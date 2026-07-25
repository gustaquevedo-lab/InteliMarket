import { useState } from "react"
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native"
import { useRouter } from "expo-router"
import { api } from "../src/services/api"
import { useClientStore } from "../src/stores/clientStore"
import { colors, spacing, borderRadius, typography } from "../src/theme"
import * as SecureStore from "expo-secure-store"

export default function LoginScreen() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [isRegister, setIsRegister] = useState(false)
  const [nombre, setNombre] = useState("")
  const [customerId, setCustomerId] = useState("")
  const [companyId, setCompanyId] = useState("")
  const router = useRouter()
  const setToken = useClientStore((s) => s.setToken)
  const setClientUser = useClientStore((s) => s.setClientUser)

  const handleLogin = async () => {
    if (!email || !password) return Alert.alert("Error", "Completá todos los campos")
    setLoading(true)
    try {
      const res = await api.auth.login(email, password)
      await SecureStore.setItemAsync("client_token", res.access_token)
      setToken(res.access_token)
      const me = await api.account.me()
      setClientUser(me)
      router.replace("/(tabs)")
    } catch (e: any) {
      Alert.alert("Error", e.message)
    }
    setLoading(false)
  }

  const handleRegister = async () => {
    if (!email || !password || !nombre || !customerId || !companyId) {
      return Alert.alert("Error", "Completá todos los campos")
    }
    setLoading(true)
    try {
      const res = await api.auth.register({ email, password, nombre, customer_id: customerId, company_id: companyId, telefono: "" })
      await SecureStore.setItemAsync("client_token", res.access_token)
      setToken(res.access_token)
      const me = await api.account.me()
      setClientUser(me)
      router.replace("/(tabs)")
    } catch (e: any) {
      Alert.alert("Error", e.message)
    }
    setLoading(false)
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.inner}>
        <Text style={styles.logo}>InteliClient</Text>
        <Text style={styles.subtitle}>Marketplace B2B</Text>
        <View style={styles.card}>
          {isRegister && (
            <>
              <TextInput style={styles.input} placeholder="Nombre" value={nombre} onChangeText={setNombre} />
              <TextInput style={styles.input} placeholder="ID Cliente (UUID)" value={customerId} onChangeText={setCustomerId} />
              <TextInput style={styles.input} placeholder="ID Empresa (UUID)" value={companyId} onChangeText={setCompanyId} />
            </>
          )}
          <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <TextInput style={styles.input} placeholder="Contraseña" value={password} onChangeText={setPassword} secureTextEntry />
          <TouchableOpacity style={styles.btn} onPress={isRegister ? handleRegister : handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{isRegister ? "Registrarse" : "Ingresar"}</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsRegister(!isRegister)}>
            <Text style={styles.link}>{isRegister ? "Ya tengo cuenta" : "Crear cuenta nueva"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  inner: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xl },
  logo: { fontSize: 32, fontWeight: "800", color: colors.primary, marginBottom: spacing.xs },
  subtitle: { ...typography.caption, marginBottom: spacing.xxl },
  card: { width: "100%", maxWidth: 360, backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.xl, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 12, elevation: 3 },
  input: { backgroundColor: colors.surfaceAlt, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.md, fontSize: 14 },
  btn: { backgroundColor: colors.primary, borderRadius: borderRadius.md, padding: spacing.md, alignItems: "center", marginBottom: spacing.md },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  link: { textAlign: "center", color: colors.primaryLight, fontSize: 13 },
})
