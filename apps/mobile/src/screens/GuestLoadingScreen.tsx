import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Button, StyleSheet, Text, View } from "react-native";
import { createGuestAccount } from "../lib/api";
import { loadGuestSession, saveGuestSession } from "../lib/auth-storage";
import { API_URL } from "../lib/env";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "GuestLoading">;

export function GuestLoadingScreen({ navigation }: Props) {
  const [error, setError] = useState<string | null>(null);

  const establishSession = useCallback(() => {
    setError(null);
    void (async () => {
      try {
        const existing = await loadGuestSession();
        if (existing) {
          navigation.replace("Home", { accountId: existing.accountId });
          return;
        }
        const session = await createGuestAccount(API_URL);
        await saveGuestSession(session);
        navigation.replace("Home", { accountId: session.accountId });
      } catch {
        setError("Could not reach the server. Check your connection and try again.");
      }
    })();
  }, [navigation]);

  useEffect(() => {
    establishSession();
  }, [establishSession]);

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>{error}</Text>
        <Button title="Retry" onPress={establishSession} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  error: { textAlign: "center", marginHorizontal: 24 },
});
