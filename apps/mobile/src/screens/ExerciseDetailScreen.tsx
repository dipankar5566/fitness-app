import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image, View } from "react-native";
import { AppText, Badge, Screen } from "../components/ui";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { makeStyles, radius, space, useTheme } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "ExerciseDetail">;

const useStyles = makeStyles((colors) => ({
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: space.xs },
  image: { width: "100%", height: 220, marginTop: space.lg, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
}));

export function ExerciseDetailScreen({ route }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
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
        <Image source={{ uri: exercise.imageUrls[0] }} style={styles.image} resizeMode="contain" />
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
  const styles = useStyles();
  const { colors } = useTheme();
  if (values.length === 0) {
    return <AppText color={colors.textTertiary}>—</AppText>;
  }
  return (
    <View style={styles.chipsRow}>
      {values.map((value) => (
        <Badge key={value} label={value} />
      ))}
    </View>
  );
}
