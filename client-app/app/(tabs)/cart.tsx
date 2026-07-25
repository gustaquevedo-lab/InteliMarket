import { useState, useEffect, useCallback } from "react"
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native"
import { Minus, Plus, Trash2, ArrowRight } from "lucide-react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter, useFocusEffect } from "expo-router"
import { api } from "../../src/services/api"
import { useClientStore } from "../../src/stores/clientStore"
import { GlassCard } from "../../src/components/GlassCard"
import { colors, spacing, borderRadius, typography } from "../../src/theme"
import type { CartItem } from "../../src/types"

export default function CartScreen() {
  const [items, setItems] = useState<CartItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const setCartStore = useClientStore((s) => s.cart.setCart)
  const clearCartStore = useClientStore((s) => s.cart.clearCart)

  useFocusEffect(useCallback(() => { loadCart() }, []))

  const loadCart = async () => {
    setLoading(true)
    try {
      const cart = await api.cart.get()
      setItems(cart.items)
      setTotal(cart.total)
      setCartStore(cart.items, cart.total)
    } catch { setItems([]); setTotal(0) }
    setLoading(false)
  }

  const updateQty = async (itemId: string, newQty: number) => {
    if (newQty <= 0) { await api.cart.removeItem(itemId); loadCart(); return }
    await api.cart.updateItem(itemId, { cantidad: newQty })
    loadCart()
  }

  const removeItem = async (itemId: string) => {
    await api.cart.removeItem(itemId)
    loadCart()
  }

  const handleCheckout = () => {
    router.push("/checkout")
  }

  if (loading) return <SafeAreaView style={styles.container}><ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} /></SafeAreaView>

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Carrito</Text>
      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <ShoppingCart size={48} color={colors.textMuted} />
          <Text style={styles.emptyText}>Carrito vacío</Text>
          <TouchableOpacity style={styles.browseBtn} onPress={() => router.push("/(tabs)/catalog")}>
            <Text style={styles.browseBtnText}>Ver catálogo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={items} contentContainerStyle={{ padding: spacing.lg }}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <GlassCard style={styles.itemCard}>
                <View style={styles.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{item.descripcion || "Producto"}</Text>
                    <Text style={styles.itemPrice}>Gs. {item.precio_unitario.toLocaleString()}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeItem(item.id)}>
                    <Trash2 size={16} color={colors.danger} />
                  </TouchableOpacity>
                </View>
                <View style={styles.qtyRow}>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.id, item.cantidad - 1)}><Minus size={14} color={colors.text} /></TouchableOpacity>
                  <Text style={styles.qtyText}>{item.cantidad}</Text>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.id, item.cantidad + 1)}><Plus size={14} color={colors.text} /></TouchableOpacity>
                  <Text style={styles.subtotal}>Gs. {(item.cantidad * item.precio_unitario).toLocaleString()}</Text>
                </View>
              </GlassCard>
            )}
          />
          <View style={styles.footer}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>Gs. {total.toLocaleString()}</Text>
            <TouchableOpacity style={styles.checkoutBtn} onPress={handleCheckout}>
              <Text style={styles.checkoutText}>Continuar</Text>
              <ArrowRight size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  )
}

import { ShoppingCart } from "lucide-react-native"

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { fontSize: 24, fontWeight: "800", color: colors.text, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { ...typography.body, color: colors.textMuted, marginTop: spacing.md },
  browseBtn: { backgroundColor: colors.primary, borderRadius: borderRadius.md, padding: spacing.md, marginTop: spacing.lg },
  browseBtnText: { color: "#fff", fontWeight: "600" },
  itemCard: { marginBottom: spacing.md },
  itemRow: { flexDirection: "row", alignItems: "flex-start" },
  itemName: { ...typography.body, fontWeight: "600", flex: 1 },
  itemPrice: { ...typography.caption, color: colors.primary, marginTop: spacing.xs },
  qtyRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.md, gap: spacing.sm },
  qtyBtn: { width: 32, height: 32, borderRadius: borderRadius.sm, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" },
  qtyText: { fontSize: 15, fontWeight: "600", minWidth: 24, textAlign: "center" },
  subtotal: { marginLeft: "auto", fontWeight: "700", fontSize: 14, color: colors.text },
  footer: { flexDirection: "row", alignItems: "center", padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  totalLabel: { ...typography.body, fontWeight: "600" },
  totalValue: { fontSize: 18, fontWeight: "800", color: colors.primary, marginLeft: spacing.sm, flex: 1 },
  checkoutBtn: { flexDirection: "row", alignItems: "center", backgroundColor: colors.primary, borderRadius: borderRadius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, gap: spacing.sm },
  checkoutText: { color: "#fff", fontWeight: "600" },
})
