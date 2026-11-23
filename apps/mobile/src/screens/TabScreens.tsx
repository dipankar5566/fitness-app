import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { ChipSelect } from "../components/ChipSelect";
import { AppText, Badge, Card, ListRow, Screen, SectionHeader } from "../components/ui";
import { getProfile, isNetworkError, type GetProfileResponse } from "../lib/api";
import { loadGuestSession } from "../lib/auth-storage";
import { getDatabase } from "../lib/db";
import { API_URL } from "../lib/env";
import { CACHED_GOAL_KEY, CACHED_PROFILE_KEY, getKv } from "../lib/kv-store";
import { getActiveSession, listSetsForSession } from "../lib/workout-repo";
import type { MainTabScreenProps } from "../navigation/MainTabs";
import { makeStyles, space, tabularNumbers, useTheme, type ThemePreference } from "../theme";

/**
 * The three simpler tabs (Log/Workout/Me) - kept in one file since each is a short menu/summary
 * screen built entirely from reusable components, unlike Today (HomeScreen.tsx, the hero of the
 * redesign) or the flow screens (which each have their own file as before).
 */

const useDividerStyles = makeStyles((colors) => ({ divider: { height: 1, backgroundColor: colors.separator } }));

function Divider() {
  const styles = useDividerStyles();
  return <View style={styles.divider} />;
}

// ---------------------------------------------------------------------------
// Log tab - quick entry points into every logging flow.
// ---------------------------------------------------------------------------

export function LogTabScreen({ navigation, route }: MainTabScreenProps<"Log">) {
  const { accountId } = route.params;
  return (
    <Screen scroll edges={["top", "bottom"]}>
      <AppText variant="h1" style={{ marginBottom: space.lg }}>Log food</AppText>
      <Card>
        <ListRow
          icon="magnify"
          title="Search foods"
          subtitle="Search our food database"
          onPress={() => navigation.navigate("FoodSearch", { accountId })}
        />
        <Divider />
        <ListRow
          icon="chat-processing-outline"
          title="Log meal with AI"
          subtitle="Describe it, or snap a photo"
          onPress={() => navigation.navigate("LogMealFromText", { accountId })}
        />
        <Divider />
        <ListRow
          icon="barcode-scan"
          title="Scan barcode"
          subtitle="Packaged food lookup"
          onPress={() => navigation.navigate("BarcodeScan", { accountId })}
        />
        <Divider />
        <ListRow
          icon="silverware-fork-knife"
          title="Today's meal plan"
          subtitle="An AI sample day built around your targets"
          onPress={() => navigation.navigate("MealPlan", { accountId })}
        />
      </Card>

      <SectionHeader title="Your foods" style={{ marginTop: space.xxl }} />
      <Card>
        <ListRow
          icon="notebook-outline"
          title="My foods"
          subtitle="Custom foods & recipes"
          onPress={() => navigation.navigate("MyFoods", { accountId })}
        />
        <Divider />
        <ListRow
          icon="plus-box-outline"
          title="Create custom food"
          onPress={() => navigation.navigate("CreateCustomFood", { accountId })}
        />
      </Card>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Workout tab - today's session status + entry points to programs/exercise library.
// ---------------------------------------------------------------------------

export function WorkoutTabScreen({ navigation, route }: MainTabScreenProps<"Workout">) {
  const { accountId } = route.params;
  const { colors } = useTheme();
  const [setCount, setSetCount] = useState<number | null>(null);
  const [hasActiveSession, setHasActiveSession] = useState(false);

  const refresh = useCallback(async () => {
    const db = await getDatabase();
    const active = await getActiveSession(db, accountId);
    setHasActiveSession(Boolean(active));
    setSetCount(active ? (await listSetsForSession(db, active.id)).length : null);
  }, [accountId]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return (
    <Screen scroll edges={["top", "bottom"]}>
      <AppText variant="h1" style={{ marginBottom: space.lg }}>Workout</AppText>

      <Card>
        <AppText variant="h2">{hasActiveSession ? "Workout in progress" : "No workout today yet"}</AppText>
        {hasActiveSession ? (
          <AppText variant="body" color={colors.textSecondary} style={{ marginTop: space.xxs }}>
            {setCount} set{setCount === 1 ? "" : "s"} logged so far
          </AppText>
        ) : (
          <AppText variant="body" color={colors.textSecondary} style={{ marginTop: space.xxs }}>
            Start a session to log sets as you train.
          </AppText>
        )}
        <ListRow
          icon={hasActiveSession ? "arrow-right-circle-outline" : "play-circle-outline"}
          title={hasActiveSession ? "Continue workout" : "Start workout"}
          onPress={() => navigation.navigate("WorkoutSession", { accountId })}
          style={{ marginTop: space.sm, paddingVertical: space.sm }}
        />
      </Card>

      <SectionHeader title="Plan ahead" style={{ marginTop: space.xxl }} />
      <Card>
        <ListRow
          icon="calendar-check-outline"
          title="Programs"
          subtitle="Follow a built-in program"
          onPress={() => navigation.navigate("Programs", { accountId })}
        />
        <Divider />
        <ListRow
          icon="dumbbell"
          title="Exercise library"
          subtitle="Browse by muscle & equipment"
          onPress={() => navigation.navigate("ExerciseLibrary", { accountId })}
        />
      </Card>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Me tab - targets, grouped settings, and the theme picker. Regrouped per
// docs/UI_UX_AUDIT.md M2/M3: the raw account id no longer sits bare on screen (it's now a
// labelled, long-press-selectable row via RN's native `selectable` text - no new dependency
// needed for "copy" since Android's own text-selection toolbar already offers Copy), and "More"
// is split into Preferences/Activity/About instead of one undifferentiated list.
// ---------------------------------------------------------------------------

const THEME_PREFERENCE_OPTIONS: readonly ThemePreference[] = ["system", "light", "dark"];
const THEME_PREFERENCE_LABELS: Record<ThemePreference, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

const useMeStyles = makeStyles((colors) => ({
  idLabel: { marginBottom: space.xxs },
  idValue: { color: colors.textSecondary, ...tabularNumbers },
}));

export function MeTabScreen({ navigation, route }: MainTabScreenProps<"Me">) {
  const { accountId } = route.params;
  const { colors, preference, setPreference } = useTheme();
  const styles = useMeStyles();
  const [profile, setProfile] = useState<GetProfileResponse | null>(null);

  const refresh = useCallback(async () => {
    const session = await loadGuestSession();
    if (!session) return;
    const db = await getDatabase();
    try {
      const result = await getProfile(API_URL, session.accessToken);
      setProfile(result);
      await getKv(db, CACHED_PROFILE_KEY); // keep the cache warm for GuestLoadingScreen's offline path
    } catch (err) {
      if (!isNetworkError(err)) throw err;
      const cachedProfile = await getKv(db, CACHED_PROFILE_KEY);
      const cachedGoal = await getKv(db, CACHED_GOAL_KEY);
      setProfile({
        profile: cachedProfile ? JSON.parse(cachedProfile) : null,
        goal: cachedGoal ? JSON.parse(cachedGoal) : null,
      });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const goal = profile?.goal;
  const dietType = profile?.profile?.diet_type;

  return (
    <Screen scroll edges={["top", "bottom"]}>
      <AppText variant="h1" style={{ marginBottom: space.lg }}>Me</AppText>

      <SectionHeader title="Daily target" />
      <Card>
        {goal ? (
          <>
            <AppText variant="display" numbers>{Math.round(Number(goal.target_kcal))} kcal</AppText>
            <AppText variant="body" color={colors.textSecondary} numbers style={{ marginTop: space.xxs }}>
              {Math.round(Number(goal.target_protein_g))}g protein · {Math.round(Number(goal.target_carb_g))}g carb ·{" "}
              {Math.round(Number(goal.target_fat_g))}g fat
            </AppText>
            {dietType ? (
              <View style={{ marginTop: space.sm }}>
                <Badge label={dietType.replace(/_/g, " ")} />
              </View>
            ) : null}
          </>
        ) : (
          <AppText variant="body" color={colors.textSecondary}>Not set yet.</AppText>
        )}
      </Card>

      <SectionHeader title="Preferences" style={{ marginTop: space.xxl }} />
      <Card>
        <ChipSelect
          label="Appearance"
          options={THEME_PREFERENCE_OPTIONS}
          value={preference}
          onChange={setPreference}
          formatOption={(value) => THEME_PREFERENCE_LABELS[value]}
        />
        <Divider />
        <ListRow icon="bell-outline" title="Reminders" onPress={() => navigation.navigate("Reminders", { accountId })} />
        <Divider />
        <ListRow icon="heart-pulse" title="Health Connect" onPress={() => navigation.navigate("HealthConnect", { accountId })} />
      </Card>

      <SectionHeader title="Activity" style={{ marginTop: space.xxl }} />
      <Card>
        <ListRow
          icon="trophy-outline"
          title="Achievements"
          subtitle="Level, points & badges"
          onPress={() => navigation.navigate("Achievements", { accountId })}
        />
        <Divider />
        <ListRow icon="notebook-outline" title="My foods" onPress={() => navigation.navigate("MyFoods", { accountId })} />
        <Divider />
        <ListRow icon="calendar-check-outline" title="Programs" onPress={() => navigation.navigate("Programs", { accountId })} />
        <Divider />
        <ListRow
          icon="robot-happy-outline"
          title="Coach"
          subtitle="Ask about your targets, logs & training"
          onPress={() => navigation.navigate("CoachChat", { accountId })}
        />
      </Card>

      <SectionHeader title="About" style={{ marginTop: space.xxl }} />
      <Card>
        <AppText variant="label" color={colors.textSecondary} style={styles.idLabel}>Account ID</AppText>
        <Text selectable style={styles.idValue}>{accountId}</Text>
        <AppText variant="micro" color={colors.textTertiary} style={{ marginTop: space.xs }}>
          Long-press to select and copy.
        </AppText>
      </Card>
    </Screen>
  );
}
