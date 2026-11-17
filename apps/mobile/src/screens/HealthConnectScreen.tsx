import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import { Alert, Linking, Switch, View } from "react-native";
import { AppText, Button, Card, SectionHeader } from "../components/ui";
import { loadGuestSession } from "../lib/auth-storage";
import { getDatabase } from "../lib/db";
import { API_URL } from "../lib/env";
import {
  getHcStatus,
  importHcWeights,
  loadHcSettings,
  requestHcPermissions,
  saveHcSettings,
  WEIGHT_IMPORT_LOOKBACK_DAYS,
  type HcSettings,
  type HcStatus,
} from "../lib/health-connect";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors, space } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "HealthConnect">;

const STATUS_LABEL: Record<HcStatus, string> = {
  unsupported_platform: "Health Connect is only available on Android.",
  unavailable: "Health Connect isn't installed on this device.",
  update_required: "Health Connect needs an update before it can be used.",
  available: "Health Connect is ready.",
};

/**
 * Health Connect read (steps/exercise/weight) + opt-in write (workouts) settings - PRD §5.6,
 * CLAUDE.md M5. Each data type is its own toggle (ARCHITECTURE.md §7: "opt-in per data type") -
 * turning one on requests only that type's permission and, on denial, leaves it off rather than
 * silently failing later. `consent_record` (ARCHITECTURE.md §8/PRD §7) isn't written here - that
 * belongs to M6's DPDP pass (ROADMAP.md M6), not this feature.
 */
export function HealthConnectScreen({ route }: Props) {
  const { accountId } = route.params;
  const [status, setStatus] = useState<HcStatus | null>(null);
  const [settings, setSettings] = useState<HcSettings | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const refresh = useCallback(async () => {
    setStatus(await getHcStatus());
    const db = await getDatabase();
    setSettings(await loadHcSettings(db));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleToggle = useCallback(
    async (key: keyof HcSettings, kind: "steps" | "exercise" | "weight" | "write_exercise", enabled: boolean) => {
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
      <View style={{ flex: 1, padding: space.lg }}>
        <AppText variant="body" color={colors.textSecondary}>Loading…</AppText>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: space.lg }}>
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
          <Card>
            <ToggleRow
              label="Steps"
              value={settings.steps}
              onChange={(v) => void handleToggle("steps", "steps", v)}
            />
            <ToggleRow
              label="Exercise sessions"
              value={settings.exercise}
              onChange={(v) => void handleToggle("exercise", "exercise", v)}
              style={{ marginTop: space.md }}
            />
            <ToggleRow
              label="Weight"
              value={settings.weight}
              onChange={(v) => void handleToggle("weight", "weight", v)}
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
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
  style,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  style?: object;
}) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, style]}>
      <AppText variant="bodyMedium">{label}</AppText>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary, false: colors.stroke }} />
    </View>
  );
}
