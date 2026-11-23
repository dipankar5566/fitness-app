import type { MealType } from "@fitness-app/shared";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Crypto from "expo-crypto";
import { useCallback, useState } from "react";
import { Alert, FlatList, Pressable, View } from "react-native";
import { AppText, Button, EmptyState, ListRow, Screen, Stepper } from "../components/ui";
import { trackEvent } from "../lib/analytics";
import { loadGuestSession } from "../lib/auth-storage";
import { listCustomFoods, softDeleteCustomFood, type LocalCustomFood } from "../lib/custom-food-repo";
import { getDatabase } from "../lib/db";
import { API_URL } from "../lib/env";
import { insert } from "../lib/food-log-repo";
import { syncNow } from "../lib/sync-engine";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { makeStyles, space, useTheme } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "MyFoods">;

function defaultMealType(): MealType {
  const hour = new Date().getHours();
  if (hour < 11) return "breakfast";
  if (hour < 16) return "lunch";
  if (hour < 21) return "dinner";
  return "snack";
}

const useStyles = makeStyles((colors) => ({
  separator: { height: 1, backgroundColor: colors.separator },
  row: { paddingVertical: space.sm },
  logRow: { flexDirection: "row", gap: space.sm, alignItems: "center", marginTop: space.sm },
}));

export function MyFoodsScreen({ navigation, route }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { accountId } = route.params;
  const [customFoods, setCustomFoods] = useState<LocalCustomFood[]>([]);
  const [loggingId, setLoggingId] = useState<string | null>(null);
  const [quantityG, setQuantityG] = useState(100);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const db = await getDatabase();
    setCustomFoods(await listCustomFoods(db, accountId));
  }, [accountId]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const handleConfirmLog = async (customFood: LocalCustomFood) => {
    if (quantityG <= 0) {
      setError("Enter a valid amount in grams.");
      return;
    }
    const session = await loadGuestSession();
    if (!session) {
      return;
    }
    const db = await getDatabase();
    const now = new Date().toISOString();
    await insert(db, {
      id: Crypto.randomUUID(),
      accountId: session.accountId,
      foodSource: "custom",
      foodRef: customFood.id,
      quantity: quantityG,
      unit: "g",
      mealType: defaultMealType(),
      loggedAt: now,
      source: "manual",
      isEstimate: false,
      isDeleted: false,
      updatedAt: now,
      // Custom-food macros are computed server-side from the recipe's ingredients (same as any
      // indb food) - this shows as "?" locally until the next sync fills it in.
      macros: null,
      foodName: customFood.name,
    });
    trackEvent("custom_food_logged");
    void syncNow(db, API_URL, session.accessToken);
    setLoggingId(null);
    setError(null);
    navigation.navigate("Home", { accountId });
  };

  const handleDelete = (customFood: LocalCustomFood) => {
    // Previously deleted immediately on tap with no confirmation - a genuine one-mis-tap-deletes-
    // a-recipe risk, fixed here with the same confirm pattern Today already uses for log entries.
    Alert.alert(`Delete "${customFood.name}"?`, "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void (async () => {
            const session = await loadGuestSession();
            if (!session) return;
            const db = await getDatabase();
            await softDeleteCustomFood(db, customFood.id, new Date().toISOString());
            void syncNow(db, API_URL, session.accessToken);
            await refresh();
          })();
        },
      },
    ]);
  };

  return (
    <Screen padded={false}>
      <FlatList
        contentContainerStyle={{ padding: space.lg }}
        data={customFoods}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <EmptyState icon="notebook-outline" title="No custom foods yet." subtitle="Create one to log it quickly next time." />
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <ListRow
              title={item.name}
              trailing={
                loggingId === item.id ? undefined : (
                  <Button
                    title="Log it"
                    variant="secondary"
                    onPress={() => {
                      setLoggingId(item.id);
                      setQuantityG(100);
                      setError(null);
                    }}
                    style={{ height: 36, paddingHorizontal: space.md }}
                  />
                )
              }
            />
            {loggingId === item.id ? (
              <View style={styles.logRow}>
                <View style={{ flex: 1 }}>
                  <Stepper value={quantityG} onChange={setQuantityG} step={10} min={10} suffix=" g" />
                </View>
                <Button title="Confirm" onPress={() => void handleConfirmLog(item)} style={{ width: 110 }} />
              </View>
            ) : null}
            <Pressable
              onPress={() => handleDelete(item)}
              accessibilityRole="button"
              accessibilityLabel={`Delete ${item.name}`}
              style={{ marginTop: space.xs, minHeight: 32, justifyContent: "center" }}
            >
              <AppText variant="caption" color={colors.error}>Delete</AppText>
            </Pressable>
          </View>
        )}
      />
      {error ? <AppText color={colors.error} center style={{ marginBottom: space.sm }}>{error}</AppText> : null}
      <View style={{ padding: space.lg, paddingTop: 0 }}>
        <Button title="+ New custom food" variant="secondary" onPress={() => navigation.navigate("CreateCustomFood", { accountId })} />
      </View>
    </Screen>
  );
}
