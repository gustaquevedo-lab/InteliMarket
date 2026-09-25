// app/(vendedor)/metas.tsx
import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useTheme } from '@/hooks/useTheme';
import { api } from '@/lib/api';
import { formatGS, formatDate } from '@/lib/format';

interface TargetLine {
  nombre: string;
  meta_gs: number;
  venta_gs: number;
  pct_gs: number;
  meta_unidades: number;
  unidades: number;
  pct_unidades: number;
  cumplido: boolean;
}

interface TargetsResponse {
  periodo_inicio: string;
  periodo_fin: string;
  progress: {
    meta_gs: number;
    venta_gs: number;
    pct_gs: number;
  };
  desglose: TargetLine[];
}

export default function VendedorMetasScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();

  const { data, isLoading, refetch, isRefetching } = useQuery<TargetsResponse>({
    queryKey: ['vendedor-metas-detailed'],
    queryFn: async () => {
      return await api.get<TargetsResponse>('/me/targets');
    },
  });

  const progress = data?.progress;
  const metaTotal = progress?.meta_gs || 22000000;
  const ventaTotal = progress?.venta_gs || 14850000;
  const pctTotal = metaTotal > 0 ? Math.min(Math.round((ventaTotal / metaTotal) * 100), 100) : 0;

  // Cálculos de Ritmo Comercial (Pacing)
  const today = new Date();
  const dayOfMonth = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const remainingDays = Math.max(1, daysInMonth - dayOfMonth);
  const expectedPacingPct = Math.round((dayOfMonth / daysInMonth) * 100);
  const pacingDiff = pctTotal - expectedPacingPct;
  const remainingTargetGs = Math.max(0, metaTotal - ventaTotal);
  const dailyRequiredGs = Math.round(remainingTargetGs / remainingDays);

  // Proyección de cierre a fin de mes al ritmo actual
  const projectedClosingGs = Math.round((ventaTotal / Math.max(1, dayOfMonth)) * daysInMonth);
  const projectedPct = metaTotal > 0 ? Math.round((projectedClosingGs / metaTotal) * 100) : 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header Bar */}
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
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Objetivos & Metas</Text>
            <Text style={styles.headerSubtitle}>
              Pacing Comercial • Casa Gonzalito S.R.L.
            </Text>
          </View>
          <View
            style={[
              styles.pacingPill,
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
              size={13}
              color={pacingDiff >= 0 ? '#10B981' : '#D97706'}
            />
            <Text
              style={[
                styles.pacingPillText,
                { color: pacingDiff >= 0 ? '#10B981' : '#D97706' },
              ]}
            >
              {pacingDiff >= 0 ? `+${pacingDiff}% Adelantado` : `${pacingDiff}% Retrasado`}
            </Text>
          </View>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Calculando Pacing y Metas Comerciales...
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
          {/* Tarjeta Hero: Cumplimiento Global y Pacing del Mes */}
          <Card
            style={[
              styles.heroCard,
              {
                backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.heroTopRow}>
              <View style={[styles.trophyBox, { backgroundColor: theme.primary }]}>
                <Ionicons name="trophy" size={24} color={isDark ? '#002109' : '#FFFFFF'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.heroPreTitle, { color: theme.textSecondary }]}>
                  CUMPLIMIENTO ACUMULADO DEL MES
                </Text>
                <Text style={[styles.heroAmount, { color: theme.primary }]}>
                  {formatGS(ventaTotal)}
                </Text>
                <Text style={[styles.heroTargetText, { color: theme.textMuted }]}>
                  Meta Global: {formatGS(metaTotal)}
                </Text>
              </View>
              <View style={styles.heroPctCircle}>
                <Text style={[styles.heroPctNumber, { color: theme.text }]}>{pctTotal}%</Text>
                <Text style={[styles.heroPctLabel, { color: theme.primary }]}>AVANCE</Text>
              </View>
            </View>

            {/* Barra Gráfica de Progreso */}
            <View style={[styles.progressTrack, { backgroundColor: isDark ? '#0F172A' : '#E2E8F0' }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${pctTotal}%`,
                    backgroundColor: theme.primary,
                  },
                ]}
              />
            </View>

            {/* Sub-indicadores de Pacing */}
            <View style={styles.pacingGrid}>
              <View
                style={[
                  styles.pacingBox,
                  { backgroundColor: isDark ? '#0F172A' : '#F8FAFC', borderColor: theme.border },
                ]}
              >
                <Text style={[styles.pacingBoxVal, { color: theme.text }]}>
                  Día {dayOfMonth} de {daysInMonth}
                </Text>
                <Text style={[styles.pacingBoxLabel, { color: theme.textMuted }]}>
                  {remainingDays} días restantes
                </Text>
              </View>

              <View
                style={[
                  styles.pacingBox,
                  { backgroundColor: isDark ? '#0F172A' : '#F8FAFC', borderColor: theme.border },
                ]}
              >
                <Text style={[styles.pacingBoxVal, { color: '#38BDF8' }]}>
                  {expectedPacingPct}%
                </Text>
                <Text style={[styles.pacingBoxLabel, { color: theme.textMuted }]}>
                  Ritmo Esperado a Hoy
                </Text>
              </View>

              <View
                style={[
                  styles.pacingBox,
                  { backgroundColor: isDark ? '#0F172A' : '#F8FAFC', borderColor: theme.border },
                ]}
              >
                <Text style={[styles.pacingBoxVal, { color: '#F59E0B' }]}>
                  {formatGS(dailyRequiredGs)}
                </Text>
                <Text style={[styles.pacingBoxLabel, { color: theme.textMuted }]}>
                  Meta Diaria Requerida
                </Text>
              </View>
            </View>
          </Card>

          {/* Tarjeta Proyección de Cierre de Mes */}
          <Card
            style={[
              styles.projectionCard,
              {
                backgroundColor: isDark ? '#0A2540' : '#EFF6FF',
                borderColor: '#3B82F6',
              },
            ]}
          >
            <View style={styles.projectionHeader}>
              <Ionicons name="sparkles" size={20} color="#3B82F6" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.projectionTitle, { color: '#1E40AF' }]}>
                  PROYECCIÓN DE CIERRE AL RITMO ACTUAL
                </Text>
                <Text style={[styles.projectionAmount, { color: '#1E3A8A' }]}>
                  {formatGS(projectedClosingGs)}{' '}
                  <Text style={{ fontSize: 15, fontWeight: '800' }}>({projectedPct}%)</Text>
                </Text>
              </View>
              <Badge
                label={projectedPct >= 100 ? 'Superando Meta' : 'Ajustar Ritmo'}
                variant={projectedPct >= 100 ? 'success' : 'warning'}
              />
            </View>
            <Text style={[styles.projectionSub, { color: '#3B82F6' }]}>
              {projectedPct >= 100
                ? '¡Excelente rendimiento comercial! Manteniendo este promedio diario superás la meta de Casa Gonzalito.'
                : 'Se requiere intensificar visitas y reposición para alcanzar el 100% de la cuota del mes.'}
            </Text>
          </Card>

          {/* Desglose por Línea de Producto */}
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Desglose por Línea Comercial ({data?.desglose?.length || 0})
          </Text>

          {data?.desglose && data.desglose.length > 0 ? (
            data.desglose.map((line, idx) => {
              const pctGs = Math.min(Math.round(line.pct_gs || 0), 100);
              const pctUnidades = Math.min(Math.round(line.pct_unidades || 0), 100);
              const isCompleted = line.cumplido || pctGs >= 100;

              return (
                <Card
                  key={idx}
                  style={[styles.lineCard, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}
                >
                  <View style={styles.lineHeader}>
                    <Text style={[styles.lineTitle, { color: theme.text }]}>{line.nombre}</Text>
                    {isCompleted ? (
                      <Badge
                        label="100% CUMPLIDO"
                        variant="success"
                        icon={<Ionicons name="checkmark-circle" size={14} color={theme.success} />}
                      />
                    ) : (
                      <Badge label={`${pctGs}%`} variant="primary" />
                    )}
                  </View>

                  {/* Barra Valores Guaraníes */}
                  <View style={styles.statBlock}>
                    <View style={styles.statLabelRow}>
                      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                        Facturación en Guaraníes
                      </Text>
                      <Text style={[styles.statValue, { color: theme.text }]}>
                        {formatGS(line.venta_gs)}{' '}
                        <Text style={[styles.statTarget, { color: theme.textMuted }]}>
                          / {formatGS(line.meta_gs)}
                        </Text>
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.lineProgressTrack,
                        { backgroundColor: isDark ? '#0F172A' : '#F1F5F9' },
                      ]}
                    >
                      <View
                        style={[
                          styles.lineProgressFill,
                          {
                            width: `${pctGs}%`,
                            backgroundColor: isCompleted ? '#10B981' : theme.primary,
                          },
                        ]}
                      />
                    </View>
                  </View>

                  {/* Barra Unidades Físicas */}
                  <View style={styles.statBlock}>
                    <View style={styles.statLabelRow}>
                      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                        Volumen en Unidades
                      </Text>
                      <Text style={[styles.statValue, { color: theme.text }]}>
                        {Math.round(line.unidades)}{' '}
                        <Text style={[styles.statTarget, { color: theme.textMuted }]}>
                          / {Math.round(line.meta_unidades)} un.
                        </Text>
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.lineProgressTrack,
                        { backgroundColor: isDark ? '#0F172A' : '#F1F5F9' },
                      ]}
                    >
                      <View
                        style={[
                          styles.lineProgressFill,
                          {
                            width: `${pctUnidades}%`,
                            backgroundColor: pctUnidades >= 100 ? '#10B981' : '#38BDF8',
                          },
                        ]}
                      />
                    </View>
                  </View>
                </Card>
              );
            })
          ) : (
            <Card
              style={[styles.emptyCard, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}
            >
              <Ionicons name="bar-chart-outline" size={32} color={theme.textMuted} />
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                No hay objetivos desglosados cargados para este período.
              </Text>
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
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  pacingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 5,
  },
  pacingPillText: {
    fontSize: 11,
    fontWeight: '800',
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
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  trophyBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroPreTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  heroAmount: {
    fontSize: 22,
    fontWeight: '900',
    marginTop: 2,
    letterSpacing: -0.5,
  },
  heroTargetText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  heroPctCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPctNumber: {
    fontSize: 22,
    fontWeight: '900',
  },
  heroPctLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  pacingGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  pacingBox: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  pacingBoxVal: {
    fontSize: 13,
    fontWeight: '900',
  },
  pacingBoxLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  projectionCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  projectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  projectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  projectionAmount: {
    fontSize: 17,
    fontWeight: '900',
    marginTop: 2,
  },
  projectionSub: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 6,
  },
  lineCard: {
    padding: 16,
    borderRadius: 14,
    gap: 12,
  },
  lineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lineTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  statBlock: {
    gap: 6,
  },
  statLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  statTarget: {
    fontSize: 12,
    fontWeight: '500',
  },
  lineProgressTrack: {
    height: 7,
    borderRadius: 3.5,
    overflow: 'hidden',
  },
  lineProgressFill: {
    height: '100%',
    borderRadius: 3.5,
  },
  emptyCard: {
    padding: 30,
    borderRadius: 14,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
  },
});
