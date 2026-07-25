import React, { useState, useEffect, useRef, useCallback } from "react"
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Linking, Animated as RNAnimated, ScrollView, Platform } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { BlurView } from "expo-blur"
import { colors, spacing, borderRadius, typography } from "../theme"
import { GlassCard, GlassCardSimple } from "./GlassCard"
import { useDriverStore } from "../stores/driverStore"
import type { RouteStop, Delivery } from "../types"

const { width: SCREEN_WIDTH } = Dimensions.get("window")
const PANEL_HEIGHT = 300

interface NavigationStep {
  instruction: string
  distance: number
  duration: number
  direction?: string
  street?: string
}

interface NavigationPanelProps {
  destination: { lat: number; lng: number; name: string; address: string } | null
  onClose: () => void
  onNavigateToStop?: (stop: RouteStop) => void
}

export function NavigationPanel({ destination, onClose, onNavigateToStop }: NavigationPanelProps) {
  const store = useDriverStore()
  const [steps, setSteps] = useState<NavigationStep[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [eta, setEta] = useState<{ distance: number; duration: number } | null>(null)
  const panelAnim = useRef(new RNAnimated.Value(0)).current

  const nextStop = store.currentStops
    .filter((s) => s.status === "pending")
    .sort((a, b) => a.planned_order - b.planned_order)[0]

  const nextDelivery = nextStop
    ? store.deliveries.find((d) => d.id === nextStop.delivery_id)
    : null

  const currentStop = store.activeStop
    ? store.deliveries.find((d) => d.id === store.activeStop?.delivery_id)
    : null

  const target = destination || (nextDelivery?.customer_lat && nextDelivery?.customer_lng
    ? { lat: nextDelivery.customer_lat, lng: nextDelivery.customer_lng, name: nextDelivery.customer_name, address: nextDelivery.customer_address }
    : null)

  useEffect(() => {
    RNAnimated.spring(panelAnim, { toValue: 1, damping: 15, stiffness: 120, useNativeDriver: true }).start()
    if (target) fetchDirections(target.lat, target.lng)
  }, [target])

  const fetchDirections = async (destLat: number, destLng: number) => {
    setLoading(true)
    try {
      const current = store.lastLocation || { lat: -25.2867, lng: -57.3333 }
      const url = `https://router.project-osrm.org/route/v1/driving/${current.lng},${current.lat};${destLng},${destLat}?overview=false&steps=true&alternatives=false&language=es`
      const response = await fetch(url)
      const data = await response.json()

      if (data.code === "Ok" && data.routes?.[0]) {
        const route = data.routes[0]
        setEta({
          distance: route.distance,
          duration: route.duration,
        })

        const parsedSteps: NavigationStep[] = route.legs[0].steps.map((step: any) => ({
          instruction: step.maneuver?.instruction || step.name || "Continuar",
          distance: step.distance,
          duration: step.duration,
          direction: step.maneuver?.type,
          street: step.name,
        }))
        setSteps(parsedSteps)
      }
    } catch {
      // Fallback: calculate Haversine ETA
      if (store.lastLocation) {
        const R = 6371
        const dLat = ((destLat - store.lastLocation.lat) * Math.PI) / 180
        const dLng = ((destLng - store.lastLocation.lng) * Math.PI) / 180
        const a = Math.sin(dLat / 2) ** 2 + Math.cos((store.lastLocation.lat * Math.PI) / 180) * Math.cos((destLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
        const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        const durMin = (distKm / 30) * 60
        setEta({ distance: distKm * 1000, duration: durMin * 60 })
        setSteps([{ instruction: `Aproximadamente ${distKm.toFixed(1)} km al destino`, distance: distKm * 1000, duration: durMin * 60 }])
      }
    } finally {
      setLoading(false)
    }
  }

  const openGoogleMaps = useCallback((lat: number, lng: number) => {
    const url = Platform.select({
      ios: `comgooglemaps://?q=${lat},${lng}&directionsmode=driving`,
      android: `geo:${lat},${lng}?q=${lat},${lng}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    })
    if (url) Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`)
    })
  }, [])

  const openWaze = useCallback((lat: number, lng: number) => {
    Linking.openURL(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`).catch(() => {
      openGoogleMaps(lat, lng)
    })
  }, [openGoogleMaps])

  const formatDistance = (meters: number) => {
    if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`
    return `${Math.round(meters)} m`
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.round(seconds / 60)
    if (mins < 60) return `${mins} min`
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return `${h}h ${m}min`
  }

  const slideIn = {
    transform: [{
      translateY: panelAnim.interpolate({ inputRange: [0, 1], outputRange: [PANEL_HEIGHT + 100, 0] }),
    }],
  }

  return (
    <RNAnimated.View style={[styles.container, slideIn]}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <LinearGradient colors={["rgba(99,102,241,0.08)", "transparent"]} style={StyleSheet.absoluteFill} />

      {/* Handle */}
      <View style={styles.handleContainer}>
        <View style={styles.handle} />
      </View>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setExpanded(!expanded)} style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>
            {target?.name ? `→ ${target.name}` : "Próxima parada"}
          </Text>
          {target?.address && <Text style={styles.headerAddress} numberOfLines={1}>{target.address}</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* ETA Bar */}
      {eta && (
        <View style={styles.etaBar}>
          <GlassCardSimple style={{ flexDirection: "row", padding: spacing.md, flex: 1 }}>
            <View style={styles.etaItem}>
              <Text style={styles.etaIcon}>📍</Text>
              <Text style={styles.etaValue}>{formatDistance(eta.distance)}</Text>
              <Text style={styles.etaLabel}>Distancia</Text>
            </View>
            <View style={styles.etaDivider} />
            <View style={styles.etaItem}>
              <Text style={styles.etaIcon}>⏱️</Text>
              <Text style={styles.etaValue}>{formatDuration(eta.duration)}</Text>
              <Text style={styles.etaLabel}>ETA estimado</Text>
            </View>
            <View style={styles.etaDivider} />
            <View style={styles.etaItem}>
              <Text style={styles.etaIcon}>🕐</Text>
              <Text style={styles.etaValue}>
                {new Date(Date.now() + eta.duration * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
              <Text style={styles.etaLabel}>Llegada</Text>
            </View>
          </GlassCardSimple>
        </View>
      )}

      {/* Next turn preview */}
      {steps.length > 0 && !expanded && (
        <View style={styles.nextTurn}>
          <View style={styles.turnIcon}>
            <Text style={{ fontSize: 28 }}>
              {steps[0].instruction.toLowerCase().includes("giro") || steps[0].instruction.toLowerCase().includes("dobla") ? "↪️" :
               steps[0].instruction.toLowerCase().includes("siga") || steps[0].instruction.toLowerCase().includes("contin") ? "⬆️" :
               steps[0].instruction.toLowerCase().includes("dest") ? "🏁" : "🚗"}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.turnInstruction} numberOfLines={2}>{steps[0].instruction}</Text>
            {steps[0].street && <Text style={styles.turnStreet}>por {steps[0].street}</Text>}
          </View>
          <Text style={styles.turnDistance}>{formatDistance(steps[0].distance)}</Text>
        </View>
      )}

      {/* Navigation buttons */}
      <View style={styles.navButtons}>
        {target && (
          <>
            <TouchableOpacity style={styles.navBtnGmaps} onPress={() => openGoogleMaps(target.lat, target.lng)}>
              <Text style={styles.navBtnIcon}>🗺️</Text>
              <Text style={styles.navBtnText}>Google Maps</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navBtnWaze} onPress={() => openWaze(target.lat, target.lng)}>
              <Text style={styles.navBtnIcon}>🧭</Text>
              <Text style={styles.navBtnText}>Waze</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Expanded steps list */}
      {expanded && steps.length > 0 && (
        <ScrollView style={styles.stepsList} showsVerticalScrollIndicator={false}>
          {steps.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepDotContainer}>
                <View style={[styles.stepDot, i === 0 && styles.stepDotActive]} />
                {i < steps.length - 1 && <View style={styles.stepLine} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepInstruction}>{step.instruction}</Text>
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <Text style={styles.stepMeta}>{formatDistance(step.distance)}</Text>
                  <Text style={styles.stepMeta}>· {formatDuration(step.duration)}</Text>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Upcoming stops */}
      {store.currentStops.filter((s) => s.status === "pending").length > 0 && (
        <View style={styles.upcomingSection}>
          <Text style={styles.upcomingTitle}>📋 Próximas paradas</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
            {store.currentStops
              .filter((s) => s.status === "pending")
              .slice(0, 5)
              .map((stop) => {
                const del = store.deliveries.find((d) => d.id === stop.delivery_id)
                return (
                  <TouchableOpacity
                    key={stop.id}
                    style={styles.upcomingChip}
                    onPress={() => { onNavigateToStop?.(stop); store.setActiveStop(stop) }}
                  >
                    <Text style={styles.upcomingChipOrder}>#{stop.planned_order}</Text>
                    <Text style={styles.upcomingChipName}>{del?.customer_name || "—"}</Text>
                    {del?.total_amount ? <Text style={styles.upcomingChipAmount}>Gs. {del.total_amount.toLocaleString()}</Text> : null}
                  </TouchableOpacity>
                )
              })}
          </ScrollView>
        </View>
      )}
    </RNAnimated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
    maxHeight: PANEL_HEIGHT + 200,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  handleContainer: { alignItems: "center", paddingTop: spacing.sm, paddingBottom: spacing.xs },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  headerTitle: { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.bold, color: colors.text },
  headerAddress: { fontSize: typography.fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center", marginLeft: spacing.sm },
  closeBtnText: { fontSize: 14, color: colors.textSecondary },
  etaBar: { paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  etaItem: { flex: 1, alignItems: "center", gap: 2 },
  etaIcon: { fontSize: 16 },
  etaValue: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.bold, color: colors.text },
  etaLabel: { fontSize: typography.fontSize.xs, color: colors.textTertiary },
  etaDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.08)", marginHorizontal: spacing.sm },
  nextTurn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: borderRadius.md,
  },
  turnIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(99,102,241,0.15)", alignItems: "center", justifyContent: "center" },
  turnInstruction: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.semibold, color: colors.text },
  turnStreet: { fontSize: typography.fontSize.xs, color: colors.textSecondary, marginTop: 1 },
  turnDistance: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.bold, color: colors.primaryLight },
  navButtons: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  navBtnGmaps: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, paddingVertical: spacing.md, borderRadius: borderRadius.md, backgroundColor: "rgba(66,133,244,0.2)", borderWidth: 1, borderColor: "rgba(66,133,244,0.3)" },
  navBtnWaze: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, paddingVertical: spacing.md, borderRadius: borderRadius.md, backgroundColor: "rgba(51,204,255,0.15)", borderWidth: 1, borderColor: "rgba(51,204,255,0.3)" },
  navBtnIcon: { fontSize: 16 },
  navBtnText: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.semibold, color: colors.text },
  stepsList: { maxHeight: 180, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  stepRow: { flexDirection: "row", gap: spacing.md, paddingVertical: spacing.xs },
  stepDotContainer: { width: 24, alignItems: "center" },
  stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "rgba(255,255,255,0.2)", marginTop: 4 },
  stepDotActive: { backgroundColor: colors.primary, width: 12, height: 12, borderRadius: 6 },
  stepLine: { width: 2, flex: 1, backgroundColor: "rgba(255,255,255,0.06)", marginTop: 2 },
  stepInstruction: { fontSize: typography.fontSize.sm, color: colors.text, fontFamily: typography.fontFamily.medium },
  stepMeta: { fontSize: typography.fontSize.xs, color: colors.textTertiary },
  upcomingSection: { paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" },
  upcomingTitle: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.semibold, color: colors.textSecondary, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  upcomingChip: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    minWidth: 120,
  },
  upcomingChipOrder: { fontSize: typography.fontSize.xs, color: colors.textTertiary, fontFamily: typography.fontFamily.bold },
  upcomingChipName: { fontSize: typography.fontSize.sm, color: colors.text, fontFamily: typography.fontFamily.semibold, marginTop: 2 },
  upcomingChipAmount: { fontSize: typography.fontSize.xs, color: colors.success, marginTop: 2 },
})
