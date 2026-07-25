import React from "react"
import { View, Text, StyleSheet } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { colors, spacing, typography } from "../theme"

interface AnimatedHeaderProps {
  title: string
  subtitle?: string
  gradient?: readonly [string, string]
  rightContent?: React.ReactNode
  isOnline?: boolean
}

export function AnimatedHeader({
  title,
  subtitle,
  gradient = colors.gradientPrimary,
  rightContent,
  isOnline = true,
}: AnimatedHeaderProps) {
  return (
    <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.container}>
      <View style={styles.decorCircle1} />
      <View style={styles.decorCircle2} />
      <View style={styles.content}>
        <View style={styles.left}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        <View style={styles.right}>
          <View style={[styles.statusDot, { backgroundColor: isOnline ? colors.online : colors.offline }]} />
          {rightContent}
        </View>
      </View>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 50,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.xl,
    position: "relative",
    overflow: "hidden",
  },
  decorCircle1: {
    position: "absolute",
    top: -60,
    right: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  decorCircle2: {
    position: "absolute",
    bottom: -30,
    left: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  content: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  left: { flex: 1 },
  right: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: {
    fontSize: typography.fontSize.xxl,
    fontFamily: typography.fontFamily.bold,
    color: colors.text,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
})

interface StatsCardProps {
  icon: string
  label: string
  value: string | number
  color?: string
  delay?: number
}

export function StatsCard({ icon, label, value, color = colors.primary, delay = 0 }: StatsCardProps) {
  const { GlassCard } = require("./GlassCard")
  return (
    <GlassCard animated animationType="up" delay={delay} style={{ flex: 1 }} intensity={30}>
      <View style={{ alignItems: "center", gap: 4 }}>
        <Text style={{ fontSize: 24 }}>{icon}</Text>
        <Text style={{ fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.bold, color: colors.text }}>
          {value}
        </Text>
        <Text style={{ fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.regular, color: colors.textSecondary, textAlign: "center" }}>
          {label}
        </Text>
      </View>
    </GlassCard>
  )
}
