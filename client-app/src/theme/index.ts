export const colors = {
  primary: "#1E40AF",
  primaryLight: "#3B82F6",
  secondary: "#7C3AED",
  success: "#16A34A",
  warning: "#D97706",
  danger: "#DC2626",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  surfaceAlt: "#F1F5F9",
  text: "#0F172A",
  textSecondary: "#64748B",
  textMuted: "#94A3B8",
  border: "#E2E8F0",
  glass: "rgba(255,255,255,0.7)",
}

export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32,
}

export const borderRadius = {
  sm: 8, md: 12, lg: 16, xl: 24, full: 999,
}

export const typography = {
  h1: { fontSize: 24, fontWeight: "800" as const, color: colors.text },
  h2: { fontSize: 18, fontWeight: "700" as const, color: colors.text },
  body: { fontSize: 14, color: colors.text },
  caption: { fontSize: 12, color: colors.textSecondary },
  label: { fontSize: 11, fontWeight: "600" as const, color: colors.textSecondary },
}
