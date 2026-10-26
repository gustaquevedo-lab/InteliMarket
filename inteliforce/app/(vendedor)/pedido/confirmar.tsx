import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CartItem } from '@/components/pedido/CartItem';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useVisit } from '@/hooks/useVisit';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { useTheme } from '@/hooks/useTheme';
import { api } from '@/lib/api';
import { offlineDb } from '@/lib/offline/db';
import { evaluar, ActividadInput } from '@/lib/actividades';
import { formatGS } from '@/lib/format';
import { haptic } from '@/lib/haptics';

export default function ConfirmarPedidoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { customer_id } = useLocalSearchParams<{ customer_id: string }>();
  const { theme, isDark } = useTheme();

  const {
    cart,
    customerName,
    visitId,
    updateCartQty,
    removeFromCart,
    clearCart,
  } = useVisit();

  const { enqueueOrExecute } = useOfflineQueue();

  const [actividades, setActividades] = useState<ActividadInput[]>([]);
  const [condicion, setCondicion] = useState<'contado' | 'credito'>('contado');
  const [observaciones, setObservaciones] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    offlineDb.getActividades<ActividadInput>().then((cached) => {
      if (cached && cached.length > 0) setActividades(cached);
    });
    api.get<ActividadInput[]>('/inteliforce/actividades')
      .then((acts) => {
        setActividades(acts);
        offlineDb.saveActividades(acts);
      })
      .catch(() => {});
  }, []);

  const evaluated = useMemo(() => {
    const lineas = cart.map((i) => ({
      product_id: i.productId,
      cantidad: i.cantidad,
      precio: i.precio_unitario,
    }));
    return evaluar(lineas, actividades);
  }, [cart, actividades]);

  const { subtotalBruto, totalAhorro, totalNeto, bonificadas } = useMemo(() => {
    let subtotal = 0;
    let ahorro = 0;
    const bonis: Array<{
      product_id: string;
      actividad_id: string | null;
      cantidad: number;
      nombre: string;
    }> = [];

    cart.forEach((item) => {
      subtotal += item.precio_unitario * item.cantidad;
      const evalLine = evaluated.find(
        (e) => !e.bonificada && e.product_id === item.productId
      );
      if (evalLine && evalLine.descuento_unitario > 0) {
        ahorro += evalLine.descuento_unitario * item.cantidad;
      }
    });

    evaluated
      .filter((e) => e.bonificada)
      .forEach((b) => {
        const matchingCart = cart.find((c) => c.productId === b.product_id);
        bonis.push({
          product_id: b.product_id,
          actividad_id: b.actividad_id,
          cantidad: b.cantidad || 0,
          nombre: matchingCart?.nombre || b.nombre_actividad || 'Producto bonificado',
        });
      });

    return {
      subtotalBruto: subtotal,
      totalAhorro: ahorro,
      totalNeto: Math.max(0, subtotal - ahorro),
      bonificadas: bonis,
    };
  }, [cart, evaluated]);

  // Modal de autorización requerida (Error 409)
  const [authRequiredData, setAuthRequiredData] = useState<{
    credito_limite?: number;
    credito_usado?: number;
    monto_pedido?: number;
  } | null>(null);

  const handleSubmitOrder = async () => {
    if (cart.length === 0) {
      Alert.alert('Carrito vacío', 'No hay productos en el pedido para confirmar.');
      return;
    }

    setLoading(true);

    const payload = {
      customer_id: customer_id || '',
      condicion,
      items: [
        ...cart.map((item) => {
          const evalLine = evaluated.find(
            (e) => !e.bonificada && e.product_id === item.productId
          );
          return {
            product_id: item.productId,
            cantidad: item.cantidad,
            precio_unitario: item.precio_unitario,
            descuento_unitario: evalLine?.descuento_unitario || 0,
            actividad_id: evalLine?.actividad_id || null,
            descuento_pct: item.descuento_pct || 0,
            iva_tasa: item.iva_tasa || 10,
          };
        }),
        ...bonificadas.map((b) => ({
          product_id: b.product_id,
          cantidad: b.cantidad,
          precio_unitario: 0,
          descuento_unitario: 0,
          actividad_id: b.actividad_id,
          bonificada: true,
          descuento_pct: 0,
          iva_tasa: 10,
        })),
      ],
      observaciones: observaciones.trim() || undefined,
      credit_authorization_id: null,
      // Mismo id en el envío directo y en el reintento de la cola: el servidor no duplica la venta.
      client_op_id: `ord_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    };

    try {
      const result = await enqueueOrExecute('create_order', payload, async () => {
        try {
          return await api.post<{
            id: string;
            numero: string;
            total: number;
            estado: string;
          }>('/orders', payload);
        } catch (err: any) {
          if (err?.status === 409) {
            haptic.error();
            setAuthRequiredData(err?.data || { requiere_autorizacion: true });
            throw err;
          }
          throw err;
        }
      });

      clearCart();

      if (result.queued) {
        haptic.medium();
        Alert.alert(
          'Pedido Guardado Offline',
          'El pedido fue registrado localmente y se enviará automáticamente cuando recuperes la conexión.',
          [{ text: 'Entendido', onPress: () => router.back() }]
        );
      } else {
        haptic.success();
        Alert.alert(
          '¡Pedido Confirmado!',
          `Número de pedido: ${result.data?.numero || 'Generado'}\nTotal: ${formatGS(
            result.data?.total ?? totalNeto
          )}`,
          [{ text: 'Aceptar', onPress: () => router.back() }]
        );
      }
    } catch (err: any) {
      if (err?.status !== 409) {
        haptic.error();
        Alert.alert('Error', err?.message || 'No se pudo procesar el pedido');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Header */}
      <View style={[styles.headerBar, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <View>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Resumen del Pedido</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>{customerName || 'Cliente'}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Selector de Condición: Contado / Crédito */}
        <Card style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Condición de Venta</Text>
          <View style={styles.condicionRow}>
            <TouchableOpacity
              style={[
                styles.condicionBtn,
                {
                  backgroundColor: condicion === 'contado'
                    ? (isDark ? '#004B1E' : '#E8F5E9')
                    : (isDark ? theme.cardLow : '#FFFFFF'),
                  borderColor: condicion === 'contado' ? theme.primary : theme.border,
                },
              ]}
              onPress={() => setCondicion('contado')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="cash-outline"
                size={18}
                color={condicion === 'contado' ? theme.primary : theme.textSecondary}
              />
              <Text
                style={[
                  styles.condicionText,
                  { color: condicion === 'contado' ? theme.primary : theme.textSecondary },
                  condicion === 'contado' && { fontWeight: '800' },
                ]}
              >
                CONTADO
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.condicionBtn,
                {
                  backgroundColor: condicion === 'credito'
                    ? (isDark ? '#004B1E' : '#E8F5E9')
                    : (isDark ? theme.cardLow : '#FFFFFF'),
                  borderColor: condicion === 'credito' ? theme.primary : theme.border,
                },
              ]}
              onPress={() => setCondicion('credito')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="card-outline"
                size={18}
                color={condicion === 'credito' ? theme.primary : theme.textSecondary}
              />
              <Text
                style={[
                  styles.condicionText,
                  { color: condicion === 'credito' ? theme.primary : theme.textSecondary },
                  condicion === 'credito' && { fontWeight: '800' },
                ]}
              >
                CRÉDITO
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Lista de Ítems */}
        <View style={styles.itemsHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Productos Seleccionados ({cart.length})</Text>
        </View>

        {cart.map((item) => {
          const evalLine = evaluated.find(
            (e) => !e.bonificada && e.product_id === item.productId
          );
          return (
            <CartItem
              key={item.productId}
              item={item}
              descuentoUnitario={evalLine?.descuento_unitario || 0}
              actividadNombre={evalLine?.nombre_actividad}
              onIncrement={() => updateCartQty(item.productId, item.cantidad + 1)}
              onDecrement={() => updateCartQty(item.productId, item.cantidad - 1)}
              onRemove={() => removeFromCart(item.productId)}
            />
          );
        })}

        {bonificadas.map((b, idx) => (
          <CartItem
            key={`boni_${b.product_id}_${idx}`}
            item={{
              productId: b.product_id,
              nombre: b.nombre,
              precio_unitario: 0,
              cantidad: b.cantidad,
              iva_tasa: 10,
              descuento_pct: 0,
            }}
            isBonificado={true}
            actividadNombre="Bonificación"
          />
        ))}

        {/* Observaciones */}
        <Card style={styles.sectionCard}>
          <Input
            label="Observaciones del pedido (opcional)"
            placeholder="Instrucciones de entrega, notas para facturación..."
            value={observaciones}
            onChangeText={setObservaciones}
            multiline
            numberOfLines={2}
          />
        </Card>

        {/* Total y Resumen de Precios */}
        <Card
          style={[
            styles.totalCard,
            {
              backgroundColor: isDark ? '#1E293B' : '#0F1F3D',
              borderColor: isDark ? '#334155' : 'transparent',
              borderWidth: isDark ? 1 : 0,
            },
          ]}
        >
          {totalAhorro > 0 && (
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: '#10B981', fontWeight: '700' }]}>
                Ahorro Actividades
              </Text>
              <Text style={[styles.breakdownVal, { color: '#10B981', fontWeight: '800' }]}>
                -{formatGS(totalAhorro)}
              </Text>
            </View>
          )}
          <View style={styles.breakdownRow}>
            <Text style={[styles.breakdownLabel, { color: isDark ? '#94A3B8' : '#CBD5E1' }]}>
              Subtotal Gravadas (10%)
            </Text>
            <Text style={[styles.breakdownVal, { color: '#FFFFFF' }]}>
              {formatGS(Math.round((totalNeto * 10) / 11))}
            </Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={[styles.breakdownLabel, { color: isDark ? '#94A3B8' : '#CBD5E1' }]}>
              Liquidación IVA (10%)
            </Text>
            <Text style={[styles.breakdownVal, { color: '#38BDF8' }]}>
              {formatGS(Math.round(totalNeto / 11))}
            </Text>
          </View>
          <View style={[styles.totalDivider, { backgroundColor: isDark ? '#334155' : 'rgba(255,255,255,0.1)' }]} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total a Pagar</Text>
            <Text style={[styles.totalAmount, { color: theme.primary }]}>{formatGS(totalNeto)}</Text>
          </View>
          <Text style={styles.ivaDisclaimer}>Importe en Guaraníes con IVA incluido</Text>
        </Card>

        {/* Botón Submit */}
        <Button
          title={`Confirmar Pedido • ${formatGS(totalNeto)}`}
          onPress={handleSubmitOrder}
          loading={loading}
          size="lg"
          variant="primary"
          style={styles.submitBtn}
          icon={<Ionicons name="checkmark-circle" size={20} color={isDark ? '#002109' : '#FFFFFF'} />}
        />
      </ScrollView>

      {/* Modal 409: Requiere Autorización de Crédito */}
      <Modal visible={!!authRequiredData} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
              },
            ]}
          >
            <View
              style={[
                styles.modalIcon,
                { backgroundColor: isDark ? '#450A0A' : theme.dangerLight },
              ]}
            >
              <Ionicons name="alert-circle" size={40} color={theme.danger} />
            </View>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Límite de Crédito Superado</Text>
            <Text style={[styles.modalBody, { color: theme.textSecondary }]}>
              Este pedido excede el saldo de crédito disponible del cliente. Se requiere
              autorización expresa de un supervisor en el sistema central antes de que pueda ser
              despachado.
            </Text>

            {authRequiredData?.credito_limite !== undefined && (
              <View
                style={[
                  styles.modalCreditDetails,
                  {
                    backgroundColor: isDark ? '#151C25' : '#F8FAFC',
                    borderColor: theme.border,
                    borderWidth: 1,
                  },
                ]}
              >
                <Text style={[styles.modalCreditRow, { color: theme.textSecondary }]}>
                  Límite:{' '}
                  <Text style={{ fontWeight: '800', color: theme.text }}>
                    {formatGS(authRequiredData.credito_limite)}
                  </Text>
                </Text>
                <Text style={[styles.modalCreditRow, { color: theme.textSecondary }]}>
                  Crédito Usado:{' '}
                  <Text style={{ fontWeight: '800', color: theme.text }}>
                    {formatGS(authRequiredData.credito_usado)}
                  </Text>
                </Text>
                <Text style={[styles.modalCreditRow, { color: theme.textSecondary }]}>
                  Monto Pedido:{' '}
                  <Text style={{ fontWeight: '800', color: theme.danger }}>
                    {formatGS(authRequiredData.monto_pedido || totalNeto)}
                  </Text>
                </Text>
              </View>
            )}

            <Button
              title="Entendido, Modificar Pedido"
              variant="primary"
              size="md"
              onPress={() => setAuthRequiredData(null)}
              style={{ width: '100%', marginTop: 8 }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionCard: {
    padding: 14,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
  },
  condicionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  condicionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    gap: 8,
  },
  condicionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  itemsHeader: {
    marginBottom: 6,
    marginTop: 4,
  },
  totalCard: {
    borderRadius: 16,
    padding: 18,
    marginTop: 8,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  breakdownLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  breakdownVal: {
    fontSize: 14,
    fontWeight: '700',
  },
  totalDivider: {
    height: 1,
    marginVertical: 10,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#94A3B8',
  },
  totalAmount: {
    fontSize: 22,
    fontWeight: '900',
  },
  ivaDisclaimer: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 6,
    textAlign: 'right',
  },
  submitBtn: {
    marginTop: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    borderWidth: 1,
  },
  modalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalBody: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  modalCreditDetails: {
    width: '100%',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 4,
  },
  modalCreditRow: {
    fontSize: 13,
  },
});
