import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import AsyncStorage from "@react-native-async-storage/async-storage"
import type { DriverUser, DriverProfile, Vehicle, Route, RouteStop, Delivery, GPSPoint, FleetChecklistItem } from "../types"

interface DriverState {
  user: DriverUser | null
  profile: DriverProfile | null
  token: string | null
  isAuthenticated: boolean
  pinCode: string | null

  currentRoute: Route | null
  currentStops: RouteStop[]
  activeStop: RouteStop | null
  deliveries: Delivery[]
  assignedVehicle: Vehicle | null

  isTracking: boolean
  gpsPoints: GPSPoint[]
  lastLocation: { lat: number; lng: number } | null
  batteryLevel: number
  speed: number
  heading: number

  checklists: FleetChecklistItem[]

  isOnline: boolean
  syncQueueCount: number
  hasUnreadNotifications: boolean

  setUser: (user: DriverUser | null) => void
  setProfile: (profile: DriverProfile | null) => void
  setToken: (token: string | null) => void
  setPinCode: (pin: string | null) => void
  setCurrentRoute: (route: Route | null) => void
  setCurrentStops: (stops: RouteStop[]) => void
  setActiveStop: (stop: RouteStop | null) => void
  setDeliveries: (deliveries: Delivery[]) => void
  setAssignedVehicle: (v: Vehicle | null) => void
  setIsTracking: (t: boolean) => void
  addGpsPoint: (point: GPSPoint) => void
  setLastLocation: (loc: { lat: number; lng: number } | null) => void
  setBatteryLevel: (level: number) => void
  setSpeed: (s: number) => void
  setHeading: (h: number) => void
  setChecklists: (items: FleetChecklistItem[]) => void
  setIsOnline: (online: boolean) => void
  setSyncQueueCount: (count: number) => void
  setHasUnreadNotifications: (v: boolean) => void
  updateStopStatus: (stopId: string, status: RouteStop["status"], updates?: Partial<RouteStop>) => void
  logout: () => void
}

export const useDriverStore = create<DriverState>()(
  persist(
    (set, get) => ({
      user: null,
      profile: null,
      token: null,
      isAuthenticated: false,
      pinCode: null,

      currentRoute: null,
      currentStops: [],
      activeStop: null,
      deliveries: [],
      assignedVehicle: null,

      isTracking: false,
      gpsPoints: [],
      lastLocation: null,
      batteryLevel: 100,
      speed: 0,
      heading: 0,

      checklists: [],

      isOnline: true,
      syncQueueCount: 0,
      hasUnreadNotifications: false,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setProfile: (profile) => set({ profile }),
      setToken: (token) => set({ token }),
      setPinCode: (pin) => set({ pinCode: pin }),

      setCurrentRoute: (route) => {
        const isActive = route?.status === "in_progress"
        set({ currentRoute: route })
        if (route?.stops) set({ currentStops: route.stops })
      },
      setCurrentStops: (stops) => set({ currentStops: stops }),
      setActiveStop: (stop) => set({ activeStop: stop }),
      setDeliveries: (deliveries) => set({ deliveries }),
      setAssignedVehicle: (v) => set({ assignedVehicle: v }),

      setIsTracking: (t) => set({ isTracking: t }),
      addGpsPoint: (point) =>
        set((state) => ({
          gpsPoints: [...state.gpsPoints.slice(-500), point],
          lastLocation: { lat: point.lat, lng: point.lng },
          speed: point.speed_kmh,
          heading: point.heading,
        })),
      setLastLocation: (loc) => set({ lastLocation: loc }),
      setBatteryLevel: (level) => set({ batteryLevel: level }),
      setSpeed: (s) => set({ speed: s }),
      setHeading: (h) => set({ heading: h }),

      setChecklists: (items) => set({ checklists: items }),

      setIsOnline: (online) => set({ isOnline: online }),
      setSyncQueueCount: (count) => set({ syncQueueCount: count }),
      setHasUnreadNotifications: (v) => set({ hasUnreadNotifications: v }),

      updateStopStatus: (stopId, status, updates) =>
        set((state) => ({
          currentStops: state.currentStops.map((s) =>
            s.id === stopId ? { ...s, status, ...updates } : s
          ),
        })),

      logout: () =>
        set({
          user: null,
          profile: null,
          token: null,
          isAuthenticated: false,
          currentRoute: null,
          currentStops: [],
          activeStop: null,
          deliveries: [],
          assignedVehicle: null,
          isTracking: false,
          gpsPoints: [],
        }),
    }),
    {
      name: "intelidriver-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        pinCode: state.pinCode,
        profile: state.profile,
      }),
    }
  )
)
