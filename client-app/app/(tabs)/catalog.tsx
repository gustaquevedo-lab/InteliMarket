import { useState, useEffect, useCallback } from "react"
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from "react-native"
import { Search } from "lucide-react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { api } from "../../src/services/api"
import { useClientStore } from "../../src/stores/clientStore"
import { ProductCard } from "../../src/components/ProductCard"
import { GlassCard } from "../../src/components/GlassCard"
import { colors, spacing, borderRadius, typography } from "../../src/theme"
import type { Product, Category } from "../../src/types"
import { useRouter } from "expo-router"

export default function CatalogScreen() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [search, setSearch] = useState("")
  const [selectedCat, setSelectedCat] = useState("")
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const router = useRouter()
  const setCart = useClientStore((s) => s.cart.setCart)

  const fetchData = useCallback(async () => {
    try {
      const [prods, cats, favs] = await Promise.all([
        api.catalog.products({ search, category_id: selectedCat, limit: 100 }),
        api.catalog.categories(),
        api.favorites.list(),
      ])
      setProducts(prods)
      setCategories(cats)
      setFavorites(new Set(favs.map((f: any) => f.product_id)))
    } catch {}
    setLoading(false)
    setRefreshing(false)
  }, [search, selectedCat])

  useEffect(() => { fetchData() }, [fetchData])

  const addToCart = useCallback(async (product: Product) => {
    try {
      const cart = await api.cart.addItem({ product_id: product.id, cantidad: 1, precio_unitario: product.precio })
      setCart(cart.items, cart.total)
    } catch {}
  }, [])

  const toggleFav = useCallback(async (productId: string) => {
    try {
      if (favorites.has(productId)) {
        await api.favorites.remove(productId)
        setFavorites((prev) => { const n = new Set(prev); n.delete(productId); return n })
      } else {
        await api.favorites.add(productId)
        setFavorites((prev) => new Set(prev).add(productId))
      }
    } catch {}
  }, [favorites])

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Catálogo</Text>
      <View style={styles.searchRow}>
        <Search size={18} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
        <TextInput style={styles.searchInput} placeholder="Buscar productos..." value={search} onChangeText={setSearch} />
      </View>
      <FlatList
        horizontal showsHorizontalScrollIndicator={false} style={styles.catList}
        data={[{ id: "", nombre: "Todos", product_count: 0 }, ...categories]}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.catChip, selectedCat === item.id && styles.catChipActive]} onPress={() => setSelectedCat(item.id)}>
            <Text style={[styles.catText, selectedCat === item.id && styles.catTextActive]}>{item.nombre}</Text>
          </TouchableOpacity>
        )}
      />
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          numColumns={2} contentContainerStyle={styles.grid}
          data={products} keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData() }} />}
          ListEmptyComponent={<Text style={styles.empty}>Sin productos</Text>}
          renderItem={({ item }) => (
            <ProductCard
              product={item} isFavorite={favorites.has(item.id)}
              onPress={() => router.push(`/product/${item.id}`)}
              onAddToCart={() => addToCart(item)}
              onToggleFavorite={() => toggleFav(item.id)}
            />
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { fontSize: 24, fontWeight: "800", color: colors.text, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  searchRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, marginHorizontal: spacing.lg, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, paddingVertical: spacing.sm, fontSize: 14 },
  catList: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  catChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.surfaceAlt, borderRadius: borderRadius.full, marginRight: spacing.sm, borderWidth: 1, borderColor: colors.border },
  catChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catText: { fontSize: 12, color: colors.textSecondary },
  catTextActive: { color: "#fff", fontWeight: "600" },
  grid: { paddingHorizontal: spacing.md, paddingBottom: 100 },
  empty: { textAlign: "center", marginTop: 40, color: colors.textMuted },
})
