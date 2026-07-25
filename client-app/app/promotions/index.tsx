import { useState, useCallback } from "react"
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Alert } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter, useFocusEffect } from "expo-router"
import { ArrowLeft, Gift, Percent, ShoppingCart, Zap, Tag } from "lucide-react-native"
import { api } from "../../src/services/api"
import { GlassCard } from "../../src/components/GlassCard"
import { colors, spacing, borderRadius, typography } from "../../src/theme"

const tipoIcons: Record<string, any> = {
  porcentaje: Percent, monto_fijo: Tag, dos_por_uno: Zap,
  combo_precio: ShoppingCart, cantidad_lleva: Gift,
}

export default function PromotionsScreen() {
  const [promotions, setPromotions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const router = useRouter()

  useFocusEffect(useCallback(() => { loadPromos() }, []))

  const loadPromos = async () => {
    try {
      const promos = await api.promotions.list()
      setPromotions(promos)
    } catch {}
    setLoading(false); setRefreshing(false)
  }

  const tipoLabel: Record<string, string> = {
    porcentaje: "% Descuento", monto_fijo: "Gs. Descuento",
    dos_por_uno: "2x1", combo_precio: "Precio Combo",
    cantidad_lleva: "Lleva XX paga YY",
  }

  if (loading) return <SafeAreaView style={styles.container}><ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} /></SafeAreaView>

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.back}><ArrowLeft size={22} color={colors.text} /></TouchableOpacity>
      <Text style={styles.header}>Promociones</Text>
      <FlatList
        data={promotions} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadPromos() }} />}
        ListEmptyComponent={<View style={{ alignItems: "center", marginTop: 40 }}><Gift size={48} color={colors.textMuted} /><Text style={styles.empty}>Sin promociones activas</Text></View>}
        renderItem={({ item }) => {
          const Icon = tipoIcons[item.tipo] || Gift
          return (
            <GlassCard style={styles.card}>
              <View style={styles.row}>
                <View style={styles.iconBox}><Icon size={22} color={colors.primary} /></View>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={styles.title}>{item.nombre}</Text>
                  {item.descripcion && <Text style={styles.desc}>{item.descripcion}</Text>}
                  <View style={styles.badgeRow}>
                    <Text style={styles.badge}>{tipoLabel[item.tipo] || item.tipo}</Text>
                    {item.valido_hasta && (
                      <Text style={styles.expiry}>Vence: {new Date(item.valido_hasta).toLocaleDateString("es-PY")}</Text>
                    )}
                  </View>
                </View>
              </View>
              {item.codigo_cupon && (
                <View style={styles.couponRow}>
                  <Text style={styles.couponLabel}>Cupón: </Text>
                  <Text style={styles.couponCode}>{item.codigo_cupon}</Text>
                </View>
              )}
            </GlassCard>
          )
        }}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  back: { padding: spacing.lg },
  header: { fontSize: 22, fontWeight: "800", color: colors.text, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  empty: { ...typography.body, color: colors.textMuted, marginTop: spacing.md },
  card: { marginBottom: spacing.md },
  row: { flexDirection: "row", alignItems: "flex-start" },
  iconBox: { width: 42, height: 42, borderRadius: borderRadius.md, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  title: { ...typography.body, fontWeight: "700" },
  desc: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  badgeRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  badge: { fontSize: 10, paddingHorizontal: 8, paddingVertical: 2, borderRadius: borderRadius.full, backgroundColor: colors.primaryLight, color: colors.primary, fontWeight: "600" },
  expiry: { fontSize: 10, color: colors.textMuted },
  couponRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.sm, backgroundColor: colors.warningLight || "#fef3c7", borderRadius: borderRadius.sm, padding: spacing.sm },
  couponLabel: { fontSize: 11, color: colors.warning },
  couponCode: { fontSize: 13, fontWeight: "700", color: colors.warning, letterSpacing: 1 },
})
