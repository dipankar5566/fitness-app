import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { ActivityIndicator, Button, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import {
  deleteFoodLog,
  getProfile,
  listFoodLog,
  type FoodLogEntryRow,
  type GetProfileResponse,
} from "../lib/api";
import { loadGuestSession } from "../lib/auth-storage";
import { API_URL } from "../lib/env";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function HomeScreen({ navigation, route }: Props) {
  const [goal, setGoal] = useState<GetProfileResponse["goal"] | null>(null);
  const [entries, setEntries] = useState<FoodLogEntryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    const session = await loadGuestSession();
    if (!session) {
      return;
    }
    setIsLoading(true);
    const [{ goal: activeGoal }, logEntries] = await Promise.all([
      getProfile(API_URL, session.accessToken),
      listFoodLog(API_URL, session.accessToken, todayDate()),
    ]);
    setGoal(activeGoal);
    setEntries(logEntries);
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const session = await loadGuestSession();
      if (!session) {
        return;
      }
      await deleteFoodLog(API_URL, session.accessToken, id);
      await refresh();
    },
    [refresh],
  );

  const totalKcal = entries.reduce((sum, entry) => sum + (entry.macros?.kcal ?? 0), 0);

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={entries}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.id}>{route.params.accountId}</Text>
          {goal ? (
            <View style={styles.targets}>
              <Text style={styles.targetsTitle}>Daily target: {goal.target_kcal} kcal</Text>
              <Text style={styles.targetsSubtitle}>
                {goal.target_protein_g}g protein · {goal.target_carb_g}g carb · {goal.target_fat_g}g fat
              </Text>
              <Text style={styles.loggedSoFar}>Logged so far: {Math.round(totalKcal)} kcal</Text>
            </View>
          ) : (
            <ActivityIndicator />
          )}
          <View style={styles.logButton}>
            <Button
              title="Log food"
              onPress={() =>
                navigation.navigate("FoodSearch", { accountId: route.params.accountId })
              }
            />
          </View>
          {!isLoading && entries.length === 0 ? (
            <Text style={styles.empty}>Nothing logged today yet.</Text>
          ) : null}
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.entryRow}>
          <View style={styles.entryInfo}>
            <Text style={styles.entryMeal}>{item.meal_type}</Text>
            <Text>
              {item.quantity} {item.unit} · {item.macros?.kcal ?? "?"} kcal
            </Text>
          </View>
          <Pressable onPress={() => handleDelete(item.id)}>
            <Text style={styles.deleteLabel}>Delete</Text>
          </Pressable>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  header: { alignItems: "center", gap: 8, marginBottom: 16 },
  id: { color: "#666", fontSize: 12 },
  targets: { marginTop: 16, alignItems: "center", gap: 4 },
  targetsTitle: { fontWeight: "600" },
  targetsSubtitle: { color: "#444" },
  loggedSoFar: { color: "#666", marginTop: 4 },
  logButton: { marginTop: 16 },
  empty: { color: "#888", marginTop: 16 },
  entryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  entryInfo: { gap: 2 },
  entryMeal: { fontWeight: "600", textTransform: "capitalize" },
  deleteLabel: { color: "#c00" },
});
