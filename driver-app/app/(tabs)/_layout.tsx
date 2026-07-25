import React from "react"
import { Tabs } from "expo-router"
import { View, Text, StyleSheet } from "react-native"
import { useDriverStore } from "../../src/stores/driverStore"
import { colors, typography } from "../../src/theme"

function TabIcon({ icon, focused }: { icon: string; focused: boolean }) {
  return (
    <View style={[tabStyles.iconContainer, focused && tabStyles.iconActive]}>
      <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{icon}</Text>
    </View>
  )
}

export default function TabLayout() {
  const syncCount = useDriverStore((s) => s.syncQueueCount)
  const hasNotifications = useDriverStore((s) => s.hasUnreadNotifications)

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: tabStyles.tabBar,
        tabBarActiveTintColor: colors.primaryLight,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: tabStyles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: "Hoy",
          tabBarIcon: ({ focused }) => <TabIcon icon="📋" focused={focused} />,
          tabBarBadge: syncCount > 0 ? syncCount : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.warning, fontSize: 10, minWidth: 16, height: 16 },
        }}
      />
      <Tabs.Screen
        name="routes"
        options={{
          title: "Ruta",
          tabBarIcon: ({ focused }) => <TabIcon icon="🗺️" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: "Mapa",
          tabBarIcon: ({ focused }) => <TabIcon icon="📍" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          tabBarIcon: ({ focused }) => <TabIcon icon="👤" focused={focused} />,
        }}
      />
    </Tabs>
  )
}

const tabStyles = StyleSheet.create({
  tabBar: {
    backgroundColor: "rgba(10, 10, 26, 0.95)",
    borderTopColor: "rgba(255,255,255,0.08)",
    borderTopWidth: 1,
    height: 80,
    paddingBottom: 20,
    paddingTop: 8,
    position: "absolute",
    elevation: 0,
  },
  tabLabel: { fontSize: 10, fontFamily: typography.fontFamily.medium, marginTop: -2 },
  iconContainer: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  iconActive: { backgroundColor: "rgba(99, 102, 241, 0.15)" },
})
