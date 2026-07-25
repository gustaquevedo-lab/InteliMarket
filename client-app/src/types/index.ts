export interface ClientUser {
  id: string
  nombre: string
  email: string
  telefono: string | null
  credito_limite: number
  credito_disponible: number
  saldo_actual: number
  loyalty_points: number
}

export interface Category {
  id: string
  nombre: string
  product_count: number
}

export interface Product {
  id: string
  sku: string | null
  codigo_barra: string | null
  nombre: string
  descripcion: string | null
  categoria: string | null
  precio: number
  iva_tasa: number
  stock_disponible: number
  unidad_medida: string | null
}

export interface CartItem {
  id: string
  product_id: string
  descripcion: string | null
  cantidad: number
  precio_unitario: number
  subtotal: number
}

export interface Cart {
  id: string
  items: CartItem[]
  total: number
  item_count: number
}

export interface OrderItem {
  id: string
  product_id: string
  descripcion: string | null
  cantidad: number
  precio_unitario: number
  total: number
}

export interface Order {
  id: string
  numero: string | null
  estado: string
  subtotal: number
  total: number
  saldo: number
  direccion_entrega: string | null
  delivery_id: string | null
  items: OrderItem[]
  created_at: string
}

export interface Address {
  id: string
  nombre: string | null
  direccion: string
  ciudad: string | null
  latitud: number | null
  longitud: number | null
  es_default: boolean
}

export interface Promotion {
  id: string
  nombre: string
  descripcion: string | null
  tipo: string
  valor: number
  codigo_cupon: string | null
  valido_hasta: string | null
}
