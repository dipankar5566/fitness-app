import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { loadGuestSession } from "./lib/auth-storage";
import { getDatabase } from "./lib/db";
import { API_URL } from "./lib/env";
import { applyReminderSchedule, loadReminderSettings } from "./lib/reminders";
import { onSyncSettled, syncNow } from "./lib/sync-engine";
import { RootNavigator } from "./navigation/RootNavigator";
import { ThemeProvider, useInterFonts, useTheme } from "./theme";
import { refreshTodayWidget } from "./widget/refresh";

/** Split out so it renders inside ThemeProvider and can read the resolved scheme for the status
 * bar - App itself can't call useTheme() above the provider that supplies it. */
function ThemedStatusBar() {
  const { colors } = useTheme();
  return <StatusBar style={colors.statusBarStyle} />;
}

async function triggerSync(): Promise<void> {
  const [db, session] = await Promise.all([getDatabase(), loadGuestSession()]);
  if (session) {
    await syncNow(db, API_URL, session.accessToken);
  }
}

export default function App() {
  const [isDbReady, setIsDbReady] = useState(false);
  const fontsLoaded = useInterFonts();
  const appState = useRef<AppStateStatus>(AppState.currentState as AppStateStatus);

  useEffect(() => {
    void getDatabase().then(async (db) => {
      setIsDbReady(true);
      // Re-applies the saved schedule on every launch - the OS doesn't persist scheduled
      // notifications across an app reinstall/data-clear/device restore, only kv does.
      await applyReminderSchedule(await loadReminderSettings(db));
    });
  }, []);

  // Every local write triggers a sync, so refreshing the home-screen widget after each sync attempt
  // keeps it current without each screen having to know the widget exists.
  useEffect(() => onSyncSettled(refreshTodayWidget), []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === "active") {
        void triggerSync();
      }
      appState.current = nextState;
    });
    return () => subscription.remove();
  }, []);

  if (!isDbReady || !fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <RootNavigator />
        <ThemedStatusBar />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
