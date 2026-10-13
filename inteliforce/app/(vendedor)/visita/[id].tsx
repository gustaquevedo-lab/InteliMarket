// app/(vendedor)/visita/[id].tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { CheckinButton } from '@/components/gps/CheckinButton';
import { ProductCard, ProductItem } from '@/components/pedido/ProductCard';
import { CartSummary } from '@/components/pedido/CartSummary';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useVisit } from '@/hooks/useVisit';
import { useLocation } from '@/hooks/useLocation';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { useTheme } from '@/hooks/useTheme';
import { api } from '@/lib/api';
import { formatGS, formatDate } from '@/lib/format';

export default function VendedorVisitaScreen() {
  const { id: customerId, razon_social } = useLocalSearchParams<{
    id: string;
    razon_social?: string;
  }>();
  const router = useRouter();
  const { theme, isDark } = useTheme();

  const {
    visitId,
    customerId: activeCustomerId,
    customerName,
    startTime,
    cart,
    startVisit,
    endVisit,
    addToCart,
    updateCartQty,
    getCartTotal,
    getCartItemCount,
  } = useVisit();

  const { location, requestFix } = useLocation();
  const { enqueueOrExecute } = useOfflineQueue();

  const isVisitOpen = Boolean(visitId && activeCustomerId === customerId);

  // Tabs dentro de la visita abierta
  const [activeTab, setActiveTab] = useState<'pedido' | '360' | 'visita'>('pedido');

  // Buscador de productos con debounce
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Cronómetro de visita activa
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  useEffect(() => {
    if (!isVisitOpen || !startTime) return;
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isVisitOpen, startTime]);

  const formattedTimer = useMemo(() => {
    const mins = Math.floor(elapsedSeconds / 60);
    const secs = elapsedSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, [elapsedSeconds]);

  // Query Productos del catálogo
  const { data: products = [], isLoading: loadingProducts } = useQuery<ProductItem[]>({
    queryKey: ['products-search', debouncedSearch],
    queryFn: async () => {
      return await api.get<ProductItem[]>(
        `/products?search=${encodeURIComponent(debouncedSearch)}&limit=40`
      );
    },
    enabled: isVisitOpen && activeTab === 'pedido',
  });

  // Query Cliente 360
  const { data: customer360, isLoading: loading360 } = useQuery<any>({
    queryKey: ['customer-360', customerId],
    queryFn: async () => {
      return await api.get<any>(`/customers/${customerId}/360`);
    },
    enabled: Boolean(customerId),
  });

  // Estado para el cierre de visita
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [closingVisit, setClosingVisit] = useState(false);

  const handleCheckout = async (conPedido: boolean) => {
    if (conPedido && cart.length === 0) {
      Alert.alert(
        'Sin productos',
        'No puedes cerrar "Con Pedido" si el carrito está vacío. Agrega productos o cierra "Sin Pedido".'
      );
      return;
    }

    setClosingVisit(true);
    try {
      const loc = location || (await requestFix());
      const payload = {
        visit_id: visitId,
        lat: loc?.latitude ?? 0,
        lng: loc?.longitude ?? 0,
        notas: checkoutNotes.trim() || (conPedido ? 'Visita con pedido completada' : 'Cliente sin pedido'),
        estado: conPedido ? 'cerrada' : 'sin_pedido',
      };

      await enqueueOrExecute('checkout', payload, async () => {
        return await api.patch(`/visits/${visitId}/checkout`, {
          lat: payload.lat,
          lng: payload.lng,
          notas: payload.notas,
          estado: payload.estado,
        });
      });

      endVisit();
      Alert.alert('Visita Finalizada', 'La salida ha sido registrada con éxito.', [
        {
          text: 'Continuar a Ruta',
          onPress: () => router.replace('/(vendedor)'),
        },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'No se pudo cerrar la visita');
    } finally {
      setClosingVisit(false);
    }
  };

  const clientTitle = customer360?.razon_social || razon_social || customerName || 'Cliente';

  // Carrito map para acceso instantáneo a cantidad por producto
  const cartQtyMap = useMemo(() => {
    const map = new Map<string, number>();
    cart.forEach((item) => map.set(item.productId, item.cantidad));
    return map;
  }, [cart]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Header */}
      <View style={[styles.headerBar, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
            {clientTitle}
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            {isVisitOpen ? `Visita en curso • ${formattedTimer}` : 'Registro de Llegada'}
          </Text>
        </View>

        {isVisitOpen && (
          <View style={[styles.timerBadge, { backgroundColor: isDark ? '#151C25' : '#EFF6FF', borderColor: theme.border }]}>
            <Ionicons name="time" size={14} color={theme.primary} />
            <Text style={[styles.timerText, { color: theme.primary }]}>{formattedTimer}</Text>
          </View>
        )}
      </View>

      {/* ESTADO 1: SIN VISITA ABIERTA (Check-in requerido) */}
      {!isVisitOpen ? (
        <ScrollView contentContainerStyle={styles.checkinScroll}>
          <Card style={styles.clientDetailCard}>
            <View style={styles.clientIconRow}>
              <View style={[styles.clientAvatar, { backgroundColor: isDark ? '#151C25' : '#EFF6FF' }]}>
                <Ionicons name="storefront" size={28} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.clientName, { color: theme.text }]}>{clientTitle}</Text>
                {customer360?.ruc && (
                  <Text style={[styles.clientRuc, { color: theme.textSecondary }]}>RUC: {customer360.ruc}</Text>
                )}
                {customer360?.direccion && (
                  <Text style={[styles.clientAddress, { color: theme.textMuted }]}>{customer360.direccion}</Text>
                )}
              </View>
            </View>

            {customer360?.credito_limite !== undefined && (
              <View style={[styles.creditPreview, { borderTopColor: isDark ? '#232A34' : theme.borderLight }]}>
                <Text style={[styles.creditLabel, { color: theme.textSecondary }]}>Saldo de crédito disponible:</Text>
                <Text style={[styles.creditAmount, { color: theme.success }]}>
                  {formatGS(customer360.saldo_disponible)}
                </Text>
              </View>
            )}
          </Card>

          <View style={styles.checkinBox}>
            <Text style={[styles.checkinInstruction, { color: theme.textSecondary }]}>
              Debes registrar tu llegada en el punto de venta para habilitar la toma de pedidos y auditoría.
            </Text>

            <CheckinButton
              customerId={customerId!}
              customerName={clientTitle}
              onCheckinSuccess={(vId) => {
                startVisit(vId, customerId!, clientTitle);
              }}
            />
          </View>
        </ScrollView>
      ) : (
        /* ESTADO 2: VISITA ABIERTA (Tabs: Pedido, 360, Visita) */
        <View style={styles.activeVisitContainer}>
          {/* Segmented Control Tabs */}
          <View style={[styles.tabsRow, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === 'pedido' && { borderBottomColor: theme.primary },
              ]}
              onPress={() => setActiveTab('pedido')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="cart-outline"
                size={16}
                color={activeTab === 'pedido' ? theme.primary : theme.textSecondary}
              />
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === 'pedido' ? theme.primary : theme.textSecondary },
                  activeTab === 'pedido' && { fontWeight: '800' },
                ]}
              >
                PEDIDO {getCartItemCount() > 0 && `(${getCartItemCount()})`}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === '360' && { borderBottomColor: theme.primary },
              ]}
              onPress={() => setActiveTab('360')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="stats-chart-outline"
                size={16}
                color={activeTab === '360' ? theme.primary : theme.textSecondary}
              />
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === '360' ? theme.primary : theme.textSecondary },
                  activeTab === '360' && { fontWeight: '800' },
                ]}
              >
                FICHA 360
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === 'visita' && { borderBottomColor: theme.primary },
              ]}
              onPress={() => setActiveTab('visita')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="checkmark-done-outline"
                size={16}
                color={activeTab === 'visita' ? theme.primary : theme.textSecondary}
              />
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === 'visita' ? theme.primary : theme.textSecondary },
                  activeTab === 'visita' && { fontWeight: '800' },
                ]}
              >
                CIERRE
              </Text>
            </TouchableOpacity>
          </View>

          {/* TAB 1: PEDIDO */}
          {activeTab === 'pedido' && (
            <View style={styles.tabContent}>
              <View
                style={[
                  styles.searchBarContainer,
                  {
                    backgroundColor: isDark ? theme.cardLow : '#FFFFFF',
                    borderColor: theme.border,
                  },
                ]}
              >
                <Ionicons name="search" size={18} color={theme.textMuted} style={styles.searchIcon} />
                <TextInput
                  style={[styles.searchInput, { color: theme.text }]}
                  placeholder="Buscar producto por nombre o SKU..."
                  placeholderTextColor={theme.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  clearButtonMode="while-editing"
                />
              </View>

              {loadingProducts ? (
                <View style={styles.centerLoading}>
                  <ActivityIndicator size="large" color={theme.primary} />
                </View>
              ) : products.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="cube-outline" size={42} color={theme.textMuted} />
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>No se encontraron productos</Text>
                  <Text style={[styles.emptyBody, { color: theme.textMuted }]}>Intenta otra búsqueda o limpia los filtros</Text>
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

              {/* Barra Flotante Carrito */}
              <CartSummary
                itemCount={getCartItemCount()}
                totalAmount={getCartTotal()}
                onConfirmOrder={() =>
                  router.push({
                    pathname: '/(vendedor)/pedido/confirmar',
                    params: { customer_id: customerId },
                  })
                }
              />
            </View>
          )}

          {/* TAB 2: CLIENTE 360 */}
          {activeTab === '360' && (
            <ScrollView contentContainerStyle={styles.scroll360}>
              {loading360 ? (
                <ActivityIndicator size="large" color={theme.primary} />
              ) : customer360 ? (
                <>
                  {/* Tarjeta de Crédito */}
                  <Card style={styles.card360}>
                    <Text style={[styles.card360Title, { color: theme.text }]}>Situación Crediticia</Text>
                    <View style={styles.creditRow}>
                      <View>
                        <Text style={[styles.creditSubLabel, { color: theme.textMuted }]}>Disponible</Text>
                        <Text style={[styles.creditBigAmount, { color: theme.success }]}>
                          {formatGS(customer360.saldo_disponible)}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.creditSubLabel, { color: theme.textMuted }]}>Límite Total</Text>
                        <Text style={[styles.creditTotalAmount, { color: theme.textSecondary }]}>
                          {formatGS(customer360.credito_limite)}
                        </Text>
                      </View>
                    </View>

                    {customer360.documentos_vencidos > 0 && (
                      <View
                        style={[
                          styles.dangerAlertBox,
                          {
                            backgroundColor: isDark ? '#450A0A' : theme.dangerLight,
                          },
                        ]}
                      >
                        <Ionicons name="warning" size={16} color={theme.danger} />
                        <Text style={[styles.dangerAlertText, { color: theme.danger }]}>
                          {customer360.documentos_vencidos} factura(s) vencida(s) pendiente(s) de cobro
                        </Text>
                      </View>
                    )}
                  </Card>

                  {/* Sugerencias de Productos */}
                  {customer360.sugerencias && customer360.sugerencias.length > 0 && (
                    <Card style={styles.card360}>
                      <Text style={[styles.card360Title, { color: theme.text }]}>Sugerencias para este cliente</Text>
                      {customer360.sugerencias.map((sug: any) => (
                        <View
                          key={sug.product_id}
                          style={[styles.suggestionRow, { borderBottomColor: isDark ? '#232A34' : theme.borderLight }]}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.sugName, { color: theme.text }]}>{sug.nombre}</Text>
                            <Text style={[styles.sugReason, { color: theme.textMuted }]}>Motivo: {sug.motivo}</Text>
                          </View>
                          <Text style={[styles.sugPrice, { color: theme.primary }]}>{formatGS(sug.precio_venta)}</Text>
                        </View>
                      ))}
                    </Card>
                  )}

                  {/* Top Productos más comprados */}
                  {customer360.top_productos && customer360.top_productos.length > 0 && (
                    <Card style={styles.card360}>
                      <Text style={[styles.card360Title, { color: theme.text }]}>Productos Más Comprados</Text>
                      {customer360.top_productos.map((tp: any) => (
                        <View
                          key={tp.product_id}
                          style={[styles.topProdRow, { borderBottomColor: isDark ? '#232A34' : theme.borderLight }]}
                        >
                          <Text style={[styles.topProdName, { color: theme.text }]} numberOfLines={1}>
                            {tp.nombre}
                          </Text>
                          <Text style={[styles.topProdQty, { color: theme.textSecondary }]}>
                            {Math.round(tp.cantidad_total)} un.
                          </Text>
                        </View>
                      ))}
                    </Card>
                  )}

                  {/* Últimas compras */}
                  {customer360.ultimas_compras && customer360.ultimas_compras.length > 0 && (
                    <Card style={styles.card360}>
                      <Text style={[styles.card360Title, { color: theme.text }]}>Últimas Compras</Text>
                      {customer360.ultimas_compras.map((compra: any, idx: number) => (
                        <View
                          key={idx}
                          style={[styles.compraRow, { borderBottomColor: isDark ? '#232A34' : theme.borderLight }]}
                        >
                          <View>
                            <Text style={[styles.compraNum, { color: theme.text }]}>{compra.numero}</Text>
                            <Text style={[styles.compraFecha, { color: theme.textMuted }]}>{formatDate(compra.fecha)}</Text>
                          </View>
                          <Text style={[styles.compraTotal, { color: theme.primary }]}>{formatGS(compra.total)}</Text>
                        </View>
                      ))}
                    </Card>
                  )}
                </>
              ) : (
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>Sin información 360 disponible</Text>
              )}
            </ScrollView>
          )}

          {/* TAB 3: CIERRE DE VISITA */}
          {activeTab === 'visita' && (
            <ScrollView contentContainerStyle={styles.scrollCierre}>
              <Card style={styles.cardCierre}>
                <Text style={[styles.card360Title, { color: theme.text }]}>Resumen y Cierre de Visita</Text>
                <Text style={[styles.cierreSubtitle, { color: theme.textSecondary }]}>
                  Indica las observaciones o acuerdos alcanzados con el cliente antes de registrar la salida.
                </Text>

                <Input
                  label="Notas de la visita"
                  placeholder="Ej: Cliente solicitó pasar el próximo jueves..."
                  value={checkoutNotes}
                  onChangeText={setCheckoutNotes}
                  multiline
                  numberOfLines={3}
                  style={{ minHeight: 80, textAlignVertical: 'top' }}
                />

                <View style={styles.cierreActions}>
                  <Button
                    title="Cerrar Con Pedido"
                    variant="success"
                    size="lg"
                    loading={closingVisit}
                    onPress={() => handleCheckout(true)}
                    icon={<Ionicons name="cart" size={20} color={isDark ? '#002109' : '#FFFFFF'} />}
                    style={{ marginBottom: 12 }}
                  />

                  <Button
                    title="Cerrar Sin Pedido"
                    variant="warning"
                    size="lg"
                    loading={closingVisit}
                    onPress={() => handleCheckout(false)}
                    icon={<Ionicons name="close-circle-outline" size={20} color="#FFFFFF" />}
                  />
                </View>
              </Card>
            </ScrollView>
          )}
        </View>
      )}
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
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  timerText: {
    fontSize: 13,
    fontWeight: '800',
  },
  checkinScroll: {
    padding: 16,
    alignItems: 'center',
  },
  clientDetailCard: {
    width: '100%',
    padding: 18,
    marginBottom: 20,
  },
  clientIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  clientAvatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clientName: {
    fontSize: 17,
    fontWeight: '800',
  },
  clientRuc: {
    fontSize: 13,
    marginTop: 2,
  },
  clientAddress: {
    fontSize: 12,
    marginTop: 2,
  },
  creditPreview: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  creditLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  creditAmount: {
    fontSize: 16,
    fontWeight: '800',
  },
  checkinBox: {
    width: '100%',
    alignItems: 'center',
  },
  checkinInstruction: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  activeVisitContainer: {
    flex: 1,
  },
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 8,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  tabContent: {
    flex: 1,
    position: 'relative',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
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
  },
  emptyBody: {
    fontSize: 13,
  },
  scroll360: {
    padding: 16,
    paddingBottom: 40,
  },
  card360: {
    padding: 16,
    marginBottom: 12,
  },
  card360Title: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 12,
  },
  creditRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  creditSubLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
  },
  creditBigAmount: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  creditTotalAmount: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  dangerAlertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    marginTop: 12,
    gap: 6,
  },
  dangerAlertText: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  suggestionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  sugName: {
    fontSize: 13,
    fontWeight: '700',
  },
  sugReason: {
    fontSize: 11,
  },
  sugPrice: {
    fontSize: 13,
    fontWeight: '800',
  },
  topProdRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  topProdName: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  topProdQty: {
    fontSize: 13,
    fontWeight: '800',
  },
  compraRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  compraNum: {
    fontSize: 13,
    fontWeight: '700',
  },
  compraFecha: {
    fontSize: 11,
  },
  compraTotal: {
    fontSize: 14,
    fontWeight: '800',
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 20,
  },
  scrollCierre: {
    padding: 16,
  },
  cardCierre: {
    padding: 18,
  },
  cierreSubtitle: {
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  cierreActions: {
    marginTop: 16,
  },
});
