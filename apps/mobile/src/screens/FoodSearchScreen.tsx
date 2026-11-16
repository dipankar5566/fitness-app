import { isAllowed, type DietClass, type DietType } from "@fitness-app/shared";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { isNetworkError, searchFoods } from "../lib/api";
import { getDatabase } from "../lib/db";
import { API_URL } from "../lib/env";
import { listRecentFoods } from "../lib/food-cache-repo";
import { getKv } from "../lib/kv-store";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "FoodSearch">;

interface DisplayResult {
  code: string;
  name: string;
  foodType: string;
  dietClass: DietClass | null;
  jainOk: boolean | null;
}

const DIET_LABELS: Record<DietType, string> = {
  veg: "veg",
  eggetarian: "eggetarian",
  non_veg: "non-veg",
  vegan: "vegan",
  jain: "Jain",
};

export function FoodSearchScreen({ navigation, route }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DisplayResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [dietType, setDietType] = useState<DietType | null>(null);

  useEffect(() => {
    void (async () => {
      const db = await getDatabase();
      const cached = await getKv(db, "cached_profile");
      if (cached) {
        const profile = JSON.parse(cached) as { diet_type?: DietType } | null;
        setDietType(profile?.diet_type ?? null);
      }
    })();
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) {
      return;
    }
    setIsSearching(true);
    setError(null);
    try {
      const found = await searchFoods(API_URL, query.trim(), dietType ?? undefined);
      setResults(
        found.map((item) => ({
          code: item.code,
          name: item.name,
          foodType: item.food_type,
          dietClass: item.dietClass,
          jainOk: null,
        })),
      );
      setHasSearched(true);
    } catch (err) {
      if (isNetworkError(err)) {
        const db = await getDatabase();
        const recent = await listRecentFoods(db);
        const filtered = dietType
          ? recent.filter((item) => isAllowed(dietType, item.dietClass, item.jainOk))
          : recent;
        setResults(
          filtered.map((item) => ({
            code: item.code,
            name: item.name,
            foodType: item.foodType,
            dietClass: item.dietClass,
            jainOk: item.jainOk,
          })),
        );
        setError(filtered.length > 0 ? "Offline - showing recently logged foods." : "Offline, and no recent foods to show.");
      } else {
        setError("Search failed. Check your connection and try again.");
      }
      setHasSearched(true);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Search for a food, e.g. idli"
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={handleSearch}
        returnKeyType="search"
        autoFocus
      />
      {dietType ? <Text style={styles.dietHeader}>Showing {DIET_LABELS[dietType]}-friendly foods</Text> : null}
      {isSearching ? <ActivityIndicator style={styles.spinner} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={results}
        keyExtractor={(item) => item.code}
        renderItem={({ item }) => (
          <Pressable
            style={styles.resultRow}
            onPress={() => {
              if (route.params.mode === "pickIngredient") {
                navigation.navigate("IngredientQuantity", {
                  accountId: route.params.accountId,
                  foodCode: item.code,
                });
              } else if (route.params.mode === "pickMealItem") {
                navigation.navigate("LogMealFromText", {
                  accountId: route.params.accountId,
                  pickedMealItemFood: { index: route.params.mealItemIndex!, code: item.code, name: item.name },
                });
              } else {
                navigation.navigate("LogFood", {
                  accountId: route.params.accountId,
                  foodCode: item.code,
                });
              }
            }}
          >
            <View>
              <Text style={styles.resultName}>{item.name}</Text>
              <Text style={styles.resultType}>{item.foodType}</Text>
            </View>
            {item.dietClass === null ? <Text style={styles.unverified}>diet unverified</Text> : null}
          </Pressable>
        )}
        ListEmptyComponent={
          hasSearched && !isSearching ? <Text style={styles.empty}>No results.</Text> : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10 },
  dietHeader: { color: "#666", marginTop: 8, fontSize: 12 },
  spinner: { marginTop: 12 },
  error: { color: "#c00", marginTop: 12, textAlign: "center" },
  resultRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  resultName: { fontSize: 16 },
  resultType: { color: "#888", fontSize: 12, textTransform: "capitalize" },
  unverified: { color: "#b8860b", fontSize: 11 },
  empty: { textAlign: "center", marginTop: 24, color: "#888" },
});
