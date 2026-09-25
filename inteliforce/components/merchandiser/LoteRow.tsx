// components/merchandiser/LoteRow.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Card } from '@/components/ui/Card';
import { ExpiryBadge } from './ExpiryBadge';
import { formatDate } from '@/lib/format';
import { useTheme } from '@/hooks/useTheme';

export interface LotItem {
  id: string;
  product_id: string;
  product_nombre: string;
  lote: string;
  fecha_vencimiento: string;
  cantidad_unidades: number;
  dias_para_vencer: number;
}

interface LoteRowProps {
  lot: LotItem;
  onEdit?: () => void;
}

export function LoteRow({ lot, onEdit }: LoteRowProps) {
  const { theme } = useTheme();

  return (
    <TouchableOpacity onPress={onEdit} disabled={!onEdit} activeOpacity={0.8}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <Text style={[styles.productName, { color: theme.text }]} numberOfLines={2}>
            {lot.product_nombre}
          </Text>
          <ExpiryBadge daysLeft={lot.dias_para_vencer} />
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text style={[styles.metaLabel, { color: theme.textMuted }]}>Lote</Text>
            <Text style={[styles.metaValue, { color: theme.text }]}>{lot.lote}</Text>
          </View>

          <View style={styles.metaItem}>
            <Text style={[styles.metaLabel, { color: theme.textMuted }]}>Vencimiento</Text>
            <Text style={[styles.metaValue, { color: theme.text }]}>{formatDate(lot.fecha_vencimiento)}</Text>
          </View>

          <View style={styles.metaItem}>
            <Text style={[styles.metaLabel, { color: theme.textMuted }]}>Cantidad</Text>
            <Text style={[styles.metaValue, { color: theme.text }]}>{lot.cantidad_unidades} un.</Text>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 8,
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  metaItem: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '700',
  },
});
