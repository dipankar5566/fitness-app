import { exerciseEquipmentSchema, exerciseMuscleSchema } from "@fitness-app/shared";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { ChipSelect } from "../components/ChipSelect";
import { type Exercise, searchExercises } from "../lib/api";
import { API_URL } from "../lib/env";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "ExerciseLibrary">;

const MUSCLE_OPTIONS = ["all", ...exerciseMuscleSchema.options] as const;
const EQUIPMENT_OPTIONS = ["all", ...exerciseEquipmentSchema.options] as const;

function formatLabel(value: string): string {
  return value.replace(/^./, (c) => c.toUpperCase());
}

export function ExerciseLibraryScreen({ navigation, route }: Props) {
  const [muscle, setMuscle] = useState<(typeof MUSCLE_OPTIONS)[number]>("all");
  const [equipment, setEquipment] = useState<(typeof EQUIPMENT_OPTIONS)[number]>("all");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    searchExercises(API_URL, {
      muscle: muscle === "all" ? undefined : muscle,
      equipment: equipment === "all" ? undefined : equipment,
    })
      .then((found) => {
        if (!cancelled) setExercises(found);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load exercises. Check your connection.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [muscle, equipment]);

  return (
    <View style={styles.container}>
      <ChipSelect label="Muscle" options={MUSCLE_OPTIONS} value={muscle} onChange={setMuscle} formatOption={formatLabel} />
      <ChipSelect
        label="Equipment"
        options={EQUIPMENT_OPTIONS}
        value={equipment}
        onChange={setEquipment}
        formatOption={formatLabel}
      />
      {isLoading ? <ActivityIndicator style={styles.spinner} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        style={styles.list}
        data={exercises}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() =>
              route.params?.mode === "pickExercise"
                ? navigation.navigate("WorkoutSession", { accountId: route.params.accountId, pickedExercise: item })
                : navigation.navigate("ExerciseDetail", { exercise: item })
            }
          >
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>
              {item.equipment ?? "no equipment"} · {item.primaryMuscles.join(", ")}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={!isLoading ? <Text style={styles.empty}>No exercises match.</Text> : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  list: { marginTop: 8 },
  spinner: { marginTop: 12 },
  error: { color: "#c00", marginTop: 12, textAlign: "center" },
  row: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  name: { fontSize: 16 },
  meta: { color: "#888", fontSize: 12, textTransform: "capitalize", marginTop: 2 },
  empty: { textAlign: "center", marginTop: 24, color: "#888" },
});
