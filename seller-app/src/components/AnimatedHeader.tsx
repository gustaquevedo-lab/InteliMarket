import React, { useEffect } from "react"
import { View, Text, StyleSheet } from "react-native"
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
  FadeInDown,
} from "react-native-reanimated"
import { LinearGradient } from "expo-linear-gradient"
import { colors, borderRadius, spacing, typography } from "../theme"
import { useBatteryLevel } from "../hooks/useNetwork"
import { GlassCard } from "./GlassCard"

interface AnimatedHeaderProps {
  title: string
  subtitle?: string
  gradient?: readonly [string, string]
  showBattery?: boolean
  showOnlineStatus?: boolean
  isOnline?: boolean
  rightContent?: React.ReactNode
}

export function AnimatedHeader({
  title,
  subtitle,
  gradient = colors.gradientPrimary,
  showBattery = true,
  showOnlineStatus = true,
  isOnline = true,
  rightContent,
}: AnimatedHeaderProps) {
  const { batteryLevel, getBatteryColor } = useBatteryLevel()

  return (
    <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.container}>
      {/* Decorative circles */}
      <View style={styles.decorCircle1} />
      <View style={styles.decorCircle2} />

      <View style={styles.content}>
        <View style={styles.left}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        <View style={styles.right}>
          {showOnlineStatus && (
            <View style={[styles.statusDot, { backgroundColor: isOnline ? colors.online : colors.offline }]} />
          )}
          {showBattery && (
            <View style={styles.batteryContainer}>
              <View style={[styles.batteryFill, { width: `${batteryLevel}%`, backgroundColor: getBatteryColor() }]} />
              <Text style={styles.batteryText}>{batteryLevel}%</Text>
            </View>
          )}
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
  left: {
    flex: 1,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
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
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  batteryContainer: {
    width: 50,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.3)",
    overflow: "hidden",
    justifyContent: "center",
    position: "relative",
  },
  batteryFill: {
    height: "100%",
    borderRadius: 2,
    position: "absolute",
    left: 0,
    top: 0,
  },
  batteryText: {
    fontSize: 9,
    fontFamily: typography.fontFamily.mono,
    color: colors.text,
    textAlign: "center",
    lineHeight: 20,
  },
})

interface StatsCardProps {
  icon: string
  label: string
  value: string | number
  color?: string
  delay?: number
}

export function StatsCard({ icon, label, value, color = colors.primary, delay = 0 }: StatsCardProps) {
  return (
    <GlassCard animated animationType="up" delay={delay} style={{ flex: 1 }} intensity={30}>
      <View style={{ alignItems: "center", gap: 4 }}>
        <Text style={{ fontSize: 24 }}>{icon}</Text>
        <Text
          style={{
            fontSize: typography.fontSize.lg,
            fontFamily: typography.fontFamily.bold,
            color: colors.text,
          }}
        >
          {value}
        </Text>
        <Text
          style={{
            fontSize: typography.fontSize.xs,
            fontFamily: typography.fontFamily.regular,
            color: colors.textSecondary,
            textAlign: "center",
          }}
        >
          {label}
        </Text>
      </View>
    </GlassCard>
  )
}
