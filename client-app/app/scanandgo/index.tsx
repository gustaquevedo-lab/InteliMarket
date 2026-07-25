import { useState, useEffect, useCallback } from "react"
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
  RefreshControl, Alert, TextInput, Modal, ScrollView,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter, useFocusEffect } from "expo-router"
import { CameraView, useCameraPermissions } from "expo-camera"
import {
  ArrowLeft, ShoppingCart, ScanLine, CreditCard, QrCode,
  Plus, Trash2, CheckCircle, XCircle, AlertTriangle,
} from "lucide-react-native"
import { api } from "../../src/services/api"
import { GlassCard } from "../../src/components/GlassCard"
import { colors, spacing, borderRadius, typography } from "../../src/theme"

export default function ScanAndGoScreen() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [barcode, setBarcode] = useState("")
  const [manualEntry, setManualEntry] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [qrMode, setQrMode] = useState<"barcode" | "loyalty">("barcode")
  const [, requestCameraPermission] = useCameraPermissions()
  const router = useRouter()

  useFocusEffect(useCallback(() => { loadSession() }, []))

  const loadSession = async () => {
    setLoading(true)
    try {
      const active = await api.scanandgo.getActiveSession()
      setSession(active)
    } catch {
      // No active session — normal
      setSession(null)
    }
    setLoading(false)
  }

  const startSession = async () => {
    try {
      const s = await api.scanandgo.createSession()
      setSession(s)
    } catch (e: any) {
      Alert.alert("Error", e.message)
    }
  }

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    setScanning(false)
    if (qrMode === "loyalty") {
      try {
        const s = await api.scanandgo.createSession({ customer_qr: data })
        setSession(s)
        return
      } catch {
        Alert.alert("QR inválido", "No se pudo iniciar sesión con este código")
        return
      }
    }
    try {
      const product = await api.scanandgo.lookupProduct(data)
      if (!session) {
        const s = await api.scanandgo.createSession()
        setSession(s)
        const updated = await api.scanandgo.addItem({ session_id: s.id, product_id: product.id, barcode: data, product_name: product.nombre, unit_price: product.precio_venta, is_weight: product.is_weight })
        setSession(updated)
      } else {
        const updated = await api.scanandgo.addItem({ session_id: session.id, product_id: product.id, barcode: data, product_name: product.nombre, unit_price: product.precio_venta, is_weight: product.is_weight })
        setSession(updated)
      }
    } catch (e: any) {
      Alert.alert("Producto no encontrado", `Código: ${data}`)
    }
  }

  const addManualItem = async () => {
    if (!barcode.trim()) return
    setManualEntry(false)
    try {
      const product = await api.scanandgo.lookupProduct(barcode.trim())
      if (!session) {
        const s = await api.scanandgo.createSession()
        setSession(s)
        const updated = await api.scanandgo.addItem({ session_id: s.id, product_id: product.id, barcode: barcode.trim(), product_name: product.nombre, unit_price: product.precio_venta, is_weight: product.is_weight })
        setSession(updated)
      } else {
        const updated = await api.scanandgo.addItem({ session_id: session.id, product_id: product.id, barcode: barcode.trim(), product_name: product.nombre, unit_price: product.precio_venta, is_weight: product.is_weight })
        setSession(updated)
      }
      setBarcode("")
    } catch {
      Alert.alert("No encontrado", "Producto no encontrado con ese código")
    }
  }

  const removeItem = async (itemId: string) => {
    if (!session) return
    try {
      const updated = await api.scanandgo.removeItem(session.id, itemId)
      setSession(updated)
    } catch {}
  }

  const openCamera = async (mode: "barcode" | "loyalty" = "barcode") => {
    const { granted } = await requestCameraPermission()
    if (!granted) {
      Alert.alert("Permiso requerido", "Se necesita acceso a la cámara para escanear códigos")
      return
    }
    setQrMode(mode)
    setScanning(true)
  }

  const totalAmount = session?.total_amount || 0
  const itemCount = session?.items?.length || 0

  if (loading) return <SafeAreaView style={styles.container}><ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} /></SafeAreaView>

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.back}><ArrowLeft size={22} color={colors.text} /></TouchableOpacity>
      <Text style={styles.header}>Scan&Go</Text>
      <Text style={styles.subtitle}>Escaneá productos mientras comprás</Text>

      {!session ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xl }}>
          <ShoppingCart size={64} color={colors.textMuted} />
          <Text style={styles.emptyText}>Sin sesión activa</Text>
          <Text style={styles.emptySub}>Escané tu QR de fidelización o empezá a comprar</Text>
          <TouchableOpacity style={styles.startBtn} onPress={startSession}>
            <Text style={styles.startBtnText}>Iniciar Compra</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ ...styles.startBtn, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary }} onPress={() => openCamera("loyalty")}>
            <QrCode size={20} color={colors.primary} /><Text style={{ color: colors.primary, fontWeight: "700", fontSize: 16 }}>QR Fidelización</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <GlassCard style={{ margin: spacing.lg, padding: spacing.md }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 14, color: colors.textMuted }}>{itemCount} items</Text>
              <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>Gs {totalAmount.toLocaleString()}</Text>
            </View>
          </GlassCard>

          <FlatList
            data={session.items || []}
            contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, paddingBottom: 120 }}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={<View style={{ alignItems: "center", marginTop: 40 }}><ShoppingCart size={40} color={colors.textMuted} /><Text style={styles.emptyText}>Carrito vacío</Text><Text style={styles.emptySub}>Escané tu primer producto</Text></View>}
            renderItem={({ item }) => (
              <View style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "600", fontSize: 14, color: colors.text }}>{item.product_name || "Producto"}</Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>{item.quantity} × Gs {item.unit_price?.toLocaleString()}</Text>
                  {item.is_weight && <Text style={{ fontSize: 11, color: colors.textMuted }}>{item.weight_kg} kg</Text>}
                </View>
                <Text style={{ fontWeight: "700", fontSize: 14, color: colors.text, marginRight: 8 }}>Gs {item.subtotal?.toLocaleString()}</Text>
                <TouchableOpacity onPress={() => removeItem(item.id)}><Trash2 size={18} color={colors.danger} /></TouchableOpacity>
              </View>
            )}
          />

          <View style={styles.bottomBar}>
            <TouchableOpacity style={styles.scanBtn} onPress={() => openCamera("barcode")}>
              <ScanLine size={20} color="white" /><Text style={styles.scanBtnText}>Escanear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ ...styles.scanBtn, backgroundColor: colors.textMuted }} onPress={() => setManualEntry(true)}>
              <Text style={styles.scanBtnText}>Código</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ ...styles.scanBtn, backgroundColor: colors.success }} onPress={() => setShowPayment(true)}>
              <CreditCard size={20} color="white" /><Text style={styles.scanBtnText}>Pagar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Modal visible={scanning} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: "black" }}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            onBarcodeScanned={handleBarCodeScanned}
          >
            <View style={{ flex: 1, justifyContent: "space-between", padding: spacing.lg }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <TouchableOpacity onPress={() => setScanning(false)} style={{ padding: 8 }}>
                  <XCircle size={28} color="white" />
                </TouchableOpacity>
              </View>
              <View style={{ alignItems: "center" }}>
                <View style={{ width: 250, height: 200, borderWidth: 2, borderColor: "white", borderRadius: 12, opacity: 0.5 }} />
                <Text style={{ color: "white", marginTop: 16, fontSize: 14 }}>
                  {qrMode === "loyalty" ? "Enfocá tu QR de Fidelización" : "Enfocá el código de barras"}
                </Text>
              </View>
              <View style={{ height: 60 }} />
            </View>
          </CameraView>
        </SafeAreaView>
      </Modal>

      <Modal visible={manualEntry} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: spacing.xl }}>
          <GlassCard style={{ padding: spacing.lg }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 12 }}>Ingresar código</Text>
            <TextInput
              value={barcode} onChangeText={setBarcode}
              placeholder="Código de barras"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              autoFocus
              onSubmitEditing={addManualItem}
            />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <TouchableOpacity onPress={() => setManualEntry(false)} style={{ flex: 1, padding: 12, backgroundColor: colors.surface, borderRadius: 12, alignItems: "center" }}>
                <Text style={{ color: colors.textMuted }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={addManualItem} style={{ flex: 1, padding: 12, backgroundColor: colors.primary, borderRadius: 12, alignItems: "center" }}>
                <Text style={{ color: "white", fontWeight: "600" }}>Agregar</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        </View>
      </Modal>

      <PaymentModal visible={showPayment} session={session} onClose={() => setShowPayment(false)} onDone={() => { setShowPayment(false); setSession(null); loadSession() }} />
    </SafeAreaView>
  )
}

function PaymentModal({ visible, session, onClose, onDone }: any) {
  const [loading, setLoading] = useState(false)
  const [usePoints, setUsePoints] = useState(false)
  const [pointsToUse, setPointsToUse] = useState("")
  const [selectedMethod, setSelectedMethod] = useState("")

  const methods = [
    { key: "pagopar", label: "Pagopar QR", icon: QrCode },
    { key: "kuapay", label: "Kuapay QR", icon: QrCode },
    { key: "spi", label: "SPI Transferencia", icon: CreditCard },
    { key: "loyalty", label: "Puntos Lealtad", icon: CheckCircle },
  ]

  const pay = async () => {
    if (!selectedMethod) { Alert.alert("Seleccioná un método de pago"); return }
    setLoading(true)
    try {
      await api.scanandgo.processPayment({
        session_id: session.id,
        method: selectedMethod,
        loyalty_points_used: usePoints ? parseInt(pointsToUse) || 0 : 0,
        gateway_transaction_id: `txn_${Date.now()}`,
      })
      Alert.alert("Pago exitoso", "Tu compra fue procesada", [{ text: "OK", onPress: onDone }])
    } catch (e: any) {
      Alert.alert("Error", e.message)
    }
    setLoading(false)
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
        <GlassCard style={{ padding: spacing.lg, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 4 }}>Pagar</Text>
          <Text style={{ fontSize: 24, fontWeight: "800", color: colors.text, marginBottom: 16 }}>Gs {session?.final_amount?.toLocaleString() || 0}</Text>

          <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 8 }}>Método de pago</Text>
          {methods.map((m) => (
            <TouchableOpacity key={m.key} onPress={() => setSelectedMethod(m.key)}
              style={{ flexDirection: "row", alignItems: "center", padding: 14, backgroundColor: selectedMethod === m.key ? colors.primary + "20" : colors.surface, borderRadius: 12, marginBottom: 8 }}
            >
              <m.icon size={22} color={selectedMethod === m.key ? colors.primary : colors.textMuted} />
              <Text style={{ flex: 1, marginLeft: 12, fontWeight: selectedMethod === m.key ? "700" : "400", color: colors.text }}>{m.label}</Text>
              {selectedMethod === m.key && <CheckCircle size={18} color={colors.primary} />}
            </TouchableOpacity>
          ))}

          <TouchableOpacity onPress={() => setUsePoints(!usePoints)} style={{ flexDirection: "row", alignItems: "center", marginVertical: 8 }}>
            <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: usePoints ? colors.primary : colors.textMuted, backgroundColor: usePoints ? colors.primary : "transparent", marginRight: 8, alignItems: "center", justifyContent: "center" }}>
              {usePoints && <Text style={{ color: "white", fontSize: 12 }}>✓</Text>}
            </View>
            <Text style={{ fontSize: 13, color: colors.text }}>Usar puntos de lealtad</Text>
          </TouchableOpacity>
          {usePoints && (
            <TextInput
              value={pointsToUse} onChangeText={setPointsToUse}
              placeholder="Puntos a canjear"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              style={styles.input}
            />
          )}

          <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
            <TouchableOpacity onPress={onClose} style={{ flex: 1, padding: 14, backgroundColor: colors.surface, borderRadius: 12, alignItems: "center" }}>
              <Text style={{ color: colors.textMuted }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={pay} disabled={loading} style={{ flex: 2, padding: 14, backgroundColor: colors.success, borderRadius: 12, alignItems: "center" }}>
              {loading ? <ActivityIndicator color="white" /> : <Text style={{ color: "white", fontWeight: "700" }}>Pagar Gs {session?.final_amount?.toLocaleString()}</Text>}
            </TouchableOpacity>
          </View>
        </GlassCard>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  back: { position: "absolute", top: 12, left: 16, zIndex: 10, padding: 4 },
  header: { fontSize: 22, fontWeight: "800", color: colors.text, textAlign: "center", marginTop: 8 },
  subtitle: { fontSize: 13, color: colors.textMuted, textAlign: "center", marginBottom: 16 },
  emptyText: { fontSize: 16, fontWeight: "600", color: colors.textMuted, marginTop: 12 },
  emptySub: { fontSize: 13, color: colors.textMuted, marginTop: 4, textAlign: "center" },
  startBtn: { marginTop: 24, paddingVertical: 14, paddingHorizontal: 32, backgroundColor: colors.primary, borderRadius: 14 },
  startBtnText: { color: "white", fontWeight: "700", fontSize: 16 },
  itemRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", gap: 8, padding: spacing.lg, paddingBottom: 24, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border },
  scanBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14, backgroundColor: colors.primary, borderRadius: 14 },
  scanBtnText: { color: "white", fontWeight: "700", fontSize: 14 },
  input: { backgroundColor: colors.surface, borderRadius: 12, padding: 12, fontSize: 16, color: colors.text },
})
