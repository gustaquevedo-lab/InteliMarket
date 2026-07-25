import { useEffect, useRef } from "react"
import { Platform } from "react-native"
import * as Notifications from "expo-notifications"
import * as Device from "expo-device"
import { useRouter } from "expo-router"
import { api } from "../services/api"

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

export function usePushNotifications() {
  const router = useRouter()
  const notificationListener = useRef<any>()
  const responseListener = useRef<any>()

  useEffect(() => {
    registerForPushNotifications()

    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      // App was already open
    })

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data
      if (data?.type === "order_status" && data?.order_id) {
        router.push(`/order/${data.order_id}`)
      }
    })

    return () => {
      if (notificationListener.current) Notifications.removeNotificationSubscription(notificationListener.current)
      if (responseListener.current) Notifications.removeNotificationSubscription(responseListener.current)
    }
  }, [])

  return { registerForPushNotifications }
}

async function registerForPushNotifications() {
  if (Platform.OS === "web") return

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }
  if (finalStatus !== "granted") return

  const pushTokenData = await Notifications.getExpoPushTokenAsync()
  const pushToken = pushTokenData.data

  try {
    await api.auth.registerDevice(pushToken, Platform.OS)
  } catch {}

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("orders", {
      name: "Pedidos",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#2563eb",
    })
    await Notifications.setNotificationChannelAsync("delivery", {
      name: "Entregas",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    })
    await Notifications.setNotificationChannelAsync("promotions", {
      name: "Promociones",
      importance: Notifications.AndroidImportance.DEFAULT,
    })
  }
}

export async function scheduleLocalNotification(title: string, body: string, data?: any) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data, sound: "default" },
    trigger: null,
  })
}
