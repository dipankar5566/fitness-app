import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { getProfile, type GetProfileResponse } from "../lib/api";
import { loadGuestSession } from "../lib/auth-storage";
import { API_URL } from "../lib/env";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export function HomeScreen({ route }: Props) {
  const [goal, setGoal] = useState<GetProfileResponse["goal"] | null>(null);

  useEffect(() => {
    void (async () => {
      const session = await loadGuestSession();
      if (!session) {
        return;
      }
      const { goal: activeGoal } = await getProfile(API_URL, session.accessToken);
      setGoal(activeGoal);
    })();
  }, []);

  return (
    <View style={styles.container}>
      <Text>Guest account ready.</Text>
      <Text style={styles.id}>{route.params.accountId}</Text>
      {goal ? (
        <View style={styles.targets}>
          <Text style={styles.targetsTitle}>Daily targets</Text>
          <Text>{goal.target_kcal} kcal</Text>
          <Text>
            {goal.target_protein_g}g protein · {goal.target_carb_g}g carb · {goal.target_fat_g}g fat
          </Text>
        </View>
      ) : (
        <ActivityIndicator />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  id: { color: "#666", fontSize: 12 },
  targets: { marginTop: 24, alignItems: "center", gap: 4 },
  targetsTitle: { fontWeight: "600" },
});
