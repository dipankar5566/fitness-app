import {
  detectNewPrs,
  nextProgramDayId,
  summarizeExercisePrs,
  type ExercisePrSummary,
  type NewPrFlags,
} from "@fitness-app/shared";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Crypto from "expo-crypto";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, FlatList, Pressable, Vibration, View } from "react-native";
import { AppText, Button, Card, CheckboxRow, IconButton, Stepper, TextField } from "../components/ui";
import { trackEvent } from "../lib/analytics";
import { type Program, type ProgramDay } from "../lib/api";
import { loadGuestSession } from "../lib/auth-storage";
import { getDatabase } from "../lib/db";
import { API_URL } from "../lib/env";
import { loadHcSettings, writeWorkoutToHc } from "../lib/health-connect";
import { FOLLOWED_PROGRAM_KEY, getKv } from "../lib/kv-store";
import { syncNow } from "../lib/sync-engine";
import {
  endSession,
  getActiveSession,
  getLastUsedProgramDayId,
  insertSession,
  insertSet,
  listSetsForExercise,
  listSetsForSession,
  type LocalWorkoutSession,
  type LocalWorkoutSet,
} from "../lib/workout-repo";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { makeStyles, radius, space, useTheme } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "WorkoutSession">;

/** Default rest between sets - adjustable +/-15s, matching a typical working-set rest window.
 * Not persisted or configurable per exercise in v1; just a sensible starting point. */
const DEFAULT_REST_SECONDS = 90;
const REST_STEP_SECONDS = 15;

function describeNewPr(flags: NewPrFlags): string {
  const kinds = [
    flags.isWeightPr && "heaviest weight",
    flags.isRepPr && "most reps at this weight",
    flags.isOneRmPr && "best estimated 1RM",
  ].filter((k): k is string => Boolean(k));
  return `New PR - ${kinds.join(", ")}`;
}

function formatRest(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Most recent set for an exercise, by updated_at (listSetsForExercise has no ORDER BY - it's
 * meant for PR aggregation, which doesn't care about order). ISO-8601 strings sort lexicographically. */
function mostRecentSet(history: LocalWorkoutSet[]): LocalWorkoutSet | null {
  if (history.length === 0) return null;
  return history.reduce((latest, set) => (set.updatedAt > latest.updatedAt ? set : latest));
}

interface SetGroup {
  exerciseId: string;
  exerciseName: string;
  sets: LocalWorkoutSet[];
}

function groupSetsByExercise(sets: LocalWorkoutSet[]): SetGroup[] {
  const order: string[] = [];
  const byExercise = new Map<string, SetGroup>();
  for (const set of sets) {
    if (!byExercise.has(set.exerciseId)) {
      order.push(set.exerciseId);
      byExercise.set(set.exerciseId, { exerciseId: set.exerciseId, exerciseName: set.exerciseName ?? set.exerciseId, sets: [] });
    }
    byExercise.get(set.exerciseId)!.sets.push(set);
  }
  return order.map((id) => byExercise.get(id)!);
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingBottom: space.xxxl },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xxl, backgroundColor: colors.bg },
  inputRow: { marginTop: space.md, gap: space.md },
  prBanner: { backgroundColor: colors.successTonal, borderRadius: radius.md, padding: space.md, marginBottom: space.md },
  planDayRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: space.sm, minHeight: 44, alignItems: "center" },
  planDayBorder: { borderTopWidth: 1, borderTopColor: colors.separator },
  restCard: { backgroundColor: colors.primaryTonal, flexDirection: "row", alignItems: "center", marginTop: space.md, padding: space.md },
  restControls: { flexDirection: "row", alignItems: "center", gap: space.sm },
  groupHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: space.xs },
  setRow: { paddingVertical: space.xs, borderTopWidth: 1, borderTopColor: colors.separator },
  setRowFirst: { borderTopWidth: 0 },
}));

/**
 * Start/resume today's session, add sets (picking an exercise hands off to ExerciseLibraryScreen
 * in "pickExercise" mode, which hands the result back via route.params.pickedExercise - the same
 * "pass params back to a screen already in the stack" pattern CreateCustomFoodScreen uses), and end
 * it - all against local SQLite via workout-repo.ts, synced the same way food_log already is.
 * set_no is numbered per exercise within the session (each exercise's own 1st/2nd/3rd set), not a
 * single session-wide counter - that's what a "sets per exercise" workout log actually means.
 *
 * Redesigned per docs/UI_UX_AUDIT.md H3: Stepper controls (prefilled from the exercise's most
 * recent set) replace three bare text fields, a one-tap "Repeat last set" skips the form
 * entirely for the common case, a rest timer auto-starts after each save, and sets are grouped by
 * exercise instead of one flat chronological list.
 */
export function WorkoutSessionScreen({ navigation, route }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { accountId } = route.params;
  const [session, setSession] = useState<LocalWorkoutSession | null>(null);
  const [sets, setSets] = useState<LocalWorkoutSet[]>([]);
  const [pendingExercise, setPendingExercise] = useState<{ id: string; name: string } | null>(null);
  const [priorPrSummary, setPriorPrSummary] = useState<ExercisePrSummary | null>(null);
  const [lastSet, setLastSet] = useState<LocalWorkoutSet | null>(null);
  const [newPrFlags, setNewPrFlags] = useState<NewPrFlags | null>(null);
  const [todaysPlan, setTodaysPlan] = useState<ProgramDay | null>(null);
  const [reps, setReps] = useState(8);
  const [weightKg, setWeightKg] = useState(0);
  const [rpe, setRpe] = useState("");
  const [isWarmup, setIsWarmup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restSecondsLeft, setRestSecondsLeft] = useState<number | null>(null);
  const restTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    const db = await getDatabase();
    const active = await getActiveSession(db, accountId);
    setSession(active);
    setSets(active ? await listSetsForSession(db, active.id) : []);

    if (active?.programDayId) {
      const cached = await getKv(db, FOLLOWED_PROGRAM_KEY);
      const program = cached ? (JSON.parse(cached) as Program) : null;
      setTodaysPlan(program?.days.find((day) => day.id === active.programDayId) ?? null);
    } else {
      setTodaysPlan(null);
    }
  }, [accountId]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  // Rest timer: one-second tick while active; clears itself (and vibrates once) at zero.
  useEffect(() => {
    if (restSecondsLeft === null) {
      if (restTimerRef.current) clearInterval(restTimerRef.current);
      return;
    }
    if (restSecondsLeft <= 0) {
      Vibration.vibrate(400);
      setRestSecondsLeft(null);
      return;
    }
    restTimerRef.current = setInterval(() => {
      setRestSecondsLeft((current) => (current === null ? null : current - 1));
    }, 1000);
    return () => {
      if (restTimerRef.current) clearInterval(restTimerRef.current);
    };
  }, [restSecondsLeft]);

  // Shared by both "pick an exercise from the library" (via route params) and "tap a planned
  // exercise from today's program day" - fetched fresh every time (even re-selecting the same
  // exercise later in this session) so it reflects a set just logged moments ago, since a PR is a
  // lifetime record, not a per-session one.
  const selectExerciseToLog = useCallback(
    async (exercise: { id: string; name: string }) => {
      setPendingExercise(exercise);
      setNewPrFlags(null);
      setError(null);
      const db = await getDatabase();
      const history = await listSetsForExercise(db, accountId, exercise.id);
      setPriorPrSummary(summarizeExercisePrs(history));
      const recent = mostRecentSet(history);
      setLastSet(recent);
      setReps(recent?.reps ?? 8);
      setWeightKg(recent?.weightKg ?? 0);
      setRpe("");
      setIsWarmup(false);
    },
    [accountId],
  );

  useEffect(() => {
    const picked = route.params.pickedExercise;
    if (picked) {
      navigation.setParams({ pickedExercise: undefined });
      void selectExerciseToLog({ id: picked.id, name: picked.name });
    }
  }, [route.params.pickedExercise, navigation, selectExerciseToLog]);

  const handleStart = async () => {
    const guestSession = await loadGuestSession();
    if (!guestSession) return;
    const db = await getDatabase();
    const now = new Date().toISOString();

    // "Follow a program -> today's session" (PRD section 5.4): if a program is followed, cycle to
    // its next day based on which day this account last trained (no server-side "follows" table -
    // ARCHITECTURE.md section 2 - so this is entirely local, reading the cached program JSON
    // ProgramsScreen wrote when the user followed it).
    let programDayId: string | null = null;
    const cachedProgram = await getKv(db, FOLLOWED_PROGRAM_KEY);
    if (cachedProgram) {
      const program = JSON.parse(cachedProgram) as Program;
      const dayIds = program.days.map((day) => day.id);
      const lastUsedDayId = await getLastUsedProgramDayId(db, guestSession.accountId, dayIds);
      programDayId = nextProgramDayId(dayIds, lastUsedDayId);
    }

    await insertSession(db, {
      id: Crypto.randomUUID(),
      accountId: guestSession.accountId,
      programDayId,
      startedAt: now,
      endedAt: null,
      isDeleted: false,
      updatedAt: now,
    });
    trackEvent("workout_started");
    await refresh();
    void syncNow(db, API_URL, guestSession.accessToken);
  };

  const handleEnd = () => {
    if (!session) return;
    // Previously ended immediately on tap - a mis-tap mid-session had no recovery
    // (docs/UI_UX_AUDIT.md H3).
    Alert.alert("End workout?", "You can still add sets later today by starting a new session.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "End workout",
        style: "destructive",
        onPress: () => {
          void (async () => {
            const guestSession = await loadGuestSession();
            if (!guestSession) return;
            const db = await getDatabase();
            const now = new Date().toISOString();
            await endSession(db, session.id, now, now);
            trackEvent("workout_ended");

            // Opt-in Health Connect write (HealthConnectScreen) - a best-effort side effect, not
            // awaited alongside the local end/sync above, since a Health Connect failure
            // shouldn't block or delay ending the workout in this app's own data.
            const hcSettings = await loadHcSettings(db);
            if (hcSettings.writeWorkout) {
              void writeWorkoutToHc({ startedAt: session.startedAt, endedAt: now });
            }

            setRestSecondsLeft(null);
            await refresh();
            void syncNow(db, API_URL, guestSession.accessToken);
          })();
        },
      },
    ]);
  };

  const saveSet = async (setReps: number, setWeightKg: number, setRpe: number | null, setIsWarmup: boolean) => {
    if (!session || !pendingExercise) return;
    const guestSession = await loadGuestSession();
    if (!guestSession) return;
    const db = await getDatabase();
    const now = new Date().toISOString();
    const setNo = sets.filter((s) => s.exerciseId === pendingExercise.id).length + 1;
    const setInput = { reps: setReps, weightKg: setWeightKg, isWarmup: setIsWarmup };

    await insertSet(db, {
      id: Crypto.randomUUID(),
      accountId: guestSession.accountId,
      sessionId: session.id,
      exerciseId: pendingExercise.id,
      exerciseName: pendingExercise.name,
      setNo,
      reps: setReps,
      weightKg: setWeightKg,
      rpe: setRpe,
      isWarmup: setIsWarmup,
      isDeleted: false,
      updatedAt: now,
    });
    trackEvent("set_logged");
    const flags = priorPrSummary ? detectNewPrs(priorPrSummary, setInput) : null;
    if (flags && (flags.isWeightPr || flags.isRepPr || flags.isOneRmPr)) {
      trackEvent("workout_pr_set");
      setNewPrFlags(flags);
    }
    setPendingExercise(null);
    setPriorPrSummary(null);
    setLastSet(null);
    setError(null);
    if (!setIsWarmup) {
      setRestSecondsLeft(DEFAULT_REST_SECONDS);
    }
    await refresh();
    void syncNow(db, API_URL, guestSession.accessToken);
  };

  const handleSaveSet = async () => {
    if (!Number.isInteger(reps) || reps <= 0) {
      setError("Enter a valid number of reps.");
      return;
    }
    if (!Number.isFinite(weightKg) || weightKg < 0) {
      setError("Enter a valid weight.");
      return;
    }
    const parsedRpe = rpe.trim() === "" ? null : Number(rpe);
    if (parsedRpe !== null && (!Number.isFinite(parsedRpe) || parsedRpe < 1 || parsedRpe > 10)) {
      setError("RPE must be between 1 and 10.");
      return;
    }
    await saveSet(reps, weightKg, parsedRpe, isWarmup);
  };

  const handleRepeatLastSet = async () => {
    if (!lastSet) return;
    await saveSet(lastSet.reps, lastSet.weightKg, null, false);
  };

  const adjustRest = (deltaSeconds: number) => {
    setRestSecondsLeft((current) => (current === null ? null : Math.max(0, current + deltaSeconds)));
  };

  if (!session) {
    return (
      <View style={styles.emptyState}>
        <AppText color={colors.textSecondary} style={{ marginBottom: space.lg }}>No workout in progress.</AppText>
        <Button title="Start workout" onPress={() => void handleStart()} style={{ minWidth: 180 }} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={groupSetsByExercise(sets)}
      keyExtractor={(group) => group.exerciseId}
      ListHeaderComponent={
        <View>
          <AppText color={colors.textSecondary} style={{ marginBottom: space.sm }}>
            Started {new Date(session.startedAt).toLocaleTimeString()}
          </AppText>

          {restSecondsLeft !== null ? (
            <Card style={styles.restCard}>
              <View style={{ flex: 1 }}>
                <AppText variant="caption" color={colors.primaryDark}>Rest</AppText>
                <AppText variant="display" numbers color={colors.primaryDark}>{formatRest(restSecondsLeft)}</AppText>
              </View>
              <View style={styles.restControls}>
                <IconButton icon="minus" label="15 seconds less rest" onPress={() => adjustRest(-REST_STEP_SECONDS)} color={colors.primaryDark} />
                <IconButton icon="plus" label="15 seconds more rest" onPress={() => adjustRest(REST_STEP_SECONDS)} color={colors.primaryDark} />
                <Button title="Skip" variant="ghost" onPress={() => setRestSecondsLeft(null)} />
              </View>
            </Card>
          ) : null}

          {pendingExercise ? (
            <Card style={{ marginTop: space.md }}>
              <AppText variant="h3">{pendingExercise.name}</AppText>
              {priorPrSummary && (priorPrSummary.bestWeightKg !== null || priorPrSummary.bestEstimatedOneRm !== null) ? (
                <AppText variant="caption" color={colors.textSecondary} numbers style={{ marginTop: space.xxs }}>
                  Best: {priorPrSummary.bestWeightKg} kg
                  {priorPrSummary.bestEstimatedOneRm !== null
                    ? ` · Est. 1RM: ${priorPrSummary.bestEstimatedOneRm} kg`
                    : ""}
                </AppText>
              ) : null}
              {lastSet ? (
                <Button
                  title={`Repeat last set (${lastSet.reps} × ${lastSet.weightKg} kg)`}
                  variant="secondary"
                  onPress={() => void handleRepeatLastSet()}
                  style={{ marginTop: space.md }}
                />
              ) : null}
              <View style={styles.inputRow}>
                <Stepper label="Reps" value={reps} onChange={setReps} step={1} min={1} />
                <Stepper label="Weight" value={weightKg} onChange={setWeightKg} step={2.5} min={0} precision={1} suffix=" kg" />
                <TextField label="RPE (optional, 1-10)" keyboardType="numeric" value={rpe} onChangeText={setRpe} />
              </View>
              <CheckboxRow label="Warm-up set" checked={isWarmup} onChange={setIsWarmup} style={{ marginTop: space.md }} />
              {error ? <AppText color={colors.error} style={{ marginTop: space.sm }}>{error}</AppText> : null}
              <Button title="Save set" onPress={() => void handleSaveSet()} style={{ marginTop: space.md }} />
              <Button title="Cancel" variant="ghost" onPress={() => setPendingExercise(null)} style={{ marginTop: space.sm }} />
            </Card>
          ) : (
            <View style={{ marginTop: space.md }}>
              {newPrFlags ? (
                <View style={styles.prBanner}>
                  <AppText variant="bodyMedium" color={colors.success} center>{describeNewPr(newPrFlags)}</AppText>
                </View>
              ) : null}
              {todaysPlan ? (
                <Card style={{ marginBottom: space.md }}>
                  <AppText variant="h3" style={{ marginBottom: space.sm }}>Today's plan: {todaysPlan.name}</AppText>
                  {todaysPlan.exercises.map((exercise, index) => (
                    <Pressable
                      key={exercise.exerciseId}
                      onPress={() => void selectExerciseToLog({ id: exercise.exerciseId, name: exercise.exerciseName })}
                      accessibilityRole="button"
                      style={[styles.planDayRow, index > 0 && styles.planDayBorder]}
                    >
                      <AppText variant="bodyMedium" style={{ flex: 1 }}>{exercise.exerciseName}</AppText>
                      <AppText color={colors.textSecondary} numbers>
                        {exercise.targetSets} × {exercise.targetReps ?? "-"}
                      </AppText>
                    </Pressable>
                  ))}
                </Card>
              ) : null}
              <Button
                title="Add exercise"
                variant="secondary"
                onPress={() => navigation.navigate("ExerciseLibrary", { accountId, mode: "pickExercise" })}
              />
            </View>
          )}

          <Button title="End workout" variant="danger" onPress={handleEnd} style={{ marginTop: space.lg }} />
          {sets.length === 0 ? (
            <AppText color={colors.textTertiary} center style={{ marginTop: space.lg }}>No sets logged yet.</AppText>
          ) : null}
        </View>
      }
      renderItem={({ item: group }) => (
        <Card style={{ marginTop: space.md }}>
          <View style={styles.groupHeader}>
            <AppText variant="h3">{group.exerciseName}</AppText>
            <AppText variant="caption" color={colors.textSecondary}>{group.sets.length} set{group.sets.length === 1 ? "" : "s"}</AppText>
          </View>
          {group.sets.map((item, index) => (
            <View key={item.id} style={[styles.setRow, index === 0 && styles.setRowFirst]}>
              <AppText variant="bodyMedium" numbers>
                Set {item.setNo}: {item.reps} reps × {item.weightKg} kg
                {item.rpe !== null ? ` @ RPE ${item.rpe}` : ""}
                {item.isWarmup ? " (warm-up)" : ""}
              </AppText>
            </View>
          ))}
        </Card>
      )}
    />
  );
}
