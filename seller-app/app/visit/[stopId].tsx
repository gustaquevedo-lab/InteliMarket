import React, { useState, useEffect, useRef } from "react"
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  Platform,
} from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { router, useLocalSearchParams } from "expo-router"
import Animated, { FadeInUp, ZoomIn } from "react-native-reanimated"
import * as Haptics from "expo-haptics"
import * as Location from "expo-location"
import { colors, borderRadius, spacing, typography } from "../../src/theme"
import { GlassCard, GlassCardSimple } from "../../src/components/GlassCard"
import { SignaturePad } from "../../src/components/SignaturePad"
import { useAppStore } from "../../src/stores/appStore"
import { api } from "../../src/services/api"
import { getDistanceBetween } from "../../src/services/location"
import { enqueueOperation } from "../../src/services/sync"

const RESULTS = [
  { key: "order_taken", icon: "📝", label: "Pedido tomado", color: colors.success },
  { key: "payment_collected", icon: "💵", label: "Cobranza realizada", color: colors.success },
  { key: "delivery", icon: "📦", label: "Entrega", color: colors.primary },
  { key: "no_answer", icon: "🔇", label: "Sin respuesta", color: colors.warning },
  { key: "rescheduled", icon: "📅", label: "Reprogramada", color: colors.warning },
  { key: "no_sale", icon: "❌", label: "Sin venta", color: colors.textTertiary },
  { key: "visit_only", icon: "👋", label: "Solo visita", color: colors.primaryLight },
]

export default function VisitScreen() {
  const { stopId } = useLocalSearchParams<{ stopId: string }>()
  const { currentStops, setCurrentStops, currentRoute, profile } = useAppStore()

  const [stop, setStop] = useState<any>(null)
  const [step, setStep] = useState<"checkin" | "visit" | "checkout">("checkin")
  const [result, setResult] = useState("")
  const [orderAmount, setOrderAmount] = useState("")
  const [paymentCollected, setPaymentCollected] = useState("")
  const [rating, setRating] = useState(0)
  const [notas, setNotas] = useState("")
  const [signature, setSignature] = useState<string | null>(null)
  const [proximity, setProximity] = useState<number | null>(null)
  const [isNearby, setIsNearby] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const s = currentStops.find((s) => s.id === stopId)
    setStop(s)
    if (s?.status === "in_progress") setStep("visit")
    if (s?.status === "completed") {
      setStep("checkout")
      setResult(s.result || "")
      setOrderAmount(String(s.order_amount || ""))
      setPaymentCollected(String(s.payment_collected || ""))
      setRating(s.customer_rating || 0)
      setNotas(s.notas || "")
    }
    checkProximity()
  }, [stopId])

  const checkProximity = async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      if (stop?.customer_lat && stop?.customer_lng) {
        const dist = getDistanceBetween(
          loc.coords.latitude, loc.coords.longitude,
          stop.customer_lat, stop.customer_lng
        )
        setProximity(Math.round(dist))
        setIsNearby(dist <= 100)
      }
    } catch {}
  }

  const handleCheckin = async () => {
    setSaving(true)
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      const dist = stop?.customer_lat && stop?.customer_lng
        ? Math.round(getDistanceBetween(loc.coords.latitude, loc.coords.longitude, stop.customer_lat, stop.customer_lng))
        : 0

      await enqueueOperation({
        type: "visit_complete",
        payload: {
          stop_id: stopId,
          data: {
            status: "in_progress",
            actual_arrival: new Date().toISOString(),
            checkin_lat: loc.coords.latitude,
            checkin_lng: loc.coords.longitude,
            distance_from_customer_meters: dist,
          },
        },
      })

      // Update local state
      const updated = currentStops.map((s) =>
        s.id === stopId ? { ...s, status: "in_progress", actual_arrival: new Date().toISOString() } : s
      )
      setCurrentStops(updated)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setStep("visit")
    } catch (e: any) {
      Alert.alert("Error", e.message || "No se pudo registrar el check-in")
    }
    setSaving(false)
  }

  const handleCheckout = async () => {
    if (!result) {
      Alert.alert("Resultado requerido", "Seleccioná el resultado de la visita")
      return
    }
    setSaving(true)
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })

      const data: any = {
        status: "completed",
        result,
        order_amount: parseFloat(orderAmount) || 0,
        products_count: parseFloat(orderAmount) > 0 ? 1 : 0,
        payment_collected: parseFloat(paymentCollected) || 0,
        actual_departure: new Date().toISOString(),
        checkout_lat: loc.coords.latitude,
        checkout_lng: loc.coords.longitude,
        customer_rating: rating || null,
        notas: notas || null,
      }

      await enqueueOperation({
        type: "visit_complete",
        payload: { stop_id: stopId, data },
      })

      // Update local state
      const updated = currentStops.map((s) =>
        s.id === stopId ? { ...s, status: "completed", result, order_amount: parseFloat(orderAmount) || 0, customer_rating: rating } : s
      )
      setCurrentStops(updated)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      Alert.alert("✅ Visita completada", "Los datos se sincronizarán cuando tengas conexión.", [
        { text: "Volver", onPress: () => router.back() },
      ])
    } catch (e: any) {
      Alert.alert("Error", e.message || "No se pudo completar la visita")
    }
    setSaving(false)
  }

  if (!stop) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: colors.textSecondary }}>Cargando visita...</Text>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <LinearGradient colors={step === "checkout" ? colors.gradientSuccess : colors.gradientPrimary}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.customerName}>{stop.customer_name || "Cliente"}</Text>
        <Text style={styles.customerAddress}>{stop.customer_address || ""}</Text>
        {proximity !== null && (
          <View style={styles.proximityBar}>
            <Text style={styles.proximityText}>
              {isNearby ? "✅ Estás cerca del cliente" : `📍 A ${proximity}m del cliente — ${isNearby ? "✅" : "❌"}`}
            </Text>
          </View>
        )}
      </LinearGradient>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        {/* Step indicator */}
        <View style={styles.steps}>
          <View style={[styles.stepDot, step === "checkin" || step === "visit" || step === "checkout" ? styles.stepActive : null]}>
            <Text style={styles.stepIcon}>✅</Text>
          </View>
          <View style={[styles.stepLine, step === "visit" || step === "checkout" ? styles.stepLineActive : null]} />
          <View style={[styles.stepDot, step === "visit" || step === "checkout" ? styles.stepActive : null]}>
            <Text style={styles.stepIcon}>{step === "checkout" ? "✅" : "📝"}</Text>
          </View>
          <View style={[styles.stepLine, step === "checkout" ? styles.stepLineActive : null]} />
          <View style={[styles.stepDot, step === "checkout" ? styles.stepActive : null]}>
            <Text style={styles.stepIcon}>🏁</Text>
          </View>
        </View>
        <View style={styles.stepLabels}>
          <Text style={styles.stepLabel}>Check-in</Text>
          <Text style={styles.stepLabel}>Visita</Text>
          <Text style={styles.stepLabel}>Salida</Text>
        </View>

        {/* Check-in step */}
        {step === "checkin" && (
          <Animated.View entering={FadeInUp.duration(400)} style={{ gap: spacing.lg, marginTop: spacing.xl }}>
            <GlassCard intensity={25} gradient={colors.gradientPrimary}>
              <View style={{ alignItems: "center", gap: spacing.md, paddingVertical: spacing.lg }}>
                <Text style={{ fontSize: 48 }}>📍</Text>
                <Text style={{ color: colors.text, fontFamily: typography.fontFamily.bold, fontSize: typography.fontSize.lg, textAlign: "center" }}>
                  ¿Listo para visitar a {stop.customer_name || "este cliente"}?
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: typography.fontSize.sm, textAlign: "center" }}>
                  {proximity !== null
                    ? `Estás a ${proximity}m del cliente`
                    : "Verificando tu ubicación..."}
                </Text>
              </View>
            </GlassCard>
            <TouchableOpacity onPress={handleCheckin} disabled={saving} style={[styles.bigBtn, { backgroundColor: colors.primary }]}>
              <Text style={styles.bigBtnText}>{saving ? "Registrando..." : "✅ Iniciar visita"}</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Visit step */}
        {step === "visit" && (
          <Animated.View entering={FadeInUp.duration(400)} style={{ gap: spacing.lg, marginTop: spacing.xl }}>
            {/* Result selection */}
            <Text style={styles.sectionLabel}>Resultado de la visita</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {RESULTS.map((r) => (
                <TouchableOpacity key={r.key} onPress={() => { setResult(r.key); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) }}
                  style={[styles.resultChip, result === r.key && { backgroundColor: `${r.color}20`, borderColor: r.color }]}>
                  <Text style={{ fontSize: 18 }}>{r.icon}</Text>
                  <Text style={[styles.resultLabel, result === r.key && { color: r.color }]}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Amount fields */}
            <GlassCardSimple>
              <View style={{ gap: spacing.md }}>
                <View>
                  <Text style={styles.fieldLabel}>💰 Monto del pedido (Gs.)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor={colors.textTertiary}
                    value={orderAmount}
                    onChangeText={setOrderAmount}
                    keyboardType="numeric"
                  />
                </View>
                <View>
                  <Text style={styles.fieldLabel}>💵 Cobranza realizada (Gs.)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor={colors.textTertiary}
                    value={paymentCollected}
                    onChangeText={setPaymentCollected}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </GlassCardSimple>

            {/* Rating */}
            <GlassCardSimple>
              <Text style={styles.fieldLabel}>⭐ Calificación del cliente</Text>
              <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity key={star} onPress={() => setRating(star)}>
                    <Text style={{ fontSize: 32, opacity: rating >= star ? 1 : 0.3 }}>⭐</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </GlassCardSimple>

            {/* Notes */}
            <GlassCardSimple>
              <Text style={styles.fieldLabel}>📝 Notas</Text>
              <TextInput
                style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
                placeholder="Agregar notas de la visita..."
                placeholderTextColor={colors.textTertiary}
                value={notas}
                onChangeText={setNotas}
                multiline
              />
            </GlassCardSimple>

            {/* Signature */}
            <SignaturePad
              onSave={(sig) => setSignature(sig)}
              onClear={() => setSignature(null)}
            />

            {/* Complete visit */}
            <TouchableOpacity
              onPress={handleCheckout}
              disabled={saving || !result}
              style={[styles.bigBtn, { backgroundColor: result ? colors.success : colors.textTertiary }]}
            >
              <Text style={styles.bigBtnText}>{saving ? "Guardando..." : "✅ Finalizar visita"}</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Checkout / Summary */}
        {step === "checkout" && (
          <Animated.View entering={ZoomIn.duration(400)} style={{ gap: spacing.lg, marginTop: spacing.xl }}>
            <GlassCard intensity={30} gradient={colors.gradientSuccess}>
              <View style={{ alignItems: "center", gap: spacing.md, paddingVertical: spacing.xl }}>
                <Text style={{ fontSize: 64 }}>🎉</Text>
                <Text style={{ color: colors.text, fontFamily: typography.fontFamily.bold, fontSize: typography.fontSize.xl }}>
                  Visita completada
                </Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Resultado:</Text>
                  <Text style={styles.summaryValue}>{RESULTS.find((r) => r.key === result)?.label || result}</Text>
                </View>
                {orderAmount && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Pedido:</Text>
                    <Text style={styles.summaryValue}>Gs. {parseFloat(orderAmount).toLocaleString()}</Text>
                  </View>
                )}
                {paymentCollected && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Cobrado:</Text>
                    <Text style={styles.summaryValue}>Gs. {parseFloat(paymentCollected).toLocaleString()}</Text>
                  </View>
                )}
                {rating > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Rating:</Text>
                    <Text style={styles.summaryValue}>{"⭐".repeat(rating)}</Text>
                  </View>
                )}
              </View>
            </GlassCard>
            <TouchableOpacity onPress={() => router.back()} style={[styles.bigBtn, { backgroundColor: colors.primary }]}>
              <Text style={styles.bigBtnText}>Volver a la ruta</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 50,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  backBtn: {
    marginBottom: spacing.md,
  },
  backText: {
    fontSize: typography.fontSize.md,
    color: "rgba(255,255,255,0.8)",
    fontFamily: typography.fontFamily.medium,
  },
  customerName: {
    fontSize: typography.fontSize.xxl,
    fontFamily: typography.fontFamily.bold,
    color: colors.text,
  },
  customerAddress: {
    fontSize: typography.fontSize.sm,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },
  proximityBar: {
    marginTop: spacing.md,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  proximityText: {
    fontSize: typography.fontSize.xs,
    color: colors.text,
    fontFamily: typography.fontFamily.medium,
  },
  steps: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  stepDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepActive: {
    borderColor: colors.primary,
    backgroundColor: "rgba(99,102,241,0.2)",
  },
  stepIcon: {
    fontSize: 16,
  },
  stepLine: {
    width: 60,
    height: 2,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginHorizontal: spacing.sm,
  },
  stepLineActive: {
    backgroundColor: colors.primary,
  },
  stepLabels: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 70,
    marginBottom: spacing.lg,
  },
  stepLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    fontFamily: typography.fontFamily.medium,
  },
  sectionLabel: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semibold,
    color: colors.text,
  },
  resultChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  resultLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.medium,
  },
  fieldLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.medium,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
    color: colors.text,
  },
  bigBtn: {
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: "center",
  },
  bigBtnText: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    color: colors.text,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: spacing.lg,
  },
  summaryLabel: {
    fontSize: typography.fontSize.sm,
    color: "rgba(255,255,255,0.7)",
  },
  summaryValue: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.bold,
    color: colors.text,
  },
})
