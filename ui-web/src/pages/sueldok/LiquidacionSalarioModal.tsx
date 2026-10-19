import React, { useState, useEffect, useRef } from "react"
import {
  FileText, Download, Printer, X, Calendar, Loader2, ShieldCheck
} from "lucide-react"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"
import { formatPYG } from "../../utils/format"
import { useToast } from "../../context/ToastContext"
import type { PayrollItem } from "./SueldokPage"

export interface SystemReferences {
  smlv?: number
  ipsWorkerRate?: number
  ipsEmployerRate?: number
  familyBonusRate?: number
  dailySalary?: number
  hourlyValue?: number
}

interface Props {
  isOpen: boolean
  onClose: () => void
  employee: PayrollItem | null
  periodoActivo: string
  availablePayrolls: Array<{ id: string; periodo: string; month?: number; year?: number; status?: string }>
  company: {
    nombre: string
    ruc: string
    apiKey: string
  }
  sueldokOverviewUrl: string
  systemReferences?: SystemReferences
}

// Nombres de meses en español
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
]

function getPeriodoLegible(periodoStr: string): string {
  if (!periodoStr || !periodoStr.includes("-")) return periodoStr
  const [year, month] = periodoStr.split("-")
  const mIdx = parseInt(month, 10) - 1
  if (mIdx >= 0 && mIdx < 12) {
    return `${MESES[mIdx]} de ${year}`
  }
  return periodoStr
}

function getRangoFechasPeriodo(periodoStr: string): string {
  if (!periodoStr || !periodoStr.includes("-")) return "Período Ordinario Mensual"
  const [yearStr, monthStr] = periodoStr.split("-")
  const y = parseInt(yearStr, 10)
  const m = parseInt(monthStr, 10)
  if (isNaN(y) || isNaN(m)) return "Período Ordinario Mensual"
  const ultimoDia = new Date(y, m, 0).getDate()
  return `01/${String(m).padStart(2, "0")}/${y} al ${ultimoDia}/${String(m).padStart(2, "0")}/${y}`
}

// Convertidor canónico de números a letras en Guaraníes (Paraguay)
function numeroALetrasPYG(monto: number): string {
  const unidades = ["", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"]
  const diez_a_diecinueve = [
    "DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE",
    "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE"
  ]
  const veintis = [
    "VEINTE", "VEINTIÚN", "VEINTIDÓS", "VEINTITRÉS", "VEINTICUATRO",
    "VEINTICINCO", "VEINTISÉIS", "VEINTISIETE", "VEINTIOCHO", "VEINTINUEVE"
  ]
  const decenas = [
    "", "DIEZ", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA",
    "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"
  ]
  const centenas = [
    "", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS",
    "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"
  ]

  function leerCentenas(n: number): string {
    if (n === 0) return ""
    if (n === 100) return "CIEN"
    let str = ""
    const c = Math.floor(n / 100)
    const d = Math.floor((n % 100) / 10)
    const u = n % 10

    if (c > 0) str += centenas[c] + " "
    const resto = n % 100
    if (resto >= 10 && resto <= 19) {
      str += diez_a_diecinueve[resto - 10]
    } else if (resto >= 20 && resto <= 29) {
      str += veintis[resto - 20]
    } else if (resto >= 30) {
      str += decenas[d]
      if (u > 0) str += " Y " + unidades[u]
    } else if (u > 0) {
      str += unidades[u]
    }
    return str.trim()
  }

  const entero = Math.floor(Math.abs(monto))
  if (entero === 0) return "CERO GUARANÍES"

  const millones = Math.floor(entero / 1000000)
  const miles = Math.floor((entero % 1000000) / 1000)
  const resto = entero % 1000

  let resultado = ""
  if (millones > 0) {
    resultado += millones === 1 ? "UN MILLÓN " : `${leerCentenas(millones)} MILLONES `
  }
  if (miles > 0) {
    resultado += miles === 1 ? "MIL " : `${leerCentenas(miles)} MIL `
  }
  if (resto > 0) {
    resultado += leerCentenas(resto)
  }

  return `GUARANÍES ${resultado.trim().replace(/\s+/g, " ")}`
}

export function LiquidacionSalarioModal({
  isOpen,
  onClose,
  employee,
  periodoActivo,
  availablePayrolls,
  company,
  sueldokOverviewUrl,
  systemReferences,
}: Props) {
  const toast = useToast()
  const printRef = useRef<HTMLDivElement>(null)

  const [selectedPeriod, setSelectedPeriod] = useState(periodoActivo || "2026-09")
  const [loadingPeriod, setLoadingPeriod] = useState(false)
  const [activeItem, setActiveItem] = useState<PayrollItem | null>(employee)
  const [currentRefs, setCurrentRefs] = useState<SystemReferences | undefined>(systemReferences)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)

  // Sincronizar cuando cambia el empleado, las referencias o el período base
  useEffect(() => {
    setActiveItem(employee)
    setSelectedPeriod(periodoActivo || "2026-09")
    if (systemReferences) setCurrentRefs(systemReferences)
  }, [employee, periodoActivo, systemReferences])

  // Carga reactiva de datos si se selecciona un período diferente
  useEffect(() => {
    if (!isOpen || !employee) return
    if (selectedPeriod === periodoActivo && employee) {
      setActiveItem(employee)
      return
    }

    let isMounted = true
    setLoadingPeriod(true)

    fetch(`${sueldokOverviewUrl}?apiKey=${company.apiKey}&periodo=${selectedPeriod}`)
      .then((res) => res.json())
      .then((json) => {
        if (!isMounted) return
        if (json?.references) {
          setCurrentRefs(json.references)
        }
        const items = json?.approvedPayroll?.items || []
        const cleanCi = String(employee.ci || "").replace(/\D/g, "")
        const match = items.find((it: any) => {
          const itCi = String(it.ci || "").replace(/\D/g, "")
          return (cleanCi && itCi === cleanCi) || it.id === employee.id || it.employeeId === employee.id
        })

        if (match) {
          setActiveItem({
            id: match.id || match.employeeId,
            nombre: match.nombre,
            ci: match.ci,
            cargo: match.cargo,
            depto: match.depto,
            baseSalary: match.baseSalary,
            bonus: match.bonus || 0,
            totalGross: match.totalGross,
            ipsWorker: match.ipsWorker !== undefined ? match.ipsWorker : 0,
            ipsEmployer: match.ipsEmployer !== undefined ? match.ipsEmployer : 0,
            advances: match.advances || 0,
            deductions: match.deductions || 0,
            loanDeductions: match.loanDeductionsDetails || match.typedDeductions || match.loanDeductions || [],
            loanDeduction: match.loanDeduction || 0,
            commercialDeduction: match.commercialDeduction || 0,
            judicialDeduction: match.judicialDeduction || 0,
            otherDeduction: match.otherDeduction || 0,
            attendanceDeduction: match.attendanceDeduction || 0,
            concepts: match.concepts || [],
            totalNet: match.totalNet || 0,
            rawItem: match.rawItem || match,
          })
        } else {
          // Si no está liquidado en este período, proyectar con valores del sistema
          const baseSal = employee.baseSalary || 0
          const smlv = json?.references?.smlv || currentRefs?.smlv || 3044000
          const workerRate = json?.references?.ipsWorkerRate || currentRefs?.ipsWorkerRate || 0.09
          const employerRate = json?.references?.ipsEmployerRate || currentRefs?.ipsEmployerRate || 0.165
          const workerIps = employee.ipsWorker !== undefined && employee.ipsWorker > 0
            ? employee.ipsWorker
            : Math.round(smlv * workerRate)
          const employerIps = employee.ipsEmployer !== undefined && employee.ipsEmployer > 0
            ? employee.ipsEmployer
            : Math.round(smlv * employerRate)

          setActiveItem({
            ...employee,
            baseSalary: baseSal,
            bonus: 0,
            totalGross: baseSal,
            ipsWorker: workerIps,
            ipsEmployer: employerIps,
            advances: 0,
            deductions: 0,
            loanDeductions: [],
            loanDeduction: 0,
            commercialDeduction: 0,
            totalNet: Math.max(0, baseSal - workerIps),
          })
        }
      })
      .catch((err) => {
        console.error("Error al cargar período seleccionado:", err)
      })
      .finally(() => {
        if (isMounted) setLoadingPeriod(false)
      })

    return () => {
      isMounted = false
    }
  }, [selectedPeriod, isOpen, employee, periodoActivo, sueldokOverviewUrl, company.apiKey, currentRefs?.smlv, currentRefs?.ipsWorkerRate, currentRefs?.ipsEmployerRate])

  if (!isOpen || !activeItem) return null

  // ── RESOLUCIÓN DINÁMICA DE REFERENCIAS PREVISIONALES DEL SISTEMA ──
  // Si el item ya tiene ipsWorker calculado por el sistema (ej. 273.960 Gs.), la base real es ipsWorker / 0.09 = 3.044.000
  const workerRate = currentRefs?.ipsWorkerRate || 0.09
  const employerRate = currentRefs?.ipsEmployerRate || 0.165
  const smlvDelSistema = currentRefs?.smlv || (
    activeItem.ipsWorker && activeItem.ipsWorker > 0
      ? Math.round(activeItem.ipsWorker / workerRate)
      : 3044000
  )

  // ── DESGLOSE DE HABERES ──
  const haberes: Array<{ concepto: string; tipo: string; referencia: string; monto: number }> = [
    {
      concepto: "Salario Ordinario Mensual",
      tipo: "Sueldo Base",
      referencia: "30 Días Liquidados",
      monto: Number(activeItem.baseSalary || 0),
    },
  ]

  if (Number(activeItem.bonus || 0) > 0) {
    haberes.push({
      concepto: "Bonificación por Responsabilidad / Productividad",
      tipo: "Asignación Adicional",
      referencia: "Caja / Rendimiento",
      monto: Number(activeItem.bonus),
    })
  }

  // Otros conceptos positivos devengados
  if (Array.isArray(activeItem.concepts)) {
    activeItem.concepts.forEach((c: any) => {
      const amt = Number(c.amount || 0)
      if (amt > 0) {
        haberes.push({
          concepto: c.description ? c.description.toUpperCase() : "Haberes Extraordinarios",
          tipo: c.type || "Adicional",
          referencia: c.reference || "Conforme a Planilla",
          monto: amt,
        })
      }
    })
  }

  // ── DESGLOSE DETALLADO DE DESCUENTOS Y OPERACIONES ──
  const descuentos: Array<{ concepto: string; tipo: string; referencia: string; monto: number }> = []

  // 1. Aporte Previsional IPS Obrero (9% sobre Salario Mínimo Legal del Sistema)
  const ipsMontoCalculado =
    activeItem.ipsWorker !== undefined && activeItem.ipsWorker > 0
      ? activeItem.ipsWorker
      : Math.round(smlvDelSistema * workerRate)

  if (ipsMontoCalculado > 0) {
    descuentos.push({
      concepto: `Aporte Jubilatorio Obrero I.P.S. (${Math.round(workerRate * 100)}%)`,
      tipo: "Retención Legal",
      referencia: `Base SMLV ₲ ${formatPYG(smlvDelSistema)} (Ley 213/93)`,
      monto: ipsMontoCalculado,
    })
  }

  // 2. Consumo Comercial Extra Club / Vales de Salón
  if (Number(activeItem.commercialDeduction || 0) > 0) {
    descuentos.push({
      concepto: "Consumo Comercial Extra Club / Vales de Salón",
      tipo: "Crédito Salón",
      referencia: "Despensa Mayorista / Extra Club",
      monto: Number(activeItem.commercialDeduction),
    })
  }

  // 3. Anticipos de Salario Quincenal
  if (Number(activeItem.advances || 0) > 0) {
    descuentos.push({
      concepto: "Anticipo de Salario Quincenal",
      tipo: "Anticipo",
      referencia: "Entrega Efectivo / Transferencia SIPAP",
      monto: Number(activeItem.advances),
    })
  }

  // 4. Desglose Exhaustivo de Préstamos y Convenios Comerciales de Terceros
  const loanList =
    (Array.isArray(activeItem.loanDeductions) && activeItem.loanDeductions.length > 0)
      ? activeItem.loanDeductions
      : (activeItem.rawItem?.loanDeductionsDetails || activeItem.rawItem?.typedDeductions || [])

  if (Array.isArray(loanList) && loanList.length > 0) {
    loanList.forEach((ld: any, idx: number) => {
      const amt = Number(ld.amount || 0)
      if (amt <= 0) return

      const razon = ld.reason || ld.description || ld.descripcion || `Convenio Comercial / Préstamo #${idx + 1}`
      const cuotas = ld.installments && ld.installments > 1
        ? `Cuota ${ld.paidInstallments || 1} de ${ld.installments}`
        : (ld.thirdPartyName ? `Convenio: ${ld.thirdPartyName}` : "Retención Autorizada")

      descuentos.push({
        concepto: razon.toUpperCase(),
        tipo: ld.category || "Convenio Tercero",
        referencia: cuotas,
        monto: amt,
      })
    })
  } else if (
    Number(activeItem.loanDeduction || 0) > 0 &&
    !descuentos.some(d => d.concepto.includes("CONVENIO") || d.concepto.includes("PRÉSTAMO") || d.concepto.includes("MALOU"))
  ) {
    descuentos.push({
      concepto: "Convenio Comercial / Préstamo de Personal",
      tipo: "Convenio",
      referencia: "Retención Autorizada",
      monto: Number(activeItem.loanDeduction),
    })
  }

  // 5. Retención Judicial / Embargo
  if (Number(activeItem.judicialDeduction || 0) > 0) {
    descuentos.push({
      concepto: "Retención Judicial / Embargo Preventivo",
      tipo: "Mandato Judicial",
      referencia: "Oficio Judicial N°",
      monto: Number(activeItem.judicialDeduction),
    })
  }

  // 6. Llegadas Tardías / Ausencias Injustificadas
  if (Number(activeItem.attendanceDeduction || 0) > 0) {
    descuentos.push({
      concepto: "Descuento por Llegadas Tardías / Ausencias",
      tipo: "Asistencia",
      referencia: "Reloj Biométrico de Marcación",
      monto: Number(activeItem.attendanceDeduction),
    })
  }

  // 7. Otras Deducciones Autorizadas
  if (Number(activeItem.otherDeduction || 0) > 0) {
    descuentos.push({
      concepto: "Otras Deducciones Autorizadas por el Trabajador",
      tipo: "Varios",
      referencia: "Conforme a Autorización Expresa",
      monto: Number(activeItem.otherDeduction),
    })
  }

  const totalHaberes = haberes.reduce((sum, h) => sum + h.monto, 0)
  const totalDescuentos = descuentos.reduce((sum, d) => sum + d.monto, 0)
  const netoACobrar = Math.max(0, totalHaberes - totalDescuentos)

  // Aporte Patronal IPS (Informativo, 16.5% sobre el SMLV del sistema)
  const ipsPatronalMonto =
    activeItem.ipsEmployer !== undefined && activeItem.ipsEmployer > 0
      ? activeItem.ipsEmployer
      : Math.round(smlvDelSistema * employerRate)

  // Descarga limpia en PDF A4 de alta definición
  const handleDownloadPdf = async () => {
    if (!printRef.current) return
    setIsGeneratingPdf(true)
    toast.info("Generando Liquidación Oficial", "Procesando documento corporativo en alta resolución...")

    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        windowWidth: 1024,
      })

      const imgData = canvas.toDataURL("image/jpeg", 0.98)
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      })

      pdf.addImage(imgData, "JPEG", 0, 0, 210, 297, undefined, "FAST")
      const cleanCi = String(activeItem.ci || "funcionario").replace(/\D/g, "")
      const filename = `liquidacion_salario_${cleanCi}_${selectedPeriod}.pdf`
      pdf.save(filename)
      toast.success("Documento Descargado", `Liquidación oficial guardada con éxito como ${filename}.`)
    } catch (err: any) {
      console.error("Error generando PDF de liquidación:", err)
      toast.error("Error al generar PDF", err.message || String(err))
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const cleanCi = String(activeItem.ci || "").replace(/\D/g, "")
  const nroRecibo = `LIQ-${selectedPeriod.replace("-", "")}-${cleanCi || "000"}`
  const periodoLegible = getPeriodoLegible(selectedPeriod)
  const rangoFechas = getRangoFechasPeriodo(selectedPeriod)

  // Fecha actual en Paraguay
  const fechaHoyStr = new Intl.DateTimeFormat("es-PY", {
    timeZone: "America/Asuncion",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date())

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full p-5 sm:p-6 shadow-2xl space-y-4 my-4 text-slate-900 dark:text-white"
      >
        {/* Cabecera Modal de Control */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black flex items-center gap-2">
                Liquidación Individual de Salario
                <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300">
                  Ley 213/93 · Formato Premium
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                {activeItem.nombre} · CI: {activeItem.ci || "—"} · Cargo: {activeItem.cargo}
              </p>
            </div>
          </div>

          {/* Selector de Período y Botón de Cerrar */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
              <Calendar className="w-4 h-4 text-indigo-500" />
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Período:</span>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                disabled={loadingPeriod}
                className="bg-transparent text-xs font-black font-mono text-indigo-600 dark:text-indigo-400 outline-none cursor-pointer"
              >
                {availablePayrolls && availablePayrolls.length > 0 ? (
                  availablePayrolls.map((p) => (
                    <option key={p.id || p.periodo} value={p.periodo} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                      {p.periodo} {p.status ? `(${p.status})` : ""}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="2026-10">2026-10 (Octubre 2026)</option>
                    <option value="2026-09">2026-09 (Septiembre 2026)</option>
                    <option value="2026-08">2026-08 (Agosto 2026)</option>
                    <option value="2026-07">2026-07 (Julio 2026)</option>
                  </>
                )}
              </select>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-all"
              title="Cerrar ventana"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Barra de Acciones y Resumen Rápido */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Neto a Percibir:</span>
            <span className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3.5 py-1 rounded-xl border border-emerald-500/20 shadow-xs">
              {formatPYG(netoACobrar)}
            </span>
            <span className="text-xs text-slate-400 hidden sm:inline">
              (Haberes: {formatPYG(totalHaberes)} | Descuentos: -{formatPYG(totalDescuentos)})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf || loadingPeriod}
              className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-indigo-600/30 disabled:opacity-50"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generando PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Descargar Recibo Oficial (PDF)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Visor del Documento A4 Oficial Corporativo */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-2 sm:p-5 bg-slate-100 dark:bg-slate-950/50 max-h-[66vh] overflow-y-auto">
          <div
            ref={printRef}
            className="bg-white text-slate-900 mx-auto p-8 sm:p-10 shadow-lg rounded-xl max-w-[820px] border border-slate-300 space-y-5 print:m-0 print:p-0 print:border-none print:shadow-none"
            style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
          >
            {/* ── ENCABEZADO CORPORATIVO OFICIAL CON LOGOTIPO ── */}
            <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4 gap-4">
              <div className="flex items-center gap-4">
                {/* Logotipo Oficial Extra Supermercado */}
                <div className="w-20 h-16 sm:w-24 sm:h-18 flex items-center justify-center p-1 bg-white rounded-lg border border-slate-200 shadow-xs shrink-0">
                  <img
                    src="/logo_extra.png"
                    alt="Extra Supermercado"
                    className="max-h-full max-w-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none"
                    }}
                  />
                </div>
                <div>
                  <h1 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight leading-tight">
                    GRUPO SANTA TERESA E.A.S.
                  </h1>
                  <h2 className="text-xs sm:text-sm font-black text-indigo-700 uppercase tracking-wide">
                    Extra Supermercado Mayorista
                  </h2>
                  <div className="text-[11px] text-slate-600 space-y-0.5 mt-0.5 font-medium">
                    <div>R.U.C.: <strong className="font-mono text-slate-900 font-bold">80150377-9</strong> · Timbrado: <span className="font-mono">18545636</span></div>
                    <div>Ruta PY05 c/ Av. Fernando de la Mora · Pedro Juan Caballero, Paraguay</div>
                  </div>
                </div>
              </div>

              {/* Placa Identificatoria del Comprobante Laboral */}
              <div className="text-right shrink-0 bg-slate-50 border border-slate-200 rounded-xl p-3">
                <span className="text-[9px] font-black uppercase tracking-widest text-indigo-600 block">
                  DOCUMENTO RESPALDATORIO LABORAL
                </span>
                <span className="text-xs sm:text-sm font-black text-slate-900 uppercase block tracking-tight">
                  RECIBO DE SALARIOS
                </span>
                <div className="text-[11px] font-mono font-bold text-slate-700 mt-0.5">
                  N° {nroRecibo}
                </div>
                <div className="text-[10px] text-slate-500 font-bold mt-1 uppercase">
                  Período: <span className="text-indigo-700 font-mono font-black">{periodoLegible}</span>
                </div>
              </div>
            </div>

            {/* ── FICHA DE DATOS DEL COLABORADOR ── */}
            <div className="bg-slate-50/80 border-l-4 border-indigo-600 border border-slate-200 rounded-xl p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-500 block">Trabajador / Beneficiario</span>
                <span className="font-black text-slate-900 block text-xs tracking-tight">{activeItem.nombre}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-500 block">Documento de Identidad (C.I.)</span>
                <span className="font-bold font-mono text-slate-900 block">{activeItem.ci || "—"}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-500 block">Cargo / Función Asignada</span>
                <span className="font-bold text-slate-900 block">{activeItem.cargo || "Colaborador"}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-500 block">Departamento / Sección</span>
                <span className="font-bold text-slate-900 block">{activeItem.depto || "General"}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-500 block">Días Liquidados</span>
                <span className="font-bold text-slate-900 block">30 Días (Mes Completo)</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-500 block">Rango de Liquidación</span>
                <span className="font-bold font-mono text-[11px] text-slate-700 block">{rangoFechas}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-500 block">Base IPS Obrero Declarada</span>
                <span className="font-bold font-mono text-indigo-700 block">SMLV ₲ {formatPYG(smlvDelSistema)}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-500 block">Fecha de Emisión</span>
                <span className="font-bold text-slate-700 block">{fechaHoyStr}</span>
              </div>
            </div>

            {/* ── TABLA PRINCIPAL DE LIQUIDACIÓN DE HABERES Y DESCUENTOS ── */}
            <div className="border border-slate-300 rounded-xl overflow-hidden text-xs shadow-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-900 text-white text-[10px] uppercase font-black tracking-wider">
                    <th className="py-2.5 px-3">Concepto Liquidado</th>
                    <th className="py-2.5 px-3">Clasificación</th>
                    <th className="py-2.5 px-3 text-center">Referencia / Cuotas</th>
                    <th className="py-2.5 px-3 text-right">Haberes (+)</th>
                    <th className="py-2.5 px-3 text-right">Descuentos (-)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {/* Filas de Haberes */}
                  {haberes.map((h, i) => (
                    <tr key={`h-${i}`} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-slate-900">{h.concepto}</td>
                      <td className="py-2.5 px-3 text-slate-500 text-[10px] uppercase font-medium">{h.tipo}</td>
                      <td className="py-2.5 px-3 text-center text-slate-600 font-mono text-[11px]">{h.referencia}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{formatPYG(h.monto)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-300">—</td>
                    </tr>
                  ))}

                  {/* Filas de Descuentos Detallados */}
                  {descuentos.map((d, i) => (
                    <tr key={`d-${i}`} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-slate-900">{d.concepto}</td>
                      <td className="py-2.5 px-3 text-slate-500 text-[10px] uppercase font-medium">{d.tipo}</td>
                      <td className="py-2.5 px-3 text-center text-slate-600 font-mono text-[11px]">{d.referencia}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-300">—</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600">-{formatPYG(d.monto)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-black text-xs border-t-2 border-slate-300">
                    <td colSpan={3} className="py-2.5 px-3 uppercase text-slate-800 tracking-wider">
                      TOTALES GENERALES LIQUIDADOS
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-900 text-sm">
                      {formatPYG(totalHaberes)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-rose-600 text-sm">
                      -{formatPYG(totalDescuentos)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* ── RECUADRO CANÓNICO: NETO A PERCIBIR Y EN LETRAS ── */}
            <div className="bg-gradient-to-r from-indigo-50/90 to-emerald-50/90 border-2 border-indigo-300 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-black tracking-widest text-indigo-800 block">
                  SALARIO NETO LÍQUIDO A PERCIBIR
                </span>
                <span className="text-xs font-bold text-slate-800 block">
                  SON: <strong className="font-black text-slate-900">{numeroALetrasPYG(netoACobrar)}</strong>
                </span>
              </div>
              <div className="text-right shrink-0">
                <div className="text-2xl font-black font-mono text-indigo-950 bg-white px-5 py-2 rounded-xl border-2 border-indigo-400 shadow-sm inline-block">
                  {formatPYG(netoACobrar)}
                </div>
              </div>
            </div>

            {/* ── NOTA PREVISIONAL INFORMATIVA (LEY DE SEGURIDAD SOCIAL) ── */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-[11px] text-slate-600">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  <strong>Aporte Patronal I.P.S. ({(employerRate * 100).toFixed(1)}%):</strong> Contribución a cargo exclusivo de la patronal sobre base SMLV (₲ {formatPYG(ipsPatronalMonto)}), no deducible del salario.
                </span>
              </div>
              <span className="font-mono font-bold text-slate-800 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200 shrink-0">
                {formatPYG(ipsPatronalMonto)}
              </span>
            </div>

            {/* ── CLÁUSULA LEGAL DE CONFORMIDAD (CÓDIGO DEL TRABAJO - LEY 213/93) ── */}
            <p className="text-[10px] text-slate-500 text-justify leading-relaxed italic border-t border-slate-200 pt-3">
              De conformidad con lo dispuesto en el Art. 235 y concordantes del Código del Trabajo (Ley N° 213/93), dejo formal constancia de haber recibido a mi entera satisfacción de la firma empleadora <strong>GRUPO SANTA TERESA E.A.S. (Extra Supermercado Mayorista)</strong> el importe líquido consignado en el presente recibo, correspondiente a la liquidación de mis haberes y beneficios del período indicado, habiéndose efectuado las deducciones de ley y compromisos comerciales expresamente autorizados, recibiendo el duplicado de rigor.
            </p>

            {/* ── SECTOR CANÓNICO DE FIRMAS Y SELLOS ── */}
            <div className="grid grid-cols-2 gap-12 pt-10">
              <div className="text-center border-t-2 border-slate-800 pt-2">
                <span className="text-[11px] font-black text-slate-900 uppercase block tracking-wider">
                  Firma y Sello Empleador
                </span>
                <span className="text-[10px] text-slate-600 block font-medium">
                  Grupo Santa Teresa E.A.S. · RUC 80150377-9
                </span>
              </div>
              <div className="text-center border-t-2 border-slate-800 pt-2">
                <span className="text-[11px] font-black text-slate-900 uppercase block tracking-wider">
                  Firma y Aclaración del Trabajador
                </span>
                <span className="text-[10px] text-slate-600 block font-medium">
                  C.I. N°: <span className="font-mono font-bold">{activeItem.ci || "—"}</span> (Duplicado Recibido)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
