/**
 * Push Notification Service
 * Handles registration, receiving, and local notifications
 * Supports: geofence alerts, route updates, supervisor messages
 */

import * as Notifications from "expo-notifications"
import * as Device from "expo-device"
import { Platform } from "react-native"
import { useAppStore } from "../stores/appStore"

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn("Push notifications require a physical device")
    return null
  }

  // Android requires notification channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Alertas generales",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 100, 200, 100],
      lightColor: "#6366f1",
      sound: "default",
    })
    await Notifications.setNotificationChannelAsync("geofence", {
      name: "Alertas de geocerca",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 300, 100, 300],
      lightColor: "#ef4444",
      sound: "critical",
    })
    await Notifications.setNotificationChannelAsync("route", {
      name: "Actualizaciones de ruta",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "default",
    })
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== "granted") {
    console.warn("Push notification permission not granted")
    return null
  }

  const token = await Notifications.getExpoPushTokenAsync({
    projectId: undefined, // Set your Expo project ID here
  })

  return token.data
}

export async function scheduleLocalNotification({
  title,
  body,
  data,
  channelId = "default",
  type = "info",
}: {
  title: string
  body: string
  data?: Record<string, any>
  channelId?: string
  type?: "info" | "geofence" | "route" | "success"
}) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      channelId,
      sound: "default",
      ...(type === "geofence" && {
        interruptionLevel: "critical",
        priority: "high",
        badge: 1,
      }),
      ...(type === "success" && {
        color: "#22c55e",
      }),
    },
    trigger: null, // Immediate
  })
}

export async function scheduleGeofenceAlert(zoneName: string) {
  await scheduleLocalNotification({
    title: "⚠️ Alerta de geocerca",
    body: `Has ingresado a la zona restringida "${zoneName}"`,
    channelId: "geofence",
    type: "geofence",
  })
  useAppStore.getState().setUnreadAlerts(useAppStore.getState().unreadAlerts + 1)
}

export async function scheduleRouteReminder(stopName: string, order: number) {
  await scheduleLocalNotification({
    title: "📍 Próxima visita",
    body: `Cliente #${order}: ${stopName}. Preparate para la visita.`,
    channelId: "route",
    type: "route",
  })
}

export async function scheduleVisitSummary(completed: number, total: number, amount: number) {
  await scheduleLocalNotification({
    title: "✅ Ruta completada",
    body: `${completed} de ${total} visitas · Gs. ${amount.toLocaleString()}`,
    channelId: "default",
    type: "success",
  })
}

export function setupNotificationListeners(
  onNotification: (notification: Notifications.Notification) => void
) {
  const subReceived = Notifications.addNotificationReceivedListener((notification) => {
    onNotification(notification)
  })

  const subResponse = Notifications.addNotificationResponseReceivedListener((response) => {
    // Handle tap actions — navigate to relevant screen
    const data = response.notification.request.content.data
    if (data?.type === "geofence") {
      // Navigate to map
    } else if (data?.type === "route" && data?.stopId) {
      // Navigate to visit
    }
  })

  return () => {
    subReceived.remove()
    subResponse.remove()
  }
}

export async function clearBadge() {
  await Notifications.setBadgeCountAsync(0)
}
