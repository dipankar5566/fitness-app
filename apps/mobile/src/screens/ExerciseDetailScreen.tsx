import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "ExerciseDetail">;

export function ExerciseDetailScreen({ route }: Props) {
  const { exercise } = route.params;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.name}>{exercise.name}</Text>
      <Text style={styles.meta}>{exercise.equipment ?? "No equipment"}</Text>
      <Text style={styles.meta}>Primary: {exercise.primaryMuscles.join(", ") || "—"}</Text>
      {exercise.secondaryMuscles.length > 0 ? (
        <Text style={styles.meta}>Secondary: {exercise.secondaryMuscles.join(", ")}</Text>
      ) : null}

      {exercise.imageUrls[0] ? (
        <Image source={{ uri: exercise.imageUrls[0] }} style={styles.image} resizeMode="contain" />
      ) : null}

      <View style={styles.instructions}>
        {exercise.instructions.map((step, index) => (
          <Text key={index} style={styles.step}>
            {index + 1}. {step}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  name: { fontSize: 20, fontWeight: "600" },
  meta: { color: "#666", marginTop: 4, textTransform: "capitalize" },
  image: { width: "100%", height: 220, marginTop: 16, backgroundColor: "#f2f2f2" },
  instructions: { marginTop: 16, gap: 8 },
  step: { fontSize: 15, lineHeight: 21 },
});
