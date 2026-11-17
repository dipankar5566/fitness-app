import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image, View } from "react-native";
import { AppText, Badge, Screen } from "../components/ui";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors, radius, space } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "ExerciseDetail">;

export function ExerciseDetailScreen({ route }: Props) {
  const { exercise } = route.params;

  return (
    <Screen scroll>
      <AppText variant="h1">{exercise.name}</AppText>
      <AppText color={colors.textSecondary} style={{ marginTop: space.xs, textTransform: "capitalize" }}>
        {exercise.equipment ?? "No equipment"}
      </AppText>

      <AppText variant="captionMedium" color={colors.textSecondary} style={{ marginTop: space.lg }}>Primary muscles</AppText>
      <Chips values={exercise.primaryMuscles} />
      {exercise.secondaryMuscles.length > 0 ? (
        <>
          <AppText variant="captionMedium" color={colors.textSecondary} style={{ marginTop: space.md }}>Secondary muscles</AppText>
          <Chips values={exercise.secondaryMuscles} />
        </>
      ) : null}

      {exercise.imageUrls[0] ? (
        <Image
          source={{ uri: exercise.imageUrls[0] }}
          style={{ width: "100%", height: 220, marginTop: space.lg, borderRadius: radius.md, backgroundColor: colors.surfaceAlt }}
          resizeMode="contain"
        />
      ) : null}

      <AppText variant="h2" style={{ marginTop: space.xl, marginBottom: space.sm }}>Instructions</AppText>
      {exercise.instructions.map((step, index) => (
        <AppText key={index} style={{ marginTop: space.sm, lineHeight: 21 }}>
          {index + 1}. {step}
        </AppText>
      ))}
    </Screen>
  );
}

function Chips({ values }: { values: string[] }) {
  if (values.length === 0) {
    return <AppText color={colors.textTertiary}>—</AppText>;
  }
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: space.xs }}>
      {values.map((value) => (
        <Badge key={value} label={value} />
      ))}
    </View>
  );
}
