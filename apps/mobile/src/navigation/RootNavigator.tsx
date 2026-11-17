import type { MealType } from "@fitness-app/shared";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { Exercise } from "../lib/api";
import { MainTabs } from "./MainTabs";
import { BarcodeScanScreen } from "../screens/BarcodeScanScreen";
import { CreateCustomFoodScreen } from "../screens/CreateCustomFoodScreen";
import { ExerciseDetailScreen } from "../screens/ExerciseDetailScreen";
import { ExerciseLibraryScreen } from "../screens/ExerciseLibraryScreen";
import { FoodSearchScreen } from "../screens/FoodSearchScreen";
import { GuestLoadingScreen } from "../screens/GuestLoadingScreen";
import { IngredientQuantityScreen } from "../screens/IngredientQuantityScreen";
import { LogFoodScreen } from "../screens/LogFoodScreen";
import { LogMealFromTextScreen } from "../screens/LogMealFromTextScreen";
import { LogPackagedFoodScreen } from "../screens/LogPackagedFoodScreen";
import { MyFoodsScreen } from "../screens/MyFoodsScreen";
import { OnboardingScreen } from "../screens/OnboardingScreen";
import { ProgramsScreen } from "../screens/ProgramsScreen";
import { WorkoutSessionScreen } from "../screens/WorkoutSessionScreen";
import { colors, fontFamily } from "../theme";

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
    mode?: "pickIngredient" | "pickMealItem";
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
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <NavigationContainer>
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
