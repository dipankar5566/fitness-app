import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { AppText, Button, Screen } from "../components/ui";
import { identifyGuest, trackEvent } from "../lib/analytics";
import { createGuestAccount, getProfile, isNetworkError, isUnauthorizedError, type GetProfileResponse } from "../lib/api";
import { loadGuestSession, saveGuestSession, wasSignedOut } from "../lib/auth-storage";
import { getDatabase } from "../lib/db";
import { API_URL } from "../lib/env";
import { CACHED_PROFILE_KEY, getKv, setKv } from "../lib/kv-store";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { space, useTheme } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "GuestLoading">;

export function GuestLoadingScreen({ navigation }: Props) {
  const { colors } = useTheme();
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
        // An expired 30-day JWT on a Google session - distinct from "could not reach the server",
        // since the device IS reachable here, it just needs to sign in again.
        if (isUnauthorizedError(err)) {
          navigation.replace("Welcome");
          return;
        }
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
        // A missing session after an explicit sign-out means "show Welcome", not "silently create
        // a new guest" - every session that predates Google Sign-In never set this flag, so a
        // genuine first launch still falls through to guest creation below as before.
        if (await wasSignedOut()) {
          navigation.replace("Welcome");
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
  }, [navigation, routeToNextScreen]);

  useEffect(() => {
    establishSession();
  }, [establishSession]);

  if (error) {
    return (
      <Screen edges={["top", "bottom"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: space.lg }}>
          <AppText center color={colors.textSecondary} style={{ marginHorizontal: space.xxl }}>
            {error}
          </AppText>
          <Button title="Retry" onPress={establishSession} style={{ minWidth: 140 }} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={["top", "bottom"]}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    </Screen>
  );
}
