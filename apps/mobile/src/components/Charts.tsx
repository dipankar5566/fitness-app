import Svg, { Circle } from "react-native-svg";
import { StyleSheet, View } from "react-native";
import { colors, radius, space } from "../theme";
import { AppText } from "./ui";

/**
 * ProgressRing + MacroBar - the hero calorie ring and protein/carb/fat bars on the Today screen.
 * Kept together (not split further) since both are small, data-less rendering helpers around the
 * same "show a fraction of a target visually" idea; ring % math itself lives in
 * packages/shared/src/meal-summary.ts (calorieRingProgress) so it's pure and unit-tested.
 */

interface ProgressRingProps {
  progress: number; // 0..1, already clamped by the caller (calorieRingProgress)
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  children?: React.ReactNode;
}

export function ProgressRing({
  progress,
  size = 140,
  strokeWidth = 12,
  color = colors.primary,
  trackColor = colors.primaryTonal,
  children,
}: ProgressRingProps) {
  const radiusPx = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radiusPx;
  const dashOffset = circumference * (1 - progress);
  const center = size / 2;

  return (
    <View style={[styles.ringContainer, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={radiusPx}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={center}
          cy={center}
          r={radiusPx}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          // The ring grows clockwise from the top, not from the default 3-o'clock start.
          rotation={-90}
          originX={center}
          originY={center}
        />
      </Svg>
      <View style={styles.ringCenter}>{children}</View>
    </View>
  );
}

interface MacroBarProps {
  label: string;
  grams: number;
  targetGrams: number;
  color: string;
}

export function MacroBar({ label, grams, targetGrams, color }: MacroBarProps) {
  const fraction = targetGrams > 0 ? Math.max(0, Math.min(1, grams / targetGrams)) : 0;
  return (
    <View style={styles.macroBar}>
      <View style={styles.macroBarHeader}>
        <AppText variant="captionMedium">{label}</AppText>
        <AppText variant="caption" color={colors.textSecondary} numbers>
          {Math.round(grams)} / {Math.round(targetGrams)}g
        </AppText>
      </View>
      <View style={styles.macroBarTrack}>
        <View style={[styles.macroBarFill, { width: `${fraction * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ringContainer: { alignItems: "center", justifyContent: "center" },
  ringCenter: { position: "absolute", alignItems: "center", justifyContent: "center" },
  macroBar: { gap: space.xxs },
  macroBarHeader: { flexDirection: "row", justifyContent: "space-between" },
  macroBarTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: "hidden",
  },
  macroBarFill: { height: "100%", borderRadius: radius.pill },
});
