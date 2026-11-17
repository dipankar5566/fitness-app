import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
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
import { colors, radius, space, tabularNumbers, textVariants, type TextVariantName } from "../theme";

/**
 * Small reusable UI primitives shared by every screen - one file (not one-per-component) so the
 * HealthifyMe-inspired look (warm neutrals, one brand colour, 48dp buttons, hairline-stroke cards)
 * lives in exactly one place. See healthifyme-re/UI_UX.md for what this was inspired by.
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
   * (headerShown: false) - the 4 bottom-tab screens and GuestLoadingScreen need this. */
  edges?: readonly Edge[];
}

export function Screen({ children, scroll = false, padded = true, style, edges = ["bottom"] }: ScreenProps) {
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
  color?: string;
  center?: boolean;
  numbers?: boolean;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

export function AppText({
  children,
  variant = "body",
  color = colors.text,
  center = false,
  numbers = false,
  style,
  numberOfLines,
}: AppTextProps) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        textVariants[variant],
        { color },
        center && styles.textCenter,
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

export function Card({ children, style }: CardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

// ---------------------------------------------------------------------------
// Button - primary/secondary/ghost, 48dp, loading state. Replaces RN's plain <Button>.
// ---------------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends Omit<PressableProps, "style" | "children"> {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({ title, variant = "primary", loading = false, disabled, style, ...rest }: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      {...rest}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.buttonBase,
        buttonVariantStyles[variant],
        isDisabled && styles.buttonDisabled,
        pressed && !isDisabled && styles.buttonPressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" || variant === "danger" ? colors.textOnPrimary : colors.primary} />
      ) : (
        <Text style={[styles.buttonText, buttonTextVariantStyles[variant]]}>{title}</Text>
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

export function TextField({ label, error, style, ...rest }: TextFieldProps) {
  return (
    <View style={styles.fieldContainer}>
      {label ? <AppText variant="captionMedium" color={colors.textSecondary} style={styles.fieldLabel}>{label}</AppText> : null}
      <TextInput
        style={[styles.input, Boolean(error) && styles.inputError, style]}
        placeholderTextColor={colors.textTertiary}
        {...rest}
      />
      {error ? <AppText variant="caption" color={colors.error} style={styles.fieldError}>{error}</AppText> : null}
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

export function ListRow({ title, subtitle, trailing, onPress, icon, style }: ListRowProps) {
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper
      onPress={onPress}
      style={({ pressed }: { pressed?: boolean }) => [
        styles.listRow,
        onPress && pressed && styles.listRowPressed,
        style,
      ] as StyleProp<ViewStyle>}
    >
      {icon ? (
        <View style={styles.listRowIcon}>
          <MaterialCommunityIcons name={icon} size={20} color={colors.primary} />
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
      {onPress ? <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} /> : null}
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

export function SectionHeader({ title, action, style }: SectionHeaderProps) {
  return (
    <View style={[styles.sectionHeader, style]}>
      <AppText variant="h3">{title}</AppText>
      {action ? (
        <Pressable onPress={action.onPress} hitSlop={8}>
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

export function EmptyState({ icon = "food-apple-outline", title, subtitle, style }: EmptyStateProps) {
  return (
    <View style={[styles.emptyState, style]}>
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
// ---------------------------------------------------------------------------

interface IconButtonProps {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress: () => void;
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({ icon, onPress, color = colors.textSecondary, size = 22, style }: IconButtonProps) {
  return (
    <Pressable onPress={onPress} hitSlop={10} style={[styles.iconButton, style]}>
      <MaterialCommunityIcons name={icon} size={size} color={color} />
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

export function Badge({ label, tone = "neutral" }: BadgeProps) {
  return (
    <View style={[styles.badge, badgeToneStyles[tone]]}>
      <AppText variant="micro" color={badgeTextToneStyles[tone]}>{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  screenSafeArea: { flex: 1 },
  screenBg: { backgroundColor: colors.bg },
  screenFlex: { flex: 1, backgroundColor: colors.bg },
  screenPadded: { padding: space.lg },
  textCenter: { textAlign: "center" },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.stroke,
    padding: space.lg,
  },
  buttonBase: {
    height: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.lg,
  },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { ...textVariants.bodyMedium },
  fieldContainer: { gap: space.xs },
  fieldLabel: {},
  fieldError: {},
  input: {
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    backgroundColor: colors.surface,
    color: colors.text,
    ...textVariants.body,
  },
  inputError: { borderColor: colors.error },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.md,
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
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: space.sm,
  },
  emptyState: { alignItems: "center", gap: space.xs, paddingVertical: space.xxl },
  emptyTitle: { marginTop: space.xs },
  iconButton: { padding: space.xs },
  badge: {
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
  },
});

const buttonVariantStyles = StyleSheet.create({
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.primaryTonal },
  ghost: { backgroundColor: "transparent" },
  danger: { backgroundColor: colors.error },
});

const buttonTextVariantStyles = StyleSheet.create({
  primary: { color: colors.textOnPrimary },
  secondary: { color: colors.primaryDark },
  ghost: { color: colors.primary },
  danger: { color: colors.textOnPrimary },
});

const badgeToneStyles = StyleSheet.create({
  neutral: { backgroundColor: colors.surfaceAlt },
  warning: { backgroundColor: colors.warningTonal },
  success: { backgroundColor: colors.successTonal },
});

const badgeTextToneStyles = {
  neutral: colors.textSecondary,
  warning: colors.warning,
  success: colors.success,
};
