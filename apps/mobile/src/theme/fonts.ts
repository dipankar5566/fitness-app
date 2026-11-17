import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { useFonts } from "expo-font";

/** Loads the Inter weights tokens.ts's fontFamily names point to. App.tsx waits for this (same
 * "don't render until ready" pattern it already uses for the local SQLite database) before
 * mounting the navigator, so no screen ever flashes the system font first. */
export function useInterFonts(): boolean {
  const [loaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  return loaded;
}
