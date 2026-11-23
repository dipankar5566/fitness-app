import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import { Alert, Linking, Switch, View } from "react-native";
import { AppText, Button, Card, Screen, SectionHeader } from "../components/ui";
import { loadGuestSession } from "../lib/auth-storage";
import { getDatabase } from "../lib/db";
import { API_URL } from "../lib/env";
import {
  getHcStatus,
  hasHcPermissions,
  importHcWeights,
  loadHcSettings,
  requestHcPermissions,
  saveHcSettings,
  WEIGHT_IMPORT_LOOKBACK_DAYS,
  type HcPermissionKind,
  type HcSettings,
  type HcStatus,
} from "../lib/health-connect";
import { getKv, HC_LAST_READ_KEY } from "../lib/kv-store";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { space, useTheme } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "HealthConnect">;

const STATUS_LABEL: Record<HcStatus, string> = {
  unsupported_platform: "Health Connect is only available on Android.",
  unavailable: "Health Connect isn't installed on this device.",
  update_required: "Health Connect needs an update before it can be used.",
  available: "Health Connect is ready.",
};

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

type ReadKind = Exclude<HcPermissionKind, "write_exercise">;
const READ_KINDS: ReadKind[] = ["steps", "exercise", "weight", "sleep"];

/**
 * Health Connect read (steps/exercise/weight) + opt-in write (workouts) settings - PRD §5.6,
 * CLAUDE.md M5. Each data type is its own toggle (ARCHITECTURE.md §7: "opt-in per data type") -
 * turning one on requests only that type's permission and, on denial, leaves it off rather than
 * silently failing later. Permission state shown per type comes from hasHcPermissions (a live
 * check against Health Connect itself, not the saved toggle) since the account can revoke access
 * from the Health Connect app at any time outside this screen's control - the toggle alone can't
 * tell that apart from "never granted". `consent_record` (ARCHITECTURE.md §8/PRD §7) isn't written
 * here - that belongs to M6's DPDP pass (ROADMAP.md M6), not this feature.
 */
export function HealthConnectScreen({ route }: Props) {
  const { accountId } = route.params;
  const { colors } = useTheme();
  const [status, setStatus] = useState<HcStatus | null>(null);
  const [settings, setSettings] = useState<HcSettings | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState<Partial<Record<ReadKind, boolean>>>({});
  const [lastReadAt, setLastReadAt] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const hcStatus = await getHcStatus();
    setStatus(hcStatus);
    const db = await getDatabase();
    const loaded = await loadHcSettings(db);
    setSettings(loaded);
    setLastReadAt(await getKv(db, HC_LAST_READ_KEY));
    if (hcStatus === "available") {
      const enabledKinds = READ_KINDS.filter((kind) => loaded[kind]);
      const checked = await Promise.all(enabledKinds.map((kind) => hasHcPermissions([kind])));
      const next: Partial<Record<ReadKind, boolean>> = {};
      enabledKinds.forEach((kind, i) => {
        next[kind] = checked[i];
      });
      setPermissionGranted(next);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleToggle = useCallback(
    async (key: keyof HcSettings, kind: "steps" | "exercise" | "weight" | "sleep" | "write_exercise", enabled: boolean) => {
      if (!settings) return;
      if (enabled) {
        const granted = await requestHcPermissions([kind]);
        if (!granted) {
          Alert.alert("Permission denied", "Grant this permission in Health Connect to turn it on.");
          return;
        }
      }
      const next = { ...settings, [key]: enabled };
      setSettings(next);
      const db = await getDatabase();
      await saveHcSettings(db, next);
    },
    [settings],
  );

  const handleImportWeight = useCallback(async () => {
    const session = await loadGuestSession();
    if (!session) return;
    setIsImporting(true);
    try {
      const db = await getDatabase();
      const since = new Date(Date.now() - WEIGHT_IMPORT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const imported = await importHcWeights(db, API_URL, session.accessToken, accountId, since);
      Alert.alert("Import complete", imported > 0 ? `Imported ${imported} weight reading${imported === 1 ? "" : "s"}.` : "No new readings found.");
    } finally {
      setIsImporting(false);
    }
  }, [accountId]);

  if (status === null || settings === null) {
    return (
      <Screen>
        <AppText variant="body" color={colors.textSecondary}>Loading…</AppText>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Card>
        <AppText variant="bodyMedium">{STATUS_LABEL[status]}</AppText>
        {status === "unavailable" || status === "update_required" ? (
          <Button
            title={status === "unavailable" ? "Install Health Connect" : "Update Health Connect"}
            variant="secondary"
            style={{ marginTop: space.sm }}
            onPress={() => void Linking.openURL("market://details?id=com.google.android.apps.healthdata")}
          />
        ) : null}
      </Card>

      {status === "available" ? (
        <>
          <SectionHeader title="Read" style={{ marginTop: space.xl }} />
          <AppText variant="caption" color={colors.textTertiary} style={{ marginBottom: space.sm }}>
            {lastReadAt ? `Last read ${formatRelativeTime(lastReadAt)}` : "Not read yet - opens Today to start reading."}
          </AppText>
          <Card>
            <ToggleRow
              label="Steps"
              value={settings.steps}
              onChange={(v) => void handleToggle("steps", "steps", v)}
              revoked={settings.steps && permissionGranted.steps === false}
            />
            <ToggleRow
              label="Exercise sessions"
              value={settings.exercise}
              onChange={(v) => void handleToggle("exercise", "exercise", v)}
              revoked={settings.exercise && permissionGranted.exercise === false}
              style={{ marginTop: space.md }}
            />
            <ToggleRow
              label="Weight"
              value={settings.weight}
              onChange={(v) => void handleToggle("weight", "weight", v)}
              revoked={settings.weight && permissionGranted.weight === false}
              style={{ marginTop: space.md }}
            />
            <ToggleRow
              label="Sleep"
              value={settings.sleep}
              onChange={(v) => void handleToggle("sleep", "sleep", v)}
              revoked={settings.sleep && permissionGranted.sleep === false}
              style={{ marginTop: space.md }}
            />
          </Card>
          {settings.weight ? (
            <Button
              title="Import weight now"
              variant="secondary"
              loading={isImporting}
              onPress={() => void handleImportWeight()}
              style={{ marginTop: space.lg }}
            />
          ) : null}

          <SectionHeader title="Write" style={{ marginTop: space.xl }} />
          <Card>
            <ToggleRow
              label="Save workouts to Health Connect"
              value={settings.writeWorkout}
              onChange={(v) => void handleToggle("writeWorkout", "write_exercise", v)}
            />
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
  revoked = false,
  style,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  /** True when this type is toggled on locally but Health Connect no longer actually grants it
   * (revoked from outside this app) - shown as a warning instead of silently reading nothing. */
  revoked?: boolean;
  style?: object;
}) {
  const { colors } = useTheme();
  return (
    <View style={style}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <AppText variant="bodyMedium">{label}</AppText>
        <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary, false: colors.stroke }} />
      </View>
      {revoked ? (
        <AppText variant="micro" color={colors.warning} style={{ marginTop: space.xxs }}>
          Permission was revoked outside the app - toggle off and on to reconnect.
        </AppText>
      ) : null}
    </View>
  );
}
