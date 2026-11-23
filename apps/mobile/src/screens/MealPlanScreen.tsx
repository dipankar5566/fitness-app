import {
  itemMacros,
  MEAL_DISPLAY_ORDER,
  PLAN_GRAMS_STEP,
  planTotals,
  type MealDisplayType,
  type MealPlan,
  type MealPlanItem,
} from "@fitness-app/shared";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Crypto from "expo-crypto";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { MacroBar } from "../components/Charts";
import { AppText, Button, Card, EmptyState, IconButton, Screen, SectionHeader } from "../components/ui";
import {
  AiQuotaExceededError,
  generateMealPlan,
  getFoodDetail,
  getTodayMealPlan,
  isNetworkError,
  MealPlanUnavailableError,
} from "../lib/api";
import { loadGuestSession } from "../lib/auth-storage";
import { getDatabase } from "../lib/db";
import { API_URL } from "../lib/env";
import { insert } from "../lib/food-log-repo";
import { syncNow } from "../lib/sync-engine";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors, space } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "MealPlan">;

const MEAL_LABELS: Record<MealDisplayType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  snack: "Snack",
  dinner: "Dinner",
};

/**
 * Today's AI sample-day meal plan (PRD §5.5). The server (apps/api/src/meal-plan/) has already
 * resolved every item to a real indb food, re-costed it from our own nutrients and validated the
 * day against the user's targets - this screen only displays it, lets the user swap a food (kept to
 * the same kcal, so the day stays on target), and logs a meal through the normal local outbox
 * (food-log-repo insert + syncNow, source 'ai_plan'). Online-only to generate, like the coach: every
 * generation is a quota-counted AI call. Swaps are local to this visit, not written back.
 */
export function MealPlanScreen({ navigation, route }: Props) {
  const { accountId, swappedPlanItem } = route.params;
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loggedMeals, setLoggedMeals] = useState<Set<MealDisplayType>>(new Set());

  useEffect(() => {
    void (async () => {
      const session = await loadGuestSession();
      if (!session) return;
      try {
        setPlan(await getTodayMealPlan(API_URL, session.accessToken));
      } catch (e) {
        setError(isNetworkError(e) ? "You're offline - connect to load your meal plan." : "Couldn't load your meal plan.");
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // A food picked from FoodSearch's swapPlanItem mode: replace that item, resizing the portion so it
  // carries the same kcal as the food it replaces.
  useEffect(() => {
    if (!swappedPlanItem) return;
    void (async () => {
      try {
        const detail = await getFoodDetail(API_URL, swappedPlanItem.code);
        const kcalPer100g = detail.nutrientsPer100g.kcal;
        if (kcalPer100g === null || kcalPer100g <= 0) {
          setError(`${detail.name} has no calorie data, so it can't be swapped in.`);
          return;
        }
        setPlan((current) => {
          if (!current) return current;
          const old = current.items[swappedPlanItem.index];
          if (!old) return current;
          const grams = Math.max(
            PLAN_GRAMS_STEP,
            Math.round(((itemMacros(old).kcal / kcalPer100g) * 100) / PLAN_GRAMS_STEP) * PLAN_GRAMS_STEP,
          );
          const replacement: MealPlanItem = {
            ...old,
            foodRef: detail.code,
            foodName: detail.name,
            grams,
            kcalPer100g,
            proteinGPer100g: detail.nutrientsPer100g.proteinG ?? 0,
            carbGPer100g: detail.nutrientsPer100g.carbG ?? 0,
            fatGPer100g: detail.nutrientsPer100g.fatG ?? 0,
          };
          const items = current.items.map((item, i) => (i === swappedPlanItem.index ? replacement : item));
          return { ...current, items, totals: planTotals(items) };
        });
      } catch {
        setError("Couldn't load that food - check your connection and try again.");
      }
    })();
  }, [swappedPlanItem]);

  const onGenerate = useCallback(async () => {
    const session = await loadGuestSession();
    if (!session) return;
    setIsGenerating(true);
    setError(null);
    try {
      setPlan(await generateMealPlan(API_URL, session.accessToken));
    } catch (e) {
      if (e instanceof AiQuotaExceededError) {
        setError("You've reached today's AI limit - try again tomorrow.");
      } else if (e instanceof MealPlanUnavailableError) {
        setError(e.message);
      } else if (isNetworkError(e)) {
        setError("You're offline - connect to generate a meal plan.");
      } else {
        setError("Something went wrong generating your plan.");
      }
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const logMeal = useCallback(
    async (mealType: MealDisplayType) => {
      if (!plan) return;
      const session = await loadGuestSession();
      if (!session) return;
      const db = await getDatabase();
      const now = new Date().toISOString();
      for (const item of plan.items.filter((i) => i.mealType === mealType)) {
        await insert(db, {
          id: Crypto.randomUUID(),
          accountId,
          foodSource: "indb",
          foodRef: item.foodRef,
          quantity: item.grams,
          unit: "g",
          mealType,
          loggedAt: now,
          source: "ai_plan",
          isEstimate: false,
          isDeleted: false,
          updatedAt: now,
          macros: itemMacros(item),
          foodName: item.foodName,
        });
      }
      setLoggedMeals((current) => new Set(current).add(mealType));
      void syncNow(db, API_URL, session.accessToken);
    },
    [accountId, plan],
  );

  if (isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} style={{ marginTop: space.xxl }} />
      </Screen>
    );
  }

  if (!plan) {
    return (
      <Screen scroll>
        <EmptyState
          icon="silverware-fork-knife"
          title="No plan for today yet"
          subtitle="Get a sample day of Indian meals built around your targets and diet type."
        />
        {error ? (
          <AppText variant="body" color={colors.error} center style={{ marginTop: space.md }}>{error}</AppText>
        ) : null}
        <Button title="Build today's plan" loading={isGenerating} onPress={() => void onGenerate()} style={{ marginTop: space.lg }} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Card>
        <AppText variant="bodyMedium" numbers>
          {plan.totals.kcal} / {plan.targets.kcal} kcal
        </AppText>
        <View style={{ gap: space.sm, marginTop: space.md }}>
          <MacroBar label="Protein" grams={plan.totals.proteinG} targetGrams={plan.targets.proteinG} color={colors.protein} />
          <MacroBar label="Carbs" grams={plan.totals.carbG} targetGrams={plan.targets.carbG} color={colors.carb} />
          <MacroBar label="Fat" grams={plan.totals.fatG} targetGrams={plan.targets.fatG} color={colors.fat} />
        </View>
        <AppText variant="micro" color={colors.textTertiary} style={{ marginTop: space.md }}>
          AI-suggested, with every number taken from our food database. Swapping keeps each item's calories.
        </AppText>
      </Card>

      {error ? (
        <AppText variant="body" color={colors.error} style={{ marginTop: space.md }}>{error}</AppText>
      ) : null}

      {MEAL_DISPLAY_ORDER.map((mealType) => {
        const entries = plan.items.map((item, index) => ({ item, index })).filter(({ item }) => item.mealType === mealType);
        if (entries.length === 0) return null;
        const mealKcal = entries.reduce((sum, { item }) => sum + itemMacros(item).kcal, 0);
        const logged = loggedMeals.has(mealType);
        return (
          <View key={mealType}>
            <SectionHeader title={`${MEAL_LABELS[mealType]} · ${mealKcal} kcal`} style={{ marginTop: space.xl }} />
            <Card>
              {entries.map(({ item, index }) => (
                <View key={`${item.foodRef}-${index}`} style={{ flexDirection: "row", alignItems: "center", paddingVertical: space.xs }}>
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyMedium">{item.foodName}</AppText>
                    <AppText variant="caption" color={colors.textSecondary} numbers>
                      {item.grams} g · {itemMacros(item).kcal} kcal · {itemMacros(item).proteinG} g protein
                    </AppText>
                  </View>
                  <IconButton
                    icon="swap-horizontal"
                    onPress={() => navigation.navigate("FoodSearch", { accountId, mode: "swapPlanItem", mealItemIndex: index })}
                  />
                </View>
              ))}
              <Button
                title={logged ? "Logged" : "Log this meal"}
                variant={logged ? "secondary" : "primary"}
                disabled={logged}
                onPress={() => void logMeal(mealType)}
                style={{ marginTop: space.sm }}
              />
            </Card>
          </View>
        );
      })}
    </Screen>
  );
}
