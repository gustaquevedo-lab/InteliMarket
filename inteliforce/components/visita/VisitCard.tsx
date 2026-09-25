// components/visita/VisitCard.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useTheme } from '@/hooks/useTheme';
import { formatGS } from '@/lib/format';

export interface RouteStop {
  customer_id: string;
  razon_social: string;
  nombre_fantasia?: string | null;
  ruc?: string | null;
  ci?: string | null;
  cedula?: string | null;
  codigo_interno?: string | null;
  direccion?: string;
  telefono?: string;
  orden_visita: number;
  route_id?: string;
  route_nombre?: string;
  estado?: 'pendiente' | 'abierta' | 'cerrada' | 'sin_pedido';
  tier?: string;
  latitud?: number | null;
  longitud?: number | null;
  credito_limite?: number;
  credito_usado?: number;
  saldo_disponible?: number;
  dias_plazo?: number;
  documentos_vencidos?: number;
  deuda_pendiente?: number;
}

interface VisitCardProps {
  stop: RouteStop;
  index?: number;
  onPress: () => void;
}

export function VisitCard({ stop, index, onPress }: VisitCardProps) {
  const { theme, isDark } = useTheme();
  const isCompleted = stop.estado === 'cerrada';
  const isInProgress = stop.estado === 'abierta';

  const getStatusBadge = () => {
    if (isCompleted) {
      return (
        <Badge
          label="Completado"
          variant="success"
          icon={<Ionicons name="checkmark-circle" size={13} color={theme.success} />}
        />
      );
    }
    if (isInProgress) {
      return (
        <Badge
          label="En Visita"
          variant="primary"
          icon={<Ionicons name="radio-button-on" size={13} color={isDark ? '#002109' : '#FFFFFF'} />}
        />
      );
    }
    if (stop.estado === 'sin_pedido') {
      return <Badge label="Sin Pedido" variant="warning" />;
    }
    return <Badge label="Pendiente" variant="neutral" />;
  };

  const handleCall = (e: any) => {
    e.stopPropagation?.();
    if (stop.telefono) {
      Linking.openURL(`tel:${stop.telefono}`);
    }
  };

  // Número de orden secuencial amigable (nunca #0)
  const displayOrder =
    stop.orden_visita && stop.orden_visita > 0
      ? `#${stop.orden_visita}`
      : index !== undefined
      ? `#${index + 1}`
      : null;

  // Filtrar fragmentos de UUID que no sean un código interno real del ERP
  const isValidInternalCode =
    stop.codigo_interno &&
    !/^[0-9a-fA-F]{8}$/.test(stop.codigo_interno.trim()) &&
    stop.codigo_interno.trim().length > 0;

  const taxDoc = stop.ruc
    ? `RUC: ${stop.ruc}`
    : stop.ci || stop.cedula
    ? `CI: ${stop.ci || stop.cedula}`
    : null;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88}>
      <Card
        style={[
          styles.card,
          {
            backgroundColor: theme.card,
            borderColor: isInProgress ? theme.primary : theme.border,
            borderWidth: isInProgress ? 1.5 : 1,
          },
        ]}
      >
        {/* Franja de acento lateral según estado */}
        <View
          style={[
            styles.accentStrip,
            {
              backgroundColor: isInProgress
                ? theme.primary
                : isCompleted
                ? theme.success
                : isDark
                ? '#334155'
                : theme.primary,
            },
          ]}
        />

        <View style={styles.content}>
          {/* Fila Superior: Orden y Badge de Estado */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              {displayOrder && (
                <View
                  style={[
                    styles.orderPill,
                    { backgroundColor: isDark ? '#1E293B' : theme.cardLow },
                  ]}
                >
                  <Text style={[styles.orderNumber, { color: theme.primary }]}>
                    {displayOrder}
                  </Text>
                </View>
              )}
              {getStatusBadge()}
            </View>

            {stop.telefono && (
              <TouchableOpacity
                style={[
                  styles.quickCallBtn,
                  {
                    backgroundColor: isDark ? '#151C25' : '#F1F5F9',
                    borderColor: isDark ? '#232A34' : '#CBD5E1',
                  },
                ]}
                onPress={handleCall}
                activeOpacity={0.7}
              >
                <Ionicons name="call" size={13} color={theme.primary} />
                <Text style={[styles.quickCallText, { color: theme.primary }]}>
                  {stop.telefono}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Razón Social & Nombre Fantasía con espacio amplio */}
          <View style={styles.nameBlock}>
            <Text
              style={[styles.razonSocial, { color: theme.text }]}
              numberOfLines={2}
            >
              {stop.nombre_fantasia || stop.razon_social}
            </Text>
            {stop.nombre_fantasia && stop.nombre_fantasia !== stop.razon_social && (
              <Text
                style={[styles.nombreFantasiaSub, { color: theme.textSecondary }]}
                numberOfLines={1}
              >
                {stop.razon_social}
              </Text>
            )}
          </View>

          {/* Pills Wrap con flexWrap y espacio holgado (evita desborde) */}
          <View style={styles.chipsWrap}>
            {taxDoc && (
              <View
                style={[
                  styles.chipPill,
                  { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' },
                ]}
              >
                <Ionicons name="document-text-outline" size={11} color={theme.textSecondary} />
                <Text style={[styles.chipText, { color: theme.textSecondary }]}>
                  {taxDoc}
                </Text>
              </View>
            )}

            {isValidInternalCode && (
              <View
                style={[
                  styles.chipPill,
                  { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' },
                ]}
              >
                <Text style={[styles.chipText, { color: theme.textMuted }]}>
                  Cód: {stop.codigo_interno}
                </Text>
              </View>
            )}

            {/* Chip de GPS */}
            {stop.latitud && stop.longitud ? (
              <View
                style={[
                  styles.chipPill,
                  { backgroundColor: isDark ? '#064E3B' : '#DCFCE7' },
                ]}
              >
                <Ionicons name="location" size={11} color="#10B981" />
                <Text style={[styles.chipText, { color: '#10B981', fontWeight: '800' }]}>
                  GPS Activo
                </Text>
              </View>
            ) : (
              <View
                style={[
                  styles.chipPill,
                  { backgroundColor: isDark ? '#78350F' : '#FEF3C7' },
                ]}
              >
                <Ionicons name="alert-circle" size={11} color="#F59E0B" />
                <Text style={[styles.chipText, { color: '#F59E0B', fontWeight: '800' }]}>
                  Sin Coordenadas
                </Text>
              </View>
            )}

            {/* Badge de Alerta Moroso sin recortes */}
            {stop.documentos_vencidos && stop.documentos_vencidos > 0 ? (
              <View
                style={[
                  styles.chipPill,
                  {
                    backgroundColor: isDark ? '#450A0A' : '#FEE2E2',
                    borderColor: '#EF4444',
                    borderWidth: 1,
                  },
                ]}
              >
                <Ionicons name="warning" size={12} color="#EF4444" />
                <Text style={[styles.chipText, { color: '#EF4444', fontWeight: '900' }]}>
                  Moroso ({stop.documentos_vencidos} doc. vencidos)
                </Text>
              </View>
            ) : null}
          </View>

          {/* Dirección física */}
          {stop.direccion ? (
            <View style={styles.addressRow}>
              <Ionicons name="location-outline" size={13} color={theme.textMuted} />
              <Text
                style={[styles.direccion, { color: theme.textSecondary }]}
                numberOfLines={2}
              >
                {stop.direccion}
              </Text>
            </View>
          ) : null}

          {/* Resumen Financiero Rápido si tiene límite / saldo */}
          {stop.saldo_disponible !== undefined && (
            <View
              style={[
                styles.financialQuickBar,
                { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' },
              ]}
            >
              <View style={styles.finCol}>
                <Text style={[styles.finLabel, { color: theme.textMuted }]}>
                  Crédito Disp:
                </Text>
                <Text
                  style={[
                    styles.finVal,
                    {
                      color:
                        stop.saldo_disponible > 0 ? theme.success : '#EF4444',
                    },
                  ]}
                >
                  {formatGS(stop.saldo_disponible)}
                </Text>
              </View>

              <View style={styles.finColRight}>
                <Text style={[styles.finLabel, { color: theme.textMuted }]}>
                  Límite:
                </Text>
                <Text style={[styles.finVal, { color: theme.textSecondary }]}>
                  {formatGS(stop.credito_limite ?? 0)}
                </Text>
              </View>
            </View>
          )}

          {/* Footer de acción */}
          <View
            style={[
              styles.footerRow,
              { borderTopColor: isDark ? '#232A34' : theme.borderLight },
            ]}
          >
            <Text style={[styles.footerHint, { color: theme.textMuted }]}>
              {isInProgress
                ? '🟢 Visita abierta actualmente'
                : 'Toca para abrir ficha y gestionar'}
            </Text>
            <View style={styles.actionArrow}>
              <Text style={[styles.actionText, { color: theme.primary }]}>
                {isInProgress ? 'Continuar' : 'Ver Ficha'}
              </Text>
              <Ionicons name="arrow-forward" size={14} color={theme.primary} />
            </View>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 0,
    marginBottom: 12,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
  },
  accentStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
  },
  content: {
    padding: 16,
    paddingLeft: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  orderNumber: {
    fontSize: 12,
    fontWeight: '900',
  },
  quickCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 5,
  },
  quickCallText: {
    fontSize: 11,
    fontWeight: '700',
  },
  nameBlock: {
    marginBottom: 8,
  },
  razonSocial: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  nombreFantasiaSub: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  chipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    marginBottom: 10,
  },
  direccion: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  financialQuickBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 10,
  },
  finCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  finColRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  finLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  finVal: {
    fontSize: 11,
    fontWeight: '800',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
  },
  footerHint: {
    fontSize: 11,
  },
  actionArrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '800',
  },
});
