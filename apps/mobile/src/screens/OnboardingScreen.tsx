import type { ActivityLevel, DietType, GoalMode, Sex } from "@fitness-app/shared";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ReactNode } from "react";
import { useState } from "react";
import { View } from "react-native";
import { ChipSelect } from "../components/ChipSelect";
import { AppText, Button, Screen, TextField } from "../components/ui";
import { trackEvent } from "../lib/analytics";
import { ApiError, submitOnboarding } from "../lib/api";
import { loadGuestSession } from "../lib/auth-storage";
import { API_URL } from "../lib/env";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors, radius, space } from "../theme";

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

type StepKey = "sex" | "dob" | "height" | "weight" | "activity" | "diet" | "goal";
const STEPS: StepKey[] = ["sex", "dob", "height", "weight", "activity", "diet", "goal"];

export function OnboardingScreen({ navigation, route }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [sex, setSex] = useState<Sex>("male");
  const [dob, setDob] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("moderate");
  const [dietType, setDietType] = useState<DietType>("veg");
  const [goalMode, setGoalMode] = useState<GoalMode>("maintain");
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;

  const validateCurrentStep = (): boolean => {
    if (step === "dob" && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      setStepError("Enter date of birth as YYYY-MM-DD.");
      return false;
    }
    if (step === "height" && (!Number.isFinite(Number(heightCm)) || Number(heightCm) <= 0)) {
      setStepError("Enter a valid height in cm.");
      return false;
    }
    if (step === "weight" && (!Number.isFinite(Number(weightKg)) || Number(weightKg) <= 0)) {
      setStepError("Enter a valid weight in kg.");
      return false;
    }
    setStepError(null);
    return true;
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    try {
      const session = await loadGuestSession();
      if (!session) {
        throw new Error("No guest session");
      }
      await submitOnboarding(API_URL, session.accessToken, {
        sex,
        dob,
        heightCm: Number(heightCm),
        activityLevel,
        dietType,
        weightKg: Number(weightKg),
        goalMode,
      });
      trackEvent("onboarding_completed");
      // Programs is the next stop, not Home - PRD section 5.4 ("programs selectable in
      // onboarding"). ProgramsScreen itself navigates on to Home once the user follows one or
      // skips.
      navigation.replace("Programs", { accountId: route.params.accountId });
    } catch (err) {
      trackEvent("onboarding_failed");
      setSubmitError(
        err instanceof ApiError
          ? "Could not save your profile. Check your connection and try again."
          : "Something went wrong. Try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = () => {
    if (!validateCurrentStep()) {
      return;
    }
    if (isLastStep) {
      setIsSubmitting(true);
      void handleSubmit();
      return;
    }
    setStepIndex((index) => index + 1);
  };

  const handleBack = () => {
    setStepError(null);
    setStepIndex((index) => Math.max(0, index - 1));
  };

  return (
    <Screen>
      <View style={{ height: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, overflow: "hidden" }}>
        <View
          style={{
            height: "100%",
            borderRadius: radius.pill,
            backgroundColor: colors.primary,
            width: `${((stepIndex + 1) / STEPS.length) * 100}%`,
          }}
        />
      </View>
      <AppText variant="caption" color={colors.textTertiary} style={{ marginTop: space.sm }}>
        Step {stepIndex + 1} of {STEPS.length}
      </AppText>

      <View style={{ flex: 1, marginTop: space.xxl }}>
        {step === "sex" ? (
          <StepQuestion title="What's your sex?">
            <ChipSelect label="" options={SEX_OPTIONS} value={sex} onChange={setSex} formatOption={formatLabel} />
          </StepQuestion>
        ) : null}
        {step === "dob" ? (
          <StepQuestion title="When were you born?">
            <TextField placeholder="YYYY-MM-DD" value={dob} onChangeText={setDob} autoCapitalize="none" />
          </StepQuestion>
        ) : null}
        {step === "height" ? (
          <StepQuestion title="What's your height?">
            <TextField placeholder="175" keyboardType="numeric" value={heightCm} onChangeText={setHeightCm} />
            <AppText color={colors.textTertiary} style={{ marginTop: space.xs }}>centimeters</AppText>
          </StepQuestion>
        ) : null}
        {step === "weight" ? (
          <StepQuestion title="What's your current weight?">
            <TextField placeholder="70" keyboardType="numeric" value={weightKg} onChangeText={setWeightKg} />
            <AppText color={colors.textTertiary} style={{ marginTop: space.xs }}>kilograms</AppText>
          </StepQuestion>
        ) : null}
        {step === "activity" ? (
          <StepQuestion title="How active are you?">
            <ChipSelect label="" options={ACTIVITY_LEVELS} value={activityLevel} onChange={setActivityLevel} formatOption={formatLabel} />
          </StepQuestion>
        ) : null}
        {step === "diet" ? (
          <StepQuestion title="What's your diet type?">
            <ChipSelect label="" options={DIET_TYPES} value={dietType} onChange={setDietType} formatOption={formatLabel} />
          </StepQuestion>
        ) : null}
        {step === "goal" ? (
          <StepQuestion title="What's your goal?">
            <ChipSelect label="" options={GOAL_MODES} value={goalMode} onChange={setGoalMode} formatOption={formatLabel} />
          </StepQuestion>
        ) : null}

        {stepError ? <AppText color={colors.error} style={{ marginTop: space.lg }}>{stepError}</AppText> : null}
        {submitError ? <AppText color={colors.error} style={{ marginTop: space.lg }}>{submitError}</AppText> : null}
      </View>

      <View style={{ flexDirection: "row", gap: space.sm }}>
        {stepIndex > 0 ? (
          <Button title="Back" variant="secondary" onPress={handleBack} style={{ flex: 1 }} disabled={isSubmitting} />
        ) : null}
        <Button
          title={isLastStep ? (isSubmitting ? "Saving..." : "Save and continue") : "Next"}
          onPress={handleNext}
          loading={isLastStep && isSubmitting}
          style={{ flex: 1 }}
        />
      </View>
    </Screen>
  );
}

function StepQuestion({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View>
      <AppText variant="h1" style={{ marginBottom: space.lg }}>{title}</AppText>
      {children}
    </View>
  );
}
