import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StyleSheet, Text, View } from "react-native";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export function HomeScreen({ route }: Props) {
  return (
    <View style={styles.container}>
      <Text>Guest account ready.</Text>
      <Text style={styles.id}>{route.params.accountId}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  id: { color: "#666", fontSize: 12 },
});
