import React, { useCallback } from "react"
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from "react-native"
import { router } from "expo-router"
import Animated, { FadeInUp } from "react-native-reanimated"
import { LinearGradient } from "expo-linear-gradient"
import { colors, spacing, borderRadius, typography, glass } from "../../src/theme"
import { GlassCard, GlassCardSimple } from "../../src/components/GlassCard"
import { useDriverStore } from "../../src/stores/driverStore"
import { useLocation } from "../../src/hooks/useLocation"
import { useNetwork } from "../../src/hooks/useNetwork"

export default function ProfileScreen() {
  const store = useDriverStore()
  const { isTracking, stopTracking } = useLocation()
  const { isOnline } = useNetwork()

  const handleLogout = useCallback(() => {
    Alert.alert("Cerrar sesión", "¿Estás seguro?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Salir",
        style: "destructive",
        onPress: async () => {
          if (isTracking) await stopTracking()
          store.logout()
          router.replace("/")
        },
      },
    ])
  }, [store, isTracking, stopTracking])

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LinearGradient colors={colors.gradientBg} style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {store.user?.nombre?.charAt(0)?.toUpperCase() || "R"}
          </Text>
        </View>
        <Text style={styles.userName}>{store.user?.nombre || "Repartidor"}</Text>
        <Text style={styles.userEmail}>{store.user?.email || ""}</Text>
        <View style={[styles.statusBadge, { backgroundColor: isOnline ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)" }]}>
          <Text style={[styles.statusText, { color: isOnline ? colors.success : colors.error }]}>
            {isOnline ? "🟢 En línea" : "🔴 Offline"}
          </Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}>
        <GlassCard style={{ marginBottom: spacing.lg }}>
          <Text style={styles.sectionTitle}>🚚 Vehículo asignado</Text>
          {store.assignedVehicle ? (
            <>
              <Text style={styles.vehicleName}>
                {store.assignedVehicle.marca} {store.assignedVehicle.modelo} ({store.assignedVehicle.ano})
              </Text>
              <Text style={styles.vehicleDetail}>Patente: {store.assignedVehicle.patente}</Text>
              <Text style={styles.vehicleDetail}>Capacidad: {store.assignedVehicle.capacidad_kg} kg</Text>
              {store.assignedVehicle.caja_termica && (
                <Text style={styles.vehicleDetail}>❄️ Caja térmica</Text>
              )}
            </>
          ) : (
            <Text style={styles.noVehicle}>Sin vehículo asignado</Text>
          )}
        </GlassCard>

        <GlassCard style={{ marginBottom: spacing.lg }}>
          <Text style={styles.sectionTitle}>⚙️ Configuración</Text>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>📍 Tracking GPS</Text>
            <Text style={styles.settingValue}>{isTracking ? "Activo" : "Inactivo"}</Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>📡 Frecuencia GPS</Text>
            <Text style={styles.settingValue}>10 segundos</Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>📶 Conexión</Text>
            <Text style={styles.settingValue}>{isOnline ? "En línea" : "Offline"}</Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>🔄 Cola de sync</Text>
            <Text style={styles.settingValue}>{store.syncQueueCount} pendientes</Text>
          </View>
        </GlassCard>

        <GlassCard style={{ marginBottom: spacing.lg }}>
          <Text style={styles.sectionTitle}>📊 Mis estadísticas</Text>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Entregas hoy</Text>
            <Text style={styles.settingValue}>{store.deliveries.length}</Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Completadas</Text>
            <Text style={[styles.settingValue, { color: colors.success }]}>
              {store.deliveries.filter((d) => d.status === "delivered").length}
            </Text>
          </View>
        </GlassCard>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>🚪 Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  header: { alignItems: "center", paddingTop: 60, paddingBottom: spacing.xxl },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginBottom: spacing.md, borderWidth: 3, borderColor: "rgba(255,255,255,0.2)" },
  avatarText: { fontSize: 36, fontFamily: typography.fontFamily.bold, color: colors.text },
  userName: { fontSize: typography.fontSize.xl, fontFamily: typography.fontFamily.bold, color: colors.text },
  userEmail: { fontSize: typography.fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  statusBadge: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xs, borderRadius: borderRadius.full, marginTop: spacing.md },
  statusText: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.semibold },
  sectionTitle: { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.semibold, color: colors.text, marginBottom: spacing.md },
  vehicleName: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.bold, color: colors.text },
  vehicleDetail: { fontSize: typography.fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  noVehicle: { fontSize: typography.fontSize.md, color: colors.textTertiary, fontStyle: "italic" },
  settingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  settingLabel: { fontSize: typography.fontSize.sm, color: colors.text },
  settingValue: { fontSize: typography.fontSize.sm, color: colors.textSecondary, fontFamily: typography.fontFamily.medium },
  logoutBtn: { marginTop: spacing.lg, padding: spacing.lg, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.error, alignItems: "center" },
  logoutText: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.semibold, color: colors.error },
})
