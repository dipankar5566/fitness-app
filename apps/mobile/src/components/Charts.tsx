import Svg, { Circle, Line, Polyline } from "react-native-svg";
import { View } from "react-native";
import { makeStyles, radius, space, useTheme } from "../theme";
import { AppText } from "./ui";

/**
 * ProgressRing + MacroBar + LineSpark - the hero calorie ring, macro bars, and weight-trend
 * sparkline. Ring/bar percentage math lives in packages/shared/src/meal-summary.ts
 * (calorieRingProgress) so it's pure and unit-tested; these are purely the rendering.
 */

interface ProgressRingProps {
  progress: number; // 0..1, already clamped by the caller (calorieRingProgress)
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  children?: React.ReactNode;
  /** Read by screen readers in place of trying to describe an SVG arc directly. */
  accessibilityLabel?: string;
}

const useRingStyles = makeStyles(() => ({
  ringContainer: { alignItems: "center", justifyContent: "center" },
  ringCenter: { position: "absolute", alignItems: "center", justifyContent: "center" },
}));

export function ProgressRing({
  progress,
  size = 140,
  strokeWidth = 12,
  color,
  trackColor,
  children,
  accessibilityLabel,
}: ProgressRingProps) {
  const styles = useRingStyles();
  const { colors } = useTheme();
  const ringColor = color ?? colors.primary;
  const ringTrack = trackColor ?? colors.primaryTonal;
  const radiusPx = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radiusPx;
  const dashOffset = circumference * (1 - progress);
  const center = size / 2;

  return (
    <View
      style={[styles.ringContainer, { width: size, height: size }]}
      accessible={Boolean(accessibilityLabel)}
      accessibilityRole={accessibilityLabel ? "progressbar" : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={accessibilityLabel ? { min: 0, max: 100, now: Math.round(progress * 100) } : undefined}
    >
      <Svg width={size} height={size}>
        <Circle cx={center} cy={center} r={radiusPx} stroke={ringTrack} strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={center}
          cy={center}
          r={radiusPx}
          stroke={ringColor}
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

const useMacroBarStyles = makeStyles((colors) => ({
  macroBar: { gap: space.xxs },
  macroBarHeader: { flexDirection: "row", justifyContent: "space-between" },
  macroBarTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: "hidden",
  },
  macroBarFill: { height: "100%", borderRadius: radius.pill },
}));

export function MacroBar({ label, grams, targetGrams, color }: MacroBarProps) {
  const styles = useMacroBarStyles();
  const { colors } = useTheme();
  const fraction = targetGrams > 0 ? Math.max(0, Math.min(1, grams / targetGrams)) : 0;
  return (
    <View
      style={styles.macroBar}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${label}: ${Math.round(grams)} of ${Math.round(targetGrams)} grams`}
      accessibilityValue={{ min: 0, max: Math.round(targetGrams), now: Math.round(grams) }}
    >
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

interface LineSparkProps {
  values: number[]; // chronological (oldest -> newest)
  width?: number;
  height?: number;
  color?: string;
  /** Shown as small min/max labels below the line and folded into the accessibility description -
   * previously this chart had no axis context at all (docs/UI_UX_AUDIT.md H5/L2). */
  unit?: string;
}

const useLineSparkStyles = makeStyles(() => ({
  wrap: { alignItems: "center" },
  labelsRow: { flexDirection: "row", justifyContent: "space-between", width: "100%", marginTop: space.xxs },
}));

/** A labelled line sparkline (e.g. a weight trend). Renders nothing for fewer than two points - a
 * single reading has no trend to draw. Scales to the series' own min/max with a little vertical
 * padding so the end caps aren't clipped. */
export function LineSpark({ values, width = 240, height = 48, color, unit = "" }: LineSparkProps) {
  const styles = useLineSparkStyles();
  const { colors } = useTheme();
  const lineColor = color ?? colors.primary;
  if (values.length < 2) {
    return null;
  }
  const pad = 4;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const points = values
    .map((value, i) => {
      const x = i * stepX;
      const y = pad + (height - 2 * pad) * (1 - (value - min) / range);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const last = values[values.length - 1];
  const lastX = (values.length - 1) * stepX;
  const lastY = pad + (height - 2 * pad) * (1 - (last - min) / range);
  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Trend over ${values.length} readings: from ${values[0]} to ${last}${unit}, ranging ${min} to ${max}${unit}`}
    >
      <Svg width={width} height={height}>
        <Line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke={colors.separator} strokeWidth={1} />
        <Polyline points={points} fill="none" stroke={lineColor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <Circle cx={lastX} cy={lastY} r={4} fill={lineColor} />
      </Svg>
      <View style={styles.labelsRow}>
        <AppText variant="micro" color={colors.textTertiary}>
          {min}{unit}
        </AppText>
        <AppText variant="micro" color={colors.textTertiary}>
          {max}{unit}
        </AppText>
      </View>
    </View>
  );
}
