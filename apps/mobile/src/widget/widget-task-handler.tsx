import * as Crypto from "expo-crypto";
import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import { loadGuestSession } from "../lib/auth-storage";
import { getDatabase } from "../lib/db";
import { GLASS_ML, insert as insertWater } from "../lib/water-repo";
import { ADD_WATER_ACTION, TodayWidget } from "./TodayWidget";
import { loadWidgetSnapshot } from "./widget-data";

async function renderToday(props: WidgetTaskHandlerProps): Promise<void> {
  const session = await loadGuestSession();
  if (!session) {
    props.renderWidget(<TodayWidget snapshot={null} />);
    return;
  }
  const db = await getDatabase();
  props.renderWidget(<TodayWidget snapshot={await loadWidgetSnapshot(db, session.accountId)} />);
}

/**
 * Headless task for the home-screen widget (registered in index.ts). Runs without the app UI, so it
 * only touches the local SQLite mirror: "+ Glass" writes a water_log row through the same outbox
 * water-repo.ts uses (dirty, so it syncs the next time the app runs syncNow) and re-renders.
 * Deep-link buttons use the library's built-in OPEN_URI action and never reach this handler.
 */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  switch (props.widgetAction) {
    case "WIDGET_ADDED":
    case "WIDGET_UPDATE":
    case "WIDGET_RESIZED":
      await renderToday(props);
      break;
    case "WIDGET_CLICK": {
      if (props.clickAction === ADD_WATER_ACTION) {
        const session = await loadGuestSession();
        if (session) {
          const now = new Date().toISOString();
          await insertWater(await getDatabase(), {
            id: Crypto.randomUUID(),
            accountId: session.accountId,
            amountMl: GLASS_ML,
            recordedAt: now,
            isDeleted: false,
            updatedAt: now,
          });
        }
      }
      await renderToday(props);
      break;
    }
    case "WIDGET_DELETED":
    default:
      break;
  }
}
