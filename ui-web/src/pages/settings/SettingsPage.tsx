import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"
import {
  Building2, CreditCard, DollarSign, Layers, Plus, Shield, Loader2, X,
  CheckCircle, AlertCircle, Settings, Globe, ShieldCheck, CheckCircle2,
  RefreshCcw, Save, Smartphone, QrCode, Banknote, Edit3, Sliders, ToggleLeft, ToggleRight,
  Printer, Sparkles, Image as ImageIcon, FileText, Tag, Award, Gift, Scissors, Eye,
  RotateCcw, Check, MessageSquare, Flame, Star, ShoppingBag, ExternalLink, Trash2,
  Monitor, Tv, Barcode, Clock, Store, Lock, Trash, Heart
} from "lucide-react"
import { api, COMPANY_ID, type Company } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"

type Tab = "company" | "currencies" | "payments" | "fiscal" | "receipt_builder" | "kiosk" | "cajas"

export interface KioskBanner {
  id: string
  titulo: string
  subtitulo?: string
  etiqueta?: string
  descuento_texto?: string
  color?: "emerald" | "amber" | "purple" | "blue" | "rose"
  activo: boolean
}

export interface KioskConfig {
  segundos_espera: number
  mostrar_cotizaciones: boolean
  mostrar_escala_precios: boolean
  mostrar_beneficios_club: boolean
  extra_club_descuento_pct: number
  mensaje_bienvenida: string
  banners: KioskBanner[]
}

const DEFAULT_KIOSK_CONFIG: KioskConfig = {
  segundos_espera: 5,
  mostrar_cotizaciones: true,
  mostrar_escala_precios: true,
  mostrar_beneficios_club: true,
  extra_club_descuento_pct: 10,
  mensaje_bienvenida: "Bienvenido a Extra Supermercado",
  banners: [
    {
      id: "b-01",
      etiqueta: "OFERTA DEL DÍA",
      titulo: "Sector Frutas & Verduras Frescas",
      subtitulo: "Hasta 20% de descuento en pesables seleccionados",
      descuento_texto: "-20% OFF",
      color: "emerald",
      activo: true,
    },
    {
      id: "b-02",
      etiqueta: "OFERTA DE LA SEMANA",
      titulo: "Carnicería Premium & Cortes Envasados",
      subtitulo: "Precios mayoristas llevando a partir de 3 Kg",
      descuento_texto: "PRECIO CLUB",
      color: "amber",
      activo: true,
    },
    {
      id: "b-03",
      etiqueta: "BENEFICIO EXTRA CLUB",
      titulo: "Acumulá Puntos y Descuentos Exclusivos",
      subtitulo: "Dictá tu número de C.I. en caja y ahorrá en cada compra",
      descuento_texto: "10% EXTRA",
      color: "purple",
      activo: true,
    },
  ],
}

export interface ReceiptTemplateConfig {
  // Cabecera e Identidad
  mostrar_logo: boolean
  logo_url: string
  logo_ancho_px: number
  nombre_fantasia: string
  razon_social: string
  ruc: string
  timbrado: string
  timbrado_vencimiento: string
  establecimiento: string
  punto_expedicion: string
  direccion: string
  ciudad: string
  telefono: string
  whatsapp: string
  slogan: string

  // Formato, Dimensiones & Tipografía
  ancho_papel: "80mm" | "58mm"
  ancho_imprimible_mm: number
  margen_izq_mm: number
  margen_der_mm: number
  interlineado: number
  fuente_ticket: "Courier New" | "Consolas" | "Monospace" | "Lucida Console" | "Segoe UI" | "Arial"
  tamano_fuente_px: number
  mostrar_cajero: boolean
  mostrar_caja: boolean
  mostrar_cliente: boolean
  mostrar_ruc_cliente: boolean
  mostrar_sku: boolean
  mostrar_balanza_origen: boolean
  formato_items: "dos_lineas" | "una_linea"

  // Totales & Multimoneda
  mostrar_multimoneda: boolean
  mostrar_equivalente_brl: boolean
  mostrar_equivalente_usd: boolean
  mostrar_liquidacion_iva: boolean
  mostrar_desglose_pagos: boolean
  mostrar_vuelto_extranjero: boolean

  // Fidelización Extra Club
  habilitar_extra_club: boolean
  puntos_por_mil_gs: number
  mensaje_socio_club: string
  mensaje_invitacion_club: string
  mostrar_qr_club: boolean
  qr_url_club: string

  // Campaña Solidaria Abre tu Corazón
  donacion_activa: boolean
  donacion_titulo: string
  donacion_mensaje: string
  donacion_web: string

  // Marketing & Cuponera
  habilitar_mensaje_marketing: boolean
  mensaje_marketing: string
  habilitar_cupon_descuento: boolean
  cupon_codigo: string
  cupon_descripcion: string
  cupon_validez_dias: number

  // Pie de Página & Corte
  mostrar_qr_sifen: boolean
  sifen_consulta_url: string
  facturacion_electronica: boolean
  usar_numero_interno_venta: boolean
  mostrar_numero_comprobante: boolean
  mensaje_despedida: string
  lineas_salto_corte: number
  mostrar_linea_corte_visual: boolean
  corte_automatico: boolean
}

export const DEFAULT_RECEIPT_CONFIG: ReceiptTemplateConfig = {
  mostrar_logo: true,
  logo_url: "/uploads/logos/logo_00000000-0000-0000-0000-000000000010.png?t=1787497787",
  logo_ancho_px: 160,
  nombre_fantasia: "Extra Supermercado",
  razon_social: "EXTRA SUPERMERCADO S.A.",
  ruc: "80092451-2",
  timbrado: "18545636",
  timbrado_vencimiento: "31/12/2026",
  establecimiento: "001",
  punto_expedicion: "012",
  direccion: "Alejo Garcia esquina Carlos Antonio López",
  ciudad: "Pedro Juan Caballero · Paraguay",
  telefono: "+595992052200",
  whatsapp: "+595992052200",
  slogan: "¡Precios Mayoristas Todos los Días!",

  ancho_papel: "80mm",
  ancho_imprimible_mm: 68,
  margen_izq_mm: 0,
  margen_der_mm: 0,
  interlineado: 1.22,
  fuente_ticket: "Consolas",
  tamano_fuente_px: 10.5,
  mostrar_cajero: true,
  mostrar_caja: true,
  mostrar_cliente: true,
  mostrar_ruc_cliente: true,
  mostrar_sku: true,
  mostrar_balanza_origen: true,
  formato_items: "dos_lineas",

  mostrar_multimoneda: true,
  mostrar_equivalente_brl: true,
  mostrar_equivalente_usd: true,
  mostrar_liquidacion_iva: true,
  mostrar_desglose_pagos: true,
  mostrar_vuelto_extranjero: true,

  habilitar_extra_club: true,
  puntos_por_mil_gs: 1,
  mensaje_socio_club: "⭐ SOCIO EXTRA CLUB: Sumaste +150 Puntos. Saldo Total: 2.850 Puntos.",
  mensaje_invitacion_club: "🎁 ¿Aún no eres socio Extra Club? Regístrate gratis en caja o en club.extrasuper.com.py y acumula puntos para canjear por premios y descuentos exclusivos.",
  mostrar_qr_club: true,
  qr_url_club: "https://club.extrasuper.com.py/registro",

  donacion_activa: true,
  donacion_titulo: "* ABRE TU CORAZON *",
  donacion_mensaje: "Gracias por colaborar con el Centro Amor y Esperanza.",
  donacion_web: "www.centroamoresperanza.org",

  habilitar_mensaje_marketing: true,
  mensaje_marketing: "🔥 ¡Miércoles de Carnicería: 15% OFF en cortes seleccionados con Extra Club!",
  habilitar_cupon_descuento: true,
  cupon_codigo: "EXTRA10OFF",
  cupon_descripcion: "10% de descuento en tu próxima compra",
  cupon_validez_dias: 15,

  mostrar_qr_sifen: true,
  sifen_consulta_url: "https://sifen.set.gov.py/consultas",
  facturacion_electronica: false,
  usar_numero_interno_venta: true,
  mostrar_numero_comprobante: true,
  mensaje_despedida: "¡Muchas gracias por su preferencia!",
  lineas_salto_corte: 5,
  mostrar_linea_corte_visual: true,
  corte_automatico: true,
}

export default function SettingsPage() {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>("receipt_builder")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // ── CAJAS Y PUNTOS DE EMISIÓN (asignación fija por máquina) ────────────────
  // Cada caja física (identificada por el hostname real de Windows, ej.
  // CAJA8) queda fija a un punto de emisión y nombre de caja -- esto lo
  // administra el back-office acá, no el cajero en el mostrador.
  const [posTerminals, setPosTerminals] = useState<{ id: string; hostname: string; punto_emision: string; caja_nombre: string; activo: boolean }[]>([])
  const [loadingPosTerminals, setLoadingPosTerminals] = useState(false)
  const [newTerminalHostname, setNewTerminalHostname] = useState("")
  const [newTerminalPunto, setNewTerminalPunto] = useState("012")
  const [newTerminalCajaNombre, setNewTerminalCajaNombre] = useState("")
  const [savingNewTerminal, setSavingNewTerminal] = useState(false)

  const fetchPosTerminals = useCallback(async () => {
    setLoadingPosTerminals(true)
    try {
      const data = await api.posTerminals.list()
      setPosTerminals(Array.isArray(data) ? data : [])
    } catch (e: any) {
      toast.error("No se pudieron cargar las cajas asignadas", e?.message || "Intente nuevamente.")
    } finally {
      setLoadingPosTerminals(false)
    }
  }, [toast])

  useEffect(() => {
    if (tab === "cajas") fetchPosTerminals()
  }, [tab, fetchPosTerminals])

  const handleCreatePosTerminal = async () => {
    if (!newTerminalHostname.trim()) {
      toast.warning("Falta el hostname", "Ingrese el nombre real de la máquina de Windows (ej. CAJA8).")
      return
    }
    setSavingNewTerminal(true)
    try {
      await api.posTerminals.create({
        hostname: newTerminalHostname.trim().toUpperCase(),
        punto_emision: newTerminalPunto,
        caja_nombre: newTerminalCajaNombre.trim() || `Caja ${newTerminalPunto}`,
      })
      toast.success("Caja Asignada", `${newTerminalHostname.trim().toUpperCase()} queda fija al punto ${newTerminalPunto}.`)
      setNewTerminalHostname("")
      setNewTerminalCajaNombre("")
      fetchPosTerminals()
    } catch (e: any) {
      toast.error("No se pudo asignar la caja", e?.message || "Intente nuevamente.")
    } finally {
      setSavingNewTerminal(false)
    }
  }

  const handleTogglePosTerminal = async (id: string, activo: boolean) => {
    try {
      await api.posTerminals.update(id, { activo: !activo })
      fetchPosTerminals()
    } catch (e: any) {
      toast.error("No se pudo actualizar", e?.message || "Intente nuevamente.")
    }
  }

  const handleDeletePosTerminal = async (id: string, hostname: string) => {
    try {
      await api.posTerminals.delete(id)
      toast.success("Asignación Eliminada", `${hostname} ya no tiene caja fija.`)
      fetchPosTerminals()
    } catch (e: any) {
      toast.error("No se pudo eliminar", e?.message || "Intente nuevamente.")
    }
  }

  // ── NUMERACIÓN DE NOTAS DE CRÉDITO POR PUNTO DE EMISIÓN ─────────────────
  // Somos autoimpresor -- no se declara CDC/SIFEN, pero cada devolución sí
  // necesita un número de NC real y correlativo por caja, igual que ya pasa
  // con la numeración de venta. Se asigna acá, junto con el resto de la
  // configuración de puntos de emisión, no en el mostrador.
  const [ncSequences, setNcSequences] = useState<{ punto_emision: string; numero_actual: number; numero_final: number; disponibles: number; timbrado_numero: string; timbrado_vencido: boolean }[]>([])
  const [loadingNcSequences, setLoadingNcSequences] = useState(false)
  const [activeTimbradoId, setActiveTimbradoId] = useState<string | null>(null)
  const [newNcPunto, setNewNcPunto] = useState("012")
  const [newNcDesde, setNewNcDesde] = useState("1")
  const [newNcHasta, setNewNcHasta] = useState("5000")
  const [savingNcSequence, setSavingNcSequence] = useState(false)

  const fetchNcSequences = useCallback(async () => {
    setLoadingNcSequences(true)
    try {
      const status = await api.fiscal.status(COMPANY_ID)
      setNcSequences((status?.puntos_emision || []).filter((p: any) => p.tipo_documento === "nota_credito"))
      const timbrados = await api.fiscal.timbrados.list(COMPANY_ID)
      const activo = (timbrados || []).find((t: any) => t.activo)
      setActiveTimbradoId(activo?.id || null)
    } catch (e: any) {
      toast.error("No se pudo cargar la numeración de NC", e?.message || "Intente nuevamente.")
    } finally {
      setLoadingNcSequences(false)
    }
  }, [toast])

  useEffect(() => {
    if (tab === "cajas") fetchNcSequences()
  }, [tab, fetchNcSequences])

  const handleCreateNcSequence = async () => {
    if (!activeTimbradoId) {
      toast.warning("No hay timbrado activo", "Configure primero un timbrado en la pestaña Datos Fiscales.")
      return
    }
    if (!newNcPunto.trim()) {
      toast.warning("Falta el punto de emisión", "Ingrese la boca (ej. 015).")
      return
    }
    setSavingNcSequence(true)
    try {
      await api.fiscal.secuencias.create({
        company_id: COMPANY_ID,
        timbrado_id: activeTimbradoId,
        punto_emision: newNcPunto.trim(),
        tipo_documento: "nota_credito",
        numero_actual: parseInt(newNcDesde, 10) || 1,
        numero_final: parseInt(newNcHasta, 10) || 5000,
      })
      toast.success("Numeración de NC Asignada", `Punto ${newNcPunto.trim()} ya puede emitir notas de crédito.`)
      setNewNcPunto("")
      fetchNcSequences()
    } catch (e: any) {
      toast.error("No se pudo asignar la numeración", e?.message || "Intente nuevamente.")
    } finally {
      setSavingNcSequence(false)
    }
  }

  // 1. Estado de Datos de Empresa (Conectado a DB)
  const [company, setCompany] = useState<Company>({
    id: COMPANY_ID,
    nombre: "Extra Supermercado Mayorista",
    nombre_fantasia: "Extra Supermercado Mayorista",
    razon_social: "GRUPO SANTA TERESA E.A.S.",
    ruc: "80150377-9",
    direccion: "Alejo Garcia esquina Carlos Antonio López",
    telefono: "+595992052200",
    email: "contacto@superextra.com.py",
    logo_url: "/uploads/logos/logo_00000000-0000-0000-0000-000000000010.png?t=1787497787",
    activo: true,
    config: {
      timbrado_dnit: "18545636",
      establecimiento: "001",
      ciudad: "Pedro Juan Caballero",
      departamento: "Amambay",
    },
  })

  // 2. Estado de Divisas y Cotizaciones en Cajas
  const [currencies, setCurrencies] = useState([
    { codigo: "PYG", nombre: "Guaraní Paraguayo", simbolo: "Gs.", compra: 1, venta: 1, es_base: true, activo: true, estado: "Moneda Base" },
    { codigo: "BRL", nombre: "Real Brasileño", simbolo: "R$", compra: 1350, venta: 1420, es_base: false, activo: true, estado: "Frontera Activo" },
    { codigo: "USD", nombre: "Dólar Estadounidense", simbolo: "US$", compra: 7450, venta: 7550, es_base: false, activo: true, estado: "Internacional" },
    { codigo: "ARS", nombre: "Peso Argentino", simbolo: "$", compra: 6.5, venta: 7.2, es_base: false, activo: false, estado: "No se usa en esta frontera" },
  ])

  // 3. Medios de Pago Habilitados
  const [paymentMethods, setPaymentMethods] = useState([
    { id: "pm-01", codigo: "EFECTIVO", nombre: "Efectivo (Guaraníes, Reales, Dólares)", icon: Banknote, comision_pct: 0.0, activo: true, custom: false },
    { id: "pm-02", codigo: "BANCARD_POS", nombre: "POS Bancard (Tarjetas Infonet)", icon: CreditCard, comision_pct: 2.0, activo: true, custom: false },
    { id: "pm-03", codigo: "DINELCO_POS", nombre: "POS Dinelco (Tarjetas Pronet)", icon: CreditCard, comision_pct: 2.2, activo: true, custom: false },
    { id: "pm-04", codigo: "QR_ZIMPLE", nombre: "Bancard QR Zimple / Billeteras", icon: QrCode, comision_pct: 1.5, activo: true, custom: false },
    { id: "pm-05", codigo: "PIX_BRASIL", nombre: "PIX Brasil (Transferencia Frontera)", icon: Smartphone, comision_pct: 1.2, activo: true, custom: false },
    { id: "pm-06", codigo: "EXTRA_CLUB", nombre: "Extra Club (Crédito & Fidelidad)", icon: ShieldCheck, comision_pct: 0.0, activo: true, custom: false },
  ])

  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false)
  const [newPaymentForm, setNewPaymentForm] = useState({
    codigo: "",
    nombre: "",
    comision_pct: 0,
    tipo: "card",
  })

  // 4. Parámetros Operativos
  const [operationalSettings, setOperationalSettings] = useState({
    redondeo_dnit: 50,
    modalidad_facturacion: "AUTOIMPRESOR",
    impresion_automatica: true,
    apertura_gaveta_venta: true,
    bloqueo_descuento_sin_supervisor: true,
  })

  // 5. Estado del Constructor de Factura / Ticket Térmico
  const [receiptConfig, setReceiptConfig] = useState<ReceiptTemplateConfig>(() => {
    const saved = localStorage.getItem("pos_receipt_template_config")
    if (saved) {
      try {
        return { ...DEFAULT_RECEIPT_CONFIG, ...JSON.parse(saved) }
      } catch (e) {}
    }
    return DEFAULT_RECEIPT_CONFIG
  })

  // 6. Estado del Kiosco Verificador & Cartelería Digital
  const [kioskConfig, setKioskConfig] = useState<KioskConfig>(() => {
    const saved = localStorage.getItem("kiosk_config")
    if (saved) {
      try {
        return { ...DEFAULT_KIOSK_CONFIG, ...JSON.parse(saved) }
      } catch (e) {}
    }
    return DEFAULT_KIOSK_CONFIG
  })

  // Subpestaña de edición del constructor
  const [designerSection, setDesignerSection] = useState<"header" | "body" | "totals" | "club" | "donacion" | "marketing" | "footer">("header")
  
  // Simulador de vista previa: con socio Extra Club o Consumidor Final
  const [previewCustomerType, setPreviewCustomerType] = useState<"socio" | "consumidor_final">("socio")

  // Cargar datos reales desde la API
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const compRes = await api.companies.list()
      if (Array.isArray(compRes) && compRes.length > 0) {
        const comp = compRes[0]
        const fantasia = comp.nombre_fantasia || comp.nombre || "Extra Supermercado Mayorista"
        const fullComp = { ...comp, nombre: fantasia, nombre_fantasia: fantasia }
        setCompany(fullComp)
        localStorage.setItem("pos_company_data", JSON.stringify(fullComp))

        // Si la empresa ya tiene plantilla de ticket guardada en DB en config.receipt_template, asumirla
        const dbReceiptTemplate = (comp.config as any)?.receipt_template
        if (dbReceiptTemplate) {
          setReceiptConfig(dbReceiptTemplate)
          localStorage.setItem("pos_receipt_template_config", JSON.stringify(dbReceiptTemplate))
        } else {
          setReceiptConfig(prev => {
            const updated = {
              ...prev,
              nombre_fantasia: fantasia,
              razon_social: comp.razon_social || prev.razon_social,
              ruc: comp.ruc || prev.ruc,
              direccion: comp.direccion || prev.direccion,
              telefono: comp.telefono || prev.telefono,
              logo_url: comp.logo_url || prev.logo_url,
              timbrado: String((comp.config as any)?.timbrado_dnit || prev.timbrado)
            }
            localStorage.setItem("pos_receipt_template_config", JSON.stringify(updated))
            return updated
          })
        }

        // Cargar medios de pago guardados en DB
        const dbPayments = (comp.config as any)?.payment_methods
        if (Array.isArray(dbPayments) && dbPayments.length > 0) {
          setPaymentMethods(dbPayments.map((p: any) => ({
            ...p,
            icon: p.codigo.includes("POS") || p.codigo.includes("CARD") ? CreditCard :
                  p.codigo.includes("QR") ? QrCode :
                  p.codigo.includes("PIX") || p.codigo.includes("APP") ? Smartphone :
                  p.codigo.includes("CLUB") ? ShieldCheck : Banknote
          })))
          localStorage.setItem("pos_payment_methods", JSON.stringify(dbPayments))
        }

        // Cargar cotizaciones guardadas en DB
        const dbCurrencies = (comp.config as any)?.currencies
        if (dbCurrencies) {
          setCurrencies(prev => prev.map(c => {
            const val = dbCurrencies[c.codigo]
            if (val) {
              return {
                ...c,
                compra: typeof val === "object" ? Number(val.compra ?? c.compra) : c.compra,
                venta: typeof val === "object" ? Number(val.venta ?? c.venta) : Number(val),
                activo: typeof val === "object" && typeof val.activo === "boolean" ? val.activo : c.activo,
              }
            }
            return c
          }))
          localStorage.setItem("pos_currencies_config", JSON.stringify(dbCurrencies))
          const brl = Number(dbCurrencies.BRL?.venta || dbCurrencies.BRL || 1420)
          const usd = Number(dbCurrencies.USD?.venta || dbCurrencies.USD || 7550)
          const ars = Number(dbCurrencies.ARS?.venta || dbCurrencies.ARS || 5.8)
          localStorage.setItem("pos_currency_rates", JSON.stringify({ BRL: brl, USD: usd, ARS: ars }))
        }

        // Cargar parámetros operativos guardados en DB
        const dbOperational = (comp.config as any)?.operational
        if (dbOperational) {
          setOperationalSettings(prev => ({ ...prev, ...dbOperational }))
          localStorage.setItem("pos_operational_config", JSON.stringify(dbOperational))
        }

        // Cargar configuración de Kiosco guardada en DB
        const dbKiosk = (comp.config as any)?.kiosk
        if (dbKiosk) {
          setKioskConfig(dbKiosk)
          localStorage.setItem("kiosk_config", JSON.stringify(dbKiosk))
        }
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const logoFileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast.error("Archivo Inválido", "Seleccione un archivo de imagen (PNG, JPG, JPEG, WEBP, SVG).")
      return
    }

    setUploadingLogo(true)
    try {
      if (!company.id) throw new Error("ID de empresa no disponible")
      const updatedCompany = await api.companies.uploadLogo(company.id, file)
      if (updatedCompany && updatedCompany.logo_url) {
        const fantasia = updatedCompany.nombre_fantasia || updatedCompany.nombre || company.nombre || ""
        const merged = { ...company, ...updatedCompany, nombre: fantasia, nombre_fantasia: fantasia }
        setCompany(merged)
        setReceiptConfig(prev => {
          const updated = { ...prev, logo_url: updatedCompany.logo_url || "" }
          localStorage.setItem("pos_receipt_template_config", JSON.stringify(updated))
          return updated
        })
        localStorage.setItem("pos_company_data", JSON.stringify(merged))
        toast.success("¡Logotipo Guardado!", "El archivo de imagen se subió al servidor y se asignó a la empresa y facturas.")
      }
    } catch (err: any) {
      const msg = typeof err?.detail === "string" ? err.detail : err?.message || (typeof err === "object" ? JSON.stringify(err) : String(err))
      toast.error("Error al subir imagen", msg)
    } finally {
      setUploadingLogo(false)
      if (logoFileInputRef.current) logoFileInputRef.current.value = ""
    }
  }

  // Guardar Cambios en Base de Datos
  const handleSaveCompany = async () => {
    setSaving(true)
    try {
      const fantasia = company.nombre_fantasia || company.nombre || ""
      const updatedConfig = {
        ...(company.config || {}),
        timbrado_dnit: (company.config as any)?.timbrado_dnit || "18545636",
        receipt_template: receiptConfig,
      }
      const payload: Partial<Company> = {
        ...company,
        nombre: fantasia,
        nombre_fantasia: fantasia,
        config: updatedConfig,
      }
      let updatedComp: Company | null = null
      if (company.id) {
        updatedComp = await api.companies.update(company.id, payload)
      }
      const savedCompany = updatedComp ? { ...updatedComp, nombre: fantasia, nombre_fantasia: fantasia, config: updatedConfig } : { ...company, nombre: fantasia, nombre_fantasia: fantasia, config: updatedConfig }
      setCompany(savedCompany)
      localStorage.setItem("pos_company_data", JSON.stringify(savedCompany))
      localStorage.setItem("pos_receipt_template_config", JSON.stringify(receiptConfig))
      toast.success("¡Datos Fiscales Guardados en DB!", "Los parámetros tributarios, logotipo y plantilla se han persistido correctamente en PostgreSQL y en las cajas.")
    } catch (err: any) {
      const msg = typeof err?.detail === "string" ? err.detail : err?.message || (typeof err === "object" ? JSON.stringify(err) : String(err))
      toast.error("Error al guardar en base de datos", msg)
    } finally {
      setSaving(false)
    }
  }

  // Guardar Formato de Ticket en Configuración Local y Base de Datos Global
  const handleSaveReceiptTemplate = async () => {
    setSaving(true)
    try {
      localStorage.setItem("pos_receipt_template_config", JSON.stringify(receiptConfig))
      if (company.id) {
        const updatedConfig = {
          ...(company.config || {}),
          receipt_template: receiptConfig,
        }
        await api.companies.update(company.id, {
          config: updatedConfig
        })
      }
      toast.success("¡Plantilla de Factura Guardada en DB!", "El nuevo diseño de ticket rige inmediatamente para todas las cajas POS y el Electron.")
    } catch (err: any) {
      toast.error("Error al guardar plantilla", err?.message || String(err))
    } finally {
      setSaving(false)
    }
  }

  const handleResetReceiptTemplate = () => {
    setReceiptConfig(DEFAULT_RECEIPT_CONFIG)
    localStorage.setItem("pos_receipt_template_config", JSON.stringify(DEFAULT_RECEIPT_CONFIG))
    toast.info("Valores por Defecto Restaurados", "Se reestableció el diseño estándar de Supermercado Extra.")
  }

  const handleTestPrint = async () => {
    toast.info("Enviando Ticket de Prueba", "Generando impresión de demostración en impresora térmica...")
    const sampleHtml = document.getElementById("receipt-preview-content")?.innerHTML
    if (sampleHtml && (window as any).electronAPI?.printReceipt) {
      await (window as any).electronAPI.printReceipt(sampleHtml)
    } else {
      const printWindow = window.open("", "_blank")
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head><title>Impresión de Prueba - Factura Térmica</title></head>
            <body style="margin: 0; padding: 10px; font-family: monospace;">
              ${sampleHtml}
              <script>window.print(); setTimeout(() => window.close(), 1500);</script>
            </body>
          </html>
        `)
        printWindow.document.close()
      }
    }
  }

  const handleSaveCurrencies = async () => {
    setSaving(true)
    try {
      const currencyMap: Record<string, { compra: number; venta: number; activo: boolean }> = {}
      let brlVenta = 1420
      let usdVenta = 7550
      let arsVenta = 5.8

      currencies.forEach(c => {
        currencyMap[c.codigo] = { compra: Number(c.compra), venta: Number(c.venta), activo: c.activo }
        if (c.codigo === "BRL") brlVenta = Number(c.venta)
        if (c.codigo === "USD") usdVenta = Number(c.venta)
        if (c.codigo === "ARS") arsVenta = Number(c.venta)
      })

      localStorage.setItem("pos_currency_rates", JSON.stringify({ BRL: brlVenta, USD: usdVenta, ARS: arsVenta }))
      localStorage.setItem("pos_currencies_config", JSON.stringify(currencies))

      if (company.id) {
        const updatedConfig = {
          ...(company.config || {}),
          currencies: currencyMap,
        }
        await api.companies.update(company.id, { config: updatedConfig } as any)
        setCompany(prev => ({ ...prev, config: updatedConfig }))
      }

      toast.success("¡Cotizaciones Guardadas en DB!", "Las tasas de cambio actualizadas se guardaron en PostgreSQL y rigen inmediatamente en todas las cajas POS y Kioscos.")
    } catch (err: any) {
      toast.error("Error al guardar cotizaciones", err?.message || String(err))
    } finally {
      setSaving(false)
    }
  }

  const handleTogglePayment = (id: string) => {
    setPaymentMethods(prev => {
      const updated = prev.map(p => {
        if (p.id === id) {
          const next = !p.activo
          return { ...p, activo: next }
        }
        return p
      })
      const raw = updated.map(({ icon, ...rest }) => rest)
      localStorage.setItem("pos_payment_methods", JSON.stringify(raw))
      return updated
    })
  }

  const handleSavePaymentMethods = async () => {
    setSaving(true)
    try {
      const raw = paymentMethods.map(({ icon, ...rest }) => rest)
      localStorage.setItem("pos_payment_methods", JSON.stringify(raw))
      if (company.id) {
        const updatedConfig = {
          ...(company.config || {}),
          payment_methods: raw,
        }
        await api.companies.update(company.id, { config: updatedConfig } as any)
        setCompany(prev => ({ ...prev, config: updatedConfig }))
      }
      toast.success("¡Medios de Pago Guardados!", "Los cambios se sincronizaron con la base de datos y rigen en todas las cajas.")
    } catch (e) {
      toast.error("Error", "No se pudo guardar la configuración de medios de pago.")
    } finally {
      setSaving(false)
    }
  }

  const handleAddPaymentMethod = () => {
    if (!newPaymentForm.codigo.trim() || !newPaymentForm.nombre.trim()) {
      toast.warning("Campos Requeridos", "Ingrese el código y el nombre del medio de pago.")
      return
    }

    const cleanCode = newPaymentForm.codigo.trim().toUpperCase().replace(/\s+/g, "_")
    const newId = `pm-${Date.now()}`
    const iconComponent = newPaymentForm.tipo === "qr" ? QrCode :
                          newPaymentForm.tipo === "app" ? Smartphone :
                          newPaymentForm.tipo === "club" ? ShieldCheck :
                          newPaymentForm.tipo === "cash" ? Banknote : CreditCard

    const newItem = {
      id: newId,
      codigo: cleanCode,
      nombre: newPaymentForm.nombre.trim(),
      icon: iconComponent,
      comision_pct: Number(newPaymentForm.comision_pct) || 0,
      activo: true,
      custom: true,
    }

    setPaymentMethods(prev => {
      const updated = [...prev, newItem]
      const raw = updated.map(({ icon, ...rest }) => rest)
      localStorage.setItem("pos_payment_methods", JSON.stringify(raw))
      return updated
    })

    setNewPaymentForm({ codigo: "", nombre: "", comision_pct: 0, tipo: "card" })
    setShowAddPaymentModal(false)
    toast.success("Medio Agregado", `Se habilitó "${newItem.nombre}" para cobros en caja.`)
  }

  const handleDeletePaymentMethod = (id: string) => {
    setPaymentMethods(prev => {
      const updated = prev.filter(p => p.id !== id)
      const raw = updated.map(({ icon, ...rest }) => rest)
      localStorage.setItem("pos_payment_methods", JSON.stringify(raw))
      return updated
    })
    toast.info("Medio Removido", "Se eliminó el medio de pago personalizado.")
  }

  return (
    <div className="space-y-6 animate-fade-in-up pb-16">
      {/* ── LUXURY COMMAND DECK HEADER ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950/90 text-white p-7 border border-blue-500/20 shadow-2xl shadow-blue-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 border border-blue-400/30 text-white flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <Settings className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-blue-400 uppercase bg-blue-500/10 px-2.5 py-0.5 rounded-md border border-blue-500/20">
                    SISTEMA CENTRAL & CONFIGURACIÓN GLOBAL
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Base de Datos PostgreSQL 16
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Configuración del Sistema
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Diseñador de comprobantes impresos, cotizaciones de frontera en vivo, parámetros fiscales y reglas de negocio
                </p>
              </div>
            </div>

            {/* Micro pills */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado S.A. (RUC 80092451-2)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-cyan-300">
                🧾 Ticket Térmico 80mm ESC/POS
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-400">
                🇵🇾 Cotizaciones BRL/USD en Vivo
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start lg:self-auto flex-wrap">
            {tab === "receipt_builder" && (
              <>
                <button
                  onClick={handleResetReceiptTemplate}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border border-slate-700 bg-slate-800/80 text-xs font-bold text-slate-200 hover:bg-slate-700 transition cursor-pointer shadow-sm"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restaurar Estándar
                </button>
                <button
                  onClick={handleTestPrint}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border border-blue-500/40 bg-blue-500/10 text-xs font-bold text-blue-300 hover:bg-blue-500/20 transition cursor-pointer shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Probar Impresión
                </button>
                <button
                  onClick={handleSaveReceiptTemplate}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-lg shadow-emerald-500/25 transition cursor-pointer active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  Guardar Plantilla
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-blue-500 to-indigo-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">RUC Registrado</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400">
            {company.ruc || "80092451-2"}
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Establecimiento: <strong className="text-slate-700 dark:text-slate-200 font-mono">001 Central</strong></span>
            <span className="text-blue-600 font-bold font-mono">PostgreSQL</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-emerald-500 to-teal-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Formato Ticket Térmico</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600">
              <Printer className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
            {receiptConfig.ancho_papel} · {receiptConfig.fuente_ticket}
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Extra Club: <strong className="text-emerald-600 font-bold">{receiptConfig.habilitar_extra_club ? "Activo" : "Off"}</strong></span>
            <span className="text-emerald-600 font-bold font-mono">80mm ESC/POS</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-purple-500 to-pink-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Marketing & Cuponera</span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600">
              <Gift className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-purple-600 dark:text-purple-400 truncate">
            {receiptConfig.habilitar_cupon_descuento ? `Cupón: ${receiptConfig.cupon_codigo}` : "Sin cupón activo"}
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Promo de Pie: <strong className="text-slate-700 dark:text-slate-200">{receiptConfig.habilitar_mensaje_marketing ? "Sí" : "No"}</strong></span>
            <span className="text-purple-600 font-bold font-mono">Fidelización</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-amber-500 to-orange-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Cotización Frontera</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
            1 R$ = {(currencies.find(c => c.codigo === "BRL")?.venta || 0).toLocaleString("es-PY")} Gs.
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Dólar: <strong className="text-slate-700 dark:text-slate-200 font-mono">{(currencies.find(c => c.codigo === "USD")?.venta || 0).toLocaleString("es-PY")} Gs.</strong></span>
            <span className="text-amber-600 font-bold font-mono">Sincronizado</span>
          </div>
        </div>
      </div>

      {/* ── TABS PRINCIPALES ── */}
      <div className="flex gap-1.5 bg-gray-100/60 dark:bg-slate-800/60 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-1.5 w-full overflow-x-auto shadow-inner">
        {[
          { key: "receipt_builder", label: "🎨 Diseñador de Factura / Ticket Térmico", icon: Printer },
          { key: "company", label: "🏢 Datos Fiscales de la Empresa", icon: Building2 },
          { key: "currencies", label: "💵 Pizarra de Cotizaciones (Cajas)", icon: DollarSign },
          { key: "payments", label: "💳 Medios de Pago Habilitados", icon: CreditCard },
          { key: "fiscal", label: "⚙️ Parámetros Operativos & Fiscales", icon: Sliders },
          { key: "kiosk", label: "📺 Kiosco Verificador & Pantallas", icon: Monitor },
          { key: "cajas", label: "🖥️ Cajas y Puntos de Emisión", icon: Store },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as Tab)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black whitespace-nowrap transition-all duration-200 cursor-pointer ${
              tab === t.key
                ? "bg-white dark:bg-slate-700 shadow-md text-blue-600 dark:text-white ring-1 ring-blue-500/20"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-slate-700/50"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── 1. TAB: DISEÑADOR PREMIUM DE FACTURA / TICKET TÉRMICO CON LIVE PREVIEW ── */}
      {tab === "receipt_builder" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* PANEL IZQUIERDO: FORMULARIO Y CONTROLES DEL CONSTRUCTOR (7 COLS) */}
          <div className="lg:col-span-7 space-y-4">
            
            {/* Sub-pestañas de edición del ticket */}
            <div className="flex gap-1 bg-white dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 overflow-x-auto">
              {[
                { id: "header", label: "Cabecera & Logo", icon: Building2 },
                { id: "body", label: "Cuerpo & Productos", icon: FileText },
                { id: "totals", label: "Totales & Pagos", icon: DollarSign },
                { id: "club", label: "Extra Club", icon: Award },
                { id: "donacion", label: "Abre tu Corazón", icon: Heart },
                { id: "marketing", label: "Marketing & Cupones", icon: Flame },
                { id: "footer", label: "Pie & Corte", icon: Scissors },
              ].map(sec => (
                <button
                  key={sec.id}
                  onClick={() => setDesignerSection(sec.id as any)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    designerSection === sec.id
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                  }`}
                >
                  <sec.icon className="w-3.5 h-3.5" />
                  {sec.label}
                </button>
              ))}
            </div>

            {/* SECCIÓN 1: CABECERA & LOGO */}
            {designerSection === "header" && (
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4 animate-fade-in">
                <div className="border-b border-slate-100 dark:border-slate-700 pb-3">
                  <h3 className="text-sm font-black text-gray-900 dark:text-white">Identidad Visual & Encabezado de la Factura</h3>
                  <p className="text-xs text-gray-500">Personalice los datos de la empresa, timbrado, logotipo y contacto que encabezan el ticket.</p>
                </div>

                <div className="space-y-3">
                  {/* Switch Logotipo */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-gray-900 dark:text-white block">Imprimir Logotipo de Empresa en Ticket</span>
                      <span className="text-[11px] text-gray-500">Utiliza el logotipo configurado en la pestaña "Datos Fiscales de la Empresa"</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={receiptConfig.mostrar_logo}
                      onChange={e => setReceiptConfig({ ...receiptConfig, mostrar_logo: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                    />
                  </div>

                  {receiptConfig.mostrar_logo && (
                    <div className="p-3 rounded-xl bg-slate-50/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                          {company.logo_url ? (
                            <img src={company.logo_url} alt="Logo" className="max-w-full max-h-full object-contain p-0.5" />
                          ) : (
                            <span className="text-[9px] text-slate-400 font-bold text-center">Sin Logo</span>
                          )}
                        </div>
                        <div>
                          <span className="text-xs font-bold text-gray-800 dark:text-slate-200 block">
                            {company.logo_url ? "Logotipo Activo" : "No has subido un logotipo aún"}
                          </span>
                          <span className="text-[11px] text-gray-500">
                            Puedes subirlo en la pestaña <button type="button" onClick={() => setTab("company")} className="text-blue-600 dark:text-blue-400 font-bold underline cursor-pointer">Datos Fiscales</button>
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Ancho en Ticket (px):</label>
                        <input
                          type="number"
                          value={receiptConfig.logo_ancho_px}
                          onChange={e => setReceiptConfig({ ...receiptConfig, logo_ancho_px: Number(e.target.value) })}
                          className="w-24 text-xs font-mono font-bold p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Nombre Comercial de Fantasía:</label>
                      <input
                        type="text"
                        value={receiptConfig.nombre_fantasia}
                        onChange={e => setReceiptConfig({ ...receiptConfig, nombre_fantasia: e.target.value })}
                        className="w-full text-xs font-bold p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Razón Social Fiscal:</label>
                      <input
                        type="text"
                        value={receiptConfig.razon_social}
                        onChange={e => setReceiptConfig({ ...receiptConfig, razon_social: e.target.value })}
                        className="w-full text-xs font-bold p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">RUC Emisor:</label>
                      <input
                        type="text"
                        value={receiptConfig.ruc}
                        onChange={e => setReceiptConfig({ ...receiptConfig, ruc: e.target.value })}
                        className="w-full text-xs font-mono font-bold p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Timbrado Nº:</label>
                      <input
                        type="text"
                        value={receiptConfig.timbrado}
                        onChange={e => setReceiptConfig({ ...receiptConfig, timbrado: e.target.value })}
                        className="w-full text-xs font-mono font-bold p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Validez Timbrado:</label>
                      <input
                        type="text"
                        value={receiptConfig.timbrado_vencimiento}
                        onChange={e => setReceiptConfig({ ...receiptConfig, timbrado_vencimiento: e.target.value })}
                        className="w-full text-xs font-mono p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Dirección del Local:</label>
                      <input
                        type="text"
                        value={receiptConfig.direccion}
                        onChange={e => setReceiptConfig({ ...receiptConfig, direccion: e.target.value })}
                        className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Ciudad / País:</label>
                      <input
                        type="text"
                        value={receiptConfig.ciudad}
                        onChange={e => setReceiptConfig({ ...receiptConfig, ciudad: e.target.value })}
                        className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Teléfono / Celular:</label>
                      <input
                        type="text"
                        value={receiptConfig.telefono}
                        onChange={e => setReceiptConfig({ ...receiptConfig, telefono: e.target.value })}
                        className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Slogan Comercial:</label>
                      <input
                        type="text"
                        value={receiptConfig.slogan}
                        onChange={e => setReceiptConfig({ ...receiptConfig, slogan: e.target.value })}
                        className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SECCIÓN 2: CUERPO & PRODUCTOS */}
            {designerSection === "body" && (
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4 animate-fade-in">
                <div className="border-b border-slate-100 dark:border-slate-700 pb-3">
                  <h3 className="text-sm font-black text-gray-900 dark:text-white">Calibración de Impresión, Márgenes & Tipografía</h3>
                  <p className="text-xs text-gray-500">Ajuste libremente el ancho útil, márgenes físicos y fuentes para evitar cualquier corte o desborde en su impresora térmica.</p>
                </div>

                <div className="space-y-4">
                  {/* Fila 1: Calibración Física de Ancho y Márgenes */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-900 dark:text-white">Calibración Dimensional del Cabezal Térmico:</span>
                      <span className="text-[11px] text-gray-500 font-mono">Impresora 80mm / 58mm</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Ancho Útil (mm):</label>
                        <input
                          type="number"
                          min={40}
                          max={90}
                          step={1}
                          value={receiptConfig.ancho_imprimible_mm || 68}
                          onChange={e => setReceiptConfig({ ...receiptConfig, ancho_imprimible_mm: Number(e.target.value) })}
                          className="w-full text-xs font-mono font-black p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white text-center"
                        />
                        <span className="text-[9px] text-gray-400 block mt-0.5">Sugerido: 68-72mm</span>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Margen Izq. (mm):</label>
                        <input
                          type="number"
                          min={-5}
                          max={15}
                          step={0.5}
                          value={receiptConfig.margen_izq_mm || 0}
                          onChange={e => setReceiptConfig({ ...receiptConfig, margen_izq_mm: Number(e.target.value) })}
                          className="w-full text-xs font-mono font-bold p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white text-center"
                        />
                        <span className="text-[9px] text-gray-400 block mt-0.5">0 = Sin gap</span>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Margen Der. (mm):</label>
                        <input
                          type="number"
                          min={-5}
                          max={15}
                          step={0.5}
                          value={receiptConfig.margen_der_mm || 0}
                          onChange={e => setReceiptConfig({ ...receiptConfig, margen_der_mm: Number(e.target.value) })}
                          className="w-full text-xs font-mono font-bold p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white text-center"
                        />
                        <span className="text-[9px] text-gray-400 block mt-0.5">0 = Borde total</span>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Interlineado:</label>
                        <input
                          type="number"
                          min={1.0}
                          max={2.0}
                          step={0.05}
                          value={receiptConfig.interlineado || 1.22}
                          onChange={e => setReceiptConfig({ ...receiptConfig, interlineado: Number(e.target.value) })}
                          className="w-full text-xs font-mono font-bold p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white text-center"
                        />
                        <span className="text-[9px] text-gray-400 block mt-0.5">Normal: 1.15-1.25</span>
                      </div>
                    </div>
                  </div>

                  {/* Fila 2: Tipografía & Tamaño */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Rollo de Papel:</label>
                      <select
                        value={receiptConfig.ancho_papel}
                        onChange={e => setReceiptConfig({ ...receiptConfig, ancho_papel: e.target.value as any })}
                        className="w-full text-xs font-bold p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
                      >
                        <option value="80mm">80 mm (Estándar Supermercado)</option>
                        <option value="58mm">58 mm (Compacto / Punto Móvil)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Tipografía ESC/POS:</label>
                      <select
                        value={receiptConfig.fuente_ticket}
                        onChange={e => setReceiptConfig({ ...receiptConfig, fuente_ticket: e.target.value as any })}
                        className="w-full text-xs font-mono font-bold p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
                      >
                        <option value="Consolas">Consolas (Recomendada / Nitidez)</option>
                        <option value="Courier New">Courier New (Clásica)</option>
                        <option value="Segoe UI">Segoe UI (Moderna Proporcional)</option>
                        <option value="Lucida Console">Lucida Console</option>
                        <option value="Monospace">Monospace Genérico</option>
                        <option value="Arial">Arial (Sans-serif)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Tamaño Fuente (px):</label>
                      <input
                        type="number"
                        min={8}
                        max={16}
                        step={0.5}
                        value={receiptConfig.tamano_fuente_px}
                        onChange={e => setReceiptConfig({ ...receiptConfig, tamano_fuente_px: Number(e.target.value) })}
                        className="w-full text-xs font-mono font-bold p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white text-center"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    {[
                      { key: "mostrar_cajero", label: "Mostrar Nombre del Cajero" },
                      { key: "mostrar_caja", label: "Mostrar Punto de Expedición (Caja)" },
                      { key: "mostrar_cliente", label: "Mostrar Nombre del Cliente" },
                      { key: "mostrar_ruc_cliente", label: "Mostrar RUC / C.I. del Cliente" },
                      { key: "mostrar_sku", label: "Mostrar Código SKU en cada ítem" },
                      { key: "mostrar_balanza_origen", label: "Distinguir Ítems Pesados en Balanza" },
                    ].map(opt => (
                      <div key={opt.key} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-900 dark:text-white">{opt.label}</span>
                        <input
                          type="checkbox"
                          checked={(receiptConfig as any)[opt.key]}
                          onChange={e => setReceiptConfig({ ...receiptConfig, [opt.key]: e.target.checked })}
                          className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* SECCIÓN 3: TOTALES & PAGOS */}
            {designerSection === "totals" && (
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4 animate-fade-in">
                <div className="border-b border-slate-100 dark:border-slate-700 pb-3">
                  <h3 className="text-sm font-black text-gray-900 dark:text-white">Desglose de Totales, Multimoneda y Pagos</h3>
                  <p className="text-xs text-gray-500">Defina qué monedas secundarias, cuadros tributarios y medios de pago se detallan en el ticket.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: "mostrar_multimoneda", label: "Cuadro Multimoneda de Totales" },
                    { key: "mostrar_equivalente_brl", label: "Equivalente en Reales Brasileños (R$)" },
                    { key: "mostrar_equivalente_usd", label: "Equivalente en Dólares (US$)" },
                    { key: "mostrar_liquidacion_iva", label: "Liquidación Legal de IVA (10%, 5%, Exentas)" },
                    { key: "mostrar_desglose_pagos", label: "Desglose de Formas de Pago (Lote/Voucher)" },
                    { key: "mostrar_vuelto_extranjero", label: "Detalle de Vuelto en Reales/Dólares" },
                  ].map(opt => (
                    <div key={opt.key} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-900 dark:text-white">{opt.label}</span>
                      <input
                        type="checkbox"
                        checked={(receiptConfig as any)[opt.key]}
                        onChange={e => setReceiptConfig({ ...receiptConfig, [opt.key]: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SECCIÓN 4: FIDELIZACIÓN EXTRA CLUB */}
            {designerSection === "club" && (
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4 animate-fade-in">
                <div className="border-b border-slate-100 dark:border-slate-700 pb-3">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-500" />
                    <h3 className="text-sm font-black text-gray-900 dark:text-white">Programa de Fidelización Extra Club en Ticket</h3>
                  </div>
                  <p className="text-xs text-gray-500">Premie a los clientes con puntos automáticos o invítelos a sumarse directamente desde la factura.</p>
                </div>

                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-amber-900 dark:text-amber-300 block">Habilitar Módulo Extra Club en el Ticket</span>
                      <span className="text-[11px] text-amber-700 dark:text-amber-400">Imprime el saldo de puntos del socio o la invitación a registrarse</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={receiptConfig.habilitar_extra_club}
                      onChange={e => setReceiptConfig({ ...receiptConfig, habilitar_extra_club: e.target.checked })}
                      className="w-4 h-4 text-amber-600 rounded cursor-pointer"
                    />
                  </div>

                  {receiptConfig.habilitar_extra_club && (
                    <>
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">
                          Mensaje para Cliente Socio (Muestra Puntos Ganados y Saldo Total):
                        </label>
                        <textarea
                          rows={2}
                          value={receiptConfig.mensaje_socio_club}
                          onChange={e => setReceiptConfig({ ...receiptConfig, mensaje_socio_club: e.target.value })}
                          className="w-full text-xs font-mono p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">
                          Mensaje para Consumidor Final (Invitación a Registrarse):
                        </label>
                        <textarea
                          rows={3}
                          value={receiptConfig.mensaje_invitacion_club}
                          onChange={e => setReceiptConfig({ ...receiptConfig, mensaje_invitacion_club: e.target.value })}
                          className="w-full text-xs font-mono p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-900 dark:text-white">Imprimir QR de Registro Club</span>
                          <input
                            type="checkbox"
                            checked={receiptConfig.mostrar_qr_club}
                            onChange={e => setReceiptConfig({ ...receiptConfig, mostrar_qr_club: e.target.checked })}
                            className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">URL de Registro en QR:</label>
                          <input
                            type="text"
                            value={receiptConfig.qr_url_club}
                            onChange={e => setReceiptConfig({ ...receiptConfig, qr_url_club: e.target.value })}
                            className="w-full text-xs font-mono p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* SECCIÓN 5: MARKETING & CUPONERA */}
            {designerSection === "marketing" && (
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4 animate-fade-in">
                <div className="border-b border-slate-100 dark:border-slate-700 pb-3">
                  <div className="flex items-center gap-2">
                    <Flame className="w-5 h-5 text-rose-500" />
                    <h3 className="text-sm font-black text-gray-900 dark:text-white">Promociones, Avisos de Marketing & Cuponera</h3>
                  </div>
                  <p className="text-xs text-gray-500">Incentive la recompra entregando cupones con fecha de vencimiento al pie del comprobante.</p>
                </div>

                <div className="space-y-4">
                  {/* Mensaje de Marketing General */}
                  <div className="space-y-2">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-900 dark:text-white">Imprimir Mensaje / Promoción de Marketing</span>
                      <input
                        type="checkbox"
                        checked={receiptConfig.habilitar_mensaje_marketing}
                        onChange={e => setReceiptConfig({ ...receiptConfig, habilitar_mensaje_marketing: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                      />
                    </div>
                    {receiptConfig.habilitar_mensaje_marketing && (
                      <textarea
                        rows={2}
                        value={receiptConfig.mensaje_marketing}
                        onChange={e => setReceiptConfig({ ...receiptConfig, mensaje_marketing: e.target.value })}
                        placeholder="Ej: ¡Miércoles de Carnicería: 15% OFF en cortes seleccionados!"
                        className="w-full text-xs font-mono p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
                      />
                    )}
                  </div>

                  {/* Cuponera de Recompra */}
                  <div className="space-y-2 border-t border-slate-100 dark:border-slate-700 pt-3">
                    <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-purple-900 dark:text-purple-300 block">Generar Cupón de Descuento para Próxima Visita</span>
                        <span className="text-[11px] text-purple-700 dark:text-purple-400">Imprime un cupón recortable con código y validez</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={receiptConfig.habilitar_cupon_descuento}
                        onChange={e => setReceiptConfig({ ...receiptConfig, habilitar_cupon_descuento: e.target.checked })}
                        className="w-4 h-4 text-purple-600 rounded cursor-pointer"
                      />
                    </div>

                    {receiptConfig.habilitar_cupon_descuento && (
                      <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-slate-50/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Código del Cupón:</label>
                          <input
                            type="text"
                            value={receiptConfig.cupon_codigo}
                            onChange={e => setReceiptConfig({ ...receiptConfig, cupon_codigo: e.target.value })}
                            className="w-full text-xs font-mono font-black p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white uppercase"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Beneficio / Descripción:</label>
                          <input
                            type="text"
                            value={receiptConfig.cupon_descripcion}
                            onChange={e => setReceiptConfig({ ...receiptConfig, cupon_descripcion: e.target.value })}
                            className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Validez (Días):</label>
                          <input
                            type="number"
                            value={receiptConfig.cupon_validez_dias}
                            onChange={e => setReceiptConfig({ ...receiptConfig, cupon_validez_dias: Number(e.target.value) })}
                            className="w-full text-xs font-mono p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* SECCIÓN 5.5: CAMPAÑA SOLIDARIA ABRE TU CORAZÓN */}
            {designerSection === "donacion" && (
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4 animate-fade-in">
                <div className="border-b border-slate-100 dark:border-slate-700 pb-3">
                  <h3 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2">
                    <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
                    Campaña Solidaria "Abre tu Corazón"
                  </h3>
                  <p className="text-xs text-gray-500">Personalice el título, mensaje institucional y enlace impreso al pie de factura cuando hay donación.</p>
                </div>

                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-gray-900 dark:text-white block">Imprimir Mensaje Solidario en Factura</span>
                      <span className="text-[11px] text-gray-500">Aparece automáticamente en el comprobante fiscal cuando el cajero registra una donación voluntaria.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={receiptConfig.donacion_activa}
                      onChange={e => setReceiptConfig({ ...receiptConfig, donacion_activa: e.target.checked })}
                      className="w-4 h-4 text-rose-600 rounded cursor-pointer"
                    />
                  </div>

                  {receiptConfig.donacion_activa && (
                    <div className="space-y-3 pt-2">
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Título del Bloque Solidario:</label>
                        <input
                          type="text"
                          value={receiptConfig.donacion_titulo}
                          onChange={e => setReceiptConfig({ ...receiptConfig, donacion_titulo: e.target.value })}
                          placeholder="* ABRE TU CORAZON *"
                          className="w-full text-xs font-mono font-bold p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Mensaje de Agradecimiento / Beneficiario:</label>
                        <input
                          type="text"
                          value={receiptConfig.donacion_mensaje}
                          onChange={e => setReceiptConfig({ ...receiptConfig, donacion_mensaje: e.target.value })}
                          placeholder="Gracias por colaborar con el Centro Amor y Esperanza."
                          className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Página Web o Enlace Institucional:</label>
                        <input
                          type="text"
                          value={receiptConfig.donacion_web}
                          onChange={e => setReceiptConfig({ ...receiptConfig, donacion_web: e.target.value })}
                          placeholder="www.centroamoresperanza.org"
                          className="w-full text-xs font-mono p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SECCIÓN 6: PIE & CORTE DE PAPEL */}
            {designerSection === "footer" && (
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4 animate-fade-in">
                <div className="border-b border-slate-100 dark:border-slate-700 pb-3">
                  <h3 className="text-sm font-black text-gray-900 dark:text-white">Pie de Comprobante, SIFEN y Guillotina</h3>
                  <p className="text-xs text-gray-500">Configuración de consulta tributaria digital y saltos de papel para corte sin roturas.</p>
                </div>

                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700/50 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-gray-900 dark:text-white block">Facturación Electrónica (SIFEN) Activa</span>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">Mientras esté apagado, el ticket dice "Factura Contado" o "Factura Crédito" (según Extra Club) en vez de "Factura Electrónica" — no rotula como electrónico un comprobante que todavía no lo es. Cuando se active SIFEN, prender este switch (sin tocar código).</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={receiptConfig.facturacion_electronica}
                      onChange={e => setReceiptConfig({ ...receiptConfig, facturacion_electronica: e.target.checked })}
                      className="w-4 h-4 text-amber-600 rounded cursor-pointer shrink-0 ml-3"
                    />
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-gray-900 dark:text-white block">Número Impreso: Interno de Venta (en vez del correlativo del ticket)</span>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">Prendido (default): el ticket muestra el mismo número que después aparece al Reimprimir (espera ~0.2s a que el servidor confirme la venta). Apagado: imprime el correlativo local al instante, pero ese número NO va a coincidir con el que se ve en Reimprimir.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={receiptConfig.usar_numero_interno_venta}
                      onChange={e => setReceiptConfig({ ...receiptConfig, usar_numero_interno_venta: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded cursor-pointer shrink-0 ml-3"
                    />
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-900 dark:text-white">Mostrar Número de Comprobante en el Ticket</span>
                    <input
                      type="checkbox"
                      checked={receiptConfig.mostrar_numero_comprobante}
                      onChange={e => setReceiptConfig({ ...receiptConfig, mostrar_numero_comprobante: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-900 dark:text-white">QR de Consulta Fiscal SIFEN</span>
                      <input
                        type="checkbox"
                        checked={receiptConfig.mostrar_qr_sifen}
                        onChange={e => setReceiptConfig({ ...receiptConfig, mostrar_qr_sifen: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">URL de Consulta Tributaria:</label>
                      <input
                        type="text"
                        value={receiptConfig.sifen_consulta_url}
                        onChange={e => setReceiptConfig({ ...receiptConfig, sifen_consulta_url: e.target.value })}
                        className="w-full text-xs font-mono p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Mensaje de Despedida:</label>
                    <input
                      type="text"
                      value={receiptConfig.mensaje_despedida}
                      onChange={e => setReceiptConfig({ ...receiptConfig, mensaje_despedida: e.target.value })}
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">
                        Líneas de Salto / Avance antes del Corte (Feed lines):
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={receiptConfig.lineas_salto_corte}
                        onChange={e => setReceiptConfig({ ...receiptConfig, lineas_salto_corte: Number(e.target.value) })}
                        className="w-full text-xs font-mono font-bold p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-900 dark:text-white">Línea Punteada de Corte Visual</span>
                      <input
                        type="checkbox"
                        checked={receiptConfig.mostrar_linea_corte_visual}
                        onChange={e => setReceiptConfig({ ...receiptConfig, mostrar_linea_corte_visual: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                      />
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-gray-900 dark:text-white block">Corte Automático de Papel</span>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400">Apagar solo si la impresora no tiene cuchilla automática (haría un ruido/movimiento raro sin cortar).</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={receiptConfig.corte_automatico}
                        onChange={e => setReceiptConfig({ ...receiptConfig, corte_automatico: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded cursor-pointer shrink-0 ml-3"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* PANEL DERECHO: VISTA PREVIA EN VIVO REALISTA (LIVE SIMULATOR 80MM) (5 COLS) */}
          <div className="lg:col-span-5 space-y-3 sticky top-4">
            
            {/* Barra de control del simulador */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800 text-white border border-slate-700 shadow-md">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-black uppercase tracking-wider">Simulador Térmico ({receiptConfig.ancho_papel})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPreviewCustomerType(previewCustomerType === "socio" ? "consumidor_final" : "socio")}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition cursor-pointer ${
                    previewCustomerType === "socio" ? "bg-amber-500 text-slate-950" : "bg-slate-700 text-slate-300"
                  }`}
                >
                  {previewCustomerType === "socio" ? "⭐ Con Extra Club" : "👤 Consumidor Final"}
                </button>
              </div>
            </div>

            {/* Ticket Térmico Renderizado 100% Realista */}
            <div className="bg-white rounded-xl shadow-2xl p-4 text-black border-2 border-slate-300 overflow-hidden font-mono max-h-[78vh] overflow-y-auto select-none">
              
              <div 
                id="receipt-preview-content"
                style={{
                  fontFamily: receiptConfig.fuente_ticket,
                  fontSize: `${receiptConfig.tamano_fuente_px}px`,
                  lineHeight: receiptConfig.interlineado || 1.22,
                  width: "100%",
                  maxWidth: `${(receiptConfig.ancho_imprimible_mm || 68) * 3.8}px`,
                  paddingLeft: `${(receiptConfig.margen_izq_mm || 0) * 3.8}px`,
                  paddingRight: `${(receiptConfig.margen_der_mm || 0) * 3.8}px`,
                  color: "#000000",
                  margin: "0 auto",
                  boxSizing: "border-box"
                }}
              >
                {/* 1. CABECERA */}
                <div style={{ textAlign: "center", marginBottom: "6px" }}>
                  {receiptConfig.mostrar_logo && (
                    <div style={{ margin: "0 auto 6px auto", width: `${receiptConfig.logo_ancho_px}px`, maxWidth: "100%" }}>
                      {(company.logo_url || receiptConfig.logo_url) ? (
                        <img
                          src={company.logo_url || receiptConfig.logo_url}
                          alt={receiptConfig.nombre_fantasia}
                          style={{ maxWidth: "100%", height: "auto", display: "block", margin: "0 auto" }}
                        />
                      ) : (
                        <div style={{ border: "2px solid #000", padding: "4px 8px", fontWeight: "900", fontSize: "14px", letterSpacing: "1px" }}>
                          ★ LOGO EMPRESA ★
                        </div>
                      )}
                    </div>
                  )}
                  <div style={{ fontSize: "15px", fontWeight: "900", letterSpacing: "0.5px" }}>
                    {receiptConfig.nombre_fantasia}
                  </div>
                  <div style={{ fontSize: "11px", fontWeight: "bold" }}>
                    {receiptConfig.razon_social}
                  </div>
                  <div style={{ fontSize: "10px" }}>
                    RUC: {receiptConfig.ruc} · Tel: {receiptConfig.telefono}
                  </div>
                  <div style={{ fontSize: "10px" }}>
                    {receiptConfig.direccion}
                  </div>
                  <div style={{ fontSize: "10px" }}>
                    {receiptConfig.ciudad}
                  </div>
                  {receiptConfig.slogan && (
                    <div style={{ fontSize: "9.5px", fontStyle: "italic", marginTop: "2px" }}>
                      "{receiptConfig.slogan}"
                    </div>
                  )}
                  <div style={{ fontSize: "10px", marginTop: "3px" }}>
                    Timbrado Nº: <strong>{receiptConfig.timbrado}</strong>
                  </div>
                  <div style={{ fontSize: "10px" }}>
                    Válido hasta: {receiptConfig.timbrado_vencimiento}
                  </div>
                </div>

                {/* 2. DATOS DE FACTURA & CLIENTE */}
                <div style={{ borderTop: "1px dashed #000", borderBottom: "1px dashed #000", padding: "4px 0", margin: "4px 0", fontSize: "10.5px" }}>
                  <div><strong>FACTURA ELECTRÓNICA:</strong> 001-012-0048291</div>
                  <div><strong>FECHA / HORA:</strong> {new Date().toLocaleString("es-PY")}</div>
                  <div><strong>CONDICIÓN:</strong> CONTADO</div>
                  {receiptConfig.mostrar_cajero && (
                    <div><strong>CAJERO:</strong> Juan Silveira ({receiptConfig.punto_expedicion})</div>
                  )}
                  {receiptConfig.mostrar_cliente && (
                    <div>
                      <strong>CLIENTE:</strong> {previewCustomerType === "socio" ? "Gustavo Quevedo (Socio Extra Club)" : "Consumidor Final"}
                    </div>
                  )}
                  {receiptConfig.mostrar_ruc_cliente && (
                    <div>
                      <strong>RUC / CI:</strong> {previewCustomerType === "socio" ? "4444440-1" : "44444401-7"}
                    </div>
                  )}
                </div>

                {/* 3. ÍTEMS FACTURADOS */}
                <table style={{ width: "100%", borderCollapse: "collapse", margin: "6px 0", fontSize: "10.5px" }}>
                  <tbody>
                    {/* Item 1 */}
                    <tr>
                      <td colSpan={2} style={{ fontWeight: "bold", paddingTop: "2px" }}>
                        COCA COLA PET 250ML (6)
                        {receiptConfig.mostrar_sku && <span style={{ fontSize: "9px", fontWeight: "normal" }}> [SKU: 118971]</span>}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: "1px dotted #888" }}>
                      <td style={{ paddingBottom: "3px" }}>2 UN x Gs. 3.500</td>
                      <td style={{ textAlign: "right", fontWeight: "bold", paddingBottom: "3px" }}>Gs. 7.000</td>
                    </tr>

                    {/* Item 2 Pesable */}
                    <tr>
                      <td colSpan={2} style={{ fontWeight: "bold", paddingTop: "4px" }}>
                        TOMATE SALSA KG {receiptConfig.mostrar_balanza_origen && <span style={{ fontSize: "9px", background: "#eee", padding: "1px 3px" }}>⚖️ Balanza</span>}
                        {receiptConfig.mostrar_sku && <span style={{ fontSize: "9px", fontWeight: "normal" }}> [SKU: 120178]</span>}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: "1px dotted #888" }}>
                      <td style={{ paddingBottom: "3px" }}>0.850 KG x Gs. 11.700</td>
                      <td style={{ textAlign: "right", fontWeight: "bold", paddingBottom: "3px" }}>Gs. 9.945</td>
                    </tr>

                    {/* Item 3 */}
                    <tr>
                      <td colSpan={2} style={{ fontWeight: "bold", paddingTop: "4px" }}>
                        QUESO MUZZARELA KG {receiptConfig.mostrar_balanza_origen && <span style={{ fontSize: "9px", background: "#eee", padding: "1px 3px" }}>⚖️ Balanza</span>}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: "1px dotted #888" }}>
                      <td style={{ paddingBottom: "3px" }}>0.450 KG x Gs. 55.777</td>
                      <td style={{ textAlign: "right", fontWeight: "bold", paddingBottom: "3px" }}>Gs. 25.100</td>
                    </tr>
                  </tbody>
                </table>

                {/* 4. TOTALES & MULTIMONEDA */}
                <div style={{ borderTop: "1px dashed #000", paddingTop: "4px", marginTop: "4px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", fontWeight: "900" }}>
                    <span>TOTAL A PAGAR:</span>
                    <span>Gs. 42.045</span>
                  </div>

                  {receiptConfig.mostrar_multimoneda && (
                    <div style={{ fontSize: "10px", marginTop: "2px", color: "#222" }}>
                      {receiptConfig.mostrar_equivalente_brl && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>Equivalente en Reales:</span>
                          <span>R$ 29.60</span>
                        </div>
                      )}
                      {receiptConfig.mostrar_equivalente_usd && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>Equivalente en Dólares:</span>
                          <span>US$ 5.56</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 5. DESGLOSE DE PAGOS */}
                {receiptConfig.mostrar_desglose_pagos && (
                  <div style={{ borderTop: "1px dotted #000", marginTop: "4px", paddingTop: "3px", fontSize: "10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Forma de Pago:</span>
                      <span style={{ fontWeight: "bold" }}>EFECTIVO MULTIMONEDA</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Monto Recibido:</span>
                      <span>Gs. 50.000</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "11px", marginTop: "1px" }}>
                      <span>VUELTO ENTREGADO:</span>
                      <span>Gs. 7.955 {receiptConfig.mostrar_vuelto_extranjero ? "(R$ 5.60)" : ""}</span>
                    </div>
                  </div>
                )}

                {/* 6. LIQUIDACIÓN IVA */}
                {receiptConfig.mostrar_liquidacion_iva && (
                  <div style={{ borderTop: "1px dashed #000", marginTop: "5px", paddingTop: "4px", fontSize: "9.5px" }}>
                    <div style={{ fontWeight: "bold" }}>LIQUIDACIÓN DEL IVA (Ley Nº 6380/19):</div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Gravadas 10%: Gs. 38.223</span>
                      <span>IVA 10%: Gs. 3.822</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Gravadas 5%: Gs. 0</span>
                      <span>IVA 5%: Gs. 0</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
                      <span>TOTAL IVA LIQUIDADO:</span>
                      <span>Gs. 3.822</span>
                    </div>
                  </div>
                )}

                {/* 7. FIDELIZACIÓN EXTRA CLUB */}
                {receiptConfig.habilitar_extra_club && (
                  <div style={{ border: "1px dashed #000", padding: "4px", margin: "6px 0", textAlign: "center", fontSize: "10px" }}>
                    {previewCustomerType === "socio" ? (
                      <>
                        <div style={{ fontWeight: "900", fontSize: "10.5px" }}>★ CLUB FIDELIDAD EXTRA ★</div>
                        <div style={{ marginTop: "2px" }}>{receiptConfig.mensaje_socio_club}</div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontWeight: "900", fontSize: "10.5px" }}>★ ÚNETE AL EXTRA CLUB ★</div>
                        <div style={{ marginTop: "2px", fontSize: "9px" }}>{receiptConfig.mensaje_invitacion_club}</div>
                        {receiptConfig.mostrar_qr_club && (
                          <div style={{ margin: "4px auto 0 auto", width: "70px", height: "70px", border: "1px solid #000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "8px", fontWeight: "bold" }}>
                            [QR REGISTRO]
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* 8. MARKETING & CUPONERA */}
                {receiptConfig.habilitar_mensaje_marketing && receiptConfig.mensaje_marketing && (
                  <div style={{ textAlign: "center", margin: "5px 0", fontSize: "9.5px", fontWeight: "bold" }}>
                    {receiptConfig.mensaje_marketing}
                  </div>
                )}

                {receiptConfig.habilitar_cupon_descuento && (
                  <div style={{ border: "1px dashed #333", padding: "4px", margin: "6px 0", textAlign: "center" }}>
                    <div style={{ fontSize: "9px", textTransform: "uppercase" }}>✂ CUPÓN DE RECOMPRA ✂</div>
                    <div style={{ fontSize: "13px", fontWeight: "900", letterSpacing: "1px", margin: "2px 0" }}>
                      {receiptConfig.cupon_codigo}
                    </div>
                    <div style={{ fontSize: "9.5px", fontWeight: "bold" }}>{receiptConfig.cupon_descripcion}</div>
                    <div style={{ fontSize: "8.5px", color: "#444" }}>Válido por {receiptConfig.cupon_validez_dias} días en todas nuestras sucursales</div>
                  </div>
                )}

                {/* 8.5. CAMPAÑA SOLIDARIA ABRE TU CORAZÓN */}
                {receiptConfig.donacion_activa && (
                  <div style={{ borderTop: "1px dashed #000", marginTop: "6px", paddingTop: "4px", textAlign: "center", fontSize: "10px" }}>
                    <div style={{ fontWeight: "900", letterSpacing: "0.5px" }}>{receiptConfig.donacion_titulo || "* ABRE TU CORAZON *"}</div>
                    <div style={{ margin: "2px 0", fontSize: "9.5px" }}>{receiptConfig.donacion_mensaje || "Gracias por colaborar con el Centro Amor y Esperanza."}</div>
                    <div style={{ fontSize: "8.5px" }}>Conoce más en:</div>
                    <div style={{ fontWeight: "bold", fontSize: "9px" }}>{receiptConfig.donacion_web || "www.centroamoresperanza.org"}</div>
                  </div>
                )}

                {/* 9. PIE FISCAL SIFEN & DESPEDIDA */}
                <div style={{ textAlign: "center", marginTop: "8px", fontSize: "9.5px" }}>
                  {receiptConfig.mostrar_qr_sifen && (
                    <>
                      <div style={{ margin: "2px auto 4px auto", width: "80px", height: "80px", border: "1px solid #000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "8px", fontWeight: "bold" }}>
                        [QR SIFEN DNIT]
                      </div>
                      <div>Consulte su comprobante electrónico en:</div>
                      <div style={{ fontWeight: "bold" }}>{receiptConfig.sifen_consulta_url}</div>
                    </>
                  )}
                  <div style={{ marginTop: "4px", fontWeight: "bold", fontSize: "10.5px" }}>
                    {receiptConfig.mensaje_despedida}
                  </div>
                </div>

                {/* 10. SALTOS DE CORTE */}
                {Array.from({ length: receiptConfig.lineas_salto_corte }).map((_, i) => (
                  <br key={i} />
                ))}

                {receiptConfig.mostrar_linea_corte_visual && (
                  <div style={{ textAlign: "center", borderTop: "1px dashed #666", fontSize: "9px", color: "#666", paddingTop: "3px" }}>
                    ✂ CORTE DE TICKET ✂
                  </div>
                )}
                <br />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. TAB: DATOS FISCALES DE LA EMPRESA ── */}
      {tab === "company" && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
            <div>
              <h2 className="text-base font-black text-gray-900 dark:text-white">Identidad Fiscal y Tributaria</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Datos registrados en el Sistema Integrado de Facturación Electrónica Nacional (SIFEN)</p>
            </div>
            <button
              onClick={handleSaveCompany}
              disabled={saving}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Guardar Cambios en DB
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* LOGOTIPO DE LA EMPRESA CON CARGA DIRECTA DE ARCHIVO */}
            <div className="md:col-span-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center gap-4">
              <div className="w-28 h-28 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0 shadow-inner relative group">
                {company.logo_url ? (
                  <img
                    src={company.logo_url}
                    alt={company.nombre}
                    className="max-w-full max-h-full object-contain p-1"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none"
                    }}
                  />
                ) : (
                  <div className="text-center p-2 text-slate-400">
                    <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-40" />
                    <span className="text-[9px] font-bold block">SIN LOGO</span>
                  </div>
                )}
                {uploadingLogo && (
                  <div className="absolute inset-0 bg-slate-950/70 flex items-center justify-center text-white">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                  </div>
                )}
              </div>

              <div className="flex-1 w-full space-y-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-slate-300 block mb-1">
                    Cargar Archivo de Logotipo Oficial:
                  </label>
                  <input
                    ref={logoFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoFileChange}
                    className="hidden"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={uploadingLogo}
                      onClick={() => logoFileInputRef.current?.click()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {uploadingLogo ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ImageIcon className="w-4 h-4" />
                      )}
                      <span>{uploadingLogo ? "Subiendo archivo..." : "📁 Seleccionar Archivo de Logo (PNG, JPG, SVG)"}</span>
                    </button>
                    {company.logo_url && (
                      <button
                        type="button"
                        onClick={async () => {
                          setCompany(prev => ({ ...prev, logo_url: "" }))
                          setReceiptConfig(prev => ({ ...prev, logo_url: "" }))
                          if (company.id) {
                            await api.companies.update(company.id, { logo_url: "" } as any)
                          }
                          toast.info("Logotipo Eliminado", "Se removió el logotipo de la empresa.")
                        }}
                        className="px-3 py-2 text-rose-500 hover:bg-rose-500/10 text-xs font-bold rounded-xl border border-rose-500/20 cursor-pointer"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                </div>

                <div className="text-[11px] text-gray-500 font-mono">
                  {company.logo_url ? (
                    <span>Archivo en servidor: <strong className="text-blue-600 dark:text-blue-400">{company.logo_url}</strong></span>
                  ) : (
                    <span>Haga clic en el botón para subir el logotipo directamente desde su computadora al servidor.</span>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Nombre Comercial de Fantasía:</label>
              <input
                type="text"
                value={company.nombre_fantasia || company.nombre || ""}
                onChange={e => {
                  const val = e.target.value
                  setCompany({ ...company, nombre: val, nombre_fantasia: val })
                  setReceiptConfig(prev => ({ ...prev, nombre_fantasia: val }))
                }}
                className="w-full text-xs font-bold p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Razón Social Jurídica:</label>
              <input
                type="text"
                value={company.razon_social || ""}
                onChange={e => {
                  const val = e.target.value
                  setCompany({ ...company, razon_social: val })
                  setReceiptConfig(prev => ({ ...prev, razon_social: val }))
                }}
                className="w-full text-xs font-bold p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">RUC:</label>
              <input
                type="text"
                value={company.ruc || ""}
                onChange={e => {
                  const val = e.target.value
                  setCompany({ ...company, ruc: val })
                  setReceiptConfig(prev => ({ ...prev, ruc: val }))
                }}
                className="w-full text-xs font-mono font-bold p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Timbrado DNIT:</label>
              <input
                type="text"
                value={String((company.config as any)?.timbrado_dnit || "18545636")}
                onChange={e => {
                  const val = e.target.value
                  setCompany({ ...company, config: { ...(company.config || {}), timbrado_dnit: val } })
                  setReceiptConfig(prev => ({ ...prev, timbrado: val }))
                }}
                className="w-full text-xs font-mono font-bold p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Teléfono / WhatsApp:</label>
              <input
                type="text"
                value={company.telefono || ""}
                onChange={e => {
                  const val = e.target.value
                  setCompany({ ...company, telefono: val })
                  setReceiptConfig(prev => ({ ...prev, telefono: val }))
                }}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Email:</label>
              <input
                type="email"
                value={company.email || ""}
                onChange={e => setCompany({ ...company, email: e.target.value })}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Dirección Matriz / Salón de Ventas:</label>
              <input
                type="text"
                value={company.direccion || ""}
                onChange={e => {
                  const val = e.target.value
                  setCompany({ ...company, direccion: val })
                  setReceiptConfig(prev => ({ ...prev, direccion: val }))
                }}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── 3. TAB: PIZARRA DE COTIZACIONES ── */}
      {tab === "currencies" && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
            <div>
              <h2 className="text-base font-black text-gray-900 dark:text-white">Pizarra de Cotizaciones Multimoneda</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Valores de cambio para cobros en Reales brasileños y Dólares en cajas POS</p>
            </div>
            <button
              type="button"
              onClick={handleSaveCurrencies}
              disabled={saving}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "Guardando..." : "Guardar en DB"}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {currencies.map(c => {
              const formatDisplay = (val: number) => {
                if (val === undefined || val === null) return ""
                if (c.codigo === "ARS") return String(val).replace(".", ",")
                return val >= 100 ? val.toLocaleString("es-PY", { maximumFractionDigits: 2 }) : String(val).replace(".", ",")
              }

              const parseVal = (raw: string) => {
                if (!raw) return 0
                const cleaned = raw.replace(/\./g, "").replace(",", ".")
                const n = parseFloat(cleaned)
                return isNaN(n) ? 0 : n
              }

              return (
                <div key={c.codigo} className={`p-4 rounded-xl border space-y-3 transition-opacity ${c.activo ? "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700" : "bg-slate-50 dark:bg-slate-900 border-dashed border-slate-300 dark:border-slate-700 opacity-50"}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm text-gray-900 dark:text-white">{c.codigo} - {c.nombre}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">{c.simbolo}</span>
                  </div>
                  <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] font-bold text-gray-500 uppercase">{c.es_base ? "Siempre activa" : "Se usa en el sistema"}</span>
                    <button
                      type="button"
                      disabled={c.es_base}
                      onClick={() => setCurrencies(prev => prev.map(item => item.codigo === c.codigo ? { ...item, activo: !item.activo } : item))}
                      className={`relative w-9 h-5 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${c.activo ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${c.activo ? "translate-x-4" : "translate-x-0"}`} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase block mb-1">Compra:</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={formatDisplay(c.compra)}
                        disabled={c.es_base}
                        onChange={e => {
                          const val = parseVal(e.target.value)
                          setCurrencies(prev => prev.map(item => item.codigo === c.codigo ? { ...item, compra: val } : item))
                        }}
                        className="w-full p-2 text-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold dark:text-white disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-900 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase block mb-1">Venta:</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={formatDisplay(c.venta)}
                        disabled={c.es_base}
                        onChange={e => {
                          const val = parseVal(e.target.value)
                          setCurrencies(prev => prev.map(item => item.codigo === c.codigo ? { ...item, venta: val } : item))
                        }}
                        className="w-full p-2 text-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold dark:text-white disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-900 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── 4. TAB: MEDIOS DE PAGO HABILITADOS ── */}
      {tab === "payments" && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700 pb-3">
            <div>
              <h2 className="text-base font-black text-gray-900 dark:text-white">Pasarelas y Medios de Cobro Habilitados</h2>
              <p className="text-xs text-gray-500">Active o desactive los métodos de cobro disponibles para los cajeros en el POS.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddPaymentModal(true)}
                className="px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar Medio
              </button>
              <button
                type="button"
                onClick={handleSavePaymentMethods}
                disabled={saving}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? "Guardando..." : "Guardar en DB"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paymentMethods.map(p => (
              <div key={p.id} className={`p-4 rounded-xl border transition-all space-y-3 ${
                p.activo
                  ? "bg-slate-50 dark:bg-slate-900/90 border-slate-200 dark:border-slate-700 shadow-sm"
                  : "bg-slate-100/50 dark:bg-slate-900/30 border-slate-200/50 dark:border-slate-800 opacity-60"
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${p.activo ? "bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400" : "bg-slate-200 dark:bg-slate-800 text-slate-400"}`}>
                      <p.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-black font-mono text-gray-900 dark:text-white">{p.codigo}</p>
                      <span className={`text-[10px] font-bold ${p.activo ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400"}`}>
                        {p.activo ? "● HABILITADO EN CAJA" : "○ DESHABILITADO"}
                      </span>
                    </div>
                  </div>

                  {/* Switch Toggle Deslizable */}
                  <div className="flex items-center gap-2">
                    {p.custom && (
                      <button
                        type="button"
                        onClick={() => handleDeletePaymentMethod(p.id)}
                        className="text-rose-500 hover:text-rose-700 p-1 text-xs cursor-pointer"
                        title="Eliminar medio personalizado"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={p.activo}
                      onClick={() => handleTogglePayment(p.id)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        p.activo ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          p.activo ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="border-t border-slate-200/60 dark:border-slate-800 pt-2 flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-300 font-medium truncate pr-2">{p.nombre}</span>
                  {p.comision_pct > 0 && (
                    <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400 shrink-0">
                      {p.comision_pct}% com.
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Modal para Agregar Medio de Pago */}
          {showAddPaymentModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
                  <h3 className="text-sm font-black text-gray-900 dark:text-white">Nuevo Medio de Pago para POS</h3>
                  <button onClick={() => setShowAddPaymentModal(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Código Único (Ej: TIGO_MONEY, SIPAP, ETC):</label>
                    <input
                      type="text"
                      placeholder="EJ: TIGO_MONEY"
                      value={newPaymentForm.codigo}
                      onChange={e => setNewPaymentForm({ ...newPaymentForm, codigo: e.target.value })}
                      className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold uppercase dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Nombre Descriptivo:</label>
                    <input
                      type="text"
                      placeholder="Ej: Billetera Tigo Money"
                      value={newPaymentForm.nombre}
                      onChange={e => setNewPaymentForm({ ...newPaymentForm, nombre: e.target.value })}
                      className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Tipo de Canal:</label>
                      <select
                        value={newPaymentForm.tipo}
                        onChange={e => setNewPaymentForm({ ...newPaymentForm, tipo: e.target.value })}
                        className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold dark:text-white"
                      >
                        <option value="card">💳 Tarjeta / Terminal POS</option>
                        <option value="qr">📱 Código QR / Billetera</option>
                        <option value="app">📲 App / PIX Transferencia</option>
                        <option value="club">🛡️ Extra Club Crédito</option>
                        <option value="cash">💵 Efectivo</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Comisión Operador (%):</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={newPaymentForm.comision_pct}
                        onChange={e => setNewPaymentForm({ ...newPaymentForm, comision_pct: Number(e.target.value) })}
                        className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold dark:text-white text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setShowAddPaymentModal(false)}
                    className="px-3 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleAddPaymentMethod}
                    className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md cursor-pointer"
                  >
                    Habilitar Medio
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 5. TAB: PARÁMETROS OPERATIVOS & FISCALES ── */}
      {tab === "fiscal" && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700 pb-3">
            <div>
              <h2 className="text-base font-black text-gray-900 dark:text-white">Parámetros Operativos de Caja y Facturación</h2>
              <p className="text-xs text-gray-500">Reglas de negocio aplicadas automáticamente en el momento de la venta</p>
            </div>
            <button
              type="button"
              onClick={async () => {
                setSaving(true)
                try {
                  localStorage.setItem("pos_operational_config", JSON.stringify(operationalSettings))
                  if (company.id) {
                    const updatedConfig = {
                      ...(company.config || {}),
                      operational: operationalSettings,
                    }
                    await api.companies.update(company.id, { config: updatedConfig } as any)
                    setCompany(prev => ({ ...prev, config: updatedConfig }))
                  }
                  toast.success("¡Parámetros Guardados!", "Las reglas operativas se sincronizaron con la base de datos.")
                } catch (e) {
                  toast.error("Error", "No se pudo guardar los parámetros.")
                } finally {
                  setSaving(false)
                }
              }}
              disabled={saving}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "Guardando..." : "Guardar en DB"}
            </button>
          </div>

          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-900 dark:text-white">Redondeo Tributario DNIT (Ley 6380/19)</p>
                <p className="text-[11px] text-gray-500">Ajuste automático a favor del cliente al múltiplo legal de 50 Guaraníes</p>
              </div>
              <select
                value={operationalSettings.redondeo_dnit}
                onChange={e => setOperationalSettings({ ...operationalSettings, redondeo_dnit: parseInt(e.target.value) })}
                className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold dark:text-white"
              >
                <option value="50">50 Guaraníes (Estándar Paraguay)</option>
                <option value="100">100 Guaraníes</option>
                <option value="0">Sin Redondeo</option>
              </select>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-900 dark:text-white">Apertura Automática de Gaveta Metálica (RJ11)</p>
                <p className="text-[11px] text-gray-500">Enviar pulso ESC/POS a la impresora para abrir el cajón en cobros en efectivo</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={operationalSettings.apertura_gaveta_venta}
                onClick={() => setOperationalSettings({ ...operationalSettings, apertura_gaveta_venta: !operationalSettings.apertura_gaveta_venta })}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  operationalSettings.apertura_gaveta_venta ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    operationalSettings.apertura_gaveta_venta ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 6. TAB: KIOSCO VERIFICADOR & CARTELERÍA DIGITAL ── */}
      {tab === "kiosk" && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-gray-900 dark:text-white">Terminal Verificador de Precios & Cartelería Digital</h2>
                <span className="px-2.5 py-0.5 text-xs font-black rounded-full bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-300 dark:border-orange-700">
                  Windows 10 Kiosk Ready
                </span>
              </div>
              <p className="text-xs text-gray-500">Configuración de pantalla completa, carrusel de ofertas, beneficios Extra Club y cotizaciones</p>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="/verificador"
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Lanzar Terminal Kiosco
              </a>
              <button
                type="button"
                onClick={async () => {
                  setSaving(true)
                  try {
                    localStorage.setItem("kiosk_config", JSON.stringify(kioskConfig))
                    if (company.id) {
                      const updatedConfig = {
                        ...(company.config || {}),
                        kiosk: kioskConfig,
                      }
                      await api.companies.update(company.id, { config: updatedConfig } as any)
                      setCompany(prev => ({ ...prev, config: updatedConfig }))
                    }
                    toast.success("¡Configuración Guardada!", "Los parámetros del Kiosco Verificador se sincronizaron con PostgreSQL.")
                  } catch (e) {
                    toast.error("Error", "No se pudo guardar la configuración del kiosco.")
                  } finally {
                    setSaving(false)
                  }
                }}
                disabled={saving}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? "Guardando..." : "Guardar en DB"}
              </button>
            </div>
          </div>

          {/* PARÁMETROS BÁSICOS DE EXHIBICIÓN */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Segundos de espera */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-2">
              <span className="text-xs font-bold text-gray-900 dark:text-white block">
                ⏱️ Tiempo de Exhibición:
              </span>
              <p className="text-[11px] text-gray-500">
                Segundos que se muestra el precio antes de volver a la pantalla de espera
              </p>
              <select
                value={kioskConfig.segundos_espera}
                onChange={e => setKioskConfig({ ...kioskConfig, segundos_espera: Number(e.target.value) })}
                className="w-full p-2 text-xs font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
              >
                <option value="3">3 Segundos (Rápido)</option>
                <option value="5">5 Segundos (Recomendado)</option>
                <option value="7">7 Segundos</option>
                <option value="10">10 Segundos</option>
              </select>
            </div>

            {/* Switch Cotizaciones Multimoneda */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-gray-900 dark:text-white block">💵 Cotizaciones en Vivo</span>
                <p className="text-[11px] text-gray-500">Mostrar R$, US$ y ARS calculados en pantalla</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={kioskConfig.mostrar_cotizaciones}
                onClick={() => setKioskConfig({ ...kioskConfig, mostrar_cotizaciones: !kioskConfig.mostrar_cotizaciones })}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  kioskConfig.mostrar_cotizaciones ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    kioskConfig.mostrar_cotizaciones ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Switch Escala Mayorista */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-gray-900 dark:text-white block">📦 Escalas por Volumen</span>
                <p className="text-[11px] text-gray-500">Mostrar precios x3 unidades y fardos cerrados</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={kioskConfig.mostrar_escala_precios}
                onClick={() => setKioskConfig({ ...kioskConfig, mostrar_escala_precios: !kioskConfig.mostrar_escala_precios })}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  kioskConfig.mostrar_escala_precios ? "bg-amber-500" : "bg-slate-300 dark:bg-slate-700"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    kioskConfig.mostrar_escala_precios ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Switch Beneficios Extra Club */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-gray-900 dark:text-white block">⭐ Extra Club</span>
                  <p className="text-[10px] text-gray-500">Descuento socio</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={kioskConfig.mostrar_beneficios_club}
                  onClick={() => setKioskConfig({ ...kioskConfig, mostrar_beneficios_club: !kioskConfig.mostrar_beneficios_club })}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    kioskConfig.mostrar_beneficios_club ? "bg-purple-600" : "bg-slate-300 dark:bg-slate-700"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      kioskConfig.mostrar_beneficios_club ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center gap-2 pt-1 border-t border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-gray-500">% Descuento:</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={kioskConfig.extra_club_descuento_pct}
                  onChange={e => setKioskConfig({ ...kioskConfig, extra_club_descuento_pct: Number(e.target.value) })}
                  className="w-16 p-1 text-xs font-bold font-mono text-center rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
                />
                <span className="text-xs font-bold">%</span>
              </div>
            </div>
          </div>

          {/* GESTOR DE BANNERS / CARRUSEL DE OFERTAS DEL DÍA Y DE LA SEMANA */}
          <div className="space-y-4 border-t border-slate-100 dark:border-slate-700 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-gray-900 dark:text-white">
                  📢 Cartelería Digital & Carrusel de Espera (Standby)
                </h3>
                <p className="text-xs text-gray-500">
                  Rotación de ofertas y novedades que se exhiben en la pantalla del kiosco cuando no hay clientes escaneando
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  const newBanner: KioskBanner = {
                    id: `b-${Date.now()}`,
                    etiqueta: "OFERTA DEL DÍA",
                    titulo: "Nueva Promoción Destacada",
                    subtitulo: "Ahorro especial en salón de ventas",
                    descuento_texto: "-15% OFF",
                    color: "emerald",
                    activo: true,
                  }
                  setKioskConfig({ ...kioskConfig, banners: [...kioskConfig.banners, newBanner] })
                  toast.info("Banner Creado", "Configure el texto y active el banner.")
                }}
                className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar Oferta / Banner
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {kioskConfig.banners.map((b, idx) => (
                <div
                  key={b.id}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <select
                        value={b.etiqueta}
                        onChange={e => {
                          const updated = [...kioskConfig.banners]
                          updated[idx] = { ...updated[idx], etiqueta: e.target.value }
                          setKioskConfig({ ...kioskConfig, banners: updated })
                        }}
                        className="px-2 py-1 text-[11px] font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      >
                        <option value="OFERTA DEL DÍA">🔥 OFERTA DEL DÍA</option>
                        <option value="OFERTA DE LA SEMANA">⭐ OFERTA DE LA SEMANA</option>
                        <option value="BENEFICIO EXTRA CLUB">🛡️ BENEFICIO EXTRA CLUB</option>
                        <option value="PROMO MAYORISTA">📦 PROMO MAYORISTA</option>
                      </select>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={b.activo}
                        onClick={() => {
                          const updated = [...kioskConfig.banners]
                          updated[idx] = { ...updated[idx], activo: !updated[idx].activo }
                          setKioskConfig({ ...kioskConfig, banners: updated })
                        }}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          b.activo ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                            b.activo ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase block">Título Promoción:</label>
                      <input
                        type="text"
                        value={b.titulo}
                        onChange={e => {
                          const updated = [...kioskConfig.banners]
                          updated[idx] = { ...updated[idx], titulo: e.target.value }
                          setKioskConfig({ ...kioskConfig, banners: updated })
                        }}
                        className="w-full p-2 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase block">Subtítulo / Aclaración:</label>
                      <input
                        type="text"
                        value={b.subtitulo || ""}
                        onChange={e => {
                          const updated = [...kioskConfig.banners]
                          updated[idx] = { ...updated[idx], subtitulo: e.target.value }
                          setKioskConfig({ ...kioskConfig, banners: updated })
                        }}
                        placeholder="Ej. Válido con todos los medios de pago"
                        className="w-full p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase block">Etiqueta Badge:</label>
                        <input
                          type="text"
                          value={b.descuento_texto || ""}
                          onChange={e => {
                            const updated = [...kioskConfig.banners]
                            updated[idx] = { ...updated[idx], descuento_texto: e.target.value }
                            setKioskConfig({ ...kioskConfig, banners: updated })
                          }}
                          placeholder="-20% OFF"
                          className="w-full p-1.5 text-xs font-bold font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase block">Color:</label>
                        <select
                          value={b.color || "emerald"}
                          onChange={e => {
                            const updated = [...kioskConfig.banners]
                            updated[idx] = { ...updated[idx], color: e.target.value as any }
                            setKioskConfig({ ...kioskConfig, banners: updated })
                          }}
                          className="w-full p-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                        >
                          <option value="emerald">Verde Esmeralda</option>
                          <option value="amber">Ámbar / Naranja</option>
                          <option value="purple">Púrpura / Club</option>
                          <option value="blue">Azul</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-[10px] text-gray-400 font-mono">
                      Estado: {b.activo ? "🟢 Visible en Kiosco" : "⚪ Desactivado"}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = kioskConfig.banners.filter((_, i) => i !== idx)
                        setKioskConfig({ ...kioskConfig, banners: updated })
                      }}
                      className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                      title="Eliminar Banner"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── CAJAS Y PUNTOS DE EMISIÓN ─────────────────────────────────────── */}
      {tab === "cajas" && (
        <div className="space-y-5">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-2">
            <h2 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
              <Store className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Cajas y Puntos de Emisión
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Cada máquina física (identificada por su hostname real de Windows, ej. <span className="font-mono font-bold">CAJA8</span>) queda fija a un punto de emisión y un nombre de caja. Esto define la numeración fiscal real por caja -- se asigna acá, una sola vez por máquina, y el cajero no puede cambiarlo desde el mostrador.
            </p>
          </div>

          {/* Alta de nueva asignación */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-3">
            <h3 className="text-sm font-black text-gray-900 dark:text-white">Asignar Nueva Caja</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase block mb-1">Hostname de la Máquina (Windows):</label>
                <input
                  type="text"
                  value={newTerminalHostname}
                  onChange={(e) => setNewTerminalHostname(e.target.value)}
                  placeholder="CAJA9"
                  className="w-full bg-gray-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase block mb-1">Punto de Emisión (Boca):</label>
                <input
                  type="text"
                  value={newTerminalPunto}
                  onChange={(e) => setNewTerminalPunto(e.target.value.replace(/\D/g, "").slice(0, 3))}
                  placeholder="012"
                  className="w-full bg-gray-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase block mb-1">Nombre de la Caja (opcional):</label>
                <input
                  type="text"
                  value={newTerminalCajaNombre}
                  onChange={(e) => setNewTerminalCajaNombre(e.target.value)}
                  placeholder={`Caja ${newTerminalPunto}`}
                  className="w-full bg-gray-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <button
              onClick={handleCreatePosTerminal}
              disabled={savingNewTerminal}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-black text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-60 rounded-xl shadow-md transition cursor-pointer"
            >
              {savingNewTerminal ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
              Asignar Caja
            </button>
          </div>

          {/* Listado de asignaciones existentes */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-gray-900 dark:text-white">Cajas Asignadas</h3>
              <button onClick={fetchPosTerminals} disabled={loadingPosTerminals} className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 cursor-pointer">
                <RefreshCcw className={`w-3.5 h-3.5 ${loadingPosTerminals ? "animate-spin" : ""}`} /> Refrescar
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 dark:bg-slate-900/50 text-gray-500 dark:text-gray-400 uppercase text-[10px] font-bold border-b border-gray-100 dark:border-slate-700">
                  <tr>
                    <th className="p-3">Hostname</th>
                    <th className="p-3">Caja</th>
                    <th className="p-3 text-center">Punto de Emisión</th>
                    <th className="p-3 text-center">Estado</th>
                    <th className="p-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60">
                  {!loadingPosTerminals && posTerminals.length === 0 && (
                    <tr><td colSpan={5} className="p-6 text-center text-gray-400 text-xs">Ninguna caja asignada todavía.</td></tr>
                  )}
                  {posTerminals.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-slate-750/50">
                      <td className="p-3 font-mono font-bold text-gray-900 dark:text-white">{t.hostname}</td>
                      <td className="p-3 text-gray-700 dark:text-gray-300">{t.caja_nombre}</td>
                      <td className="p-3 text-center font-mono font-bold text-blue-600 dark:text-blue-400">{t.punto_emision}</td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleTogglePosTerminal(t.id, t.activo)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer ${
                            t.activo
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-gray-400"
                          }`}
                        >
                          {t.activo ? "Activa" : "Inactiva"}
                        </button>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleDeletePosTerminal(t.id, t.hostname)}
                          title="Eliminar asignación"
                          className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Numeración de Notas de Crédito por punto de emisión */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-3">
            <div>
              <h3 className="text-sm font-black text-gray-900 dark:text-white">Numeración de Notas de Crédito</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Somos autoimpresor -- no se declara CDC ni se emite por SIFEN. Cada punto de emisión necesita su propio rango numerado de NC, igual que ya tiene para venta.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase block mb-1">Punto de Emisión (Boca):</label>
                <input
                  type="text"
                  value={newNcPunto}
                  onChange={(e) => setNewNcPunto(e.target.value.replace(/\D/g, "").slice(0, 3))}
                  placeholder="015"
                  className="w-full bg-gray-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase block mb-1">NC Desde:</label>
                <input
                  type="text"
                  value={newNcDesde}
                  onChange={(e) => setNewNcDesde(e.target.value.replace(/\D/g, ""))}
                  className="w-full bg-gray-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase block mb-1">NC Hasta:</label>
                <input
                  type="text"
                  value={newNcHasta}
                  onChange={(e) => setNewNcHasta(e.target.value.replace(/\D/g, ""))}
                  className="w-full bg-gray-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500"
                />
              </div>
              <button
                onClick={handleCreateNcSequence}
                disabled={savingNcSequence}
                className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-black text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-60 rounded-xl shadow-md transition cursor-pointer"
              >
                {savingNcSequence ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                Asignar
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 dark:bg-slate-900/50 text-gray-500 dark:text-gray-400 uppercase text-[10px] font-bold border-b border-gray-100 dark:border-slate-700">
                  <tr>
                    <th className="p-3">Punto de Emisión</th>
                    <th className="p-3 text-center">Próximo Nº NC</th>
                    <th className="p-3 text-center">Hasta</th>
                    <th className="p-3 text-center">Disponibles</th>
                    <th className="p-3 text-center">Timbrado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60">
                  {!loadingNcSequences && ncSequences.length === 0 && (
                    <tr><td colSpan={5} className="p-6 text-center text-gray-400 text-xs">Ningún punto de emisión tiene numeración de NC todavía.</td></tr>
                  )}
                  {ncSequences.map((s) => (
                    <tr key={s.punto_emision} className="hover:bg-gray-50 dark:hover:bg-slate-750/50">
                      <td className="p-3 font-mono font-bold text-gray-900 dark:text-white">{s.punto_emision}</td>
                      <td className="p-3 text-center font-mono font-bold text-blue-600 dark:text-blue-400">{s.numero_actual}</td>
                      <td className="p-3 text-center font-mono text-gray-500 dark:text-gray-400">{s.numero_final}</td>
                      <td className="p-3 text-center font-mono text-gray-700 dark:text-gray-300">{s.disponibles}</td>
                      <td className="p-3 text-center font-mono text-gray-500 dark:text-gray-400">{s.timbrado_numero}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
