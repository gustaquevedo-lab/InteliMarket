import { useState, useCallback } from "react"
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter, useFocusEffect } from "expo-router"
import { ArrowLeft, MapPin, Plus, Trash2, Star } from "lucide-react-native"
import { api } from "../../src/services/api"
import { GlassCard } from "../../src/components/GlassCard"
import { colors, spacing, borderRadius, typography } from "../../src/theme"
import type { Address } from "../../src/types"

export default function AddressesScreen() {
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useFocusEffect(useCallback(() => {
    api.addresses.list().then(setAddresses).catch(() => {}).finally(() => setLoading(false))
  }, []))

  const deleteAddress = (id: string) => {
    Alert.alert("Eliminar", "¿Eliminar esta dirección?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: async () => {
        await api.addresses.delete(id)
        setAddresses((prev) => prev.filter((a) => a.id !== id))
      }},
    ])
  }

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.back}><ArrowLeft size={22} color={colors.text} /></TouchableOpacity>
      <Text style={styles.header}>Mis Direcciones</Text>
      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} /> : (
        <FlatList
          data={addresses} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={styles.empty}>Sin direcciones guardadas</Text>}
          renderItem={({ item }) => (
            <GlassCard style={styles.card}>
              <View style={styles.row}>
                <MapPin size={18} color={colors.primary} />
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text style={styles.name}>{item.nombre || "Dirección"}</Text>
                    {item.es_default && <Star size={12} color={colors.warning} fill={colors.warning} style={{ marginLeft: spacing.xs }} />}
                  </View>
                  <Text style={styles.dir}>{item.direccion}</Text>
                  {item.ciudad && <Text style={styles.city}>{item.ciudad}</Text>}
                </View>
                <TouchableOpacity onPress={() => deleteAddress(item.id)}><Trash2 size={16} color={colors.danger} /></TouchableOpacity>
              </View>
            </GlassCard>
          )}
        />
      )}
      <TouchableOpacity style={styles.addBtn} onPress={() => {}}>
        <Plus size={18} color="#fff" />
        <Text style={styles.addBtnText}>Nueva dirección</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  back: { padding: spacing.lg },
  header: { fontSize: 22, fontWeight: "800", color: colors.text, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  empty: { textAlign: "center", marginTop: 40, color: colors.textMuted },
  card: { marginBottom: spacing.md },
  row: { flexDirection: "row", alignItems: "flex-start" },
  name: { ...typography.body, fontWeight: "600" },
  dir: { ...typography.caption, marginTop: 2 },
  city: { ...typography.caption, color: colors.textMuted },
  addBtn: { position: "absolute", bottom: 24, right: spacing.lg, flexDirection: "row", alignItems: "center", backgroundColor: colors.primary, borderRadius: borderRadius.full, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, gap: spacing.sm, elevation: 4 },
  addBtnText: { color: "#fff", fontWeight: "600" },
})
