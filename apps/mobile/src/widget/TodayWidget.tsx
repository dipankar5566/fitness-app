import { FlexWidget, TextWidget } from "react-native-android-widget";
import { DEEP_LINKS } from "../lib/deep-links";
import { colors } from "../theme/tokens";
import type { WidgetSnapshot } from "./widget-data";

export const TODAY_WIDGET_NAME = "TodaySummary";
/** Custom click action handled in widget-task-handler.tsx - logs one glass without opening the app. */
export const ADD_WATER_ACTION = "ADD_WATER";

type Hex = `#${string}`;
const hex = (value: string) => value as Hex;

/**
 * Home-screen widget (react-native-android-widget renders this JSX to native RemoteViews - only its
 * own Flex/Text primitives work here, not regular RN components). Shows kcal left + water, with a
 * "Log food" deep link into FoodSearch and a one-tap "+ Glass". Colours reuse the app's own tokens.
 */
export function TodayWidget({ snapshot }: { snapshot: WidgetSnapshot | null }) {
  const kcalLine =
    snapshot?.kcalLeft == null
      ? "Set up your targets"
      : snapshot.kcalLeft >= 0
        ? `${snapshot.kcalLeft} kcal left`
        : `${-snapshot.kcalLeft} kcal over`;
  const waterLine = snapshot
    ? `${(snapshot.waterMl / 1000).toFixed(2)} / ${(snapshot.waterGoalMl / 1000).toFixed(1)} L water`
    : "Open the app to get started";
  const isOver = snapshot?.kcalLeft != null && snapshot.kcalLeft < 0;

  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: DEEP_LINKS.today }}
      style={{
        height: "match_parent",
        width: "match_parent",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 14,
        borderRadius: 20,
        backgroundColor: hex(colors.surface),
      }}
    >
      <FlexWidget style={{ flexDirection: "column" }}>
        <TextWidget text="Today" style={{ fontSize: 12, color: hex(colors.textSecondary) }} />
        <TextWidget
          text={kcalLine}
          maxLines={1}
          style={{ fontSize: 22, fontWeight: "700", color: hex(isOver ? colors.error : colors.text) }}
        />
        {snapshot?.targetKcal != null ? (
          <TextWidget
            text={`${snapshot.eatenKcal} of ${snapshot.targetKcal} kcal eaten`}
            style={{ fontSize: 12, color: hex(colors.textSecondary) }}
          />
        ) : null}
        <TextWidget text={waterLine} style={{ fontSize: 12, color: hex(colors.textSecondary), marginTop: 4 }} />
      </FlexWidget>

      <FlexWidget style={{ flexDirection: "row", flexGap: 8, width: "match_parent" }}>
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: DEEP_LINKS.food_search }}
          style={{ flex: 1, paddingVertical: 8, borderRadius: 12, alignItems: "center", backgroundColor: hex(colors.primary) }}
        >
          <TextWidget text="Log food" style={{ fontSize: 13, fontWeight: "600", color: hex(colors.textOnPrimary) }} />
        </FlexWidget>
        <FlexWidget
          clickAction={ADD_WATER_ACTION}
          style={{ flex: 1, paddingVertical: 8, borderRadius: 12, alignItems: "center", backgroundColor: hex(colors.primaryTonal) }}
        >
          <TextWidget text="+ Glass" style={{ fontSize: 13, fontWeight: "600", color: hex(colors.primary) }} />
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}
