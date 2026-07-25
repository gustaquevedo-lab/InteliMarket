import { useState, useEffect } from "react"
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Linking } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { ArrowLeft, MessageCircle } from "lucide-react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { WebView } from "react-native-webview"
import { GlassCard } from "../../src/components/GlassCard"
import { colors, spacing, borderRadius, typography } from "../../src/theme"
import { api } from "../../src/services/api"

export default function WhatsAppChatScreen() {
  const [sellerName, setSellerName] = useState("")
  const [whatsappUrl, setWhatsappUrl] = useState("")
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    api.chat.whatsappUrl().then((res) => {
      setWhatsappUrl(res.url)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const openWhatsApp = () => {
    if (whatsappUrl) Linking.openURL(whatsappUrl)
  }

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.back}><ArrowLeft size={22} color={colors.text} /></TouchableOpacity>
      <Text style={styles.header}>Chatear con tu Vendedor</Text>
      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} /> : (
        <View style={styles.content}>
          <GlassCard style={styles.card}>
            <MessageCircle size={48} color={colors.success} />
            <Text style={styles.title}>Hablar por WhatsApp</Text>
            <Text style={styles.desc}>Conectate directamente con tu vendedor asignado para consultar precios, stock, promociones o hacer tu pedido.</Text>
            <TouchableOpacity style={styles.btn} onPress={openWhatsApp}>
              <MessageCircle size={20} color="#fff" />
              <Text style={styles.btnText}>Abrir WhatsApp</Text>
            </TouchableOpacity>
          </GlassCard>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  back: { padding: spacing.lg },
  header: { fontSize: 22, fontWeight: "800", color: colors.text, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  content: { padding: spacing.lg, alignItems: "center" },
  card: { alignItems: "center", paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg, width: "100%" },
  title: { fontSize: 18, fontWeight: "700", marginTop: spacing.lg, marginBottom: spacing.sm },
  desc: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginBottom: spacing.xl, lineHeight: 20 },
  btn: { flexDirection: "row", alignItems: "center", backgroundColor: colors.success, borderRadius: borderRadius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.xxl, gap: spacing.sm },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
})
