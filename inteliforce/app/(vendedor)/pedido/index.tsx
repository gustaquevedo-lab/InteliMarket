// app/(vendedor)/pedido/index.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { ProductCard, ProductItem } from '@/components/pedido/ProductCard';
import { CartSummary } from '@/components/pedido/CartSummary';
import { useVisit } from '@/hooks/useVisit';
import { useTheme } from '@/hooks/useTheme';
import { haptic } from '@/lib/haptics';
import { api } from '@/lib/api';
import { ThemeColors } from '@/constants/colors';

export default function PedidoCatalogScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);

  const { cart, customerName, addToCart, updateCartQty, getCartTotal, getCartItemCount } =
    useVisit();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: products = [], isLoading } = useQuery<ProductItem[]>({
    queryKey: ['products-direct-search', debouncedSearch],
    queryFn: async () => {
      return await api.get<ProductItem[]>(
        `/products?search=${encodeURIComponent(debouncedSearch)}&limit=100`
      );
    },
  });

  // Extract distinct category lines
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.linea_nombre && p.linea_nombre.trim()) {
        set.add(p.linea_nombre.trim());
      }
    });
    return ['Todos', ...Array.from(set).sort()];
  }, [products]);

  // Client-side category filtering
  const filteredProducts = useMemo(() => {
    if (selectedCategory === 'Todos') return products;
    return products.filter((p) => p.linea_nombre === selectedCategory);
  }, [products, selectedCategory]);

  const cartQtyMap = useMemo(() => {
    const map = new Map<string, number>();
    cart.forEach((i) => map.set(i.productId, i.cantidad));
    return map;
  }, [cart]);

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          onPress={() => {
            haptic.light();
            router.back();
          }}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Catálogo de Productos</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {customerName || 'Toma de Pedido'}
          </Text>
        </View>
        <View style={styles.itemsCountBadge}>
          <Text style={styles.itemsCountBadgeText}>
            {filteredProducts.length} productos
          </Text>
        </View>
      </View>

      {/* Search Input Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={theme.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar producto o código SKU..."
          placeholderTextColor={theme.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        {search.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearch('')}
            style={{ padding: 4 }}
            activeOpacity={0.7}
          >
            <Ionicons name="close-circle" size={18} color={theme.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category Filter Chips Bar */}
      {categories.length > 1 && (
        <View style={styles.categoriesContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesScrollContent}
          >
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryChip,
                    isSelected && styles.categoryChipActive,
                  ]}
                  onPress={() => {
                    haptic.light();
                    setSelectedCategory(cat);
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      isSelected && styles.categoryChipTextActive,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Catalog Listing */}
      {isLoading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : filteredProducts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="cube-outline" size={44} color={theme.textMuted} />
          <Text style={styles.emptyTitle}>Sin resultados</Text>
          <Text style={styles.emptySubtitle}>
            {search.trim()
              ? `No hay productos coincidentes con "${search}"`
              : `No hay productos en la categoría "${selectedCategory}"`}
          </Text>
        </View>
      ) : (
        <FlashList
          data={filteredProducts}
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
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110, paddingTop: 6 }}
        />
      )}

      {/* Floating Bottom Cart Summary */}
      <CartSummary
        itemCount={getCartItemCount()}
        totalAmount={getCartTotal()}
        onConfirmOrder={() => {
          haptic.medium();
          router.push('/(vendedor)/pedido/confirmar');
        }}
      />
    </View>
  );
}

const getStyles = (theme: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    backBtn: {
      padding: 6,
      marginRight: 8,
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.text,
      letterSpacing: -0.2,
    },
    headerSubtitle: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 1,
    },
    itemsCountBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 12,
      backgroundColor: isDark ? '#1E293B' : '#E2E8F0',
    },
    itemsCountBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.textSecondary,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.card,
      marginHorizontal: 16,
      marginTop: 12,
      marginBottom: 8,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      height: 44,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: theme.text,
    },
    categoriesContainer: {
      marginBottom: 8,
    },
    categoriesScrollContent: {
      paddingHorizontal: 16,
      gap: 8,
      paddingVertical: 4,
    },
    categoryChip: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
      borderWidth: 1,
      borderColor: theme.border,
    },
    categoryChipActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    categoryChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    categoryChipTextActive: {
      color: isDark ? '#002109' : '#FFFFFF',
      fontWeight: '800',
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
      color: theme.text,
    },
    emptySubtitle: {
      fontSize: 13,
      color: theme.textMuted,
      textAlign: 'center',
    },
  });
