import { useState, useEffect, useCallback } from "react"
import NetInfo from "@react-native-community/netinfo"
import { useAppStore } from "../stores/appStore"

export function useNetworkStatus() {
  const { isOnline, setSyncQueueCount } = useAppStore()
  const [networkType, setNetworkType] = useState<string>("unknown")

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected === true
      setNetworkType(state.type || "unknown")
      useAppStore.getState().setIsOnline(online)
    })
    return () => unsubscribe()
  }, [])

  const checkNow = useCallback(async () => {
    const state = await NetInfo.fetch()
    const online = state.isConnected === true
    useAppStore.getState().setIsOnline(online)
    setNetworkType(state.type || "unknown")
    return online
  }, [])

  return { isOnline, networkType, checkNow }
}

export function useBatteryLevel() {
  const batteryLevel = useAppStore((s) => s.batteryLevel)
  const setBatteryLevel = useAppStore((s) => s.setBatteryLevel)
  const [isCharging, setIsCharging] = useState(false)

  useEffect(() => {
    let mounted = true
    const check = async () => {
      try {
        const { default: Device } = await import("expo-device")
        const level = await Device.getBatteryLevelAsync()
        if (mounted) {
          setBatteryLevel(Math.round((level || 1) * 100))
        }
      } catch {}
    }
    check()
    const iv = setInterval(check, 60000)
    return () => {
      mounted = false
      clearInterval(iv)
    }
  }, [setBatteryLevel])

  const getBatteryColor = () => {
    if (batteryLevel <= 15) return "#ef4444"
    if (batteryLevel <= 30) return "#f59e0b"
    if (batteryLevel <= 60) return "#22c55e"
    return "#22c55e"
  }

  const getBatteryIcon = () => {
    if (batteryLevel <= 15) return "🪫"
    if (batteryLevel <= 30) return "🔋"
    return "🔋"
  }

  return { batteryLevel, isCharging, getBatteryColor, getBatteryIcon }
}
