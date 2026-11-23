import {
  activeFast,
  completedFasts,
  ED_SIGNAL_RESPONSE,
  fastingCaution,
  fastingProgress,
  FASTING_PRESETS,
  fastTargetReachedAt,
  formatFastingDuration,
} from "@fitness-app/shared";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Crypto from "expo-crypto";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { loadGuestSession } from "../lib/auth-storage";
import { getDatabase } from "../lib/db";
import { API_URL } from "../lib/env";
import { end as endFast, listRecent, start as startFast, type LocalFastingLog } from "../lib/fasting-repo";
import { listByLocalDay } from "../lib/food-log-repo";
import { cancelFastCompleteNotification, scheduleFastCompleteNotification } from "../lib/reminders";
import { syncNow } from "../lib/sync-engine";
import { makeStyles, space, useTheme } from "../theme";
import { ChipSelect } from "./ChipSelect";
import { ProgressRing } from "./Charts";
import { AppText, Button, Card } from "./ui";

const DEFAULT_PRESET = "16:8";
/** Past completed days checked by fastingCaution - not today, whose partial total is meaningless. */
const CAUTION_LOOKBACK_DAYS = 2;

function localDateDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

interface FastingCardProps {
  accountId: string;
  /** Bumped by the parent on focus so the card re-reads the local mirror (e.g. after a sync). */
  refreshKey: number;
  /** Called after any write so the parent can refresh derived views (achievements, etc.). */
  onChange?: () => void;
}

const useStyles = makeStyles(() => ({
  header: { flexDirection: "row", alignItems: "center" },
  activeRow: { flexDirection: "row", alignItems: "center", marginTop: space.md },
}));

/**
 * Today's intermittent-fasting card (PRD §5.1 "IF window mode"). Storage is fasting-repo.ts (the
 * local outbox, synced via /sync); all window math is packages/shared's fasting.ts. Safety: presets
 * stop at 20h, and when recent logged days already look like severe restriction (fastingCaution),
 * the card shows support resources instead of offering to start a fast.
 */
export function FastingCard({ accountId, refreshKey, onChange }: FastingCardProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [rows, setRows] = useState<LocalFastingLog[]>([]);
  const [preset, setPreset] = useState(DEFAULT_PRESET);
  const [caution, setCaution] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const db = await getDatabase();
    setRows(await listRecent(db, accountId));
    const pastKcal: number[] = [];
    for (let i = 1; i <= CAUTION_LOOKBACK_DAYS; i++) {
      const entries = await listByLocalDay(db, accountId, localDateDaysAgo(i));
      pastKcal.push(entries.reduce((sum, e) => sum + (e.macros?.kcal ?? 0), 0));
    }
    setCaution(fastingCaution(pastKcal));
  }, [accountId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const active = activeFast(rows);

  // Minute tick only while a fast is running - nothing to animate otherwise.
  useEffect(() => {
    if (!active) return;
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, [active]);

  const afterWrite = useCallback(async () => {
    await load();
    onChange?.();
    const session = await loadGuestSession();
    if (session) {
      void syncNow(await getDatabase(), API_URL, session.accessToken);
    }
  }, [load, onChange]);

  const onStart = useCallback(async () => {
    const chosen = FASTING_PRESETS.find((p) => p.label === preset) ?? FASTING_PRESETS[2];
    const startedAt = new Date().toISOString();
    const targetMinutes = chosen.fastHours * 60;
    setBusy(true);
    try {
      const db = await getDatabase();
      await startFast(db, { id: Crypto.randomUUID(), accountId, startedAt, targetMinutes, updatedAt: startedAt });
      void scheduleFastCompleteNotification(fastTargetReachedAt(startedAt, targetMinutes)).catch(() => undefined);
      await afterWrite();
    } finally {
      setBusy(false);
    }
  }, [accountId, afterWrite, preset]);

  const onEnd = useCallback(async () => {
    if (!active) return;
    setBusy(true);
    try {
      const db = await getDatabase();
      await endFast(db, active.id, new Date().toISOString());
      void cancelFastCompleteNotification().catch(() => undefined);
      await afterWrite();
    } finally {
      setBusy(false);
    }
  }, [active, afterWrite]);

  const completedCount = completedFasts(rows).length;

  return (
    <Card style={{ marginTop: space.lg }}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="timer-sand" size={20} color={colors.primary} />
        <AppText variant="bodyMedium" style={{ marginLeft: space.sm, flex: 1 }}>Fasting</AppText>
        {completedCount > 0 ? (
          <AppText variant="caption" color={colors.textTertiary}>{completedCount} completed</AppText>
        ) : null}
      </View>

      {active ? (
        <ActiveFast fast={active} now={now} busy={busy} onEnd={() => void onEnd()} />
      ) : caution ? (
        <AppText variant="body" color={colors.textSecondary} style={{ marginTop: space.sm }}>
          {ED_SIGNAL_RESPONSE}
        </AppText>
      ) : (
        <View style={{ marginTop: space.sm }}>
          <ChipSelect
            label="Fast : eating window (hours)"
            options={FASTING_PRESETS.map((p) => p.label)}
            value={preset}
            onChange={setPreset}
          />
          <Button title={`Start ${preset} fast`} loading={busy} onPress={() => void onStart()} style={{ marginTop: space.sm }} />
        </View>
      )}
    </Card>
  );
}

function ActiveFast({
  fast,
  now,
  busy,
  onEnd,
}: {
  fast: LocalFastingLog;
  now: Date;
  busy: boolean;
  onEnd: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const progress = fastingProgress(fast.startedAt, fast.targetMinutes, now);
  const opensAt = fastTargetReachedAt(fast.startedAt, fast.targetMinutes);
  return (
    <View style={styles.activeRow}>
      <ProgressRing
        progress={progress.fraction}
        size={96}
        strokeWidth={9}
        accessibilityLabel={`Fasting progress: ${formatFastingDuration(progress.elapsedMinutes)} elapsed`}
      >
        <AppText variant="captionMedium" numbers>{formatFastingDuration(progress.elapsedMinutes)}</AppText>
      </ProgressRing>
      <View style={{ flex: 1, marginLeft: space.lg }}>
        <AppText variant="bodyMedium">
          {progress.isComplete ? "Goal reached - eating window open" : `${formatFastingDuration(progress.remainingMinutes)} to go`}
        </AppText>
        <AppText variant="caption" color={colors.textSecondary} style={{ marginTop: space.xs }}>
          {fast.targetMinutes / 60}h goal · window opens{" "}
          {opensAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </AppText>
        <Button
          title="End fast"
          variant={progress.isComplete ? "primary" : "secondary"}
          loading={busy}
          onPress={onEnd}
          style={{ marginTop: space.sm }}
        />
      </View>
    </View>
  );
}
