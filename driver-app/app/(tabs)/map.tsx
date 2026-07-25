import React, { useEffect, useState, useRef, useCallback } from "react"
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Animated as RNAnimated } from "react-native"
import MapView, { Marker, Polyline, Callout, PROVIDER_GOOGLE } from "react-native-maps"
import { router } from "expo-router"
import { colors, spacing, borderRadius, typography } from "../../src/theme"
import { GlassCard, GlassCardSimple } from "../../src/components/GlassCard"
import { NavigationPanel } from "../../src/components/NavigationPanel"
import { useDriverStore } from "../../src/stores/driverStore"

const { width, height } = Dimensions.get("window")
const PULSE_INTERVAL = 3000

export default function MapScreen() {
  const store = useDriverStore()
  const mapRef = useRef<MapView>(null)
  const [selectedStop, setSelectedStop] = useState<string | null>(null)
  const [showNav, setShowNav] = useState(false)
  const [navTarget, setNavTarget] = useState<{ lat: number; lng: number; name: string; address: string } | null>(null)
  const routeOpacity = useRef(new RNAnimated.Value(0.6)).current

  const stopsWithLocation = store.currentStops.filter((s) => {
    const delivery = store.deliveries.find((d) => d.id === s.delivery_id)
    return delivery?.customer_lat && delivery?.customer_lng
  })

  const routeCoords = stopsWithLocation
    .map((s) => {
      const delivery = store.deliveries.find((d) => d.id === s.delivery_id)
      return delivery?.customer_lat && delivery?.customer_lng
        ? { latitude: delivery.customer_lat, longitude: delivery.customer_lng }
        : null
    })
    .filter(Boolean) as { latitude: number; longitude: number }[]

  const nextPendingStop = stopsWithLocation
    .filter((s) => s.status === "pending")
    .sort((a, b) => a.planned_order - b.planned_order)[0]

  const nextDelivery = nextPendingStop
    ? store.deliveries.find((d) => d.id === nextPendingStop.delivery_id)
    : null

  // Pulse route effect
  useEffect(() => {
    const pulse = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(routeOpacity, { toValue: 1, duration: PULSE_INTERVAL / 2, useNativeDriver: false }),
        RNAnimated.timing(routeOpacity, { toValue: 0.3, duration: PULSE_INTERVAL / 2, useNativeDriver: false }),
      ])
    )
    pulse.start()
    return () => pulse.stop()
  }, [])

  const fitToMarkers = useCallback(() => {
    if (stopsWithLocation.length > 0 && mapRef.current) {
      mapRef.current.fitToSuppliedMarkers(
        stopsWithLocation.map((s) => s.id),
        { edgePadding: { top: 120, right: 80, bottom: 300, left: 80 }, animated: true }
      )
    }
  }, [stopsWithLocation])

  useEffect(() => { fitToMarkers() }, [stopsWithLocation.length])

  const navigateToStop = useCallback((stop: typeof nextPendingStop) => {
    if (!stop) return
    const delivery = store.deliveries.find((d) => d.id === stop.delivery_id)
    if (delivery?.customer_lat && delivery?.customer_lng) {
      setNavTarget({
        lat: delivery.customer_lat,
        lng: delivery.customer_lng,
        name: delivery.customer_name,
        address: delivery.customer_address,
      })
      setShowNav(true)
    }
  }, [store.deliveries])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return colors.success
      case "in_progress": return colors.primary
      case "missed": case "cancelled": return colors.error
      default: return colors.warning
    }
  }

  const completedCount = stopsWithLocation.filter((s) => s.status === "completed").length

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: -25.2867,
            longitude: -57.3333,
            latitudeDelta: 0.1,
            longitudeDelta: 0.1,
          }}
          customMapStyle={darkMapStyle}
          showsUserLocation
          followsUserLocation
        >
          {/* Driver marker */}
          {store.lastLocation && (
            <Marker
              coordinate={{ latitude: store.lastLocation.lat, longitude: store.lastLocation.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              zIndex={999}
            >
              <View style={styles.driverMarker}>
                <View style={styles.driverMarkerInner}>
                  <Text style={{ fontSize: 18 }}>🚚</Text>
                </View>
              </View>
            </Marker>
          )}

          {/* Stop markers */}
          {stopsWithLocation.map((stop) => {
            const delivery = store.deliveries.find((d) => d.id === stop.delivery_id)
            if (!delivery?.customer_lat || !delivery?.customer_lng) return null
            const color = getStatusColor(stop.status)
            const isNext = stop.id === nextPendingStop?.id

            return (
              <Marker
                key={stop.id}
                identifier={stop.id}
                coordinate={{ latitude: delivery.customer_lat, longitude: delivery.customer_lng }}
                pinColor={color}
                onPress={() => setSelectedStop(stop.id)}
                zIndex={isNext ? 99 : 1}
              >
                {isNext && (
                  <View style={styles.nextStopBadge}>
                    <Text style={styles.nextStopText}>SIGUIENTE</Text>
                  </View>
                )}
                <Callout onPress={() => { store.setActiveStop(stop); router.push(`/delivery/${stop.id}`) }}>
                  <View style={styles.callout}>
                    <Text style={styles.calloutTitle}>
                      {isNext ? "▶ " : ""}{delivery.customer_name}
                    </Text>
                    <Text style={styles.calloutStatus}>
                      {stop.status === "completed" ? "✅ Entregado" :
                       stop.status === "in_progress" ? "🔄 En curso" : "⏳ Pendiente"}
                    </Text>
                    <Text style={styles.calloutAmount}>💰 Gs. {delivery.total_amount.toLocaleString()}</Text>
                    <Text style={styles.calloutAction}>Tocar para gestionar</Text>
                  </View>
                </Callout>
              </Marker>
            )
          })}

          {/* Route polyline */}
          {routeCoords.length > 1 && (
            <RNAnimated.View style={{ opacity: routeOpacity }}>
              <Polyline
                coordinates={routeCoords}
                strokeColor={colors.primary}
                strokeWidth={3}
                lineDashPattern={[10, 5]}
              />
            </RNAnimated.View>
          )}

          {/* Route line from driver to next stop */}
          {store.lastLocation && nextDelivery?.customer_lat && nextDelivery?.customer_lng && (
            <Polyline
              coordinates={[
                { latitude: store.lastLocation.lat, longitude: store.lastLocation.lng },
                { latitude: nextDelivery.customer_lat, longitude: nextDelivery.customer_lng },
              ]}
              strokeColor={colors.secondary}
              strokeWidth={2}
              lineDashPattern={[5, 5]}
            />
          )}
        </MapView>

        {/* Top overlay - stats */}
        <View style={styles.statsOverlay}>
          <GlassCardSimple style={{ padding: spacing.sm }}>
            <Text style={styles.statsText}>
              📍 {stopsWithLocation.length} paradas · ✅ {completedCount} entregadas · ⏳ {stopsWithLocation.length - completedCount} pendientes
            </Text>
          </GlassCardSimple>
        </View>

        {/* Next stop quick action */}
        {nextPendingStop && nextDelivery && !showNav && (
          <View style={styles.nextStopOverlay}>
            <GlassCard elevated style={{ padding: spacing.md }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <View style={styles.nextStopIcon}>
                  <Text style={{ fontSize: 24 }}>📍</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nextStopName}>{nextDelivery.customer_name}</Text>
                  <Text style={styles.nextStopAddress} numberOfLines={1}>{nextDelivery.customer_address}</Text>
                  <Text style={styles.nextStopAmount}>Gs. {nextDelivery.total_amount.toLocaleString()}</Text>
                </View>
                <TouchableOpacity
                  style={styles.navigateBtn}
                  onPress={() => navigateToStop(nextPendingStop)}
                >
                  <Text style={styles.navigateBtnText}>Navegar</Text>
                </TouchableOpacity>
              </View>
            </GlassCard>
          </View>
        )}

        {/* Bottom controls */}
        <View style={styles.controlsOverlay}>
          <TouchableOpacity style={styles.controlBtn} onPress={fitToMarkers}>
            <Text style={styles.controlBtnText}>🔍 Ajustar</Text>
          </TouchableOpacity>
          {showNav && (
            <TouchableOpacity style={[styles.controlBtn, { backgroundColor: "rgba(239,68,68,0.2)", borderColor: colors.error }]} onPress={() => setShowNav(false)}>
              <Text style={[styles.controlBtnText, { color: colors.error }]}>✕ Cerrar navegación</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Navigation Panel */}
      {showNav && (
        <NavigationPanel
          destination={navTarget}
          onClose={() => setShowNav(false)}
          onNavigateToStop={(stop) => {
            const d = store.deliveries.find((del) => del.id === stop.delivery_id)
            if (d?.customer_lat && d?.customer_lng) {
              setNavTarget({ lat: d.customer_lat, lng: d.customer_lng, name: d.customer_name, address: d.customer_address })
            }
          }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  mapContainer: { flex: 1, position: "relative" },
  map: { width, height },
  driverMarker: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "rgba(99,102,241,0.2)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 3, borderColor: colors.primary,
  },
  driverMarkerInner: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "rgba(99,102,241,0.3)",
    alignItems: "center", justifyContent: "center",
  },
  nextStopBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 4, marginBottom: 4,
    alignSelf: "center",
  },
  nextStopText: {
    fontSize: 8, fontFamily: typography.fontFamily.bold,
    color: colors.text, letterSpacing: 1,
  },
  callout: { padding: spacing.sm, minWidth: 180 },
  calloutTitle: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.bold, color: "#000" },
  calloutStatus: { fontSize: typography.fontSize.sm, color: "#555", marginTop: 2 },
  calloutAmount: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.bold, color: "#16a34a", marginTop: 2 },
  calloutAction: { fontSize: typography.fontSize.xs, color: "#6366f1", marginTop: 4, textDecorationLine: "underline" },
  statsOverlay: { position: "absolute", top: 16, left: 16, right: 16 },
  statsText: { fontSize: typography.fontSize.xs, color: colors.text, fontFamily: typography.fontFamily.medium, textAlign: "center" },
  nextStopOverlay: { position: "absolute", top: 80, left: 16, right: 16 },
  nextStopIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(99,102,241,0.15)", alignItems: "center", justifyContent: "center" },
  nextStopName: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.bold, color: colors.text },
  nextStopAddress: { fontSize: typography.fontSize.xs, color: colors.textSecondary, marginTop: 1 },
  nextStopAmount: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.bold, color: colors.success, marginTop: 2 },
  navigateBtn: { backgroundColor: colors.primary, borderRadius: borderRadius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  navigateBtnText: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.semibold, color: colors.text },
  controlsOverlay: { position: "absolute", bottom: 340, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: spacing.sm },
  controlBtn: { backgroundColor: "rgba(0,0,0,0.6)", borderRadius: borderRadius.full, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  controlBtnText: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.semibold, color: colors.text },
})

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#0a0a1a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#ffffff" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0a0a1a" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1a1a3a" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca3af" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#14142e" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#1a1a2e" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#6b7280" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#1a1a3a" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#1a1a2e" }] },
]
