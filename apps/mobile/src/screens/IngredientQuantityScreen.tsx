import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { ActivityIndicator, Button, StyleSheet, Text, TextInput, View } from "react-native";
import { getFoodDetail, type FoodDetail } from "../lib/api";
import { getDatabase } from "../lib/db";
import { API_URL } from "../lib/env";
import { cacheFood, getCachedFood } from "../lib/food-cache-repo";
import type { RootStackParamList } from "../navigation/RootNavigator";

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
      <View style={styles.center}>
        <Text style={styles.error}>Could not load this food. Go back and try again.</Text>
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{detail.name}</Text>
      <Text style={styles.subtitle}>
        Per 100g: {detail.nutrientsPer100g.kcal ?? "?"} kcal · {detail.nutrientsPer100g.proteinG ?? "?"}g protein
      </Text>

      <Text style={styles.label}>Amount (grams)</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={quantityG}
        onChangeText={setQuantityG}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.button}>
        <Button title="Add to recipe" onPress={handleConfirm} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "700" },
  subtitle: { color: "#666", marginTop: 4, marginBottom: 16 },
  label: { fontWeight: "600", marginTop: 16, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10 },
  error: { color: "#c00", textAlign: "center", marginTop: 16 },
  button: { marginTop: 24 },
});
