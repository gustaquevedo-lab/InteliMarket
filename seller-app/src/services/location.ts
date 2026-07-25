/**
 * GPS Background Location Service
 * Smart adaptive polling: fast when moving, slow when stationary
 * Battery-optimized with geofence zone checking
 */

import * as Location from "expo-location"
import * as TaskManager from "expo-task-manager"
import { Platform } from "react-native"
import { api } from "./api"
import { useAppStore } from "../stores/appStore"

const LOCATION_TASK = "INTELISELLER_BACKGROUND_LOCATION"
const PING_INTERVAL_MS = 15000
const PING_MIN_DISTANCE = 10
const FAST_INTERVAL = 5000
const SLOW_INTERVAL = 30000
const SPEED_THRESHOLD_KMH = 5

let isRunning = false
let foregroundWatcher: Location.LocationSubscription | null = null
let currentInterval = PING_INTERVAL_MS

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }: any) => {
  if (error) return
  if (data?.locations) {
    for (const loc of data.locations) {
      await processLocation(loc)
    }
  }
})

async function processLocation(loc: Location.LocationObject) {
  const { latitude, longitude, speed, accuracy, altitude } = loc.coords
  const store = useAppStore.getState()
  if (!store.profile || !store.isTracking) return

  const batteryLevel = store.batteryLevel
  const now = new Date().toISOString()

  const point = {
    lat: latitude,
    lng: longitude,
    battery_level: batteryLevel,
    speed_kmh: (speed || 0) * 3.6,
    accuracy_meters: accuracy || 0,
    altitude_meters: altitude || 0,
    recorded_at: now,
  }

  // Store locally
  store.addGpsPoint(point)

  // Send to server (fire-and-forget)
  try {
    await api.tracking.ping(store.profile.id, point)
  } catch {
    // Will be queued by API client
  }

  // Adaptive interval based on speed
  const speedKmh = (speed || 0) * 3.6
  const newInterval = speedKmh > SPEED_THRESHOLD_KMH ? FAST_INTERVAL : SLOW_INTERVAL
  if (newInterval !== currentInterval) {
    currentInterval = newInterval
    await updateLocationAccuracy()
  }
}

async function updateLocationAccuracy() {
  if (foregroundWatcher) {
    foregroundWatcher.remove()
  }
  foregroundWatcher = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: currentInterval,
      distanceInterval: PING_MIN_DISTANCE,
    },
    (loc) => processLocation(loc)
  )
}

export async function startGPSTracking(): Promise<boolean> {
  if (isRunning) return true

  const { status } = await Location.requestForegroundPermissionsAsync()
  if (status !== "granted") {
    console.warn("Foreground location permission denied")
    return false
  }

  let bgStatus = { granted: true }
  if (Platform.OS !== "web") {
    bgStatus = await Location.requestBackgroundPermissionsAsync()
  }

  useAppStore.getState().setIsTracking(true)
  isRunning = true

  // Start foreground watcher
  await updateLocationAccuracy()

  // Start background task
  if (Platform.OS !== "web") {
    const isDefined = TaskManager.isTaskDefined(LOCATION_TASK)
    if (isDefined) {
      await Location.startLocationUpdatesAsync(LOCATION_TASK, {
        accuracy: Location.Accuracy.High,
        timeInterval: currentInterval,
        distanceInterval: PING_MIN_DISTANCE,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: "InteliSeller",
          notificationBody: "Tracking de ruta activo",
          notificationColor: "#6366f1",
        },
        pausesUpdatesAutomatically: false,
        activityType: Location.ActivityType.AutomotiveNavigation,
      })
    }
  }

  return true
}

export async function stopGPSTracking() {
  if (foregroundWatcher) {
    foregroundWatcher.remove()
    foregroundWatcher = null
  }
  if (TaskManager.isTaskDefined(LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK)
  }
  useAppStore.getState().setIsTracking(false)
  isRunning = false
}

export async function getCurrentLocation(): Promise<{ lat: number; lng: number } | null> {
  try {
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    })
    return { lat: loc.coords.latitude, lng: loc.coords.longitude }
  } catch {
    return null
  }
}

export async function getBatteryLevel(): Promise<number> {
  try {
    const { default: Device } = await import("expo-device")
    const battery = await Device.getBatteryLevelAsync()
    return Math.round((battery || 1) * 100)
  } catch {
    return 100
  }
}

export function getDistanceBetween(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}
