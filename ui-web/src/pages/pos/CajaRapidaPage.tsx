import React, { useState, useEffect, useRef, useMemo, useCallback } from "react"
import {
  Search, ScanLine, ShoppingCart, Calculator, ClipboardList, Save, Loader2, Sun, Moon, Plus, Minus, Trash2, User, Pause, Play,
  Percent, X, CheckCircle, Printer, RefreshCw, Banknote,
  CreditCard, QrCode, Building, ArrowRight, Check, AlertCircle, Clock,
  DollarSign, Globe, Settings, FileText, ChevronDown, Sparkles, Receipt,
  Award, ShieldCheck, KeyRound, Star, Wallet, Scale, AlertTriangle, ChevronRight, ArrowLeft,
  Usb, ArrowDownRight, CornerDownLeft, ArrowRightLeft, CornerRightDown,
  Maximize2, Eye, Image as ImageIcon, ZoomIn, LogOut, Lock, Unlock,
  Coins, HelpCircle, Package, Flame, ShoppingBag, LayoutGrid, ListFilter,
  Layers, Tag, Boxes, Radio, Activity, ShieldAlert, ArrowUpRight, Sliders, UserPlus, Sparkle, RotateCcw, ExternalLink, Smartphone,
  Ticket, Scissors, Heart, Copy
} from "lucide-react"
import { api, type Product, type Customer, type Sale, type Warehouse, API_ORIGIN, COMPANY_ID } from "../../api"
import { useAuth } from "../../context/AuthContext"
import { useTheme } from "../../context/ThemeContext"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"
import { DEFAULT_RECEIPT_CONFIG } from "../../constants/receiptDefaults"
import { loadCachedPOSData, persistPOSCatalog } from "../../utils/posOfflineSync"
import { offlineDB } from "../../utils/offlineDB"
import { syncPendingSales } from "../../utils/syncManager"


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
  bancardIp: string
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
function escposWrapText(text: string, width = ESCPOS_LINE_WIDTH, align: 'left' | 'center' = 'left'): string {
  const clean = escposStripAccents(text).trim()
  if (!clean) return ''
  
  const paragraphs = clean.split('\n')
  const formattedLines: string[] = []

  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/)
    let currentLine = ''

    for (const word of words) {
      if (!word) continue
      if (!currentLine) {
        currentLine = word
      } else if ((currentLine + ' ' + word).length <= width) {
        currentLine += ' ' + word
      } else {
        formattedLines.push(align === 'center' ? escposCenter(currentLine, width) : currentLine)
        currentLine = word
      }
    }

    if (currentLine) {
      formattedLines.push(align === 'center' ? escposCenter(currentLine, width) : currentLine)
    }
  }

  return formattedLines.join('\n') + '\n'
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

const triggerSuccessSound = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1) // A5
    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.3)
  } catch (e) {}
}

const FORMA_PAGO_LABEL: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TARJETA_BANCARD: "Tarjeta Bancard",
  TARJETA_DINELCO: "Tarjeta Dinelco",
  QR: "QR / Transferencia",
  EXTRA_CLUB: "Extra Club (Crédito)",
  PLUGPAY_PIX: "PIX Brasil (PlugPay)",
  PLUGPAY_CREDITO: "Crédito Brasil (PlugPay)",
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
  { id: "001-011", nombre: "Caja 01 · Salón Central (Boca 011)" },
  { id: "001-012", nombre: "Caja 02 · Salón Central (Boca 012)" },
  { id: "001-013", nombre: "Caja 03 · Salón Central (Boca 013)" },
  { id: "001-014", nombre: "Caja 04 · Salón Central (Boca 014)" },
  { id: "001-015", nombre: "Caja 05 · Salón Central (Boca 015)" },
  { id: "001-016", nombre: "Caja 06 · Salón Central (Boca 016)" },
  { id: "001-017", nombre: "Caja 07 · Línea de Caja (Boca 017)" },
  { id: "001-018", nombre: "Caja 08 · Mayorista (Boca 018)" },
  { id: "001-019", nombre: "Caja 09 · Esquina / Administración (Boca 019)" },
  { id: "001-020", nombre: "Caja 10 · Esquina / Refuerzo (Boca 020)" },
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
  // Logo real del supermercado para el header -- mismo cache que ya usa el
  // ticket (pos_logo_data_url), asi no se vuelve a bajar por red.
  const [headerLogoUrl, setHeaderLogoUrl] = useState<string>(() => localStorage.getItem("pos_logo_data_url") || "")
  const [submittingApertura, setSubmittingApertura] = useState(false)
  const [montoCierreReal, setMontoCierreReal] = useState<string>("")
  const [montoCierreUsd, setMontoCierreUsd] = useState<string>("")
  const [montoCierreBrl, setMontoCierreBrl] = useState<string>("")
  const [submittingCierre, setSubmittingCierre] = useState(false)
  const [cierreResult, setCierreResult] = useState<{ monto_cierre_esperado: number; diferencia: number; requiere_revision: boolean; diferencia_usd: number; diferencia_brl: number; desglose_formas_pago: { forma_pago: string; moneda: string; monto: number }[]; contado: number; contado_usd: number; contado_brl: number } | null>(null)
  const [preCloseData, setPreCloseData] = useState<any>(null)
  const [loadingPreClose, setLoadingPreClose] = useState(false)
  const [cierreTab, setCierreTab] = useState<"conteo" | "conciliacion">("conteo")
  const [lastClosedSessionId, setLastClosedSessionId] = useState<string | null>(null)
  const [lastCierreTicketHtml, setLastCierreTicketHtml] = useState<string | null>(null)
  const [lastCierreEscPosB64, setLastCierreEscPosB64] = useState<string | null>(null)
  const pendingDropIdsRef = useRef<Set<string>>(new Set())
  const confirmedDropIdsRef = useRef<Set<string>>(new Set())
  const pendingHandoffIdRef = useRef<string | null>(null)

  // ── TURNO NÓMADA & PAUSA DE TURNO (MODELO A / ENFOQUE 1) ─────────────────
  const [showPausaTurnoModal, setShowPausaTurnoModal] = useState(false)
  const [pausaMotivo, setPausaMotivo] = useState("Salida a almuerzo / relevo de gaveta")
  const [submittingPausa, setSubmittingPausa] = useState(false)
  const [activeUserSessionInfo, setActiveUserSessionInfo] = useState<any>(null)
  const [showReanudarModal, setShowReanudarModal] = useState(false)
  const [submittingReanudar, setSubmittingReanudar] = useState(false)

  const [showCashDropModal, setShowCashDropModal] = useState(false)
  const [cashDropMonto, setCashDropMonto] = useState<string>("")
  const [cashDropMontoUsd, setCashDropMontoUsd] = useState<string>("")
  const [cashDropMontoBrl, setCashDropMontoBrl] = useState<string>("")
  const [cashDropObs, setCashDropObs] = useState<string>("")
  const [submittingCashDrop, setSubmittingCashDrop] = useState(false)
  const [cashDropStatus, setCashDropStatus] = useState<{ efectivo_acumulado: number; cash_drop_threshold: number | null; cash_drop_alert: boolean; cash_drop_warning: boolean } | null>(null)
  const cashDropStatusNotifiedRef = useRef<"none" | "warning" | "alert">("none")

  // Config de puntos de fidelidad -- se necesita al construir el ticket
  // (antes de que la venta se cree en el backend) para poder imprimir
  // "Sumaste X puntos" en el mismo comprobante, igual que ya se hace con
  // el bloque de firma de Extra Club.
  const [loyaltyConfig, setLoyaltyConfig] = useState<{ activo: boolean; crear_en_venta: boolean; puntos_por_guarani: number } | null>(null)
  useEffect(() => {
    api.loyalty.getConfig(COMPANY_ID).then((cfg: any) => setLoyaltyConfig(cfg)).catch(() => {})
  }, [])

  useEffect(() => {
    api.caja.registers.list()
      .then((regs) => {
        if (!Array.isArray(regs) || regs.length === 0) return
        const peNum = puntoEmision.includes("-") ? puntoEmision.split("-")[1] : puntoEmision
        const peClean = peNum.replace(/[^0-9]/g, "").replace(/^0+/, "")
        const match = regs.find((r: any) => {
          const rNum = (r.codigo || "").replace(/[^0-9]/g, "").replace(/^0+/, "")
          return (
            r.codigo === puntoEmision ||
            r.codigo === `POS-${peNum.padStart(3, "0")}` ||
            (peClean && rNum === peClean) ||
            (terminalAssignment?.caja_nombre && r.nombre?.toLowerCase() === terminalAssignment.caja_nombre.toLowerCase())
          )
        })
        if (match) {
          setCashRegisterId(match.id)
        } else {
          const idx = PUNTOS_EMISION.findIndex((p) => p.id === puntoEmision)
          const fallback = idx >= 0 ? regs[idx % regs.length] : regs[0]
          setCashRegisterId((fallback || regs[0]).id)
        }
      })
      .catch(() => {})
  }, [puntoEmision, terminalAssignment])

  // Detecta el hostname real de esta máquina (vía Electron) y busca si un
  // administrador ya la asignó a una caja fija. Si existe, puntoEmision
  // queda bloqueado a ese valor pase lo que pase, sin importar quién
  // inicie sesión como cajero.
  useEffect(() => {
    (async () => {
      try {
        const status = await (window as any).electronAPI?.getStatus?.()
        const hostname = status?.hostname
        let assignment: any = null
        if (hostname) {
          setMachineHostname(hostname)
          try {
            assignment = await api.posTerminals.getByHostname(hostname)
          } catch (e) {}
        }
        if (!assignment) {
          try {
            assignment = await api.posTerminals.detect({ hostname: hostname || undefined })
          } catch (e) {}
        }
        if (assignment && assignment.punto_emision) {
          const rawPe = String(assignment.punto_emision).trim()
          const pe = rawPe.startsWith("001-")
            ? rawPe
            : `001-${rawPe.replace(/[^0-9]/g, "").padStart(3, "0")}`
          setTerminalAssignment(assignment)
          setPuntoEmision(pe)
          try {
            const saved = localStorage.getItem(userCajaKey)
            const currentData = saved ? JSON.parse(saved) : {}
            localStorage.setItem(userCajaKey, JSON.stringify({ ...currentData, puntoEmision: pe }))
          } catch (e) {}
        }
      } catch (e) {
        // sin asignación todavía -- se maneja en la UI de Apertura de Caja
      } finally {
        setTerminalAssignmentChecked(true)
      }
    })()
  }, [])

  // ── 2. ESTADOS GENERALES Y CATÁLOGO ───────────────────────────────────────
  const [products, setProducts] = useState<Product[]>([])
  // Codigos de barra de pack/caja (1 codigo = N unidades del producto base,
  // ver Productos > "Codigos de Pack / Caja"). Se indexa por codigo de barra
  // para que el escaneo lo resuelva en memoria, igual que el resto del
  // catalogo -- no pega al backend por cada escaneo.
  const [packBarcodeMap, setPackBarcodeMap] = useState<Map<string, { productId: string; etiqueta: string; unidadesPorPaquete: number }>>(new Map())
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
  // Verificacion peso etiqueta vs balanza -- pedido explicito: al escanear
  // ── CONTROL CRUZADO INTELIGENTE: TOLERANCIA DINÁMICA Y ASENTAMIENTO DE BALANZA ─
  const getPesoTolerancia = (etiquetaKg: number) => Math.max(0.035, etiquetaKg * 0.035)
  const isPesableProduct = (p: Product | null | undefined): boolean => {
    if (!p) return false
    return (p as any).tipo_venta === "peso" ||
           (p as any).unidad_medida?.toUpperCase() === "KG" ||
           ((p as any).plu_balanza != null && (p as any).unidad_medida?.toUpperCase() !== "UN")
  }
  const scaleSettlingTimerRef = useRef<any>(null)

  const [weightMismatch, setWeightMismatch] = useState<{ product: Product; etiquetaKg: number; balanzaKg: number } | null>(null)
  const [weightPendingScale, setWeightPendingScale] = useState<{ product: Product; etiquetaKg: number } | null>(null)
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
        bancardIp: "",
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

  // IP de terminal Bancard por caja -- viene del modulo de Configuracion de
  // Integraciones (payment_integration_configs), ya no depende de tocar
  // codigo ni de localStorage por maquina. Si el backend todavia no tiene
  // nada cargado, se cae al valor de posAssignments (localStorage) como
  // respaldo, para no romper cajas que ya tenian la IP puesta a mano.
  const [bancardIpsPorCaja, setBancardIpsPorCaja] = useState<Record<string, string>>({})
  const [dinelcoIpsPorCaja, setDinelcoIpsPorCaja] = useState<Record<string, string>>({})
  const [plugpayEnabled, setPlugpayEnabled] = useState(false)
  useEffect(() => {
    api.paymentIntegrations.get("bancard")
      .then((cfg) => {
        if (cfg?.config?.ips_por_punto_emision) {
          setBancardIpsPorCaja(cfg.config.ips_por_punto_emision)
        }
      })
      .catch(() => {})

    api.paymentIntegrations.get("dinelco")
      .then((cfg) => {
        if (cfg?.config?.ips_por_punto_emision) {
          setDinelcoIpsPorCaja(cfg.config.ips_por_punto_emision)
        }
      })
      .catch(() => {})

    api.paymentIntegrations.get("plugpay")
      .then((cfg) => {
        if (cfg) {
          setPlugpayEnabled(cfg.enabled)
        }
      })
      .catch(() => {})
  }, [])

  // Obtener la configuración de la caja actual activa
  const activePosConfig = useMemo(() => {
    const base = posAssignments[puntoEmision] || {
      puntoEmision,
      nombreCaja: puntoEmision,
      bancardIp: "",
      bancardTerminalId: "BC-984401",
      bancardLote: "001",
      bancardPort: "COM4",
      dinelcoTerminalId: "DN-872101",
      dinelcoLote: "001",
      dinelcoPort: "COM7",
    }
    return {
      ...base,
      bancardIp: bancardIpsPorCaja[puntoEmision] || base.bancardIp,
      dinelcoIp: dinelcoIpsPorCaja[puntoEmision] || "",
    }
  }, [posAssignments, puntoEmision, bancardIpsPorCaja, dinelcoIpsPorCaja])

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
    type: "remove_item" | "clear_cart" | "decrease_qty" | "open_pos_config" | "process_return" | "assign_terminal" | "extra_club_payment" | "reopen_invoice" | "reopen_payment" | "use_label_weight" | "direct_discount"
    itemId?: string
    delta?: number
    sale?: Sale
    customer?: Customer
    formaPago?: string
    motivo?: string
    weightProduct?: Product
    weightEtiquetaKg?: number
    weightBalanzaKg?: number
    discountType?: "percentage" | "fixed"
    discountValue?: number
    discountReason?: string
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

  // ── ESTADOS DE CARRITO & CLIENTE (Auto-Persistidos contra recargas o reinicios) ──
  const ACTIVE_CART_KEY = `pos_active_cart_${COMPANY_ID}`
  const ACTIVE_CUSTOMER_KEY = `pos_active_customer_${COMPANY_ID}`

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const s = localStorage.getItem(`pos_active_cart_${COMPANY_ID}`)
      return s ? JSON.parse(s) : []
    } catch {
      return []
    }
  })
  const [customer, setCustomer] = useState<Customer>(() => {
    try {
      const s = localStorage.getItem(`pos_active_customer_${COMPANY_ID}`)
      return s ? JSON.parse(s) : DEFAULT_CUSTOMER
    } catch {
      return DEFAULT_CUSTOMER
    }
  })

  useEffect(() => {
    try {
      if (cart.length > 0) {
        localStorage.setItem(ACTIVE_CART_KEY, JSON.stringify(cart))
      } else {
        localStorage.removeItem(ACTIVE_CART_KEY)
      }
    } catch {}
  }, [cart])

  useEffect(() => {
    try {
      if (customer && customer.id !== DEFAULT_CUSTOMER.id) {
        localStorage.setItem(ACTIVE_CUSTOMER_KEY, JSON.stringify(customer))
      } else {
        localStorage.removeItem(ACTIVE_CUSTOMER_KEY)
      }
    } catch {}
  }, [customer])

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

  // ── DESCUENTO DIRECTO AUTORIZADO POR SUPERVISOR (AUDITABLE) ────────────────
  const [appliedDiscount, setAppliedDiscount] = useState<{
    type: "percentage" | "fixed"
    value: number
    montoPyg: number
    reason: string
    supervisorId: string
    supervisorNombre: string
  } | null>(null)
  const [showDiscountModal, setShowDiscountModal] = useState(false)
  const [discountInputType, setDiscountInputType] = useState<"percentage" | "fixed">("percentage")
  const [discountInputValue, setDiscountInputValue] = useState<string>("10")

  // ── MODALES DE COBRO MULTIMONEDA & PASARELAS POS BANCARD / DINELCO ─────────
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  // Redondeo Solidario & Donación ("Abre tu corazón" - Centro Amor y Esperanza)
  const [donacionActiva, setDonacionActiva] = useState(false)
  const [montoDonacionManual, setMontoDonacionManual] = useState<number | null>(null)
  const [campanaActivaDonacion, setCampanaActivaDonacion] = useState<any>(null)

  // Metodos de cobro activos -- reemplaza el viejo "paymentTab" de
  // seleccion unica (+ una pestana "Pago Mixto" que duplicaba cada campo).
  // Ahora cada metodo es un boton que se prende/apaga: con uno solo activo
  // se comporta igual que antes (implica el total, sin campo de monto
  // visible salvo en Efectivo); con 2+ activos, cada linea no-efectivo
  // muestra su propio campo de monto para dividir el cobro -- eso ES el
  // pago mixto, sin pantalla aparte.
  const [activeMethods, setActiveMethods] = useState<Set<"cash" | "bancard" | "dinelco" | "qr" | "extra_club" | "plugpay_pix" | "plugpay_credito">>(new Set(["cash"]))
  const isMultiPayment = activeMethods.size > 1
  // Por defecto un tap en un medio de pago REEMPLAZA la seleccion (un solo
  // medio activo a la vez, como espera cualquier cajero). Antes cada tap
  // solo AGREGABA al set sin sacar los anteriores -- tocar Bancard dejaba
  // Efectivo prendido, tocar Dinelco despues prendia los 3 a la vez, sin
  // forma obvia de volver atras. El pago dividido en varios medios sigue
  // existiendo, pero ahora requiere prender "Pago mixto" a proposito.
  const [allowMixedPayment, setAllowMixedPayment] = useState(false)
  const toggleActiveMethod = (m: "cash" | "bancard" | "dinelco" | "qr" | "extra_club" | "plugpay_pix" | "plugpay_credito") => {
    // Solo resetear Bancard/Dinelco/QR/PlugPay cuando de verdad corresponde:
    // reemplazo total (modo no-mixto) o se está SACANDO un metodo del mix.
    // Agregar un metodo nuevo al pago mixto NO puede resetear nada -- antes
    // togglear cualquier metodo llamaba resetBancardFlow() sin condicion, asi
    // que si la cajera ya habia cobrado con Bancard (resultado "aprobada" ya
    // en pantalla) y despues prendia otro medio para completar el mix, ese
    // resultado recien obtenido se borraba solo.
    let shouldReset = false
    setActiveMethods(prev => {
      if (!allowMixedPayment) {
        shouldReset = true
        return new Set([m])
      }
      const next = new Set(prev as any)
      if (next.has(m)) {
        if (next.size === 1) return prev
        next.delete(m)
        shouldReset = true
      } else {
        next.add(m)
      }
      return next as any
    })
    setPosVerifyStatus("idle")
    setPosVerifyCandidates([])
    setPosVerifiedTxn(null)
    if (shouldReset) resetBancardFlow()
  }
  
  const [qrSubMethod, setQrSubMethod] = useState<"zimple" | "pix" | "dinelco">("zimple")
  const [dinelcoQrState, setDinelcoQrState] = useState<"idle" | "esperando" | "aprobada" | "error_rechazo" | "error_conexion">("idle")
  const [dinelcoQrError, setDinelcoQrError] = useState<string>("")
  const [dinelcoQrMode, setDinelcoQrMode] = useState<"qr" | "pix">("qr")
  const [dinelcoPixCpf, setDinelcoPixCpf] = useState("")
  // Efectivo Multimoneda simultáneo (Guaraníes NUNCA tiene decimales)
  const [payCashPyg, setPayCashPyg] = useState<string>("")
  const [payCashBrl, setPayCashBrl] = useState<string>("")
  const [payCashUsd, setPayCashUsd] = useState<string>("")
  // El Enter en un campo de efectivo cerraba la venta apenas el monto
  // cubria el total -- si hubo vuelto, no daba tiempo ni de verlo ni de
  // ofrecer "Abre tu corazon". Ahora, la PRIMERA vez que el monto alcanza
  // a cubrir el total, ese Enter solo "marca listo" (deja ver el vuelto
  // tranquilo); recien el Enter SIGUIENTE cierra la venta de verdad. Si
  // el cajero vuelve a tocar algun monto despues de eso, se reinicia (ver
  // el useEffect mas abajo) para no saltarse la revision por accidente.
  const [listoParaCerrar, setListoParaCerrar] = useState(false)
  const [hasClickedQuickCash, setHasClickedQuickCash] = useState<boolean>(false)
  const confirmCheckoutBtnRef = useRef<HTMLButtonElement>(null)
  const payCashPygInputRef = useRef<HTMLInputElement>(null)
  const payCashBrlInputRef = useRef<HTMLInputElement>(null)
  const payCashUsdInputRef = useRef<HTMLInputElement>(null)
  // Monto de cada linea cuando hay 2+ metodos activos (pago dividido) --
  // con un solo metodo activo estos campos no se muestran, el monto es
  // implicitamente el total de la venta.
  const mixedCardPygInputRef = useRef<HTMLInputElement>(null)
  const mixedDinelcoPygInputRef = useRef<HTMLInputElement>(null)
  const mixedQrPygInputRef = useRef<HTMLInputElement>(null)
  const mixedExtraClubPygInputRef = useRef<HTMLInputElement>(null)

  // Tarjetas POS Bancard & Dinelco vinculadas a la caja activa
  const [posTerminalId, setPosTerminalId] = useState(activePosConfig.bancardTerminalId)
  const [posCardType, setPosCardType] = useState<"debito" | "credito">("debito")
  const [posCardCuotas, setPosCardCuotas] = useState<number>(1)
  const [posCardLote, setPosCardLote] = useState(activePosConfig.bancardLote)
  const [posCardCupon, setPosCardCupon] = useState("")
  const [posCardLast4, setPosCardLast4] = useState("")

  // Dinelco POS vinculada a la caja activa
  const [dinelcoTerminalId, setDinelcoTerminalId] = useState(activePosConfig.dinelcoTerminalId)
  const [dinelcoCardType, setDinelcoCardType] = useState<"debito" | "credito" | "social">("debito")
  const [dinelcoLote, setDinelcoLote] = useState(activePosConfig.dinelcoLote)
  const [dinelcoCupon, setDinelcoCupon] = useState("")

  // Verificación real contra la maquinita física (Bancard/Dinelco) -- busca
  // en la transacción real que la terminal ya registró en su propia red,
  // en vez de confiar en que el cajero tipee bien el lote/cupón a mano.
  const [posVerifyStatus, setPosVerifyStatus] = useState<"idle" | "searching" | "found" | "multiple" | "none">("idle")
  const [posVerifyCandidates, setPosVerifyCandidates] = useState<{ id: string; fecha: string; tarjeta_marca: string; monto: number; voucher: string; cajero: string }[]>([])
  const [posVerifiedTxn, setPosVerifiedTxn] = useState<{ id: string; fecha: string; tarjeta_marca: string; monto: number; voucher: string; cajero: string } | null>(null)
  const [posVerifyOpenedAt, setPosVerifyOpenedAt] = useState<string | null>(null)
  // ── FLUJO REAL DE COBRO BANCARD (API POS Android, via electron/main.cjs) ──
  // El terminal ya habla REST/JSON en <ip>:3000 -- documentado oficialmente y
  // verificado en vivo. Dos pasos para tarjeta (venta/debito|credito -> bin+nsu
  // -> descuento con bin+nsu+monto), uno solo para QR (venta-qr, respuesta ya
  // viene completa). Se distingue rechazo real de negocio (el terminal SI
  // contestó, no se ofrece respaldo manual -- cargarlo a mano inventaría una
  // aprobación que no existió) de falla de conexión (no sabemos si cobró o
  // no, ahí sí se habilita el cupón manual como respaldo).
  type BancardTxnResult = {
    bin?: string; nsu?: string; codigoAutorizacion?: string; codigoComercio?: string
    issuerId?: string; nombreTarjeta?: string; pan?: string; mensajeDisplay?: string
    nombreCliente?: string; montoVuelto?: number; saldo?: number; nroBoleta?: string
  }
  const [bancardTxnState, setBancardTxnState] = useState<"idle" | "esperando_tarjeta" | "confirmando" | "aprobada" | "error_rechazo" | "error_conexion">("idle")
  const [bancardTxnResult, setBancardTxnResult] = useState<BancardTxnResult | null>(null)
  const [bancardTxnError, setBancardTxnError] = useState<string>("")
  const [showBancardManualFallback, setShowBancardManualFallback] = useState(false)
  const [dinelcoTxnState, setDinelcoTxnState] = useState<"idle" | "esperando_tarjeta" | "confirmando" | "aprobada" | "error_rechazo" | "error_conexion">("idle")
  const [dinelcoTxnResult, setDinelcoTxnResult] = useState<any>(null)
  const [dinelcoTxnError, setDinelcoTxnError] = useState<string>("")
  const [dinelcoTxnLogId, setDinelcoTxnLogId] = useState<string | null>(null)
  const [dinelcoSessionId, setDinelcoSessionId] = useState<string | null>(null)
  const [dinelcoCuotas, setDinelcoCuotas] = useState(1)
  const [showDinelcoManualFallback, setShowDinelcoManualFallback] = useState(false)
  const [bancardTxnLogId, setBancardTxnLogId] = useState<string | null>(null)

  const [bancardQrState, setBancardQrState] = useState<"idle" | "esperando" | "aprobada" | "error_rechazo" | "error_conexion">("idle")
  const [bancardQrResult, setBancardQrResult] = useState<BancardTxnResult | null>(null)
  const [bancardQrError, setBancardQrError] = useState<string>("")
  const [bancardQrManualConfirm, setBancardQrManualConfirm] = useState(false)
  const [bancardQrLogId, setBancardQrLogId] = useState<string | null>(null)
  const [showBancardQrManualFallback, setShowBancardQrManualFallback] = useState(false)
  const [posQrCupon, setPosQrCupon] = useState("")
  const [posQrAuth, setPosQrAuth] = useState("")

  const handleManualConfirmQr = () => {
    if (!posQrCupon.trim()) {
      toast.warning("Falta Nº de Boleta / Ticket", "Ingresá el número de boleta o cupón impreso en el voucher del terminal.")
      return
    }
    const result: BancardTxnResult = {
      codigoAutorizacion: posQrAuth.trim() || "MANUAL",
      nroBoleta: posQrCupon.trim(),
      mensajeDisplay: "APROBADA MANUAL",
      nombreTarjeta: "QR ZIMPLE / BANCARD",
      nombreCliente: customer?.nombre || "CLIENTE",
    }
    setBancardQrResult(result)
    setBancardQrState("aprobada")
    setBancardQrManualConfirm(true)
    toast.success("Pago QR Confirmado", `Voucher Nº ${posQrCupon.trim()} registrado manualmente.`)
  }

  // ── FLUJO DE COBRO PLUGPAY (PIX & CRÉDITO PARCELADO BRASIL) ────────────────
  const [plugpayMethod, setPlugpayMethod] = useState<"zimple" | "pix" | "parcelado">("zimple")
  const [plugpayState, setPlugpayState] = useState<"idle" | "esperando" | "aprobada" | "error">("idle")
  const [plugpayResult, setPlugpayResult] = useState<any>(null)
  const [plugpayError, setPlugpayError] = useState("")
  const [plugpayCpf, setPlugpayCpf] = useState("")
  const [plugpayPhone, setPlugpayPhone] = useState("")
  const [plugpayCuotas, setPlugpayCuotas] = useState(3)
  const [plugpayBrlValue, setPlugpayBrlValue] = useState<number | null>(null)
  const plugpayPollIntervalRef = useRef<any>(null)

  const clearPlugpayPoll = () => {
    if (plugpayPollIntervalRef.current) {
      clearInterval(plugpayPollIntervalRef.current)
      plugpayPollIntervalRef.current = null
    }
  }

  const handlePlugpayPix = async () => {
    const cleanCpf = plugpayCpf.replace(/\D/g, "")
    if (!cleanCpf || cleanCpf.length !== 11) {
      toast.warning("CPF inválido", "El CPF brasileño debe tener exactamente 11 números.")
      return
    }
    const montoPyg = isMultiPayment ? parseInt(mixedQrPyg.replace(/\D/g, "") || "0", 10) : totalPyg
    if (montoPyg <= 0) {
      toast.warning("Monto inválido", "Ingrese un monto mayor a 0.")
      return
    }
    setPlugpayState("esperando")
    setPlugpayError("")
    setPlugpayResult(null)
    clearPlugpayPoll()

    try {
      console.log(`[PLUGPAY-TRACE] Consultando cotización PIX para Gs. ${montoPyg}`)
      const quoteRes = await api.plugpay.quotePix({ monto: montoPyg, moneda: "PYG" })
      if (!quoteRes.ok) {
        throw new Error(quoteRes.error_message || "Error al obtener cotización.")
      }
      
      const valBrl = quoteRes.data?.valorEmBRL || quoteRes.data?.valueBRL || (rates.BRL > 0 ? (montoPyg / rates.BRL) : 0)
      const valBrlNum = parseFloat(valBrl)
      if (!valBrlNum || valBrlNum <= 0) {
        throw new Error("La cotización devolvió un monto en Reales inválido.")
      }
      setPlugpayBrlValue(valBrlNum)

      console.log(`[PLUGPAY-TRACE] Creando PIX de R$ ${valBrlNum} para CPF ${cleanCpf}`)
      const pixRes = await api.plugpay.createPix({
        monto: valBrlNum,
        moneda: "BRL",
        customer_cpf: cleanCpf,
      })

      if (!pixRes.ok) {
        throw new Error(pixRes.error_message || "Error al generar cobro PIX.")
      }

      setPlugpayResult(pixRes.data)
      const refInterna = pixRes.data.referenciaInterna

      plugpayPollIntervalRef.current = setInterval(async () => {
        try {
          const statusRes = await api.plugpay.pixStatus(refInterna)
          if (statusRes.ok && statusRes.data) {
            const status = statusRes.data.status
            console.log(`[PLUGPAY-TRACE] Polling PIX status=${status} (${statusRes.data.statusDescription || ""})`)
            if (status === 1) {
              clearPlugpayPoll()
              setPlugpayState("aprobada")
              toast.success("Pago Aprobado", "La transacción PIX fue aprobada con éxito.")
              setBancardQrResult({
                codigoAutorizacion: statusRes.data.transactionCode || "PLUGPAY",
                nroBoleta: String(statusRes.data.IdTransacao || Date.now()),
                mensajeDisplay: "APROBADA",
                nombreTarjeta: "PIX BRASIL",
                nombreCliente: "CLIENTE BRASILEÑO",
              })
              setBancardQrState("aprobada")
            } else if (status === 6) {
              clearPlugpayPoll()
              setPlugpayState("error")
              setPlugpayError("La transacción fue cancelada o expiró en PlugPay.")
              toast.error("PIX Cancelado", "El cobro PIX fue cancelado o expiró.")
            }
          }
        } catch (err) {
          console.error("Error en polling PIX:", err)
        }
      }, 5000)

    } catch (e: any) {
      console.error(e)
      setPlugpayState("error")
      setPlugpayError(e.message || "Error al conectar con PlugPay.")
      toast.error("Error PlugPay", e.message || "No se pudo procesar el PIX.")
    }
  }

  const handlePlugpayParcelado = async () => {
    const cleanCpf = plugpayCpf.replace(/\D/g, "")
    if (!cleanCpf || cleanCpf.length !== 11) {
      toast.warning("CPF inválido", "El CPF brasileño debe tener exactamente 11 números.")
      return
    }
    const cleanPhone = plugpayPhone.replace(/\D/g, "")
    if (!cleanPhone || cleanPhone.length < 8) {
      toast.warning("Teléfono inválido", "Ingrese un número de teléfono válido para el cliente.")
      return
    }
    const montoPyg = isMultiPayment ? parseInt(mixedQrPyg.replace(/\D/g, "") || "0", 10) : totalPyg
    if (montoPyg <= 0) {
      toast.warning("Monto inválido", "Ingrese un monto mayor a 0.")
      return
    }
    setPlugpayState("esperando")
    setPlugpayError("")
    setPlugpayResult(null)
    clearPlugpayPoll()

    try {
      console.log(`[PLUGPAY-TRACE] Simulando cuotas para Gs. ${montoPyg} en ${plugpayCuotas}x`)
      const simRes = await api.plugpay.calcularParcelado({
        monto: montoPyg,
        moneda: "PYG",
        cuotas: plugpayCuotas
      })

      if (!simRes.ok) {
        throw new Error(simRes.error_message || "Error al simular parcelado.")
      }

      const valBrl = simRes.data?.valorEmBRL || simRes.data?.calculoParcelas?.valorOriginal || (rates.BRL > 0 ? (montoPyg / rates.BRL) : 0)
      const valBrlNum = parseFloat(valBrl)
      setPlugpayBrlValue(valBrlNum)

      console.log(`[PLUGPAY-TRACE] Iniciando parcelado de Gs. ${montoPyg} en BRL para CPF ${cleanCpf}`)
      const startRes = await api.plugpay.startParcelado({
        monto: montoPyg,
        moneda: "PYG",
        cuotas: plugpayCuotas,
        customer_cpf: cleanCpf,
        customer_phone: cleanPhone
      })

      if (!startRes.ok) {
        throw new Error(startRes.error_message || "Error al iniciar Crédito Parcelado.")
      }

      setPlugpayResult(startRes.data)
      const refInterna = startRes.data.serialNumber || startRes.data.SerialNumber || startRes.data.referenciaInterna || String(startRes.data.IdInitialTransaction || "")

      plugpayPollIntervalRef.current = setInterval(async () => {
        try {
          const statusRes = await api.plugpay.parceladoStatus(refInterna)
          if (statusRes.ok && statusRes.data) {
            const txn = statusRes.data.transaction || statusRes.data
            console.log(`[PLUGPAY-TRACE] Polling Crédito status:`, txn)
            if (txn.token || txn.payment_method_id || txn.status === 1 || txn.status === "approved") {
              clearPlugpayPoll()
              setPlugpayState("aprobada")
              toast.success("Crédito Aprobado", "La transacción con tarjeta de Brasil fue aprobada con éxito.")
              setBancardQrResult({
                codigoAutorizacion: txn.SerialNumber || String(txn.id || "PLUGPAY"),
                nroBoleta: String(txn.id || Date.now()),
                mensajeDisplay: "APROBADA",
                nombreTarjeta: "PLUGPAY CRÉDITO",
                nombreCliente: plugpayCpf,
              })
              setBancardQrState("aprobada")
            } else if (txn.status === 6 || txn.status === "rejected" || txn.status === "cancelled") {
              clearPlugpayPoll()
              setPlugpayState("error")
              setPlugpayError("La transacción con tarjeta fue cancelada o rechazada.")
              toast.error("Transacción Rechazada", "El pago con tarjeta fue rechazado.")
            }
          }
        } catch (err) {
          console.error("Error en polling parcelado:", err)
        }
      }, 4000)

    } catch (e: any) {
      console.error(e)
      setPlugpayState("error")
      setPlugpayError(e.message || "Error al conectar con PlugPay.")
      toast.error("Error PlugPay", e.message || "No se pudo procesar el crédito.")
    }
  }

  useEffect(() => {
    return () => {
      clearPlugpayPoll()
    }
  }, [])

  const resetBancardFlow = () => {
    setBancardTxnState("idle"); setBancardTxnResult(null); setBancardTxnError(""); setShowBancardManualFallback(false); setBancardTxnLogId(null); setPosCardCuotas(1)
    setBancardQrState("idle"); setBancardQrResult(null); setBancardQrError(""); setBancardQrManualConfirm(false); setBancardQrLogId(null); setShowBancardQrManualFallback(false); setPosQrCupon(""); setPosQrAuth("")
    setPlugpayState("idle"); setPlugpayResult(null); setPlugpayError(""); setPlugpayBrlValue(null); clearPlugpayPoll()
    setDinelcoTxnState("idle"); setDinelcoTxnResult(null); setDinelcoTxnError(""); setDinelcoTxnLogId(null); setDinelcoSessionId(null); setDinelcoCuotas(1); setShowDinelcoManualFallback(false)
    setDinelcoQrState("idle"); setDinelcoQrError(""); setDinelcoQrMode("qr"); setDinelcoPixCpf("")
  }

  // El terminal Bancard no tiene forma via API de forzar la limpieza de una
  // transaccion que quedo "en proceso" (la documentacion oficial solo cubre
  // anulacion de ventas YA aprobadas, no de una operacion colgada) -- la
  // unica salida real es cancelarla a mano en la pantalla del propio
  // terminal. "Reintentar" en la app SI funciona (manda el pedido de nuevo),
  // pero el terminal lo va a seguir rechazando hasta que se cancele ahi.
  const bancardErrorMessage = (rawMessage: string | undefined) => {
    const msg = rawMessage || "El terminal rechazó la operación."
    if (/en proceso|en curso/i.test(msg)) {
      return `${msg} -- Cancelá la operación pendiente en la pantalla del propio terminal Bancard (presionando la X o el botón rojo) y después tocá Reintentar.`
    }
    return msg
  }

  const logBancardTxn = async (data: Record<string, any>) => {
    try {
      return await api.posTerminalTransactions.create({
        ...data,
        punto_emision: puntoEmision,
        customer_id: customer && customer.id !== DEFAULT_CUSTOMER.id ? customer.id : null,
      } as any)
    } catch (e) {
      console.error("No se pudo registrar la transacción del terminal Bancard:", e)
      return null
    }
  }

  const handleBancardCharge = async () => {
    console.log(`[BANCARD-TRACE] Tarjeta handler invocado, bancardIp=${activePosConfig.bancardIp || "(vacio)"}, tipo=${posCardType}, cuotas=${posCardCuotas}`)
    const ip = activePosConfig.bancardIp
    if (!ip) {
      toast.warning("Falta configurar el terminal", "Cargá la IP del terminal Bancard para esta caja en \"Configurar Terminales POS\".")
      return
    }
    const montoBancard = isMultiPayment ? parseInt(mixedCardPyg.replace(/\D/g, "") || "0", 10) : totalPyg
    if (montoBancard <= 0) {
      toast.warning("Monto inválido", "Cargá el monto a cobrar por Bancard antes de continuar.")
      return
    }
    const electronAPI = (window as any).electronAPI
    if (!electronAPI?.bancardCall) {
      setBancardTxnState("error_conexion")
      setBancardTxnError("Esta pantalla no está corriendo dentro de la app de caja -- no se puede conectar al terminal desde acá.")
      setShowBancardManualFallback(true)
      return
    }
    const facturaNro = Date.now()
    setBancardTxnState("esperando_tarjeta")
    setBancardTxnError("")
    setBancardTxnResult(null)
    setShowBancardManualFallback(false)

    // Venta Contado universal oficial (soporta débito y crédito sin discriminar con chip/contactless/banda)
    // Si se seleccionó crédito en cuotas (>=2), envía cuotas y plan 1 según la sección 5.2 de Bancard
    const path1 = "/pos/venta-ux"
    const body1: any = { facturaNro, monto: montoBancard }
    if (posCardType === "credito" && posCardCuotas > 1) {
      body1.cuotas = posCardCuotas
      body1.plan = 1
    }
    console.log(`[BANCARD-TRACE] paso1 -> ip=${ip} path=${path1} body=${JSON.stringify(body1)}`)
    const res1 = await electronAPI.bancardCall(ip, path1, body1, 90000)
    console.log(`[BANCARD-TRACE] paso1 <- ${JSON.stringify(res1)}`)

    if (!res1.ok) {
      if (res1.status === 400 || res1.status === 500) {
        setBancardTxnState("error_rechazo")
        setBancardTxnError(bancardErrorMessage(res1.body?.message))
        await logBancardTxn({
          tipo_operacion: posCardType === "debito" ? "venta_debito" : (posCardCuotas > 1 ? `venta_credito_${posCardCuotas}cuotas` : "venta_credito"),
          exitosa: false, verificado_automaticamente: true, error_message: res1.body?.message,
          monto: montoBancard, terminal_ip: ip, factura_nro_provisional: String(facturaNro), raw_response: res1.body,
        })
      } else {
        setBancardTxnState("error_conexion")
        setBancardTxnError(`No se pudo conectar con el terminal (${res1.message || "error de red"}) -- verificá la red o cargá el cupón manualmente si ya cobraste en el terminal.`)
        setShowBancardManualFallback(true)
      }
      return
    }

    const { bin, nsu } = res1.body || {}
    setBancardTxnState("confirmando")
    const body2 = { bin, nsu, monto: montoBancard }
    console.log(`[BANCARD-TRACE] paso2 -> ip=${ip} path=/pos/descuento body=${JSON.stringify(body2)}`)
    const res2 = await electronAPI.bancardCall(ip, "/pos/descuento", body2, 30000)
    console.log(`[BANCARD-TRACE] paso2 <- ${JSON.stringify(res2)}`)

    if (!res2.ok) {
      if (res2.status === 400 || res2.status === 500) {
        setBancardTxnState("error_rechazo")
        setBancardTxnError(bancardErrorMessage(res2.body?.message))
        await logBancardTxn({
          tipo_operacion: posCardType === "debito" ? "venta_debito" : (posCardCuotas > 1 ? `venta_credito_${posCardCuotas}cuotas` : "venta_credito"),
          exitosa: false, verificado_automaticamente: true, error_message: res2.body?.message,
          bin, nsu, monto: montoBancard, terminal_ip: ip, factura_nro_provisional: String(facturaNro), raw_response: res2.body,
        })
      } else {
        setBancardTxnState("error_conexion")
        setBancardTxnError(`Se cobró en el terminal pero no se pudo confirmar la respuesta (${res2.message || "error de red"}) -- revisá el terminal y cargá el cupón manualmente.`)
        setShowBancardManualFallback(true)
      }
      return
    }

    const result = res2.body || {}
    setBancardTxnResult(result)
    setBancardTxnState("aprobada")
    const logged = await logBancardTxn({
      tipo_operacion: posCardType === "debito" ? "venta_debito" : (posCardCuotas > 1 ? `venta_credito_${posCardCuotas}cuotas` : "venta_credito"),
      exitosa: true, verificado_automaticamente: true,
      bin, nsu, monto: montoBancard, terminal_ip: ip, factura_nro_provisional: String(facturaNro),
      codigo_autorizacion: result.codigoAutorizacion, codigo_comercio: result.codigoComercio,
      issuer_id: result.issuerId, nombre_tarjeta: result.nombreTarjeta, pan: result.pan,
      mensaje_display: result.mensajeDisplay, nombre_cliente: result.nombreCliente,
      monto_vuelto: result.montoVuelto, saldo: result.saldo, raw_response: result,
    })
    setBancardTxnLogId((logged as any)?.id || null)
    setPosCardCupon(result.nroBoleta || "")
  }

  const logDinelcoTxn = async (data: Record<string, any>) => {
    try {
      return await api.posTerminalTransactions.create({
        ...data,
        punto_emision: puntoEmision,
        customer_id: customer && customer.id !== DEFAULT_CUSTOMER.id ? customer.id : null,
      } as any)
    } catch (e) {
      console.error("No se pudo registrar la transacción del terminal Dinelco:", e)
      return null
    }
  }

  // Protocolo Dinelco real (manual "Integracion Caja - POS WIFI/LAN/USB v2.6"):
  // TCP crudo puerto 9600, pipe-delimited. Secuencia: RBIN (pide monto+OP, el
  // terminal solicita la tarjeta) -> ENDOP (confirma monto/cuotas, dispara la
  // autorizacion). El bridge vive en Electron main (net.Socket), no en el
  // backend Python, porque el terminal esta en la LAN de la caja, igual que
  // Bancard -- ver electron/dinelco-client.cjs.
  const handleDinelcoCharge = async () => {
    const ip = activePosConfig.dinelcoIp
    if (!ip) {
      toast.warning("Falta configurar el terminal", "Cargá la IP del terminal Dinelco para esta caja en \"Configurar Terminales POS\".")
      return
    }
    const montoDinelco = isMultiPayment ? parseInt(mixedDinelcoPyg.replace(/\D/g, "") || "0", 10) : totalPyg
    if (montoDinelco <= 0) {
      toast.warning("Monto inválido", "Cargá el monto a cobrar por Dinelco antes de continuar.")
      return
    }
    const electronAPI = (window as any).electronAPI
    if (!electronAPI?.dinelcoCall) {
      setDinelcoTxnState("error_conexion")
      setDinelcoTxnError("Esta pantalla no está corriendo dentro de la app de caja -- no se puede conectar al terminal desde acá.")
      setShowDinelcoManualFallback(true)
      return
    }
    setDinelcoTxnState("esperando_tarjeta")
    setDinelcoTxnError("")
    setDinelcoTxnResult(null)
    setShowDinelcoManualFallback(false)

    const res1 = await electronAPI.dinelcoCall(ip, "venta_inicio", { op: "01", monto: montoDinelco }, null, 90000)

    if (!res1.ok) {
      setDinelcoTxnState(res1.error ? "error_conexion" : "error_rechazo")
      setDinelcoTxnError(res1.error ? `No se pudo conectar con el terminal (${res1.error}) -- verificá la red o cargá el cupón manualmente si ya cobraste en el terminal.` : (res1.desc || "El terminal rechazó la operación."))
      if (res1.error) setShowDinelcoManualFallback(true)
      await logDinelcoTxn({
        tipo_operacion: dinelcoCardType === "credito" && dinelcoCuotas > 1 ? `dinelco_venta_credito_${dinelcoCuotas}cuotas` : `dinelco_venta_${dinelcoCardType}`,
        exitosa: false, verificado_automaticamente: true, error_message: res1.desc || res1.error,
        monto: montoDinelco, terminal_ip: ip, raw_response: res1,
      })
      return
    }

    setDinelcoSessionId(res1.sessionId)
    setDinelcoTxnState("confirmando")
    const cuotasParam = dinelcoCardType === "credito" && dinelcoCuotas > 1 ? dinelcoCuotas : 0
    const res2 = await electronAPI.dinelcoCall(ip, "venta_confirmar", { cuotas: cuotasParam, monto: montoDinelco }, res1.sessionId, 30000)

    if (!res2.ok) {
      setDinelcoTxnState(res2.error ? "error_conexion" : "error_rechazo")
      setDinelcoTxnError(res2.error ? `Se inició el cobro en el terminal pero no se pudo confirmar la respuesta (${res2.error}) -- revisá el terminal y cargá el cupón manualmente.` : (res2.desc || "El terminal rechazó la operación."))
      if (res2.error) setShowDinelcoManualFallback(true)
      await logDinelcoTxn({
        tipo_operacion: dinelcoCardType === "credito" && dinelcoCuotas > 1 ? `dinelco_venta_credito_${dinelcoCuotas}cuotas` : `dinelco_venta_${dinelcoCardType}`,
        exitosa: false, verificado_automaticamente: true, error_message: res2.desc || res2.error,
        monto: montoDinelco, terminal_ip: ip, raw_response: res2,
      })
      setDinelcoSessionId(null)
      return
    }

    // Orden de CAMPOSOK del manual: AUTHCODE|AUTHORIZER|OPTYPE|BOLETA|TERMINAL|COMERCIO|ULTIMOS4|PUNTOS
    const c = res2.campos || []
    const result = {
      codigoAutorizacion: c[0] || "", authorizer: c[1] || "", opType: c[2] || "",
      nroBoleta: c[3] || "", terminal: c[4] || "", comercio: c[5] || "", ultimos4: c[6] || "", puntos: c[7] || "",
    }
    setDinelcoTxnResult(result)
    setDinelcoTxnState("aprobada")
    const logged = await logDinelcoTxn({
      tipo_operacion: dinelcoCardType === "credito" && dinelcoCuotas > 1 ? `dinelco_venta_credito_${dinelcoCuotas}cuotas` : `dinelco_venta_${dinelcoCardType}`,
      exitosa: true, verificado_automaticamente: true,
      monto: montoDinelco, terminal_ip: ip,
      codigo_autorizacion: result.codigoAutorizacion, codigo_comercio: result.comercio,
      mensaje_display: "APROBADA", raw_response: result,
    })
    setDinelcoTxnLogId((logged as any)?.id || null)
    setDinelcoSessionId(null)
    setDinelcoCupon(result.nroBoleta || "")
  }

  const handleDinelcoQR = async () => {
    const ip = activePosConfig.dinelcoIp
    if (!ip) {
      toast.warning("Falta configurar el terminal", "Cargá la IP del terminal Dinelco para esta caja en \"Configurar Terminales POS\".")
      return
    }
    const montoQrDinelco = isMultiPayment ? parseInt(mixedQrPyg.replace(/\D/g, "") || "0", 10) : totalPyg
    if (montoQrDinelco <= 0) {
      toast.warning("Monto inválido", "Cargá el monto a cobrar por QR antes de continuar.")
      return
    }
    if (dinelcoQrMode === "pix" && dinelcoPixCpf.replace(/\D/g, "").length !== 11) {
      toast.warning("CPF inválido", "El CPF del comprador debe tener 11 dígitos para procesar PIX.")
      return
    }
    const electronAPI = (window as any).electronAPI
    if (!electronAPI?.dinelcoCall) {
      setDinelcoQrState("error_conexion")
      setDinelcoQrError("Esta pantalla no está corriendo dentro de la app de caja -- no se puede conectar al terminal desde acá.")
      return
    }
    setDinelcoQrState("esperando")
    setDinelcoQrError("")

    const res = dinelcoQrMode === "pix"
      ? await electronAPI.dinelcoCall(ip, "pix", { monto: montoQrDinelco, cpf: dinelcoPixCpf.replace(/\D/g, "") }, null, 90000)
      : await electronAPI.dinelcoCall(ip, "qr", { op: "01", monto: montoQrDinelco }, null, 90000)

    const tipoOperacion = dinelcoQrMode === "pix" ? "dinelco_pix" : "dinelco_qr"

    if (!res.ok) {
      setDinelcoQrState(res.error ? "error_conexion" : "error_rechazo")
      setDinelcoQrError(res.error ? `No se pudo conectar con el terminal (${res.error}).` : (res.desc || "El terminal rechazó la operación."))
      await logDinelcoTxn({
        tipo_operacion: tipoOperacion, exitosa: false, verificado_automaticamente: true,
        error_message: res.desc || res.error, monto: montoQrDinelco, terminal_ip: ip, raw_response: res,
      })
      return
    }

    setDinelcoQrState("aprobada")
    await logDinelcoTxn({
      tipo_operacion: tipoOperacion, exitosa: true, verificado_automaticamente: true,
      monto: montoQrDinelco, terminal_ip: ip, mensaje_display: "APROBADA", raw_response: res,
    })
  }

  const handleBancardQR = async () => {
    console.log(`[BANCARD-TRACE] QR handler invocado, bancardIp=${activePosConfig.bancardIp || "(vacio)"}`)
    const ip = activePosConfig.bancardIp
    if (!ip) {
      toast.warning("Falta configurar el terminal", "Cargá la IP del terminal Bancard para esta caja en \"Configurar Terminales POS\".")
      return
    }
    const montoQr = isMultiPayment ? parseInt(mixedQrPyg.replace(/\D/g, "") || "0", 10) : totalPyg
    if (montoQr <= 0) {
      toast.warning("Monto inválido", "Cargá el monto a cobrar por QR antes de continuar.")
      return
    }
    const electronAPI = (window as any).electronAPI
    if (!electronAPI?.bancardCall) {
      setBancardQrState("error_conexion")
      setBancardQrError("Esta pantalla no está corriendo dentro de la app de caja -- no se puede conectar al terminal desde acá.")
      return
    }
    const facturaNro = Date.now()
    setBancardQrState("esperando")
    setBancardQrError("")
    setBancardQrResult(null)
    setBancardQrManualConfirm(false)

    const bodyQr = { facturaNro, monto: montoQr, montoVuelto: 0 }
    console.log(`[BANCARD-TRACE] QR -> ip=${ip} path=/pos/venta-qr body=${JSON.stringify(bodyQr)}`)
    const res = await electronAPI.bancardCall(ip, "/pos/venta-qr", bodyQr, 180000)
    console.log(`[BANCARD-TRACE] QR <- ${JSON.stringify(res)}`)

    if (!res.ok) {
      if (res.status === 400 || res.status === 500) {
        setBancardQrState("error_rechazo")
        setBancardQrError(bancardErrorMessage(res.body?.message))
        await logBancardTxn({
          tipo_operacion: "venta_qr", exitosa: false, verificado_automaticamente: true, error_message: res.body?.message,
          monto: montoQr, terminal_ip: ip, factura_nro_provisional: String(facturaNro), raw_response: res.body,
        })
      } else {
        setBancardQrState("error_conexion")
        setBancardQrError(`No se pudo conectar con el terminal (${res.message || "error de red"}).`)
      }
      return
    }

    const result = res.body || {}
    setBancardQrResult(result)
    setBancardQrState("aprobada")
    const logged = await logBancardTxn({
      tipo_operacion: "venta_qr", exitosa: true, verificado_automaticamente: true,
      monto: montoQr, terminal_ip: ip, factura_nro_provisional: String(facturaNro),
      codigo_autorizacion: result.codigoAutorizacion, codigo_comercio: result.codigoComercio,
      issuer_id: result.issuerId, nombre_tarjeta: result.nombreTarjeta, pan: result.pan,
      mensaje_display: result.mensajeDisplay, nombre_cliente: result.nombreCliente,
      monto_vuelto: result.montoVuelto, saldo: result.saldo, raw_response: result,
    })
    setBancardQrLogId((logged as any)?.id || null)
  }


  // Sincronizar terminales cuando cambia la caja
  useEffect(() => {
    setPosTerminalId(activePosConfig.bancardTerminalId)
    setPosCardLote(activePosConfig.bancardLote)
    setDinelcoTerminalId(activePosConfig.dinelcoTerminalId)
    setDinelcoLote(activePosConfig.dinelcoLote)
  }, [activePosConfig])

  // Cobro Mixto
  const [mixedCardPyg, setMixedCardPyg] = useState("")
  const [mixedDinelcoPyg, setMixedDinelcoPyg] = useState("")
  const [mixedQrPyg, setMixedQrPyg] = useState("")
  const [mixedParceladoPyg, setMixedParceladoPyg] = useState("")
  const [mixedExtraClubPyg, setMixedExtraClubPyg] = useState("")

  // ── Extra Club (pago a credito) -- busqueda propia dentro del tab de pago,
  // separada del selector general de "Cliente" del ticket: acá además hace
  // falta ver la línea de crédito real antes de dejar avanzar el cobro.
  const [extraClubQuery, setExtraClubQuery] = useState("")
  const [extraClubResults, setExtraClubResults] = useState<Customer[]>([])
  const [extraClubHighlight, setExtraClubHighlight] = useState(0)
  const [extraClubSearching, setExtraClubSearching] = useState(false)
  const [extraClubCredit, setExtraClubCredit] = useState<{ limite_credito: number; saldo_disponible: number; saldo_utilizado: number; activo: boolean } | null | "loading">(null)
  const [extraClubAdminOverride, setExtraClubAdminOverride] = useState(false)
  const [showExtraClubBalanceModal, setShowExtraClubBalanceModal] = useState(false)
  const [balanceModalQuery, setBalanceModalQuery] = useState("")
  const [balanceModalResults, setBalanceModalResults] = useState<Customer[]>([])
  const [balanceModalHighlight, setBalanceModalHighlight] = useState(0)
  const [balanceModalSearching, setBalanceModalSearching] = useState(false)
  const [balanceModalSelected, setBalanceModalSelected] = useState<Customer | null>(null)
  const [balanceModalCredit, setBalanceModalCredit] = useState<{ limite_credito: number; saldo_disponible: number; saldo_utilizado: number; activo: boolean } | null | "loading">(null)

  const [showLostDemandModal, setShowLostDemandModal] = useState(false)
  const [lostDemandCliente, setLostDemandCliente] = useState("")
  const [lostDemandTelefono, setLostDemandTelefono] = useState("")
  const [lostDemandRows, setLostDemandRows] = useState<{ producto: string; motivo: string }[]>([{ producto: "", motivo: "sin_stock" }])
  // Busqueda de cliente real (contra la base) para el modal de Producto No
  // Encontrado -- antes era un campo de texto libre que no quedaba
  // vinculado a ningun cliente real. Mismo patron de debounce + auto-select
  // en unico resultado que ya se usa en Extra Club / Consulta de Productos.
  const [lostDemandCustomer, setLostDemandCustomer] = useState<Customer | null>(null)
  const [lostDemandSearchResults, setLostDemandSearchResults] = useState<Customer[]>([])
  const [lostDemandSearching, setLostDemandSearching] = useState(false)
  const [showLostDemandRegisterForm, setShowLostDemandRegisterForm] = useState(false)
  const [newLostDemandNombre, setNewLostDemandNombre] = useState("")
  const [newLostDemandPhoneCountry, setNewLostDemandPhoneCountry] = useState<"+595" | "+55">("+595")
  const [newLostDemandPhoneNumber, setNewLostDemandPhoneNumber] = useState("")
  const [creatingLostDemandCustomer, setCreatingLostDemandCustomer] = useState(false)
  const [lostDemandUrgencia, setLostDemandUrgencia] = useState<"normal" | "urgente">("normal")

  const [submitting, setSubmitting] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // ── CARGA OFFLINE INSTANTÁNEA (INDEXEDDB) Y SINCRONIZACIÓN PERIÓDICA EN SEGUNDO PLANO ──
  useEffect(() => {
    let isMounted = true

    async function syncCatalog(isInitial: boolean) {
      if (isInitial) {
        // 1. Cargar inmediatamente de IndexedDB / localStorage (0ms, 100% offline)
        try {
          const cached = await loadCachedPOSData()
          if (isMounted) {
            if (cached.cachedProducts.length > 0) setProducts(cached.cachedProducts)
            if (cached.cachedCustomers.length > 0) setCustomers(cached.cachedCustomers)
            if (cached.cachedStaff.length > 0) setSupervisorStaffOptions(cached.cachedStaff)
          }
        } catch (e) {
          console.warn("[POS] Error leyendo cache offline:", e)
        }
      }

      // 2. Consulta en segundo plano al servidor central
      try {
        const [prodData, custData, whData, staffData, topData, stockData, packBarcodeData] = await Promise.allSettled([
          api.products.list({ limit: 15000 }),
          api.customers.list({ limit: 10000 }),
          api.warehouses.list(),
          api.auth.posAuthorizers(),
          api.reports.salesByProduct({ limit: 100 }),
          api.inventory.getStockMap(),
          api.products.packBarcodes.list(),
        ])

        let freshProds: Product[] = []
        let freshCusts: Customer[] = []
        let freshStaff: any[] = []

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
          freshProds = Array.from(map.values())
          if (isMounted) setProducts(freshProds)
        }

        if (custData.status === "fulfilled") {
          freshCusts = (custData.value || []).map(normalizeCustomer)
          if (isMounted) setCustomers(freshCusts)
        }

        if (whData.status === "fulfilled" && isMounted) {
          setWarehouses((whData.value || []).filter((w: any) => w.activo !== false))
        }

        if (staffData.status === "fulfilled") {
          freshStaff = staffData.value?.staff || []
          if (isMounted) setSupervisorStaffOptions(freshStaff)
        }

        if (topData.status === "fulfilled" && isMounted) {
          setTopProductSkus((topData.value || []).map((r: any) => r.sku).filter(Boolean))
        }

        if (stockData.status === "fulfilled" && isMounted) {
          setStockMap(stockData.value || {})
        }

        if (packBarcodeData.status === "fulfilled" && isMounted) {
          const map = new Map<string, { productId: string; etiqueta: string; unidadesPorPaquete: number }>()
          for (const pb of packBarcodeData.value || []) {
            map.set(pb.codigo_barra, {
              productId: pb.product_id,
              etiqueta: pb.etiqueta,
              unidadesPorPaquete: Number(pb.unidades_por_paquete),
            })
          }
          setPackBarcodeMap(map)
        }

        // 3. Persistir catálogo completo indexado en IndexedDB
        if (freshProds.length > 0 || freshCusts.length > 0) {
          persistPOSCatalog(freshProds, freshCusts, freshStaff)
        }
      } catch (err: any) {
        if (isInitial) {
          console.warn("[POS] Trabajando en modo offline con datos locales indexados.")
        }
      } finally {
        if (isInitial && isMounted) setLoading(false)
      }
    }

    // Carga inicial
    syncCatalog(true)
    syncPendingSales().catch(() => {})

    // Sincronización silenciosa en background cada 2 minutos
    const syncInterval = setInterval(() => {
      syncCatalog(false)
      syncPendingSales().catch(() => {})
    }, 2 * 60 * 1000)

    return () => {
      isMounted = false
      clearInterval(syncInterval)
    }
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
        // Consulta directa: un codigo de barras escaneado siempre da una
        // sola coincidencia exacta -- antes había que ademas tocar la fila
        // o apretar Enter para recien ver el detalle (foto/escala/monedas),
        // un paso de mas que generaba exactamente la confusion de "no
        // aparece nada" cuando lo unico visible todavia era la lista.
        if (res && res.length === 1) {
          handlePriceCheckSelect(res[0])
        }
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

  // Busqueda de cliente para el modal de Producto No Encontrado -- mismo
  // criterio que el buscador F9: debounce + auto-seleccion si hay una unica
  // coincidencia, para no obligar a la cajera a tocar un resultado obvio.
  useEffect(() => {
    if (!showLostDemandModal) return
    const query = lostDemandCliente.trim()
    if (!query) {
      setLostDemandSearchResults([])
      setLostDemandSearching(false)
      return
    }
    const timer = setTimeout(async () => {
      setLostDemandSearching(true)
      try {
        const res = await api.customers.list({ search: query, limit: 10 })
        const normalized = (res || []).map(normalizeCustomer)
        setLostDemandSearchResults(normalized)
        if (normalized.length === 1) {
          setLostDemandCustomer(normalized[0])
        }
      } catch (e) {
      } finally {
        setLostDemandSearching(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [lostDemandCliente, showLostDemandModal])

  const handleCreateLostDemandCustomer = async () => {
    if (!newLostDemandNombre.trim()) {
      toast.warning("Falta el nombre", "Ingrese el nombre del cliente.")
      return
    }
    setCreatingLostDemandCustomer(true)
    try {
      const telefono = newLostDemandPhoneNumber.trim()
        ? `${newLostDemandPhoneCountry}${newLostDemandPhoneNumber.replace(/\D/g, "")}`
        : undefined
      const createdRaw = await api.customers.create({
        nombre: newLostDemandNombre.trim(),
        razon_social: newLostDemandNombre.trim(),
        telefono,
        activo: true,
      } as any)
      const created = createdRaw ? normalizeCustomer(createdRaw) : null
      if (created) {
        setLostDemandCustomer(created)
        setLostDemandCliente(created.nombre || "")
        setShowLostDemandRegisterForm(false)
        setNewLostDemandNombre("")
        setNewLostDemandPhoneNumber("")
        toast.success("Cliente registrado", `${created.nombre} guardado en la base.`)
      }
    } catch (e: any) {
      toast.error("No se pudo registrar", e?.message || "Intente nuevamente.")
    } finally {
      setCreatingLostDemandCustomer(false)
    }
  }

  // Busqueda de socio Extra Club por numero/RUC/cedula/nombre -- mismo
  const getCustomerCreditFallback = (c: any) => {
    if (!c) return null
    const lim = Number(c.credito_limite ?? c.limite_credito ?? 0)
    const usado = Number(c.credito_usado ?? 0)
    const disp = Math.max(0, lim - usado)
    return {
      limite_credito: lim,
      saldo_disponible: disp,
      saldo_utilizado: usado,
      activo: c.activo !== false,
    }
  }

  // Criterio de búsqueda Extra Club: búsqueda instantánea local + fallback remoto
  useEffect(() => {
    if (!activeMethods.has("extra_club")) return
    const query = extraClubQuery.trim()
    if (!query) { setExtraClubResults([]); setExtraClubSearching(false); return }

    // 1. Coincidencias instantáneas en memoria/IndexedDB (0ms)
    const localMatches = (customers || []).filter((c: any) => {
      const name = (c.nombre || c.razon_social || c.nombre_fantasia || "").toLowerCase()
      const ruc = (c.ruc || "").toLowerCase()
      const ci = (c.ci || "").toLowerCase()
      const club = (c.extra_club_numero || "").toLowerCase()
      const q = query.toLowerCase()
      return name.includes(q) || ruc.includes(q) || ci.includes(q) || club.includes(q)
    }).slice(0, 15).map(normalizeCustomer)

    if (localMatches.length > 0) {
      setExtraClubResults(localMatches)
      setExtraClubHighlight(0)
      if (localMatches.length === 1) {
        setCustomer(localMatches[0])
        setExtraClubQuery("")
        setExtraClubResults([])
        setExtraClubAdminOverride(false)
      }
    }

    // 2. Consulta remota en background
    const timer = setTimeout(async () => {
      setExtraClubSearching(true)
      try {
        const res = (await api.customers.list({ search: query, limit: 15 })) || []
        const normalized = res.map(normalizeCustomer)
        if (normalized.length > 0) {
          setExtraClubResults(normalized)
          setExtraClubHighlight(0)
          if (normalized.length === 1) {
            setCustomer(normalized[0])
            setExtraClubQuery("")
            setExtraClubResults([])
            setExtraClubAdminOverride(false)
          }
        }
      } catch (e) {
      } finally {
        setExtraClubSearching(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [extraClubQuery, activeMethods, customers])

  // Línea de crédito real del cliente elegido para Extra Club
  useEffect(() => {
    if (!activeMethods.has("extra_club") || !customer || customer.id === DEFAULT_CUSTOMER.id) {
      setExtraClubCredit(null)
      return
    }
    const fallbackCredit = getCustomerCreditFallback(customer)
    if (fallbackCredit && fallbackCredit.limite_credito > 0) {
      setExtraClubCredit(fallbackCredit)
    } else {
      setExtraClubCredit("loading")
    }

    let cancelled = false
    api.creditAccounts.getByCustomer(customer.id)
      .then((acc) => {
        if (!cancelled) {
          if (acc) {
            setExtraClubCredit({
              limite_credito: Number(acc.limite_credito || 0),
              saldo_disponible: Number(acc.saldo_disponible || 0),
              saldo_utilizado: Number(acc.saldo_utilizado || 0),
              activo: acc.activo !== false,
            })
          } else {
            setExtraClubCredit(fallbackCredit)
          }
        }
      })
      .catch(() => {
        if (!cancelled) setExtraClubCredit(fallbackCredit)
      })
    return () => { cancelled = true }
  }, [customer, activeMethods])

  // Búsqueda para el modal de consulta de saldo (Header / Toolbar)
  useEffect(() => {
    if (!showExtraClubBalanceModal) return
    const query = balanceModalQuery.trim()
    if (!query) { setBalanceModalResults([]); setBalanceModalSearching(false); return }

    // 1. Coincidencias instantáneas en memoria/IndexedDB
    const localMatches = (customers || []).filter((c: any) => {
      const name = (c.nombre || c.razon_social || c.nombre_fantasia || "").toLowerCase()
      const ruc = (c.ruc || "").toLowerCase()
      const ci = (c.ci || "").toLowerCase()
      const club = (c.extra_club_numero || "").toLowerCase()
      const q = query.toLowerCase()
      return name.includes(q) || ruc.includes(q) || ci.includes(q) || club.includes(q)
    }).slice(0, 15).map(normalizeCustomer)

    if (localMatches.length > 0) {
      setBalanceModalResults(localMatches)
      setBalanceModalHighlight(0)
      if (localMatches.length === 1) {
        setBalanceModalSelected(localMatches[0])
      }
    }

    // 2. Consulta remota en background
    const timer = setTimeout(async () => {
      setBalanceModalSearching(true)
      try {
        const res = (await api.customers.list({ search: query, limit: 15 })) || []
        const normalized = res.map(normalizeCustomer)
        if (normalized.length > 0) {
          setBalanceModalResults(normalized)
          setBalanceModalHighlight(0)
          if (normalized.length === 1) {
            setBalanceModalSelected(normalized[0])
          }
        }
      } catch (e) {
      } finally {
        setBalanceModalSearching(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [balanceModalQuery, showExtraClubBalanceModal, customers])

  useEffect(() => {
    if (!balanceModalSelected) { setBalanceModalCredit(null); return }
    const fallbackCredit = getCustomerCreditFallback(balanceModalSelected)
    if (fallbackCredit && fallbackCredit.limite_credito > 0) {
      setBalanceModalCredit(fallbackCredit)
    } else {
      setBalanceModalCredit("loading")
    }

    let cancelled = false
    api.creditAccounts.getByCustomer(balanceModalSelected.id)
      .then((acc) => {
        if (!cancelled) {
          if (acc) {
            setBalanceModalCredit({
              limite_credito: Number(acc.limite_credito || 0),
              saldo_disponible: Number(acc.saldo_disponible || 0),
              saldo_utilizado: Number(acc.saldo_utilizado || 0),
              activo: acc.activo !== false,
            })
          } else {
            setBalanceModalCredit(fallbackCredit)
          }
        }
      })
      .catch(() => {
        if (!cancelled) setBalanceModalCredit(fallbackCredit)
      })
    return () => { cancelled = true }
  }, [balanceModalSelected])

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
            // Merge en cascada: DEFAULT_RECEIPT_CONFIG (base) < DB (empresa) < localStorage (último guardado por el operador).
            // El localStorage es la fuente de verdad del operador: si modificó algo en el Diseñador
            // de Facturas y guardó, eso prevalece sobre lo que la DB tenga. Así los mensajes
            // personalizados sobreviven al reiniciar la caja.
            const dbTpl = (c.config as any).receipt_template as Record<string, unknown>
            const localTplRaw = localStorage.getItem("pos_receipt_template_config")
            const localTpl: Record<string, unknown> = localTplRaw
              ? (() => { try { return JSON.parse(localTplRaw) } catch { return {} } })()
              : {}
            const mergedTpl = { ...DEFAULT_RECEIPT_CONFIG, ...dbTpl, ...localTpl }
            localStorage.setItem("pos_receipt_template_config", JSON.stringify(mergedTpl))
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
              if (dataUrl) { localStorage.setItem("pos_logo_data_url", dataUrl); setHeaderLogoUrl(dataUrl) }
            } catch (e) {}
          } else if (logoUrl) {
            setHeaderLogoUrl(localStorage.getItem("pos_logo_data_url") || logoUrl)
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
  const addToCart = useCallback((product: Product, quantityOverride?: number, origenBalanza?: "balmak_bck30" | "etiqueta_plu") => {
    setLastScannedProduct(product)

    const isPesable = isPesableProduct(product)


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
    // Promo baked-in desde el catálogo (1 query en background, 0 llamadas al escanear)
    const promoPrice = (product as any).en_promocion && (product as any).precio_promo
      ? Number((product as any).precio_promo)
      : null
    const effectivePrice = promoPrice !== null ? promoPrice : unitPrice

    if (isPesable) {
      // Cada pesaje es una pieza física distinta (ej. dos cortes de carne del
      // mismo producto con pesos distintos): siempre se agrega como línea
      // nueva, nunca se sobreescribe un pesaje anterior del mismo producto.
      setCart((prev) => [
        {
          id: `${product.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          product_id: product.id,
          nombre: product.nombre,
          precio: effectivePrice,
          precio_base: unitPrice,
          sku: product.sku || "",
          codigo_barra: product.codigo_barra,
          imagen_url: product.imagen_url,
          quantity: finalQty,
          iva_tasa: ivaTasa,
          es_pesable: true,
          origen_balanza: origenBalanza || "balmak_bck30",
          ...(promoPrice !== null ? {
            en_promocion: true,
            promocion_id: (product as any).promocion_id || null,
            promocion_nombre: (product as any).promocion_nombre || null,
          } : {})
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
          precio: effectivePrice,
          precio_base: unitPrice,
          sku: product.sku || "",
          codigo_barra: product.codigo_barra,
          imagen_url: product.imagen_url,
          quantity: newQty,
          iva_tasa: ivaTasa,
          es_pesable: false,
          origen_balanza: null,
          ...(promoPrice !== null ? {
            en_promocion: true,
            promocion_id: (product as any).promocion_id || null,
            promocion_nombre: (product as any).promocion_nombre || null,
          } : {})
        },
        ...prev,
      ]
    })

    setSearch("")
    searchInputRef.current?.focus()
    // Saltar tiered price si el producto ya tiene promo activa (precio ya correcto)
    if (promoPrice === null) {
      applyTieredPrice(product.id, newQty, customer.id)
    }
  }, [currentScaleWeight, cart, customer.id])

  // ── ESCALA DE PRECIOS POR CANTIDAD (sp_tiered_prices) ──────────────────────
  // Recalcula el precio unitario de la línea no pesable de `productId` contra
  // los escalones cargados en Smart Pricing. Si no hay escalón para la
  // cantidad actual (ya sea por debajo del mínimo, o la API no encuentra
  // nada), vuelve al precio base del producto -- nunca se queda con un precio
  // de escalón que ya no corresponde a la cantidad real.
  // Precio real por cliente (sp_price_list_assignments / Customer.price_list_id,
  // resuelto server-side en /price-lists/lookup) tiene prioridad sobre el
  // escalon por cantidad global -- si el cliente de la venta tiene una lista
  // de precios asignada, se prueba esa fuente primero. Si no hay cliente
  // real (Consumidor Final) o la lista no tiene nada para este producto,
  // cae exactamente al comportamiento de siempre (escalon global, luego
  // precio_base) -- ningun camino existente cambia de comportamiento.
  const applyTieredPrice = useCallback(async (productId: string, quantity: number, customerId?: string) => {
    try {
      // Regla Comercial Extra Supermercado: Si el producto está en promoción activa,
      // las escalas quedan ON HOLD (se preserva el precio promocional).
      let isPromoActive = false
      setCart((prev) => {
        const existing = prev.find((i) => i.product_id === productId && !i.es_pesable)
        if (existing && (existing as any).en_promocion) {
          isPromoActive = true
        }
        return prev
      })
      if (isPromoActive) return

      if (customerId && customerId !== DEFAULT_CUSTOMER.id) {
        const resolved = await api.priceLists.resolvePrice(customerId, productId, Math.floor(quantity)).catch(() => null)
        const resolvedPrice = resolved && typeof resolved.precio !== "undefined" ? Number(resolved.precio) : null
        if (resolvedPrice !== null && !isNaN(resolvedPrice)) {
          setCart((prev) => prev.map((item) =>
            item.product_id === productId && !item.es_pesable && !(item as any).en_promocion
              ? { ...item, precio: resolvedPrice }
              : item
          ))
          return
        }
      }
      const tier = await api.smartPricing.calculateTieredPrice(productId, Math.floor(quantity))
      const tierPrice = tier && typeof tier.precio_unitario !== "undefined" ? Number(tier.precio_unitario) : null
      setCart((prev) => prev.map((item) =>
        item.product_id === productId && !item.es_pesable && !(item as any).en_promocion
          ? { ...item, precio: tierPrice !== null && !isNaN(tierPrice) ? tierPrice : item.precio_base }
          : item
      ))
    } catch (e) {
      setCart((prev) => prev.map((item) =>
        item.product_id === productId && !item.es_pesable && !(item as any).en_promocion
          ? { ...item, precio: item.precio_base }
          : item
      ))
    }
  }, [])

  // Cuando cambia el cliente de la venta (F9, o volver a Consumidor Final),
  // recalcular el precio de las lineas no pesables ya en el carrito contra
  // la lista/asignacion del nuevo cliente.
  useEffect(() => {
    cart.forEach((item) => {
      if (!item.es_pesable) applyTieredPrice(item.product_id, item.quantity, customer.id)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer.id])

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
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "Verifique la conexión con el servidor e intente de nuevo."
      toast.error("No se pudo abrir la caja", msg)
    } finally {
      setSubmittingApertura(false)
    }
  }

  // ── DETECCIÓN AUTOMÁTICA DE TURNO ACTIVO / PAUSADO (NÓMADA & MODELO A) ──
  useEffect(() => {
    if (!user?.id) return
    let isCancelled = false
    api.caja.sessions.activeUser()
      .then((active) => {
        if (isCancelled || !active) return
        setActiveUserSessionInfo(active)
        if (active.estado === "pausada") {
          // Sesión pausada (Modelo A: Relevo / Almuerzo) -> Mostrar modal para reanudar
          setShowReanudarModal(true)
          setShowAperturaModal(false)
        } else if (active.estado === "abierta") {
          // Sesión abierta detectada en backend
          if (!cashSessionId || cashSessionId !== active.id) {
            setCashSessionId(active.id)
            setCajaAbierta(true)
            setShowAperturaModal(false)
            toast.info(
              "Turno Activo Detectado",
              `Continuando turno de ${active.cajero_nombre || user?.nombre} (${active.total_ventas} ventas hoy).`
            )
          }
        }
      })
      .catch(() => {})
    return () => { isCancelled = true }
  }, [user?.id])

  const handleConfirmPausaTurno = async () => {
    if (!cashSessionId) return
    setSubmittingPausa(true)
    try {
      await api.caja.sessions.pause(cashSessionId, { motivo: pausaMotivo.trim() || undefined })
      localStorage.removeItem(userCajaKey)
      setCashSessionId(null)
      setCajaAbierta(false)
      setShowPausaTurnoModal(false)
      toast.success(
        "Turno en Pausa",
        "Tu turno fue pausado con éxito. Puedes retirar tu gaveta. Al regresar podrás reanudarlo aquí o en otra caja."
      )
      // Salir de la sesión de usuario para dejar la pantalla lista para la siguiente cajera
      logout()
    } catch (e: any) {
      toast.error("No se pudo pausar el turno", e?.message || "Intente nuevamente.")
    } finally {
      setSubmittingPausa(false)
    }
  }

  const handleReanudarTurno = async (sessionData?: any) => {
    const targetSession = sessionData || activeUserSessionInfo
    if (!targetSession?.id) return
    setSubmittingReanudar(true)
    try {
      await api.caja.sessions.resume(targetSession.id, {
        cash_register_id: cashRegisterId || undefined,
        punto_emision: puntoEmision || undefined,
      })
      const registro = {
        puntoEmision,
        cajeroId: user?.id,
        cajeroNombre: user?.nombre || "Cajero",
        fechaApertura: targetSession.fecha_apertura || new Date().toISOString(),
        fondoPyg: targetSession.monto_apertura || 0,
        fondoBrl: targetSession.monto_apertura_brl || 0,
        fondoUsd: targetSession.monto_apertura_usd || 0,
        cashSessionId: targetSession.id,
      }
      localStorage.setItem(userCajaKey, JSON.stringify(registro))
      setCashSessionId(targetSession.id)
      setCajaAbierta(true)
      setShowReanudarModal(false)
      setShowAperturaModal(false)
      toast.success(
        "¡Turno Reanudado!",
        `Continuando turno en ${PUNTOS_EMISION.find(p => p.id === puntoEmision)?.nombre || puntoEmision}.`
      )
    } catch (e: any) {
      toast.error("No se pudo reanudar el turno", e?.message || "Intente nuevamente.")
    } finally {
      setSubmittingReanudar(false)
    }
  }

  const handleOpenCierreModal = async () => {
    setShowCierreTurnoModal(true)
    setCierreTab("conteo")
    if (cashSessionId) {
      setLoadingPreClose(true)
      try {
        const data = await api.caja.sessions.preCloseSummary(cashSessionId)
        setPreCloseData(data)
      } catch (e) {
        console.error("Error cargando pre-cierre:", e)
      } finally {
        setLoadingPreClose(false)
      }
    }
  }

  // Cierre de caja: con vista previa de conciliación por formas de pago
  const handleConfirmCierreCaja = async () => {
    if (!cashSessionId) {
      toast.warning("No hay sesión de caja activa", "")
      return
    }
    const contado = parseInt(montoCierreReal.replace(/\D/g, "") || "0", 10)
    const contadoUsd = parseFloat(montoCierreUsd.replace(/,/g, ".") || "0") || 0
    const contadoBrl = parseFloat(montoCierreBrl.replace(/,/g, ".") || "0") || 0
    const currentSessionId = cashSessionId
    setSubmittingCierre(true)
    try {
      const result = await api.caja.sessions.close(currentSessionId, {
        monto_cierre_real: contado,
        monto_cierre_usd: contadoUsd,
        monto_cierre_brl: contadoBrl,
      })
      setLastClosedSessionId(currentSessionId)
      if ((result as any)?.handoff_id) {
        pendingHandoffIdRef.current = String((result as any).handoff_id)
      }
      setCierreResult({
        monto_cierre_esperado: result.monto_cierre_esperado,
        diferencia: result.diferencia,
        diferencia_usd: result.diferencia_usd,
        diferencia_brl: result.diferencia_brl,
        requiere_revision: result.requiere_revision,
        desglose_formas_pago: result.desglose_formas_pago || [],
        contado,
        contado_usd: contadoUsd,
        contado_brl: contadoBrl,
      })

      const resAny = result as any
      const fondoPyg = Number(resAny?.monto_apertura ?? preCloseData?.monto_apertura_pyg ?? 0)
      const fondoBrl = Number(resAny?.monto_apertura_brl ?? preCloseData?.monto_apertura_brl ?? 0)
      const fondoUsd = Number(resAny?.monto_apertura_usd ?? preCloseData?.monto_apertura_usd ?? 0)
      const diferencia = result.diferencia || 0
      const difBrl = result.diferencia_brl || 0
      const difUsd = result.diferencia_usd || 0
      const puntoNombre = PUNTOS_EMISION.find(p => p.id === puntoEmision)?.nombre || puntoEmision || "Caja"

      // ── Impresión ESC/POS Nativa para Impresora Térmica ZKP8008 ────────
      if ((window as any).electronAPI?.printEscPos) {
        const W = ESCPOS_LINE_WIDTH
        let t = ESCPOS_INIT
        t += ESCPOS_ALIGN_CENTER
        t += ESCPOS_BOLD_ON + "EXTRA SUPERMERCADO MAYORISTA\n" + ESCPOS_BOLD_OFF
        t += "GRUPO SANTA TERESA E.A.S.\n"
        t += "RUC: 80150377-9\n"
        t += ESCPOS_BOLD_ON + "CIERRE DE TURNO / ARQUEO DE CAJA\n" + ESCPOS_BOLD_OFF
        t += escposDashes(W) + "\n"
        t += ESCPOS_ALIGN_LEFT
        t += `Cajero/a:    ${escposStripAccents(user?.nombre || "Cajero")}\n`
        t += `Caja / Boca: ${puntoNombre} (${puntoEmision || "012"})\n`
        t += `Fecha/Hora:  ${new Date().toLocaleString("es-PY")}\n`
        t += `Turno ID:    ${currentSessionId.slice(0, 8).toUpperCase()}\n`
        t += escposDashes(W) + "\n"
        t += ESCPOS_BOLD_ON + "FONDOS DE APERTURA INICIAL:\n" + ESCPOS_BOLD_OFF
        t += escposTwoCol("  Guaranies (PYG):", `GS. ${formatPYG(fondoPyg)}`, W) + "\n"
        if (fondoBrl > 0 || contadoBrl > 0) {
          t += escposTwoCol("  Reales (BRL):", `R$ ${fondoBrl.toFixed(2)}`, W) + "\n"
        }
        if (fondoUsd > 0 || contadoUsd > 0) {
          t += escposTwoCol("  Dolares (USD):", `US$ ${fondoUsd.toFixed(2)}`, W) + "\n"
        }
        t += escposDashes(W) + "\n"

        if ((result.desglose_formas_pago || []).length > 0) {
          t += ESCPOS_BOLD_ON + "VENTAS DEL TURNO POR FORMA DE PAGO:\n" + ESCPOS_BOLD_OFF
          for (const p of result.desglose_formas_pago) {
            const label = "  " + (FORMA_PAGO_LABEL[p.forma_pago] || p.forma_pago) + (p.moneda && p.moneda !== "PYG" ? ` (${p.moneda})` : "") + ":"
            const mTxt = p.moneda === "PYG" ? `GS. ${formatPYG(p.monto)}` : `${p.moneda} ${Number(p.monto).toFixed(2)}`
            t += escposTwoCol(label, mTxt, W) + "\n"
          }
          t += escposDashes(W) + "\n"
        }

        t += ESCPOS_BOLD_ON + "CONCILIACION DE EFECTIVO EN GAVETA:\n" + ESCPOS_BOLD_OFF
        t += "[GUARANIES - PYG]\n"
        t += escposTwoCol("  Fondo Inicial:", `GS. ${formatPYG(fondoPyg)}`, W) + "\n"
        t += escposTwoCol("  Ventas en Efectivo:", `+GS. ${formatPYG(Number(result.monto_cierre_esperado || 0) - fondoPyg)}`, W) + "\n"
        t += escposTwoCol("  Total Esperado:", `GS. ${formatPYG(result.monto_cierre_esperado)}`, W) + "\n"
        t += ESCPOS_BOLD_ON + escposTwoCol("  Total Contado Fisico:", `GS. ${formatPYG(contado)}`, W) + ESCPOS_BOLD_OFF + "\n"
        t += ESCPOS_BOLD_ON + escposTwoCol("  DIFERENCIA PYG:", `${diferencia >= 0 ? "+" : ""}GS. ${formatPYG(diferencia)}`, W) + ESCPOS_BOLD_OFF + "\n"

        if (fondoBrl > 0 || contadoBrl > 0 || result.diferencia_brl) {
          t += "\n[REALES - BRL]\n"
          t += escposTwoCol("  Fondo Inicial:", `R$ ${fondoBrl.toFixed(2)}`, W) + "\n"
          t += escposTwoCol("  Total Esperado:", `R$ ${Number(resAny?.monto_cierre_esperado_brl || (fondoBrl + contadoBrl - difBrl)).toFixed(2)}`, W) + "\n"
          t += ESCPOS_BOLD_ON + escposTwoCol("  Total Contado Fisico:", `R$ ${contadoBrl.toFixed(2)}`, W) + ESCPOS_BOLD_OFF + "\n"
          t += ESCPOS_BOLD_ON + escposTwoCol("  DIFERENCIA BRL:", `${difBrl >= 0 ? "+" : ""}R$ ${Number(difBrl).toFixed(2)}`, W) + ESCPOS_BOLD_OFF + "\n"
        }

        if (fondoUsd > 0 || contadoUsd > 0 || result.diferencia_usd) {
          t += "\n[DOLARES - USD]\n"
          t += escposTwoCol("  Fondo Inicial:", `US$ ${fondoUsd.toFixed(2)}`, W) + "\n"
          t += escposTwoCol("  Total Esperado:", `US$ ${Number(resAny?.monto_cierre_esperado_usd || (fondoUsd + contadoUsd - difUsd)).toFixed(2)}`, W) + "\n"

          t += ESCPOS_BOLD_ON + escposTwoCol("  Total Contado Fisico:", `US$ ${contadoUsd.toFixed(2)}`, W) + ESCPOS_BOLD_OFF + "\n"
          t += ESCPOS_BOLD_ON + escposTwoCol("  DIFERENCIA USD:", `${difUsd >= 0 ? "+" : ""}US$ ${Number(difUsd).toFixed(2)}`, W) + ESCPOS_BOLD_OFF + "\n"
        }

        if (result.requiere_revision) {
          t += "\n" + ESCPOS_BOLD_ON + ESCPOS_ALIGN_CENTER
          t += "! DIFERENCIA FUERA DE TOLERANCIA !\n"
          t += "REQUIERE REVISION DE SUPERVISION\n" + ESCPOS_BOLD_OFF + ESCPOS_ALIGN_LEFT
        }

        t += escposDashes(W) + "\n\n"
        t += "Firma Cajero/a: _________________________\n\n"
        t += "Firma Supervisora: ______________________\n\n\n\n\n\n"
        t += GS + 'V' + '\x01'

        const b64 = btoa(unescape(encodeURIComponent(t)))
        setLastCierreEscPosB64(b64)
        const tpl = JSON.parse(localStorage.getItem("pos_receipt_template_config") || "{}")
        try {
          await (window as any).electronAPI.printEscPos(b64, tpl.nombre_impresora_windows || "ZKP8008")
        } catch (printErr) {
          console.error("Error al imprimir ESC/POS:", printErr)
        }
      } else {
        const body = buildTicketPrelude("CIERRE DE CAJA / ARQUEO") + `
          <div style="padding: 4px 0; font-size: 10px;">
            <div>Cajero/a: ${user?.nombre || "-"}</div>
            <div>Caja: ${puntoNombre}</div>
            <div>Fecha/Hora: ${new Date().toLocaleString("es-PY")}</div>
            <div>Turno ID: ${currentSessionId.slice(0, 8).toUpperCase()}</div>
          </div>
          <table style="width:100%; border-collapse:collapse; border-top:1px dashed #000; margin-top:4px; padding-top:4px; font-size:10px;">
            <tr><td>Fondo apertura (Gs):</td><td style="text-align:right;">${formatPYG(fondoPyg)}</td></tr>
            ${fondoBrl > 0 ? `<tr><td>Fondo apertura (R$):</td><td style="text-align:right;">R$ ${fondoBrl.toFixed(2)}</td></tr>` : ""}
            <tr><td>Efectivo esperado (Gs.):</td><td style="text-align:right;">${formatPYG(result.monto_cierre_esperado)}</td></tr>
            <tr><td>Efectivo contado (Gs.):</td><td style="text-align:right; font-weight:bold;">${formatPYG(contado)}</td></tr>
            <tr style="font-weight:900; border-top:1px dashed #000;"><td>Diferencia (Gs.):</td><td style="text-align:right;">${diferencia >= 0 ? "+" : ""}${formatPYG(diferencia)}</td></tr>
            ${(contadoUsd > 0 || result.diferencia_usd) ? `<tr><td>Diferencia US$:</td><td style="text-align:right;">${result.diferencia_usd >= 0 ? "+" : ""}${Number(result.diferencia_usd).toFixed(2)}</td></tr>` : ""}
            ${(contadoBrl > 0 || result.diferencia_brl) ? `<tr><td>Diferencia R$:</td><td style="text-align:right;">${result.diferencia_brl >= 0 ? "+" : ""}${Number(result.diferencia_brl).toFixed(2)}</td></tr>` : ""}
          </table>
          ${(result.desglose_formas_pago || []).length > 0 ? `
          <table style="width:100%; border-collapse:collapse; border-top:1px dashed #000; margin-top:4px; padding-top:4px; font-size:10px;">
            <tr><td colspan="2" style="font-weight:900; padding-bottom:2px;">Ventas del turno por forma de pago:</td></tr>
            ${result.desglose_formas_pago.map((p: any) => `<tr><td>${FORMA_PAGO_LABEL[p.forma_pago] || p.forma_pago}${p.moneda && p.moneda !== "PYG" ? ` (${p.moneda})` : ""}:</td><td style="text-align:right;">${p.moneda === "PYG" ? formatPYG(p.monto) : Number(p.monto).toFixed(2)}</td></tr>`).join("")}
          </table>` : ""}
          ${result.requiere_revision ? `<div style="text-align:center; font-weight:900; margin-top:6px; border:1px dashed #000; padding:4px;">⚠ DIFERENCIA FUERA DE TOLERANCIA -- REQUIERE REVISIÓN</div>` : ""}
          <div style="margin-top:14px; font-size:9px;">
            <div>Firma Cajero/a: ___________________________</div>
            <div style="margin-top:10px;">Firma Supervisora: _________________________</div>
          </div>
          <br/><br/>
        </div>`
        setLastCierreTicketHtml(body)
        await printTicketHtml(body)
      }


      localStorage.removeItem(userCajaKey)
      setCashSessionId(null)
      setCajaAbierta(false)
      setMontoCierreReal("")
      setMontoCierreUsd("")
      setMontoCierreBrl("")
      toast.info("Turno de Caja Cerrado", result.requiere_revision ? "Cierre registrado con diferencia fuera de tolerancia." : "Cierre registrado sin novedades.")
    } catch (err) {
      toast.error("No se pudo cerrar la caja", "Verifique la conexión con el servidor e intente de nuevo.")
    } finally {
      setSubmittingCierre(false)
    }
  }

  // ── Aviso de umbral de retiro y Monitoreo de confirmaciones en Bóveda ────────
  useEffect(() => {
    if (!cashSessionId || !cashRegisterId) { setCashDropStatus(null); return }
    let cancelled = false
    const check = async () => {
      try {
        // 1. Monitoreo de umbral de caja
        const sessions = await api.caja.sessionsSummary({ register_id: cashRegisterId, estado: "abierta" } as any)
        const mine = (sessions || []).find((s: any) => s.id === cashSessionId)
        if (cancelled || !mine) return
        const status = {
          efectivo_acumulado: mine.efectivo_acumulado,
          cash_drop_threshold: mine.cash_drop_threshold,
          cash_drop_alert: mine.cash_drop_alert,
          cash_drop_warning: mine.cash_drop_warning,
        }
        setCashDropStatus(status)
        const level: "none" | "warning" | "alert" = status.cash_drop_alert ? "alert" : status.cash_drop_warning ? "warning" : "none"
        if (level !== "none" && level !== cashDropStatusNotifiedRef.current) {
          if (level === "alert") {
            toast.error("Umbral de retiro superado", `Efectivo acumulado: ${formatPYG(status.efectivo_acumulado)}. Haga un retiro antes de seguir cobrando.`)
          } else {
            toast.warning("Se acerca al umbral de retiro", `Efectivo acumulado: ${formatPYG(status.efectivo_acumulado)}.`)
          }
        }
        cashDropStatusNotifiedRef.current = level

        // 2. Monitoreo reactivo de confirmación de Cash Drop (Imprime Ticket 2)
        if (pendingDropIdsRef.current.size > 0) {
          const drops = await api.caja.cashDropRequests.list("confirmado")
          if (Array.isArray(drops)) {
            for (const d of drops) {
              if (pendingDropIdsRef.current.has(d.id) && !confirmedDropIdsRef.current.has(d.id)) {
                confirmedDropIdsRef.current.add(d.id)
                pendingDropIdsRef.current.delete(d.id)
                triggerSuccessSound()
                const puntoNombre = PUNTOS_EMISION.find(p => p.id === puntoEmision)?.nombre || puntoEmision || "Caja"
                const bodyConfirm = buildTicketPrelude("CONFIRMACIÓN DE SANGRÍA - BÓVEDA") + `
                  <div style="padding: 4px 0; font-size: 10px;">
                    <div style="font-weight:900; text-align:center; font-size:11px; border-bottom:1px dashed #000; padding-bottom:3px;">
                      RETIRO INGRESADO A BÓVEDA
                    </div>
                    <div style="margin-top:4px;">Caja: ${puntoNombre}</div>
                    <div>Cajero/a: ${d.solicitado_por_nombre || user?.nombre || "-"}</div>
                    <div>Supervisora: ${d.confirmado_por_nombre || "Supervisor/a"}</div>
                    <div>Fecha Confirmación: ${d.fecha_confirmacion ? new Date(d.fecha_confirmacion).toLocaleString("es-PY") : new Date().toLocaleString("es-PY")}</div>
                    <div>Nro. Solicitud: CD-${String(d.id).slice(0, 8).toUpperCase()}</div>
                  </div>
                  <table style="width:100%; border-collapse:collapse; border-top:1px dashed #000; margin-top:4px; font-size:10px;">
                    <tr><td>Monto Declarado:</td><td style="text-align:right; font-weight:bold;">${formatPYG(d.monto_pyg)}</td></tr>
                    <tr><td>Recibido en Bóveda:</td><td style="text-align:right; font-weight:900;">${formatPYG(d.monto_confirmado_pyg || d.monto_pyg)}</td></tr>
                    ${d.monto_usd ? `<tr><td>USD:</td><td style="text-align:right;">US$ ${(d.monto_confirmado_usd || d.monto_usd).toFixed(2)}</td></tr>` : ""}
                    ${d.monto_brl ? `<tr><td>BRL:</td><td style="text-align:right;">R$ ${(d.monto_confirmado_brl || d.monto_brl).toFixed(2)}</td></tr>` : ""}
                  </table>
                  ${d.discrepancia_confirmacion ? `<div style="font-weight:900; text-align:center; border:1px dashed #000; margin-top:4px; padding:2px;">⚠ DISCREPANCIA EN RECUENTO DE BÓVEDA</div>` : `<div style="text-align:center; font-weight:bold; margin-top:4px;">✓ RECUENTO COINCIDENTE (EXACTO)</div>`}
                  <div style="text-align:center; font-size:9px; margin-top:6px; border-top:1px dashed #000; padding-top:4px;">
                    ✅ Efectivo transferido a Bóveda. Cajera liberada de custodia.
                  </div>
                  <br/><br/>
                </div>`
                await printTicketHtml(bodyConfirm)
                toast.success("Sangría Confirmada en Bóveda", `Recibido por ${d.confirmado_por_nombre || 'Supervisora'}`)
              }
            }
          }
        }

        // 3. Monitoreo reactivo de confirmación de Handoff (Entrega de Cierre)
        if (pendingHandoffIdRef.current) {
          const handoffs = await api.caja.handoffs.list({ estado: "confirmado" })
          if (Array.isArray(handoffs)) {
            const match = handoffs.find((h: any) => h.id === pendingHandoffIdRef.current)
            if (match) {
              pendingHandoffIdRef.current = null
              triggerSuccessSound()
              const puntoNombre = PUNTOS_EMISION.find(p => p.id === puntoEmision)?.nombre || puntoEmision || "Caja"
              const bodyHandoff = buildTicketPrelude("RECEPCIÓN DE CIERRE EN BÓVEDA") + `
                <div style="padding: 4px 0; font-size: 10px;">
                  <div style="font-weight:900; text-align:center; font-size:11px; border-bottom:1px dashed #000; padding-bottom:3px;">
                    ENTREGA DE TURNO RECIBIDA
                  </div>
                  <div style="margin-top:4px;">Caja: ${puntoNombre}</div>
                  <div>Cajero/a: ${match.entregado_por_nombre || user?.nombre || "-"}</div>
                  <div>Supervisora: ${match.recibido_por_nombre || "Supervisor/a"}</div>
                  <div>Fecha Recepción: ${match.fecha_confirmacion ? new Date(match.fecha_confirmacion).toLocaleString("es-PY") : new Date().toLocaleString("es-PY")}</div>
                </div>
                <table style="width:100%; border-collapse:collapse; border-top:1px dashed #000; margin-top:4px; font-size:10px;">
                  <tr><td>Monto Declarado:</td><td style="text-align:right; font-weight:bold;">${formatPYG(match.monto_pyg)}</td></tr>
                  <tr><td>Recibido en Bóveda:</td><td style="text-align:right; font-weight:900;">${formatPYG(match.monto_confirmado_pyg || match.monto_pyg)}</td></tr>
                  ${match.monto_usd ? `<tr><td>USD:</td><td style="text-align:right;">US$ ${(match.monto_confirmado_usd || match.monto_usd).toFixed(2)}</td></tr>` : ""}
                  ${match.monto_brl ? `<tr><td>BRL:</td><td style="text-align:right;">R$ ${(match.monto_confirmado_brl || match.monto_brl).toFixed(2)}</td></tr>` : ""}
                </table>
                ${match.discrepancia_confirmacion ? `<div style="font-weight:900; text-align:center; border:1px dashed #000; margin-top:4px; padding:2px;">⚠ DISCREPANCIA REGISTRADA EN BÓVEDA</div>` : `<div style="text-align:center; font-weight:bold; margin-top:4px;">✓ RECUENTO DE ENTREGA CONFORME</div>`}
                <div style="text-align:center; font-size:9px; margin-top:6px; border-top:1px dashed #000; padding-top:4px;">
                  ✅ Cierre recibido formalmente en Bóveda Central.
                </div>
                <br/><br/>
              </div>`
              await printTicketHtml(bodyHandoff)
              toast.success("Cierre Recibido en Bóveda", `Confirmado por ${match.recibido_por_nombre || 'Supervisora'}`)
            }
          }
        }
      } catch { /* silencioso */ }
    }
    check()
    const interval = setInterval(check, 10000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [cashSessionId, cashRegisterId, puntoEmision, user])

  const handleConfirmCashDrop = async () => {
    if (!cashSessionId) {
      toast.warning("No hay sesión de caja activa", "")
      return
    }
    const monto = parseInt(cashDropMonto.replace(/\D/g, "") || "0", 10)
    const montoUsd = parseFloat(cashDropMontoUsd.replace(/,/g, ".")) || 0
    const montoBrl = parseFloat(cashDropMontoBrl.replace(/,/g, ".")) || 0
    if (monto <= 0 && montoUsd <= 0 && montoBrl <= 0) {
      toast.warning("Monto inválido", "Ingrese al menos un monto mayor a 0 en alguna moneda.")
      return
    }
    setSubmittingCashDrop(true)
    try {
      const dropRes = await api.caja.cashDrop(cashSessionId, { monto, monto_usd: montoUsd, monto_brl: montoBrl, observaciones: cashDropObs.trim() || undefined })
      if (dropRes?.id) {
        pendingDropIdsRef.current.add(String(dropRes.id))
      }
      const montosTexto = [
        monto > 0 ? formatPYG(monto) : null,
        montoUsd > 0 ? `US$ ${montoUsd.toFixed(2)}` : null,
        montoBrl > 0 ? `R$ ${montoBrl.toFixed(2)}` : null,
      ].filter(Boolean).join(" + ")
      const puntoNombre = PUNTOS_EMISION.find(p => p.id === puntoEmision)?.nombre || puntoEmision || "Caja"
      const dropIdStr = dropRes?.id ? String(dropRes.id).slice(0, 8).toUpperCase() : "-"
      const body = buildTicketPrelude("SOLICITUD DE RETIRO (CASH DROP)") + `
        <div style="padding: 4px 0; font-size: 10px;">
          <div>Cajero/a: ${user?.nombre || "-"}</div>
          <div>Caja: ${puntoNombre}</div>
          <div>Fecha/Hora: ${new Date().toLocaleString("es-PY")}</div>
          <div>Nro. Solicitud: CD-${dropIdStr}</div>
          <div style="font-weight:900; font-size:12px; margin-top:6px; border-top:1px dashed #000; border-bottom:1px dashed #000; padding:3px 0;">
            Monto Retirado: ${montosTexto}
          </div>
          <div style="margin-top:4px; font-weight:bold;">[ESTADO: PENDIENTE DE RECUENTO EN BÓVEDA]</div>
          ${cashDropObs.trim() ? `<div style="margin-top:2px;">Obs: ${cashDropObs.trim()}</div>` : ""}
        </div>
        <div style="margin-top:12px; font-size:9px;">
          <div>Firma Cajero/a: ___________________________</div>
          <div style="margin-top:10px;">Firma Supervisora: _________________________</div>
        </div>
        <div style="text-align:center; font-size:8.5px; margin-top:8px; color:#555;">
          Comprobante de custodia temporal hasta confirmación en Bóveda.
        </div>
        <br/><br/>
      </div>`
      await printTicketHtml(body)
      toast.success("Retiro registrado", `${montosTexto} -- pendiente de confirmación por supervisora.`)
      setShowCashDropModal(false)
      setCashDropMonto("")
      setCashDropMontoUsd("")
      setCashDropMontoBrl("")
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
  const [reimprimirTab, setReimprimirTab] = useState<"ventas" | "devoluciones" | "cierres">("ventas")
  const [reimprimirSearch, setReimprimirSearch] = useState("")
  const [reimprimirSales, setReimprimirSales] = useState<Sale[]>([])
  const [reimprimirReturns, setReimprimirReturns] = useState<any[]>([])
  const [reimprimirSessions, setReimprimirSessions] = useState<any[]>([])
  const [reimprimirLoading, setReimprimirLoading] = useState(false)
  const [reimprimirError, setReimprimirError] = useState("")

  const filteredReimprimirSales = useMemo(() => {
    const q = reimprimirSearch.trim().toLowerCase()
    if (!q) return reimprimirSales
    const qNum = q.replace(/\D/g, "")
    return reimprimirSales.filter(s => {
      const num = (s.numero || "").toLowerCase()
      const numInt = (s.numero_interno || "").toLowerCase()
      const cNom = (s.customer_nombre || s.customer?.nombre || s.customer?.razon_social || "").toLowerCase()
      const cDoc = (s.customer_doc || s.customer?.ruc || s.customer?.ci || s.customer?.telefono || "").toLowerCase()
      const cDocClean = cDoc.replace(/\D/g, "")
      const cEc = (s.customer_extra_club || s.customer?.extra_club_numero || "").toLowerCase()
      const totalStr = String(s.total || 0)
      const totalFormatted = (s.total || 0).toLocaleString("es-PY").toLowerCase()
      const fp = (s.forma_pago || (s.condicion === "credito" ? "EXTRA_CLUB" : "EFECTIVO")).toLowerCase()

      return (
        num.includes(q) ||
        numInt.includes(q) ||
        cNom.includes(q) ||
        cDoc.includes(q) ||
        (qNum && cDocClean.includes(qNum)) ||
        cEc.includes(q) ||
        fp.includes(q) ||
        totalStr.includes(q) ||
        totalFormatted.includes(q) ||
        (qNum && totalStr.includes(qNum))
      )
    })
  }, [reimprimirSales, reimprimirSearch])

  // Reabrir factura -- agregar identificacion de cliente a una venta que
  // salio como Consumidor Final. Pedido real: el cliente se va, la caja
  // sigue, y despues vuelve pidiendo que la factura lleve su nombre.
  // Siempre pasa por autorizacion de supervisor antes de tocar la venta.
  const [reabrirFacturaSaleId, setReabrirFacturaSaleId] = useState<string | null>(null)
  const [reabrirFacturaSearch, setReabrirFacturaSearch] = useState("")
  const [reabrirFacturaResults, setReabrirFacturaResults] = useState<Customer[]>([])
  const [reabrirFacturaSearching, setReabrirFacturaSearching] = useState(false)
  const [submittingReabrirFactura, setSubmittingReabrirFactura] = useState(false)

  // Cambio de forma de pago en venta ya cerrada (solo turno activo)
  const [reabrirPagoSaleId, setReabrirPagoSaleId] = useState<string | null>(null)
  const [reabrirPagoFormaPago, setReabrirPagoFormaPago] = useState("")
  const [reabrirPagoMotivo, setReabrirPagoMotivo] = useState("")
  const [reabrirPagoCustomer, setReabrirPagoCustomer] = useState<Customer | null>(null)
  const [reabrirPagoCustomerSearch, setReabrirPagoCustomerSearch] = useState("")
  const [reabrirPagoCustomerResults, setReabrirPagoCustomerResults] = useState<Customer[]>([])
  const [reabrirPagoCustomerSearching, setReabrirPagoCustomerSearching] = useState(false)
  const [submittingReabrirPago, setSubmittingReabrirPago] = useState(false)

  // ── CUPONES DE SORTEO EN CAJA (ELECTRON / POS MULTI-CAMPAÑA) ────────────────
  const [showCuponModal, setShowCuponModal] = useState(false)
  const [cuponModalStep, setCuponModalStep] = useState<"pregunta" | "formulario">("pregunta")
  const [lookingUpDoc, setLookingUpDoc] = useState(false)
  const [pendingCuponData, setPendingCuponData] = useState<{
    saleNumero: string
    montoCompra: number
    totalCupones: number
    campanasCalificadas: Array<{
      campana_id: string
      nombre: string
      patrocinador: string
      premio_destacado?: string
      tipo_trigger: string
      cupones_ganados: number
      ticket_encabezado?: string
      ticket_subtitulo?: string
      ticket_pie_urna?: string
      whatsapp_template?: string
      whatsapp_activo?: boolean
    }>
    doc: string
    nombre: string
    telCodigo: "595" | "55"
    telefono: string
    barrio: string
    ciudad: string
    items: any[]
    origenDoc?: string
    printInvoiceCallback?: () => Promise<void>
  } | null>(null)
  const [savingCupon, setSavingCupon] = useState(false)

  const lastLookedUpDocRef = useRef<string>("")
  const lookupDocTimerRef = useRef<any>(null)

  const handleLookupDoc = (docStr: string, immediate = false) => {
    const clean = docStr.trim().replace(/\D/g, "")
    if (clean.length < 5) return
    if (lastLookedUpDocRef.current === clean && !immediate) return

    if (lookupDocTimerRef.current) clearTimeout(lookupDocTimerRef.current)

    const doLookup = async () => {
      if (lastLookedUpDocRef.current === clean) return
      try {
        setLookingUpDoc(true)
        const res = await api.cupones.buscarDocumento(clean)
        lastLookedUpDocRef.current = clean
        if (res && res.encontrado && res.nombre) {
          setPendingCuponData(prev => {
            if (!prev) return null
            let telCod = prev.telCodigo
            let telNum = prev.telefono
            if (res.telefono) {
              const t = res.telefono.trim()
              if (t.startsWith("55")) {
                telCod = "55"
                telNum = t.slice(2)
              } else if (t.startsWith("595")) {
                telCod = "595"
                telNum = t.slice(3)
              } else {
                telNum = t
              }
            }
            return {
              ...prev,
              doc: clean,
              nombre: res.nombre || prev.nombre,
              telCodigo: telCod,
              telefono: telNum,
              barrio: res.barrio || prev.barrio,
              ciudad: res.ciudad || prev.ciudad,
              origenDoc: res.origen
            }
          })
          toast.info(
            "Cliente Localizado",
            `${res.nombre} (${res.origen === "padron_tsje" ? "Padrón Nacional TSJE" : "Base de Clientes"})`
          )
        }
      } catch {
        // Silencioso
      } finally {
        setLookingUpDoc(false)
      }
    }

    if (immediate) {
      doLookup()
    } else {
      lookupDocTimerRef.current = setTimeout(doLookup, 400)
    }
  }

  const printCuponesMultiCampanaEscPos = async (
    cuponData: {
      saleNumero: string
      montoCompra: number
      campanasCalificadas: Array<{
        campana_id: string
        nombre: string
        patrocinador: string
        premio_destacado?: string
        cupones_ganados: number
        ticket_encabezado?: string
        ticket_subtitulo?: string
        ticket_pie_urna?: string
      }>
      nombre: string
      documento: string
      telefono: string
      barrio: string
      ciudad: string
    }
  ) => {
    if (!(window as any).electronAPI?.printEscPos) return
    const tpl = JSON.parse(localStorage.getItem("pos_receipt_template_config") || "{}")
    const printerName = tpl.nombre_impresora_windows || 'ZKP8008'
    const W = ESCPOS_LINE_WIDTH // 48 columnas térmicas

    for (const camp of cuponData.campanasCalificadas) {
      for (let i = 1; i <= camp.cupones_ganados; i++) {
        let t = ''
        t += ESCPOS_INIT
        t += ESCPOS_ALIGN_CENTER

        // 1. Encabezado configurable
        const encabezado = camp.ticket_encabezado?.trim() || tpl.nombre_fantasia || "EXTRA SUPERMERCADO MAYORISTA"
        t += ESCPOS_BOLD_ON + escposStripAccents(encabezado) + ESCPOS_BOLD_OFF + '\n'
        t += "Pedro Juan Caballero · Paraguay\n"
        t += escposDashes(W) + '\n'

        // 2. Subtítulo del Sorteo y Premio
        const subtitulo = camp.ticket_subtitulo?.trim() || `*** ${escposStripAccents(camp.nombre).trim().toUpperCase()} ***`
        t += ESCPOS_BOLD_ON + escposWrapText(subtitulo, W, 'center') + ESCPOS_BOLD_OFF

        if (camp.premio_destacado) {
          t += escposWrapText(`Premio: ${camp.premio_destacado}`, W, 'center')
        }
        if (camp.patrocinador && camp.patrocinador !== "Extra Supermercado") {
          t += escposWrapText(`Patrocinador: ${camp.patrocinador}`, W, 'center')
        }

        // 3. Número de cupón (tamaño normal en negrita, idéntico al diseñador)
        t += escposDashes(W) + '\n'
        t += ESCPOS_BOLD_ON + `CUPON ${i} DE ${camp.cupones_ganados}` + ESCPOS_BOLD_OFF + '\n'
        t += escposDashes(W) + '\n'

        // 4. Datos del Ticket
        t += escposTwoCol(`Ticket: #${cuponData.saleNumero}`, `Gs. ${formatPYG(cuponData.montoCompra)}`, W) + '\n'
        t += escposTwoCol(`Fecha: ${new Date().toLocaleDateString("es-PY")} ${new Date().toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" })}`, `Boca: ${puntoEmision || "012"}`, W) + '\n'
        t += escposDashes(W) + '\n'

        // 5. Datos del Participante
        t += ESCPOS_ALIGN_LEFT
        t += `CLIENTE:  ${escposStripAccents(cuponData.nombre).toUpperCase().substring(0, 36)}\n`
        t += `DOC / CI: ${cuponData.documento.padEnd(12)} TEL: ${cuponData.telefono}\n`
        t += `BARRIO:   ${escposStripAccents(cuponData.barrio || "Centro").substring(0, 36)}\n`
        t += `CIUDAD:   ${escposStripAccents(cuponData.ciudad || "Pedro Juan Caballero").substring(0, 36)}\n`
        t += escposDashes(W) + '\n'

        // 6. Pie de Urna y Validez
        t += ESCPOS_ALIGN_CENTER
        t += ESCPOS_BOLD_ON + escposWrapText(camp.ticket_pie_urna || "¡Deposita este cupon en la urna de la sucursal!", W, 'center') + ESCPOS_BOLD_OFF
        t += "Valido para los sorteos de la campana\n"
        t += '\n'.repeat(Math.max(4, tpl.lineas_salto_corte || 4))
        t += GS + 'V' + '\x01' // Corte parcial

        const escposB64 = escposToBase64(t)
        try {
          await (window as any).electronAPI.printEscPos(escposB64, printerName)
        } catch (e) {
          console.error(`Error imprimiendo cupón de ${camp.nombre}:`, e)
        }
      }
    }
  }

  const handleConfirmCupon = async () => {
    if (!pendingCuponData) return
    if (!pendingCuponData.nombre.trim() || !pendingCuponData.doc.trim() || !pendingCuponData.telefono.trim()) {
      toast.warning("Campos obligatorios", "Nombre, documento y teléfono son requeridos para el sorteo.")
      return
    }

    setSavingCupon(true)
    const fullTel = `${pendingCuponData.telCodigo}${pendingCuponData.telefono.trim()}`
    try {
      await api.cupones.registrarMultiple({
        documento: pendingCuponData.doc.trim(),
        nombre: pendingCuponData.nombre.trim(),
        telefono: fullTel,
        barrio: pendingCuponData.barrio.trim() || "Centro",
        ciudad: pendingCuponData.ciudad.trim() || "Pedro Juan Caballero",
        nro_ticket: pendingCuponData.saleNumero,
        monto_compra: pendingCuponData.montoCompra,
        usuario_nombre: user?.nombre || "Cajero POS",
        cupones_por_campana: pendingCuponData.campanasCalificadas.map(c => ({
          campana_id: c.campana_id,
          campana_nombre: c.nombre,
          cantidad: c.cupones_ganados
        })),
        items: pendingCuponData.items,
        enviar_whatsapp: true
      })

      // Imprimir factura primero
      if (pendingCuponData.printInvoiceCallback) {
        await pendingCuponData.printInvoiceCallback()
      }

      // Luego imprimir cupones
      await printCuponesMultiCampanaEscPos({
        saleNumero: pendingCuponData.saleNumero,
        montoCompra: pendingCuponData.montoCompra,
        campanasCalificadas: pendingCuponData.campanasCalificadas,
        nombre: pendingCuponData.nombre.trim(),
        documento: pendingCuponData.doc.trim(),
        telefono: fullTel,
        barrio: pendingCuponData.barrio.trim() || "Centro",
        ciudad: pendingCuponData.ciudad.trim() || "Pedro Juan Caballero",
      })

      toast.success("Cupones Emitidos", `Se emitieron ${pendingCuponData.totalCupones} cupón(es) para ${pendingCuponData.campanasCalificadas.length} sorteo(s).`)
      setShowCuponModal(false)
      setPendingCuponData(null)
    } catch (err: any) {
      toast.error("Error al emitir cupones", err?.message || "No se pudo guardar el cupón.")
    } finally {
      setSavingCupon(false)
    }
  }

  const handleSkipCupon = async () => {
    if (pendingCuponData?.printInvoiceCallback) {
      await pendingCuponData.printInvoiceCallback()
    }
    setShowCuponModal(false)
    setPendingCuponData(null)
  }


  useEffect(() => {
    if (!reabrirFacturaSaleId) return
    const query = reabrirFacturaSearch.trim()
    if (!query) { setReabrirFacturaResults([]); return }
    const timer = setTimeout(async () => {
      setReabrirFacturaSearching(true)
      try {
        const res = await api.customers.list({ search: query, limit: 8 })
        setReabrirFacturaResults((res || []).map(normalizeCustomer))
      } catch (e) {
      } finally {
        setReabrirFacturaSearching(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [reabrirFacturaSearch, reabrirFacturaSaleId])

  // Búsqueda debounce de socios para cambio de forma de pago a Extra Club / Crédito
  useEffect(() => {
    if (!reabrirPagoSaleId || !reabrirPagoCustomerSearch.trim() || reabrirPagoCustomerSearch.trim().length < 2) {
      setReabrirPagoCustomerResults([])
      return
    }
    setReabrirPagoCustomerSearching(true)
    const timer = setTimeout(async () => {
      try {
        const res = await api.customers.list({ search: reabrirPagoCustomerSearch.trim(), limit: 10 } as any)
        setReabrirPagoCustomerResults((res || []).map(normalizeCustomer))
      } catch (e) {
        setReabrirPagoCustomerResults([])
      } finally {
        setReabrirPagoCustomerSearching(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [reabrirPagoCustomerSearch, reabrirPagoSaleId])

  const submitReabrirFactura = async (sale: Sale, selected: Customer, resolverId: string, resolverNombre: string) => {
    setSubmittingReabrirFactura(true)
    try {
      const updated = await api.sales.reopenCustomer(sale.id, {
        customer_id: String(selected.id),
        autorizado_por_id: resolverId,
        autorizado_por_nombre: resolverNombre,
      })
      setReimprimirSales(prev => prev.map(s => s.id === sale.id ? { ...s, customer_id: updated.customer_id } as any : s))
      setReabrirFacturaSaleId(null)
      setReabrirFacturaSearch("")
      setReabrirFacturaResults([])
      toast.success("Factura reabierta", `${selected.nombre} vinculado a la venta Nº ${sale.numero}. Se puede reimprimir con su identificación.`)
    } catch (e: any) {
      toast.error("No se pudo reabrir la factura", e?.message || "Intente nuevamente.")
    } finally {
      setSubmittingReabrirFactura(false)
    }
  }

  const submitReabrirPago = async (
    sale: Sale,
    formaPago: string,
    motivo: string,
    resolverId: string,
    resolverNombre: string,
    selectedCustomer?: Customer | null,
  ) => {
    setSubmittingReabrirPago(true)
    try {
      const updated = await api.sales.reopenPayment(sale.id, {
        forma_pago: formaPago,
        motivo,
        autorizado_por_id: resolverId,
        autorizado_por_nombre: resolverNombre,
        customer_id: selectedCustomer?.id ? String(selectedCustomer.id) : undefined,
      })
      // Actualizar el objeto en memoria con la nueva forma de pago y cliente para que
      // la reimpresión inmediata use los datos correctos.
      const saleActualizada = {
        ...sale,
        forma_pago: updated.forma_pago ?? formaPago,
        customer_id: updated.customer_id ?? (selectedCustomer?.id ? String(selectedCustomer.id) : sale.customer_id),
        customer: selectedCustomer || sale.customer,
        observaciones: updated.observaciones,
      } as Sale
      setReimprimirSales(prev => prev.map(s => s.id === sale.id ? saleActualizada : s))
      setReabrirPagoSaleId(null)
      setReabrirPagoFormaPago("")
      setReabrirPagoMotivo("")
      setReabrirPagoCustomer(null)
      setReabrirPagoCustomerSearch("")
      setReabrirPagoCustomerResults([])
      toast.success(
        "Forma de pago actualizada",
        `Venta Nº ${sale.numero}: ${sale.forma_pago} → ${formaPago}${selectedCustomer ? ` (${selectedCustomer.nombre})` : ""}. Reimprimiendo con el dato correcto...`
      )
      // Reimprimir automáticamente con la venta ya actualizada
      await handleReimprimirSale(saleActualizada)
    } catch (e: any) {
      toast.error("No se pudo cambiar la forma de pago", e?.message || "Intente nuevamente.")
    } finally {
      setSubmittingReabrirPago(false)
    }
  }

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

  const fetchReimprimirSessions = async () => {
    setReimprimirLoading(true)
    setReimprimirError("")
    try {
      const sessions = await api.caja.sessionsSummary({ estado: "cerrada", limit: 20 })
      setReimprimirSessions(Array.isArray(sessions) ? sessions : [])
    } catch (e) {
      setReimprimirError("No se pudo cargar el historial de cierres de caja.")
    } finally {
      setReimprimirLoading(false)
    }
  }

  const handleDownloadCierrePdf = async (sessionId: string) => {
    try {
      const token = localStorage.getItem("access_token") || localStorage.getItem("auth_token") || ""
      const res = await fetch(`/api/v1/cash-sessions/${sessionId}/export/cierre.pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) {
        throw new Error("No se pudo generar el PDF del cierre.")
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `cierre_caja_${sessionId.slice(0, 8)}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      toast.success("PDF Descargado", `Cierre oficial ${sessionId.slice(0, 8)} descargado correctamente.`)
    } catch (e: any) {
      toast.error("Error al descargar PDF", e?.message || "Verifique la conexión.")
    }
  }

  const handleReimprimirCierreEscPos = async (sessionSummary: any) => {
    try {
      const summary = await api.caja.sessions.preCloseSummary(sessionSummary.id)
      const tpl = JSON.parse(localStorage.getItem("pos_receipt_template_config") || "{}")
      const comp = JSON.parse(localStorage.getItem("pos_company_data") || "{}")
      const W = 42

      let t = ESCPOS_INIT
      t += ESCPOS_ALIGN_CENTER
      t += ESCPOS_BOLD_ON + (comp?.nombre_fantasia || comp?.razon_social || "EXTRA SUPERMERCADO MAYORISTA") + "\n" + ESCPOS_BOLD_OFF
      if (comp?.ruc) t += `RUC: ${comp.ruc}\n`
      t += "REIMPRESION DE ARQUEO / CIERRE\n"
      t += escposDashes(W) + "\n"
      t += ESCPOS_ALIGN_LEFT
      t += `Cajero/a: ${sessionSummary.cajero_nombre || "-"}\n`
      t += `Caja: ${sessionSummary.register_nombre || "Caja"}\n`
      t += `Turno ID: ${sessionSummary.id.slice(0, 8).toUpperCase()}\n`
      t += `Fecha Apertura: ${sessionSummary.fecha_apertura ? new Date(sessionSummary.fecha_apertura).toLocaleString("es-PY") : "-"}\n`
      t += `Fecha Cierre:   ${sessionSummary.fecha_cierre ? new Date(sessionSummary.fecha_cierre).toLocaleString("es-PY") : "-"}\n`
      t += escposDashes(W) + "\n"

      t += ESCPOS_BOLD_ON + "[RESUMEN POR FORMA DE PAGO]\n" + ESCPOS_BOLD_OFF
      if (summary?.desglose_formas_pago && summary.desglose_formas_pago.length > 0) {
        for (const dp of summary.desglose_formas_pago) {
          const lbl = (FORMA_PAGO_LABEL[dp.forma_pago] || dp.forma_pago) + (dp.moneda && dp.moneda !== "PYG" ? ` (${dp.moneda})` : "")
          const val = dp.moneda === "PYG" ? `${formatPYG(dp.monto)}` : `${dp.moneda} ${Number(dp.monto).toFixed(2)}`
          t += escposTwoCol(`  ${lbl} (${dp.cantidad || 0}):`, val, W) + "\n"
        }
      }

      t += escposDashes(W) + "\n"
      t += ESCPOS_BOLD_ON + "[CONCILIACION EN GUARANIES]\n" + ESCPOS_BOLD_OFF
      t += escposTwoCol("  Fondo Apertura Gs:", formatPYG(sessionSummary.monto_apertura || 0), W) + "\n"
      t += escposTwoCol("  Ventas Efectivo Gs:", formatPYG(summary?.efectivo_pyg_esperado || 0), W) + "\n"
      t += escposTwoCol("  Total Esperado Gs:", formatPYG(sessionSummary.monto_cierre_esperado || (sessionSummary.monto_apertura + (summary?.efectivo_pyg_esperado || 0))), W) + "\n"
      t += ESCPOS_BOLD_ON + escposTwoCol("  Total Contado en Gaveta:", formatPYG(sessionSummary.monto_cierre || 0), W) + ESCPOS_BOLD_OFF + "\n"
      const difPyg = sessionSummary.diferencia || 0
      t += ESCPOS_BOLD_ON + escposTwoCol("  DIFERENCIA GS:", `${difPyg >= 0 ? "+" : ""}${formatPYG(difPyg)}`, W) + ESCPOS_BOLD_OFF + "\n"

      if (sessionSummary.monto_apertura_brl > 0 || sessionSummary.diferencia_brl !== null) {
        t += "\n" + ESCPOS_BOLD_ON + "[CONCILIACION EN REALES (R$)]\n" + ESCPOS_BOLD_OFF
        t += escposTwoCol("  Fondo Inicial R$:", `R$ ${Number(sessionSummary.monto_apertura_brl || 0).toFixed(2)}`, W) + "\n"
        t += escposTwoCol("  Ventas Efectivo R$:", `R$ ${Number(summary?.efectivo_brl_esperado || 0).toFixed(2)}`, W) + "\n"
        const difBrl = sessionSummary.diferencia_brl || 0
        t += ESCPOS_BOLD_ON + escposTwoCol("  DIFERENCIA R$:", `${difBrl >= 0 ? "+" : ""}R$ ${Number(difBrl).toFixed(2)}`, W) + ESCPOS_BOLD_OFF + "\n"
      }

      t += escposDashes(W) + "\n\n"
      t += "Firma Cajero/a: _________________________\n\n"
      t += "Firma Supervisora: ______________________\n\n\n\n\n\n"
      t += GS + 'V' + '\x01'

      const b64 = btoa(unescape(encodeURIComponent(t)))
      if ((window as any).electronAPI?.printEscPos) {
        const res = await (window as any).electronAPI.printEscPos(b64, tpl.nombre_impresora_windows || "ZKP8008")
        if (!res?.success) {
          toast.warning("No se pudo imprimir", res?.error || "Revise la impresora.")
          return
        }
      }
      toast.success("Cierre Reimpreso", `Arqueo del turno ${sessionSummary.id.slice(0, 8)} enviado a la impresora ZKP8008.`)
    } catch (e: any) {
      toast.warning("Error al reimprimir", e?.message || "Verifique la conexión.")
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
          cliente_nombre: lostDemandCustomer?.nombre || lostDemandCliente.trim() || undefined,
          cliente_contacto: lostDemandCustomer?.telefono || lostDemandTelefono.trim() || undefined,
          customer_id: lostDemandCustomer && !String(lostDemandCustomer.id).startsWith("lookup-") ? String(lostDemandCustomer.id) : undefined,
          urgencia: lostDemandUrgencia,
          cajero_nombre: user?.nombre,
          caja_id: puntoEmision,
        })
      ))
      toast.success("Registrado", `Se avisó a Compras sobre ${filas.length} producto${filas.length > 1 ? "s" : ""} faltante${filas.length > 1 ? "s" : ""}.`)
      setShowLostDemandModal(false)
      setLostDemandCliente("")
      setLostDemandTelefono("")
      setLostDemandRows([{ producto: "", motivo: "sin_stock" }])
      setLostDemandCustomer(null)
      setLostDemandSearchResults([])
      setShowLostDemandRegisterForm(false)
      setNewLostDemandNombre("")
      setNewLostDemandPhoneNumber("")
      setLostDemandUrgencia("normal")
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
      return products.filter((p: any) => isPesableProduct(p)).slice(0, 35)
    }


    // A partir de aca, filtro por la categoria REAL del producto
    // (categoria.nombre, la que ya carga y mantiene el catalogo), no por
    // palabras sueltas adivinadas del nombre -- eso traia cualquier cosa
    // (en Carnicería aparecía cualquier producto salvo carne, en Panadería
    const catMatch = (p: Product, keywords: string[]) => {
      const cat = escposStripAccents((p as any).categoria?.nombre || (p as any).categoria_nombre || (typeof (p as any).categoria === "string" ? (p as any).categoria : "")).toUpperCase()
      const name = escposStripAccents(p.nombre || "").toUpperCase()
      return cat.length > 0
        ? keywords.some((k) => cat.includes(k))
        : keywords.some((k) => name.includes(k))
    }

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
      return rankSlice(products.filter((p) => catMatch(p, ["CARNE", "CARNICERIA", "POLLO", "PESCADO", "TILAPIA", "CAMARON", "CONGELADO", "EMBUTIDO", "NUGGET", "BOVINO", "AVICOLA", "COSTILLA", "BIFE", "MOLIDA", "ASADO", "VACIO", "CHORIZO", "CERDO"])), CATEGORY_TILE_LIMIT)
    }

    if (selectedCategoryTab === "PANADERIA") {
      return rankSlice(products.filter((p) => catMatch(p, ["PAN", "PANIFIC", "PANADER", "REPOSTER", "HORNEAD", "MASA", "TOSTADA", "GALLETITA", "PASTELERIA", "CHIPA", "FACTURA", "BIZCOCHO"])), CATEGORY_TILE_LIMIT)
    }

    if (selectedCategoryTab === "VERDULERIA") {
      return rankSlice(products.filter((p) => catMatch(p, ["VERDU", "FRUTA", "LEGUMBRE", "FLV", "HUEVO", "MANDIOCA", "TOMATE", "CEBOLLA", "PAPA", "BANANA", "MANZANA", "NARANJA", "LECHUGA", "ZANAHORIA", "ZAPALLO"])), CATEGORY_TILE_LIMIT)
    }

    if (selectedCategoryTab === "BEBIDAS") {
      return rankSlice(products.filter((p) => catMatch(p, ["BEBIDA", "ALCOHOL", "GASEOSA", "PARESA", "REFRESCO", "CERVEZA", "VINO", "JUGO", "AGUA", "COCA", "PEPSI", "BRAHMA", "PILSEN"])), CATEGORY_TILE_LIMIT)
    }

    if (selectedCategoryTab === "LACTEOS") {
      return rankSlice(products.filter((p) => catMatch(p, ["LACTEO", "LECHE", "MANTECA", "CUAJADA", "DERIVADO", "DULCE DE LECHE", "HELADO", "TREBOL", "QUESO", "YOGUR", "FIAMBRE", "JAMON", "PALETA"])), CATEGORY_TILE_LIMIT)
    }

    if (selectedCategoryTab === "ALMACEN") {
      return rankSlice(products.filter((p) => catMatch(p, [
        "ALMACEN", "ABARROTE", "ACEITE", "ADEREZO", "ALIMENTO", "ALMIDON", "APOLO", "ARROZ", "AZUCAR",
        "CEREAL", "COMESTIBLE", "CONDIMENTO", "CONSERV", "DULCE", "FARINHA", "FAROFA", "FEIJAO", "FIDEO",
        "GOLOSINA", "SNACK", "HARINA", "INFUSION", "LASAÑA", "LASANA", "LENTEJA", "LEVADURA", "MAIZ",
        "MATINAL", "PASTA", "SEMILLA", "TE", "CAF", "YERBA"
      ])), CATEGORY_TILE_LIMIT)
    }

    if (selectedCategoryTab === "LIMPIEZA") {
      return rankSlice(products.filter((p) => catMatch(p, [
        "LIMPIEZA", "HIGIENE", "JABON", "PERFUMERIA", "CUIDADO", "DENTAL", "DESODORANTE", "CAPILAR", "FEMENINO",
        "PAÑAL", "PANAL", "PAPEL HIGIENICO", "LIMPIA VIDRIO", "PLAGA", "VENENO", "HOGAR", "BAZAR", "COCINA",
        "DETERGENTE", "LAVANDINA", "SUAVIZANTE"
      ])), CATEGORY_TILE_LIMIT)
    }

    return products.slice(0, 30)
  }, [search, selectedCategoryTab, products, searchResults, topProductSkus])

  // ── CONTROL CRUZADO INTELIGENTE CON BALANZA DE CHECKOUT (CON DEBOUNCE DE ASENTAMIENTO) ──
  useEffect(() => {
    if (!weightPendingScale) {
      if (scaleSettlingTimerRef.current) {
        clearTimeout(scaleSettlingTimerRef.current)
        scaleSettlingTimerRef.current = null
      }
      return
    }

    const { product, etiquetaKg } = weightPendingScale
    const tol = getPesoTolerancia(etiquetaKg)

    // Si aún no hay peso en la balanza de checkout (> 15g), seguimos esperando que coloquen el producto
    if (currentScaleWeight <= 0.015) {
      if (scaleSettlingTimerRef.current) {
        clearTimeout(scaleSettlingTimerRef.current)
        scaleSettlingTimerRef.current = null
      }
      return
    }

    const diffKg = Math.abs(currentScaleWeight - etiquetaKg)

    // CASO 1: Coincide con la etiqueta dentro de la tolerancia permitida (mín. 35g o 3.5%)
    if (diffKg <= tol) {
      if (scaleSettlingTimerRef.current) {
        clearTimeout(scaleSettlingTimerRef.current)
        scaleSettlingTimerRef.current = null
      }

      if (isScaleStable) {
        api.inteliaudit.recordEvent({
          company_id: COMPANY_ID,
          user_id: user?.id,
          accion: "peso_etiqueta_verificado",
          entidad: "producto_pesable",
          entidad_id: product.id,
          datos_nuevos: {
            producto_nombre: product.nombre,
            etiqueta_kg: etiquetaKg,
            balanza_kg: currentScaleWeight,
            diferencia_g: Math.round(diffKg * 1000),
            tolerancia_g: Math.round(tol * 1000),
            caja: puntoEmision,
            cajero: user?.nombre,
          },
        } as any).catch(() => {})

        addToCart(product, etiquetaKg, "etiqueta_plu")
        setWeightPendingScale(null)
        searchInputRef.current?.focus()
        toast.success("Balanza de Sección", `${product.nombre}: ${etiquetaKg.toFixed(3)} KG -- verificado en balanza (${currentScaleWeight.toFixed(3)} KG).`)
      }
      return
    }

    // CASO 2: Discrepancia aparente (diffKg > tol).
    // Esperamos 650ms continuos de lectura estable antes de declarar discrepancia real
    if (isScaleStable) {
      if (!scaleSettlingTimerRef.current) {
        scaleSettlingTimerRef.current = setTimeout(() => {
          scaleSettlingTimerRef.current = null
          const finalDiff = Math.abs(currentScaleWeight - etiquetaKg)
          if (finalDiff > tol && currentScaleWeight > 0.015) {
            api.inteliaudit.recordEvent({
              company_id: COMPANY_ID,
              user_id: user?.id,
              accion: "peso_discrepancia_detectada",
              entidad: "producto_pesable",
              entidad_id: product.id,
              datos_nuevos: {
                producto_nombre: product.nombre,
                etiqueta_kg: etiquetaKg,
                balanza_kg: currentScaleWeight,
                diferencia_g: Math.round(finalDiff * 1000),
                tolerancia_g: Math.round(tol * 1000),
                caja: puntoEmision,
                cajero: user?.nombre,
              },
            } as any).catch(() => {})

            setWeightMismatch({ product, etiquetaKg, balanzaKg: currentScaleWeight })
            setWeightPendingScale(null)
          }
        }, 650)
      }
    } else {
      if (scaleSettlingTimerRef.current) {
        clearTimeout(scaleSettlingTimerRef.current)
        scaleSettlingTimerRef.current = null
      }
    }
  }, [currentScaleWeight, isScaleStable, weightPendingScale])

  // ── FOCO SIEMPRE EN "ESCANEAR PRODUCTO" AL CERRAR CUALQUIER MODAL ──────────
  const anyModalOpen =
    showAssignTerminalModal || showAperturaModal || showCierreTurnoModal || showCashDropModal ||
    showScaleModal || showManualWeightModal || showPosConfigModal || showSupervisorModal ||
    showRemoteAuthModal || showDevolucionModal || showCustomerModal || showCreateCustomerForm ||
    showPausedModal || showPriceCheckModal || showRatesModal || showPaymentModal ||
    showBancardManualFallback || showExtraClubBalanceModal || showLostDemandModal ||
    showLostDemandRegisterForm || showReimprimirModal || showCuponModal ||
    !!weightMismatch || !!weightPendingScale

  useEffect(() => {
    if (!anyModalOpen) {
      searchInputRef.current?.focus()
    }
  }, [anyModalOpen])

  // ── ESCANEO DIRECTO Y DECODIFICACIÓN DE BALANZAS DE GÓNDOLA (EAN-13 PREFIJO 2) ─
  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    let code = search.trim()
    if (!code) return

    // 0. Cantidad rápida: "3*<codigo>" o "3x<codigo>"
    let qtyPrefix: number | null = null
    const qtyMatch = code.match(/^(\d{1,4})\s*[*x]\s*(.*)$/i)
    if (qtyMatch) {
      const n = parseInt(qtyMatch[1], 10)
      const rest = qtyMatch[2].trim()
      if (n > 0 && rest) {
        qtyPrefix = n
        code = rest
      } else if (n > 0 && !rest) {
        return
      }
    }

    // 1. DECODIFICACIÓN AUTOMÁTICA DE CÓDIGOS DE BALANZA DE GÓNDOLA (EAN-13 PREFIJO 2)
    if (!qtyPrefix && code.length === 13 && code.startsWith("2")) {
      const pluCandidate = code.substring(0, 7)
      const weightGrams = parseInt(code.substring(7, 12), 10)
      if (weightGrams > 0) {
        const weightKg = weightGrams / 1000
        const matchPesable = products.find(p => p.codigo_barra === pluCandidate || p.sku === pluCandidate || p.codigo_barra?.startsWith(pluCandidate))
        if (matchPesable) {
          const tol = getPesoTolerancia(weightKg)
          const diffKg = Math.abs(currentScaleWeight - weightKg)
          const balanzaCoincideYa = isScaleStable && currentScaleWeight > 0.015 && diffKg <= tol

          if (balanzaCoincideYa) {
            // Si el producto ya está en la balanza del checkout y coincide, validar al instante
            api.inteliaudit.recordEvent({
              company_id: COMPANY_ID,
              user_id: user?.id,
              accion: "peso_etiqueta_verificado",
              entidad: "producto_pesable",
              entidad_id: matchPesable.id,
              datos_nuevos: {
                producto_nombre: matchPesable.nombre,
                etiqueta_kg: weightKg,
                balanza_kg: currentScaleWeight,
                diferencia_g: Math.round(diffKg * 1000),
                tolerancia_g: Math.round(tol * 1000),
                caja: puntoEmision,
                cajero: user?.nombre,
              },
            } as any).catch(() => {})

            addToCart(matchPesable, weightKg, "etiqueta_plu")
            setSearch("")
            searchInputRef.current?.focus()
            toast.success("Balanza de Sección", `${matchPesable.nombre}: ${weightKg.toFixed(3)} KG -- verificado en balanza.`)
            return
          }

          // Activamos verificación en balanza con feedback interactivo
          setWeightPendingScale({ product: matchPesable, etiquetaKg: weightKg })
          setSearch("")
          return
        }
      }
    }

    // 1.5 TARJETA QR / CÓDIGO DE SOCIO EXTRA CLUB (Búsqueda Offline-First en Memoria Local)
    const looksLikeExtraClubCode = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(code)
    if (!qtyPrefix && looksLikeExtraClubCode) {
      const cleanCode = code.toLowerCase()
      // Búsqueda en memoria local (0ms, 100% offline)
      const localMatch = customers.find((c) =>
        c.extra_club_numero?.toLowerCase() === cleanCode ||
        (c as any).ruc_sin_dv === cleanCode ||
        c.ruc === cleanCode ||
        c.id === cleanCode
      )
      if (localMatch) {
        setShowExtraClubBalanceModal(true)
        setBalanceModalQuery("")
        setBalanceModalResults([])
        setBalanceModalSelected(localMatch)
        setSearch("")
        searchInputRef.current?.focus()
        toast.success("Socio Extra Club", `${localMatch.razon_social || localMatch.nombre} -- consultando saldo.`)
        return
      }

      try {
        const found = (await api.customers.list({ search: code, limit: 5 })) || []
        const match = found.find((c) => c.extra_club_numero?.toLowerCase() === cleanCode || (c as any).ruc_sin_dv === code || c.ruc === code)

        if (match) {
          const normalized = normalizeCustomer(match)
          setShowExtraClubBalanceModal(true)
          setBalanceModalQuery("")
          setBalanceModalResults([])
          setBalanceModalSelected(normalized)
          setSearch("")
          searchInputRef.current?.focus()
          toast.success("Socio Extra Club", `${normalized.razon_social || normalized.nombre} -- consultando saldo.`)
          return
        }
      } catch (e) {}
      toast.warning("Socio no encontrado", `El código de socio ${code} no está registrado.`)
      setSearch("")
      searchInputRef.current?.focus()
      return
    }


    // 2. Coincidencia exacta en memoria local (con soporte estricto de padding para EAN-13/UPC)
    const cleanCode = code.trim()
    const localMatch = products.find((p) => {
      if (p.codigo_barra === cleanCode || p.sku === cleanCode) return true
      const pCode = p.codigo_barra?.trim()
      if (pCode && pCode.length >= 8 && cleanCode.length >= 8) {
        return pCode.padStart(13, "0") === cleanCode.padStart(13, "0")
      }
      return false
    })

    if (localMatch) {
      addToCart(localMatch, qtyPrefix ?? undefined)
      setSearch("")
      searchInputRef.current?.focus()
      return
    }

    const packMatch = packBarcodeMap.get(cleanCode)
    if (packMatch) {
      const baseProduct = products.find((p) => p.id === packMatch.productId)
      if (baseProduct) {
        const totalUnidades = (qtyPrefix ?? 1) * packMatch.unidadesPorPaquete
        addToCart(baseProduct, totalUnidades)
        setSearch("")
        searchInputRef.current?.focus()
        toast.success(`${packMatch.etiqueta} detectado`, `Se agregaron ${totalUnidades} unidades de ${baseProduct.nombre}.`)
        return
      }
    }

    // 3. Consulta al backend por código exacto
    try {
      const serverRes = await api.products.list({ search: cleanCode, limit: 10 })
      if (serverRes && serverRes.length > 0) {
        const best = serverRes.find((p) => {
          if (p.codigo_barra === cleanCode || p.sku === cleanCode) return true
          const pCode = p.codigo_barra?.trim()
          if (pCode && pCode.length >= 8 && cleanCode.length >= 8) {
            return pCode.padStart(13, "0") === cleanCode.padStart(13, "0")
          }
          return false
        })
        if (best) {
          addToCart(best, qtyPrefix ?? undefined)
          setSearch("")
          searchInputRef.current?.focus()
          return
        }
      }
    } catch (err) {}

    // 4. Si no existe coincidencia exacta de código, no adivinar ni agregar productos ajenos
    toast.warning("Producto no encontrado", `Código ${cleanCode} no está en catálogo.`)
    setLostDemandRows([{ producto: cleanCode, motivo: "sin_stock" }])
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
      case "extra_club_payment": {
        const nombre = customer.razon_social || customer.nombre || "Cliente"
        const numero = customer.extra_club_numero ? ` · Socio ${customer.extra_club_numero}` : ""
        const saldoTxt = extraClubCredit && extraClubCredit !== "loading" ? ` · Disponible ${formatPYG(extraClubCredit.saldo_disponible)}` : ""
        // En pago mixto solo la porcion Extra Club va a credito -- mostrar
        // el total de la venta ahi seria enganoso para la supervisora, que
        // necesita saber cuanto de esto es realmente fiado.
        if (isMultiPayment) {
          const montoCredito = parseInt(mixedExtraClubPyg.replace(/\D/g, "") || "0", 10)
          return `Pago mixto con Extra Club: ${nombre}${numero} · ${formatPYG(montoCredito)} a crédito de ${formatPYG(totalPyg)} total${saldoTxt}`
        }
        return `Pago Extra Club: ${nombre}${numero} · ${formatPYG(totalPyg)}${saldoTxt}`
      }
      case "reopen_invoice": {
        const nombre = (action as any).customer?.nombre || "cliente"
        return `Agregar identificación a factura Nº ${(action as any).sale?.numero || ""}: ${nombre}`
      }
      case "reopen_payment": {
        const s = (action as any).sale
        const fp = (action as any).formaPago || "—"
        const motTxt = (action as any).motivo || ""
        const socio = (action as any).customer?.nombre ? ` (Socio: ${(action as any).customer.nombre})` : ""
        return `⚠️ CAMBIO DE FORMA DE PAGO — Venta Nº ${s?.numero || ""}: ${s?.forma_pago || ""} → ${fp}${socio} | Motivo: ${motTxt}`
      }
      case "use_label_weight": {
        const wp = (action as any).weightProduct
        const etiquetaKg = (action as any).weightEtiquetaKg
        return `Usar peso de etiqueta pese a diferencia con la balanza: ${wp?.nombre || "producto"} · Etiqueta ${Number(etiquetaKg || 0).toFixed(3)} KG`
      }
      case "direct_discount": {
        const dType = (action as any).discountType === "percentage" ? `${(action as any).discountValue}%` : `₲ ${Number((action as any).discountValue || 0).toLocaleString("es-PY")}`
        return `Autorizar Descuento Directo: ${dType} sobre total de ${formatPYG(totalBrutoPyg)}`
      }
      default:
        return "Autorización de supervisor"
    }
  }

  const executeApprovedRemoteAction = async (action: any, resolverId: string, resolverNombre: string) => {
    if (action.type === "process_return") {
      await submitDevolucion(resolverId, resolverNombre)
    } else if (action.type === "assign_terminal") {
      await submitAssignTerminal()
    } else if (action.type === "extra_club_payment") {
      await handleProcessCheckout()
    } else if (action.type === "reopen_invoice") {
      await submitReabrirFactura(action.sale, action.customer, resolverId, resolverNombre)
    } else if (action.type === "reopen_payment") {
      await submitReabrirPago(action.sale, action.formaPago, action.motivo, resolverId, resolverNombre, action.customer)
    } else {
      executeSupervisorAction(action, resolverId, resolverNombre)
    }
  }

  const requestSupervisorAuthorization = async (action: {
    type: "remove_item" | "clear_cart" | "decrease_qty" | "open_pos_config" | "process_return" | "assign_terminal" | "extra_club_payment" | "reopen_invoice" | "reopen_payment" | "use_label_weight" | "direct_discount",
    itemId?: string,
    delta?: number,
    sale?: Sale,
    customer?: Customer,
    formaPago?: string,
    motivo?: string,
    weightProduct?: Product,
    weightEtiquetaKg?: number,
    weightBalanzaKg?: number,
    discountType?: "percentage" | "fixed",
    discountValue?: number,
    discountReason?: string
  }) => {
    if (isSupervisorUser) {
      if (action.type === "process_return") {
        await submitDevolucion(user!.id, user?.nombre || "Supervisor")
      } else if (action.type === "assign_terminal") {
        await submitAssignTerminal()
      } else if (action.type === "reopen_invoice") {
        await submitReabrirFactura(action.sale!, action.customer!, user!.id, user?.nombre || "Supervisor")
      } else if (action.type === "reopen_payment") {
        await submitReabrirPago(action.sale!, (action as any).formaPago!, (action as any).motivo!, user!.id, user?.nombre || "Supervisor", action.customer)
      } else {
        executeSupervisorAction(action, user!.id, user?.nombre || "Supervisor")
      }
      return
    }

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

  const executeSupervisorAction = (action: {
    type: "remove_item" | "clear_cart" | "decrease_qty" | "open_pos_config" | "process_return" | "assign_terminal" | "extra_club_payment" | "reopen_invoice" | "reopen_payment" | "use_label_weight" | "direct_discount",
    itemId?: string,
    delta?: number,
    sale?: Sale,
    customer?: Customer,
    formaPago?: string,
    motivo?: string,
    weightProduct?: Product,
    weightEtiquetaKg?: number,
    weightBalanzaKg?: number,
    discountType?: "percentage" | "fixed",
    discountValue?: number,
    discountReason?: string
  }, resolverId?: string, resolverNombre?: string) => {
    if (action.type === "extra_club_payment") {
      handleProcessCheckout()
    } else if (action.type === "direct_discount") {
      const dType = action.discountType || "percentage"
      const dVal = Number(action.discountValue) || 0
      const reason = (supervisorReason || action.discountReason || "Descuento autorizado por supervisor").trim()

      let discountAmountPyg = 0
      if (dType === "percentage") {
        discountAmountPyg = Math.round(totalBrutoPyg * (dVal / 100))
      } else {
        discountAmountPyg = Math.min(totalBrutoPyg, Math.round(dVal))
      }

      setAppliedDiscount({
        type: dType,
        value: dVal,
        montoPyg: discountAmountPyg,
        reason: reason,
        supervisorId: resolverId || user?.id || "",
        supervisorNombre: resolverNombre || user?.nombre || "Supervisor",
      })
      setShowDiscountModal(false)

      // REGISTRO DE EVENTO DE AUDITORÍA Y RIESGO EN INTELIAUDIT
      api.inteliaudit.recordEvent({
        company_id: COMPANY_ID,
        user_id: resolverId || user?.id,
        accion: "descuento_directo_autorizado",
        entidad: "venta_pos",
        entidad_id: null,
        datos_anteriores: {
          total_bruto_pyg: totalBrutoPyg,
          items_count: cart.length,
        },
        datos_nuevos: {
          tipo_descuento: dType,
          valor_descuento: dVal,
          monto_descuento_pyg: discountAmountPyg,
          total_con_descuento_pyg: Math.max(0, totalBrutoPyg - discountAmountPyg),
          motivo: reason,
          autorizado_por_id: resolverId || user?.id,
          autorizado_por_nombre: resolverNombre || user?.nombre,
          cajero_id: user?.id,
          cajero_nombre: user?.nombre,
          caja: terminalAssignment?.caja_nombre || machineHostname || "Caja POS",
          nivel_riesgo: "ALTO_RIESGO_FINANCIERO",
          timestamp: new Date().toISOString(),
        },
      } as any).catch((err) => console.warn("Error grabando auditoria de descuento:", err))

      toast.success("Descuento Aplicado", `Descuento de ${dType === "percentage" ? `${dVal}%` : formatPYG(discountAmountPyg)} autorizado por ${resolverNombre || "Supervisor"}.`)
    } else if (action.type === "use_label_weight" && action.weightProduct && action.weightEtiquetaKg) {

      api.inteliaudit.recordEvent({
        company_id: COMPANY_ID,
        user_id: resolverId || user?.id,
        accion: "peso_resuelto_etiqueta_autorizado",
        entidad: "producto_pesable",
        entidad_id: action.weightProduct.id,
        datos_nuevos: {
          producto_nombre: action.weightProduct.nombre,
          etiqueta_kg: action.weightEtiquetaKg,
          balanza_kg: action.weightBalanzaKg ?? null,
          diferencia_g: action.weightBalanzaKg != null ? Math.round(Math.abs(action.weightEtiquetaKg - action.weightBalanzaKg) * 1000) : null,
          caja: puntoEmision,
          cajero: user?.nombre,
          autorizado_por: resolverNombre || user?.nombre,
        },
      } as any).catch(() => {})
      addToCart(action.weightProduct, action.weightEtiquetaKg, "etiqueta_plu")
      setWeightMismatch(null)
      setWeightPendingScale(null)
      searchInputRef.current?.focus()
      toast.warning("Peso de etiqueta autorizado", `${action.weightProduct.nombre}: se usó ${action.weightEtiquetaKg.toFixed(3)} KG de la etiqueta pese a la diferencia con la balanza.`)
    } else if (action.type === "remove_item" && action.itemId) {
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
        if (nextQty > 0) applyTieredPrice(itemBefore.product_id, nextQty, customer.id)
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
    if (pendingSupervisorAction?.type === "direct_discount") {
      if (!supervisorReason || supervisorReason.trim().length < 5) {
        toast.warning("Motivo Obligatorio", "El supervisor debe ingresar obligatoriamente el motivo del descuento (mín. 5 caracteres).")
        return
      }
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
        } else if (pendingSupervisorAction.type === "extra_club_payment") {
          await handleProcessCheckout()
        } else if (pendingSupervisorAction.type === "reopen_invoice") {
          await submitReabrirFactura(pendingSupervisorAction.sale!, pendingSupervisorAction.customer!, res.id!, res.nombre || "Supervisor")
        } else if (pendingSupervisorAction.type === "reopen_payment") {
          await submitReabrirPago(pendingSupervisorAction.sale!, pendingSupervisorAction.formaPago!, pendingSupervisorAction.motivo!, res.id!, res.nombre || "Supervisor", pendingSupervisorAction.customer)
        } else {
          executeSupervisorAction(pendingSupervisorAction, res.id!, res.nombre || "Supervisor")
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
        applyTieredPrice(item.product_id, item.quantity + delta, customer.id)
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

    const tokens = query.split(/\s+/).filter(Boolean)
    return list.filter(c => {
      const text = `${c.nombre || ''} ${c.razon_social || ''} ${c.ruc || ''} ${c.ci || ''} ${(c as any).telefono || ''} ${(c as any).extra_club_numero || ''}`.toLowerCase()
      return tokens.every(token => text.includes(token))
    })
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

  // Temporizador de auto-cierre -- igual criterio que el kiosco de precios
  // (PriceCheckerKioskPage): si nadie toca la consulta se cierra sola, no
  // se queda abierta indefinidamente tapando la pantalla de cobro. Se
  // reinicia cada vez que se elige un producto nuevo.
  const PRICE_CHECK_AUTOCLOSE_SECONDS = 10
  const [priceCheckCountdown, setPriceCheckCountdown] = useState(PRICE_CHECK_AUTOCLOSE_SECONDS)
  useEffect(() => {
    if (!showPriceCheckModal || !priceCheckSelected) return
    setPriceCheckCountdown(PRICE_CHECK_AUTOCLOSE_SECONDS)
    const interval = setInterval(() => {
      setPriceCheckCountdown((s) => {
        if (s <= 1) {
          clearInterval(interval)
          closePriceCheckModal()
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [showPriceCheckModal, priceCheckSelected])

  // ── GUARDADO DE ASIGNACIONES DE TERMINALES POS (BANCARD & DINELCO) ────────
  const handleSavePosAssignments = (e: React.FormEvent) => {
    e.preventDefault()
    localStorage.setItem("pos_terminals_master_mapping", JSON.stringify(posAssignments))
    setShowPosConfigModal(false)
    toast.success("Configuración Guardada", "Se actualizaron las terminales POS asignadas a las cajas.")
  }

  // ── CÁLCULOS DE TOTALES Y MULTIMONEDA ──────────────────────────────────────
  const { totalBrutoPyg, totalBasePyg, totalAhorroPyg, descuentoTotalPyg, totalPyg, totalBrl, totalUsd, gravada10Pyg, gravada5Pyg, exentaPyg, iva10Pyg, iva5Pyg } = useMemo(() => {
    let totBruto = 0
    let totBase = 0
    let g10 = 0
    let g5 = 0
    let ex = 0

    for (const item of cart) {
      const lineTotal = item.precio * item.quantity
      const lineBase = (Number(item.precio_base) || Number(item.precio) || 0) * item.quantity
      totBruto += lineTotal
      totBase += lineBase

      if (item.iva_tasa === 10) {
        g10 += lineTotal
      } else if (item.iva_tasa === 5) {
        g5 += lineTotal
      } else {
        ex += lineTotal
      }
    }

    let descMonto = 0
    if (appliedDiscount) {
      if (appliedDiscount.type === "percentage") {
        descMonto = Math.round(totBruto * (appliedDiscount.value / 100))
      } else {
        descMonto = Math.min(totBruto, Math.round(appliedDiscount.value))
      }
    }

    const ahorroPromos = Math.max(0, totBase - totBruto)
    const totalAhorro = Math.round(ahorroPromos + descMonto)
    const netTot = Math.max(0, totBruto - descMonto)
    const factorDesc = totBruto > 0 ? netTot / totBruto : 1

    const iv10 = Math.round((g10 * factorDesc) / 11)
    const iv5 = Math.round((g5 * factorDesc) / 21)

    const totBrl = rates.BRL > 0 ? (netTot / rates.BRL).toFixed(2) : "0.00"
    const totUsd = rates.USD > 0 ? (netTot / rates.USD).toFixed(2) : "0.00"

    return {
      totalBrutoPyg: Math.round(totBruto),
      totalBasePyg: Math.round(totBase),
      totalAhorroPyg: totalAhorro,
      descuentoTotalPyg: Math.round(descMonto),
      totalPyg: Math.round(netTot),
      totalBrl: totBrl,
      totalUsd: totUsd,
      gravada10Pyg: Math.round(g10 * factorDesc),
      gravada5Pyg: Math.round(g5 * factorDesc),
      exentaPyg: Math.round(ex * factorDesc),
      iva10Pyg: Math.round(iv10),
      iva5Pyg: Math.round(iv5),
    }
  }, [cart, rates, appliedDiscount])


  // Cálculos dinámicos de vuelto multimoneda en el modal de cobro (SIN CÉNTIMOS EN PYG)
  const { totalRecibidoPyg, saldoRestantePyg, vueltoPyg } = useMemo(() => {
    let recibido = 0

    // Con un solo metodo activo, ese metodo implica el total de la venta
    // (nunca se pide un monto -- la tarjeta/QR/Extra Club se cobran enteros
    // de una). Con 2+ metodos activos, cada uno no-efectivo aporta lo que
    // el cajero cargo en su propio campo -- eso reemplaza a la vieja
    // pestana "Pago Mixto".
    if (activeMethods.has("cash")) {
      // Un monto mal tipeado (ej. una "," suelta en el campo de R$/US$)
      // hace que parseFloat devuelva NaN, que se propaga a totalRecibidoPyg
      // y de ahi a saldoRestantePyg -- y "NaN > 0" es false en JS, asi que
      // el chequeo de "falta cobrar" en handleProcessCheckout se saltaba
      // por completo, dejando pasar un cobro sin plata real detras.
      const pyg = parseInt(payCashPyg.replace(/\D/g, "") || "0", 10) || 0
      const brl = (parseFloat(payCashBrl.replace(/,/g, ".") || "0") || 0) * rates.BRL
      const usd = (parseFloat(payCashUsd.replace(/,/g, ".") || "0") || 0) * rates.USD
      recibido += pyg + brl + usd
    }
    if (activeMethods.has("bancard")) {
      recibido += isMultiPayment ? parseInt(mixedCardPyg.replace(/\D/g, "") || "0", 10) : totalPyg
    }
    if (activeMethods.has("dinelco")) {
      recibido += isMultiPayment ? parseInt(mixedDinelcoPyg.replace(/\D/g, "") || "0", 10) : totalPyg
    }
    if (activeMethods.has("qr")) {
      recibido += isMultiPayment ? parseInt(mixedQrPyg.replace(/\D/g, "") || "0", 10) : totalPyg
    }
    if (activeMethods.has("plugpay_credito")) {
      recibido += isMultiPayment ? parseInt(mixedParceladoPyg.replace(/\D/g, "") || "0", 10) : totalPyg
    }
    if (activeMethods.has("extra_club")) {
      recibido += isMultiPayment ? parseInt(mixedExtraClubPyg.replace(/\D/g, "") || "0", 10) : totalPyg
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
  }, [activeMethods, isMultiPayment, payCashPyg, payCashBrl, payCashUsd, mixedCardPyg, mixedDinelcoPyg, mixedQrPyg, mixedParceladoPyg, mixedExtraClubPyg, totalPyg, rates])

  // ── Detección inteligente de redondeo para Centro Amor y Esperanza ("Abre tu corazón") ──
  const montoSugeridoDonacion = useMemo(() => {
    if (montoDonacionManual !== null && montoDonacionManual > 0) return montoDonacionManual

    // 1. Si el cajero ingresó un billete mayor (ej. 102.000 para 100.577 -> sugerir primero la diferencia total de 1.423)
    if (vueltoPyg > 0) {
      return vueltoPyg
    }

    // 2. Si no hay vuelto o monto exacto, sugerir el redondeo de compra al próximo millar (ej. 100.577 -> 423)
    const restoTotal = totalPyg % 1000
    if (restoTotal > 0) {
      return 1000 - restoTotal
    }

    return 500
  }, [vueltoPyg, totalPyg, montoDonacionManual])

  const montoDonacionEfectiva = donacionActiva ? (montoDonacionManual !== null ? montoDonacionManual : montoSugeridoDonacion) : 0
  const vueltoFinalPyg = Math.max(0, vueltoPyg - montoDonacionEfectiva)

  const handleToggleDonacion = (nextActiva: boolean, customMonto?: number) => {
    setDonacionActiva(nextActiva)
    if (customMonto !== undefined) {
      setMontoDonacionManual(customMonto)
    } else {
      // Sin customMonto -- ya sea al desactivar, o al elegir el chip "Vuelto
      // Total" (modo automatico/en vivo) -- se limpia cualquier monto
      // congelado de un chip anterior para que vuelva a seguir el vuelto
      // real/sugerido en cada recalculo, no un numero pegado del momento
      // en que se hizo clic.
      setMontoDonacionManual(null)
    }
    const monto = customMonto !== undefined ? customMonto : (montoDonacionManual !== null ? montoDonacionManual : montoSugeridoDonacion)
    const currentCash = parseInt(payCashPyg.replace(/\D/g, "") || "0", 10)
    // Esta formula (total + donacion) solo tiene sentido para un cobro
    // 100% en efectivo Gs -- si ya hay algo cargado en R$/US$ (pago
    // multimoneda), pisar el campo de Gs con este numero arruinaba lo
    // que el cajero ya venia armando. El vuelto y la donacion efectiva
    // ya se recalculan solos via vueltoPyg/montoDonacionEfectiva sin
    // necesidad de tocar ningun campo en ese caso.
    const hayOtraMoneda = (parseFloat(payCashBrl.replace(/,/g, ".") || "0") || 0) > 0 || (parseFloat(payCashUsd.replace(/,/g, ".") || "0") || 0) > 0
    
    // Solo actualizar el campo de efectivo si el cajero estaba en el monto exacto base sin haber ingresado un billete mayor
    if (currentCash <= totalPyg && !hayOtraMoneda) {
      if (nextActiva) {
        setPayCashPyg((totalPyg + monto).toLocaleString("es-PY"))
      } else {
        setPayCashPyg(totalPyg.toLocaleString("es-PY"))
      }
    }
  }

  // Cargar campaña activa de donación para el POS
  useEffect(() => {
    api.donaciones.getCampanaActiva().then(setCampanaActivaDonacion).catch(() => {})
  }, [])

  // Al abrir el modal de cobro, foco directo al campo de Guaraníes (ya viene
  // precargado con el monto exacto) con el texto seleccionado -- así el
  // cajero puede tipear un monto distinto de una sola vez (sobreescribe la
  // selección) o apretar Enter directo para cobrar el exacto, sin mouse.
  // Antes el foco saltaba solo al botón de confirmar apenas el monto
  // alcanzaba, lo que le sacaba el foco al campo mientras el cajero
  // todavía estaba tipeando un monto distinto.
  useEffect(() => {
    if (showPaymentModal && activeMethods.has("cash")) {
      payCashPygInputRef.current?.focus()
      payCashPygInputRef.current?.select()
    }
  }, [showPaymentModal, activeMethods])

  // Mismo ciclo con precarga del faltante que en efectivo, pero para pago
  // mixto: Gs -> R$ -> Tarjeta -> QR -> Gs. El pago mixto antes era 4
  // campos sueltos sin ninguna ayuda -- ahora cada Enter sugiere cuánto
  // falta convertido a la moneda del siguiente campo.
  // Enter en el campo de monto de una linea no-efectivo (Bancard, Dinelco,
  // QR, Extra Club) cuando hay pago dividido: si lo que ya se cargo cubre
  // el total, cobra directo; si no, autocompleta ESTE campo con el
  // faltante (equivalente a tocar "Resto" pero sin soltar el teclado). El
  // ciclo Gs -> R$ -> US$ -> Gs de Efectivo es aparte y no cambia.
  const handleMixedFieldKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    setValue: (v: string) => void,
  ) => {
    if (e.key === "Enter") {
      e.preventDefault()
      if (totalRecibidoPyg >= totalPyg && totalPyg > 0 && !submitting) {
        handleProcessCheckout()
      } else {
        const faltante = Math.max(0, totalPyg - totalRecibidoPyg)
        if (faltante > 0) setValue(Math.ceil(faltante).toLocaleString("es-PY"))
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
        if (listoParaCerrar) {
          handleProcessCheckout()
        } else {
          setListoParaCerrar(true)
        }
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
  useEffect(() => {
    setListoParaCerrar(false)
  }, [payCashPyg, payCashBrl, payCashUsd])

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
    setActiveMethods(new Set(["cash"]))
    setAllowMixedPayment(false)
    setPayCashPyg(totalPyg.toLocaleString("es-PY"))
    setPayCashBrl("")
    setPayCashUsd("")
    setHasClickedQuickCash(false)
    setMixedCardPyg("")
    setMixedDinelcoPyg("")
    setMixedQrPyg("")
    setMixedParceladoPyg("")
    setMixedExtraClubPyg("")
    setPosVerifyStatus("idle")
    setPosVerifyCandidates([])
    setPosVerifiedTxn(null)
    setPosVerifyOpenedAt(new Date().toISOString())
    resetBancardFlow()
    setDonacionActiva(false)
    setMontoDonacionManual(null)
    setShowPaymentModal(true)
  }

  // Busca en la maquinita física (tabla real fin_operacao_pos, viva, en la
  // red propia del terminal -- confirmado con el cliente que Bancard va por
  // cable con IP propia y Dinelco por WiFi, ninguno atado a Ñemuha) la
  // transacción que corresponde al cobro actual, en vez de que el cajero
  // tipee el voucher a mano sin ninguna verificación real.
  const handleVerifyPosTerminal = async (metodo: "bancard" | "dinelco") => {
    const procesador = metodo === "bancard" ? "BANCARD" : "DINELCO"
    const montoStr = metodo === "bancard" ? mixedCardPyg : mixedDinelcoPyg
    const monto = isMultiPayment ? parseInt(montoStr.replace(/\D/g, "") || String(totalPyg), 10) : totalPyg
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
        handleSelectPosCandidate(metodo, candidates[0])
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

  const handleSelectPosCandidate = (metodo: "bancard" | "dinelco", c: { id: string; fecha: string; tarjeta_marca: string; monto: number; voucher: string; cajero: string }) => {
    setPosVerifiedTxn(c)
    setPosVerifyStatus("found")
    setPosVerifyCandidates([])
    if (metodo === "bancard") setPosCardCupon(c.voucher)
    else setDinelcoCupon(c.voucher)
  }

  const handleProcessCheckout = async () => {
    if (saldoRestantePyg > 0 && !(activeMethods.size === 1 && activeMethods.has("qr"))) {
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
      // isClubMember antes se calculaba solo por "hay un cliente elegido"
      // (cualquier venta con nombre de cliente salia rotulada "FACTURA
      // CREDITO", incluso pagada en efectivo) -- ahora es especificamente
      // "se pago con Extra Club", que es lo unico que realmente es credito.
      const isClubMember = activeMethods.has("extra_club") && (!isMultiPayment || parseInt(mixedExtraClubPyg.replace(/\D/g, "") || "0", 10) > 0)
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
      const saleItemsForCreate = cart.map(i => {
        const itemTotalBruto = i.precio * i.quantity
        const pctDesc = totalBrutoPyg > 0 && descuentoTotalPyg > 0 ? (descuentoTotalPyg / totalBrutoPyg) * 100 : (i.descuento_pct || 0)
        return {
          product_id: i.product_id || i.id,
          cantidad: i.quantity,
          precio_unitario: i.precio,
          iva_tasa: i.iva_tasa,
          descuento_pct: Number(pctDesc.toFixed(2)),
          descuento_monto: Math.round(itemTotalBruto * (pctDesc / 100)),
          subtotal: itemTotalBruto,
          origen_balanza: i.origen_balanza || undefined,
        }
      })
      // Desglose real de medios de pago -- antes era una sola linea fija
      // por pestaña (ni "mixed" ni "extra_club" quedaban bien representados)
      // y ademas se descartaba en silencio del lado del backend (ver fix en
      // sales/service.py). Los codigos EFECTIVO/QR/etc en mayuscula
      // coinciden con lo que ya usa caja/service.py para calcular el
      // efectivo acumulado de la alerta de retiro.
      const salePaymentsForCreate: { forma_pago: string; monto: number; moneda?: string }[] = (() => {
        const out: { forma_pago: string; monto: number; moneda?: string }[] = []
        
        let cardMonto = 0
        let dinelcoMonto = 0
        let qrMonto = 0
        let parceladoMonto = 0
        let extraClubMonto = 0

        if (activeMethods.has("bancard")) {
          cardMonto = isMultiPayment ? parseInt(mixedCardPyg.replace(/\D/g, "") || "0", 10) : totalPyg
          if (cardMonto > 0) out.push({ forma_pago: "TARJETA_BANCARD", monto: cardMonto, moneda: "PYG" })
        }
        if (activeMethods.has("dinelco")) {
          dinelcoMonto = isMultiPayment ? parseInt(mixedDinelcoPyg.replace(/\D/g, "") || "0", 10) : totalPyg
          if (dinelcoMonto > 0) out.push({ forma_pago: "TARJETA_DINELCO", monto: dinelcoMonto, moneda: "PYG" })
        }
        if (activeMethods.has("qr")) {
          qrMonto = isMultiPayment ? parseInt(mixedQrPyg.replace(/\D/g, "") || "0", 10) : totalPyg
          if (qrMonto > 0) out.push({ forma_pago: "QR", monto: qrMonto, moneda: "PYG" })
        }
        if (activeMethods.has("extra_club")) {
          extraClubMonto = isMultiPayment ? parseInt(mixedExtraClubPyg.replace(/\D/g, "") || "0", 10) : totalPyg
          if (extraClubMonto > 0) out.push({ forma_pago: "EXTRA_CLUB", monto: extraClubMonto, moneda: "PYG" })
        }
        if (activeMethods.has("cash")) {
          const otrosNonCash = cardMonto + dinelcoMonto + qrMonto + parceladoMonto + extraClubMonto
          let remainingPyg = Math.max(0, totalPyg - otrosNonCash)

          const brlInput = parseFloat(payCashBrl.replace(",", ".")) || 0
          const usdInput = parseFloat(payCashUsd.replace(",", ".")) || 0

          if (brlInput > 0 && remainingPyg > 0) {
            const brlRate = rates.BRL > 0 ? rates.BRL : 1480
            const brlValueInPyg = brlInput * brlRate
            const netPygCoveredByBrl = Math.min(brlValueInPyg, remainingPyg)
            const netBrl = Math.round((netPygCoveredByBrl / brlRate) * 100) / 100
            if (netBrl > 0) {
              out.push({ forma_pago: "EFECTIVO", monto: netBrl, moneda: "BRL" })
              remainingPyg = Math.max(0, remainingPyg - netPygCoveredByBrl)
            }
          }

          if (usdInput > 0 && remainingPyg > 0) {
            const usdRate = rates.USD > 0 ? rates.USD : 7550
            const usdValueInPyg = usdInput * usdRate
            const netPygCoveredByUsd = Math.min(usdValueInPyg, remainingPyg)
            const netUsd = Math.round((netPygCoveredByUsd / usdRate) * 100) / 100
            if (netUsd > 0) {
              out.push({ forma_pago: "EFECTIVO", monto: netUsd, moneda: "USD" })
              remainingPyg = Math.max(0, remainingPyg - netPygCoveredByUsd)
            }
          }

          if (remainingPyg > 0) {
            out.push({ forma_pago: "EFECTIVO", monto: remainingPyg, moneda: "PYG" })
          }
        }

        if (out.length === 0) out.push({ forma_pago: "EFECTIVO", monto: totalPyg, moneda: "PYG" })
        return out
      })()

      const saleBasePayload = {
        company_id: COMPANY_ID,
        customer_id: customer.id,
        user_id: user?.id,
        session_id: cashSessionId || undefined,
        punto_emision: terminalAssignment?.punto_emision || undefined,
        subtotal: totalBrutoPyg,
        descuento_total: descuentoTotalPyg,
        total: totalPyg,
        observaciones: appliedDiscount ? `Descuento directo autorizado por ${appliedDiscount.supervisorNombre} (${appliedDiscount.reason})` : undefined,
        condicion: isClubMember ? "credito" : "contado",
        estado: "completada",
        items: saleItemsForCreate,
        payments: salePaymentsForCreate,

        admin_override_credito: activeMethods.has("extra_club") ? extraClubAdminOverride : false,
        monto_donacion: donacionActiva ? montoDonacionEfectiva : 0,
        donacion_campana: donacionActiva ? (campanaActivaDonacion?.nombre || "Abre tu corazón") : undefined,
        donacion_ong: donacionActiva ? (campanaActivaDonacion?.ong_nombre || "Centro Amor y Esperanza") : undefined,
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
      // Estimacion de puntos de fidelidad -- misma formula que usa el backend
      // (piso de total/puntos_por_guarani), asi que coincide con lo que
      // realmente se va a guardar. No aplica a Consumidor Final.
      const puntosEstimados = (
        customer.id !== DEFAULT_CUSTOMER.id &&
        loyaltyConfig?.activo &&
        loyaltyConfig?.crear_en_venta &&
        loyaltyConfig?.puntos_por_guarani > 0
      ) ? Math.floor(totalPyg / loyaltyConfig.puntos_por_guarani) : 0

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
              <tr><td colspan="2" style="font-weight: bold; padding-bottom: 1px;">Medios de Pago Utilizados:</td></tr>
              ${salePaymentsForCreate.map((p) => `
                <tr>
                  <td>${FORMA_PAGO_LABEL[p.forma_pago] || p.forma_pago}${p.moneda && p.moneda !== "PYG" ? ` (${p.moneda})` : ""}:</td>
                  <td style="text-align: right;">${p.moneda === "USD" ? `US$ ${p.monto.toFixed(2)}` : p.moneda === "BRL" ? `R$ ${p.monto.toFixed(2)}` : `Gs. ${fmtGs(p.monto)}`}</td>
                </tr>
              `).join("")}
              ${(bancardTxnState === "aprobada" && bancardTxnResult) ? `
                <tr><td colspan="2" style="font-size: 8.5px; padding-top: 1px;">${bancardTxnResult.nombreTarjeta || ""}${bancardTxnResult.pan ? ` **** ${bancardTxnResult.pan}` : ""}</td></tr>
                <tr><td colspan="2" style="font-size: 8.5px;">Aut. ${bancardTxnResult.codigoAutorizacion || "-"} · Boleta ${bancardTxnResult.nroBoleta || "-"}</td></tr>
              ` : ""}
              ${(bancardQrState === "aprobada" && bancardQrResult) ? `
                <tr><td colspan="2" style="font-size: 8.5px; padding-top: 1px;">${bancardQrResult.nombreTarjeta || ""}</td></tr>
                <tr><td colspan="2" style="font-size: 8.5px;">Aut. ${bancardQrResult.codigoAutorizacion || "-"} · Boleta ${bancardQrResult.nroBoleta || "-"}</td></tr>
              ` : ""}
              ${(donacionActiva && montoDonacionEfectiva > 0) ? `
                <tr style="color: #b45309; font-weight: bold;">
                  <td style="padding-top: 2px;">DONACIÓN SOLIDARIA:</td>
                  <td style="text-align: right; padding-top: 2px;">Gs. ${fmtGs(montoDonacionEfectiva)}</td>
                </tr>
                <tr>
                  <td colspan="2" style="font-size: 8px; color: #555; text-align: left;">(Centro Amor y Esperanza - Abre tu corazón)</td>
                </tr>
              ` : ""}
              <tr style="font-weight: bold; font-size: 10.5px;">
                <td style="padding-top: 2px;">VUELTO:</td>
                <td style="text-align: right; padding-top: 2px; white-space: nowrap;">
                  Gs. ${fmtGs(vueltoFinalPyg)} ${rates.BRL > 0 ? `(R$ ${(vueltoFinalPyg / rates.BRL).toFixed(2)})` : ''}
                </td>
              </tr>
            </table>
          ` : ''}

          ${(donacionActiva && montoDonacionEfectiva > 0) ? `
            <div style="border: 1px dashed #b45309; background: #fffbeb; padding: 6px; margin: 6px 0; text-align: center; font-size: 9px; font-family: monospace; border-radius: 4px;">
              <div style="font-weight: 900; font-size: 10px; color: #92400e;">❤️ ¡GRACIAS POR ABRIR TU CORAZÓN!</div>
              <div style="margin-top: 2px; color: #78350f;">Colaboraste con <b>Gs. ${fmtGs(montoDonacionEfectiva)}</b> para el</div>
              <div style="font-weight: bold; color: #78350f;">Centro Amor y Esperanza</div>
              <div style="font-size: 8px; margin-top: 3px; color: #92400e;">Conocé más y auditá en:</div>
              <div style="font-weight: bold; font-size: 9px; color: #1e40af;">www.centroamoresperanza.org</div>
            </div>
          ` : ''}

          ${isClubMember ? `
            <div style="border-top: 1px dashed #000; margin-top: 6px; padding-top: 4px; font-size: 9px;">
              <div>Cliente: ${(customer.razon_social || customer.nombre || "").toUpperCase()}</div>
              <div>C.I./RUC: ${customer.ci || customer.ruc || "-"}</div>
              <div>Empresa: ${customer.empresa_vinculada_nombre ? `${customer.empresa_vinculada_nombre.trim()}${customer.empresa_vinculada_ruc ? ` (${customer.empresa_vinculada_ruc})` : ""}` : "-"}</div>
              <div style="text-align: center; margin-top: 14px; border-top: 1px solid #000; padding-top: 2px; width: 70%; margin-left: auto; margin-right: auto;">Firma del cliente</div>
              <div style="text-align: center; font-size: 8px; margin-top: 3px;">Factura a crédito Extra Club -- documento con valor para cobro</div>
            </div>
          ` : ''}

          ${puntosEstimados > 0 ? `
            <div style="border-top: 1px dashed #000; margin-top: 5px; padding-top: 3px; font-size: 9.5px; text-align: center; font-weight: bold;">
              ⭐ Sumaste ${puntosEstimados} puntos de fidelidad
            </div>
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
        saleCreatePromise = api.sales.create({ ...saleBasePayload, recibo_html: receiptHtml } as any).catch(async (apiErr: any) => {
          console.warn("[POS] API central no disponible, encolando venta offline en IndexedDB...", apiErr)
          try {
            const offlineId = `off-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
            await offlineDB.pendingSales.add({
              id: offlineId,
              data: { ...saleBasePayload, recibo_html: receiptHtml },
              created_at: new Date().toISOString(),
              status: "pending",
              retry_count: 0,
              last_retry: new Date().toISOString(),
              next_retry: new Date().toISOString(),
            })
            toast.warning("Venta guardada en modo offline", "El ticket se imprimió y la venta se sincronizará automáticamente cuando vuelva la conexión.")
          } catch (dbErr) {
            console.error("Error guardando en pendingSales:", dbErr)
            toast.error("Venta no guardada en el sistema", apiErr?.message || "Avisá a soporte.")
          }
          return null
        })
      }

      // Si el cobro con tarjeta se verificó contra la transacción real de la
      // terminal, se reclama ahora (best-effort, sin esperar -- no debe
      // sumar delay entre cobrar y que salga el ticket) para que esa
      // transacción no se le pueda asignar por error a otra venta.
      if ((activeMethods.has("bancard") || activeMethods.has("dinelco")) && posVerifiedTxn) {
        const claimTxn = posVerifiedTxn
        const claimProcesador = activeMethods.has("bancard") ? "BANCARD" : "DINELCO"
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

      // Igual que arriba, pero para el registro de pos_terminal_transactions
      // del flujo automatico nuevo (Bancard real via API) -- linkea el
      // sale_id una vez que la venta ya existe, best-effort.
      const bancardLogId = bancardTxnLogId || bancardQrLogId
      if (bancardLogId) {
        const doLinkSale = (saleIdForLink?: string) => {
          if (!saleIdForLink) return
          api.posTerminalTransactions.update(bancardLogId, { sale_id: saleIdForLink } as any).catch(() => {})
        }
        if (createdSaleId) {
          doLinkSale(createdSaleId)
        } else if (saleCreatePromise) {
          saleCreatePromise.then((s: any) => doLinkSale(s?.id))
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
        t += ESCPOS_BOLD_ON + `${escposStripAccents(tipoComprobanteLabel)} No: ${numeroComprobante}` + ESCPOS_BOLD_OFF + '\n'
        if (tpl.usar_numero_interno_venta !== false && numeroInterno) {
          t += `No Venta: ${numeroInterno}\n`
        }
        t += `Fecha/Hora: ${new Date().toLocaleString("es-PY")}\n`
        t += `Condicion: ${isClubMember ? "CREDITO" : "CONTADO"}\n`
        if (showCajero) t += `Cajero: ${escposStripAccents(user?.nombre || "Cajero 01")} (${puntoEmision})\n`
        if (showCliente) t += `Cliente: ${escposStripAccents(customer.nombre)}\n`
        if (showRucCliente) t += `RUC/CI: ${escposStripAccents(customer.ruc || customer.ci || "44444401-7")}\n`
        t += escposDashes(W) + '\n'
        t += escposTwoCol('DESCRIPCION / DETALLE', 'TOTAL (GS)', W) + '\n'
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
            // Maximo 2 lineas: nombre solo en la primera
            let nombreLine = escposStripAccents(item.nombre) + balanza
            if (nombreLine.length > W) nombreLine = escposPadRight(nombreLine, W)
            t += nombreLine + '\n'
            t += escposTwoCol(`  ${cantStr} x ${fmtGs(item.precio)}${cod}`, lineTotalStr) + '\n'
          }
        }
        t += escposDashes(W) + '\n'
        if (descuentoTotalPyg > 0) {
          t += escposTwoCol('SUBTOTAL:', fmtGs(totalBrutoPyg), W) + '\n'
          t += escposTwoCol('DESC. AUTORIZADO:', `-${fmtGs(descuentoTotalPyg)}`, W) + '\n'
          if (appliedDiscount?.reason) {
            t += `  Motivo: ${escposStripAccents(appliedDiscount.reason.slice(0, 30))}\n`
          }
          if (appliedDiscount?.supervisorNombre) {
            t += `  Aut: ${escposStripAccents(appliedDiscount.supervisorNombre.slice(0, 20))}\n`
          }
        }
        t += ESCPOS_BOLD_ON + ESCPOS_DOUBLE_ON + escposTwoCol('TOTAL:', fmtGs(totalPyg), 24) + ESCPOS_DOUBLE_OFF + ESCPOS_BOLD_OFF + '\n'

        if (showMulti && showBrl) t += escposTwoCol('Equiv. Reales:', `R$ ${totalBrl}`) + '\n'
        if (showMulti && showUsd) t += escposTwoCol('Equiv. Dolares:', `US$ ${totalUsd}`) + '\n'

        if (showPagos) {
          t += escposDashes(W) + '\n'
          t += 'Medios de Pago Utilizados:\n'
          for (const p of salePaymentsForCreate) {
            const label = (FORMA_PAGO_LABEL[p.forma_pago] || p.forma_pago) + (p.moneda && p.moneda !== "PYG" ? ` (${p.moneda})` : "")
            const montoTxt = p.moneda === "USD" ? `US$ ${p.monto.toFixed(2)}` : p.moneda === "BRL" ? `R$ ${p.monto.toFixed(2)}` : fmtGs(p.monto)
            t += escposTwoCol(escposStripAccents(label) + ':', montoTxt) + '\n'
          }
          if (donacionActiva && montoDonacionEfectiva > 0) {
            t += ESCPOS_BOLD_ON + escposTwoCol('DONACION SOLIDARIA:', fmtGs(montoDonacionEfectiva)) + ESCPOS_BOLD_OFF + '\n'
            t += ' (Centro Amor y Esperanza)\n'
          }
          const vueltoTxt = tpl.mostrar_vuelto_extranjero && rates.BRL > 0 && vueltoFinalPyg > 0
            ? `${fmtGs(vueltoFinalPyg)} (R$ ${(vueltoFinalPyg / rates.BRL).toFixed(2)})`
            : fmtGs(vueltoFinalPyg)
          t += ESCPOS_BOLD_ON + escposTwoCol('VUELTO:', vueltoTxt) + ESCPOS_BOLD_OFF + '\n'
        }

          if (tpl.habilitar_recuadro_ahorro !== false) {
            t += escposDashes(W) + '\n'
            t += ESCPOS_ALIGN_CENTER
            // 'left' aqui es intencional: la impresora ya esta en modo ALIGN_CENTER;
            // si ademas se agregan espacios manuales de centrado (escposCenter) el
            // texto queda desplazado hacia la derecha en el papel.
            if (isClubMember) {
              t += ESCPOS_BOLD_ON + escposStripAccents(tpl.titulo_ahorro_con_descuento || 'TU EXTRA AHORRO HOY:') + ESCPOS_BOLD_OFF + '\n'
              if (tpl.subtitulo_ahorro_promo) t += escposWrapText(tpl.subtitulo_ahorro_promo, W)
              if (tpl.subtitulo_ahorro_mayorista) t += escposWrapText(tpl.subtitulo_ahorro_mayorista, W)
            } else {
              t += ESCPOS_BOLD_ON + escposStripAccents(tpl.titulo_invitacion_ahorro || 'SUMATE AL EXTRA AHORRO DIARIO!') + ESCPOS_BOLD_OFF + '\n'
              // Las 3 lineas configurables -- se imprimen si tienen contenido
              if (tpl.linea1_invitacion_ahorro) t += escposWrapText(tpl.linea1_invitacion_ahorro, W)
              if (tpl.linea2_invitacion_ahorro) t += escposWrapText(tpl.linea2_invitacion_ahorro, W)
              if (tpl.linea3_invitacion_ahorro) t += ESCPOS_BOLD_ON + escposStripAccents(tpl.linea3_invitacion_ahorro) + ESCPOS_BOLD_OFF + '\n'
            }
            t += ESCPOS_ALIGN_LEFT
          }

        if (isClubMember) {
          t += escposDashes(W) + '\n'
          t += `Cliente: ${escposStripAccents((customer.razon_social || customer.nombre || "").toUpperCase())}\n`
          t += `C.I./RUC: ${customer.ci || customer.ruc || "-"}\n`
          t += `Empresa: ${customer.empresa_vinculada_nombre ? escposStripAccents(customer.empresa_vinculada_nombre.trim()) + (customer.empresa_vinculada_ruc ? ` (${customer.empresa_vinculada_ruc})` : "") : "-"}\n`
          t += '\n\n'
          t += ESCPOS_ALIGN_CENTER
          t += escposDashes(28) + '\n'
          t += 'Firma del cliente\n'
          t += 'Factura a credito Extra Club\n'
          t += 'Documento con valor para cobro\n'
          t += ESCPOS_ALIGN_LEFT
        }

        if (puntosEstimados > 0) {
          t += escposDashes(W) + '\n'
          t += ESCPOS_ALIGN_CENTER
          t += ESCPOS_BOLD_ON + `Sumaste ${puntosEstimados} puntos de fidelidad` + ESCPOS_BOLD_OFF + '\n'
          t += ESCPOS_ALIGN_LEFT
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
            t += escposWrapText(msgSocio, W)  // sin 'center': impresora ya centra
          } else {
            t += ESCPOS_BOLD_ON + '* UNITE AL EXTRA CLUB *' + ESCPOS_BOLD_OFF + '\n'
            t += escposWrapText(msgInvitacion, W)  // sin 'center'
            if (tpl.mostrar_qr_club && tpl.qr_url_club) {
              t += escposQr(tpl.qr_url_club) + '\n'
            }
          }
          t += ESCPOS_ALIGN_LEFT
        }

        if (showMarketing && tpl.mensaje_marketing) {
          t += ESCPOS_ALIGN_CENTER + ESCPOS_BOLD_ON + escposWrapText(tpl.mensaje_marketing, W) + ESCPOS_BOLD_OFF + ESCPOS_ALIGN_LEFT
        }

        if (donacionActiva && montoDonacionEfectiva > 0) {
          t += escposDashes(W) + '\n'
          t += ESCPOS_ALIGN_CENTER
          t += ESCPOS_BOLD_ON + escposStripAccents(tpl.donacion_titulo || '* ABRE TU CORAZON *') + ESCPOS_BOLD_OFF + '\n'
          const donMsg = tpl.donacion_mensaje || `Gracias por colaborar con ${fmtGs(montoDonacionEfectiva)} para el Centro Amor y Esperanza.`
          t += escposWrapText(donMsg, W)  // sin 'center': impresora ya centra
          t += 'Conoce mas en:\n'
          t += ESCPOS_BOLD_ON + escposStripAccents(tpl.donacion_web || 'www.centroamoresperanza.org') + ESCPOS_BOLD_OFF + '\n'
          t += ESCPOS_ALIGN_LEFT
        }

        if (showCupon) {
          t += ESCPOS_ALIGN_CENTER
          t += 'CUPON DE RECOMPRA\n'
          t += ESCPOS_BOLD_ON + ESCPOS_DOUBLE_ON + cuponCod + ESCPOS_DOUBLE_OFF + ESCPOS_BOLD_OFF + '\n'
          t += escposWrapText(cuponDesc, W)  // sin 'center'
          t += `Valido por ${cuponDias} dias\n`
          t += ESCPOS_ALIGN_LEFT
        }

        t += ESCPOS_ALIGN_CENTER
        if (showQrSifen) t += `Consulte en: ${sifenUrl}\n`
        t += ESCPOS_BOLD_ON + escposWrapText(msgDespedida, W) + ESCPOS_BOLD_OFF  // sin 'center'
        t += '\n'.repeat(Math.max(8, feedLinesCount))
        // Corte automatico (GS V 1 = corte parcial).
        if (tpl.corte_automatico !== false) t += GS + 'V' + '\x01'

        // Guardar el ticket ESC/POS tal cual se imprimió
        const escposB64ForStorage = escposToBase64(t)
        if (createdSaleId) {
          api.sales.attachTicket(createdSaleId, escposB64ForStorage).catch((e) => console.error("No se pudo guardar el ticket para reimprimir:", e))
        } else if (saleCreatePromise) {
          saleCreatePromise.then((created) => {
            if (created?.id) api.sales.attachTicket(created.id, escposB64ForStorage).catch((e) => console.error("No se pudo guardar el ticket para reimprimir:", e))
          })
        }

        let printedInvoice = false
        const executePrintInvoice = async () => {
          if (printedInvoice) return
          printedInvoice = true
          try {
            const result = await (window as any).electronAPI.printEscPos(escposB64ForStorage, tpl.nombre_impresora_windows || 'ZKP8008')
            if (!result?.success) {
              console.error('Error imprimiendo ESC/POS:', result?.error)
              toast.error('No se pudo imprimir el ticket', result?.error || 'Revise la impresora.')
            }
          } catch (printErr) {
            console.error('Error imprimiendo ESC/POS:', printErr)
          }
        }

        // ── EVALUACIÓN MULTI-CAMPAÑA DE SORTEOS Y CUPONES ──────────────────
        let calificaCupones = false
        try {
          const itemsEvaluacion = cart.map(item => ({
            producto_id: item.product_id,
            sku: item.sku,
            nombre: item.nombre,
            cantidad: item.quantity,
            precio_unitario: item.precio,
            total: item.precio * item.quantity,
            codigo_barra: item.codigo_barra
          }))

          const evalRes = await api.cupones.evaluarCarrito({
            total_monto: totalPyg,
            items: itemsEvaluacion
          })

          if (evalRes && evalRes.total_cupones > 0 && evalRes.campanas_calificadas?.length > 0) {
            calificaCupones = true
            let initialTelCod: "595" | "55" = "595"
            let initialTelNum = customer?.telefono || ""
            if (initialTelNum.startsWith("55")) {
              initialTelCod = "55"
              initialTelNum = initialTelNum.slice(2)
            } else if (initialTelNum.startsWith("595")) {
              initialTelCod = "595"
              initialTelNum = initialTelNum.slice(3)
            }

            setPendingCuponData({
              saleNumero: numeroComprobante,
              montoCompra: totalPyg,
              totalCupones: evalRes.total_cupones,
              campanasCalificadas: evalRes.campanas_calificadas,
              doc: customer?.ci || customer?.ruc || "",
              nombre: (customer?.nombre && customer?.nombre !== "Consumidor Final") ? customer.nombre : "",
              telCodigo: initialTelCod,
              telefono: initialTelNum,
              barrio: (customer as any)?.barrio || "Centro",
              ciudad: (customer as any)?.ciudad || "Pedro Juan Caballero",
              items: itemsEvaluacion,
              printInvoiceCallback: executePrintInvoice
            })
            setCuponModalStep("pregunta")
            setShowCuponModal(true)
          }
        } catch (e) {
          console.warn("Error evaluando cupones:", e)
        }

        // Si no califica para sorteo, se imprime la factura de inmediato
        if (!calificaCupones) {
          await executePrintInvoice()
        }
      } else if ((window as any).electronAPI?.printReceipt) {
        await (window as any).electronAPI.printReceipt(receiptHtml, paperWidthMm)
      }

      setShowPaymentModal(false)
      setCart([])
      setCustomer(DEFAULT_CUSTOMER)
      toast.success(
        "¡Cobro Exitoso!",
        `Comprobante ${numeroComprobante} emitido. Vuelto: ${formatPYG(vueltoFinalPyg)}` +
        (donacionActiva && montoDonacionEfectiva > 0 ? ` (Donación: ${formatPYG(montoDonacionEfectiva)})` : "") +
        (puntosEstimados > 0 ? ` -- Sumó ${puntosEstimados} puntos de fidelidad.` : "")
      )
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
        // Si el modal de cobro ya esta abierto, un F12 de mas (reflejo
        // comun justo despues de abrirlo) no debe reiniciar handleOpenPayment
        // -- eso borraba en silencio los montos que el cajero ya habia
        // cargado en un pago dividido. Con el modal abierto, F12 no hace
        // nada aca (el boton de Confirmar Cobro ya tiene su propio F12).
        if (cart.length > 0 && !showPaymentModal) handleOpenPayment()
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
        // Mismo motivo que F12 arriba: con el modal de cobro abierto, F6
        // pausaba la venta (vaciando el carrito) sin cerrar el modal, que
        // se quedaba mostrando un cobro de una venta que ya no estaba en
        // curso.
        if (cart.length > 0 && !showPaymentModal) pauseCurrentSale()
      } else if (e.key === "F7") {
        e.preventDefault()
        if (pausedSales.length > 0) setShowPausedModal(true)
      } else if (e.key === "F8") {
        e.preventDefault()
        if (showPaymentModal) handleToggleDonacion(!donacionActiva)
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
  }, [cart, totalPyg, pausedSales.length, showAperturaModal, showCierreTurnoModal, showManualWeightModal, showScaleModal, showSupervisorModal, showPosConfigModal, showPaymentModal, manualWeightInput, targetWeighProduct])

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
      
      {/* ── 1. HEADER EN DOS FILAS -- antes todo (identidad, balanza,
          cotizaciones, 10 botones de accion) se apretaba en una sola fila
          de 48px, desbordando en cualquier ventana no maximizada. Fila de
          arriba: identidad y estado (informativo). Fila de abajo: acciones
          agrupadas por funcion, con scroll horizontal como ultimo recurso
          en vez de un salto de linea desprolijo. ── */}
      <header className={`shrink-0 border-b shadow-sm z-20 ${bgPanel}`}>
        {/* Fila 1: identidad (logo real + avatar + cerrar sesion), a la
            izquierda -- balanza/cotizaciones/tema a la derecha. */}
        <div className="h-11 px-3 flex items-center justify-between gap-2 border-b border-black/5 dark:border-white/5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-black/5 dark:border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
              {headerLogoUrl ? (
                <img src={headerLogoUrl} alt="Logo" className="w-full h-full object-contain p-0.5" />
              ) : (
                <span className="text-white bg-emerald-600 w-full h-full flex items-center justify-center font-black text-[10px]">EM</span>
              )}
            </div>

            <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 border border-black/5 dark:border-white/10 flex items-center justify-center overflow-hidden shrink-0">
              {user?.foto_url ? (
                <img src={user.foto_url} alt={user?.nombre || "Cajero"} className="w-full h-full object-cover" />
              ) : (
                <User className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 leading-none">
                <span className={`font-black text-xs tracking-tight ${textHeading}`}>{user?.nombre || "Cajero"}</span>
                {isSupervisorUser && <span className="text-[9px] bg-purple-500/20 text-purple-600 font-bold px-1 rounded shrink-0">SUPERVISOR</span>}
              </div>
              <div className={`text-[10px] font-posMono tabular-nums leading-none mt-0.5 ${textMuted}`}>
                {terminalAssignment?.caja_nombre || PUNTOS_EMISION.find(p => p.id === puntoEmision)?.nombre.split('·')[0] || puntoEmision}
              </div>
            </div>

            <button
              onClick={() => { api.auth.endPosShift().catch(() => {}); logout() }}
              title="Cerrar Sesión"
              className={`flex items-center justify-center w-7 h-7 rounded-lg border text-xs font-bold transition-colors cursor-pointer shrink-0 ml-1 ${
                dark ? "bg-slate-800 text-rose-400 border-slate-700 hover:bg-rose-900/40" : "bg-slate-200 text-rose-600 border-slate-300 hover:bg-rose-100"
              }`}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Widget Balanza USB Balmak BCK30 */}
            <div
              onClick={() => setShowScaleModal(true)}
              title="Balanza Checkout Balmak BCK30. Haga clic para configurar o presione F3."
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border cursor-pointer transition-all ${
                scaleUsbConnected
                  ? isScaleStable
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/40"
                    : "bg-amber-500/15 text-amber-600 border-amber-500/50 animate-pulse"
                  : "bg-amber-500/10 text-amber-600 border-amber-500/40 hover:bg-amber-500/20"
              }`}
            >
              <Scale className={`w-3.5 h-3.5 ${scaleUsbConnected ? (isScaleStable ? "text-emerald-500" : "text-amber-500") : "text-amber-500"}`} />
              <span className="text-xs font-posMono tabular-nums font-black">
                {scaleUsbConnected ? `${currentScaleWeight.toFixed(3)} KG` : "F3"}
              </span>
            </div>

            {/* Cotizaciones -- sin candado: el titulo ya explica si es
                editable o solo lectura, el icono no sumaba nada. */}
            <div
              onClick={() => setShowRatesModal(true)}
              title={isSupervisorUser ? "Editar Cotizaciones (Gerente/Admin)" : "Cotizaciones fijadas por Administración (Solo Lectura)"}
              className={`flex items-center gap-2 text-xs font-posMono tabular-nums font-bold px-2.5 py-1 rounded-lg border cursor-pointer transition-colors ${
                isSupervisorUser ? "hover:border-blue-500 bg-slate-800/10" : "opacity-90"
              } ${borderTone}`}
            >
              <span className="text-amber-600 font-extrabold flex items-center gap-1">
                <FlagBR /> {rates.BRL.toLocaleString("es-PY")}
              </span>
              <span className={textMuted}>|</span>
              <span className="text-blue-600 font-extrabold flex items-center gap-1">
                <FlagUS /> {rates.USD.toLocaleString("es-PY")}
              </span>
            </div>

            <button
              onClick={toggleTheme}
              title={dark ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro"}
              className={`flex items-center justify-center w-7 h-7 rounded-lg transition-all border cursor-pointer ${
                dark
                  ? "bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-300"
              }`}
            >
              {dark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Fila 2: barra de acciones, agrupada por funcion */}
        <div className="h-10 px-3 flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => requestSupervisorAuthorization({ type: "open_pos_config" })}
            title="Configurar y Asignar Terminales POS Bancard & Dinelco a esta caja (Requiere Supervisor)"
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-bold transition-all cursor-pointer shrink-0 ${
              dark ? "bg-slate-800 text-blue-400 border-slate-700 hover:bg-slate-700" : "bg-slate-200 text-blue-700 border-slate-300 hover:bg-slate-300"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="text-[10px] hidden md:inline">POS {activePosConfig.bancardTerminalId.split('-')[1]}</span>
          </button>

          <span className={`w-px h-5 shrink-0 ${borderTone} border-l`} />

          <button
            onClick={handleOpenCalculator}
            title="Abrir Calculadora de Windows"
            className={`p-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer shrink-0 ${
              dark ? "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700" : "bg-slate-200 text-slate-800 border-slate-300 hover:bg-slate-300"
            }`}
          >
            <Calculator className="w-4 h-4" />
          </button>

          <button
            onClick={openReimprimirModal}
            title="Reimprimir Comprobante de una Venta Anterior"
            className={`p-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer shrink-0 ${
              dark ? "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700" : "bg-slate-200 text-slate-800 border-slate-300 hover:bg-slate-300"
            }`}
          >
            <Printer className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowPriceCheckModal(true)}
            title="Consulta de Productos (precio, stock y promoción)"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600/10 text-emerald-600 border border-emerald-500/30 hover:bg-emerald-600/20 cursor-pointer shrink-0"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="text-[11px] hidden sm:inline">Productos</span>
          </button>

          <button
            onClick={() => setShowLostDemandModal(true)}
            title="Registrar Producto que el Cliente No Encontró (F4)"
            className="p-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer bg-amber-500/10 text-amber-600 border-amber-500/40 hover:bg-amber-500/20 shrink-0"
          >
            <Package className="w-4 h-4" />
          </button>

          <span className={`w-px h-5 shrink-0 ${borderTone} border-l`} />

          <button
            onClick={openDevolucionModal}
            title="Registrar Devolución de un Cliente (requiere autorización de Supervisor)"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-rose-600/10 text-rose-500 border border-rose-500/30 hover:bg-rose-600/20 cursor-pointer shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="text-[11px] hidden sm:inline">Devolución</span>
          </button>

          <button
            onClick={() => {
              // Sugerir el monto a retirar usando el umbral configurado como
              // referencia -- solo cuando ya se supero o esta cerca del
              // umbral, para no sugerir un retiro que deje la caja sin
              // sencillo apenas arranca el turno.
              if (cashDropStatus?.cash_drop_threshold && (cashDropStatus.cash_drop_alert || cashDropStatus.cash_drop_warning)) {
                setCashDropMonto(Math.round(cashDropStatus.cash_drop_threshold).toLocaleString("es-PY"))
              }
              setShowCashDropModal(true)
            }}
            title={cashDropStatus?.cash_drop_alert ? "Superó el umbral de retiro -- haga un retiro" : cashDropStatus?.cash_drop_warning ? "Se acerca al umbral de retiro" : "Registrar Retiro de Efectivo de la Caja"}
            className={`relative flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border cursor-pointer transition-colors shrink-0 ${
              cashDropStatus?.cash_drop_alert
                ? "bg-rose-600/15 text-rose-600 border-rose-500/50 animate-pulse"
                : cashDropStatus?.cash_drop_warning
                ? "bg-amber-500/15 text-amber-600 border-amber-500/50"
                : "bg-orange-600/10 text-orange-600 border-orange-500/30 hover:bg-orange-600/20"
            }`}
          >
            <Banknote className="w-3.5 h-3.5" />
            <span className="text-[11px] hidden sm:inline">Retiro</span>
            {(cashDropStatus?.cash_drop_alert || cashDropStatus?.cash_drop_warning) && (
              <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 ${cashDropStatus?.cash_drop_alert ? "bg-rose-500" : "bg-amber-500"}`} />
            )}
          </button>

          <button
            onClick={() => { setShowExtraClubBalanceModal(true); setBalanceModalQuery(""); setBalanceModalResults([]); setBalanceModalSelected(null) }}
            title="Consultar saldo de línea de crédito Extra Club"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-purple-600/10 text-purple-600 border border-purple-500/30 hover:bg-purple-600/20 cursor-pointer shrink-0"
          >
            <Star className="w-3.5 h-3.5" />
            <span className="text-[11px] hidden sm:inline">Extra Club</span>
          </button>

          <span className={`w-px h-5 shrink-0 ${borderTone} border-l`} />

          <button
            onClick={() => { setPausaMotivo("Salida a almuerzo / relevo de gaveta"); setShowPausaTurnoModal(true) }}
            title="Pausar Turno (Relevo / Salida a Almuerzo con gaveta extraíble)"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 cursor-pointer shrink-0"
          >
            <Pause className="w-3.5 h-3.5" />
            <span className="text-[11px] hidden sm:inline">Pausar</span>
          </button>

          <button
            onClick={handleOpenCierreModal}
            title="Cierre de Turno y Arqueo"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-600/10 text-amber-600 border border-amber-500/30 hover:bg-amber-600/20 cursor-pointer shrink-0"
          >
            <Lock className="w-3.5 h-3.5" />
            <span className="text-[11px] hidden sm:inline">Cierre</span>
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
                <div className="flex items-center gap-1.5 truncate">
                  <div className={`font-bold text-xs truncate ${textHeading}`}>
                    {customer.nombre}
                  </div>
                  {((customer as any).extra_club_numero || (customer as any).extra_club_activo) && (
                    <span className="px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-600 dark:text-purple-300 text-[9px] font-black uppercase tracking-wider shrink-0 border border-purple-500/30 flex items-center gap-0.5">
                      <Star className="w-2.5 h-2.5 fill-purple-500" /> Extra Club
                    </span>
                  )}
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
                              onClick={() => updateQuantity(item.id, item.es_pesable ? -0.1 : -1)}
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
                              onClick={() => updateQuantity(item.id, item.es_pesable ? 0.1 : 1)}
                              className={`w-5 h-5 rounded flex items-center justify-center font-bold text-xs cursor-pointer ${
                                dark ? "bg-slate-800 hover:bg-slate-700 text-slate-200" : "bg-slate-200 hover:bg-slate-300 text-slate-800"
                              }`}
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          <div className={`font-bold text-xs ${textHeading} flex items-start gap-1`}>
                            {((item as any).en_promocion || (item.precio_base && item.precio < item.precio_base)) && (
                              <span className="inline-flex items-center gap-0.5 bg-gradient-to-r from-red-600 to-amber-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded shrink-0 animate-pulse shadow-xs mt-0.5">
                                🔥 PROMO
                              </span>
                            )}
                            <span className="leading-tight">{item.nombre}</span>
                          </div>
                          <div className={`text-[10px] font-posMono tabular-nums flex items-center gap-1.5 ${textMuted}`}>
                            <span>SKU: {item.sku}</span>
                            {item.es_pesable && (
                              <span className="text-[9px] bg-emerald-500/20 text-emerald-600 font-extrabold px-1 rounded">
                                ⚖️ Balanza ({item.quantity.toFixed(3)} KG)
                              </span>
                            )}
                            {item.precio_base && item.precio < item.precio_base && (
                              <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-black">
                                Ahorras {formatPYG((item.precio_base - item.precio) * item.quantity)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className={`py-2 px-2 text-right font-posMono tabular-nums ${textBody}`}>
                          {item.precio_base && item.precio < item.precio_base ? (
                            <div className="flex flex-col items-end">
                              <span className="line-through text-[10px] text-slate-400 font-normal">{formatPYG(item.precio_base)}</span>
                              <span className="font-black text-red-600 dark:text-red-400 text-xs">{formatPYG(item.precio)}</span>
                            </div>
                          ) : (
                            <span className="font-semibold">{formatPYG(item.precio)}</span>
                          )}
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
            {/* Banner Destacado y Animado de Ahorro */}
            {totalAhorroPyg > 0 && (
              <div className="bg-gradient-to-r from-amber-500/20 via-emerald-500/20 to-amber-500/20 border-2 border-amber-500/50 rounded-xl px-3 py-2 flex items-center justify-between shadow-xs animate-pulse">
                <div className="flex items-center gap-2">
                  <span className="text-lg animate-bounce">🎉</span>
                  <div>
                    <div className="text-[11px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wide leading-tight">
                      ¡TU EXTRA AHORRO HOY!
                    </div>
                    <div className="text-[9px] text-slate-500 dark:text-slate-400 font-medium">
                      Descuentos y ofertas aplicadas en tu compra
                    </div>
                  </div>
                </div>
                <div className="text-right font-posMono tabular-nums font-black text-base text-emerald-600 dark:text-emerald-400">
                  -{formatPYG(totalAhorroPyg)}
                </div>
              </div>
            )}

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
                <div className={`font-black text-sm lg:text-base leading-tight mt-0.5 ${textHeading}`}>
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
                  placeholder="Escanear o buscar (F2) -- ej: 3*codigo para cantidad"
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
                      const pBase = Number(p.precio_venta) || 0
                      const isPromo = Boolean((p as any).en_promocion && (p as any).precio_promo)
                      const pPromo = isPromo ? Number((p as any).precio_promo) : null
                      const pEffective = isPromo && pPromo ? pPromo : pBase
                      const pMayor = Math.round(pEffective * 0.93)
                      const isPesable = isPesableProduct(p)
                      const ahorroUnit = isPromo && pPromo ? Math.max(0, pBase - pPromo) : 0

                      return (
                        <tr
                          key={p.id}
                          onClick={() => addToCart(p)}
                          className={`group cursor-pointer transition-colors ${
                            isPromo
                              ? (dark ? "bg-red-950/20 hover:bg-red-900/30" : "bg-red-50/40 hover:bg-red-100/60")
                              : (dark ? "hover:bg-blue-600/10" : "hover:bg-blue-50")
                          }`}
                        >
                          <td className="py-2 px-2">
                            <div className={`font-bold text-xs group-hover:text-blue-600 ${textHeading} flex items-start gap-1`}>
                              {isPromo && (
                                <span className="inline-flex items-center gap-0.5 bg-gradient-to-r from-red-600 to-amber-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded shrink-0 animate-pulse shadow-xs mt-0.5">
                                  🔥 OFERTA
                                </span>
                              )}
                              <span className="leading-tight">{p.nombre}</span>
                            </div>
                            <div className={`text-[10px] font-posMono tabular-nums flex items-center gap-1.5 ${textMuted}`}>
                              <span>SKU: {p.sku}</span>
                              {isPesable && (
                                <span className="text-[9px] bg-emerald-500/20 text-emerald-600 font-extrabold px-1 rounded">
                                  ⚖️ KG
                                </span>
                              )}
                              {ahorroUnit > 0 && (
                                <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-extrabold">
                                  (Ahorras {formatPYG(ahorroUnit)})
                                </span>
                              )}
                            </div>
                          </td>
                          <td className={`py-2 px-2 text-center font-posMono tabular-nums font-bold ${textBody}`}>
                            {stockMap[p.id] ?? 0} UN
                          </td>
                          <td className="py-2 px-2 text-right font-posMono tabular-nums">
                            {isPromo && pPromo ? (
                              <div className="flex flex-col items-end">
                                <span className="line-through text-[10px] text-slate-400 font-normal">{formatPYG(pBase)}</span>
                                <span className="font-black text-red-600 dark:text-red-400 text-xs">{formatPYG(pPromo)}</span>
                              </div>
                            ) : (
                              <span className="font-black text-emerald-600 text-xs">{formatPYG(pBase)}</span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right font-posMono tabular-nums font-bold text-amber-600 text-xs">
                            {formatPYG(pMayor)}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                addToCart(p)
                              }}
                              className={`px-2.5 py-1 ${isPromo ? 'bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500' : 'bg-blue-600 hover:bg-blue-500'} text-white rounded-lg text-[11px] font-bold shadow-xs cursor-pointer active:scale-95`}
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
                    const pBase = Number(p.precio_venta) || 0
                    const isPromo = Boolean((p as any).en_promocion && (p as any).precio_promo)
                    const pPromo = isPromo ? Number((p as any).precio_promo) : null
                    const pEffective = isPromo && pPromo ? pPromo : pBase
                    const pMayor = Math.round(pEffective * 0.93)
                    const isPesable = isPesableProduct(p)
                    const ahorroUnit = isPromo && pPromo ? Math.max(0, pBase - pPromo) : 0

                    return (
                      <button
                        key={p.id}
                        onClick={() => addToCart(p)}
                        className={`border rounded-xl p-2 text-left flex flex-col justify-between transition-all group active:scale-98 cursor-pointer ${
                          isPromo
                            ? (dark ? "bg-red-950/30 hover:bg-red-900/40 border-red-800/60 hover:border-red-500" : "bg-red-50/60 hover:bg-red-100/80 border-red-300 hover:border-red-500 shadow-xs")
                            : (dark ? "bg-slate-950/80 hover:bg-slate-800/80 border-slate-800 hover:border-blue-500/50" : "bg-white hover:bg-blue-50/50 border-slate-300 hover:border-blue-500 shadow-xs")
                        }`}
                      >
                        <div className={`w-full h-20 rounded-lg overflow-hidden mb-1 flex items-center justify-center border relative ${bgInner}`}>
                          {isPromo && (
                            <span className="absolute top-1 left-1 bg-gradient-to-r from-red-600 to-amber-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-xs z-10 animate-pulse">
                              🔥 OFERTA
                            </span>
                          )}
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
                            <span className="absolute top-1 right-1 bg-emerald-600 text-white text-[8px] font-black px-1 rounded z-10">
                              KG
                            </span>
                          )}
                        </div>
                        <div>
                          <div className={`font-bold text-xs leading-tight group-hover:text-blue-600 transition-colors ${textHeading}`}>
                            {p.nombre}
                          </div>
                          <div className="flex items-center justify-between mt-1 font-posMono tabular-nums">
                            {isPromo && pPromo ? (
                              <div className="flex items-baseline gap-1">
                                <span className="line-through text-[10px] text-slate-400 font-normal">{formatPYG(pBase)}</span>
                                <span className="font-black text-xs text-red-600 dark:text-red-400">{formatPYG(pPromo)}</span>
                              </div>
                            ) : (
                              <span className="font-black text-xs text-emerald-600">
                                {formatPYG(pBase)}
                              </span>
                            )}
                            <span className="font-bold text-[10px] text-amber-600">
                              M: {formatPYG(pMayor)}
                            </span>
                          </div>
                          {ahorroUnit > 0 && (
                            <div className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 font-posMono mt-0.5">
                              Ahorras {formatPYG(ahorroUnit)}
                            </div>
                          )}
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
      {weightPendingScale && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-amber-400 dark:border-amber-600">
            <div className="flex items-center gap-3 mb-3">
              <Scale className="w-6 h-6 text-amber-500 animate-pulse" />
              <div>
                <h3 className="font-black text-sm text-slate-900 dark:text-white">Verificación de peso pendiente</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{weightPendingScale.product.nombre}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Etiqueta PLU</span>
                <span className="text-xl font-black font-posMono text-slate-900 dark:text-white">{weightPendingScale.etiquetaKg.toFixed(3)} KG</span>
              </div>
              <div className={`p-3 rounded-xl border text-center transition-colors ${
                Math.abs(currentScaleWeight - weightPendingScale.etiquetaKg) <= getPesoTolerancia(weightPendingScale.etiquetaKg) && currentScaleWeight > 0.015
                  ? "bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-black"
                  : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-black"
              }`}>
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Balanza de Caja</span>
                <span className="text-xl font-posMono">{currentScaleWeight.toFixed(3)} KG</span>
              </div>
            </div>
            <div className="text-center mb-4">
              <span className={`text-[11px] font-bold px-3 py-1 rounded-full ${
                currentScaleWeight <= 0.015
                  ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                  : Math.abs(currentScaleWeight - weightPendingScale.etiquetaKg) <= getPesoTolerancia(weightPendingScale.etiquetaKg)
                  ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-black animate-pulse"
                  : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
              }`}>
                {currentScaleWeight <= 0.015
                  ? "Coloque el producto en la balanza..."
                  : Math.abs(currentScaleWeight - weightPendingScale.etiquetaKg) <= getPesoTolerancia(weightPendingScale.etiquetaKg)
                  ? "✓ Peso verificado -- agregando..."
                  : "Asentando lectura de balanza..."}
              </span>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => requestSupervisorAuthorization({ type: "use_label_weight", weightProduct: weightPendingScale.product, weightEtiquetaKg: weightPendingScale.etiquetaKg })}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" /> Balanza no disponible -- usar etiqueta (requiere supervisor)
              </button>
              <button
                onClick={() => { setWeightPendingScale(null); searchInputRef.current?.focus() }}
                className="w-full py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {weightMismatch && (
        <div className="fixed inset-0 z-[120] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border-2 border-rose-500 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-900 dark:text-slate-100 animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center text-white shrink-0 shadow-sm shadow-rose-500/30">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white font-posDisplay tracking-tight">Diferencia de peso detectada</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">{weightMismatch.product.nombre}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-center">
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Etiqueta</div>
                <div className="text-xl font-black font-posMono tabular-nums text-slate-900 dark:text-white">{weightMismatch.etiquetaKg.toFixed(3)} KG</div>
              </div>
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-300 dark:border-rose-500/30 text-center">
                <div className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase">Balanza (ahora)</div>
                <div className="text-xl font-black font-posMono tabular-nums text-rose-600 dark:text-rose-400">{weightMismatch.balanzaKg.toFixed(3)} KG</div>
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 text-center">
              Lo que dice la etiqueta no coincide con lo que hay ahora en la balanza (diferencia de {(Math.abs(weightMismatch.etiquetaKg - weightMismatch.balanzaKg) * 1000).toFixed(0)} g). Puede ser que el contenido de la bolsa haya cambiado desde que se etiquetó.
            </p>

            <div className="space-y-2">
              <button
                onClick={() => {
                  api.inteliaudit.recordEvent({
                    company_id: COMPANY_ID,
                    user_id: user?.id,
                    accion: "peso_resuelto_balanza",
                    entidad: "producto_pesable",
                    entidad_id: weightMismatch.product.id,
                    datos_nuevos: {
                      producto_nombre: weightMismatch.product.nombre,
                      etiqueta_kg: weightMismatch.etiquetaKg,
                      balanza_kg: weightMismatch.balanzaKg,
                      diferencia_g: Math.round(Math.abs(weightMismatch.etiquetaKg - weightMismatch.balanzaKg) * 1000),
                      caja: puntoEmision,
                      cajero: user?.nombre,
                    },
                  } as any).catch(() => {})
                  addToCart(weightMismatch.product, weightMismatch.balanzaKg, "balmak_bck30")
                  setWeightMismatch(null)
                  searchInputRef.current?.focus()
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Scale className="w-4 h-4" /> Usar peso de balanza ({weightMismatch.balanzaKg.toFixed(3)} KG)
              </button>
              <button
                onClick={() => requestSupervisorAuthorization({ type: "use_label_weight", weightProduct: weightMismatch.product, weightEtiquetaKg: weightMismatch.etiquetaKg, weightBalanzaKg: weightMismatch.balanzaKg })}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" /> Usar peso de etiqueta (requiere supervisor)
              </button>
              <button
                onClick={() => {
                  api.inteliaudit.recordEvent({
                    company_id: COMPANY_ID,
                    user_id: user?.id,
                    accion: "peso_discrepancia_cancelada",
                    entidad: "producto_pesable",
                    entidad_id: weightMismatch.product.id,
                    datos_nuevos: {
                      producto_nombre: weightMismatch.product.nombre,
                      etiqueta_kg: weightMismatch.etiquetaKg,
                      balanza_kg: weightMismatch.balanzaKg,
                      caja: puntoEmision,
                      cajero: user?.nombre,
                    },
                  } as any).catch(() => {})
                  setWeightMismatch(null)
                  searchInputRef.current?.focus()
                }}
                className="w-full py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                Cancelar -- volver a pesar
              </button>
            </div>
          </div>
        </div>
      )}

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
                    bancardIp: "",
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
                            <div className="col-span-2">
                              <label className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">IP del Terminal (red local, API POS Android):</label>
                              <input
                                type="text"
                                value={cfg.bancardIp || ""}
                                onChange={(e) => {
                                  const val = e.target.value
                                  setPosAssignments(prev => ({
                                    ...prev,
                                    [pe.id]: { ...cfg, bancardIp: val }
                                  }))
                                }}
                                placeholder="Ej: 192.168.0.32"
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 font-posMono tabular-nums text-xs text-emerald-600 dark:text-emerald-400 font-bold outline-none"
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

            <button
              onClick={async () => {
                if (remoteAuthRequestId && user?.id) {
                  try {
                    await api.supervisorRequests.resolve(remoteAuthRequestId, { aprobado: false, resuelto_por: user.id, resuelto_por_nombre: "Resuelto localmente en caja" })
                  } catch {
                    // Si falla el aviso remoto, igual abrimos el modal local --
                    // el pedido puede quedar colgado en la PWA de la supervisora
                    // pero no bloqueamos a la cajera que ya tiene a la supervisora
                    // parada al lado con la clave en la mano.
                  }
                }
                setShowRemoteAuthModal(false)
                setRemoteAuthRequestId(null)
                setSupervisorPin("")
                setSupervisorEmail("")
                setShowSupervisorModal(true)
              }}
              className="w-full py-3 rounded-xl bg-brand-orange hover:brightness-95 text-[#1C1710] font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-orange-500/30 cursor-pointer mb-2"
            >
              <KeyRound className="w-4 h-4" /> Tengo un supervisor acá — ingresar clave
            </button>
            <button
              onClick={async () => {
                if (remoteAuthRequestId && user?.id) {
                  try {
                    await api.supervisorRequests.resolve(remoteAuthRequestId, { aprobado: false, resuelto_por: user.id, resuelto_por_nombre: "Cancelado por el cajero" })
                  } catch (e: any) {
                    // No cerramos el modal si esto falla -- si lo cerramos igual,
                    // el pedido queda pendiente en el servidor pero el cajero cree
                    // que lo canceló, y la supervisora sigue viéndolo colgado sin
                    // que nadie sepa que pasó.
                    toast.error("No se pudo cancelar la solicitud", e?.message || "Sigue pendiente para el supervisor. Intente de nuevo.")
                    return
                  }
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
        <div className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
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
                    : pendingSupervisorAction?.type === "direct_discount"
                    ? `🏷️ Descuento Directo: ${pendingSupervisorAction.discountType === "percentage" ? `${pendingSupervisorAction.discountValue}%` : `₲ ${Number(pendingSupervisorAction.discountValue || 0).toLocaleString("es-PY")}`}`
                    : pendingSupervisorAction?.type === "open_pos_config"
                    ? "⚙️ Configuración y Asignación de Terminales POS"
                    : pendingSupervisorAction?.type === "process_return"
                    ? "↩️ Devolución de Cliente (afecta stock y caja)"
                    : "🗑️ Eliminación / Disminución de Producto del Carrito"}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">
                  Motivo de Autorización {pendingSupervisorAction?.type === "direct_discount" ? <span className="text-rose-500 font-black">*(OBLIGATORIO)</span> : ":"}:
                </label>
                {pendingSupervisorAction?.type === "direct_discount" ? (
                  <div>
                    <input
                      type="text"
                      value={supervisorReason}
                      onChange={(e) => setSupervisorReason(e.target.value)}
                      placeholder="Escriba el motivo del descuento (mín. 5 letras)..."
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white font-bold outline-none focus:border-rose-500"
                    />
                    <div className="flex gap-1.5 mt-1.5 flex-wrap">
                      {["Atención al cliente", "Mercadería con detalle", "Convenio especial", "Aprobación de gerencia"].map((sug) => (
                        <button
                          key={sug}
                          type="button"
                          onClick={() => setSupervisorReason(sug)}
                          className="text-[9px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
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
                )}
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
                    <div className="flex items-center justify-between mb-2 shrink-0">
                      <div className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        Ítems a devolver:
                      </div>
                      {devolucionItems.some((it) => (it.cantidad_disponible ?? it.cantidad) > 0) && (
                        <button
                          type="button"
                          onClick={() => {
                            const next: Record<string, number> = {}
                            devolucionItems.forEach((it) => {
                              const disp = it.cantidad_disponible ?? it.cantidad
                              if (disp > 0) next[it.id] = disp
                            })
                            setDevolucionSeleccion(next)
                          }}
                          className="text-[10px] font-black uppercase tracking-wide text-rose-600 dark:text-rose-400 cursor-pointer"
                        >
                          Devolver factura completa
                        </button>
                      )}
                    </div>
                    <div className="space-y-1.5 mb-3">
                      {devolucionItems.map((it) => {
                        const checked = !!devolucionSeleccion[it.id]
                        const disponible = it.cantidad_disponible ?? it.cantidad
                        const yaDevuelto = it.cantidad_devuelta ?? 0
                        const agotado = disponible <= 0
                        return (
                          <div
                            key={it.id}
                            className={`flex items-center gap-3 rounded-lg px-3 py-2 border ${agotado ? "opacity-50 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800" : checked ? "bg-rose-50 dark:bg-rose-500/10 border-rose-500/40" : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={agotado}
                              onChange={() => toggleDevolucionItem(it.id, disponible)}
                              className="w-4 h-4 accent-rose-500 cursor-pointer disabled:cursor-not-allowed"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-xs text-slate-900 dark:text-white truncate">{it.productName}</div>
                              <div className="text-[10px] font-posMono tabular-nums text-slate-500 dark:text-slate-400">
                                Vendido: {it.cantidad} x {formatPYG(it.precio_unitario)}
                                {yaDevuelto > 0 && (
                                  <span className="text-amber-600 dark:text-amber-400"> · Ya devuelto: {yaDevuelto}</span>
                                )}
                              </div>
                              {agotado && (
                                <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400">Sin cantidad disponible para devolver</div>
                              )}
                            </div>
                            {checked && !agotado && (
                              <input
                                type="number"
                                min={0}
                                max={disponible}
                                step={1}
                                value={devolucionSeleccion[it.id]}
                                onChange={(e) => setDevolucionCantidad(it.id, Number(e.target.value), disponible)}
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
        <div className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-5xl w-full shadow-2xl text-slate-900 dark:text-slate-100 overflow-hidden flex flex-col">
            
            {/* 1. HEADER BAR */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-slate-950 shrink-0 shadow-sm font-black text-base">
                  ₲
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black text-slate-900 dark:text-white font-posDisplay tracking-tight">
                      Liquidación y Cobro
                    </h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono">
                      Caja Activa
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Seleccione medio de pago o ingrese el monto recibido.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
                title="Cerrar [ESC]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 2. BODY SPLIT (2 COLUMNS) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
              
              {/* ── COLUMNA IZQUIERDA: RESUMEN FINANCIERO Y VUELTO (5 COLS) ── */}
              <div className="lg:col-span-5 p-4 bg-slate-50/60 dark:bg-slate-950/40 space-y-2.5">
                {/* Hero Total Venta */}
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <span>Total a Cobrar</span>
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-mono">
                      {cart.length} {cart.length === 1 ? "ítem" : "ítems"}
                    </span>
                  </div>
                  <div className="text-3xl font-black font-posMono tabular-nums text-slate-950 dark:text-white tracking-tight">
                    {formatPYG(totalPyg)}
                  </div>
                  <div className="flex items-center gap-2.5 pt-1.5 border-t border-slate-100 dark:border-slate-800 text-sm font-posMono tabular-nums">
                    <span className="flex items-center gap-1.5 font-black text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-xl border border-amber-500/25">
                      <FlagBR /> R$ {totalBrl}
                    </span>
                    <span className="flex items-center gap-1.5 font-black text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-xl border border-blue-500/25">
                      <FlagUS /> US$ {totalUsd}
                    </span>
                  </div>
                </div>

                {/* Descuento Directo Autorizado */}
                {appliedDiscount ? (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs animate-fade-in">
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400 text-[11px]">
                        <Percent className="w-3.5 h-3.5 shrink-0" />
                        <span>Descuento Directo: -{formatPYG(descuentoTotalPyg)} ({appliedDiscount.type === "percentage" ? `${appliedDiscount.value}%` : "Fijo"})</span>
                      </div>
                      <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5 truncate">
                        Motivo: <strong className="font-semibold">{appliedDiscount.reason}</strong> · Aut: {appliedDiscount.supervisorNombre}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAppliedDiscount(null)}
                      className="p-1 rounded-lg text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-950/50 cursor-pointer shrink-0"
                      title="Quitar Descuento"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowDiscountModal(true)}
                    className="w-full py-2 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center justify-between transition cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <Percent className="w-3.5 h-3.5 text-amber-500" />
                      Aplicar Descuento Especial
                    </span>
                    <span className="text-[10px] font-mono bg-amber-500/20 px-2 py-0.5 rounded-md font-semibold">
                      Requiere Supervisor
                    </span>
                  </button>
                )}

                {/* Recibido Parcial si hay múltiples pagos */}

                {totalRecibidoPyg > 0 && totalRecibidoPyg < totalPyg && (
                  <div className="p-2.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 flex items-center justify-between text-xs font-bold">
                    <span className="text-blue-700 dark:text-blue-300 uppercase text-[10px]">Total Recibido:</span>
                    <span className="font-posMono text-sm text-blue-700 dark:text-blue-300 font-black">{formatPYG(totalRecibidoPyg)}</span>
                  </div>
                )}

                {/* Hero Vuelto / Saldo Restante */}
                {saldoRestantePyg > 0 ? (
                  <div className="p-3.5 rounded-2xl border-2 border-rose-500 bg-rose-50/80 dark:bg-rose-950/40 text-center shadow-sm space-y-1">
                    <span className="text-xs font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider block">
                      Falta Cobrar
                    </span>
                    <div className="text-3xl font-black font-posMono tabular-nums text-rose-600 dark:text-rose-400 leading-tight">
                      {formatPYG(saldoRestantePyg)}
                    </div>
                    <div className="flex items-center justify-center gap-2 pt-1 font-posMono tabular-nums">
                      <span className="px-2 py-0.5 rounded-lg bg-rose-500/15 text-rose-700 dark:text-rose-300 text-xs font-black">
                        ≈ R$ {(saldoRestantePyg / rates.BRL).toFixed(2)}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-rose-500/15 text-rose-700 dark:text-rose-300 text-xs font-black">
                        ≈ US$ {(saldoRestantePyg / rates.USD).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-2xl border-2 border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 text-center shadow-sm space-y-1">
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                      {donacionActiva && montoDonacionEfectiva > 0 ? "Vuelto Limpio a Entregar" : "Vuelto a Entregar"}
                    </span>
                    <div className="text-3xl font-black font-posMono tabular-nums text-emerald-600 dark:text-emerald-400 leading-tight">
                      {formatPYG(vueltoFinalPyg)}
                    </div>
                    <div className="flex items-center justify-center gap-2 pt-1 font-posMono tabular-nums">
                      <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-black">
                        R$ {(vueltoFinalPyg / rates.BRL).toFixed(2)}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-700 dark:text-blue-300 text-xs font-black">
                        US$ {(vueltoFinalPyg / rates.USD).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Cliente Seleccionado Card */}
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <User className="w-4 h-4 text-slate-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate text-[11px] block">
                          {customer?.nombre || "Consumidor Final"}
                        </span>
                        {((customer as any)?.extra_club_numero || (customer as any)?.extra_club_activo) && (
                          <span className="px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-600 dark:text-purple-300 text-[8px] font-black uppercase tracking-wider shrink-0 border border-purple-500/30">
                            ★ Extra Club
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] font-mono text-slate-500 truncate">
                        {customer?.ruc || customer?.ci ? `Doc: ${customer.ruc || customer.ci}` : "Sin RUC (Boleta Simple)"}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCustomerModal(true)}
                    className="text-[10px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-1 rounded-lg hover:bg-blue-100 cursor-pointer shrink-0"
                  >
                    Cambiar (F9)
                  </button>
                </div>

                {/* Abre tu Corazón - Redondeo Solidario F8 (Solo si está activo en Configuración) */}
                {(() => {
                  let isDonacionOn = true
                  try {
                    const savedTpl = localStorage.getItem("pos_receipt_template_config")
                    if (savedTpl) {
                      const parsed = JSON.parse(savedTpl)
                      if (parsed.donacion_activa === false) isDonacionOn = false
                    } else {
                      const savedComp = localStorage.getItem("pos_company_data")
                      if (savedComp) {
                        const comp = JSON.parse(savedComp)
                        if ((comp?.config as any)?.receipt_template?.donacion_activa === false) isDonacionOn = false
                      }
                    }
                  } catch (e) {}

                  if (!isDonacionOn) return null

                  return (
                    <div className={`p-3 rounded-2xl border transition-all shadow-sm ${
                      donacionActiva
                        ? "bg-gradient-to-br from-rose-50/90 to-amber-50/80 dark:from-rose-950/50 dark:to-amber-950/40 border-rose-400 dark:border-rose-600"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                    }`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Heart className={`w-4 h-4 shrink-0 ${donacionActiva ? "fill-rose-500 text-rose-500 animate-pulse" : "text-slate-400"}`} />
                          <div className="min-w-0">
                            <span className="text-xs font-black text-slate-900 dark:text-white truncate block leading-tight">
                              Abre tu corazón <span className="text-[10px] font-bold text-rose-500">(F8)</span>
                            </span>
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate">
                              {campanaActivaDonacion?.ong_nombre || "Centro Amor y Esperanza"}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleDonacion(!donacionActiva)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                            donacionActiva ? "bg-rose-600" : "bg-slate-300 dark:bg-slate-700"
                          }`}
                        >
                          <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition ${
                            donacionActiva ? "translate-x-4" : "translate-x-0"
                          }`} />
                        </button>
                      </div>

                      {/* Chips de montos rápidos inteligentes */}
                      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-1 flex-wrap">
                        {(() => {
                          const vueltoSinDonar = vueltoPyg
                          const restoCompra = totalPyg % 1000
                          const redondeoCompra = restoCompra > 0 ? 1000 - restoCompra : 500

                          const quickChips: Array<{ label: string; val: number; live?: boolean }> = []

                          if (vueltoSinDonar > 0) {
                            quickChips.push({ label: `Vuelto Total (${formatPYG(vueltoSinDonar)})`, val: vueltoSinDonar, live: true })
                            if (redondeoCompra !== vueltoSinDonar) {
                              quickChips.push({ label: `Redondeo (${formatPYG(redondeoCompra)})`, val: redondeoCompra })
                            }
                          } else {
                            quickChips.push({ label: `Sugerido (${formatPYG(redondeoCompra)})`, val: redondeoCompra })
                          }

                          quickChips.push(
                            { label: "+500", val: 500 },
                            { label: "+1.000", val: 1000 },
                            { label: "+2.000", val: 2000 },
                            { label: "+5.000", val: 5000 }
                          )

                          return quickChips.map((btn, idx) => {
                            const isSelected = donacionActiva && (
                              (btn.live && montoDonacionManual === null) ||
                              montoDonacionManual === btn.val ||
                              (montoDonacionManual === null && btn.val === montoSugeridoDonacion)
                            )
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => btn.live ? handleToggleDonacion(true) : handleToggleDonacion(true, btn.val)}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold font-posMono tabular-nums transition-all cursor-pointer ${
                                  isSelected
                                    ? "bg-rose-600 text-white shadow-sm font-black"
                                    : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                                }`}
                              >
                                {btn.label}
                              </button>
                            )
                          })
                        })()}
                      </div>

                      {/* Campo Manual de Donación */}
                      <div className="mt-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                        <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 shrink-0">
                          Monto Libre (₲):
                        </label>
                        <input
                          type="text"
                          value={montoDonacionManual !== null ? montoDonacionManual.toLocaleString("es-PY") : ""}
                          onChange={(e) => {
                            const clean = e.target.value.replace(/\D/g, "")
                            if (clean) {
                              handleToggleDonacion(true, parseInt(clean, 10))
                            } else {
                              handleToggleDonacion(true, undefined)
                            }
                          }}
                          placeholder={montoSugeridoDonacion.toLocaleString("es-PY")}
                          className="w-32 bg-white dark:bg-slate-950 border border-rose-300 dark:border-rose-700/80 rounded-xl px-2.5 py-1 text-xs font-posMono font-black text-rose-600 dark:text-rose-400 text-right outline-none focus:border-rose-500 shadow-inner"
                        />
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* ── COLUMNA DERECHA: SELECCIÓN DE MÉTODO Y ENTRADA DE PAGO (7 COLS) ── */}
              <div className="lg:col-span-7 p-4 space-y-3">
                {/* Selector de Métodos de Pago */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      Método de Pago:
                    </span>
                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={allowMixedPayment}
                        onChange={(e) => {
                          const on = e.target.checked
                          setAllowMixedPayment(on)
                          if (!on) {
                            setActiveMethods(prev => new Set([prev.values().next().value || "cash"]))
                          }
                        }}
                        className="w-3.5 h-3.5 text-blue-600 rounded cursor-pointer"
                      />
                      <span>Pago mixto</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
                    {(() => {
                      let pMethods: any[] = []
                      try {
                        const saved = localStorage.getItem("pos_payment_methods")
                        if (saved) pMethods = JSON.parse(saved)
                      } catch (e) {}

                      let isExtraClubOn = true
                      try {
                        const savedTpl = localStorage.getItem("pos_receipt_template_config")
                        if (savedTpl) {
                          const parsed = JSON.parse(savedTpl)
                          if (parsed.habilitar_extra_club === false) isExtraClubOn = false
                        } else {
                          const savedComp = localStorage.getItem("pos_company_data")
                          if (savedComp) {
                            const comp = JSON.parse(savedComp)
                            if ((comp?.config as any)?.receipt_template?.habilitar_extra_club === false) isExtraClubOn = false
                          }
                        }
                      } catch (e) {}

                      const isEnabled = (key: string) => {
                        if (!pMethods || pMethods.length === 0) return true
                        const found = pMethods.find((p: any) => p.codigo.toUpperCase().includes(key) || key.includes(p.codigo.toUpperCase()))
                        return found ? found.activo !== false : true
                      }

                      const allTabs = [
                        { id: "cash", key: "1", label: "Efectivo", icon: Banknote, show: isEnabled("EFECTIVO") },
                        { id: "bancard", key: "2", label: "Bancard", icon: CreditCard, show: isEnabled("BANCARD") },
                        { id: "dinelco", key: "3", label: "Dinelco", icon: CreditCard, show: isEnabled("DINELCO") },
                        { id: "qr", key: "4", label: "QR / PIX", icon: QrCode, show: isEnabled("QR") || isEnabled("PIX") },
                        { id: "plugpay_credito", key: "5", label: "Crédito BRL", icon: CreditCard, show: true },
                        { id: "extra_club", key: "6", label: "Extra Club", icon: Star, show: isExtraClubOn && isEnabled("EXTRA_CLUB") },
                      ]

                      return allTabs.filter(t => t.show).map((m) => {
                        const isActive = activeMethods.has(m.id as any)
                        return (
                          <button
                            key={m.id}
                            onClick={() => toggleActiveMethod(m.id as any)}
                            className={`relative px-2 py-2 rounded-xl border font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all cursor-pointer select-none min-h-[54px] ${
                              isActive
                                ? "bg-emerald-600 text-white border-emerald-500 shadow-sm shadow-emerald-600/20"
                                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                            }`}
                          >
                            <span className={`absolute top-1 left-1.5 text-[9px] font-black font-mono ${isActive ? "text-emerald-200" : "text-slate-400"}`}>
                              {m.key}
                            </span>
                            <m.icon className="w-4 h-4" />
                            <span className="text-center leading-tight truncate w-full text-[11px] font-bold">{m.label}</span>
                          </button>
                        )
                      })
                    })()}
                  </div>
                  {isMultiPayment && (
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                      Pago dividido entre {activeMethods.size} métodos -- complete el monto de cada línea.
                    </p>
                  )}
                </div>

                {/* Panel Activo por Método */}
                <div>
                  
                  {/* 1. EFECTIVO MULTIMONEDA */}
                  {activeMethods.has("cash") && (
                    <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <Banknote className="w-4 h-4 text-emerald-600" /> Ingreso de Efectivo
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Enter / Tab salta entre monedas
                        </span>
                      </div>

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
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2 font-posMono tabular-nums font-black text-sm text-emerald-600 dark:text-emerald-400 outline-none focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 transition"
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
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2 font-posMono tabular-nums font-bold text-sm text-amber-600 dark:text-amber-400 outline-none focus:border-amber-500 focus:bg-white dark:focus:bg-slate-900 transition"
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
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2 font-posMono tabular-nums font-bold text-sm text-blue-600 dark:text-blue-400 outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition"
                          />
                        </div>
                      </div>

                      {/* Billetes Rápidos Táctiles - Grid Uniforme */}
                      <div className="pt-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">
                          Billetes Rápidos:
                        </span>
                        <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleQuickCashClick(totalPyg)}
                            className="col-span-2 sm:col-span-1 py-2 px-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-posMono tabular-nums font-black text-[11px] rounded-xl cursor-pointer shadow-sm transition-all active:scale-95 text-center truncate"
                          >
                            Exacto
                          </button>
                          {[
                            { label: "100.000", val: 100000 },
                            { label: "50.000", val: 50000 },
                            { label: "20.000", val: 20000 },
                            { label: "10.000", val: 10000 },
                            { label: "5.000", val: 5000 },
                            { label: "2.000", val: 2000 },
                          ].map((b) => (
                            <button
                              key={b.label}
                              type="button"
                              onClick={() => handleQuickCashClick(b.val)}
                              className="py-2 px-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-posMono tabular-nums font-bold rounded-xl cursor-pointer border border-slate-200 dark:border-slate-700 transition-all active:scale-95 text-center"
                            >
                              {b.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                    {/* 2. POS BANCARD INFONET */}
                    {activeMethods.has("bancard") && (
                      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                          <div className="flex items-center gap-2">
                            <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            <span className="font-black text-xs text-slate-900 dark:text-white">Terminal POS Bancard Infonet</span>
                          </div>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => { setPosCardType("debito"); setPosCardCuotas(1); }}
                              disabled={bancardTxnState === "esperando_tarjeta" || bancardTxnState === "confirmando"}
                              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${posCardType === "debito" ? "bg-blue-600 text-white shadow-xs" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}`}
                            >
                              Débito
                            </button>
                            <button
                              type="button"
                              onClick={() => setPosCardType("credito")}
                              disabled={bancardTxnState === "esperando_tarjeta" || bancardTxnState === "confirmando"}
                              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${posCardType === "credito" ? "bg-blue-600 text-white shadow-xs" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}`}
                            >
                              Crédito
                            </button>
                          </div>
                        </div>

                        {posCardType === "credito" && (
                          <div className="flex items-center gap-1.5 p-2 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800/60">
                            <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase shrink-0">Cuotas:</span>
                            <div className="flex gap-1 flex-wrap">
                              {[1, 2, 3, 6, 12, 18, 24].map((c) => (
                                <button
                                  key={c}
                                  type="button"
                                  onClick={() => setPosCardCuotas(c)}
                                  disabled={bancardTxnState === "esperando_tarjeta" || bancardTxnState === "confirmando"}
                                  className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${posCardCuotas === c ? "bg-blue-600 text-white shadow-xs" : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700"}`}
                                >
                                  {c === 1 ? "1 (Directo)" : `${c}x`}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {isMultiPayment && (
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Monto en esta línea (₲):</label>
                            <div className="flex gap-1">
                              <input
                                ref={mixedCardPygInputRef}
                                type="text"
                                value={mixedCardPyg}
                                onChange={(e) => { const clean = e.target.value.replace(/\D/g, ""); setMixedCardPyg(clean ? parseInt(clean, 10).toLocaleString("es-PY") : "") }}
                                onKeyDown={(e) => handleMixedFieldKeyDown(e, setMixedCardPyg)}
                                onFocus={(e) => e.target.select()}
                                placeholder="0"
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2 font-posMono tabular-nums font-bold text-sm text-blue-600 dark:text-blue-400 outline-none focus:border-blue-500"
                              />
                              <button
                                type="button"
                                title="Completar con el resto"
                                onClick={() => setMixedCardPyg(Math.ceil(Math.max(0, totalPyg - totalRecibidoPyg + (parseInt(mixedCardPyg.replace(/\D/g, "") || "0", 10)))).toLocaleString("es-PY"))}
                                className="px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl cursor-pointer shrink-0"
                              >
                                Resto
                              </button>
                            </div>
                          </div>
                        )}

                        {!activePosConfig.bancardIp && (
                          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/40 text-xs text-amber-600 dark:text-amber-300">
                            No hay IP de terminal configurada para esta caja.{" "}
                            <button type="button" onClick={() => setShowPosConfigModal(true)} className="underline font-bold cursor-pointer">Configurar ahora</button>
                          </div>
                        )}

                        {bancardTxnState !== "aprobada" && (
                          <button
                            type="button"
                            onClick={handleBancardCharge}
                            disabled={!activePosConfig.bancardIp || bancardTxnState === "esperando_tarjeta" || bancardTxnState === "confirmando"}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 cursor-pointer shadow-md shadow-blue-600/20"
                          >
                            {(bancardTxnState === "esperando_tarjeta" || bancardTxnState === "confirmando") ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                            <span>
                              {bancardTxnState === "esperando_tarjeta" ? "Presente la tarjeta en el terminal..."
                                : bancardTxnState === "confirmando" ? "Confirmando con el terminal..."
                                : "Cobrar con Bancard"}
                            </span>
                          </button>
                        )}

                        {bancardTxnState === "aprobada" && bancardTxnResult && (
                          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-xs text-emerald-600 dark:text-emerald-300 space-y-0.5">
                            <div className="font-black">✓ {bancardTxnResult.mensajeDisplay || "Aprobada"}</div>
                            {bancardTxnResult.nombreTarjeta && <div>{bancardTxnResult.nombreTarjeta}{bancardTxnResult.pan ? ` · **** ${bancardTxnResult.pan}` : ""}</div>}
                            {bancardTxnResult.nombreCliente && <div>{bancardTxnResult.nombreCliente}</div>}
                            <div className="font-posMono tabular-nums">Autorización {bancardTxnResult.codigoAutorizacion} · Boleta {bancardTxnResult.nroBoleta}</div>
                          </div>
                        )}

                        {bancardTxnState === "error_rechazo" && (
                          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/40 text-xs text-rose-600 dark:text-rose-300 space-y-1.5">
                            <div className="font-black">✕ {bancardTxnError}</div>
                            <button type="button" onClick={handleBancardCharge} className="text-xs font-bold underline cursor-pointer">Reintentar</button>
                          </div>
                        )}

                        {bancardTxnState === "error_conexion" && (
                          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/40 text-xs text-amber-600 dark:text-amber-300 space-y-1.5">
                            <div className="font-black">⚠ {bancardTxnError}</div>
                            <button type="button" onClick={handleBancardCharge} className="text-xs font-bold underline cursor-pointer">Reintentar conexión</button>
                          </div>
                        )}

                        {/* Respaldo manual */}
                        {bancardTxnState !== "aprobada" && (
                          <div className="pt-1 border-t border-slate-200 dark:border-slate-800">
                            <button
                              type="button"
                              onClick={() => setShowBancardManualFallback((v) => !v)}
                              className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                            >
                              {showBancardManualFallback ? "▾ Ocultar carga manual" : "▸ Cargar voucher manualmente"}
                            </button>

                            {showBancardManualFallback && (
                              <div className="mt-2 space-y-2">
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Terminal:</label>
                                    <input
                                      type="text"
                                      value={posTerminalId}
                                      onChange={(e) => setPosTerminalId(e.target.value)}
                                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2 font-posMono tabular-nums text-xs text-blue-600 dark:text-blue-400 font-bold outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Nº Lote:</label>
                                    <input
                                      type="text"
                                      value={posCardLote}
                                      onChange={(e) => setPosCardLote(e.target.value)}
                                      placeholder="001"
                                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2 font-posMono tabular-nums text-xs outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Nº Voucher:</label>
                                    <input
                                      type="text"
                                      value={posCardCupon}
                                      onChange={(e) => setPosCardCupon(e.target.value)}
                                      placeholder="123456"
                                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2 font-posMono tabular-nums text-xs text-emerald-600 dark:text-emerald-400 font-bold outline-none"
                                    />
                                  </div>
                                </div>

                                <div className="mt-2">
                                  <button
                                    type="button"
                                    onClick={() => handleVerifyPosTerminal("bancard")}
                                    disabled={posVerifyStatus === "searching"}
                                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 hover:bg-blue-600/20 disabled:opacity-60 cursor-pointer"
                                  >
                                    {posVerifyStatus === "searching" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                                    <span>{posVerifyStatus === "searching" ? "Buscando en terminal..." : "Verificar Transacción en Terminal"}</span>
                                  </button>

                                  {posVerifyStatus === "found" && posVerifiedTxn && (
                                    <div className="mt-2 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-xs text-emerald-600 dark:text-emerald-300">
                                      ✓ Verificado: {posVerifiedTxn.tarjeta_marca} · {formatPYG(posVerifiedTxn.monto)} · Voucher {posVerifiedTxn.voucher}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 3. POS DINELCO BEPSA */}
                    {activeMethods.has("dinelco") && (
                      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                          <div className="flex items-center gap-2">
                            <CreditCard className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                            <span className="font-black text-xs text-slate-900 dark:text-white">Terminal POS Dinelco (Ingenico AXIUM)</span>
                          </div>
                          <div className="flex gap-1">
                            {(["debito", "credito", "social"] as const).map(t => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setDinelcoCardType(t)}
                                disabled={dinelcoTxnState === "esperando_tarjeta" || dinelcoTxnState === "confirmando"}
                                className={`px-2.5 py-1 rounded-xl text-xs font-bold uppercase transition-all ${dinelcoCardType === t ? "bg-purple-600 text-white shadow-xs" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}`}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>

                        {dinelcoCardType === "credito" && (
                          <div className="flex items-center gap-1.5 p-2 bg-purple-50/60 dark:bg-purple-950/30 rounded-xl border border-purple-200 dark:border-purple-800/60">
                            <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase shrink-0">Cuotas:</span>
                            <div className="flex gap-1 flex-wrap">
                              {[1, 2, 3, 6, 12, 18, 24].map((c) => (
                                <button
                                  key={c}
                                  type="button"
                                  onClick={() => setDinelcoCuotas(c)}
                                  disabled={dinelcoTxnState === "esperando_tarjeta" || dinelcoTxnState === "confirmando"}
                                  className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${dinelcoCuotas === c ? "bg-purple-600 text-white shadow-xs" : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700"}`}
                                >
                                  {c === 1 ? "1 (Directo)" : `${c}x`}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {isMultiPayment && (
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Monto en esta línea (₲):</label>
                            <div className="flex gap-1">
                              <input
                                ref={mixedDinelcoPygInputRef}
                                type="text"
                                value={mixedDinelcoPyg}
                                onChange={(e) => { const clean = e.target.value.replace(/\D/g, ""); setMixedDinelcoPyg(clean ? parseInt(clean, 10).toLocaleString("es-PY") : "") }}
                                onKeyDown={(e) => handleMixedFieldKeyDown(e, setMixedDinelcoPyg)}
                                onFocus={(e) => e.target.select()}
                                placeholder="0"
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2 font-posMono tabular-nums font-bold text-sm text-purple-600 dark:text-purple-400 outline-none focus:border-purple-500"
                              />
                              <button
                                type="button"
                                title="Completar con el resto"
                                onClick={() => setMixedDinelcoPyg(Math.ceil(Math.max(0, totalPyg - totalRecibidoPyg + (parseInt(mixedDinelcoPyg.replace(/\D/g, "") || "0", 10)))).toLocaleString("es-PY"))}
                                className="px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl cursor-pointer shrink-0"
                              >
                                Resto
                              </button>
                            </div>
                          </div>
                        )}

                        {!activePosConfig.dinelcoIp && (
                          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/40 text-xs text-amber-600 dark:text-amber-300">
                            No hay IP de terminal Dinelco configurada para esta caja.{" "}
                            <button type="button" onClick={() => setShowPosConfigModal(true)} className="underline font-bold cursor-pointer">Configurar ahora</button>
                          </div>
                        )}

                        {activePosConfig.dinelcoIp && dinelcoTxnState !== "aprobada" && (
                          <button
                            type="button"
                            onClick={handleDinelcoCharge}
                            disabled={dinelcoTxnState === "esperando_tarjeta" || dinelcoTxnState === "confirmando"}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50 cursor-pointer shadow-md shadow-purple-600/20"
                          >
                            {(dinelcoTxnState === "esperando_tarjeta" || dinelcoTxnState === "confirmando") ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                            <span>
                              {dinelcoTxnState === "esperando_tarjeta" ? "Presente la tarjeta en el terminal..."
                                : dinelcoTxnState === "confirmando" ? "Confirmando con el terminal..."
                                : "Cobrar con Dinelco"}
                            </span>
                          </button>
                        )}

                        {dinelcoTxnState === "aprobada" && dinelcoTxnResult && (
                          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-xs text-emerald-600 dark:text-emerald-300 space-y-0.5">
                            <div className="font-black">✓ Aprobada</div>
                            {dinelcoTxnResult.ultimos4 && <div>**** {dinelcoTxnResult.ultimos4}</div>}
                            <div className="font-posMono tabular-nums">Autorización {dinelcoTxnResult.codigoAutorizacion} · Boleta {dinelcoTxnResult.nroBoleta}</div>
                          </div>
                        )}

                        {dinelcoTxnState === "error_rechazo" && (
                          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/40 text-xs text-rose-600 dark:text-rose-300 space-y-1.5">
                            <div className="font-black">✕ {dinelcoTxnError}</div>
                            <button type="button" onClick={handleDinelcoCharge} className="text-xs font-bold underline cursor-pointer">Reintentar</button>
                          </div>
                        )}

                        {dinelcoTxnState === "error_conexion" && (
                          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/40 text-xs text-amber-600 dark:text-amber-300 space-y-1.5">
                            <div className="font-black">⚠ {dinelcoTxnError}</div>
                            <button type="button" onClick={handleDinelcoCharge} className="text-xs font-bold underline cursor-pointer">Reintentar conexión</button>
                          </div>
                        )}

                        {/* Respaldo manual -- cupon a mano + match contra la base legacy, igual que antes de tener el terminal en vivo */}
                        {dinelcoTxnState !== "aprobada" && (
                          <div className="pt-1 border-t border-slate-200 dark:border-slate-800">
                            <button
                              type="button"
                              onClick={() => setShowDinelcoManualFallback((v) => !v)}
                              className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                            >
                              {showDinelcoManualFallback ? "▾ Ocultar carga manual" : "▸ Cargar voucher manualmente"}
                            </button>

                            {showDinelcoManualFallback && (
                              <div className="mt-2 space-y-2">
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Terminal:</label>
                                    <input
                                      type="text"
                                      value={dinelcoTerminalId}
                                      onChange={(e) => setDinelcoTerminalId(e.target.value)}
                                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2 font-posMono tabular-nums text-xs text-purple-600 dark:text-purple-400 font-bold outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Nº Lote:</label>
                                    <input
                                      type="text"
                                      value={dinelcoLote}
                                      onChange={(e) => setDinelcoLote(e.target.value)}
                                      placeholder="001"
                                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2 font-posMono tabular-nums text-xs outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Nº Voucher:</label>
                                    <input
                                      type="text"
                                      value={dinelcoCupon}
                                      onChange={(e) => setDinelcoCupon(e.target.value)}
                                      placeholder="654321"
                                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2 font-posMono tabular-nums text-xs text-purple-600 dark:text-purple-400 font-bold outline-none"
                                    />
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleVerifyPosTerminal("dinelco")}
                                  disabled={posVerifyStatus === "searching"}
                                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-purple-600/10 text-purple-600 dark:text-purple-400 border border-purple-500/30 hover:bg-purple-600/20 disabled:opacity-60 cursor-pointer"
                                >
                                  {posVerifyStatus === "searching" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                                  <span>{posVerifyStatus === "searching" ? "Buscando en terminal..." : "Verificar Transacción en Terminal"}</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 4. QR / PIX (Bancard Zimple + PlugPay PIX) */}
                    {activeMethods.has("qr") && (
                      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2.5">
                        {/* Subselector Segmented Control */}
                        <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl gap-1 max-w-xs mx-auto">
                          <button
                            type="button"
                            onClick={() => setQrSubMethod("zimple")}
                            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                              qrSubMethod === "zimple"
                                ? "bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-300 shadow-xs"
                                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                            }`}
                          >
                            <FlagPY /> <span>QR Zimple</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setQrSubMethod("pix")}
                            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                              qrSubMethod === "pix"
                                ? "bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-300 shadow-xs"
                                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                            }`}
                          >
                            <FlagBR /> <span>PIX Brasil</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setQrSubMethod("dinelco")}
                            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                              qrSubMethod === "dinelco"
                                ? "bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-300 shadow-xs"
                                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                            }`}
                          >
                            <QrCode className="w-3.5 h-3.5" /> <span>QR Dinelco</span>
                          </button>
                        </div>

                        {isMultiPayment && (
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Monto en esta línea (₲):</label>
                            <div className="flex gap-1">
                              <input
                                ref={mixedQrPygInputRef}
                                type="text"
                                value={mixedQrPyg}
                                onChange={(e) => { const clean = e.target.value.replace(/\D/g, ""); setMixedQrPyg(clean ? parseInt(clean, 10).toLocaleString("es-PY") : "") }}
                                onKeyDown={(e) => handleMixedFieldKeyDown(e, setMixedQrPyg)}
                                onFocus={(e) => e.target.select()}
                                placeholder="0"
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2 font-posMono tabular-nums font-bold text-sm text-purple-600 dark:text-purple-400 outline-none focus:border-purple-500 text-center"
                              />
                              <button
                                type="button"
                                title="Completar con el resto"
                                onClick={() => setMixedQrPyg(Math.ceil(Math.max(0, totalPyg - totalRecibidoPyg + (parseInt(mixedQrPyg.replace(/\D/g, "") || "0", 10)))).toLocaleString("es-PY"))}
                                className="px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl cursor-pointer shrink-0"
                              >
                                Resto
                              </button>
                            </div>
                          </div>
                        )}

                        {/* SUB-PANEL 1: QR ZIMPLE */}
                        {qrSubMethod === "zimple" && (
                          <div className="flex flex-col items-center text-center space-y-2.5 w-full">
                            <div className="flex items-center gap-2">
                              <QrCode className="w-7 h-7 text-purple-600" />
                              <div className="text-left">
                                <div className="font-bold text-xs text-slate-900 dark:text-white">QR Dinámico Bancard Zimple</div>
                                {!isMultiPayment && (
                                  <div className="text-xs font-posMono tabular-nums font-black text-purple-600 dark:text-purple-400">
                                    {formatPYG(totalPyg)} (R$ {totalBrl})
                                  </div>
                                )}
                              </div>
                            </div>

                            {bancardQrState !== "aprobada" && (
                              <button
                                type="button"
                                onClick={handleBancardQR}
                                disabled={!activePosConfig.bancardIp || bancardQrState === "esperando"}
                                className="w-full max-w-sm flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50 cursor-pointer shadow-sm shadow-purple-600/20"
                              >
                                {bancardQrState === "esperando" ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                                <span>{bancardQrState === "esperando" ? "Esperando el pago del cliente..." : "Generar QR Zimple en Terminal"}</span>
                              </button>
                            )}

                            {bancardQrState === "error_rechazo" && (
                              <div className="w-full max-w-sm p-3 rounded-xl bg-rose-500/10 border border-rose-500/40 text-xs text-rose-600 dark:text-rose-300 space-y-1.5 text-left">
                                <div className="font-black">✕ {bancardQrError || "Transacción QR rechazada"}</div>
                                <button type="button" onClick={handleBancardQR} className="text-xs font-bold underline cursor-pointer">Reintentar</button>
                              </div>
                            )}

                            {bancardQrState === "error_conexion" && (
                              <div className="w-full max-w-sm p-3 rounded-xl bg-amber-500/10 border border-amber-500/40 text-xs text-amber-600 dark:text-amber-300 space-y-1.5 text-left">
                                <div className="font-black">⚠ {bancardQrError || "Error de conexión con el terminal"}</div>
                                <button type="button" onClick={handleBancardQR} className="text-xs font-bold underline cursor-pointer">Reintentar conexión</button>
                              </div>
                            )}

                            {/* Respaldo manual de voucher para QR */}
                            {bancardQrState !== "aprobada" && (
                              <div className="w-full max-w-sm pt-1 border-t border-slate-200 dark:border-slate-800 text-left">
                                <button
                                  type="button"
                                  onClick={() => setShowBancardQrManualFallback((v) => !v)}
                                  className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer flex items-center gap-1"
                                >
                                  <span>{showBancardQrManualFallback ? "▾ Ocultar carga manual de voucher QR" : "▸ Cargar voucher QR manualmente"}</span>
                                </button>

                                {showBancardQrManualFallback && (
                                  <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                                      Si el terminal ya cobró y emitió el ticket impreso, cargá los datos para validar la venta:
                                    </p>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-0.5">Nº Boleta / Ticket:</label>
                                        <input
                                          type="text"
                                          value={posQrCupon}
                                          onChange={(e) => setPosQrCupon(e.target.value)}
                                          placeholder="123456"
                                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 font-posMono tabular-nums text-xs text-purple-600 dark:text-purple-400 font-bold outline-none"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-0.5">Cod. Autorización:</label>
                                        <input
                                          type="text"
                                          value={posQrAuth}
                                          onChange={(e) => setPosQrAuth(e.target.value)}
                                          placeholder="000123"
                                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 font-posMono tabular-nums text-xs outline-none"
                                        />
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={handleManualConfirmQr}
                                      className="w-full py-2 px-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                                    >
                                      <CheckCircle className="w-3.5 h-3.5" />
                                      <span>Confirmar Pago QR con Voucher</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            {bancardQrState === "aprobada" && bancardQrResult && (
                              <div className="w-full max-w-sm p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-xs text-emerald-600 dark:text-emerald-300 space-y-0.5 text-left">
                                <div className="font-black flex items-center justify-between">
                                  <span>✓ {bancardQrResult.mensajeDisplay || "Pago Exitoso"}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setBancardQrState("idle")
                                      setBancardQrResult(null)
                                      setBancardQrManualConfirm(false)
                                    }}
                                    className="text-[10px] text-rose-500 hover:underline cursor-pointer font-bold"
                                  >
                                    Cambiar
                                  </button>
                                </div>
                                <div className="font-posMono tabular-nums">Autorización {bancardQrResult.codigoAutorizacion} · Boleta {bancardQrResult.nroBoleta}</div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* SUB-PANEL 2: PIX BRASIL */}
                        {qrSubMethod === "pix" && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-orange-50 dark:bg-orange-950 flex items-center justify-center text-orange-600">
                                  <Smartphone className="w-3.5 h-3.5" />
                                </div>
                                <span className="font-bold text-xs text-slate-900 dark:text-white">PIX Brasil (PlugPay)</span>
                              </div>
                              <div className="text-right">
                                <span className="text-xs font-posMono font-black text-orange-600 dark:text-orange-400">
                                  {plugpayBrlValue ? `R$ ${plugpayBrlValue.toFixed(2)}` : `Gs. ${formatPYG(isMultiPayment ? parseInt(mixedQrPyg.replace(/\D/g, "") || "0", 10) : totalPyg)}`}
                                </span>
                              </div>
                            </div>

                            {plugpayState === "idle" && (
                              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                                <div className="sm:col-span-8">
                                  <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">CPF (11 dígitos):</label>
                                  <input
                                    type="text"
                                    value={plugpayCpf}
                                    onChange={(e) => setPlugpayCpf(e.target.value.replace(/\D/g, "").slice(0, 11))}
                                    placeholder="52998224725"
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2 font-mono text-xs outline-none focus:border-orange-500 text-center font-bold"
                                  />
                                </div>
                                <div className="sm:col-span-4">
                                  <button
                                    type="button"
                                    onClick={handlePlugpayPix}
                                    className="w-full py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-black rounded-xl transition cursor-pointer shadow-sm shadow-orange-600/20 flex items-center justify-center gap-1.5 h-[36px]"
                                  >
                                    <QrCode className="w-3.5 h-3.5" />
                                    <span>Generar PIX</span>
                                  </button>
                                </div>
                              </div>
                            )}

                            {plugpayState === "esperando" && (
                              <div className="p-3 bg-orange-50/80 dark:bg-orange-950/40 rounded-2xl border border-orange-200 dark:border-orange-800 space-y-2.5">
                                <div className="flex items-center justify-between border-b border-orange-200/60 dark:border-orange-800/60 pb-1.5">
                                  <div className="flex items-center gap-1.5 text-xs font-black text-orange-700 dark:text-orange-300">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-600" />
                                    <span>Esperando pago PIX en tiempo real...</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={resetBancardFlow}
                                    className="text-xs text-rose-500 hover:text-rose-600 font-bold underline cursor-pointer"
                                  >
                                    Cancelar
                                  </button>
                                </div>

                                <div className="flex items-center gap-3.5">
                                  {plugpayResult?.qrCodeStringImage && (
                                    <div className="p-2 bg-white rounded-xl shadow-xs border border-orange-300 shrink-0">
                                      <img
                                        src={`data:image/png;base64,${plugpayResult.qrCodeStringImage}`}
                                        className="w-48 h-48 sm:w-52 sm:h-52 object-contain rounded-md"
                                        alt="PIX QR Code Brasil"
                                      />
                                    </div>
                                  )}
                                  <div className="flex-1 space-y-2.5 text-left">
                                    <div>
                                      <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-0.5">Total a pagar:</span>
                                      <span className="text-xl font-black font-posMono text-orange-600 dark:text-orange-400">
                                        R$ {plugpayResult?.valueBRL || (plugpayBrlValue ? plugpayBrlValue.toFixed(2) : "0.00")}
                                      </span>
                                    </div>

                                    {plugpayResult?.qrCodeCopiaCola && (
                                      <div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            navigator.clipboard.writeText(plugpayResult.qrCodeCopiaCola)
                                            toast.success("Copiado", "Código PIX Copia y Cola copiado.")
                                          }}
                                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-600/15 hover:bg-orange-600/25 text-orange-700 dark:text-orange-400 border border-orange-500/30 rounded-lg text-[11px] font-bold transition cursor-pointer shadow-xs"
                                        >
                                          <Copy className="w-3 h-3" />
                                          <span>Copiar código</span>
                                        </button>
                                      </div>
                                    )}

                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                                      Escanear desde app de banco (Nubank, Itaú, Bradesco, Mercado Pago, Inter).
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {plugpayState === "aprobada" && (
                              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-xs text-emerald-600 dark:text-emerald-300 text-left space-y-0.5">
                                <div className="font-black">✓ Transacción PIX Aprobada</div>
                                <div>ID: {plugpayResult?.IdTransacao}</div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* SUB-PANEL 3: QR / PIX DINELCO */}
                        {qrSubMethod === "dinelco" && (
                          <div className="flex flex-col items-center text-center space-y-2.5 w-full">
                            <div className="flex items-center gap-2">
                              <QrCode className="w-7 h-7 text-purple-600" />
                              <div className="text-left">
                                <div className="font-bold text-xs text-slate-900 dark:text-white">Dinelco (Ingenico AXIUM)</div>
                                {!isMultiPayment && (
                                  <div className="text-xs font-posMono tabular-nums font-black text-purple-600 dark:text-purple-400">
                                    {formatPYG(totalPyg)}
                                  </div>
                                )}
                              </div>
                            </div>

                            {dinelcoQrState !== "aprobada" && (
                              <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl gap-1 w-full max-w-xs">
                                <button
                                  type="button"
                                  onClick={() => setDinelcoQrMode("qr")}
                                  className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-black transition-all cursor-pointer ${dinelcoQrMode === "qr" ? "bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-300 shadow-xs" : "text-slate-500 dark:text-slate-400"}`}
                                >
                                  QR Guaraníes
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDinelcoQrMode("pix")}
                                  className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-black transition-all cursor-pointer ${dinelcoQrMode === "pix" ? "bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-300 shadow-xs" : "text-slate-500 dark:text-slate-400"}`}
                                >
                                  PIX Brasil
                                </button>
                              </div>
                            )}

                            {!activePosConfig.dinelcoIp && (
                              <div className="w-full max-w-sm p-2 rounded-xl bg-amber-500/10 border border-amber-500/40 text-xs text-amber-600 dark:text-amber-300">
                                No hay IP de terminal Dinelco configurada para esta caja.{" "}
                                <button type="button" onClick={() => setShowPosConfigModal(true)} className="underline font-bold cursor-pointer">Configurar ahora</button>
                              </div>
                            )}

                            {dinelcoQrMode === "pix" && dinelcoQrState !== "aprobada" && (
                              <div className="w-full max-w-sm">
                                <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">CPF del comprador (11 dígitos):</label>
                                <input
                                  type="text"
                                  value={dinelcoPixCpf}
                                  onChange={(e) => setDinelcoPixCpf(e.target.value.replace(/\D/g, "").slice(0, 11))}
                                  placeholder="52998224725"
                                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2 font-mono text-xs outline-none focus:border-orange-500 text-center font-bold"
                                />
                              </div>
                            )}

                            {dinelcoQrState !== "aprobada" && (
                              <button
                                type="button"
                                onClick={handleDinelcoQR}
                                disabled={!activePosConfig.dinelcoIp || dinelcoQrState === "esperando"}
                                className="w-full max-w-sm flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50 cursor-pointer shadow-sm shadow-purple-600/20"
                              >
                                {dinelcoQrState === "esperando" ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                                <span>
                                  {dinelcoQrState === "esperando"
                                    ? "Esperando el pago del cliente..."
                                    : dinelcoQrMode === "pix" ? "Generar PIX en Terminal Dinelco" : "Generar QR en Terminal Dinelco"}
                                </span>
                              </button>
                            )}

                            {dinelcoQrState === "aprobada" && (
                              <div className="w-full max-w-sm p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-xs text-emerald-600 dark:text-emerald-300 text-left">
                                <div className="font-black">✓ Transacción {dinelcoQrMode === "pix" ? "PIX" : "QR"} Dinelco Aprobada</div>
                              </div>
                            )}

                            {dinelcoQrState === "error_rechazo" && (
                              <div className="w-full max-w-sm p-3 rounded-xl bg-rose-500/10 border border-rose-500/40 text-xs text-rose-600 dark:text-rose-300 space-y-1.5 text-left">
                                <div className="font-black">✕ {dinelcoQrError}</div>
                                <button type="button" onClick={handleDinelcoQR} className="text-xs font-bold underline cursor-pointer">Reintentar</button>
                              </div>
                            )}

                            {dinelcoQrState === "error_conexion" && (
                              <div className="w-full max-w-sm p-3 rounded-xl bg-amber-500/10 border border-amber-500/40 text-xs text-amber-600 dark:text-amber-300 space-y-1.5 text-left">
                                <div className="font-black">⚠ {dinelcoQrError}</div>
                                <button type="button" onClick={handleDinelcoQR} className="text-xs font-bold underline cursor-pointer">Reintentar conexión</button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 5. CRÉDITO BRASIL (PlugPay) */}
                    {activeMethods.has("plugpay_credito") && (
                      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2.5">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-600">
                              <CreditCard className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="font-black text-xs text-slate-900 dark:text-white">Crédito Brasil (PlugPay)</span>
                              <span className="text-[10px] text-slate-400 block font-normal">Cobro parcelado internacional</span>
                            </div>
                          </div>
                          {plugpayBrlValue && (
                            <div className="text-right">
                              <div className="text-[9px] text-slate-400 uppercase font-bold">Total a Financiar</div>
                              <div className="text-xs font-posMono font-black text-blue-600 dark:text-blue-400">
                                R$ {plugpayBrlValue.toFixed(2)}
                              </div>
                            </div>
                          )}
                        </div>

                        {isMultiPayment && (
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Monto en esta línea (₲):</label>
                            <div className="flex gap-1">
                              <input
                                type="text"
                                value={mixedParceladoPyg}
                                onChange={(e) => { const clean = e.target.value.replace(/\D/g, ""); setMixedParceladoPyg(clean ? parseInt(clean, 10).toLocaleString("es-PY") : "") }}
                                onFocus={(e) => e.target.select()}
                                placeholder="0"
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2 font-posMono tabular-nums font-bold text-sm text-blue-600 dark:text-blue-400 outline-none focus:border-blue-500 text-center"
                              />
                              <button
                                type="button"
                                title="Completar con el resto"
                                onClick={() => setMixedParceladoPyg(Math.ceil(Math.max(0, totalPyg - totalRecibidoPyg + (parseInt(mixedParceladoPyg.replace(/\D/g, "") || "0", 10)))).toLocaleString("es-PY"))}
                                className="px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl cursor-pointer shrink-0"
                              >
                                Resto
                              </button>
                            </div>
                          </div>
                        )}

                        {plugpayState === "idle" && (
                          <div className="space-y-2.5">
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">CPF (11 dígitos):</label>
                                <input
                                  type="text"
                                  value={plugpayCpf}
                                  onChange={(e) => setPlugpayCpf(e.target.value.replace(/\D/g, "").slice(0, 11))}
                                  placeholder="52998224725"
                                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2 font-mono text-xs outline-none focus:border-blue-500 text-center font-bold"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">WhatsApp:</label>
                                <input
                                  type="text"
                                  value={plugpayPhone}
                                  onChange={(e) => setPlugpayPhone(e.target.value.replace(/\D/g, ""))}
                                  placeholder="48999999999"
                                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2 font-mono text-xs outline-none focus:border-blue-500 text-center font-bold"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">Cuotas:</label>
                                <select
                                  value={plugpayCuotas}
                                  onChange={(e) => setPlugpayCuotas(Number(e.target.value))}
                                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2 text-xs outline-none focus:border-blue-500 font-bold"
                                >
                                  {[1, 2, 3, 4, 5, 6, 9, 12, 18, 24].map((c) => (
                                    <option key={c} value={c}>{c === 1 ? "1 pago directo" : `${c} cuotas`}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={handlePlugpayParcelado}
                              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl transition cursor-pointer shadow-sm shadow-blue-600/20 flex items-center justify-center gap-2"
                            >
                              <CreditCard className="w-4 h-4" />
                              <span>Iniciar Crédito Parcelado</span>
                            </button>
                          </div>
                        )}

                        {plugpayState === "esperando" && (
                          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-300">
                                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                                <span>Esperando cobro con tarjeta...</span>
                              </div>
                              <button
                                type="button"
                                onClick={resetBancardFlow}
                                className="text-xs text-rose-500 hover:text-rose-600 font-bold underline cursor-pointer"
                              >
                                Cancelar
                              </button>
                            </div>

                            {plugpayResult?.UrlPaymentForm && (
                              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-blue-200 dark:border-blue-800 flex items-center justify-between gap-2">
                                <div className="text-[11px] text-slate-600 dark:text-slate-300">
                                  <span className="font-bold block text-xs text-slate-900 dark:text-white">Pasarela de Pago Segura</span>
                                  {plugpayCuotas} cuotas de R$ {(plugpayBrlValue ? (plugpayBrlValue / plugpayCuotas).toFixed(2) : "0.00")}
                                </div>
                                <a
                                  href={plugpayResult.UrlPaymentForm}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg flex items-center gap-1 shrink-0 shadow-sm cursor-pointer"
                                >
                                  <span>Abrir Pasarela</span>
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            )}
                          </div>
                        )}

                        {plugpayState === "aprobada" && (
                          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-xs text-emerald-600 dark:text-emerald-300 text-left space-y-0.5">
                            <div className="font-black flex items-center gap-1.5">
                              <CheckCircle className="w-4 h-4 text-emerald-500" />
                              <span>✓ Crédito Parcelado Aprobado</span>
                            </div>
                            <div className="text-[11px] opacity-90">Autorización / Serial: {plugpayResult?.serialNumber || plugpayResult?.SerialNumber || plugpayResult?.IdInitialTransaction}</div>
                          </div>
                        )}

                        {plugpayState === "error" && (
                          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/40 text-xs text-rose-600 dark:text-rose-300 text-left space-y-1.5">
                            <div className="font-bold flex items-center gap-1">
                              <AlertCircle className="w-4 h-4 text-rose-500" />
                              <span>Error en PlugPay: {plugpayError || "Transacción cancelada o fallida"}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => { setPlugpayState("idle"); setPlugpayError("") }}
                              className="px-2.5 py-1 bg-rose-600 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                            >
                              Reintentar
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 7. EXTRA CLUB */}
                    {activeMethods.has("extra_club") && (
                      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                        {(!customer || customer.id === DEFAULT_CUSTOMER.id) ? (
                          <>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Busque por número de socio Extra Club, RUC, cédula o nombre.
                            </p>
                            <input
                              type="text"
                              autoFocus
                              value={extraClubQuery}
                              onChange={(e) => setExtraClubQuery(e.target.value)}
                              onKeyDown={async (e) => {
                                if (e.key === "ArrowDown") { e.preventDefault(); setExtraClubHighlight((h) => Math.min(h + 1, extraClubResults.length - 1)) }
                                else if (e.key === "ArrowUp") { e.preventDefault(); setExtraClubHighlight((h) => Math.max(h - 1, 0)) }
                                else if (e.key === "Enter") {
                                  e.preventDefault()
                                  const c = extraClubResults[extraClubHighlight]
                                  if (c) { setCustomer(c); setExtraClubQuery(""); setExtraClubResults([]); setExtraClubAdminOverride(false); return }
                                  const q = extraClubQuery.trim()
                                  if (!q) return
                                  try {
                                    const found = (await api.customers.list({ search: q, limit: 5 })) || []
                                    if (found.length > 0) {
                                      const c2 = normalizeCustomer(found[0])
                                      setCustomer(c2); setExtraClubQuery(""); setExtraClubResults([]); setExtraClubAdminOverride(false)
                                    }
                                  } catch (err) {}
                                }
                              }}
                              placeholder="Número de socio / RUC / cédula / nombre"
                              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs outline-none focus:border-purple-500"
                            />
                          </>
                        ) : (
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between p-2.5 bg-purple-50/60 dark:bg-purple-950/30 rounded-xl border border-purple-200 dark:border-purple-800/60">
                              <div>
                                <span className="font-black text-xs text-purple-900 dark:text-purple-200">{customer.nombre}</span>
                                <div className="text-[10px] text-purple-600 dark:text-purple-400 font-mono">Socio: {customer.ruc || customer.ci}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => { setCustomer(DEFAULT_CUSTOMER); setExtraClubCredit(null); setExtraClubAdminOverride(false) }}
                                className="text-[10px] font-bold text-purple-600 dark:text-purple-400 underline cursor-pointer"
                              >
                                Cambiar
                              </button>
                            </div>

                            {isMultiPayment && (
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Monto a Crédito Extra Club (₲):</label>
                                <div className="flex gap-1">
                                  <input
                                    type="text"
                                    value={mixedExtraClubPyg}
                                    onChange={(e) => { const clean = e.target.value.replace(/\D/g, ""); setMixedExtraClubPyg(clean ? parseInt(clean, 10).toLocaleString("es-PY") : "") }}
                                    onFocus={(e) => e.target.select()}
                                    placeholder="0"
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2 font-posMono tabular-nums font-bold text-sm text-purple-600 dark:text-purple-400 outline-none focus:border-purple-500 text-center"
                                  />
                                  <button
                                    type="button"
                                    title="Completar con el resto"
                                    onClick={() => setMixedExtraClubPyg(Math.ceil(Math.max(0, totalPyg - totalRecibidoPyg + (parseInt(mixedExtraClubPyg.replace(/\D/g, "") || "0", 10)))).toLocaleString("es-PY"))}
                                    className="px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl cursor-pointer shrink-0"
                                  >
                                    Resto
                                  </button>
                                </div>
                              </div>
                            )}

                            {extraClubCredit && extraClubCredit !== "loading" && (
                              <div className="grid grid-cols-2 gap-2">
                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                                  <div className="text-[9px] text-slate-500 uppercase">Límite</div>
                                  <div className="font-black text-sm font-posMono text-slate-900 dark:text-white">{formatPYG(extraClubCredit.limite_credito)}</div>
                                </div>
                                <div className={`p-2.5 rounded-xl border ${extraClubCredit.saldo_disponible >= totalPyg ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300" : "bg-rose-50 dark:bg-rose-500/10 border-rose-300"}`}>
                                  <div className="text-[9px] text-slate-500 uppercase">Disponible</div>
                                  <div className={`font-black text-sm font-posMono ${extraClubCredit.saldo_disponible >= totalPyg ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>{formatPYG(extraClubCredit.saldo_disponible)}</div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                </div>
              </div>

              {/* 3. FOOTER ACTION BAR */}
              <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/70">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Volver al Carrito</span>
                  <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 text-slate-500">ESC</span>
                </button>

                <button
                  ref={confirmCheckoutBtnRef}
                  onClick={() => {
                    if (activeMethods.has("bancard") && bancardTxnState !== "aprobada" && !posCardCupon.trim()) {
                      toast.warning("Bancard sin confirmar", "Cobrá con el terminal o cargá el cupón manualmente antes de continuar.")
                      return
                    }
                    if (activeMethods.has("dinelco") && dinelcoTxnState !== "aprobada" && !dinelcoCupon.trim()) {
                      toast.warning("Dinelco sin confirmar", "Cobrá con el terminal o cargá el cupón manualmente antes de continuar.")
                      return
                    }
                    if (activeMethods.has("qr") && !bancardQrManualConfirm) {
                      const qrConfirmado =
                        (qrSubMethod === "zimple" && bancardQrState === "aprobada") ||
                        (qrSubMethod === "pix" && plugpayState === "aprobada") ||
                        (qrSubMethod === "dinelco" && dinelcoQrState === "aprobada")
                      if (!qrConfirmado) {
                        toast.warning("QR sin confirmar", "Generá el QR y esperá el pago, o marcá que ya cobraste por fuera del sistema.")
                        return
                      }
                    }
                    const montoExtraClub = activeMethods.has("extra_club") ? (isMultiPayment ? parseInt(mixedExtraClubPyg.replace(/\D/g, "") || "0", 10) : totalPyg) : 0
                    if (montoExtraClub > 0) {
                      if (!customer || customer.id === DEFAULT_CUSTOMER.id) {
                        toast.warning("Elija un socio Extra Club", "Busque al cliente por número de socio, RUC, cédula o nombre.")
                        return
                      }
                      const tieneLinea = extraClubCredit && extraClubCredit !== "loading" && extraClubCredit.activo
                      if (!tieneLinea && !extraClubAdminOverride) {
                        toast.warning("Sin línea de crédito", "Este cliente no tiene cuenta de crédito activa. Solo un admin puede autorizar la excepción.")
                        return
                      }
                      requestSupervisorAuthorization({ type: "extra_club_payment" })
                      return
                    }
                    handleProcessCheckout()
                  }}
                  disabled={submitting}
                  className="flex-1 max-w-lg py-3 px-6 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 transition cursor-pointer active:scale-[0.99] disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Printer className="w-4 h-4" />
                      <span>Confirmar Cobro e Imprimir Factura</span>
                      <span className="text-[10px] font-mono bg-emerald-700/80 px-1.5 py-0.5 rounded border border-emerald-400/40 text-emerald-100">F12 / Enter</span>
                    </>
                  )}
                </button>
              </div>
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
                    <div className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 flex items-center gap-1.5">
                      {c.nombre}
                      {(c as any).extra_club_numero ? (
                        <span className="px-1.5 py-0.5 rounded-md bg-purple-500/15 text-purple-600 dark:text-purple-400 text-[9px] font-black uppercase tracking-wider">★ Extra Club</span>
                      ) : null}
                    </div>
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

      {/* ── MODAL DE DESCUENTO DIRECTO EN PAGO (AUTORIZACIÓN OBLIGATORIA) ──── */}
      {showDiscountModal && (

        <div className="fixed inset-0 z-[150] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border-2 border-amber-500 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-[#1C1710] font-black shadow-md shadow-amber-500/30">
                  <Percent className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white font-posDisplay tracking-tight">
                    Descuento Directo en Venta
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Requiere autorización y motivo obligatorio del supervisor.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDiscountModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Total Venta Actual:</span>
                <span className="text-sm font-black font-posMono text-slate-900 dark:text-white">{formatPYG(totalBrutoPyg)}</span>
              </div>

              {/* Selector de Tipo de Descuento */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setDiscountInputType("percentage"); setDiscountInputValue("10") }}
                  className={`py-2 px-3 rounded-xl text-xs font-black cursor-pointer transition ${
                    discountInputType === "percentage"
                      ? "bg-amber-500 text-[#1C1710] shadow-md shadow-amber-500/20"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  Por Porcentaje (%)
                </button>
                <button
                  type="button"
                  onClick={() => { setDiscountInputType("fixed"); setDiscountInputValue("") }}
                  className={`py-2 px-3 rounded-xl text-xs font-black cursor-pointer transition ${
                    discountInputType === "fixed"
                      ? "bg-amber-500 text-[#1C1710] shadow-md shadow-amber-500/20"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  Por Monto Fijo (₲)
                </button>
              </div>

              {discountInputType === "percentage" ? (
                <div>
                  <div className="flex gap-2 mb-2">
                    {[5, 10, 15, 20].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setDiscountInputValue(String(pct))}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold font-posMono cursor-pointer border ${
                          discountInputValue === String(pct)
                            ? "bg-amber-500/20 border-amber-500 text-amber-700 dark:text-amber-300"
                            : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Porcentaje de Descuento (%):</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={discountInputValue}
                    onChange={(e) => setDiscountInputValue(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-lg font-posMono font-black text-amber-600 dark:text-amber-400 outline-none focus:border-amber-500"
                    placeholder="10"
                    autoFocus
                  />
                </div>
              ) : (
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Monto de Descuento (₲):</label>
                  <input
                    type="text"
                    value={discountInputValue}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/\D/g, "")
                      setDiscountInputValue(clean ? parseInt(clean, 10).toLocaleString("es-PY") : "")
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-lg font-posMono font-black text-amber-600 dark:text-amber-400 outline-none focus:border-amber-500"
                    placeholder="0"
                    autoFocus
                  />
                </div>
              )}

              {/* Resumen Calculado */}
              {(() => {
                const numVal = discountInputType === "percentage"
                  ? parseFloat(discountInputValue) || 0
                  : parseInt(discountInputValue.replace(/\D/g, "") || "0", 10)
                let calcMonto = 0
                if (discountInputType === "percentage") {
                  calcMonto = Math.round(totalBrutoPyg * (numVal / 100))
                } else {
                  calcMonto = Math.min(totalBrutoPyg, numVal)
                }
                const newNet = Math.max(0, totalBrutoPyg - calcMonto)

                return (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1">
                    <div className="flex justify-between font-bold text-amber-800 dark:text-amber-200">
                      <span>Monto a Descontar:</span>
                      <span className="font-posMono text-sm font-black">-{formatPYG(calcMonto)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-700 dark:text-slate-300 pt-1 border-t border-amber-500/20">
                      <span>Nuevo Total a Cobrar:</span>
                      <span className="font-posMono text-sm font-black text-emerald-600 dark:text-emerald-400">{formatPYG(newNet)}</span>
                    </div>
                  </div>
                )
              })()}

              <button
                type="button"
                onClick={() => {
                  const numVal = discountInputType === "percentage"
                    ? parseFloat(discountInputValue) || 0
                    : parseInt(discountInputValue.replace(/\D/g, "") || "0", 10)
                  if (numVal <= 0) {
                    toast.warning("Monto Inválido", "Ingrese un porcentaje o monto mayor a cero.")
                    return
                  }
                  setShowDiscountModal(false)
                  requestSupervisorAuthorization({
                    type: "direct_discount",
                    discountType: discountInputType,
                    discountValue: numVal,
                    discountReason: "",
                  })
                }}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-[#1C1710] font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30 cursor-pointer"
              >
                <ShieldAlert className="w-4 h-4" /> Solicitar Autorización de Supervisor
              </button>
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
              <div className="flex items-center gap-2 shrink-0">
                {priceCheckSelected && (
                  <span className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-500 to-amber-400 text-white font-posMono tabular-nums font-black text-xs flex items-center justify-center shadow-sm" title="Se cierra sola si no se toca">
                    {priceCheckCountdown}s
                  </span>
                )}
                <button onClick={closePriceCheckModal} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
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
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-slate-900 dark:text-white leading-tight">{p.nombre}</div>
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
                    <div className={`font-black text-xl text-slate-900 dark:text-white mb-1 leading-tight ${priceCheckPromo ? "pr-24" : ""}`}>{priceCheckSelected.nombre}</div>
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
                    {(rates.BRL > 0 || rates.USD > 0) && (
                      <div className="flex items-center gap-3 mt-2">
                        {rates.BRL > 0 && (
                          <span className="text-lg font-black text-amber-600 dark:text-amber-400 font-posMono tabular-nums flex items-center gap-1.5 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-1 rounded-lg">
                            <FlagBR /> R$ {((priceCheckPromo ? priceCheckPromo.precio_final : Number(priceCheckSelected.precio_venta) || 0) / rates.BRL).toFixed(2)}
                          </span>
                        )}
                        {rates.USD > 0 && (
                          <span className="text-lg font-black text-blue-600 dark:text-blue-400 font-posMono tabular-nums flex items-center gap-1.5 bg-blue-50 dark:bg-blue-500/10 px-2.5 py-1 rounded-lg">
                            <FlagUS /> US$ {((priceCheckPromo ? priceCheckPromo.precio_final : Number(priceCheckSelected.precio_venta) || 0) / rates.USD).toFixed(2)}
                          </span>
                        )}
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
                        <div className="text-right">
                          <div className="font-black text-emerald-600 dark:text-emerald-400 font-posMono tabular-nums">{formatPYG(Number(t.precio_unitario) || 0)}</div>
                          {(rates.BRL > 0 || rates.USD > 0) && (
                            <div className="flex items-center gap-2 justify-end mt-1">
                              {rates.BRL > 0 && <span className="text-sm font-black text-amber-600 dark:text-amber-400 font-posMono tabular-nums">R$ {(Number(t.precio_unitario) / rates.BRL).toFixed(2)}</span>}
                              {rates.USD > 0 && <span className="text-sm font-black text-blue-600 dark:text-blue-400 font-posMono tabular-nums">US$ {(Number(t.precio_unitario) / rates.USD).toFixed(2)}</span>}
                            </div>
                          )}
                        </div>
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
              <button
                onClick={() => { setReimprimirTab("cierres"); if (reimprimirSessions.length === 0) fetchReimprimirSessions() }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold cursor-pointer ${
                  reimprimirTab === "cierres" ? "bg-brand-orange text-[#1C1710]" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                }`}
              >
                Cierres / Arqueos
              </button>
            </div>

            {/* Buscador Rápido con Fallback a Nombre, CI/RUC y Monto */}
            {reimprimirTab === "ventas" && (
              <div className="px-2 pt-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={reimprimirSearch}
                    onChange={(e) => setReimprimirSearch(e.target.value)}
                    placeholder="🔍 Buscar factura, nombre de cliente, CI, RUC o monto..."
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500 font-medium placeholder:text-slate-400"
                  />
                  {reimprimirSearch && (
                    <button
                      type="button"
                      onClick={() => setReimprimirSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold p-0.5"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            )}

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
                  {filteredReimprimirSales.length === 0 && (
                    <div className="text-center text-sm text-slate-500 dark:text-slate-400 py-12">
                      {reimprimirSearch ? `No se encontraron ventas para "${reimprimirSearch}".` : "No hay ventas recientes para mostrar."}
                    </div>
                  )}
                  {filteredReimprimirSales.map((sale) => {
                    const fpActual = (sale.forma_pago || (sale.condicion === "credito" ? "EXTRA_CLUB" : "EFECTIVO")).toUpperCase()
                    const clienteNombre = sale.customer_nombre || sale.customer?.nombre || sale.customer?.razon_social || "Consumidor Final"
                    const esConsumidorFinal = !sale.customer_id || sale.customer_id === DEFAULT_CUSTOMER.id || clienteNombre === "Consumidor Final"
                    const clienteDoc = sale.customer_doc || sale.customer?.ruc || sale.customer?.ci || sale.customer?.telefono || ""
                    const extraClubNum = sale.customer_extra_club || sale.customer?.extra_club_numero || ""

                    return (
                    <div
                      key={sale.id}
                      className="p-3 mx-1 my-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-2"
                    >
                      {/* Cabecera: Factura Nº, Hora y Forma de Pago */}
                      <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black font-posMono text-slate-900 dark:text-white tracking-tight">
                            Nº {sale.numero || sale.numero_interno || sale.id.slice(0, 8)}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {sale.fecha ? new Date(sale.fecha).toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" }) : "—"}
                          </span>
                        </div>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${
                          fpActual === "EXTRA_CLUB"
                            ? "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30"
                            : fpActual === "TARJETA"
                            ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30"
                            : fpActual === "TRANSFERENCIA" || fpActual === "QR"
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                            : fpActual === "CREDITO"
                            ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
                            : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                        }`}>
                          {fpActual === "EXTRA_CLUB" ? "★ Extra Club" : fpActual}
                        </span>
                      </div>

                      {/* Fila Central: Datos del Cliente y Monto Total */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1 text-xs font-bold text-slate-800 dark:text-slate-200">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{clienteNombre}</span>
                            {extraClubNum && (
                              <span className="px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-600 dark:text-purple-400 text-[9px] font-black shrink-0">
                                ★ #{extraClubNum}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {clienteDoc ? `Doc: ${clienteDoc}` : "Sin documento"} · {sale.condicion ? sale.condicion.toUpperCase() : "CONTADO"}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-sm font-black font-posMono text-slate-900 dark:text-white">
                            {formatPYG(sale.total || 0)}
                          </div>
                        </div>
                      </div>

                      {/* Barra de Acciones */}
                      <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                        {esConsumidorFinal && (
                          <button
                            onClick={() => {
                              setReabrirFacturaSaleId(reabrirFacturaSaleId === sale.id ? null : sale.id)
                              setReabrirFacturaSearch("")
                              setReabrirFacturaResults([])
                              setReabrirPagoSaleId(null)
                            }}
                            title="Agregar identificación de cliente a esta factura (requiere autorización de supervisor)"
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-600/10 hover:bg-purple-600/20 text-purple-600 dark:text-purple-400 border border-purple-500/30 cursor-pointer"
                          >
                            <User className="w-3.5 h-3.5" />
                            Reabrir Titular
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (reabrirPagoSaleId === sale.id) {
                              setReabrirPagoSaleId(null)
                              setReabrirPagoFormaPago("")
                              setReabrirPagoMotivo("")
                              setReabrirPagoCustomer(null)
                              setReabrirPagoCustomerSearch("")
                              setReabrirPagoCustomerResults([])
                            } else {
                              setReabrirPagoSaleId(sale.id)
                              setReabrirPagoFormaPago(fpActual)
                              setReabrirPagoMotivo("")
                              setReabrirFacturaSaleId(null)
                              if (sale.customer && String(sale.customer.id) !== DEFAULT_CUSTOMER.id) {
                                setReabrirPagoCustomer(normalizeCustomer(sale.customer))
                              } else if (sale.customer_id && sale.customer_id !== DEFAULT_CUSTOMER.id && sale.customer_nombre) {
                                setReabrirPagoCustomer(normalizeCustomer({
                                  id: sale.customer_id,
                                  razon_social: sale.customer_nombre,
                                  nombre: sale.customer_nombre,
                                  ruc: sale.customer_doc,
                                  extra_club_numero: sale.customer_extra_club,
                                }))
                              } else {
                                setReabrirPagoCustomer(null)
                              }
                              setReabrirPagoCustomerSearch("")
                              setReabrirPagoCustomerResults([])
                            }
                          }}
                          title="Cambiar forma de pago (solo turno actual, requiere supervisor y motivo)"
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            reabrirPagoSaleId === sale.id
                              ? "bg-amber-600 text-white"
                              : "bg-amber-600/10 hover:bg-amber-600/20 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                          }`}
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          Cambiar Pago
                        </button>
                        <button
                          onClick={() => handleReimprimirSale(sale)}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-xs active:scale-95 transition-all"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Reimprimir
                        </button>
                      </div>

                      {/* Panel de Reabrir Titular */}
                      {reabrirFacturaSaleId === sale.id && (
                        <div className="mt-2 border-t border-slate-200 dark:border-slate-800 pt-2">
                          <input
                            type="text"
                            value={reabrirFacturaSearch}
                            onChange={(e) => setReabrirFacturaSearch(e.target.value)}
                            placeholder="Buscar cliente por nombre, CI o RUC..."
                            autoFocus
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2 text-sm text-slate-900 dark:text-white outline-none focus:border-purple-500"
                          />
                          {reabrirFacturaSearch.trim() && (
                            <div className="mt-1.5 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                              {reabrirFacturaSearching ? (
                                <div className="p-2 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando...</div>
                              ) : reabrirFacturaResults.length > 0 ? (
                                reabrirFacturaResults.map((c) => (
                                  <button
                                    key={String(c.id)}
                                    disabled={submittingReabrirFactura}
                                    onClick={() => requestSupervisorAuthorization({ type: "reopen_invoice", sale, customer: c })}
                                    className="w-full text-left p-2 text-sm hover:bg-purple-50 dark:hover:bg-purple-500/10 border-b border-slate-100 dark:border-slate-800 last:border-b-0 disabled:opacity-50"
                                  >
                                    <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                      {c.nombre}
                                      {(c as any).extra_club_numero ? (
                                        <span className="px-1.5 py-0.5 rounded-md bg-purple-500/15 text-purple-600 dark:text-purple-400 text-[9px] font-black uppercase tracking-wider">★ Extra Club</span>
                                      ) : null}
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">{c.ruc || c.ci || c.telefono || "—"}</div>
                                  </button>
                                ))
                              ) : (
                                <div className="p-2 text-xs text-slate-500 dark:text-slate-400">No se encontró ningún cliente.</div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Panel de Cambiar Forma de Pago con Auditoría y Control de Riesgos */}
                      {reabrirPagoSaleId === sale.id && (
                        <div className="mt-3 border-t border-amber-500/30 pt-3 bg-amber-500/5 dark:bg-amber-500/10 -mx-3 -mb-3 p-3 rounded-b-xl space-y-3">
                          {/* Banner de Auditoría y Control de Riesgo */}
                          <div className="flex items-start gap-2 bg-amber-500/20 border border-amber-500/40 rounded-xl p-2.5 text-xs text-amber-900 dark:text-amber-200">
                            <span className="text-base leading-none">⚠️</span>
                            <div>
                              <div className="font-black uppercase tracking-wide text-[11px]">Auditoría y Control de Riesgos</div>
                              <div className="text-[11px] opacity-90 leading-relaxed mt-0.5">
                                Esta acción modifica la forma de pago de la venta cerrada (Turno Actual). Quedará registrada la traza completa (anterior: <strong>{fpActual}</strong>), motivo y supervisor autorizante. Se reimprimirá la factura automáticamente con el dato correcto.
                              </div>
                            </div>
                          </div>

                          {/* Selector de Nueva Forma de Pago */}
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                              Seleccionar Nueva Forma de Pago:
                            </label>
                            <div className="grid grid-cols-3 gap-1.5">
                              {[
                                { id: "EXTRA_CLUB", label: "★ Extra Club", color: "border-purple-500 text-purple-600 bg-purple-500/10" },
                                { id: "EFECTIVO", label: "💵 Efectivo", color: "border-emerald-500 text-emerald-600 bg-emerald-500/10" },
                                { id: "TARJETA", label: "💳 Tarjeta", color: "border-blue-500 text-blue-600 bg-blue-500/10" },
                                { id: "TRANSFERENCIA", label: "🏦 Transfer.", color: "border-sky-500 text-sky-600 bg-sky-500/10" },
                                { id: "QR", label: "📱 QR Pix", color: "border-amber-500 text-amber-600 bg-amber-500/10" },
                                { id: "CREDITO", label: "📋 Crédito Casa", color: "border-rose-500 text-rose-600 bg-rose-500/10" },
                              ].map((opt) => {
                                const isSelected = reabrirPagoFormaPago === opt.id
                                const isSameAsCurrent = fpActual === opt.id
                                return (
                                  <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => setReabrirPagoFormaPago(opt.id)}
                                    className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center relative ${
                                      isSelected
                                        ? `${opt.color} border-2 ring-2 ring-amber-500/50 shadow-xs scale-102`
                                        : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400"
                                    }`}
                                  >
                                    {opt.label}
                                    {isSameAsCurrent && (
                                      <span className="block text-[9px] text-slate-400 font-normal mt-0.5">(Actual)</span>
                                    )}
                                  </button>
                                )
                              })}
                            </div>
                          </div>

                          {/* Selector de Socio Extra Club cuando la forma de pago elegida es EXTRA_CLUB o CREDITO */}
                          {(reabrirPagoFormaPago === "EXTRA_CLUB" || reabrirPagoFormaPago === "CREDITO") && (
                            <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-black text-purple-700 dark:text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                                  <Star className="w-3.5 h-3.5 fill-purple-500 text-purple-500" />
                                  Socio Extra Club Obligatorio:
                                </span>
                                {reabrirPagoCustomer && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReabrirPagoCustomer(null)
                                      setReabrirPagoCustomerSearch("")
                                    }}
                                    className="text-[10px] text-purple-600 dark:text-purple-400 hover:underline font-bold cursor-pointer"
                                  >
                                    Cambiar socio
                                  </button>
                                )}
                              </div>

                              {reabrirPagoCustomer ? (
                                <div className="bg-white dark:bg-slate-900 border border-purple-500/40 rounded-xl p-2.5 flex items-center justify-between shadow-xs">
                                  <div>
                                    <div className="font-black text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                                      {reabrirPagoCustomer.nombre}
                                      <span className="px-1.5 py-0.5 rounded-md bg-purple-500/15 text-purple-600 dark:text-purple-400 text-[9px] font-black uppercase tracking-wider">
                                        ★ Extra Club
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                      {reabrirPagoCustomer.ruc || reabrirPagoCustomer.ci || "Sin documento"} · {reabrirPagoCustomer.extra_club_numero ? `Socio #${reabrirPagoCustomer.extra_club_numero}` : "Cuenta Extra Club"}
                                    </div>
                                  </div>
                                  <CheckCircle className="w-5 h-5 text-purple-500 shrink-0" />
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  <input
                                    type="text"
                                    value={reabrirPagoCustomerSearch}
                                    onChange={(e) => setReabrirPagoCustomerSearch(e.target.value)}
                                    placeholder="Buscar socio por nombre, CI, RUC o Nº Extra Club..."
                                    className="w-full bg-white dark:bg-slate-950 border border-purple-500/40 rounded-xl p-2 text-xs text-slate-900 dark:text-white outline-none focus:border-purple-600 shadow-inner"
                                    autoFocus
                                  />
                                  {reabrirPagoCustomerSearch.trim().length >= 2 && (
                                    <div className="max-h-44 overflow-y-auto border border-purple-500/30 rounded-xl bg-white dark:bg-slate-950 divide-y divide-slate-100 dark:divide-slate-800 shadow-lg">
                                      {reabrirPagoCustomerSearching ? (
                                        <div className="p-2.5 text-xs text-slate-500 flex items-center gap-2">
                                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando socios...
                                        </div>
                                      ) : reabrirPagoCustomerResults.length > 0 ? (
                                        reabrirPagoCustomerResults.map((c) => (
                                          <button
                                            key={String(c.id)}
                                            type="button"
                                            onClick={() => {
                                              setReabrirPagoCustomer(c)
                                              setReabrirPagoCustomerSearch("")
                                              setReabrirPagoCustomerResults([])
                                            }}
                                            className="w-full text-left p-2 hover:bg-purple-50 dark:hover:bg-purple-500/10 flex items-center justify-between transition-colors cursor-pointer"
                                          >
                                            <div>
                                              <div className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                                {c.nombre}
                                                {c.extra_club_numero && (
                                                  <span className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-600 dark:text-purple-400 text-[9px] font-black">
                                                    ★ #{c.extra_club_numero}
                                                  </span>
                                                )}
                                              </div>
                                              <div className="text-[10px] text-slate-500">
                                                {c.ruc || c.ci || c.telefono || "—"}
                                              </div>
                                            </div>
                                            <Plus className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                                          </button>
                                        ))
                                      ) : (
                                        <div className="p-2.5 text-xs text-slate-500">No se encontró ningún cliente/socio con ese criterio.</div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Campo de Motivo Obligatorio */}
                          <div>
                            <div className="flex justify-between items-baseline mb-1">
                              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                Motivo del Cambio (Obligatorio):
                              </label>
                              <span className={`text-[10px] font-bold ${
                                reabrirPagoMotivo.trim().length >= 10 ? "text-emerald-500" : "text-rose-500"
                              }`}>
                                {reabrirPagoMotivo.trim().length}/10 caracteres mín.
                              </span>
                            </div>
                            <textarea
                              rows={2}
                              value={reabrirPagoMotivo}
                              onChange={(e) => setReabrirPagoMotivo(e.target.value)}
                              placeholder="Ej: Cajera cobró en efectivo por error, cliente es socio Extra Club y solicitó crédito..."
                              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500 resize-none"
                            />
                          </div>

                          {/* Botones de Acción */}
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setReabrirPagoSaleId(null)
                                setReabrirPagoFormaPago("")
                                setReabrirPagoMotivo("")
                                setReabrirPagoCustomer(null)
                                setReabrirPagoCustomerSearch("")
                                setReabrirPagoCustomerResults([])
                              }}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              disabled={
                                submittingReabrirPago ||
                                !reabrirPagoFormaPago ||
                                ((reabrirPagoFormaPago === "EXTRA_CLUB" || reabrirPagoFormaPago === "CREDITO") && !reabrirPagoCustomer) ||
                                (reabrirPagoFormaPago === fpActual && (!reabrirPagoCustomer || (sale.customer && String(reabrirPagoCustomer.id) === String(sale.customer.id)))) ||
                                reabrirPagoMotivo.trim().length < 10
                              }
                              onClick={() => {
                                requestSupervisorAuthorization({
                                  type: "reopen_payment",
                                  sale,
                                  customer: reabrirPagoCustomer || undefined,
                                  formaPago: reabrirPagoFormaPago,
                                  motivo: reabrirPagoMotivo.trim(),
                                } as any)
                              }}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white shadow-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
                            >
                              {submittingReabrirPago ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  Guardando...
                                </>
                              ) : (
                                <>
                                  <Printer className="w-3.5 h-3.5" />
                                  Confirmar y Reimprimir Correcto
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )})}
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

              {reimprimirTab === "cierres" && !reimprimirLoading && !reimprimirError && (
                <>
                  {reimprimirSessions.length === 0 && (
                    <div className="text-center text-sm text-slate-500 dark:text-slate-400 py-12">No hay cierres de turno anteriores para mostrar.</div>
                  )}
                  {reimprimirSessions.map((ses) => (
                    <div
                      key={ses.id}
                      className="p-3 mx-1 my-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent hover:border-slate-300 dark:hover:border-slate-700"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span>Turno {ses.id.slice(0, 8).toUpperCase()}</span>
                            <span className="text-xs px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
                              {ses.cajero_nombre || "Cajero/a"}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Cierre: {ses.fecha_cierre ? new Date(ses.fecha_cierre).toLocaleString("es-PY") : "—"} · Gaveta: <strong className="text-slate-800 dark:text-slate-200">{formatPYG(ses.monto_cierre || 0)}</strong>
                            {ses.monto_apertura_brl > 0 ? ` · R$ ${Number(ses.monto_apertura_brl).toFixed(2)}` : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleDownloadCierrePdf(ses.id)}
                            title="Descargar PDF Oficial"
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200"
                          >
                            <FileText className="w-3.5 h-3.5 text-blue-500" />
                            PDF
                          </button>
                          <button
                            onClick={() => handleReimprimirCierreEscPos(ses)}
                            title="Reimprimir Arqueo ESC/POS (ZKP8008)"
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-[#1C1710]"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            Imprimir Ticket
                          </button>
                        </div>
                      </div>
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

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Cliente (opcional, buscar en la base)</label>
              {lostDemandCustomer ? (
                <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-500/40 rounded-xl p-2.5">
                  <div>
                    <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{lostDemandCustomer.nombre}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{lostDemandCustomer.telefono || "Sin teléfono registrado"}</div>
                  </div>
                  <button
                    onClick={() => { setLostDemandCustomer(null); setLostDemandCliente(""); setLostDemandSearchResults([]) }}
                    className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-red-400 px-2"
                  >
                    Cambiar
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={lostDemandCliente}
                    onChange={(e) => { setLostDemandCliente(e.target.value); setShowLostDemandRegisterForm(false) }}
                    placeholder="Nombre, CI o RUC del cliente..."
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-amber-500"
                  />
                  {lostDemandCliente.trim() && !showLostDemandRegisterForm && (
                    <div className="mt-1.5 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                      {lostDemandSearching ? (
                        <div className="p-2.5 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando...</div>
                      ) : lostDemandSearchResults.length > 0 ? (
                        lostDemandSearchResults.slice(0, 5).map((c) => (
                          <button
                            key={String(c.id)}
                            onClick={() => setLostDemandCustomer(c)}
                            className="w-full text-left p-2.5 text-sm hover:bg-amber-50 dark:hover:bg-amber-500/10 border-b border-slate-100 dark:border-slate-800 last:border-b-0"
                          >
                            <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                              {c.nombre}
                              {(c as any).extra_club_numero ? (
                                <span className="px-1.5 py-0.5 rounded-md bg-purple-500/15 text-purple-600 dark:text-purple-400 text-[9px] font-black uppercase tracking-wider">★ Extra Club</span>
                              ) : null}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{c.telefono || c.ruc || c.ci || "—"}</div>
                          </button>
                        ))
                      ) : (
                        <div className="p-2.5 flex items-center justify-between">
                          <span className="text-xs text-slate-500 dark:text-slate-400">No se encontró ningún cliente.</span>
                          <button
                            onClick={() => { setShowLostDemandRegisterForm(true); setNewLostDemandNombre(lostDemandCliente) }}
                            className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline shrink-0 ml-2"
                          >
                            + Registrar nuevo
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {showLostDemandRegisterForm && (
                <div className="mt-2 border border-amber-500/40 rounded-xl p-3 space-y-2 bg-amber-50/50 dark:bg-amber-500/5">
                  <input
                    type="text"
                    value={newLostDemandNombre}
                    onChange={(e) => setNewLostDemandNombre(e.target.value)}
                    placeholder="Nombre del cliente"
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-amber-500"
                  />
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Teléfono (WhatsApp)</label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setNewLostDemandPhoneCountry("+595")}
                        className={`flex items-center gap-1 px-2 py-2 rounded-lg border text-xs font-bold shrink-0 ${newLostDemandPhoneCountry === "+595" ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400" : "border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400"}`}
                      >
                        <FlagPY /> +595
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewLostDemandPhoneCountry("+55")}
                        className={`flex items-center gap-1 px-2 py-2 rounded-lg border text-xs font-bold shrink-0 ${newLostDemandPhoneCountry === "+55" ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400" : "border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400"}`}
                      >
                        <FlagBR /> +55
                      </button>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={newLostDemandPhoneNumber}
                        onChange={(e) => setNewLostDemandPhoneNumber(e.target.value.replace(/\D/g, ""))}
                        placeholder="981123456"
                        className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowLostDemandRegisterForm(false)}
                      className="flex-1 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleCreateLostDemandCustomer}
                      disabled={creatingLostDemandCustomer || !newLostDemandNombre.trim()}
                      className="flex-1 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
                    >
                      {creatingLostDemandCustomer ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      Guardar cliente
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 mt-3">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Urgencia:</span>
                <button
                  onClick={() => setLostDemandUrgencia("normal")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${lostDemandUrgencia === "normal" ? "border-slate-500 bg-slate-500/10 text-slate-700 dark:text-slate-200" : "border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400"}`}
                >
                  Normal
                </button>
                <button
                  onClick={() => setLostDemandUrgencia("urgente")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${lostDemandUrgencia === "urgente" ? "border-red-500 bg-red-500/10 text-red-600 dark:text-red-400" : "border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400"}`}
                >
                  🔥 Urgente
                </button>
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
                onClick={() => {
                  setShowLostDemandModal(false)
                  setLostDemandCustomer(null)
                  setLostDemandSearchResults([])
                  setShowLostDemandRegisterForm(false)
                  setNewLostDemandNombre("")
                  setNewLostDemandPhoneNumber("")
                  setLostDemandUrgencia("normal")
                }}
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
      {/* ── CIERRE DE CAJA Y ARQUEO CON PRE-CONCILIACIÓN ─────────────────────── */}
      {showCierreTurnoModal && (
        <div className="fixed inset-0 z-[130] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border-2 border-amber-500 rounded-2xl max-w-lg w-full p-6 shadow-2xl text-slate-900 dark:text-slate-100 max-h-[92vh] flex flex-col">
            <div className="flex items-center gap-3 mb-3 shrink-0">
              <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 font-black shadow-sm shadow-amber-500/30">
                <Lock className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-black text-slate-900 dark:text-white font-posDisplay tracking-tight">Cierre de Caja y Arqueo de Turno</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Verifique los medios de pago no-efectivo y realice el conteo de gaveta.</p>
              </div>
            </div>

            {!cierreResult ? (
              <>
                {/* Selector de pestañas */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mb-4 shrink-0">
                  <button
                    type="button"
                    onClick={() => setCierreTab("conteo")}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      cierreTab === "conteo"
                        ? "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    1. Arqueo Efectivo (Gaveta)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCierreTab("conciliacion")}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      cierreTab === "conciliacion"
                        ? "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <Receipt className="w-4 h-4" />
                    2. Resumen de Turno
                  </button>
                </div>

                <div className="overflow-y-auto flex-1 pr-1 space-y-3">
                  {cierreTab === "conteo" ? (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                          Efectivo Físico en Gaveta (Gs.)
                        </label>
                        <input
                          type="text"
                          value={montoCierreReal}
                          onChange={(e) => {
                            const clean = e.target.value.replace(/\D/g, "")
                            setMontoCierreReal(clean ? parseInt(clean, 10).toLocaleString("es-PY") : "")
                          }}
                          placeholder="0"
                          autoFocus
                          className="w-full bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-xl p-3 text-2xl font-posMono tabular-nums font-black text-emerald-600 dark:text-emerald-400 outline-none focus:border-amber-500 text-right"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Contado US$</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={montoCierreUsd}
                            onChange={(e) => setMontoCierreUsd(e.target.value.replace(/[^0-9.,]/g, ""))}
                            placeholder="0.00"
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm font-posMono tabular-nums font-bold text-slate-900 dark:text-white outline-none focus:border-amber-500 text-right"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Contado R$</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={montoCierreBrl}
                            onChange={(e) => setMontoCierreBrl(e.target.value.replace(/[^0-9.,]/g, ""))}
                            placeholder="0.00"
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm font-posMono tabular-nums font-bold text-slate-900 dark:text-white outline-none focus:border-amber-500 text-right"
                          />
                        </div>
                      </div>

                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-300">
                        <p className="font-bold flex items-center gap-1.5 mb-1">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          Instrucciones de Arqueo Físico:
                        </p>
                        <ul className="list-disc list-inside space-y-0.5 text-[11px] opacity-90">
                          <li>Cuente todos los billetes y monedas que están en la gaveta.</li>
                          <li>No incluya cheques ni cupones de tarjeta en este campo.</li>
                          <li>Revise la pestaña <strong>"2. Resumen de Turno"</strong> para validar sus comprobantes POS (Bancard, QR).</li>
                        </ul>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-3">
                      {loadingPreClose ? (
                        <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-500">
                          <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                          <span className="text-xs font-bold">Obteniendo totales del turno...</span>
                        </div>
                      ) : preCloseData ? (
                        <>
                          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-2 text-xs">
                            <div className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">
                              Medios Electrónicos y Crédito (Comprobantes POS / Bancard)
                            </div>
                            <div className="space-y-1 font-posMono tabular-nums">
                              {preCloseData.medios_no_efectivo?.length > 0 ? (
                                preCloseData.medios_no_efectivo.map((m: any, idx: number) => (
                                  <div key={idx} className="flex justify-between items-center py-1 border-b border-slate-200/50 dark:border-slate-800/50 last:border-0">
                                    <span className="font-medium text-slate-700 dark:text-slate-300">{FORMA_PAGO_LABEL[m.forma_pago] || m.forma_pago}</span>
                                    <span className="font-bold text-slate-900 dark:text-white">
                                      {m.moneda === "PYG" ? formatPYG(m.monto) : `${m.moneda} ${Number(m.monto).toFixed(2)}`}
                                    </span>
                                  </div>
                                ))
                              ) : (
                                <div className="text-slate-400 py-1 text-center italic">Sin operaciones electrónicas en este turno</div>
                              )}
                            </div>
                          </div>

                          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-1.5 text-xs font-posMono tabular-nums">
                            <div className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] mb-1">
                              Flujo Operativo de Caja
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600 dark:text-slate-400">Fondo Inicial de Apertura:</span>
                              <span className="font-bold">{formatPYG(preCloseData.monto_apertura_pyg || 0)}</span>
                            </div>
                            <div className="flex justify-between text-orange-600 dark:text-orange-400">
                              <span>Sangrías Realizadas (Retiros):</span>
                              <span className="font-bold">-{formatPYG(preCloseData.total_cash_drops_pyg || 0)}</span>
                            </div>
                            {preCloseData.total_donaciones_pyg > 0 && (
                              <div className="flex justify-between text-pink-600 dark:text-pink-400">
                                <span>Donaciones Recaudadas:</span>
                                <span className="font-bold">+{formatPYG(preCloseData.total_donaciones_pyg)}</span>
                              </div>
                            )}
                            <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-1.5 font-black text-slate-900 dark:text-white">
                              <span>Total Transacciones:</span>
                              <span>{preCloseData.ventas_count || 0} tickets</span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-4 text-xs text-slate-400">No se pudieron cargar los datos de pre-conciliación.</div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-4 shrink-0 border-t border-slate-200 dark:border-slate-800 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowCierreTurnoModal(false)}
                    className="w-1/3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmCierreCaja}
                    disabled={submittingCierre || !montoCierreReal}
                    className="w-2/3 bg-amber-600 hover:bg-amber-700 text-white py-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg shadow-amber-600/20"
                  >
                    {submittingCierre ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                    Confirmar Cierre de Turno
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-3 space-y-1 text-sm font-posMono tabular-nums">
                  <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Efectivo Esperado:</span><span>{formatPYG(cierreResult.monto_cierre_esperado)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Efectivo Contado:</span><span className="font-bold">{formatPYG(cierreResult.contado)}</span></div>
                  <div className={`flex justify-between font-black pt-1 border-t border-slate-200 dark:border-slate-800 ${cierreResult.diferencia < 0 ? "text-red-600 dark:text-red-400" : cierreResult.diferencia > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                    <span>Diferencia Gs.:</span><span>{cierreResult.diferencia >= 0 ? "+" : ""}{formatPYG(cierreResult.diferencia)}</span>
                  </div>
                  {(cierreResult.contado_usd || cierreResult.diferencia_usd) && (
                    <div className={`flex justify-between font-bold pt-1 ${cierreResult.diferencia_usd < 0 ? "text-red-600 dark:text-red-400" : cierreResult.diferencia_usd > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                      <span>Diferencia US$:</span><span>{cierreResult.diferencia_usd >= 0 ? "+" : ""}{cierreResult.diferencia_usd.toFixed(2)}</span>
                    </div>
                  )}
                  {(cierreResult.contado_brl || cierreResult.diferencia_brl) && (
                    <div className={`flex justify-between font-bold ${cierreResult.diferencia_brl < 0 ? "text-red-600 dark:text-red-400" : cierreResult.diferencia_brl > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                      <span>Diferencia R$:</span><span>{cierreResult.diferencia_brl >= 0 ? "+" : ""}{cierreResult.diferencia_brl.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                {cierreResult.desglose_formas_pago.length > 0 && (
                  <div className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-3 space-y-1 text-xs font-posMono tabular-nums">
                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Ventas del turno por forma de pago</div>
                    {cierreResult.desglose_formas_pago.map((p, i) => (
                      <div key={i} className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>{FORMA_PAGO_LABEL[p.forma_pago] || p.forma_pago}{p.moneda && p.moneda !== "PYG" ? ` (${p.moneda})` : ""}</span>
                        <span>{p.moneda === "PYG" ? formatPYG(p.monto) : Number(p.monto).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {cierreResult.requiere_revision && (
                  <div className="text-center text-xs font-bold text-red-500 bg-red-500/10 border border-red-500/40 rounded-xl p-2.5">
                    ⚠ Diferencia fuera de tolerancia — Turno marcado para auditoría de supervisora.
                  </div>
                )}

                {/* Acciones de Comprobante / Reimpresión / Descarga PDF */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if ((window as any).electronAPI?.printEscPos && lastCierreEscPosB64) {
                        const tpl = JSON.parse(localStorage.getItem("pos_receipt_template_config") || "{}")
                        try {
                          await (window as any).electronAPI.printEscPos(lastCierreEscPosB64, tpl.nombre_impresora_windows || "ZKP8008")
                          toast.success("Ticket reimpreso", "Enviado a impresora térmica.")
                        } catch (err: any) {
                          toast.error("Error al reimprimir", err?.message || "Revise la impresora.")
                        }
                      } else if (lastCierreTicketHtml) {
                        await printTicketHtml(lastCierreTicketHtml)
                        toast.success("Ticket reimpreso", "Enviado a impresora.")
                      } else if (lastClosedSessionId) {
                        await handleReimprimirCierreEscPos({
                          id: lastClosedSessionId,
                          cajero_nombre: user?.nombre,
                          register_nombre: puntoEmision || "Caja",
                          fecha_apertura: preCloseData?.fecha_apertura,
                          fecha_cierre: new Date().toISOString(),
                          monto_apertura: preCloseData?.monto_apertura_pyg,
                          monto_apertura_brl: preCloseData?.monto_apertura_brl,
                          monto_cierre: cierreResult?.contado,
                          monto_cierre_esperado: cierreResult?.monto_cierre_esperado,
                          diferencia: cierreResult?.diferencia,
                          diferencia_brl: cierreResult?.diferencia_brl,
                        })
                      } else {
                        toast.warning("Sin datos de cierre", "No se encontró el ticket para reimprimir.")
                      }
                    }}
                    className="py-2.5 px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center gap-1.5"
                  >
                    <Printer className="w-4 h-4 text-amber-500" />
                    Reimprimir Ticket
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (lastClosedSessionId) {
                        handleDownloadCierrePdf(lastClosedSessionId)
                      }
                    }}
                    className="py-2.5 px-3 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <FileText className="w-4 h-4" />
                    Descargar PDF Oficial
                  </button>
                </div>


                <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => { setCierreResult(null); setShowCierreTurnoModal(false); setShowAperturaModal(true) }}
                    className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all"
                  >
                    Finalizar y Abrir Siguiente Turno
                  </button>
                </div>
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
                {cashDropStatus?.cash_drop_threshold ? (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Sugerido = umbral de retiro configurado (₲ {Math.round(cashDropStatus.cash_drop_threshold).toLocaleString("es-PY")}) · Acumulado actual: ₲ {Math.round(cashDropStatus.efectivo_acumulado || 0).toLocaleString("es-PY")} · editable
                  </p>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Monto US$</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={cashDropMontoUsd}
                    onChange={(e) => setCashDropMontoUsd(e.target.value.replace(/[^0-9.,]/g, ""))}
                    placeholder="0.00"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm font-posMono tabular-nums font-bold text-slate-900 dark:text-white outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Monto R$</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={cashDropMontoBrl}
                    onChange={(e) => setCashDropMontoBrl(e.target.value.replace(/[^0-9.,]/g, ""))}
                    placeholder="0.00"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm font-posMono tabular-nums font-bold text-slate-900 dark:text-white outline-none focus:border-orange-500"
                  />
                </div>
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
              <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5">
                Este retiro queda pendiente hasta que una supervisora lo confirme con su propio recuento.
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
                disabled={submittingCashDrop || (!cashDropMonto && !cashDropMontoUsd && !cashDropMontoBrl)}
                className="w-2/3 bg-orange-600 hover:bg-orange-700 text-white py-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {submittingCashDrop ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
                Registrar Retiro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CONSULTA DE SALDO EXTRA CLUB -- boton dedicado, no toca la venta ── */}
      {showExtraClubBalanceModal && (
        <div className="fixed inset-0 z-[130] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border-2 border-purple-500/60 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white font-black shadow-sm">
                  <Star className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white font-posDisplay tracking-tight">Saldo Extra Club</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Consulta de línea de crédito, no afecta la venta actual.</p>
                </div>
              </div>
              <button onClick={() => setShowExtraClubBalanceModal(false)} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            {!balanceModalSelected ? (
              <>
                <input
                  type="text"
                  autoFocus
                  value={balanceModalQuery}
                  onChange={(e) => setBalanceModalQuery(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === "ArrowDown") { e.preventDefault(); setBalanceModalHighlight((h) => Math.min(h + 1, balanceModalResults.length - 1)) }
                    else if (e.key === "ArrowUp") { e.preventDefault(); setBalanceModalHighlight((h) => Math.max(h - 1, 0)) }
                    else if (e.key === "Enter") {
                      e.preventDefault()
                      const c = balanceModalResults[balanceModalHighlight]
                      if (c) { setBalanceModalSelected(c); return }
                      // Un lector de codigo de barra/QR "tipea" rapidisimo y
                      // manda Enter apenas termina -- mucho antes de que el
                      // debounce de 250ms de arriba llegue siquiera a
                      // disparar la busqueda, asi que balanceModalResults
                      // todavia esta vacio en este momento y no habia nada
                      // que seleccionar. En vez de quedarse sin hacer nada,
                      // se dispara la busqueda ya mismo con lo que hay
                      // tipeado/escaneado.
                      const q = balanceModalQuery.trim()
                      if (!q) return
                      try {
                        const found = (await api.customers.list({ search: q, limit: 5 })) || []
                        if (found.length > 0) setBalanceModalSelected(normalizeCustomer(found[0]))
                      } catch (err) {}
                    }
                  }}
                  placeholder="Número de socio / RUC / cédula / nombre"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm outline-none focus:border-purple-500 text-slate-900 dark:text-white mb-2"
                />
                {balanceModalSearching && (
                  <div className="flex items-center justify-center py-4 text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /></div>
                )}
                {!balanceModalSearching && balanceModalQuery.trim() && balanceModalResults.length === 0 && (
                  <div className="text-center text-xs text-slate-500 dark:text-slate-400 py-4">Sin resultados.</div>
                )}
                {balanceModalResults.length > 1 && (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-1">↑↓ para elegir, Enter para confirmar</p>
                )}
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {balanceModalResults.map((c, idx) => (
                    <button
                      key={c.id}
                      onClick={() => setBalanceModalSelected(c)}
                      onMouseEnter={() => setBalanceModalHighlight(idx)}
                      className={`w-full text-left flex items-center justify-between gap-2 px-3 py-2 rounded-lg border cursor-pointer ${idx === balanceModalHighlight ? "border-purple-500 bg-purple-50 dark:bg-purple-500/10" : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-purple-500"}`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{c.razon_social || c.nombre}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          {c.extra_club_numero ? `Socio ${c.extra_club_numero.slice(0, 8)}…` : "Sin número de socio"} · {c.ruc || c.ci || "sin RUC/CI"}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={() => { setBalanceModalSelected(null); setBalanceModalCredit(null) }}
                  className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mb-3 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Buscar otro
                </button>
                <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-300 dark:border-purple-500/30 mb-3">
                  <div className="text-sm font-black text-slate-900 dark:text-white truncate">{balanceModalSelected.razon_social || balanceModalSelected.nombre}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {balanceModalSelected.extra_club_numero || "Sin número de socio"} · {balanceModalSelected.ruc || balanceModalSelected.ci || "sin RUC/CI"}
                  </div>
                </div>
                {balanceModalCredit === "loading" && (
                  <div className="flex items-center justify-center py-8 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
                )}
                {balanceModalCredit && balanceModalCredit !== "loading" && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-center">
                      <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Límite</div>
                      <div className="font-black text-sm font-posMono tabular-nums text-slate-900 dark:text-white">{formatPYG(balanceModalCredit.limite_credito)}</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-center">
                      <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Utilizado</div>
                      <div className="font-black text-sm font-posMono tabular-nums text-amber-600 dark:text-amber-400">{formatPYG(balanceModalCredit.saldo_utilizado)}</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 text-center">
                      <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Disponible</div>
                      <div className="font-black text-sm font-posMono tabular-nums text-emerald-600 dark:text-emerald-400">{formatPYG(balanceModalCredit.saldo_disponible)}</div>
                    </div>
                    {!balanceModalCredit.activo && (
                      <div className="col-span-3 text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5 mt-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Cuenta de crédito inactiva.
                      </div>
                    )}
                  </div>
                )}
                {balanceModalCredit === null && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-300 dark:border-rose-500/30 text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Este cliente no tiene línea de crédito habilitada.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
      {/* ── MODAL DE PARTICIPACIÓN EN SORTEO & IMPRESIÓN DE CUPONES (MULTI-CAMPAÑA) ── */}
      {showCuponModal && pendingCuponData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-orange-500/50 p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6">
            {cuponModalStep === "pregunta" ? (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-gradient-to-tr from-orange-500 to-amber-400 text-white rounded-3xl mx-auto flex items-center justify-center shadow-lg shadow-orange-500/30 animate-bounce">
                  <Ticket className="w-8 h-8" />
                </div>

                <div className="space-y-1">
                  <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 text-xs font-black uppercase tracking-wider font-mono">
                    🎉 ¡Compra Premiada!
                  </span>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white pt-1">
                    Esta compra de {formatPYG(pendingCuponData.montoCompra)} generó:
                  </h2>
                  <div className="text-3xl font-black text-orange-600 dark:text-orange-400 font-posMono tracking-tight">
                    {pendingCuponData.totalCupones} {pendingCuponData.totalCupones === 1 ? "Cupón" : "Cupones"}
                  </div>
                </div>

                {/* Desglose de Campañas Calificadas */}
                <div className="space-y-2 max-h-48 overflow-y-auto text-left">
                  {pendingCuponData.campanasCalificadas.map(c => (
                    <div key={c.campana_id} className="p-3 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">{c.nombre}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          Patrocinador: {c.patrocinador} {c.premio_destacado ? `· Premio: ${c.premio_destacado}` : ""}
                        </div>
                      </div>
                      <span className="font-black text-orange-600 dark:text-orange-400 font-posMono text-sm">
                        {c.cupones_ganados} {c.cupones_ganados === 1 ? "Cupón" : "Cupones"}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300">
                  ¿El cliente desea participar de los sorteos e imprimir sus cupones?
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    onClick={handleSkipCupon}
                    className="py-3 px-4 rounded-2xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    No participar / Imprimir solo Factura
                  </button>

                  <button
                    onClick={() => setCuponModalStep("formulario")}
                    className="py-3 px-4 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs shadow-lg shadow-orange-500/30 flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <span>Sí, Participar</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-orange-500 text-white rounded-xl">
                      <Ticket className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white">
                        Datos para Sorteos ({pendingCuponData.totalCupones} Cupones)
                      </h3>
                      <span className="text-[10px] text-slate-400">
                        Ticket #{pendingCuponData.saleNumero} · {pendingCuponData.campanasCalificadas.length} sorteo(s)
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={handleSkipCupon}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        Documento C.I. / CPF *
                      </label>
                      {lookingUpDoc && (
                        <span className="text-[10px] text-blue-500 font-bold flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Consultando Padrón...
                        </span>
                      )}
                      {pendingCuponData.origenDoc && !lookingUpDoc && (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                          {pendingCuponData.origenDoc === "padron_tsje" ? "🏛️ Padrón Nacional TSJE" : "🏢 Base Clientes"}
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      autoFocus
                      value={pendingCuponData.doc}
                      onChange={e => {
                        const val = e.target.value
                        setPendingCuponData({ ...pendingCuponData, doc: val })
                        handleLookupDoc(val, false)
                      }}
                      onBlur={() => handleLookupDoc(pendingCuponData.doc, true)}
                      placeholder="Ingrese C.I. (ej: 3657834)"
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Nombre y Apellido *
                    </label>
                    <input
                      type="text"
                      required
                      value={pendingCuponData.nombre}
                      onChange={e => setPendingCuponData({ ...pendingCuponData, nombre: e.target.value })}
                      placeholder="Nombre del cliente"
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Teléfono / WhatsApp *
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={pendingCuponData.telCodigo}
                        onChange={e => setPendingCuponData({ ...pendingCuponData, telCodigo: e.target.value as "595" | "55" })}
                        className="p-2.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                      >
                        <option value="595">🇵🇾 +595</option>
                        <option value="55">🇧🇷 +55</option>
                      </select>
                      <input
                        type="text"
                        required
                        value={pendingCuponData.telefono}
                        onChange={e => setPendingCuponData({ ...pendingCuponData, telefono: e.target.value.replace(/\D/g, "") })}
                        placeholder={pendingCuponData.telCodigo === "595" ? "981 123456" : "67 991234567"}
                        className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold flex-1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Barrio</label>
                      <input
                        type="text"
                        value={pendingCuponData.barrio}
                        onChange={e => setPendingCuponData({ ...pendingCuponData, barrio: e.target.value })}
                        placeholder="Ej: San Gerardo"
                        className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Ciudad</label>
                      <input
                        type="text"
                        value={pendingCuponData.ciudad}
                        onChange={e => setPendingCuponData({ ...pendingCuponData, ciudad: e.target.value })}
                        placeholder="Pedro Juan Caballero"
                        className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleConfirmCupon}
                  disabled={savingCupon}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 mt-2"
                >
                  {savingCupon ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Emitiendo e Imprimiendo Cupones...</span>
                    </>
                  ) : (
                    <>
                      <Printer className="w-4 h-4" />
                      <span>Emitir e Imprimir {pendingCuponData.totalCupones} Cupones con Corte</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* ── MODAL PAUSAR TURNO (RELEVO DE ALMUERZO CON GAVETA EXTRAÍBLE) ────── */}
      {showPausaTurnoModal && (
        <div className="fixed inset-0 z-[140] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-amber-500/40 rounded-3xl max-w-md w-full p-6 shadow-2xl text-slate-900 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <Pause className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Pausar Turno de Caja</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Relevo de almuerzo / cambio de gaveta física</p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 text-amber-900 dark:text-amber-200 space-y-1">
                <div className="font-black flex items-center gap-1.5 uppercase text-[11px]">
                  <span>🔐 Control de Custodia de Efectivo</span>
                </div>
                <div className="text-[11px] leading-relaxed opacity-90">
                  Tu turno quedará <strong>congelado</strong> en el sistema con tus ventas y montos exactos.
                  <strong> Recuerda retirar tu gaveta física con llave</strong> para que la cajera de relevo pueda ingresar a esta terminal con su propia gaveta.
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Motivo de la Pausa / Relevo:
                </label>
                <input
                  type="text"
                  value={pausaMotivo}
                  onChange={(e) => setPausaMotivo(e.target.value)}
                  placeholder="Ej: Salida a almuerzo / relevo de gaveta..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500"
                />
              </div>

              <div className="p-3 bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-1 text-slate-600 dark:text-slate-300 text-[11px]">
                <div className="flex justify-between">
                  <span>Cajero:</span>
                  <strong className="text-slate-900 dark:text-white">{user?.nombre || "Cajero"}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Punto de Emisión:</span>
                  <strong className="text-slate-900 dark:text-white">{PUNTOS_EMISION.find(p => p.id === puntoEmision)?.nombre || puntoEmision}</strong>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPausaTurnoModal(false)}
                  className="py-3 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={submittingPausa}
                  onClick={handleConfirmPausaTurno}
                  className="py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black text-xs shadow-lg shadow-amber-500/25 flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  {submittingPausa ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Pausando...
                    </>
                  ) : (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      Confirmar y Salir
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL REANUDAR TURNO (TURNO PAUSADO O TURNO NÓMADA) ───────────────── */}
      {showReanudarModal && activeUserSessionInfo && (
        <div className="fixed inset-0 z-[140] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-emerald-500/40 rounded-3xl max-w-md w-full p-6 shadow-2xl text-slate-900 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <Play className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  {activeUserSessionInfo.estado === "pausada" ? "Reanudar Turno Pausado" : "Continuar Turno Nómada"}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {activeUserSessionInfo.estado === "pausada"
                    ? "Turno en pausa (regreso de almuerzo / relevo)"
                    : "Turno iniciado en otra terminal"}
                </p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3 text-emerald-900 dark:text-emerald-200 space-y-1">
                <div className="font-black flex items-center gap-1.5 uppercase text-[11px]">
                  <span>✅ Estado de Turno Detectado</span>
                </div>
                <div className="text-[11px] leading-relaxed opacity-90">
                  {activeUserSessionInfo.estado === "pausada"
                    ? `Tienes un turno pausado de hoy (${activeUserSessionInfo.total_ventas} ventas previas). Coloca tu gaveta física con llave para continuar.`
                    : `Iniciaste tu turno en ${activeUserSessionInfo.register_nombre || "otra caja"}. Las nuevas ventas emitidas aquí saldrán timbradas con el punto fiscal de esta terminal (${PUNTOS_EMISION.find(p => p.id === puntoEmision)?.nombre || puntoEmision}) y tu arqueo de dinero seguirá unificado.`}
                </div>
              </div>

              <div className="p-3.5 bg-slate-100 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-2 text-slate-600 dark:text-slate-300 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Cajera / Titular:</span>
                  <strong className="text-slate-900 dark:text-white text-sm">{activeUserSessionInfo.cajero_nombre || user?.nombre}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Fondo Inicial:</span>
                  <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{formatPYG(activeUserSessionInfo.monto_apertura || 0)}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Ventas Acumuladas:</span>
                  <strong className="text-slate-900 dark:text-white font-bold">{activeUserSessionInfo.total_ventas} tickets ({formatPYG(activeUserSessionInfo.total_cobrado || 0)})</strong>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500">Terminal Actual:</span>
                  <strong className="text-blue-600 dark:text-blue-400 font-black">{PUNTOS_EMISION.find(p => p.id === puntoEmision)?.nombre || puntoEmision}</strong>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowReanudarModal(false)
                    setShowAperturaModal(true)
                  }}
                  className="py-3 px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer text-center"
                >
                  Abrir Nuevo Turno
                </button>
                <button
                  type="button"
                  disabled={submittingReanudar}
                  onClick={() => handleReanudarTurno()}
                  className="py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  {submittingReanudar ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Reanudando...
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      Reanudar Turno
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

