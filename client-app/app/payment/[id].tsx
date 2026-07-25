import { useState } from "react"
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { ArrowLeft, CreditCard, Banknote, Zap, CheckCircle } from "lucide-react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { api } from "../../src/services/api"
import { GlassCard } from "../../src/components/GlassCard"
import { colors, spacing, borderRadius, typography } from "../../src/theme"

const gateways = [
  { key: "pagopar", label: "Pagopar", icon: Zap, color: "#E53935", desc: "Tarjetas, transferencias" },
  { key: "kuapay", label: "Kuapay", icon: CreditCard, color: "#1E88E5", desc: "Tarjetas de crédito/débito" },
  { key: "spi", label: "Transferencia SPI", icon: Banknote, color: "#43A047", desc: "Transferencia bancaria" },
  { key: "cash", label: "Pago contra entrega", icon: CheckCircle, color: colors.text, desc: "Efectivo al recibir" },
]

export default function PaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [selected, setSelected] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handlePay = async () => {
    if (!selected) return Alert.alert("Seleccioná un método de pago")
    if (selected === "cash") {
      Alert.alert("Listo", "Pagás cuando recibís el pedido")
      router.back()
      return
    }
    setLoading(true)
    try {
      const res = await (api.payments as any)[selected](id!)
      if (res?.redirect_url) {
        // Linking.openURL(res.redirect_url) — would open payment web page
      }
      Alert.alert("Pago iniciado", res?.message || "Procesando pago...")
      router.back()
    } catch (e: any) { Alert.alert("Error", e.message) }
    setLoading(false)
  }

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.back}><ArrowLeft size={22} color={colors.text} /></TouchableOpacity>
      <View style={styles.content}>
        <Text style={styles.header}>Elegí cómo pagar</Text>
        <Text style={styles.sub}>Pedido #{id!.slice(0, 8)}</Text>
        {gateways.map((gw) => {
          const Icon = gw.icon
          return (
            <TouchableOpacity key={gw.key} style={[styles.gwCard, selected === gw.key && styles.gwCardActive]} onPress={() => setSelected(gw.key)}>
              <View style={[styles.iconBox, { backgroundColor: gw.color + "15" }]}>
                <Icon size={22} color={gw.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.gwLabel}>{gw.label}</Text>
                <Text style={styles.gwDesc}>{gw.desc}</Text>
              </View>
              <View style={[styles.radio, selected === gw.key && styles.radioActive]} />
            </TouchableOpacity>
          )
        })}
        <TouchableOpacity style={styles.payBtn} onPress={handlePay} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.payBtnText}>Pagar</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  back: { padding: spacing.lg },
  content: { padding: spacing.lg },
  header: { fontSize: 22, fontWeight: "800", color: colors.text, marginBottom: spacing.xs },
  sub: { ...typography.caption, marginBottom: spacing.xl },
  gwCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1.5, borderColor: colors.border },
  gwCardActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight + "08" },
  iconBox: { width: 44, height: 44, borderRadius: borderRadius.md, alignItems: "center", justifyContent: "center", marginRight: spacing.md },
  gwLabel: { ...typography.body, fontWeight: "600" },
  gwDesc: { ...typography.caption, marginTop: 2 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border, marginLeft: spacing.md },
  radioActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  payBtn: { backgroundColor: colors.primary, borderRadius: borderRadius.lg, paddingVertical: spacing.md, alignItems: "center", marginTop: spacing.xl },
  payBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
})
