import { Stack } from "expo-router"
import { useClientStore } from "../src/stores/clientStore"
import { StatusBar } from "expo-status-bar"
import { colors } from "../src/theme"

export default function RootLayout() {
  const isAuthenticated = useClientStore((s) => s.isAuthenticated)

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="index" />
        ) : (
          <Stack.Screen name="(tabs)" />
        )}
      </Stack>
    </>
  )
}
