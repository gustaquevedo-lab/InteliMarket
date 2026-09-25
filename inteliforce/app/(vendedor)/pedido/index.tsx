// app/(vendedor)/pedido/index.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { ProductCard, ProductItem } from '@/components/pedido/ProductCard';
import { CartSummary } from '@/components/pedido/CartSummary';
import { useVisit } from '@/hooks/useVisit';
import { api } from '@/lib/api';
import { colors } from '@/constants/colors';

export default function PedidoCatalogScreen() {
  const router = useRouter();
  const { cart, customerName, addToCart, updateCartQty, getCartTotal, getCartItemCount } =
    useVisit();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: products = [], isLoading } = useQuery<ProductItem[]>({
    queryKey: ['products-direct-search', debouncedSearch],
    queryFn: async () => {
      return await api.get<ProductItem[]>(
        `/products?search=${encodeURIComponent(debouncedSearch)}&limit=50`
      );
    },
  });

  const cartQtyMap = useMemo(() => {
    const map = new Map<string, number>();
    cart.forEach((i) => map.set(i.productId, i.cantidad));
    return map;
  }, [cart]);

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Catálogo de Productos</Text>
          <Text style={styles.headerSubtitle}>{customerName || 'Toma de Pedido'}</Text>
        </View>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar producto o código SKU..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {isLoading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : products.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="cube-outline" size={44} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Sin resultados</Text>
          <Text style={styles.emptySubtitle}>No se encontraron productos coincidentes.</Text>
        </View>
      ) : (
        <FlashList
          data={products}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const qty = cartQtyMap.get(item.id) || 0;
            return (
              <ProductCard
                product={item}
                quantityInCart={qty}
                onAdd={() => addToCart(item, 1)}
                onRemove={() => updateCartQty(item.id, qty - 1)}
              />
            );
          }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110 }}
        />
      )}

      <CartSummary
        itemCount={getCartItemCount()}
        totalAmount={getCartTotal()}
        onConfirmOrder={() => router.push('/(vendedor)/pedido/confirmar')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    margin: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textMuted,
  },
});
