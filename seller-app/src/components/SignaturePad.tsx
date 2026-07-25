import React, { useRef, useState } from "react"
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from "react-native"
import { GestureDetector, Gesture } from "react-native-gesture-handler"
import Animated, { useSharedValue, useAnimatedProps } from "react-native-reanimated"
import { colors, borderRadius, spacing, typography } from "../theme"

const { width: SCREEN_WIDTH } = Dimensions.get("window")
const PAD_WIDTH = SCREEN_WIDTH - 80
const PAD_HEIGHT = 200

interface SignaturePadProps {
  onSave: (base64: string) => void
  onClear: () => void
}

export function SignaturePad({ onSave, onClear }: SignaturePadProps) {
  const [paths, setPaths] = useState<{ points: { x: number; y: number }[] }[]>([])
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([])
  const [hasSigned, setHasSigned] = useState(false)

  const gesture = Gesture.Pan()
    .onBegin((e) => {
      setCurrentPath([{ x: e.x, y: e.y }])
      setHasSigned(true)
    })
    .onUpdate((e) => {
      setCurrentPath((prev) => [...prev, { x: e.x, y: e.y }])
    })
    .onEnd(() => {
      if (currentPath.length > 1) {
        setPaths((prev) => [...prev, { points: currentPath }])
      }
      setCurrentPath([])
    })

  const handleClear = () => {
    setPaths([])
    setCurrentPath([])
    setHasSigned(false)
    onClear()
  }

  const handleSave = () => {
    // In production, render to canvas and export as base64
    // For now, return a placeholder
    onSave(`signature_${Date.now()}`)
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Firma digital</Text>

      <GestureDetector gesture={gesture}>
        <View style={styles.pad}>
          {/* Grid dots for visual guidance */}
          {Array.from({ length: 8 }).map((_, i) => (
            <View key={`h${i}`} style={[styles.gridLine, styles.gridH, { top: (i + 1) * (PAD_HEIGHT / 10) }]} />
          ))}
          {Array.from({ length: 8 }).map((_, i) => (
            <View key={`v${i}`} style={[styles.gridLine, styles.gridV, { left: (i + 1) * (PAD_WIDTH / 10) }]} />
          ))}

          {/* Render completed paths */}
          {paths.map((path, idx) => (
            <View key={idx} style={StyleSheet.absoluteFill}>
              {path.points.length > 1 && (
                <View style={StyleSheet.absoluteFill}>
                  {path.points.slice(0, -1).map((pt, pIdx) => {
                    const next = path.points[pIdx + 1]
                    if (!next) return null
                    const dx = next.x - pt.x
                    const dy = next.y - pt.y
                    const length = Math.sqrt(dx * dx + dy * dy)
                    const angle = Math.atan2(dy, dx) * (180 / Math.PI)
                    return (
                      <View
                        key={pIdx}
                        style={{
                          position: "absolute",
                          left: pt.x,
                          top: pt.y,
                          width: length,
                          height: 3,
                          backgroundColor: colors.text,
                          borderRadius: 1.5,
                          transform: [{ rotate: `${angle}deg` }],
                          transformOrigin: "left center",
                        }}
                      />
                    )
                  })}
                </View>
              )}
            </View>
          ))}

          {/* Render current path */}
          {currentPath.length > 1 && (
            <View style={StyleSheet.absoluteFill}>
              {currentPath.slice(0, -1).map((pt, pIdx) => {
                const next = currentPath[pIdx + 1]
                if (!next) return null
                const dx = next.x - pt.x
                const dy = next.y - pt.y
                const length = Math.sqrt(dx * dx + dy * dy)
                const angle = Math.atan2(dy, dx) * (180 / Math.PI)
                return (
                  <View
                    key={pIdx}
                    style={{
                      position: "absolute",
                      left: pt.x,
                      top: pt.y,
                      width: length,
                      height: 3,
                      backgroundColor: colors.primary,
                      borderRadius: 1.5,
                      transform: [{ rotate: `${angle}deg` }],
                      transformOrigin: "left center",
                    }}
                  />
                )
              })}
            </View>
          )}

          {!hasSigned && (
            <Text style={styles.placeholder}>Firmá aquí</Text>
          )}
        </View>
      </GestureDetector>

      <View style={styles.actions}>
        <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
          <Text style={styles.clearText}>Limpiar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleSave}
          style={[styles.saveBtn, !hasSigned && styles.saveBtnDisabled]}
          disabled={!hasSigned}
        >
          <Text style={styles.saveText}>Confirmar firma</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  label: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.semibold,
    color: colors.text,
  },
  pad: {
    width: PAD_WIDTH,
    height: PAD_HEIGHT,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    overflow: "hidden",
    position: "relative",
  },
  gridLine: {
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  gridH: {
    left: 0,
    right: 0,
    height: 1,
  },
  gridV: {
    top: 0,
    bottom: 0,
    width: 1,
  },
  placeholder: {
    position: "absolute",
    bottom: 20,
    left: 20,
    fontSize: typography.fontSize.md,
    color: "rgba(255,255,255,0.2)",
    fontFamily: typography.fontFamily.regular,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.md,
  },
  clearBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
  },
  clearText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.textSecondary,
  },
  saveBtn: {
    flex: 2,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    color: colors.text,
  },
})
