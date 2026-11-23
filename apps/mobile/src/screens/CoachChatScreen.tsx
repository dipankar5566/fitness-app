import { COACH_PROMPT_SUGGESTIONS, MEDICAL_DISCLAIMER } from "@fitness-app/shared";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, View } from "react-native";
import { AppText, Card, IconButton, TextField } from "../components/ui";
import {
  AiQuotaExceededError,
  ApiError,
  getCoachHistory,
  isNetworkError,
  sendCoachMessage,
  type CoachMessageRow,
} from "../lib/api";
import { loadGuestSession } from "../lib/auth-storage";
import { API_URL } from "../lib/env";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { makeStyles, radius, space, useTheme } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "CoachChat">;

/**
 * AI coach chat (PRD §5.5/ARCHITECTURE.md §5, M5). Deliberately online-only - no offline queue -
 * since every turn costs real money (AiUsageService's daily quota) and needs fresh grounding
 * (today's logs/targets), unlike food logging which works fine queued offline. The medical
 * disclaimer banner is always visible, not just appended to a reply that happens to need it -
 * CoachService already appends MEDICAL_DISCLAIMER to replies that need it server-side; this
 * banner is the always-on "this isn't medical advice" framing the PRD's screen-level AC expects.
 */

type Message = { id: string; role: "user" | "assistant"; content: string };

function fromHistoryRow(row: CoachMessageRow): Message | null {
  if (row.role === "tool") return null; // not rendered - no tool-calling wired up yet (ARCHITECTURE.md §5)
  return { id: row.id, role: row.role, content: row.content };
}

const useStyles = makeStyles((colors) => ({
  flex: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xxl },
  promptChips: { marginTop: space.lg, gap: space.sm, alignSelf: "stretch" },
  promptChip: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    alignItems: "center",
  },
  promptChipPressed: { backgroundColor: colors.primaryTonal },
  disclaimerBanner: {
    padding: space.md,
    backgroundColor: colors.accentTonal,
    borderBottomWidth: 1,
    borderBottomColor: colors.stroke,
  },
  messages: { padding: space.lg, gap: space.sm, flexGrow: 1 },
  bubbleRow: { flexDirection: "row" },
  bubbleRowUser: { justifyContent: "flex-end" },
  bubble: { maxWidth: "85%", paddingVertical: space.sm, paddingHorizontal: space.md, borderRadius: radius.lg },
  bubbleAssistant: { backgroundColor: colors.surface },
  bubbleUser: { backgroundColor: colors.primary, borderColor: colors.primary },
  typingRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.lg, paddingBottom: space.xs },
  errorBanner: { paddingHorizontal: space.lg, paddingBottom: space.xs },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: space.sm,
    padding: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.stroke,
    backgroundColor: colors.surface,
  },
  input: { flex: 1, maxHeight: 120 },
}));

export function CoachChatScreen({ route }: Props) {
  void route.params.accountId; // not needed directly - the server scopes everything by the JWT's accountId
  const styles = useStyles();
  const { colors } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    void (async () => {
      const session = await loadGuestSession();
      if (!session) return;
      try {
        const history = await getCoachHistory(API_URL, session.accessToken);
        setMessages(history.map(fromHistoryRow).filter((m): m is Message => m !== null));
      } catch (err) {
        if (!isNetworkError(err)) throw err;
        setError("Coach needs a connection. Check your internet and reopen this screen.");
      } finally {
        setIsLoadingHistory(false);
      }
    })();
  }, []);

  const send = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || isSending) return;

    const session = await loadGuestSession();
    if (!session) return;

    setDraft("");
    setError(null);
    const userMessage: Message = { id: `local-${Date.now()}`, role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
    setIsSending(true);

    try {
      const reply = await sendCoachMessage(API_URL, session.accessToken, text);
      setMessages((prev) => [...prev, { id: `local-${Date.now()}-reply`, role: "assistant", content: reply }]);
    } catch (err) {
      if (err instanceof AiQuotaExceededError) {
        setError("You've hit today's coach usage limit - try again tomorrow.");
      } else if (isNetworkError(err)) {
        setError("Coach needs a connection. Your message wasn't sent - try again.");
      } else if (err instanceof ApiError) {
        setError("Something went wrong reaching the coach. Try again.");
      } else {
        throw err;
      }
      // Remove the optimistic user bubble on failure so the draft can be resent as-is.
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
      setDraft(text);
    } finally {
      setIsSending(false);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, [isSending]);

  const handleSend = useCallback(() => void send(draft), [send, draft]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <View style={styles.disclaimerBanner}>
        <AppText variant="caption" color={colors.textSecondary}>{MEDICAL_DISCLAIMER}</AppText>
      </View>

      {isLoadingHistory ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messages}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.centered}>
              <AppText variant="body" color={colors.textSecondary} center>
                Ask about your targets, today's logs, or your training - I'll answer using your own data.
              </AppText>
              <View style={styles.promptChips}>
                {COACH_PROMPT_SUGGESTIONS.map((prompt) => (
                  <Pressable
                    key={prompt}
                    disabled={isSending}
                    onPress={() => void send(prompt)}
                    style={({ pressed }) => [styles.promptChip, pressed && styles.promptChipPressed]}
                  >
                    <AppText variant="caption" color={colors.primary}>{prompt}</AppText>
                  </Pressable>
                ))}
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.bubbleRow, item.role === "user" && styles.bubbleRowUser]}>
              <Card style={[styles.bubble, item.role === "user" ? styles.bubbleUser : styles.bubbleAssistant]}>
                <AppText
                  variant="body"
                  color={item.role === "user" ? colors.textOnPrimary : colors.text}
                >
                  {item.content}
                </AppText>
              </Card>
            </View>
          )}
        />
      )}

      {isSending ? (
        <View style={styles.typingRow}>
          <ActivityIndicator size="small" color={colors.textSecondary} />
          <AppText variant="caption" color={colors.textSecondary} style={{ marginLeft: space.xs }}>
            Coach is thinking…
          </AppText>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBanner}>
          <AppText variant="caption" color={colors.error}>{error}</AppText>
        </View>
      ) : null}

      <View style={styles.inputRow}>
        <TextField
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Ask your coach…"
          multiline
          editable={!isSending}
        />
        <IconButton icon="send" label="Send message" onPress={() => void handleSend()} color={colors.primary} size={26} />
      </View>
    </KeyboardAvoidingView>
  );
}
