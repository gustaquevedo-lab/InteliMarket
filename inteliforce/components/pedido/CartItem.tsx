// components/pedido/CartItem.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatGS } from '@/lib/format';
import { useTheme } from '@/hooks/useTheme';
import { CartItem as CartItemType } from '@/hooks/useVisit';

interface CartItemProps {
  item: CartItemType;
  descuentoUnitario?: number;
  actividadNombre?: string;
  isBonificado?: boolean;
  onIncrement?: () => void;
  onDecrement?: () => void;
  onRemove?: () => void;
}

export function CartItem({
  item,
  descuentoUnitario = 0,
  actividadNombre,
  isBonificado = false,
  onIncrement,
  onDecrement,
  onRemove,
}: CartItemProps) {
  const { theme, isDark } = useTheme();
  const precioEfectivo = isBonificado ? 0 : Math.max(0, item.precio_unitario - descuentoUnitario);
  const subtotal = precioEfectivo * item.cantidad;
  const ahorro = isBonificado ? 0 : descuentoUnitario * item.cantidad;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.card,
          borderColor: isBonificado ? '#10B981' : theme.border,
        },
      ]}
    >
      <View style={styles.infoCol}>
        <Text style={[styles.nombre, { color: theme.text }]} numberOfLines={2}>
          {item.nombre}
        </Text>
        <Text style={[styles.unitPrice, { color: theme.textSecondary }]}>
          {isBonificado ? '₲ 0' : formatGS(item.precio_unitario)} x {item.cantidad} un.
        </Text>

        {isBonificado && (
          <View style={styles.boniBadge}>
            <Text style={styles.boniBadgeText}>🎁 Bonificado</Text>
          </View>
        )}

        {!isBonificado && ahorro > 0 && (
          <View style={styles.actBadge}>
            <Text style={styles.actBadgeText}>
              🏷 {actividadNombre || 'Actividad'} (-{formatGS(ahorro)})
            </Text>
          </View>
        )}
      </View>

      <View style={styles.actionsCol}>
        {!isBonificado && onIncrement && onDecrement && (
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
        )}

        {isBonificado && (
          <Text style={[styles.qtyText, { color: theme.text, marginRight: 8 }]}>
            x{item.cantidad}
          </Text>
        )}

        <Text style={[styles.subtotal, { color: isBonificado ? '#10B981' : theme.primary }]}>
          {formatGS(subtotal)}
        </Text>

        {onRemove && (
          <TouchableOpacity onPress={onRemove} style={styles.deleteBtn} activeOpacity={0.7}>
            <Ionicons name="trash-outline" size={18} color={theme.danger} />
          </TouchableOpacity>
        )}
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
  boniBadge: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  boniBadgeText: {
    color: '#065F46',
    fontSize: 11,
    fontWeight: '700',
  },
  actBadge: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  actBadgeText: {
    color: '#047857',
    fontSize: 11,
    fontWeight: '700',
  },
});
