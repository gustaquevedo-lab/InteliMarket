import React, { useState, useEffect, useRef, useCallback } from "react"
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Vibration, TextInput, Animated as RNAnimated, Easing } from "react-native"
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera"
import { LinearGradient } from "expo-linear-gradient"
import { BlurView } from "expo-blur"
import * as Haptics from "expo-haptics"
import { colors, spacing, borderRadius, typography, glass } from "../theme"

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window")
const SCAN_SIZE = SCREEN_WIDTH * 0.7

interface BarcodeScannerProps {
  onScan: (barcode: string) => void
  onClose: () => void
  expectedBarcode?: string
  packageDesc?: string
}

export function BarcodeScanner({ onScan, onClose, expectedBarcode, packageDesc }: BarcodeScannerProps) {
  const [permission, requestPermission] = useCameraPermissions()
  const [scanned, setScanned] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [manualMode, setManualMode] = useState(false)
  const [manualCode, setManualCode] = useState("")
  const [torch, setTorch] = useState(false)
  const scanLineAnim = useRef(new RNAnimated.Value(0)).current
  const pulseAnim = useRef(new RNAnimated.Value(1)).current

  useEffect(() => {
    if (!permission) { requestPermission(); return }
    if (!permission.granted) { requestPermission() }
  }, [permission])

  useEffect(() => {
    const lineLoop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(scanLineAnim, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true }),
        RNAnimated.timing(scanLineAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    )
    lineLoop.start()

    const pulseLoop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulseAnim, { toValue: 1.03, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        RNAnimated.timing(pulseAnim, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    )
    pulseLoop.start()

    return () => { lineLoop.stop(); pulseLoop.stop() }
  }, [])

  const handleBarCodeScanned = useCallback((result: BarcodeScanningResult) => {
    if (scanned) return
    setScanned(true)
    Vibration.vibrate(100)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    setShowSuccess(true)
    setTimeout(() => {
      onScan(result.data)
    }, 800)
  }, [scanned, onScan])

  const handleManualSubmit = () => {
    if (!manualCode.trim()) return
    Vibration.vibrate(50)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    onScan(manualCode.trim())
  }

  const scanLineTranslate = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCAN_SIZE / 2, SCAN_SIZE / 2],
  })

  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.permissionCard}>
          <Text style={{ fontSize: 48, marginBottom: spacing.md }}>📷</Text>
          <Text style={styles.permissionTitle}>Permiso de cámara requerido</Text>
          <Text style={styles.permissionText}>Necesitamos acceso a la cámara para escanear códigos de barras de los paquetes.</Text>
          <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
            <Text style={styles.permissionBtnText}>Conceder permiso</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backBtn} onPress={onClose}>
            <Text style={styles.backBtnText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ["qr", "ean13", "ean8", "code39", "code128", "pdf417", "aztec", "datamatrix", "upc_a", "upc_e"] }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      <LinearGradient colors={["rgba(0,0,0,0.6)", "transparent", "transparent", "rgba(0,0,0,0.6)"]} style={StyleSheet.absoluteFill} />

      {/* Scan area overlay */}
      <View style={styles.scanOverlay}>
        <RNAnimated.View style={[styles.scanFrame, { transform: [{ scale: pulseAnim }] }]}>
          {/* Corner brackets */}
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />

          {/* Scan line */}
          <RNAnimated.View style={[styles.scanLine, { transform: [{ translateY: scanLineTranslate }] }]}>
            <LinearGradient colors={["transparent", colors.primaryLight, "transparent"]} style={{ flex: 1 }} />
          </RNAnimated.View>
        </RNAnimated.View>
      </View>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={onClose}>
          <Text style={styles.headerBtnText}>✕</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerBtn} onPress={() => setTorch(!torch)}>
          <Text style={styles.headerBtnText}>{torch ? "🔦" : "🔦"}</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom info */}
      <View style={styles.bottomInfo}>
        <BlurView intensity={35} tint="dark" style={styles.bottomCard}>
          {showSuccess ? (
            <View style={{ alignItems: "center", paddingVertical: spacing.sm }}>
              <Text style={{ fontSize: 32 }}>✅</Text>
              <Text style={styles.scanSuccessText}>¡Código escaneado!</Text>
            </View>
          ) : manualMode ? (
            <View>
              <Text style={styles.infoText}>Ingresá el código manualmente</Text>
              <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
                <TextInput
                  style={styles.manualInput}
                  placeholder="Código de barras"
                  placeholderTextColor={colors.textTertiary}
                  value={manualCode}
                  onChangeText={setManualCode}
                  autoFocus
                />
                <TouchableOpacity style={styles.manualSubmitBtn} onPress={handleManualSubmit}>
                  <Text style={styles.manualSubmitText}>OK</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => setManualMode(false)} style={{ marginTop: spacing.sm }}>
                <Text style={styles.switchLink}>Volver a escáner</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text style={styles.infoText}>
                {expectedBarcode ? `Esperado: ${expectedBarcode}` : "Escaneá el código de barras del paquete"}
              </Text>
              {packageDesc && <Text style={styles.packageDesc}>{packageDesc}</Text>}
              <Text style={styles.infoSubtext}>Alineá el código dentro del marco</Text>
              <TouchableOpacity onPress={() => setManualMode(true)} style={{ marginTop: spacing.sm }}>
                <Text style={styles.switchLink}>Ingresar código manualmente</Text>
              </TouchableOpacity>
            </View>
          )}
        </BlurView>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  header: { position: "absolute", top: 50, left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing.xl, zIndex: 10 },
  headerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  headerBtnText: { fontSize: 22, color: colors.text },
  scanOverlay: { flex: 1, justifyContent: "center", alignItems: "center" },
  scanFrame: { width: SCAN_SIZE, height: SCAN_SIZE, position: "relative", justifyContent: "center", alignItems: "center" },
  corner: { position: "absolute", width: 24, height: 24, borderColor: colors.primaryLight },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },
  scanLine: { position: "absolute", width: SCAN_SIZE - 40, height: 3, borderRadius: 1.5 },
  bottomInfo: { position: "absolute", bottom: 80, left: spacing.xl, right: spacing.xl },
  bottomCard: { borderRadius: borderRadius.xl, padding: spacing.lg, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  infoText: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.semibold, color: colors.text, textAlign: "center" },
  packageDesc: { fontSize: typography.fontSize.sm, color: colors.textSecondary, textAlign: "center", marginTop: 4 },
  infoSubtext: { fontSize: typography.fontSize.xs, color: colors.textTertiary, textAlign: "center", marginTop: 4 },
  scanSuccessText: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.bold, color: colors.success, marginTop: spacing.xs },
  switchLink: { fontSize: typography.fontSize.sm, color: colors.primaryLight, textAlign: "center", textDecorationLine: "underline" },
  manualInput: { flex: 1, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: borderRadius.md, padding: spacing.md, fontSize: typography.fontSize.md, color: colors.text, borderWidth: 1, borderColor: colors.border },
  manualSubmitBtn: { backgroundColor: colors.primary, borderRadius: borderRadius.md, paddingHorizontal: spacing.xl, justifyContent: "center" },
  manualSubmitText: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.bold, color: colors.text },

  permissionCard: { margin: spacing.xl, padding: spacing.xxl, borderRadius: borderRadius.xl, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  permissionTitle: { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.bold, color: colors.text, textAlign: "center" },
  permissionText: { fontSize: typography.fontSize.sm, color: colors.textSecondary, textAlign: "center", marginTop: spacing.sm, marginBottom: spacing.xl },
  permissionBtn: { backgroundColor: colors.primary, borderRadius: borderRadius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.xxxl },
  permissionBtnText: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.semibold, color: colors.text },
  backBtn: { marginTop: spacing.md, padding: spacing.md },
  backBtnText: { fontSize: typography.fontSize.sm, color: colors.textSecondary, textAlign: "center" },
})
