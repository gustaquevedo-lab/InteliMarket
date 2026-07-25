import { useState, useEffect } from "react"
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, Linking } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { ArrowLeft, MapPin, Package, CreditCard, Truck } from "lucide-react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { api } from "../../src/services/api"
import { GlassCard } from "../../src/components/GlassCard"
import { colors, spacing, borderRadius, typography } from "../../src/theme"
import type { Order } from "../../src/types"

const statusSteps = ["pendiente", "en_pago", "pagado", "en_preparacion", "enviado", "entregado"]
const statusLabel: Record<string, string> = {
  pendiente: "Pendiente", en_pago: "En Pago", pagado: "Pagado",
  en_preparacion: "En Preparación", enviado: "Enviado", entregado: "Entregado", cancelado: "Cancelado",
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [order, setOrder] = useState<Order | null>(null)
  const [tracking, setTracking] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    Promise.all([
      api.orders.get(id!),
      api.orders.tracking(id!).catch(() => null),
    ]).then(([o, t]) => {
      setOrder(o); setTracking(t); setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  if (loading) return <SafeAreaView style={styles.container}><ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} /></SafeAreaView>
  if (!order) return <SafeAreaView style={styles.container}><Text>Pedido no encontrado</Text></SafeAreaView>

  const currentStep = statusSteps.indexOf(order.estado)
  const canPay = order.estado === "pendiente" || order.estado === "en_pago"

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.back}><ArrowLeft size={22} color={colors.text} /></TouchableOpacity>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Text style={styles.header}>Pedido #{order.numero || order.id.slice(0, 8)}</Text>
        <Text style={styles.date}>{new Date(order.created_at).toLocaleDateString("es-PY", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</Text>

        {/* Status steps */}
        <GlassCard style={{ marginBottom: spacing.md }}>
          <Text style={styles.sectionTitle}>Estado</Text>
          <View style={styles.steps}>
            {statusSteps.map((s, i) => (
              <View key={s} style={[styles.step, i <= currentStep && styles.stepActive]}>
                <View style={[styles.dot, i <= currentStep && styles.dotActive]} />
                <Text style={[styles.stepLabel, i <= currentStep && styles.stepLabelActive]}>{statusLabel[s]}</Text>
              </View>
            ))}
          </View>
        </GlassCard>

        {/* Tracking */}
        {tracking && (
          <GlassCard style={{ marginBottom: spacing.md }}>
            <Text style={styles.sectionTitle}>Tracking</Text>
            <Text style={styles.trackingText}>Estado: {statusLabel[tracking.estado] || tracking.estado}</Text>
            {tracking.direccion && <Text style={styles.trackingText}>Dirección: {tracking.direccion}</Text>}
          </GlassCard>
        )}

        {/* Items */}
        <GlassCard style={{ marginBottom: spacing.md }}>
          <Text style={styles.sectionTitle}>Productos</Text>
          {order.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Text style={styles.itemName}>{item.descripcion || "Producto"} x{item.cantidad}</Text>
              <Text style={styles.itemTotal}>Gs. {item.total.toLocaleString()}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>Gs. {order.total.toLocaleString()}</Text>
          </View>
        </GlassCard>

        {/* Delivery address */}
        {order.direccion_entrega && (
          <GlassCard style={{ marginBottom: spacing.md }}>
            <Text style={styles.sectionTitle}>Dirección de Entrega</Text>
            <Text style={styles.addressText}>{order.direccion_entrega}</Text>
          </GlassCard>
        )}

        {/* Tracking button */}
        {order.delivery_id && (
          <TouchableOpacity style={[styles.payBtn, { backgroundColor: colors.primary }]} onPress={() => router.push(`/tracking/${order.id}`)}>
            <MapPin size={18} color="#fff" />
            <Text style={styles.payBtnText}>Seguir envío en mapa</Text>
          </TouchableOpacity>
        )}

        {/* Pay button */}
        {canPay && (
          <TouchableOpacity style={styles.payBtn} onPress={() => router.push(`/payment/${order.id}`)}>
            <CreditCard size={18} color="#fff" />
            <Text style={styles.payBtnText}>Pagar ahora</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  back: { padding: spacing.lg },
  header: { fontSize: 22, fontWeight: "800", color: colors.text, marginBottom: spacing.xs },
  date: { ...typography.caption, marginBottom: spacing.lg },
  sectionTitle: { ...typography.body, fontWeight: "700", marginBottom: spacing.md },
  steps: { gap: spacing.md },
  step: { flexDirection: "row", alignItems: "center", gap: spacing.md, opacity: 0.4 },
  stepActive: { opacity: 1 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.primary },
  stepLabel: { fontSize: 12, color: colors.textMuted },
  stepLabelActive: { color: colors.text, fontWeight: "600" },
  trackingText: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xs },
  itemRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  itemName: { ...typography.body, flex: 1 },
  itemTotal: { fontWeight: "600" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.md },
  totalLabel: { ...typography.body, fontWeight: "700" },
  totalValue: { fontSize: 18, fontWeight: "800", color: colors.primary },
  addressText: { ...typography.body, color: colors.textSecondary },
  payBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: colors.success, borderRadius: borderRadius.lg, padding: spacing.md, gap: spacing.sm, marginTop: spacing.md },
  payBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
})
