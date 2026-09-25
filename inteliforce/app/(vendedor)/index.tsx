// app/(vendedor)/index.tsx
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { VisitCard, RouteStop } from '@/components/visita/VisitCard';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { InteliforceLogo } from '@/components/ui/InteliforceLogo';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from '@/hooks/useLocation';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { useTheme } from '@/hooks/useTheme';
import { useVisit } from '@/hooks/useVisit';
import { api } from '@/lib/api';
import { offlineDb } from '@/lib/offline/db';
import { formatGS } from '@/lib/format';
import { ThemeColors } from '@/constants/colors';

interface TargetsSummary {
  progress?: {
    meta_gs: number;
    venta_gs: number;
    pct_gs: number;
  };
}

function calculateDistanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export default function VendedorDashboard() {
  const { user, logout } = useAuth();
  const { theme, isDark, toggleTheme } = useTheme();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);
  const router = useRouter();
  const { location, accuracy, requestFix, isLocating } = useLocation();
  const { isConnected, pendingCount, isSyncing, triggerSync } = useOfflineQueue();
  const { startVisit } = useVisit();

  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Estado para la ficha interactiva del cliente en ruta
  const [selectedStop, setSelectedStop] = useState<RouteStop | null>(null);

  // Estado para el modal de actualización de ubicación GPS
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [updatingLocation, setUpdatingLocation] = useState(false);
  const [updateMotivo, setUpdateMotivo] = useState('precision_gps');
  const [updateNotas, setUpdateNotas] = useState('');

  // Query Ruta del día
  const {
    data: routes = [],
    isLoading: loadingRoutes,
    isRefetching: refetchingRoutes,
    refetch: refetchRoutes,
  } = useQuery<RouteStop[]>({
    queryKey: ['vendedor-routes-today'],
    staleTime: 60 * 1000,
    retry: 1,
    queryFn: async (): Promise<RouteStop[]> => {
      try {
        const [stops, visits] = await Promise.all([
          api.get<RouteStop[]>('/me/routes/today'),
          api.get<any[]>('/visits/today').catch(() => []),
        ]);
        const visitMap = new Map(visits.map((v) => [v.customer_id, v.estado]));

        const enriched: RouteStop[] = stops.map((s) => ({
          ...s,
          estado: (visitMap.get(s.customer_id) || 'pendiente') as any,
        }));

        offlineDb.saveCachedRoutes(
          enriched.map((s) => ({
            customer_id: s.customer_id,
            razon_social: s.razon_social,
            direccion: s.direccion || null,
            orden_visita: s.orden_visita,
            gps_lat: s.latitud ?? null,
            gps_lng: s.longitud ?? null,
            cached_at: Date.now(),
          }))
        ).catch(() => {});

        return enriched;
      } catch {
        const cached = await offlineDb.getCachedRoutes();
        return cached.map((c): RouteStop => ({
          customer_id: c.customer_id,
          razon_social: c.razon_social,
          direccion: c.direccion || undefined,
          orden_visita: c.orden_visita,
          latitud: c.gps_lat ?? undefined,
          longitud: c.gps_lng ?? undefined,
          estado: 'pendiente',
        }));
      }
    },
  });

  // Query Metas
  const { data: targets, refetch: refetchTargets } = useQuery<TargetsSummary>({
    queryKey: ['vendedor-targets-summary'],
    staleTime: 60 * 1000,
    retry: 1,
    queryFn: async () => {
      try {
        return await api.get<TargetsSummary>('/me/targets');
      } catch {
        return {};
      }
    },
  });

  // Query Asistencia del día para bloqueo de jornada comercial
  const {
    data: attendance,
    isLoading: loadingAttendance,
    refetch: refetchAttendance,
  } = useQuery<any>({
    queryKey: ['attendance-today'],
    staleTime: 60 * 1000,
    retry: 1,
    queryFn: async () => {
      try {
        return await api.get<any>('/attendance/today');
      } catch {
        return null;
      }
    },
  });

  const isJornadaActiva = attendance?.estado_jornada === 'en_jornada';

  const onRefresh = useCallback(async () => {
    await Promise.all([refetchRoutes(), refetchTargets(), refetchAttendance()]);
  }, [refetchRoutes, refetchTargets, refetchAttendance]);

  const metaGs = targets?.progress?.meta_gs || 22000000;
  const ventaGs = targets?.progress?.venta_gs || 14850000;
  const pct = metaGs > 0 ? Math.min(Math.round((ventaGs / metaGs) * 100), 100) : 0;

  // Métricas avanzadas de Pacing diario
  const today = new Date();
  const dayOfMonth = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const remainingDays = Math.max(1, daysInMonth - dayOfMonth);
  const expectedPacingPct = Math.round((dayOfMonth / daysInMonth) * 100);
  const actualPacingPct = pct;
  const pacingDiff = actualPacingPct - expectedPacingPct;
  const remainingTargetGs = Math.max(0, metaGs - ventaGs);
  const dailyRequiredGs = Math.round(remainingTargetGs / remainingDays);

  const completedCount = useMemo(
    () => routes.filter((r) => r.estado === 'cerrada').length,
    [routes]
  );
  const pendingRouteCount = useMemo(
    () => routes.filter((r) => r.estado !== 'cerrada').length,
    [routes]
  );

  const filteredRoutes = useMemo(() => {
    let list = routes;
    if (filter === 'pending') {
      list = routes.filter((r) => r.estado !== 'cerrada');
    } else if (filter === 'completed') {
      list = routes.filter((r) => r.estado === 'cerrada');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const qDigits = q.replace(/[^0-9]/g, '');

      list = list.filter((r) => {
        const razonSocial = (r.razon_social || '').toLowerCase();
        const nombreFantasia = (r.nombre_fantasia || '').toLowerCase();
        const ruc = (r.ruc || '').toLowerCase();
        const rucDigits = ruc.replace(/[^0-9]/g, '');
        const ci = (r.ci || r.cedula || '').toLowerCase();
        const ciDigits = ci.replace(/[^0-9]/g, '');
        const codigoInterno = (r.codigo_interno || r.customer_id || '').toLowerCase();

        return (
          razonSocial.includes(q) ||
          nombreFantasia.includes(q) ||
          ruc.includes(q) ||
          (qDigits.length >= 2 && rucDigits.includes(qDigits)) ||
          ci.includes(q) ||
          (qDigits.length >= 2 && ciDigits.includes(qDigits)) ||
          codigoInterno.includes(q)
        );
      });
    }

    return list;
  }, [routes, filter, searchQuery]);

  // Guardar nueva ubicación GPS con justificación
  const handleSaveLocation = async () => {
    if (!selectedStop) return;
    setUpdatingLocation(true);
    try {
      const loc = location || (await requestFix());
      if (!loc) {
        Alert.alert('Error GPS', 'No se pudo obtener la posición satelital actual.');
        setUpdatingLocation(false);
        return;
      }
      await api.put(`/customers/${selectedStop.customer_id}/location`, {
        lat: loc.latitude,
        lng: loc.longitude,
        motivo: updateMotivo,
        notas: updateNotas || undefined,
        accuracy: loc.accuracy,
      });

      setSelectedStop((prev) =>
        prev
          ? {
              ...prev,
              latitud: loc.latitude,
              longitud: loc.longitude,
            }
          : null
      );
      await refetchRoutes();
      setIsLocationModalOpen(false);
      Alert.alert(
        '¡Ubicación Actualizada!',
        `Nuevas coordenadas asignadas: ${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}.`
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'No se pudo actualizar la ubicación.');
    } finally {
      setUpdatingLocation(false);
    }
  };

  // Distancia del cliente seleccionado respecto al vendedor
  const distanciaCliente = useMemo(() => {
    if (!selectedStop?.latitud || !selectedStop?.longitud || !location) return null;
    const d = calculateDistanceM(
      location.latitude,
      location.longitude,
      selectedStop.latitud,
      selectedStop.longitud
    );
    if (d < 1000) return `${d} m`;
    return `${(d / 1000).toFixed(1)} km`;
  }, [selectedStop, location]);

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <InteliforceLogo size={36} />
          <View style={styles.brandTitleCol}>
            <Text style={styles.brandTitle}>Inteliforce</Text>
            <Text style={styles.brandSubtitle}>Casa Gonzalito</Text>
          </View>
        </View>

        <View style={styles.topRightActions}>
          <TouchableOpacity
            onPress={toggleTheme}
            style={styles.themeToggleButton}
            activeOpacity={0.8}
            accessibilityLabel="Cambiar tema claro/oscuro"
          >
            <Ionicons name={isDark ? 'sunny' : 'moon'} size={15} color={theme.primary} />
          </TouchableOpacity>

          <View style={styles.connectivityPill}>
            <View
              style={[
                styles.connectivityDot,
                { backgroundColor: isConnected ? theme.primary : theme.offline },
              ]}
            />
            <Text style={styles.connectivityText}>
              {isConnected ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refetchingRoutes}
            onRefresh={onRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
      >
        {/* Welcome Greeting */}
        <View style={styles.greetingHeader}>
          <View style={styles.greetingContent}>
            <Text style={styles.greetingTitle}>¡Buen día, {user?.nombre || 'Vendedor'}!</Text>
            <Text style={styles.greetingSubtitle}>
              {routes.length} clientes en tu itinerario de hoy
            </Text>
          </View>
        </View>

        {/* Offline Sync Banner */}
        {pendingCount > 0 && (
          <View style={styles.offlineBannerWrapper}>
            <View style={styles.offlineBanner}>
              <View style={styles.offlineBannerLeft}>
                <Ionicons name="cloud-offline" size={20} color={theme.warning} />
                <View>
                  <Text style={styles.offlineBannerTitle}>
                    {pendingCount} registros pendientes
                  </Text>
                  <Text style={styles.offlineBannerSubtitle}>
                    Sincronización automática de Casa Gonzalito
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.subirBtn}
                onPress={triggerSync}
                disabled={isSyncing || !isConnected}
                activeOpacity={0.8}
              >
                {isSyncing ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <>
                    <Text style={styles.subirBtnText}>Subir</Text>
                    <Ionicons name="arrow-up" size={13} color={theme.primary} />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Bloqueo estricto de jornada: Si la jornada NO ha sido iniciada, nada puede hacer hasta marcar Entrada */}
        {attendance && !isJornadaActiva ? (
          <View style={styles.jornadaLockContainer}>
            <View
              style={[
                styles.jornadaLockCard,
                {
                  backgroundColor: theme.card,
                  borderColor: isDark ? '#334155' : theme.border,
                },
              ]}
            >
              <View
                style={[
                  styles.lockIconCircle,
                  { backgroundColor: isDark ? '#1E293B' : '#EFF6FF' },
                ]}
              >
                <Ionicons name="time-outline" size={38} color={theme.primary} />
              </View>

              <Text style={[styles.lockTitle, { color: theme.text }]}>
                Jornada Laboral No Iniciada
              </Text>

              <Text style={[styles.lockDesc, { color: theme.textSecondary }]}>
                Por política de Casa Gonzalito, debes marcar tu{' '}
                <Text style={{ fontWeight: '800', color: theme.primary }}>Entrada</Text>{' '}
                con geolocalización en Asistencia antes de comenzar visitas, consultar clientes o registrar pedidos.
              </Text>

              <View
                style={[
                  styles.lockSummaryBox,
                  { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' },
                ]}
              >
                <View style={styles.lockSummaryRow}>
                  <Ionicons name="map-outline" size={16} color={theme.textMuted} />
                  <Text style={[styles.lockSummaryText, { color: theme.textSecondary }]}>
                    Clientes en ruta hoy: <Text style={{ fontWeight: '800', color: theme.text }}>{routes.length}</Text>
                  </Text>
                </View>
                <View style={styles.lockSummaryRow}>
                  <Ionicons name="lock-closed" size={16} color="#F59E0B" />
                  <Text style={[styles.lockSummaryText, { color: '#F59E0B', fontWeight: '700' }]}>
                    Ruta y operaciones bloqueadas hasta marcar
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.marcarEntradaBtn, { backgroundColor: theme.primary }]}
                onPress={() => router.push('/(vendedor)/asistencia')}
                activeOpacity={0.85}
              >
                <Ionicons name="finger-print" size={20} color={isDark ? '#002109' : '#FFFFFF'} />
                <Text style={[styles.marcarEntradaBtnText, { color: isDark ? '#002109' : '#FFFFFF' }]}>
                  Ir a Marcar Asistencia
                </Text>
                <Ionicons name="arrow-forward" size={18} color={isDark ? '#002109' : '#FFFFFF'} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            {/* Quota Progress Card & Vanguard Commercial Pacing */}
            <View style={styles.quotaSection}>
          <Card style={styles.quotaCard}>
            <View style={styles.quotaHeader}>
              <View>
                <Text style={styles.quotaTag}>PACING COMERCIAL DEL MES</Text>
                <Text style={styles.quotaTitle}>Meta y Ritmo de Facturación</Text>
              </View>
              <View
                style={[
                  styles.ritmoBadge,
                  {
                    backgroundColor:
                      pacingDiff >= 0
                        ? isDark ? '#064E3B' : '#D1FAE5'
                        : isDark ? '#78350F' : '#FEF3C7',
                  },
                ]}
              >
                <Ionicons
                  name={pacingDiff >= 0 ? 'trending-up' : 'trending-down'}
                  size={14}
                  color={pacingDiff >= 0 ? '#10B981' : '#F59E0B'}
                />
                <Text
                  style={[
                    styles.ritmoText,
                    { color: pacingDiff >= 0 ? '#10B981' : '#D97706' },
                  ]}
                >
                  {pacingDiff >= 0 ? `+${pacingDiff}% Adelantado` : `${pacingDiff}% Retrasado`}
                </Text>
              </View>
            </View>

            {/* Circular Ring + Financial Ledger Layout */}
            <View style={styles.progressRow}>
              <View style={styles.ringContainer}>
                <View style={styles.ringCenter}>
                  <Text style={styles.ringPct}>{pct}%</Text>
                  <Text style={styles.ringLabel}>AVANCE</Text>
                </View>
              </View>

              <View style={styles.ledgerContainer}>
                <Text style={styles.ledgerLabel}>Facturado acumulado</Text>
                <Text style={styles.ledgerAmount}>{formatGS(ventaGs)}</Text>
                <View style={styles.targetSubRow}>
                  <Text style={styles.targetLabel}>Meta del mes:</Text>
                  <Text style={styles.targetAmount}>{formatGS(metaGs)}</Text>
                </View>
              </View>
            </View>

            {/* Barra Visual de Pacing */}
            <View style={styles.pacingBarWrapper}>
              <View style={styles.pacingBarTrack}>
                <View style={[styles.pacingBarFill, { width: `${pct}%` }]} />
              </View>
              <View style={styles.pacingLabelsRow}>
                <Text style={styles.pacingDayText}>
                  Día {dayOfMonth} de {daysInMonth} ({remainingDays} días restantes)
                </Text>
                <Text style={styles.pacingRunrateText}>
                  Objetivo: {formatGS(dailyRequiredGs)}/día
                </Text>
              </View>
            </View>

            {/* Botón hacia Dashboard Completo de Metas */}
            <TouchableOpacity
              style={styles.viewDetailedMetasBtn}
              onPress={() => router.push('/(vendedor)/metas')}
              activeOpacity={0.8}
            >
              <Text style={styles.viewDetailedMetasText}>Ver Desglose de Metas y Gráficos</Text>
              <Ionicons name="chevron-forward" size={15} color={theme.primary} />
            </TouchableOpacity>
          </Card>
        </View>

        {/* Route Section Header, Search & Filter Chips */}
        <View style={styles.routeHeaderSection}>
          <View style={styles.routeHeaderRow}>
            <View style={styles.routeTitleGroup}>
              <Text style={styles.routeSectionTitle}>Ruta de Hoy</Text>
              <View style={styles.clientCountChip}>
                <Text style={styles.clientCountText}>
                  {filteredRoutes.length !== routes.length
                    ? `${filteredRoutes.length} de ${routes.length}`
                    : `${routes.length}`} clientes
                </Text>
              </View>
            </View>
          </View>

          {/* Buscador Multi-campo */}
          <View style={styles.searchBarContainer}>
            <Ionicons name="search-outline" size={18} color={theme.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar cliente, fantasía, RUC, CI o código..."
              placeholderTextColor={theme.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
                <Ionicons name="close-circle" size={18} color={theme.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter Pills */}
          <View style={styles.filterPillsRow}>
            <TouchableOpacity
              style={[styles.filterPill, filter === 'all' && styles.filterPillActive]}
              onPress={() => setFilter('all')}
              activeOpacity={0.8}
            >
              <Text
                style={[styles.filterPillText, filter === 'all' && styles.filterPillTextActive]}
              >
                Todos ({routes.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterPill, filter === 'pending' && styles.filterPillActive]}
              onPress={() => setFilter('pending')}
              activeOpacity={0.8}
            >
              <Text
                style={[styles.filterPillText, filter === 'pending' && styles.filterPillTextActive]}
              >
                Pendientes ({pendingRouteCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterPill, filter === 'completed' && styles.filterPillActive]}
              onPress={() => setFilter('completed')}
              activeOpacity={0.8}
            >
              <Text
                style={[styles.filterPillText, filter === 'completed' && styles.filterPillTextActive]}
              >
                Completados ({completedCount})
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Route Stops Cards */}
        <View style={styles.listContainer}>
          {loadingRoutes && routes.length === 0 ? (
            <View style={styles.centerLoading}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : filteredRoutes.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={38} color={theme.textMuted} />
              <Text style={styles.emptyTitle}>
                {searchQuery.trim()
                  ? `Sin resultados para "${searchQuery}"`
                  : 'Sin clientes en este filtro'}
              </Text>
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  style={styles.clearFilterBtn}
                  activeOpacity={0.8}
                >
                  <Text style={styles.clearFilterBtnText}>Limpiar búsqueda</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filteredRoutes.map((item, index) => (
              <VisitCard
                key={item.customer_id}
                stop={item}
                index={index}
                onPress={() => setSelectedStop(item)}
              />
            ))
          )}
        </View>
        </>
        )}
      </ScrollView>

      {/* ── MODAL FICHA INTERACTIVA DE RUTA Y KPIS DEL CLIENTE ──────────────── */}
      <Modal
        visible={Boolean(selectedStop)}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedStop(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.sheetContainer, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
            {/* Header del Sheet */}
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetFantasia, { color: theme.text }]} numberOfLines={1}>
                  {selectedStop?.nombre_fantasia || selectedStop?.razon_social}
                </Text>
                {selectedStop?.nombre_fantasia && selectedStop?.nombre_fantasia !== selectedStop?.razon_social && (
                  <Text style={[styles.sheetRazonSocial, { color: theme.textSecondary }]} numberOfLines={1}>
                    {selectedStop.razon_social}
                  </Text>
                )}
                <Text style={[styles.sheetDocText, { color: theme.textMuted }]}>
                  {selectedStop?.ruc ? `RUC: ${selectedStop.ruc}` : selectedStop?.ci ? `CI: ${selectedStop.ci}` : ''}
                  {selectedStop?.codigo_interno ? ` • Cód: ${selectedStop.codigo_interno}` : ''}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setSelectedStop(null)}
                style={styles.sheetCloseBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="close-circle" size={26} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.sheetScrollContent}>
              {/* Semáforo Financiero y KPIs del Cliente */}
              <View style={[styles.kpisContainer, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}>
                <View style={styles.kpiCol}>
                  <Text style={[styles.kpiLabelText, { color: theme.textMuted }]}>DISPONIBLE</Text>
                  <Text style={[styles.kpiDispoVal, { color: '#10B981' }]}>
                    {formatGS(selectedStop?.saldo_disponible ?? 0)}
                  </Text>
                </View>

                <View style={styles.kpiCol}>
                  <Text style={[styles.kpiLabelText, { color: theme.textMuted }]}>LÍMITE TOTAL</Text>
                  <Text style={[styles.kpiNumVal, { color: theme.text }]}>
                    {formatGS(selectedStop?.credito_limite ?? 0)}
                  </Text>
                </View>

                <View style={styles.kpiCol}>
                  <Text style={[styles.kpiLabelText, { color: theme.textMuted }]}>DEUDA PENDIENTE</Text>
                  <Text
                    style={[
                      styles.kpiNumVal,
                      { color: (selectedStop?.documentos_vencidos ?? 0) > 0 ? '#EF4444' : theme.text },
                    ]}
                  >
                    {formatGS(selectedStop?.deuda_pendiente ?? 0)}
                  </Text>
                </View>
              </View>

              {/* Alerta de Documentos Vencidos */}
              {selectedStop?.documentos_vencidos && selectedStop.documentos_vencidos > 0 ? (
                <View
                  style={[
                    styles.alertVencidoBox,
                    { backgroundColor: isDark ? '#450A0A' : '#FEE2E2', borderColor: '#EF4444' },
                  ]}
                >
                  <Ionicons name="warning" size={18} color="#EF4444" />
                  <Text style={[styles.alertVencidoText, { color: '#EF4444' }]}>
                    Cliente con {selectedStop.documentos_vencidos} factura(s) en mora. Cobro prioritario.
                  </Text>
                </View>
              ) : null}

              {/* Sección de Ubicación y Coordenadas GPS */}
              <View
                style={[
                  styles.locationCard,
                  { backgroundColor: isDark ? '#0F172A' : '#F8FAFC', borderColor: theme.border },
                ]}
              >
                <View style={styles.locationHeaderRow}>
                  <View style={styles.locationHeaderLeft}>
                    <Ionicons
                      name={selectedStop?.latitud ? 'navigate-circle' : 'location'}
                      size={20}
                      color={selectedStop?.latitud ? '#10B981' : '#F59E0B'}
                    />
                    <View>
                      <Text style={[styles.locationCardTitle, { color: theme.text }]}>
                        {selectedStop?.latitud ? 'Ubicación Satelital Verificada' : 'Sin Coordenadas GPS'}
                      </Text>
                      <Text style={[styles.locationCardSub, { color: theme.textMuted }]}>
                        {selectedStop?.latitud && selectedStop?.longitud
                          ? `${selectedStop.latitud.toFixed(5)}, ${selectedStop.longitud.toFixed(5)}${
                              distanciaCliente ? ` • A ${distanciaCliente}` : ''
                            }`
                          : 'Se recomienda capturar la ubicación en local'}
                      </Text>
                    </View>
                  </View>
                </View>

                {selectedStop?.direccion ? (
                  <Text style={[styles.sheetAddress, { color: theme.textSecondary }]}>
                    {selectedStop.direccion}
                  </Text>
                ) : null}

                {/* Acciones de Mapa y Actualización */}
                <View style={styles.locationBtnsRow}>
                  {selectedStop?.latitud && selectedStop?.longitud ? (
                    <TouchableOpacity
                      style={[styles.mapOpenBtn, { backgroundColor: '#38BDF8' }]}
                      onPress={() => {
                        const url = `https://www.google.com/maps/search/?api=1&query=${selectedStop.latitud},${selectedStop.longitud}`;
                        Linking.openURL(url);
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="map" size={15} color="#0F172A" />
                      <Text style={styles.mapOpenBtnText}>Ver en Google Maps</Text>
                    </TouchableOpacity>
                  ) : null}

                  <TouchableOpacity
                    style={[styles.updateGpsBtn, { borderColor: theme.primary }]}
                    onPress={() => setIsLocationModalOpen(true)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="locate" size={15} color={theme.primary} />
                    <Text style={[styles.updateGpsBtnText, { color: theme.primary }]}>
                      Actualizar GPS
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Botones de Acción de Campo */}
              <View style={styles.sheetActionsContainer}>
                {/* Botón Visita Oficial */}
                <Button
                  title="Iniciar Visita en Local"
                  size="lg"
                  variant="primary"
                  icon={<Ionicons name="location" size={20} color={isDark ? '#002109' : '#FFFFFF'} />}
                  onPress={() => {
                    const stop = selectedStop;
                    if (!stop) return;
                    setSelectedStop(null);
                    router.push({
                      pathname: '/(vendedor)/visita/[id]',
                      params: { id: stop.customer_id, razon_social: stop.razon_social },
                    });
                  }}
                  style={{ width: '100%' }}
                />

                {/* Botón Simulación / Probar Pedido (Sin Afectar ERP) */}
                <TouchableOpacity
                  style={[
                    styles.simulationBtn,
                    { backgroundColor: isDark ? '#1E3A8A' : '#EFF6FF', borderColor: '#3B82F6' },
                  ]}
                  onPress={() => {
                    const stop = selectedStop;
                    if (!stop) return;
                    setSelectedStop(null);
                    startVisit(
                      `sim_${Date.now()}`,
                      stop.customer_id,
                      stop.nombre_fantasia || stop.razon_social
                    );
                    router.push('/(vendedor)/pedido');
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="cart-outline" size={18} color="#3B82F6" />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.simulationBtnTitle, { color: '#3B82F6' }]}>
                      Modo Simulación / Probar Pedido
                    </Text>
                    <Text style={styles.simulationBtnSub}>
                      Explorar catálogo, agregar ítems y calcular sin emitir al ERP
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#3B82F6" />
                </TouchableOpacity>

                {/* Ficha 360 Completa */}
                <Button
                  title="Ver Ficha 360 Completa"
                  size="md"
                  variant="secondary"
                  icon={<Ionicons name="pie-chart-outline" size={18} color={theme.text} />}
                  onPress={() => {
                    const stop = selectedStop;
                    if (!stop) return;
                    setSelectedStop(null);
                    router.push({
                      pathname: '/(vendedor)/clientes/[id]',
                      params: { id: stop.customer_id, razon_social: stop.razon_social },
                    });
                  }}
                  style={{ width: '100%' }}
                />

                {/* Contacto Directo */}
                <View style={styles.sheetContactRow}>
                  {selectedStop?.telefono ? (
                    <>
                      <TouchableOpacity
                        style={[styles.sheetContactBtn, { backgroundColor: '#10B981' }]}
                        onPress={() => Linking.openURL(`tel:${selectedStop.telefono}`)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="call" size={15} color="#FFFFFF" />
                        <Text style={styles.sheetContactBtnText}>Llamar</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.sheetContactBtn, { backgroundColor: '#25D366' }]}
                        onPress={() => {
                          let clean = (selectedStop.telefono || '').replace(/[^\d]/g, '');
                          if (!clean.startsWith('595')) {
                            if (clean.startsWith('0')) clean = clean.substring(1);
                            clean = `595${clean}`;
                          }
                          Linking.openURL(`whatsapp://send?phone=${clean}`);
                        }}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="logo-whatsapp" size={15} color="#FFFFFF" />
                        <Text style={styles.sheetContactBtnText}>WhatsApp</Text>
                      </TouchableOpacity>
                    </>
                  ) : null}
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── MODAL ACTUALIZAR COORDENADAS GPS CON JUSTIFICACIÓN ────────────── */}
      <Modal
        visible={isLocationModalOpen}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsLocationModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.locationModalBox, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
            <View style={styles.locationModalHeader}>
              <View>
                <Text style={[styles.locationModalTitle, { color: theme.text }]}>
                  Actualizar Coordenadas GPS
                </Text>
                <Text style={[styles.locationModalSub, { color: theme.textMuted }]}>
                  {selectedStop?.nombre_fantasia || selectedStop?.razon_social}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsLocationModalOpen(false)}>
                <Ionicons name="close" size={22} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            {/* GPS Fix actual */}
            <View style={[styles.gpsFixBox, { backgroundColor: isDark ? '#0F172A' : '#F1F5F9' }]}>
              <Ionicons
                name="pin"
                size={18}
                color={accuracy <= 50 ? '#10B981' : '#F59E0B'}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.gpsFixTitle, { color: theme.text }]}>
                  {location
                    ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
                    : 'Obteniendo GPS...'}
                </Text>
                <Text style={[styles.gpsFixAccuracy, { color: theme.textMuted }]}>
                  Precisión satelital: ±{Math.round(accuracy)} metros
                </Text>
              </View>
              <TouchableOpacity onPress={() => requestFix()} disabled={isLocating}>
                {isLocating ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <Ionicons name="refresh" size={18} color={theme.primary} />
                )}
              </TouchableOpacity>
            </View>

            {/* Selector de Motivo */}
            <Text style={[styles.motivoLabel, { color: theme.textSecondary }]}>
              MOTIVO DE LA ACTUALIZACIÓN (REQUERIDO):
            </Text>
            <View style={styles.motivoOptionsContainer}>
              {[
                { id: 'precision_gps', label: 'Corrección de precisión GPS anterior' },
                { id: 'cambio_local', label: 'Cliente cambió de local comercial' },
                { id: 'deposito_alternativo', label: 'Nuevo punto de descarga / depósito' },
                { id: 'sucursal', label: 'Nueva sucursal del cliente' },
                { id: 'otro', label: 'Otro motivo operativo' },
              ].map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[
                    styles.motivoRow,
                    updateMotivo === m.id && {
                      backgroundColor: isDark ? '#064E3B' : '#D1FAE5',
                      borderColor: '#10B981',
                    },
                  ]}
                  onPress={() => setUpdateMotivo(m.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={updateMotivo === m.id ? 'radio-button-on' : 'radio-button-off'}
                    size={16}
                    color={updateMotivo === m.id ? '#10B981' : theme.textMuted}
                  />
                  <Text
                    style={[
                      styles.motivoText,
                      { color: updateMotivo === m.id ? (isDark ? '#FFFFFF' : '#064E3B') : theme.text },
                    ]}
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Campo de Notas */}
            <Text style={[styles.motivoLabel, { color: theme.textSecondary, marginTop: 10 }]}>
              OBSERVACIONES O JUSTIFICACIÓN:
            </Text>
            <TextInput
              style={[
                styles.motivoInput,
                {
                  backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
              placeholder="Ej: Local nuevo frente a la plaza principal..."
              placeholderTextColor={theme.textMuted}
              value={updateNotas}
              onChangeText={setUpdateNotas}
              multiline
              numberOfLines={2}
            />

            {/* Botón Guardar */}
            <Button
              title="Guardar Coordenadas GPS"
              size="lg"
              variant="primary"
              loading={updatingLocation}
              onPress={handleSaveLocation}
              icon={<Ionicons name="checkmark-done" size={20} color={isDark ? '#002109' : '#FFFFFF'} />}
              style={{ marginTop: 14 }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (theme: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    topBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 10,
      backgroundColor: theme.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    brandTitleCol: {
      justifyContent: 'center',
    },
    brandTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.text,
      letterSpacing: -0.3,
    },
    brandSubtitle: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.textSecondary,
      letterSpacing: 0.2,
    },
    topRightActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    themeToggleButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: isDark ? '#1E293B' : '#EAEDFF',
    },
    connectivityPill: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
      backgroundColor: isDark ? '#1E293B' : '#EAEDFF',
      gap: 6,
    },
    connectivityDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    connectivityText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.text,
    },
    scrollArea: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 40,
    },
    greetingHeader: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 6,
    },
    greetingContent: {
      flex: 1,
    },
    greetingTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: theme.text,
      letterSpacing: -0.4,
    },
    greetingSubtitle: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    offlineBannerWrapper: {
      paddingHorizontal: 16,
      marginTop: 8,
    },
    offlineBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: isDark ? '#3D2A00' : '#FEF3C7',
      borderWidth: 1,
      borderColor: isDark ? '#6B4E00' : '#FDE68A',
    },
    offlineBannerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    offlineBannerTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: isDark ? '#FDE68A' : '#92400E',
    },
    offlineBannerSubtitle: {
      fontSize: 11,
      color: isDark ? '#D97706' : '#B45309',
      marginTop: 1,
    },
    subirBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
      borderWidth: 1,
      borderColor: theme.primary,
    },
    subirBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.primary,
    },
    quotaSection: {
      paddingHorizontal: 16,
      marginTop: 12,
    },
    quotaCard: {
      padding: 16,
      borderRadius: 16,
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderWidth: 1,
    },
    quotaHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    quotaTag: {
      fontSize: 10,
      fontWeight: '800',
      color: theme.primary,
      letterSpacing: 0.8,
    },
    quotaTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.text,
      marginTop: 2,
    },
    ritmoBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 4,
    },
    ritmoText: {
      fontSize: 11,
      fontWeight: '800',
    },
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    ringContainer: {
      width: 76,
      height: 76,
      borderRadius: 38,
      borderWidth: 5,
      borderColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDark ? '#0F172A' : '#F1F5F9',
    },
    ringCenter: {
      alignItems: 'center',
    },
    ringPct: {
      fontSize: 18,
      fontWeight: '900',
      color: theme.text,
    },
    ringLabel: {
      fontSize: 8,
      fontWeight: '800',
      color: theme.primary,
      letterSpacing: 0.5,
    },
    ledgerContainer: {
      flex: 1,
    },
    ledgerLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    ledgerAmount: {
      fontSize: 20,
      fontWeight: '900',
      color: theme.primary,
      marginTop: 2,
    },
    targetSubRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 2,
    },
    targetLabel: {
      fontSize: 12,
      color: theme.textMuted,
    },
    targetAmount: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.textSecondary,
    },
    pacingBarWrapper: {
      marginTop: 14,
    },
    pacingBarTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: isDark ? '#0F172A' : '#E2E8F0',
      overflow: 'hidden',
    },
    pacingBarFill: {
      height: '100%',
      borderRadius: 3,
      backgroundColor: theme.primary,
    },
    pacingLabelsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 6,
    },
    pacingDayText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.textMuted,
    },
    pacingRunrateText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.textSecondary,
    },
    viewDetailedMetasBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      marginTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      gap: 4,
    },
    viewDetailedMetasText: {
      fontSize: 12,
      fontWeight: '800',
      color: theme.primary,
    },
    routeHeaderSection: {
      paddingHorizontal: 16,
      marginTop: 18,
    },
    routeHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    routeTitleGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    routeSectionTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.text,
    },
    clientCountChip: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
      backgroundColor: isDark ? '#1E293B' : '#E2E8F0',
    },
    clientCountText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.textSecondary,
    },
    searchBarContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      height: 42,
      borderRadius: 10,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 10,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 13,
      color: theme.text,
    },
    clearSearchBtn: {
      padding: 4,
    },
    filterPillsRow: {
      flexDirection: 'row',
      gap: 8,
    },
    filterPill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
      borderWidth: 1,
      borderColor: theme.border,
    },
    filterPillActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    filterPillText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.textSecondary,
    },
    filterPillTextActive: {
      color: isDark ? '#002109' : '#FFFFFF',
    },
    listContainer: {
      paddingHorizontal: 16,
      marginTop: 12,
      gap: 10,
    },
    centerLoading: {
      paddingVertical: 40,
      alignItems: 'center',
    },
    emptyContainer: {
      paddingVertical: 40,
      alignItems: 'center',
      gap: 8,
    },
    emptyTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.textMuted,
      textAlign: 'center',
    },
    clearFilterBtn: {
      marginTop: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: isDark ? '#1E293B' : '#E2E8F0',
    },
    clearFilterBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.primary,
    },
    // Estilos de los Modales
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    sheetContainer: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '85%',
      paddingTop: 16,
    },
    sheetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingHorizontal: 20,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    sheetFantasia: {
      fontSize: 19,
      fontWeight: '900',
      letterSpacing: -0.3,
    },
    sheetRazonSocial: {
      fontSize: 13,
      fontWeight: '600',
      marginTop: 1,
    },
    sheetDocText: {
      fontSize: 12,
      fontWeight: '700',
      marginTop: 3,
    },
    sheetCloseBtn: {
      padding: 4,
    },
    sheetScrollContent: {
      padding: 20,
      gap: 14,
    },
    kpisContainer: {
      flexDirection: 'row',
      padding: 12,
      borderRadius: 14,
      justifyContent: 'space-between',
    },
    kpiCol: {
      flex: 1,
      alignItems: 'center',
    },
    kpiLabelText: {
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    kpiDispoVal: {
      fontSize: 15,
      fontWeight: '900',
      marginTop: 2,
    },
    kpiNumVal: {
      fontSize: 13,
      fontWeight: '800',
      marginTop: 2,
    },
    alertVencidoBox: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 10,
      borderRadius: 10,
      borderWidth: 1,
      gap: 8,
    },
    alertVencidoText: {
      fontSize: 12,
      fontWeight: '700',
      flex: 1,
    },
    locationCard: {
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      gap: 8,
    },
    locationHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    locationHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    locationCardTitle: {
      fontSize: 13,
      fontWeight: '800',
    },
    locationCardSub: {
      fontSize: 11,
      marginTop: 1,
    },
    sheetAddress: {
      fontSize: 12,
      marginTop: 2,
    },
    locationBtnsRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 6,
    },
    mapOpenBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      borderRadius: 8,
      gap: 6,
    },
    mapOpenBtnText: {
      fontSize: 12,
      fontWeight: '800',
      color: '#0F172A',
    },
    updateGpsBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      gap: 6,
    },
    updateGpsBtnText: {
      fontSize: 12,
      fontWeight: '800',
    },
    sheetActionsContainer: {
      gap: 10,
      marginTop: 4,
    },
    simulationBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      gap: 10,
    },
    simulationBtnTitle: {
      fontSize: 13,
      fontWeight: '800',
    },
    simulationBtnSub: {
      fontSize: 10,
      color: '#64748B',
      marginTop: 1,
    },
    sheetContactRow: {
      flexDirection: 'row',
      gap: 10,
    },
    sheetContactBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: 10,
      gap: 6,
    },
    sheetContactBtnText: {
      fontSize: 13,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    // Estilos Modal Actualizar Ubicación
    locationModalBox: {
      marginHorizontal: 16,
      marginBottom: 30,
      borderRadius: 20,
      padding: 20,
    },
    locationModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    locationModalTitle: {
      fontSize: 17,
      fontWeight: '800',
    },
    locationModalSub: {
      fontSize: 12,
      marginTop: 2,
    },
    gpsFixBox: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 12,
      gap: 10,
      marginBottom: 14,
    },
    gpsFixTitle: {
      fontSize: 13,
      fontWeight: '800',
    },
    gpsFixAccuracy: {
      fontSize: 11,
      marginTop: 1,
    },
    motivoLabel: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    motivoOptionsContainer: {
      gap: 6,
    },
    motivoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'transparent',
      gap: 8,
    },
    motivoText: {
      fontSize: 12,
      fontWeight: '700',
      flex: 1,
    },
    motivoInput: {
      borderRadius: 10,
      borderWidth: 1,
      padding: 10,
      fontSize: 12,
      textAlignVertical: 'top',
    },
    jornadaLockContainer: {
      marginTop: 8,
      marginBottom: 24,
    },
    jornadaLockCard: {
      padding: 24,
      borderRadius: 20,
      borderWidth: 1,
      alignItems: 'center',
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
    },
    lockIconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    lockTitle: {
      fontSize: 20,
      fontWeight: '900',
      letterSpacing: -0.3,
      textAlign: 'center',
      marginBottom: 8,
    },
    lockDesc: {
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
      marginBottom: 20,
      paddingHorizontal: 8,
    },
    lockSummaryBox: {
      width: '100%',
      padding: 14,
      borderRadius: 12,
      gap: 10,
      marginBottom: 22,
    },
    lockSummaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    lockSummaryText: {
      fontSize: 13,
      fontWeight: '600',
    },
    marcarEntradaBtn: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 14,
      gap: 10,
    },
    marcarEntradaBtnText: {
      fontSize: 15,
      fontWeight: '800',
    },
  });
