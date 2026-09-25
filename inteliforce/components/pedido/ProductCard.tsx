// components/pedido/ProductCard.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatGS } from '@/lib/format';
import { useTheme } from '@/hooks/useTheme';
import { haptic } from '@/lib/haptics';

export interface ProductItem {
  id: string;
  sku?: string;
  nombre: string;
  precio_venta: number;
  stock?: number;
  unidad_medida?: string;
  linea_nombre?: string;
}

interface ProductCardProps {
  product: ProductItem;
  quantityInCart: number;
  onAdd: () => void;
  onRemove: () => void;
}

export function ProductCard({
  product,
  quantityInCart,
  onAdd,
  onRemove,
}: ProductCardProps) {
  const { theme, isDark } = useTheme();
  const hasStock = (product.stock ?? 0) > 0;

  const handleAdd = () => {
    if (quantityInCart === 0) {
      haptic.medium();
    } else {
      haptic.light();
    }
    onAdd();
  };

  const handleRemove = () => {
    haptic.light();
    onRemove();
  };

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.info}>
          {product.linea_nombre && (
            <Badge label={product.linea_nombre} variant="neutral" style={styles.badge} />
          )}
          <Text
            style={[styles.title, { color: theme.text }]}
            numberOfLines={2}
          >
            {product.nombre}
          </Text>
          {product.sku && (
            <Text style={[styles.sku, { color: theme.textMuted }]}>
              SKU: {product.sku}
            </Text>
          )}
        </View>

        <View style={styles.priceContainer}>
          <Text style={[styles.price, { color: theme.primary }]}>
            {formatGS(product.precio_venta)}
          </Text>
          <Text
            style={[
              styles.stock,
              { color: hasStock ? theme.success : theme.danger },
            ]}
          >
            {hasStock ? `Stock: ${Math.round(product.stock ?? 0)} ${product.unidad_medida || 'un.'}` : 'Sin stock'}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.footer,
          { borderTopColor: isDark ? '#232A34' : theme.borderLight },
        ]}
      >
        {quantityInCart === 0 ? (
          <TouchableOpacity
            style={[
              styles.addButton,
              { backgroundColor: hasStock ? theme.primary : isDark ? '#1F2937' : theme.border },
            ]}
            onPress={handleAdd}
            disabled={!hasStock}
            activeOpacity={0.7}
          >
            <Ionicons
              name="cart-outline"
              size={16}
              color={isDark ? '#002109' : '#FFFFFF'}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.addButtonText,
                { color: isDark ? '#002109' : '#FFFFFF' },
              ]}
            >
              Agregar
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.stepperContainer}>
            <TouchableOpacity
              style={[
                styles.stepBtn,
                {
                  backgroundColor: isDark ? '#151C25' : '#EFF6FF',
                  borderColor: isDark ? '#232A34' : '#BFDBFE',
                },
              ]}
              onPress={handleRemove}
              activeOpacity={0.7}
            >
              <Ionicons name="remove" size={18} color={theme.primary} />
            </TouchableOpacity>

            <View style={styles.qtyContainer}>
              <Text style={[styles.qtyText, { color: theme.text }]}>{quantityInCart}</Text>
            </View>

            <TouchableOpacity
              style={[
                styles.stepBtn,
                {
                  backgroundColor: isDark ? '#151C25' : '#EFF6FF',
                  borderColor: isDark ? '#232A34' : '#BFDBFE',
                },
              ]}
              onPress={handleAdd}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={18} color={theme.primary} />
            </TouchableOpacity>

            <Text style={[styles.subtotalText, { color: theme.textSecondary }]}>
              Subtotal: <Text style={{ fontWeight: '800', color: theme.text }}>{formatGS(product.precio_venta * quantityInCart)}</Text>
            </Text>
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  info: {
    flex: 1,
    paddingRight: 12,
  },
  badge: {
    marginBottom: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  sku: {
    fontSize: 12,
    marginTop: 2,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 16,
    fontWeight: '800',
  },
  stock: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  footer: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  qtyContainer: {
    minWidth: 36,
    alignItems: 'center',
  },
  qtyText: {
    fontSize: 15,
    fontWeight: '800',
  },
  subtotalText: {
    fontSize: 13,
    marginLeft: 'auto',
  },
});

