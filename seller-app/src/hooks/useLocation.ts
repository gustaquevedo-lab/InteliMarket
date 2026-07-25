import { useState, useEffect, useCallback, useRef } from "react"
import { startGPSTracking, stopGPSTracking, getCurrentLocation, getDistanceBetween } from "../services/location"
import { useAppStore } from "../stores/appStore"

export function useLocation() {
  const { isTracking, lastLocation, batteryLevel, setBatteryLevel, setIsTracking } = useAppStore()
  const [error, setError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)

  const start = useCallback(async () => {
    if (isStarting || isTracking) return
    setIsStarting(true)
    setError(null)
    try {
      const success = await startGPSTracking()
      if (!success) setError("No se pudo iniciar el GPS. Verificá los permisos.")
      return success
    } catch (e: any) {
      setError(e.message || "Error al iniciar GPS")
      return false
    } finally {
      setIsStarting(false)
    }
  }, [isTracking, isStarting])

  const stop = useCallback(async () => {
    await stopGPSTracking()
    setIsTracking(false)
  }, [setIsTracking])

  const refreshLocation = useCallback(async () => {
    return await getCurrentLocation()
  }, [])

  return {
    isTracking,
    lastLocation,
    batteryLevel,
    error,
    isStarting,
    start,
    stop,
    refreshLocation,
  }
}

export function useProximityCheck(
  targetLat: number | null | undefined,
  targetLng: number | null | undefined,
  thresholdMeters: number = 100
) {
  const lastLocation = useAppStore((s) => s.lastLocation)
  const [isNearby, setIsNearby] = useState(false)
  const [distance, setDistance] = useState<number | null>(null)

  useEffect(() => {
    if (!lastLocation || !targetLat || !targetLng) {
      setIsNearby(false)
      setDistance(null)
      return
    }
    const dist = getDistanceBetween(lastLocation.lat, lastLocation.lng, targetLat, targetLng)
    setDistance(dist)
    setIsNearby(dist <= thresholdMeters)
  }, [lastLocation, targetLat, targetLng, thresholdMeters])

  return { isNearby, distance }
}
