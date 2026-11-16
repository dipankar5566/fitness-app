import type { MealType } from "@fitness-app/shared";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Crypto from "expo-crypto";
import { useEffect, useState } from "react";
import { ActivityIndicator, Button, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ChipSelect } from "../components/ChipSelect";
import { trackEvent } from "../lib/analytics";
import { getFoodDetail, isNetworkError, parseMealDraft, type FoodDetail, type MealDraftItem } from "../lib/api";
import { loadGuestSession } from "../lib/auth-storage";
import { getDatabase } from "../lib/db";
import { API_URL } from "../lib/env";
import { insert } from "../lib/food-log-repo";
import { syncNow } from "../lib/sync-engine";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "LogMealFromText">;

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

function defaultMealType(): MealType {
  const hour = new Date().getHours();
  if (hour < 11) return "breakfast";
  if (hour < 16) return "lunch";
  if (hour < 21) return "dinner";
  return "snack";
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

interface MacroPreview {
  kcal: number | null;
  proteinG: number | null;
  fatG: number | null;
  carbG: number | null;
}

function gramsPerUnit(unit: string, detail: FoodDetail): number | null {
  if (unit === "g" || unit === "ml") {
    return 1;
  }
  return detail.servingMeasures.find((measure) => measure.name === unit)?.grams ?? null;
}

function computePreview(item: MealDraftItem, detail: FoodDetail | undefined): MacroPreview | null {
  if (!detail) return null;
  const perUnit = gramsPerUnit(item.unit, detail);
  if (perUnit === null) return null;
  const scale = (item.quantity * perUnit) / 100;
  const scaled = (per100g: number | null) => (per100g === null ? null : Math.round(per100g * scale * 10) / 10);
  return {
    kcal: scaled(detail.nutrientsPer100g.kcal),
    proteinG: scaled(detail.nutrientsPer100g.proteinG),
    fatG: scaled(detail.nutrientsPer100g.fatG),
    carbG: scaled(detail.nutrientsPer100g.carbG),
  };
}

/** Normalizes a freshly-parsed item's unit to one the matched food actually has (so the first
 * render shows a real preview instead of "?") - keeps the AI's quantity number, only swaps the
 * unit when it doesn't match "g"/"ml" or a real serving measure name, same fallback LogFoodScreen
 * uses for a food with no prior default. */
function normalizeUnit(item: MealDraftItem, detail: FoodDetail | undefined): MealDraftItem {
  if (!detail) return item;
  if (item.unit === "g" || item.unit === "ml") return item;
  if (detail.servingMeasures.some((measure) => measure.name === item.unit)) return item;
  const fallback = detail.servingMeasures.find((measure) => measure.isDefault) ?? detail.servingMeasures[0];
  return fallback ? { ...item, unit: fallback.name } : item;
}

/**
 * Text-based AI meal logging (ARCHITECTURE.md §5, PRD §5.5): free text -> draft (via POST
 * /ai/meal/parse, search-then-match against indb) -> editable per-item quantity/unit/match ->
 * confirm logs each resolved item through the existing local food-log outbox (source: "ai_text"),
 * same offline-first path LogFoodScreen already uses for manual entries. A real smoke test turned
 * up a wrong match ("filter coffee" -> "Coffee drops") - that's exactly why "Find a different
 * match" exists: hands off to FoodSearchScreen's new "pickMealItem" mode, which returns the
 * replacement here via route params.
 */
export function LogMealFromTextScreen({ navigation, route }: Props) {
  const { accountId } = route.params;
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<MealDraftItem[]>([]);
  const [detailByFoodRef, setDetailByFoodRef] = useState<Record<string, FoodDetail>>({});
  const [mealType, setMealType] = useState<MealType>(defaultMealType());
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  useEffect(() => {
    const picked = route.params.pickedMealItemFood;
    if (!picked) return;
    navigation.setParams({ pickedMealItemFood: undefined });
    void (async () => {
      const detail = await getFoodDetail(API_URL, picked.code).catch(() => null);
      if (detail) {
        setDetailByFoodRef((current) => ({ ...current, [picked.code]: detail }));
      }
      setDraft((current) =>
        current.map((item, index) => {
          if (index !== picked.index) return item;
          const replaced: MealDraftItem = {
            ...item,
            foodSource: "indb",
            foodRef: picked.code,
            foodName: picked.name,
            isEstimate: false,
          };
          return normalizeUnit(replaced, detail ?? undefined);
        }),
      );
    })();
  }, [route.params.pickedMealItemFood, navigation]);

  const handleParse = async () => {
    if (!text.trim()) return;
    setIsParsing(true);
    setParseError(null);
    setConfirmError(null);
    try {
      const session = await loadGuestSession();
      if (!session) throw new Error("No guest session");
      const items = await parseMealDraft(API_URL, session.accessToken, text.trim());

      const refs = [...new Set(items.filter((item) => item.foodRef).map((item) => item.foodRef!))];
      const details = await Promise.all(refs.map((ref) => getFoodDetail(API_URL, ref).catch(() => null)));
      const detailMap: Record<string, FoodDetail> = {};
      refs.forEach((ref, index) => {
        const detail = details[index];
        if (detail) detailMap[ref] = detail;
      });

      setDetailByFoodRef(detailMap);
      setDraft(items.map((item) => (item.foodRef ? normalizeUnit(item, detailMap[item.foodRef]) : item)));
    } catch (err) {
      setParseError(
        isNetworkError(err) ? "Offline - try again when connected." : "Couldn't parse that. Try rephrasing.",
      );
    } finally {
      setIsParsing(false);
    }
  };

  const updateItem = (index: number, patch: Partial<Pick<MealDraftItem, "quantity" | "unit">>) => {
    setDraft((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const removeItem = (index: number) => {
    setDraft((current) => current.filter((_, i) => i !== index));
  };

  const handleConfirm = async () => {
    const loggable = draft.filter((item) => item.foodRef !== null);
    if (loggable.length === 0) {
      setConfirmError("Nothing to log - find a match for at least one item first.");
      return;
    }
    const guestSession = await loadGuestSession();
    if (!guestSession) return;
    setIsConfirming(true);
    setConfirmError(null);
    try {
      const db = await getDatabase();
      const now = new Date().toISOString();
      for (const item of loggable) {
        const detail = detailByFoodRef[item.foodRef!];
        await insert(db, {
          id: Crypto.randomUUID(),
          accountId: guestSession.accountId,
          foodSource: "indb",
          foodRef: item.foodRef!,
          quantity: item.quantity,
          unit: item.unit,
          mealType,
          loggedAt: now,
          source: "ai_text",
          isEstimate: item.isEstimate,
          isDeleted: false,
          updatedAt: now,
          macros: computePreview(item, detail),
        });
      }
      trackEvent("ai_meal_logged");
      void syncNow(db, API_URL, guestSession.accessToken);
      navigation.navigate("Home", { accountId });
    } catch {
      trackEvent("ai_meal_log_failed");
      setConfirmError("Something went wrong saving these entries.");
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={draft}
      keyExtractor={(_, index) => String(index)}
      ListHeaderComponent={
        <View>
          <Text style={styles.label}>Describe your meal</Text>
          <TextInput
            style={styles.textArea}
            placeholder='e.g. "2 roti aur dal" or "idli sambar and filter coffee"'
            value={text}
            onChangeText={setText}
            multiline
          />
          {parseError ? <Text style={styles.error}>{parseError}</Text> : null}
          <View style={styles.button}>
            <Button
              title={isParsing ? "Parsing..." : "Parse"}
              onPress={() => void handleParse()}
              disabled={isParsing || !text.trim()}
            />
          </View>

          {draft.length > 0 ? (
            <ChipSelect label="Meal" options={MEAL_TYPES} value={mealType} onChange={setMealType} formatOption={capitalize} />
          ) : null}
        </View>
      }
      renderItem={({ item, index }) => {
        const detail = item.foodRef ? detailByFoodRef[item.foodRef] : undefined;
        const preview = computePreview(item, detail);
        const unitOptions = ["g", ...(detail?.servingMeasures ?? []).map((measure) => measure.name)];

        return (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.itemName}>{item.foodName ?? item.rawName}</Text>
              <Pressable onPress={() => removeItem(index)}>
                <Text style={styles.removeLabel}>Remove</Text>
              </Pressable>
            </View>

            {!item.foodRef ? (
              <>
                <Text style={styles.noMatch}>No match found for "{item.rawName}".</Text>
                <Pressable
                  onPress={() =>
                    navigation.navigate("FoodSearch", { accountId, mode: "pickMealItem", mealItemIndex: index })
                  }
                >
                  <Text style={styles.findMatch}>Find a match</Text>
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.quantityRow}>
                  <TextInput
                    style={styles.quantityInput}
                    keyboardType="numeric"
                    value={String(item.quantity)}
                    onChangeText={(value) => updateItem(index, { quantity: Number(value) || 0 })}
                  />
                </View>
                <ChipSelect
                  label="Unit"
                  options={unitOptions}
                  value={item.unit}
                  onChange={(unit) => updateItem(index, { unit })}
                />
                <Pressable
                  onPress={() =>
                    navigation.navigate("FoodSearch", { accountId, mode: "pickMealItem", mealItemIndex: index })
                  }
                >
                  <Text style={styles.findMatch}>Find a different match</Text>
                </Pressable>
                {preview ? (
                  <Text style={styles.preview}>
                    {preview.kcal ?? "?"} kcal · {preview.proteinG ?? "?"}g protein
                  </Text>
                ) : null}
              </>
            )}
          </View>
        );
      }}
      ListFooterComponent={
        draft.length > 0 ? (
          <View style={styles.footer}>
            {confirmError ? <Text style={styles.error}>{confirmError}</Text> : null}
            {isConfirming ? <ActivityIndicator /> : null}
            <View style={styles.button}>
              <Button title="Log it" onPress={() => void handleConfirm()} disabled={isConfirming} />
            </View>
          </View>
        ) : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },
  label: { fontWeight: "600", marginBottom: 6 },
  textArea: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10, minHeight: 60 },
  button: { marginTop: 12 },
  error: { color: "#c00", marginTop: 8, textAlign: "center" },
  card: { marginTop: 16, padding: 12, borderWidth: 1, borderColor: "#eee", borderRadius: 8 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemName: { fontSize: 16, fontWeight: "600", flex: 1 },
  removeLabel: { color: "#c00" },
  noMatch: { color: "#b8860b", marginTop: 6 },
  findMatch: { color: "#06c", marginTop: 8 },
  quantityRow: { marginTop: 8 },
  quantityInput: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 8, width: 80 },
  preview: { color: "#444", marginTop: 8 },
  footer: { marginTop: 8 },
});
