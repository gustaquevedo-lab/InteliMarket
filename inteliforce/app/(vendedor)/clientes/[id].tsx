// app/(vendedor)/clientes/[id].tsx
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/hooks/useTheme';
import { api } from '@/lib/api';
import { formatGS } from '@/lib/format';

interface PendingInvoiceItem {
  id?: string;
  numero?: string;
  fecha_emision?: string;
  fecha_vencimiento?: string;
  monto_total: number;
  saldo_pendiente: number;
  dias_atraso: number;
  vencido: boolean;
}

interface TopProductItem {
  product_id: string;
  nombre: string;
  sku: string;
  compras_recientes: number;
  precio_habitual: number;
  linea_nombre?: string;
}

interface SuggestionItem {
  product_id: string;
  nombre: string;
  sku: string;
  precio_venta: number;
  motivo: string;
  linea_nombre?: string;
}

interface Customer360Data {
  customer_id: string;
  razon_social: string;
  nombre_fantasia?: string;
  ruc?: string;
  ci?: string;
  codigo_interno?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  latitud?: number;
  longitud?: number;
  credito_limite: number;
  credito_usado: number;
  saldo_disponible: number;
  dias_plazo?: number;
  cuentas_por_cobrar_pendiente: number;
  documentos_vencidos: number;
  cheques_en_cartera: number;
  cheques_rechazados: number;
  pagares: number;
  deuda_total_consolidada: number;
  estado_credito: 'normal' | 'moroso' | 'bloqueado';
  facturas_pendientes: PendingInvoiceItem[];
  ultimas_compras: Array<{
    numero?: string;
    fecha?: string;
    total?: number;
    estado?: string;
  }>;
  top_productos: TopProductItem[];
  sugerencias: SuggestionItem[];
  marco_sugerencia?: string;
  marco_analisis?: {
    dias_sin_compra?: number | null;
    nivel_riesgo?: string;
    oportunidad_reposicion?: boolean;
    top_linea?: string;
  };
}

export default function Customer360Screen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id: customerId, razon_social } = useLocalSearchParams<{
    id: string;
    razon_social?: string;
  }>();
  const { theme, isDark } = useTheme();

  const [activeTab, setActiveTab] = useState<'finanzas' | 'frecuencia' | 'sugerencias' | 'ubicacion'>('finanzas');

  const {
    data: customer,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<Customer360Data>({
    queryKey: ['customer-360-detail', customerId],
    queryFn: async () => {
      return await api.get<Customer360Data>(`/customers/${customerId}/360`);
    },
    enabled: Boolean(customerId),
  });

  const clientName = customer?.razon_social || razon_social || 'Cliente Casa Gonzalito';
  const fantasia = customer?.nombre_fantasia;
  const codigo = customer?.codigo_interno || (customerId ? customerId.substring(0, 8).toUpperCase() : '');

  // Calculo de uso de crédito porcentual
  const creditUsagePct = useMemo(() => {
    if (!customer || !customer.credito_limite || customer.credito_limite <= 0) return 0;
    const pct = (customer.credito_usado / customer.credito_limite) * 100;
    return Math.min(100, Math.max(0, Math.round(pct)));
  }, [customer]);

  const estadoBadge = useMemo(() => {
    if (!customer) return { label: 'Al Día', color: '#10B981', bg: isDark ? '#064E3B' : '#D1FAE5' };
    if (customer.documentos_vencidos > 0 || customer.estado_credito === 'moroso') {
      return {
        label: `Moroso (${customer.documentos_vencidos} Vencidos)`,
        color: '#EF4444',
        bg: isDark ? '#7F1D1D' : '#FEE2E2',
      };
    }
    if (customer.saldo_disponible <= 0 && customer.credito_limite > 0) {
      return {
        label: 'Límite Excedido',
        color: '#F59E0B',
        bg: isDark ? '#78350F' : '#FEF3C7',
      };
    }
    return {
      label: 'Al Día / Normal',
      color: '#10B981',
      bg: isDark ? '#064E3B' : '#D1FAE5',
    };
  }, [customer, isDark]);

  const handleCall = () => {
    if (!customer?.telefono) {
      Alert.alert('Sin Teléfono', 'Este cliente no tiene teléfono registrado.');
      return;
    }
    Linking.openURL(`tel:${customer.telefono.replace(/[^\d+]/g, '')}`);
  };

  const handleWhatsApp = () => {
    if (!customer?.telefono) {
      Alert.alert('Sin Teléfono', 'Este cliente no tiene número telefónico para WhatsApp.');
      return;
    }
    let cleanPhone = customer.telefono.replace(/[^\d]/g, '');
    if (!cleanPhone.startsWith('595')) {
      if (cleanPhone.startsWith('0')) cleanPhone = cleanPhone.substring(1);
      cleanPhone = `595${cleanPhone}`;
    }
    Linking.openURL(`whatsapp://send?phone=${cleanPhone}&text=Hola ${clientName}, le saludo de Casa Gonzalito.`);
  };

  const handleOpenMaps = () => {
    if (customer?.latitud && customer?.longitud) {
      const url = `https://www.google.com/maps/search/?api=1&query=${customer.latitud},${customer.longitud}`;
      Linking.openURL(url);
    } else if (customer?.direccion) {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customer.direccion + ', Paraguay')}`;
      Linking.openURL(url);
    } else {
      Alert.alert('Sin Ubicación', 'No hay dirección o coordenadas registradas para este cliente.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Header */}
      <View
        style={[
          styles.headerBar,
          {
            paddingTop: insets.top + 8,
            backgroundColor: isDark ? '#0F172A' : '#012611',
            borderBottomColor: theme.border,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {clientName}
            </Text>
            <Text style={styles.headerSubtitle}>
              CLIENTE 360 • CÓD: {codigo}
            </Text>
          </View>
        </View>

        {/* Quick Contact Bar */}
        <View style={styles.quickContactRow}>
          <TouchableOpacity
            style={[styles.quickBtn, { backgroundColor: '#10B981' }]}
            onPress={handleCall}
            activeOpacity={0.8}
          >
            <Ionicons name="call" size={15} color="#FFFFFF" />
            <Text style={styles.quickBtnText}>Llamar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickBtn, { backgroundColor: '#25D366' }]}
            onPress={handleWhatsApp}
            activeOpacity={0.8}
          >
            <Ionicons name="logo-whatsapp" size={15} color="#FFFFFF" />
            <Text style={styles.quickBtnText}>WhatsApp</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickBtn, { backgroundColor: '#38BDF8' }]}
            onPress={handleOpenMaps}
            activeOpacity={0.8}
          >
            <Ionicons name="map" size={15} color="#0F172A" />
            <Text style={[styles.quickBtnText, { color: '#0F172A' }]}>GPS Mapa</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Cargando Ficha 360 del Cliente...
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 30 }]}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={theme.primary}
            />
          }
        >
          {/* Tarjeta Hero Principal del Cliente */}
          <Card style={[styles.heroCard, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
            <View style={styles.heroTop}>
              <View style={{ flex: 1 }}>
                {fantasia ? (
                  <>
                    <Text style={[styles.heroFantasia, { color: theme.text }]}>{fantasia}</Text>
                    <Text style={[styles.heroRazonSocial, { color: theme.textSecondary }]}>
                      {clientName}
                    </Text>
                  </>
                ) : (
                  <Text style={[styles.heroFantasia, { color: theme.text }]}>{clientName}</Text>
                )}

                <View style={styles.tagsRow}>
                  {customer?.ruc && (
                    <View style={[styles.infoTag, { backgroundColor: isDark ? '#0F172A' : '#F1F5F9' }]}>
                      <Text style={[styles.infoTagText, { color: theme.textMuted }]}>
                        RUC: {customer.ruc}
                      </Text>
                    </View>
                  )}
                  {customer?.ci && (
                    <View style={[styles.infoTag, { backgroundColor: isDark ? '#0F172A' : '#F1F5F9' }]}>
                      <Text style={[styles.infoTagText, { color: theme.textMuted }]}>
                        CI: {customer.ci}
                      </Text>
                    </View>
                  )}
                  {customer?.dias_plazo !== undefined && (
                    <View style={[styles.infoTag, { backgroundColor: isDark ? '#0F172A' : '#F1F5F9' }]}>
                      <Text style={[styles.infoTagText, { color: theme.textMuted }]}>
                        Plazo: {customer.dias_plazo} días
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={[styles.statusBadge, { backgroundColor: estadoBadge.bg }]}>
                <Text style={[styles.statusBadgeText, { color: estadoBadge.color }]}>
                  {estadoBadge.label}
                </Text>
              </View>
            </View>

            {customer?.direccion && (
              <View style={styles.direccionRow}>
                <Ionicons name="location-outline" size={16} color={theme.textMuted} />
                <Text style={[styles.direccionText, { color: theme.textSecondary }]} numberOfLines={2}>
                  {customer.direccion}
                </Text>
              </View>
            )}

            {/* CTAs de Campo */}
            <View style={styles.heroActionsRow}>
              <Button
                title="Iniciar Visita"
                size="md"
                variant="primary"
                icon={<Ionicons name="location" size={18} color={isDark ? '#002109' : '#FFFFFF'} />}
                onPress={() =>
                  router.push({
                    pathname: '/(vendedor)/visita/[id]',
                    params: { id: customerId, razon_social: clientName },
                  })
                }
                style={{ flex: 1 }}
              />

              <Button
                title="Nuevo Pedido"
                size="md"
                variant="secondary"
                icon={<Ionicons name="cart" size={18} color={theme.text} />}
                onPress={() =>
                  router.push({
                    pathname: '/(vendedor)/pedido',
                    params: { customerId, razon_social: clientName },
                  })
                }
                style={{ flex: 1 }}
              />
            </View>
          </Card>

          {/* Card de Marco - Asistente de Inteligencia Comercial */}
          {customer?.marco_sugerencia && (
            <Card
              style={[
                styles.marcoCard,
                {
                  backgroundColor: isDark ? '#0F172A' : '#F0FDF4',
                  borderColor: isDark ? '#1E3A5F' : '#BBF7D0',
                },
              ]}
            >
              <View style={styles.marcoHeader}>
                <View style={styles.marcoTitleRow}>
                  <View style={[styles.marcoIconCircle, { backgroundColor: isDark ? '#1E293B' : '#DCFCE7' }]}>
                    <Ionicons name="sparkles" size={16} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.marcoTitle, { color: theme.text }]}>Marco (IA Comercial)</Text>
                    <Text style={[styles.marcoSubtitle, { color: theme.textSecondary }]}>
                      Sugerencia de pedido y diagnóstico en tiempo real
                    </Text>
                  </View>
                </View>
                <View style={[styles.marcoBadge, { backgroundColor: isDark ? '#064E3B' : '#D1FAE5' }]}>
                  <Text style={[styles.marcoBadgeText, { color: '#10B981' }]}>IA Activa</Text>
                </View>
              </View>

              <Text style={[styles.marcoText, { color: theme.text }]}>
                {customer.marco_sugerencia}
              </Text>

              {customer.marco_analisis && (
                <View style={[styles.marcoMetaRow, { borderTopColor: isDark ? '#1E293B' : '#DCFCE7' }]}>
                  {customer.marco_analisis.dias_sin_compra !== null && customer.marco_analisis.dias_sin_compra !== undefined && (
                    <Text style={[styles.marcoMetaText, { color: theme.textMuted }]}>
                      ⏱️ Sin compra: <Text style={{ fontWeight: '800', color: theme.text }}>{customer.marco_analisis.dias_sin_compra}d</Text>
                    </Text>
                  )}
                  <Text style={[styles.marcoMetaText, { color: theme.textMuted }]}>
                    📦 Foco: <Text style={{ fontWeight: '800', color: theme.text }}>{customer.marco_analisis.top_linea}</Text>
                  </Text>
                  <Text style={[styles.marcoMetaText, { color: theme.textMuted }]}>
                    🛡️ Riesgo:{' '}
                    <Text
                      style={{
                        fontWeight: '800',
                        color: customer.marco_analisis.nivel_riesgo === 'alto' ? '#EF4444' : theme.text,
                      }}
                    >
                      {customer.marco_analisis.nivel_riesgo?.toUpperCase()}
                    </Text>
                  </Text>
                </View>
              )}
            </Card>
          )}

          {/* Sub-tabs segmentados */}
          <View style={styles.subtabsContainer}>
            <TouchableOpacity
              style={[
                styles.subtabBtn,
                activeTab === 'finanzas' && { backgroundColor: theme.primary },
              ]}
              onPress={() => setActiveTab('finanzas')}
            >
              <Text
                style={[
                  styles.subtabText,
                  { color: activeTab === 'finanzas' ? (isDark ? '#002109' : '#FFFFFF') : '#94A3B8' },
                ]}
              >
                Finanzas
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.subtabBtn,
                activeTab === 'frecuencia' && { backgroundColor: theme.primary },
              ]}
              onPress={() => setActiveTab('frecuencia')}
            >
              <Text
                style={[
                  styles.subtabText,
                  { color: activeTab === 'frecuencia' ? (isDark ? '#002109' : '#FFFFFF') : '#94A3B8' },
                ]}
              >
                Frecuencia
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.subtabBtn,
                activeTab === 'sugerencias' && { backgroundColor: theme.primary },
              ]}
              onPress={() => setActiveTab('sugerencias')}
            >
              <Text
                style={[
                  styles.subtabText,
                  { color: activeTab === 'sugerencias' ? (isDark ? '#002109' : '#FFFFFF') : '#94A3B8' },
                ]}
              >
                Sugerencias IA ({customer?.sugerencias?.length || 0})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.subtabBtn,
                activeTab === 'ubicacion' && { backgroundColor: theme.primary },
              ]}
              onPress={() => setActiveTab('ubicacion')}
            >
              <Text
                style={[
                  styles.subtabText,
                  { color: activeTab === 'ubicacion' ? (isDark ? '#002109' : '#FFFFFF') : '#94A3B8' },
                ]}
              >
                Ubicación
              </Text>
            </TouchableOpacity>
          </View>

          {/* TAB 1: FINANZAS Y CRÉDITO */}
          {activeTab === 'finanzas' && (
            <>
              {/* Tarjeta de Línea de Crédito */}
              <Card style={[styles.card, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
                <Text style={[styles.cardSectionTitle, { color: theme.textSecondary }]}>
                  LÍNEA DE CRÉDITO Y SALDO DISPONIBLE
                </Text>

                <View style={styles.creditBigStats}>
                  <View>
                    <Text style={[styles.creditLabel, { color: theme.textMuted }]}>
                      SALDO DISPONIBLE
                    </Text>
                    <Text style={[styles.creditDispo, { color: '#10B981' }]}>
                      {formatGS(customer?.saldo_disponible || 0)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.creditLabel, { color: theme.textMuted }]}>
                      LÍMITE TOTAL
                    </Text>
                    <Text style={[styles.creditLimit, { color: theme.textSecondary }]}>
                      {formatGS(customer?.credito_limite || 0)}
                    </Text>
                  </View>
                </View>

                {/* Barra gráfica de progreso */}
                <View style={[styles.progressTrack, { backgroundColor: isDark ? '#0F172A' : '#E2E8F0' }]}>
                  <View
                    style={[
                      styles.progressBar,
                      {
                        width: `${creditUsagePct}%`,
                        backgroundColor:
                          creditUsagePct > 90 ? '#EF4444' : creditUsagePct > 70 ? '#F59E0B' : '#10B981',
                      },
                    ]}
                  />
                </View>
                <View style={styles.progressLabels}>
                  <Text style={[styles.pctLabel, { color: theme.textMuted }]}>
                    Crédito Utilizado: {formatGS(customer?.credito_usado || 0)} ({creditUsagePct}%)
                  </Text>
                  <Text style={[styles.pctLabel, { color: theme.textMuted }]}>
                    Plazo: {customer?.dias_plazo ? `${customer.dias_plazo} días` : 'Contado'}
                  </Text>
                </View>

                {/* Alerta de Documentos Vencidos */}
                {customer && customer.documentos_vencidos > 0 && (
                  <View
                    style={[
                      styles.alertVencidos,
                      { backgroundColor: isDark ? '#450A0A' : '#FEE2E2', borderColor: '#EF4444' },
                    ]}
                  >
                    <Ionicons name="alert-circle" size={22} color="#EF4444" />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.alertTitle, { color: '#EF4444' }]}>
                        {customer.documentos_vencidos} FACTURA(S) VENCIDA(S)
                      </Text>
                      <Text style={[styles.alertSub, { color: '#B91C1C' }]}>
                        El cliente posee saldo en mora. Requiere cobro antes de emitir nuevos pedidos a crédito.
                      </Text>
                    </View>
                  </View>
                )}
              </Card>

              {/* Tarjeta de Cartera y Valores */}
              <Card style={[styles.card, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
                <Text style={[styles.cardSectionTitle, { color: theme.textSecondary }]}>
                  ESTADO CONSOLIDADO DE CUENTAS
                </Text>

                <View style={styles.carteraGrid}>
                  <View
                    style={[
                      styles.carteraBox,
                      { backgroundColor: isDark ? '#0F172A' : '#F8FAFC', borderColor: theme.border },
                    ]}
                  >
                    <Text style={[styles.carteraVal, { color: theme.text }]}>
                      {formatGS(customer?.cuentas_por_cobrar_pendiente || 0)}
                    </Text>
                    <Text style={[styles.carteraLabel, { color: theme.textMuted }]}>
                      Facturas por Cobrar
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.carteraBox,
                      { backgroundColor: isDark ? '#0F172A' : '#F8FAFC', borderColor: theme.border },
                    ]}
                  >
                    <Text style={[styles.carteraVal, { color: '#38BDF8' }]}>
                      {formatGS(customer?.cheques_en_cartera || 0)}
                    </Text>
                    <Text style={[styles.carteraLabel, { color: theme.textMuted }]}>
                      Cheques en Cartera
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.carteraBox,
                      { backgroundColor: isDark ? '#0F172A' : '#F8FAFC', borderColor: theme.border },
                    ]}
                  >
                    <Text style={[styles.carteraVal, { color: customer?.cheques_rechazados ? '#EF4444' : theme.text }]}>
                      {formatGS(customer?.cheques_rechazados || 0)}
                    </Text>
                    <Text style={[styles.carteraLabel, { color: theme.textMuted }]}>
                      Cheques Rechazados
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.carteraBox,
                      { backgroundColor: isDark ? '#0F172A' : '#F8FAFC', borderColor: theme.border },
                    ]}
                  >
                    <Text style={[styles.carteraVal, { color: '#F59E0B' }]}>
                      {formatGS(customer?.deuda_total_consolidada || 0)}
                    </Text>
                    <Text style={[styles.carteraLabel, { color: theme.textMuted }]}>
                      Deuda Total Consolidada
                    </Text>
                  </View>
                </View>
              </Card>

              {/* Listado de Facturas Pendientes */}
              <Card style={[styles.card, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
                <Text style={[styles.cardSectionTitle, { color: theme.textSecondary }]}>
                  FACTURAS PENDIENTES DE COBRO ({customer?.facturas_pendientes?.length || 0})
                </Text>

                {customer?.facturas_pendientes && customer.facturas_pendientes.length > 0 ? (
                  customer.facturas_pendientes.map((fact, index) => (
                    <View
                      key={fact.id || index}
                      style={[
                        styles.invoiceRow,
                        { borderBottomColor: isDark ? '#334155' : '#E2E8F0' },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.invoiceNum, { color: theme.text }]}>
                            {fact.numero || 'Factura'}
                          </Text>
                          {fact.vencido && (
                            <View style={styles.badgeVencidoMini}>
                              <Text style={styles.badgeVencidoMiniText}>Vencida</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.invoiceDate, { color: theme.textMuted }]}>
                          Vencimiento: {fact.fecha_vencimiento || '—'}
                          {fact.dias_atraso > 0 ? ` (${fact.dias_atraso}d mora)` : ''}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.invoiceSaldo, { color: fact.vencido ? '#EF4444' : theme.text }]}>
                          {formatGS(fact.saldo_pendiente)}
                        </Text>
                        <Text style={[styles.invoiceTotal, { color: theme.textMuted }]}>
                          Total: {formatGS(fact.monto_total)}
                        </Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyContainer}>
                    <Ionicons name="checkmark-circle-outline" size={32} color="#10B981" />
                    <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                      El cliente no posee facturas pendientes. ¡Cuenta al día!
                    </Text>
                  </View>
                )}
              </Card>
            </>
          )}

          {/* TAB 2: FRECUENCIA Y CATÁLOGO HABITUAL */}
          {activeTab === 'frecuencia' && (
            <>
              {/* Top Productos habituales */}
              <Card style={[styles.card, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
                <Text style={[styles.cardSectionTitle, { color: theme.textSecondary }]}>
                  CATÁLOGO DE FRECUENCIA (TOP COMPRADOS)
                </Text>

                {customer?.top_productos && customer.top_productos.length > 0 ? (
                  customer.top_productos.map((prod) => (
                    <View
                      key={prod.product_id}
                      style={[
                        styles.productItemRow,
                        { borderBottomColor: isDark ? '#334155' : '#E2E8F0' },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.prodName, { color: theme.text }]}>
                          {prod.nombre}
                        </Text>
                        <Text style={[styles.prodMeta, { color: theme.textMuted }]}>
                          SKU: {prod.sku} {prod.linea_nombre ? `• ${prod.linea_nombre}` : ''}
                        </Text>
                        <Text style={[styles.prodCompras, { color: '#38BDF8' }]}>
                          {prod.compras_recientes} pedidos registrados
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 6 }}>
                        <Text style={[styles.prodPrice, { color: theme.primary }]}>
                          {formatGS(prod.precio_habitual)}
                        </Text>
                        <TouchableOpacity
                          style={[styles.addBtnMini, { backgroundColor: theme.primary }]}
                          onPress={() =>
                            router.push({
                              pathname: '/(vendedor)/pedido',
                              params: { customerId, preselectedSku: prod.sku },
                            })
                          }
                          activeOpacity={0.7}
                        >
                          <Ionicons name="add" size={16} color={isDark ? '#002109' : '#FFFFFF'} />
                          <Text
                            style={[
                              styles.addBtnText,
                              { color: isDark ? '#002109' : '#FFFFFF' },
                            ]}
                          >
                            Pedir
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyContainer}>
                    <Ionicons name="basket-outline" size={32} color={theme.textMuted} />
                    <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                      Sin productos habituales registrados aún.
                    </Text>
                  </View>
                )}
              </Card>

              {/* Historial de Últimas Compras */}
              <Card style={[styles.card, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
                <Text style={[styles.cardSectionTitle, { color: theme.textSecondary }]}>
                  HISTORIAL DE VENTAS RECIENTES ({customer?.ultimas_compras?.length || 0})
                </Text>

                {customer?.ultimas_compras && customer.ultimas_compras.length > 0 ? (
                  customer.ultimas_compras.map((compra, i) => (
                    <View
                      key={i}
                      style={[
                        styles.compraRow,
                        { borderBottomColor: isDark ? '#334155' : '#E2E8F0' },
                      ]}
                    >
                      <View>
                        <Text style={[styles.compraNum, { color: theme.text }]}>
                          Factura #{compra.numero || 'S/N'}
                        </Text>
                        <Text style={[styles.compraFecha, { color: theme.textMuted }]}>
                          {compra.fecha ? String(compra.fecha).substring(0, 10) : '—'}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.compraTotal, { color: theme.primary }]}>
                          {formatGS(compra.total || 0)}
                        </Text>
                        <Text style={[styles.compraEstado, { color: '#10B981' }]}>
                          {compra.estado || 'confirmado'}
                        </Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyContainer}>
                    <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                      No hay compras recientes registradas.
                    </Text>
                  </View>
                )}
              </Card>
            </>
          )}

          {/* TAB 3: OPORTUNIDADES Y SUGERENCIAS IA */}
          {activeTab === 'sugerencias' && (
            <Card style={[styles.card, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
              <Text style={[styles.cardSectionTitle, { color: theme.textSecondary }]}>
                OPORTUNIDADES DE VENTA RECOMENDADAS POR IA
              </Text>
              <Text style={[styles.cardSectionSub, { color: theme.textMuted }]}>
                Sugerencias basadas en historial de recompra y productos líderes de su rubro.
              </Text>

              {customer?.sugerencias && customer.sugerencias.length > 0 ? (
                customer.sugerencias.map((sug) => {
                  const isWinback = sug.motivo.includes('no_compra');
                  return (
                    <View
                      key={sug.product_id}
                      style={[
                        styles.sugCard,
                        {
                          backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                          borderColor: theme.border,
                        },
                      ]}
                    >
                      <View style={styles.sugHeader}>
                        <View
                          style={[
                            styles.sugBadge,
                            {
                              backgroundColor: isWinback
                                ? isDark ? '#78350F' : '#FEF3C7'
                                : isDark ? '#064E3B' : '#D1FAE5',
                            },
                          ]}
                        >
                          <Ionicons
                            name={isWinback ? 'refresh-circle' : 'trending-up'}
                            size={14}
                            color={isWinback ? '#D97706' : '#10B981'}
                          />
                          <Text
                            style={[
                              styles.sugBadgeText,
                              { color: isWinback ? '#D97706' : '#10B981' },
                            ]}
                          >
                            {isWinback ? 'Recuperar Recompra' : 'Top Cross-Selling'}
                          </Text>
                        </View>
                        <Text style={[styles.sugPrice, { color: theme.primary }]}>
                          {formatGS(sug.precio_venta)}
                        </Text>
                      </View>

                      <Text style={[styles.sugName, { color: theme.text }]}>{sug.nombre}</Text>
                      <Text style={[styles.sugLine, { color: theme.textMuted }]}>
                        Línea: {sug.linea_nombre || 'General'} • SKU: {sug.sku}
                      </Text>

                      <Button
                        title="Agregar a Pedido"
                        size="sm"
                        variant="primary"
                        icon={<Ionicons name="cart-outline" size={16} color={isDark ? '#002109' : '#FFFFFF'} />}
                        onPress={() =>
                          router.push({
                            pathname: '/(vendedor)/pedido',
                            params: { customerId, preselectedSku: sug.sku },
                          })
                        }
                        style={{ marginTop: 10 }}
                      />
                    </View>
                  );
                })
              ) : (
                <View style={styles.emptyContainer}>
                  <Ionicons name="sparkles-outline" size={32} color={theme.primary} />
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                    No hay sugerencias pendientes para este cliente.
                  </Text>
                </View>
              )}
            </Card>
          )}

          {/* TAB 4: UBICACIÓN Y CONTACTO */}
          {activeTab === 'ubicacion' && (
            <Card style={[styles.card, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
              <Text style={[styles.cardSectionTitle, { color: theme.textSecondary }]}>
                DATOS DE GEOLOCALIZACIÓN Y CONTACTO
              </Text>

              <View style={styles.ubicaList}>
                <View style={styles.ubicaItem}>
                  <Ionicons name="business-outline" size={20} color={theme.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.ubicaLabel, { color: theme.textMuted }]}>RAZÓN SOCIAL</Text>
                    <Text style={[styles.ubicaVal, { color: theme.text }]}>{clientName}</Text>
                  </View>
                </View>

                {customer?.direccion && (
                  <View style={styles.ubicaItem}>
                    <Ionicons name="location-outline" size={20} color={theme.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.ubicaLabel, { color: theme.textMuted }]}>DIRECCIÓN</Text>
                      <Text style={[styles.ubicaVal, { color: theme.text }]}>{customer.direccion}</Text>
                    </View>
                  </View>
                )}

                {customer?.telefono && (
                  <View style={styles.ubicaItem}>
                    <Ionicons name="call-outline" size={20} color={theme.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.ubicaLabel, { color: theme.textMuted }]}>TELÉFONO DE CONTACTO</Text>
                      <Text style={[styles.ubicaVal, { color: theme.text }]}>{customer.telefono}</Text>
                    </View>
                  </View>
                )}

                {customer?.email && (
                  <View style={styles.ubicaItem}>
                    <Ionicons name="mail-outline" size={20} color={theme.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.ubicaLabel, { color: theme.textMuted }]}>CORREO ELECTRÓNICO</Text>
                      <Text style={[styles.ubicaVal, { color: theme.text }]}>{customer.email}</Text>
                    </View>
                  </View>
                )}

                <View style={styles.ubicaItem}>
                  <Ionicons name="navigate-circle-outline" size={20} color={theme.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.ubicaLabel, { color: theme.textMuted }]}>COORDENADAS GPS</Text>
                    <Text style={[styles.ubicaVal, { color: theme.text }]}>
                      {customer?.latitud && customer?.longitud
                        ? `${customer.latitud.toFixed(5)}, ${customer.longitud.toFixed(5)}`
                        : 'Coordenadas no registradas'}
                    </Text>
                  </View>
                </View>
              </View>

              <Button
                title="Abrir en Google Maps / Waze"
                size="md"
                variant="primary"
                icon={<Ionicons name="navigate" size={18} color={isDark ? '#002109' : '#FFFFFF'} />}
                onPress={handleOpenMaps}
                style={{ marginTop: 16 }}
              />
            </Card>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  quickContactRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 8,
    gap: 6,
  },
  quickBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  heroCard: {
    padding: 16,
    borderRadius: 16,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  heroFantasia: {
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  heroRazonSocial: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  infoTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  infoTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },
  direccionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  direccionText: {
    fontSize: 12,
    flex: 1,
  },
  heroActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  subtabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#0A0F1D',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  subtabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  subtabText: {
    fontSize: 11,
    fontWeight: '800',
  },
  card: {
    padding: 16,
    borderRadius: 16,
  },
  cardSectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  cardSectionSub: {
    fontSize: 12,
    marginBottom: 14,
  },
  creditBigStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  creditLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  creditDispo: {
    fontSize: 22,
    fontWeight: '900',
    marginTop: 2,
  },
  creditLimit: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pctLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  alertVencidos: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    marginTop: 14,
  },
  alertTitle: {
    fontSize: 12,
    fontWeight: '900',
  },
  alertSub: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
  carteraGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  carteraBox: {
    width: '48%',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  carteraVal: {
    fontSize: 16,
    fontWeight: '900',
  },
  carteraLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 3,
  },
  invoiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  invoiceNum: {
    fontSize: 13,
    fontWeight: '800',
  },
  badgeVencidoMini: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  badgeVencidoMiniText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  invoiceDate: {
    fontSize: 11,
    marginTop: 2,
  },
  invoiceSaldo: {
    fontSize: 14,
    fontWeight: '900',
  },
  invoiceTotal: {
    fontSize: 11,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 6,
  },
  emptyText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  productItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  prodName: {
    fontSize: 13,
    fontWeight: '800',
  },
  prodMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  prodCompras: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  prodPrice: {
    fontSize: 14,
    fontWeight: '900',
  },
  addBtnMini: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  addBtnText: {
    fontSize: 11,
    fontWeight: '800',
  },
  compraRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  compraNum: {
    fontSize: 13,
    fontWeight: '800',
  },
  compraFecha: {
    fontSize: 11,
    marginTop: 2,
  },
  compraTotal: {
    fontSize: 14,
    fontWeight: '900',
  },
  compraEstado: {
    fontSize: 11,
    fontWeight: '700',
  },
  sugCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  sugHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sugBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  sugBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  sugPrice: {
    fontSize: 15,
    fontWeight: '900',
  },
  sugName: {
    fontSize: 14,
    fontWeight: '800',
  },
  sugLine: {
    fontSize: 11,
    marginTop: 2,
  },
  ubicaList: {
    gap: 14,
  },
  ubicaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ubicaLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  ubicaVal: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 1,
  },
  marcoCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  marcoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  marcoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  marcoIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marcoTitle: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  marcoSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  marcoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  marcoBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  marcoText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    marginBottom: 10,
  },
  marcoMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
  },
  marcoMetaText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
