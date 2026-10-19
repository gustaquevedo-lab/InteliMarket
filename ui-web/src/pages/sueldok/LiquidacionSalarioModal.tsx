import React, { useState, useEffect, useRef } from "react"
import {
  FileText, Download, Printer, X, User, Building, Calendar, CheckCircle, Loader2
} from "lucide-react"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"
import { formatPYG } from "../../utils/format"
import { useToast } from "../../context/ToastContext"
import type { PayrollItem } from "./SueldokPage"

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
}: Props) {
  const toast = useToast()
  const printRef = useRef<HTMLDivElement>(null)

  const [selectedPeriod, setSelectedPeriod] = useState(periodoActivo || "2026-09")
  const [loadingPeriod, setLoadingPeriod] = useState(false)
  const [activeItem, setActiveItem] = useState<PayrollItem | null>(employee)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)

  // Sincronizar cuando cambia el empleado o el período base
  useEffect(() => {
    setActiveItem(employee)
    setSelectedPeriod(periodoActivo || "2026-09")
  }, [employee, periodoActivo])

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
            ipsWorker: match.ipsWorker || 0,
            ipsEmployer: match.ipsEmployer || 0,
            advances: match.advances || 0,
            deductions: match.deductions || 0,
            loanDeductions: match.loanDeductions || [],
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
          // Si no está liquidado en este período, mostrar valores base del empleado
          setActiveItem({
            ...employee,
            baseSalary: employee.baseSalary,
            bonus: 0,
            totalGross: employee.baseSalary,
            ipsWorker: Math.round(employee.baseSalary * 0.09),
            ipsEmployer: Math.round(employee.baseSalary * 0.165),
            advances: 0,
            deductions: 0,
            totalNet: Math.round(employee.baseSalary * 0.91),
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
  }, [selectedPeriod, isOpen, employee, periodoActivo, sueldokOverviewUrl, company.apiKey])

  if (!isOpen || !activeItem) return null

  // Construcción detallada de filas de haberes y descuentos
  const haberes: Array<{ concepto: string; referencia: string; monto: number }> = [
    { concepto: "Salario Mensual Ordinario", referencia: "30 Días", monto: Number(activeItem.baseSalary || 0) },
  ]

  if (Number(activeItem.bonus || 0) > 0) {
    haberes.push({
      concepto: "Bonificación / Asignación Extraordinaria",
      referencia: "Productividad / Caja",
      monto: Number(activeItem.bonus),
    })
  }

  // Otros conceptos positivos
  if (Array.isArray(activeItem.concepts)) {
    activeItem.concepts.forEach((c: any) => {
      const amt = Number(c.amount || 0)
      if (amt > 0) {
        haberes.push({
          concepto: c.description ? c.description.toUpperCase() : "Bonificación Adicional",
          referencia: "Haberes Extra",
          monto: amt,
        })
      }
    })
  }

  const descuentos: Array<{ concepto: string; referencia: string; monto: number }> = [
    {
      concepto: "Aporte Jubilatorio IPS Obrero (9%)",
      referencia: "Ley 213/93",
      monto: Number(activeItem.ipsWorker || Math.round(activeItem.baseSalary * 0.09)),
    },
  ]

  if (Number(activeItem.commercialDeduction || 0) > 0) {
    descuentos.push({
      concepto: "Consumo Comercial Extra Club / Vales",
      referencia: "Crédito Salón",
      monto: Number(activeItem.commercialDeduction),
    })
  }

  if (Number(activeItem.advances || 0) > 0 && Number(activeItem.advances) !== Number(activeItem.loanDeduction)) {
    descuentos.push({
      concepto: "Anticipo Quincenal de Salario",
      referencia: "Entrega Efectivo/SIPAP",
      monto: Number(activeItem.advances),
    })
  }

  // Desglose de préstamos / convenios de terceros
  if (Array.isArray(activeItem.loanDeductions) && activeItem.loanDeductions.length > 0) {
    activeItem.loanDeductions.forEach((ld: any) => {
      descuentos.push({
        concepto: ld.reason || ld.descripcion || "Préstamo / Retención Comercial",
        referencia: ld.thirdPartyName || "Convenio",
        monto: Number(ld.amount || 0),
      })
    })
  } else if (Number(activeItem.loanDeduction || 0) > 0 && !descuentos.some(d => d.concepto.includes("Préstamo") || d.concepto.includes("Convenio"))) {
    descuentos.push({
      concepto: "Deducción de Préstamos / Convenios",
      referencia: "Interno",
      monto: Number(activeItem.loanDeduction),
    })
  }

  if (Number(activeItem.judicialDeduction || 0) > 0) {
    descuentos.push({
      concepto: "Retención Judicial / Embargo",
      referencia: "Oficio Judicial",
      monto: Number(activeItem.judicialDeduction),
    })
  }

  if (Number(activeItem.attendanceDeduction || 0) > 0) {
    descuentos.push({
      concepto: "Descuento por Llegadas Tardías / Ausencias",
      referencia: "Reloj Marcador",
      monto: Number(activeItem.attendanceDeduction),
    })
  }

  if (Number(activeItem.otherDeduction || 0) > 0) {
    descuentos.push({
      concepto: "Otras Deducciones Autorizadas",
      referencia: "Varios",
      monto: Number(activeItem.otherDeduction),
    })
  }

  const totalHaberes = haberes.reduce((sum, h) => sum + h.monto, 0)
  const totalDescuentos = descuentos.reduce((sum, d) => sum + d.monto, 0)
  const netoACobrar = Math.max(0, totalHaberes - totalDescuentos)

  // Descarga limpia en PDF A4
  const handleDownloadPdf = async () => {
    if (!printRef.current) return
    setIsGeneratingPdf(true)
    toast.info("Generando Liquidación", "Preparando documento oficial A4 para descarga...")

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
      toast.success("Documento Descargado", `Liquidación oficial guardada como ${filename}.`)
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

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-5 my-8 text-slate-900 dark:text-white"
      >
        {/* Header Modal */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black flex items-center gap-2">
                Liquidación Oficial de Salario
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300">
                  Ley 213/93
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                {activeItem.nombre} · CI: {activeItem.ci || "—"} · {activeItem.cargo}
              </p>
            </div>
          </div>

          {/* Selector de Período y Botón de Cierre */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <Calendar className="w-4 h-4 text-indigo-500" />
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Mes:</span>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                disabled={loadingPeriod}
                className="bg-transparent text-xs font-bold font-mono text-indigo-600 dark:text-indigo-400 outline-none cursor-pointer"
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
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Barra de Acciones de Descarga e Impresión */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Total a Percibir:</span>
            <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-xl border border-emerald-500/20">
              {formatPYG(netoACobrar)}
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

        {/* Vista previa Documento A4 Oficial */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-slate-100 dark:bg-slate-950/50 max-h-[60vh] overflow-y-auto">
          <div
            ref={printRef}
            className="bg-white text-slate-900 mx-auto p-8 shadow-md rounded-lg max-w-[800px] border border-slate-300 space-y-6 print:m-0 print:p-0 print:border-none print:shadow-none"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            {/* Encabezado Corporativo Oficial */}
            <div className="flex items-start justify-between border-b-2 border-indigo-600 pb-4">
              <div>
                <div className="text-lg font-black text-slate-900 uppercase tracking-tight">
                  GRUPO SANTA TERESA E.A.S.
                </div>
                <div className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
                  Extra Supermercado Mayorista
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  RUC: 80150377-9 · Pedro Juan Caballero, Paraguay
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 block">
                  Documento Respaldatorio Laboral
                </span>
                <span className="text-sm font-black text-slate-800 uppercase block">
                  Recibo de Salarios / Liquidación
                </span>
                <span className="text-[11px] font-bold font-mono text-slate-500">
                  Período: {selectedPeriod}
                </span>
              </div>
            </div>

            {/* Ficha del Colaborador */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Trabajador</span>
                <span className="font-black text-slate-800 block text-xs">{activeItem.nombre}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Documento de Identidad</span>
                <span className="font-bold font-mono text-slate-800 block">{activeItem.ci || "—"}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Cargo / Función</span>
                <span className="font-bold text-slate-800 block">{activeItem.cargo || "Colaborador"}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Departamento / Sección</span>
                <span className="font-bold text-slate-800 block">{activeItem.depto || "General"}</span>
              </div>
            </div>

            {/* Tabla Detallada de Haberes y Descuentos */}
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 text-[10px] uppercase font-black border-b border-slate-200">
                    <th className="p-2.5">Concepto Liquidado</th>
                    <th className="p-2.5 text-center">Referencia / Cuotas</th>
                    <th className="p-2.5 text-right">Haberes</th>
                    <th className="p-2.5 text-right">Descuentos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {/* Filas de Haberes */}
                  {haberes.map((h, i) => (
                    <tr key={`h-${i}`}>
                      <td className="p-2.5 font-bold text-slate-800">{h.concepto}</td>
                      <td className="p-2.5 text-center text-slate-500 font-mono text-[11px]">{h.referencia}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-900">{formatPYG(h.monto)}</td>
                      <td className="p-2.5 text-right font-mono text-slate-400">—</td>
                    </tr>
                  ))}

                  {/* Filas de Descuentos */}
                  {descuentos.map((d, i) => (
                    <tr key={`d-${i}`}>
                      <td className="p-2.5 font-bold text-slate-800">{d.concepto}</td>
                      <td className="p-2.5 text-center text-slate-500 font-mono text-[11px]">{d.referencia}</td>
                      <td className="p-2.5 text-right font-mono text-slate-400">—</td>
                      <td className="p-2.5 text-right font-mono font-bold text-rose-600">-{formatPYG(d.monto)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-black text-xs border-t-2 border-slate-200">
                    <td colSpan={2} className="p-2.5 uppercase text-slate-700">Subtotales</td>
                    <td className="p-2.5 text-right font-mono text-slate-900">{formatPYG(totalHaberes)}</td>
                    <td className="p-2.5 text-right font-mono text-rose-600">-{formatPYG(totalDescuentos)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Recuadro Neto a Cobrar y En Letras */}
            <div className="bg-indigo-50/80 border-2 border-indigo-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <span className="text-[10px] uppercase font-black tracking-wider text-indigo-700 block">
                  Importe Líquido a Percibir
                </span>
                <span className="text-xs font-bold text-slate-700 block mt-0.5">
                  Son: {numeroALetrasPYG(netoACobrar)}
                </span>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xl font-black font-mono text-indigo-950 bg-white px-4 py-1.5 rounded-lg border border-indigo-300 shadow-xs block">
                  {formatPYG(netoACobrar)}
                </span>
              </div>
            </div>

            {/* Cláusula Legal de Conformidad */}
            <p className="text-[10px] text-slate-500 text-justify leading-relaxed italic border-t border-slate-100 pt-3">
              Conforme al Código del Trabajo (Ley 213/93), dejo constancia de haber recibido a mi entera satisfacción de la firma empleadora <strong>GRUPO SANTA TERESA E.A.S.</strong> el importe neto consignado en la presente liquidación, correspondiente a los haberes del período indicado, habiéndose deducido las sumas autorizadas por ley y compromisos comerciales adquiridos.
            </p>

            {/* Firmas Canónicas */}
            <div className="grid grid-cols-2 gap-12 pt-8">
              <div className="text-center border-t border-slate-400 pt-2">
                <span className="text-[11px] font-black text-slate-800 uppercase block">Firma y Sello Empleador</span>
                <span className="text-[10px] text-slate-500 block">Grupo Santa Teresa E.A.S.</span>
              </div>
              <div className="text-center border-t border-slate-400 pt-2">
                <span className="text-[11px] font-black text-slate-800 uppercase block">Firma del Trabajador</span>
                <span className="text-[10px] text-slate-500 block">C.I. N°: {activeItem.ci || "—"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
