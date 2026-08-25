import { useState, useEffect } from "react"
import { useNavigate, Link, useLocation } from "react-router-dom"
import {
  ShoppingCart, User, Package, LogOut, Store, Menu, X,
  MapPin, Phone, Clock, ShieldCheck, CreditCard, Truck,
  ChevronDown, Search, Heart, Sparkles, MessageCircle
} from "lucide-react"
import { ecommerceApi } from "../../api/ecommerce"
import { formatPYG } from "../../utils/format"

export default function EcommerceLayout({ children }: { children: React.ReactNode }) {
  const [cartCount, setCartCount] = useState(0)
  const [cartTotal, setCartTotal] = useState(0)
  const [customer, setCustomer] = useState<any>(null)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [selectedBranch, setSelectedBranch] = useState("Sucursal Central (Av. Eusebio Ayala)")
  const [showBranchModal, setShowBranchModal] = useState(false)

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
      ecommerceApi.cart().then((c: any) => {
        const count = c.items?.reduce((s: number, i: any) => s + i.cantidad, 0) || 0
        const total = c.items?.reduce((s: number, i: any) => s + (i.cantidad * (i.precio_unitario || i.precio || 0)), 0) || 0
        setCartCount(count)
        setCartTotal(total)
      }).catch(() => {})
    }
  }, [customer, location.pathname])

  const handleLogout = () => {
    localStorage.removeItem("ecommerce_token")
    setCustomer(null)
    navigate("/tienda")
  }

  const branches = [
    { id: "b1", name: "Sucursal Central (Av. Eusebio Ayala)", time: "Abierto hasta 22:00" },
    { id: "b2", name: "Sucursal Shopping (Av. Mcal. López)", time: "Abierto hasta 23:00" },
    { id: "b3", name: "Sucursal Centro (Calle Palma)", time: "Abierto hasta 21:00" },
  ]

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans text-gray-900 dark:text-gray-100 selection:bg-red-500 selection:text-white">
      {/* ── TOPBAR SUPER EXTRA ──────────────────────────────────────────────── */}
      <div className="bg-red-700 text-white text-[11px] font-semibold py-1.5 px-4 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-yellow-300" />
              <span>Envíos express en el día en Gran Asunción</span>
            </span>
            <span className="hidden md:flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-green-300" />
              <span>Cadena de frío 100% garantizada en carnes y lácteos</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="https://wa.me/595981000000"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 hover:text-yellow-200 transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5 text-green-400" />
              <span className="hidden sm:inline">Pedidos WhatsApp:</span>
              <span className="font-bold font-mono">0981 123 456</span>
            </a>
            <span className="hidden lg:inline text-white/40">|</span>
            <Link to="/tienda/pedidos" className="hidden lg:inline hover:underline text-white/90">
              Rastrear mi pedido
            </Link>
          </div>
        </div>
      </div>

      {/* ── MAIN HEADER SUPER EXTRA ────────────────────────────────────────── */}
      <header className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 py-3.5">
          <div className="flex items-center justify-between gap-4">
            {/* LOGO SUPER EXTRA */}
            <Link to="/tienda" className="flex items-center gap-2.5 shrink-0 group">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-red-600 to-red-500 flex items-center justify-center text-white shadow-md shadow-red-500/20 group-hover:scale-105 transition-transform">
                <Store className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-xl font-black tracking-tight text-gray-900 dark:text-white uppercase leading-none">
                    SUPER <span className="text-red-600">EXTRA</span>
                  </span>
                  <span className="px-1.5 py-0.5 rounded-md bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 text-[9px] font-black uppercase tracking-wider">
                    ONLINE
                  </span>
                </div>
                <span className="text-[10px] text-gray-400 font-medium">Supermercado & Frescos</span>
              </div>
            </Link>

            {/* SUCURSAL SELECTOR */}
            <div className="hidden lg:block relative">
              <button
                onClick={() => setShowBranchModal(!showBranchModal)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/80 hover:bg-gray-100 text-left text-xs transition-colors"
              >
                <MapPin className="w-3.5 h-3.5 text-red-600 shrink-0" />
                <div>
                  <p className="text-[9px] uppercase font-black text-gray-400 leading-none">Retiro / Envío desde</p>
                  <p className="font-bold text-gray-800 dark:text-gray-200 truncate max-w-[180px]">{selectedBranch}</p>
                </div>
                <ChevronDown className="w-3 h-3 text-gray-400" />
              </button>

              {showBranchModal && (
                <div className="absolute left-0 mt-2 w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-800 p-2 z-50 animate-fade-in-up">
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 p-2">Elegí tu Sucursal</p>
                  {branches.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => {
                        setSelectedBranch(b.name)
                        setShowBranchModal(false)
                      }}
                      className={`w-full text-left p-2.5 rounded-xl text-xs transition-colors ${
                        selectedBranch === b.name
                          ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 font-bold"
                          : "hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      <p className="font-bold">{b.name}</p>
                      <p className="text-[10px] text-gray-400">{b.time}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ACCIONES DE USUARIO & CARRITO */}
            <div className="flex items-center gap-3">
              {customer ? (
                <div className="flex items-center gap-3">
                  <Link
                    to="/tienda/pedidos"
                    className="hidden sm:flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-200 hover:text-red-600 transition-colors"
                  >
                    <Package className="w-4 h-4 text-gray-400" />
                    <span>Mis Pedidos</span>
                  </Link>

                  <div className="flex items-center gap-2 pl-2 border-l border-gray-200 dark:border-slate-700">
                    <div className="w-7 h-7 rounded-full bg-red-100 dark:bg-red-950/50 text-red-600 flex items-center justify-center font-bold text-xs">
                      {customer.nombre?.[0] || "U"}
                    </div>
                    <span className="hidden md:inline text-xs font-bold text-gray-800 dark:text-gray-200 max-w-[100px] truncate">
                      {customer.nombre}
                    </span>
                    <button
                      onClick={handleLogout}
                      className="p-1 text-gray-400 hover:text-red-600 rounded-lg transition-colors"
                      title="Cerrar Sesión"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : !isAuthPage ? (
                <div className="flex items-center gap-2">
                  <Link
                    to="/tienda/login"
                    className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-200 hover:text-red-600 px-3 py-2 rounded-xl transition-colors"
                  >
                    <User className="w-4 h-4" />
                    <span className="hidden sm:inline">Iniciar Sesión</span>
                  </Link>
                  <Link
                    to="/tienda/registro"
                    className="hidden md:inline-flex text-xs font-extrabold bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 text-gray-800 dark:text-gray-200 px-3 py-2 rounded-xl transition-colors"
                  >
                    Crear Cuenta
                  </Link>
                </div>
              ) : null}

              {/* BOTÓN CARRITO DE COMPRAS */}
              <Link
                to="/tienda/carrito"
                className="flex items-center gap-2.5 bg-red-600 hover:bg-red-700 text-white px-3.5 py-2 rounded-xl shadow-md shadow-red-600/20 font-bold text-xs transition-all active:scale-95"
              >
                <div className="relative">
                  <ShoppingCart className="w-4 h-4" />
                  {cartCount > 0 && (
                    <span className="absolute -top-2 -right-2.5 bg-yellow-400 text-red-900 text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-black animate-pulse">
                      {cartCount}
                    </span>
                  )}
                </div>
                <div className="hidden sm:flex flex-col text-left leading-none">
                  <span className="text-[9px] text-red-200 uppercase font-black">Mi Carrito</span>
                  <span className="font-mono text-xs font-black">
                    {cartTotal > 0 ? formatPYG(cartTotal) : "Gs. 0"}
                  </span>
                </div>
              </Link>

              {/* MOBILE MENU TOGGLE */}
              <button
                onClick={() => setMobileMenu(!mobileMenu)}
                className="md:hidden p-2 text-gray-500 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                {mobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* ── MOBILE MENU ─────────────────────────────────────────────────── */}
        {mobileMenu && (
          <div className="md:hidden border-t border-gray-200 dark:border-slate-800 px-4 py-3 space-y-2 bg-white dark:bg-slate-900 animate-fade-in-up">
            <Link
              to="/tienda"
              onClick={() => setMobileMenu(false)}
              className="block text-xs font-bold py-2 text-gray-700 dark:text-gray-200"
            >
              Catálogo & Ofertas
            </Link>
            {customer ? (
              <>
                <Link
                  to="/tienda/pedidos"
                  onClick={() => setMobileMenu(false)}
                  className="block text-xs font-bold py-2 text-gray-700 dark:text-gray-200"
                >
                  Mis Pedidos
                </Link>
                <Link
                  to="/tienda/carrito"
                  onClick={() => setMobileMenu(false)}
                  className="block text-xs font-bold py-2 text-red-600"
                >
                  Carrito ({cartCount} artículos · {formatPYG(cartTotal)})
                </Link>
                <button
                  onClick={() => {
                    handleLogout()
                    setMobileMenu(false)
                  }}
                  className="block text-xs font-bold py-2 text-red-500"
                >
                  Cerrar Sesión
                </button>
              </>
            ) : !isAuthPage ? (
              <div className="pt-2 border-t border-gray-100 dark:border-slate-800 space-y-2">
                <Link
                  to="/tienda/login"
                  onClick={() => setMobileMenu(false)}
                  className="block text-xs font-bold py-2 text-center bg-red-600 text-white rounded-xl"
                >
                  Iniciar Sesión
                </Link>
                <Link
                  to="/tienda/registro"
                  onClick={() => setMobileMenu(false)}
                  className="block text-xs font-bold py-2 text-center bg-gray-100 dark:bg-slate-800 rounded-xl"
                >
                  Registrarme
                </Link>
              </div>
            ) : null}
          </div>
        )}
      </header>

      {/* ── CONTENIDO PRINCIPAL ────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {children}
      </main>

      {/* ── FOOTER SUPER EXTRA ─────────────────────────────────────────────── */}
      <footer className="bg-slate-900 text-gray-300 border-t border-slate-800 mt-16 text-xs">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* COL 1: INFO & BRAND */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-red-600 flex items-center justify-center text-white font-bold">
                  <Store className="w-4 h-4" />
                </div>
                <span className="text-lg font-black tracking-tight text-white uppercase">
                  SUPER <span className="text-red-500">EXTRA</span>
                </span>
              </div>
              <p className="text-gray-400 text-xs leading-relaxed">
                Supermercado líder en calidad, frescura y precios convenientes. Hacé tus compras online y recibí en tu casa o retirá en sucursal.
              </p>
              <div className="pt-2 flex items-center gap-3 text-gray-400">
                <ShieldCheck className="w-4 h-4 text-green-400" />
                <span className="text-[11px]">Compra 100% Segura & Factura Legal</span>
              </div>
            </div>

            {/* COL 2: SUCURSALES & ATENCIÓN */}
            <div className="space-y-3">
              <h4 className="font-extrabold text-white text-xs uppercase tracking-wider">Nuestras Sucursales</h4>
              <ul className="space-y-2 text-gray-400 text-xs">
                <li>📍 <strong>Central:</strong> Av. Eusebio Ayala km 4.5</li>
                <li>📍 <strong>Shopping:</strong> Av. Mcal. López y San Martín</li>
                <li>📍 <strong>Centro:</strong> Calle Palma y 14 de Mayo</li>
                <li className="pt-1">🕒 <strong>Horario:</strong> Lunes a Domingo 07:00 a 22:00</li>
              </ul>
            </div>

            {/* COL 3: ENLACES RÁPIDOS */}
            <div className="space-y-3">
              <h4 className="font-extrabold text-white text-xs uppercase tracking-wider">Atención al Cliente</h4>
              <ul className="space-y-2 text-gray-400 text-xs">
                <li><Link to="/tienda" className="hover:text-white transition">Ofertas de la Semana</Link></li>
                <li><Link to="/tienda/pedidos" className="hover:text-white transition">Estado de mi Pedido</Link></li>
                <li><a href="https://wa.me/595981000000" target="_blank" rel="noreferrer" className="hover:text-white transition">Soporte WhatsApp</a></li>
                <li><Link to="/tienda/login" className="hover:text-white transition">Mi Cuenta</Link></li>
              </ul>
            </div>

            {/* COL 4: MEDIOS DE PAGO */}
            <div className="space-y-3">
              <h4 className="font-extrabold text-white text-xs uppercase tracking-wider">Medios de Pago Aceptados</h4>
              <p className="text-gray-400 text-xs">
                Aceptamos todas las tarjetas de crédito y débito, transferencias SIPAP, QR Pix y pago contra entrega (Efectivo o POS inalámbrico).
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                <span className="px-2 py-1 rounded bg-slate-800 text-gray-300 font-mono text-[10px] font-bold">💳 Bancard vPOS</span>
                <span className="px-2 py-1 rounded bg-slate-800 text-gray-300 font-mono text-[10px] font-bold">📲 QR Pix / Simple</span>
                <span className="px-2 py-1 rounded bg-slate-800 text-gray-300 font-mono text-[10px] font-bold">💵 Efectivo</span>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800 mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-gray-500">
            <p>© {new Date().getFullYear()} Super Extra · Desarrollado con tecnología InteliMarket.</p>
            <p className="flex items-center gap-1">
              <span>Sitio oficial:</span>
              <a href="https://www.superextra.com.py" target="_blank" rel="noreferrer" className="text-red-400 font-semibold hover:underline">
                www.superextra.com.py
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
