import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Crypto from "expo-crypto";
import { useEffect, useState } from "react";
import { FlatList, View } from "react-native";
import { AppText, Button, EmptyState, ListRow, Screen, TextField } from "../components/ui";
import { trackEvent } from "../lib/analytics";
import { loadGuestSession } from "../lib/auth-storage";
import { insertCustomFood, insertIngredient } from "../lib/custom-food-repo";
import { getDatabase } from "../lib/db";
import { API_URL } from "../lib/env";
import { syncNow } from "../lib/sync-engine";
import type { PickedIngredient, RootStackParamList } from "../navigation/RootNavigator";
import { colors, space } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "CreateCustomFood">;

/** Create-only in v1 (no editing an existing recipe) - nothing is written to SQLite until "Save",
 * so the ingredient list lives in component state while building. "Add ingredient" hands off to
 * FoodSearchScreen in pick mode, which hands the result back via route.params.pickedIngredient
 * (the standard React Navigation "pass params back to a screen already in the stack" pattern). */
export function CreateCustomFoodScreen({ navigation, route }: Props) {
  const { accountId } = route.params;
  const [name, setName] = useState("");
  const [ingredients, setIngredients] = useState<PickedIngredient[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const picked = route.params.pickedIngredient;
    if (picked) {
      setIngredients((current) => [...current, picked]);
      navigation.setParams({ pickedIngredient: undefined });
    }
  }, [route.params.pickedIngredient, navigation]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Give this recipe a name.");
      return;
    }
    if (ingredients.length === 0) {
      setError("Add at least one ingredient.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const session = await loadGuestSession();
      if (!session) {
        throw new Error("No guest session");
      }
      const db = await getDatabase();
      const customFoodId = Crypto.randomUUID();
      const now = new Date().toISOString();

      await insertCustomFood(db, {
        id: customFoodId,
        accountId: session.accountId,
        name: name.trim(),
        isDeleted: false,
        updatedAt: now,
      });
      for (const ingredient of ingredients) {
        await insertIngredient(db, {
          id: Crypto.randomUUID(),
          accountId: session.accountId,
          customFoodId,
          foodSource: "indb",
          foodRef: ingredient.foodRef,
          quantityG: ingredient.quantityG,
          isDeleted: false,
          updatedAt: now,
        });
      }

      trackEvent("custom_food_created");
      void syncNow(db, API_URL, session.accessToken);
      navigation.navigate("MyFoods", { accountId });
    } catch {
      setError("Something went wrong.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen padded={false}>
      <FlatList
        contentContainerStyle={{ padding: space.lg }}
        data={ingredients}
        keyExtractor={(item, index) => `${item.foodRef}-${index}`}
        ListHeaderComponent={
          <View style={{ marginBottom: space.lg }}>
            <TextField label="Name" placeholder="e.g. Overnight oats" value={name} onChangeText={setName} />
            <AppText variant="h3" style={{ marginTop: space.xl }}>Ingredients</AppText>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.separator }} />}
        renderItem={({ item }) => (
          <ListRow
            title={item.name}
            trailing={<AppText variant="caption" color={colors.textSecondary} numbers>{item.quantityG}g</AppText>}
          />
        )}
        ListEmptyComponent={<EmptyState icon="food-variant" title="No ingredients added yet." />}
        ListFooterComponent={
          <View>
            <Button
              title="+ Add ingredient"
              variant="secondary"
              onPress={() => navigation.navigate("FoodSearch", { accountId, mode: "pickIngredient" })}
              style={{ marginTop: space.md }}
            />
            {error ? <AppText color={colors.error} center style={{ marginTop: space.lg }}>{error}</AppText> : null}
            <Button
              title={isSaving ? "Saving..." : "Save recipe"}
              onPress={() => void handleSave()}
              loading={isSaving}
              style={{ marginTop: space.xl }}
            />
          </View>
        }
      />
    </Screen>
  );
}
