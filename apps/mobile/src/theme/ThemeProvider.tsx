import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { StyleSheet, useColorScheme, type ImageStyle, type TextStyle, type ViewStyle } from "react-native";
import { getDatabase } from "../lib/db";
import { getKv, setKv, THEME_PREFERENCE_KEY } from "../lib/kv-store";
import { darkColors, lightColors, type ColorScheme, type ThemeColors } from "./tokens";

/**
 * Light/dark/system theme, persisted in `kv` and reacting live to the OS setting when the
 * preference is "system" - see docs/THEME_SYSTEM.md for the full design. `App.tsx` wraps
 * `RootNavigator` in this once the local database is ready (the same gate it already applies
 * before mounting anything, so there's no extra "flash of unthemed content" to guard against).
 */
export type ThemePreference = "system" | "light" | "dark";

interface ThemeContextValue {
  colors: ThemeColors;
  scheme: ColorScheme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");

  // Loaded once on mount - App.tsx only mounts this provider after the local database is open, so
  // there's no "render with the wrong theme, then flip" moment for a stored non-default pref.
  useEffect(() => {
    void (async () => {
      const db = await getDatabase();
      const stored = await getKv(db, THEME_PREFERENCE_KEY);
      if (isThemePreference(stored)) {
        setPreferenceState(stored);
      }
    })();
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    void (async () => {
      const db = await getDatabase();
      await setKv(db, THEME_PREFERENCE_KEY, next);
    })();
  }, []);

  const scheme: ColorScheme = preference === "system" ? (systemScheme === "dark" ? "dark" : "light") : preference;
  const colors = scheme === "dark" ? darkColors : lightColors;

  const value = useMemo<ThemeContextValue>(
    () => ({ colors, scheme, preference, setPreference }),
    [colors, scheme, preference, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme() must be called from within a ThemeProvider (see App.tsx)");
  }
  return ctx;
}

/** Mirrors `react-native`'s own (unexported) `NamedStyles<T>` - a self-referential bound on `T`
 * so each property of the factory's returned object literal is contextually checked against
 * `ViewStyle | TextStyle | ImageStyle` while it's still being inferred. Without this, a plain
 * `(colors) => ({ row: { flexDirection: "row" } })` arrow function has no expected return type to
 * check against, so TS widens `"row"` to `string` and `StyleSheet.create` then rejects it. */
type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

/**
 * Turns a `(colors) => StyleSheet-shaped object` factory into a hook that recomputes only when
 * the active colour scheme changes - the replacement for a module-level
 * `StyleSheet.create({ ...colors.x... })`, which could never react to a theme change because it
 * ran once at import time, before any theme was even loaded. Every screen now does:
 *
 *   const useStyles = makeStyles((colors) => ({ card: { backgroundColor: colors.surface } }));
 *   // inside the component:
 *   const styles = useStyles();
 */
export function makeStyles<T extends NamedStyles<T> | NamedStyles<unknown>>(factory: (colors: ThemeColors) => T) {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
