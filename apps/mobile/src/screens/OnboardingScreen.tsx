import type { ActivityLevel, DietType, GoalMode, Sex } from "@fitness-app/shared";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Button, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ChipSelect } from "../components/ChipSelect";
import { trackEvent } from "../lib/analytics";
import { ApiError, submitOnboarding } from "../lib/api";
import { loadGuestSession } from "../lib/auth-storage";
import { API_URL } from "../lib/env";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Onboarding">;

const SEX_OPTIONS: Sex[] = ["male", "female"];
const ACTIVITY_LEVELS: ActivityLevel[] = [
  "sedentary",
  "light",
  "moderate",
  "active",
  "very_active",
];
const DIET_TYPES: DietType[] = ["veg", "eggetarian", "non_veg", "vegan", "jain"];
const GOAL_MODES: GoalMode[] = ["cut", "recomp", "maintain", "bulk"];

function formatLabel(value: string): string {
  return value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export function OnboardingScreen({ navigation, route }: Props) {
  const [sex, setSex] = useState<Sex>("male");
  const [dob, setDob] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("moderate");
  const [dietType, setDietType] = useState<DietType>("veg");
  const [goalMode, setGoalMode] = useState<GoalMode>("maintain");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    const parsedHeight = Number(heightCm);
    const parsedWeight = Number(weightKg);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      setError("Enter date of birth as YYYY-MM-DD.");
      return;
    }
    if (!Number.isFinite(parsedHeight) || parsedHeight <= 0) {
      setError("Enter a valid height in cm.");
      return;
    }
    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      setError("Enter a valid weight in kg.");
      return;
    }

    setIsSubmitting(true);
    try {
      const session = await loadGuestSession();
      if (!session) {
        throw new Error("No guest session");
      }
      await submitOnboarding(API_URL, session.accessToken, {
        sex,
        dob,
        heightCm: parsedHeight,
        activityLevel,
        dietType,
        weightKg: parsedWeight,
        goalMode,
      });
      trackEvent("onboarding_completed");
      // Programs is the next stop, not Home - PRD section 5.4 ("programs selectable in
      // onboarding"). ProgramsScreen itself navigates on to Home once the user follows one or
      // skips.
      navigation.replace("Programs", { accountId: route.params.accountId });
    } catch (err) {
      trackEvent("onboarding_failed");
      setError(
        err instanceof ApiError
          ? "Could not save your profile. Check your connection and try again."
          : "Something went wrong. Try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ChipSelect label="Sex" options={SEX_OPTIONS} value={sex} onChange={setSex} formatOption={formatLabel} />

      <Text style={styles.label}>Date of birth</Text>
      <TextInput
        style={styles.input}
        placeholder="YYYY-MM-DD"
        value={dob}
        onChangeText={setDob}
        autoCapitalize="none"
      />

      <Text style={styles.label}>Height (cm)</Text>
      <TextInput
        style={styles.input}
        placeholder="175"
        keyboardType="numeric"
        value={heightCm}
        onChangeText={setHeightCm}
      />

      <Text style={styles.label}>Weight (kg)</Text>
      <TextInput
        style={styles.input}
        placeholder="70"
        keyboardType="numeric"
        value={weightKg}
        onChangeText={setWeightKg}
      />

      <ChipSelect
        label="Activity level"
        options={ACTIVITY_LEVELS}
        value={activityLevel}
        onChange={setActivityLevel}
        formatOption={formatLabel}
      />
      <ChipSelect
        label="Diet type"
        options={DIET_TYPES}
        value={dietType}
        onChange={setDietType}
        formatOption={formatLabel}
      />
      <ChipSelect
        label="Goal"
        options={GOAL_MODES}
        value={goalMode}
        onChange={setGoalMode}
        formatOption={formatLabel}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.submitButton}>
        <Button
          title={isSubmitting ? "Saving..." : "Save and continue"}
          onPress={handleSubmit}
          disabled={isSubmitting}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingBottom: 48 },
  label: { fontWeight: "600", marginTop: 16, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10 },
  error: { color: "#c00", textAlign: "center", marginTop: 16 },
  submitButton: { marginTop: 24 },
});
