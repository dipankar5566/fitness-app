import type { LogSource, MealType } from "@fitness-app/shared";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Crypto from "expo-crypto";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, View } from "react-native";
import { AppText, Badge, Button, Card, TextField } from "../components/ui";
import { ChipSelect } from "../components/ChipSelect";
import { trackEvent } from "../lib/analytics";
import {
  getFoodDetail,
  isNetworkError,
  parseMealDraft,
  parseMealPhoto,
  type FoodDetail,
  type MealDraftItem,
} from "../lib/api";
import { loadGuestSession } from "../lib/auth-storage";
import { getDatabase } from "../lib/db";
import { API_URL } from "../lib/env";
import { insert } from "../lib/food-log-repo";
import { syncNow } from "../lib/sync-engine";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors, space } from "../theme";

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
 * AI meal logging, from text or a photo (ARCHITECTURE.md §5, PRD §5.5) - one shared confirm
 * screen for both, since everything past "get a draft" is identical: free text (POST
 * /ai/meal/parse) or a single photo (POST /ai/meal/parse-photo, captured/picked via
 * expo-image-picker), either way search-then-matched against indb -> editable per-item
 * quantity/unit/match -> confirm logs each resolved item through the existing local food-log
 * outbox (source: "ai_text" or "ai_photo", tracked in `logSource`), same offline-first path
 * LogFoodScreen already uses for manual entries. A real smoke test turned up a wrong text match
 * ("filter coffee" -> "Coffee drops") - that's exactly why "Find a different match" exists: hands
 * off to FoodSearchScreen's new "pickMealItem" mode, which returns the replacement here via route
 * params.
 */
export function LogMealFromTextScreen({ navigation, route }: Props) {
  const { accountId } = route.params;
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<MealDraftItem[]>([]);
  const [detailByFoodRef, setDetailByFoodRef] = useState<Record<string, FoodDetail>>({});
  const [logSource, setLogSource] = useState<LogSource>("ai_text");
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

  /** Shared by the text and photo paths: fetch each matched item's FoodDetail (for serving
   * measures/macro preview, the same data LogFoodScreen already uses) and normalize units before
   * showing the draft. */
  const applyParsedItems = async (items: MealDraftItem[]) => {
    const refs = [...new Set(items.filter((item) => item.foodRef).map((item) => item.foodRef!))];
    const details = await Promise.all(refs.map((ref) => getFoodDetail(API_URL, ref).catch(() => null)));
    const detailMap: Record<string, FoodDetail> = {};
    refs.forEach((ref, index) => {
      const detail = details[index];
      if (detail) detailMap[ref] = detail;
    });

    setDetailByFoodRef(detailMap);
    setDraft(items.map((item) => (item.foodRef ? normalizeUnit(item, detailMap[item.foodRef]) : item)));
  };

  const handleParse = async () => {
    if (!text.trim()) return;
    setIsParsing(true);
    setParseError(null);
    setConfirmError(null);
    try {
      const session = await loadGuestSession();
      if (!session) throw new Error("No guest session");
      const items = await parseMealDraft(API_URL, session.accessToken, text.trim());
      setLogSource("ai_text");
      await applyParsedItems(items);
    } catch (err) {
      setParseError(
        isNetworkError(err) ? "Offline - try again when connected." : "Couldn't parse that. Try rephrasing.",
      );
    } finally {
      setIsParsing(false);
    }
  };

  const handlePhoto = async (launch: () => Promise<ImagePicker.ImagePickerResult>, permissionError: string) => {
    setIsParsing(true);
    setParseError(null);
    setConfirmError(null);
    try {
      const result = await launch();
      if (result.canceled || !result.assets[0]) {
        setIsParsing(false);
        return;
      }
      const asset = result.assets[0];
      const session = await loadGuestSession();
      if (!session) throw new Error("No guest session");
      const items = await parseMealPhoto(API_URL, session.accessToken, {
        uri: asset.uri,
        name: asset.fileName ?? "meal.jpg",
        type: asset.mimeType ?? "image/jpeg",
      });
      setLogSource("ai_photo");
      await applyParsedItems(items);
    } catch (err) {
      setParseError(
        isNetworkError(err) ? "Offline - try again when connected." : permissionError,
      );
    } finally {
      setIsParsing(false);
    }
  };

  const handleTakePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setParseError("Camera permission is required to take a meal photo.");
      return;
    }
    await handlePhoto(
      () => ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.7 }),
      "Couldn't read that photo. Try again.",
    );
  };

  const handlePickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setParseError("Photo library permission is required to choose a meal photo.");
      return;
    }
    await handlePhoto(
      () => ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 }),
      "Couldn't read that photo. Try again.",
    );
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
          source: logSource,
          isEstimate: item.isEstimate,
          isDeleted: false,
          updatedAt: now,
          macros: computePreview(item, detail),
          foodName: item.foodName,
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
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxxl }}
      data={draft}
      keyExtractor={(_, index) => String(index)}
      ListHeaderComponent={
        <View>
          <TextField
            label="Describe your meal"
            placeholder='e.g. "2 roti aur dal" or "idli sambar and filter coffee"'
            value={text}
            onChangeText={setText}
            multiline
            style={{ minHeight: 60 }}
          />
          {parseError ? <AppText color={colors.error} center style={{ marginTop: space.sm }}>{parseError}</AppText> : null}
          <Button
            title={isParsing ? "Parsing..." : "Parse"}
            onPress={() => void handleParse()}
            loading={isParsing}
            disabled={!text.trim()}
            style={{ marginTop: space.md }}
          />

          <AppText variant="caption" color={colors.textTertiary} center style={{ marginTop: space.md }}>or</AppText>
          <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.sm }}>
            <Button title="Take a photo" variant="secondary" onPress={() => void handleTakePhoto()} disabled={isParsing} style={{ flex: 1 }} />
            <Button title="Choose from gallery" variant="secondary" onPress={() => void handlePickPhoto()} disabled={isParsing} style={{ flex: 1 }} />
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
          <Card style={{ marginTop: space.lg }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <AppText variant="h3" style={{ flex: 1 }} numberOfLines={1}>{item.foodName ?? item.rawName}</AppText>
              <Pressable onPress={() => removeItem(index)}>
                <AppText variant="caption" color={colors.error}>Remove</AppText>
              </Pressable>
            </View>

            {!item.foodRef ? (
              <>
                <View style={{ marginTop: space.sm }}>
                  <Badge label="no match" tone="warning" />
                </View>
                <Pressable
                  onPress={() =>
                    navigation.navigate("FoodSearch", { accountId, mode: "pickMealItem", mealItemIndex: index })
                  }
                  style={{ marginTop: space.sm }}
                >
                  <AppText variant="captionMedium" color={colors.primary}>Find a match</AppText>
                </Pressable>
              </>
            ) : (
              <>
                <View style={{ marginTop: space.sm, width: 90 }}>
                  <TextField
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
                  style={{ marginTop: space.sm }}
                >
                  <AppText variant="captionMedium" color={colors.primary}>Find a different match</AppText>
                </Pressable>
                {preview ? (
                  <AppText variant="caption" color={colors.textSecondary} numbers style={{ marginTop: space.sm }}>
                    {preview.kcal ?? "?"} kcal · {preview.proteinG ?? "?"}g protein
                  </AppText>
                ) : null}
              </>
            )}
          </Card>
        );
      }}
      ListFooterComponent={
        draft.length > 0 ? (
          <View style={{ marginTop: space.lg }}>
            {confirmError ? <AppText color={colors.error} center style={{ marginBottom: space.sm }}>{confirmError}</AppText> : null}
            {isConfirming ? <ActivityIndicator color={colors.primary} style={{ marginBottom: space.sm }} /> : null}
            <Button title="Log it" onPress={() => void handleConfirm()} disabled={isConfirming} />
          </View>
        ) : undefined
      }
    />
  );
}
