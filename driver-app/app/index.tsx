import React, { useState, useCallback } from "react"
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert } from "react-native"
import { router } from "expo-router"
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated"
import { LinearGradient } from "expo-linear-gradient"
import { BlurView } from "expo-blur"
import { colors, spacing, borderRadius, typography } from "../src/theme"
import { useDriverStore } from "../src/stores/driverStore"
import { api } from "../src/services/api"

export default function LoginScreen() {
  const [step, setStep] = useState<"login" | "pin">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [pin, setPin] = useState("")
  const [loading, setLoading] = useState(false)
  const setUser = useDriverStore((s) => s.setUser)
  const setToken = useDriverStore((s) => s.setToken)
  const setPinCode = useDriverStore((s) => s.setPinCode)

  const handleLogin = useCallback(async () => {
    if (!email || !password) { Alert.alert("Error", "Completá email y contraseña"); return }
    setLoading(true)
    try {
      const res = await api.auth.login(email, password)
      setToken(res.access_token)
      setUser(res.user)
      setStep("pin")
    } catch (e: any) {
      Alert.alert("Error", e.message || "Credenciales inválidas")
    } finally {
      setLoading(false)
    }
  }, [email, password, setToken, setUser])

  const handlePinSetup = useCallback(async () => {
    if (pin.length < 4) { Alert.alert("Error", "El PIN debe tener al menos 4 dígitos"); return }
    setPinCode(pin)
    try {
      const meRes = await api.auth.me()
      setUser(meRes)
      router.replace("/(tabs)/today")
    } catch {
      router.replace("/(tabs)/today")
    }
  }, [pin, setPinCode, setUser])

  if (step === "pin") {
    return (
      <LinearGradient colors={colors.gradientBg} style={styles.container}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.inner}>
          <Animated.View entering={FadeInUp.duration(600).springify()} style={styles.card}>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
            <Text style={styles.emoji}>🔐</Text>
            <Text style={styles.title}>Configurá tu PIN</Text>
            <Text style={styles.subtitle}>Ingresá un PIN de 4-6 dígitos para acceder rápido</Text>
            <TextInput
              style={styles.input}
              placeholder="PIN"
              placeholderTextColor={colors.textTertiary}
              value={pin}
              onChangeText={setPin}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
            />
            <TouchableOpacity style={styles.button} onPress={handlePinSetup} disabled={loading}>
              <Text style={styles.buttonText}>{loading ? "Guardando..." : "Confirmar PIN"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setStep("login"); setPin("") }}>
              <Text style={styles.link}>Volver</Text>
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAvoidingView>
      </LinearGradient>
    )
  }

  return (
    <LinearGradient colors={colors.gradientBg} style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.inner}>
        <Animated.View entering={FadeInDown.duration(600).springify()} style={styles.logoContainer}>
          <Text style={styles.logo}>🚚</Text>
          <Text style={styles.appName}>InteliDriver</Text>
          <Text style={styles.tagline}>App de Repartidores</Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(600).delay(200).springify()} style={styles.card}>
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          <Text style={styles.cardTitle}>Iniciar sesión</Text>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textTertiary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="Contraseña"
            placeholderTextColor={colors.textTertiary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? "Ingresando..." : "Ingresar"}</Text>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </LinearGradient>
  )
}

import { StyleSheet } from "react-native"
const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xl },
  logoContainer: { alignItems: "center", marginBottom: spacing.xxxl },
  logo: { fontSize: 72, marginBottom: spacing.md },
  appName: { fontSize: typography.fontSize.xxl, fontFamily: typography.fontFamily.bold, color: colors.text },
  tagline: { fontSize: typography.fontSize.sm, color: colors.textSecondary, marginTop: 4 },
  card: { width: "100%", maxWidth: 400, borderRadius: borderRadius.xl, padding: spacing.xxl, borderWidth: 1, borderColor: colors.border, overflow: "hidden" as const },
  cardTitle: { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.semibold, color: colors.text, marginBottom: spacing.xl, textAlign: "center" },
  emoji: { fontSize: 48, textAlign: "center", marginBottom: spacing.md },
  title: { fontSize: typography.fontSize.xl, fontFamily: typography.fontFamily.bold, color: colors.text, textAlign: "center" },
  subtitle: { fontSize: typography.fontSize.sm, color: colors.textSecondary, textAlign: "center", marginBottom: spacing.xl },
  input: { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: borderRadius.md, padding: spacing.lg, fontSize: typography.fontSize.md, color: colors.text, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  button: { backgroundColor: colors.primary, borderRadius: borderRadius.md, padding: spacing.lg, alignItems: "center", marginTop: spacing.md },
  buttonText: { fontSize: typography.fontSize.md, fontFamily: typography.fontFamily.semibold, color: colors.text },
  link: { textAlign: "center", color: colors.primaryLight, marginTop: spacing.lg, fontSize: typography.fontSize.sm },
})
