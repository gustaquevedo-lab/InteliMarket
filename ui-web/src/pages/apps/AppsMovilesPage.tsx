import { useState, useEffect } from "react"
import {
  Download, QrCode, Smartphone, ExternalLink, CheckCircle2,
  ShieldCheck, ArrowRight, Sparkles, Copy, Check, Radio,
  Package, Truck, Key, ShoppingCart, ClipboardCheck, Info, X
} from "lucide-react"
import QRCode from "qrcode"
import { useToast } from "../../context/ToastContext"

interface MobileAppInfo {
  id: string
  name: string
  packageId: string
  version: string
  badge: string
  category: string
  description: string
  accentColor: string
  badgeBg: string
  badgeText: string
  iconSrc: string
  apkUrl: string
  apkFilename: string
  sizeMb: string
  webUrl: string
  keyFeatures: string[]
  targetRoles: string
}

const APPS: MobileAppInfo[] = [
  {
    id: "deposito",
    name: "Extra Depósito",
    packageId: "com.intelimarket.deposito",
    version: "1.0",
    badge: "Logística & Muelle",
    category: "Recepción de Mercaderías",
    description: "Gestión de entrada de camiones de proveedores, escaneo de remisiones con cámara nativa, control de bultos y fotos de comprobantes de descarga.",
    accentColor: "from-amber-500/20 via-orange-500/10 to-transparent border-amber-500/30",
    badgeBg: "bg-amber-500/15 border-amber-500/30",
    badgeText: "text-amber-600 dark:text-amber-400",
    iconSrc: "/deposito-icon-512.png",
    apkUrl: "/download/extra-deposito.apk",
    apkFilename: "extra-deposito.apk",
    sizeMb: "3.2 MB",
    webUrl: "/deposito",
    keyFeatures: [
      "Recepción y cotejo de órdenes de compra",
      "Escaneo láser de códigos de barra por cámara",
      "Control de diferencias de bultos y mermas en descarga",
      "Adjunto de fotos de remisión y sello de conformidad"
    ],
    targetRoles: "Encargados de Depósito, Operadores de Muelle, Auditores de Recepción"
  },
  {
    id: "supervisor",
    name: "Extra Supervisor",
    packageId: "com.intelimarket.supervisor",
    version: "1.0",
    badge: "Seguridad & Cajas",
    category: "Supervisión de Salón y POS",
    description: "Autorizaciones remotas y presenciales de anulaciones de ítems en cajas, apertura de gaveta de seguridad, arqueos y control de cajeras.",
    accentColor: "from-blue-600/20 via-indigo-600/10 to-transparent border-blue-500/30",
    badgeBg: "bg-blue-500/15 border-blue-500/30",
    badgeText: "text-blue-600 dark:text-blue-400",
    iconSrc: "/supervisor-icon-512.png",
    apkUrl: "/download/extra-supervisor.apk",
    apkFilename: "extra-supervisor.apk",
    sizeMb: "3.3 MB",
    webUrl: "/supervisor",
    keyFeatures: [
      "Autorización inmediata con PIN/clave de supervisor",
      "Monitoreo en vivo de cajas registradoras activas",
      "Gestión de arqueos bimonetarios y retiros de efectivo",
      "Validación de vouchers de tarjetas, QR y transferencias"
    ],
    targetRoles: "Supervisores de Cajas, Encargados de Turno, Gerencia de Local"
  },
  {
    id: "salon",
    name: "Extra Salón",
    packageId: "com.intelimarket.salon",
    version: "1.0",
    badge: "Piso de Venta",
    category: "Góndolas & Producción",
    description: "Control de reposición en góndola, cola de impresión de flejes de precio, gestión de balanzas y control de sectores frescos (carnicería, panadería, fiambrería).",
    accentColor: "from-emerald-500/20 via-green-500/10 to-transparent border-emerald-500/30",
    badgeBg: "bg-emerald-500/15 border-emerald-500/30",
    badgeText: "text-emerald-600 dark:text-emerald-400",
    iconSrc: "/salon-icon-512.png",
    apkUrl: "/download/extra-salon.apk",
    apkFilename: "extra-salon.apk",
    sizeMb: "3.2 MB",
    webUrl: "/operaciones-salon",
    keyFeatures: [
      "Cola rápida para reimpresión de etiquetas y flejes",
      "Auditoría visual de precios de venta vs góndola",
      "Gestión de sectores de producción y rotisería",
      "Registro de mermas y productos dañados en piso"
    ],
    targetRoles: "Reponedores, Jefes de Salón, Personal de Carnicería y Panadería"
  },
  {
    id: "conteo",
    name: "Extra Conteo",
    packageId: "com.intelimarket.conteo",
    version: "1.0",
    badge: "Auditoría & Calidad",
    category: "Inventario Físico & Vencimientos",
    description: "Conteo cíclico ágil en góndola y trastienda con control riguroso de fechas de caducidad, lote y captura de foto de evidencia.",
    accentColor: "from-cyan-500/20 via-sky-500/10 to-transparent border-cyan-500/30",
    badgeBg: "bg-cyan-500/15 border-cyan-500/30",
    badgeText: "text-cyan-600 dark:text-cyan-400",
    iconSrc: "/conteo-icon-512.png",
    apkUrl: "/download/extra-conteo.apk",
    apkFilename: "extra-conteo.apk",
    sizeMb: "3.2 MB",
    webUrl: "/conteo-vencimientos",
    keyFeatures: [
      "Escaneo ultrarrápido con cámara o lector integrado",
      "Control de semáforo de fechas de vencimiento (FIFO)",
      "Registro de lote y fotografía de evidencia de estado",
      "Sincronización en vivo con el inventario central"
    ],
    targetRoles: "Auditores de Stock, Encargados de Merma, Personal de Inventario"
  }
]

export default function AppsMovilesPage() {
  const toast = useToast()
  const [qrModalApp, setQrModalApp] = useState<MobileAppInfo | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string>("")
  const [copiedAppId, setCopiedAppId] = useState<string | null>(null)

  // Obtener URL absoluta para descargas QR
  const baseUrl = typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.host}`
    : "https://intelimarket.superextra.com.py"

  const openQrModal = async (app: MobileAppInfo) => {
    try {
      const fullDownloadUrl = `${baseUrl}${app.apkUrl}`
      const url = await QRCode.toDataURL(fullDownloadUrl, {
        margin: 2,
        width: 320,
        color: {
          dark: "#002665",
          light: "#FFFFFF"
        }
      })
      setQrDataUrl(url)
      setQrModalApp(app)
    } catch (err) {
      toast.error("Error", "No se pudo generar el código QR de descarga")
    }
  }

  const copyDownloadLink = (app: MobileAppInfo) => {
    const fullDownloadUrl = `${baseUrl}${app.apkUrl}`
    navigator.clipboard.writeText(fullDownloadUrl)
    setCopiedAppId(app.id)
    toast.success("Enlace copiado", "Podés enviarlo por WhatsApp o compartirlo.")
    setTimeout(() => setCopiedAppId(null), 2500)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* ── HEADER PRINCIPAL ── */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-[#002665] via-[#091B3D] to-[#040D1E] p-6 sm:p-8 text-white shadow-xl border border-white/10">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/20 border border-orange-500/40 text-orange-400 text-xs font-black uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              ECOSISTEMA NATIVO ANDROID
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight">
              Aplicaciones Móviles de Extra Supermercado
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Descargá e instalá directamente los APKs nativos optimizados para teléfonos de operadores, colectores de datos industriales y terminales de mano en tienda.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
            <div className="px-4 py-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs text-xs space-y-1">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                <span>Servidor en Vivo</span>
              </div>
              <p className="text-slate-400 font-mono text-[11px] truncate max-w-[220px]">
                {baseUrl}
              </p>
            </div>
          </div>
        </div>

        {/* Ambient background glow */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* ── GRID DE APPS MÓVILES ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {APPS.map((app) => (
          <div
            key={app.id}
            className={`rounded-3xl bg-white dark:bg-slate-900 border ${app.accentColor} p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-6 group`}
          >
            <div className="space-y-5">
              {/* Encabezado de la App */}
              <div className="flex items-start gap-4">
                <img
                  src={app.iconSrc}
                  alt={app.name}
                  className="w-20 h-20 sm:w-22 sm:h-22 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 object-contain group-hover:scale-105 transition-transform shrink-0"
                />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-black uppercase tracking-wider ${app.badgeBg} ${app.badgeText}`}>
                      {app.badge}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                      v{app.version} · {app.sizeMb}
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white truncate">
                    {app.name}
                  </h2>
                  <p className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate">
                    {app.packageId}
                  </p>
                </div>
              </div>

              {/* Descripción */}
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {app.description}
              </p>

              {/* Funcionalidades Clave */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Funcionalidades Destacadas
                </p>
                <ul className="grid grid-cols-1 gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                  {app.keyFeatures.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Roles destinatarios */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300">Uso recomendado: </span>
                <span className="text-slate-500 dark:text-slate-400">{app.targetRoles}</span>
              </div>
            </div>

            {/* Botones de Acción */}
            <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row gap-2">
                {/* Botón Descargar APK */}
                <a
                  href={app.apkUrl}
                  download={app.apkFilename}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-[#002665] hover:bg-[#00358E] text-white font-black text-sm shadow-md hover:shadow-lg active:scale-[0.98] transition cursor-pointer"
                >
                  <Download className="w-4 h-4 text-orange-400" />
                  <span>Descargar APK ({app.sizeMb})</span>
                </a>

                {/* Botón QR */}
                <button
                  type="button"
                  onClick={() => openQrModal(app)}
                  title="Ver código QR para escanear con la cámara del celular"
                  className="flex items-center justify-center gap-2 px-3 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition cursor-pointer shrink-0"
                >
                  <QrCode className="w-4 h-4" />
                  <span className="sm:hidden">Código QR</span>
                </button>

                {/* Botón Copiar Enlace */}
                <button
                  type="button"
                  onClick={() => copyDownloadLink(app)}
                  title="Copiar enlace de descarga directa"
                  className="flex items-center justify-center gap-2 px-3 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition cursor-pointer shrink-0"
                >
                  {copiedAppId === app.id ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Enlace a versión Web */}
              <div className="flex items-center justify-between text-xs pt-1 px-1">
                <span className="text-slate-400">¿Operás desde navegador de PC?</span>
                <a
                  href={app.webUrl}
                  className="inline-flex items-center gap-1 font-bold text-brand-orange hover:underline"
                >
                  <span>Abrir Versión Web</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── GUÍA RÁPIDA DE INSTALACIÓN ── */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-orange-500/10 text-brand-orange">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              Guía de Instalación en Dispositivos Android
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Pasos sencillos para instalar los APKs en teléfonos y colectores de datos de Extra Supermercado.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 space-y-2">
            <div className="flex items-center gap-2 font-black text-sm text-slate-900 dark:text-white">
              <span className="w-6 h-6 rounded-full bg-[#002665] text-white flex items-center justify-center text-xs">1</span>
              <span>Descargar APK</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Presioná el botón de descarga directa o escaneá el código QR apuntando con la cámara del celular.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 space-y-2">
            <div className="flex items-center gap-2 font-black text-sm text-slate-900 dark:text-white">
              <span className="w-6 h-6 rounded-full bg-[#002665] text-white flex items-center justify-center text-xs">2</span>
              <span>Permitir Fuentes Desconocidas</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Si Android solicita permiso, confirmá "Instalar aplicaciones de fuentes desconocidas" para tu navegador (Chrome, etc.).
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 space-y-2">
            <div className="flex items-center gap-2 font-black text-sm text-slate-900 dark:text-white">
              <span className="w-6 h-6 rounded-full bg-[#002665] text-white flex items-center justify-center text-xs">3</span>
              <span>Iniciar Sesión</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Abrí la app e ingresá con el usuario y contraseña institucional asignado. La app actualizará sus datos automáticamente vía HTTPS.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-amber-500/10 border border-amber-500/20 p-3 rounded-2xl">
          <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>
            <strong>Actualizaciones dinámicas:</strong> Las aplicaciones cargan la lógica de negocio en vivo desde el servidor central. No es necesario reinstalar el APK ante mejoras operativas habituales.
          </span>
        </div>
      </div>

      {/* ── MODAL DE CÓDIGO QR ── */}
      {qrModalApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="relative w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-5 text-center">
            {/* Botón cerrar */}
            <button
              onClick={() => setQrModalApp(null)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Cabecera del modal */}
            <div className="space-y-1">
              <img
                src={qrModalApp.iconSrc}
                alt={qrModalApp.name}
                className="w-16 h-16 rounded-2xl mx-auto shadow-md border border-slate-200 dark:border-slate-800 object-contain mb-2"
              />
              <h3 className="text-xl font-black text-slate-900 dark:text-white">
                {qrModalApp.name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                {qrModalApp.packageId}
              </p>
            </div>

            {/* Código QR generado */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-inner flex justify-center items-center">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR Code" className="w-56 h-56 object-contain" />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center text-slate-400">
                  Generando QR...
                </div>
              )}
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Apuntá la cámara de tu teléfono para descargar el instalador directamente sin cables.
            </p>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setQrModalApp(null)}
                className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-xs text-slate-800 dark:text-slate-200 transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
