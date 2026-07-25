import React, { useState, useEffect } from "react"
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, FlatList, Alert } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { router, useLocalSearchParams } from "expo-router"
import * as Haptics from "expo-haptics"
import { colors, borderRadius, spacing, typography } from "../../src/theme"
import { GlassCard, GlassCardSimple } from "../../src/components/GlassCard"
import { useAppStore } from "../../src/stores/appStore"
import { api } from "../../src/services/api"

type Customer = {
  id: string
  nombre: string
  direccion?: string
  telefono?: string
  email?: string
  ruc?: string
  credito_disponible?: number
  credito_limite?: number
  saldo_pendiente?: number
  ultima_venta?: string
  frecuencia_compra?: string
  categoria?: string
  latitud?: number
  longitud?: number
  visitas_ultimo_mes?: number
  total_comprado_mes?: number
}

type Agreement = {
  id: string
  tipo: string
  estado: string
  descuento?: number
  descuento_base?: number
  descuento_volumen?: number
  fecha_inicio: string
  fecha_fin: string
  vence_en?: number
}

type LastVisit = {
  id: string
  fecha: string
  resultado: string
  monto_pedido: number
  rating: number
}

export default function CustomerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [agreements, setAgreements] = useState<Agreement[]>([])
  const [lastVisits, setLastVisits] = useState<LastVisit[]>([])
  const [activeTab, setActiveTab] = useState<"resumen" | "acuerdos" | "historial">("resumen")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [id])

  const loadData = async () => {
    try {
      // Try loading from SQLite cache first
      const cached = (await import("../../src/services/storage")).getFromCache("customer_" + id)
      if (cached) setCustomer(cached as Customer)
    } catch {}
    try {
      // Then try API
      const [cust, agree, visits] = await Promise.all([
        api.customers.get(id!).catch(() => null),
        api.getAgreementsByCustomer(id!).catch(() => []),
        api.getCustomerLastVisits(id!).catch(() => []),
      ])
      if (cust) setCustomer(cust)
      if (agree) setAgreements(agree)
      if (visits) setLastVisits(visits)
    } catch {}
    setLoading(false)
  }

  const renderStars = (n: number) => "⭐".repeat(n)

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <LinearGradient colors={colors.gradientPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>{(customer?.nombre || "C").charAt(0)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.customerName}>{customer?.nombre || "Cargando..."}</Text>
            <Text style={styles.customerMeta}>{customer?.categoria || "—"} {customer?.ruc ? `• ${customer.ruc}` : ""}</Text>
            {customer?.telefono && <Text style={styles.customerMeta}>📞 {customer.telefono}</Text>}
            {customer?.email && <Text style={styles.customerMeta}>✉️ {customer.email}</Text>}
          </View>
        </View>
      </LinearGradient>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(["resumen", "acuerdos", "historial"] as const).map((tab) => (
          <TouchableOpacity key={tab} onPress={() => { setActiveTab(tab); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) }}
            style={[styles.tab, activeTab === tab && styles.tabActive]}>
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === "resumen" ? "📊 Resumen" : tab === "acuerdos" ? "📋 Acuerdos" : "📜 Historial"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}>

        {/* Resumen tab */}
        {activeTab === "resumen" && (
          <View style={{ gap: spacing.lg }}>
            {/* Credit KPIs */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
              <GlassCardSimple style={{ width: "47%" }}>
                <Text style={{ fontSize: 24, marginBottom: 2 }}>💳</Text>
                <Text style={styles.kpiValue}>Gs. {(customer?.credito_disponible ?? 0).toLocaleString()}</Text>
                <Text style={styles.kpiLabel}>Crédito disponible</Text>
              </GlassCardSimple>
              <GlassCardSimple style={{ width: "47%" }}>
                <Text style={{ fontSize: 24, marginBottom: 2 }}>💰</Text>
                <Text style={[styles.kpiValue, { color: colors.warning }]}>Gs. {(customer?.saldo_pendiente ?? 0).toLocaleString()}</Text>
                <Text style={styles.kpiLabel}>Saldo pendiente</Text>
              </GlassCardSimple>
              <GlassCardSimple style={{ width: "47%" }}>
                <Text style={{ fontSize: 24, marginBottom: 2 }}>📈</Text>
                <Text style={styles.kpiValue}>Gs. {(customer?.total_comprado_mes ?? 0).toLocaleString()}</Text>
                <Text style={styles.kpiLabel}>Comprado este mes</Text>
              </GlassCardSimple>
              <GlassCardSimple style={{ width: "47%" }}>
                <Text style={{ fontSize: 24, marginBottom: 2 }}>📅</Text>
                <Text style={styles.kpiValue}>{customer?.visitas_ultimo_mes ?? 0}</Text>
                <Text style={styles.kpiLabel}>Visitas último mes</Text>
              </GlassCardSimple>
            </View>

            {/* Quick info */}
            <GlassCard intensity={15}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Dirección</Text>
                <Text style={styles.infoValue}>{customer?.direccion || "—"}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Frecuencia de compra</Text>
                <Text style={styles.infoValue}>{customer?.frecuencia_compra || "—"}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Última venta</Text>
                <Text style={styles.infoValue}>{customer?.ultima_venta ? new Date(customer.ultima_venta).toLocaleDateString("es-PY") : "—"}</Text>
              </View>
            </GlassCard>

            {/* Map link */}
            {customer?.latitud && customer?.longitud && (
              <TouchableOpacity onPress={() => Alert.alert("Abrir mapa", `Lat: ${customer.latitud}, Lng: ${customer.longitud}`)}>
                <GlassCard intensity={15}>
                  <Text style={{ color: colors.primaryLight, fontFamily: typography.fontFamily.medium }}>📍 Ver en el mapa</Text>
                </GlassCard>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Acuerdos tab */}
        {activeTab === "acuerdos" && (
          <View style={{ gap: spacing.md }}>
            {agreements.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: spacing.xxl }}>
                <Text style={{ fontSize: 48, marginBottom: spacing.md }}>📋</Text>
                <Text style={{ color: colors.textSecondary }}>Sin acuerdos comerciales activos</Text>
              </View>
            ) : (
              agreements.map((ag) => (
                <GlassCard key={ag.id} intensity={20}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.agreeTipo}>{ag.tipo}</Text>
                      <Text style={styles.agreeFechas}>
                        {new Date(ag.fecha_inicio).toLocaleDateString("es-PY")} — {new Date(ag.fecha_fin).toLocaleDateString("es-PY")}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: ag.estado === "activo" ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)" }]}>
                      <Text style={[styles.statusText, { color: ag.estado === "activo" ? colors.success : colors.textTertiary }]}>
                        {ag.estado}
                      </Text>
                    </View>
                  </View>
                  {ag.descuento && (
                    <Text style={styles.agreeDiscount}>Descuento base: {ag.descuento}%</Text>
                  )}
                </GlassCard>
              ))
            )}
          </View>
        )}

        {/* Historial tab */}
        {activeTab === "historial" && (
          <View style={{ gap: spacing.md }}>
            {lastVisits.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: spacing.xxl }}>
                <Text style={{ fontSize: 48, marginBottom: spacing.md }}>📜</Text>
                <Text style={{ color: colors.textSecondary }}>Sin visitas registradas</Text>
              </View>
            ) : (
              lastVisits.map((v) => (
                <GlassCard key={v.id} intensity={15}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <View>
                      <Text style={{ color: colors.text, fontFamily: typography.fontFamily.semibold }}>
                        {new Date(v.fecha).toLocaleDateString("es-PY", { weekday: "short", day: "numeric", month: "short" })}
                      </Text>
                      <Text style={{ color: colors.textSecondary, fontSize: typography.fontSize.xs }}>
                        {v.resultado}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      {v.monto_pedido > 0 && (
                        <Text style={{ color: colors.success, fontFamily: typography.fontFamily.bold }}>
                          Gs. {v.monto_pedido.toLocaleString()}
                        </Text>
                      )}
                      {v.rating > 0 && <Text style={{ fontSize: 12 }}>{renderStars(v.rating)}</Text>}
                    </View>
                  </View>
                </GlassCard>
              ))
            )}
          </View>
        )}

      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 50,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  backBtn: {
    marginBottom: spacing.md,
  },
  backText: {
    fontSize: typography.fontSize.md,
    color: "rgba(255,255,255,0.8)",
    fontFamily: typography.fontFamily.medium,
  },
  headerContent: {
    flexDirection: "row",
    gap: spacing.lg,
    alignItems: "center",
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    fontSize: 24,
    fontFamily: typography.fontFamily.bold,
    color: colors.text,
  },
  customerName: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
    color: colors.text,
  },
  customerMeta: {
    fontSize: typography.fontSize.xs,
    color: "rgba(255,255,255,0.7)",
    marginTop: 1,
  },
  tabs: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  tabActive: {
    backgroundColor: "rgba(99,102,241,0.15)",
  },
  tabText: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.medium,
  },
  tabTextActive: {
    color: colors.primary,
  },
  kpiValue: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    color: colors.text,
  },
  kpiLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
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
    flex: 1,
    textAlign: "right",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  agreeTipo: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semibold,
    color: colors.text,
    textTransform: "capitalize" as const,
  },
  agreeFechas: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.medium,
    textTransform: "capitalize" as const,
  },
  agreeDiscount: {
    fontSize: typography.fontSize.sm,
    color: colors.primaryLight,
    fontFamily: typography.fontFamily.medium,
    marginTop: spacing.sm,
  },
})
