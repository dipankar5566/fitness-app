import {
  calorieRingProgress,
  groupFoodLogByMeal,
  kcalRemaining,
  sumKcal,
  type MealDisplayType,
} from "@fitness-app/shared";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { MacroBar, ProgressRing } from "../components/Charts";
import { AppText, Card, EmptyState, SectionHeader } from "../components/ui";
import { getProfile, isNetworkError, type GetProfileResponse } from "../lib/api";
import { loadGuestSession } from "../lib/auth-storage";
import { getDatabase } from "../lib/db";
import { API_URL } from "../lib/env";
import { listByLocalDay, softDelete, type LocalFoodLogRow } from "../lib/food-log-repo";
import { CACHED_GOAL_KEY, getKv, setKv } from "../lib/kv-store";
import type { SqlDb } from "../lib/sql-db";
import { syncNow } from "../lib/sync-engine";
import { getActiveSession, listSetsForSession } from "../lib/workout-repo";
import type { MainTabScreenProps } from "../navigation/MainTabs";
import { colors, radius, space } from "../theme";

type Goal = GetProfileResponse["goal"];

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

const MEAL_LABELS: Record<MealDisplayType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  snack: "Snacks",
  dinner: "Dinner",
};

function sumMacro(entries: LocalFoodLogRow[], key: "proteinG" | "fatG" | "carbG"): number {
  return entries.reduce((sum, entry) => sum + (entry.macros?.[key] ?? 0), 0);
}

export function HomeScreen({ navigation, route }: MainTabScreenProps<"Today">) {
  const { accountId } = route.params;
  const [goal, setGoal] = useState<Goal>(null);
  const [entries, setEntries] = useState<LocalFoodLogRow[]>([]);
  const [activeWorkoutSets, setActiveWorkoutSets] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadEntries = useCallback(async (db: SqlDb) => {
    setEntries(await listByLocalDay(db, accountId, todayDate()));
  }, [accountId]);

  const refresh = useCallback(async () => {
    const session = await loadGuestSession();
    if (!session) {
      return;
    }
    setIsLoading(true);
    const db = await getDatabase();

    // Local rows render immediately (works offline); syncing then re-reads to pick up any server
    // changes (e.g. from another device) once the sync has actually happened.
    await loadEntries(db);
    void syncNow(db, API_URL, session.accessToken).then(() => loadEntries(db));

    const activeSession = await getActiveSession(db, accountId);
    setActiveWorkoutSets(activeSession ? (await listSetsForSession(db, activeSession.id)).length : null);

    try {
      const { goal: activeGoal } = await getProfile(API_URL, session.accessToken);
      setGoal(activeGoal);
      await setKv(db, CACHED_GOAL_KEY, JSON.stringify(activeGoal));
    } catch (err) {
      if (!isNetworkError(err)) {
        throw err;
      }
      const cached = await getKv(db, CACHED_GOAL_KEY);
      setGoal(cached ? (JSON.parse(cached) as Goal) : null);
    }

    setIsLoading(false);
  }, [accountId, loadEntries]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const handleDelete = useCallback(
    (entry: LocalFoodLogRow) => {
      Alert.alert("Delete entry?", undefined, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              const session = await loadGuestSession();
              if (!session) return;
              const db = await getDatabase();
              await softDelete(db, entry.id, new Date().toISOString());
              await loadEntries(db);
              void syncNow(db, API_URL, session.accessToken);
            })();
          },
        },
      ]);
    },
    [loadEntries],
  );

  const totalKcal = sumKcal(entries);
  const targetKcal = goal ? Number(goal.target_kcal) : 0;
  const remaining = kcalRemaining(totalKcal, targetKcal);
  const progress = calorieRingProgress(totalKcal, targetKcal);
  const mealGroups = groupFoodLogByMeal(entries);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={mealGroups}
      keyExtractor={(group) => group.mealType}
      ListHeaderComponent={
        <View>
          <AppText variant="h1">Today</AppText>
          <AppText variant="body" color={colors.textSecondary} style={{ marginBottom: space.lg }}>
            {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
          </AppText>

          {goal ? (
            <Card style={styles.heroCard}>
              <ProgressRing progress={progress} color={remaining < 0 ? colors.error : colors.primary}>
                <AppText variant="h1" numbers>{Math.abs(remaining)}</AppText>
                <AppText variant="caption" color={colors.textSecondary}>
                  kcal {remaining < 0 ? "over" : "left"}
                </AppText>
              </ProgressRing>
              <AppText variant="caption" color={colors.textSecondary} center numbers style={{ marginTop: space.sm }}>
                {Math.round(totalKcal)} / {Math.round(targetKcal)} kcal eaten
              </AppText>

              <View style={styles.macroBars}>
                <MacroBar label="Protein" grams={sumMacro(entries, "proteinG")} targetGrams={Number(goal.target_protein_g)} color={colors.protein} />
                <MacroBar label="Carbs" grams={sumMacro(entries, "carbG")} targetGrams={Number(goal.target_carb_g)} color={colors.carb} />
                <MacroBar label="Fat" grams={sumMacro(entries, "fatG")} targetGrams={Number(goal.target_fat_g)} color={colors.fat} />
              </View>
            </Card>
          ) : null}

          <View style={styles.quickActions}>
            <QuickAction icon="magnify" label="Search" onPress={() => navigation.navigate("FoodSearch", { accountId })} />
            <QuickAction icon="chat-processing-outline" label="AI / Photo" onPress={() => navigation.navigate("LogMealFromText", { accountId })} />
            <QuickAction icon="barcode-scan" label="Scan" onPress={() => navigation.navigate("BarcodeScan", { accountId })} />
            <QuickAction icon="robot-happy-outline" label="Coach" onPress={() => navigation.navigate("CoachChat", { accountId })} />
          </View>

          <Pressable
            onPress={() => navigation.navigate("WorkoutSession", { accountId })}
            style={({ pressed }) => [styles.workoutCard, pressed && styles.workoutCardPressed]}
          >
            <MaterialCommunityIcons name="dumbbell" size={22} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <AppText variant="bodyMedium">
                {activeWorkoutSets === null ? "No workout logged today" : `Workout in progress`}
              </AppText>
              {activeWorkoutSets !== null ? (
                <AppText variant="caption" color={colors.textSecondary}>{activeWorkoutSets} set{activeWorkoutSets === 1 ? "" : "s"} logged</AppText>
              ) : null}
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} />
          </Pressable>
        </View>
      }
      renderItem={({ item: group }) => (
        <View style={styles.mealSection}>
          <SectionHeader
            title={`${MEAL_LABELS[group.mealType]}${group.entries.length > 0 ? ` · ${Math.round(group.kcalSubtotal)} kcal` : ""}`}
            action={{ label: "+ Add", onPress: () => navigation.navigate("FoodSearch", { accountId, presetMealType: group.mealType }) }}
          />
          {group.entries.length === 0 ? (
            <AppText variant="caption" color={colors.textTertiary}>Nothing logged yet.</AppText>
          ) : (
            group.entries.map((entry) => (
              <Pressable
                key={entry.id}
                onLongPress={() => handleDelete(entry)}
                style={({ pressed }) => [styles.entryRow, pressed && styles.entryRowPressed]}
              >
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyMedium" numberOfLines={1}>
                    {entry.quantity} {entry.unit}
                  </AppText>
                  {entry.isEstimate ? <AppText variant="micro" color={colors.warning}>estimate</AppText> : null}
                </View>
                <AppText variant="bodyMedium" numbers color={colors.textSecondary}>
                  {entry.macros?.kcal ?? "?"} kcal
                </AppText>
              </Pressable>
            ))
          )}
        </View>
      )}
      ListFooterComponent={
        !isLoading && entries.length === 0 ? (
          <EmptyState icon="food-apple-outline" title="Nothing logged today yet." subtitle="Log your first meal above." />
        ) : (
          <AppText variant="caption" color={colors.textTertiary} center style={{ marginTop: space.lg }}>
            Long-press an entry to delete it.
          </AppText>
        )
      }
    />
    </SafeAreaView>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.quickAction, pressed && styles.quickActionPressed]}>
      <MaterialCommunityIcons name={icon} size={22} color={colors.primary} />
      <AppText variant="captionMedium" style={{ marginTop: space.xs }}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { flex: 1 },
  content: { padding: space.lg, paddingBottom: space.xxxl },
  heroCard: { alignItems: "center", marginTop: space.sm },
  macroBars: { width: "100%", gap: space.sm, marginTop: space.lg },
  quickActions: { flexDirection: "row", gap: space.sm, marginTop: space.lg },
  quickAction: {
    flex: 1,
    alignItems: "center",
    paddingVertical: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.stroke,
  },
  quickActionPressed: { opacity: 0.7 },
  workoutCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginTop: space.lg,
    padding: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.stroke,
  },
  workoutCardPressed: { opacity: 0.7 },
  mealSection: { marginTop: space.xxl },
  entryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
  },
  entryRowPressed: { opacity: 0.6 },
});
