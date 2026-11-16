import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { Exercise } from "../lib/api";
import { CreateCustomFoodScreen } from "../screens/CreateCustomFoodScreen";
import { ExerciseDetailScreen } from "../screens/ExerciseDetailScreen";
import { ExerciseLibraryScreen } from "../screens/ExerciseLibraryScreen";
import { FoodSearchScreen } from "../screens/FoodSearchScreen";
import { GuestLoadingScreen } from "../screens/GuestLoadingScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { IngredientQuantityScreen } from "../screens/IngredientQuantityScreen";
import { LogFoodScreen } from "../screens/LogFoodScreen";
import { MyFoodsScreen } from "../screens/MyFoodsScreen";
import { OnboardingScreen } from "../screens/OnboardingScreen";
import { ProgramsScreen } from "../screens/ProgramsScreen";
import { WorkoutSessionScreen } from "../screens/WorkoutSessionScreen";

export interface PickedIngredient {
  foodRef: string;
  name: string;
  quantityG: number;
}

export type RootStackParamList = {
  GuestLoading: undefined;
  Onboarding: { accountId: string };
  Home: { accountId: string };
  FoodSearch: { accountId: string; mode?: "pickIngredient" };
  LogFood: { accountId: string; foodCode: string };
  MyFoods: { accountId: string };
  CreateCustomFood: { accountId: string; pickedIngredient?: PickedIngredient };
  IngredientQuantity: { accountId: string; foodCode: string };
  ExerciseLibrary: { accountId: string; mode?: "pickExercise" };
  ExerciseDetail: { exercise: Exercise };
  WorkoutSession: { accountId: string; pickedExercise?: Exercise };
  Programs: { accountId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="GuestLoading">
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
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: "Fitness" }} />
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
