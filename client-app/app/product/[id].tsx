import { useState, useEffect } from "react"
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { ShoppingCart, Heart, ArrowLeft, Minus, Plus } from "lucide-react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { api } from "../../src/services/api"
import { useClientStore } from "../../src/stores/clientStore"
import { GlassCard } from "../../src/components/GlassCard"
import { colors, spacing, borderRadius, typography } from "../../src/theme"
import type { Product } from "../../src/types"

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [product, setProduct] = useState<Product | null>(null)
  const [qty, setQty] = useState(1)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const setCart = useClientStore((s) => s.cart.setCart)

  useEffect(() => {
    api.catalog.products({ search: "", limit: 1 }).then((prods) => {
      setProduct(prods.find((p: Product) => p.id === id) || null)
      setLoading(false)
    })
  }, [id])

  const addToCart = async () => {
    if (!product) return
    try {
      const cart = await api.cart.addItem({ product_id: product.id, cantidad: qty, precio_unitario: product.precio, descripcion: product.nombre })
      setCart(cart.items, cart.total)
      router.back()
    } catch {}
  }

  if (loading) return <SafeAreaView style={styles.container}><ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} /></SafeAreaView>
  if (!product) return <SafeAreaView style={styles.container}><Text>Producto no encontrado</Text></SafeAreaView>

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.back}><ArrowLeft size={22} color={colors.text} /></TouchableOpacity>
      <View style={styles.content}>
        <View style={styles.imagePlaceholder}>
          <ShoppingCart size={48} color={colors.textMuted} />
        </View>
        <Text style={styles.name}>{product.nombre}</Text>
        {product.descripcion && <Text style={styles.desc}>{product.descripcion}</Text>}
        <Text style={styles.price}>Gs. {product.precio.toLocaleString()}</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoText}>Stock: {product.stock_disponible} und</Text>
          <Text style={styles.infoText}>IVA: {product.iva_tasa}%</Text>
        </View>
        <View style={styles.qtyRow}>
          <Text style={styles.qtyLabel}>Cantidad:</Text>
          <TouchableOpacity style={styles.qtyBtn} onPress={() => setQty(Math.max(1, qty - 1))}><Minus size={16} color={colors.text} /></TouchableOpacity>
          <Text style={styles.qtyValue}>{qty}</Text>
          <TouchableOpacity style={styles.qtyBtn} onPress={() => setQty(qty + 1)}><Plus size={16} color={colors.text} /></TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={addToCart}>
          <ShoppingCart size={18} color="#fff" />
          <Text style={styles.addText}>Agregar al Carrito — Gs. {(product.precio * qty).toLocaleString()}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  back: { padding: spacing.lg },
  content: { padding: spacing.lg, alignItems: "center" },
  imagePlaceholder: { width: 200, height: 200, borderRadius: borderRadius.xl, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center", marginBottom: spacing.xl },
  name: { fontSize: 20, fontWeight: "700", textAlign: "center", marginBottom: spacing.sm },
  desc: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginBottom: spacing.lg },
  price: { fontSize: 28, fontWeight: "800", color: colors.primary, marginBottom: spacing.md },
  infoRow: { flexDirection: "row", gap: spacing.xl, marginBottom: spacing.xl },
  infoText: { ...typography.caption },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.xl },
  qtyLabel: { ...typography.body, fontWeight: "600" },
  qtyBtn: { width: 36, height: 36, borderRadius: borderRadius.sm, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" },
  qtyValue: { fontSize: 18, fontWeight: "700", minWidth: 30, textAlign: "center" },
  addBtn: { flexDirection: "row", alignItems: "center", backgroundColor: colors.primary, borderRadius: borderRadius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.xxl, gap: spacing.md },
  addText: { color: "#fff", fontWeight: "600", fontSize: 15 },
})
