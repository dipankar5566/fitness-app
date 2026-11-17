import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { CompositeScreenProps } from "@react-navigation/native";
import { createBottomTabNavigator, type BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { HomeScreen } from "../screens/HomeScreen";
import { LogTabScreen, MeTabScreen, WorkoutTabScreen } from "../screens/TabScreens";
import { colors, textVariants } from "../theme";
import type { RootStackParamList } from "./RootNavigator";

/**
 * Bottom tabs for the signed-in app, replacing the old "stack of buttons on Home" IA (see
 * healthifyme-re/UI_UX.md: HealthifyMe's own top level is tabbed, not a button list). Registered
 * as the existing "Home" stack screen in RootNavigator.tsx (route name kept, not renamed) so every
 * screen that already does `navigation.navigate("Home", { accountId })` keeps working unchanged -
 * popping back to "Home" just refocuses whichever tab was active.
 */
export type MainTabParamList = {
  Today: { accountId: string };
  Log: { accountId: string };
  Workout: { accountId: string };
  Me: { accountId: string };
};

/** Every tab screen's Props type - gives `navigation.navigate(...)` access to both this tab
 * navigator's own screens and every screen pushed on the root stack (FoodSearch, WorkoutSession,
 * etc.), per React Navigation's documented pattern for typing a nested navigator. */
export type MainTabScreenProps<T extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICONS: Record<keyof MainTabParamList, keyof typeof MaterialCommunityIcons.glyphMap> = {
  Today: "home-variant",
  Log: "plus-circle-outline",
  Workout: "dumbbell",
  Me: "account-circle-outline",
};

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export function MainTabs({ route }: Props) {
  const { accountId } = route.params;

  return (
    <Tab.Navigator
      screenOptions={({ route: tabRoute }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.stroke },
        tabBarLabelStyle: textVariants.micro,
        tabBarIcon: ({ color, size }) => (
          <MaterialCommunityIcons
            name={TAB_ICONS[tabRoute.name as keyof MainTabParamList]}
            color={color}
            size={size}
          />
        ),
      })}
    >
      <Tab.Screen name="Today" component={HomeScreen} initialParams={{ accountId }} />
      <Tab.Screen name="Log" component={LogTabScreen} initialParams={{ accountId }} />
      <Tab.Screen name="Workout" component={WorkoutTabScreen} initialParams={{ accountId }} />
      <Tab.Screen name="Me" component={MeTabScreen} initialParams={{ accountId }} />
    </Tab.Navigator>
  );
}
