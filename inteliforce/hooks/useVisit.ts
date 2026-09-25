// hooks/useVisit.ts
import { create } from 'zustand';

export interface CartItem {
  productId: string;
  sku?: string;
  nombre: string;
  precio_unitario: number;
  cantidad: number;
  stock?: number;
  iva_tasa: number;
  descuento_pct: number;
}

interface ActiveVisitState {
  visitId: string | null;
  customerId: string | null;
  customerName: string | null;
  startTime: number | null;
  cart: CartItem[];

  // Actions
  startVisit: (visitId: string, customerId: string, customerName: string) => void;
  endVisit: () => void;

  // Cart actions
  addToCart: (product: {
    id: string;
    sku?: string;
    nombre: string;
    precio_venta: number;
    stock?: number;
  }, cantidad?: number) => void;
  updateCartQty: (productId: string, cantidad: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;

  // Computed total
  getCartTotal: () => number;
  getCartItemCount: () => number;
}

export const useVisit = create<ActiveVisitState>((set, get) => ({
  visitId: null,
  customerId: null,
  customerName: null,
  startTime: null,
  cart: [],

  startVisit: (visitId, customerId, customerName) => {
    set({
      visitId,
      customerId,
      customerName,
      startTime: Date.now(),
      cart: [],
    });
  },

  endVisit: () => {
    set({
      visitId: null,
      customerId: null,
      customerName: null,
      startTime: null,
      cart: [],
    });
  },

  addToCart: (product, cantidad = 1) => {
    const { cart } = get();
    const existingIndex = cart.findIndex((i) => i.productId === product.id);

    if (existingIndex >= 0) {
      const updated = [...cart];
      updated[existingIndex].cantidad += cantidad;
      set({ cart: updated });
    } else {
      set({
        cart: [
          ...cart,
          {
            productId: product.id,
            sku: product.sku,
            nombre: product.nombre,
            precio_unitario: product.precio_venta,
            cantidad,
            stock: product.stock,
            iva_tasa: 10,
            descuento_pct: 0,
          },
        ],
      });
    }
  },

  updateCartQty: (productId, cantidad) => {
    const { cart } = get();
    if (cantidad <= 0) {
      set({ cart: cart.filter((i) => i.productId !== productId) });
      return;
    }
    set({
      cart: cart.map((i) => (i.productId === productId ? { ...i, cantidad } : i)),
    });
  },

  removeFromCart: (productId) => {
    set({ cart: get().cart.filter((i) => i.productId !== productId) });
  },

  clearCart: () => {
    set({ cart: [] });
  },

  getCartTotal: () => {
    return get().cart.reduce((sum, item) => sum + item.precio_unitario * item.cantidad, 0);
  },

  getCartItemCount: () => {
    return get().cart.reduce((sum, item) => sum + item.cantidad, 0);
  },
}));
