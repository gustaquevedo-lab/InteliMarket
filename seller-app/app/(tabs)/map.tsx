import React, { useEffect, useState, useRef } from "react"
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from "react-native"
import MapView, { Marker, Callout, Polyline, Polygon, PROVIDER_GOOGLE } from "react-native-maps"
import { router } from "expo-router"
import { LinearGradient } from "expo-linear-gradient"
import { colors, borderRadius, spacing, typography } from "../../src/theme"
import { GlassCardSimple } from "../../src/components/GlassCard"
import { useAppStore } from "../../src/stores/appStore"
import { api } from "../../src/services/api"

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window")

export default function MapScreen() {
  const { user, currentStops, lastLocation } = useAppStore()
  const companyId = user?.company_id || "00000000-0000-0000-0000-000000000010"
  const mapRef = useRef<MapView>(null)
  const [region, setRegion] = useState({
    latitude: -25.2637,
    longitude: -57.5759,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  })

  const [customers, setCustomers] = useState<any[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (lastLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: lastLocation.lat,
        longitude: lastLocation.lng,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }, 500)
    }
  }, [lastLocation])

  const loadData = async () => {
    try {
      const allCustomers = await api.distribuidora.tracking.sellers.list(companyId)
      // Get customer details for stops
      const customerIds = [...new Set(currentStops.map((s) => s.customer_id))]
      const customerDetails = await Promise.all(
        customerIds.map((id) => api.customers.get(companyId, id).catch(() => null))
      )
      setCustomers(customerDetails.filter(Boolean))
    } catch {}
  }

  const focusOnCustomer = (customer: any) => {
    if (customer.latitud && customer.longitud && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: customer.latitud,
        longitude: customer.longitud,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }, 300)
    }
  }

  const visitedCustomers = currentStops.filter((s) => s.status === "completed").map((s) => s.customer_id)
  const pendingCustomers = currentStops.filter((s) => s.status === "pending").map((s) => s.customer_id)
  const inProgressCustomer = currentStops.find((s) => s.status === "in_progress")?.customer_id

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <LinearGradient colors={colors.gradientBg} style={styles.header}>
        <Text style={styles.title}>🗺️ Mapa</Text>
        <Text style={styles.subtitle}>{currentStops.length} clientes en ruta</Text>
      </LinearGradient>

      {/* Map */}
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton
        rotateEnabled
        pitchEnabled
      >
        {/* Customer markers */}
        {customers.map((customer) => {
          if (!customer.latitud || !customer.longitud) return null
          const isVisited = visitedCustomers.includes(customer.id)
          const isPending = pendingCustomers.includes(customer.id)
          const isInProgress = inProgressCustomer === customer.id

          return (
            <Marker
              key={customer.id}
              coordinate={{ latitude: customer.latitud, longitude: customer.longitud }}
              title={customer.nombre || customer.razon_social}
              description={customer.direccion}
              pinColor={isInProgress ? colors.primary : isVisited ? colors.success : colors.warning}
              onPress={() => setSelectedCustomer(customer)}
            >
              <Callout onPress={() => {
                const stop = currentStops.find((s) => s.customer_id === customer.id)
                if (stop) router.push(`/visit/${stop.id}`)
              }}>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>{customer.nombre || customer.razon_social}</Text>
                  <Text style={styles.calloutText}>{customer.direccion}</Text>
                  {customer.limite_credito > 0 && (
                    <Text style={styles.calloutText}>💰 Gs. {customer.limite_credito.toLocaleString()}</Text>
                  )}
                  <Text style={styles.calloutAction}>👉 Visitar</Text>
                </View>
              </Callout>
            </Marker>
          )
        })}

        {/* Route polyline connecting stops in order */}
        {currentStops.length > 1 && (
          <Polyline
            coordinates={currentStops
              .map((stop) => {
                const customer = customers.find((c) => c.id === stop.customer_id)
                if (!customer?.latitud || !customer?.longitud) return null
                return { latitude: customer.latitud, longitude: customer.longitud }
              })
              .filter(Boolean) as any}
            strokeColor={colors.primary}
            strokeWidth={3}
            lineDashPattern={[10, 5]}
          />
        )}
      </MapView>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.warning }]} /><Text style={styles.legendText}>Pendiente ({pendingCustomers.length})</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.success }]} /><Text style={styles.legendText}>Completado ({visitedCustomers.length})</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.primary }]} /><Text style={styles.legendText}>En curso</Text></View>
      </View>

      {/* Bottom customer list */}
      {selectedCustomer && (
        <View style={styles.bottomSheet}>
          <View style={styles.bottomHandle} />
          <GlassCardSimple>
            <Text style={styles.customerName}>{selectedCustomer.nombre || selectedCustomer.razon_social}</Text>
            <Text style={styles.customerDetail}>📍 {selectedCustomer.direccion}</Text>
            {selectedCustomer.ruc && <Text style={styles.customerDetail}>🆔 {selectedCustomer.ruc}</Text>}
            <View style={styles.bottomActions}>
              <TouchableOpacity
                onPress={() => {
                  const stop = currentStops.find((s) => s.customer_id === selectedCustomer.id)
                  if (stop) router.push(`/visit/${stop.id}`)
                }}
                style={styles.actionBtnPrimary}
              >
                <Text style={styles.actionBtnText}>Iniciar visita</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push(`/customer/${selectedCustomer.id}`)}
                style={styles.actionBtnSecondary}
              >
                <Text style={styles.actionBtnTextS}>Ver cliente</Text>
              </TouchableOpacity>
            </View>
          </GlassCardSimple>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 50,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  title: {
    fontSize: typography.fontSize.xxl,
    fontFamily: typography.fontFamily.bold,
    color: colors.text,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    marginTop: 2,
  },
  callout: {
    padding: spacing.sm,
    minWidth: 150,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  calloutText: {
    fontSize: 12,
    color: "#666",
    marginBottom: 2,
  },
  calloutAction: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: "600",
    marginTop: 4,
  },
  legend: {
    position: "absolute",
    top: 100,
    right: spacing.md,
    backgroundColor: "rgba(10,10,26,0.9)",
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  bottomSheet: {
    position: "absolute",
    bottom: 100,
    left: spacing.lg,
    right: spacing.lg,
    gap: spacing.md,
  },
  bottomHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignSelf: "center",
  },
  customerName: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    color: colors.text,
  },
  customerDetail: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  bottomActions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  actionBtnPrimary: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: "center",
  },
  actionBtnSecondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: "center",
  },
  actionBtnText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    color: colors.text,
  },
  actionBtnTextS: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    color: colors.textSecondary,
  },
})
