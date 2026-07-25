import React, { useState, useCallback } from "react"
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert, Platform } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import Animated, { FadeInUp } from "react-native-reanimated"
import { LinearGradient } from "expo-linear-gradient"
import { BlurView } from "expo-blur"
import * as ImagePicker from "expo-image-picker"
import { colors, spacing, borderRadius, typography } from "../../src/theme"
import { GlassCard, GlassCardSimple } from "../../src/components/GlassCard"
import { SignaturePad } from "../../src/components/SignaturePad"
import { BarcodeScanner } from "../../src/components/BarcodeScanner"
import { useDriverStore } from "../../src/stores/driverStore"
import { api } from "../../src/services/api"

export default function DeliveryScreen() {
  const { stopId } = useLocalSearchParams<{ stopId: string }>()
  const store = useDriverStore()

  const stop = store.currentStops.find((s) => s.id === stopId)
  const delivery = store.deliveries.find((d) => d.id === stop?.delivery_id)

  const [step, setStep] = useState<"info" | "scan" | "photo" | "sign" | "pin" | "complete">("info")
  const [pinInput, setPinInput] = useState("")
  const [signature, setSignature] = useState<string | null>(null)
  const [fotoAntes, setFotoAntes] = useState<string | null>(null)
  const [fotoDespues, setFotoDespues] = useState<string | null>(null)
  const [notas, setNotas] = useState("")
  const [loading, setLoading] = useState(false)
  const [barcodeScanned, setBarcodeScanned] = useState<string | null>(null)
  const [showScanner, setShowScanner] = useState(false)

  const takePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== "granted") { Alert.alert("Permiso denegado", "Necesitamos acceso a la cámara"); return }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
    })

    if (!result.canceled && result.assets[0]) {
      return result.assets[0].base64 || result.assets[0].uri
    }
    return null
  }, [])

  const handleComplete = useCallback(async () => {
    if (!stop || !delivery) return
    setLoading(true)

    try {
      const proofData: any = {
        delivery_id: delivery.id,
        observaciones: notas,
      }
      if (barcodeScanned) proofData.codigo_barras = barcodeScanned
      if (fotoAntes) proofData.foto_antes_url = fotoAntes
      if (fotoDespues) proofData.foto_despues_url = fotoDespues
      if (signature) proofData.firma_url = signature
      if (pinInput) proofData.pin_confirmado = pinInput

      await api.proofs.add(delivery.id, proofData)
      await api.deliveries.updateStatus(delivery.id, "delivered", { delivered_at: new Date().toISOString() })

      store.updateStopStatus(stop.id, "completed", {
        result: "delivered",
        notas,
        fotos_url: [fotoAntes, fotoDespues].filter(Boolean) as string[],
        firma_url: signature,
      })

      store.setDeliveries(
        store.deliveries.map((d) =>
          d.id === delivery.id ? { ...d, status: "delivered", delivered_at: new Date().toISOString() } : d
        )
      )

      Alert.alert("✅ Entrega completada", "Todo en orden", [
        { text: "Volver", onPress: () => router.back() },
      ])
    } catch (e: any) {
      Alert.alert("Error", e.message || "No se pudo completar la entrega")
    } finally {
      setLoading(false)
    }
  }, [stop, delivery, notas, fotoAntes, fotoDespues, signature, pinInput, store])

  const handleIncident = () => {
    router.push("/incident/new")
  }

  if (!stop || !delivery) {
    return (
      <LinearGradient colors={colors.gradientBg} style={styles.container}>
        <Text style={styles.errorTitle}>Parada no encontrada</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Volver</Text>
        </TouchableOpacity>
      </LinearGradient>
    )
  }

  if (step === "complete") {
    return (
      <LinearGradient colors={colors.gradientBg} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Animated.View entering={FadeInUp.duration(400).springify()}>
            <Text style={styles.stepEmoji}>✅</Text>
            <Text style={styles.stepTitle}>Resumen de entrega</Text>

            <GlassCard style={{ marginBottom: spacing.lg }}>
              <Text style={styles.detailLabel}>Cliente</Text>
              <Text style={styles.detailValue}>{delivery.customer_name}</Text>
              <Text style={styles.detailLabel}>Dirección</Text>
              <Text style={styles.detailValue}>{delivery.customer_address}</Text>
              <Text style={styles.detailLabel}>Monto</Text>
              <Text style={[styles.detailValue, { color: colors.success }]}>Gs. {delivery.total_amount.toLocaleString()}</Text>
              {notas ? <><Text style={styles.detailLabel}>Notas</Text><Text style={styles.detailValue}>{notas}</Text></> : null}
            </GlassCard>

            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {barcodeScanned && <Text style={styles.photoBadge}>📦 Escaneo ✓</Text>}
              {fotoAntes && <Text style={styles.photoBadge}>📷 Foto antes ✓</Text>}
              {fotoDespues && <Text style={styles.photoBadge}>📷 Foto después ✓</Text>}
              {signature && <Text style={styles.photoBadge}>✍️ Firma ✓</Text>}
              {pinInput && <Text style={styles.photoBadge}>🔐 PIN ✓</Text>}
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, loading && { opacity: 0.5 }]}
              onPress={handleComplete}
              disabled={loading}
            >
              <Text style={styles.primaryBtnText}>{loading ? "Procesando..." : "✅ Confirmar entrega"}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep("info")}>
              <Text style={styles.secondaryBtnText}>Volver a editar</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </LinearGradient>
    )
  }

  return (
    <LinearGradient colors={colors.gradientBg} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Animated.View entering={FadeInUp.duration(400).springify()}>
          <Text style={styles.stepEmoji}>
            {step === "info" ? "📋" : step === "scan" ? "📷" : step === "photo" ? "📸" : step === "sign" ? "✍️" : "🔐"}
          </Text>
          <Text style={styles.stepTitle}>
            {step === "info" ? "Información de entrega" :
             step === "photo" ? "Foto de la entrega" :
             step === "sign" ? "Firma digital" :
             step === "pin" ? "Código de confirmación" :
             "Escanear paquete"}
          </Text>

          {/* Step indicator */}
          <View style={styles.stepsRow}>
            {["info", "scan", "photo", "sign", "pin"].map((s, i) => (
              <TouchableOpacity
                key={s}
                style={[styles.stepDot, step === s && styles.stepDotActive, i < ["info", "scan", "photo", "sign", "pin"].indexOf(step) && styles.stepDotDone]}
                onPress={() => setStep(s as any)}
              >
                <Text style={[styles.stepDotText, step === s && styles.stepDotTextActive]}>
                  {i < ["info", "scan", "photo", "sign", "pin"].indexOf(step) ? "✓" : i + 1}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {step === "info" && (
            <>
              <GlassCard style={{ marginBottom: spacing.lg }}>
                <Text style={styles.customerName}>{delivery.customer_name}</Text>
                <Text style={styles.customerDetail}>📍 {delivery.customer_address}</Text>
                {delivery.customer_phone && <Text style={styles.customerDetail}>📞 {delivery.customer_phone}</Text>}
                <View style={styles.divider} />
                <Text style={styles.detailLabel}>Productos</Text>
                <Text style={styles.detailValue}>{delivery.package_desc || `${delivery.package_count} paquete(s)`}</Text>
                <Text style={styles.detailLabel}>Monto a cobrar</Text>
                <Text style={[styles.detailValue, { color: colors.success, fontSize: typography.fontSize.xl }]}>
                  Gs. {delivery.total_amount.toLocaleString()}
                </Text>
                {delivery.delivery_window_start && (
                  <>
                    <Text style={styles.detailLabel}>Ventana horaria</Text>
                    <Text style={styles.detailValue}>
                      {new Date(delivery.delivery_window_start).toLocaleTimeString()} - {new Date(delivery.delivery_window_end!).toLocaleTimeString()}
                    </Text>
                  </>
                )}
              </GlassCard>

              <TextInput
                style={styles.textArea}
                placeholder="Notas de la entrega..."
                placeholderTextColor={colors.textTertiary}
                value={notas}
                onChangeText={setNotas}
                multiline
                numberOfLines={3}
              />

              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <TouchableOpacity
                  style={[styles.primaryBtn, { flex: 2 }]}
                  onPress={() => setStep("scan")}
                >
                  <Text style={styles.primaryBtnText}>✅ Completar entrega</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primaryBtn, { flex: 1, backgroundColor: "transparent", borderWidth: 1, borderColor: colors.error }]} onPress={handleIncident}>
                  <Text style={[styles.primaryBtnText, { color: colors.error }]}>⚠️</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {showScanner && (
            <View style={{ position: "absolute", top: -spacing.xl, left: -spacing.xl, right: -spacing.xl, bottom: -100, zIndex: 100 }}>
              <BarcodeScanner
                onScan={(code) => {
                  setBarcodeScanned(code)
                  setShowScanner(false)
                  setStep("photo")
                }}
                onClose={() => setShowScanner(false)}
                expectedBarcode={delivery.package_desc?.match(/\d{8,}/)?.[0] || undefined}
                packageDesc={delivery.package_desc || undefined}
              />
            </View>
          )}

          {step === "scan" && !showScanner && (
            <>
              {barcodeScanned ? (
                <GlassCardSimple
                  gradient={colors.gradientSuccess}
                  style={{ alignItems: "center", padding: spacing.xxl, marginBottom: spacing.lg }}
                >
                  <Text style={{ fontSize: 48, marginBottom: spacing.sm }}>✅</Text>
                  <Text style={{ fontSize: typography.fontSize.md, color: colors.text, fontFamily: typography.fontFamily.bold, textAlign: "center" }}>
                    Paquete verificado
                  </Text>
                  <Text style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xs }}>
                    Código: {barcodeScanned}
                  </Text>
                </GlassCardSimple>
              ) : (
                <GlassCardSimple style={{ alignItems: "center", padding: spacing.xxl, marginBottom: spacing.lg }}>
                  <Text style={{ fontSize: 56, marginBottom: spacing.md }}>📦</Text>
                  <Text style={{ fontSize: typography.fontSize.md, color: colors.text, fontFamily: typography.fontFamily.medium, textAlign: "center" }}>
                    Escaneá el código de barras del paquete
                  </Text>
                  <Text style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, textAlign: "center", marginTop: spacing.sm }}>
                    Verificación de carga para {delivery.customer_name}
                  </Text>
                </GlassCardSimple>
              )}

              <TouchableOpacity
                style={[styles.primaryBtn, { flexDirection: "row", gap: spacing.sm, justifyContent: "center" }]}
                onPress={() => setShowScanner(true)}
              >
                <Text style={{ fontSize: 20 }}>📷</Text>
                <Text style={styles.primaryBtnText}>
                  {barcodeScanned ? "✅ Escaneado — Siguiente" : "Escanear código de barras"}
                </Text>
              </TouchableOpacity>

              {!barcodeScanned && (
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.border }]}
                  onPress={() => setStep("photo")}
                >
                  <Text style={[styles.primaryBtnText, { color: colors.textSecondary }]}>Saltar escaneo</Text>
                </TouchableOpacity>
              )}

              {barcodeScanned && (
                <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep("photo")}>
                  <Text style={styles.primaryBtnText}>Siguiente: Fotos</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {step === "photo" && (
            <>
              <GlassCardSimple style={{ marginBottom: spacing.lg }}>
                <Text style={styles.sectionLabel}>Foto antes de entregar</Text>
                <TouchableOpacity style={styles.photoBtn} onPress={async () => {
                  const photo = await takePhoto()
                  if (photo) setFotoAntes(photo)
                }}>
                  <Text style={styles.photoBtnText}>{fotoAntes ? "📸 Foto tomada ✓" : "📷 Tomar foto antes"}</Text>
                </TouchableOpacity>
              </GlassCardSimple>

              <GlassCardSimple style={{ marginBottom: spacing.lg }}>
                <Text style={styles.sectionLabel}>Foto después de entregar</Text>
                <TouchableOpacity style={styles.photoBtn} onPress={async () => {
                  const photo = await takePhoto()
                  if (photo) setFotoDespues(photo)
                }}>
                  <Text style={styles.photoBtnText}>{fotoDespues ? "📸 Foto tomada ✓" : "📷 Tomar foto después"}</Text>
                </TouchableOpacity>
              </GlassCardSimple>

              <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep("sign")}>
                <Text style={styles.primaryBtnText}>Siguiente: Firma</Text>
              </TouchableOpacity>
            </>
          )}

          {step === "sign" && (
            <>
              <SignaturePad
                onSave={(base64) => { setSignature(base64) }}
                onClear={() => setSignature(null)}
              />
              <TouchableOpacity
                style={[styles.primaryBtn, !signature && { opacity: 0.5 }]}
                onPress={() => setStep("pin")}
                disabled={!signature}
              >
                <Text style={styles.primaryBtnText}>Siguiente: PIN</Text>
              </TouchableOpacity>
            </>
          )}

          {step === "pin" && (
            <>
              <GlassCardSimple style={{ alignItems: "center", padding: spacing.xxl, marginBottom: spacing.lg }}>
                <Text style={{ fontSize: 48, marginBottom: spacing.md }}>🔐</Text>
                <Text style={{ fontSize: typography.fontSize.md, color: colors.text, fontFamily: typography.fontFamily.medium, textAlign: "center" }}>
                  Pedile al cliente el código de confirmación
                </Text>
                <Text style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xs }}>
                  El código está en el detalle del pedido (4 dígitos)
                </Text>
              </GlassCardSimple>
              <TextInput
                style={styles.pinInput}
                placeholder="PIN de 4 dígitos"
                placeholderTextColor={colors.textTertiary}
                value={pinInput}
                onChangeText={setPinInput}
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
              />
              <TouchableOpacity
                style={[styles.primaryBtn, (!pinInput || pinInput.length < 4) && { opacity: 0.5 }]}
                onPress={() => setStep("complete")}
                disabled={!pinInput || pinInput.length < 4}
              >
                <Text style={styles.primaryBtnText}>Revisar y confirmar</Text>
              </TouchableOpacity>
            </>
          )}

          {step !== "info" && (
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep("info")}>
              <Text style={styles.secondaryBtnText}>Cancelar</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: spacing.xl, paddingBottom: 100 },
  stepEmoji: { fontSize: 48, textAlign: "center", marginBottom: spacing.md },
  stepTitle: { fontSize: typography.fontSize.xl, fontFamily: typography.fontFamily.bold, color: colors.text, textAlign: "center", marginBottom: spacing.xl },
  errorTitle: { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.bold, color: colors.error, textAlign: "center", marginTop: 200 },
  backBtn: { marginTop: spacing.lg, padding: spacing.lg, borderRadius: borderRadius.md, backgroundColor: colors.primary, alignItems: "center" },
  backBtnText: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.semibold, color: colors.text },

  stepsRow: { flexDirection: "row", justifyContent: "center", gap: spacing.md, marginBottom: spacing.xl },
  stepDot: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  stepDotActive: { backgroundColor: colors.primary },
  stepDotDone: { backgroundColor: colors.success },
  stepDotText: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.bold, color: colors.textTertiary },
  stepDotTextActive: { color: colors.text },

  customerName: { fontSize: typography.fontSize.xl, fontFamily: typography.fontFamily.bold, color: colors.text, marginBottom: spacing.xs },
  customerDetail: { fontSize: typography.fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },

  detailLabel: { fontSize: typography.fontSize.xs, color: colors.textTertiary, fontFamily: typography.fontFamily.medium, marginTop: spacing.sm, textTransform: "uppercase" },
  detailValue: { fontSize: typography.fontSize.md, color: colors.text, fontFamily: typography.fontFamily.semibold, marginTop: 2 },

  textArea: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: borderRadius.md, padding: spacing.md, fontSize: typography.fontSize.sm, color: colors.text, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg, minHeight: 80, textAlignVertical: "top" },

  sectionLabel: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.semibold, color: colors.textSecondary, marginBottom: spacing.sm },

  photoBtn: { padding: spacing.lg, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, borderStyle: "dashed", alignItems: "center" },
  photoBtnText: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium, color: colors.primary },

  pinInput: { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: borderRadius.md, padding: spacing.lg, fontSize: 32, color: colors.text, textAlign: "center", letterSpacing: 12, marginBottom: spacing.lg, fontFamily: typography.fontFamily.mono },

  photoBadge: { fontSize: typography.fontSize.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.sm, backgroundColor: "rgba(34,197,94,0.15)", color: colors.success, fontFamily: typography.fontFamily.medium, overflow: "hidden" as const },

  primaryBtn: { padding: spacing.lg, borderRadius: borderRadius.md, backgroundColor: colors.primary, alignItems: "center", marginTop: spacing.lg },
  primaryBtnText: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.semibold, color: colors.text },
  secondaryBtn: { padding: spacing.md, borderRadius: borderRadius.md, alignItems: "center", marginTop: spacing.md },
  secondaryBtnText: { fontSize: typography.fontSize.sm, color: colors.textSecondary },
})
