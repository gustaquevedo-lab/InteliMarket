import { useEffect, useRef, useCallback } from "react"
import * as Location from "expo-location"
import * as TaskManager from "expo-task-manager"
import { useDriverStore } from "../stores/driverStore"
import { api } from "../services/api"
import { queueGPSPoint } from "../services/storage"

const LOCATION_TASK = "intelidriver-location-tracking"
const GPS_PING_INTERVAL = 10000

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }: any) => {
  if (error) return
  if (data?.locations) {
    const loc = data.locations[0]
    const store = useDriverStore.getState()
    const point = {
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      speed: loc.coords.speed ? Math.round(loc.coords.speed * 3.6) : store.speed,
      heading: loc.coords.heading ?? store.heading,
      accuracy_meters: loc.coords.accuracy ?? 0,
      altitude_meters: loc.coords.altitude ?? 0,
      battery_level: store.batteryLevel,
      recorded_at: new Date().toISOString(),
    }

    store.addGpsPoint(point)

    if (store.isOnline) {
      try {
        await api.tracking.ping({
          driver_id: store.user?.id,
          lat: point.lat,
          lng: point.lng,
          speed_kmh: point.speed,
          heading: point.heading,
          battery_level: point.batteryLevel,
        })
      } catch {
        await queueGPSPoint(point)
      }
    } else {
      await queueGPSPoint(point)
    }
  }
})

export function useLocation() {
  const isTracking = useDriverStore((s) => s.isTracking)
  const setIsTracking = useDriverStore((s) => s.setIsTracking)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startTracking = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== "granted") return false

    const bgStatus = await Location.requestBackgroundPermissionsAsync()
    if (bgStatus.status !== "granted") {
      await Location.startLocationUpdatesAsync(LOCATION_TASK, {
        accuracy: Location.Accuracy.High,
        distanceInterval: 5,
        timeInterval: GPS_PING_INTERVAL,
        foregroundService: {
          notificationTitle: "InteliDriver",
          notificationBody: "Tracking de ruta activo",
          notificationColor: "#6366f1",
        },
      })
    } else {
      await Location.startLocationUpdatesAsync(LOCATION_TASK, {
        accuracy: Location.Accuracy.High,
        distanceInterval: 5,
        timeInterval: GPS_PING_INTERVAL,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: "InteliDriver",
          notificationBody: "Tracking de ruta activo",
          notificationColor: "#6366f1",
        },
      })
    }

    setIsTracking(true)
    return true
  }, [setIsTracking])

  const stopTracking = useCallback(async () => {
    const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK)
    if (isTaskRegistered) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK)
    }
    setIsTracking(false)
  }, [setIsTracking])

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  return { startTracking, stopTracking, isTracking }
}

export function useBatteryLevel() {
  const batteryLevel = useDriverStore((s) => s.batteryLevel)
  const setBatteryLevel = useDriverStore((s) => s.setBatteryLevel)

  const getBatteryColor = useCallback(() => {
    if (batteryLevel > 50) return "#22c55e"
    if (batteryLevel > 20) return "#f59e0b"
    return "#ef4444"
  }, [batteryLevel])

  return { batteryLevel, setBatteryLevel, getBatteryColor }
}
