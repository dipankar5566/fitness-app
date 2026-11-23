import type { AchievementSummary } from "@fitness-app/shared";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { AppText, Card, Screen, SectionHeader } from "../components/ui";
import { loadAchievements, markBadgesSeen } from "../lib/achievements-repo";
import { getDatabase } from "../lib/db";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors, radius, space } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Achievements">;

/**
 * Level + badge grid (packages/shared's achievements.ts). Everything is derived from the local
 * mirror via achievements-repo.ts - no network. Opening this screen marks every unlocked badge as
 * seen, so Today's "new badge" banner doesn't repeat what the user is looking at right now.
 */
export function AchievementsScreen({ route }: Props) {
  const { accountId } = route.params;
  const [summary, setSummary] = useState<AchievementSummary | null>(null);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const db = await getDatabase();
        const loaded = await loadAchievements(db, accountId);
        setSummary(loaded);
        await markBadgesSeen(db, loaded.badges.filter((b) => b.unlocked).map((b) => b.id));
      })();
    }, [accountId]),
  );

  if (!summary) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} style={{ marginTop: space.xxl }} />
      </Screen>
    );
  }

  const unlockedCount = summary.badges.filter((b) => b.unlocked).length;

  return (
    <Screen scroll>
      <Card>
        <View style={styles.levelRow}>
          <View style={styles.levelBadge}>
            <AppText variant="h2" numbers color={colors.primary}>{summary.level}</AppText>
          </View>
          <View style={{ flex: 1, marginLeft: space.lg }}>
            <AppText variant="bodyMedium">Level {summary.level}</AppText>
            <AppText variant="caption" color={colors.textSecondary} numbers>
              {summary.points} points
              {summary.nextLevelAt !== null ? ` · ${summary.nextLevelAt - summary.points} to level ${summary.level + 1}` : " · top level"}
            </AppText>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.round(summary.levelProgress * 100)}%` }]} />
            </View>
          </View>
        </View>
        <AppText variant="micro" color={colors.textTertiary} style={{ marginTop: space.md }}>
          Points come from logging consistently, training, hydration and completed fasts.
        </AppText>
      </Card>

      <SectionHeader title={`Badges · ${unlockedCount}/${summary.badges.length}`} style={{ marginTop: space.xxl }} />
      <View style={styles.grid}>
        {summary.badges.map((badge) => (
          <Card key={badge.id} style={[styles.badge, !badge.unlocked && styles.badgeLocked]}>
            <MaterialCommunityIcons
              name={badge.icon as keyof typeof MaterialCommunityIcons.glyphMap}
              size={28}
              color={badge.unlocked ? colors.accent : colors.textTertiary}
            />
            <AppText variant="captionMedium" center style={{ marginTop: space.xs }}>{badge.title}</AppText>
            <AppText variant="micro" color={colors.textSecondary} center style={{ marginTop: space.xxs }}>
              {badge.description}
            </AppText>
            {!badge.unlocked ? (
              <AppText variant="micro" numbers color={colors.textTertiary} center style={{ marginTop: space.xs }}>
                {badge.progress}/{badge.threshold}
              </AppText>
            ) : null}
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  levelRow: { flexDirection: "row", alignItems: "center" },
  levelBadge: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTonal,
    alignItems: "center",
    justifyContent: "center",
  },
  track: { height: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, marginTop: space.sm, overflow: "hidden" },
  fill: { height: 6, borderRadius: radius.pill, backgroundColor: colors.primary },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: space.md },
  badge: { width: "48%", alignItems: "center", paddingVertical: space.lg },
  badgeLocked: { opacity: 0.6 },
});
