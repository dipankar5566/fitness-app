import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Button, StyleSheet, Text, View } from "react-native";
import { identifyGuest, trackEvent } from "../lib/analytics";
import { createGuestAccount, getProfile, isNetworkError, type GetProfileResponse } from "../lib/api";
import { loadGuestSession, saveGuestSession } from "../lib/auth-storage";
import { getDatabase } from "../lib/db";
import { API_URL } from "../lib/env";
import { getKv, setKv } from "../lib/kv-store";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "GuestLoading">;

const CACHED_PROFILE_KEY = "cached_profile";

export function GuestLoadingScreen({ navigation }: Props) {
  const [error, setError] = useState<string | null>(null);

  const routeToNextScreen = useCallback(
    async (accountId: string, accessToken: string) => {
      const db = await getDatabase();
      try {
        const { profile } = await getProfile(API_URL, accessToken);
        await setKv(db, CACHED_PROFILE_KEY, JSON.stringify(profile));
        if (profile) {
          navigation.replace("Home", { accountId });
        } else {
          navigation.replace("Onboarding", { accountId });
        }
      } catch (err) {
        if (!isNetworkError(err)) {
          throw err;
        }
        // Offline cold start: a returning user with a cached profile goes straight to Home - it
        // refreshes itself in the background once there, same as any other focus of that screen.
        const cached = await getKv(db, CACHED_PROFILE_KEY);
        if (!cached) {
          throw err;
        }
        const profile = JSON.parse(cached) as GetProfileResponse["profile"];
        if (profile) {
          navigation.replace("Home", { accountId });
        } else {
          navigation.replace("Onboarding", { accountId });
        }
      }
    },
    [navigation],
  );

  const establishSession = useCallback(() => {
    setError(null);
    void (async () => {
      try {
        const existing = await loadGuestSession();
        if (existing) {
          identifyGuest(existing.accountId);
          trackEvent("guest_session_resumed");
          await routeToNextScreen(existing.accountId, existing.accessToken);
          return;
        }
        const session = await createGuestAccount(API_URL);
        await saveGuestSession(session);
        identifyGuest(session.accountId);
        trackEvent("guest_session_created");
        await routeToNextScreen(session.accountId, session.accessToken);
      } catch {
        trackEvent("guest_session_failed");
        setError("Could not reach the server. Check your connection and try again.");
      }
    })();
  }, [routeToNextScreen]);

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
