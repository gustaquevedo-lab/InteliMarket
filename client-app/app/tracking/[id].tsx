import { useState, useEffect, useRef } from "react"
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { ArrowLeft, MapPin, Navigation, Truck } from "lucide-react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps"
import { GlassCard } from "../../src/components/GlassCard"
import { colors, spacing, borderRadius, typography } from "../../src/theme"
import { api } from "../../src/services/api"

export default function TrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [tracking, setTracking] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const router = useRouter()
  const mapRef = useRef<MapView>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval>>()

  const fetchTracking = async () => {
    try {
      const data = await api.orders.tracking(id!)
      setTracking(data)
      setError("")
    } catch {
      if (!tracking) setError("El pedido aún no tiene información de seguimiento")
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchTracking()
    intervalRef.current = setInterval(fetchTracking, 15000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [id])

  const openNavigation = () => {
    if (tracking?.latitud && tracking?.longitud) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${tracking.latitud},${tracking.longitud}`
      // Linking.openURL(url) — would open maps
    }
  }

  if (loading) return <SafeAreaView style={styles.container}><ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} /></SafeAreaView>

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.back}><ArrowLeft size={22} color={colors.text} /></TouchableOpacity>
      <Text style={styles.header}>Seguimiento de Entrega</Text>
      {error ? (
        <View style={styles.errorContainer}>
          <Truck size={48} color={colors.textMuted} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : tracking ? (
        <View style={{ flex: 1 }}>
          <View style={styles.mapContainer}>
            <MapView
              ref={mapRef} style={StyleSheet.absoluteFill}
              initialRegion={{
                latitude: parseFloat(tracking.latitud) || -25.2637,
                longitude: parseFloat(tracking.longitud) || -57.5759,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }}
            >
              {tracking.latitud && tracking.longitud && (
                <Marker
                  coordinate={{ latitude: parseFloat(tracking.latitud), longitude: parseFloat(tracking.longitud) }}
                  title={tracking.driver_nombre || "Repartidor"}
                  description={tracking.estado}
                >
                  <View style={styles.marker}><Truck size={18} color="#fff" /></View>
                </Marker>
              )}
            </MapView>
          </View>
          <GlassCard style={styles.infoCard}>
            <View style={styles.infoRow}>
              <MapPin size={16} color={colors.primary} />
              <Text style={styles.infoText}>{tracking.direccion || "Sin dirección"}</Text>
            </View>
            {tracking.driver_nombre && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Repartidor:</Text>
                <Text style={styles.infoValue}>{tracking.driver_nombre}</Text>
              </View>
            )}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Estado:</Text>
              <Text style={[styles.infoValue, styles.statusText]}>{tracking.estado}</Text>
            </View>
            <TouchableOpacity style={styles.navBtn} onPress={openNavigation}>
              <Navigation size={18} color="#fff" />
              <Text style={styles.navBtnText}>Abrir en Google Maps</Text>
            </TouchableOpacity>
          </GlassCard>
        </View>
      ) : null}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  back: { padding: spacing.lg },
  header: { fontSize: 22, fontWeight: "800", color: colors.text, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  mapContainer: { flex: 1, marginHorizontal: spacing.lg, borderRadius: borderRadius.xl, overflow: "hidden" },
  marker: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#fff" },
  infoCard: { margin: spacing.lg },
  infoRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.sm, gap: spacing.sm },
  infoText: { ...typography.body, flex: 1, color: colors.textSecondary },
  infoLabel: { ...typography.caption, fontWeight: "600" },
  infoValue: { ...typography.body, flex: 1 },
  statusText: { color: colors.primary, fontWeight: "600", textTransform: "capitalize" },
  navBtn: { flexDirection: "row", alignItems: "center", backgroundColor: colors.primary, borderRadius: borderRadius.md, padding: spacing.md, justifyContent: "center", gap: spacing.sm, marginTop: spacing.md },
  navBtnText: { color: "#fff", fontWeight: "600" },
  errorContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  errorText: { ...typography.body, color: colors.textMuted, marginTop: spacing.md, textAlign: "center" },
})
