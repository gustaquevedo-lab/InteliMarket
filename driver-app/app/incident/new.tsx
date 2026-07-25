import React, { useState, useCallback } from "react"
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert } from "react-native"
import { router } from "expo-router"
import Animated, { FadeInUp } from "react-native-reanimated"
import { LinearGradient } from "expo-linear-gradient"
import { colors, spacing, borderRadius, typography } from "../../src/theme"
import { GlassCard, GlassCardSimple } from "../../src/components/GlassCard"
import { useDriverStore } from "../../src/stores/driverStore"
import { api } from "../../src/services/api"

const INCIDENT_TYPES = [
  { id: "customer_absent", icon: "🚪", label: "Cliente ausente" },
  { id: "wrong_address", icon: "📍", label: "Dirección incorrecta" },
  { id: "damaged_package", icon: "📦", label: "Paquete dañado" },
  { id: "rejected", icon: "🚫", label: "Cliente rechazó" },
  { id: "other", icon: "❓", label: "Otro" },
] as const

export default function IncidentScreen() {
  const store = useDriverStore()
  const [tipo, setTipo] = useState<string | null>(null)
  const [descripcion, setDescripcion] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = useCallback(async () => {
    if (!tipo || !descripcion.trim()) {
      Alert.alert("Error", "Completá el tipo y descripción del incidente")
      return
    }

    setLoading(true)
    try {
      await api.incidents.report({
        delivery_id: store.activeStop?.delivery_id,
        tipo,
        descripcion: descripcion.trim(),
      })

      if (store.activeStop) {
        store.updateStopStatus(store.activeStop.id, "missed", {
          result: tipo,
          notas: descripcion.trim(),
        })
      }

      Alert.alert("Incidente reportado", "El despachador será notificado", [
        { text: "Volver", onPress: () => router.back() },
      ])
    } catch (e: any) {
      Alert.alert("Error", e.message || "No se pudo reportar el incidente")
    } finally {
      setLoading(false)
    }
  }, [tipo, descripcion, store])

  return (
    <LinearGradient colors={colors.gradientBg} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 100 }}>
        <Animated.View entering={FadeInUp.duration(400).springify()}>
          <Text style={{ fontSize: 48, textAlign: "center", marginBottom: spacing.md }}>⚠️</Text>
          <Text style={styles.title}>Reportar incidencia</Text>
          <Text style={styles.subtitle}>Seleccioná el tipo y describí qué pasó</Text>

          <Text style={styles.sectionLabel}>Tipo de incidencia</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.xl }}>
            {INCIDENT_TYPES.map((inc) => (
              <TouchableOpacity
                key={inc.id}
                style={[styles.typeBtn, tipo === inc.id && styles.typeBtnActive]}
                onPress={() => setTipo(inc.id)}
              >
                <Text style={{ fontSize: 20 }}>{inc.icon}</Text>
                <Text style={[styles.typeBtnText, tipo === inc.id && styles.typeBtnTextActive]}>
                  {inc.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionLabel}>Descripción</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Describí qué pasó..."
            placeholderTextColor={colors.textTertiary}
            value={descripcion}
            onChangeText={setDescripcion}
            multiline
            numberOfLines={4}
          />

          <TouchableOpacity
            style={[styles.submitBtn, loading && { opacity: 0.5 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.submitBtnText}>{loading ? "Enviando..." : "📤 Reportar incidencia"}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
            <Text style={styles.cancelBtnText}>Cancelar</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  title: { fontSize: typography.fontSize.xl, fontFamily: typography.fontFamily.bold, color: colors.text, textAlign: "center" },
  subtitle: { fontSize: typography.fontSize.sm, color: colors.textSecondary, textAlign: "center", marginBottom: spacing.xl, marginTop: spacing.xs },
  sectionLabel: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.semibold, color: colors.textSecondary, marginBottom: spacing.sm, textTransform: "uppercase" },
  typeBtn: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border },
  typeBtnActive: { borderColor: colors.primary, backgroundColor: "rgba(99,102,241,0.1)" },
  typeBtnText: { fontSize: typography.fontSize.sm, color: colors.text },
  typeBtnTextActive: { color: colors.primary, fontFamily: typography.fontFamily.semibold },
  textArea: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: borderRadius.md, padding: spacing.md, fontSize: typography.fontSize.sm, color: colors.text, borderWidth: 1, borderColor: colors.border, minHeight: 100, textAlignVertical: "top" },
  submitBtn: { padding: spacing.lg, borderRadius: borderRadius.md, backgroundColor: colors.error, alignItems: "center", marginTop: spacing.xl },
  submitBtnText: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.semibold, color: colors.text },
  cancelBtn: { padding: spacing.md, borderRadius: borderRadius.md, alignItems: "center", marginTop: spacing.md },
  cancelBtnText: { fontSize: typography.fontSize.sm, color: colors.textSecondary },
})
