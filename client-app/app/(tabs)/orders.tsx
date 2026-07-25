import { useState, useCallback } from "react"
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from "react-native"
import { Package, Repeat, MapPin, ChevronRight } from "lucide-react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter, useFocusEffect } from "expo-router"
import { api } from "../../src/services/api"
import { GlassCard } from "../../src/components/GlassCard"
import { colors, spacing, borderRadius, typography } from "../../src/theme"
import type { Order } from "../../src/types"

export default function OrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const router = useRouter()

  useFocusEffect(useCallback(() => { loadOrders() }, []))

  const loadOrders = async () => {
    try {
      const data = await api.orders.list(50, 0)
      setOrders(data)
    } catch {}
    setLoading(false); setRefreshing(false)
  }

  const handleRepeat = async (orderId: string) => {
    try {
      const cart = await api.orders.repeat(orderId)
      router.push("/(tabs)/cart")
    } catch {}
  }

  const statusColor: Record<string, string> = {
    pendiente: colors.warning, en_pago: colors.primaryLight,
    pagado: colors.success, en_preparacion: colors.primary,
    enviado: colors.secondary, entregado: colors.success,
    cancelado: colors.danger,
  }

  if (loading) return <SafeAreaView style={styles.container}><ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} /></SafeAreaView>

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Mis Pedidos</Text>
      <FlatList
        data={orders} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadOrders() }} />}
        ListEmptyComponent={<View style={{ alignItems: "center", marginTop: 40 }}><Package size={48} color={colors.textMuted} /><Text style={styles.emptyText}>Sin pedidos aún</Text></View>}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => router.push(`/order/${item.id}`)}>
            <GlassCard style={styles.card}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderNum}>#{item.numero || item.id.slice(0, 8)}</Text>
                  <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString("es-PY")}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: (statusColor[item.estado] || colors.textMuted) + "20" }]}>
                  <Text style={[styles.badgeText, { color: statusColor[item.estado] || colors.textMuted }]}>{item.estado}</Text>
                </View>
              </View>
              <View style={styles.row}>
                <Text style={styles.total}>Gs. {item.total.toLocaleString()}</Text>
                <View style={{ flexDirection: "row", gap: spacing.xs }}>
                  {(item.estado === "enviado" || item.estado === "entregado") && item.delivery_id && (
                    <TouchableOpacity onPress={() => router.push(`/tracking/${item.id}`)} style={styles.repeatBtn}>
                      <MapPin size={14} color={colors.success} />
                      <Text style={[styles.repeatText, { color: colors.success }]}>Tracking</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => handleRepeat(item.id)} style={styles.repeatBtn}>
                    <Repeat size={14} color={colors.primary} />
                    <Text style={styles.repeatText}>Repetir</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </GlassCard>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { fontSize: 24, fontWeight: "800", color: colors.text, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  emptyText: { ...typography.body, color: colors.textMuted, marginTop: spacing.md },
  card: { marginBottom: spacing.md },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  orderNum: { ...typography.body, fontWeight: "700" },
  date: { ...typography.caption, marginTop: 2 },
  badge: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.full },
  badgeText: { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
  total: { fontSize: 16, fontWeight: "700", color: colors.text },
  repeatBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, padding: spacing.sm },
  repeatText: { fontSize: 12, color: colors.primary, fontWeight: "600" },
})
