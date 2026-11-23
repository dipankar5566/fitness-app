import { CameraView, useCameraPermissions } from "expo-camera";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { AppText, Button, Screen } from "../components/ui";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { makeStyles, radius, space, useTheme } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "BarcodeScan">;

const CORNER_SIZE = 32;
const CORNER_THICKNESS = 4;
const fillAbsolute = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xxl },
  overlay: { ...fillAbsolute, alignItems: "center", justifyContent: "center" },
  frame: { width: 260, height: 160 },
  corner: { position: "absolute", width: CORNER_SIZE, height: CORNER_SIZE, borderColor: colors.primary },
  cornerTL: { top: 0, left: 0, borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderTopLeftRadius: radius.sm },
  cornerTR: { top: 0, right: 0, borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderTopRightRadius: radius.sm },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderBottomLeftRadius: radius.sm },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderBottomRightRadius: radius.sm },
  hintBar: { padding: space.md, backgroundColor: colors.scrim },
}));

/** Barcode scan -> Open Food Facts lookup (PRD section 5.5). A debounce flag (`scanned`) stops
 * onBarcodeScanned from firing repeatedly while the same barcode stays in frame - without it the
 * camera would re-trigger navigation dozens of times a second. The corner-marker frame overlay
 * (docs/UI_UX_AUDIT.md M9) is purely visual guidance - the scanner itself reads the full frame, not
 * just the area inside the frame. */
export function BarcodeScanScreen({ navigation, route }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
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
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.frame}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>
      </View>
      <View style={styles.hintBar}>
        <AppText center color="#FFFFFF">Point the camera at a product barcode</AppText>
      </View>
    </View>
  );
}
