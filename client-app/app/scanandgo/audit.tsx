import { useState, useEffect } from "react"
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Modal } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter, useLocalSearchParams } from "expo-router"
import { ArrowLeft, Camera, CheckCircle, XCircle, AlertTriangle, ScanLine } from "lucide-react-native"
import { CameraView, useCameraPermissions } from "expo-camera"
import { api } from "../../src/services/api"
import { GlassCard } from "../../src/components/GlassCard"
import { colors, spacing, borderRadius, typography } from "../../src/theme"

export default function AuditScreen() {
  const { auditId } = useLocalSearchParams<{ auditId: string }>()
  const [audit, setAudit] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [currentCheck, setCurrentCheck] = useState<any>(null)
  const [checkedItems, setCheckedItems] = useState<any[]>([])
  const [resolved, setResolved] = useState(false)
  const [, requestCameraPermission] = useCameraPermissions()
  const router = useRouter()

  useEffect(() => { loadAudit() }, [])

  const loadAudit = async () => {
    try {
      const pending = await api.scanandgo.getPendingAudits()
      const a = pending.find((p: any) => p.id === auditId) || pending[0]
      setAudit(a)
      if (a?.items_to_check) setCurrentCheck(a.items_to_check[0])
    } catch {}
    setLoading(false)
  }

  const openCamera = async () => {
    const { granted } = await requestCameraPermission()
    if (!granted) {
      Alert.alert("Permiso requerido", "Se necesita acceso a la cámara")
      return
    }
    setScanning(true)
  }

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    setScanning(false)
    const match = currentCheck
    if (!match) return
    if (data === match.barcode) {
      const updated = await api.scanandgo.checkAudit({ audit_id: audit.id, product_id: match.product_id, scanned_barcode: data, match: true })
      setCheckedItems([...checkedItems, { ...match, status: "ok" }])
      const remaining = (audit.items_to_check || []).filter((i: any) => i.product_id !== match.product_id)
      if (remaining.length > 0) {
        setCurrentCheck(remaining[0])
        setAudit({ ...audit, items_to_check: remaining })
      } else {
        Alert.alert("Auditoría completa", "Todos los items verificados", [
          { text: "OK", onPress: () => finishAudit() },
        ])
      }
    } else {
      Alert.alert("No coincide", "El código escaneado no coincide", [
        { text: "Reintentar", onPress: () => {} },
        { text: "Reportar", onPress: () => reportMismatch() },
      ])
    }
  }

  const reportMismatch = async () => {
    try {
      await api.scanandgo.checkAudit({ audit_id: audit.id, product_id: currentCheck?.product_id, scanned_barcode: "MISMATCH", match: false })
      setCheckedItems([...checkedItems, { ...currentCheck, status: "mismatch" }])
      const remaining = (audit.items_to_check || []).filter((i: any) => i.product_id !== currentCheck?.product_id)
      if (remaining.length > 0) {
        setCurrentCheck(remaining[0])
        setAudit({ ...audit, items_to_check: remaining })
      } else {
        Alert.alert("Auditoría finalizada", "Discrepancias reportadas")
        finishAudit()
      }
    } catch {}
  }

  const finishAudit = async () => {
    try {
      await api.scanandgo.resolveAudit({ audit_id: audit.id, status: checkedItems.some(i => i.status === "mismatch") ? "discrepancy" : "verified", checked_items: checkedItems })
      setResolved(true)
    } catch {}
  }

  if (loading) return <SafeAreaView style={styles.container}><ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} /></SafeAreaView>

  if (resolved) return (
    <SafeAreaView style={styles.container}>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xl }}>
        <CheckCircle size={64} color={colors.success} />
        <Text style={styles.title}>Auditoría finalizada</Text>
        <Text style={styles.sub}>Gracias por tu cooperación</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.replace("/scanandgo")}>
          <Text style={styles.btnText}>Volver</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.back}><ArrowLeft size={22} color={colors.text} /></TouchableOpacity>
      <Text style={styles.header}>Verificación de Auditoría</Text>

      <View style={{ padding: spacing.lg }}>
        <GlassCard style={{ padding: spacing.md, marginBottom: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={20} color={colors.warning} />
            <Text style={{ fontSize: 14, color: colors.text, flex: 1 }}>
              Has sido seleccionado para una auditoría aleatoria. Escaneá {audit?.items_to_check?.length || 0} producto(s) para verificar.
            </Text>
          </View>
        </GlassCard>

        {currentCheck && (
          <GlassCard style={{ padding: spacing.lg, marginBottom: 16, alignItems: "center" }}>
            <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 4 }}>Producto a verificar</Text>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 4 }}>{currentCheck.product_name}</Text>
            <Text style={{ fontSize: 14, color: colors.textMuted, marginBottom: 16 }}>Código: {currentCheck.barcode}</Text>

            <TouchableOpacity style={styles.scanBtn} onPress={openCamera}>
              <ScanLine size={22} color="white" /><Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>Escanear producto</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={reportMismatch} style={{ marginTop: 12 }}>
              <Text style={{ color: colors.danger, fontSize: 13 }}>No coincide → Reportar</Text>
            </TouchableOpacity>
          </GlassCard>
        )}

        {checkedItems.length > 0 && (
          <View>
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: 8 }}>Verificados</Text>
            {checkedItems.map((item, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 8 }}>
                {item.status === "ok" ? <CheckCircle size={18} color={colors.success} /> : <XCircle size={18} color={colors.danger} />}
                <Text style={{ flex: 1, fontSize: 14, color: colors.text }}>{item.product_name}</Text>
                <Text style={{ fontSize: 12, color: item.status === "ok" ? colors.success : colors.danger }}>
                  {item.status === "ok" ? "Coincide" : "No coincide"}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <Modal visible={scanning} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: "black" }}>
          <CameraView style={{ flex: 1 }} facing="back" onBarcodeScanned={handleBarCodeScanned}>
            <View style={{ flex: 1, justifyContent: "space-between", padding: spacing.lg }}>
              <TouchableOpacity onPress={() => setScanning(false)} style={{ alignSelf: "flex-end", padding: 8 }}>
                <XCircle size={28} color="white" />
              </TouchableOpacity>
              <View style={{ alignItems: "center" }}>
                <View style={{ width: 250, height: 200, borderWidth: 2, borderColor: "white", borderRadius: 12, opacity: 0.5 }} />
                <Text style={{ color: "white", marginTop: 16, fontSize: 14 }}>Escaneá el código de barras</Text>
              </View>
              <View style={{ height: 60 }} />
            </View>
          </CameraView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  back: { position: "absolute", top: 12, left: 16, zIndex: 10, padding: 4 },
  header: { fontSize: 22, fontWeight: "800", color: colors.text, textAlign: "center", marginTop: 8 },
  title: { fontSize: 20, fontWeight: "700", color: colors.text, marginTop: 16 },
  sub: { fontSize: 14, color: colors.textMuted, marginTop: 4, textAlign: "center" },
  btn: { marginTop: 24, paddingVertical: 14, paddingHorizontal: 32, backgroundColor: colors.primary, borderRadius: 14 },
  btnText: { color: "white", fontWeight: "700" },
  scanBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 14, paddingHorizontal: 24, backgroundColor: colors.primary, borderRadius: 14 },
})
