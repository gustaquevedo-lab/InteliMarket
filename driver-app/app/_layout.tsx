import React, { useEffect } from "react"
import { Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { initDatabase } from "../src/services/storage"
import { registerForPushNotifications } from "../src/services/notifications"
import { useDriverStore } from "../src/stores/driverStore"

export default function RootLayout() {
  const isAuthenticated = useDriverStore((s) => s.isAuthenticated)

  useEffect(() => {
    initApp()
  }, [])

  async function initApp() {
    await initDatabase()
    try {
      const token = await registerForPushNotifications()
      if (token) console.log("Push token:", token)
    } catch {}
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
        {!isAuthenticated ? (
          <Stack.Screen name="index" options={{ animation: "fade" }} />
        ) : (
          <>
            <Stack.Screen name="(tabs)" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="delivery/[stopId]" options={{ animation: "slide_from_bottom", presentation: "modal" }} />
            <Stack.Screen name="incident/new" options={{ animation: "slide_from_bottom", presentation: "modal" }} />
          </>
        )}
      </Stack>
    </GestureHandlerRootView>
  )
}
