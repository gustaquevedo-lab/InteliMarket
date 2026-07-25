import React from "react"
import { View, TouchableOpacity, StyleSheet, type ViewStyle, type TouchableOpacityProps } from "react-native"
import { BlurView } from "expo-blur"
import Animated, { FadeInUp, FadeInDown, FadeInLeft, FadeInRight, ZoomIn } from "react-native-reanimated"
import { GestureDetector, Gesture } from "react-native-gesture-handler"
import { LinearGradient } from "expo-linear-gradient"
import { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated"
import { colors, borderRadius, spacing, glass } from "../theme"

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity)

interface GlassCardProps extends TouchableOpacityProps {
  children: React.ReactNode
  intensity?: number
  gradient?: readonly [string, string]
  glowColor?: string
  animated?: boolean
  animationType?: "up" | "down" | "left" | "right" | "zoom"
  delay?: number
  pressScale?: number
  elevated?: boolean
  style?: ViewStyle
}

export function GlassCard({
  children,
  intensity = 25,
  gradient,
  glowColor,
  animated = true,
  animationType = "up",
  delay = 0,
  pressScale = 0.97,
  elevated = false,
  style,
  ...props
}: GlassCardProps) {
  const scale = useSharedValue(1)

  const gesture = Gesture.Tap()
    .onBegin(() => {
      scale.value = withSpring(pressScale, { damping: 20, stiffness: 200 })
    })
    .onFinalize(() => {
      scale.value = withSpring(1, { damping: 15, stiffness: 150 })
    })

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const getEntryAnimation = () => {
    if (!animated) return undefined
    switch (animationType) {
      case "up": return FadeInUp.duration(400).delay(delay).springify().damping(15)
      case "down": return FadeInDown.duration(400).delay(delay).springify().damping(15)
      case "left": return FadeInLeft.duration(400).delay(delay).springify().damping(15)
      case "right": return FadeInRight.duration(400).delay(delay).springify().damping(15)
      case "zoom": return ZoomIn.duration(400).delay(delay).springify().damping(15)
      default: return FadeInUp.duration(400).delay(delay).springify().damping(15)
    }
  }

  const cardStyle: ViewStyle[] = [
    {
      borderRadius: borderRadius.lg,
      overflow: "hidden",
      ...(elevated ? glass.elevated : glass.card),
    },
    glowColor ? {
      shadowColor: glowColor,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 16,
      elevation: 8,
    } : {},
    style,
  ].filter(Boolean) as ViewStyle[]

  return (
    <GestureDetector gesture={gesture}>
      <AnimatedTouchable
        entering={getEntryAnimation()}
        style={[animatedCardStyle]}
        activeOpacity={0.9}
        {...props}
      >
        <View style={cardStyle}>
          <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
          {gradient && (
            <LinearGradient
              colors={gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
              opacity={0.15}
            />
          )}
          <View style={{ padding: spacing.lg, zIndex: 1 }}>{children}</View>
        </View>
      </AnimatedTouchable>
    </GestureDetector>
  )
}

export function GlassCardSimple({
  children,
  style,
  gradient,
  ...props
}: {
  children: React.ReactNode
  style?: ViewStyle
  gradient?: readonly [string, string]
  [key: string]: any
}) {
  return (
    <View
      style={[
        {
          backgroundColor: "rgba(255,255,255,0.06)",
          borderRadius: borderRadius.md,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.1)",
          padding: spacing.md,
          overflow: "hidden",
        },
        style,
      ]}
      {...props}
    >
      {gradient && (
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          opacity={0.1}
        />
      )}
      <View style={{ zIndex: 1 }}>{children}</View>
    </View>
  )
}
