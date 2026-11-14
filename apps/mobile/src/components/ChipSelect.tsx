import { Pressable, StyleSheet, Text, View } from "react-native";

interface ChipSelectProps<T extends string> {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  formatOption?: (value: T) => string;
}

export function ChipSelect<T extends string>({
  label,
  options,
  value,
  onChange,
  formatOption,
}: ChipSelectProps<T>) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {options.map((option) => {
          const selected = option === value;
          return (
            <Pressable
              key={option}
              onPress={() => onChange(option)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {formatOption ? formatOption(option) : option}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 8 },
  label: { fontWeight: "600", marginBottom: 6 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipSelected: { backgroundColor: "#111", borderColor: "#111" },
  chipText: { color: "#111" },
  chipTextSelected: { color: "#fff" },
});
