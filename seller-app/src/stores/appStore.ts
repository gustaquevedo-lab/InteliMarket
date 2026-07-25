import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import AsyncStorage from "@react-native-async-storage/async-storage"
import type {
  SellerUser,
  SellerProfile,
  RouteInstance,
  RouteStop,
  Product,
  OrderItem,
  Customer,
  GPSPoint,
} from "../types"

interface AppState {
  // Auth
  user: SellerUser | null
  profile: SellerProfile | null
  token: string | null
  isAuthenticated: boolean
  pinCode: string | null
  useBiometrics: boolean

  // Route
  currentRoute: RouteInstance | null
  currentStops: RouteStop[]
  activeStop: RouteStop | null

  // GPS
  isTracking: boolean
  gpsPoints: GPSPoint[]
  lastLocation: { lat: number; lng: number } | null
  batteryLevel: number

  // Order
  cartItems: OrderItem[]
  selectedCustomer: Customer | null
  cartTotal: number
  cartDiscount: number

  // UI
  isOnline: boolean
  syncQueueCount: number
  unreadAlerts: number
  isRouteActive: boolean

  // Actions
  setUser: (user: SellerUser | null) => void
  setProfile: (profile: SellerProfile | null) => void
  setToken: (token: string | null) => void
  setPinCode: (pin: string | null) => void
  setUseBiometrics: (use: boolean) => void
  setCurrentRoute: (route: RouteInstance | null) => void
  setCurrentStops: (stops: RouteStop[]) => void
  setActiveStop: (stop: RouteStop | null) => void
  setIsTracking: (tracking: boolean) => void
  addGpsPoint: (point: GPSPoint) => void
  setLastLocation: (loc: { lat: number; lng: number } | null) => void
  setBatteryLevel: (level: number) => void
  addToCart: (item: OrderItem) => void
  removeFromCart: (productId: string) => void
  updateCartItem: (productId: string, cantidad: number) => void
  clearCart: () => void
  setSelectedCustomer: (customer: Customer | null) => void
  setCartTotal: (total: number) => void
  setCartDiscount: (discount: number) => void
  setIsOnline: (online: boolean) => void
  setSyncQueueCount: (count: number) => void
  setUnreadAlerts: (count: number) => void
  setIsRouteActive: (active: boolean) => void
  logout: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      profile: null,
      token: null,
      isAuthenticated: false,
      pinCode: null,
      useBiometrics: false,

      currentRoute: null,
      currentStops: [],
      activeStop: null,

      isTracking: false,
      gpsPoints: [],
      lastLocation: null,
      batteryLevel: 100,

      cartItems: [],
      selectedCustomer: null,
      cartTotal: 0,
      cartDiscount: 0,

      isOnline: true,
      syncQueueCount: 0,
      unreadAlerts: 0,
      isRouteActive: false,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setProfile: (profile) => set({ profile }),
      setToken: (token) => set({ token }),
      setPinCode: (pin) => set({ pinCode: pin }),
      setUseBiometrics: (use) => set({ useBiometrics: use }),

      setCurrentRoute: (route) => set({ currentRoute: route, isRouteActive: route?.status === "in_progress" }),
      setCurrentStops: (stops) => set({ currentStops: stops }),
      setActiveStop: (stop) => set({ activeStop: stop }),

      setIsTracking: (tracking) => set({ isTracking: tracking }),
      addGpsPoint: (point) =>
        set((state) => ({
          gpsPoints: [...state.gpsPoints.slice(-500), point],
          lastLocation: { lat: point.lat, lng: point.lng },
        })),
      setLastLocation: (loc) => set({ lastLocation: loc }),
      setBatteryLevel: (level) => set({ batteryLevel: level }),

      addToCart: (item) =>
        set((state) => {
          const existing = state.cartItems.find((i) => i.product_id === item.product_id)
          if (existing) {
            return {
              cartItems: state.cartItems.map((i) =>
                i.product_id === item.product_id
                  ? { ...i, cantidad: i.cantidad + item.cantidad, subtotal: (i.cantidad + item.cantidad) * i.precio_unitario * (1 - i.descuento_pct / 100) }
                  : i
              ),
            }
          }
          return { cartItems: [...state.cartItems, item] }
        }),

      removeFromCart: (productId) =>
        set((state) => ({ cartItems: state.cartItems.filter((i) => i.product_id !== productId) })),

      updateCartItem: (productId, cantidad) =>
        set((state) => ({
          cartItems: state.cartItems.map((i) =>
            i.product_id === productId
              ? { ...i, cantidad, subtotal: cantidad * i.precio_unitario * (1 - i.descuento_pct / 100) }
              : i
          ),
        })),

      clearCart: () => set({ cartItems: [], cartTotal: 0, cartDiscount: 0 }),
      setSelectedCustomer: (customer) => set({ selectedCustomer: customer }),
      setCartTotal: (total) => set({ cartTotal: total }),
      setCartDiscount: (discount) => set({ cartDiscount: discount }),

      setIsOnline: (online) => set({ isOnline: online }),
      setSyncQueueCount: (count) => set({ syncQueueCount: count }),
      setUnreadAlerts: (count) => set({ unreadAlerts: count }),
      setIsRouteActive: (active) => set({ isRouteActive: active }),

      logout: () =>
        set({
          user: null,
          profile: null,
          token: null,
          isAuthenticated: false,
          currentRoute: null,
          currentStops: [],
          activeStop: null,
          isTracking: false,
          gpsPoints: [],
          cartItems: [],
          selectedCustomer: null,
          isRouteActive: false,
        }),
    }),
    {
      name: "inteliseller-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        pinCode: state.pinCode,
        useBiometrics: state.useBiometrics,
        profile: state.profile,
      }),
    }
  )
)
