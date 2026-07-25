import React, { useEffect, useState, useCallback } from "react"
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Dimensions,
} from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { router } from "expo-router"
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated"
import { colors, borderRadius, spacing, typography, shadows } from "../../src/theme"
import { GlassCard, GlassCardSimple } from "../../src/components/GlassCard"
import { AnimatedHeader, StatsCard } from "../../src/components/AnimatedHeader"
import { RouteTimeline } from "../../src/components/RouteTimeline"
import { useLocation } from "../../src/hooks/useLocation"
import { useAppStore } from "../../src/stores/appStore"
import { api } from "../../src/services/api"
import { startGPSTracking } from "../../src/services/location"
import { cacheRouteStops } from "../../src/services/storage"

const { width: SCREEN_WIDTH } = Dimensions.get("window")

export default function TodayScreen() {
  const { user, profile, isOnline, currentRoute, currentStops, setCurrentRoute, setCurrentStops, setActiveStop, setIsRouteActive } = useAppStore()
  const { start, isTracking } = useLocation()
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [dashboard, setDashboard] = useState<any>(null)

  const companyId = user?.company_id || "00000000-0000-0000-0000-000000000010"

  useEffect(() => {
    loadTodayData()
  }, [])

  const loadTodayData = async () => {
    setLoading(true)
    try {
      const data = await api.distribuidora.tracking.liveMap(companyId)
      setDashboard(data)

      // Load today's route
      const today = new Date().toISOString().split("T")[0]
      const instances = await api.distribuidora.tracking.routeInstances.list(companyId, { fecha: today })
      if (instances && instances.length > 0) {
        const route = instances[0]
        setCurrentRoute(route)
        const stops = await api.distribuidora.tracking.routeInstances.stops.list(route.id)
        const enriched = await enrichStopsWithCustomerData(stops || [])
        setCurrentStops(enriched || [])
        await cacheRouteStops(enriched || [])
      }
    } catch {}
    setLoading(false)
  }

  const enrichStopsWithCustomerData = async (stops: any[]) => {
    try {
      const customers = await api.customers.list(companyId)
      const customerMap = new Map(customers?.map((c: any) => [c.id, c]) || [])
      return stops.map((s: any) => ({
        ...s,
        customer_name: customerMap.get(s.customer_id)?.nombre || customerMap.get(s.customer_id)?.razon_social || s.customer_id.slice(0, 8),
        customer_address: customerMap.get(s.customer_id)?.direccion || "",
        customer_lat: customerMap.get(s.customer_id)?.latitud,
        customer_lng: customerMap.get(s.customer_id)?.longitud,
      }))
    } catch {
      return stops
    }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadTodayData()
    setRefreshing(false)
  }, [])

  const handleStartRoute = async () => {
    if (!currentRoute) return
    // Start GPS tracking
    const gpsStarted = await start()
    if (gpsStarted) {
      try {
        await api.distribuidora.tracking.routeInstances.start(currentRoute.id)
        setIsRouteActive(true)
        setCurrentRoute({ ...currentRoute, status: "in_progress" })
      } catch {}
    }
  }

  const handleStopPress = (stop: any) => {
    setActiveStop(stop)
    router.push(`/visit/${stop.id}`)
  }

  const handleEndRoute = async () => {
    if (!currentRoute) return
    try {
      await api.distribuidora.tracking.routeInstances.end(currentRoute.id)
      setIsRouteActive(false)
      setCurrentRoute({ ...currentRoute, status: "completed" })
    } catch {}
  }

  const isActive = currentRoute?.status === "in_progress"
  const pendingStops = currentStops.filter((s) => s.status === "pending").length

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AnimatedHeader
        title={`Hola, ${user?.nombre || "Vendedor"}`}
        subtitle={isActive ? "Ruta en curso" : `${pendingStops} visitas pendientes`}
        isOnline={isOnline}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primaryLight} />}
      >
        {/* KPIs */}
        <View style={{ flexDirection: "row", gap: spacing.md, marginBottom: spacing.xl }}>
          <StatsCard icon="📍" label="Visitas hoy" value={dashboard?.today_visits || 0} color={colors.primary} delay={100} />
          <StatsCard icon="✅" label="Completadas" value={dashboard?.today_completed || 0} color={colors.success} delay={200} />
          <StatsCard icon="💰" label="Gs. hoy" value={(dashboard?.today_amount || 0).toLocaleString()} color={colors.accent} delay={300} />
        </View>

        {/* Start/End route button */}
        {currentRoute && (
          <Animated.View entering={ZoomIn.duration(400).springify()} style={{ marginBottom: spacing.xl }}>
            {!isActive ? (
              <TouchableOpacity onPress={handleStartRoute} activeOpacity={0.8}>
                <LinearGradient colors={colors.gradientSuccess} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.actionBtn}>
                  <Text style={styles.actionBtnIcon}>▶️</Text>
                  <View>
                    <Text style={styles.actionBtnTitle}>Iniciar ruta</Text>
                    <Text style={styles.actionBtnSub}>{currentStops.length} clientes para visitar</Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={handleEndRoute} activeOpacity={0.8}>
                <LinearGradient colors={colors.gradientError} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.actionBtn}>
                  <Text style={styles.actionBtnIcon}>⏹️</Text>
                  <View>
                    <Text style={styles.actionBtnTitle}>Finalizar ruta</Text>
                    <Text style={styles.actionBtnSub}>
                      {currentStops.filter((s) => s.status === "completed").length}/{currentStops.length} completadas
                    </Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </Animated.View>
        )}

        {/* GPS status */}
        <Animated.View entering={FadeInDown.duration(400).delay(400)} style={{ marginBottom: spacing.xl }}>
          <GlassCardSimple gradient={isTracking ? colors.gradientSecondary : undefined}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <Text style={{ fontSize: 20 }}>{isTracking ? "🛰️" : "📡"}</Text>
                <View>
                  <Text style={{ color: colors.text, fontFamily: typography.fontFamily.semibold, fontSize: typography.fontSize.sm }}>
                    GPS {isTracking ? "Activo" : "Inactivo"}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: typography.fontSize.xs }}>
                    {isTracking ? "Enviando ubicación en tiempo real" : "Iniciá la ruta para activar el GPS"}
                  </Text>
                </View>
              </View>
              <View style={[styles.statusPulse, { backgroundColor: isTracking ? colors.success : colors.textTertiary }]} />
            </View>
          </GlassCardSimple>
        </Animated.View>

        {/* Notifications alert */}
        {useAppStore.getState().unreadAlerts > 0 && (
          <TouchableOpacity onPress={() => router.push("/(tabs)/map")} style={{ marginBottom: spacing.lg }}>
            <GlassCardSimple gradient={colors.gradientError}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <Text style={{ fontSize: 20 }}>⚠️</Text>
                <View>
                  <Text style={{ color: colors.text, fontFamily: typography.fontFamily.semibold }}>Alertas de geocerca</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: typography.fontSize.xs }}>Revisá el mapa para más detalles</Text>
                </View>
              </View>
            </GlassCardSimple>
          </TouchableOpacity>
        )}

        {/* Route timeline */}
        <View style={{ marginBottom: spacing.lg }}>
          <Text style={styles.sectionTitle}>Ruta del día</Text>
          <RouteTimeline stops={currentStops} onStopPress={handleStopPress} activeStopId={undefined} />
        </View>

        {/* Quick stats */}
        <View style={{ marginTop: spacing.md }}>
          <Text style={styles.sectionTitle}>Resumen rápido</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
            {[
              { icon: "📊", label: "Pedidos", value: dashboard?.today_orders || 0 },
              { icon: "⭐", label: "Pendientes", value: pendingStops },
              { icon: "📦", label: "Productos", value: currentStops.reduce((s, st) => s + (st.products_count || 0), 0) },
              { icon: "💳", label: "Cobrado", value: (currentStops.reduce((s, st) => s + (st.payment_collected || 0), 0)).toLocaleString() },
            ].map((stat, i) => (
              <GlassCardSimple key={i} style={{ width: (SCREEN_WIDTH - 64) / 2 }}>
                <Text style={{ fontSize: 24, marginBottom: 4 }}>{stat.icon}</Text>
                <Text style={{ color: colors.text, fontFamily: typography.fontFamily.bold, fontSize: typography.fontSize.lg }}>{stat.value}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: typography.fontSize.xs }}>{stat.label}</Text>
              </GlassCardSimple>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
  },
  actionBtnIcon: {
    fontSize: 32,
  },
  actionBtnTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    color: colors.text,
  },
  actionBtnSub: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },
  statusPulse: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
})
