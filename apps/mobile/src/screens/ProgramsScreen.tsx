import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, View } from "react-native";
import { AppText, Button, Card } from "../components/ui";
import { trackEvent } from "../lib/analytics";
import { listPrograms, type Program } from "../lib/api";
import { getDatabase } from "../lib/db";
import { API_URL } from "../lib/env";
import { FOLLOWED_PROGRAM_ID_KEY, FOLLOWED_PROGRAM_KEY, getKv, setKv } from "../lib/kv-store";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { makeStyles, space, useTheme } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Programs">;

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingBottom: space.xxxl },
  // Previously a tight caption (12px/16 lineHeight) directly under the next day's block with only
  // 8px of margin - on a long exercise list that wraps to 2 lines, this read as visually
  // overlapping the line below it (docs/UI_UX_AUDIT.md M8). More line-height and a bit more
  // vertical gap fixes it without touching the shared `caption` variant other screens rely on.
  dayLine: { marginTop: space.md, lineHeight: 20 },
}));

/**
 * Built-in program picker - PRD section 5.4 ("programs selectable in onboarding", "follow a
 * program -> today's session"). There's no server-side "account follows program X" table
 * (ARCHITECTURE.md section 2 has none) - following is local-only state: the full picked program
 * (its days/exercises) is cached in kv so WorkoutSessionScreen can determine "today's day" fully
 * offline, the same way cached_profile/cached_goal already let Home work offline.
 */
export function ProgramsScreen({ navigation, route }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { accountId } = route.params;
  const [programs, setPrograms] = useState<Program[]>([]);
  const [followedId, setFollowedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const db = await getDatabase();
      setFollowedId(await getKv(db, FOLLOWED_PROGRAM_ID_KEY));
      try {
        setPrograms(await listPrograms(API_URL));
      } catch {
        setError("Couldn't load programs. Check your connection and try again.");
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleFollow = async (program: Program) => {
    const db = await getDatabase();
    await setKv(db, FOLLOWED_PROGRAM_ID_KEY, program.id);
    await setKv(db, FOLLOWED_PROGRAM_KEY, JSON.stringify(program));
    trackEvent("program_followed");
    setFollowedId(program.id);
    navigation.navigate("Home", { accountId });
  };

  const handleSkip = () => {
    navigation.navigate("Home", { accountId });
  };

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={programs}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View style={{ marginBottom: space.sm }}>
          <AppText variant="h1">Pick a program to follow</AppText>
          {isLoading ? <ActivityIndicator style={{ marginTop: space.md }} color={colors.primary} /> : null}
          {error ? <AppText color={colors.error} center style={{ marginTop: space.md }}>{error}</AppText> : null}
          <Button title="Skip for now" variant="ghost" onPress={handleSkip} style={{ marginTop: space.md }} />
        </View>
      }
      renderItem={({ item }) => {
        const isFollowed = item.id === followedId;
        return (
          <Card style={{ marginTop: space.lg }}>
            <AppText variant="h3">{item.name}</AppText>
            {item.description ? (
              <AppText color={colors.textSecondary} style={{ marginTop: space.xxs }}>{item.description}</AppText>
            ) : null}
            {item.days.map((day) => (
              <AppText key={day.id} variant="caption" color={colors.textSecondary} style={styles.dayLine}>
                {day.name}: {day.exercises.map((e) => e.exerciseName).join(", ")}
              </AppText>
            ))}
            <Button
              title={isFollowed ? "Following" : "Follow this program"}
              onPress={() => void handleFollow(item)}
              disabled={isFollowed}
              style={{ marginTop: space.md }}
            />
          </Card>
        );
      }}
    />
  );
}
