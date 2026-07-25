import React from "react"
import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import Animated, { FadeInLeft, FadeInRight } from "react-native-reanimated"
import { LinearGradient } from "expo-linear-gradient"
import { colors, borderRadius, spacing, typography, glass } from "../theme"
import { GlassCard } from "./GlassCard"
import type { RouteStop } from "../types"

interface RouteTimelineProps {
  stops: RouteStop[]
  activeStopId?: string
  onStopPress: (stop: RouteStop) => void
}

export function RouteTimeline({ stops, activeStopId, onStopPress }: RouteTimelineProps) {
  if (!stops || stops.length === 0) {
    return (
      <View style={{ alignItems: "center", padding: spacing.xxxl }}>
        <Text style={{ fontSize: 40, marginBottom: spacing.md }}>📍</Text>
        <Text style={{ color: colors.textSecondary, fontFamily: typography.fontFamily.medium, fontSize: typography.fontSize.md }}>
          No hay visitas planificadas para hoy
        </Text>
      </View>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return colors.success
      case "in_progress":
        return colors.primary
      case "missed":
      case "cancelled":
        return colors.error
      case "rescheduled":
        return colors.warning
      default:
        return colors.textTertiary
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return "✅"
      case "in_progress":
        return "🔄"
      case "missed":
        return "❌"
      case "cancelled":
        return "🚫"
      case "rescheduled":
        return "📅"
      default:
        return "⏳"
    }
  }

  const completed = stops.filter((s) => s.status === "completed").length
  const progress = stops.length > 0 ? (completed / stops.length) * 100 : 0

  return (
    <View>
      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {completed}/{stops.length} completadas
        </Text>
      </View>

      {/* Timeline */}
      {stops.map((stop, index) => {
        const isActive = stop.id === activeStopId
        const statusColor = getStatusColor(stop.status)
        const isLast = index === stops.length - 1

        return (
          <Animated.View
            key={stop.id}
            entering={FadeInLeft.duration(400).delay(index * 80).springify()}
          >
            <TouchableOpacity
              onPress={() => onStopPress(stop)}
              activeOpacity={0.8}
              style={[
                styles.stopContainer,
                isActive && styles.stopActive,
              ]}
            >
              {/* Timeline node */}
              <View style={styles.timelineLeft}>
                <View
                  style={[
                    styles.timelineDot,
                    { backgroundColor: statusColor, borderColor: isActive ? colors.primary : "transparent" },
                  ]}
                >
                  <Text style={styles.dotText}>{getStatusIcon(stop.status)}</Text>
                </View>
                {!isLast && <View style={[styles.timelineLine, { backgroundColor: "rgba(255,255,255,0.08)" }]} />}
              </View>

              {/* Content */}
              <GlassCard
                animated={false}
                intensity={isActive ? 35 : 20}
                gradient={isActive ? colors.gradientCard : undefined}
                glowColor={isActive ? colors.primary : undefined}
                style={[styles.stopCard, isActive && styles.stopCardActive]}
                onPress={() => onStopPress(stop)}
              >
                <View style={styles.stopHeader}>
                  <Text style={styles.stopOrder}>#{stop.planned_order}</Text>
                  <Text style={[styles.stopStatus, { color: statusColor }]}>
                    {stop.status === "pending" ? "Pendiente" :
                     stop.status === "completed" ? "Completada" :
                     stop.status === "in_progress" ? "En curso" :
                     stop.status === "missed" ? "Perdida" : stop.status}
                  </Text>
                </View>
                <Text style={styles.stopCustomer}>
                  {stop.customer_name || `Cliente ${stop.customer_id.slice(0, 8)}`}
                </Text>
                {stop.customer_address && (
                  <Text style={styles.stopAddress} numberOfLines={1}>
                    📍 {stop.customer_address}
                  </Text>
                )}
                {stop.actual_arrival && (
                  <Text style={styles.stopTime}>
                    🕐 Llegada: {new Date(stop.actual_arrival).toLocaleTimeString()}
                  </Text>
                )}
                {stop.order_amount > 0 && (
                  <View style={styles.amountBadge}>
                    <Text style={styles.amountText}>
                      💰 Gs. {stop.order_amount.toLocaleString()}
                    </Text>
                  </View>
                )}
              </GlassCard>
            </TouchableOpacity>
          </Animated.View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.xs,
  },
  progressBg: {
    flex: 1,
    height: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.success,
    borderRadius: 3,
  },
  progressText: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.medium,
  },
  stopContainer: {
    flexDirection: "row",
    marginBottom: spacing.sm,
  },
  stopActive: {},
  timelineLeft: {
    width: 40,
    alignItems: "center",
  },
  timelineDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  dotText: {
    fontSize: 14,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginVertical: 2,
  },
  stopCard: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  stopCardActive: {
    borderColor: colors.primary,
  },
  stopHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  stopOrder: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.bold,
    color: colors.textTertiary,
  },
  stopStatus: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.semibold,
  },
  stopCustomer: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semibold,
    color: colors.text,
  },
  stopAddress: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  stopTime: {
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },
  amountBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginTop: spacing.xs,
  },
  amountText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.bold,
    color: colors.success,
  },
})
