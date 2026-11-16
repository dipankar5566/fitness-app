import { CameraView, useCameraPermissions } from "expo-camera";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { ActivityIndicator, Button, StyleSheet, Text, View } from "react-native";
import type { RootStackParamList } from "../navigation/RootNavigator";

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
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>Camera permission is required to scan a barcode.</Text>
        <View style={styles.button}>
          <Button title="Grant permission" onPress={() => void requestPermission()} />
        </View>
      </View>
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
      <Text style={styles.hint}>Point the camera at a product barcode</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  camera: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  message: { textAlign: "center" },
  button: { marginTop: 16 },
  hint: { textAlign: "center", padding: 12, color: "#666" },
});
