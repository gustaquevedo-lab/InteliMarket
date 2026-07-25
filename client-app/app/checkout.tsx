import { useState, useEffect } from "react"
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from "react-native"
import { useRouter } from "expo-router"
import { ArrowLeft, MapPin, Percent, CheckCircle, XCircle } from "lucide-react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { api } from "../src/services/api"
import { useClientStore } from "../src/stores/clientStore"
import { GlassCard } from "../src/components/GlassCard"
import { colors, spacing, borderRadius, typography } from "../src/theme"

export default function CheckoutScreen() {
  const [address, setAddress] = useState("")
  const [observations, setObservations] = useState("")
  const [loading, setLoading] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState("contado")
  const [couponCode, setCouponCode] = useState("")
  const [couponValid, setCouponValid] = useState<boolean | null>(null)
  const [couponInfo, setCouponInfo] = useState<any>(null)
  const [validatingCoupon, setValidatingCoupon] = useState(false)
  const cart = useClientStore((s) => s.cart)
  const clearCart = useClientStore((s) => s.cart.clearCart)
  const router = useRouter()

  const validateCoupon = async () => {
    if (!couponCode.trim()) return
    setValidatingCoupon(true)
    try {
      const promo = await api.promotions.validate(couponCode.trim())
      setCouponValid(true)
      setCouponInfo(promo)
    } catch {
      setCouponValid(false)
      setCouponInfo(null)
    }
    setValidatingCoupon(false)
  }

  const handleCheckout = async () => {
    if (!address) return Alert.alert("Error", "Indicá una dirección de entrega")
    setLoading(true)
    try {
      const payload: any = {
        direccion_entrega: address,
        observaciones: observations,
        condicion: paymentMethod,
      }
      if (couponCode.trim()) payload.codigo_cupon = couponCode.trim()
      const order = await api.cart.checkout(payload)
      clearCart()
      router.replace(`/order/${order.id}`)
    } catch (e: any) { Alert.alert("Error", e.message) }
    setLoading(false)
  }

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.back}><ArrowLeft size={22} color={colors.text} /></TouchableOpacity>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Text style={styles.header}>Confirmar Pedido</Text>
        <GlassCard style={{ marginBottom: spacing.md }}>
          <Text style={styles.sectionTitle}>Resumen</Text>
          <Text style={styles.summaryText}>{cart.itemCount} productos</Text>
          <Text style={styles.summaryTotal}>Total: Gs. {cart.total.toLocaleString()}</Text>
        </GlassCard>
        <GlassCard style={{ marginBottom: spacing.md }}>
          <Text style={styles.sectionTitle}>Dirección de Entrega</Text>
          <TextInput style={styles.input} placeholder="Dirección" value={address} onChangeText={setAddress} multiline />
        </GlassCard>
        <GlassCard style={{ marginBottom: spacing.md }}>
          <Text style={styles.sectionTitle}>Condición de Pago</Text>
          {[
            { key: "contado", label: "Contado" },
            { key: "credito", label: "Crédito" },
          ].map((opt) => (
            <TouchableOpacity key={opt.key} style={styles.payOption} onPress={() => setPaymentMethod(opt.key)}>
              <View style={[styles.radio, paymentMethod === opt.key && styles.radioActive]} />
              <Text style={styles.payLabel}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </GlassCard>
        {/* Coupon */}
        <GlassCard style={{ marginBottom: spacing.md }}>
          <Text style={styles.sectionTitle}>Cupón de Descuento</Text>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholder="Código de cupón" value={couponCode} onChangeText={(t) => { setCouponCode(t); setCouponValid(null); setCouponInfo(null) }} />
            <TouchableOpacity style={styles.couponBtn} onPress={validateCoupon} disabled={validatingCoupon || !couponCode.trim()}>
              {validatingCoupon ? <ActivityIndicator size="small" color="#fff" /> : <Percent size={16} color="#fff" />}
            </TouchableOpacity>
          </View>
          {couponValid === true && couponInfo && (
            <Text style={{ color: colors.success, fontSize: 12, marginTop: spacing.sm }}>
              <CheckCircle size={12} /> {couponInfo.nombre} — {couponInfo.tipo === "porcentaje" ? `${couponInfo.valor}% off` : `Gs. ${couponInfo.valor} off`}
            </Text>
          )}
          {couponValid === false && (
            <Text style={{ color: colors.danger, fontSize: 12, marginTop: spacing.sm }}><XCircle size={12} /> Cupón inválido o expirado</Text>
          )}
        </GlassCard>

        <TextInput style={styles.input} placeholder="Observaciones (opcional)" value={observations} onChangeText={setObservations} />
        <TouchableOpacity style={styles.btn} onPress={handleCheckout} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Confirmar Pedido</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  back: { padding: spacing.lg },
  header: { fontSize: 22, fontWeight: "800", color: colors.text, marginBottom: spacing.lg },
  sectionTitle: { ...typography.body, fontWeight: "700", marginBottom: spacing.md },
  summaryText: { ...typography.body, color: colors.textSecondary },
  summaryTotal: { fontSize: 18, fontWeight: "700", color: colors.primary, marginTop: spacing.sm },
  input: { backgroundColor: colors.surfaceAlt, borderRadius: borderRadius.md, padding: spacing.md, fontSize: 14, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  payOption: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, gap: spacing.md },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border },
  radioActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  payLabel: { ...typography.body },
  couponBtn: { backgroundColor: colors.primary, borderRadius: borderRadius.md, padding: spacing.md, justifyContent: "center", alignItems: "center" },
  btn: { backgroundColor: colors.primary, borderRadius: borderRadius.lg, padding: spacing.md, alignItems: "center", marginTop: spacing.lg },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
})
