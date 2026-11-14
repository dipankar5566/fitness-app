import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { FoodSearchScreen } from "../screens/FoodSearchScreen";
import { GuestLoadingScreen } from "../screens/GuestLoadingScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { LogFoodScreen } from "../screens/LogFoodScreen";
import { OnboardingScreen } from "../screens/OnboardingScreen";

export type RootStackParamList = {
  GuestLoading: undefined;
  Onboarding: { accountId: string };
  Home: { accountId: string };
  FoodSearch: { accountId: string };
  LogFood: { accountId: string; foodCode: string };
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
