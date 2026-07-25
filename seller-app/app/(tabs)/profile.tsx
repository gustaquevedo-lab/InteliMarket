import React from "react"
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch, Alert } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { router } from "expo-router"
import { colors, borderRadius, spacing, typography } from "../../src/theme"
import { GlassCard, GlassCardSimple } from "../../src/components/GlassCard"
import { useAppStore } from "../../src/stores/appStore"
import { useBatteryLevel } from "../../src/hooks/useNetwork"
import { stopGPSTracking } from "../../src/services/location"
import { deleteToken } from "../../src/services/storage"

export default function ProfileScreen() {
  const { user, profile, isOnline, isTracking, batteryLevel, useBiometrics, setUseBiometrics, logout, unreadAlerts } = useAppStore()
  const { getBatteryColor, getBatteryIcon } = useBatteryLevel()

  const handleLogout = () => {
    Alert.alert("Cerrar sesión", "¿Estás seguro?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Salir",
        style: "destructive",
        onPress: async () => {
          await stopGPSTracking()
          await deleteToken()
          logout()
        },
      },
    ])
  }

  const stats = [
    { icon: "📍", label: "Visitas hoy", value: "—" },
    { icon: "📊", label: "Score rendimiento", value: "—" },
    { icon: "⏱️", label: "Horas hoy", value: "—" },
    { icon: "📦", label: "Pedidos hoy", value: "—" },
  ]

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header with avatar */}
      <LinearGradient colors={colors.gradientPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <View style={styles.avatar}>
          {profile?.photo_url ? (
            <Text style={{ fontSize: 32 }}>👤</Text>
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarLetter}>{(user?.nombre || "V").charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </View>
        <Text style={styles.name}>{user?.nombre || "Vendedor"}</Text>
        <Text style={styles.email}>{user?.email || ""}</Text>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: isOnline ? colors.online : colors.offline }]} />
          <Text style={styles.statusText}>{isOnline ? "Online" : "Offline"}</Text>
          <Text style={styles.batteryText}>{getBatteryIcon()} {batteryLevel}%</Text>
        </View>
      </LinearGradient>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}>
        {/* Quick stats */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginBottom: spacing.xl }}>
          {stats.map((stat, i) => (
            <GlassCardSimple key={i} style={{ width: "47%" }}>
              <Text style={{ fontSize: 24, marginBottom: 4 }}>{stat.icon}</Text>
              <Text style={{ color: colors.text, fontFamily: typography.fontFamily.bold, fontSize: typography.fontSize.lg }}>{stat.value}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: typography.fontSize.xs }}>{stat.label}</Text>
            </GlassCardSimple>
          ))}
        </View>

        {/* Settings */}
        <Text style={styles.sectionTitle}>Configuración</Text>
        <GlassCard intensity={15}>
          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Usar biometría</Text>
              <Text style={styles.settingDesc}>Accedé con huella digital o Face ID</Text>
            </View>
            <Switch
              value={useBiometrics}
              onValueChange={setUseBiometrics}
              trackColor={{ false: "rgba(255,255,255,0.1)", true: "rgba(99,102,241,0.4)" }}
              thumbColor={useBiometrics ? colors.primary : "#666"}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>GPS en segundo plano</Text>
              <Text style={styles.settingDesc}>{isTracking ? "Activo — enviando ubicación" : "Inactivo"}</Text>
            </View>
            <View style={[styles.statusPulse, { backgroundColor: isTracking ? colors.success : colors.textTertiary }]} />
          </View>
          <View style={styles.divider} />
          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Notificaciones</Text>
              <Text style={styles.settingDesc}>{unreadAlerts} alertas sin leer</Text>
            </View>
            <Text style={{ color: unreadAlerts > 0 ? colors.error : colors.textSecondary }}>
              {unreadAlerts > 0 ? "🔴" : "🟢"}
            </Text>
          </View>
        </GlassCard>

        {/* App info */}
        <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>Información</Text>
        <GlassCard intensity={15}>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Versión</Text><Text style={styles.infoValue}>1.0.0</Text></View>
          <View style={styles.divider} />
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Compañía</Text><Text style={styles.infoValue}>{user?.company_id?.slice(0, 8) || "—"}</Text></View>
          <View style={styles.divider} />
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Código vendedor</Text><Text style={styles.infoValue}>{profile?.codigo_vendedor || "—"}</Text></View>
          <View style={styles.divider} />
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Zona</Text><Text style={styles.infoValue}>{profile?.zona_asignada || "—"}</Text></View>
        </GlassCard>

        {/* Logout */}
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    paddingTop: 60,
    paddingBottom: spacing.xxl,
  },
  avatar: {
    marginBottom: spacing.md,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  avatarLetter: {
    fontSize: 32,
    fontFamily: typography.fontFamily.bold,
    color: colors.text,
  },
  name: {
    fontSize: typography.fontSize.xxl,
    fontFamily: typography.fontFamily.bold,
    color: colors.text,
  },
  email: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    color: "rgba(255,255,255,0.7)",
  },
  batteryText: {
    fontSize: typography.fontSize.xs,
    color: "rgba(255,255,255,0.7)",
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  settingLabel: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semibold,
    color: colors.text,
  },
  settingDesc: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusPulse: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
  },
  infoLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    color: colors.text,
  },
  logoutBtn: {
    marginTop: spacing.xxl,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.08)",
  },
  logoutText: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semibold,
    color: colors.error,
  },
})
