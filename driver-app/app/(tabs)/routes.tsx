import React, { useEffect, useState } from "react"
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from "react-native"
import { router } from "expo-router"
import Animated, { FadeInUp } from "react-native-reanimated"
import { colors, spacing, borderRadius, typography } from "../../src/theme"
import { AnimatedHeader } from "../../src/components/AnimatedHeader"
import { GlassCard, GlassCardSimple } from "../../src/components/GlassCard"
import { RouteTimeline } from "../../src/components/RouteTimeline"
import { useDriverStore } from "../../src/stores/driverStore"
import { useNetwork } from "../../src/hooks/useNetwork"
import { api } from "../../src/services/api"
import type { Route, Delivery } from "../../src/types"

export default function RoutesScreen() {
  const { isOnline } = useNetwork()
  const store = useDriverStore()
  const [allRoutes, setAllRoutes] = useState<Route[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadRoutes = async () => {
    try {
      const routes = await api.routes.today()
      setAllRoutes(routes || [])
    } catch {} finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadRoutes() }, [])

  const onRefresh = async () => {
    setRefreshing(true)
    await loadRoutes()
    setRefreshing(false)
  }

  const deliveryMap = new Map<string, Delivery>()
  store.deliveries.forEach((d) => deliveryMap.set(d.id, d))

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AnimatedHeader title="Mis Rutas" subtitle={isOnline ? "En línea" : "Offline"} isOnline={isOnline} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {store.currentRoute && (
          <GlassCard style={{ marginBottom: spacing.lg }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm }}>
              <Text style={styles.routeName}>{store.currentRoute.name}</Text>
              <View style={[styles.statusBadge, {
                backgroundColor: store.currentRoute.status === "in_progress" ? "rgba(34,197,94,0.15)" : "rgba(99,102,241,0.15)",
              }]}>
                <Text style={[styles.statusText, {
                  color: store.currentRoute.status === "in_progress" ? colors.success : colors.primary,
                }]}>
                  {store.currentRoute.status === "in_progress" ? "En curso" : "Planificada"}
                </Text>
              </View>
            </View>
            {store.currentRoute.total_km > 0 && (
              <Text style={styles.routeKm}>📏 {store.currentRoute.total_km} km totales</Text>
            )}
            <TouchableOpacity
              style={styles.optimizeBtn}
              onPress={async () => {
                try {
                  const optimized = await api.routes.optimize(store.currentRoute!.id)
                  store.setCurrentStops(optimized.stops || [])
                  Alert.alert("Ruta optimizada", "El orden de paradas fue optimizado")
                } catch { Alert.alert("Error", "No se pudo optimizar") }
              }}
            >
              <Text style={styles.optimizeBtnText}>🔄 Optimizar orden de paradas</Text>
            </TouchableOpacity>
          </GlassCard>
        )}

        {store.currentStops.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>📍 Paradas de la ruta activa</Text>
            <RouteTimeline
              stops={store.currentStops}
              deliveries={deliveryMap}
              activeStopId={store.activeStop?.id}
              onStopPress={(stop) => {
                store.setActiveStop(stop)
                router.push(`/delivery/${stop.id}`)
              }}
            />
          </>
        )}

        {allRoutes.length === 0 && !loading && (
          <GlassCardSimple style={{ marginTop: spacing.xl, alignItems: "center", padding: spacing.xxxl }}>
            <Text style={{ fontSize: 48, marginBottom: spacing.md }}>🗺️</Text>
            <Text style={styles.emptyTitle}>Sin rutas asignadas</Text>
            <Text style={styles.emptySub}>Tus rutas aparecerán aquí cuando el despachador las asigne</Text>
          </GlassCardSimple>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.semibold, color: colors.text, marginBottom: spacing.md },
  routeName: { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.bold, color: colors.text },
  routeKm: { fontSize: typography.fontSize.sm, color: colors.textSecondary, marginBottom: spacing.sm },
  statusBadge: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.full },
  statusText: { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.semibold },
  optimizeBtn: { marginTop: spacing.sm, padding: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.primary, borderStyle: "dashed", alignItems: "center" },
  optimizeBtnText: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium, color: colors.primary },
  emptyTitle: { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.bold, color: colors.text, textAlign: "center" },
  emptySub: { fontSize: typography.fontSize.sm, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xs },
})

import { Alert } from "react-native"
