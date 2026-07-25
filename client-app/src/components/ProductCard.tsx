import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import { ShoppingCart, Heart } from "lucide-react-native"
import { GlassCard } from "./GlassCard"
import { colors, spacing, borderRadius, typography } from "../theme"
import type { Product } from "../types"

interface Props {
  product: Product
  isFavorite: boolean
  onPress: () => void
  onAddToCart: () => void
  onToggleFavorite: () => void
}

export function ProductCard({ product, isFavorite, onPress, onAddToCart, onToggleFavorite }: Props) {
  const inStock = product.stock_disponible > 0
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <GlassCard style={styles.card}>
        <TouchableOpacity onPress={onToggleFavorite} style={styles.favBtn}>
          <Heart size={16} color={isFavorite ? colors.danger : colors.textMuted} fill={isFavorite ? colors.danger : "transparent"} />
        </TouchableOpacity>
        <Text style={styles.name} numberOfLines={2}>{product.nombre}</Text>
        <Text style={styles.price}>Gs. {product.precio.toLocaleString()}</Text>
        <View style={styles.row}>
          <Text style={[styles.stock, { color: inStock ? colors.success : colors.textMuted }]}>
            {inStock ? `${product.stock_disponible} und` : "Sin stock"}
          </Text>
          <TouchableOpacity onPress={onAddToCart} style={styles.addBtn}>
            <ShoppingCart size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </GlassCard>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: { margin: spacing.sm / 2, width: 160, minHeight: 140, position: "relative" },
  favBtn: { position: "absolute", top: 8, right: 8, zIndex: 1 },
  name: { ...typography.body, fontWeight: "600", marginBottom: spacing.xs, paddingRight: 20 },
  price: { fontSize: 16, fontWeight: "700", color: colors.primary, marginBottom: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stock: { ...typography.caption },
  addBtn: { backgroundColor: colors.primary, borderRadius: borderRadius.sm, padding: 6 },
})
