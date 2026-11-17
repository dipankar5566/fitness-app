import type { MealType } from "@fitness-app/shared";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Crypto from "expo-crypto";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { AppText, Button, Card, Screen, TextField } from "../components/ui";
import { ChipSelect } from "../components/ChipSelect";
import { trackEvent } from "../lib/analytics";
import { getFoodDetail, type FoodDetail } from "../lib/api";
import { loadGuestSession } from "../lib/auth-storage";
import { getDatabase } from "../lib/db";
import { API_URL } from "../lib/env";
import { cacheFood, getCachedFood } from "../lib/food-cache-repo";
import { insert } from "../lib/food-log-repo";
import { syncNow } from "../lib/sync-engine";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors, space } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "LogFood">;

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

function defaultMealType(): MealType {
  const hour = new Date().getHours();
  if (hour < 11) return "breakfast";
  if (hour < 16) return "lunch";
  if (hour < 21) return "dinner";
  return "snack";
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function LogFoodScreen({ navigation, route }: Props) {
  const { accountId, foodCode, presetMealType } = route.params;
  const [detail, setDetail] = useState<FoodDetail | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [quantity, setQuantity] = useState("100");
  const [unit, setUnit] = useState("g");
  const [mealType, setMealType] = useState<MealType>(presetMealType ?? defaultMealType());
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const applyDefaultServing = (result: FoodDetail) => {
    const defaultServing = result.servingMeasures.find((measure) => measure.isDefault) ?? result.servingMeasures[0];
    if (defaultServing) {
      setUnit(defaultServing.name);
      setQuantity("1");
    }
  };

  useEffect(() => {
    void (async () => {
      const db = await getDatabase();
      try {
        const result = await getFoodDetail(API_URL, foodCode);
        setDetail(result);
        applyDefaultServing(result);
        await cacheFood(db, result);
      } catch {
        const cached = await getCachedFood(db, foodCode);
        if (cached) {
          setDetail(cached);
          applyDefaultServing(cached);
        } else {
          setLoadFailed(true);
        }
      }
    })();
  }, [foodCode]);

  const unitOptions = useMemo(
    () => ["g", ...(detail?.servingMeasures ?? []).map((measure) => measure.name)],
    [detail],
  );

  const gramsPerUnit = (candidateUnit: string): number | null => {
    if (candidateUnit === "g" || candidateUnit === "ml") {
      return 1;
    }
    return detail?.servingMeasures.find((measure) => measure.name === candidateUnit)?.grams ?? null;
  };

  const preview = useMemo(() => {
    const parsedQuantity = Number(quantity);
    if (!detail || !Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      return null;
    }
    const perUnit = gramsPerUnit(unit);
    if (perUnit === null) {
      return null;
    }
    const scale = (parsedQuantity * perUnit) / 100;
    const scaled = (per100g: number | null) =>
      per100g === null ? null : Math.round(per100g * scale * 10) / 10;
    return {
      kcal: scaled(detail.nutrientsPer100g.kcal),
      proteinG: scaled(detail.nutrientsPer100g.proteinG),
      fatG: scaled(detail.nutrientsPer100g.fatG),
      carbG: scaled(detail.nutrientsPer100g.carbG),
    };
  }, [detail, quantity, unit]);

  const handleSubmit = async () => {
    const parsedQuantity = Number(quantity);
    if (!detail || !Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setSubmitError("Enter a valid quantity.");
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const session = await loadGuestSession();
      if (!session) {
        throw new Error("No guest session");
      }
      const db = await getDatabase();
      const now = new Date().toISOString();
      await insert(db, {
        id: Crypto.randomUUID(),
        accountId: session.accountId,
        foodSource: "indb",
        foodRef: detail.code,
        quantity: parsedQuantity,
        unit,
        mealType,
        loggedAt: now,
        source: "manual",
        isEstimate: false,
        isDeleted: false,
        updatedAt: now,
        macros: preview,
        foodName: detail.name,
      });
      trackEvent("food_logged");
      void syncNow(db, API_URL, session.accessToken);
      navigation.navigate("Home", { accountId });
    } catch {
      trackEvent("food_log_failed");
      setSubmitError("Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadFailed) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <AppText color={colors.error} center>Could not load this food. Go back and try again.</AppText>
        </View>
      </Screen>
    );
  }

  if (!detail) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <AppText variant="h1">{detail.name}</AppText>
      <AppText variant="body" color={colors.textSecondary} style={{ marginTop: space.xxs, marginBottom: space.lg }}>
        Per 100g: {detail.nutrientsPer100g.kcal ?? "?"} kcal · {detail.nutrientsPer100g.proteinG ?? "?"}g protein
      </AppText>

      <TextField label="Quantity" keyboardType="numeric" value={quantity} onChangeText={setQuantity} />

      <ChipSelect label="Unit" options={unitOptions} value={unit} onChange={setUnit} />
      <ChipSelect
        label="Meal"
        options={MEAL_TYPES}
        value={mealType}
        onChange={setMealType}
        formatOption={capitalize}
      />

      {preview ? (
        <Card style={{ marginTop: space.xl }}>
          <AppText variant="captionMedium" color={colors.textSecondary}>This entry</AppText>
          <AppText variant="h1" numbers style={{ marginTop: space.xxs }}>{preview.kcal ?? "?"} kcal</AppText>
          <AppText variant="body" color={colors.textSecondary} numbers style={{ marginTop: space.xxs }}>
            {preview.proteinG ?? "?"}g protein · {preview.carbG ?? "?"}g carb · {preview.fatG ?? "?"}g fat
          </AppText>
        </Card>
      ) : null}

      {submitError ? <AppText color={colors.error} center style={{ marginTop: space.lg }}>{submitError}</AppText> : null}
      <Button
        title={isSubmitting ? "Saving..." : "Log it"}
        onPress={() => void handleSubmit()}
        loading={isSubmitting}
        style={{ marginTop: space.xxl }}
      />
    </Screen>
  );
}
