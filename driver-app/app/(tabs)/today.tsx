import React, { useEffect, useState, useCallback } from "react"
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Alert } from "react-native"
import { router } from "expo-router"
import Animated, { FadeInUp } from "react-native-reanimated"
import { LinearGradient } from "expo-linear-gradient"
import { colors, spacing, borderRadius, typography } from "../../src/theme"
import { AnimatedHeader, StatsCard } from "../../src/components/AnimatedHeader"
import { GlassCard, GlassCardSimple } from "../../src/components/GlassCard"
import { RouteTimeline } from "../../src/components/RouteTimeline"
import { useDriverStore } from "../../src/stores/driverStore"
import { useLocation } from "../../src/hooks/useLocation"
import { useNetwork } from "../../src/hooks/useNetwork"
import { api } from "../../src/services/api"
import { cacheDeliveries, getCachedDeliveries } from "../../src/services/storage"
import type { Route, RouteStop, Delivery } from "../../src/types"

export default function TodayScreen() {
  const { isOnline, checkNow } = useNetwork()
  const { startTracking, stopTracking, isTracking } = useLocation()
  const store = useDriverStore()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [routesRes, deliveriesRes, vehicleRes] = await Promise.all([
        api.routes.today().catch(() => null),
        api.deliveries.today().catch(() => null),
        api.vehicle.assigned().catch(() => null),
      ])

      if (routesRes && routesRes.length > 0) {
        store.setCurrentRoute(routesRes[0])
        store.setCurrentStops(routesRes[0].stops || [])
      }
      if (deliveriesRes) {
        store.setDeliveries(deliveriesRes)
        await cacheDeliveries(deliveriesRes)
      }
      if (vehicleRes) store.setAssignedVehicle(vehicleRes)

      setError(null)
    } catch (e: any) {
      const cached = await getCachedDeliveries()
      if (cached.length > 0) store.setDeliveries(cached)
      setError(isOnline ? "Error al cargar datos" : "Modo offline - datos locales")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await checkNow()
    await loadData()
    setRefreshing(false)
  }, [loadData, checkNow])

  const deliveryMap = new Map<string, Delivery>()
  store.deliveries.forEach((d) => deliveryMap.set(d.id, d))

  const todayKpis = {
    total: store.deliveries.length,
    completed: store.deliveries.filter((d) => d.status === "delivered").length,
    pending: store.deliveries.filter((d) => d.status === "pending" || d.status === "assigned").length,
    totalAmount: store.deliveries.reduce((sum, d) => sum + (d.total_amount || 0), 0),
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AnimatedHeader
        title={store.user?.nombre || "Repartidor"}
        subtitle={store.assignedVehicle ? `${store.assignedVehicle.marca} ${store.assignedVehicle.patente}` : "Sin vehículo asignado"}
        isOnline={isOnline}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {error && (
          <GlassCardSimple gradient={colors.gradientWarning} style={{ marginBottom: spacing.md }}>
            <Text style={styles.errorText}>{error}</Text>
          </GlassCardSimple>
        )}

        {!store.currentRoute && !loading && (
          <GlassCardSimple gradient={colors.gradientPrimary} style={{ marginBottom: spacing.lg }}>
            <Text style={{ fontSize: 36, textAlign: "center", marginBottom: spacing.sm }}>🛵</Text>
            <Text style={styles.noRouteTitle}>Sin ruta asignada</Text>
            <Text style={styles.noRouteSub}>Esperá a que el despachador te asigne una ruta</Text>
          </GlassCardSimple>
        )}

        <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg }}>
          <StatsCard icon="📦" label="Total" value={todayKpis.total} color={colors.primary} delay={0} />
          <StatsCard icon="✅" label="Entregado" value={todayKpis.completed} color={colors.success} delay={100} />
          <StatsCard icon="⏳" label="Pendiente" value={todayKpis.pending} color={colors.warning} delay={200} />
        </View>

        <GlassCard style={{ marginBottom: spacing.lg }} intensity={25}>
          <Text style={styles.sectionTitle}>💰 Recaudación del día</Text>
          <Text style={styles.amountText}>Gs. {todayKpis.totalAmount.toLocaleString()}</Text>
        </GlassCard>

        {store.currentRoute && (
          <>
            <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg }}>
              <TouchableOpacity
                style={[styles.actionBtn, store.currentRoute.status === "in_progress" && styles.actionBtnActive]}
                onPress={async () => {
                  if (store.currentRoute?.status === "planned") {
                    try {
                      await api.routes.start(store.currentRoute.id)
                      store.setCurrentRoute({ ...store.currentRoute, status: "in_progress", started_at: new Date().toISOString() })
                      await startTracking()
                      Alert.alert("Ruta iniciada", "¡Buena ruta!")
                    } catch { Alert.alert("Error", "No se pudo iniciar la ruta") }
                  }
                }}
                disabled={store.currentRoute?.status === "completed"}
              >
                <Text style={styles.actionBtnText}>
                  {store.currentRoute?.status === "planned" ? "🟢 Iniciar ruta" :
                   store.currentRoute?.status === "in_progress" ? "🔄 En curso" :
                   "✅ Ruta completada"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: colors.error }]}
                onPress={async () => {
                  if (store.currentRoute?.status === "in_progress") {
                    try {
                      await api.routes.complete(store.currentRoute.id)
                      store.setCurrentRoute({ ...store.currentRoute, status: "completed", ended_at: new Date().toISOString() })
                      await stopTracking()
                      Alert.alert("Ruta completada", "¡Excelente trabajo!")
                    } catch { Alert.alert("Error", "No se pudo completar la ruta") }
                  }
                }}
                disabled={store.currentRoute?.status !== "in_progress"}
              >
                <Text style={[styles.actionBtnText, { color: store.currentRoute?.status === "in_progress" ? colors.error : colors.textTertiary }]}>
                  🏁 Finalizar ruta
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>📍 Paradas</Text>
            <RouteTimeline
              stops={store.currentStops}
              deliveries={deliveryMap}
              activeStopId={store.activeStop?.id}
              onStopPress={(stop, delivery) => {
                store.setActiveStop(stop)
                router.push(`/delivery/${stop.id}`)
              }}
            />
          </>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.semibold, color: colors.text, marginBottom: spacing.md },
  amountText: { fontSize: typography.fontSize.xxxl, fontFamily: typography.fontFamily.bold, color: colors.success, textAlign: "center" },
  actionBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  actionBtnActive: { borderColor: colors.success, backgroundColor: "rgba(34,197,94,0.1)" },
  actionBtnText: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.semibold, color: colors.text },
  errorText: { fontSize: typography.fontSize.sm, color: colors.warning, textAlign: "center", fontFamily: typography.fontFamily.medium },
  noRouteTitle: { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.bold, color: colors.text, textAlign: "center" },
  noRouteSub: { fontSize: typography.fontSize.sm, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xs },
})
