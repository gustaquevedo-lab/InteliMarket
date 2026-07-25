export const colors = {
  primary: "#6366f1",
  primaryLight: "#818cf8",
  primaryDark: "#4f46e5",
  secondary: "#06b6d4",
  accent: "#f59e0b",
  success: "#22c55e",
  successLight: "#4ade80",
  warning: "#f59e0b",
  warningLight: "#fbbf24",
  error: "#ef4444",
  errorLight: "#f87171",
  info: "#3b82f6",
  bg: "#0a0a1a",
  bgCard: "rgba(255, 255, 255, 0.06)",
  bgCardHover: "rgba(255, 255, 255, 0.10)",
  bgElevated: "rgba(255, 255, 255, 0.08)",
  text: "#ffffff",
  textSecondary: "rgba(255, 255, 255, 0.65)",
  textTertiary: "rgba(255, 255, 255, 0.35)",
  textInverse: "#0a0a1a",
  border: "rgba(255, 255, 255, 0.10)",
  borderLight: "rgba(255, 255, 255, 0.05)",
  glass: "rgba(255, 255, 255, 0.08)",
  glassBorder: "rgba(255, 255, 255, 0.12)",
  glassShadow: "rgba(0, 0, 0, 0.4)",
  online: "#22c55e",
  busy: "#f59e0b",
  idle: "#6b7280",
  offline: "#374151",
  batteryHigh: "#22c55e",
  batteryMedium: "#f59e0b",
  batteryLow: "#ef4444",
  gradientPrimary: ["#6366f1", "#8b5cf6"] as const,
  gradientSecondary: ["#06b6d4", "#3b82f6"] as const,
  gradientSuccess: ["#22c55e", "#4ade80"] as const,
  gradientWarning: ["#f59e0b", "#fbbf24"] as const,
  gradientError: ["#ef4444", "#f87171"] as const,
  gradientCard: ["rgba(99, 102, 241, 0.15)", "rgba(139, 92, 246, 0.08)"] as const,
  gradientBg: ["#0a0a1a", "#14142e"] as const,
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48 }

export const borderRadius = { sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, full: 9999 }

export const typography = {
  fontFamily: {
    regular: "Inter_400Regular",
    medium: "Inter_500Medium",
    semibold: "Inter_600SemiBold",
    bold: "Inter_700Bold",
    extrabold: "Inter_800ExtraBold",
    mono: "JetBrainsMono_400Regular",
  },
  fontSize: { xs: 11, sm: 13, md: 15, lg: 17, xl: 20, xxl: 24, xxxl: 32, display: 40 },
  lineHeight: { tight: 1.15, normal: 1.4, relaxed: 1.6 },
}

export const shadows = {
  sm: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2 },
  md: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  lg: { shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8 },
  glow: { shadowColor: "#6366f1", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 10 },
}

export const glass = {
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
    borderRadius: 16,
    overflow: "hidden" as const,
  },
  elevated: {
    backgroundColor: "rgba(255, 255, 255, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 20,
    overflow: "hidden" as const,
    ...shadows.lg,
  },
  button: {
    backgroundColor: "rgba(99, 102, 241, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.3)",
    borderRadius: 12,
  },
}

export const animation = {
  spring: { damping: 15, stiffness: 150, mass: 1 },
  springLight: { damping: 20, stiffness: 200, mass: 0.8 },
  springHeavy: { damping: 10, stiffness: 100, mass: 1.2 },
  timing: { duration: 300, easing: [0.4, 0, 0.2, 1] as [number, number, number, number] },
  timingFast: { duration: 150, easing: [0.4, 0, 0.2, 1] as [number, number, number, number] },
}

export const layout = { screenPadding: 20, screenPaddingHorizontal: 20, headerHeight: 60, tabBarHeight: 80, cardGap: 12, contentMaxWidth: 500 }

export default { colors, spacing, borderRadius, typography, shadows, glass, animation, layout }
