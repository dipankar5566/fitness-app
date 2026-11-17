import type { MealType } from "@fitness-app/shared";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Crypto from "expo-crypto";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { AppText, Button, Card, Screen, TextField } from "../components/ui";
import { ChipSelect } from "../components/ChipSelect";
import { trackEvent } from "../lib/analytics";
import { lookupPackagedFood, type PackagedFoodDetail } from "../lib/api";
import { loadGuestSession } from "../lib/auth-storage";
import { getDatabase } from "../lib/db";
import { API_URL } from "../lib/env";
import { insert } from "../lib/food-log-repo";
import { syncNow } from "../lib/sync-engine";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors, space } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "LogPackagedFood">;

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

/**
 * Barcode -> Open Food Facts product -> log (PRD section 5.5). Quantity is always grams - same
 * v1 simplification as custom foods, since packaged_food has no serving-measure data the way
 * indb does. A "not found" product (lookupPackagedFood resolving null) shows PRD's "not found,
 * add it" flow by handing off to the existing CreateCustomFoodScreen rather than a new one.
 */
export function LogPackagedFoodScreen({ navigation, route }: Props) {
  const { accountId, barcode } = route.params;
  const [product, setProduct] = useState<PackagedFoodDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("100");
  const [mealType, setMealType] = useState<MealType>(defaultMealType());
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const result = await lookupPackagedFood(API_URL, barcode);
        if (result) {
          setProduct(result);
        } else {
          setNotFound(true);
        }
      } catch {
        setLoadError("Couldn't look up this barcode. Check your connection and try again.");
      }
    })();
  }, [barcode]);

  const preview = useMemo(() => {
    const parsedQuantity = Number(quantity);
    if (!product || !Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      return null;
    }
    const scale = parsedQuantity / 100;
    const scaled = (per100g: number | null) => (per100g === null ? null : Math.round(per100g * scale * 10) / 10);
    return {
      kcal: scaled(product.nutrientsPer100g.energy_kcal),
      proteinG: scaled(product.nutrientsPer100g.protein_g),
      fatG: scaled(product.nutrientsPer100g.fat_g),
      carbG: scaled(product.nutrientsPer100g.carb_g),
    };
  }, [product, quantity]);

  const handleSubmit = async () => {
    const parsedQuantity = Number(quantity);
    if (!product || !Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setSubmitError("Enter a valid quantity in grams.");
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
        foodSource: "packaged",
        foodRef: product.id,
        quantity: parsedQuantity,
        unit: "g",
        mealType,
        loggedAt: now,
        source: "barcode",
        isEstimate: false,
        isDeleted: false,
        updatedAt: now,
        macros: preview,
      });
      trackEvent("packaged_food_logged");
      void syncNow(db, API_URL, session.accessToken);
      navigation.navigate("Home", { accountId });
    } catch {
      trackEvent("packaged_food_log_failed");
      setSubmitError("Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <AppText color={colors.error} center>{loadError}</AppText>
        </View>
      </Screen>
    );
  }

  if (notFound) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: space.sm }}>
          <AppText variant="h2" center>No product found for this barcode.</AppText>
          <AppText color={colors.textSecondary} center>You can add it manually as a custom food instead.</AppText>
          <Button
            title="Add it manually"
            onPress={() => navigation.navigate("CreateCustomFood", { accountId })}
            style={{ marginTop: space.lg, minWidth: 180 }}
          />
        </View>
      </Screen>
    );
  }

  if (!product) {
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
      <AppText variant="h1">{product.name}</AppText>
      {product.brand ? <AppText color={colors.textSecondary} style={{ marginTop: space.xxs }}>{product.brand}</AppText> : null}
      <AppText variant="body" color={colors.textSecondary} style={{ marginTop: space.xxs, marginBottom: space.lg }}>
        Per 100g: {product.nutrientsPer100g.energy_kcal ?? "?"} kcal · {product.nutrientsPer100g.protein_g ?? "?"}g protein
      </AppText>

      <TextField label="Quantity (grams)" keyboardType="numeric" value={quantity} onChangeText={setQuantity} />

      <ChipSelect label="Meal" options={MEAL_TYPES} value={mealType} onChange={setMealType} formatOption={capitalize} />

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
