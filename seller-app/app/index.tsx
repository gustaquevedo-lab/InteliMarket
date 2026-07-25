import React, { useState, useRef, useEffect } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Alert,
} from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import Animated, {
  FadeInDown,
  FadeInUp,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated"
import { StatusBar } from "expo-status-bar"
import { colors, borderRadius, spacing, typography, shadows } from "../src/theme"
import { api } from "../src/services/api"
import { saveToken, savePinCode, getPinCode } from "../src/services/storage"
import { useAppStore } from "../src/stores/appStore"

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window")

export default function LoginScreen() {
  const setUser = useAppStore((s) => s.setUser)
  const setToken = useAppStore((s) => s.setToken)
  const setProfile = useAppStore((s) => s.setProfile)
  const setPinCode = useAppStore((s) => s.setPinCode)
  const pinCode = useAppStore((s) => s.pinCode)

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [pin, setPin] = useState(["", "", "", ""])
  const [step, setStep] = useState<"login" | "pin_setup" | "pin_verify">("login")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const pinRefs = useRef<TextInput[]>([])
  const logoScale = useSharedValue(0)
  const formOffset = useSharedValue(SCREEN_HEIGHT)

  useEffect(() => {
    logoScale.value = withSpring(1, { damping: 12, stiffness: 100 })
    formOffset.value = withSpring(0, { damping: 15, stiffness: 120 })
  }, [])

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }))

  const formStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: formOffset.value }],
  }))

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Ingresá email y contraseña")
      return
    }
    setLoading(true)
    setError("")
    try {
      const result = await api.auth.login(email, password)
      await saveToken(result.access_token)
      setToken(result.access_token)
      setUser(result.user)

      // Check if PIN exists
      const existingPin = await getPinCode()
      if (existingPin) {
        setStep("pin_verify")
      } else {
        setStep("pin_setup")
      }
    } catch (e: any) {
      setError(e.message || "Error de conexión")
    }
    setLoading(false)
  }

  const handlePinInput = (text: string, index: number) => {
    const newPin = [...pin]
    newPin[index] = text
    setPin(newPin)

    if (text && index < 3) {
      pinRefs.current[index + 1]?.focus()
    }

    // When all 4 digits entered
    if (index === 3 && text) {
      const pinStr = newPin.join("")
      if (step === "pin_setup") {
        setPinCode(pinStr)
        setStep("login")
        handleLoginSuccess()
      } else if (step === "pin_verify") {
        if (pinStr === pinCode) {
          handleLoginSuccess()
        } else {
          setError("PIN incorrecto")
          setPin(["", "", "", ""])
          pinRefs.current[0]?.focus()
        }
      }
    }
  }

  const handleLoginSuccess = () => {
    // Transition to main app
    formOffset.value = withTiming(-SCREEN_HEIGHT, { duration: 400 })
    setTimeout(() => {
      setStep("login")
    }, 500)
  }

  const renderLoginStep = () => (
    <Animated.View style={[styles.formContainer, formStyle]}>
      <Text style={styles.welcome}>Bienvenido</Text>
      <Text style={styles.welcomeSub}>Iniciá sesión para comenzar tu ruta</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="admin@ejemplo.com"
          placeholderTextColor={colors.textTertiary}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Contraseña</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor={colors.textTertiary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        onPress={handleLogin}
        disabled={loading}
        style={[styles.loginBtn, loading && { opacity: 0.6 }]}
        activeOpacity={0.8}
      >
        <LinearGradient colors={colors.gradientPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.loginGradient}>
          <Text style={styles.loginText}>{loading ? "Ingresando..." : "Ingresar"}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  )

  const renderPinStep = () => (
    <Animated.View entering={FadeInUp.duration(500).springify()} style={styles.formContainer}>
      <Text style={styles.welcome}>
        {step === "pin_setup" ? "Creá tu PIN" : "Ingresá tu PIN"}
      </Text>
      <Text style={styles.welcomeSub}>
        {step === "pin_setup"
          ? "Un código de 4 dígitos para acceso rápido"
          : "Usá tu PIN para acceder más rápido"}
      </Text>

      <View style={styles.pinContainer}>
        {pin.map((digit, index) => (
          <View key={index} style={[styles.pinBox, digit ? styles.pinBoxFilled : null]}>
            <TextInput
              ref={(ref) => { pinRefs.current[index] = ref! }}
              style={styles.pinInput}
              keyboardType="number-pad"
              maxLength={1}
              value={digit}
              onChangeText={(text) => handlePinInput(text, index)}
              onFocus={() => {
                if (!pin[index] && index > 0 && !pin[index - 1]) {
                  pinRefs.current[0]?.focus()
                }
              }}
              secureTextEntry
              caretHidden
            />
            {digit ? <Text style={styles.pinDot}>●</Text> : null}
          </View>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {step === "pin_verify" && (
        <TouchableOpacity onPress={() => { setStep("login"); setError("") }}>
          <Text style={styles.backLink}>Usar email/contraseña</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  )

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <LinearGradient colors={colors.gradientBg} style={StyleSheet.absoluteFill} />

      {/* Decorative elements */}
      <View style={styles.decorCircle1} />
      <View style={styles.decorCircle2} />
      <View style={styles.decorCircle3} />

      {/* Logo */}
      <Animated.View style={[styles.logoContainer, logoStyle]}>
        <View style={styles.logoIcon}>
          <Text style={styles.logoText}>IS</Text>
        </View>
        <Text style={styles.appName}>InteliSeller</Text>
        <Text style={styles.tagline}>Tu ruta, tu día, tu éxito</Text>
      </Animated.View>

      {/* Form */}
      {step === "login" ? renderLoginStep() : renderPinStep()}

      {/* Bottom gradient */}
      <View style={styles.bottomFade} />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xxl,
  },
  decorCircle1: {
    position: "absolute",
    top: -100,
    right: -60,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(99, 102, 241, 0.08)",
  },
  decorCircle2: {
    position: "absolute",
    bottom: -80,
    left: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(6, 182, 212, 0.06)",
  },
  decorCircle3: {
    position: "absolute",
    top: SCREEN_HEIGHT * 0.4,
    right: -80,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(245, 158, 11, 0.04)",
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: spacing.xxxl,
  },
  logoIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "rgba(99, 102, 241, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  logoText: {
    fontSize: typography.fontSize.xxl,
    fontFamily: typography.fontFamily.bold,
    color: colors.primaryLight,
  },
  appName: {
    fontSize: typography.fontSize.xxxl,
    fontFamily: typography.fontFamily.extrabold,
    color: colors.text,
  },
  tagline: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  formContainer: {
    width: "100%",
    maxWidth: 400,
    gap: spacing.lg,
  },
  welcome: {
    fontSize: typography.fontSize.xxl,
    fontFamily: typography.fontFamily.bold,
    color: colors.text,
    textAlign: "center",
  },
  welcomeSub: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  inputGroup: {
    gap: spacing.sm,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.textSecondary,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.regular,
    color: colors.text,
  },
  error: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.error,
    textAlign: "center",
  },
  loginBtn: {
    borderRadius: borderRadius.md,
    overflow: "hidden",
    marginTop: spacing.sm,
  },
  loginGradient: {
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  loginText: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semibold,
    color: colors.text,
  },
  pinContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.lg,
    marginVertical: spacing.xl,
  },
  pinBox: {
    width: 60,
    height: 72,
    borderRadius: borderRadius.md,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  pinBoxFilled: {
    borderColor: colors.primary,
    backgroundColor: "rgba(99, 102, 241, 0.1)",
  },
  pinInput: {
    position: "absolute",
    width: "100%",
    height: "100%",
    opacity: 0,
  },
  pinDot: {
    fontSize: 28,
    color: colors.text,
  },
  backLink: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.primaryLight,
    textAlign: "center",
    marginTop: spacing.md,
  },
  bottomFade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
    background: "linear-gradient(to top, rgba(10,10,26,1), transparent)",
  },
})
