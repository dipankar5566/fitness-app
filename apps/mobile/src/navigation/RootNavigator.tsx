import type { MealType } from "@fitness-app/shared";
import { createNavigationContainerRef, DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useCallback, useEffect, useRef } from "react";
import { Linking } from "react-native";
import type { Exercise } from "../lib/api";
import { loadGuestSession } from "../lib/auth-storage";
import { parseDeepLink, type DeepLinkTarget } from "../lib/deep-links";
import { MainTabs } from "./MainTabs";
import { BarcodeScanScreen } from "../screens/BarcodeScanScreen";
import { AchievementsScreen } from "../screens/AchievementsScreen";
import { MealPlanScreen } from "../screens/MealPlanScreen";
import { CoachChatScreen } from "../screens/CoachChatScreen";
import { CreateCustomFoodScreen } from "../screens/CreateCustomFoodScreen";
import { ExerciseDetailScreen } from "../screens/ExerciseDetailScreen";
import { ExerciseLibraryScreen } from "../screens/ExerciseLibraryScreen";
import { FoodSearchScreen } from "../screens/FoodSearchScreen";
import { GuestLoadingScreen } from "../screens/GuestLoadingScreen";
import { HealthConnectScreen } from "../screens/HealthConnectScreen";
import { IngredientQuantityScreen } from "../screens/IngredientQuantityScreen";
import { LogFoodScreen } from "../screens/LogFoodScreen";
import { LogMealFromTextScreen } from "../screens/LogMealFromTextScreen";
import { LogPackagedFoodScreen } from "../screens/LogPackagedFoodScreen";
import { MyFoodsScreen } from "../screens/MyFoodsScreen";
import { OnboardingScreen } from "../screens/OnboardingScreen";
import { ProgramsScreen } from "../screens/ProgramsScreen";
import { RemindersScreen } from "../screens/RemindersScreen";
import { WorkoutSessionScreen } from "../screens/WorkoutSessionScreen";
import { fontFamily, useTheme } from "../theme";

export interface PickedIngredient {
  foodRef: string;
  name: string;
  quantityG: number;
}

export type RootStackParamList = {
  GuestLoading: undefined;
  Onboarding: { accountId: string };
  Home: { accountId: string };
  FoodSearch: {
    accountId: string;
    mode?: "pickIngredient" | "pickMealItem" | "swapPlanItem";
    mealItemIndex?: number;
    presetMealType?: MealType;
  };
  LogFood: { accountId: string; foodCode: string; presetMealType?: MealType };
  MyFoods: { accountId: string };
  CreateCustomFood: { accountId: string; pickedIngredient?: PickedIngredient };
  IngredientQuantity: { accountId: string; foodCode: string };
  ExerciseLibrary: { accountId: string; mode?: "pickExercise" };
  ExerciseDetail: { exercise: Exercise };
  WorkoutSession: { accountId: string; pickedExercise?: Exercise };
  Programs: { accountId: string };
  LogMealFromText: {
    accountId: string;
    pickedMealItemFood?: { index: number; code: string; name: string };
  };
  BarcodeScan: { accountId: string };
  LogPackagedFood: { accountId: string; barcode: string };
  CoachChat: { accountId: string };
  Reminders: { accountId: string };
  HealthConnect: { accountId: string };
  Achievements: { accountId: string };
  MealPlan: { accountId: string; swappedPlanItem?: { index: number; code: string; name: string } };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const navigationRef = createNavigationContainerRef<RootStackParamList>();

/** Screens a deep link must wait behind - the guest session/onboarding hasn't resolved yet. */
const DEEP_LINK_BLOCKING_ROUTES = new Set<string>(["GuestLoading", "Onboarding"]);

/**
 * Widget deep links (lib/deep-links.ts). A link can arrive before the navigator is ready or while
 * GuestLoading is still resolving the session (cold start from the widget), so it's held as pending
 * and flushed on onReady/onStateChange once a real screen is showing - then navigated with the
 * session's accountId, which the URL itself can't carry.
 */
function useWidgetDeepLinks() {
  const pending = useRef<DeepLinkTarget | null>(null);

  const flush = useCallback(async () => {
    const target = pending.current;
    if (!target || !navigationRef.isReady()) return;
    const current = navigationRef.getCurrentRoute()?.name;
    if (!current || DEEP_LINK_BLOCKING_ROUTES.has(current)) return;
    const session = await loadGuestSession();
    if (!session || pending.current !== target) return;
    pending.current = null;
    if (target === "food_search") {
      navigationRef.navigate("FoodSearch", { accountId: session.accountId });
    } else {
      navigationRef.navigate("Home", { accountId: session.accountId });
    }
  }, []);

  useEffect(() => {
    const receive = (url: string | null | undefined) => {
      const target = parseDeepLink(url);
      if (target) {
        pending.current = target;
        void flush();
      }
    };
    void Linking.getInitialURL().then(receive);
    const subscription = Linking.addEventListener("url", ({ url }) => receive(url));
    return () => subscription.remove();
  }, [flush]);

  return flush;
}

export function RootNavigator() {
  const flushDeepLink = useWidgetDeepLinks();
  const { colors, scheme } = useTheme();
  // React Navigation's own light/dark theme objects control things this app doesn't otherwise
  // touch (the native modal backdrop, the default header back button tint) - layered under our
  // own explicit screenOptions below, not replacing them.
  const navTheme = scheme === "dark" ? DarkTheme : DefaultTheme;
  return (
    <NavigationContainer
      ref={navigationRef}
      theme={{
        ...navTheme,
        colors: { ...navTheme.colors, background: colors.bg, card: colors.surface, text: colors.text, border: colors.stroke, primary: colors.primary },
      }}
      onReady={() => void flushDeepLink()}
      onStateChange={() => void flushDeepLink()}
    >
      <Stack.Navigator
        initialRouteName="GuestLoading"
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerShadowVisible: false,
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: fontFamily.semiBold, fontSize: 16 },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen
          name="GuestLoading"
          component={GuestLoadingScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Onboarding"
          component={OnboardingScreen}
          options={{ title: "Set up your targets" }}
        />
        <Stack.Screen name="Home" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen
          name="FoodSearch"
          component={FoodSearchScreen}
          options={{ title: "Log a food" }}
        />
        <Stack.Screen name="LogFood" component={LogFoodScreen} options={{ title: "Log food" }} />
        <Stack.Screen name="MyFoods" component={MyFoodsScreen} options={{ title: "My foods" }} />
        <Stack.Screen
          name="CreateCustomFood"
          component={CreateCustomFoodScreen}
          options={{ title: "New custom food" }}
        />
        <Stack.Screen
          name="IngredientQuantity"
          component={IngredientQuantityScreen}
          options={{ title: "Add ingredient" }}
        />
        <Stack.Screen
          name="ExerciseLibrary"
          component={ExerciseLibraryScreen}
          options={{ title: "Exercises" }}
        />
        <Stack.Screen
          name="ExerciseDetail"
          component={ExerciseDetailScreen}
          options={{ title: "Exercise" }}
        />
        <Stack.Screen
          name="WorkoutSession"
          component={WorkoutSessionScreen}
          options={{ title: "Workout" }}
        />
        <Stack.Screen name="Programs" component={ProgramsScreen} options={{ title: "Programs" }} />
        <Stack.Screen
          name="LogMealFromText"
          component={LogMealFromTextScreen}
          options={{ title: "Log a meal" }}
        />
        <Stack.Screen
          name="BarcodeScan"
          component={BarcodeScanScreen}
          options={{ title: "Scan barcode" }}
        />
        <Stack.Screen
          name="LogPackagedFood"
          component={LogPackagedFoodScreen}
          options={{ title: "Log product" }}
        />
        <Stack.Screen name="CoachChat" component={CoachChatScreen} options={{ title: "Coach" }} />
        <Stack.Screen name="Reminders" component={RemindersScreen} options={{ title: "Reminders" }} />
        <Stack.Screen name="HealthConnect" component={HealthConnectScreen} options={{ title: "Health Connect" }} />
        <Stack.Screen name="Achievements" component={AchievementsScreen} options={{ title: "Achievements" }} />
        <Stack.Screen name="MealPlan" component={MealPlanScreen} options={{ title: "Meal plan" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
