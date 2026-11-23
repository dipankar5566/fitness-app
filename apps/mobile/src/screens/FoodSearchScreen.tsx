import { isAllowed, type DietClass, type DietType } from "@fitness-app/shared";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, View } from "react-native";
import { AppText, Badge, Button, EmptyState, ListRow, Screen, SectionHeader, TextField } from "../components/ui";
import { isNetworkError, reportFood, searchFoods } from "../lib/api";
import { loadGuestSession } from "../lib/auth-storage";
import { getDatabase } from "../lib/db";
import { API_URL } from "../lib/env";
import { listRecentFoods } from "../lib/food-cache-repo";
import { getKv } from "../lib/kv-store";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { makeStyles, space, useTheme } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "FoodSearch">;

interface DisplayResult {
  code: string;
  name: string;
  foodType: string;
  dietClass: DietClass | null;
  jainOk: boolean | null;
  /** Only populated for recent/cached foods - live search results don't carry nutrient data
   * (searchFoods() intentionally returns a lighter row; see docs/UI_UX_AUDIT.md M5/H4 - showing
   * this for recents is "free" since the full detail is already cached locally). */
  kcal?: number | null;
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

const useStyles = makeStyles((colors) => ({
  searchField: { margin: space.lg, marginBottom: space.sm },
  dietHint: { marginHorizontal: space.lg },
  listContent: { paddingHorizontal: space.lg, paddingBottom: space.xl },
  separator: { height: 1, backgroundColor: colors.separator },
}));

export function FoodSearchScreen({ navigation, route }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DisplayResult[]>([]);
  const [recent, setRecent] = useState<DisplayResult[]>([]);
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

  const loadRecent = useCallback(async (currentDietType: DietType | null) => {
    const db = await getDatabase();
    const cached = await listRecentFoods(db);
    const filtered = currentDietType
      ? cached.filter((item) => isAllowed(currentDietType, item.dietClass, item.jainOk))
      : cached;
    setRecent(
      filtered.map((item) => ({
        code: item.code,
        name: item.name,
        foodType: item.foodType,
        dietClass: item.dietClass,
        jainOk: item.jainOk,
        kcal: item.nutrientsPer100g.kcal,
      })),
    );
  }, []);

  // Recent foods show immediately on open (docs/UI_UX_AUDIT.md H4/M1) - previously this screen was
  // just an empty text field with the keyboard up until a search was typed.
  useEffect(() => {
    void (async () => {
      const db = await getDatabase();
      const cached = await getKv(db, "cached_profile");
      const currentDietType = cached ? (JSON.parse(cached) as { diet_type?: DietType } | null)?.diet_type ?? null : null;
      setDietType(currentDietType);
      await loadRecent(currentDietType);
    })();
  }, [loadRecent]);

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
        await loadRecent(dietType);
        setError(recent.length > 0 ? "Offline - showing recently logged foods." : "Offline, and no recent foods to show.");
      } else {
        setError("Search failed. Check your connection and try again.");
      }
      setHasSearched(true);
    } finally {
      setIsSearching(false);
    }
  };

  const handlePickResult = (item: DisplayResult) => {
    if (route.params.mode === "pickIngredient") {
      navigation.navigate("IngredientQuantity", { accountId: route.params.accountId, foodCode: item.code });
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
  };

  const renderRow = (item: DisplayResult) => (
    <ListRow
      title={item.name}
      subtitle={item.kcal != null ? `${capitalize(item.foodType)} · ${Math.round(item.kcal)} kcal/100g` : capitalize(item.foodType)}
      trailing={item.dietClass === null ? <Badge label="unverified" tone="warning" /> : undefined}
      onPress={() => handlePickResult(item)}
    />
  );

  // Before any search: show recent foods (or an empty hint). After a search: show the live
  // results (or the offline-fallback recent list, already in `results` via the catch path above).
  const showingRecent = !hasSearched && !isSearching;
  const listData = showingRecent ? recent : results;

  return (
    <Screen padded={false}>
      <TextField
        label="Search"
        style={styles.searchField}
        placeholder="Search for a food, e.g. idli"
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={handleSearch}
        returnKeyType="search"
        autoFocus
      />
      {dietType ? (
        <AppText variant="caption" color={colors.textSecondary} style={styles.dietHint}>
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
        contentContainerStyle={styles.listContent}
        data={listData}
        keyExtractor={(item) => item.code}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          showingRecent && recent.length > 0 ? <SectionHeader title="Recent" style={{ marginTop: space.md }} /> : undefined
        }
        renderItem={({ item }) => renderRow(item)}
        ListEmptyComponent={
          showingRecent ? (
            query.trim() ? undefined : <EmptyState icon="magnify" title="Search for a food to get started." style={{ marginTop: space.xxl }} />
          ) : hasSearched && !isSearching ? (
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
