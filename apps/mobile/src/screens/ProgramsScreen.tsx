import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { ActivityIndicator, Button, FlatList, StyleSheet, Text, View } from "react-native";
import { trackEvent } from "../lib/analytics";
import { listPrograms, type Program } from "../lib/api";
import { getDatabase } from "../lib/db";
import { API_URL } from "../lib/env";
import { FOLLOWED_PROGRAM_ID_KEY, FOLLOWED_PROGRAM_KEY, getKv, setKv } from "../lib/kv-store";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Programs">;

/**
 * Built-in program picker - PRD section 5.4 ("programs selectable in onboarding", "follow a
 * program -> today's session"). There's no server-side "account follows program X" table
 * (ARCHITECTURE.md section 2 has none) - following is local-only state: the full picked program
 * (its days/exercises) is cached in kv so WorkoutSessionScreen can determine "today's day" fully
 * offline, the same way cached_profile/cached_goal already let Home work offline.
 */
export function ProgramsScreen({ navigation, route }: Props) {
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
        <View style={styles.header}>
          <Text style={styles.title}>Pick a program to follow</Text>
          {isLoading ? <ActivityIndicator style={styles.spinner} /> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.button}>
            <Button title="Skip for now" onPress={handleSkip} color="#888" />
          </View>
        </View>
      }
      renderItem={({ item }) => {
        const isFollowed = item.id === followedId;
        return (
          <View style={styles.card}>
            <Text style={styles.programName}>{item.name}</Text>
            {item.description ? <Text style={styles.programDescription}>{item.description}</Text> : null}
            {item.days.map((day) => (
              <Text key={day.id} style={styles.dayLine}>
                {day.name}: {day.exercises.map((e) => e.exerciseName).join(", ")}
              </Text>
            ))}
            <View style={styles.button}>
              <Button
                title={isFollowed ? "Following" : "Follow this program"}
                onPress={() => void handleFollow(item)}
                disabled={isFollowed}
              />
            </View>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  header: { marginBottom: 8 },
  title: { fontSize: 18, fontWeight: "600" },
  spinner: { marginTop: 12 },
  error: { color: "#c00", marginTop: 12, textAlign: "center" },
  button: { marginTop: 12 },
  card: {
    marginTop: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 8,
  },
  programName: { fontSize: 16, fontWeight: "600" },
  programDescription: { color: "#666", marginTop: 4 },
  dayLine: { color: "#444", marginTop: 6, fontSize: 13 },
});
