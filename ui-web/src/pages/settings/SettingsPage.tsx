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
import { type ReceiptTemplateConfig, DEFAULT_RECEIPT_CONFIG } from "../../constants/receiptDefaults"

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

// ReceiptTemplateConfig y DEFAULT_RECEIPT_CONFIG se importan desde constants/receiptDefaults.ts
export { type ReceiptTemplateConfig, DEFAULT_RECEIPT_CONFIG }

export default function SettingsPage() {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>("receipt_builder")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // ── CAJAS Y PUNTOS DE EMISIÓN (asignación fija por máquina e IP) ──────────
  const [posTerminals, setPosTerminals] = useState<{
    id: string
    hostname: string
    ip_address?: string
    ip_pos_bancard?: string
    punto_emision: string
    caja_nombre: string
    activo: boolean
    factura_actual?: number
    factura_final?: number
    nc_actual?: number
    nc_final?: number
    tiene_factura?: boolean
    tiene_nc?: boolean
  }[]>([])
  const [loadingPosTerminals, setLoadingPosTerminals] = useState(false)
  const [newTerminalHostname, setNewTerminalHostname] = useState("")
  const [newTerminalIp, setNewTerminalIp] = useState("")
  const [newTerminalIpPosBancard, setNewTerminalIpPosBancard] = useState("")
  const [newTerminalPunto, setNewTerminalPunto] = useState("011")
  const [newTerminalCajaNombre, setNewTerminalCajaNombre] = useState("")
  const [savingNewTerminal, setSavingNewTerminal] = useState(false)
  const [editingIpId, setEditingIpId] = useState<string | null>(null)
  const [editingIpVal, setEditingIpVal] = useState("")
  const [editingBancardIpId, setEditingBancardIpId] = useState<string | null>(null)
  const [editingBancardIpVal, setEditingBancardIpVal] = useState("")

  const fetchPosTerminals = useCallback(async () => {
    setLoadingPosTerminals(true)
    try {
      const data = await api.posTerminals.list()
      setPosTerminals(Array.isArray(data) ? data : [])
    } catch (e: any) {
      console.error("Error al cargar cajas asignadas:", e)
    } finally {
      setLoadingPosTerminals(false)
    }
  }, [])

  const handleCreatePosTerminal = async () => {
    if (!newTerminalHostname.trim() && !newTerminalIp.trim()) {
      toast.warning("Falta Identificador", "Ingrese el Hostname de Windows (ej. CAJA1) o la IP de la máquina (ej. 192.168.0.11).")
      return
    }
    setSavingNewTerminal(true)
    try {
      await api.posTerminals.create({
        hostname: newTerminalHostname.trim().toUpperCase() || `CAJA-${newTerminalPunto}`,
        ip_address: newTerminalIp.trim() || undefined,
        ip_pos_bancard: newTerminalIpPosBancard.trim() || undefined,
        punto_emision: newTerminalPunto,
        caja_nombre: newTerminalCajaNombre.trim() || `Caja ${newTerminalPunto}`,
      })
      toast.success("Caja Asignada", `Caja vinculada al punto de emisión ${newTerminalPunto}.`)
      setNewTerminalHostname("")
      setNewTerminalIp("")
      setNewTerminalIpPosBancard("")
      setNewTerminalCajaNombre("")
      fetchPosTerminals()
    } catch (e: any) {
      toast.error("No se pudo asignar la caja", e?.message || "Intente nuevamente.")
    } finally {
      setSavingNewTerminal(false)
    }
  }

  const handleSaveTerminalIp = async (id: string) => {
    try {
      await api.posTerminals.update(id, { ip_address: editingIpVal.trim() || null })
      toast.success("IP Actualizada", "La dirección IP de la máquina quedó guardada.")
      setEditingIpId(null)
      fetchPosTerminals()
    } catch (e: any) {
      toast.error("Error al actualizar IP", e?.message || "Intente nuevamente.")
    }
  }

  const handleSaveTerminalBancardIp = async (id: string) => {
    try {
      await api.posTerminals.update(id, { ip_pos_bancard: editingBancardIpVal.trim() || null })
      toast.success("IP POS Bancard Actualizada", "La dirección IP del POS Bancard quedó guardada y rige en cajas.")
      setEditingBancardIpId(null)
      fetchPosTerminals()
    } catch (e: any) {
      toast.error("Error al actualizar IP POS Bancard", e?.message || "Intente nuevamente.")
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
  const [ncSequences, setNcSequences] = useState<{ punto_emision: string; numero_actual: number; numero_final: number; disponibles: number; timbrado_numero: string; timbrado_vencido: boolean }[]>([])
  const [loadingNcSequences, setLoadingNcSequences] = useState(false)
  const [activeTimbradoId, setActiveTimbradoId] = useState<string | null>(null)
  const [newNcPunto, setNewNcPunto] = useState("011")
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
      console.error("Error al cargar secuencias NC:", e)
    } finally {
      setLoadingNcSequences(false)
    }
  }, [])

  useEffect(() => {
    if (tab === "cajas") {
      fetchPosTerminals()
      fetchNcSequences()
    }
  }, [tab, fetchPosTerminals, fetchNcSequences])

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

        // Si la empresa ya tiene plantilla de ticket guardada en DB, mezclarla asegurando todos los defaults de Extra Ahorro
        const dbReceiptTemplate = (comp.config as any)?.receipt_template
        const mergedTemplate: ReceiptTemplateConfig = {
          ...DEFAULT_RECEIPT_CONFIG,
          ...(dbReceiptTemplate || {}),
          nombre_fantasia: fantasia || DEFAULT_RECEIPT_CONFIG.nombre_fantasia,
          razon_social: comp.razon_social || DEFAULT_RECEIPT_CONFIG.razon_social,
          ruc: comp.ruc || DEFAULT_RECEIPT_CONFIG.ruc,
          direccion: comp.direccion || DEFAULT_RECEIPT_CONFIG.direccion,
          telefono: comp.telefono || DEFAULT_RECEIPT_CONFIG.telefono,
          logo_url: comp.logo_url || DEFAULT_RECEIPT_CONFIG.logo_url,
          timbrado: String((comp.config as any)?.timbrado_dnit || dbReceiptTemplate?.timbrado || DEFAULT_RECEIPT_CONFIG.timbrado)
        }
        setReceiptConfig(mergedTemplate)
        localStorage.setItem("pos_receipt_template_config", JSON.stringify(mergedTemplate))

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
                🏢 GRUPO SANTA TERESA E.A.S. (RUC 80150377-9)
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
            {company.ruc || "80150377-9"}
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
          
          {/* PANEL IZQUIERDO: FORMULARIO Y CONTROLES DEL CONSTRUCTOR EN 6 BLOQUES COHERENTES (7 COLS) */}
          <div className="lg:col-span-7 space-y-5">
            
            {/* BLOQUE 1: CABECERA & IDENTIDAD COMERCIAL */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-700/80 pb-3">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">1. Cabecera & Identidad Comercial</h3>
                  <p className="text-xs text-slate-500">Logotipo, nombre comercial, contacto y ubicación impresos en el encabezado.</p>
                </div>
              </div>

              <div className="space-y-3">
                {/* Switch Logotipo */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">Imprimir Logotipo en la Cabecera</span>
                    <span className="text-[11px] text-slate-500">Convierte el logo a matriz térmica monocromo de alta nitidez</span>
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
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                          {company.logo_url ? "Logotipo Activo" : "No has subido un logotipo aún"}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Puedes subirlo en la pestaña <button type="button" onClick={() => setTab("company")} className="text-blue-600 dark:text-blue-400 font-bold underline cursor-pointer">Datos Fiscales</button>
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Ancho en Ticket (px):</label>
                      <input
                        type="number"
                        value={receiptConfig.logo_ancho_px}
                        onChange={e => setReceiptConfig({ ...receiptConfig, logo_ancho_px: Number(e.target.value) })}
                        className="w-24 text-xs font-mono font-bold p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Nombre Comercial de Fantasía:</label>
                    <input
                      type="text"
                      value={receiptConfig.nombre_fantasia}
                      onChange={e => setReceiptConfig({ ...receiptConfig, nombre_fantasia: e.target.value })}
                      className="w-full text-xs font-bold p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Slogan Comercial:</label>
                    <input
                      type="text"
                      value={receiptConfig.slogan}
                      onChange={e => setReceiptConfig({ ...receiptConfig, slogan: e.target.value })}
                      placeholder="¡Ahorro de verdad!"
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Dirección del Local:</label>
                    <input
                      type="text"
                      value={receiptConfig.direccion}
                      onChange={e => setReceiptConfig({ ...receiptConfig, direccion: e.target.value })}
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Ciudad / País:</label>
                    <input
                      type="text"
                      value={receiptConfig.ciudad}
                      onChange={e => setReceiptConfig({ ...receiptConfig, ciudad: e.target.value })}
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Teléfono / WhatsApp de Contacto:</label>
                  <input
                    type="text"
                    value={receiptConfig.telefono}
                    onChange={e => setReceiptConfig({ ...receiptConfig, telefono: e.target.value })}
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* BLOQUE 2: TRANSACCIÓN & DATOS DE LA VENTA */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-700/80 pb-3">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">2. Transacción & Datos de Venta</h3>
                  <p className="text-xs text-slate-500">Información del cajero, cliente y códigos impresos en el cuerpo del ticket.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { key: "mostrar_numero_comprobante", label: "Mostrar Nº de Factura / Comprobante Fiscal" },
                  { key: "usar_numero_interno_venta", label: "Imprimir Nº Interno de Venta" },
                  { key: "mostrar_cajero", label: "Mostrar Nombre del Cajero y Boca" },
                  { key: "mostrar_caja", label: "Mostrar Punto de Expedición" },
                  { key: "mostrar_cliente", label: "Mostrar Nombre del Cliente" },
                  { key: "mostrar_ruc_cliente", label: "Mostrar RUC / C.I. del Cliente" },
                  { key: "mostrar_sku", label: "Mostrar Código SKU / Barra en ítems" },
                ].map(opt => (
                  <div key={opt.key} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">{opt.label}</span>
                    <input
                      type="checkbox"
                      checked={(receiptConfig as any)[opt.key]}
                      onChange={e => setReceiptConfig({ ...receiptConfig, [opt.key]: e.target.checked })}
                      className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* BLOQUE 3: TOTALES, MULTIMONEDA & LIQUIDACIÓN DE IVA */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-700/80 pb-3">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">3. Totales, Multimoneda & Liquidación de IVA</h3>
                  <p className="text-xs text-slate-500">Conversiones de frontera (Reales/Dólares), desglose de pagos y cuadro impositivo.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { key: "mostrar_multimoneda", label: "Cuadro Multimoneda de Totales" },
                  { key: "mostrar_equivalente_brl", label: "Equivalente en Reales (R$)" },
                  { key: "mostrar_equivalente_usd", label: "Equivalente en Dólares (US$)" },
                  { key: "mostrar_desglose_pagos", label: "Desglose de Formas de Pago" },
                  { key: "mostrar_vuelto_extranjero", label: "Detalle de Vuelto en Reales/Dólares" },
                  { key: "mostrar_liquidacion_iva", label: "Liquidación Legal de IVA (10%, 5%, Exentas)" },
                ].map(opt => (
                  <div key={opt.key} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">{opt.label}</span>
                    <input
                      type="checkbox"
                      checked={(receiptConfig as any)[opt.key]}
                      onChange={e => setReceiptConfig({ ...receiptConfig, [opt.key]: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* BLOQUE 4: FIDELIZACIÓN EXTRA CLUB */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-700/80 pb-3">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">4. Fidelización Extra Club</h3>
                  <p className="text-xs text-slate-500">Muestra el saldo de puntos al socio o la invitación a registrarse para consumidores finales.</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-amber-900 dark:text-amber-300 block">Habilitar Módulo Extra Club en el Ticket</span>
                    <span className="text-[11px] text-amber-700 dark:text-amber-400">Habilita también la opción de pago Extra Club en caja</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={receiptConfig.habilitar_extra_club}
                    onChange={e => setReceiptConfig({ ...receiptConfig, habilitar_extra_club: e.target.checked })}
                    className="w-4 h-4 text-amber-600 rounded cursor-pointer"
                  />
                </div>

                {receiptConfig.habilitar_extra_club && (
                  <div className="space-y-3 pt-1">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                        Mensaje para Cliente Socio (Puntos Ganados y Saldo):
                      </label>
                      <textarea
                        rows={2}
                        value={receiptConfig.mensaje_socio_club}
                        onChange={e => setReceiptConfig({ ...receiptConfig, mensaje_socio_club: e.target.value })}
                        className="w-full text-xs font-mono p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                        Mensaje de Invitación para No Socios (* UNITE AL EXTRA CLUB *):
                      </label>
                      <textarea
                        rows={3}
                        value={receiptConfig.mensaje_invitacion_club}
                        onChange={e => setReceiptConfig({ ...receiptConfig, mensaje_invitacion_club: e.target.value })}
                        className="w-full text-xs font-mono p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">Imprimir QR de Registro Club</span>
                        <input
                          type="checkbox"
                          checked={receiptConfig.mostrar_qr_club}
                          onChange={e => setReceiptConfig({ ...receiptConfig, mostrar_qr_club: e.target.checked })}
                          className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">URL de Registro en QR:</label>
                        <input
                          type="text"
                          value={receiptConfig.qr_url_club}
                          onChange={e => setReceiptConfig({ ...receiptConfig, qr_url_club: e.target.value })}
                          className="w-full text-xs font-mono p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* BLOQUE 4.5: RECUADRO DINÁMICO DE EXTRA AHORRO Y PRECIOS MAYORISTAS [M] (45 COLS) */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border-2 border-emerald-500/30 dark:border-emerald-500/40 shadow-md space-y-4">
              <div className="flex items-center justify-between border-b border-emerald-100 dark:border-emerald-900/40 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      4.5. Recuadro Dinámico de Extra Ahorro & Precios Mayoristas (45 cols)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Enmarcado térmico ┌──┐ │ └──┘ con ahorro real desglosado o invitación comercial si no hubo descuento.
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={receiptConfig.habilitar_recuadro_ahorro}
                  onChange={e => setReceiptConfig({ ...receiptConfig, habilitar_recuadro_ahorro: e.target.checked })}
                  className="w-5 h-5 text-emerald-600 rounded cursor-pointer"
                />
              </div>

              {receiptConfig.habilitar_recuadro_ahorro && (
                <div className="space-y-4 pt-1">
                  {/* SECCIÓN A: MENSAJES CUANDO HUBO AHORRO */}
                  <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-2.5">
                    <span className="text-[11px] font-black text-emerald-900 dark:text-emerald-300 uppercase tracking-wider block">
                      🟢 Mensajes cuando el Cliente AHORRÓ en su compra:
                    </span>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase block mb-1">
                        Título de Felicitación (Línea Superior):
                      </label>
                      <input
                        type="text"
                        value={receiptConfig.titulo_ahorro_con_descuento}
                        onChange={e => setReceiptConfig({ ...receiptConfig, titulo_ahorro_con_descuento: e.target.value })}
                        className="w-full text-xs font-mono font-bold p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase block mb-1">
                          Etiqueta Ahorro en Promociones:
                        </label>
                        <input
                          type="text"
                          value={receiptConfig.subtitulo_ahorro_promo}
                          onChange={e => setReceiptConfig({ ...receiptConfig, subtitulo_ahorro_promo: e.target.value })}
                          className="w-full text-xs font-mono p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase block mb-1">
                          Etiqueta Ahorro en Mayoristas [M]:
                        </label>
                        <input
                          type="text"
                          value={receiptConfig.subtitulo_ahorro_mayorista}
                          onChange={e => setReceiptConfig({ ...receiptConfig, subtitulo_ahorro_mayorista: e.target.value })}
                          className="w-full text-xs font-mono p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* SECCIÓN B: MENSAJES CUANDO NO HUBO AHORRO (INVITACIÓN) */}
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2.5">
                    <span className="text-[11px] font-black text-amber-900 dark:text-amber-300 uppercase tracking-wider block">
                      🟡 Mensajes cuando NO HUBO Ahorro (Invitación & Fidelización):
                    </span>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase block mb-1">
                        Título de Invitación:
                      </label>
                      <input
                        type="text"
                        value={receiptConfig.titulo_invitacion_ahorro}
                        onChange={e => setReceiptConfig({ ...receiptConfig, titulo_invitacion_ahorro: e.target.value })}
                        className="w-full text-xs font-mono font-bold p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase block mb-0.5">
                          Línea 1 de Beneficio (Mayorista):
                        </label>
                        <input
                          type="text"
                          value={receiptConfig.linea1_invitacion_ahorro}
                          onChange={e => setReceiptConfig({ ...receiptConfig, linea1_invitacion_ahorro: e.target.value })}
                          className="w-full text-xs font-mono p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase block mb-0.5">
                          Línea 2 de Beneficio (Ofertas):
                        </label>
                        <input
                          type="text"
                          value={receiptConfig.linea2_invitacion_ahorro}
                          onChange={e => setReceiptConfig({ ...receiptConfig, linea2_invitacion_ahorro: e.target.value })}
                          className="w-full text-xs font-mono p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase block mb-0.5">
                          Línea 3 / Lema Comercial:
                        </label>
                        <input
                          type="text"
                          value={receiptConfig.linea3_invitacion_ahorro}
                          onChange={e => setReceiptConfig({ ...receiptConfig, linea3_invitacion_ahorro: e.target.value })}
                          className="w-full text-xs font-mono font-bold p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* BLOQUE 5: CAMPAÑA SOLIDARIA "ABRE TU CORAZÓN" */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-700/80 pb-3">
                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <Heart className="w-5 h-5 fill-rose-500 text-rose-500" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">5. Campaña Solidaria "Abre tu Corazón"</h3>
                  <p className="text-xs text-slate-500">Mensaje institucional impreso al pie del comprobante cuando hay donación.</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">Imprimir Mensaje Solidario en Factura</span>
                    <span className="text-[11px] text-slate-500">Activa también el botón interactivo y atajo F8 en la caja</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={receiptConfig.donacion_activa}
                    onChange={e => setReceiptConfig({ ...receiptConfig, donacion_activa: e.target.checked })}
                    className="w-4 h-4 text-rose-600 rounded cursor-pointer"
                  />
                </div>

                {receiptConfig.donacion_activa && (
                  <div className="space-y-3 pt-1">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Título del Bloque Solidario:</label>
                      <input
                        type="text"
                        value={receiptConfig.donacion_titulo}
                        onChange={e => setReceiptConfig({ ...receiptConfig, donacion_titulo: e.target.value })}
                        placeholder="* ABRE TU CORAZON *"
                        className="w-full text-xs font-mono font-bold p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Mensaje de Agradecimiento / Beneficiario:</label>
                      <input
                        type="text"
                        value={receiptConfig.donacion_mensaje}
                        onChange={e => setReceiptConfig({ ...receiptConfig, donacion_mensaje: e.target.value })}
                        placeholder="Gracias por colaborar con el Centro Amor y Esperanza."
                        className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Página Web o Enlace Institucional:</label>
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

            {/* BLOQUE 6: MARKETING, CUPÓN DE RECOMPRA & DESPEDIDA */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-700/80 pb-3">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <Flame className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">6. Marketing, Cupón de Recompra & Pie Fiscal</h3>
                  <p className="text-xs text-slate-500">Avisos promocionales, cupón con validez recortable, consulta SIFEN y despedida.</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Mensaje de Marketing */}
                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">Imprimir Mensaje / Promoción de Marketing</span>
                    <input
                      type="checkbox"
                      checked={receiptConfig.habilitar_mensaje_marketing}
                      onChange={e => setReceiptConfig({ ...receiptConfig, habilitar_mensaje_marketing: e.target.checked })}
                      className="w-4 h-4 text-purple-600 rounded cursor-pointer"
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
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-slate-50/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Código del Cupón:</label>
                        <input
                          type="text"
                          value={receiptConfig.cupon_codigo}
                          onChange={e => setReceiptConfig({ ...receiptConfig, cupon_codigo: e.target.value })}
                          className="w-full text-xs font-mono font-black p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white uppercase"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Beneficio / Descripción:</label>
                        <input
                          type="text"
                          value={receiptConfig.cupon_descripcion}
                          onChange={e => setReceiptConfig({ ...receiptConfig, cupon_descripcion: e.target.value })}
                          className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Validez (Días):</label>
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

                {/* SIFEN & Despedida */}
                <div className="space-y-3 border-t border-slate-100 dark:border-slate-700 pt-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">QR de Consulta Fiscal SIFEN</span>
                      <input
                        type="checkbox"
                        checked={receiptConfig.mostrar_qr_sifen}
                        onChange={e => setReceiptConfig({ ...receiptConfig, mostrar_qr_sifen: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">URL de Consulta SIFEN:</label>
                      <input
                        type="text"
                        value={receiptConfig.sifen_consulta_url}
                        onChange={e => setReceiptConfig({ ...receiptConfig, sifen_consulta_url: e.target.value })}
                        className="w-full text-xs font-mono p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Mensaje de Despedida:</label>
                    <input
                      type="text"
                      value={receiptConfig.mensaje_despedida}
                      onChange={e => setReceiptConfig({ ...receiptConfig, mensaje_despedida: e.target.value })}
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white font-bold text-center"
                    />
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* PANEL DERECHO: VISTA PREVIA EN VIVO REALISTA (SIMULADOR FOTORREALISTA 80MM TÉRMICO) (5 COLS) */}
          <div className="lg:col-span-5 space-y-3 sticky top-4">
            
            {/* Barra de control del simulador */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-900 text-white border border-slate-700/80 shadow-xl">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-black uppercase tracking-wider">Papel Térmico 80mm (ESC/POS)</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="/cupones"
                  title="Ir al Diseñador de Cupones de Sorteos"
                  className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-purple-600 hover:bg-purple-500 text-white transition flex items-center gap-1 cursor-pointer shadow-sm"
                >
                  <Gift className="w-3 h-3" />
                  <span>Diseñador Cupones ➔</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewCustomerType(previewCustomerType === "socio" ? "consumidor_final" : "socio")}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition cursor-pointer ${
                    previewCustomerType === "socio" ? "bg-amber-500 text-slate-950 font-bold" : "bg-slate-800 text-slate-300 border border-slate-700"
                  }`}
                >
                  {previewCustomerType === "socio" ? "⭐ Extra Club" : "👤 Sin Club"}
                </button>
              </div>
            </div>

            {/* Contenedor Fotorrealista de Rollo Térmico 80mm */}
            <div className="bg-slate-950/60 p-4 sm:p-6 rounded-3xl border border-slate-800 flex justify-center shadow-inner overflow-hidden">
              <div className="relative w-[310px] max-w-[310px] select-none filter drop-shadow-[0_12px_24px_rgba(0,0,0,0.45)]">
                
                {/* Borde dentado superior (Tear-off Zig-zag) */}
                <div 
                  className="h-3 w-full bg-[#FAFAF7]" 
                  style={{
                    clipPath: "polygon(0% 100%, 2% 0%, 4% 100%, 6% 0%, 8% 100%, 10% 0%, 12% 100%, 14% 0%, 16% 100%, 18% 0%, 20% 100%, 22% 0%, 24% 100%, 26% 0%, 28% 100%, 30% 0%, 32% 100%, 34% 0%, 36% 100%, 38% 0%, 40% 100%, 42% 0%, 44% 100%, 46% 0%, 48% 100%, 50% 0%, 52% 100%, 54% 0%, 56% 100%, 58% 0%, 60% 100%, 62% 0%, 64% 100%, 66% 0%, 68% 100%, 70% 0%, 72% 100%, 74% 0%, 76% 100%, 78% 0%, 80% 100%, 82% 0%, 84% 100%, 86% 0%, 88% 100%, 90% 0%, 92% 100%, 94% 0%, 96% 100%, 98% 0%, 100% 100%)"
                  }}
                />

                {/* Cuerpo del Ticket Térmico */}
                <div 
                  id="receipt-preview-content"
                  className="bg-[#FAFAF7] text-black px-4 py-3 font-mono border-x border-slate-300/40"
                  style={{
                    fontSize: "11px",
                    lineHeight: "1.25",
                    fontFamily: '"SF Mono", "Courier New", Courier, Monaco, Consolas, monospace',
                    letterSpacing: "-0.2px",
                  }}
                >
                  {/* 1. CABECERA FISCAL */}
                  <div className="text-center space-y-0.5 mb-2">
                    {receiptConfig.mostrar_logo && (
                      <div className="mx-auto mb-2 flex justify-center">
                        {(company.logo_url || receiptConfig.logo_url) ? (
                          <img
                            src={company.logo_url || receiptConfig.logo_url}
                            alt="Extra Supermercado"
                            className="max-h-12 w-auto object-contain filter grayscale contrast-150"
                          />
                        ) : (
                          <div className="border-2 border-black px-3 py-1 font-black text-xs tracking-widest">
                            ★ EXTRA SUPERMERCADO ★
                          </div>
                        )}
                      </div>
                    )}
                    <div className="font-black text-xs uppercase tracking-wide">
                      {receiptConfig.nombre_fantasia || "EXTRA SUPERMERCADO"}
                    </div>
                    <div className="font-bold text-[10px]">
                      {receiptConfig.razon_social || "EXTRA SUPERMERCADO S.A."}
                    </div>
                    <div className="text-[10px]">
                      RUC: {receiptConfig.ruc || "80092451-2"} · Tel: {receiptConfig.telefono || "+595992052200"}
                    </div>
                    <div className="text-[9.5px]">
                      {receiptConfig.direccion || "Alejo García c/ Carlos Antonio López"}
                    </div>
                    <div className="text-[9.5px]">
                      {receiptConfig.ciudad || "Pedro Juan Caballero · Paraguay"}
                    </div>
                    {receiptConfig.slogan && (
                      <div className="text-[9px] italic pt-0.5">
                        "{receiptConfig.slogan}"
                      </div>
                    )}
                    <div className="text-[9.5px] pt-1 font-bold">
                      Timbrado Nº: {receiptConfig.timbrado || "18545636"}
                    </div>
                    <div className="text-[9px] text-slate-700">
                      Válido hasta: {receiptConfig.timbrado_vencimiento || "31/12/2026"}
                    </div>
                  </div>

                  {/* 2. DATOS DE LA TRANSACCIÓN */}
                  <div className="border-t border-b border-black border-dashed py-1.5 my-1.5 text-[10px] space-y-0.5">
                    {/* Tipo comprobante y número - SIEMPRE se imprime, igual que en ESC/POS */}
                    <div className="flex justify-between font-bold">
                      <span>
                        {receiptConfig.facturacion_electronica
                          ? "FACTURA ELECTRÓNICA"
                          : previewCustomerType === "socio"
                            ? "FACTURA CRÉDITO"
                            : "FACTURA CONTADO"
                        }:
                      </span>
                      <span>001-012-0004829</span>
                    </div>
                    {receiptConfig.usar_numero_interno_venta && (
                      <div className="flex justify-between text-[9px] text-slate-600">
                        <span>No Venta:</span>
                        <span className="font-mono">VTA-0000289</span>
                      </div>
                    )}
                    <div className="flex justify-between text-[9.5px]">
                      <span>Fecha / Hora:</span>
                      <span>{new Date().toLocaleDateString("es-PY")} {new Date().toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <div className="flex justify-between text-[9.5px]">
                      <span>Condición:</span>
                      <span>{previewCustomerType === "socio" ? "CRÉDITO EXTRA CLUB" : "CONTADO"}</span>
                    </div>
                    {receiptConfig.mostrar_cajero && (
                      <div className="flex justify-between text-[9.5px]">
                        <span>Cajero / Terminal:</span>
                        <span>Tomasa (Boca 012)</span>
                      </div>
                    )}
                    {receiptConfig.mostrar_cliente && (
                      <div className="flex justify-between text-[9.5px] font-bold">
                        <span>Cliente:</span>
                        <span className="truncate max-w-[170px]">
                          {previewCustomerType === "socio" ? "PEDRO RAMIREZ GONZALEZ" : "CONSUMIDOR FINAL"}
                        </span>
                      </div>
                    )}
                    {receiptConfig.mostrar_ruc_cliente && (
                      <div className="flex justify-between text-[9.5px]">
                        <span>RUC / C.I.:</span>
                        <span>{previewCustomerType === "socio" ? "3657834" : "44444401-7"}</span>
                      </div>
                    )}
                  </div>

                  {/* 3. DETALLE DE PRODUCTOS (FORMATO DOS LÍNEAS SUPERMERCADO) */}
                  <div className="py-1">
                    {/* Cabecera de columnas - igual que en ESC/POS */}
                    <div className="flex justify-between text-[9px] font-bold border-b border-black border-dashed pb-0.5 mb-1">
                      <span>DESCRIPCIÓN / DETALLE</span>
                      <span>TOTAL (GS)</span>
                    </div>

                    <div className="space-y-1.5 text-[9.5px]">
                      {/* Item 1: En Promo [P] */}
                      {receiptConfig.formato_items === "una_linea" ? (
                        <div className="flex justify-between">
                          <span className="font-bold uppercase truncate max-w-[160px]">COCA COLA PET 250ML</span>
                          <span className="font-mono font-bold">Gs. 7.000</span>
                        </div>
                      ) : (
                        <div>
                          <div className="font-bold uppercase tracking-tight">
                            COCA COLA ORIGINAL PET 250ML
                          </div>
                          <div className="flex justify-between items-baseline text-[9px] pl-1 font-mono">
                            <div className="flex items-center gap-1">
                              <span>2 UN x Gs. 3.500</span>
                              <span className="font-bold text-[8.5px] px-1 bg-black text-white rounded-sm">[P]</span>
                              {receiptConfig.mostrar_sku && <span className="text-[8px] text-slate-700">7840058001234</span>}
                            </div>
                            <span className="font-bold text-[9.5px]">Gs. 7.000</span>
                          </div>
                        </div>
                      )}

                      {/* Item 2: Mayorista [M] */}
                      {receiptConfig.formato_items === "una_linea" ? (
                        <div className="flex justify-between">
                          <span className="font-bold uppercase truncate max-w-[160px]">ARROZ TIO LUCAS 5KG</span>
                          <span className="font-mono font-bold">Gs. 85.500</span>
                        </div>
                      ) : (
                        <div>
                          <div className="font-bold uppercase tracking-tight">
                            ARROZ TIO LUCAS TIPO 1 5KG
                          </div>
                          <div className="flex justify-between items-baseline text-[9px] pl-1 font-mono">
                            <div className="flex items-center gap-1">
                              <span>3 UN x Gs. 28.500</span>
                              <span className="font-bold text-[8.5px] px-1 bg-black text-white rounded-sm">[M]</span>
                              {receiptConfig.mostrar_sku && <span className="text-[8px] text-slate-700">7891234567890</span>}
                            </div>
                            <span className="font-bold text-[9.5px]">Gs. 85.500</span>
                          </div>
                        </div>
                      )}

                      {/* Item 3: Balanza */}
                      {receiptConfig.formato_items === "una_linea" ? (
                        <div className="flex justify-between">
                          <span className="font-bold uppercase truncate max-w-[160px]">TOMATE SELECCIONADO {receiptConfig.mostrar_balanza_origen && "⚖"}</span>
                          <span className="font-mono font-bold">Gs. 9.945</span>
                        </div>
                      ) : (
                        <div>
                          <div className="font-bold uppercase tracking-tight">
                            TOMATE SALSA NACIONAL SELECCIONADO
                          </div>
                          <div className="flex justify-between items-baseline text-[9px] pl-1 font-mono">
                            <div className="flex items-center gap-1">
                              <span>0.850 KG x Gs. 11.700</span>
                              {receiptConfig.mostrar_balanza_origen && <span className="text-[8.5px]" title="Origen Balanza">⚖</span>}
                              {receiptConfig.mostrar_sku && <span className="text-[8px] text-slate-700">2000012017855</span>}
                            </div>
                            <span className="font-bold text-[9.5px]">Gs. 9.945</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 4. TOTALES & MULTIMONEDA */}
                  <div className="border-t border-black border-dashed pt-1 mt-1 text-[9px] space-y-0.5">
                    <div className="flex justify-between text-slate-700">
                      <span>SUBTOTAL (Precio Lista):</span>
                      <span className="font-mono font-bold">Gs. 201.000</span>
                    </div>
                    <div className="flex justify-between font-bold text-emerald-950">
                      <span>TOTAL EXTRA AHORRO:</span>
                      <span className="font-mono font-black">-Gs. 55.500</span>
                    </div>
                    <div className="border-t-2 border-black pt-1 my-0.5 flex justify-between items-baseline font-black text-xs">
                      <span>TOTAL A PAGAR:</span>
                      <span className="text-sm font-mono font-black">Gs. 145.500</span>
                    </div>

                    {receiptConfig.mostrar_multimoneda && (
                      <div className="pt-0.5 text-[8.5px] space-y-0.5 text-slate-800 border-t border-dotted border-black/40 mt-1">
                        {receiptConfig.mostrar_equivalente_brl && (
                          <div className="flex justify-between">
                            <span>Equivalente en Reales:</span>
                            <span className="font-bold font-mono">R$ 102.40</span>
                          </div>
                        )}
                        {receiptConfig.mostrar_equivalente_usd && (
                          <div className="flex justify-between">
                            <span>Equivalente en Dólares:</span>
                            <span className="font-bold font-mono">US$ 19.50</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 5. DESGLOSE DE MEDIOS DE PAGO */}
                  {receiptConfig.mostrar_desglose_pagos && (
                    <div className="border-t border-black border-dashed pt-1 mt-1 text-[8.5px] space-y-0.5">
                      <div className="font-bold">Medios de Pago:</div>
                      <div className="flex justify-between pl-1">
                        <span>EFECTIVO PYG:</span>
                        <span className="font-mono">Gs. 150.000</span>
                      </div>
                      {receiptConfig.donacion_activa && (
                        <div className="flex justify-between pl-1 font-bold text-[8px]">
                          <span>DONACIÓN SOLIDARIA:</span>
                          <span className="font-mono">Gs. 500</span>
                        </div>
                      )}
                      <div className="flex justify-between pl-1 font-black text-[9px] pt-0.5 border-t border-dotted border-black">
                        <span>VUELTO ENTREGADO:</span>
                        <span className="font-mono">Gs. 4.000 {receiptConfig.mostrar_vuelto_extranjero ? "(R$ 2.80)" : ""}</span>
                      </div>
                    </div>
                  )}

                  {/* 6. LIQUIDACIÓN IVA (DNIT / SIFEN) */}
                  {receiptConfig.mostrar_liquidacion_iva && (
                    <div className="border-t border-black border-dashed pt-1 mt-1 text-[8px] space-y-0.5">
                      <div className="font-bold text-[8.5px]">LIQUIDACIÓN DEL IVA (Ley Nº 6380/19):</div>
                      <div className="flex justify-between">
                        <span>Gravadas 10%: Gs. 132.273</span>
                        <span>IVA 10%: Gs. 13.227</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Gravadas 5%: Gs. 0</span>
                        <span>IVA 5%: Gs. 0</span>
                      </div>
                      <div className="flex justify-between font-bold">
                        <span>Exentas: Gs. 0</span>
                        <span>TOTAL IVA: Gs. 13.227</span>
                      </div>
                    </div>
                  )}

                  {/* 6.5. RECUADRO DE EXTRA AHORRO / PRECIOS MAYORISTAS (45 COLS) */}
                  {receiptConfig.habilitar_recuadro_ahorro && (
                    <div className="my-2 p-1.5 border-2 border-black rounded text-center text-[8.5px] font-mono leading-tight bg-white">
                      {previewCustomerType === "socio" ? (
                        <>
                          <div className="font-black text-[9px] tracking-wide text-black uppercase">
                            {receiptConfig.titulo_ahorro_con_descuento || "¡FELICIDADES! TU EXTRA AHORRO HOY:"}
                          </div>
                          <div className="text-xs font-black my-0.5 text-black font-mono">₲ 55.500 <span className="text-[8px] font-normal">(-27.6%)</span></div>
                          <div className="text-[7.5px] text-left px-1 space-y-0.5 pt-0.5 border-t border-dotted border-black/40">
                            <div className="flex justify-between">
                              <span>{receiptConfig.subtitulo_ahorro_promo || "• En Promociones:"}</span>
                              <strong className="font-mono">₲ 45.000</strong>
                            </div>
                            <div className="flex justify-between">
                              <span>{receiptConfig.subtitulo_ahorro_mayorista || "• En Precios Mayoristas:"}</span>
                              <strong className="font-mono">₲ 10.500 [M]</strong>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="font-black text-[9px] tracking-wide text-black uppercase">
                            {receiptConfig.titulo_invitacion_ahorro || "¡SUMATE AL EXTRA AHORRO DIARIO!"}
                          </div>
                          <div className="text-[7.5px] text-left px-1 space-y-0.5 mt-0.5 border-t border-dotted border-black/40 pt-0.5">
                            <div>{receiptConfig.linea1_invitacion_ahorro || "• Comprá por fardo/caja a precio [M]"}</div>
                            <div>{receiptConfig.linea2_invitacion_ahorro || "• Aprovechá las Ofertas de la Semana"}</div>
                            <div className="font-black text-center pt-0.5">{receiptConfig.linea3_invitacion_ahorro || "¡Los mejores precios de la región!"}</div>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* 7. PROGRAMA DE FIDELIZACIÓN EXTRA CLUB */}
                  {receiptConfig.habilitar_extra_club && (
                    <div className="border border-black border-dashed p-1.5 my-1.5 text-center text-[9px] space-y-0.5">
                      {previewCustomerType === "socio" ? (
                        <>
                          <div className="font-black text-[10px]">★ SOCIO EXTRA CLUB ★</div>
                          <div>Socio Nº: 3657834 · Puntos Ganados: +22</div>
                          <div className="font-bold">Saldo Total Acumulado: 2.872 Puntos</div>
                        </>
                      ) : (
                        <>
                          <div className="font-black text-[10px]">★ UNITE AL EXTRA CLUB ★</div>
                          <div className="text-[8.5px] leading-tight">
                            {receiptConfig.mensaje_invitacion_club || "Acumula puntos en cada compra para canjear por premios y descuentos directos."}
                          </div>
                          {receiptConfig.mostrar_qr_club && (
                            <div className="mx-auto my-1 w-12 h-12 border border-black flex items-center justify-center text-[7px] font-bold bg-white">
                              [QR CLUB]
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* 8. CAMPAÑA SOLIDARIA ABRE TU CORAZÓN */}
                  {receiptConfig.donacion_activa && (
                    <div className="border-t border-black border-dashed pt-1 mt-1 text-center text-[9px]">
                      <div className="font-black">{receiptConfig.donacion_titulo || "* ABRE TU CORAZÓN *"}</div>
                      <div className="text-[8.5px] leading-tight">
                        {receiptConfig.donacion_mensaje || "Gracias por colaborar con el Centro Amor y Esperanza."}
                      </div>
                      <div className="text-[8px] font-bold">{receiptConfig.donacion_web || "www.centroamoresperanza.org"}</div>
                    </div>
                  )}

                  {/* 9. MARKETING / CUPONERA */}
                  {receiptConfig.habilitar_mensaje_marketing && receiptConfig.mensaje_marketing && (
                    <div className="text-center font-bold text-[9px] pt-1">
                      {receiptConfig.mensaje_marketing}
                    </div>
                  )}

                  {receiptConfig.habilitar_cupon_descuento && (
                    <div className="border-2 border-black border-dashed p-1.5 my-1 text-center">
                      <div className="text-[8px] uppercase tracking-widest">✂ CUPÓN DE RECOMPRA ✂</div>
                      <div className="font-black text-xs tracking-wider my-0.5">
                        {receiptConfig.cupon_codigo || "EXTRA-VERANO-10"}
                      </div>
                      <div className="text-[8.5px] font-bold">{receiptConfig.cupon_descripcion || "10% OFF en tu próxima compra"}</div>
                      <div className="text-[7.5px] text-slate-600">Válido por {receiptConfig.cupon_validez_dias || 7} días</div>
                    </div>
                  )}

                  {/* 10. QR FISCAL SIFEN & PIE */}
                  <div className="text-center pt-1.5 space-y-1">
                    {receiptConfig.mostrar_qr_sifen && (
                      <div className="flex flex-col items-center">
                        <div className="w-16 h-16 border-2 border-black p-0.5 flex items-center justify-center bg-white">
                          <svg viewBox="0 0 24 24" className="w-full h-full text-black fill-current">
                            <path d="M2 2h8v8H2V2zm2 2v4h4V4H4zm10-2h8v8h-8V2zm2 2v4h4V4h-4zM2 14h8v8H2v-8zm2 2v4h4v-4H4zm14-2h4v2h-4v-2zm-4 0h2v4h-2v-4zm2 4h2v4h-2v-4zm2 2h4v2h-4v-2zm0-4h2v2h-2v-2z" />
                          </svg>
                        </div>
                        <div className="text-[7px] text-slate-800 mt-0.5 break-all leading-none font-mono">
                          CDC: 01{(receiptConfig.ruc || "80150377-9").replace("-", "").padStart(9, "0")}001012000004829120260829123456789
                        </div>
                        <div className="text-[7.5px] text-slate-700 font-bold">
                          Consulte en: https://ekuatia.set.gov.py/consultas
                        </div>
                      </div>
                    )}
                    <div className="font-bold text-[10px] pt-1">
                      {receiptConfig.mensaje_despedida || "¡Gracias por su preferencia!"}
                    </div>
                  </div>

                  {/* Saltos de Corte de Papel */}
                  {receiptConfig.mostrar_linea_corte_visual && (
                    <div className="text-center border-t border-slate-400 border-dashed text-[8px] text-slate-500 pt-1 mt-2">
                      - - - - - - - - - - - - - ✂ CORTE DE TICKET ✂ - - - - - - - - - - - - -
                    </div>
                  )}
                </div>

                {/* Borde dentado inferior (Tear-off Zig-zag) */}
                <div 
                  className="h-3 w-full bg-[#FAFAF7]" 
                  style={{
                    clipPath: "polygon(0% 0%, 2% 100%, 4% 0%, 6% 100%, 8% 0%, 10% 100%, 12% 0%, 14% 100%, 16% 0%, 18% 100%, 20% 0%, 22% 100%, 24% 0%, 26% 100%, 28% 0%, 30% 100%, 32% 0%, 34% 100%, 36% 0%, 38% 100%, 40% 0%, 42% 100%, 44% 0%, 46% 100%, 48% 0%, 50% 100%, 52% 0%, 54% 100%, 56% 0%, 58% 100%, 60% 0%, 62% 100%, 64% 0%, 66% 100%, 68% 0%, 70% 100%, 72% 0%, 74% 100%, 76% 0%, 78% 100%, 80% 0%, 82% 100%, 84% 0%, 86% 100%, 88% 0%, 90% 100%, 92% 0%, 94% 100%, 96% 0%, 98% 100%, 100% 0%)"
                  }}
                />
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
            <h3 className="text-sm font-black text-gray-900 dark:text-white">Asignar Nueva Caja / Máquina</h3>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <div>
                <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase block mb-1">Hostname (Windows):</label>
                <input
                  type="text"
                  value={newTerminalHostname}
                  onChange={(e) => setNewTerminalHostname(e.target.value)}
                  placeholder="CAJA1"
                  className="w-full bg-gray-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase block mb-1">IP Máquina (LAN):</label>
                <input
                  type="text"
                  value={newTerminalIp}
                  onChange={(e) => setNewTerminalIp(e.target.value.trim())}
                  placeholder="192.168.0.11"
                  className="w-full bg-gray-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase block mb-1">IP POS Bancard (REST):</label>
                <input
                  type="text"
                  value={newTerminalIpPosBancard}
                  onChange={(e) => setNewTerminalIpPosBancard(e.target.value.trim())}
                  placeholder="192.168.0.51"
                  className="w-full bg-gray-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase block mb-1">Punto Emisión (Boca):</label>
                <input
                  type="text"
                  value={newTerminalPunto}
                  onChange={(e) => setNewTerminalPunto(e.target.value.replace(/\D/g, "").slice(0, 3))}
                  placeholder="011"
                  className="w-full bg-gray-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase block mb-1">Nombre de la Caja:</label>
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
              Asignar Caja & Punto Fiscal
            </button>
          </div>

          {/* Listado de asignaciones existentes con Correlativos y Validación Fiscal */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-gray-900 dark:text-white">Cajas & Puntos de Emisión Enlazados</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Enlace permanente de máquinas por Hostname o IP fija, su IP de POS Bancard asignada y sus puntos de Factura y Nota de Crédito.
                </p>
              </div>
              <button onClick={fetchPosTerminals} disabled={loadingPosTerminals} className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 cursor-pointer">
                <RefreshCcw className={`w-3.5 h-3.5 ${loadingPosTerminals ? "animate-spin" : ""}`} /> Refrescar
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 dark:bg-slate-900/50 text-gray-500 dark:text-gray-400 uppercase text-[10px] font-bold border-b border-gray-100 dark:border-slate-700">
                  <tr>
                    <th className="p-3">Caja</th>
                    <th className="p-3">Hostname</th>
                    <th className="p-3">IP Máquina (LAN)</th>
                    <th className="p-3">IP POS Bancard</th>
                    <th className="p-3 text-center">Punto Fiscal</th>
                    <th className="p-3 text-center">Facturas (Actual / Final)</th>
                    <th className="p-3 text-center">Notas de Crédito</th>
                    <th className="p-3 text-center">Blindaje Fiscal</th>
                    <th className="p-3 text-center">Estado</th>
                    <th className="p-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60">
                  {!loadingPosTerminals && posTerminals.length === 0 && (
                    <tr><td colSpan={10} className="p-6 text-center text-gray-400 text-xs">Ninguna caja asignada todavía.</td></tr>
                  )}
                  {posTerminals.map((t) => {
                    const isFiscalOk = t.tiene_factura && t.tiene_nc
                    const isEditingIp = editingIpId === t.id
                    const isEditingBancardIp = editingBancardIpId === t.id

                    return (
                      <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-slate-750/50">
                        <td className="p-3 font-bold text-gray-900 dark:text-white">{t.caja_nombre}</td>
                        <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">{t.hostname}</td>
                        
                        {/* Celda de IP Máquina con edición rápida */}
                        <td className="p-3 font-mono text-xs">
                          {isEditingIp ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={editingIpVal}
                                onChange={(e) => setEditingIpVal(e.target.value)}
                                placeholder="192.168.0.X"
                                className="w-28 bg-white dark:bg-slate-900 border border-blue-500 rounded px-1.5 py-0.5 text-xs font-mono text-gray-900 dark:text-white"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveTerminalIp(t.id)}
                                className="px-1.5 py-0.5 rounded bg-emerald-600 text-white font-bold text-[10px] cursor-pointer"
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => setEditingIpId(null)}
                                className="px-1.5 py-0.5 rounded bg-gray-300 dark:bg-slate-700 text-gray-700 dark:text-gray-300 text-[10px] cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div
                              onClick={() => {
                                setEditingIpId(t.id)
                                setEditingIpVal(t.ip_address || "")
                              }}
                              className="group flex items-center gap-1.5 cursor-pointer hover:text-blue-600"
                              title="Hacer clic para editar IP de la máquina"
                            >
                              <span className={t.ip_address ? "text-gray-800 dark:text-gray-200 font-bold" : "text-gray-400 italic"}>
                                {t.ip_address || "Sin IP (Asignar)"}
                              </span>
                              <span className="opacity-0 group-hover:opacity-100 text-[10px] text-blue-500">✏️</span>
                            </div>
                          )}
                        </td>

                        {/* Celda de IP POS Bancard con edición rápida */}
                        <td className="p-3 font-mono text-xs">
                          {isEditingBancardIp ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={editingBancardIpVal}
                                onChange={(e) => setEditingBancardIpVal(e.target.value)}
                                placeholder="192.168.0.X"
                                className="w-28 bg-white dark:bg-slate-900 border border-emerald-500 rounded px-1.5 py-0.5 text-xs font-mono text-gray-900 dark:text-white"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveTerminalBancardIp(t.id)}
                                className="px-1.5 py-0.5 rounded bg-emerald-600 text-white font-bold text-[10px] cursor-pointer"
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => setEditingBancardIpId(null)}
                                className="px-1.5 py-0.5 rounded bg-gray-300 dark:bg-slate-700 text-gray-700 dark:text-gray-300 text-[10px] cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div
                              onClick={() => {
                                setEditingBancardIpId(t.id)
                                setEditingBancardIpVal(t.ip_pos_bancard || "")
                              }}
                              className="group flex items-center gap-1.5 cursor-pointer hover:text-emerald-600"
                              title="Hacer clic para editar IP del POS Bancard"
                            >
                              <span className={t.ip_pos_bancard ? "text-emerald-700 dark:text-emerald-400 font-bold" : "text-gray-400 italic"}>
                                {t.ip_pos_bancard || "Sin POS (Asignar)"}
                              </span>
                              <span className="opacity-0 group-hover:opacity-100 text-[10px] text-emerald-500">✏️</span>
                            </div>
                          )}
                        </td>

                        <td className="p-3 text-center font-mono font-black text-amber-600 dark:text-amber-400">
                          001-{t.punto_emision}
                        </td>

                        {/* Correlativo Factura */}
                        <td className="p-3 text-center font-mono">
                          {t.tiene_factura ? (
                            <div>
                              <span className="font-bold text-gray-900 dark:text-white">
                                {`001-${t.punto_emision}-${String(t.factura_actual || 0).padStart(7, "0")}`}
                              </span>
                              <div className="text-[10px] text-gray-400">
                                Hasta: {t.factura_final?.toLocaleString()}
                              </div>
                            </div>
                          ) : (
                            <span className="text-rose-500 font-bold text-[10px]">⚠️ Sin Factura</span>
                          )}
                        </td>

                        {/* Correlativo Nota de Crédito */}
                        <td className="p-3 text-center font-mono">
                          {t.tiene_nc ? (
                            <div>
                              <span className="font-bold text-gray-900 dark:text-white">
                                {`001-${t.punto_emision}-${String(t.nc_actual || 0).padStart(7, "0")}`}
                              </span>
                              <div className="text-[10px] text-gray-400">
                                Hasta: {t.nc_final?.toLocaleString()}
                              </div>
                            </div>
                          ) : (
                            <span className="text-rose-500 font-bold text-[10px]">⚠️ Sin NC</span>
                          )}
                        </td>

                        {/* Blindaje Fiscal */}
                        <td className="p-3 text-center">
                          {isFiscalOk ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                              ✓ Factura + NC
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
                              Incompleto
                            </span>
                          )}
                        </td>

                        {/* Estado */}
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
                    )
                  })}
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
