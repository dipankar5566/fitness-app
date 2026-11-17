import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { loadGuestSession } from "./lib/auth-storage";
import { getDatabase } from "./lib/db";
import { API_URL } from "./lib/env";
import { syncNow } from "./lib/sync-engine";
import { RootNavigator } from "./navigation/RootNavigator";
import { useInterFonts } from "./theme";

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
    void getDatabase().then(() => setIsDbReady(true));
  }, []);

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
      <RootNavigator />
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
