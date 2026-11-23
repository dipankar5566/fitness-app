import { calculateAgeYears, calculateMacroTargets, type ActivityLevel, type DietType, type GoalMode, type MacroTargets, type Sex } from "@fitness-app/shared";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { ChipSelect } from "../components/ChipSelect";
import { AppText, Button, Card, Screen, Stepper } from "../components/ui";
import { trackEvent } from "../lib/analytics";
import { ApiError, submitOnboarding } from "../lib/api";
import { loadGuestSession } from "../lib/auth-storage";
import { API_URL } from "../lib/env";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { makeStyles, radius, space, useTheme } from "../theme";

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

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatLabel(value: string): string {
  return value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

type StepKey = "welcome" | "sex" | "dob" | "height" | "weight" | "activity" | "diet" | "goal" | "summary";
const STEPS: StepKey[] = ["welcome", "sex", "dob", "height", "weight", "activity", "diet", "goal", "summary"];
// "welcome" isn't counted in the "Step X of N" progress indicator - it's an intro, not a question
// being asked, so the progress bar starts filling only once the account actually answers something.
const QUESTION_STEPS = STEPS.length - 1;

const currentYear = new Date().getFullYear();
const MIN_DOB_YEAR = currentYear - 100;
const MAX_DOB_YEAR = currentYear - 10; // a reasonable floor - the app's targets/coach assume an adult

const useStyles = makeStyles((colors) => ({
  track: { height: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, overflow: "hidden" },
  fill: { height: "100%", borderRadius: radius.pill, backgroundColor: colors.primary },
  // Stacked, not a 3-up row: three Steppers side by side would each have to shrink their +/-
  // buttons below the 48dp touch-target minimum to leave any room for the value text (confirmed
  // live - a 4-digit year clipped/wrapped in a squeezed value box). Full-width rows cost a little
  // vertical space but keep every button a real touch target.
  dobField: { marginTop: space.md },
  welcomeWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.sm, paddingHorizontal: space.lg },
  summaryCard: { marginTop: space.md },
}));

/**
 * One-question-per-step onboarding wizard (docs/UI_UX_AUDIT.md) feeding PUT /profile
 * (packages/shared's onboardingRequestSchema: sex/dob/heightCm/activityLevel/dietType/weightKg/
 * goalMode - server computes and stores the real targets). DOB/height/weight use bounded numeric
 * controls (Stepper, three-field DOB) instead of free text, so there's nothing left to validate
 * client-side - every control's own min/max already guarantees a submittable value. The closing
 * "summary" step previews the server's own calculateMacroTargets formula (packages/shared/
 * targets.ts, already used server-side) purely for a same-screen preview - PUT /profile still
 * recomputes and stores the real targets; this is a preview, not a second source of truth.
 */
export function OnboardingScreen({ navigation, route }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [stepIndex, setStepIndex] = useState(0);
  const [sex, setSex] = useState<Sex>("male");
  const [dobDay, setDobDay] = useState(1);
  const [dobMonth, setDobMonth] = useState(1);
  const [dobYear, setDobYear] = useState(currentYear - 25);
  const [heightCm, setHeightCm] = useState(170);
  const [weightKg, setWeightKg] = useState(70);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("moderate");
  const [dietType, setDietType] = useState<DietType>("veg");
  const [goalMode, setGoalMode] = useState<GoalMode>("maintain");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // A month/year change can leave a previously-valid day (e.g. 31) past the new month's end (e.g.
  // Feb) - clamped here rather than in the Stepper itself, which only clamps on its own +/- press.
  useEffect(() => {
    const max = daysInMonth(dobMonth, dobYear);
    setDobDay((day) => Math.min(day, max));
  }, [dobMonth, dobYear]);

  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;
  const dob = `${dobYear}-${pad2(dobMonth)}-${pad2(dobDay)}`;

  const previewTargets = useMemo((): { training: MacroTargets; rest: MacroTargets } => {
    const ageYears = calculateAgeYears(dob);
    const biometrics = { sex, ageYears, heightCm, weightKg, activityLevel };
    return {
      training: calculateMacroTargets(biometrics, goalMode, true),
      rest: calculateMacroTargets(biometrics, goalMode, false),
    };
  }, [sex, dob, heightCm, weightKg, activityLevel, goalMode]);

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
        heightCm,
        activityLevel,
        dietType,
        weightKg,
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
    if (isLastStep) {
      setIsSubmitting(true);
      void handleSubmit();
      return;
    }
    setStepIndex((index) => index + 1);
  };

  const handleBack = () => {
    setStepIndex((index) => Math.max(0, index - 1));
  };

  return (
    <Screen scroll>
      {step !== "welcome" ? (
        <>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${(stepIndex / QUESTION_STEPS) * 100}%` }]} />
          </View>
          <AppText variant="caption" color={colors.textTertiary} style={{ marginTop: space.sm }}>
            Step {stepIndex} of {QUESTION_STEPS}
          </AppText>
        </>
      ) : null}

      <View style={{ flex: 1, marginTop: step === "welcome" ? 0 : space.xxl }}>
        {step === "welcome" ? (
          <View style={styles.welcomeWrap}>
            <MaterialCommunityIcons name="leaf" size={48} color={colors.primary} />
            <AppText variant="h1" center>Let's set up your targets</AppText>
            <AppText variant="body" color={colors.textSecondary} center>
              A few quick questions, then we'll calculate your daily calorie and macro targets.
            </AppText>
          </View>
        ) : null}
        {step === "sex" ? (
          <StepQuestion title="What's your sex?">
            <ChipSelect label="" options={SEX_OPTIONS} value={sex} onChange={setSex} formatOption={formatLabel} />
          </StepQuestion>
        ) : null}
        {step === "dob" ? (
          <StepQuestion title="When were you born?">
            <Stepper label="Day" value={dobDay} onChange={setDobDay} min={1} max={daysInMonth(dobMonth, dobYear)} />
            <View style={styles.dobField}>
              <Stepper label="Month" value={dobMonth} onChange={setDobMonth} min={1} max={12} />
            </View>
            <View style={styles.dobField}>
              <Stepper label="Year" value={dobYear} onChange={setDobYear} min={MIN_DOB_YEAR} max={MAX_DOB_YEAR} />
            </View>
            <AppText color={colors.textSecondary} style={{ marginTop: space.md }}>
              {MONTH_NAMES[dobMonth - 1]} {dobDay}, {dobYear}
            </AppText>
          </StepQuestion>
        ) : null}
        {step === "height" ? (
          <StepQuestion title="What's your height?">
            <Stepper value={heightCm} onChange={setHeightCm} step={1} min={100} max={250} suffix=" cm" />
          </StepQuestion>
        ) : null}
        {step === "weight" ? (
          <StepQuestion title="What's your current weight?">
            <Stepper value={weightKg} onChange={setWeightKg} step={0.5} min={30} max={200} precision={1} suffix=" kg" />
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
        {step === "summary" ? (
          <StepQuestion title="Your daily targets">
            <TargetPreviewCard label="Training day" targets={previewTargets.training} style={styles.summaryCard} />
            <TargetPreviewCard label="Rest day" targets={previewTargets.rest} style={styles.summaryCard} />
            <AppText variant="micro" color={colors.textTertiary} style={{ marginTop: space.md }}>
              An estimate from your answers - refines automatically as you log.
            </AppText>
          </StepQuestion>
        ) : null}

        {submitError ? <AppText color={colors.error} style={{ marginTop: space.lg }}>{submitError}</AppText> : null}
      </View>

      <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.lg }}>
        {stepIndex > 0 ? (
          <Button title="Back" variant="secondary" onPress={handleBack} style={{ flex: 1 }} disabled={isSubmitting} />
        ) : null}
        <Button
          title={step === "welcome" ? "Get started" : isLastStep ? (isSubmitting ? "Saving..." : "Save and continue") : "Next"}
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

function TargetPreviewCard({ label, targets, style }: { label: string; targets: MacroTargets; style?: object }) {
  const { colors } = useTheme();
  return (
    <Card style={style}>
      <AppText variant="captionMedium" color={colors.textSecondary}>{label}</AppText>
      <AppText variant="display" numbers style={{ marginTop: space.xxs }}>{targets.kcal} kcal</AppText>
      <AppText variant="caption" color={colors.textSecondary} numbers>
        {targets.proteinG}g protein · {targets.carbG}g carb · {targets.fatG}g fat
      </AppText>
    </Card>
  );
}
