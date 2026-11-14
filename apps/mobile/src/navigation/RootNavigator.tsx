import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { GuestLoadingScreen } from "../screens/GuestLoadingScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { OnboardingScreen } from "../screens/OnboardingScreen";

export type RootStackParamList = {
  GuestLoading: undefined;
  Onboarding: { accountId: string };
  Home: { accountId: string };
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
