// components/pedido/CartItem.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatGS } from '@/lib/format';
import { useTheme } from '@/hooks/useTheme';
import { CartItem as CartItemType } from '@/hooks/useVisit';

interface CartItemProps {
  item: CartItemType;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
}

export function CartItem({
  item,
  onIncrement,
  onDecrement,
  onRemove,
}: CartItemProps) {
  const { theme, isDark } = useTheme();
  const subtotal = item.precio_unitario * item.cantidad;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
        },
      ]}
    >
      <View style={styles.infoCol}>
        <Text style={[styles.nombre, { color: theme.text }]} numberOfLines={2}>
          {item.nombre}
        </Text>
        <Text style={[styles.unitPrice, { color: theme.textSecondary }]}>
          {formatGS(item.precio_unitario)} x {item.cantidad} un.
        </Text>
      </View>

      <View style={styles.actionsCol}>
        <View
          style={[
            styles.stepper,
            { backgroundColor: isDark ? '#151C25' : '#F1F5F9' },
          ]}
        >
          <TouchableOpacity style={styles.stepBtn} onPress={onDecrement} activeOpacity={0.7}>
            <Ionicons name="remove" size={16} color={theme.primary} />
          </TouchableOpacity>

          <Text style={[styles.qtyText, { color: theme.text }]}>{item.cantidad}</Text>

          <TouchableOpacity style={styles.stepBtn} onPress={onIncrement} activeOpacity={0.7}>
            <Ionicons name="add" size={16} color={theme.primary} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.subtotal, { color: theme.primary }]}>{formatGS(subtotal)}</Text>

        <TouchableOpacity onPress={onRemove} style={styles.deleteBtn} activeOpacity={0.7}>
          <Ionicons name="trash-outline" size={18} color={theme.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoCol: {
    flex: 1,
    paddingRight: 10,
  },
  nombre: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  unitPrice: {
    fontSize: 12,
  },
  actionsCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    padding: 2,
  },
  stepBtn: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyText: {
    fontSize: 14,
    fontWeight: '800',
    minWidth: 24,
    textAlign: 'center',
  },
  subtotal: {
    fontSize: 14,
    fontWeight: '800',
    minWidth: 80,
    textAlign: 'right',
  },
  deleteBtn: {
    padding: 4,
    marginLeft: 4,
  },
});
