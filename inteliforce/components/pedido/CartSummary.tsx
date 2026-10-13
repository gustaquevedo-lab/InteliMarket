// components/pedido/CartSummary.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatGS } from '@/lib/format';
import { useTheme } from '@/hooks/useTheme';

interface CartSummaryProps {
  itemCount: number;
  totalAmount: number;
  onConfirmOrder: () => void;
  disabled?: boolean;
}

export function CartSummary({
  itemCount,
  totalAmount,
  onConfirmOrder,
  disabled = false,
}: CartSummaryProps) {
  const { theme, isDark } = useTheme();

  if (itemCount === 0) return null;

  return (
    <View
      style={[
        styles.floatingContainer,
        {
          backgroundColor: isDark ? '#151C25' : '#0F1F3D',
          borderColor: isDark ? '#232A34' : 'transparent',
        },
      ]}
    >
      <View style={styles.infoCol}>
        <Text style={styles.itemCountText}>
          {itemCount} producto{itemCount > 1 ? 's' : ''} en carrito
        </Text>
        <Text style={[styles.totalText, { color: theme.primary }]}>{formatGS(totalAmount)}</Text>
      </View>

      <TouchableOpacity
        style={[
          styles.checkoutBtn,
          { backgroundColor: theme.primary },
          disabled && { backgroundColor: isDark ? '#1F2937' : '#94A3B8' },
        ]}
        onPress={onConfirmOrder}
        disabled={disabled}
        activeOpacity={0.85}
      >
        <Text style={[styles.checkoutBtnText, { color: isDark ? '#002109' : '#FFFFFF' }]}>
          Confirmar
        </Text>
        <Ionicons
          name="arrow-forward"
          size={18}
          color={isDark ? '#002109' : '#FFFFFF'}
          style={{ marginLeft: 6 }}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  infoCol: {
    flex: 1,
  },
  itemCountText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  totalText: {
    fontSize: 19,
    fontWeight: '800',
    marginTop: 2,
  },
  checkoutBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkoutBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
