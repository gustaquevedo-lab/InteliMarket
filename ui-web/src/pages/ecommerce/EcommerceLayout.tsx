import { useState, useEffect } from "react"
import { useNavigate, Link, useLocation } from "react-router-dom"
import { ShoppingCart, User, Package, LogOut, Store, Menu, X } from "lucide-react"
import { ecommerceApi } from "../../api/ecommerce"

export default function EcommerceLayout({ children }: { children: React.ReactNode }) {
  const [cartCount, setCartCount] = useState(0)
  const [customer, setCustomer] = useState<any>(null)
  const [mobileMenu, setMobileMenu] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const isAuthPage = location.pathname.includes("/login") || location.pathname.includes("/registro")

  useEffect(() => {
    const token = localStorage.getItem("ecommerce_token")
    if (token) {
      ecommerceApi.me().then(setCustomer).catch(() => localStorage.removeItem("ecommerce_token"))
    }
  }, [location.pathname])

  useEffect(() => {
    if (customer) {
      ecommerceApi.cart().then((c) => {
        const count = c.items?.reduce((s: number, i: any) => s + i.cantidad, 0) || 0
        setCartCount(count)
      }).catch(() => {})
    }
  }, [customer, location.pathname])

  const handleLogout = () => {
    localStorage.removeItem("ecommerce_token")
    setCustomer(null)
    navigate("/tienda")
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/tienda" className="flex items-center gap-2">
            <Store className="w-6 h-6 text-blue-600" />
            <span className="text-lg font-bold text-gray-900 dark:text-white">InteliMarket</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <Link to="/tienda" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600">Catálogo</Link>
            {customer && (
              <>
                <Link to="/tienda/dashboard" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600">Mis Pedidos</Link>
                <Link to="/tienda/carrito" className="relative text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600">
                  <ShoppingCart className="w-5 h-5 inline" />
                  {cartCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">{cartCount}</span>
                  )}
                </Link>
              </>
            )}
          </nav>

          <div className="flex items-center gap-3">
            {customer ? (
              <div className="hidden md:flex items-center gap-3">
                <span className="text-sm text-gray-500">{customer.nombre}</span>
                <button onClick={handleLogout} className="text-sm text-red-500 hover:text-red-600"><LogOut className="w-4 h-4" /></button>
              </div>
            ) : !isAuthPage ? (
              <Link to="/tienda/login" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition">
                Iniciar Sesión
              </Link>
            ) : null}
            <button onClick={() => setMobileMenu(!mobileMenu)} className="md:hidden p-2 text-gray-500">
              {mobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenu && (
          <div className="md:hidden border-t border-gray-200 dark:border-gray-700 px-4 py-3 space-y-2 bg-white dark:bg-gray-800">
            <Link to="/tienda" onClick={() => setMobileMenu(false)} className="block text-sm py-2">Catálogo</Link>
            {customer ? (
              <>
                <Link to="/tienda/dashboard" onClick={() => setMobileMenu(false)} className="block text-sm py-2">Mis Pedidos</Link>
                <Link to="/tienda/carrito" onClick={() => setMobileMenu(false)} className="block text-sm py-2">Carrito ({cartCount})</Link>
                <button onClick={() => { handleLogout(); setMobileMenu(false) }} className="block text-sm py-2 text-red-500">Cerrar Sesión</button>
              </>
            ) : !isAuthPage ? (
              <Link to="/tienda/login" onClick={() => setMobileMenu(false)} className="block text-sm py-2 text-blue-600">Iniciar Sesión</Link>
            ) : null}
          </div>
        )}
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
