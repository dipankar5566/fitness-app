import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
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
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "FoodSearch">;

interface DisplayResult {
  code: string;
  name: string;
  foodType: string;
}

export function FoodSearchScreen({ navigation, route }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DisplayResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) {
      return;
    }
    setIsSearching(true);
    setError(null);
    try {
      const found = await searchFoods(API_URL, query.trim());
      setResults(found.map((item) => ({ code: item.code, name: item.name, foodType: item.food_type })));
      setHasSearched(true);
    } catch (err) {
      if (isNetworkError(err)) {
        const db = await getDatabase();
        const recent = await listRecentFoods(db);
        setResults(recent.map((item) => ({ code: item.code, name: item.name, foodType: item.foodType })));
        setError(recent.length > 0 ? "Offline - showing recently logged foods." : "Offline, and no recent foods to show.");
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
      {isSearching ? <ActivityIndicator style={styles.spinner} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={results}
        keyExtractor={(item) => item.code}
        renderItem={({ item }) => (
          <Pressable
            style={styles.resultRow}
            onPress={() =>
              route.params.mode === "pickIngredient"
                ? navigation.navigate("IngredientQuantity", {
                    accountId: route.params.accountId,
                    foodCode: item.code,
                  })
                : navigation.navigate("LogFood", {
                    accountId: route.params.accountId,
                    foodCode: item.code,
                  })
            }
          >
            <Text style={styles.resultName}>{item.name}</Text>
            <Text style={styles.resultType}>{item.foodType}</Text>
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
  spinner: { marginTop: 12 },
  error: { color: "#c00", marginTop: 12, textAlign: "center" },
  resultRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  resultName: { fontSize: 16 },
  resultType: { color: "#888", fontSize: 12, textTransform: "capitalize" },
  empty: { textAlign: "center", marginTop: 24, color: "#888" },
});
