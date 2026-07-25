import { useState, useEffect, useCallback, useRef } from "react"
import { Plus, Minus, Trash2, Search, X, User, ShoppingCart, Loader2 } from "lucide-react"
import { api, type Product, type Customer } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG, debounce } from "../../utils/format"

interface CartItem extends Product {
  quantity: number
  descuento: number
}

interface NewSaleFormProps {
  onSuccess?: () => void
  onClose?: () => void
}

export function NewSaleForm({ onSuccess, onClose }: NewSaleFormProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState("")
  const [customerSearch, setCustomerSearch] = useState("")
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [condicion, setCondicion] = useState<"contado" | "credito">("contado")
  const [tipoComprobante, setTipoComprobante] = useState("factura")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showProducts, setShowProducts] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  const loadProducts = useCallback(async (q: string) => {
    try {
      const data = await api.products.list({ search: q || undefined, activo: true })
      setProducts(data.slice(0, 20))
    } catch {
      // Demo fallback
      setProducts([])
    }
  }, [])

  const loadCustomers = useCallback(async (q: string) => {
    try {
      const data = await api.customers.list({ search: q || undefined, activo: true })
      setCustomers(data.slice(0, 10))
    } catch {
      setCustomers([])
    }
  }, [])

  const debouncedProductSearch = useRef(debounce((q: string) => { loadProducts(q) }, 300)).current
  const debouncedCustomerSearch = useRef(debounce((q: string) => { loadCustomers(q) }, 300)).current

  useEffect(() => {
    if (showProducts) {
      loadProducts(search)
      searchRef.current?.focus()
    }
  }, [search, showProducts, loadProducts])

  useEffect(() => {
    if (showCustomerDropdown) {
      loadCustomers(customerSearch)
    }
  }, [customerSearch, showCustomerDropdown, loadCustomers])

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id)
      if (existing) return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { ...product, quantity: 1, descuento: 0 }]
    })
    setSearch("")
    setShowProducts(false)
    searchRef.current?.focus()
  }

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => {
      const item = prev.find(i => i.id === id)
      if (!item) return prev
      const newQty = item.quantity + delta
      if (newQty <= 0) return prev.filter(i => i.id !== id)
      return prev.map(i => i.id === id ? { ...i, quantity: newQty } : i)
    })
  }

  const removeFromCart = (id: string) => setCart(prev => prev.filter(i => i.id !== id))

  const subtotal = cart.reduce((sum, item) => sum + (item as unknown as { iva_tasa: number }).iva_tasa, 0)

  // Calculate with iva_tasa from product
  const totalSinIVA = cart.reduce((sum, item) => {
    const tasa = (item as unknown as { iva_tasa: number }).iva_tasa || 10
    const precio = ((item as unknown as { precio: number }).precio || 0)
    return sum + precio * item.quantity
  }, 0)

  const getItemsTotal = cart.reduce((sum, item) => {
    const price = item.precio || 0
    return sum + price * item.quantity
  }, 0)

  const getIVA10 = () => {
    return cart.reduce((sum, item) => {
      const tasa = item.iva_tasa || 10
      const price = item.precio || 0
      if (tasa === 10) return sum + Math.round((price * item.quantity) * 0.1 / 1.1)
      if (tasa === 5) return sum + Math.round((price * item.quantity) * 0.05 / 1.05)
      return sum
    }, 0)
  }

  const total = getItemsTotal
  const iva10 = getIVA10()

  const handleCreateSale = async () => {
    if (cart.length === 0) {
      toast.warning("Carrito vacío", "Agregá productos antes de crear la venta")
      return
    }
    setSaving(true)
    try {
      await api.sales.create({
        customer_id: selectedCustomer?.id,
        condicion,
        tipo_comprobante: tipoComprobante,
        items: cart.map(item => ({
          product_id: item.id,
          cantidad: item.quantity,
          precio_unitario: item.precio || 0,
        })),
      })
      toast.success("Venta creada correctamente")
      setCart([])
      setSelectedCustomer(null)
      onSuccess?.()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al crear la venta"
      toast.error("Error", msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-10rem)]">
      {/* Left: Product selection */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="flex gap-3 items-center">
          <button
            onClick={() => setShowProducts(!showProducts)}
            className="btn-primary flex items-center gap-2"
          >
            <Search className="w-4 h-4" />
            Buscar productos
          </button>
          <div className="relative flex-1">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="input-field pl-10"
              placeholder="Buscar cliente..."
              value={customerSearch}
              onChange={(e) => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true) }}
              onFocus={() => setShowCustomerDropdown(true)}
            />
            {showCustomerDropdown && customers.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto">
                <button
                  key="consumer"
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-sm"
                  onClick={() => { setSelectedCustomer(null); setShowCustomerDropdown(false); setCustomerSearch("Consumidor Final") }}
                >
                  Consumidor Final
                </button>
                {customers.map(c => (
                  <button
                    key={c.id}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                    onClick={() => { setSelectedCustomer(c); setShowCustomerDropdown(false); setCustomerSearch(c.razon_social || c.nombre || "") }}
                  >
                    <p className="text-sm font-medium">{c.razon_social}</p>
                    <p className="text-xs text-gray-400">{c.ruc || c.ci}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {showProducts && (
          <div className="relative">
            <input
              ref={searchRef}
              className="input-field"
              placeholder="Escribí para buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && products.length > 0) addToCart(products[0]) }}
            />
            {products.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-20 max-h-64 overflow-y-auto">
                {products.map(p => (
                  <button
                    key={p.id}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors flex justify-between items-center"
                    onClick={() => addToCart(p)}
                  >
                    <div>
                      <p className="text-sm font-medium">{p.nombre}</p>
                      <p className="text-xs text-gray-400 font-mono">{p.sku}</p>
                    </div>
                    <span className="text-sm font-bold text-primary">{formatPYG(p.precio || 0)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Config */}
        <div className="flex gap-4">
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Condición</label>
            <select className="input-field mt-1" value={condicion} onChange={(e) => setCondicion(e.target.value as "contado" | "credito")}>
              <option value="contado">Contado</option>
              <option value="credito">Crédito</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Comprobante</label>
            <select className="input-field mt-1" value={tipoComprobante} onChange={(e) => setTipoComprobante(e.target.value)}>
              <option value="factura">Factura</option>
              <option value="ticket">Ticket</option>
              <option value="remito">Remito</option>
            </select>
          </div>
        </div>
      </div>

      {/* Right: Cart */}
      <div className="w-96 card flex flex-col">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            Carrito ({cart.length})
          </h2>
          {cart.length > 0 && (
            <button onClick={() => setCart([])} className="text-xs text-red-500 hover:text-red-600 font-bold">
              Vaciar
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <ShoppingCart className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm font-bold">Carrito vacío</p>
              <p className="text-xs mt-1">Buscá productos para agregar</p>
            </div>
          ) : cart.map((item) => {
            const price = item.precio || 0
            return (
              <div key={item.id} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{item.nombre}</p>
                  <p className="text-xs font-mono text-gray-400">{formatPYG(price)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQuantity(item.id, -1)} className="w-7 h-7 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"><Minus className="w-3 h-3" /></button>
                  <span className="w-8 text-center text-sm font-bold font-mono">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, 1)} className="w-7 h-7 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"><Plus className="w-3 h-3" /></button>
                </div>
                <p className="text-sm font-bold font-mono w-20 text-right">{formatPYG(price * item.quantity)}</p>
                <button onClick={() => removeFromCart(item.id)} className="text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
            )
          })}
        </div>

        <div className="p-4 border-t border-gray-100 dark:border-gray-700 space-y-3">
          <div className="space-y-1">
            <div className="flex justify-between text-sm text-gray-500"><span>Subtotal</span><span className="font-mono">{formatPYG(total - iva10)}</span></div>
            <div className="flex justify-between text-sm text-gray-500"><span>IVA 10%</span><span className="font-mono">{formatPYG(iva10)}</span></div>
            <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-white pt-1 border-t border-gray-100 dark:border-gray-700"><span>Total</span><span className="font-mono">{formatPYG(total)}</span></div>
          </div>
          <button
            onClick={handleCreateSale}
            disabled={saving || cart.length === 0}
            className="btn-primary w-full py-3 text-base"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Crear venta"}
          </button>
        </div>
      </div>
    </div>
  )
}
