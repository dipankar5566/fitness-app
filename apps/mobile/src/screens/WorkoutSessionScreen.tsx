import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Crypto from "expo-crypto";
import { useCallback, useEffect, useState } from "react";
import { Button, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { trackEvent } from "../lib/analytics";
import { loadGuestSession } from "../lib/auth-storage";
import { getDatabase } from "../lib/db";
import { API_URL } from "../lib/env";
import { syncNow } from "../lib/sync-engine";
import {
  endSession,
  getActiveSession,
  insertSession,
  insertSet,
  listSetsForSession,
  type LocalWorkoutSession,
  type LocalWorkoutSet,
} from "../lib/workout-repo";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "WorkoutSession">;

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
  }, [accountId]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(() => {
    const picked = route.params.pickedExercise;
    if (picked) {
      setPendingExercise({ id: picked.id, name: picked.name });
      navigation.setParams({ pickedExercise: undefined });
    }
  }, [route.params.pickedExercise, navigation]);

  const handleStart = async () => {
    const guestSession = await loadGuestSession();
    if (!guestSession) return;
    const db = await getDatabase();
    const now = new Date().toISOString();
    await insertSession(db, {
      id: Crypto.randomUUID(),
      accountId: guestSession.accountId,
      programDayId: null,
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
    setPendingExercise(null);
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
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>No workout in progress.</Text>
        <View style={styles.button}>
          <Button title="Start workout" onPress={() => void handleStart()} />
        </View>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={sets}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.startedAt}>Started {new Date(session.startedAt).toLocaleTimeString()}</Text>

          {pendingExercise ? (
            <View style={styles.form}>
              <Text style={styles.formTitle}>{pendingExercise.name}</Text>
              <Text style={styles.label}>Reps</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={reps} onChangeText={setReps} />
              <Text style={styles.label}>Weight (kg)</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={weightKg} onChangeText={setWeightKg} />
              <Text style={styles.label}>RPE (optional, 1-10)</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={rpe} onChangeText={setRpe} />
              <Pressable style={styles.warmupRow} onPress={() => setIsWarmup((w) => !w)}>
                <Text style={styles.warmupLabel}>{isWarmup ? "☑" : "☐"} Warm-up set</Text>
              </Pressable>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <View style={styles.button}>
                <Button title="Save set" onPress={() => void handleSaveSet()} />
              </View>
              <View style={styles.button}>
                <Button title="Cancel" onPress={() => setPendingExercise(null)} color="#888" />
              </View>
            </View>
          ) : (
            <View style={styles.button}>
              <Button
                title="Add exercise"
                onPress={() => navigation.navigate("ExerciseLibrary", { accountId, mode: "pickExercise" })}
              />
            </View>
          )}

          <View style={styles.button}>
            <Button title="End workout" onPress={() => void handleEnd()} color="#c00" />
          </View>
          {sets.length === 0 ? <Text style={styles.empty}>No sets logged yet.</Text> : null}
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.setRow}>
          <Text style={styles.exerciseName}>{item.exerciseName ?? item.exerciseId}</Text>
          <Text style={styles.setMeta}>
            Set {item.setNo}: {item.reps} reps × {item.weightKg} kg
            {item.rpe !== null ? ` @ RPE ${item.rpe}` : ""}
            {item.isWarmup ? " (warm-up)" : ""}
          </Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyTitle: { color: "#666", marginBottom: 16 },
  header: { gap: 4 },
  startedAt: { color: "#666", marginBottom: 8 },
  button: { marginTop: 12 },
  form: { marginTop: 8, padding: 12, borderWidth: 1, borderColor: "#eee", borderRadius: 8 },
  formTitle: { fontSize: 16, fontWeight: "600" },
  label: { fontWeight: "600", marginTop: 10, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 8 },
  warmupRow: { marginTop: 10 },
  warmupLabel: { fontSize: 14 },
  error: { color: "#c00", marginTop: 8 },
  empty: { color: "#888", marginTop: 16, textAlign: "center" },
  setRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  exerciseName: { fontWeight: "600" },
  setMeta: { color: "#444", marginTop: 2 },
});
