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
import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { AppText, Button, Card, TextField } from "../components/ui";
import { trackEvent } from "../lib/analytics";
import { type Program, type ProgramDay } from "../lib/api";
import { loadGuestSession } from "../lib/auth-storage";
import { getDatabase } from "../lib/db";
import { API_URL } from "../lib/env";
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
import { colors, radius, space } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "WorkoutSession">;

function describeNewPr(flags: NewPrFlags): string {
  const kinds = [
    flags.isWeightPr && "heaviest weight",
    flags.isRepPr && "most reps at this weight",
    flags.isOneRmPr && "best estimated 1RM",
  ].filter((k): k is string => Boolean(k));
  return `New PR - ${kinds.join(", ")}`;
}

/**
 * Start/resume today's session, add sets (picking an exercise hands off to ExerciseLibraryScreen
 * in "pickExercise" mode, which hands the result back via route.params.pickedExercise - the same
 * "pass params back to a screen already in the stack" pattern CreateCustomFoodScreen uses), and end
 * it - all against local SQLite via workout-repo.ts, synced the same way food_log already is.
 * set_no is numbered per exercise within the session (each exercise's own 1st/2nd/3rd set), not a
 * single session-wide counter - that's what a "sets per exercise" workout log actually means.
 */
export function WorkoutSessionScreen({ navigation, route }: Props) {
  const { accountId } = route.params;
  const [session, setSession] = useState<LocalWorkoutSession | null>(null);
  const [sets, setSets] = useState<LocalWorkoutSet[]>([]);
  const [pendingExercise, setPendingExercise] = useState<{ id: string; name: string } | null>(null);
  const [priorPrSummary, setPriorPrSummary] = useState<ExercisePrSummary | null>(null);
  const [newPrFlags, setNewPrFlags] = useState<NewPrFlags | null>(null);
  const [todaysPlan, setTodaysPlan] = useState<ProgramDay | null>(null);
  const [reps, setReps] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [rpe, setRpe] = useState("");
  const [isWarmup, setIsWarmup] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Shared by both "pick an exercise from the library" (via route params) and "tap a planned
  // exercise from today's program day" - fetched fresh every time (even re-selecting the same
  // exercise later in this session) so it reflects a set just logged moments ago, since a PR is a
  // lifetime record, not a per-session one.
  const selectExerciseToLog = useCallback(
    async (exercise: { id: string; name: string }) => {
      setPendingExercise(exercise);
      setNewPrFlags(null);
      const db = await getDatabase();
      const history = await listSetsForExercise(db, accountId, exercise.id);
      setPriorPrSummary(summarizeExercisePrs(history));
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

  const handleEnd = async () => {
    if (!session) return;
    const guestSession = await loadGuestSession();
    if (!guestSession) return;
    const db = await getDatabase();
    const now = new Date().toISOString();
    await endSession(db, session.id, now, now);
    trackEvent("workout_ended");
    await refresh();
    void syncNow(db, API_URL, guestSession.accessToken);
  };

  const handleSaveSet = async () => {
    if (!session || !pendingExercise) return;
    const parsedReps = Number(reps);
    if (!Number.isInteger(parsedReps) || parsedReps <= 0) {
      setError("Enter a valid number of reps.");
      return;
    }
    const parsedWeight = weightKg.trim() === "" ? 0 : Number(weightKg);
    if (!Number.isFinite(parsedWeight) || parsedWeight < 0) {
      setError("Enter a valid weight.");
      return;
    }
    const parsedRpe = rpe.trim() === "" ? null : Number(rpe);
    if (parsedRpe !== null && (!Number.isFinite(parsedRpe) || parsedRpe < 1 || parsedRpe > 10)) {
      setError("RPE must be between 1 and 10.");
      return;
    }

    const guestSession = await loadGuestSession();
    if (!guestSession) return;
    const db = await getDatabase();
    const now = new Date().toISOString();
    const setNo = sets.filter((s) => s.exerciseId === pendingExercise.id).length + 1;
    const setInput = { reps: parsedReps, weightKg: parsedWeight, isWarmup };

    await insertSet(db, {
      id: Crypto.randomUUID(),
      accountId: guestSession.accountId,
      sessionId: session.id,
      exerciseId: pendingExercise.id,
      exerciseName: pendingExercise.name,
      setNo,
      reps: parsedReps,
      weightKg: parsedWeight,
      rpe: parsedRpe,
      isWarmup,
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
    setReps("");
    setWeightKg("");
    setRpe("");
    setIsWarmup(false);
    setError(null);
    await refresh();
    void syncNow(db, API_URL, guestSession.accessToken);
  };

  if (!session) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: space.xxl, backgroundColor: colors.bg }}>
        <AppText color={colors.textSecondary} style={{ marginBottom: space.lg }}>No workout in progress.</AppText>
        <Button title="Start workout" onPress={() => void handleStart()} style={{ minWidth: 180 }} />
      </View>
    );
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxxl }}
      data={sets}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View>
          <AppText color={colors.textSecondary} style={{ marginBottom: space.sm }}>
            Started {new Date(session.startedAt).toLocaleTimeString()}
          </AppText>

          {pendingExercise ? (
            <Card>
              <AppText variant="h3">{pendingExercise.name}</AppText>
              {priorPrSummary && (priorPrSummary.bestWeightKg !== null || priorPrSummary.bestEstimatedOneRm !== null) ? (
                <AppText variant="caption" color={colors.textSecondary} numbers style={{ marginTop: space.xxs }}>
                  Best: {priorPrSummary.bestWeightKg} kg
                  {priorPrSummary.bestEstimatedOneRm !== null
                    ? ` · Est. 1RM: ${priorPrSummary.bestEstimatedOneRm} kg`
                    : ""}
                </AppText>
              ) : null}
              <View style={{ marginTop: space.md, gap: space.sm }}>
                <TextField label="Reps" keyboardType="numeric" value={reps} onChangeText={setReps} />
                <TextField label="Weight (kg)" keyboardType="numeric" value={weightKg} onChangeText={setWeightKg} />
                <TextField label="RPE (optional, 1-10)" keyboardType="numeric" value={rpe} onChangeText={setRpe} />
              </View>
              <Pressable onPress={() => setIsWarmup((w) => !w)} style={{ marginTop: space.md }}>
                <AppText variant="bodyMedium">{isWarmup ? "☑" : "☐"} Warm-up set</AppText>
              </Pressable>
              {error ? <AppText color={colors.error} style={{ marginTop: space.sm }}>{error}</AppText> : null}
              <Button title="Save set" onPress={() => void handleSaveSet()} style={{ marginTop: space.md }} />
              <Button title="Cancel" variant="ghost" onPress={() => setPendingExercise(null)} style={{ marginTop: space.sm }} />
            </Card>
          ) : (
            <View>
              {newPrFlags ? (
                <View style={{ backgroundColor: colors.successTonal, borderRadius: radius.md, padding: space.md, marginBottom: space.md }}>
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
                      style={[
                        { flexDirection: "row", justifyContent: "space-between", paddingVertical: space.sm },
                        index > 0 && { borderTopWidth: 1, borderTopColor: colors.separator },
                      ]}
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

          <Button title="End workout" variant="danger" onPress={() => void handleEnd()} style={{ marginTop: space.lg }} />
          {sets.length === 0 ? (
            <AppText color={colors.textTertiary} center style={{ marginTop: space.lg }}>No sets logged yet.</AppText>
          ) : null}
        </View>
      }
      renderItem={({ item }) => (
        <View style={{ paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: colors.separator }}>
          <AppText variant="bodyMedium">{item.exerciseName ?? item.exerciseId}</AppText>
          <AppText variant="caption" color={colors.textSecondary} numbers style={{ marginTop: space.xxs }}>
            Set {item.setNo}: {item.reps} reps × {item.weightKg} kg
            {item.rpe !== null ? ` @ RPE ${item.rpe}` : ""}
            {item.isWarmup ? " (warm-up)" : ""}
          </AppText>
        </View>
      )}
    />
  );
}
