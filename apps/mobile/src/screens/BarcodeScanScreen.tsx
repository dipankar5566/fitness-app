import { CameraView, useCameraPermissions } from "expo-camera";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { AppText, Button, Screen } from "../components/ui";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors, space } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "BarcodeScan">;

/** Barcode scan -> Open Food Facts lookup (PRD section 5.5). A debounce flag (`scanned`) stops
 * onBarcodeScanned from firing repeatedly while the same barcode stays in frame - without it the
 * camera would re-trigger navigation dozens of times a second. */
export function BarcodeScanScreen({ navigation, route }: Props) {
  const { accountId } = route.params;
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  if (!permission) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen>
        <View style={styles.center}>
          <AppText center color={colors.textSecondary}>Camera permission is required to scan a barcode.</AppText>
          <Button title="Grant permission" onPress={() => void requestPermission()} style={{ marginTop: space.lg, minWidth: 160 }} />
        </View>
      </Screen>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e"] }}
        onBarcodeScanned={
          scanned
            ? undefined
            : ({ data }) => {
                setScanned(true);
                navigation.replace("LogPackagedFood", { accountId, barcode: data });
              }
        }
      />
      <View style={styles.hintBar}>
        <AppText center color={colors.textOnPrimary}>Point the camera at a product barcode</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xxl },
  hintBar: { padding: space.md, backgroundColor: "rgba(0,0,0,0.55)" },
});
