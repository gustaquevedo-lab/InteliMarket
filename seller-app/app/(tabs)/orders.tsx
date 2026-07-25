import React, { useEffect, useState } from "react"
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import Animated, { FadeInUp } from "react-native-reanimated"
import { colors, borderRadius, spacing, typography } from "../../src/theme"
import { GlassCard, GlassCardSimple } from "../../src/components/GlassCard"
import { useAppStore } from "../../src/stores/appStore"
import { api } from "../../src/services/api"
import { getCachedProducts, cacheProducts } from "../../src/services/storage"
import type { Product, OrderItem } from "../../src/types"

const { width: SCREEN_WIDTH } = Dimensions.get("window")
const CARD_WIDTH = (SCREEN_WIDTH - 60) / 2

export default function OrdersScreen() {
  const { user, cartItems, addToCart, removeFromCart, clearCart, selectedCustomer, cartTotal, setCartTotal } = useAppStore()
  const companyId = user?.company_id || "00000000-0000-0000-0000-000000000010"

  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>("all")

  useEffect(() => {
    loadProducts()
  }, [])

  useEffect(() => {
    const total = cartItems.reduce((sum, item) => sum + item.subtotal, 0)
    setCartTotal(total)
  }, [cartItems])

  const loadProducts = async () => {
    setLoading(true)
    try {
      // Try cache first
      const cached = await getCachedProducts()
      if (cached.length > 0) {
        setProducts(cached)
        setLoading(false)
        // Refresh in background
        api.products.list(companyId).then((fresh) => {
          if (fresh) { setProducts(fresh); cacheProducts(fresh) }
        }).catch(() => {})
        return
      }
      const data = await api.products.list(companyId)
      if (data) {
        setProducts(data)
        await cacheProducts(data)
      }
    } catch {}
    setLoading(false)
  }

  const categories = [...new Set(products.map((p) => p.category_name || "Sin categoría"))]
  const filtered = products.filter((p) => {
    if (selectedCategory !== "all" && p.category_name !== selectedCategory) return false
    if (search && !p.nombre.toLowerCase().includes(search.toLowerCase()) && !p.sku?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const handleAddProduct = (product: Product) => {
    const item: OrderItem = {
      product_id: product.id,
      product_name: product.nombre,
      sku: product.sku,
      cantidad: 1,
      precio_unitario: product.precio_venta,
      descuento_pct: 0,
      subtotal: product.precio_venta,
    }
    addToCart(item)
  }

  const cartCount = cartItems.reduce((sum, i) => sum + i.cantidad, 0)
  const CartBadge = cartCount > 0 ? (
    <View style={styles.cartBadge}>
      <Text style={styles.cartBadgeText}>{cartCount}</Text>
    </View>
  ) : null

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <LinearGradient colors={colors.gradientBg} style={styles.header}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={styles.title}>🛒 Pedidos</Text>
            <Text style={styles.subtitle}>{products.length} productos disponibles</Text>
          </View>
          <TouchableOpacity onPress={clearCart} style={styles.cartBtn}>
            <Text style={styles.cartBtnText}>🛒 {cartCount}</Text>
            {CartBadge}
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar producto..."
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* Categories */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.md }}>
          {["all", ...categories].map((cat) => (
            <TouchableOpacity
              key={cat}
              onPress={() => setSelectedCategory(cat)}
              style={[styles.categoryChip, selectedCategory === cat && styles.categoryChipActive]}
            >
              <Text style={[styles.categoryText, selectedCategory === cat && styles.categoryTextActive]}>
                {cat === "all" ? "Todo" : cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </LinearGradient>

      {/* Product grid */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
          {filtered.map((product, index) => (
            <Animated.View key={product.id} entering={FadeInUp.duration(300).delay(index * 30)}>
              <TouchableOpacity onPress={() => handleAddProduct(product)} activeOpacity={0.8}>
                <GlassCard intensity={15} style={{ width: CARD_WIDTH }}>
                  <View style={{ aspectRatio: 1, backgroundColor: "rgba(99,102,241,0.1)", borderRadius: borderRadius.sm, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm }}>
                    <Text style={{ fontSize: 32 }}>{product.tipo_venta === "pesable" ? "⚖️" : "📦"}</Text>
                  </View>
                  <Text style={styles.productName} numberOfLines={2}>{product.nombre}</Text>
                  <Text style={styles.productSku}>{product.sku}</Text>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xs }}>
                    <Text style={styles.productPrice}>Gs. {product.precio_venta.toLocaleString()}</Text>
                    <Text style={styles.productStock}>📦 {product.stock_actual}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleAddProduct(product)} style={styles.addBtn}>
                    <Text style={styles.addBtnText}>+ Agregar</Text>
                  </TouchableOpacity>
                </GlassCard>
              </TouchableOpacity>
            </Animated.View>
          ))}
          {filtered.length === 0 && (
            <View style={{ width: "100%", alignItems: "center", padding: spacing.xxxl }}>
              <Text style={{ fontSize: 40, marginBottom: spacing.md }}>📭</Text>
              <Text style={{ color: colors.textSecondary }}>No se encontraron productos</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Cart summary */}
      {cartItems.length > 0 && (
        <View style={styles.cartSummary}>
          <View style={styles.cartHeader}>
            <Text style={styles.cartTitle}>🛒 Pedido actual ({cartCount} items)</Text>
            <TouchableOpacity onPress={clearCart}><Text style={styles.cartClear}>Limpiar</Text></TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 60 }}>
            {cartItems.map((item) => (
              <TouchableOpacity key={item.product_id} onPress={() => removeFromCart(item.product_id)} style={styles.cartChip}>
                <Text style={styles.cartChipText}>{item.product_name.split(" ").slice(0, 2).join(" ")} x{item.cantidad}</Text>
                <Text style={styles.cartChipRemove}>✕</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.cartFooter}>
            <Text style={styles.cartTotal}>Total: Gs. {cartTotal.toLocaleString()}</Text>
            <TouchableOpacity style={styles.confirmBtn}>
              <Text style={styles.confirmBtnText}>Confirmar pedido</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 50,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  title: {
    fontSize: typography.fontSize.xxl,
    fontFamily: typography.fontFamily.bold,
    color: colors.text,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
    color: colors.text,
  },
  categoryChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  categoryChipActive: {
    backgroundColor: "rgba(99, 102, 241, 0.2)",
    borderColor: colors.primary,
  },
  categoryText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.medium,
    color: colors.textSecondary,
  },
  categoryTextActive: {
    color: colors.primaryLight,
  },
  productName: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    color: colors.text,
    height: 36,
  },
  productSku: {
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    fontFamily: typography.fontFamily.mono,
    marginTop: 2,
  },
  productPrice: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.bold,
    color: colors.success,
  },
  productStock: {
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
  },
  addBtn: {
    marginTop: spacing.sm,
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.sm,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.2)",
  },
  addBtnText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.semibold,
    color: colors.primaryLight,
  },
  cartBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  cartBtnText: {
    fontSize: typography.fontSize.md,
  },
  cartBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: colors.error,
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  cartBadgeText: {
    fontSize: 10,
    fontFamily: typography.fontFamily.bold,
    color: colors.text,
  },
  cartSummary: {
    position: "absolute",
    bottom: 80,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: "rgba(10,10,26,0.95)",
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cartTitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    color: colors.text,
  },
  cartClear: {
    fontSize: typography.fontSize.xs,
    color: colors.errorLight,
  },
  cartChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginRight: spacing.sm,
    gap: spacing.xs,
  },
  cartChipText: {
    fontSize: typography.fontSize.xs,
    color: colors.primaryLight,
  },
  cartChipRemove: {
    fontSize: 10,
    color: colors.textTertiary,
  },
  cartFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.xs,
  },
  cartTotal: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.bold,
    color: colors.success,
  },
  confirmBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  confirmBtnText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    color: colors.text,
  },
})
