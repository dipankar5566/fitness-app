import {
  averageLoggedKcal,
  averageLoggedProteinG,
  buildDailyCalorieSeries,
  buildWorkoutConsistency,
  countWorkoutDays,
  type ProgressDay,
  type WorkoutConsistencyDay,
} from "@fitness-app/shared";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useState } from "react";
import { View } from "react-native";
import { BarChart, LineSpark } from "../components/Charts";
import { ChipSelect } from "../components/ChipSelect";
import { AppText, Card, EmptyState, Screen, SectionHeader } from "../components/ui";
import { listRecent as listRecentBodyMetric } from "../lib/body-metric-repo";
import { getDatabase } from "../lib/db";
import { dailyTotalsBetween } from "../lib/food-log-repo";
import { CACHED_GOAL_KEY, getKv } from "../lib/kv-store";
import { listSessionDaysBetween } from "../lib/workout-repo";
import type { MainTabScreenProps } from "../navigation/MainTabs";
import { makeStyles, radius, space, useTheme } from "../theme";

const WINDOW_OPTIONS = ["7d", "30d"] as const;
type WindowOption = (typeof WINDOW_OPTIONS)[number];
const WINDOW_DAYS: Record<WindowOption, number> = { "7d": 7, "30d": 30 };

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** `days` calendar days ago, inclusive of `date` itself (dateDaysBefore(date, 1) === date). */
function dateDaysBefore(date: string, days: number): string {
  return new Date(new Date(`${date}T00:00:00.000Z`).getTime() - (days - 1) * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

interface CachedGoalShape {
  target_kcal?: string | number;
  target_protein_g?: string | number;
}

const useStyles = makeStyles((colors) => ({
  content: { paddingBottom: space.xxxl },
  summaryRow: { flexDirection: "row", gap: space.sm, marginTop: space.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: space.sm },
  gridCell: {
    width: 20,
    height: 20,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  gridCellWorked: { backgroundColor: colors.primary },
}));

/**
 * New read-only Progress tab (CLAUDE.md redesign Stage 7) - 7d/30d calorie trend against target,
 * average logged protein, weight trend, and workout-day consistency, built entirely from the
 * local SQLite mirror (no new API call). The two new repo queries this reads
 * (food-log-repo.dailyTotalsBetween, workout-repo.listSessionDaysBetween) are read-only
 * aggregations over tables the sync engine already populates; the pure day-series/averaging math
 * lives in packages/shared/src/progress.ts per the "formulas stay pure" rule. The goal's target
 * kcal/protein come from the same CACHED_GOAL_KEY cache HomeScreen already writes, not a fresh
 * network call - Progress never fabricates a target it doesn't actually have.
 */
export function ProgressScreen({ route }: MainTabScreenProps<"Progress">) {
  const { accountId } = route.params;
  const styles = useStyles();
  const { colors } = useTheme();
  const [windowOption, setWindowOption] = useState<WindowOption>("7d");
  const [series, setSeries] = useState<ProgressDay[]>([]);
  const [consistency, setConsistency] = useState<WorkoutConsistencyDay[]>([]);
  const [weights, setWeights] = useState<number[]>([]);
  const [targetKcal, setTargetKcal] = useState<number | null>(null);
  const [targetProteinG, setTargetProteinG] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const db = await getDatabase();
    const days = WINDOW_DAYS[windowOption];
    const end = todayDate();
    const start = dateDaysBefore(end, days);

    const totals = await dailyTotalsBetween(db, accountId, start, end);
    setSeries(buildDailyCalorieSeries(totals, days, end));

    const sessionDays = await listSessionDaysBetween(db, accountId, start, end);
    setConsistency(buildWorkoutConsistency(sessionDays, days, end));

    const recentWeights = await listRecentBodyMetric(db, accountId, "weight_kg", days);
    setWeights(
      [...recentWeights]
        .reverse()
        .filter((reading) => reading.recordedAt.slice(0, 10) >= start && reading.value != null)
        .map((reading) => reading.value as number),
    );

    const cachedGoal = await getKv(db, CACHED_GOAL_KEY);
    if (cachedGoal) {
      const goal = JSON.parse(cachedGoal) as CachedGoalShape;
      setTargetKcal(goal.target_kcal != null ? Number(goal.target_kcal) : null);
      setTargetProteinG(goal.target_protein_g != null ? Number(goal.target_protein_g) : null);
    }

    setIsLoading(false);
  }, [accountId, windowOption]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const avgKcal = useMemo(() => averageLoggedKcal(series), [series]);
  const avgProtein = useMemo(() => averageLoggedProteinG(series), [series]);
  const workedDays = useMemo(() => countWorkoutDays(consistency), [consistency]);
  const hasAnyFoodData = series.some((day) => day.hasData);

  return (
    <Screen scroll edges={["top", "bottom"]} style={styles.content}>
      <AppText variant="h1">Progress</AppText>
      <ChipSelect
        label=""
        options={WINDOW_OPTIONS}
        value={windowOption}
        onChange={setWindowOption}
        formatOption={(option) => (option === "7d" ? "Last 7 days" : "Last 30 days")}
      />

      <Card style={{ marginTop: space.lg }}>
        <SectionHeader title="Calories" />
        {hasAnyFoodData ? (
          <>
            <AppText variant="caption" color={colors.textSecondary} numbers>
              {avgKcal} kcal/day avg{targetKcal ? ` · target ${Math.round(targetKcal)}` : ""}
            </AppText>
            <View style={{ marginTop: space.md }}>
              <BarChart data={series} target={targetKcal ?? undefined} color={colors.primary} />
            </View>
          </>
        ) : (
          <EmptyState icon="food-apple-outline" title="Nothing logged in this window yet." />
        )}
      </Card>

      <Card style={{ marginTop: space.lg }}>
        <SectionHeader title="Protein" />
        {hasAnyFoodData ? (
          <View style={styles.summaryRow}>
            <View>
              <AppText variant="display" numbers>{avgProtein}</AppText>
              <AppText variant="caption" color={colors.textSecondary}>
                g/day avg{targetProteinG ? ` of ${Math.round(targetProteinG)}g target` : ""}
              </AppText>
            </View>
          </View>
        ) : (
          <EmptyState icon="food-drumstick-outline" title="No protein data in this window yet." />
        )}
      </Card>

      <Card style={{ marginTop: space.lg }}>
        <SectionHeader title="Weight trend" />
        {weights.length >= 2 ? (
          <View style={{ alignItems: "center", marginTop: space.sm }}>
            <LineSpark values={weights} unit=" kg" color={colors.accent} />
          </View>
        ) : (
          <EmptyState icon="scale-bathroom" title="Log your weight a couple of times to see a trend." />
        )}
      </Card>

      <Card style={{ marginTop: space.lg }}>
        <SectionHeader title="Workout consistency" />
        <AppText variant="caption" color={colors.textSecondary} numbers>
          {workedDays} of {consistency.length} days
        </AppText>
        <View style={styles.grid} accessible accessibilityLabel={`Worked out ${workedDays} of ${consistency.length} days`}>
          {consistency.map((day) => (
            <View key={day.date} style={[styles.gridCell, day.worked && styles.gridCellWorked]} />
          ))}
        </View>
      </Card>

      {isLoading ? null : (
        <AppText variant="micro" color={colors.textTertiary} center style={{ marginTop: space.lg }}>
          Built from what's already synced on this device.
        </AppText>
      )}
    </Screen>
  );
}
