import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { AppText, Button, Screen, Stepper } from "../components/ui";
import { getFoodDetail, type FoodDetail } from "../lib/api";
import { getDatabase } from "../lib/db";
import { API_URL } from "../lib/env";
import { cacheFood, getCachedFood } from "../lib/food-cache-repo";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { makeStyles, space, useTheme } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "IngredientQuantity">;

const useStyles = makeStyles(() => ({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
}));

/** Grams-only quantity entry for a recipe ingredient (CreateCustomFoodScreen) - mirrors
 * LogFoodScreen's detail fetch + offline cache fallback, but no unit/meal-type since custom foods
 * only support grams in v1 (see the plan's Context). */
export function IngredientQuantityScreen({ navigation, route }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { accountId, foodCode } = route.params;
  const [detail, setDetail] = useState<FoodDetail | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [quantityG, setQuantityG] = useState(100);
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
    if (!detail || quantityG <= 0) {
      setError("Enter a valid amount in grams.");
      return;
    }
    navigation.navigate("CreateCustomFood", {
      accountId,
      pickedIngredient: { foodRef: detail.code, name: detail.name, quantityG },
    });
  };

  if (loadFailed) {
    return (
      <Screen>
        <View style={styles.centered}>
          <AppText color={colors.error} center>Could not load this food. Go back and try again.</AppText>
        </View>
      </Screen>
    );
  }

  if (!detail) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppText variant="h1">{detail.name}</AppText>
      <AppText variant="caption" color={colors.textTertiary} style={{ marginTop: space.xxs, marginBottom: space.lg }}>
        Per 100g: {detail.nutrientsPer100g.kcal != null ? Math.round(detail.nutrientsPer100g.kcal) : "?"} kcal ·{" "}
        {detail.nutrientsPer100g.proteinG != null ? Math.round(detail.nutrientsPer100g.proteinG) : "?"}g protein
      </AppText>

      <Stepper label="Amount" value={quantityG} onChange={setQuantityG} step={10} min={10} suffix=" g" />

      {error ? <AppText color={colors.error} center style={{ marginTop: space.lg }}>{error}</AppText> : null}
      <Button title="Add to recipe" onPress={handleConfirm} style={{ marginTop: space.xxl }} />
    </Screen>
  );
}
