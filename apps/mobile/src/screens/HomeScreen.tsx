import {
  calorieRingProgress,
  computeLoggingStreak,
  groupFoodLogByMeal,
  kcalRemaining,
  splitMealBudgets,
  sumKcal,
  type DietType,
  type MealDisplayType,
} from "@fitness-app/shared";
import { waterGoalMl } from "@fitness-app/shared";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import * as Crypto from "expo-crypto";
import { Alert, FlatList, Modal, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LineSpark, MacroBar, ProgressRing } from "../components/Charts";
import { FastingCard } from "../components/FastingCard";
import { AppText, Button, Card, EmptyState, IconButton, SectionHeader, TextField } from "../components/ui";
import {
  getCoachDailyInsight,
  getProfile,
  getSuggestions,
  isNetworkError,
  type FoodSearchResult,
  type GetProfileResponse,
} from "../lib/api";
import { loadGuestSession } from "../lib/auth-storage";
import {
  getLatest as getLatestBodyMetric,
  insert as insertBodyMetric,
  listRecent as listRecentBodyMetric,
  type LocalBodyMetric,
} from "../lib/body-metric-repo";
import {
  insert as insertWater,
  softDeleteLatestBetween as removeLatestWater,
  totalMlBetween as totalWaterMlBetween,
} from "../lib/water-repo";
import { getDatabase } from "../lib/db";
import { API_URL } from "../lib/env";
import { listByLocalDay, listLoggedLocalDays, softDelete, type LocalFoodLogRow } from "../lib/food-log-repo";
import {
  getHcStatus,
  importHcWeights,
  loadHcSettings,
  readRecentExerciseSessions,
  readTodaySleep,
  readTodaySteps,
  WEIGHT_IMPORT_LOOKBACK_DAYS,
  type HcExerciseSessionSummary,
} from "../lib/health-connect";
import { CACHED_GOAL_KEY, CACHED_PROFILE_KEY, getKv, setKv } from "../lib/kv-store";
import type { SqlDb } from "../lib/sql-db";
import { syncNow } from "../lib/sync-engine";
import { getActiveSession, listSetsForSession } from "../lib/workout-repo";
import type { MainTabScreenProps } from "../navigation/MainTabs";
import { colors, radius, space } from "../theme";

/** How far back to look for the streak calculation - well beyond any realistic streak length, so
 * this is really just a bound on the local query, not a cap on the streak itself. */
const STREAK_LOOKBACK_DAYS = 400;

type Goal = GetProfileResponse["goal"];

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Half-open [start, end) ISO bounds of "today", using the same UTC day as todayDate() so the water
 * total and the food diary agree on which day it is. */
function todayBoundsIso(): { startIso: string; endIso: string } {
  const startIso = `${todayDate()}T00:00:00.000Z`;
  const endIso = new Date(new Date(startIso).getTime() + 24 * 60 * 60 * 1000).toISOString();
  return { startIso, endIso };
}

const GLASS_ML = 250;

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
  const [streak, setStreak] = useState<ReturnType<typeof computeLoggingStreak> | null>(null);
  const [hcSteps, setHcSteps] = useState<number | null>(null);
  const [hcExercise, setHcExercise] = useState<HcExerciseSessionSummary | null>(null);
  const [hcSleepMin, setHcSleepMin] = useState<number | null>(null);
  const [waterMl, setWaterMl] = useState(0);
  const [waterGoal, setWaterGoal] = useState(() => waterGoalMl(null));
  const [weightReadings, setWeightReadings] = useState<LocalBodyMetric[]>([]);
  const [weightModalOpen, setWeightModalOpen] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const [suggestions, setSuggestions] = useState<Partial<Record<MealDisplayType, FoodSearchResult[]>>>({});
  const [coachInsight, setCoachInsight] = useState<string | null>(null);
  const [focusKey, setFocusKey] = useState(0);

  const loadEntries = useCallback(async (db: SqlDb) => {
    setEntries(await listByLocalDay(db, accountId, todayDate()));
  }, [accountId]);

  const loadWater = useCallback(async (db: SqlDb) => {
    const { startIso, endIso } = todayBoundsIso();
    setWaterMl(await totalWaterMlBetween(db, accountId, startIso, endIso));
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

    // Streak is computed entirely from the local mirror (packages/shared's computeLoggingStreak) -
    // no server round trip, same "derive it from what's already synced" pattern as PRs.
    const sinceDate = new Date(Date.now() - STREAK_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const loggedDays = await listLoggedLocalDays(db, accountId, sinceDate);
    setStreak(computeLoggingStreak(loggedDays, todayDate()));

    const activeSession = await getActiveSession(db, accountId);
    setActiveWorkoutSets(activeSession ? (await listSetsForSession(db, activeSession.id)).length : null);

    // Water: today's total from the local mirror, goal derived from the latest synced weight
    // (falls back to a sane default when there's no weight yet).
    const latestWeight = await getLatestBodyMetric(db, accountId, "weight_kg");
    setWaterGoal(waterGoalMl(latestWeight?.value ?? null));
    await loadWater(db);

    // Weight trend: recent readings (Health Connect imports and manual entries both land in
    // body_metric), newest first - the card reverses them for a left-to-right sparkline.
    setWeightReadings(await listRecentBodyMetric(db, accountId, "weight_kg", 30));

    // Health Connect: only reads what's opted into (HealthConnectScreen), and only on an Android
    // device where it's actually available - getHcStatus/the read functions themselves already
    // no-op safely everywhere else, but checking status first avoids three pointless native calls.
    const hcStatus = await getHcStatus();
    if (hcStatus === "available") {
      const hcSettings = await loadHcSettings(db);
      if (hcSettings.steps) {
        setHcSteps(await readTodaySteps());
      }
      if (hcSettings.exercise) {
        const sessions = await readRecentExerciseSessions(1);
        setHcExercise(sessions[0] ?? null);
      }
      if (hcSettings.sleep) {
        setHcSleepMin(await readTodaySleep());
      }
      if (hcSettings.weight) {
        const since = new Date(Date.now() - WEIGHT_IMPORT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
        void importHcWeights(db, API_URL, session.accessToken, accountId, since);
      }
    }

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

    // Coach daily insight - best-effort, cached server-side (one AI call/day), skipped offline or
    // before onboarding.
    try {
      setCoachInsight(await getCoachDailyInsight(API_URL, session.accessToken));
    } catch {
      setCoachInsight(null);
    }

    // Meal suggestions ("what to log next") from the open /food/suggestions endpoint - best-effort,
    // diet-filtered via the cached profile, and silently skipped offline (chips are a nice-to-have).
    try {
      const cachedProfile = await getKv(db, CACHED_PROFILE_KEY);
      const dietType = cachedProfile
        ? (JSON.parse(cachedProfile) as { diet_type?: DietType }).diet_type
        : undefined;
      const meals = Object.keys(MEAL_LABELS) as MealDisplayType[];
      const lists = await Promise.all(
        meals.map((meal) => getSuggestions(API_URL, meal, dietType ?? undefined, 6).catch(() => [])),
      );
      const next: Partial<Record<MealDisplayType, FoodSearchResult[]>> = {};
      meals.forEach((meal, i) => {
        next[meal] = lists[i];
      });
      setSuggestions(next);
    } catch {
      // chips are optional - ignore any failure
    }

    setIsLoading(false);
  }, [accountId, loadEntries, loadWater]);

  const adjustWater = useCallback(
    async (direction: "add" | "remove") => {
      const db = await getDatabase();
      const now = new Date().toISOString();
      if (direction === "add") {
        await insertWater(db, {
          id: Crypto.randomUUID(),
          accountId,
          amountMl: GLASS_ML,
          recordedAt: now,
          isDeleted: false,
          updatedAt: now,
        });
      } else {
        const { startIso, endIso } = todayBoundsIso();
        await removeLatestWater(db, accountId, startIso, endIso, now);
      }
      await loadWater(db);
      const session = await loadGuestSession();
      if (session) {
        void syncNow(db, API_URL, session.accessToken);
      }
    },
    [accountId, loadWater],
  );

  const saveWeight = useCallback(async () => {
    const value = Number(weightInput);
    if (!Number.isFinite(value) || value <= 0) {
      Alert.alert("Enter a weight", "Please enter your weight in kg.");
      return;
    }
    const db = await getDatabase();
    const now = new Date().toISOString();
    await insertBodyMetric(db, {
      id: Crypto.randomUUID(),
      accountId,
      metricType: "weight_kg",
      value,
      photoRef: null,
      recordedAt: now,
      isDeleted: false,
      updatedAt: now,
    });
    setWeightModalOpen(false);
    setWeightInput("");
    setWeightReadings(await listRecentBodyMetric(db, accountId, "weight_kg", 30));
    setWaterGoal(waterGoalMl(value));
    const session = await loadGuestSession();
    if (session) {
      void syncNow(db, API_URL, session.accessToken);
    }
  }, [accountId, weightInput]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      setFocusKey((key) => key + 1);
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
  const mealBudgets = splitMealBudgets(targetKcal);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={mealGroups}
      keyExtractor={(group) => group.mealType}
      ListHeaderComponent={
        <View>
          <View style={{ marginBottom: space.lg }}>
            <View style={styles.titleRow}>
              <View style={{ flex: 1 }}>
                <AppText variant="h1">Today</AppText>
                <AppText variant="body" color={colors.textSecondary}>
                  {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
                </AppText>
              </View>
              {streak && streak.length > 0 ? (
                <View style={styles.streakChip}>
                  <MaterialCommunityIcons name="fire" size={16} color={colors.accent} />
                  <AppText variant="captionMedium" numbers color={colors.accent} style={{ marginLeft: 2 }}>
                    {streak.length}
                  </AppText>
                </View>
              ) : null}
            </View>
            {streak?.freezeUsedThisWeek ? (
              <AppText variant="micro" color={colors.textTertiary} style={{ marginTop: space.xs }}>
                Freeze used this week - don't miss two days in a row.
              </AppText>
            ) : null}
          </View>

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

          {coachInsight ? (
            <Pressable onPress={() => navigation.navigate("CoachChat", { accountId })}>
              <Card style={[styles.insightCard, { marginTop: space.lg }]}>
                <MaterialCommunityIcons name="robot-happy-outline" size={20} color={colors.primary} />
                <AppText variant="caption" style={{ flex: 1, marginLeft: space.sm }}>
                  {coachInsight}
                </AppText>
              </Card>
            </Pressable>
          ) : null}

          {hcSteps !== null || hcExercise !== null || hcSleepMin !== null ? (
            <Card style={{ marginTop: space.lg }}>
              <SectionHeader title="Today's activity" />
              {hcSteps !== null ? (
                <AppText variant="bodyMedium" numbers>{hcSteps.toLocaleString()} steps</AppText>
              ) : null}
              {hcSleepMin !== null ? (
                <AppText variant="bodyMedium" numbers style={{ marginTop: space.xxs }}>
                  {Math.floor(hcSleepMin / 60)}h {hcSleepMin % 60}m sleep
                </AppText>
              ) : null}
              {hcExercise ? (
                <AppText variant="caption" color={colors.textSecondary} style={{ marginTop: space.xxs }}>
                  {hcExercise.title ?? "Workout"} logged in Health Connect
                </AppText>
              ) : null}
            </Card>
          ) : null}

          <Card style={{ marginTop: space.lg }}>
            <View style={styles.waterHeader}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <MaterialCommunityIcons name="cup-water" size={20} color={colors.primary} />
                <AppText variant="bodyMedium" style={{ marginLeft: space.sm }}>Water</AppText>
                {waterMl >= waterGoal && waterGoal > 0 ? (
                  <MaterialCommunityIcons name="check-circle" size={16} color={colors.primary} style={{ marginLeft: space.sm }} />
                ) : null}
              </View>
              <View style={styles.waterControls}>
                <IconButton icon="minus-circle-outline" onPress={() => void adjustWater("remove")} color={colors.textSecondary} />
                <AppText variant="bodyMedium" numbers style={{ marginHorizontal: space.sm, minWidth: 92, textAlign: "center" }}>
                  {(waterMl / 1000).toFixed(2)} / {(waterGoal / 1000).toFixed(1)} L
                </AppText>
                <IconButton icon="plus-circle" onPress={() => void adjustWater("add")} color={colors.primary} />
              </View>
            </View>
            <AppText variant="micro" color={colors.textTertiary} style={{ marginTop: space.xs }}>
              One glass = {GLASS_ML} ml
            </AppText>
          </Card>

          <FastingCard accountId={accountId} refreshKey={focusKey} />

          <Card style={{ marginTop: space.lg }}>
            <View style={styles.waterHeader}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <MaterialCommunityIcons name="scale-bathroom" size={20} color={colors.primary} />
                <AppText variant="bodyMedium" style={{ marginLeft: space.sm }}>Weight</AppText>
              </View>
              {weightReadings[0]?.value != null ? (
                <AppText variant="bodyMedium" numbers>{weightReadings[0].value.toFixed(1)} kg</AppText>
              ) : null}
            </View>
            {weightReadings.length >= 2 ? (
              <View style={{ marginTop: space.sm, alignItems: "center" }}>
                <LineSpark values={[...weightReadings].reverse().map((r) => r.value ?? 0)} />
              </View>
            ) : (
              <AppText variant="micro" color={colors.textTertiary} style={{ marginTop: space.xs }}>
                Log your weight to see your trend.
              </AppText>
            )}
            <Button title="Log weight" variant="ghost" onPress={() => setWeightModalOpen(true)} style={{ marginTop: space.sm }} />
          </Card>

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

          <Modal
            visible={weightModalOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setWeightModalOpen(false)}
          >
            <Pressable style={styles.modalBackdrop} onPress={() => setWeightModalOpen(false)}>
              <Pressable style={styles.modalCard} onPress={() => undefined}>
                <AppText variant="h3">Log weight</AppText>
                <TextField
                  placeholder="kg"
                  keyboardType="decimal-pad"
                  value={weightInput}
                  onChangeText={setWeightInput}
                  autoFocus
                  style={{ marginTop: space.md }}
                />
                <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.md }}>
                  <View style={{ flex: 1 }}>
                    <Button title="Cancel" variant="secondary" onPress={() => setWeightModalOpen(false)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button title="Save" onPress={() => void saveWeight()} />
                  </View>
                </View>
              </Pressable>
            </Pressable>
          </Modal>
        </View>
      }
      renderItem={({ item: group }) => (
        <View style={styles.mealSection}>
          <SectionHeader
            title={`${MEAL_LABELS[group.mealType]}${
              mealBudgets[group.mealType] > 0
                ? ` · ${Math.round(group.kcalSubtotal)} / ${mealBudgets[group.mealType]} kcal`
                : group.entries.length > 0
                  ? ` · ${Math.round(group.kcalSubtotal)} kcal`
                  : ""
            }`}
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
                    {entry.foodName ?? "Unknown food"}
                  </AppText>
                  <AppText variant="caption" color={colors.textSecondary} numbers>
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
          {(suggestions[group.mealType]?.length ?? 0) > 0 ? (
            <View style={styles.suggestionRow}>
              {suggestions[group.mealType]!.slice(0, 3).map((item) => (
                <Pressable
                  key={item.code}
                  onPress={() =>
                    navigation.navigate("LogFood", {
                      accountId,
                      foodCode: item.code,
                      presetMealType: group.mealType,
                    })
                  }
                  style={({ pressed }) => [styles.suggestionChip, pressed && styles.suggestionChipPressed]}
                >
                  <MaterialCommunityIcons name="plus" size={13} color={colors.primary} />
                  <AppText variant="micro" color={colors.primary} numberOfLines={1} style={{ marginLeft: 2 }}>
                    {item.name}
                  </AppText>
                </Pressable>
              ))}
            </View>
          ) : null}
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
  titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  streakChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.accentTonal,
  },
  heroCard: { alignItems: "center", marginTop: space.sm },
  macroBars: { width: "100%", gap: space.sm, marginTop: space.lg },
  quickActions: { flexDirection: "row", gap: space.sm, marginTop: space.lg },
  waterHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  waterControls: { flexDirection: "row", alignItems: "center" },
  insightCard: { flexDirection: "row", alignItems: "center" },
  suggestionRow: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: space.sm },
  suggestionChip: {
    flexDirection: "row",
    alignItems: "center",
    maxWidth: "100%",
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTonal,
  },
  suggestionChipPressed: { opacity: 0.7 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    paddingHorizontal: space.xl,
  },
  modalCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg },
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
