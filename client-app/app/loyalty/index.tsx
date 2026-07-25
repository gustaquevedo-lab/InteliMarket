import { useState, useEffect } from "react"
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, RefreshControl } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { ArrowLeft, Star, Gift, ShoppingCart, Zap } from "lucide-react-native"
import { api } from "../../src/services/api"
import { GlassCard } from "../../src/components/GlassCard"
import { colors, spacing, borderRadius, typography } from "../../src/theme"

export default function LoyaltyScreen() {
  const [loyalty, setLoyalty] = useState<any>(null)
  const [rewards, setRewards] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [redeeming, setRedeeming] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    Promise.all([
      api.loyalty.get().then(setLoyalty).catch(() => {}),
      api.loyalty.rewards().then(setRewards).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  const handleRedeem = async (reward: any) => {
    Alert.alert(
      "Canjear Puntos",
      `¿Canjear ${reward.puntos} puntos por "${reward.nombre}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Canjear", onPress: async () => {
          setRedeeming(reward.id)
          try {
            const res = await api.loyalty.redeem(reward.puntos, reward.nombre)
            if (res.success) {
              Alert.alert("✅ Canje exitoso", `Canjeaste ${reward.puntos} puntos por "${reward.nombre}"`)
              const updated = await api.loyalty.get()
              setLoyalty(updated)
            }
          } catch (e: any) { Alert.alert("Error", e.message) }
          setRedeeming(null)
        }},
      ]
    )
  }

  const rewardIcons: Record<string, any> = {
    descuento: Zap, envio_gratis: ShoppingCart, producto_gratis: Gift,
  }

  if (loading) return <SafeAreaView style={styles.container}><ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} /></SafeAreaView>

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.back}><ArrowLeft size={22} color={colors.text} /></TouchableOpacity>
      {/* Points summary */}
      <GlassCard style={styles.summaryCard}>
        <Star size={28} color={colors.warning} fill={colors.warning} />
        <Text style={styles.pointsTitle}>Tus Puntos de Fidelidad</Text>
        <Text style={styles.pointsValue}>{loyalty?.balance || 0}</Text>
        <Text style={styles.pointsSub}>Acumulados: {loyalty?.total_earned || 0} · Canjeados: {loyalty?.total_redeemed || 0}</Text>
        <Text style={styles.pointsHint}>Ganá 1 punto por cada Gs. 1.000 en compras</Text>
      </GlassCard>

      <Text style={styles.sectionTitle}>Recompensas Disponibles</Text>
      <FlatList
        data={rewards} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>Sin recompensas disponibles</Text>}
        renderItem={({ item }) => {
          const Icon = rewardIcons[item.tipo] || Gift
          const canAfford = (loyalty?.balance || 0) >= item.puntos
          return (
            <TouchableOpacity disabled={!canAfford} onPress={() => handleRedeem(item)}>
              <GlassCard style={[styles.rewardCard, !canAfford && styles.disabledCard]}>
                <View style={styles.rewardIcon}>
                  <Icon size={22} color={canAfford ? colors.warning : colors.textMuted} />
                </View>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={[styles.rewardName, !canAfford && styles.disabledText]}>{item.nombre}</Text>
                  <Text style={styles.rewardPts}>{item.puntos} pts</Text>
                </View>
                {redeeming === item.id ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : canAfford ? (
                  <Text style={styles.redeemBtn}>Canjear</Text>
                ) : (
                  <Text style={styles.lockedBtn}>🔒</Text>
                )}
              </GlassCard>
            </TouchableOpacity>
          )
        }}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  back: { padding: spacing.lg },
  summaryCard: { alignItems: "center", marginHorizontal: spacing.lg, paddingVertical: spacing.xl, marginBottom: spacing.md },
  pointsTitle: { ...typography.body, color: colors.textSecondary, marginTop: spacing.md },
  pointsValue: { fontSize: 42, fontWeight: "800", color: colors.warning, marginTop: spacing.sm },
  pointsSub: { ...typography.caption, marginTop: spacing.sm },
  pointsHint: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: 20 },
  rewardCard: { flexDirection: "row", alignItems: "center", marginBottom: spacing.sm },
  disabledCard: { opacity: 0.5 },
  disabledText: { opacity: 0.6 },
  rewardIcon: { width: 42, height: 42, borderRadius: borderRadius.md, backgroundColor: colors.warningLight || "#fef3c7", alignItems: "center", justifyContent: "center" },
  rewardName: { ...typography.body, fontWeight: "600" },
  rewardPts: { fontSize: 13, color: colors.warning, fontWeight: "700", marginTop: 2 },
  redeemBtn: { fontSize: 12, fontWeight: "700", color: colors.primary },
  lockedBtn: { fontSize: 16 },
})
