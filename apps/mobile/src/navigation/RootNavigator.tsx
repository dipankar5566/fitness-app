import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { CreateCustomFoodScreen } from "../screens/CreateCustomFoodScreen";
import { FoodSearchScreen } from "../screens/FoodSearchScreen";
import { GuestLoadingScreen } from "../screens/GuestLoadingScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { IngredientQuantityScreen } from "../screens/IngredientQuantityScreen";
import { LogFoodScreen } from "../screens/LogFoodScreen";
import { MyFoodsScreen } from "../screens/MyFoodsScreen";
import { OnboardingScreen } from "../screens/OnboardingScreen";

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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
