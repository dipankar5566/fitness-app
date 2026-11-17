import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { Alert, Switch, View } from "react-native";
import { AppText, Button, Card, SectionHeader, TextField } from "../components/ui";
import { getDatabase } from "../lib/db";
import {
  ensureNotificationPermission,
  isValidTimeOfDay,
  loadReminderSettings,
  saveReminderSettings,
  type ReminderSetting,
} from "../lib/reminders";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors, space } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Reminders">;

const KIND_LABEL: Record<ReminderSetting["kind"], string> = {
  meal: "Meal",
  workout: "Workout",
  water: "Water",
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Meal/workout/water reminder settings (PRD §5.6) - local notifications only, see
 * lib/reminders.ts's docstring for why app.reminder is unused. Time edits are staged in local
 * state and only take effect on "Save" (which both persists to kv and reschedules, via
 * saveReminderSettings) - turning a switch on takes effect immediately instead, since there's
 * nothing to batch and a denied permission needs to flip the switch straight back off.
 */
export function RemindersScreen({ route }: Props) {
  void route.params.accountId; // reminders are device-local, not account-scoped
  const [settings, setSettings] = useState<ReminderSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const db = await getDatabase();
      setSettings(await loadReminderSettings(db));
      setIsLoading(false);
    })();
  }, []);

  const updateReminder = (id: string, patch: Partial<ReminderSetting>) => {
    setSettings((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const handleToggle = async (reminder: ReminderSetting, enabled: boolean) => {
    if (enabled) {
      const granted = await ensureNotificationPermission();
      if (!granted) {
        Alert.alert(
          "Notifications are off",
          "Enable notifications for this app in your device settings to use reminders.",
        );
        return; // leave the switch off
      }
    }
    const next = settings.map((r) => (r.id === reminder.id ? { ...r, enabled } : r));
    setSettings(next);
    const db = await getDatabase();
    await saveReminderSettings(db, next); // immediate - nothing to batch for a simple on/off
  };

  const handleSaveTimes = async () => {
    const invalid = settings.find((r) => !isValidTimeOfDay(r.hour, r.minute));
    if (invalid) {
      Alert.alert("Invalid time", `${invalid.label}'s time isn't valid - use HH (0-23) and MM (0-59).`);
      return;
    }
    setIsSaving(true);
    try {
      const db = await getDatabase();
      await saveReminderSettings(db, settings);
      Alert.alert("Saved", "Your reminder times have been updated.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, padding: space.lg }}>
        <AppText variant="body" color={colors.textSecondary}>Loading…</AppText>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: space.lg }}>
      <SectionHeader title="Reminders" />
      <Card>
        {settings.map((reminder, index) => (
          <View key={reminder.id} style={{ marginTop: index === 0 ? 0 : space.lg }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View>
                <AppText variant="bodyMedium">{reminder.label}</AppText>
                <AppText variant="caption" color={colors.textSecondary}>{KIND_LABEL[reminder.kind]}</AppText>
              </View>
              <Switch
                value={reminder.enabled}
                onValueChange={(value) => void handleToggle(reminder, value)}
                trackColor={{ true: colors.primary, false: colors.stroke }}
              />
            </View>
            <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.sm }}>
              <TextField
                style={{ width: 64 }}
                keyboardType="number-pad"
                value={pad2(reminder.hour)}
                onChangeText={(text) => updateReminder(reminder.id, { hour: Number(text) || 0 })}
                placeholder="HH"
              />
              <AppText variant="h2" color={colors.textSecondary}>:</AppText>
              <TextField
                style={{ width: 64 }}
                keyboardType="number-pad"
                value={pad2(reminder.minute)}
                onChangeText={(text) => updateReminder(reminder.id, { minute: Number(text) || 0 })}
                placeholder="MM"
              />
            </View>
          </View>
        ))}
      </Card>

      <Button
        title="Save times"
        onPress={() => void handleSaveTimes()}
        loading={isSaving}
        style={{ marginTop: space.lg }}
      />
    </View>
  );
}
