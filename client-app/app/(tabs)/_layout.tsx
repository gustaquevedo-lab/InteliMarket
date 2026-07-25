import { Tabs } from "expo-router"
import { ShoppingBag, Package, ShoppingCart, User, Scan } from "lucide-react-native"
import { colors } from "../../src/theme"
import { View, Text, StyleSheet } from "react-native"
import { useClientStore } from "../../src/stores/clientStore"

function CartBadge() {
  const count = useClientStore((s) => s.cart.itemCount)
  if (count === 0) return null
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count > 99 ? "99+" : count}</Text>
    </View>
  )
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen name="catalog" options={{ title: "Catálogo", tabBarIcon: ({ color }) => <ShoppingBag size={22} color={color} /> }} />
      <Tabs.Screen name="cart" options={{ title: "Carrito", tabBarIcon: ({ color }) => <ShoppingCart size={22} color={color} />, tabBarBadge: undefined as any, tabBarIcon: (p: any) => <View><ShoppingCart size={22} color={p.color} /><CartBadge /></View> }} />
      <Tabs.Screen name="scanandgo" options={{ title: "Scan&Go", tabBarIcon: ({ color }) => <Scan size={22} color={color} /> }} />
      <Tabs.Screen name="orders" options={{ title: "Pedidos", tabBarIcon: ({ color }) => <Package size={22} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Mi Cuenta", tabBarIcon: ({ color }) => <User size={22} color={color} /> }} />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  badge: { position: "absolute", top: -6, right: -10, backgroundColor: colors.danger, borderRadius: 10, minWidth: 18, height: 18, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
})
