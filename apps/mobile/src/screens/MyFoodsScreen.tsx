import type { MealType } from "@fitness-app/shared";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Crypto from "expo-crypto";
import { useCallback, useState } from "react";
import { Button, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { trackEvent } from "../lib/analytics";
import { loadGuestSession } from "../lib/auth-storage";
import { listCustomFoods, softDeleteCustomFood, type LocalCustomFood } from "../lib/custom-food-repo";
import { getDatabase } from "../lib/db";
import { API_URL } from "../lib/env";
import { insert } from "../lib/food-log-repo";
import { syncNow } from "../lib/sync-engine";
import type { RootStackParamList } from "../navigation/RootNavigator";

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
    <View style={styles.container}>
      <FlatList
        data={customFoods}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>No custom foods yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowHeader}>
              <Text style={styles.name}>{item.name}</Text>
              <Pressable onPress={() => handleDelete(item)}>
                <Text style={styles.deleteLabel}>Delete</Text>
              </Pressable>
            </View>
            {loggingId === item.id ? (
              <View style={styles.logForm}>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={quantityG}
                  onChangeText={setQuantityG}
                />
                <Button title="Confirm" onPress={() => handleConfirmLog(item)} />
              </View>
            ) : (
              <Button title="Log it" onPress={() => { setLoggingId(item.id); setQuantityG("100"); setError(null); }} />
            )}
          </View>
        )}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.newButton}>
        <Button title="+ New custom food" onPress={() => navigation.navigate("CreateCustomFood", { accountId })} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  empty: { color: "#888", textAlign: "center", marginTop: 24 },
  row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#eee", gap: 8 },
  rowHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { fontSize: 16, fontWeight: "600" },
  deleteLabel: { color: "#c00" },
  logForm: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 8, width: 80 },
  error: { color: "#c00", textAlign: "center", marginTop: 12 },
  newButton: { marginTop: 16 },
});
