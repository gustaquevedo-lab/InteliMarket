import { useState, useCallback } from "react"
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from "react-native"
import { User, MapPin, Heart, Gift, LogOut, MessageCircle, CreditCard, ChevronRight, Star, ShoppingCart, Percent } from "lucide-react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter, useFocusEffect } from "expo-router"
import { api } from "../../src/services/api"
import { useClientStore } from "../../src/stores/clientStore"
import { GlassCard } from "../../src/components/GlassCard"
import { colors, spacing, borderRadius, typography } from "../../src/theme"
import * as SecureStore from "expo-secure-store"

export default function ProfileScreen() {
  const [account, setAccount] = useState<any>(null)
  const [loyalty, setLoyalty] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const logout = useClientStore((s) => s.logout)
  const clientUser = useClientStore((s) => s.clientUser)

  useFocusEffect(useCallback(() => {
    setLoading(true)
    Promise.all([
      api.account.me().then(setAccount).catch(() => {}),
      api.loyalty.get().then(setLoyalty).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, []))

  const handleLogout = () => {
    Alert.alert("Cerrar sesión", "¿Estás seguro?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Salir", style: "destructive", onPress: async () => {
        await SecureStore.deleteItemAsync("client_token")
        logout()
        router.replace("/")
      }},
    ])
  }

  const MenuItem = ({ icon: Icon, label, onPress, color = colors.text, right }: any) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <Icon size={20} color={color} />
      <Text style={[styles.menuLabel, { flex: 1, marginLeft: spacing.md }]}>{label}</Text>
      {right || <ChevronRight size={16} color={colors.textMuted} />}
    </TouchableOpacity>
  )

  if (loading) return <SafeAreaView style={styles.container}><ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} /></SafeAreaView>

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}>
        <Text style={styles.header}>Mi Cuenta</Text>

        {/* Profile card */}
        <GlassCard style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(account?.nombre || "U").charAt(0)}</Text>
          </View>
          <Text style={styles.name}>{account?.nombre || clientUser?.nombre || "Cargando..."}</Text>
          <Text style={styles.email}>{account?.email || ""}</Text>
        </GlassCard>

        {/* Credit card */}
        <GlassCard style={styles.creditCard}>
          <CreditCard size={20} color={colors.success} />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={styles.creditLabel}>Crédito Disponible</Text>
            <Text style={styles.creditValue}>Gs. {(account?.credito_disponible || 0).toLocaleString()}</Text>
          </View>
          <Text style={styles.limit}>Límite: Gs. {(account?.credito_limite || 0).toLocaleString()}</Text>
        </GlassCard>

        {/* Loyalty card */}
        {loyalty && (
          <GlassCard style={styles.loyaltyCard}>
            <Star size={20} color={colors.warning} fill={colors.warning} />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={styles.loyaltyLabel}>Mis Puntos</Text>
              <Text style={styles.loyaltyPoints}>{loyalty.balance} pts</Text>
            </View>
            <Text style={styles.pointsEarned}>+{loyalty.total_earned || 0} ganados</Text>
          </GlassCard>
        )}

        {/* Menu */}
        <View style={styles.menu}>
          <MenuItem icon={MapPin} label="Mis Direcciones" onPress={() => router.push("/addresses")} />
          <MenuItem icon={Heart} label="Favoritos" onPress={() => router.push("/(tabs)/catalog")} />
          <MenuItem icon={Gift} label="Promociones" onPress={() => router.push("/promotions")} color={colors.warning} />
          <MenuItem
            icon={ShoppingCart} label="Puntos de Fidelidad"
            onPress={() => router.push("/loyalty")}
            color={colors.secondary}
            right={<Text style={styles.pointsBadge}>{loyalty?.balance || 0} pts</Text>}
          />
          <MenuItem icon={MessageCircle} label="Chatear con vendedor" onPress={() => router.push("/chat")} color={colors.success} />
          <MenuItem icon={LogOut} label="Cerrar sesión" onPress={handleLogout} color={colors.danger} />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { fontSize: 24, fontWeight: "800", color: colors.text, marginBottom: spacing.lg },
  profileCard: { alignItems: "center", paddingVertical: spacing.xxl, marginBottom: spacing.md },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  avatarText: { fontSize: 24, fontWeight: "700", color: "#fff" },
  name: { fontWeight: "700", fontSize: 18, marginBottom: spacing.xs },
  email: { ...typography.caption },
  creditCard: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md },
  creditLabel: { ...typography.caption },
  creditValue: { fontSize: 18, fontWeight: "800", color: colors.success, marginTop: 2 },
  limit: { ...typography.caption, textAlign: "right" },
  loyaltyCard: { flexDirection: "row", alignItems: "center", marginBottom: spacing.lg, borderColor: colors.warning + "30", borderWidth: 1 },
  loyaltyLabel: { ...typography.caption },
  loyaltyPoints: { fontSize: 18, fontWeight: "800", color: colors.warning, marginTop: 2 },
  pointsEarned: { ...typography.caption, color: colors.warning },
  menu: { gap: spacing.sm },
  menuItem: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.md },
  menuLabel: { ...typography.body },
  pointsBadge: { backgroundColor: colors.secondaryLight || "#ccfbf1", paddingHorizontal: 8, paddingVertical: 2, borderRadius: borderRadius.full, fontSize: 12, fontWeight: "700", color: colors.secondary },
})
