import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { View } from "react-native";
import { AppText, Button, Screen } from "../components/ui";
import { signInWithGoogleFlow } from "../lib/account-auth";
import { clearSignedOutFlag } from "../lib/auth-storage";
import { getDatabase } from "../lib/db";
import { API_URL } from "../lib/env";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { space, useTheme } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Welcome">;

/**
 * Shown after a Google-account sign-out (GuestLoadingScreen routes here instead of silently
 * creating a guest, see its own comment) - a guest device never sees this, since signing out isn't
 * offered to guests (CLAUDE.md/plan: "Guests see Create account / Sign in", not Sign out).
 */
export function WelcomeScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsSigningIn(true);
    try {
      const db = await getDatabase();
      await signInWithGoogleFlow(db, API_URL);
      navigation.reset({ index: 0, routes: [{ name: "GuestLoading" }] });
    } catch {
      setError("Could not sign in. Check your connection and try again.");
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleContinueAsGuest = async () => {
    await clearSignedOutFlag();
    navigation.reset({ index: 0, routes: [{ name: "GuestLoading" }] });
  };

  return (
    <Screen edges={["top", "bottom"]}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: space.lg, paddingHorizontal: space.xxl }}>
        <MaterialCommunityIcons name="leaf" size={48} color={colors.primary} />
        <AppText variant="h1" center>Welcome back</AppText>
        <AppText variant="body" color={colors.textSecondary} center>
          Sign in to pick up your targets and logs, or continue without an account.
        </AppText>
        {error ? <AppText color={colors.error} center>{error}</AppText> : null}
      </View>
      <View style={{ gap: space.sm }}>
        <Button
          title={isSigningIn ? "Signing in..." : "Continue with Google"}
          onPress={handleGoogleSignIn}
          loading={isSigningIn}
          disabled={isSigningIn}
        />
        <Button title="Continue as guest" variant="secondary" onPress={handleContinueAsGuest} disabled={isSigningIn} />
      </View>
    </Screen>
  );
}
