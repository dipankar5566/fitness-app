import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { AppText, Button, Screen, TextField } from "../components/ui";
import { getFoodDetail, type FoodDetail } from "../lib/api";
import { getDatabase } from "../lib/db";
import { API_URL } from "../lib/env";
import { cacheFood, getCachedFood } from "../lib/food-cache-repo";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors, space } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "IngredientQuantity">;

/** Grams-only quantity entry for a recipe ingredient (CreateCustomFoodScreen) - mirrors
 * LogFoodScreen's detail fetch + offline cache fallback, but no unit/meal-type since custom foods
 * only support grams in v1 (see the plan's Context). */
export function IngredientQuantityScreen({ navigation, route }: Props) {
  const { accountId, foodCode } = route.params;
  const [detail, setDetail] = useState<FoodDetail | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [quantityG, setQuantityG] = useState("100");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const db = await getDatabase();
      try {
        const result = await getFoodDetail(API_URL, foodCode);
        setDetail(result);
        await cacheFood(db, result);
      } catch {
        const cached = await getCachedFood(db, foodCode);
        if (cached) {
          setDetail(cached);
        } else {
          setLoadFailed(true);
        }
      }
    })();
  }, [foodCode]);

  const handleConfirm = () => {
    const parsed = Number(quantityG);
    if (!detail || !Number.isFinite(parsed) || parsed <= 0) {
      setError("Enter a valid amount in grams.");
      return;
    }
    navigation.navigate("CreateCustomFood", {
      accountId,
      pickedIngredient: { foodRef: detail.code, name: detail.name, quantityG: parsed },
    });
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
    <Screen>
      <AppText variant="h1">{detail.name}</AppText>
      <AppText variant="body" color={colors.textSecondary} style={{ marginTop: space.xxs, marginBottom: space.lg }}>
        Per 100g: {detail.nutrientsPer100g.kcal ?? "?"} kcal · {detail.nutrientsPer100g.proteinG ?? "?"}g protein
      </AppText>

      <TextField label="Amount (grams)" keyboardType="numeric" value={quantityG} onChangeText={setQuantityG} />

      {error ? <AppText color={colors.error} center style={{ marginTop: space.lg }}>{error}</AppText> : null}
      <Button title="Add to recipe" onPress={handleConfirm} style={{ marginTop: space.xxl }} />
    </Screen>
  );
}
