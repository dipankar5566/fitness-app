import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import {
  ExerciseType,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  insertRecords,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
  type ExerciseSessionRecord,
  type HealthConnectRecord,
  type Permission,
} from "react-native-health-connect";
import { insert as insertBodyMetric, type LocalBodyMetric } from "./body-metric-repo";
import { getKv, HC_SETTINGS_KEY, setKv } from "./kv-store";
import type { SqlDb } from "./sql-db";
import { syncNow } from "./sync-engine";

/**
 * Health Connect read (steps/exercise/weight) + opt-in write (workouts) - CLAUDE.md M5, PRD §5.6.
 * Android-only (Health Connect has no iOS/web equivalent this library supports) - every exported
 * function here is a no-op/safe-default off Android, so callers don't need their own Platform
 * guard at every call site. Weight is imported into the local body_metric mirror (and from there,
 * synced like every other table) rather than just displayed - see body-metric-repo.ts's docstring
 * for why `insert` there is idempotent by id. Steps/exercise sessions are read live and shown,
 * never persisted locally - there's no feature yet that needs their history, only "today".
 */

export type HcStatus = "unsupported_platform" | "unavailable" | "update_required" | "available";

/** How far back a weight import looks (months, not days) - a past Health Connect weight entry
 * never changes, so there's no cost to re-checking a wide window every time; body-metric-repo's
 * idempotent insert keeps re-imports from ever duplicating. Used by both HealthConnectScreen's
 * manual "Import weight now" and HomeScreen's on-focus auto-import. */
export const WEIGHT_IMPORT_LOOKBACK_DAYS = 365;

export async function getHcStatus(): Promise<HcStatus> {
  if (Platform.OS !== "android") {
    return "unsupported_platform";
  }
  const status = await getSdkStatus();
  if (status === SdkAvailabilityStatus.SDK_AVAILABLE) {
    return "available";
  }
  if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
    return "update_required";
  }
  return "unavailable";
}

/** Per-data-type opt-in, persisted in kv (HC_SETTINGS_KEY) - each flag is independent, matching
 * PRD §5.6's "opt-in per data type" and the DPDP-minded "ask only for what's actually on" posture
 * reminders.ts already follows. Starts fully off; HealthConnectScreen is the only writer. */
export interface HcSettings {
  steps: boolean;
  exercise: boolean;
  weight: boolean;
  writeWorkout: boolean;
}

const DEFAULT_HC_SETTINGS: HcSettings = { steps: false, exercise: false, weight: false, writeWorkout: false };

/** Falls back to every flag off for missing/malformed input, same policy as
 * reminders.ts's parseReminderSettings - a corrupt stored value degrades to "nothing enabled"
 * rather than crashing a screen or (worse) silently enabling a data type the user never opted into. */
export function parseHcSettings(json: string | null): HcSettings {
  if (!json) return DEFAULT_HC_SETTINGS;
  try {
    const parsed = JSON.parse(json) as Partial<Record<keyof HcSettings, unknown>>;
    if (typeof parsed !== "object" || parsed === null) return DEFAULT_HC_SETTINGS;
    return {
      steps: Boolean(parsed.steps),
      exercise: Boolean(parsed.exercise),
      weight: Boolean(parsed.weight),
      writeWorkout: Boolean(parsed.writeWorkout),
    };
  } catch {
    return DEFAULT_HC_SETTINGS;
  }
}

export async function loadHcSettings(db: SqlDb): Promise<HcSettings> {
  return parseHcSettings(await getKv(db, HC_SETTINGS_KEY));
}

export async function saveHcSettings(db: SqlDb, settings: HcSettings): Promise<void> {
  await setKv(db, HC_SETTINGS_KEY, JSON.stringify(settings));
}

export type HcPermissionKind = "steps" | "exercise" | "weight" | "write_exercise";

const PERMISSION_BY_KIND: Record<HcPermissionKind, Permission> = {
  steps: { accessType: "read", recordType: "Steps" },
  exercise: { accessType: "read", recordType: "ExerciseSession" },
  weight: { accessType: "read", recordType: "Weight" },
  write_exercise: { accessType: "write", recordType: "ExerciseSession" },
};

/** True if every requested kind is already granted - checked against getGrantedPermissions
 * rather than assuming the result of a past requestHcPermissions call is still valid, since the
 * user can revoke access from the Health Connect app at any time outside this app's control. */
export async function hasHcPermissions(kinds: HcPermissionKind[]): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  const granted = await getGrantedPermissions();
  return kinds.every((kind) => {
    const wanted = PERMISSION_BY_KIND[kind];
    return granted.some((p) => "recordType" in p && p.recordType === wanted.recordType && p.accessType === wanted.accessType);
  });
}

/** Requests the given permission kinds, initializing the SDK first (required before any other
 * call). Returns whether every requested kind ended up granted. */
export async function requestHcPermissions(kinds: HcPermissionKind[]): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  await initialize();
  await requestPermission(kinds.map((kind) => PERMISSION_BY_KIND[kind]));
  return hasHcPermissions(kinds);
}

/** Today's step count so far (local calendar day, device-local time - the same "today" the rest
 * of the app uses), summed across every Steps record HC returns for the window. */
export async function readTodaySteps(): Promise<number> {
  if (Platform.OS !== "android") return 0;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { records } = await readRecords("Steps", {
    timeRangeFilter: { operator: "between", startTime: startOfDay.toISOString(), endTime: new Date().toISOString() },
  });
  return records.reduce((sum, record) => sum + record.count, 0);
}

export interface HcExerciseSessionSummary {
  id: string | null;
  title: string | null;
  startTime: string;
  endTime: string;
}

/** Exercise sessions logged via any app that writes to Health Connect, most recent first - shown
 * on Today as "latest activity", not stored locally (see module docstring). */
export async function readRecentExerciseSessions(days: number): Promise<HcExerciseSessionSummary[]> {
  if (Platform.OS !== "android") return [];
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const { records } = await readRecords("ExerciseSession", {
    timeRangeFilter: { operator: "between", startTime: since.toISOString(), endTime: new Date().toISOString() },
  });
  return records
    .map((record) => ({
      id: record.metadata?.id ?? null,
      title: record.title ?? null,
      startTime: record.startTime,
      endTime: record.endTime,
    }))
    .sort((a, b) => b.startTime.localeCompare(a.startTime));
}

/** A raw Health Connect weight reading, extracted down to just what toBodyMetricWeightRow needs -
 * the pure mapping step (unlike the native readRecords call that produces it). Null if the record
 * has no Health Connect id, since that id is what makes re-import idempotent (body-metric-repo's
 * dedup key) - a record HC itself can't identify isn't safely importable. */
export interface HcWeightReading {
  hcRecordId: string;
  valueKg: number;
  recordedAtIso: string;
}

export function extractWeightReading(record: { metadata?: { id?: string }; weight: { inKilograms: number }; time: string }): HcWeightReading | null {
  const hcRecordId = record.metadata?.id;
  if (!hcRecordId) return null;
  return { hcRecordId, valueKg: record.weight.inKilograms, recordedAtIso: record.time };
}

/** Builds the local body_metric row for one weight reading - pure given a precomputed id (the
 * caller derives that id from the reading's own hcRecordId via a stable hash, see
 * importHcWeights - kept out of this function so it stays synchronous and trivially testable). */
export function toBodyMetricWeightRow(id: string, accountId: string, reading: HcWeightReading): LocalBodyMetric {
  return {
    id,
    accountId,
    metricType: "weight_kg",
    value: reading.valueKg,
    photoRef: null,
    recordedAt: reading.recordedAtIso,
    isDeleted: false,
    updatedAt: new Date().toISOString(),
  };
}

/** sha1("hc-weight:<hc record id>"), formatted as a UUID - the same deterministic-hash approach
 * db/seed-programs.ts uses for its own stable ids, via expo-crypto since this runs on-device
 * (node:crypto isn't available in React Native). Deterministic so re-importing the same HC record
 * always produces the same local id - body-metric-repo.insert's INSERT OR IGNORE then makes a
 * re-import a no-op instead of a duplicate. */
export async function stableIdForHcWeight(hcRecordId: string): Promise<string> {
  const hex = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA1, `hc-weight:${hcRecordId}`);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** Reads every Weight record since `sinceIso`, maps and inserts any not already imported, then
 * syncs - the orchestration step that ties the pure pieces above to the native read and the local
 * outbox. Returns how many readings were newly imported (0 if everything was already present). */
export async function importHcWeights(
  db: SqlDb,
  apiUrl: string,
  accessToken: string,
  accountId: string,
  sinceIso: string,
): Promise<number> {
  if (Platform.OS !== "android") return 0;
  const { records } = await readRecords("Weight", {
    timeRangeFilter: { operator: "between", startTime: sinceIso, endTime: new Date().toISOString() },
  });

  let imported = 0;
  for (const record of records) {
    const reading = extractWeightReading(record);
    if (!reading) continue;
    const id = await stableIdForHcWeight(reading.hcRecordId);
    await insertBodyMetric(db, toBodyMetricWeightRow(id, accountId, reading));
    imported += 1;
  }
  if (imported > 0) {
    await syncNow(db, apiUrl, accessToken);
  }
  return imported;
}

/** Maps a local workout session into the Health Connect write payload - pure, no native call.
 * Always written as strength training: this app has no exercise-type taxonomy that maps onto
 * Health Connect's broader ExerciseType enum yet (PRD's workout logger is a simple set/rep
 * logger, not categorized by cardio/strength/etc.), and every exercise in the built-in programs
 * (CLAUDE.md M3) is a resistance exercise. */
export function mapSessionToHcExercisePayload(session: { startedAt: string; endedAt: string }): ExerciseSessionRecord {
  return {
    recordType: "ExerciseSession",
    exerciseType: ExerciseType.STRENGTH_TRAINING,
    startTime: session.startedAt,
    endTime: session.endedAt,
    title: "Workout",
  };
}

/** Writes one ended workout session to Health Connect - called from WorkoutSessionScreen's "End
 * workout" only when the user has opted into workout write (HC_SETTINGS_KEY, see
 * HealthConnectScreen). A session without an endedAt can't be written (Health Connect's
 * ExerciseSessionRecord requires both ends), so the caller must only call this after ending. */
export async function writeWorkoutToHc(session: { startedAt: string; endedAt: string }): Promise<void> {
  if (Platform.OS !== "android") return;
  const payload = mapSessionToHcExercisePayload(session);
  await insertRecords([payload as HealthConnectRecord]);
}
