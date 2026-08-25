import React, { useState, useEffect, useRef, useMemo, useCallback } from "react"
import {
  Search, ScanLine, ShoppingCart, Calculator, ClipboardList, Save, Loader2, Sun, Moon, Plus, Minus, Trash2, User, Pause, Play,
  Percent, X, CheckCircle, Printer, RefreshCw, Banknote,
  CreditCard, QrCode, Building, ArrowRight, Check, AlertCircle, Clock,
  DollarSign, Globe, Settings, FileText, ChevronDown, Sparkles, Receipt,
  Award, ShieldCheck, KeyRound, Star, Wallet, Scale, AlertTriangle,
  Usb, ArrowDownRight, CornerDownLeft, ArrowRightLeft, CornerRightDown,
  Maximize2, Eye, Image as ImageIcon, ZoomIn, LogOut, Lock, Unlock,
  Coins, HelpCircle, Package, Flame, ShoppingBag, LayoutGrid, ListFilter,
  Layers, Tag, Boxes, Radio, Activity, ShieldAlert, ArrowUpRight, Sliders, UserPlus, Sparkle, RotateCcw
} from "lucide-react"
import { api, type Product, type Customer, type Sale, type Warehouse, API_ORIGIN, COMPANY_ID } from "../../api"
import { useAuth } from "../../context/AuthContext"
import { useTheme } from "../../context/ThemeContext"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"

// ── BANDERAS VECTORIALES SVG PARA COMPATIBILIDAD TOTAL EN WINDOWS / ELECTRON ─
const FlagPY = () => (
  <svg className="w-5 h-3.5 rounded-xs shadow-xs inline-block shrink-0" viewBox="0 0 750 450">
    <rect width="750" height="150" fill="#d52b1e" />
    <rect y="150" width="750" height="150" fill="#ffffff" />
    <rect y="300" width="750" height="150" fill="#0038a8" />
    <circle cx="375" cy="225" r="35" fill="#ffdf00" stroke="#0038a8" strokeWidth="4" />
  </svg>
)

const FlagBR = () => (
  <svg className="w-5 h-3.5 rounded-xs shadow-xs inline-block shrink-0" viewBox="0 0 720 500">
    <rect width="720" height="500" fill="#009c3b" />
    <polygon points="360,50 660,250 360,450 60,250" fill="#ffdf00" />
    <circle cx="360" cy="250" r="105" fill="#002776" />
    <path d="M260,265 C320,225 400,225 460,265" stroke="#ffffff" strokeWidth="16" fill="none" />
  </svg>
)

const FlagUS = () => (
  <svg className="w-5 h-3.5 rounded-xs shadow-xs inline-block shrink-0" viewBox="0 0 741 390">
    <rect width="741" height="390" fill="#b22234" />
    <path d="M0,30 H741 M0,90 H741 M0,150 H741 M0,210 H741 M0,270 H741 M0,330 H741" stroke="#ffffff" strokeWidth="30" />
    <rect width="296.4" height="210" fill="#3c3b6e" />
  </svg>
)

// ── CÁLCULO OFICIAL DE DÍGITO VERIFICADOR (MÓDULO 11 SET / DNIT PARAGUAY) ───
function calculateRucDv(rucBase: string): number {
  const clean = rucBase.replace(/\D/g, "")
  if (!clean) return 0
  let suma = 0
  let factor = 2
  for (let i = clean.length - 1; i >= 0; i--) {
    suma += parseInt(clean[i], 10) * factor
    factor = factor === 11 ? 2 : factor + 1
  }
  const resto = suma % 11
  return resto > 1 ? 11 - resto : 0
}

interface CartItem {
  id: string
  product_id: string
  nombre: string
  precio: number
  precio_base: number
  sku: string
  codigo_barra?: string
  imagen_url?: string | null
  quantity: number
  iva_tasa: number
  descuento_pct?: number
  es_pesable?: boolean
  peso_etiqueta_kg?: number
  peso_verificado?: boolean
  origen_balanza?: "balmak_bck30" | "etiqueta_plu" | null
}

interface PausedSale {
  id: string
  timestamp: string
  customer: Customer
  items: CartItem[]
  total: number
}

interface CurrencyRates {
  BRL: number
  USD: number
}

interface PosTerminalAssignment {
  puntoEmision: string
  nombreCaja: string
  bancardTerminalId: string
  bancardLote: string
  bancardPort: string
  dinelcoTerminalId: string
  dinelcoLote: string
  dinelcoPort: string
}

// ── GENERADOR DE TICKET ESC/POS (impresión térmica directa, sin Chromium/GDI) ─
// El driver Windows de la impresora térmica no traduce bien las páginas HTML
// que arma Chromium al imprimir (queda corrido/cortado sin importar el ancho
// pedido, confirmado con un ticket de diagnóstico). Los comandos ESC/POS se
// mandan crudos directo a la impresora vía print-bridge.exe, sin que Windows
// reinterprete nada -- por eso el ticket se arma acá como texto de ancho fijo
// (columnas), no como HTML.
const ESC = '\x1B'
const GS = '\x1D'
const ESCPOS_INIT = ESC + '@'
const ESCPOS_BOLD_ON = ESC + 'E' + '\x01'
const ESCPOS_BOLD_OFF = ESC + 'E' + '\x00'
const ESCPOS_ALIGN_LEFT = ESC + 'a' + '\x00'
const ESCPOS_ALIGN_CENTER = ESC + 'a' + '\x01'
const ESCPOS_DOUBLE_ON = GS + '!' + '\x11'
const ESCPOS_HEIGHT_ON = GS + '!' + '\x10'
const ESCPOS_DOUBLE_OFF = GS + '!' + '\x00'
const ESCPOS_LINE_WIDTH = 48

function escposStripAccents(s: string): string {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7E\n]/g, '')
}
function escposPadRight(s: string, n: number): string {
  s = escposStripAccents(s)
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length)
}
function escposTwoCol(left: string, right: string, width = ESCPOS_LINE_WIDTH): string {
  left = escposStripAccents(left)
  right = escposStripAccents(right)
  if (right.length >= width) return right.slice(0, width)
  const maxLeft = width - right.length - 1
  if (left.length > maxLeft) left = left.slice(0, Math.max(0, maxLeft))
  const gap = width - left.length - right.length
  return left + ' '.repeat(Math.max(1, gap)) + right
}
function escposCenter(s: string, width = ESCPOS_LINE_WIDTH): string {
  s = escposStripAccents(s)
  if (s.length >= width) return s.slice(0, width)
  const padL = Math.floor((width - s.length) / 2)
  return ' '.repeat(padL) + s
}
function escposDashes(width = ESCPOS_LINE_WIDTH): string {
  return '-'.repeat(width)
}
// btoa espera char codes 0-255 -- ya garantizado por escposStripAccents +
// los propios bytes de control ESC/GS (todos < 256).
function escposToBase64(escposText: string): string {
  return btoa(escposText)
}

// Codigo QR nativo del propio firmware de la impresora (comando GS ( k,
// familia de codigos 2D estandar ESC/POS) -- no es una imagen, es la
// impresora la que dibuja el QR, mucho mas confiable que rasterizar un PNG.
function escposQr(data: string, moduleSize = 5): string {
  const d = data
  const len = d.length + 3
  const pL = String.fromCharCode(len & 0xFF)
  const pH = String.fromCharCode((len >> 8) & 0xFF)
  let cmd = ''
  cmd += GS + '(k' + '\x04\x00' + '\x31\x41' + '\x32\x00' // modelo 2
  cmd += GS + '(k' + '\x03\x00' + '\x31\x43' + String.fromCharCode(moduleSize) // tamano de modulo
  cmd += GS + '(k' + '\x03\x00' + '\x31\x45' + '\x31' // correccion de error M
  cmd += GS + '(k' + pL + pH + '\x31\x50\x30' + d // guardar datos
  cmd += GS + '(k' + '\x03\x00' + '\x31\x51\x30' // imprimir
  return cmd
}

// Convierte un logo (data URL, ya cacheado en localStorage) a una imagen
// rasterizada monocroma en formato ESC/POS (comando GS v 0), usando canvas
// -- sin librerias externas ni bindings nativos. maxWidthPx=384 son 48 bytes
// de ancho, un tamano estandar y seguro para 80mm a 203dpi.
function escposLogoFromDataUrl(dataUrl: string, maxWidthPx = 384): Promise<string> {
  return new Promise((resolve) => {
    if (!dataUrl) { resolve(''); return }
    const img = new Image()
    img.onload = () => {
      try {
        const scale = Math.min(1, maxWidthPx / img.width)
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const wBytes = Math.ceil(w / 8)
        const canvas = document.createElement('canvas')
        canvas.width = wBytes * 8
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve(''); return }
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, h)
        ctx.drawImage(img, 0, 0, w, h)
        const imgData = ctx.getImageData(0, 0, canvas.width, h).data
        const bytes: number[] = []
        for (let y = 0; y < h; y++) {
          for (let bx = 0; bx < wBytes; bx++) {
            let byte = 0
            for (let bit = 0; bit < 8; bit++) {
              const x = bx * 8 + bit
              const idx = (y * canvas.width + x) * 4
              const a = imgData[idx + 3]
              const lum = a < 128 ? 255 : (0.299 * imgData[idx] + 0.587 * imgData[idx + 1] + 0.114 * imgData[idx + 2])
              if (lum < 160) byte |= (1 << (7 - bit))
            }
            bytes.push(byte)
          }
        }
        const xL = String.fromCharCode(wBytes & 0xFF)
        const xH = String.fromCharCode((wBytes >> 8) & 0xFF)
        const yL = String.fromCharCode(h & 0xFF)
        const yH = String.fromCharCode((h >> 8) & 0xFF)
        let cmd = GS + 'v0' + '\x00' + xL + xH + yL + yH
        for (const b of bytes) cmd += String.fromCharCode(b)
        resolve(cmd)
      } catch (e) {
        resolve('')
      }
    }
    img.onerror = () => resolve('')
    img.src = dataUrl
  })
}

const DEFAULT_CUSTOMER: Customer = {
  id: "00000000-0000-0000-0000-000000000001",
  nombre: "Consumidor Final",
  razon_social: "Consumidor Final",
  ruc: "44444401-7",
  ci: "44444401",
  tipo_documento: "CI",
  activo: true,
} as any

// El backend de clientes reales no manda "nombre" -- usa razon_social /
// nombre_fantasia. Toda la pantalla de POS asume item.nombre (búsqueda,
// lista, selección); sin esto los resultados de búsqueda volvían del
// servidor bien, pero se veían en blanco -- por eso parecía que la
// búsqueda "no funcionaba" cuando en realidad sí traía datos.
function normalizeCustomer(c: any): Customer {
  return { ...c, nombre: c.nombre || c.nombre_fantasia || c.razon_social || "Sin nombre" }
}

const PUNTOS_EMISION = [
  { id: "001-012", nombre: "Caja 01 · Salón Central (Boca 012)" },
  { id: "001-013", nombre: "Caja 02 · Salón Central (Boca 013)" },
  { id: "001-014", nombre: "Caja 03 · Salón Central (Boca 014)" },
  { id: "001-015", nombre: "Caja 04 · Salón Central (Boca 015)" },
  { id: "001-016", nombre: "Caja 05 · Salón Central (Boca 016)" },
  { id: "001-017", nombre: "Caja 06 · Salón Central (Boca 017)" },
  { id: "001-018", nombre: "Caja 07 · Línea de Caja (Boca 018)" },
  { id: "001-019", nombre: "Caja Especial Mayorista / Administración (Boca 019)" },
  { id: "001-020", nombre: "Caja Auxiliar / Refuerzo (Boca 020)" },
]

// Padrón de Top Productos Verificados de Supermercado Extra
const TOP_CATALOG_SEED: Partial<Product>[] = [
  { id: "seed-1", nombre: "COCA COLA PET 250ML (6)", sku: "118971", codigo_barra: "7840058001887", precio_venta: 3500 as any, stock_minimo: 48, imagen_url: "/uploads/products/118971.jpg" },
  { id: "seed-2", nombre: "COCA COLA PET 1L (4)", sku: "118900", codigo_barra: "7840058009449", precio_venta: 7900 as any, stock_minimo: 36, imagen_url: "/uploads/products/118900.jpg" },
  { id: "seed-3", nombre: "COCA COLA PET 500ML (6)", sku: "6202", codigo_barra: "7840058000019", precio_venta: 6500 as any, stock_minimo: 24, imagen_url: "/uploads/products/6202.jpg" },
  { id: "seed-4", nombre: "COCA COLA ZERO PET 250ML (6)", sku: "118974", codigo_barra: "7840058002556", precio_venta: 3500 as any, stock_minimo: 48, imagen_url: "/uploads/products/118974.jpg" },
  { id: "seed-5", nombre: "FANTA NARANJA PET 250ML (6)", sku: "118895", codigo_barra: "7840058010339", precio_venta: 3500 as any, stock_minimo: 30, imagen_url: "/uploads/products/118895.jpg" },
  { id: "seed-6", nombre: "PAN FRANCES KG", sku: "120257", codigo_barra: "2000098", precio_venta: 10000 as any, stock_minimo: 100, tipo_venta: "peso" as any },
  { id: "seed-7", nombre: "TOMATE SALSA KG", sku: "120178", codigo_barra: "2000077", precio_venta: 11700 as any, stock_minimo: 80, tipo_venta: "peso" as any },
  { id: "seed-8", nombre: "CEBOLLA KG", sku: "120179", codigo_barra: "2000078", precio_venta: 9477 as any, stock_minimo: 95, tipo_venta: "peso" as any, imagen_url: "/uploads/products/120179.jpg" },
  { id: "seed-9", nombre: "BANANA KARAPE KG", sku: "120180", codigo_barra: "2000079", precio_venta: 7200 as any, stock_minimo: 60, tipo_venta: "peso" as any },
  { id: "seed-10", nombre: "PAPA ESPECIAL KG", sku: "120396", codigo_barra: "2000164", precio_venta: 7500 as any, stock_minimo: 120, tipo_venta: "peso" as any },
  { id: "seed-11", nombre: "COAMO ACEITE DE SOJA 900ML (20)", sku: "119293", codigo_barra: "7896279600538", precio_venta: 8750 as any, stock_minimo: 50, imagen_url: "/uploads/products/119293.jpg" },
  { id: "seed-12", nombre: "HUEVO BLANCO C/30", sku: "121082", codigo_barra: "2000341", precio_venta: 17377 as any, stock_minimo: 40 },
  { id: "seed-13", nombre: "LECHE SACHET ULTRA X1LT", sku: "120020", codigo_barra: "7840042000216", precio_venta: 6800 as any, stock_minimo: 72, imagen_url: "/uploads/products/120020.jpg" },
  { id: "seed-14", nombre: "QUESO MUZZARELA B", sku: "122534", codigo_barra: "2000370", precio_venta: 55777 as any, stock_minimo: 35, tipo_venta: "peso" as any, imagen_url: "/uploads/products/122534.jpg" },
  { id: "seed-15", nombre: "ML COSTILLA DE PRIMERA / MATAMBRE KG", sku: "120093", codigo_barra: "2000007", precio_venta: 34777 as any, stock_minimo: 45, tipo_venta: "peso" as any },
  { id: "seed-16", nombre: "ML CARNE MOLIDA DE PRIMERA KG", sku: "120099", codigo_barra: "2000012", precio_venta: 38977 as any, stock_minimo: 50, tipo_venta: "peso" as any },
  { id: "seed-17", nombre: "BENEDICTINO AGUA PET 500ML (12)", sku: "99109", codigo_barra: "7840058008381", precio_venta: 2000 as any, stock_minimo: 60, imagen_url: "/uploads/products/99109.jpg" },
  { id: "seed-18", nombre: "BRAHMITA CERV ULTRA CERO LT 269ML (12)", sku: "120121", codigo_barra: "7840050008655", precio_venta: 2500 as any, stock_minimo: 48, imagen_url: "/uploads/products/120121.jpg" },
  { id: "seed-19", nombre: "GALLETA CUARTEL KG", sku: "120254", codigo_barra: "2000096", precio_venta: 8977 as any, stock_minimo: 30, tipo_venta: "peso" as any },
  { id: "seed-20", nombre: "BOLSA PLASTICA INTERNA", sku: "120594", codigo_barra: "2000265", precio_venta: 500 as any, stock_minimo: 500 },
  { id: "seed-21", nombre: "CHIPA TRADICIONAL", sku: "120264", codigo_barra: "2000101", precio_venta: 30977 as any, stock_minimo: 25, tipo_venta: "peso" as any },
  { id: "seed-22", nombre: "NARANJA KG", sku: "120363", codigo_barra: "2000133", precio_venta: 5200 as any, stock_minimo: 70, tipo_venta: "peso" as any },
  { id: "seed-23", nombre: "LIMÓN TAITI KG", sku: "120290", codigo_barra: "2000106", precio_venta: 4800 as any, stock_minimo: 65, tipo_venta: "peso" as any, imagen_url: "/uploads/products/120290.jpg" },
  { id: "seed-24", nombre: "ZANAHORIA KG", sku: "120289", codigo_barra: "2000105", precio_venta: 12500 as any, stock_minimo: 40, tipo_venta: "peso" as any, imagen_url: "/uploads/products/120289.jpg" }
]

export default function POSPage() {
  const { user, logout } = useAuth()
  const toast = useToast()
  const { dark, toggle: toggleTheme } = useTheme()

  // ── TOKENS DE TEMA REUTILIZABLES PARA TODOS LOS MODALES ────────────────────
  // Antes cada modal tenía el fondo oscuro fijo (bg-slate-900/950) sin
  // importar el switch claro/oscuro -- solo la pantalla principal lo
  // respetaba. Estos tokens se arman una vez acá y se usan en todos los
  // modales para que sean consistentes con el tema elegido.
  const mCard = dark ? "bg-slate-900 text-slate-100" : "bg-white text-slate-900"
  const mInner = dark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"
  const mInnerAlt = dark ? "bg-slate-950/80 border-slate-800" : "bg-slate-50 border-slate-200"
  const mLabel = dark ? "text-slate-400" : "text-slate-500"
  const mMuted = dark ? "text-slate-400" : "text-slate-600"
  const mHeading = dark ? "text-white" : "text-slate-900"
  const mInput = dark ? "bg-slate-950 border-slate-700 text-white placeholder-slate-500" : "bg-white border-slate-300 text-slate-900 placeholder-slate-400"
  const mBtnSecondary = dark ? "bg-slate-800 hover:bg-slate-700 text-slate-300" : "bg-slate-100 hover:bg-slate-200 text-slate-700"
  const mDivide = dark ? "divide-slate-800" : "divide-slate-200"
  const mBorder = dark ? "border-slate-800" : "border-slate-200"

  // ── 1. GESTIÓN DE APERTURA DE CAJA OBLIGATORIA AL INICIAR SESIÓN ───────────
  const userCajaKey = `pos_caja_activa_${user?.id || 'default'}`
  const [cajaAbierta, setCajaAbierta] = useState<boolean>(() => {
    return !!localStorage.getItem(userCajaKey)
  })
  const [puntoEmision, setPuntoEmision] = useState<string>(() => {
    const saved = localStorage.getItem(userCajaKey)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        return parsed.puntoEmision || "001-012"
      } catch (e) {}
    }
    return "001-012"
  })

  // Caja/punto de emisión fijos por máquina física (hostname de Windows,
  // ej. CAJA8) -- antes el cajero podía elegir libremente el punto de
  // emisión cada vez que abría turno, lo que rompía la numeración fiscal
  // por caja. Ahora, si esta máquina tiene una asignación real configurada
  // por un administrador, queda bloqueado a esa caja pase lo que pase.
  const [machineHostname, setMachineHostname] = useState<string | null>(null)
  const [terminalAssignment, setTerminalAssignment] = useState<{ id: string; punto_emision: string; caja_nombre: string } | null>(null)
  const [terminalAssignmentChecked, setTerminalAssignmentChecked] = useState(false)
  const [showAssignTerminalModal, setShowAssignTerminalModal] = useState(false)
  const [assignPuntoEmision, setAssignPuntoEmision] = useState("012")
  const [assignCajaNombre, setAssignCajaNombre] = useState("")
  const [showAperturaModal, setShowAperturaModal] = useState<boolean>(!cajaAbierta)
  const [montoAperturaPyg, setMontoAperturaPyg] = useState<string>("300.000")
  const [montoAperturaBrl, setMontoAperturaBrl] = useState<string>("100")
  const [montoAperturaUsd, setMontoAperturaUsd] = useState<string>("0")
  const [showCierreTurnoModal, setShowCierreTurnoModal] = useState<boolean>(false)

  // ── SESIÓN DE CAJA REAL (backend) -- apertura/cierre a ciegas + cash drop ──
  const [cashSessionId, setCashSessionId] = useState<string | null>(() => {
    const saved = localStorage.getItem(userCajaKey)
    if (saved) {
      try { return JSON.parse(saved).cashSessionId || null } catch (e) {}
    }
    return null
  })
  const [cashRegisterId, setCashRegisterId] = useState<string | null>(null)
  const [submittingApertura, setSubmittingApertura] = useState(false)
  const [montoCierreReal, setMontoCierreReal] = useState<string>("")
  const [submittingCierre, setSubmittingCierre] = useState(false)
  const [cierreResult, setCierreResult] = useState<{ monto_cierre_esperado: number; diferencia: number; requiere_revision: boolean } | null>(null)
  const [showCashDropModal, setShowCashDropModal] = useState(false)
  const [cashDropMonto, setCashDropMonto] = useState<string>("")
  const [cashDropObs, setCashDropObs] = useState<string>("")
  const [submittingCashDrop, setSubmittingCashDrop] = useState(false)

  useEffect(() => {
    api.caja.registers.list()
      .then((regs) => {
        if (!Array.isArray(regs) || regs.length === 0) return
        const normalizado = puntoEmision.replace(/[^0-9]/g, "").replace(/^0+/, "") || puntoEmision
        const match = regs.find((r: any) =>
          r.codigo === puntoEmision ||
          r.codigo?.replace(/[^0-9]/g, "").replace(/^0+/, "") === normalizado
        )
        setCashRegisterId((match || regs[0]).id)
      })
      .catch(() => {})
  }, [puntoEmision])

  // Detecta el hostname real de esta máquina (vía Electron) y busca si un
  // administrador ya la asignó a una caja fija. Si existe, puntoEmision
  // queda bloqueado a ese valor pase lo que pase, sin importar quién
  // inicie sesión como cajero.
  useEffect(() => {
    (async () => {
      try {
        const status = await (window as any).electronAPI?.getStatus?.()
        const hostname = status?.hostname
        if (!hostname) return
        setMachineHostname(hostname)
        const assignment = await api.posTerminals.getByHostname(hostname)
        setTerminalAssignment(assignment)
        setPuntoEmision(`001-${assignment.punto_emision}`)
      } catch (e) {
        // sin asignación todavía -- se maneja en la UI de Apertura de Caja
      } finally {
        setTerminalAssignmentChecked(true)
      }
    })()
  }, [])

  // ── 2. ESTADOS GENERALES Y CATÁLOGO ───────────────────────────────────────
  const [products, setProducts] = useState<Product[]>([])
  const [stockMap, setStockMap] = useState<Record<string, number>>({})
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerSearchResults, setCustomerSearchResults] = useState<Customer[]>([])
  const [searchingCustomers, setSearchingCustomers] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searchingServer, setSearchingServer] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<string>("TOP")
  const [viewMode, setViewMode] = useState<"table" | "cards">("table")

  // ── ESTADOS DE BALANZA BALMAK BCK30 (USB DIRECTO & ELECTRON) ──────────────
  const [currentScaleWeight, setCurrentScaleWeight] = useState<number>(0.000)
  const [isScaleStable, setIsScaleStable] = useState<boolean>(true)
  const [scaleUsbConnected, setScaleUsbConnected] = useState<boolean>(false)
  const [scalePortName, setScalePortName] = useState<string>("COM3")
  const [scaleBaudRate, setScaleBaudRate] = useState<number>(9600)
  const [scaleRawLog, setScaleRawLog] = useState<string>("Balanza lista. Presione Probar Lectura.")
  const [showScaleModal, setShowScaleModal] = useState<boolean>(false)
  
  // Modal reactivo de pesaje con auto-confirmación
  const [showManualWeightModal, setShowManualWeightModal] = useState<boolean>(false)
  const [manualWeightInput, setManualWeightInput] = useState<string>("")
  const [targetWeighProduct, setTargetWeighProduct] = useState<Product | null>(null)

  // ── CONFIGURACIÓN DE ASIGNACIÓN DE POS BANCARD & DINELCO POR CAJA ───────────
  const [showPosConfigModal, setShowPosConfigModal] = useState(false)
  const [posAssignments, setPosAssignments] = useState<Record<string, PosTerminalAssignment>>(() => {
    const saved = localStorage.getItem("pos_terminals_master_mapping")
    if (saved) {
      try { return JSON.parse(saved) } catch (e) {}
    }
    const initial: Record<string, PosTerminalAssignment> = {}
    PUNTOS_EMISION.forEach((pe, idx) => {
      const pad = String(idx + 1).padStart(2, "0")
      initial[pe.id] = {
        puntoEmision: pe.id,
        nombreCaja: pe.nombre,
        bancardTerminalId: `BC-9844${pad}`,
        bancardLote: "001",
        bancardPort: `COM${idx + 4}`,
        dinelcoTerminalId: `DN-8721${pad}`,
        dinelcoLote: "001",
        dinelcoPort: `COM${idx + 7}`,
      }
    })
    return initial
  })

  // Obtener la configuración de la caja actual activa
  const activePosConfig = useMemo(() => {
    return posAssignments[puntoEmision] || {
      puntoEmision,
      nombreCaja: puntoEmision,
      bancardTerminalId: "BC-984401",
      bancardLote: "001",
      bancardPort: "COM4",
      dinelcoTerminalId: "DN-872101",
      dinelcoLote: "001",
      dinelcoPort: "COM7",
    }
  }, [posAssignments, puntoEmision])

  // ── SEGURIDAD Y CONTROL DE SUPERVISOR (PIN) ──────────────────────────────
  const isSupervisorUser = useMemo(() => {
    if (!user) return false
    const r = (user.rol || "").toLowerCase()
    return r === "admin" || r === "gerente" || r === "supervisor" || (user as any).is_superadmin === true
  }, [user])

  const [showSupervisorModal, setShowSupervisorModal] = useState(false)
  const [supervisorPin, setSupervisorPin] = useState("")
  const [supervisorEmail, setSupervisorEmail] = useState("")
  const [supervisorStaffOptions, setSupervisorStaffOptions] = useState<{ id: string; email: string; nombre: string; rol: string }[]>([])
  const [verifyingSupervisor, setVerifyingSupervisor] = useState(false)
  const [supervisorReason, setSupervisorReason] = useState("Error de escaneo / digitación")
  const [pendingSupervisorAction, setPendingSupervisorAction] = useState<{
    type: "remove_item" | "clear_cart" | "decrease_qty" | "open_pos_config" | "process_return" | "assign_terminal"
    itemId?: string
    delta?: number
  } | null>(null)
  const [showRemoteAuthModal, setShowRemoteAuthModal] = useState(false)
  const [remoteAuthRequestId, setRemoteAuthRequestId] = useState<string | null>(null)
  const [remoteAuthStatus, setRemoteAuthStatus] = useState<"pendiente" | "aprobado" | "rechazado">("pendiente")
  const [remoteAuthLocalSupervisorAvailable, setRemoteAuthLocalSupervisorAvailable] = useState(false)

  // Ranking real de productos más vendidos (por sku, viene de reportes reales
  // de ventas) -- la pestaña "TOP"/Frecuentes antes mostraba products.slice(0,30)
  // sin ningún criterio de popularidad real, literalmente "cualquier cosa".
  const [topProductSkus, setTopProductSkus] = useState<string[]>([])

  // ── DEVOLUCIONES DE CLIENTES (con autorización real de supervisor) ────────
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [showDevolucionModal, setShowDevolucionModal] = useState(false)
  const [devolucionStep, setDevolucionStep] = useState<"buscar" | "items">("buscar")
  const [devolucionSales, setDevolucionSales] = useState<Sale[]>([])
  const [devolucionSalesLoading, setDevolucionSalesLoading] = useState(false)
  const [devolucionSearch, setDevolucionSearch] = useState("")
  const [devolucionSaleSeleccionada, setDevolucionSaleSeleccionada] = useState<Sale | null>(null)
  const [devolucionItems, setDevolucionItems] = useState<any[]>([])
  const [devolucionItemsLoading, setDevolucionItemsLoading] = useState(false)
  const [devolucionSeleccion, setDevolucionSeleccion] = useState<Record<string, number>>({})
  const [devolucionMotivo, setDevolucionMotivo] = useState("cliente_insatisfecho")
  const [devolucionCondicion, setDevolucionCondicion] = useState("buen_estado")
  const [devolucionObservaciones, setDevolucionObservaciones] = useState("")
  const [devolucionSubmitting, setDevolucionSubmitting] = useState(false)

  // ── ESTADOS DE CARRITO & CLIENTE ──────────────────────────────────────────
  const [cart, setCart] = useState<CartItem[]>([])
  const [customer, setCustomer] = useState<Customer>(DEFAULT_CUSTOMER)
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [customerSearch, setCustomerSearch] = useState("")
  const [showCreateCustomerForm, setShowCreateCustomerForm] = useState(false)
  const [newCustNombre, setNewCustNombre] = useState("")
  const [newCustRuc, setNewCustRuc] = useState("")
  const [newCustTelefono, setNewCustTelefono] = useState("")
  const [lookupDvSuggested, setLookupDvSuggested] = useState<string | null>(null)
  const [customerHighlight, setCustomerHighlight] = useState(0)

  // Persistidas en localStorage -- antes vivían solo en memoria y una venta
  // pausada se perdía sin aviso ante cualquier recarga (HMR, crash, F5).
  const PAUSED_SALES_KEY = `pos_paused_sales_${COMPANY_ID}`
  const [pausedSales, setPausedSales] = useState<PausedSale[]>(() => {
    try {
      const raw = localStorage.getItem(PAUSED_SALES_KEY)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(PAUSED_SALES_KEY, JSON.stringify(pausedSales))
    } catch {}
  }, [pausedSales])
  const [showPausedModal, setShowPausedModal] = useState(false)
  const [pausedHighlight, setPausedHighlight] = useState(0)

  // ── CONSULTA DE PRECIOS (solo lectura, con escala por cantidad) ────────────
  const [showPriceCheckModal, setShowPriceCheckModal] = useState(false)
  const [priceCheckSearch, setPriceCheckSearch] = useState("")
  const [priceCheckResults, setPriceCheckResults] = useState<Product[]>([])
  const [priceCheckHighlight, setPriceCheckHighlight] = useState(0)
  const [priceCheckSearching, setPriceCheckSearching] = useState(false)
  const [priceCheckSelected, setPriceCheckSelected] = useState<Product | null>(null)
  const [priceCheckTiers, setPriceCheckTiers] = useState<any[]>([])
  const [priceCheckLoadingTiers, setPriceCheckLoadingTiers] = useState(false)
  const [priceCheckStock, setPriceCheckStock] = useState<{ cantidad_total: number; cantidad_reservada: number; cantidad_disponible: number; por_deposito: { nombre: string; cantidad: number }[] } | null>(null)
  const [priceCheckLoadingStock, setPriceCheckLoadingStock] = useState(false)
  const [priceCheckPromo, setPriceCheckPromo] = useState<{ nombre: string; tipo: string; descuento: number; precio_final: number } | null>(null)
  const [priceCheckLoadingPromo, setPriceCheckLoadingPromo] = useState(false)

  // ── MULTIMONEDA & COTIZACIONES ────────────────────────────────────────────
  const [rates, setRates] = useState<CurrencyRates>(() => {
    const saved = localStorage.getItem("pos_currency_rates")
    return saved ? JSON.parse(saved) : { BRL: 1380, USD: 7550 }
  })
  const [showRatesModal, setShowRatesModal] = useState(false)
  const [tempBrl, setTempBrl] = useState(String(rates.BRL))
  const [tempUsd, setTempUsd] = useState(String(rates.USD))

  // ── VISOR DE FOTOGRAFÍA HD EN VIVO ─────────────────────────────────────────
  const [lastScannedProduct, setLastScannedProduct] = useState<Product | null>(null)
  const [lightboxImage, setLightboxImage] = useState<{
    url: string
    nombre: string
    sku: string
    precio: number
  } | null>(null)

  // ── MODALES DE COBRO MULTIMONEDA & PASARELAS POS BANCARD / DINELCO ─────────
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentTab, setPaymentTab] = useState<"cash" | "bancard" | "dinelco" | "qr" | "mixed">("cash")
  
  // Efectivo Multimoneda simultáneo (Guaraníes NUNCA tiene decimales)
  const [payCashPyg, setPayCashPyg] = useState<string>("")
  const [payCashBrl, setPayCashBrl] = useState<string>("")
  const [payCashUsd, setPayCashUsd] = useState<string>("")
  const [hasClickedQuickCash, setHasClickedQuickCash] = useState<boolean>(false)
  const confirmCheckoutBtnRef = useRef<HTMLButtonElement>(null)
  const payCashPygInputRef = useRef<HTMLInputElement>(null)
  const payCashBrlInputRef = useRef<HTMLInputElement>(null)
  const payCashUsdInputRef = useRef<HTMLInputElement>(null)
  const mixedCashPygInputRef = useRef<HTMLInputElement>(null)
  const mixedCashBrlInputRef = useRef<HTMLInputElement>(null)
  const mixedCardPygInputRef = useRef<HTMLInputElement>(null)
  const mixedQrPygInputRef = useRef<HTMLInputElement>(null)

  // Tarjetas POS Bancard & Dinelco vinculadas a la caja activa
  const [posTerminalId, setPosTerminalId] = useState(activePosConfig.bancardTerminalId)
  const [posCardType, setPosCardType] = useState<"debito" | "credito">("debito")
  const [posCardLote, setPosCardLote] = useState(activePosConfig.bancardLote)
  const [posCardCupon, setPosCardCupon] = useState("")
  const [posCardLast4, setPosCardLast4] = useState("")
  const [posCardMontoPyg, setPosCardMontoPyg] = useState("")

  // Dinelco POS vinculada a la caja activa
  const [dinelcoTerminalId, setDinelcoTerminalId] = useState(activePosConfig.dinelcoTerminalId)
  const [dinelcoCardType, setDinelcoCardType] = useState<"debito" | "credito" | "social">("debito")
  const [dinelcoLote, setDinelcoLote] = useState(activePosConfig.dinelcoLote)
  const [dinelcoCupon, setDinelcoCupon] = useState("")
  const [dinelcoMontoPyg, setDinelcoMontoPyg] = useState("")

  // Verificación real contra la maquinita física (Bancard/Dinelco) -- busca
  // en la transacción real que la terminal ya registró en su propia red,
  // en vez de confiar en que el cajero tipee bien el lote/cupón a mano.
  const [posVerifyStatus, setPosVerifyStatus] = useState<"idle" | "searching" | "found" | "multiple" | "none">("idle")
  const [posVerifyCandidates, setPosVerifyCandidates] = useState<{ id: string; fecha: string; tarjeta_marca: string; monto: number; voucher: string; cajero: string }[]>([])
  const [posVerifiedTxn, setPosVerifiedTxn] = useState<{ id: string; fecha: string; tarjeta_marca: string; monto: number; voucher: string; cajero: string } | null>(null)
  const [posVerifyOpenedAt, setPosVerifyOpenedAt] = useState<string | null>(null)

  // Sincronizar terminales cuando cambia la caja
  useEffect(() => {
    setPosTerminalId(activePosConfig.bancardTerminalId)
    setPosCardLote(activePosConfig.bancardLote)
    setDinelcoTerminalId(activePosConfig.dinelcoTerminalId)
    setDinelcoLote(activePosConfig.dinelcoLote)
  }, [activePosConfig])

  // Cobro Mixto
  const [mixedCashPyg, setMixedCashPyg] = useState("")
  const [mixedCashBrl, setMixedCashBrl] = useState("")
  const [mixedCardPyg, setMixedCardPyg] = useState("")
  const [mixedQrPyg, setMixedQrPyg] = useState("")

  const [showLostDemandModal, setShowLostDemandModal] = useState(false)
  const [lostDemandCliente, setLostDemandCliente] = useState("")
  const [lostDemandTelefono, setLostDemandTelefono] = useState("")
  const [lostDemandRows, setLostDemandRows] = useState<{ producto: string; motivo: string }[]>([{ producto: "", motivo: "sin_stock" }])

  const [submitting, setSubmitting] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // ── CARGA INICIAL DE CATÁLOGO Y CLIENTES ──────────────────────────────────
  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const [prodData, custData, whData, staffData, topData, stockData] = await Promise.allSettled([
          // limit=1500 se quedaba corto -- esta empresa tiene 11.370
          // productos reales y el recorte no garantiza ningun orden de
          // popularidad, asi que productos comunes (ej. gaseosas) quedaban
          // afuera del catalogo cargado y el POS caia al respaldo con IDs
          // falsos (seed-N) para esos casos, rompiendo el guardado de la
          // venta. Se pide el catalogo completo con margen.
          api.products.list({ limit: 15000 }),
          api.customers.list({ limit: 300 }),
          api.warehouses.list(),
          api.auth.posAuthorizers(),
          api.reports.salesByProduct({ limit: 100 }),
          api.inventory.getStockMap(),
        ])

        if (prodData.status === "fulfilled") {
          const validProds = (prodData.value || []).filter(
            (p: any) => p && p.nombre && p.nombre.trim() !== "..."
          )
          const combined = [...validProds, ...TOP_CATALOG_SEED as Product[]]
          const map = new Map<string, Product>()
          for (const item of combined) {
            if (item.sku && !map.has(item.sku)) {
              map.set(item.sku, item)
            }
          }
          setProducts(Array.from(map.values()))
        }

        if (custData.status === "fulfilled") {
          setCustomers((custData.value || []).map(normalizeCustomer))
        }

        if (whData.status === "fulfilled") {
          setWarehouses((whData.value || []).filter((w: any) => w.activo !== false))
        }

        if (staffData.status === "fulfilled") {
          setSupervisorStaffOptions(staffData.value?.staff || [])
        }

        if (topData.status === "fulfilled") {
          setTopProductSkus((topData.value || []).map((r: any) => r.sku).filter(Boolean))
        }

        if (stockData.status === "fulfilled") {
          setStockMap(stockData.value || {})
        }
      } catch (err: any) {
        toast.error("Error al sincronizar datos", err.message)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Búsqueda remota de productos con debounce
  useEffect(() => {
    if (!search || search.trim().length < 2) {
      setSearchResults([])
      setSearchingServer(false)
      return
    }

    const timer = setTimeout(async () => {
      setSearchingServer(true)
      try {
        const res = await api.products.list({ search: search.trim(), limit: 40 })
        setSearchResults(res || [])
      } catch (e) {
      } finally {
        setSearchingServer(false)
      }
    }, 200)

    return () => clearTimeout(timer)
  }, [search])

  // Búsqueda remota de productos para Consulta de Precios, con debounce
  useEffect(() => {
    if (!showPriceCheckModal) return
    const query = priceCheckSearch.trim()
    if (query.length < 2) {
      setPriceCheckResults([])
      setPriceCheckSearching(false)
      return
    }

    const timer = setTimeout(async () => {
      setPriceCheckSearching(true)
      try {
        const res = await api.products.list({ search: query, limit: 30 })
        setPriceCheckResults(res || [])
        setPriceCheckHighlight(0)
      } catch (e) {
      } finally {
        setPriceCheckSearching(false)
      }
    }, 200)

    return () => clearTimeout(timer)
  }, [priceCheckSearch, showPriceCheckModal])

  // Búsqueda remota y en vivo de Clientes (F9) con debounce y consulta RUC
  useEffect(() => {
    if (!showCustomerModal) return

    const query = customerSearch.trim()
    if (!query) {
      setCustomerSearchResults([])
      setSearchingCustomers(false)
      return
    }

    const timer = setTimeout(async () => {
      setSearchingCustomers(true)
      try {
        const res = await api.customers.list({ search: query, limit: 30 })
        setCustomerSearchResults((res || []).map(normalizeCustomer))

        // Si es número de cédula o RUC, intentar consultar el padrón
        const digits = query.replace(/\D/g, "")
        if (digits.length >= 5) {
          try {
            const rucRes = await api.customers.lookupRuc(digits)
            if (rucRes && rucRes.nombre) {
              setCustomerSearchResults(prev => {
                if (prev.some(c => c.ruc === rucRes.ruc || c.ci === rucRes.ci)) return prev
                return [
                  {
                    id: `lookup-${rucRes.ruc}`,
                    nombre: rucRes.nombre,
                    razon_social: rucRes.razon_social,
                    ruc: rucRes.ruc,
                    ci: rucRes.ci,
                    telefono: rucRes.telefono,
                    email: rucRes.email,
                    activo: true,
                  } as Customer,
                  ...prev
                ]
              })
            }
          } catch (e) {}
        }
      } catch (e) {
      } finally {
        setSearchingCustomers(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [customerSearch, showCustomerModal])

  // Autocompletado de RUC y cálculo de DV en alta rápida de clientes
  useEffect(() => {
    const digits = newCustRuc.replace(/\D/g, "")
    if (digits.length >= 5) {
      const dv = calculateRucDv(digits)
      setLookupDvSuggested(`${digits}-${dv}`)

      // Consulta de autocompletado de nombre si no ha sido escrito
      const timer = setTimeout(async () => {
        try {
          const res = await api.customers.lookupRuc(digits)
          if (res && res.nombre && !newCustNombre) {
            setNewCustNombre(res.nombre)
            if (res.telefono && !newCustTelefono) setNewCustTelefono(res.telefono)
          }
        } catch (e) {}
      }, 300)
      return () => clearTimeout(timer)
    } else {
      setLookupDvSuggested(null)
    }
  }, [newCustRuc])

  // ── SUSCRIPCIÓN EN TIEMPO REAL A BALANZA BALMAK EN ELECTRON ───────────────
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).electronAPI) {
      const apiObj = (window as any).electronAPI

      const unsubscribe = apiObj.onScaleWeight?.((data: { weight?: number; weight_kg?: number; isStable?: boolean; stable?: boolean; port?: string; raw?: string }) => {
        const w = typeof data.weight_kg === "number" ? data.weight_kg : typeof data.weight === "number" ? data.weight : null
        if (w !== null && !isNaN(w)) {
          setCurrentScaleWeight(w)
          const isSt = data.stable !== undefined ? data.stable : data.isStable !== false
          setIsScaleStable(isSt)
          setScaleUsbConnected(true)
          if (data.port) setScalePortName(data.port)
          if (data.raw) setScaleRawLog(prev => `[${new Date().toLocaleTimeString()}] ${data.port}: RAW=${data.raw} => ${w.toFixed(3)} KG\n${prev}`.substring(0, 1000))
        }
      })

      const unsubStatus = apiObj.onScaleStatus?.((data: { connected: boolean; port?: string }) => {
        if (data.port) {
          setScalePortName(data.port)
          setScaleUsbConnected(true)
          setScaleRawLog(prev => `[${new Date().toLocaleTimeString()}] Puerto conectado: ${data.port}\n${prev}`.substring(0, 1000))
        }
      })

      const unsubLog = apiObj.onScaleLog?.((msg: string) => {
        setScaleRawLog(prev => `[${new Date().toLocaleTimeString()}] ${msg}\n${prev}`.substring(0, 1000))
      })

      return () => {
        if (typeof unsubscribe === "function") unsubscribe()
        if (typeof unsubStatus === "function") unsubStatus()
        if (typeof unsubLog === "function") unsubLog()
      }
    }
  }, [])

  // ── CARGAR AUTOMÁTICAMENTE CONFIGURACIÓN FISCAL Y PLANTILLA DE TICKET DE LA DB ─
  useEffect(() => {
    async function loadCompanyDataAndTemplate() {
      try {
        const comps = await api.companies.list()
        if (Array.isArray(comps) && comps.length > 0) {
          const c = comps[0]
          const fantasia = c.nombre_fantasia || c.nombre || "Extra Supermercado Mayorista"
          const merged = { ...c, nombre: fantasia, nombre_fantasia: fantasia }
          localStorage.setItem("pos_company_data", JSON.stringify(merged))
          if ((c.config as any)?.receipt_template) {
            localStorage.setItem("pos_receipt_template_config", JSON.stringify((c.config as any).receipt_template))
          }
          if ((c.config as any)?.currencies) {
            const currs = (c.config as any).currencies
            const brl = Number(currs.BRL?.venta || currs.BRL || 1380)
            const usd = Number(currs.USD?.venta || currs.USD || 7550)
            setRates({ BRL: brl, USD: usd })
            localStorage.setItem("pos_currency_rates", JSON.stringify({ BRL: brl, USD: usd }))
          }

          // Precachear el logo como data URL una sola vez al abrir el POS,
          // en vez de volver a bajarlo por red en cada venta -- eso era la
          // causa del delay de varios segundos entre cobrar e imprimir.
          const logoUrl = c.logo_url || (c.config as any)?.receipt_template?.logo_url
          if (logoUrl && !logoUrl.startsWith("data:") && !localStorage.getItem("pos_logo_data_url")) {
            try {
              const targetUrl = logoUrl.startsWith("http") ? logoUrl : `${window.location.origin}${logoUrl}`
              const res = await fetch(targetUrl)
              const blob = await res.blob()
              const dataUrl = await new Promise<string>((resolve) => {
                const reader = new FileReader()
                reader.onloadend = () => resolve(reader.result as string)
                reader.onerror = () => resolve("")
                reader.readAsDataURL(blob)
              })
              if (dataUrl) localStorage.setItem("pos_logo_data_url", dataUrl)
            } catch (e) {}
          }

          // Igual que el logo: precachear el QR del club como data URL una
          // sola vez, en vez de depender de una carga de imagen por red en
          // el momento exacto de imprimir (podía no llegar a tiempo).
          const tplCfg = (c.config as any)?.receipt_template
          if (tplCfg?.mostrar_qr_club && tplCfg?.qr_url_club && !localStorage.getItem("pos_qr_club_data_url")) {
            try {
              const qrRes = await fetch(`${API_ORIGIN}/api/v1/receipts/qr?data=${encodeURIComponent(tplCfg.qr_url_club)}&size=140`)
              const qrBlob = await qrRes.blob()
              const qrDataUrl = await new Promise<string>((resolve) => {
                const reader = new FileReader()
                reader.onloadend = () => resolve(reader.result as string)
                reader.onerror = () => resolve("")
                reader.readAsDataURL(qrBlob)
              })
              if (qrDataUrl) localStorage.setItem("pos_qr_club_data_url", qrDataUrl)
            } catch (e) {}
          }
        }
      } catch (e) {
        console.warn("No se pudo sincronizar datos de empresa con la API:", e)
      }
    }
    loadCompanyDataAndTemplate()
  }, [])

  // ── AGREGAR AL CARRITO ────────────────────────────────────────────────────
  const addToCart = useCallback((product: Product, quantityOverride?: number) => {
    setLastScannedProduct(product)

    const isPesable = (product as any).tipo_venta === "peso" ||
                      (product as any).es_pesable === true ||
                      (product.nombre || "").toUpperCase().includes(" KG") ||
                      (product.nombre || "").toUpperCase().includes("KILO")

    let finalQty = 1
    if (quantityOverride !== undefined) {
      finalQty = quantityOverride
    } else if (isPesable) {
      if (currentScaleWeight > 0.015) {
        finalQty = currentScaleWeight
      } else {
        setTargetWeighProduct(product)
        setManualWeightInput("")
        setShowManualWeightModal(true)
        return
      }
    }

    const unitPrice = Number(product.precio_venta) || 0
    const ivaTasa = Number(product.iva_tasa) || 10

    if (isPesable) {
      // Cada pesaje es una pieza física distinta (ej. dos cortes de carne del
      // mismo producto con pesos distintos): siempre se agrega como línea
      // nueva, nunca se sobreescribe un pesaje anterior del mismo producto.
      setCart((prev) => [
        {
          id: `${product.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          product_id: product.id,
          nombre: product.nombre,
          precio: unitPrice,
          precio_base: unitPrice,
          sku: product.sku || "",
          codigo_barra: product.codigo_barra,
          imagen_url: product.imagen_url,
          quantity: finalQty,
          iva_tasa: ivaTasa,
          es_pesable: true,
          origen_balanza: "balmak_bck30"
        },
        ...prev,
      ])
      setSearch("")
      searchInputRef.current?.focus()
      return
    }

    // No pesable: se suma a la línea existente del mismo producto, y se
    // recalcula el precio unitario contra la escala de precios por cantidad.
    const existingItem = cart.find((item) => item.product_id === product.id && !item.es_pesable)
    const newQty = existingItem ? existingItem.quantity + finalQty : finalQty

    setCart((prev) => {
      const existingIdx = prev.findIndex((item) => item.product_id === product.id && !item.es_pesable)
      if (existingIdx >= 0) {
        const copy = [...prev]
        copy[existingIdx] = { ...copy[existingIdx], quantity: newQty }
        return copy
      }

      return [
        {
          id: product.id,
          product_id: product.id,
          nombre: product.nombre,
          precio: unitPrice,
          precio_base: unitPrice,
          sku: product.sku || "",
          codigo_barra: product.codigo_barra,
          imagen_url: product.imagen_url,
          quantity: newQty,
          iva_tasa: ivaTasa,
          es_pesable: false,
          origen_balanza: null
        },
        ...prev,
      ]
    })

    setSearch("")
    searchInputRef.current?.focus()
    applyTieredPrice(product.id, newQty)
  }, [currentScaleWeight, cart])

  // ── ESCALA DE PRECIOS POR CANTIDAD (sp_tiered_prices) ──────────────────────
  // Recalcula el precio unitario de la línea no pesable de `productId` contra
  // los escalones cargados en Smart Pricing. Si no hay escalón para la
  // cantidad actual (ya sea por debajo del mínimo, o la API no encuentra
  // nada), vuelve al precio base del producto -- nunca se queda con un precio
  // de escalón que ya no corresponde a la cantidad real.
  const applyTieredPrice = useCallback(async (productId: string, quantity: number) => {
    try {
      const tier = await api.smartPricing.calculateTieredPrice(productId, Math.floor(quantity))
      const tierPrice = tier && typeof tier.precio_unitario !== "undefined" ? Number(tier.precio_unitario) : null
      setCart((prev) => prev.map((item) =>
        item.product_id === productId && !item.es_pesable
          ? { ...item, precio: tierPrice !== null && !isNaN(tierPrice) ? tierPrice : item.precio_base }
          : item
      ))
    } catch (e) {
      setCart((prev) => prev.map((item) =>
        item.product_id === productId && !item.es_pesable
          ? { ...item, precio: item.precio_base }
          : item
      ))
    }
  }, [])

  // Iniciar/asegurar flujo de lectura serie continuo al abrir el modal de pesaje
  useEffect(() => {
    if (showManualWeightModal) {
      if ((window as any).electronAPI?.startScaleStream) {
        (window as any).electronAPI.startScaleStream(scalePortName, scaleBaudRate || 9600)
      }
    }
  }, [showManualWeightModal, scalePortName, scaleBaudRate])

  // ── AUTO-CONFIRMACIÓN INMEDIATA DEL PESAJE AL ESTABILIZAR EL PESO ─────────
  useEffect(() => {
    if (showManualWeightModal && targetWeighProduct && currentScaleWeight > 0.015 && isScaleStable) {
      const autoTimer = setTimeout(() => {
        addToCart(targetWeighProduct, currentScaleWeight)
        setShowManualWeightModal(false)
        const prodName = targetWeighProduct.nombre
        const weightVal = currentScaleWeight.toFixed(3)
        setTargetWeighProduct(null)
        setManualWeightInput("")
        toast.success("Pesaje Balmak Confirmado", `${prodName}: ${weightVal} KG insertado.`)
      }, 350)
      return () => clearTimeout(autoTimer)
    }
  }, [showManualWeightModal, targetWeighProduct, currentScaleWeight, isScaleStable, addToCart])

  const handleConfirmManualWeight = () => {
    if (!targetWeighProduct) return
    const w = parseFloat(manualWeightInput.replace(/,/g, "."))
    if (!isNaN(w) && w > 0) {
      addToCart(targetWeighProduct, w)
      setShowManualWeightModal(false)
      setTargetWeighProduct(null)
      setManualWeightInput("")
    } else {
      toast.warning("Peso Inválido", "Coloque el producto en la balanza o ingrese un peso mayor a 0 (ej: 0.455).")
    }
  }

  // ── APERTURA Y CIERRE DE TURNO (sesión real en el backend) ───────────────
  const buildTicketPrelude = (titulo: string) => {
    let companyData: any = {}
    try {
      const saved = localStorage.getItem("pos_company_data")
      if (saved) companyData = JSON.parse(saved)
    } catch (e) {}
    const fantasia = companyData.nombre_fantasia || companyData.nombre || "Extra Supermercado Mayorista"
    const logoUrl = localStorage.getItem("pos_logo_data_url") || ""
    return `
      <div style="font-family: 'Consolas','Segoe UI',monospace; font-size: 10.5px; line-height: 1.3; width: 100%; color: #000;">
        <div style="text-align: center; margin-bottom: 6px;">
          ${logoUrl ? `<img src="${logoUrl}" style="max-width: 140px; display: block; margin: 0 auto 4px auto;" />` : ""}
          <div style="font-weight: 900; font-size: 12px;">${fantasia}</div>
          <div style="font-weight: 900; font-size: 11px; margin-top: 4px; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 3px 0;">${titulo}</div>
        </div>
    `
  }

  const printTicketHtml = async (bodyHtml: string) => {
    const tpl = JSON.parse(localStorage.getItem("pos_receipt_template_config") || "{}")
    const paperWidthMm = parseInt(String(tpl.ancho_papel || "80mm").replace(/\D/g, ""), 10) || 80
    if ((window as any).electronAPI?.printReceipt) {
      await (window as any).electronAPI.printReceipt(bodyHtml, paperWidthMm)
    }
  }

  const handleConfirmAperturaCaja = async (e: React.FormEvent) => {
    e.preventDefault()
    const fondoPyg = parseInt(montoAperturaPyg.replace(/\D/g, "") || "0", 10)
    setSubmittingApertura(true)
    try {
      const session = await api.caja.sessions.create({
        cash_register_id: cashRegisterId || undefined,
        user_id: user?.id,
        cajero_nombre: user?.nombre || "Cajero",
        monto_apertura: fondoPyg,
      })
      const registro = {
        puntoEmision,
        cajeroId: user?.id,
        cajeroNombre: user?.nombre || "Cajero",
        fechaApertura: new Date().toISOString(),
        fondoPyg,
        fondoBrl: parseFloat(montoAperturaBrl.replace(/,/g, ".") || "0"),
        fondoUsd: parseFloat(montoAperturaUsd.replace(/,/g, ".") || "0"),
        cashSessionId: session.id,
      }
      localStorage.setItem(userCajaKey, JSON.stringify(registro))
      setCashSessionId(session.id)
      setCajaAbierta(true)
      setShowAperturaModal(false)
      toast.success(
        "¡Caja Habilitada con Éxito!",
        `${PUNTOS_EMISION.find(p => p.id === puntoEmision)?.nombre || puntoEmision} abierta para operar.`
      )
    } catch (err) {
      toast.error("No se pudo abrir la caja", "Verifique la conexión con el servidor e intente de nuevo.")
    } finally {
      setSubmittingApertura(false)
    }
  }

  // Cierre a ciegas: el cajero solo carga lo que contó físicamente. El
  // sistema recién revela el esperado y la diferencia DESPUÉS de enviar --
  // nunca antes, para que el conteo no esté sesgado por el número esperado.
  const handleConfirmCierreCaja = async () => {
    if (!cashSessionId) {
      toast.warning("No hay sesión de caja activa", "")
      return
    }
    const contado = parseInt(montoCierreReal.replace(/\D/g, "") || "0", 10)
    setSubmittingCierre(true)
    try {
      const result = await api.caja.sessions.close(cashSessionId, { monto_cierre_real: contado })
      setCierreResult({
        monto_cierre_esperado: result.monto_cierre_esperado,
        diferencia: result.diferencia,
        requiere_revision: result.requiere_revision,
      })

      const diferencia = result.diferencia || 0
      const body = buildTicketPrelude("CIERRE DE CAJA") + `
        <div style="padding: 4px 0; font-size: 10px;">
          <div>Cajero: ${user?.nombre || "-"}</div>
          <div>Caja: ${PUNTOS_EMISION.find(p => p.id === puntoEmision)?.nombre || puntoEmision}</div>
          <div>Fecha/Hora: ${new Date().toLocaleString("es-PY")}</div>
        </div>
        <table style="width:100%; border-collapse:collapse; border-top:1px dashed #000; margin-top:4px; padding-top:4px; font-size:10px;">
          <tr><td>Fondo de apertura:</td><td style="text-align:right;">${formatPYG(parseInt(montoAperturaPyg.replace(/\D/g,"")||"0",10))}</td></tr>
          <tr><td>Efectivo esperado (sistema):</td><td style="text-align:right;">${formatPYG(result.monto_cierre_esperado)}</td></tr>
          <tr><td>Efectivo contado (real):</td><td style="text-align:right;">${formatPYG(contado)}</td></tr>
          <tr style="font-weight:900; border-top:1px dashed #000;"><td>Diferencia:</td><td style="text-align:right;">${diferencia >= 0 ? "+" : ""}${formatPYG(diferencia)}</td></tr>
        </table>
        ${result.requiere_revision ? `<div style="text-align:center; font-weight:900; margin-top:6px; border:1px dashed #000; padding:4px;">⚠ DIFERENCIA FUERA DE TOLERANCIA -- REQUIERE REVISIÓN</div>` : ""}
        <div style="text-align:center; margin-top:10px; font-size:9px;">Firma cajero: ______________________</div>
        <br/><br/>
      </div>`
      await printTicketHtml(body)

      localStorage.removeItem(userCajaKey)
      setCashSessionId(null)
      setCajaAbierta(false)
      setShowCierreTurnoModal(false)
      setMontoCierreReal("")
      toast.info("Turno de Caja Cerrado", result.requiere_revision ? "Cierre registrado con diferencia fuera de tolerancia." : "Cierre registrado sin novedades.")
      setShowAperturaModal(true)
    } catch (err) {
      toast.error("No se pudo cerrar la caja", "Verifique la conexión con el servidor e intente de nuevo.")
    } finally {
      setSubmittingCierre(false)
    }
  }

  const handleConfirmCashDrop = async () => {
    if (!cashSessionId) {
      toast.warning("No hay sesión de caja activa", "")
      return
    }
    const monto = parseInt(cashDropMonto.replace(/\D/g, "") || "0", 10)
    if (monto <= 0) {
      toast.warning("Monto inválido", "Ingrese un monto mayor a 0.")
      return
    }
    setSubmittingCashDrop(true)
    try {
      await api.caja.cashDrop(cashSessionId, { monto, observaciones: cashDropObs.trim() || undefined })
      const body = buildTicketPrelude("RETIRO DE EFECTIVO (CASH DROP)") + `
        <div style="padding: 4px 0; font-size: 10px;">
          <div>Cajero: ${user?.nombre || "-"}</div>
          <div>Fecha/Hora: ${new Date().toLocaleString("es-PY")}</div>
          <div style="font-weight:900; font-size:13px; margin-top:6px;">Monto retirado: ${formatPYG(monto)}</div>
          ${cashDropObs.trim() ? `<div style="margin-top:4px;">Obs: ${cashDropObs.trim()}</div>` : ""}
        </div>
        <div style="text-align:center; margin-top:10px; font-size:9px;">Firma cajero: ______________________</div>
        <br/><br/>
      </div>`
      await printTicketHtml(body)
      toast.success("Retiro registrado", `${formatPYG(monto)} retirados de la caja.`)
      setShowCashDropModal(false)
      setCashDropMonto("")
      setCashDropObs("")
    } catch (err) {
      toast.error("No se pudo registrar el retiro", "Verifique que la sesión de caja siga abierta.")
    } finally {
      setSubmittingCashDrop(false)
    }
  }

  const handleOpenCalculator = async () => {
    if ((window as any).electronAPI?.openCalculator) {
      await (window as any).electronAPI.openCalculator()
    } else {
      window.open("https://www.google.com/search?q=calculator", "_blank")
    }
  }

  // ── REIMPRESIÓN DE VENTAS YA EMITIDAS ──────────────────────────────────────
  const [showReimprimirModal, setShowReimprimirModal] = useState(false)
  const [reimprimirTab, setReimprimirTab] = useState<"ventas" | "devoluciones">("ventas")
  const [reimprimirSales, setReimprimirSales] = useState<Sale[]>([])
  const [reimprimirReturns, setReimprimirReturns] = useState<any[]>([])
  const [reimprimirLoading, setReimprimirLoading] = useState(false)
  const [reimprimirError, setReimprimirError] = useState("")

  const fetchReimprimirReturns = async () => {
    setReimprimirLoading(true)
    setReimprimirError("")
    try {
      const rets = await api.returns.list({ estado: "aprobado" } as any)
      setReimprimirReturns(Array.isArray(rets) ? rets : [])
    } catch (e) {
      setReimprimirError("No se pudo cargar el historial de devoluciones.")
    } finally {
      setReimprimirLoading(false)
    }
  }

  const openReimprimirModal = async () => {
    setShowReimprimirModal(true)
    setReimprimirTab("ventas")
    setReimprimirLoading(true)
    setReimprimirError("")
    try {
      // Acotado a la sesión de caja actual (este cajero, turno todavía no
      // rendido) -- no la lista completa de la empresa. Al cerrar caja la
      // sesión cambia, así que las ventas ya rendidas dejan de aparecer acá.
      // Si esa consulta acotada no trae nada (sesión recién abierta, o
      // ventas viejas de antes de que existiera este seguimiento), se cae
      // a las últimas de la empresa en vez de dejar la lista vacía.
      let sales = cashSessionId
        ? await api.sales.list({ session_id: cashSessionId } as any)
        : (user?.id ? await api.sales.list({ user_id: user.id } as any) : [])
      if (!Array.isArray(sales) || sales.length === 0) {
        sales = await api.sales.list()
      }
      setReimprimirSales(Array.isArray(sales) ? sales : [])
    } catch (e) {
      setReimprimirError("No se pudo cargar el historial de ventas.")
    } finally {
      setReimprimirLoading(false)
    }
  }

  const handleReimprimirSale = async (sale: Sale) => {
    // Reimprime exactamente el mismo ticket ESC/POS que salió por la
    // impresora térmica en el momento del cobro (guardado en
    // recibo_escpos_b64) -- el mismo camino directo a la impresora, no el
    // HTML por Chromium. recibo_html queda solo como respaldo/lectura para
    // ventas viejas, de antes de que existiera el ESC/POS guardado.
    try {
      if (sale.recibo_escpos_b64 && (window as any).electronAPI?.printEscPos) {
        const tpl = JSON.parse(localStorage.getItem("pos_receipt_template_config") || "{}")
        const result = await (window as any).electronAPI.printEscPos(sale.recibo_escpos_b64, tpl.nombre_impresora_windows || "ZKP8008")
        if (!result?.success) {
          toast.warning("No se pudo reimprimir", result?.error || "Revise la impresora.")
          return
        }
      } else if (sale.recibo_html) {
        await printTicketHtml(sale.recibo_html)
      } else {
        toast.warning("Sin recibo guardado", "Esta venta es anterior a la función de reimpresión y no tiene el ticket original guardado.")
        return
      }
      toast.success("Reimpreso", `Comprobante Nº ${sale.numero || sale.id.slice(0, 8)} enviado a la impresora.`)
    } catch (e) {
      toast.warning("No se pudo reimprimir", "Verifique la impresora.")
    }
  }

  const handleReimprimirDevolucion = async (ret: { id: string }) => {
    // A diferencia de la venta (que reimprime bytes ya guardados), la NC se
    // reconstruye desde los mismos datos persistidos (ítems + número de NC
    // ya reservado) -- no había ningún ESC/POS guardado, así que se genera
    // de nuevo con el mismo formato, marcado como reimpresión.
    try {
      const full = await api.returns.get(ret.id)
      if (!full?.nota_credito_numero) {
        toast.warning("Sin Nota de Crédito", "Esta devolución no tiene una NC generada para reimprimir.")
        return
      }
      await printNotaCreditoTicket(
        { numero: full.numero, nota_credito_numero: full.nota_credito_numero },
        (full.items || []).map((it: any) => ({ descripcion: it.descripcion || it.product_name, cantidad: Number(it.cantidad), precio_unitario: Number(it.precio_unitario) })),
        full.sale_numero ? { numero: full.sale_numero } : null,
        "(ver registro original)",
        true,
      )
      toast.success("Reimpreso", `NC ${full.nota_credito_numero} enviada a la impresora.`)
    } catch (e: any) {
      toast.warning("No se pudo reimprimir", e?.message || "Verifique la impresora.")
    }
  }

  // ── PRODUCTOS FALTANTES (DEMANDA PERDIDA) -> COMPRAS ────────────────────────
  // El backend y el cliente API ya existian (api.purchases.lostDemand),
  // usado desde la pantalla de Compras -- lo que faltaba era el modal en el
  // POS de Electron: existia el estado, el atajo F4 y el disparador al
  // escanear un codigo que no esta en catalogo, pero nunca se renderizaba
  // nada ni se mandaba al backend.
  const [submittingLostDemand, setSubmittingLostDemand] = useState(false)

  const lostDemandAddRow = () => setLostDemandRows(prev => [...prev, { producto: "", motivo: "sin_stock" }])
  const lostDemandRemoveRow = (idx: number) => setLostDemandRows(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev)
  const lostDemandUpdateRow = (idx: number, field: "producto" | "motivo", value: string) =>
    setLostDemandRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))

  const handleSubmitLostDemand = async () => {
    const filas = lostDemandRows.filter(r => r.producto.trim())
    if (filas.length === 0) {
      toast.warning("Falta el producto", "Escriba al menos un producto que buscaba el cliente.")
      return
    }
    setSubmittingLostDemand(true)
    try {
      await Promise.all(filas.map(fila =>
        api.purchases.lostDemand.create({
          producto_nombre: fila.producto.trim(),
          notas: `Motivo: ${fila.motivo}`,
          cliente_nombre: lostDemandCliente.trim() || undefined,
          cliente_contacto: lostDemandTelefono.trim() || undefined,
          cajero_nombre: user?.nombre,
          caja_id: puntoEmision,
        })
      ))
      toast.success("Registrado", `Se avisó a Compras sobre ${filas.length} producto${filas.length > 1 ? "s" : ""} faltante${filas.length > 1 ? "s" : ""}.`)
      setShowLostDemandModal(false)
      setLostDemandCliente("")
      setLostDemandTelefono("")
      setLostDemandRows([{ producto: "", motivo: "sin_stock" }])
    } catch (e) {
      toast.error("No se pudo registrar", "Intente nuevamente en unos segundos.")
    } finally {
      setSubmittingLostDemand(false)
    }
  }

  // ── FILTROS DE CATEGORÍAS COMPLETOS ───────────────────────────────────────
  const CATEGORY_TABS = [
    { key: "TOP", label: "⭐ Frecuentes" },
    { key: "PESABLES", label: "⚖️ Pesables (Balanza)" },
    { key: "CARNICERIA", label: "🥩 Carnicería" },
    { key: "PANADERIA", label: "🥖 Panadería & Rotisería" },
    { key: "VERDULERIA", label: "🥬 Frutas & Verduras" },
    { key: "BEBIDAS", label: "🥤 Bebidas & Cervezas" },
    { key: "LACTEOS", label: "🧀 Lácteos & Fiambres" },
    { key: "ALMACEN", label: "🥫 Almacén" },
    { key: "LIMPIEZA", label: "🧼 Limpieza & Perfumería" },
  ]

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase()
    
    if (query) {
      const tokens = query.split(/\s+/).filter(Boolean)
      const pool = new Map<string, Product>()
      for (const p of [...searchResults, ...products]) {
        if (p && p.id && !pool.has(p.id)) {
          pool.set(p.id, p)
        }
      }

      return Array.from(pool.values()).filter((p) => {
        const target = `${p.nombre || ""} ${p.codigo_barra || ""} ${p.sku || ""}`.toLowerCase()
        return tokens.every((token) => target.includes(token))
      }).slice(0, 45)
    }

    if (selectedCategoryTab === "TOP") {
      if (topProductSkus.length > 0 && products.length > 0) {
        const bySku = new Map(products.map((p) => [p.sku, p]))
        const ranked = topProductSkus.map((sku) => bySku.get(sku)).filter(Boolean) as Product[]
        if (ranked.length > 0) return ranked.slice(0, 30)
      }
      return (products.length > 0 ? products : TOP_CATALOG_SEED as Product[]).slice(0, 30)
    }

    if (selectedCategoryTab === "PESABLES") {
      return products.filter((p: any) => 
        p.tipo_venta === "peso" || 
        p.es_pesable || 
        (p.nombre || "").toUpperCase().includes("KG") ||
        (p.nombre || "").toUpperCase().includes("KILO")
      ).slice(0, 35)
    }

    // A partir de aca, filtro por la categoria REAL del producto
    // (categoria.nombre, la que ya carga y mantiene el catalogo), no por
    // palabras sueltas adivinadas del nombre -- eso traia cualquier cosa
    // (en Carnicería aparecía cualquier producto salvo carne, en Panadería
    // cualquier cosa salvo pan) porque el nombre de un producto no dice de
    // forma confiable a que rubro pertenece.
    const catMatch = (p: Product, keywords: string[]) => {
      const cat = escposStripAccents((p as any).categoria?.nombre || "").toUpperCase()
      return cat.length > 0 && keywords.some((k) => cat.includes(k))
    }

    // Categorías grandes (Almacén tiene 3000+ productos, Limpieza 1600+) no
    // entran enteras en pantalla ni conviene renderizar todo de una vez --
    // se corta en CATEGORY_TILE_LIMIT, pero ordenado por lo más vendido
    // (mismo ranking real de "Frecuentes"), no en cualquier orden. Así lo
    // que se corta es lo menos relevante, no una selección arbitraria.
    const topRankIndex = new Map(topProductSkus.map((sku, idx) => [sku, idx]))
    const rankSlice = (list: Product[], limit: number) => {
      if (topRankIndex.size === 0) return list.slice(0, limit)
      const sorted = [...list].sort((a, b) => {
        const ra = topRankIndex.has(a.sku) ? topRankIndex.get(a.sku)! : Infinity
        const rb = topRankIndex.has(b.sku) ? topRankIndex.get(b.sku)! : Infinity
        return ra - rb
      })
      return sorted.slice(0, limit)
    }
    const CATEGORY_TILE_LIMIT = 150

    if (selectedCategoryTab === "CARNICERIA") {
      return rankSlice(products.filter((p) => catMatch(p, ["CARNE", "CARNICERIA", "POLLO", "PESCADO", "TILAPIA", "CAMARON"])), CATEGORY_TILE_LIMIT)
    }

    if (selectedCategoryTab === "PANADERIA") {
      return rankSlice(products.filter((p) => catMatch(p, ["PANIFIC", "PANADER", "REPOSTER", "HORNEAD", "MASAS"])), CATEGORY_TILE_LIMIT)
    }

    if (selectedCategoryTab === "VERDULERIA") {
      return rankSlice(products.filter((p) => catMatch(p, ["VERDU", "FRUTA", "LEGUMBRE", "FLV"])), CATEGORY_TILE_LIMIT)
    }

    if (selectedCategoryTab === "BEBIDAS") {
      return rankSlice(products.filter((p) => catMatch(p, ["ALCOHOL", "BEBIDA", "GASEOSA"])), CATEGORY_TILE_LIMIT)
    }

    if (selectedCategoryTab === "LACTEOS") {
      return rankSlice(products.filter((p) => catMatch(p, ["LECHE", "LACTEO", "DERIVADO", "MANTECA", "EMBUTIDO", "FIAMBRE", "CUAJADA"])), CATEGORY_TILE_LIMIT)
    }

    if (selectedCategoryTab === "ALMACEN") {
      return rankSlice(products.filter((p) => catMatch(p, [
        "ALIMENTOS", "FIDEOS", "CONDIMENTOS", "ADEREZOS", "CONSERVADOS", "ARROZ", "AZUCAR",
        "HARINAS", "ACEITES", "CEREALES", "COMESTIBLES", "ALMACEN", "ABARROTES", "YERBA",
        "INFUSIONES", "GALLETITA", "DULCES", "SNACKS", "PASTAS",
      ])), CATEGORY_TILE_LIMIT)
    }

    if (selectedCategoryTab === "LIMPIEZA") {
      return rankSlice(products.filter((p) => catMatch(p, [
        "LIMPIEZA", "JABON", "DESODORANTE", "DENTAL", "CAPILAR", "CORPORAL", "FEMENINO",
        "PERFUMERIA", "HIGIENE", "PIEL", "PAÑAL", "PANAL", "BETUN", "PLAGAS",
      ])), CATEGORY_TILE_LIMIT)
    }

    return products.slice(0, 30)
  }, [search, selectedCategoryTab, products, searchResults, topProductSkus])

  // ── ESCANEO DIRECTO Y DECODIFICACIÓN DE BALANZAS DE GÓNDOLA (EAN-13 PREFIJO 2) ─
  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = search.trim()
    if (!code) return

    // 1. DECODIFICACIÓN AUTOMÁTICA DE CÓDIGOS DE BALANZA DE GÓNDOLA (EAN-13 PREFIJO 2)
    if (code.length === 13 && code.startsWith("2")) {
      const pluCandidate = code.substring(0, 7)
      const weightGrams = parseInt(code.substring(7, 12), 10)
      if (weightGrams > 0) {
        const weightKg = weightGrams / 1000
        const matchPesable = products.find(p => p.codigo_barra === pluCandidate || p.sku === pluCandidate || p.codigo_barra?.startsWith(pluCandidate))
        if (matchPesable) {
          addToCart(matchPesable, weightKg)
          setSearch("")
          searchInputRef.current?.focus()
          toast.success("Balanza de Sección", `${matchPesable.nombre}: ${weightKg.toFixed(3)} KG leídos de etiqueta.`)
          return
        }
      }
    }

    // 2. Coincidencia exacta en memoria local
    const localMatch = products.find(
      (p) => p.codigo_barra === code || p.sku === code || p.codigo_barra?.endsWith(code) || (p.codigo_barra && code.endsWith(p.codigo_barra))
    )

    if (localMatch) {
      addToCart(localMatch)
      setSearch("")
      searchInputRef.current?.focus()
      return
    }

    // 3. Consulta inmediata al backend por código de barras
    try {
      const serverRes = await api.products.list({ search: code, limit: 10 })
      if (serverRes && serverRes.length > 0) {
        const best = serverRes.find((p) => p.codigo_barra === code || p.sku === code) || serverRes[0]
        addToCart(best)
        setSearch("")
        searchInputRef.current?.focus()
        return
      }
    } catch (err) {}

    // 4. Si hay un único resultado en la lista filtrada
    if (filteredProducts.length === 1) {
      addToCart(filteredProducts[0])
      setSearch("")
      searchInputRef.current?.focus()
      return
    }

    // 5. Si no existe, abrir modal de faltante
    toast.warning("Producto no encontrado", `Código ${code} no está en catálogo.`)
    setLostDemandRows([{ producto: code, motivo: "sin_stock" }])
    setShowLostDemandModal(true)
  }

  // ── CONTROL DE SEGURIDAD PARA ANULACIONES Y AJUSTES DE POS (SUPERVISOR PIN) ──
  // Ademas del PIN (sin cambios, a proposito), ahora se exige que exista un
  // supervisor con turno realmente iniciado en el sistema -- si nadie con
  // rol supervisor marco su entrada, no se ofrece ni la posibilidad de
  // autorizar, sin importar que alguien sepa un PIN.
  const describeSupervisorAction = (action: { type: string, itemId?: string }): string => {
    switch (action.type) {
      case "remove_item": {
        const it = cart.find((i) => i.id === action.itemId)
        return `Anular ítem del carrito: ${it?.nombre || "producto"}`
      }
      case "decrease_qty": {
        const it = cart.find((i) => i.id === action.itemId)
        return `Reducir cantidad: ${it?.nombre || "producto"}`
      }
      case "clear_cart":
        return `Vaciar carrito completo (${cart.length} ítems, ${formatPYG(totalPyg)})`
      case "process_return":
        return `Aprobar devolución de venta ${devolucionSaleSeleccionada?.numero || ""} (${formatPYG(devolucionItems.reduce((s, it) => s + (devolucionSeleccion[it.id] || 0) * it.precio_unitario, 0))})`
      case "open_pos_config":
        return "Abrir configuración de terminales POS"
      case "assign_terminal":
        return `Asignar esta caja (${machineHostname || "terminal"}) a un punto de emisión`
      default:
        return "Autorización de supervisor"
    }
  }

  const executeApprovedRemoteAction = async (action: any, resolverId: string, resolverNombre: string) => {
    if (action.type === "process_return") {
      await submitDevolucion(resolverId, resolverNombre)
    } else if (action.type === "assign_terminal") {
      await submitAssignTerminal()
    } else {
      executeSupervisorAction(action)
    }
  }

  const requestSupervisorAuthorization = async (action: { type: "remove_item" | "clear_cart" | "decrease_qty" | "open_pos_config" | "process_return" | "assign_terminal", itemId?: string, delta?: number }) => {
    if (isSupervisorUser) {
      if (action.type === "process_return") {
        await submitDevolucion(user!.id, user?.nombre || "Supervisor")
      } else if (action.type === "assign_terminal") {
        await submitAssignTerminal()
      } else {
        executeSupervisorAction(action)
      }
      return
    }

    // "Turno activo" ya no significa "hay alguien parado en esta caja" --
    // desde que existe la PWA, un supervisor puede tener turno activo
    // logueada solo en su celular. Antes ESO hacía que se saltee la alerta
    // remota y se pidiera clave local (que nunca nadie tipeaba, porque el
    // supervisor no estaba ahí). Ahora la solicitud remota SIEMPRE se manda
    // -- si además hay alguien con turno activo, se ofrece el atajo de
    // clave local como alternativa más rápida, no como el único camino.
    let localSupervisorAvailable = false
    try {
      const res = await api.auth.activeSupervisor()
      localSupervisorAvailable = !!res?.has_supervisor
    } catch (e) {
      toast.error("No se pudo verificar al supervisor", "Intente nuevamente.")
      return
    }

    setPendingSupervisorAction(action)
    setRemoteAuthLocalSupervisorAvailable(localSupervisorAvailable)
    try {
      const created = await api.supervisorRequests.create({
        tipo: action.type,
        descripcion: describeSupervisorAction(action),
        cajero_id: user?.id,
        cajero_nombre: user?.nombre,
        caja_nombre: terminalAssignment?.caja_nombre || machineHostname || undefined,
      })
      setRemoteAuthRequestId(created.id)
      setRemoteAuthStatus("pendiente")
      setShowRemoteAuthModal(true)
    } catch (e: any) {
      toast.error("No se pudo enviar la solicitud", e?.message || "Intente nuevamente.")
    }
  }

  // Espera en vivo la resolución de la solicitud remota -- sondea cada 3s
  // mientras el modal está abierto.
  useEffect(() => {
    if (!showRemoteAuthModal || !remoteAuthRequestId) return
    const poll = async () => {
      try {
        const req = await api.supervisorRequests.get(remoteAuthRequestId)
        if (req.estado === "aprobado") {
          setRemoteAuthStatus("aprobado")
          setShowRemoteAuthModal(false)
          if (pendingSupervisorAction) {
            await executeApprovedRemoteAction(pendingSupervisorAction, req.resuelto_por || "", req.resuelto_por_nombre || "Supervisor")
          }
          toast.success("Autorización Aprobada", `Aprobado por ${req.resuelto_por_nombre || "supervisor"} desde su celular.`)
        } else if (req.estado === "rechazado") {
          setRemoteAuthStatus("rechazado")
          setShowRemoteAuthModal(false)
          toast.warning("Autorización Rechazada", `${req.resuelto_por_nombre || "El supervisor"} rechazó la solicitud.`)
        }
      } catch (e) {}
    }
    const interval = setInterval(poll, 3000)
    return () => clearInterval(interval)
  }, [showRemoteAuthModal, remoteAuthRequestId, pendingSupervisorAction])

  const executeSupervisorAction = (action: { type: "remove_item" | "clear_cart" | "decrease_qty" | "open_pos_config" | "process_return" | "assign_terminal", itemId?: string, delta?: number }) => {
    if (action.type === "remove_item" && action.itemId) {
      const itemToDelete = cart.find(i => i.id === action.itemId)
      setCart((prev) => prev.filter((i) => i.id !== action.itemId))
      toast.info("Ítem Anulado", `${itemToDelete?.nombre || 'Producto'} eliminado de la venta.`)
    } else if (action.type === "clear_cart") {
      setCart([])
      setCustomer(DEFAULT_CUSTOMER)
      toast.warning("Venta Cancelada", "Se anularon todos los productos del ticket.")
    } else if (action.type === "decrease_qty" && action.itemId && action.delta) {
      const itemBefore = cart.find((i) => i.id === action.itemId)
      setCart((prev) =>
        prev
          .map((item) => {
            if (item.id === action.itemId) {
              const next = item.quantity + (action.delta || 0)
              return next > 0 ? { ...item, quantity: parseFloat(next.toFixed(3)) } : null
            }
            return item
          })
          .filter(Boolean) as CartItem[]
      )
      if (itemBefore && !itemBefore.es_pesable) {
        const nextQty = itemBefore.quantity + (action.delta || 0)
        if (nextQty > 0) applyTieredPrice(itemBefore.product_id, nextQty)
      }
    } else if (action.type === "open_pos_config") {
      setShowPosConfigModal(true)
    }
  }

  // Verifica email + contraseña reales de un usuario con rol supervisor/admin
  // contra el backend (POST /auth/verify-supervisor) -- antes esto era un PIN
  // hardcodeado que aceptaba cualquier texto de 4+ caracteres, sin conexión
  // real al sistema. Cualquier cajero podía "autorizarse a sí mismo".
  const handleConfirmSupervisorPin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supervisorEmail || !supervisorPin) {
      toast.warning("Datos incompletos", "Seleccione el supervisor e ingrese su contraseña.")
      return
    }
    setVerifyingSupervisor(true)
    try {
      const res = await api.auth.verifySupervisor({ email: supervisorEmail, password: supervisorPin })
      if (!res?.valid) {
        toast.warning("Autorización Rechazada", "Contraseña incorrecta o la cuenta no tiene nivel de supervisor.")
        return
      }
      setShowSupervisorModal(false)
      if (pendingSupervisorAction) {
        if (pendingSupervisorAction.type === "process_return") {
          await submitDevolucion(res.id!, res.nombre || "Supervisor")
        } else if (pendingSupervisorAction.type === "assign_terminal") {
          await submitAssignTerminal()
        } else {
          executeSupervisorAction(pendingSupervisorAction)
        }
      }
      toast.success("Autorización Exitosa", `Acción aprobada por ${res.nombre} (${supervisorReason}).`)
      setPendingSupervisorAction(null)
      setSupervisorPin("")
      setSupervisorEmail("")
    } catch (err) {
      toast.error("No se pudo verificar al supervisor", "Intente nuevamente.")
    } finally {
      setVerifyingSupervisor(false)
    }
  }

  // ── DEVOLUCIONES DE CLIENTES ────────────────────────────────────────────
  // Flujo completo contra el backend real (misma tabla `returns` que usa
  // el ERP): buscar la venta original, elegir items+cantidad a devolver,
  // autorización real de supervisor, crear la devolución y aprobarla en el
  // mismo paso (el supervisor presente ES la aprobación) -- impacta stock
  // de inmediato y queda visible en el menú de Devoluciones del sistema.
  const openDevolucionModal = async () => {
    setShowDevolucionModal(true)
    setDevolucionStep("buscar")
    setDevolucionSaleSeleccionada(null)
    setDevolucionItems([])
    setDevolucionSeleccion({})
    setDevolucionSearch("")
    setDevolucionMotivo("cliente_insatisfecho")
    setDevolucionCondicion("buen_estado")
    setDevolucionObservaciones("")
    setDevolucionSalesLoading(true)
    try {
      let sales = cashSessionId
        ? await api.sales.list({ session_id: cashSessionId } as any)
        : (user?.id ? await api.sales.list({ user_id: user.id } as any) : [])
      if (!Array.isArray(sales) || sales.length === 0) {
        sales = await api.sales.list()
      }
      setDevolucionSales(Array.isArray(sales) ? sales : [])
    } catch (e) {
      toast.error("No se pudo cargar el historial de ventas", "Intente nuevamente.")
    } finally {
      setDevolucionSalesLoading(false)
    }
  }

  const closeDevolucionModal = () => {
    setShowDevolucionModal(false)
    setDevolucionStep("buscar")
    setDevolucionSaleSeleccionada(null)
    setDevolucionItems([])
    setDevolucionSeleccion({})
    setDevolucionSearch("")
    setDevolucionObservaciones("")
  }

  const handleSelectVentaDevolucion = async (sale: Sale) => {
    setDevolucionSaleSeleccionada(sale)
    setDevolucionStep("items")
    setDevolucionItemsLoading(true)
    try {
      const items = await api.sales.items(sale.id)
      const enriched = (items || []).map((it: any) => ({
        ...it,
        productName: products.find((p) => p.id === it.product_id)?.nombre || it.descripcion || "Producto",
      }))
      setDevolucionItems(enriched)
      setDevolucionSeleccion({})
    } catch (e) {
      toast.error("No se pudieron cargar los ítems de la venta", "Intente nuevamente.")
    } finally {
      setDevolucionItemsLoading(false)
    }
  }

  const toggleDevolucionItem = (itemId: string, maxQty: number) => {
    setDevolucionSeleccion((prev) => {
      const next = { ...prev }
      if (next[itemId]) {
        delete next[itemId]
      } else {
        next[itemId] = maxQty
      }
      return next
    })
  }

  const setDevolucionCantidad = (itemId: string, qty: number, maxQty: number) => {
    const clamped = Math.max(0, Math.min(maxQty, qty))
    setDevolucionSeleccion((prev) => ({ ...prev, [itemId]: clamped }))
  }

  const submitDevolucion = async (aprobadoPorId: string, aprobadoPorNombre: string) => {
    if (!devolucionSaleSeleccionada) return
    const itemsToReturn = devolucionItems
      .filter((it) => (devolucionSeleccion[it.id] || 0) > 0)
      .map((it) => ({
        sale_item_id: it.id,
        product_id: it.product_id,
        descripcion: it.productName,
        cantidad: devolucionSeleccion[it.id],
        precio_unitario: it.precio_unitario,
        iva_tasa: it.iva_tasa,
        motivo_detalle: devolucionObservaciones || undefined,
        condicion: devolucionCondicion,
      }))
    if (itemsToReturn.length === 0) {
      toast.warning("Sin ítems seleccionados", "Elija al menos un producto a devolver.")
      return
    }
    setDevolucionSubmitting(true)
    try {
      const created = await api.returns.create({
        company_id: COMPANY_ID,
        sale_id: devolucionSaleSeleccionada.id,
        customer_id: (devolucionSaleSeleccionada as any).customer_id || undefined,
        motivo: devolucionMotivo,
        observaciones: devolucionObservaciones || undefined,
        warehouse_id: warehouses[0]?.id,
        user_id: user?.id,
        items: itemsToReturn,
      } as any)
      const approved = await api.returns.approve(created.id, aprobadoPorId)

      if (approved?.nota_credito_numero) {
        toast.success("Devolución Registrada", `NC ${approved.nota_credito_numero} aprobada por ${aprobadoPorNombre}. Imprimiendo...`)
        try {
          await printNotaCreditoTicket(approved, itemsToReturn, devolucionSaleSeleccionada, aprobadoPorNombre)
        } catch (printErr: any) {
          toast.warning("NC generada, no se pudo imprimir", printErr?.message || "Reimprima desde el historial de devoluciones.")
        }
      } else {
        // La devolución quedó registrada igual (stock repuesto) pero sin
        // numeración fiscal real -- pasa si el punto de emisión de esa caja
        // todavía no tiene rango de NC asignado en Configuración.
        toast.warning(
          "Devolución registrada SIN Nota de Crédito",
          approved?.nota_credito_error || "Falta asignar numeración de NC para este punto de emisión en Configuración → Cajas."
        )
      }
      closeDevolucionModal()
    } catch (err: any) {
      toast.error("No se pudo registrar la devolución", err?.message || "Intente nuevamente.")
    } finally {
      setDevolucionSubmitting(false)
    }
  }

  // Ticket ESC/POS real de la Nota de Crédito -- mismo mecanismo crudo que
  // ya usa el cobro (electronAPI.printEscPos), pero un documento propio:
  // antes la devolución no imprimía nada porque no existía ningún
  // comprobante que imprimir.
  const printNotaCreditoTicket = async (
    approved: { numero?: string; nota_credito_numero?: string | null; fecha?: string },
    items: { descripcion?: string; cantidad: number; precio_unitario: number }[],
    saleOriginal: { numero?: string | null } | null | undefined,
    aprobadoPorNombre: string,
    isReprint = false,
  ) => {
    if (!(window as any).electronAPI?.printEscPos) return

    const fmtGs = (val: number | string | null | undefined): string => {
      const n = typeof val === "number" ? val : parseFloat(String(val ?? 0)) || 0
      return Math.round(n).toLocaleString("es-PY")
    }

    let companyData: any = {}
    try {
      const comps = await api.companies.list()
      if (Array.isArray(comps) && comps.length > 0) companyData = comps[0]
    } catch (e) {}

    const fantasia = companyData.nombre_fantasia || companyData.nombre || "Extra Supermercado Mayorista"
    const razon = companyData.razon_social || "GRUPO SANTA TERESA E.A.S."
    const rucEmpresa = companyData.ruc || "80150377-9"
    const tpl = JSON.parse(localStorage.getItem("pos_receipt_template_config") || "{}")

    // Mismo logo cacheado que ya usa el ticket de venta (localStorage
    // pos_logo_data_url) -- la NC no tenía logo porque nunca llamaba a
    // este mismo camino de resolución.
    const showLogo = tpl.mostrar_logo !== false && (companyData.logo_url || tpl.logo_url)
    const rawLogoUrl = companyData.logo_url || tpl.logo_url || ""
    let logoUrl = localStorage.getItem("pos_logo_data_url") || ""
    if (showLogo && !logoUrl && rawLogoUrl) {
      logoUrl = rawLogoUrl.startsWith("http") ? rawLogoUrl : `${API_ORIGIN}${rawLogoUrl}`
    }

    const W = ESCPOS_LINE_WIDTH
    let t = ESCPOS_INIT
    t += ESCPOS_ALIGN_CENTER

    let logoImpreso = false
    if (showLogo && logoUrl) {
      try {
        const logoCmd = await escposLogoFromDataUrl(logoUrl)
        if (logoCmd) { t += logoCmd + '\n'; logoImpreso = true }
      } catch (e) {}
    }

    if (!logoImpreso) t += ESCPOS_BOLD_ON + escposStripAccents(fantasia) + '\n' + ESCPOS_BOLD_OFF
    t += escposStripAccents(razon) + '\n'
    t += `RUC: ${escposStripAccents(rucEmpresa)}\n`
    t += escposDashes(W) + '\n'
    t += ESCPOS_DOUBLE_ON + ESCPOS_BOLD_ON + 'NOTA DE CREDITO' + ESCPOS_DOUBLE_OFF + ESCPOS_BOLD_OFF + '\n'
    if (isReprint) t += ESCPOS_BOLD_ON + '*** REIMPRESION ***' + ESCPOS_BOLD_OFF + '\n'
    t += ESCPOS_ALIGN_LEFT
    t += ESCPOS_BOLD_ON + `NC No: ${approved.nota_credito_numero}` + ESCPOS_BOLD_OFF + '\n'
    t += `Devolucion No: ${approved.numero || ''}\n`
    t += `Fecha/Hora: ${new Date().toLocaleString("es-PY")}\n`
    // Referencia a la factura que se devuelve -- destacada en su propio
    // recuadro, no una línea más entre las demás, porque es el dato que
    // vincula legalmente la NC a la factura original.
    if (saleOriginal?.numero) {
      t += escposDashes(W) + '\n'
      t += ESCPOS_BOLD_ON + `Refiere a Factura Nro: ${escposStripAccents(saleOriginal.numero)}` + ESCPOS_BOLD_OFF + '\n'
      t += escposDashes(W) + '\n'
    }
    t += `Autorizado por: ${escposStripAccents(aprobadoPorNombre)}\n`
    t += `Cajero: ${escposStripAccents(user?.nombre || '')} (${puntoEmision})\n`
    t += escposDashes(W) + '\n'
    t += escposTwoCol('Descripcion', 'Monto', W) + '\n'
    t += escposDashes(W) + '\n'

    let subtotal = 0
    for (const it of items) {
      const lineTotal = it.cantidad * it.precio_unitario
      subtotal += lineTotal
      t += escposTwoCol(escposStripAccents(it.descripcion || 'Producto'), fmtGs(lineTotal)) + '\n'
      t += `  ${it.cantidad} x ${fmtGs(it.precio_unitario)}\n`
    }

    t += escposDashes(W) + '\n'
    t += ESCPOS_BOLD_ON + ESCPOS_DOUBLE_ON + escposTwoCol('TOTAL NC:', fmtGs(subtotal), 24) + ESCPOS_DOUBLE_OFF + ESCPOS_BOLD_OFF + '\n'
    t += escposDashes(W) + '\n'
    t += ESCPOS_ALIGN_CENTER
    t += 'Documento autoimpresor\n'
    t += 'Valido como comprobante de devolucion\n'

    // Corte automático: 4 saltos de línea antes de la cuchilla (pedido
    // explícito) y GS V 1 (corte parcial), mismo comando que ya usa el
    // ticket de venta.
    t += '\n'.repeat(4)
    t += GS + 'V' + '\x01'

    await (window as any).electronAPI.printEscPos(escposToBase64(t), tpl.nombre_impresora_windows || "ZKP8008")
  }

  const devolucionSalesFiltradas = useMemo(() => {
    const q = devolucionSearch.trim().toLowerCase()
    if (!q) return devolucionSales
    return devolucionSales.filter((s) => (s.numero || "").toLowerCase().includes(q))
  }, [devolucionSales, devolucionSearch])

  const updateQuantity = (id: string, delta: number) => {
    if (delta < 0) {
      requestSupervisorAuthorization({ type: "decrease_qty", itemId: id, delta })
    } else {
      setCart((prev) =>
        prev.map((item) => {
          if (item.id === id) {
            const next = item.quantity + delta
            return { ...item, quantity: parseFloat(next.toFixed(3)) }
          }
          return item
        })
      )
      const item = cart.find((i) => i.id === id)
      if (item && !item.es_pesable) {
        applyTieredPrice(item.product_id, item.quantity + delta)
      }
    }
  }

  const removeFromCart = (id: string) => {
    requestSupervisorAuthorization({ type: "remove_item", itemId: id })
  }

  const clearCart = () => {
    if (cart.length === 0) return
    requestSupervisorAuthorization({ type: "clear_cart" })
  }

  const pauseCurrentSale = () => {
    if (cart.length === 0) return
    const newPaused: PausedSale = {
      id: `p-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" }),
      customer,
      items: [...cart],
      total: totalPyg,
    }
    setPausedSales((prev) => [newPaused, ...prev])
    setCart([])
    setCustomer(DEFAULT_CUSTOMER)
    toast.info("Venta en Espera", "La venta fue pausada exitosamente.")
  }

  const resumePausedSale = (paused: PausedSale) => {
    setCart(paused.items)
    setCustomer(paused.customer)
    setPausedSales((prev) => prev.filter((p) => p.id !== paused.id))
    setShowPausedModal(false)
    toast.success("Venta Recuperada", `Restaurados ${paused.items.length} ítems.`)
  }

  const discardPausedSale = (id: string) => {
    setPausedSales((prev) => prev.filter((p) => p.id !== id))
    setPausedHighlight((i) => Math.max(0, i - 1))
    toast.info("Venta Descartada", "Se eliminó de la lista de ventas en espera.")
  }

  const handlePausedModalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setPausedHighlight((i) => Math.min(i + 1, pausedSales.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setPausedHighlight((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const p = pausedSales[pausedHighlight]
      if (p) resumePausedSale(p)
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault()
      const p = pausedSales[pausedHighlight]
      if (p) discardPausedSale(p.id)
    }
  }

  // ── GESTIÓN Y CREACIÓN RÁPIDA DE CLIENTES (F9) CON RUC AUTOCALCULADO ────────
  const combinedCustomerList = useMemo(() => {
    const list = customerSearch.trim() && customerSearchResults.length > 0
      ? customerSearchResults
      : customers

    const query = customerSearch.trim().toLowerCase()
    if (!query) return list

    return list.filter(c => 
      c.nombre?.toLowerCase().includes(query) || 
      c.ruc?.toLowerCase().includes(query) ||
      c.ci?.includes(query) ||
      (c.razon_social && c.razon_social.toLowerCase().includes(query))
    )
  }, [customerSearch, customerSearchResults, customers])

  // El índice 0 siempre es "Consumidor Final"; 1..N son los resultados de
  // combinedCustomerList -- se resetea cada vez que cambia la búsqueda para
  // no dejar seleccionado un resultado que ya no está en la lista.
  useEffect(() => {
    setCustomerHighlight(0)
  }, [customerSearch, showCustomerModal])

  useEffect(() => {
    if (showPausedModal) setPausedHighlight(0)
  }, [showPausedModal])

  const handleCustomerSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const maxIndex = Math.min(combinedCustomerList.length, 20)
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setCustomerHighlight((i) => Math.min(i + 1, maxIndex))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setCustomerHighlight((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (customerHighlight === 0) {
        setCustomer(DEFAULT_CUSTOMER)
        setShowCustomerModal(false)
        toast.info("Cliente", "Asignado Consumidor Final.")
      } else {
        const c = combinedCustomerList[customerHighlight - 1]
        if (c) handleSelectCustomer(c)
      }
    }
  }

  const handleCreateQuickCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCustNombre.trim()) {
      toast.warning("Nombre Requerido", "Ingrese el nombre o razón social del cliente.")
      return
    }

    const finalRuc = lookupDvSuggested || newCustRuc.trim() || undefined

    try {
      const createdRaw = await api.customers.create({
        nombre: newCustNombre.trim(),
        razon_social: newCustNombre.trim(),
        ruc: finalRuc,
        ci: newCustRuc.replace(/\D/g, "") || undefined,
        telefono: newCustTelefono.trim() || undefined,
        activo: true,
      } as any)
      const created = createdRaw ? normalizeCustomer(createdRaw) : createdRaw

      if (created) {
        setCustomers(prev => [created, ...prev])
        setCustomer(created)
        setShowCreateCustomerForm(false)
        setShowCustomerModal(false)
        setNewCustNombre("")
        setNewCustRuc("")
        setNewCustTelefono("")
        toast.success("Cliente Creado", `${created.nombre} asignado a la venta actual.`)
      }
    } catch (err: any) {
      toast.error("Error al crear cliente", err.message)
    }
  }

  const [asignandoCliente, setAsignandoCliente] = useState(false)

  // Un resultado del padrón (consulta RUC/CI externa) no es todavía un
  // cliente real en la base -- se le pone un id "lookup-..." temporal solo
  // para mostrarlo en la lista. Si se manda tal cual en una venta, el
  // backend lo rechaza (no es un UUID) y la venta queda sin guardar. Antes
  // de asignarlo hay que crearlo de verdad y usar el cliente real (con UUID)
  // que devuelve el servidor.
  const handleSelectCustomer = async (c: Customer) => {
    if (!String(c.id).startsWith("lookup-")) {
      setCustomer(c)
      setShowCustomerModal(false)
      toast.success("Cliente Asignado", `${c.nombre} (${c.ruc || c.ci || 'CI'})`)
      return
    }
    setAsignandoCliente(true)
    try {
      const createdRaw = await api.customers.create({
        nombre: c.nombre,
        razon_social: c.razon_social || c.nombre,
        ruc: c.ruc || undefined,
        ci: c.ci || undefined,
        telefono: c.telefono || undefined,
        email: (c as any).email || undefined,
        activo: true,
      } as any)
      const created = normalizeCustomer(createdRaw)
      setCustomers(prev => [created, ...prev])
      setCustomer(created)
      setShowCustomerModal(false)
      toast.success("Cliente Creado y Asignado", `${created.nombre} (${created.ruc || created.ci || 'CI'})`)
    } catch (err: any) {
      toast.error("No se pudo registrar el cliente del padrón", err.message)
    } finally {
      setAsignandoCliente(false)
    }
  }

  const handlePriceCheckSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setPriceCheckHighlight((i) => Math.min(i + 1, priceCheckResults.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setPriceCheckHighlight((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const p = priceCheckResults[priceCheckHighlight]
      if (p) handlePriceCheckSelect(p)
    }
  }

  const handlePriceCheckSelect = async (p: Product) => {
    setPriceCheckSelected(p)
    setPriceCheckTiers([])
    setPriceCheckStock(null)
    setPriceCheckPromo(null)
    setPriceCheckLoadingTiers(true)
    setPriceCheckLoadingStock(true)
    setPriceCheckLoadingPromo(true)

    api.smartPricing.listTieredPrices(COMPANY_ID, p.id)
      .then((tiers) => setPriceCheckTiers((tiers || []).slice().sort((a: any, b: any) => (a.min_qty || 0) - (b.min_qty || 0))))
      .catch(() => {})
      .finally(() => setPriceCheckLoadingTiers(false))

    api.inventory.getProductStock(p.id)
      .then((res) => setPriceCheckStock(res))
      .catch(() => {})
      .finally(() => setPriceCheckLoadingStock(false))

    api.promotions.calculate({
      items: [{ producto_id: p.id, categoria_id: p.categoria_id || undefined, cantidad: 1, precio_unitario: Number(p.precio_venta) || 0 }],
    })
      .then((res) => {
        const promo = res?.applicable_promotions?.[0]
        if (promo) {
          setPriceCheckPromo({
            nombre: promo.nombre,
            tipo: promo.tipo,
            descuento: promo.descuento,
            precio_final: Math.max(0, (Number(p.precio_venta) || 0) - promo.descuento),
          })
        }
      })
      .catch(() => {})
      .finally(() => setPriceCheckLoadingPromo(false))
  }

  const closePriceCheckModal = () => {
    setShowPriceCheckModal(false)
    setPriceCheckSearch("")
    setPriceCheckResults([])
    setPriceCheckSelected(null)
    setPriceCheckTiers([])
    setPriceCheckStock(null)
    setPriceCheckPromo(null)
  }

  // ── GUARDADO DE ASIGNACIONES DE TERMINALES POS (BANCARD & DINELCO) ────────
  const handleSavePosAssignments = (e: React.FormEvent) => {
    e.preventDefault()
    localStorage.setItem("pos_terminals_master_mapping", JSON.stringify(posAssignments))
    setShowPosConfigModal(false)
    toast.success("Configuración Guardada", "Se actualizaron las terminales POS asignadas a las cajas.")
  }

  // ── CÁLCULOS DE TOTALES Y MULTIMONEDA ──────────────────────────────────────
  const { totalPyg, totalBrl, totalUsd, gravada10Pyg, gravada5Pyg, exentaPyg, iva10Pyg, iva5Pyg } = useMemo(() => {
    let totPyg = 0
    let g10 = 0
    let g5 = 0
    let ex = 0

    for (const item of cart) {
      const lineTotal = item.precio * item.quantity
      totPyg += lineTotal

      if (item.iva_tasa === 10) {
        g10 += lineTotal
      } else if (item.iva_tasa === 5) {
        g5 += lineTotal
      } else {
        ex += lineTotal
      }
    }

    const iv10 = Math.round(g10 / 11)
    const iv5 = Math.round(g5 / 21)

    const totBrl = rates.BRL > 0 ? (totPyg / rates.BRL).toFixed(2) : "0.00"
    const totUsd = rates.USD > 0 ? (totPyg / rates.USD).toFixed(2) : "0.00"

    return {
      totalPyg: Math.round(totPyg),
      totalBrl: totBrl,
      totalUsd: totUsd,
      gravada10Pyg: Math.round(g10),
      gravada5Pyg: Math.round(g5),
      exentaPyg: Math.round(ex),
      iva10Pyg: Math.round(iv10),
      iva5Pyg: Math.round(iv5),
    }
  }, [cart, rates])

  // Cálculos dinámicos de vuelto multimoneda en el modal de cobro (SIN CÉNTIMOS EN PYG)
  const { totalRecibidoPyg, saldoRestantePyg, vueltoPyg } = useMemo(() => {
    let recibido = 0

    if (paymentTab === "cash") {
      const pyg = parseInt(payCashPyg.replace(/\D/g, "") || "0", 10)
      const brl = parseFloat(payCashBrl.replace(/,/g, ".") || "0") * rates.BRL
      const usd = parseFloat(payCashUsd.replace(/,/g, ".") || "0") * rates.USD
      recibido = pyg + brl + usd
    } else if (paymentTab === "bancard") {
      recibido = parseInt(posCardMontoPyg.replace(/\D/g, "") || String(totalPyg), 10)
    } else if (paymentTab === "dinelco") {
      recibido = parseInt(dinelcoMontoPyg.replace(/\D/g, "") || String(totalPyg), 10)
    } else if (paymentTab === "qr") {
      recibido = totalPyg
    } else if (paymentTab === "mixed") {
      const pyg = parseInt(mixedCashPyg.replace(/\D/g, "") || "0", 10)
      const brl = parseFloat(mixedCashBrl.replace(/,/g, ".") || "0") * rates.BRL
      const card = parseInt(mixedCardPyg.replace(/\D/g, "") || "0", 10)
      const qr = parseInt(mixedQrPyg.replace(/\D/g, "") || "0", 10)
      recibido = pyg + brl + card + qr
    }

    // El guaraní no circula en billetes/monedas por debajo de ₲500 -- al
    // combinar monedas (ej. algo de R$ convertido a Gs) la cotización casi
    // nunca cierra en un número redondo, y quedaba pidiendo "faltan ₲3" o
    // similar: una diferencia que nadie puede pagar de verdad porque no
    // existe esa unidad. Con una diferencia por debajo de la tolerancia se
    // da por cubierto, igual que redondearía cualquier caja real.
    const TOLERANCIA_REDONDEO_PYG = 50
    let saldo = Math.max(0, totalPyg - recibido)
    let vuelto = Math.max(0, recibido - totalPyg)
    if (saldo > 0 && saldo <= TOLERANCIA_REDONDEO_PYG) saldo = 0
    if (vuelto > 0 && vuelto <= TOLERANCIA_REDONDEO_PYG) vuelto = 0

    return {
      totalRecibidoPyg: Math.round(recibido),
      saldoRestantePyg: Math.round(saldo),
      vueltoPyg: Math.round(vuelto)
    }
  }, [paymentTab, payCashPyg, payCashBrl, payCashUsd, posCardMontoPyg, dinelcoMontoPyg, mixedCashPyg, mixedCashBrl, mixedCardPyg, mixedQrPyg, totalPyg, rates])

  // Al abrir el modal de cobro, foco directo al campo de Guaraníes (ya viene
  // precargado con el monto exacto) con el texto seleccionado -- así el
  // cajero puede tipear un monto distinto de una sola vez (sobreescribe la
  // selección) o apretar Enter directo para cobrar el exacto, sin mouse.
  // Antes el foco saltaba solo al botón de confirmar apenas el monto
  // alcanzaba, lo que le sacaba el foco al campo mientras el cajero
  // todavía estaba tipeando un monto distinto.
  useEffect(() => {
    if (showPaymentModal && paymentTab === "cash") {
      payCashPygInputRef.current?.focus()
      payCashPygInputRef.current?.select()
    } else if (showPaymentModal && paymentTab === "mixed") {
      mixedCashPygInputRef.current?.focus()
      mixedCashPygInputRef.current?.select()
    }
  }, [showPaymentModal, paymentTab])

  // Mismo ciclo con precarga del faltante que en efectivo, pero para pago
  // mixto: Gs -> R$ -> Tarjeta -> QR -> Gs. El pago mixto antes era 4
  // campos sueltos sin ninguna ayuda -- ahora cada Enter sugiere cuánto
  // falta convertido a la moneda del siguiente campo.
  const handleMixedFieldKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    nextRef: React.RefObject<HTMLInputElement>,
    fillNext?: (faltantePyg: number) => void,
  ) => {
    if (e.key === "Enter") {
      e.preventDefault()
      if (totalRecibidoPyg >= totalPyg && totalPyg > 0 && !submitting) {
        handleProcessCheckout()
      } else {
        const faltante = Math.max(0, totalPyg - totalRecibidoPyg)
        if (faltante > 0 && fillNext) fillNext(faltante)
        // El setTimeout es necesario: si el campo se precargó recién arriba
        // (fillNext), React todavía no pintó ese valor en el DOM en este
        // mismo tick -- un .select() inmediato selecciona el valor viejo
        // (vacío), no el precargado, y el cajero terminaba borrando a mano.
        setTimeout(() => {
          nextRef.current?.focus()
          nextRef.current?.select()
        }, 0)
      }
    }
  }

  // Enter en cualquier campo de efectivo confirma el cobro si el monto ya
  // cubre el total -- el flujo habitual de un cajero es tipear y Enter,
  // nunca tocar el mouse salvo que algo salga mal.
  // Ciclo fijo Gs -> R$ -> US$ -> Gs: si lo tipeado en el campo actual ya
  // cubre el total, Enter cobra directo. Si no alcanza (el cliente puede
  // pagar en varias monedas, ej. "tengo tantos dólares" y el resto en
  // guaraníes), Enter pasa al siguiente campo de moneda -- y ya viene
  // PRECARGADO con el faltante convertido a esa moneda, seleccionado, para
  // que un segundo Enter cierre el cobro directo si el cliente paga justo
  // el resto. Antes el cajero tenía que calcular la conversión a mano.
  const handleCashFieldKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    nextRef: React.RefObject<HTMLInputElement>,
    nextCurrency: "PYG" | "BRL" | "USD",
  ) => {
    if (e.key === "Enter") {
      e.preventDefault()
      if (totalRecibidoPyg >= totalPyg && totalPyg > 0 && !submitting) {
        handleProcessCheckout()
      } else {
        const faltante = Math.max(0, totalPyg - totalRecibidoPyg)
        if (faltante > 0) {
          if (nextCurrency === "PYG") setPayCashPyg(Math.ceil(faltante).toLocaleString("es-PY"))
          else if (nextCurrency === "BRL") setPayCashBrl((faltante / rates.BRL).toFixed(2))
          else if (nextCurrency === "USD") setPayCashUsd((faltante / rates.USD).toFixed(2))
        }
        // Mismo motivo que en handleMixedFieldKeyDown: esperar al próximo
        // tick para que React ya haya pintado el monto precargado antes
        // de seleccionarlo.
        setTimeout(() => {
          nextRef.current?.focus()
          nextRef.current?.select()
        }, 0)
      }
    }
  }

  // Asigna esta máquina (por hostname) a una caja/punto de emisión fijo --
  // solo llega hasta acá con autorización real de supervisor ya confirmada.
  const submitAssignTerminal = async () => {
    if (!machineHostname) {
      toast.error("No se detectó el nombre de esta máquina", "Esta función requiere ejecutarse desde la aplicación de escritorio.")
      return
    }
    try {
      const created = await api.posTerminals.create({
        hostname: machineHostname,
        punto_emision: assignPuntoEmision,
        caja_nombre: assignCajaNombre.trim() || `Caja ${assignPuntoEmision}`,
      })
      setTerminalAssignment(created as any)
      setPuntoEmision(`001-${created.punto_emision}`)
      setShowAssignTerminalModal(false)
      toast.success("Caja Asignada", `Esta máquina (${machineHostname}) queda fija a ${created.caja_nombre}.`)
    } catch (err: any) {
      toast.error("No se pudo asignar la caja", err?.message || "Intente nuevamente.")
    }
  }

  // ── MANEJO DEL SECTOR RÁPIDO DE BILLETES (SOBREESCRIBE EN EL 1ER CLIC, INCREMENTA DESPUÉS) ──
  const handleQuickCashClick = (amount: number) => {
    if (!hasClickedQuickCash) {
      setPayCashPyg(amount.toLocaleString("es-PY"))
      setHasClickedQuickCash(true)
    } else {
      const current = parseInt(payCashPyg.replace(/\D/g, "") || "0", 10)
      setPayCashPyg((current + amount).toLocaleString("es-PY"))
    }
  }

  // ── PROCESAMIENTO DE COBRO (FACTURACIÓN E IMPRESIÓN 80MM) ──────────────────
  const handleOpenPayment = () => {
    setPayCashPyg(totalPyg.toLocaleString("es-PY"))
    setPayCashBrl("")
    setPayCashUsd("")
    setHasClickedQuickCash(false)
    setPosCardMontoPyg(totalPyg.toLocaleString("es-PY"))
    setDinelcoMontoPyg(totalPyg.toLocaleString("es-PY"))
    setMixedCashPyg("")
    setMixedCashBrl("")
    setMixedCardPyg("")
    setMixedQrPyg("")
    setPosVerifyStatus("idle")
    setPosVerifyCandidates([])
    setPosVerifiedTxn(null)
    setPosVerifyOpenedAt(new Date().toISOString())
    setShowPaymentModal(true)
  }

  // Busca en la maquinita física (tabla real fin_operacao_pos, viva, en la
  // red propia del terminal -- confirmado con el cliente que Bancard va por
  // cable con IP propia y Dinelco por WiFi, ninguno atado a Ñemuha) la
  // transacción que corresponde al cobro actual, en vez de que el cajero
  // tipee el voucher a mano sin ninguna verificación real.
  const handleVerifyPosTerminal = async () => {
    const procesador = paymentTab === "bancard" ? "BANCARD" : "DINELCO"
    const montoStr = paymentTab === "bancard" ? posCardMontoPyg : dinelcoMontoPyg
    const monto = parseInt(montoStr.replace(/\D/g, "") || String(totalPyg), 10)
    setPosVerifyStatus("searching")
    setPosVerifyCandidates([])
    setPosVerifiedTxn(null)
    try {
      const candidates = await api.integrations.posMatch({
        procesador,
        monto,
        desde: posVerifyOpenedAt || new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      })
      if (candidates.length === 1) {
        handleSelectPosCandidate(candidates[0])
      } else if (candidates.length > 1) {
        setPosVerifyCandidates(candidates)
        setPosVerifyStatus("multiple")
      } else {
        setPosVerifyStatus("none")
      }
    } catch (e) {
      setPosVerifyStatus("none")
    }
  }

  const handleSelectPosCandidate = (c: { id: string; fecha: string; tarjeta_marca: string; monto: number; voucher: string; cajero: string }) => {
    setPosVerifiedTxn(c)
    setPosVerifyStatus("found")
    setPosVerifyCandidates([])
    if (paymentTab === "bancard") setPosCardCupon(c.voucher)
    else setDinelcoCupon(c.voucher)
  }

  const handleProcessCheckout = async () => {
    if (saldoRestantePyg > 0 && paymentTab !== "qr") {
      toast.warning("Saldo Pendiente", `Falta saldar ${formatPYG(saldoRestantePyg)} para completar el cobro.`)
      return
    }

    setSubmitting(true)
    try {
      const saleNumber = `${puntoEmision}-${String(Math.floor(Math.random() * 900000) + 100000).padStart(7, "0")}`

      // Cargar datos reales de la empresa y plantilla personalizada directamente desde DB / localStorage
      let companyData: any = {}
      try {
        const savedComp = localStorage.getItem("pos_company_data")
        if (savedComp) companyData = JSON.parse(savedComp)
      } catch (e) {}

      if (!companyData.ruc) {
        try {
          const comps = await api.companies.list()
          if (Array.isArray(comps) && comps.length > 0) {
            companyData = comps[0]
            const fantasia = companyData.nombre_fantasia || companyData.nombre || "Extra Supermercado Mayorista"
            companyData.nombre = fantasia
            companyData.nombre_fantasia = fantasia
          }
        } catch (e) {}
      }

      let tpl: any = {}
      try {
        const savedTpl = localStorage.getItem("pos_receipt_template_config")
        if (savedTpl) tpl = JSON.parse(savedTpl)
        else if ((companyData.config as any)?.receipt_template) {
          tpl = (companyData.config as any).receipt_template
        }
      } catch (e) {}

      const showLogo = tpl.mostrar_logo !== false && (companyData.logo_url || tpl.logo_url)
      const rawLogoUrl = companyData.logo_url || tpl.logo_url || ""
      
      // Logotipo: usar el cacheado en el arranque del POS (evita el fetch +
      // conversión a base64 en el camino crítico de cada venta, que era la
      // causa del delay entre cobrar e imprimir). Solo se baja por red si
      // por algo todavía no hay cache (primera venta antes de que termine
      // de cargar, o logo cambiado recién).
      let logoUrl = ""
      if (showLogo && rawLogoUrl) {
        const cachedLogo = localStorage.getItem("pos_logo_data_url")
        if (cachedLogo) {
          logoUrl = cachedLogo
        } else if (rawLogoUrl.startsWith("data:")) {
          logoUrl = rawLogoUrl
        } else {
          try {
            const targetUrl = rawLogoUrl.startsWith("http") ? rawLogoUrl : `${window.location.origin}${rawLogoUrl}`
            const res = await fetch(targetUrl)
            const blob = await res.blob()
            logoUrl = await new Promise<string>((resolve) => {
              const reader = new FileReader()
              reader.onloadend = () => resolve(reader.result as string)
              reader.onerror = () => resolve(targetUrl)
              reader.readAsDataURL(blob)
            })
            if (logoUrl) localStorage.setItem("pos_logo_data_url", logoUrl)
          } catch (e) {
            logoUrl = rawLogoUrl.startsWith("http") ? rawLogoUrl : `${window.location.origin}${rawLogoUrl}`
          }
        }
      }

      const logoWidth = tpl.logo_ancho_px || 160
      const fantasia = companyData.nombre_fantasia || companyData.nombre || tpl.nombre_fantasia || "Extra Supermercado Mayorista"
      const razon = companyData.razon_social || tpl.razon_social || "GRUPO SANTA TERESA E.A.S."
      const rucEmpresa = companyData.ruc || tpl.ruc || "80150377-9"
      const timbrado = String((companyData.config as any)?.timbrado_dnit || companyData.timbrado_numero || tpl.timbrado || "18545636")
      const timbradoVenc = tpl.timbrado_vencimiento || "31/12/2026"
      const direccion = companyData.direccion || tpl.direccion || "Alejo Garcia esquina Carlos Antonio López"
      const ciudad = companyData.ciudad || tpl.ciudad || "Pedro Juan Caballero · Paraguay"
      const tel = companyData.telefono || tpl.telefono || "+595992052200"
      const slogan = tpl.slogan || ""
      const font = tpl.fuente_ticket || "Consolas"
      const fontSize = tpl.tamano_fuente_px || 10.5
      const showCajero = tpl.mostrar_cajero !== false
      const showCliente = tpl.mostrar_cliente !== false
      const showRucCliente = tpl.mostrar_ruc_cliente !== false
      const showSku = tpl.mostrar_sku !== false
      const showBalanza = tpl.mostrar_balanza_origen !== false
      const showMulti = tpl.mostrar_multimoneda !== false
      const showBrl = tpl.mostrar_equivalente_brl !== false
      const showUsd = tpl.mostrar_equivalente_usd !== false
      const showIva = tpl.mostrar_liquidacion_iva !== false
      const showPagos = tpl.mostrar_desglose_pagos !== false
      const showClub = tpl.habilitar_extra_club !== false
      const isClubMember = customer && customer.id !== DEFAULT_CUSTOMER.id
      const msgSocio = tpl.mensaje_socio_club || `⭐ SOCIO EXTRA CLUB: Sumaste +${Math.round(totalPyg / 1000)} Puntos. Saldo Total: 2.850 Puntos.`
      const msgInvitacion = tpl.mensaje_invitacion_club || "🎁 ¿Aún no eres socio Extra Club? Regístrate gratis en caja o en club.extrasuper.com.py y acumula puntos para canjear por premios y descuentos exclusivos."
      const showMarketing = tpl.habilitar_mensaje_marketing && tpl.mensaje_marketing
      const showCupon = tpl.habilitar_cupon_descuento && tpl.cupon_codigo
      const cuponCod = tpl.cupon_codigo || "EXTRA10OFF"
      const cuponDesc = tpl.cupon_descripcion || "10% de descuento en tu próxima compra"
      const cuponDias = tpl.cupon_validez_dias || 15
      const showQrSifen = tpl.mostrar_qr_sifen !== false
      const sifenUrl = tpl.sifen_consulta_url || "https://sifen.set.gov.py/consultas"
      const msgDespedida = tpl.mensaje_despedida || "¡Muchas gracias por su preferencia!"
      const feedLinesCount = tpl.lineas_salto_corte || 5
      const showCutLine = tpl.mostrar_linea_corte_visual !== false

      // Formateador limpio sin símbolos extraños ni Unicode que rompa en impresoras térmicas
      const fmtGs = (val: number | string | null | undefined): string => {
        if (val == null) return "0"
        const n = typeof val === "string" ? Math.round(parseFloat(val.replace(/\./g, "").replace(",", "."))) : Math.round(val)
        if (isNaN(n)) return "0"
        return n.toLocaleString("es-PY", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
      }

      const anchoImprimibleMm = tpl.ancho_imprimible_mm || 68
      const margenIzqMm = tpl.margen_izq_mm || 0
      const margenDerMm = tpl.margen_der_mm || 0
      const interlineado = tpl.interlineado || 1.22
      const paperWidthMm = parseInt(String(tpl.ancho_papel || "80mm").replace(/\D/g, ""), 10) || 80

      // Mientras no haya facturación electrónica real (SIFEN), el comprobante
      // no es una "factura electrónica" -- decir eso es engañoso. Se rotula
      // según la condición real de pago hasta que se active facturación
      // electrónica desde el Diseñador (un solo campo de configuración,
      // sin tocar código, para cuando llegue SIFEN).
      const facturacionElectronica = tpl.facturacion_electronica === true
      const tipoComprobanteLabel = facturacionElectronica
        ? "FACTURA ELECTRÓNICA"
        : (isClubMember ? "FACTURA CRÉDITO" : "FACTURA CONTADO")

      // Número a mostrar en el ticket: por defecto el correlativo local
      // (instantáneo, no espera al servidor). Si el Diseñador tiene
      // activado "usar número interno de venta", se espera la confirmación
      // del servidor (aprox. 200ms) para mostrar el número real ya
      // registrado -- esa venta se crea acá mismo, sin recibo_html todavía
      // (se agrega abajo si el modo es el correlativo local).
      // OJO: nunca filtrar items acá aunque product_id se vea raro -- un
      // filtro "defensivo" que descartaba items en silencio fue justamente
      // lo que causó ventas guardadas con total 0 (el servidor calcula el
      // total sumando los items que le llegan; si el filtro los vaciaba,
      // el total quedaba en 0 aunque el ticket impreso mostrara los
      // productos reales). Si un product_id es inválido, que lo rechace el
      // servidor con un error visible, nunca perder el dato en silencio.
      const saleItemsForCreate = cart
        .map(i => ({
          product_id: i.product_id || i.id,
          cantidad: i.quantity,
          precio_unitario: i.precio,
          iva_tasa: i.iva_tasa,
          subtotal: i.precio * i.quantity
        }))
      const salePaymentsForCreate = [{ forma: paymentTab === "cash" ? "efectivo" : paymentTab === "bancard" ? "tarjeta_bancard" : paymentTab === "dinelco" ? "tarjeta_dinelco" : "qr", monto: totalPyg }]
      const saleBasePayload = {
        company_id: COMPANY_ID,
        customer_id: customer.id,
        user_id: user?.id,
        session_id: cashSessionId || undefined,
        // Punto de emisión fijo de esta máquina (si ya fue asignado por un
        // administrador) -- sin esto, el backend cae al único punto de
        // emisión por defecto de toda la empresa, sin importar en qué caja
        // real se hizo la venta.
        punto_emision: terminalAssignment?.punto_emision || undefined,
        subtotal: totalPyg,
        total: totalPyg,
        condicion: isClubMember ? "credito" : "contado",
        estado: "completada",
        items: saleItemsForCreate,
        payments: salePaymentsForCreate,
      }

      let numeroComprobante = saleNumber
      let numeroInterno: string | null = null
      let ventaYaCreadaSinRecibo = false
      let createdSaleId: string | null = null
      let saleCreatePromise: Promise<any> | null = null
      if (tpl.usar_numero_interno_venta) {
        try {
          const created = await api.sales.create(saleBasePayload as any)
          numeroComprobante = created.numero || saleNumber
          numeroInterno = (created as any).numero_interno || null
          ventaYaCreadaSinRecibo = true
          createdSaleId = created.id
        } catch (apiErr: any) {
          console.error("No se pudo registrar la venta para obtener el número interno:", apiErr)
          toast.error("No se obtuvo el número real de venta", apiErr?.message || "El ticket sale con un número provisorio -- avisá a soporte.")
        }
      }

      // Formateo de Factura Térmica Dinámica (Calibrada al ancho y márgenes configurados en el Diseñador)
      const receiptHtml = `
        <div style="font-family: '${font}', 'Consolas', 'Segoe UI', monospace; font-size: ${fontSize}px; line-height: ${interlineado}; margin: 0 auto; padding-left: ${margenIzqMm}mm; padding-right: ${margenDerMm}mm; box-sizing: border-box; width: 100%; max-width: ${anchoImprimibleMm}mm; color: #000;">
          <div style="text-align: center; margin-bottom: 5px;">
            ${showLogo && logoUrl ? `
              <div style="margin: 0 auto 5px auto; width: ${logoWidth}px; max-width: 100%;">
                <img src="${logoUrl}" style="max-width: 100%; height: auto; display: block; margin: 0 auto;" alt="${fantasia}" />
              </div>
            ` : `<div style="font-size: 14px; font-weight: 900; letter-spacing: 0.5px; line-height: 1.15;">${fantasia}</div>`}
            <div style="font-size: 10.5px; font-weight: bold;">${razon}</div>
            <div style="font-size: 9.5px;">RUC: ${rucEmpresa} · Tel: ${tel}</div>
            <div style="font-size: 9.5px;">${direccion}</div>
            <div style="font-size: 9.5px;">${ciudad}</div>
            ${slogan ? `<div style="font-size: 9px; font-style: italic; margin-top: 2px;">"${slogan}"</div>` : ''}
            <div style="font-size: 9.5px; margin-top: 2px;">Timbrado Nº: ${timbrado} · Válido hasta: ${timbradoVenc}</div>
          </div>
          
          <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 3px 0; margin: 3px 0; font-size: 10px;">
            <div><strong>${tipoComprobanteLabel}${tpl.mostrar_numero_comprobante !== false ? `:</strong> ${numeroComprobante}` : '</strong>'}</div>
            ${numeroInterno ? `<div><strong>Nº VENTA:</strong> ${numeroInterno}</div>` : ''}
            <div><strong>FECHA / HORA:</strong> ${new Date().toLocaleString("es-PY")}</div>
            <div><strong>CONDICIÓN:</strong> CONTADO</div>
            ${showCajero ? `<div><strong>CAJERO:</strong> ${user?.nombre || "Cajero 01"} (${puntoEmision})</div>` : ''}
            ${showCliente ? `<div><strong>CLIENTE:</strong> ${customer.nombre}</div>` : ''}
            ${showRucCliente ? `<div><strong>RUC / CI:</strong> ${customer.ruc || customer.ci || "44444401-7 (Sin RUC)"}</div>` : ''}
          </div>

          <table style="width: 100%; border-collapse: collapse; margin: 4px 0; font-size: 10px; table-layout: fixed;">
            <colgroup>
              <col style="width: 65%;">
              <col style="width: 35%;">
            </colgroup>
            ${cart.map(item => `
              <tr>
                <td colspan="2" style="font-weight: bold; padding-top: 2px; word-break: break-word;">
                  ${item.nombre}
                  ${showBalanza && item.es_pesable ? ' <span style="font-size: 8.5px; font-weight: normal;">[Balanza]</span>' : ''}
                  ${showSku && (item.codigo_barra || item.sku) ? ` <span style="font-size: 8.5px; font-weight: normal;">[${item.codigo_barra || item.sku}]</span>` : ''}
                </td>
              </tr>
              <tr style="border-bottom: 1px dotted #888;">
                <td style="padding-bottom: 3px; font-size: 9.5px; word-break: break-word;">
                  ${item.es_pesable ? `${item.quantity.toFixed(3)} KG` : `${item.quantity} UN`} x Gs. ${fmtGs(item.precio)}
                </td>
                <td style="text-align: right; font-weight: bold; padding-bottom: 3px; font-size: 10px; white-space: nowrap;">
                  Gs. ${fmtGs(item.precio * item.quantity)}
                </td>
              </tr>
            `).join('')}
          </table>

          <table style="width: 100%; border-collapse: collapse; border-top: 1px dashed #000; margin-top: 4px; padding-top: 4px; table-layout: fixed;">
            <colgroup>
              <col style="width: 50%;">
              <col style="width: 50%;">
            </colgroup>
            <tr style="font-size: 13px; font-weight: 900;">
              <td style="padding: 2px 0;">TOTAL A PAGAR:</td>
              <td style="text-align: right; padding: 2px 0; white-space: nowrap;">Gs. ${fmtGs(totalPyg)}</td>
            </tr>
            ${showMulti && showBrl ? `
              <tr style="font-size: 9.5px;">
                <td>Equiv. Reales:</td>
                <td style="text-align: right; white-space: nowrap;">R$ ${totalBrl}</td>
              </tr>
            ` : ''}
            ${showMulti && showUsd ? `
              <tr style="font-size: 9.5px;">
                <td>Equiv. Dólares:</td>
                <td style="text-align: right; white-space: nowrap;">US$ ${totalUsd}</td>
              </tr>
            ` : ''}
          </table>

          ${showPagos ? `
            <table style="width: 100%; border-collapse: collapse; border-top: 1px dotted #000; margin-top: 3px; padding-top: 2px; font-size: 9.5px; table-layout: fixed;">
              <colgroup>
                <col style="width: 50%;">
                <col style="width: 50%;">
              </colgroup>
              <tr>
                <td>Forma de Pago:</td>
                <td style="text-align: right; font-weight: bold; text-transform: uppercase;">${paymentTab === "cash" ? "Efectivo" : paymentTab === "bancard" ? "Tarjeta Bancard" : paymentTab === "dinelco" ? "Tarjeta Dinelco" : paymentTab}</td>
              </tr>
              <tr>
                <td>Monto Recibido:</td>
                <td style="text-align: right;">Gs. ${fmtGs(totalRecibidoPyg)}</td>
              </tr>
              <tr style="font-weight: bold; font-size: 10.5px;">
                <td style="padding-top: 2px;">VUELTO:</td>
                <td style="text-align: right; padding-top: 2px; white-space: nowrap;">
                  Gs. ${fmtGs(vueltoPyg)} ${rates.BRL > 0 ? `(R$ ${(vueltoPyg / rates.BRL).toFixed(2)})` : ''}
                </td>
              </tr>
            </table>
          ` : ''}

          ${showIva ? `
            <div style="border-top: 1px dashed #000; margin-top: 5px; padding-top: 3px; font-size: 9px;">
              <div style="font-weight: bold; margin-bottom: 2px;">LIQUIDACIÓN DEL IVA (Ley Nº 6380/19):</div>
              <table style="width: 100%; border-collapse: collapse; font-size: 9px; table-layout: fixed;">
                <colgroup>
                  <col style="width: 50%;">
                  <col style="width: 50%;">
                </colgroup>
                <tr>
                  <td>Gravadas 10%: Gs. ${fmtGs(gravada10Pyg - iva10Pyg)}</td>
                  <td style="text-align: right;">IVA 10%: Gs. ${fmtGs(iva10Pyg)}</td>
                </tr>
                <tr>
                  <td>Gravadas 5%: Gs. ${fmtGs(gravada5Pyg - iva5Pyg)}</td>
                  <td style="text-align: right;">IVA 5%: Gs. ${fmtGs(iva5Pyg)}</td>
                </tr>
                <tr>
                  <td colspan="2">Exentas: Gs. ${fmtGs(exentaPyg)}</td>
                </tr>
                <tr style="font-weight: bold;">
                  <td style="padding-top: 2px;">TOTAL IVA:</td>
                  <td style="text-align: right; padding-top: 2px;">Gs. ${fmtGs(iva10Pyg + iva5Pyg)}</td>
                </tr>
              </table>
            </div>
          ` : ''}

          ${showClub ? `
            <div style="border: 1px dashed #000; padding: 4px; margin: 5px 0; text-align: center; font-size: 9.5px;">
              ${isClubMember ? `
                <div style="font-weight: 900; font-size: 10px;">★ CLUB FIDELIDAD EXTRA ★</div>
                <div style="margin-top: 2px;">${msgSocio}</div>
              ` : `
                <div style="font-weight: 900; font-size: 10px;">★ ÚNETE AL EXTRA CLUB ★</div>
                <div style="margin-top: 2px; font-size: 8.5px;">${msgInvitacion}</div>
                ${tpl.mostrar_qr_club && tpl.qr_url_club && (localStorage.getItem("pos_qr_club_data_url") || "") ? `
                  <img src="${localStorage.getItem("pos_qr_club_data_url")}" style="width: 90px; height: 90px; margin: 4px auto 0 auto; display: block;" />
                ` : ''}
              `}
            </div>
          ` : ''}

          ${showMarketing ? `
            <div style="text-align: center; margin: 4px 0; font-size: 9px; font-weight: bold;">
              ${tpl.mensaje_marketing}
            </div>
          ` : ''}

          ${showCupon ? `
            <div style="border: 1px dashed #333; padding: 4px; margin: 5px 0; text-align: center;">
              <div style="font-size: 8.5px; text-transform: uppercase;">✂ CUPÓN DE RECOMPRA ✂</div>
              <div style="font-size: 12px; font-weight: 900; letter-spacing: 1px; margin: 2px 0;">${cuponCod}</div>
              <div style="font-size: 9px; font-weight: bold;">${cuponDesc}</div>
              <div style="font-size: 8px; color: #444;">Válido por ${cuponDias} días en todas nuestras sucursales</div>
            </div>
          ` : ''}

          <div style="text-align: center; margin-top: 6px; font-size: 9px;">
            ${showQrSifen ? `
              <div>Consulte la validez de este comprobante en:</div>
              <div style="font-weight: bold;">${sifenUrl}</div>
            ` : ''}
            <div style="margin-top: 4px; font-weight: bold; font-size: 10px;">${msgDespedida}</div>
          </div>

          <!-- Saltos de papel configurados antes del corte -->
          ${'<br/>'.repeat(feedLinesCount)}
          ${showCutLine ? `
            <div style="text-align: center; border-top: 1px dashed #999; font-size: 8.5px; color: #666; padding-top: 3px;">
              ✂ CORTE DE TICKET ✂
            </div>
          ` : ''}
          <br/>
        </div>
      `

      // Si no se creó antes (modo correlativo local, el default), se crea
      // ahora con el recibo_html ya armado, en paralelo, SIN bloquear el
      // ticket -- antes se esperaba esta llamada antes de imprimir, lo que
      // sumaba al delay entre cobrar y que salga el ticket.
      if (!ventaYaCreadaSinRecibo) {
        saleCreatePromise = api.sales.create({ ...saleBasePayload, recibo_html: receiptHtml } as any).catch((apiErr: any) => {
          console.error("No se pudo guardar la venta:", apiErr)
          toast.error("Venta no guardada en el sistema", apiErr?.message || "El ticket se imprimió igual, pero avisá a soporte -- esta venta puede no quedar registrada.")
          return null
        })
      }

      // Si el cobro con tarjeta se verificó contra la transacción real de la
      // terminal, se reclama ahora (best-effort, sin esperar -- no debe
      // sumar delay entre cobrar y que salga el ticket) para que esa
      // transacción no se le pueda asignar por error a otra venta.
      if ((paymentTab === "bancard" || paymentTab === "dinelco") && posVerifiedTxn) {
        const claimTxn = posVerifiedTxn
        const claimProcesador = paymentTab === "bancard" ? "BANCARD" : "DINELCO"
        const doClaim = (saleIdForClaim?: string) => api.integrations.posClaim({
          fin_operacao_pos_id: claimTxn.id,
          procesador: claimProcesador,
          monto: Math.round(claimTxn.monto),
          voucher: claimTxn.voucher,
          tarjeta_marca: claimTxn.tarjeta_marca,
          sale_id: saleIdForClaim,
        }).catch(() => {})
        if (createdSaleId) {
          doClaim(createdSaleId)
        } else if (saleCreatePromise) {
          saleCreatePromise.then((s: any) => doClaim(s?.id))
        } else {
          doClaim()
        }
      }

      // Ticket físico real: ESC/POS crudo (ver comentario del generador más
      // arriba). receiptHtml sigue existiendo para guardarse en recibo_html
      // y para el visor/reimpresión por PDF, pero lo que sale por la
      // impresora térmica es esto.
      if ((window as any).electronAPI?.printEscPos) {
        const W = ESCPOS_LINE_WIDTH
        let t = ESCPOS_INIT
        // Margen izquierdo real (GS L, en puntos -- 203dpi ~= 8 puntos/mm),
        // tomado del mismo campo que ya existe en el Diseñador.
        const margenIzqDots = Math.max(0, Math.round((tpl.margen_izq_mm || 0) * 8))
        t += GS + 'L' + String.fromCharCode(margenIzqDots & 0xFF) + String.fromCharCode((margenIzqDots >> 8) & 0xFF)
        // Interlineado (ESC 3 n, alto de linea en puntos). 1.22 (default del
        // diseñador) ~= 30 puntos a fuente normal; se escala desde ahi.
        const lineSpacingDots = Math.max(16, Math.min(60, Math.round((tpl.interlineado || 1.22) * 24)))
        t += ESC + '3' + String.fromCharCode(lineSpacingDots)
        t += ESCPOS_ALIGN_CENTER

        let logoImpreso = false
        if (showLogo && logoUrl) {
          const logoCmd = await escposLogoFromDataUrl(logoUrl)
          if (logoCmd) { t += logoCmd + '\n'; logoImpreso = true }
        }

        // El nombre de fantasía en texto queda solo como respaldo cuando no
        // hay logo impreso -- con logo, repetir el nombre abajo es
        // redundante (el logo ya lo dice) y a este tamaño chico no suma nada.
        if (!logoImpreso) {
          t += ESCPOS_BOLD_ON + escposStripAccents(fantasia) + '\n' + ESCPOS_BOLD_OFF
        }
        t += escposStripAccents(razon) + '\n'
        t += `RUC: ${escposStripAccents(rucEmpresa)}\n`
        t += escposStripAccents(direccion) + '\n'
        t += escposStripAccents(ciudad) + '\n'
        t += escposStripAccents(tel) + '\n'
        if (slogan) t += `"${escposStripAccents(slogan)}"\n`
        t += `Timbrado No: ${timbrado} - Valido hasta: ${timbradoVenc}\n`
        t += ESCPOS_ALIGN_LEFT
        t += escposDashes(W) + '\n'
        t += ESCPOS_BOLD_ON + (tpl.mostrar_numero_comprobante !== false ? `${escposStripAccents(tipoComprobanteLabel)}: ${numeroComprobante}` : escposStripAccents(tipoComprobanteLabel)) + ESCPOS_BOLD_OFF + '\n'
        if (numeroInterno) t += `No Venta: ${numeroInterno}\n`
        t += `Fecha/Hora: ${new Date().toLocaleString("es-PY")}\n`
        t += `Condicion: ${isClubMember ? "CREDITO" : "CONTADO"}\n`
        if (showCajero) t += `Cajero: ${escposStripAccents(user?.nombre || "Cajero 01")} (${puntoEmision})\n`
        if (showCliente) t += `Cliente: ${escposStripAccents(customer.nombre)}\n`
        if (showRucCliente) t += `RUC/CI: ${escposStripAccents(customer.ruc || customer.ci || "44444401-7")}\n`
        t += escposDashes(W) + '\n'

        const itemsUnaLinea = tpl.formato_items === "una_linea"
        for (const item of cart) {
          const cod = showSku && (item.codigo_barra || item.sku) ? ` [${escposStripAccents(item.codigo_barra || item.sku)}]` : ''
          const balanza = showBalanza && item.es_pesable ? ' [Balanza]' : ''
          const cantStr = item.es_pesable ? `${item.quantity.toFixed(3)} KG` : `${item.quantity} UN`
          const lineTotalStr = fmtGs(item.precio * item.quantity)

          if (itemsUnaLinea) {
            // Una sola linea: nombre (recortado si hace falta) + subtotal a la derecha
            t += escposTwoCol(escposStripAccents(item.nombre) + balanza, lineTotalStr) + '\n'
          } else {
            // Maximo 2 lineas: nombre solo en la primera (el codigo de
            // barras pegado ahi se estaba truncando junto con nombres
            // largos y quedaba invisible). El codigo va en la segunda linea,
            // junto a cantidad x precio, protegido por escposTwoCol -- si no
            // entra todo, se recorta el texto de la izquierda pero el monto
            // de la derecha nunca se solapa.
            let nombreLine = escposStripAccents(item.nombre) + balanza
            if (nombreLine.length > W) nombreLine = escposPadRight(nombreLine, W)
            t += nombreLine + '\n'
            t += escposTwoCol(`  ${cantStr} x ${fmtGs(item.precio)}${cod}`, lineTotalStr) + '\n'
          }
        }
        t += escposDashes(W) + '\n'
        t += ESCPOS_BOLD_ON + ESCPOS_DOUBLE_ON + escposTwoCol('TOTAL:', fmtGs(totalPyg), 24) + ESCPOS_DOUBLE_OFF + ESCPOS_BOLD_OFF + '\n'
        if (showMulti && showBrl) t += escposTwoCol('Equiv. Reales:', `R$ ${totalBrl}`) + '\n'
        if (showMulti && showUsd) t += escposTwoCol('Equiv. Dolares:', `US$ ${totalUsd}`) + '\n'

        if (showPagos) {
          t += escposDashes(W) + '\n'
          const formaPagoLabel = paymentTab === "cash" ? "EFECTIVO" : paymentTab === "bancard" ? "TARJETA BANCARD" : paymentTab === "dinelco" ? "TARJETA DINELCO" : paymentTab.toUpperCase()
          t += escposTwoCol('Forma de Pago:', formaPagoLabel) + '\n'
          t += escposTwoCol('Monto Recibido:', fmtGs(totalRecibidoPyg)) + '\n'
          t += ESCPOS_BOLD_ON + escposTwoCol('VUELTO:', fmtGs(vueltoPyg)) + ESCPOS_BOLD_OFF + '\n'
        }

        if (showIva) {
          t += escposDashes(W) + '\n'
          t += 'LIQUIDACION DEL IVA (Ley 6380/19):\n'
          t += escposTwoCol(`Grav.10%: ${fmtGs(gravada10Pyg - iva10Pyg)}`, `IVA: ${fmtGs(iva10Pyg)}`) + '\n'
          t += escposTwoCol(`Grav.5%: ${fmtGs(gravada5Pyg - iva5Pyg)}`, `IVA: ${fmtGs(iva5Pyg)}`) + '\n'
          t += `Exentas: ${fmtGs(exentaPyg)}\n`
        }

        if (showClub) {
          t += escposDashes(W) + '\n'
          t += ESCPOS_ALIGN_CENTER
          if (isClubMember) {
            t += ESCPOS_BOLD_ON + '* CLUB FIDELIDAD EXTRA *' + ESCPOS_BOLD_OFF + '\n'
            t += escposStripAccents(msgSocio) + '\n'
          } else {
            t += ESCPOS_BOLD_ON + '* UNETE AL EXTRA CLUB *' + ESCPOS_BOLD_OFF + '\n'
            t += escposStripAccents(msgInvitacion) + '\n'
            if (tpl.mostrar_qr_club && tpl.qr_url_club) {
              t += escposQr(tpl.qr_url_club) + '\n'
            }
          }
          t += ESCPOS_ALIGN_LEFT
        }

        if (showMarketing && tpl.mensaje_marketing) {
          t += ESCPOS_ALIGN_CENTER + ESCPOS_BOLD_ON + escposStripAccents(tpl.mensaje_marketing) + ESCPOS_BOLD_OFF + '\n' + ESCPOS_ALIGN_LEFT
        }

        if (showCupon) {
          t += ESCPOS_ALIGN_CENTER
          t += 'CUPON DE RECOMPRA\n'
          t += ESCPOS_BOLD_ON + ESCPOS_DOUBLE_ON + cuponCod + ESCPOS_DOUBLE_OFF + ESCPOS_BOLD_OFF + '\n'
          t += escposStripAccents(cuponDesc) + '\n'
          t += `Valido por ${cuponDias} dias\n`
          t += ESCPOS_ALIGN_LEFT
        }

        t += ESCPOS_ALIGN_CENTER
        if (showQrSifen) t += `Consulte en: ${sifenUrl}\n`
        t += ESCPOS_BOLD_ON + escposStripAccents(msgDespedida) + ESCPOS_BOLD_OFF + '\n'
        // Antes de cortar hay que sacar el papel bien lejos del cabezal --
        // la cuchilla esta unos cm mas adelante que donde imprime. Con poco
        // avance (el feedLinesCount configurado, ej. 2) la cuchilla corta
        // ENCIMA de las ultimas lineas todavia no salidas (por eso el QR y
        // el mensaje del club "desaparecian": se estaban imprimiendo bien,
        // pero la cuchilla los cortaba antes de que asomaran). Se respeta lo
        // configurado pero nunca menos de 6 lineas de colchon.
        t += '\n'.repeat(Math.max(8, feedLinesCount))
        // Corte automatico (GS V 1 = corte parcial).
        if (tpl.corte_automatico !== false) t += GS + 'V' + '\x01'

        // Guardar el ticket ESC/POS tal cual se imprimió, para que
        // Reimprimir mande exactamente esto (no el HTML viejo por
        // Chromium). No bloquea el ticket actual -- se adjunta en paralelo.
        const escposB64ForStorage = escposToBase64(t)
        if (createdSaleId) {
          api.sales.attachTicket(createdSaleId, escposB64ForStorage).catch(() => {})
        } else if (saleCreatePromise) {
          saleCreatePromise.then((created) => {
            if (created?.id) api.sales.attachTicket(created.id, escposB64ForStorage).catch(() => {})
          })
        }

        try {
          const result = await (window as any).electronAPI.printEscPos(escposB64ForStorage, tpl.nombre_impresora_windows || 'ZKP8008')
          if (!result?.success) {
            console.error('Error imprimiendo ESC/POS:', result?.error)
            toast.error('No se pudo imprimir el ticket', result?.error || 'Revise la impresora.')
          }
        } catch (printErr) {
          console.error('Error imprimiendo ESC/POS:', printErr)
        }
      } else if ((window as any).electronAPI?.printReceipt) {
        await (window as any).electronAPI.printReceipt(receiptHtml, paperWidthMm)
      }

      setShowPaymentModal(false)
      setCart([])
      setCustomer(DEFAULT_CUSTOMER)
      toast.success("¡Cobro Exitoso!", `Comprobante ${numeroComprobante} emitido. Vuelto: ${formatPYG(vueltoPyg)}`)
    } catch (err: any) {
      toast.error("Error al procesar cobro", err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── ATAJOS DE TECLADO ────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showAperturaModal || showCierreTurnoModal || showSupervisorModal || showPosConfigModal) return

      if (showManualWeightModal) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          handleConfirmManualWeight()
        } else if (e.key === "Escape") {
          e.preventDefault()
          setShowManualWeightModal(false)
        }
        return
      }

      if (e.key === "F12" || (e.code === "Space" && e.ctrlKey)) {
        e.preventDefault()
        if (cart.length > 0) handleOpenPayment()
      } else if (e.key === "F2") {
        e.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      } else if (e.key === "F3") {
        e.preventDefault()
        setShowScaleModal(true)
      } else if (e.key === "F4") {
        e.preventDefault()
        setShowLostDemandModal(true)
      } else if (e.key === "F6") {
        e.preventDefault()
        if (cart.length > 0) pauseCurrentSale()
      } else if (e.key === "F7") {
        e.preventDefault()
        if (pausedSales.length > 0) setShowPausedModal(true)
      } else if (e.key === "F9") {
        e.preventDefault()
        setShowCustomerModal(true)
      } else if (e.key === "Escape") {
        e.preventDefault()
        setShowPaymentModal(false)
        setShowCustomerModal(false)
        setShowScaleModal(false)
        setShowRatesModal(false)
        setShowPosConfigModal(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [cart, totalPyg, pausedSales.length, showAperturaModal, showCierreTurnoModal, showManualWeightModal, showScaleModal, showSupervisorModal, showPosConfigModal, manualWeightInput, targetWeighProduct])

  // ── PALETA DE COLORES Y CONTRASTE DINÁMICO ────────────────────────────────
  const bgMain = dark ? "bg-slate-950 text-slate-100" : "bg-slate-100 text-slate-900"
  const bgPanel = dark ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-300 shadow-sm text-slate-900"
  const bgInner = dark ? "bg-slate-950/80 border-slate-800/80" : "bg-slate-50 border-slate-200"
  const textHeading = dark ? "text-white" : "text-slate-900"
  const textBody = dark ? "text-slate-200" : "text-slate-800"
  const textMuted = dark ? "text-slate-400" : "text-slate-600 font-semibold"
  const borderTone = dark ? "border-slate-800" : "border-slate-300"

  return (
    <div className={`fixed inset-0 h-screen w-screen flex flex-col select-none overflow-hidden font-sans ${bgMain}`}>
      
      {/* ── 1. HEADER COMPACTO CON SWITCH DE TEMA, BALANZA, COTIZACIONES Y CIERRE ── */}
      <header className={`h-12 shrink-0 border-b px-3 flex items-center justify-between gap-2 shadow-sm z-20 ${bgPanel}`}>
        
        {/* Identidad de Marca y Turno */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-black text-xs shadow-sm">
            EM
          </div>
          <div>
            <div className="flex items-center gap-1.5 leading-none">
              <span className={`font-black text-xs tracking-tight ${textHeading}`}>EXTRA SUPERMERCADO</span>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-600 font-extrabold px-1.5 py-0.5 rounded">
                {PUNTOS_EMISION.find(p => p.id === puntoEmision)?.nombre.split('·')[0] || puntoEmision}
              </span>
            </div>
            <div className={`text-[10px] font-posMono tabular-nums leading-none mt-0.5 ${textMuted}`}>
              Cajero: <strong className={textHeading}>{user?.nombre || "Cajero"}</strong>
              {isSupervisorUser && <span className="ml-1 text-[9px] bg-purple-500/20 text-purple-600 font-bold px-1 rounded">SUPERVISOR</span>}
            </div>
          </div>
        </div>

        {/* Centro: Widget Balanza USB + Terminales POS + Cotizaciones */}
        <div className="flex items-center gap-2">
          
          {/* Widget Balanza USB Balmak BCK30 */}
          <div 
            onClick={() => setShowScaleModal(true)}
            title="Balanza Checkout Balmak BCK30. Haga clic para configurar o presione F3."
            className={`flex items-center gap-2 px-3 py-1 rounded-lg border cursor-pointer transition-all ${
              scaleUsbConnected 
                ? isScaleStable 
                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/40 shadow-xs" 
                  : "bg-amber-500/15 text-amber-600 border-amber-500/50 animate-pulse"
                : "bg-amber-500/10 text-amber-600 border-amber-500/40 hover:bg-amber-500/20"
            }`}
          >
            <Scale className={`w-4 h-4 ${scaleUsbConnected ? (isScaleStable ? "text-emerald-500" : "text-amber-500") : "text-amber-500"}`} />
            <div className="flex flex-col text-left leading-none">
              <span className="text-xs font-posMono tabular-nums font-black">
                {currentScaleWeight.toFixed(3)} KG
              </span>
              <span className="text-[8px] uppercase tracking-wider font-extrabold opacity-80">
                {scaleUsbConnected ? (isScaleStable ? `Balmak (Estable)` : `Balmak (Pesando...)`) : "⚡ Balanza (F3)"}
              </span>
            </div>
          </div>

          {/* Botón de Configuración de Terminales POS (Protegido por Supervisor) */}
          <button
            onClick={() => requestSupervisorAuthorization({ type: "open_pos_config" })}
            title="Configurar y Asignar Terminales POS Bancard & Dinelco a esta caja (Requiere Supervisor)"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
              dark ? "bg-slate-800 text-blue-400 border-slate-700 hover:bg-slate-700" : "bg-slate-200 text-blue-700 border-slate-300 hover:bg-slate-300"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="text-[10px] hidden md:inline">POS {activePosConfig.bancardTerminalId.split('-')[1]}</span>
          </button>

          {/* Cotizaciones Monedas Extranjeras */}
          <div
            onClick={() => setShowRatesModal(true)}
            title={isSupervisorUser ? "Editar Cotizaciones (Gerente/Admin)" : "Cotizaciones fijadas por Administración (Solo Lectura)"}
            className={`flex items-center gap-2.5 text-xs font-posMono tabular-nums font-bold px-2.5 py-1 rounded-lg border cursor-pointer transition-colors ${
              isSupervisorUser ? "hover:border-blue-500 bg-slate-800/10" : "opacity-90"
            } ${borderTone}`}
          >
            <span className="text-amber-600 font-extrabold flex items-center gap-1.5">
              <FlagBR /> R$ <strong>{rates.BRL.toLocaleString("es-PY")}</strong>
            </span>
            <span className={textMuted}>|</span>
            <span className="text-blue-600 font-extrabold flex items-center gap-1.5">
              <FlagUS /> US$ <strong>{rates.USD.toLocaleString("es-PY")}</strong>
            </span>
            {isSupervisorUser ? (
              <Unlock className="w-3 h-3 text-blue-500" />
            ) : (
              <Lock className={`w-3 h-3 ${textMuted}`} />
            )}
          </div>
        </div>

        {/* Derecha: Switch Modo Claro/Oscuro, Calculadora, Cierre de Turno y Salir */}
        <div className="flex items-center gap-1.5">
          
          {/* SWITCH MODO CLARO / OSCURO — solo ícono, discreto */}
          <button
            onClick={toggleTheme}
            title={dark ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro"}
            className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all border cursor-pointer ${
              dark
                ? "bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700"
                : "bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-300"
            }`}
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Calculadora */}
          <button
            onClick={handleOpenCalculator}
            title="Abrir Calculadora de Windows"
            className={`p-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
              dark ? "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700" : "bg-slate-200 text-slate-800 border-slate-300 hover:bg-slate-300"
            }`}
          >
            <Calculator className="w-4 h-4" />
          </button>

          {/* Reimprimir Comprobante */}
          <button
            onClick={openReimprimirModal}
            title="Reimprimir Comprobante de una Venta Anterior"
            className={`p-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
              dark ? "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700" : "bg-slate-200 text-slate-800 border-slate-300 hover:bg-slate-300"
            }`}
          >
            <Printer className="w-4 h-4" />
          </button>

          {/* Consulta de Precios (solo lectura, con escala por cantidad) */}
          <button
            onClick={() => setShowPriceCheckModal(true)}
            title="Consulta de Productos (precio, stock y promoción)"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600/10 text-emerald-600 border border-emerald-500/30 hover:bg-emerald-600/20 cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="text-[11px] hidden sm:inline">Productos</span>
          </button>

          {/* Producto Faltante (Demanda Perdida -> Compras) */}
          <button
            onClick={() => setShowLostDemandModal(true)}
            title="Registrar Producto que el Cliente No Encontró (F4)"
            className="p-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer bg-amber-500/10 text-amber-600 border-amber-500/40 hover:bg-amber-500/20"
          >
            <Package className="w-4 h-4" />
          </button>

          {/* Devolución de Cliente (requiere autorización real de supervisor) */}
          <button
            onClick={openDevolucionModal}
            title="Registrar Devolución de un Cliente (requiere autorización de Supervisor)"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-rose-600/10 text-rose-500 border border-rose-500/30 hover:bg-rose-600/20 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="text-[11px] hidden sm:inline">Devolución</span>
          </button>

          {/* Retiro de Efectivo (Cash Drop) */}
          <button
            onClick={() => setShowCashDropModal(true)}
            title="Registrar Retiro de Efectivo de la Caja"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-orange-600/10 text-orange-600 border border-orange-500/30 hover:bg-orange-600/20 cursor-pointer"
          >
            <Banknote className="w-3.5 h-3.5" />
            <span className="text-[11px] hidden sm:inline">Retiro</span>
          </button>

          {/* Cierre de Caja */}
          <button
            onClick={() => setShowCierreTurnoModal(true)}
            title="Cierre de Turno y Arqueo"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-600/10 text-amber-600 border border-amber-500/30 hover:bg-amber-600/20 cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span className="text-[11px] hidden sm:inline">Cierre</span>
          </button>

          {/* Salir */}
          <button
            onClick={() => { api.auth.endPosShift().catch(() => {}); logout() }}
            title="Cerrar Sesión"
            className={`p-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
              dark ? "bg-slate-800 text-rose-400 border-slate-700 hover:bg-rose-900/40" : "bg-slate-200 text-rose-600 border-slate-300 hover:bg-rose-100"
            }`}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── 2. LAYOUT PRINCIPAL: 3 COLUMNAS OPTIMIZADAS ── */}
      <div className="flex-1 flex overflow-hidden p-2 gap-2 min-h-0">
        
        {/* ── COLUMNA IZQUIERDA: CARRITO DE COMPRA, CLIENTE Y TOTALES ── */}
        <div className={`w-[45%] lg:w-[42%] flex flex-col rounded-xl border overflow-hidden ${bgPanel}`}>
          
          {/* Barra de Cliente y Turno */}
          <div className={`p-2.5 border-b flex items-center justify-between gap-2 shrink-0 ${bgInner}`}>
            <div className="flex items-center gap-2 truncate">
              <User className="w-4 h-4 text-blue-500 shrink-0" />
              <div className="truncate">
                <div className={`font-bold text-xs truncate ${textHeading}`}>
                  {customer.nombre}
                </div>
                <div className={`text-[10px] font-posMono tabular-nums ${textMuted}`}>
                  {customer.ruc || customer.ci || "Sin RUC"} · {customer.razon_social || "Consumidor Final"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setShowCustomerModal(true)}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[11px] font-bold shadow-xs cursor-pointer flex items-center gap-1"
              >
                <User className="w-3.5 h-3.5" />
                <span>F9 Cliente</span>
              </button>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  title="Anular Venta / Vaciar Carrito (Requiere Supervisor)"
                  className="p-1 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Tabla de Productos en el Carrito */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/30 p-1 min-h-0">
            {cart.length === 0 ? (
              <div className={`h-full flex flex-col items-center justify-center text-xs py-12 ${textMuted}`}>
                <ShoppingCart className="w-10 h-10 mb-2 opacity-40" />
                <span className="font-bold">CARRITO VACÍO</span>
                <span className="text-[10px] mt-0.5">Escanee productos o use el buscador (F2)</span>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className={`text-[10px] font-black uppercase tracking-wider border-b ${
                    dark ? "text-slate-400 bg-slate-950/60 border-slate-800" : "text-slate-700 bg-slate-200 border-slate-300"
                  }`}>
                    <th className="py-1.5 px-2">Cant</th>
                    <th className="py-1.5 px-2">Descripción</th>
                    <th className="py-1.5 px-2 text-right">P. Unit</th>
                    <th className="py-1.5 px-2 text-right">Subtotal</th>
                    <th className="py-1.5 px-1 text-center w-8"></th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${dark ? "divide-slate-800/40" : "divide-slate-200"}`}>
                  {cart.map((item) => {
                    const lineTotal = item.precio * item.quantity
                    return (
                      <tr key={item.id} className={dark ? "hover:bg-slate-800/40" : "hover:bg-blue-50/50"}>
                        <td className="py-2 px-2 font-posMono tabular-nums">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => updateQuantity(item.id, -1)}
                              className={`w-5 h-5 rounded flex items-center justify-center font-bold text-xs cursor-pointer ${
                                dark ? "bg-slate-800 hover:bg-slate-700 text-slate-200" : "bg-slate-200 hover:bg-slate-300 text-slate-800"
                              }`}
                            >
                              -
                            </button>
                            <span className={`font-black text-xs min-w-[28px] text-center ${textHeading}`}>
                              {item.es_pesable ? item.quantity.toFixed(3) : item.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(item.id, 1)}
                              className={`w-5 h-5 rounded flex items-center justify-center font-bold text-xs cursor-pointer ${
                                dark ? "bg-slate-800 hover:bg-slate-700 text-slate-200" : "bg-slate-200 hover:bg-slate-300 text-slate-800"
                              }`}
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          <div className={`font-bold text-xs truncate max-w-[160px] lg:max-w-[200px] ${textHeading}`}>
                            {item.nombre}
                          </div>
                          <div className={`text-[10px] font-posMono tabular-nums flex items-center gap-1.5 ${textMuted}`}>
                            <span>SKU: {item.sku}</span>
                            {item.es_pesable && (
                              <span className="text-[9px] bg-emerald-500/20 text-emerald-600 font-extrabold px-1 rounded">
                                ⚖️ Balanza ({item.quantity.toFixed(3)} KG)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className={`py-2 px-2 text-right font-posMono tabular-nums font-semibold ${textBody}`}>
                          {formatPYG(item.precio)}
                        </td>
                        <td className="py-2 px-2 text-right font-posMono tabular-nums font-black text-emerald-600">
                          {formatPYG(lineTotal)}
                        </td>
                        <td className="py-2 px-1 text-center">
                          <button
                            onClick={() => removeFromCart(item.id)}
                            title="Eliminar producto (Requiere Supervisor)"
                            className="text-rose-500 hover:text-rose-400 p-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Panel de Totales y Liquidación */}
          <div className={`p-3 border-t space-y-2 shrink-0 ${bgInner}`}>
            <div className="flex items-baseline justify-between">
              <span className={`text-xs font-bold uppercase tracking-wider ${textMuted}`}>Total a Cobrar:</span>
              <div className="text-right">
                <div className="text-2xl lg:text-3xl font-black font-posMono tabular-nums text-emerald-600 tracking-tight">
                  {formatPYG(totalPyg)}
                </div>
                <div className="flex justify-end gap-3 font-posMono tabular-nums text-xs font-black text-slate-500 mt-0.5">
                  <span className="flex items-center gap-1"><FlagBR /> R$ <strong>{totalBrl}</strong></span>
                  <span className="flex items-center gap-1"><FlagUS /> US$ <strong>{totalUsd}</strong></span>
                </div>
              </div>
            </div>

            {/* Botón Principal de Cobro */}
            <div className="grid grid-cols-4 gap-1.5 pt-1">
              <button
                onClick={pauseCurrentSale}
                disabled={cart.length === 0}
                className={`py-2 px-2 rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-0.5 border transition-all cursor-pointer ${
                  cart.length === 0
                    ? "opacity-50 cursor-not-allowed border-slate-700 text-slate-500"
                    : dark
                    ? "bg-slate-800 hover:bg-slate-700 text-amber-400 border-slate-700"
                    : "bg-slate-200 hover:bg-slate-300 text-amber-700 border-slate-300"
                }`}
              >
                <Pause className="w-3.5 h-3.5" />
                <span className="text-[10px]">F6 Pausa</span>
              </button>

              <button
                onClick={() => setShowPausedModal(true)}
                disabled={pausedSales.length === 0}
                className={`py-2 px-2 rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-0.5 border transition-all cursor-pointer ${
                  pausedSales.length === 0
                    ? "opacity-50 cursor-not-allowed border-slate-700 text-slate-500"
                    : dark
                    ? "bg-slate-800 hover:bg-slate-700 text-blue-400 border-slate-700"
                    : "bg-slate-200 hover:bg-slate-300 text-blue-700 border-slate-300"
                }`}
              >
                <Play className="w-3.5 h-3.5" />
                <span className="text-[10px]">F7 ({pausedSales.length})</span>
              </button>

              <button
                onClick={handleOpenPayment}
                disabled={cart.length === 0}
                className={`col-span-2 py-2 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer ${
                  cart.length === 0
                    ? "bg-slate-700 text-slate-400 opacity-50 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white active:scale-98"
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>COBRAR (F12)</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── COLUMNA DERECHA: FOTO HD, BUSCADOR Y CATÁLOGO POR CATEGORÍAS ── */}
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          
          {/* Panel Superior: Visor de Foto HD + Buscador de Código de Barras */}
          <div className={`p-3 rounded-xl border flex gap-3 shrink-0 ${bgPanel}`}>
            
            {/* Visor de Foto HD del Último Producto */}
            <div 
              onClick={() => {
                if (lastScannedProduct?.imagen_url) {
                  setLightboxImage({
                    url: lastScannedProduct.imagen_url.startsWith("http") ? lastScannedProduct.imagen_url : `${API_ORIGIN}${lastScannedProduct.imagen_url}`,
                    nombre: lastScannedProduct.nombre,
                    sku: lastScannedProduct.sku,
                    precio: Number(lastScannedProduct.precio_venta) || 0
                  })
                }
              }}
              title="Haga clic para ampliar fotografía en HD"
              className={`w-36 h-36 lg:w-40 lg:h-40 rounded-xl overflow-hidden shrink-0 border flex items-center justify-center relative cursor-pointer group shadow-sm ${bgInner}`}
            >
              {lastScannedProduct?.imagen_url ? (
                <>
                  <img
                    src={lastScannedProduct.imagen_url.startsWith("http") ? lastScannedProduct.imagen_url : `${API_ORIGIN}${lastScannedProduct.imagen_url}`}
                    alt={lastScannedProduct.nombre}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1">
                    <ZoomIn className="w-4 h-4" />
                    <span>Zoom</span>
                  </div>
                </>
              ) : (
                <div className={`flex flex-col items-center justify-center text-center p-2 ${textMuted}`}>
                  <Package className="w-10 h-10 mb-1 opacity-30" />
                  <span className="text-[10px] font-bold">FOTO DEL PRODUCTO</span>
                </div>
              )}
            </div>

            {/* Info del Último Producto Escaneado + Input Buscador */}
            <div className="flex-1 flex flex-col justify-between min-w-0">
              <div>
                <div className={`text-[11px] font-bold uppercase tracking-wider ${textMuted}`}>
                  ÚLTIMO PRODUCTO ESCANEADO
                </div>
                <div className={`font-black text-sm lg:text-base truncate mt-0.5 ${textHeading}`}>
                  {lastScannedProduct ? lastScannedProduct.nombre : "LISTO PARA ESCANEAR"}
                </div>
                {lastScannedProduct && (
                  <div className="flex items-center gap-3 mt-1 font-posMono tabular-nums">
                    <span className="text-xl lg:text-2xl font-black text-emerald-600">
                      {formatPYG(Number(lastScannedProduct.precio_venta) || 0)}
                    </span>
                    <span className="text-xs font-bold text-amber-600">
                      M: {formatPYG(Math.round((Number(lastScannedProduct.precio_venta) || 0) * 0.93))}
                    </span>
                    <span className={`text-xs font-bold ${textMuted}`}>
                      Stock: {stockMap[lastScannedProduct.id] ?? 0} UN
                    </span>
                  </div>
                )}
              </div>

              {/* Formulario de Escaneo con Soporte PLU y Backend */}
              <form onSubmit={handleBarcodeSubmit} className="relative mt-2">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Escanear código de barras o buscar por nombre (F2)..."
                  className={`w-full py-2.5 pl-9 pr-24 rounded-xl border text-xs font-bold outline-none transition-all shadow-xs ${
                    dark 
                      ? "bg-slate-950 border-slate-700 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                      : "bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  }`}
                />
                <ScanLine className={`w-4 h-4 absolute left-3 top-3 ${textMuted}`} />
                <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
                  {searchingServer && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                  <button
                    type="submit"
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[11px] font-bold cursor-pointer"
                  >
                    Enter
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Panel Inferior: Pestañas de Categorías y Catálogo */}
          <div className={`flex-1 p-2 rounded-xl border flex flex-col min-h-0 overflow-hidden ${bgPanel}`}>
            
            {/* Pestañas de Categorías */}
            <div className="flex items-center justify-between gap-1 border-b pb-2 shrink-0 overflow-x-auto">
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                {CATEGORY_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setSelectedCategoryTab(tab.key)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black whitespace-nowrap transition-all cursor-pointer ${
                      selectedCategoryTab === tab.key
                        ? "bg-blue-600 text-white shadow-xs"
                        : dark
                        ? "bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white"
                        : "bg-slate-200 text-slate-700 hover:bg-slate-300 hover:text-slate-900"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Selector de Vista (Tabla vs Tarjetas) */}
              <div className="flex items-center gap-1 shrink-0 ml-1">
                <button
                  onClick={() => setViewMode(viewMode === "table" ? "cards" : "table")}
                  title={viewMode === "table" ? "Cambiar a Vista Tarjetas" : "Cambiar a Vista Tabla"}
                  className={`p-1.5 rounded-lg border font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer ${
                    viewMode === "table" ? "bg-blue-600/20 text-blue-600 border-blue-500/40" : "bg-slate-200 text-slate-700 border-slate-300"
                  }`}
                >
                  {viewMode === "table" ? <ListFilter className="w-3.5 h-3.5" /> : <LayoutGrid className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Listado de Productos: MODO TABLA O MODO TARJETAS */}
            <div className="flex-1 overflow-y-auto min-h-0 pt-1.5">
              {filteredProducts.length === 0 ? (
                <div className={`h-full flex flex-col items-center justify-center text-xs py-8 ${textMuted}`}>
                  <Package className="w-8 h-8 mb-1 opacity-50" />
                  <span>No se encontraron productos con ese filtro</span>
                </div>
              ) : viewMode === "table" ? (
                
                /* ── MODO TABLA: DESCRIPCIÓN, STOCK Y ESCALAS DE PRECIO ─────────── */
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className={`text-[10px] font-black uppercase tracking-wider border-b ${
                      dark ? "text-slate-400 bg-slate-950/40 border-slate-800" : "text-slate-700 bg-slate-200 border-slate-300"
                    }`}>
                      <th className="py-1.5 px-2">Producto / SKU</th>
                      <th className="py-1.5 px-2 text-center">Stock</th>
                      <th className="py-1.5 px-2 text-right">Minorista (1-5)</th>
                      <th className="py-1.5 px-2 text-right text-amber-600">Mayorista (6+)</th>
                      <th className="py-1.5 px-2 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${dark ? "divide-slate-800/40" : "divide-slate-200"}`}>
                    {filteredProducts.map((p) => {
                      const pVenta = Number(p.precio_venta) || 0
                      const pMayor = Math.round(pVenta * 0.93)
                      const isPesable = (p as any).tipo_venta === "peso" || (p.nombre || "").toUpperCase().includes("KG")

                      return (
                        <tr
                          key={p.id}
                          onClick={() => addToCart(p)}
                          className={`group cursor-pointer transition-colors ${
                            dark ? "hover:bg-blue-600/10" : "hover:bg-blue-50"
                          }`}
                        >
                          <td className="py-2 px-2">
                            <div className={`font-bold text-xs group-hover:text-blue-600 truncate max-w-[190px] ${textHeading}`}>
                              {p.nombre}
                            </div>
                            <div className={`text-[10px] font-posMono tabular-nums flex items-center gap-1.5 ${textMuted}`}>
                              <span>SKU: {p.sku}</span>
                              {isPesable && (
                                <span className="text-[9px] bg-emerald-500/20 text-emerald-600 font-extrabold px-1 rounded">
                                  ⚖️ KG
                                </span>
                              )}
                            </div>
                          </td>
                          <td className={`py-2 px-2 text-center font-posMono tabular-nums font-bold ${textBody}`}>
                            {stockMap[p.id] ?? 0} UN
                          </td>
                          <td className="py-2 px-2 text-right font-posMono tabular-nums font-black text-emerald-600">
                            {formatPYG(pVenta)}
                          </td>
                          <td className="py-2 px-2 text-right font-posMono tabular-nums font-bold text-amber-600">
                            {formatPYG(pMayor)}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                addToCart(p)
                              }}
                              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[11px] font-bold shadow-xs cursor-pointer active:scale-95"
                            >
                              + Agregar
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : (
                
                /* ── MODO TARJETAS CON ESCALA DE PRECIOS ────────────────────────── */
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                  {filteredProducts.map((p) => {
                    const pVenta = Number(p.precio_venta) || 0
                    const pMayor = Math.round(pVenta * 0.93)
                    const isPesable = (p as any).tipo_venta === "peso" || (p.nombre || "").toUpperCase().includes("KG")

                    return (
                      <button
                        key={p.id}
                        onClick={() => addToCart(p)}
                        className={`border rounded-xl p-2 text-left flex flex-col justify-between transition-all group active:scale-98 cursor-pointer ${
                          dark 
                            ? "bg-slate-950/80 hover:bg-slate-800/80 border-slate-800 hover:border-blue-500/50" 
                            : "bg-white hover:bg-blue-50/50 border-slate-300 hover:border-blue-500 shadow-xs"
                        }`}
                      >
                        <div className={`w-full h-20 rounded-lg overflow-hidden mb-1 flex items-center justify-center border relative ${bgInner}`}>
                          {p.imagen_url ? (
                            <img
                              src={p.imagen_url.startsWith("http") ? p.imagen_url : `${API_ORIGIN}${p.imagen_url}`}
                              alt={p.nombre}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <Package className="w-8 h-8 opacity-40" />
                          )}
                          {isPesable && (
                            <span className="absolute top-1 right-1 bg-emerald-600 text-white text-[8px] font-black px-1 rounded">
                              KG
                            </span>
                          )}
                        </div>
                        <div>
                          <div className={`font-bold text-xs line-clamp-1 group-hover:text-blue-600 transition-colors ${textHeading}`}>
                            {p.nombre}
                          </div>
                          <div className="flex items-center justify-between mt-1 font-posMono tabular-nums">
                            <span className="font-black text-xs text-emerald-600">
                              {formatPYG(pVenta)}
                            </span>
                            <span className="font-bold text-[10px] text-amber-600">
                              M: {formatPYG(pMayor)}
                            </span>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. MODAL OBLIGATORIO DE APERTURA DE CAJA AL INICIAR SESIÓN ───────── */}
      {showAperturaModal && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border-2 border-blue-500 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-fade-in text-slate-900 dark:text-slate-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-brand-orange flex items-center justify-center text-[#1C1710] font-black shadow-sm shadow-orange-500/30">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white font-posDisplay tracking-tight">Apertura de Turno de Caja</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Seleccione la caja e ingrese el fondo inicial de sencillo.</p>
              </div>
            </div>

            <form onSubmit={handleConfirmAperturaCaja} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Terminal de Caja a Habilitar:
                </label>
                {terminalAssignment ? (
                  <div className="w-full bg-slate-50 dark:bg-slate-950 border border-emerald-600/60 rounded-xl p-2.5 text-sm text-slate-900 dark:text-white font-bold flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-emerald-500" />
                      {terminalAssignment.caja_nombre} (Punto {terminalAssignment.punto_emision})
                    </span>
                    <span className="text-[10px] text-slate-500 font-posMono tabular-nums">{machineHostname}</span>
                  </div>
                ) : terminalAssignmentChecked && machineHostname ? (
                  <div className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 border-l-4 border-l-amber-500 rounded-xl p-2.5 text-xs text-amber-700 dark:text-amber-300 space-y-1.5">
                    <div>Esta máquina (<span className="font-posMono tabular-nums font-bold">{machineHostname}</span>) no tiene una caja asignada todavía.</div>
                    <button
                      type="button"
                      onClick={() => { setAssignCajaNombre(""); setShowAssignTerminalModal(true) }}
                      className="text-[11px] font-bold text-blue-600 dark:text-blue-400 underline cursor-pointer"
                    >
                      Asignar esta caja (requiere supervisor)
                    </button>
                  </div>
                ) : (
                  <select
                    value={puntoEmision}
                    onChange={(e) => setPuntoEmision(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm text-slate-900 dark:text-white font-bold outline-none focus:border-blue-500"
                  >
                    {PUNTOS_EMISION.map((pe) => (
                      <option key={pe.id} value={pe.id} className="bg-white dark:bg-slate-900">
                        {pe.nombre}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase block">
                  Fondo Fijo Inicial en Efectivo (Sencillo):
                </span>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <FlagPY /> Guaraníes (₲):
                  </label>
                  <input
                    type="text"
                    value={montoAperturaPyg}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/\D/g, "")
                      if (!clean) {
                        setMontoAperturaPyg("")
                        return
                      }
                      const num = parseInt(clean, 10)
                      setMontoAperturaPyg(num.toLocaleString("es-PY"))
                    }}
                    placeholder="300.000"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 font-posMono tabular-nums font-black text-base text-emerald-600 dark:text-emerald-400 outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <FlagBR /> Reales (R$):
                    </label>
                    <input
                      type="text"
                      value={montoAperturaBrl}
                      onChange={(e) => setMontoAperturaBrl(e.target.value.replace(/[^0-9.,]/g, ""))}
                      placeholder="100,00"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 font-posMono tabular-nums font-bold text-sm text-amber-600 dark:text-amber-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <FlagUS /> Dólares (US$):
                    </label>
                    <input
                      type="text"
                      value={montoAperturaUsd}
                      onChange={(e) => setMontoAperturaUsd(e.target.value.replace(/[^0-9.,]/g, ""))}
                      placeholder="0,00"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 font-posMono tabular-nums font-bold text-sm text-blue-600 dark:text-blue-400 outline-none"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-brand-orange hover:brightness-95 text-[#1C1710] font-black py-3 rounded-xl shadow-lg shadow-orange-500/30 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Confirmar Apertura e Iniciar Cobros</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── 4. MODAL DE CONFIGURACIÓN Y DIAGNÓSTICO DE BALANZA (F3) ──────────── */}
      {showScaleModal && (
        <div className="fixed inset-0 z-[110] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl max-w-md w-full p-5 shadow-2xl text-slate-900 dark:text-slate-100 animate-fade-in">
            <div className="flex items-center justify-between mb-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-orange flex items-center justify-center text-[#1C1710] shrink-0 shadow-sm shadow-orange-500/30">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900 dark:text-white font-posDisplay tracking-tight">Balanza de Checkout (Balmak BCK30)</h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Configuración de puerto serie y prueba de transmisión</p>
                </div>
              </div>
              <button onClick={() => setShowScaleModal(false)} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Display de Peso en Vivo */}
            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-center mb-4">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                PESO ACTUAL EN BALANZA
              </span>
              <div className="text-4xl font-black font-posMono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
                {currentScaleWeight.toFixed(3)} <span className="text-lg text-slate-500 dark:text-slate-400">KG</span>
              </div>
              <span className="text-[10px] font-posMono tabular-nums text-slate-500 dark:text-slate-400 mt-1 block">
                Estado: <strong className={scaleUsbConnected ? (isScaleStable ? "text-emerald-400" : "text-amber-400") : "text-slate-500"}>
                  {scaleUsbConnected ? (isScaleStable ? `CONECTADA (${scalePortName} · ESTABLE)` : `TRANSMITIENDO (${scalePortName})...`) : "DESCONECTADA"}
                </strong>
              </span>
            </div>

            {/* Selector de Puerto COM y BaudRate */}
            <div className="space-y-3 mb-4">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Puerto COM:</label>
                  <select
                    value={scalePortName}
                    onChange={(e) => setScalePortName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-posMono tabular-nums font-bold text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  >
                    {['COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'COM10'].map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Velocidad (Baud):</label>
                  <select
                    value={scaleBaudRate}
                    onChange={(e) => setScaleBaudRate(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-posMono tabular-nums font-bold text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  >
                    <option value={9600}>9600 bps (Balmak/Toledo)</option>
                    <option value={4800}>4800 bps</option>
                    <option value={2400}>2400 bps (Filizola)</option>
                  </select>
                </div>
              </div>

              {/* Registro de Telemetría RAW */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Registro de Datos Serial:</label>
                <div className="w-full h-16 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 font-posMono tabular-nums text-[10px] text-emerald-600 dark:text-emerald-400 overflow-y-auto whitespace-pre-line">
                  {scaleRawLog}
                </div>
              </div>
            </div>

            {/* Botones de Acción */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if ((window as any).electronAPI?.startScaleStream) {
                    (window as any).electronAPI.startScaleStream(scalePortName, scaleBaudRate)
                    toast.success("Lector Iniciado", `Monitoreando ${scalePortName} (${scaleBaudRate} bps)`)
                  }
                }}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
              >
                <Activity className="w-4 h-4" />
                <span>Reconectar Balanza</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 5. MODAL REACTIVO DE PESAJE DE BALANZA (CON AUTO-CONFIRMACIÓN) ──────── */}
      {showManualWeightModal && (
        <div className="fixed inset-0 z-[115] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border-2 border-emerald-500 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-900 dark:text-slate-100 animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-orange flex items-center justify-center text-[#1C1710] shrink-0 shadow-sm shadow-orange-500/30">
                  <Scale className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900 dark:text-white font-posDisplay tracking-tight">Balanza de Checkout · Pesaje</h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Coloque el producto sobre el plato para pesaje instantáneo</p>
                </div>
              </div>
              <button onClick={() => setShowManualWeightModal(false)} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {targetWeighProduct && (
              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 mb-4">
                <div className="font-black text-sm text-slate-900 dark:text-white">{targetWeighProduct.nombre}</div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs font-posMono tabular-nums text-emerald-600 dark:text-emerald-400 font-bold">
                    Precio: {formatPYG(Number(targetWeighProduct.precio_venta) || 0)} / KG
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">SKU: {targetWeighProduct.sku}</span>
                </div>
              </div>
            )}

            {/* Display Reactivo de Balanza en Vivo */}
            <div className={`p-4 rounded-xl border mb-4 text-center transition-all ${
              currentScaleWeight > 0.015
                ? (isScaleStable ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 shadow-md" : "bg-amber-50 dark:bg-amber-950/40 border-amber-500 animate-pulse")
                : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
            }`}>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                {currentScaleWeight > 0.015
                  ? (isScaleStable ? "✓ ESTABILIZADO · INSERTANDO AUTOMÁTICAMENTE..." : "PESANDO... ESTABILICE EL PRODUCTO")
                  : "COLOQUE EL PRODUCTO EN EL PLATO DE LA BALANZA"}
              </span>
              <div className="text-5xl font-black font-posMono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
                {currentScaleWeight > 0.015 ? currentScaleWeight.toFixed(3) : (manualWeightInput || "0.000")} <span className="text-lg text-slate-500 dark:text-slate-400">KG</span>
              </div>
              {targetWeighProduct && (
                <div className="text-sm font-posMono tabular-nums font-bold text-emerald-300 mt-1">
                  Subtotal: {formatPYG(Math.round(((currentScaleWeight > 0.015 ? currentScaleWeight : parseFloat(manualWeightInput || "0")) * (Number(targetWeighProduct.precio_venta) || 0))))}
                </div>
              )}
            </div>

            {/* Opción de ingreso manual si la balanza no está conectada */}
            <div className="mb-4">
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">
                O ingrese peso manual:
              </label>
              <input
                type="text"
                value={manualWeightInput}
                onChange={(e) => setManualWeightInput(e.target.value)}
                placeholder="0.455"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 font-posMono tabular-nums font-black text-lg text-emerald-600 dark:text-emerald-400 outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowManualWeightModal(false)}
                className="py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmManualWeight}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg cursor-pointer active:scale-98"
              >
                <Check className="w-4 h-4" />
                <span>Confirmar Manualmente [ENTER]</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 6. MODAL DE ASIGNACIÓN DE TERMINALES POS (BANCARD & DINELCO) POR CAJA ─ */}
      {showPosConfigModal && (
        <div className="fixed inset-0 z-[120] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl max-w-xl w-full p-6 shadow-2xl text-slate-900 dark:text-slate-100 animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-orange flex items-center justify-center text-[#1C1710] shrink-0 shadow-sm shadow-orange-500/30">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white font-posDisplay tracking-tight">Asignación de Terminales POS a Cajas</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Configure qué terminal Bancard y Dinelco corresponde a cada punto de emisión.</p>
                </div>
              </div>
              <button onClick={() => setShowPosConfigModal(false)} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePosAssignments} className="space-y-4">
              <div className="space-y-3">
                {PUNTOS_EMISION.map((pe) => {
                  const cfg = posAssignments[pe.id] || {
                    puntoEmision: pe.id,
                    nombreCaja: pe.nombre,
                    bancardTerminalId: "BC-984401",
                    bancardLote: "001",
                    bancardPort: "COM4",
                    dinelcoTerminalId: "DN-872101",
                    dinelcoLote: "001",
                    dinelcoPort: "COM7"
                  }

                  const isCurrent = pe.id === puntoEmision

                  return (
                    <div 
                      key={pe.id} 
                      className={`p-3 rounded-xl border transition-all ${
                        isCurrent
                          ? "bg-blue-50 dark:bg-blue-950/30 border-blue-500/60 shadow-xs"
                          : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900 dark:text-white">{pe.nombre}</span>
                          {isCurrent && <span className="text-[9px] bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold px-1.5 py-0.5 rounded">Caja Activa</span>}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {/* Config Bancard */}
                        <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1.5">
                          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase block">Bancard Infonet POS:</span>
                          <div className="grid grid-cols-2 gap-1.5">
                            <div>
                              <label className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Terminal ID:</label>
                              <input
                                type="text"
                                value={cfg.bancardTerminalId}
                                onChange={(e) => {
                                  const val = e.target.value
                                  setPosAssignments(prev => ({
                                    ...prev,
                                    [pe.id]: { ...cfg, bancardTerminalId: val }
                                  }))
                                }}
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 font-posMono tabular-nums text-xs text-slate-900 dark:text-white outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Lote Inicial:</label>
                              <input
                                type="text"
                                value={cfg.bancardLote}
                                onChange={(e) => {
                                  const val = e.target.value
                                  setPosAssignments(prev => ({
                                    ...prev,
                                    [pe.id]: { ...cfg, bancardLote: val }
                                  }))
                                }}
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 font-posMono tabular-nums text-xs text-slate-900 dark:text-white outline-none"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Config Dinelco */}
                        <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1.5">
                          <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase block">Dinelco BEPSA POS:</span>
                          <div className="grid grid-cols-2 gap-1.5">
                            <div>
                              <label className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Terminal ID:</label>
                              <input
                                type="text"
                                value={cfg.dinelcoTerminalId}
                                onChange={(e) => {
                                  const val = e.target.value
                                  setPosAssignments(prev => ({
                                    ...prev,
                                    [pe.id]: { ...cfg, dinelcoTerminalId: val }
                                  }))
                                }}
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 font-posMono tabular-nums text-xs text-slate-900 dark:text-white outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Lote Inicial:</label>
                              <input
                                type="text"
                                value={cfg.dinelcoLote}
                                onChange={(e) => {
                                  const val = e.target.value
                                  setPosAssignments(prev => ({
                                    ...prev,
                                    [pe.id]: { ...cfg, dinelcoLote: val }
                                  }))
                                }}
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 font-posMono tabular-nums text-xs text-slate-900 dark:text-white outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPosConfigModal(false)}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-brand-orange hover:brightness-95 text-[#1C1710] font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-orange-500/30 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar Asignaciones de POS</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── SOLICITUD DE AUTORIZACIÓN REMOTA (SIN SUPERVISOR EN ESTA CAJA) ──── */}
      {showRemoteAuthModal && (
        <div className="fixed inset-0 z-[125] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border-2 border-brand-orange rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-900 dark:text-slate-100 animate-fade-in text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-brand-orange flex items-center justify-center text-[#1C1710] shadow-lg shadow-orange-500/30 animate-pulse">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-black font-posDisplay tracking-tight mb-1">Esperando Autorización</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Se envió el pedido a la app de supervisora — se aprueba desde ahí, en cualquier celular con turno activo.
            </p>
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 mb-4 text-left text-xs font-bold text-slate-700 dark:text-slate-300">
              {pendingSupervisorAction && describeSupervisorAction(pendingSupervisorAction)}
            </div>
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400 mb-5">
              <Loader2 className="w-4 h-4 animate-spin" /> Esperando respuesta…
            </div>

            {remoteAuthLocalSupervisorAvailable && (
              <button
                onClick={async () => {
                  if (remoteAuthRequestId) {
                    try { await api.supervisorRequests.resolve(remoteAuthRequestId, { aprobado: false, resuelto_por: user?.id || "", resuelto_por_nombre: "Resuelto localmente en caja" }) } catch {}
                  }
                  setShowRemoteAuthModal(false)
                  setRemoteAuthRequestId(null)
                  setSupervisorPin("")
                  setSupervisorEmail("")
                  setShowSupervisorModal(true)
                }}
                className="w-full py-3 rounded-xl bg-brand-orange hover:brightness-95 text-[#1C1710] font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-orange-500/30 cursor-pointer mb-2"
              >
                <KeyRound className="w-4 h-4" /> Tengo un supervisor acá — escribir clave
              </button>
            )}
            <button
              onClick={async () => {
                if (remoteAuthRequestId) {
                  try { await api.supervisorRequests.resolve(remoteAuthRequestId, { aprobado: false, resuelto_por: user?.id || "", resuelto_por_nombre: "Cancelado por el cajero" }) } catch {}
                }
                setShowRemoteAuthModal(false)
                setRemoteAuthRequestId(null)
              }}
              className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs cursor-pointer"
            >
              Cancelar solicitud
            </button>
          </div>
        </div>
      )}

      {/* ── 7. MODAL DE AUTORIZACIÓN DE SUPERVISOR (SEGURIDAD DE CAJA) ──────── */}
      {showSupervisorModal && (
        <div className="fixed inset-0 z-[125] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border-2 border-rose-500 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-900 dark:text-slate-100 animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-brand-orange flex items-center justify-center text-[#1C1710] font-black shadow-sm shadow-orange-500/30">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white font-posDisplay tracking-tight">Autorización Requerida de Supervisor</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Esta acción modifica parámetros o anula ítems registrados.</p>
              </div>
            </div>

            <form onSubmit={handleConfirmSupervisorPin} className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">
                  Acción a Autorizar:
                </span>
                <div className="font-bold text-xs text-rose-600 dark:text-rose-400">
                  {pendingSupervisorAction?.type === "clear_cart"
                    ? "❌ Cancelación / Anulación de Toda la Venta"
                    : pendingSupervisorAction?.type === "open_pos_config"
                    ? "⚙️ Configuración y Asignación de Terminales POS"
                    : pendingSupervisorAction?.type === "process_return"
                    ? "↩️ Devolución de Cliente (afecta stock y caja)"
                    : "🗑️ Eliminación / Disminución de Producto del Carrito"}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">Motivo:</label>
                <select
                  value={supervisorReason}
                  onChange={(e) => setSupervisorReason(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white font-bold outline-none focus:border-rose-500"
                >
                  <option value="Error de escaneo / digitación">Error de escaneo / digitación</option>
                  <option value="Cliente desistió de comprar el producto">Cliente desistió de comprar el producto</option>
                  <option value="Configuración de Terminales POS">Configuración de Terminales POS</option>
                  <option value="Producto dañado / fecha de vencimiento">Producto dañado / fecha de vencimiento</option>
                  <option value="Precio incorrecto en góndola">Precio incorrecto en góndola</option>
                  <option value="Devolución de cliente">Devolución de cliente</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">Supervisor que autoriza:</label>
                <select
                  value={supervisorEmail}
                  onChange={(e) => setSupervisorEmail(e.target.value)}
                  autoFocus
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white font-bold outline-none focus:border-rose-500"
                >
                  <option value="">Seleccione...</option>
                  {supervisorStaffOptions.map((s) => (
                    <option key={s.id} value={s.email}>{s.nombre} ({s.rol})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">Contraseña de Supervisor:</label>
                <input
                  type="password"
                  value={supervisorPin}
                  onChange={(e) => setSupervisorPin(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 font-posMono tabular-nums font-black text-xl text-center tracking-widest text-rose-600 dark:text-rose-400 outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowSupervisorModal(false)
                    setPendingSupervisorAction(null)
                  }}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Rechazar / Cancelar
                </button>
                <button
                  type="submit"
                  disabled={verifyingSupervisor}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg cursor-pointer"
                >
                  {verifyingSupervisor ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  <span>{verifyingSupervisor ? "Verificando..." : "Aprobar Acción"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DEVOLUCIÓN DE CLIENTE (búsqueda de venta → ítems → autorización) ── */}
      {showDevolucionModal && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border-2 border-rose-500 rounded-2xl max-w-2xl w-full p-6 shadow-2xl animate-fade-in text-slate-900 dark:text-slate-100 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-orange flex items-center justify-center text-[#1C1710] font-black shadow-sm shadow-orange-500/30">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white font-posDisplay tracking-tight">Devolución de Cliente</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {devolucionStep === "buscar" ? "Busque la venta original por número." : `Venta ${devolucionSaleSeleccionada?.numero || ""}`}
                  </p>
                </div>
              </div>
              <button onClick={closeDevolucionModal} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {devolucionStep === "buscar" ? (
              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="relative mb-3 shrink-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    autoFocus
                    type="text"
                    value={devolucionSearch}
                    onChange={(e) => setDevolucionSearch(e.target.value)}
                    placeholder="Filtrar por número de comprobante..."
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-900 dark:text-white font-bold outline-none focus:border-rose-500"
                  />
                </div>

                {devolucionSalesLoading ? (
                  <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-xs flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Cargando ventas...
                  </div>
                ) : devolucionSalesFiltradas.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-xs">No se encontraron ventas.</div>
                ) : (
                  <div className="divide-y divide-slate-800/50">
                    {devolucionSalesFiltradas.map((sale) => (
                      <button
                        key={sale.id}
                        onClick={() => handleSelectVentaDevolucion(sale)}
                        className="w-full flex items-center justify-between gap-3 py-2.5 px-1 hover:bg-slate-100 dark:hover:bg-slate-800/40 rounded-lg text-left cursor-pointer"
                      >
                        <div>
                          <div className="font-bold text-sm text-slate-900 dark:text-white">Nº {sale.numero}</div>
                          <div className="text-[10px] font-posMono tabular-nums text-slate-500 dark:text-slate-400">
                            {sale.fecha ? new Date(sale.fecha).toLocaleString("es-PY") : ""}
                          </div>
                        </div>
                        <div className="font-black text-rose-600 dark:text-rose-400 font-posMono tabular-nums shrink-0">{formatPYG(Number((sale as any).total) || 0)}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
                <button
                  onClick={() => setDevolucionStep("buscar")}
                  className="text-xs text-rose-600 dark:text-rose-400 font-bold mb-3 flex items-center gap-1 cursor-pointer shrink-0"
                >
                  ← Elegir otra venta
                </button>

                {devolucionItemsLoading ? (
                  <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-xs flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Cargando ítems...
                  </div>
                ) : devolucionItems.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-xs">Esta venta no tiene ítems.</div>
                ) : (
                  <>
                    <div className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2 shrink-0">
                      Ítems a devolver:
                    </div>
                    <div className="space-y-1.5 mb-3">
                      {devolucionItems.map((it) => {
                        const checked = !!devolucionSeleccion[it.id]
                        return (
                          <div
                            key={it.id}
                            className={`flex items-center gap-3 rounded-lg px-3 py-2 border ${checked ? "bg-rose-50 dark:bg-rose-500/10 border-rose-500/40" : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleDevolucionItem(it.id, it.cantidad)}
                              className="w-4 h-4 accent-rose-500 cursor-pointer"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-xs text-slate-900 dark:text-white truncate">{it.productName}</div>
                              <div className="text-[10px] font-posMono tabular-nums text-slate-500 dark:text-slate-400">
                                Vendido: {it.cantidad} x {formatPYG(it.precio_unitario)}
                              </div>
                            </div>
                            {checked && (
                              <input
                                type="number"
                                min={0}
                                max={it.cantidad}
                                step={1}
                                value={devolucionSeleccion[it.id]}
                                onChange={(e) => setDevolucionCantidad(it.id, Number(e.target.value), it.cantidad)}
                                className="w-16 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-posMono tabular-nums font-bold text-slate-900 dark:text-white text-center outline-none focus:border-rose-500"
                              />
                            )}
                          </div>
                        )
                      })}
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-3 shrink-0">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">Motivo:</label>
                        <select
                          value={devolucionMotivo}
                          onChange={(e) => setDevolucionMotivo(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2 text-xs text-slate-900 dark:text-white font-bold outline-none focus:border-rose-500"
                        >
                          <option value="producto_defectuoso">Producto defectuoso</option>
                          <option value="producto_equivocado">Producto equivocado</option>
                          <option value="vencimiento">Vencimiento</option>
                          <option value="dano_transporte">Daño de transporte</option>
                          <option value="cliente_insatisfecho">Cliente insatisfecho</option>
                          <option value="error_venta">Error de venta</option>
                          <option value="devolucion_voluntaria">Devolución voluntaria</option>
                          <option value="garantia">Garantía</option>
                          <option value="otro">Otro</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">Condición del producto:</label>
                        <select
                          value={devolucionCondicion}
                          onChange={(e) => setDevolucionCondicion(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2 text-xs text-slate-900 dark:text-white font-bold outline-none focus:border-rose-500"
                        >
                          <option value="buen_estado">Buen estado (vuelve a stock)</option>
                          <option value="defectuoso">Defectuoso</option>
                          <option value="danado">Dañado</option>
                          <option value="vencido">Vencido</option>
                          <option value="incompleto">Incompleto</option>
                        </select>
                      </div>
                    </div>

                    <div className="mb-3 shrink-0">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">Observaciones (opcional):</label>
                      <input
                        type="text"
                        value={devolucionObservaciones}
                        onChange={(e) => setDevolucionObservaciones(e.target.value)}
                        placeholder="Detalle adicional..."
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-rose-500"
                      />
                    </div>

                    <button
                      onClick={() => requestSupervisorAuthorization({ type: "process_return" })}
                      disabled={devolucionSubmitting || Object.keys(devolucionSeleccion).length === 0}
                      className="w-full py-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg cursor-pointer shrink-0"
                    >
                      {devolucionSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
                      <span>{devolucionSubmitting ? "Procesando..." : "Solicitar Autorización y Confirmar Devolución"}</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ASIGNAR ESTA MÁQUINA A UNA CAJA FIJA (requiere supervisor) ──────── */}
      {showAssignTerminalModal && (
        <div className="fixed inset-0 z-[130] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border-2 border-blue-500 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-fade-in text-slate-900 dark:text-slate-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-brand-orange flex items-center justify-center text-[#1C1710] font-black shadow-sm shadow-orange-500/30">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white font-posDisplay tracking-tight">Asignar Esta Caja</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Máquina: <span className="font-posMono tabular-nums font-bold text-slate-900 dark:text-white">{machineHostname}</span>. Una vez asignada, esta máquina siempre abrirá con la misma caja y punto de emisión, sin importar quién inicie sesión.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Punto de Emisión:</label>
                <select
                  value={assignPuntoEmision}
                  onChange={(e) => setAssignPuntoEmision(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm text-slate-900 dark:text-white font-bold outline-none focus:border-blue-500"
                >
                  {PUNTOS_EMISION.map((pe) => (
                    <option key={pe.id} value={pe.id.replace(/^001-/, "")} className="bg-white dark:bg-slate-900">
                      {pe.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Nombre de la Caja (opcional):</label>
                <input
                  type="text"
                  value={assignCajaNombre}
                  onChange={(e) => setAssignCajaNombre(e.target.value)}
                  placeholder={`Caja ${assignPuntoEmision}`}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAssignTerminalModal(false)}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAssignTerminalModal(false)
                    requestSupervisorAuthorization({ type: "assign_terminal" })
                  }}
                  className="flex-1 py-3 bg-brand-orange hover:brightness-95 text-[#1C1710] font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-orange-500/30 cursor-pointer"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>Autorizar y Asignar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 8. MODAL DE COBRO MULTIMONEDA & PASARELAS POS BANCARD / DINELCO (F12) ── */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl text-slate-900 dark:text-slate-100 animate-fade-in max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-orange flex items-center justify-center text-[#1C1710] shrink-0 shadow-sm shadow-orange-500/30 font-posDisplay font-black">₲</div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white font-posDisplay tracking-tight">Liquidación y Cobro de Venta</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Seleccione la forma de pago, moneda o terminal POS integrada.</p>
                </div>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Display de Totales y Vuelto -- el número que importa de
                verdad en el momento (falta o vuelto) va grande y solo, no
                compitiendo en tamaño con total/recibido que son contexto */}
            <div className="mb-4">
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                  <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase block">Total Venta</span>
                  <div className="text-lg font-black font-posMono tabular-nums text-slate-900 dark:text-white">{formatPYG(totalPyg)}</div>
                  <div className="text-[10px] font-posMono tabular-nums text-slate-500 dark:text-slate-400">R$ {totalBrl} · US$ {totalUsd}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                  <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase block">Recibido</span>
                  <div className="text-lg font-black font-posMono tabular-nums text-blue-600 dark:text-blue-400">{formatPYG(totalRecibidoPyg)}</div>
                </div>
              </div>

              {saldoRestantePyg > 0 ? (
                <div className="relative p-4 rounded-2xl border-2 border-rose-500 bg-rose-50 dark:bg-rose-950/30 text-center overflow-hidden shadow-sm">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-rose-500" />
                  <span className="text-xs font-black text-rose-600 dark:text-rose-300 uppercase tracking-wider block mb-1">Falta Cobrar</span>
                  <div className="text-4xl sm:text-5xl font-black font-posMono tabular-nums text-rose-600 dark:text-rose-400 leading-none">{formatPYG(saldoRestantePyg)}</div>
                  <div className="text-xs font-posMono tabular-nums text-rose-500 dark:text-rose-300/80 mt-2">
                    ≈ R$ {(saldoRestantePyg / rates.BRL).toFixed(2)} · US$ {(saldoRestantePyg / rates.USD).toFixed(2)}
                  </div>
                </div>
              ) : (
                <div className="relative p-4 rounded-2xl border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-center overflow-hidden shadow-sm">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-300 uppercase tracking-wider block mb-1">Vuelto a Entregar</span>
                  <div className="text-4xl sm:text-5xl font-black font-posMono tabular-nums text-emerald-600 dark:text-emerald-400 leading-none">{formatPYG(vueltoPyg)}</div>
                  <div className="text-xs font-posMono tabular-nums text-emerald-500 dark:text-emerald-300/80 mt-2">
                    R$ {(vueltoPyg / rates.BRL).toFixed(2)} · US$ {(vueltoPyg / rates.USD).toFixed(2)}
                  </div>
                </div>
              )}
            </div>

            {/* Pestañas de Métodos de Cobro (Filtrados según configuración en Configuración > Medios de Pago) */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 mb-4">
              {(() => {
                let pMethods: any[] = []
                try {
                  const saved = localStorage.getItem("pos_payment_methods")
                  if (saved) pMethods = JSON.parse(saved)
                } catch (e) {}

                const isEnabled = (key: string) => {
                  if (!pMethods || pMethods.length === 0) return true
                  const found = pMethods.find((p: any) => p.codigo.toUpperCase().includes(key) || key.includes(p.codigo.toUpperCase()))
                  return found ? found.activo !== false : true
                }

                const allTabs = [
                  { id: "cash", label: "Efectivo Multimoneda", icon: Banknote, show: isEnabled("EFECTIVO") },
                  { id: "bancard", label: `POS Bancard (${posTerminalId})`, icon: CreditCard, show: isEnabled("BANCARD") },
                  { id: "dinelco", label: `POS Dinelco (${dinelcoTerminalId})`, icon: CreditCard, show: isEnabled("DINELCO") },
                  { id: "qr", label: "QR / Pix / Extra Club", icon: QrCode, show: isEnabled("QR") || isEnabled("PIX") || isEnabled("EXTRA_CLUB") },
                  { id: "mixed", label: "Pago Mixto", icon: Coins, show: true },
                ]

                return allTabs.filter(t => t.show).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setPaymentTab(m.id as any)
                      setPosVerifyStatus("idle")
                      setPosVerifyCandidates([])
                      setPosVerifiedTxn(null)
                    }}
                    className={`p-2 rounded-xl border font-bold text-[11px] flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      paymentTab === m.id
                        ? "bg-emerald-600 text-white border-emerald-500 shadow-md"
                        : "bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <m.icon className="w-4 h-4" />
                    <span className="text-center leading-tight truncate w-full">{m.label}</span>
                  </button>
                ))
              })()}
            </div>

            {/* Contenido según método de cobro */}
            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 mb-4">
              
              {/* 1. EFECTIVO MULTIMONEDA (CON BANDERA PARAGUAY Y CAMPOS ALINEADOS) */}
              {paymentTab === "cash" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 items-end">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1 mb-1">
                        <FlagPY /> Guaraníes (₲):
                      </label>
                      <input
                        ref={payCashPygInputRef}
                        type="text"
                        value={payCashPyg}
                        onChange={(e) => {
                          const clean = e.target.value.replace(/\D/g, "")
                          setPayCashPyg(clean ? parseInt(clean, 10).toLocaleString("es-PY") : "")
                        }}
                        onKeyDown={(e) => handleCashFieldKeyDown(e, payCashBrlInputRef, "BRL")}
                        onFocus={(e) => e.target.select()}
                        onClick={(e) => e.currentTarget.select()}
                        placeholder="0"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 font-posMono tabular-nums font-black text-sm text-emerald-600 dark:text-emerald-400 outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1 mb-1">
                        <FlagBR /> Reales (R$ x{rates.BRL}):
                      </label>
                      <input
                        ref={payCashBrlInputRef}
                        type="text"
                        value={payCashBrl}
                        onChange={(e) => setPayCashBrl(e.target.value.replace(/[^0-9.,]/g, ""))}
                        onKeyDown={(e) => handleCashFieldKeyDown(e, payCashUsdInputRef, "USD")}
                        onFocus={(e) => e.target.select()}
                        onClick={(e) => e.currentTarget.select()}
                        placeholder="0.00"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 font-posMono tabular-nums font-bold text-sm text-amber-600 dark:text-amber-400 outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1 mb-1">
                        <FlagUS /> Dólares (US$ x{rates.USD}):
                      </label>
                      <input
                        ref={payCashUsdInputRef}
                        type="text"
                        value={payCashUsd}
                        onChange={(e) => setPayCashUsd(e.target.value.replace(/[^0-9.,]/g, ""))}
                        onKeyDown={(e) => handleCashFieldKeyDown(e, payCashPygInputRef, "PYG")}
                        onFocus={(e) => e.target.select()}
                        onClick={(e) => e.currentTarget.select()}
                        placeholder="0.00"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 font-posMono tabular-nums font-bold text-sm text-blue-600 dark:text-blue-400 outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Billetes Rápidos: Sobreescribe al 1er clic, incrementa después.
                      "Exacto" queda destacado en naranja de marca como la
                      sugerencia principal; el resto son fichas de billete
                      real (2.000 a 100.000, los que circulan en Paraguay). */}
                  <div className="pt-1">
                    <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">Billetes Rápidos:</span>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleQuickCashClick(totalPyg)}
                        className="px-3 py-1.5 bg-[#FF7019] hover:bg-[#e6640f] text-white text-[11px] font-posMono tabular-nums font-black rounded-lg cursor-pointer shadow-sm shadow-orange-500/30 transition-all active:scale-95"
                      >
                        Exacto
                      </button>
                      {[
                        { label: "2.000", val: 2000 },
                        { label: "5.000", val: 5000 },
                        { label: "10.000", val: 10000 },
                        { label: "20.000", val: 20000 },
                        { label: "50.000", val: 50000 },
                        { label: "100.000", val: 100000 },
                      ].map((b) => (
                        <button
                          key={b.label}
                          type="button"
                          onClick={() => handleQuickCashClick(b.val)}
                          className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-[11px] font-posMono tabular-nums font-bold rounded-lg cursor-pointer shadow-sm transition-all active:scale-95"
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 2. POS BANCARD INFONET */}
              {paymentTab === "bancard" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      <span className="font-black text-xs text-slate-900 dark:text-white">Terminal POS Bancard Infonet</span>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPosCardType("debito")}
                        className={`px-3 py-1 rounded-lg text-xs font-bold ${posCardType === "debito" ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"}`}
                      >
                        Débito
                      </button>
                      <button
                        type="button"
                        onClick={() => setPosCardType("credito")}
                        className={`px-3 py-1 rounded-lg text-xs font-bold ${posCardType === "credito" ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"}`}
                      >
                        Crédito
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Terminal Asignada:</label>
                      <input
                        type="text"
                        value={posTerminalId}
                        onChange={(e) => setPosTerminalId(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-posMono tabular-nums text-xs text-blue-600 dark:text-blue-400 font-bold outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Nº Lote:</label>
                      <input
                        type="text"
                        value={posCardLote}
                        onChange={(e) => setPosCardLote(e.target.value)}
                        placeholder="001"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-posMono tabular-nums text-xs text-slate-900 dark:text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Nº Cupón / Voucher:</label>
                      <input
                        type="text"
                        value={posCardCupon}
                        onChange={(e) => setPosCardCupon(e.target.value)}
                        placeholder="123456"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-posMono tabular-nums text-xs text-emerald-600 dark:text-emerald-400 font-bold outline-none"
                      />
                    </div>
                  </div>

                  {/* Verificación real contra la transacción que la terminal ya registró */}
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={handleVerifyPosTerminal}
                      disabled={posVerifyStatus === "searching"}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-blue-600/20 text-blue-300 border border-blue-500/40 hover:bg-blue-600/30 disabled:opacity-60 cursor-pointer"
                    >
                      {posVerifyStatus === "searching" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                      <span>{posVerifyStatus === "searching" ? "Buscando en la terminal..." : "Verificar Transacción en Terminal"}</span>
                    </button>

                    {posVerifyStatus === "found" && posVerifiedTxn && (
                      <div className="mt-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/40 text-[11px] text-emerald-300">
                        ✓ Verificado: {posVerifiedTxn.tarjeta_marca} · {formatPYG(posVerifiedTxn.monto)} · Voucher {posVerifiedTxn.voucher} · {posVerifiedTxn.fecha.slice(11)}
                      </div>
                    )}

                    {posVerifyStatus === "none" && (
                      <div className="mt-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/40 text-[11px] text-amber-300">
                        No se encontró todavía la transacción en la terminal. Reintente o cargue el voucher a mano.
                      </div>
                    )}

                    {posVerifyStatus === "multiple" && (
                      <div className="mt-2 space-y-1">
                        <div className="text-[11px] font-bold text-amber-300">Hay más de una coincidencia, elija la correcta:</div>
                        {posVerifyCandidates.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => handleSelectPosCandidate(c)}
                            className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-blue-500 text-left cursor-pointer"
                          >
                            <span className="text-[11px] text-slate-900 dark:text-white font-posMono tabular-nums">{c.tarjeta_marca} · {c.cajero}</span>
                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-posMono tabular-nums font-bold">{formatPYG(c.monto)} · {c.fecha.slice(11)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 3. POS DINELCO BEPSA */}
              {paymentTab === "dinelco" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      <span className="font-black text-xs text-slate-900 dark:text-white">Terminal POS Dinelco BEPSA</span>
                    </div>
                    <div className="flex gap-1.5">
                      {(["debito", "credito", "social"] as const).map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setDinelcoCardType(t)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase ${dinelcoCardType === t ? "bg-purple-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"}`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Terminal Asignada:</label>
                      <input
                        type="text"
                        value={dinelcoTerminalId}
                        onChange={(e) => setDinelcoTerminalId(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-posMono tabular-nums text-xs text-purple-600 dark:text-purple-400 font-bold outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Nº Lote:</label>
                      <input
                        type="text"
                        value={dinelcoLote}
                        onChange={(e) => setDinelcoLote(e.target.value)}
                        placeholder="001"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-posMono tabular-nums text-xs text-slate-900 dark:text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Nº Voucher:</label>
                      <input
                        type="text"
                        value={dinelcoCupon}
                        onChange={(e) => setDinelcoCupon(e.target.value)}
                        placeholder="654321"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-posMono tabular-nums text-xs text-purple-600 dark:text-purple-400 font-bold outline-none"
                      />
                    </div>
                  </div>

                  {/* Verificación real contra la transacción que la terminal ya registró */}
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={handleVerifyPosTerminal}
                      disabled={posVerifyStatus === "searching"}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-purple-600/20 text-purple-300 border border-purple-500/40 hover:bg-purple-600/30 disabled:opacity-60 cursor-pointer"
                    >
                      {posVerifyStatus === "searching" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                      <span>{posVerifyStatus === "searching" ? "Buscando en la terminal..." : "Verificar Transacción en Terminal"}</span>
                    </button>

                    {posVerifyStatus === "found" && posVerifiedTxn && (
                      <div className="mt-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/40 text-[11px] text-emerald-300">
                        ✓ Verificado: {posVerifiedTxn.tarjeta_marca} · {formatPYG(posVerifiedTxn.monto)} · Voucher {posVerifiedTxn.voucher} · {posVerifiedTxn.fecha.slice(11)}
                      </div>
                    )}

                    {posVerifyStatus === "none" && (
                      <div className="mt-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/40 text-[11px] text-amber-300">
                        No se encontró todavía la transacción en la terminal. Reintente o cargue el voucher a mano.
                      </div>
                    )}

                    {posVerifyStatus === "multiple" && (
                      <div className="mt-2 space-y-1">
                        <div className="text-[11px] font-bold text-amber-300">Hay más de una coincidencia, elija la correcta:</div>
                        {posVerifyCandidates.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => handleSelectPosCandidate(c)}
                            className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-purple-500 text-left cursor-pointer"
                          >
                            <span className="text-[11px] text-slate-900 dark:text-white font-posMono tabular-nums">{c.tarjeta_marca} · {c.cajero}</span>
                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-posMono tabular-nums font-bold">{formatPYG(c.monto)} · {c.fecha.slice(11)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 4. QR ZIMPLE / PIX */}
              {paymentTab === "qr" && (
                <div className="flex flex-col items-center text-center p-2">
                  <div className="w-36 h-36 bg-white rounded-xl p-2 flex items-center justify-center shadow-lg mb-2">
                    <QrCode className="w-32 h-32 text-slate-900" />
                  </div>
                  <div className="font-bold text-xs text-slate-900 dark:text-white">QR Dinámico Bancard Zimple / Pix Brasil</div>
                  <div className="text-xs font-posMono tabular-nums font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {formatPYG(totalPyg)} (R$ {totalBrl})
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                    Presente la pantalla al cliente para el escaneo directo.
                  </span>
                </div>
              )}

              {/* 5. COBRO MIXTO -- combinar dos o más formas de pago. Cada
                  campo, al presionar Enter, sugiere cuánto falta (ya
                  convertido a esa moneda) para el siguiente método, y el
                  botón "Completar resto" hace lo mismo con el mouse. */}
              {paymentTab === "mixed" && (
                <div className="space-y-2.5">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Combine efectivo, tarjeta y QR hasta cubrir el total. Enter en cualquier campo sugiere el resto en la siguiente moneda.
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1 mb-1">
                        <FlagPY /> Efectivo Guaraníes (₲):
                      </label>
                      <div className="flex gap-1">
                        <input
                          ref={mixedCashPygInputRef}
                          type="text"
                          value={mixedCashPyg}
                          onChange={(e) => {
                            const clean = e.target.value.replace(/\D/g, "")
                            setMixedCashPyg(clean ? parseInt(clean, 10).toLocaleString("es-PY") : "")
                          }}
                          onKeyDown={(e) => handleMixedFieldKeyDown(e, mixedCashBrlInputRef, (f) => setMixedCashBrl((f / rates.BRL).toFixed(2)))}
                          onFocus={(e) => e.target.select()}
                          onClick={(e) => e.currentTarget.select()}
                          placeholder="0"
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-posMono tabular-nums font-bold text-sm text-emerald-600 dark:text-emerald-400 outline-none focus:border-emerald-500"
                        />
                        <button
                          type="button"
                          title="Completar con el resto"
                          onClick={() => setMixedCashPyg(Math.ceil(Math.max(0, totalPyg - totalRecibidoPyg + (parseInt(mixedCashPyg.replace(/\D/g, "") || "0", 10)))).toLocaleString("es-PY"))}
                          className="px-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold rounded-lg cursor-pointer shrink-0"
                        >
                          Resto
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1 mb-1">
                        <FlagBR /> Efectivo Reales (R$ x{rates.BRL}):
                      </label>
                      <div className="flex gap-1">
                        <input
                          ref={mixedCashBrlInputRef}
                          type="text"
                          value={mixedCashBrl}
                          onChange={(e) => setMixedCashBrl(e.target.value.replace(/[^0-9.,]/g, ""))}
                          onKeyDown={(e) => handleMixedFieldKeyDown(e, mixedCardPygInputRef, (f) => setMixedCardPyg(Math.ceil(f).toLocaleString("es-PY")))}
                          onFocus={(e) => e.target.select()}
                          onClick={(e) => e.currentTarget.select()}
                          placeholder="0.00"
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-posMono tabular-nums font-bold text-sm text-amber-600 dark:text-amber-400 outline-none focus:border-amber-500"
                        />
                        <button
                          type="button"
                          title="Completar con el resto"
                          onClick={() => {
                            const yaPuestoBrl = parseFloat(mixedCashBrl.replace(/,/g, ".") || "0") * rates.BRL
                            const restoPyg = Math.max(0, totalPyg - totalRecibidoPyg + yaPuestoBrl)
                            setMixedCashBrl((restoPyg / rates.BRL).toFixed(2))
                          }}
                          className="px-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold rounded-lg cursor-pointer shrink-0"
                        >
                          Resto
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1 mb-1">
                        <CreditCard className="w-3 h-3" /> Tarjeta POS (₲):
                      </label>
                      <div className="flex gap-1">
                        <input
                          ref={mixedCardPygInputRef}
                          type="text"
                          value={mixedCardPyg}
                          onChange={(e) => {
                            const clean = e.target.value.replace(/\D/g, "")
                            setMixedCardPyg(clean ? parseInt(clean, 10).toLocaleString("es-PY") : "")
                          }}
                          onKeyDown={(e) => handleMixedFieldKeyDown(e, mixedQrPygInputRef, (f) => setMixedQrPyg(Math.ceil(f).toLocaleString("es-PY")))}
                          onFocus={(e) => e.target.select()}
                          onClick={(e) => e.currentTarget.select()}
                          placeholder="0"
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-posMono tabular-nums font-bold text-sm text-blue-600 dark:text-blue-400 outline-none focus:border-blue-500"
                        />
                        <button
                          type="button"
                          title="Completar con el resto"
                          onClick={() => setMixedCardPyg(Math.ceil(Math.max(0, totalPyg - totalRecibidoPyg + (parseInt(mixedCardPyg.replace(/\D/g, "") || "0", 10)))).toLocaleString("es-PY"))}
                          className="px-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold rounded-lg cursor-pointer shrink-0"
                        >
                          Resto
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1 mb-1">
                        <QrCode className="w-3 h-3" /> QR / Transferencia (₲):
                      </label>
                      <div className="flex gap-1">
                        <input
                          ref={mixedQrPygInputRef}
                          type="text"
                          value={mixedQrPyg}
                          onChange={(e) => {
                            const clean = e.target.value.replace(/\D/g, "")
                            setMixedQrPyg(clean ? parseInt(clean, 10).toLocaleString("es-PY") : "")
                          }}
                          onKeyDown={(e) => handleMixedFieldKeyDown(e, mixedCashPygInputRef, (f) => setMixedCashPyg(Math.ceil(f).toLocaleString("es-PY")))}
                          onFocus={(e) => e.target.select()}
                          onClick={(e) => e.currentTarget.select()}
                          placeholder="0"
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-posMono tabular-nums font-bold text-sm text-purple-600 dark:text-purple-400 outline-none focus:border-purple-500"
                        />
                        <button
                          type="button"
                          title="Completar con el resto"
                          onClick={() => setMixedQrPyg(Math.ceil(Math.max(0, totalPyg - totalRecibidoPyg + (parseInt(mixedQrPyg.replace(/\D/g, "") || "0", 10)))).toLocaleString("es-PY"))}
                          className="px-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold rounded-lg cursor-pointer shrink-0"
                        >
                          Resto
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Botón Final de Cobro e Impresión */}
            <button
              ref={confirmCheckoutBtnRef}
              onClick={handleProcessCheckout}
              disabled={submitting}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3.5 rounded-xl shadow-lg transition-all text-sm flex items-center justify-center gap-2 cursor-pointer active:scale-98 focus:ring-4 focus:ring-emerald-400"
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Printer className="w-5 h-5" />
                  <span>Confirmar Cobro e Imprimir Comprobante (F12)</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── 9. MODAL DE CLIENTES (F9) CON BÚSQUEDA EN VIVO Y ALTA RÁPIDA ───────── */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-[110] bg-slate-100 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl max-w-lg w-full p-5 shadow-2xl text-slate-900 dark:text-slate-100 animate-fade-in">
            <div className="flex items-center justify-between mb-3 border-b border-slate-200 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-orange flex items-center justify-center text-[#1C1710] shrink-0 shadow-sm shadow-orange-500/30">
                  <User className="w-5 h-5" />
                </div>
                <h3 className="font-black text-sm text-slate-900 dark:text-white font-posDisplay tracking-tight">Seleccionar Cliente para Facturación</h3>
              </div>
              <button onClick={() => setShowCustomerModal(false)} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario de creación rápida */}
            {showCreateCustomerForm ? (
              <form onSubmit={handleCreateQuickCustomer} className="space-y-3 mb-3 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="font-bold text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4" />
                  <span>Registrar Nuevo Cliente Rápido</span>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">RUC o Cédula de Identidad:</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={newCustRuc}
                      onChange={(e) => setNewCustRuc(e.target.value)}
                      placeholder="Ej: 4444440 o 80012345"
                      required
                      autoFocus
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-900 dark:text-white font-posMono tabular-nums outline-none focus:border-blue-500"
                    />
                    {lookupDvSuggested && (
                      <span className="absolute right-2 top-2 text-[10px] bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold px-1.5 py-0.5 rounded">
                        RUC: {lookupDvSuggested}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Nombre Completo o Razón Social:</label>
                  <input
                    type="text"
                    value={newCustNombre}
                    onChange={(e) => setNewCustNombre(e.target.value)}
                    placeholder="Ej: Juan Pérez / Empresa S.A."
                    required
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Teléfono / Celular:</label>
                  <input
                    type="text"
                    value={newCustTelefono}
                    onChange={(e) => setNewCustTelefono(e.target.value)}
                    placeholder="Ej: 0981 123456"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowCreateCustomerForm(false)}
                    className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-lg text-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs cursor-pointer"
                  >
                    Guardar y Asignar
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    onKeyDown={handleCustomerSearchKeyDown}
                    placeholder="Buscar por RUC, C.I. o Nombre (en vivo)... ↑↓ + Enter"
                    autoFocus
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg pl-8 pr-8 py-2 text-xs text-slate-900 dark:text-white font-bold outline-none focus:border-blue-500"
                  />
                  <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-500 dark:text-slate-400" />
                  {searchingCustomers && <Loader2 className="w-4 h-4 absolute right-2.5 top-2.5 text-blue-500 animate-spin" />}
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateCustomerForm(true)}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nuevo</span>
                </button>
              </div>
            )}

            {/* Listado de Clientes */}
            <div className="max-h-64 overflow-y-auto divide-y divide-slate-800/60 mb-2">
              <button
                type="button"
                onClick={() => {
                  setCustomer(DEFAULT_CUSTOMER)
                  setShowCustomerModal(false)
                  toast.info("Cliente", "Asignado Consumidor Final.")
                }}
                className={`w-full text-left p-2.5 rounded-lg flex items-center justify-between cursor-pointer group ${
                  customerHighlight === 0 ? "bg-blue-100 dark:bg-blue-900/40 ring-1 ring-blue-500" : "hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <div>
                  <div className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">Consumidor Final (Sin Nombre)</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-posMono tabular-nums">RUC: 44444401-7</div>
                </div>
                <span className="text-[10px] bg-blue-500/20 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded font-bold">Por Defecto</span>
              </button>

              {combinedCustomerList.slice(0, 20).map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelectCustomer(c)}
                  onMouseEnter={() => setCustomerHighlight(i + 1)}
                  disabled={asignandoCliente}
                  className={`w-full text-left p-2.5 rounded-lg flex items-center justify-between cursor-pointer group disabled:opacity-50 ${
                    customerHighlight === i + 1 ? "bg-blue-100 dark:bg-blue-900/40 ring-1 ring-blue-500" : "hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <div>
                    <div className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">{c.nombre}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-posMono tabular-nums">
                      {c.ruc ? `RUC: ${c.ruc}` : `CI: ${c.ci || 'Sin Doc'}`} · {c.razon_social || ""} {c.telefono ? `· Tel: ${c.telefono}` : ""}
                      {String(c.id).startsWith("lookup-") ? " · (padrón, se registrará al elegir)" : ""}
                    </div>
                  </div>
                  {asignandoCliente ? <Loader2 className="w-4 h-4 animate-spin text-slate-500" /> : <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400" />}
                </button>
              ))}

              {combinedCustomerList.length === 0 && !searchingCustomers && (
                <div className="text-center py-6 text-slate-500 dark:text-slate-400 text-xs">
                  <span>No se encontró ningún cliente con ese RUC o nombre.</span>
                  <button
                    onClick={() => {
                      setNewCustRuc(customerSearch)
                      setShowCreateCustomerForm(true)
                    }}
                    className="block mx-auto mt-2 text-emerald-600 dark:text-emerald-400 font-bold underline cursor-pointer"
                  >
                    Crear cliente con "{customerSearch}" ahora
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── VENTAS EN ESPERA (F7) -- antes el botón abría un estado sin modal ── */}
      {showPausedModal && (
        <div
          className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4"
          onKeyDown={handlePausedModalKeyDown}
          tabIndex={-1}
          ref={(el) => el?.focus()}
        >
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-fade-in text-slate-900 dark:text-slate-100 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-orange flex items-center justify-center text-[#1C1710] font-black shadow-sm shadow-orange-500/30">
                  <Pause className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white font-posDisplay tracking-tight">Ventas en Espera</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">↑↓ para elegir · Enter para reanudar · Supr para descartar</p>
                </div>
              </div>
              <button onClick={() => setShowPausedModal(false)} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 space-y-2">
              {pausedSales.length === 0 && (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-xs">No hay ventas en espera.</div>
              )}
              {pausedSales.map((p, i) => (
                <div
                  key={p.id}
                  onMouseEnter={() => setPausedHighlight(i)}
                  className={`rounded-xl p-3 border flex items-center justify-between gap-3 ${
                    pausedHighlight === i
                      ? "bg-orange-100 dark:bg-orange-900/30 border-brand-orange ring-1 ring-brand-orange"
                      : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <button type="button" onClick={() => resumePausedSale(p)} className="flex-1 text-left cursor-pointer">
                    <div className="font-bold text-sm text-slate-900 dark:text-white">{p.customer?.nombre || "Consumidor Final"}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-posMono tabular-nums">
                      {p.items.length} ítem{p.items.length === 1 ? "" : "s"} · {p.timestamp}
                    </div>
                  </button>
                  <div className="text-right shrink-0">
                    <div className="font-black text-emerald-600 dark:text-emerald-400 font-posMono tabular-nums">{formatPYG(p.total)}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => discardPausedSale(p.id)}
                    title="Descartar venta en espera"
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── CONSULTA DE PRECIOS (solo lectura, con escala por cantidad) ──────── */}
      {showPriceCheckModal && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border-2 border-emerald-500 rounded-2xl max-w-2xl w-full p-6 shadow-2xl animate-fade-in text-slate-900 dark:text-slate-100 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-orange flex items-center justify-center text-[#1C1710] font-black shadow-sm shadow-orange-500/30">
                  <Search className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white font-posDisplay tracking-tight">Consulta de Productos</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Precio, stock y promoción · no modifica el carrito de la venta actual.</p>
                </div>
              </div>
              <button onClick={closePriceCheckModal} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative mb-3 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                autoFocus
                type="text"
                value={priceCheckSearch}
                onChange={(e) => { setPriceCheckSearch(e.target.value); setPriceCheckSelected(null); setPriceCheckTiers([]) }}
                onKeyDown={handlePriceCheckSearchKeyDown}
                placeholder="Código de barras, nombre o código interno... ↑↓ + Enter"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-9 py-2.5 text-sm text-slate-900 dark:text-white font-bold outline-none focus:border-emerald-500"
              />
              {priceCheckSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500 animate-spin" />
              )}
            </div>

            {!priceCheckSelected ? (
              <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-slate-800/50">
                {priceCheckResults.length === 0 && priceCheckSearch.trim().length >= 2 && !priceCheckSearching && (
                  <div className="text-center py-6 text-slate-500 dark:text-slate-400 text-xs">No se encontraron productos.</div>
                )}
                {priceCheckResults.map((p, i) => (
                  <button
                    key={p.id}
                    onClick={() => handlePriceCheckSelect(p)}
                    onMouseEnter={() => setPriceCheckHighlight(i)}
                    className={`w-full flex items-center justify-between gap-3 py-2.5 px-1 rounded-lg text-left cursor-pointer ${
                      priceCheckHighlight === i ? "bg-orange-100 dark:bg-orange-900/30 ring-1 ring-brand-orange" : "hover:bg-slate-100 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    <div className="truncate">
                      <div className="font-bold text-sm text-slate-900 dark:text-white truncate">{p.nombre}</div>
                      <div className="text-[10px] font-posMono tabular-nums text-slate-500 dark:text-slate-400">{p.codigo_barra || p.sku || "Sin código"}</div>
                    </div>
                    <div className="font-black text-emerald-600 dark:text-emerald-400 font-posMono tabular-nums shrink-0">{formatPYG(Number(p.precio_venta) || 0)}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto min-h-0">
                <button
                  onClick={() => { setPriceCheckSelected(null); setPriceCheckTiers([]); setPriceCheckStock(null); setPriceCheckPromo(null) }}
                  className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mb-3 flex items-center gap-1 cursor-pointer"
                >
                  ← Volver a la búsqueda
                </button>

                <div className="relative bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-4 mb-3 overflow-hidden flex gap-4">
                  {priceCheckPromo && (
                    <div className="absolute top-0 right-0 bg-[#FF7019] text-white text-[10px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-wider flex items-center gap-1">
                      <Tag className="w-3 h-3" /> Promoción: {priceCheckPromo.nombre}
                    </div>
                  )}

                  {/* Foto del producto -- se reserva el espacio aunque falte la
                      imagen, porque el catálogo real va a tener foto siempre;
                      así el layout no "salta" producto a producto. */}
                  <div className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center">
                    {priceCheckSelected.imagen_url ? (
                      <img
                        src={priceCheckSelected.imagen_url.startsWith("http") ? priceCheckSelected.imagen_url : `${API_ORIGIN}${priceCheckSelected.imagen_url}`}
                        alt={priceCheckSelected.nombre}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="w-7 h-7 text-slate-300 dark:text-slate-700" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="font-black text-xl text-slate-900 dark:text-white mb-1 pr-16 truncate">{priceCheckSelected.nombre}</div>
                    <div className="text-xs font-posMono tabular-nums text-slate-500 dark:text-slate-400 mb-3">
                      {priceCheckSelected.codigo_barra || priceCheckSelected.sku || "Sin código"}
                    </div>
                    {priceCheckPromo ? (
                      <div className="flex items-end gap-3">
                        <div className="text-4xl font-black text-[#FF7019] font-posMono tabular-nums">{formatPYG(priceCheckPromo.precio_final)}</div>
                        <div className="text-lg font-bold text-slate-400 dark:text-slate-500 font-posMono tabular-nums line-through mb-1">{formatPYG(Number(priceCheckSelected.precio_venta) || 0)}</div>
                      </div>
                    ) : (
                      <div className="text-4xl font-black text-emerald-600 dark:text-emerald-400 font-posMono tabular-nums">
                        {formatPYG(Number(priceCheckSelected.precio_venta) || 0)}
                      </div>
                    )}
                    <div className="text-[10px] text-slate-500 mt-1">
                      {priceCheckLoadingPromo ? "Verificando promociones…" : priceCheckPromo ? "Precio unitario con promoción aplicada" : "Precio unitario"}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-4 mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Stock Disponible</div>
                    {priceCheckLoadingStock ? (
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Consultando…</div>
                    ) : priceCheckStock ? (
                      <div className={`text-2xl font-black font-posMono tabular-nums ${priceCheckStock.cantidad_disponible <= (priceCheckSelected.stock_minimo || 0) ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-white"}`}>
                        {priceCheckStock.cantidad_disponible} {priceCheckSelected.unidad_medida || "UN"}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 dark:text-slate-400">Sin datos de stock.</div>
                    )}
                    {priceCheckStock && priceCheckStock.cantidad_reservada > 0 && (
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{priceCheckStock.cantidad_reservada} reservado en pedidos pendientes</div>
                    )}
                  </div>
                  {priceCheckStock && priceCheckStock.cantidad_disponible <= (priceCheckSelected.stock_minimo || 0) && (
                    <div className="text-[10px] font-black text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-lg px-2 py-1 uppercase">Stock bajo</div>
                  )}
                </div>

                <div className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Escala de Precios por Cantidad
                </div>

                {priceCheckLoadingTiers ? (
                  <div className="text-center py-6 text-slate-500 dark:text-slate-400 text-xs flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Cargando escala...
                  </div>
                ) : priceCheckTiers.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 dark:text-slate-400 text-xs">
                    Este producto no tiene una escala de precios por cantidad configurada.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {priceCheckTiers.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2"
                      >
                        <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          {t.max_qty ? `De ${t.min_qty} a ${t.max_qty} unidades` : `${t.min_qty}+ unidades`}
                        </div>
                        <div className="font-black text-emerald-600 dark:text-emerald-400 font-posMono tabular-nums">{formatPYG(Number(t.precio_unitario) || 0)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 10. LIGHTBOX FOTO HD EN PANTALLA COMPLETA ────────────────────────── */}
      {lightboxImage && (
        <div 
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-[130] bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 cursor-pointer"
        >
          <div className="max-w-2xl w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl overflow-hidden p-4 text-slate-900 dark:text-white shadow-2xl flex flex-col items-center">
            <img
              src={lightboxImage.url}
              alt={lightboxImage.nombre}
              className="max-h-[65vh] w-auto object-contain rounded-lg"
            />
            <div className="w-full mt-3 text-center">
              <h2 className="text-lg font-black font-posDisplay tracking-tight">{lightboxImage.nombre}</h2>
              <div className="text-2xl font-black font-posMono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
                {formatPYG(lightboxImage.precio)}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">SKU: {lightboxImage.sku} · Haga clic en cualquier lugar para cerrar</p>
            </div>
          </div>
        </div>
      )}

      {/* ── REIMPRIMIR COMPROBANTE DE VENTA ANTERIOR ─────────────────────────── */}
      {showReimprimirModal && (
        <div className="fixed inset-0 z-[130] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-2xl max-w-lg w-full max-h-[80vh] flex flex-col shadow-2xl text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-orange flex items-center justify-center text-[#1C1710] shrink-0 shadow-sm shadow-orange-500/30">
                  <Printer className="w-5 h-5" />
                </div>
                <h2 className="text-base font-black text-slate-900 dark:text-white font-posDisplay tracking-tight">Reimprimir Comprobante</h2>
              </div>
              <button onClick={() => setShowReimprimirModal(false)} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-1.5 p-2 pb-0">
              <button
                onClick={() => setReimprimirTab("ventas")}
                className={`flex-1 py-2 rounded-lg text-xs font-bold cursor-pointer ${
                  reimprimirTab === "ventas" ? "bg-brand-orange text-[#1C1710]" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                }`}
              >
                Ventas
              </button>
              <button
                onClick={() => { setReimprimirTab("devoluciones"); if (reimprimirReturns.length === 0) fetchReimprimirReturns() }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold cursor-pointer ${
                  reimprimirTab === "devoluciones" ? "bg-brand-orange text-[#1C1710]" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                }`}
              >
                Devoluciones
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-2">
              {reimprimirLoading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-400" />
                </div>
              )}
              {!reimprimirLoading && reimprimirError && (
                <div className="m-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
                  {reimprimirError}
                </div>
              )}

              {reimprimirTab === "ventas" && !reimprimirLoading && !reimprimirError && (
                <>
                  {reimprimirSales.length === 0 && (
                    <div className="text-center text-sm text-slate-500 dark:text-slate-400 py-12">No hay ventas recientes para mostrar.</div>
                  )}
                  {reimprimirSales.map((sale) => (
                    <div
                      key={sale.id}
                      className="flex items-center justify-between gap-3 p-3 mx-1 my-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent hover:border-slate-300 dark:hover:border-slate-700"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 dark:text-white truncate">Nº {sale.numero || sale.id.slice(0, 8)}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {sale.fecha ? new Date(sale.fecha).toLocaleString("es-PY") : "—"} · {formatPYG(sale.total || 0)}
                        </div>
                      </div>
                      <button
                        onClick={() => handleReimprimirSale(sale)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shrink-0"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Reimprimir
                      </button>
                    </div>
                  ))}
                </>
              )}

              {reimprimirTab === "devoluciones" && !reimprimirLoading && !reimprimirError && (
                <>
                  {reimprimirReturns.length === 0 && (
                    <div className="text-center text-sm text-slate-500 dark:text-slate-400 py-12">No hay devoluciones aprobadas para mostrar.</div>
                  )}
                  {reimprimirReturns.map((ret) => (
                    <div
                      key={ret.id}
                      className="flex items-center justify-between gap-3 p-3 mx-1 my-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent hover:border-slate-300 dark:hover:border-slate-700"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {ret.nota_credito_numero ? `NC ${ret.nota_credito_numero}` : ret.numero}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {ret.fecha ? new Date(ret.fecha).toLocaleString("es-PY") : "—"} · {formatPYG(ret.total || 0)}
                          {ret.sale_numero ? ` · Venta ${ret.sale_numero}` : ""}
                        </div>
                      </div>
                      <button
                        onClick={() => handleReimprimirDevolucion(ret)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shrink-0"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Reimprimir
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ── PRODUCTO FALTANTE (DEMANDA PERDIDA) -> AVISO A COMPRAS ───────────── */}
      {showLostDemandModal && (
        <div className="fixed inset-0 z-[130] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border-2 border-amber-500/50 rounded-2xl max-w-2xl w-full p-6 shadow-2xl text-slate-900 dark:text-slate-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-brand-orange flex items-center justify-center text-[#1C1710] font-black shadow-sm shadow-orange-500/30">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white font-posDisplay tracking-tight">Productos No Encontrados</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Se avisa al sector de Compras para evaluar si se incorporan.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Cliente (opcional)</label>
                <input
                  type="text"
                  value={lostDemandCliente}
                  onChange={(e) => setLostDemandCliente(e.target.value)}
                  placeholder="Nombre del cliente"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Teléfono (opcional, para avisarle)</label>
                <input
                  type="text"
                  value={lostDemandTelefono}
                  onChange={(e) => setLostDemandTelefono(e.target.value)}
                  placeholder="0981 123456"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
              {lostDemandRows.map((row, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={row.producto}
                    onChange={(e) => lostDemandUpdateRow(idx, "producto", e.target.value)}
                    placeholder="Ej: Yerba Pajarito 1kg"
                    autoFocus={idx === 0}
                    className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-amber-500"
                  />
                  <select
                    value={row.motivo}
                    onChange={(e) => lostDemandUpdateRow(idx, "motivo", e.target.value)}
                    className="w-40 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-amber-500"
                  >
                    <option value="sin_stock">Sin stock</option>
                    <option value="no_lo_vendemos">No lo vendemos</option>
                    <option value="otro">Otro</option>
                  </select>
                  <button
                    onClick={() => lostDemandRemoveRow(idx)}
                    disabled={lostDemandRows.length === 1}
                    className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-red-400 hover:border-red-500/40 disabled:opacity-30 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={lostDemandAddRow}
              className="mt-2 flex items-center gap-1.5 text-xs font-bold text-amber-500 hover:text-amber-600 dark:hover:text-amber-400"
            >
              <Plus className="w-3.5 h-3.5" /> Agregar otro producto
            </button>

            <div className="flex items-center gap-2 pt-4">
              <button
                onClick={() => setShowLostDemandModal(false)}
                className="w-1/3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmitLostDemand}
                disabled={submittingLostDemand}
                className="w-2/3 bg-amber-600 hover:bg-amber-700 text-white py-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {submittingLostDemand ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
                Avisar a Compras
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── CIERRE DE CAJA A CIEGAS ───────────────────────────────────────────── */}
      {showCierreTurnoModal && (
        <div className="fixed inset-0 z-[130] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border-2 border-amber-500 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-900 dark:text-slate-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-brand-orange flex items-center justify-center text-[#1C1710] font-black shadow-sm shadow-orange-500/30">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white font-posDisplay tracking-tight">Cierre de Caja (Arqueo a Ciegas)</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Cuente el efectivo físico e ingrese el total. El sistema muestra la diferencia recién después de confirmar.</p>
              </div>
            </div>

            {!cierreResult ? (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Efectivo Contado (Gs.)</label>
                  <input
                    type="text"
                    value={montoCierreReal}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/\D/g, "")
                      setMontoCierreReal(clean ? parseInt(clean, 10).toLocaleString("es-PY") : "")
                    }}
                    placeholder="0"
                    autoFocus
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-xl font-posMono tabular-nums font-black text-emerald-600 dark:text-emerald-400 outline-none focus:border-amber-500"
                  />
                </div>
                <div className="flex items-center gap-2 pt-4">
                  <button
                    onClick={() => setShowCierreTurnoModal(false)}
                    className="w-1/3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmCierreCaja}
                    disabled={submittingCierre || !montoCierreReal}
                    className="w-2/3 bg-amber-600 hover:bg-amber-700 text-white py-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {submittingCierre ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                    Confirmar Cierre
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-3 space-y-1 text-sm font-posMono tabular-nums">
                  <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Esperado (sistema):</span><span>{formatPYG(cierreResult.monto_cierre_esperado)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Contado (real):</span><span>{formatPYG(parseInt(montoCierreReal.replace(/\D/g, "") || "0", 10))}</span></div>
                  <div className={`flex justify-between font-black pt-1 border-t border-slate-200 dark:border-slate-800 ${cierreResult.diferencia < 0 ? "text-red-600 dark:text-red-400" : cierreResult.diferencia > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                    <span>Diferencia:</span><span>{cierreResult.diferencia >= 0 ? "+" : ""}{formatPYG(cierreResult.diferencia)}</span>
                  </div>
                </div>
                {cierreResult.requiere_revision && (
                  <div className="text-center text-xs font-bold text-red-400 border border-red-500/40 rounded-xl p-2">
                    ⚠ Diferencia fuera de tolerancia — quedó marcada para revisión de supervisor.
                  </div>
                )}
                <p className="text-center text-xs text-slate-500 dark:text-slate-400">Se imprimió el ticket de cierre. La caja fue cerrada.</p>
                <button
                  onClick={() => { setCierreResult(null); setShowCierreTurnoModal(false) }}
                  className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white py-2.5 rounded-xl font-bold text-xs"
                >
                  Cerrar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── RETIRO DE EFECTIVO (CASH DROP) ────────────────────────────────────── */}
      {showCashDropModal && (
        <div className="fixed inset-0 z-[130] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border-2 border-orange-500/60 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-900 dark:text-slate-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-brand-orange flex items-center justify-center text-[#1C1710] font-black shadow-sm shadow-orange-500/30">
                <Banknote className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white font-posDisplay tracking-tight">Retiro de Efectivo</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Registra un retiro parcial de la caja durante el turno (no cierra la sesión).</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Monto a Retirar (Gs.)</label>
                <input
                  type="text"
                  value={cashDropMonto}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, "")
                    setCashDropMonto(clean ? parseInt(clean, 10).toLocaleString("es-PY") : "")
                  }}
                  placeholder="0"
                  autoFocus
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-xl font-posMono tabular-nums font-black text-orange-600 dark:text-orange-400 outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Motivo (opcional)</label>
                <input
                  type="text"
                  value={cashDropObs}
                  onChange={(e) => setCashDropObs(e.target.value)}
                  placeholder="Ej: envío a bóveda"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-4">
              <button
                onClick={() => setShowCashDropModal(false)}
                className="w-1/3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmCashDrop}
                disabled={submittingCashDrop || !cashDropMonto}
                className="w-2/3 bg-orange-600 hover:bg-orange-700 text-white py-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {submittingCashDrop ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
                Confirmar Retiro
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
