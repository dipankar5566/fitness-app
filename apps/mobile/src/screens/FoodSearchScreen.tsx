import { isAllowed, type DietClass, type DietType } from "@fitness-app/shared";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, View } from "react-native";
import { AppText, Badge, Button, EmptyState, ListRow, Screen, TextField } from "../components/ui";
import { isNetworkError, reportFood, searchFoods } from "../lib/api";
import { loadGuestSession } from "../lib/auth-storage";
import { getDatabase } from "../lib/db";
import { API_URL } from "../lib/env";
import { listRecentFoods } from "../lib/food-cache-repo";
import { getKv } from "../lib/kv-store";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors, space } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "FoodSearch">;

interface DisplayResult {
  code: string;
  name: string;
  foodType: string;
  dietClass: DietClass | null;
  jainOk: boolean | null;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
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
  const [isReporting, setIsReporting] = useState(false);

  const handleReportMissing = async () => {
    const term = query.trim();
    if (!term || isReporting) {
      return;
    }
    setIsReporting(true);
    try {
      const session = await loadGuestSession();
      if (!session) {
        Alert.alert("Not signed in", "Please reopen the app and try again.");
        return;
      }
      await reportFood(API_URL, session.accessToken, { kind: "missing", query: term });
      Alert.alert("Thanks!", `We'll look into adding "${term}".`);
    } catch {
      Alert.alert("Couldn't send", "Please try again when you're back online.");
    } finally {
      setIsReporting(false);
    }
  };

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
    <Screen padded={false}>
      <TextField
        style={{ margin: space.lg, marginBottom: space.sm }}
        placeholder="Search for a food, e.g. idli"
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={handleSearch}
        returnKeyType="search"
        autoFocus
      />
      {dietType ? (
        <AppText variant="caption" color={colors.textSecondary} style={{ marginHorizontal: space.lg }}>
          Showing {DIET_LABELS[dietType]}-friendly foods
        </AppText>
      ) : null}
      {isSearching ? <ActivityIndicator style={{ marginTop: space.md }} color={colors.primary} /> : null}
      {error ? (
        <AppText color={colors.warning} center style={{ marginTop: space.md, marginHorizontal: space.lg }}>
          {error}
        </AppText>
      ) : null}
      <FlatList
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xl }}
        data={results}
        keyExtractor={(item) => item.code}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.separator }} />}
        renderItem={({ item }) => (
          <ListRow
            title={item.name}
            subtitle={capitalize(item.foodType)}
            trailing={item.dietClass === null ? <Badge label="unverified" tone="warning" /> : undefined}
            onPress={() => {
              if (route.params.mode === "pickIngredient") {
                navigation.navigate("IngredientQuantity", {
                  accountId: route.params.accountId,
                  foodCode: item.code,
                });
              } else if (route.params.mode === "swapPlanItem") {
                navigation.navigate("MealPlan", {
                  accountId: route.params.accountId,
                  swappedPlanItem: { index: route.params.mealItemIndex!, code: item.code, name: item.name },
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
                  presetMealType: route.params.presetMealType,
                });
              }
            }}
          />
        )}
        ListEmptyComponent={
          hasSearched && !isSearching ? (
            <EmptyState icon="magnify" title="No results." style={{ marginTop: space.xxl }} />
          ) : undefined
        }
        ListFooterComponent={
          hasSearched && !isSearching && query.trim() ? (
            <Button
              title={isReporting ? "Sending…" : "Can't find it? Report a missing food"}
              variant="ghost"
              disabled={isReporting}
              onPress={handleReportMissing}
              style={{ marginTop: space.lg }}
            />
          ) : undefined
        }
      />
    </Screen>
  );
}
