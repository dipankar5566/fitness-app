import { Pressable, Text, View } from "react-native";
import { makeStyles, radius, sizes, space, textVariants } from "../theme";

interface ChipSelectProps<T extends string> {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  formatOption?: (value: T) => string;
}

const useStyles = makeStyles((colors) => ({
  container: { marginTop: space.sm },
  label: { ...textVariants.label, color: colors.textSecondary, marginBottom: space.sm },
  row: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    minHeight: sizes.touchTarget,
    justifyContent: "center",
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...textVariants.bodyMedium, color: colors.text },
  chipTextSelected: { color: colors.textOnPrimary },
}));

export function ChipSelect<T extends string>({
  label,
  options,
  value,
  onChange,
  formatOption,
}: ChipSelectProps<T>) {
  const styles = useStyles();
  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row} accessibilityRole="radiogroup">
        {options.map((option) => {
          const selected = option === value;
          const text = formatOption ? formatOption(option) : option;
          return (
            <Pressable
              key={option}
              onPress={() => onChange(option)}
              accessibilityRole="radio"
              accessibilityState={{ selected, checked: selected }}
              accessibilityLabel={text}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{text}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
