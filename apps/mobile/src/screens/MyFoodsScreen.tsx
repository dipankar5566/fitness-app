import type { MealType } from "@fitness-app/shared";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Crypto from "expo-crypto";
import { useCallback, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { AppText, Button, EmptyState, ListRow, Screen, TextField } from "../components/ui";
import { trackEvent } from "../lib/analytics";
import { loadGuestSession } from "../lib/auth-storage";
import { listCustomFoods, softDeleteCustomFood, type LocalCustomFood } from "../lib/custom-food-repo";
import { getDatabase } from "../lib/db";
import { API_URL } from "../lib/env";
import { insert } from "../lib/food-log-repo";
import { syncNow } from "../lib/sync-engine";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors, space } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "MyFoods">;

function defaultMealType(): MealType {
  const hour = new Date().getHours();
  if (hour < 11) return "breakfast";
  if (hour < 16) return "lunch";
  if (hour < 21) return "dinner";
  return "snack";
}

export function MyFoodsScreen({ navigation, route }: Props) {
  const { accountId } = route.params;
  const [customFoods, setCustomFoods] = useState<LocalCustomFood[]>([]);
  const [loggingId, setLoggingId] = useState<string | null>(null);
  const [quantityG, setQuantityG] = useState("100");
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
    const parsed = Number(quantityG);
    if (!Number.isFinite(parsed) || parsed <= 0) {
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
      quantity: parsed,
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
    });
    trackEvent("custom_food_logged");
    void syncNow(db, API_URL, session.accessToken);
    setLoggingId(null);
    setError(null);
    navigation.navigate("Home", { accountId });
  };

  const handleDelete = async (customFood: LocalCustomFood) => {
    const session = await loadGuestSession();
    if (!session) {
      return;
    }
    const db = await getDatabase();
    await softDeleteCustomFood(db, customFood.id, new Date().toISOString());
    void syncNow(db, API_URL, session.accessToken);
    await refresh();
  };

  return (
    <Screen padded={false}>
      <FlatList
        contentContainerStyle={{ padding: space.lg }}
        data={customFoods}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.separator }} />}
        ListEmptyComponent={
          <EmptyState icon="notebook-outline" title="No custom foods yet." subtitle="Create one to log it quickly next time." />
        }
        renderItem={({ item }) => (
          <View style={{ paddingVertical: space.sm }}>
            <ListRow
              title={item.name}
              trailing={
                loggingId === item.id ? undefined : (
                  <Button
                    title="Log it"
                    variant="secondary"
                    onPress={() => {
                      setLoggingId(item.id);
                      setQuantityG("100");
                      setError(null);
                    }}
                    style={{ height: 36, paddingHorizontal: space.md }}
                  />
                )
              }
            />
            {loggingId === item.id ? (
              <View style={{ flexDirection: "row", gap: space.sm, alignItems: "flex-end", marginTop: space.sm }}>
                <View style={{ flex: 1 }}>
                  <TextField keyboardType="numeric" value={quantityG} onChangeText={setQuantityG} />
                </View>
                <Button title="Confirm" onPress={() => void handleConfirmLog(item)} style={{ width: 110 }} />
              </View>
            ) : null}
            <Pressable onPress={() => void handleDelete(item)} style={{ marginTop: space.xs }}>
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
