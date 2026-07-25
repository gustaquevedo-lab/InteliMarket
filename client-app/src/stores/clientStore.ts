import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import AsyncStorage from "@react-native-async-storage/async-storage"

interface CartState {
  items: Array<{ product_id: string; cantidad: number; precio_unitario: number; descripcion?: string }>
  itemCount: number
  total: number
  setCart: (items: any[], total: number) => void
  clearCart: () => void
}

interface ClientStore {
  token: string | null
  clientUser: any | null
  isAuthenticated: boolean
  setToken: (token: string) => void
  setClientUser: (user: any) => void
  logout: () => void
  cart: CartState
}

export const useClientStore = create<ClientStore>()(
  persist(
    (set) => ({
      token: null,
      clientUser: null,
      isAuthenticated: false,
      setToken: (token) => set({ token, isAuthenticated: true }),
      setClientUser: (user) => set({ clientUser: user }),
      logout: () => set({ token: null, clientUser: null, isAuthenticated: false }),
      cart: {
        items: [],
        itemCount: 0,
        total: 0,
        setCart: (items, total) =>
          set({ cart: { items, itemCount: items.length, total } }),
        clearCart: () =>
          set({ cart: { items: [], itemCount: 0, total: 0 } }),
      },
    }),
    {
      name: "inteliclient-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)
