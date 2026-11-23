import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { makeStyles, radius, sizes, space, tabularNumbers, textVariants, useTheme, type TextVariantName } from "../theme";

/**
 * Small reusable UI primitives shared by every screen - one file (not one-per-component) so the
 * HealthifyMe-inspired look (warm neutrals, one brand colour, 48dp buttons, hairline-stroke cards)
 * lives in exactly one place. See healthifyme-re/UI_UX.md for what this was inspired by, and
 * docs/DESIGN_SYSTEM.md for the token reasoning. Every style here comes from `useTheme()`/
 * `makeStyles()` (theme/ThemeProvider.tsx), not a static `colors` import, so every primitive
 * re-renders correctly when the theme changes.
 */

// ---------------------------------------------------------------------------
// Screen - safe-area + background, with or without scrolling.
// ---------------------------------------------------------------------------

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Default omits "top": a native-stack header already consumes the top inset, so adding it
   * again would push content down twice. Pass edges={["top", "bottom"]} for a headerless screen
   * (headerShown: false) - the bottom-tab screens and GuestLoadingScreen need this. */
  edges?: readonly Edge[];
}

const useScreenStyles = makeStyles((colors) => ({
  screenSafeArea: { flex: 1 },
  screenBg: { backgroundColor: colors.bg },
  screenFlex: { flex: 1, backgroundColor: colors.bg },
  screenPadded: { padding: space.lg },
}));

export function Screen({ children, scroll = false, padded = true, style, edges = ["bottom"] }: ScreenProps) {
  const styles = useScreenStyles();
  const content = padded ? styles.screenPadded : undefined;
  if (scroll) {
    return (
      <SafeAreaView style={styles.screenSafeArea} edges={edges}>
        <ScrollView
          style={styles.screenBg}
          contentContainerStyle={[content, style]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={[styles.screenSafeArea, styles.screenBg]} edges={edges}>
      <View style={[styles.screenFlex, content, style]}>{children}</View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// AppText - one component for every text variant instead of ad-hoc StyleSheet text styles.
// ---------------------------------------------------------------------------

interface AppTextProps {
  children: ReactNode;
  variant?: TextVariantName;
  /** Omit to use the theme's default text colour - pass an explicit colour (from `useTheme()`)
   * only when a specific tone (secondary/error/on-primary/...) is actually needed. */
  color?: string;
  center?: boolean;
  numbers?: boolean;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

const textCenterStyle: TextStyle = { textAlign: "center" };

export function AppText({
  children,
  variant = "body",
  color,
  center = false,
  numbers = false,
  style,
  numberOfLines,
}: AppTextProps) {
  const { colors } = useTheme();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        textVariants[variant],
        { color: color ?? colors.text },
        center && textCenterStyle,
        numbers && tabularNumbers,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Card - the base surface for every grouped block of content.
// ---------------------------------------------------------------------------

interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

const useCardStyles = makeStyles((colors) => ({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.stroke,
    padding: space.lg,
  },
}));

export function Card({ children, style }: CardProps) {
  const styles = useCardStyles();
  return <View style={[styles.card, style]}>{children}</View>;
}

// ---------------------------------------------------------------------------
// Button - primary/secondary/ghost/danger, 52dp, loading state. Replaces RN's plain <Button>.
// ---------------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends Omit<PressableProps, "style" | "children"> {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

const useButtonStyles = makeStyles((colors) => ({
  buttonBase: {
    height: sizes.buttonHeight,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.lg,
  },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { ...textVariants.bodyMedium },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.primaryTonal },
  ghost: { backgroundColor: "transparent" },
  danger: { backgroundColor: colors.error },
  textPrimary: { color: colors.textOnPrimary },
  textSecondary: { color: colors.primaryDark },
  textGhost: { color: colors.primary },
  textDanger: { color: colors.textOnPrimary },
}));

export function Button({ title, variant = "primary", loading = false, disabled, style, accessibilityRole, ...rest }: ButtonProps) {
  const styles = useButtonStyles();
  const { colors } = useTheme();
  const isDisabled = disabled || loading;
  const textStyleKey = (`text${variant[0].toUpperCase()}${variant.slice(1)}`) as
    | "textPrimary"
    | "textSecondary"
    | "textGhost"
    | "textDanger";
  return (
    <Pressable
      {...rest}
      accessibilityRole={accessibilityRole ?? "button"}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.buttonBase,
        styles[variant],
        isDisabled && styles.buttonDisabled,
        pressed && !isDisabled && styles.buttonPressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" || variant === "danger" ? colors.textOnPrimary : colors.primary} />
      ) : (
        <Text style={[styles.buttonText, styles[textStyleKey]]}>{title}</Text>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// TextField - labeled text input in the app's visual language.
// ---------------------------------------------------------------------------

interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string | null;
}

const useTextFieldStyles = makeStyles((colors) => ({
  fieldContainer: { gap: space.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    backgroundColor: colors.surface,
    color: colors.text,
    minHeight: sizes.touchTarget,
    ...textVariants.body,
  },
  inputError: { borderColor: colors.error },
}));

export function TextField({ label, error, style, ...rest }: TextFieldProps) {
  const styles = useTextFieldStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.fieldContainer}>
      {label ? <AppText variant="label" color={colors.textSecondary}>{label}</AppText> : null}
      <TextInput
        style={[styles.input, Boolean(error) && styles.inputError, style]}
        placeholderTextColor={colors.textTertiary}
        accessibilityLabel={label}
        {...rest}
      />
      {error ? <AppText variant="caption" color={colors.error}>{error}</AppText> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// ListRow - title/subtitle/trailing, optionally pressable.
// ---------------------------------------------------------------------------

interface ListRowProps {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  style?: StyleProp<ViewStyle>;
}

const useListRowStyles = makeStyles((colors) => ({
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.md,
    minHeight: sizes.touchTarget,
  },
  listRowPressed: { opacity: 0.6 },
  listRowIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTonal,
    alignItems: "center",
    justifyContent: "center",
  },
  listRowBody: { flex: 1, gap: 2 },
}));

export function ListRow({ title, subtitle, trailing, onPress, icon, style }: ListRowProps) {
  const styles = useListRowStyles();
  const { colors } = useTheme();
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper
      onPress={onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={onPress ? [title, subtitle].filter(Boolean).join(", ") : undefined}
      style={({ pressed }: { pressed?: boolean }) => [
        styles.listRow,
        onPress && pressed && styles.listRowPressed,
        style,
      ] as StyleProp<ViewStyle>}
    >
      {icon ? (
        <View style={styles.listRowIcon}>
          <MaterialCommunityIcons name={icon} size={sizes.iconMd} color={colors.primary} />
        </View>
      ) : null}
      <View style={styles.listRowBody}>
        <AppText variant="bodyMedium" numberOfLines={1}>{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" color={colors.textSecondary} numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {trailing}
      {onPress ? <MaterialCommunityIcons name="chevron-right" size={sizes.iconMd} color={colors.textTertiary} /> : null}
    </Wrapper>
  );
}

// ---------------------------------------------------------------------------
// SectionHeader - a label above a group of cards/rows, with an optional trailing action.
// ---------------------------------------------------------------------------

interface SectionHeaderProps {
  title: string;
  action?: { label: string; onPress: () => void };
  style?: StyleProp<ViewStyle>;
}

const useSectionHeaderStyles = makeStyles(() => ({
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: space.sm,
    minHeight: sizes.iconMd,
  },
  actionHit: { minHeight: sizes.touchTarget, justifyContent: "center" },
}));

export function SectionHeader({ title, action, style }: SectionHeaderProps) {
  const styles = useSectionHeaderStyles();
  const { colors } = useTheme();
  return (
    <View style={[styles.sectionHeader, style]}>
      <AppText variant="h3">{title}</AppText>
      {action ? (
        <Pressable
          onPress={action.onPress}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          style={styles.actionHit}
        >
          <AppText variant="captionMedium" color={colors.primary}>{action.label}</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// EmptyState - centered icon + message for an empty list/screen.
// ---------------------------------------------------------------------------

interface EmptyStateProps {
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
}

const useEmptyStateStyles = makeStyles(() => ({
  emptyState: { alignItems: "center", gap: space.xs, paddingVertical: space.xxl },
  emptyTitle: { marginTop: space.xs },
}));

export function EmptyState({ icon = "food-apple-outline", title, subtitle, style }: EmptyStateProps) {
  const styles = useEmptyStateStyles();
  const { colors } = useTheme();
  return (
    <View
      style={[styles.emptyState, style]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={[title, subtitle].filter(Boolean).join(". ")}
    >
      <MaterialCommunityIcons name={icon} size={32} color={colors.textTertiary} />
      <AppText variant="bodyMedium" color={colors.textSecondary} center style={styles.emptyTitle}>
        {title}
      </AppText>
      {subtitle ? (
        <AppText variant="caption" color={colors.textTertiary} center>
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// IconButton - a tappable icon-only control (back/delete/close affordances).
// docs/UI_UX_AUDIT.md C2: this previously had no label/role and a ~30dp hit area. Both fixed here
// in one place rather than at each of its ~15 call sites - `label` is now required, not optional,
// so a missing accessibility label is a type error, not something easy to forget silently.
// ---------------------------------------------------------------------------

interface IconButtonProps {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress: () => void;
  /** Read by screen readers. A short verb phrase, e.g. "Add a glass of water" - not just the
   * icon's name. */
  label: string;
  color?: string;
  size?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

const useIconButtonStyles = makeStyles(() => ({
  iconButton: {
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  iconButtonPressed: { opacity: 0.6 },
  iconButtonDisabled: { opacity: 0.4 },
}));

export function IconButton({ icon, onPress, label, color, size = sizes.iconMd, disabled, style }: IconButtonProps) {
  const styles = useIconButtonStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => [
        styles.iconButton,
        pressed && !disabled && styles.iconButtonPressed,
        disabled && styles.iconButtonDisabled,
        style,
      ]}
    >
      <MaterialCommunityIcons name={icon} size={size} color={color ?? colors.textSecondary} />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Badge - small pill label (e.g. "estimate", "diet unverified").
// ---------------------------------------------------------------------------

interface BadgeProps {
  label: string;
  tone?: "neutral" | "warning" | "success";
}

const useBadgeStyles = makeStyles((colors) => ({
  badge: {
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
  },
  neutral: { backgroundColor: colors.surfaceAlt },
  warning: { backgroundColor: colors.warningTonal },
  success: { backgroundColor: colors.successTonal },
}));

export function Badge({ label, tone = "neutral" }: BadgeProps) {
  const styles = useBadgeStyles();
  const { colors } = useTheme();
  const textColor = tone === "neutral" ? colors.textSecondary : tone === "warning" ? colors.warning : colors.success;
  return (
    <View style={[styles.badge, styles[tone]]}>
      <AppText variant="captionMedium" color={textColor}>{label}</AppText>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Stepper - large +/- numeric control, replacing a bare TextField for quantities/reps/weight
// (docs/UI_UX_AUDIT.md H3/M5).
// ---------------------------------------------------------------------------

interface StepperProps {
  label?: string;
  value: number;
  onChange: (next: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  /** Decimal places to keep when stepping (e.g. 0.5 steps need 1) - avoids float noise like
   * 62.70000000000001. */
  precision?: number;
}

const useStepperStyles = makeStyles((colors) => ({
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  valueBox: {
    flex: 1,
    height: sizes.touchTarget,
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: space.xxs,
  },
  button: {
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTonal,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPressed: { opacity: 0.7 },
  buttonDisabled: { opacity: 0.4 },
  label: { marginBottom: space.xs },
}));

function round(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function Stepper({ label, value, onChange, step = 1, min = 0, max, suffix, precision = 0 }: StepperProps) {
  const styles = useStepperStyles();
  const { colors } = useTheme();
  const atMin = value <= min;
  const atMax = max !== undefined && value >= max;
  const clamp = (next: number) => round(Math.max(min, max !== undefined ? Math.min(max, next) : next), precision);
  return (
    <View>
      {label ? <AppText variant="label" color={colors.textSecondary} style={styles.label}>{label}</AppText> : null}
      <View style={styles.row}>
        <Pressable
          onPress={() => onChange(clamp(value - step))}
          disabled={atMin}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label ?? "value"}`}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, atMin && styles.buttonDisabled]}
        >
          <MaterialCommunityIcons name="minus" size={sizes.iconMd} color={colors.primaryDark} />
        </Pressable>
        <View style={styles.valueBox} accessible accessibilityLabel={`${label ?? "Value"}: ${value}${suffix ?? ""}`}>
          <AppText variant="h2" numbers>{value}</AppText>
          {suffix ? <AppText variant="caption" color={colors.textSecondary}>{suffix}</AppText> : null}
        </View>
        <Pressable
          onPress={() => onChange(clamp(value + step))}
          disabled={atMax}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label ?? "value"}`}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, atMax && styles.buttonDisabled]}
        >
          <MaterialCommunityIcons name="plus" size={sizes.iconMd} color={colors.primaryDark} />
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// CheckboxRow - a real checkbox with a role/state, replacing a "☐ label" text glyph
// (docs/UI_UX_AUDIT.md C2 - WorkoutSessionScreen's warm-up toggle).
// ---------------------------------------------------------------------------

interface CheckboxRowProps {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  style?: StyleProp<ViewStyle>;
}

const useCheckboxStyles = makeStyles((colors) => ({
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: sizes.touchTarget },
  box: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.stroke,
    alignItems: "center",
    justifyContent: "center",
  },
  boxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
}));

export function CheckboxRow({ label, checked, onChange, style }: CheckboxRowProps) {
  const styles = useCheckboxStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      style={[styles.row, style]}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? <MaterialCommunityIcons name="check" size={16} color={colors.textOnPrimary} /> : null}
      </View>
      <AppText variant="bodyMedium">{label}</AppText>
    </Pressable>
  );
}
