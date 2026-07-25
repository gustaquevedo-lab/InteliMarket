import { useState } from "react"
import { Plus, Minus, Trash2, X, Pause, Play } from "lucide-react"

interface CartItem {
  id: string
  nombre: string
  sku: string
  quantity: number
  precio: number
  iva_tasa: number
}

interface CartPanelProps {
  items: CartItem[]
  onUpdateQty: (id: string, delta: number) => void
  onRemove: (id: string) => void
  onUpdatePrice: (id: string, price: number) => void
  onClear: () => void
  formatPrice: (value: number) => string
  heldSale?: { cart: CartItem[]; customer: unknown } | null
  onRecoverSale?: () => void
  discountPct?: number
  onApplyDiscount?: (pct: number) => void
  onClearDiscount?: () => void
  customerName?: string | null
}

export default function CartPanel({
  items,
  onUpdateQty,
  onRemove,
  onUpdatePrice,
  onClear,
  formatPrice,
  heldSale,
  onRecoverSale,
  discountPct = 0,
  onApplyDiscount,
  onClearDiscount,
  customerName,
}: CartPanelProps) {
  const subtotal = items.reduce((sum, item) => sum + item.precio * item.quantity, 0)
  const iva10 = items.filter(i => i.iva_tasa === 10).reduce((sum, i) => sum + Math.round(i.precio * i.quantity * 10 / 110), 0)
  const iva5 = items.filter(i => i.iva_tasa === 5).reduce((sum, i) => sum + Math.round(i.precio * i.quantity * 5 / 105), 0)
  const total = subtotal
  const discountAmount = Math.round(total * discountPct / 100)
  const totalAfterDiscount = total - discountAmount
  const totalQty = items.reduce((a, i) => a + i.quantity, 0)

  return (
    <div className="w-96 card flex flex-col">
      <div className="p-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Carrito <span className="text-primary">({totalQty})</span>
          </h2>
          <div className="flex items-center gap-2">
            {customerName && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-bold truncate max-w-32">
                {customerName}
              </span>
            )}
            {items.length > 0 && (
              <button onClick={onClear} className="text-gray-400 hover:text-red-500 transition-colors p-1">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <span className="text-4xl mb-3">🛒</span>
            <p className="text-sm font-bold">Carrito vacío</p>
            <p className="text-xs mt-1">Agrega productos para comenzar</p>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex flex-col gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{item.nombre}</p>
                  <p className="text-xs font-mono text-gray-400">{item.sku}</p>
                </div>
                <button onClick={() => onRemove(item.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <button onClick={() => onUpdateQty(item.id, -1)} className="w-7 h-7 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-8 text-center text-sm font-bold font-mono">{item.quantity}</span>
                  <button onClick={() => onUpdateQty(item.id, 1)} className="w-7 h-7 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <input
                  type="number"
                  className="input-field text-sm w-24 text-right font-mono"
                  placeholder="Precio"
                  value={item.precio || ""}
                  onChange={(e) => onUpdatePrice(item.id, parseFloat(e.target.value) || 0)}
                />
                <p className="text-sm font-bold font-mono w-20 text-right">{formatPrice(item.precio * item.quantity)}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t border-gray-100 dark:border-gray-700 space-y-3">
        <div className="space-y-1">
          <div className="flex justify-between text-sm text-gray-500">
            <span>Subtotal</span>
            <span className="font-mono">{formatPrice(subtotal)}</span>
          </div>
          {discountPct > 0 && (
            <div className="flex justify-between text-sm text-green-500">
              <span>Desc. {discountPct}%</span>
              <span className="font-mono">-{formatPrice(discountAmount)}</span>
            </div>
          )}
          {iva10 > 0 && (
            <div className="flex justify-between text-sm text-gray-500">
              <span>IVA 10%</span>
              <span className="font-mono">{formatPrice(iva10)}</span>
            </div>
          )}
          {iva5 > 0 && (
            <div className="flex justify-between text-sm text-gray-500">
              <span>IVA 5%</span>
              <span className="font-mono">{formatPrice(iva5)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-white pt-1 border-t border-gray-100 dark:border-gray-700">
            <span>Total</span>
            <span className="font-mono">{formatPrice(totalAfterDiscount)}</span>
          </div>
        </div>

        <div className="flex gap-1">
          {[5, 10, 15, 20].map(pct => (
            <button
              key={pct}
              onClick={() => onApplyDiscount?.(pct)}
              className={`px-2 py-1 text-xs rounded-lg font-bold transition-colors ${
                discountPct === pct
                  ? "bg-green-500 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-green-100 dark:hover:bg-green-900/30"
              }`}
            >
              -{pct}%
            </button>
          ))}
          {discountPct > 0 && onClearDiscount && (
            <button onClick={onClearDiscount} className="px-2 py-1 text-xs rounded-lg bg-red-100 dark:bg-red-900/20 text-red-500 font-bold">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {heldSale && onRecoverSale && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-xs text-amber-600">
            <Pause className="w-3 h-3" />
            Venta estacionada ({heldSale.cart.length} prod.) —
            <button onClick={onRecoverSale} className="underline font-bold flex items-center gap-1">
              <Play className="w-3 h-3" /> Recuperar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
