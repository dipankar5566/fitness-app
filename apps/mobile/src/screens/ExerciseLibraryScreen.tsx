import { exerciseEquipmentSchema, exerciseMuscleSchema } from "@fitness-app/shared";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, View } from "react-native";
import { ChipSelect } from "../components/ChipSelect";
import { AppText, EmptyState, ListRow, Screen } from "../components/ui";
import { type Exercise, searchExercises } from "../lib/api";
import { API_URL } from "../lib/env";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors, space } from "../theme";

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
    <Screen padded={false}>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.lg }}>
        <ChipSelect label="Muscle" options={MUSCLE_OPTIONS} value={muscle} onChange={setMuscle} formatOption={formatLabel} />
        <ChipSelect
          label="Equipment"
          options={EQUIPMENT_OPTIONS}
          value={equipment}
          onChange={setEquipment}
          formatOption={formatLabel}
        />
      </View>
      {isLoading ? <ActivityIndicator style={{ marginTop: space.md }} color={colors.primary} /> : null}
      {error ? (
        <AppText color={colors.error} center style={{ marginTop: space.md, paddingHorizontal: space.lg }}>
          {error}
        </AppText>
      ) : null}
      <FlatList
        style={{ marginTop: space.sm }}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xl }}
        data={exercises}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.separator }} />}
        renderItem={({ item }) => (
          <ListRow
            title={item.name}
            subtitle={`${item.equipment ?? "no equipment"} · ${item.primaryMuscles.join(", ")}`}
            onPress={() =>
              route.params?.mode === "pickExercise"
                ? navigation.navigate("WorkoutSession", { accountId: route.params.accountId, pickedExercise: item })
                : navigation.navigate("ExerciseDetail", { exercise: item })
            }
          />
        )}
        ListEmptyComponent={!isLoading ? <EmptyState icon="dumbbell" title="No exercises match." /> : undefined}
      />
    </Screen>
  );
}
