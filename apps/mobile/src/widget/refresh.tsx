import { Platform } from "react-native";
import { requestWidgetUpdate } from "react-native-android-widget";
import { loadGuestSession } from "../lib/auth-storage";
import { getDatabase } from "../lib/db";
import { TODAY_WIDGET_NAME, TodayWidget } from "./TodayWidget";
import { loadWidgetSnapshot } from "./widget-data";

/**
 * Re-renders any home-screen widget instances from the local mirror. App.tsx registers this to run
 * after every sync attempt (sync-engine.ts's onSyncSettled), and every write already triggers a
 * sync - so a logged food or glass shows up on the widget without a separate call per screen.
 * Best-effort: a no-op off Android or with no widget placed, and never throws into the caller.
 */
export async function refreshTodayWidget(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await requestWidgetUpdate({
      widgetName: TODAY_WIDGET_NAME,
      renderWidget: async () => {
        const session = await loadGuestSession();
        if (!session) return <TodayWidget snapshot={null} />;
        return <TodayWidget snapshot={await loadWidgetSnapshot(await getDatabase(), session.accountId)} />;
      },
    });
  } catch {
    // Widget refresh is cosmetic - never let it break a sync or a write.
  }
}
