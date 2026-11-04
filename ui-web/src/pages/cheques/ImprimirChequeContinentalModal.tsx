import { useState, useEffect, useMemo } from "react"
import {
  Printer, X, Check, Settings2, Sliders, ShieldCheck, Eye, RefreshCw,
  AlertTriangle, FileText, Landmark, Calendar, HelpCircle, CheckCircle2,
  Sparkles, RotateCcw
} from "lucide-react"
import { useToast } from "../../context/ToastContext"
import { formatPYG, getTodayAsuncion } from "../../utils/format"
import CurrencyInput from "../../components/CurrencyInput"
import {
  generarEscpChequeContinental,
  generarEscpPruebaAlineacion,
  generarEscpReglaCalibracion,
  generarEscpTestRapido,
  numeroALetrasContinental,
  formatearLetrasSeguridad,
  type ChequeContinentalData
} from "../../utils/escpChequeContinental"
import { printRawViaQz, listarImpresoras, qzErrorLegible } from "../../utils/qzTray"

export interface ImprimirChequeContinentalModalProps {
  isOpen: boolean
  onClose: () => void
  chequeData?: {
    id?: string
    numero?: string
    monto?: number | string
    beneficiario?: string
    esDiferido?: boolean
    diferido?: boolean
    fechaEmision?: string
    fecha_emision?: string
    fechaPago?: string
    fecha_pago?: string
    cruzado?: boolean
    noALaOrden?: boolean
    concepto?: string
  } | null
  onChequeImpreso?: (chequeId?: string) => void
}

const STORAGE_KEYS = {
  PRINTER: "intelimarket_cheque_printer",
  OFFSET_X: "intelimarket_cheque_offset_x",
  OFFSET_Y: "intelimarket_cheque_offset_y",
  IMPRIMIR_TALON: "intelimarket_cheque_imprimir_talon",
  PLAZA: "intelimarket_cheque_plaza",
  COL_TALON: "intelimarket_cheque_col_talon",
  COL_CHEQUE: "intelimarket_cheque_col_cheque",
  COL_MONTO: "intelimarket_cheque_col_monto",
  COL_FECHAS_EMI: "intelimarket_cheque_col_fechas_emi",
  COL_FECHAS_PAGO: "intelimarket_cheque_col_fechas_pago",
}

export default function ImprimirChequeContinentalModal({
  isOpen,
  onClose,
  chequeData,
  onChequeImpreso
}: ImprimirChequeContinentalModalProps) {
  const toast = useToast()

  // ── ESTADO DEL FORMULARIO DE CHEQUE ──
  const [numero, setNumero] = useState("")
  const [monto, setMonto] = useState<number>(0)
  const [beneficiario, setBeneficiario] = useState("")
  const [esDiferido, setEsDiferido] = useState(true)
  const [fechaEmision, setFechaEmision] = useState(getTodayAsuncion())
  const [fechaPago, setFechaPago] = useState(getTodayAsuncion())
  const [cruzado, setCruzado] = useState(true)
  const [noALaOrden, setNoALaOrden] = useState(true)
  const [concepto, setConcepto] = useState("")
  const [plaza, setPlaza] = useState("Pedro Juan Caballero")
  const [imprimirTalon, setImprimirTalon] = useState(true)

  // ── CALIBRACIÓN Y DISPOSITIVOS ──
  const [printers, setPrinters] = useState<string[]>([])
  const [selectedPrinter, setSelectedPrinter] = useState("")
  const [loadingPrinters, setLoadingPrinters] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [offsetX, setOffsetX] = useState<number>(0)
  const [offsetY, setOffsetY] = useState<number>(0)
  // Columnas calibradas individuales (defecto 12 CPI para Banco Continental con Talón + Cheque)
  const [colTalon, setColTalon] = useState<number>(1)
  const [colCheque, setColCheque] = useState<number>(26)
  const [colMonto, setColMonto] = useState<number>(76)
  const [colFechasEmi, setColFechasEmi] = useState<number>(48)
  const [colFechasPago, setColFechasPago] = useState<number>(68)
  const [imprimiendo, setImprimiendo] = useState(false)

  // Cargar preferencias guardadas en localStorage
  useEffect(() => {
    const savedPrinter = localStorage.getItem(STORAGE_KEYS.PRINTER) || ""
    const savedOffX = parseInt(localStorage.getItem(STORAGE_KEYS.OFFSET_X) || "0", 10)
    const savedOffY = parseInt(localStorage.getItem(STORAGE_KEYS.OFFSET_Y) || "0", 10)
    const savedTalon = localStorage.getItem(STORAGE_KEYS.IMPRIMIR_TALON)
    const savedPlaza = localStorage.getItem(STORAGE_KEYS.PLAZA) || "Pedro Juan Caballero"
    const savedColTalon = parseInt(localStorage.getItem(STORAGE_KEYS.COL_TALON) || "1", 10)
    const savedColCheque = parseInt(localStorage.getItem(STORAGE_KEYS.COL_CHEQUE) || "26", 10)
    const savedColMonto = parseInt(localStorage.getItem(STORAGE_KEYS.COL_MONTO) || "76", 10)
    const savedColFEmi = parseInt(localStorage.getItem(STORAGE_KEYS.COL_FECHAS_EMI) || "48", 10)
    const savedColFPago = parseInt(localStorage.getItem(STORAGE_KEYS.COL_FECHAS_PAGO) || "68", 10)

    if (savedPrinter) setSelectedPrinter(savedPrinter)
    if (!isNaN(savedOffX)) setOffsetX(savedOffX)
    if (!isNaN(savedOffY)) setOffsetY(savedOffY)
    if (savedTalon !== null) setImprimirTalon(savedTalon === "true")
    if (savedPlaza) setPlaza(savedPlaza)
    if (!isNaN(savedColTalon)) setColTalon(savedColTalon)
    if (!isNaN(savedColCheque)) setColCheque(savedColCheque)
    if (!isNaN(savedColMonto)) setColMonto(savedColMonto)
    if (!isNaN(savedColFEmi)) setColFechasEmi(savedColFEmi)
    if (!isNaN(savedColFPago)) setColFechasPago(savedColFPago)
  }, [])

  // Precargar datos del cheque cuando se abre el modal
  useEffect(() => {
    if (!isOpen) return
    if (chequeData) {
      setNumero(chequeData.numero || "")
      setMonto(Number(chequeData.monto) || 0)
      setBeneficiario(chequeData.beneficiario || "")
      setEsDiferido(chequeData.esDiferido ?? chequeData.diferido ?? true)
      setFechaEmision(chequeData.fechaEmision || chequeData.fecha_emision || getTodayAsuncion())
      setFechaPago(chequeData.fechaPago || chequeData.fecha_pago || getTodayAsuncion())
      setCruzado(chequeData.cruzado ?? true)
      setNoALaOrden(chequeData.noALaOrden ?? true)
      setConcepto(chequeData.concepto || "")
    } else {
      setNumero("")
      setMonto(0)
      setBeneficiario("")
      setEsDiferido(true)
      setFechaEmision(getTodayAsuncion())
      setFechaPago(getTodayAsuncion())
      setCruzado(true)
      setNoALaOrden(true)
      setConcepto("")
    }
    cargarImpresoras()
  }, [isOpen, chequeData])

  // Cargar impresoras disponibles vía QZ Tray
  const cargarImpresoras = async () => {
    setLoadingPrinters(true)
    try {
      const list = await listarImpresoras()
      setPrinters(list)
      const savedPrinter = localStorage.getItem(STORAGE_KEYS.PRINTER)
      if (savedPrinter && list.includes(savedPrinter)) {
        setSelectedPrinter(savedPrinter)
      } else {
        // Autoseleccionar la que tenga "LX-300" o "EPSON" o "Generic"
        const candidate = list.find(p => /lx-?300|epson|generic/i.test(p)) || list[0] || ""
        setSelectedPrinter(candidate)
        if (candidate) localStorage.setItem(STORAGE_KEYS.PRINTER, candidate)
      }
    } catch (e: any) {
      console.warn("QZ Tray no disponible:", e)
    } finally {
      setLoadingPrinters(false)
    }
  }

  // Guardar configuración de offset y dispositivo
  const guardarConfiguracion = (
    newPrinter: string,
    newOffX: number,
    newOffY: number,
    newTalon: boolean,
    newPlaza: string,
    newColTalon = colTalon,
    newColCheque = colCheque,
    newColMonto = colMonto,
    newColFEmi = colFechasEmi,
    newColFPago = colFechasPago
  ) => {
    setSelectedPrinter(newPrinter)
    setOffsetX(newOffX)
    setOffsetY(newOffY)
    setImprimirTalon(newTalon)
    setPlaza(newPlaza)
    setColTalon(newColTalon)
    setColCheque(newColCheque)
    setColMonto(newColMonto)
    setColFechasEmi(newColFEmi)
    setColFechasPago(newColFPago)
    localStorage.setItem(STORAGE_KEYS.PRINTER, newPrinter)
    localStorage.setItem(STORAGE_KEYS.OFFSET_X, String(newOffX))
    localStorage.setItem(STORAGE_KEYS.OFFSET_Y, String(newOffY))
    localStorage.setItem(STORAGE_KEYS.IMPRIMIR_TALON, String(newTalon))
    localStorage.setItem(STORAGE_KEYS.PLAZA, newPlaza)
    localStorage.setItem(STORAGE_KEYS.COL_TALON, String(newColTalon))
    localStorage.setItem(STORAGE_KEYS.COL_CHEQUE, String(newColCheque))
    localStorage.setItem(STORAGE_KEYS.COL_MONTO, String(newColMonto))
    localStorage.setItem(STORAGE_KEYS.COL_FECHAS_EMI, String(newColFEmi))
    localStorage.setItem(STORAGE_KEYS.COL_FECHAS_PAGO, String(newColFPago))
  }

  // Desglose del monto en letras y seguridad
  const textoLetras = useMemo(() => {
    return numeroALetrasContinental(monto)
  }, [monto])

  const letrasConSeguridad = useMemo(() => {
    return formatearLetrasSeguridad(monto, 56)
  }, [monto])

  // Partición de fechas para la vista previa
  const partesFechaEmi = useMemo(() => {
    const p = (fechaEmision || getTodayAsuncion()).split("-")
    return { dd: p[2] || "01", mm: p[1] || "01", aa: (p[0] || "2026").slice(-2) }
  }, [fechaEmision])

  const partesFechaPago = useMemo(() => {
    const p = (fechaPago || getTodayAsuncion()).split("-")
    return { dd: p[2] || "01", mm: p[1] || "01", aa: (p[0] || "2026").slice(-2) }
  }, [fechaPago])

  // Ejecución de impresión oficial
  const handleImprimirOficial = async () => {
    if (!selectedPrinter) {
      toast.error("Seleccione una impresora", "Elija la Epson LX-300+ de la lista de impresoras.")
      return
    }
    if (monto <= 0) {
      toast.error("Monto inválido", "El monto del cheque debe ser mayor a cero.")
      return
    }
    if (!beneficiario.trim()) {
      toast.error("Falta beneficiario", "Ingrese la persona o razón social a favor de quien se libra el cheque.")
      return
    }

    setImprimiendo(true)
    try {
      const payload: ChequeContinentalData = {
        numero,
        monto,
        beneficiario,
        esDiferido,
        fechaEmision,
        fechaPago: esDiferido ? fechaPago : undefined,
        cruzado,
        noALaOrden,
        concepto,
        plaza,
        imprimirTalon,
        offsetX,
        offsetY,
        colTalon,
        colCheque,
        colMonto,
        colFechasEmi,
        colFechasPago,
      }

      const comandos = generarEscpChequeContinental(payload)
      await printRawViaQz(selectedPrinter, comandos)

      toast.success(
        "Cheque Enviado a la Epson LX-300+",
        `Cheque N° ${numero || "S/N"} por ${formatPYG(monto)} impreso correctamente (Talón + Cheque).`
      )
      if (onChequeImpreso) onChequeImpreso(chequeData?.id)
      onClose()
    } catch (e: any) {
      console.error("Error al imprimir cheque ESC/P:", e)
      toast.error("Error de impresión", qzErrorLegible(e))
    } finally {
      setImprimiendo(false)
    }
  }

  // Impresión de prueba en papel continuo borrador
  const handleImprimirPrueba = async () => {
    if (!selectedPrinter) {
      toast.error("Seleccione una impresora", "Elija la Epson LX-300+ de la lista.")
      return
    }
    setImprimiendo(true)
    try {
      const comandos = generarEscpPruebaAlineacion(offsetX, offsetY)
      await printRawViaQz(selectedPrinter, comandos)
      toast.success(
        "Prueba de Calibración Enviada",
        "Se imprimió una plantilla compacta en papel borrador. Superpóngala a trasluz con su cheque para verificar el calce."
      )
    } catch (e: any) {
      toast.error("Error de prueba", qzErrorLegible(e))
    } finally {
      setImprimiendo(false)
    }
  }

  // Impresión de regla física milimétrica (Grid L1..L9)
  const handleImprimirRegla = async () => {
    if (!selectedPrinter) {
      toast.error("Seleccione una impresora", "Elija la Epson LX-300+ de la lista.")
      return
    }
    setImprimiendo(true)
    try {
      const comandos = generarEscpReglaCalibracion()
      await printRawViaQz(selectedPrinter, comandos)
      toast.success(
        "Regla de Calibración Enviada a la LX-300+",
        "Se imprimió la regla L1..L9 con columnas numeradas. Colóquela sobre su cheque a trasluz para verificar exactamente en qué línea y columna cae cada casillero."
      )
    } catch (e: any) {
      toast.error("Error al imprimir regla", qzErrorLegible(e))
    } finally {
      setImprimiendo(false)
    }
  }

  // Test rápido de conexión física (bip + 1 renglón)
  const handleTestConexion = async () => {
    if (!selectedPrinter) {
      toast.error("Seleccione una impresora", "Elija la Epson LX-300+ de la lista de impresoras.")
      return
    }
    setImprimiendo(true)
    try {
      const comandos = generarEscpTestRapido()
      await printRawViaQz(selectedPrinter, comandos)
      toast.success(
        "Señal de Test Enviada a la Impresora",
        "Si la impresora está conectada y lista, emitirá un bip sonoro e imprimirá una línea de diagnóstico."
      )
    } catch (e: any) {
      toast.error("Error al enviar señal de prueba", qzErrorLegible(e))
    } finally {
      setImprimiendo(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="max-h-[92vh] flex flex-col overflow-hidden rounded-2xl shadow-2xl w-full max-w-5xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        
        {/* ── CABECERA FIJA (SHRINK-0) ── */}
        <div className="shrink-0 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-500/20">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900 dark:text-white">
                  Impresión de Cheque · Banco Continental
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Formulario Continuo 2.75&quot; ESC/P
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Epson LX-300+ (USB) · Cta. Cte. N° 38-00647793-08 · Grupo Santa Teresa E.A.S.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowConfig(!showConfig)}
              className={`p-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                showConfig
                  ? "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800"
                  : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
              }`}
              title="Calibración y configuración de márgenes"
            >
              <Sliders className="w-4 h-4" />
              <span className="hidden sm:inline">Calibración</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── CUERPO CENTRAL CON SCROLL (FLEX-1 OVERFLOW-Y-AUTO) ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">

          {/* PANEL DE CALIBRACIÓN COLAPSABLE */}
          {showConfig && (
            <div className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 space-y-4 animate-fade-in shadow-inner">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-purple-400" />
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-100">
                      Calibrador de Márgenes y Dispositivo (Epson LX-300+)
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Imprime la regla milimétrica o prueba en borrador para ajustar el calce exacto de las casillas.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => guardarConfiguracion(selectedPrinter, 0, 0, true, "Pedro Juan Caballero", 1, 26, 76, 48, 68)}
                  className="text-[11px] text-purple-300 hover:text-purple-200 flex items-center gap-1 font-bold underline"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Restablecer Valores Canónicos
                </button>
              </div>

              {/* BOTONERA PRINCIPAL DE CALIBRACIÓN DIRECTA */}
              <div className="p-3.5 bg-purple-950/60 border border-purple-500/40 rounded-xl space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-black text-purple-200 uppercase tracking-wide flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-purple-400" />
                    Acciones Inmediatas en Impresora:
                  </span>
                  <span className="text-[11px] text-purple-300/80 font-mono">
                    Carro: 12 CPI Elite · 96 Columnas · 6 LPI
                  </span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={handleImprimirRegla}
                    disabled={imprimiendo || !selectedPrinter}
                    className="px-3.5 py-2.5 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-950/50 disabled:opacity-50 transition flex items-center justify-center gap-2 border border-purple-400/40"
                    title="Imprime la regla milimétrica de 96 columnas numeradas L1..L9"
                  >
                    <Sliders className="w-4 h-4" />
                    <span>📐 Imprimir Regla L1..L9 (Grid)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleImprimirPrueba}
                    disabled={imprimiendo || !selectedPrinter}
                    className="px-3.5 py-2.5 rounded-xl text-xs font-black bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 disabled:opacity-50 transition flex items-center justify-center gap-2"
                    title="Imprime un cheque con marcas completas (talón + cheque) en papel borrador"
                  >
                    <FileText className="w-4 h-4" />
                    <span>📄 Imprimir Cheque de Prueba</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleTestConexion}
                    disabled={imprimiendo || !selectedPrinter}
                    className="px-3.5 py-2.5 rounded-xl text-xs font-black bg-emerald-700 hover:bg-emerald-600 text-white disabled:opacity-50 transition flex items-center justify-center gap-2"
                    title="Emite un bip sonoro en el parlante de la Epson y 1 renglón de prueba"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>🔔 Test Conexión (Bip + Línea)</span>
                  </button>
                </div>

                <p className="text-[10px] text-purple-200/70 pt-1 leading-relaxed">
                  💡 <strong>¿Cómo calibrar?</strong> Presiona <em>&quot;Imprimir Regla L1..L9&quot;</em> sobre papel continuo borrador. Superpón tu cheque Continental a trasluz y observa en qué línea (L1..L8) y columna (0..90) cae cada recuadro para ajustar los casilleros de abajo.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                {/* Impresora */}
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">
                    Impresora Seleccionada en Windows (QZ Tray)
                  </label>
                  <div className="flex gap-2">
                    <select
                      className="input text-xs w-full font-mono bg-slate-800 border-slate-700 text-white"
                      value={selectedPrinter}
                      onChange={e => guardarConfiguracion(e.target.value, offsetX, offsetY, imprimirTalon, plaza, colTalon, colCheque, colMonto, colFechasEmi, colFechasPago)}
                    >
                      {printers.length === 0 && <option value="">— Sin impresoras detectadas (abrir QZ Tray) —</option>}
                      {printers.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={cargarImpresoras}
                      disabled={loadingPrinters}
                      className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white"
                      title="Refrescar lista de impresoras"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingPrinters ? "animate-spin" : ""}`} />
                    </button>
                  </div>
                </div>

                {/* Offset Horizontal X */}
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">
                    Offset X (Columnas / Espacios)
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => guardarConfiguracion(selectedPrinter, offsetX - 1, offsetY, imprimirTalon, plaza, colTalon, colCheque, colMonto, colFechasEmi, colFechasPago)}
                      className="w-8 h-8 rounded bg-slate-800 hover:bg-slate-700 text-white font-black"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      className="input text-xs text-center font-bold font-mono bg-slate-800 border-slate-700 text-white w-16"
                      value={offsetX}
                      onChange={e => guardarConfiguracion(selectedPrinter, parseInt(e.target.value) || 0, offsetY, imprimirTalon, plaza, colTalon, colCheque, colMonto, colFechasEmi, colFechasPago)}
                    />
                    <button
                      type="button"
                      onClick={() => guardarConfiguracion(selectedPrinter, offsetX + 1, offsetY, imprimirTalon, plaza, colTalon, colCheque, colMonto, colFechasEmi, colFechasPago)}
                      className="w-8 h-8 rounded bg-slate-800 hover:bg-slate-700 text-white font-black"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Offset Vertical Y */}
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">
                    Offset Y (Líneas a 6 LPI)
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => guardarConfiguracion(selectedPrinter, offsetX, offsetY - 1, imprimirTalon, plaza, colTalon, colCheque, colMonto, colFechasEmi, colFechasPago)}
                      className="w-8 h-8 rounded bg-slate-800 hover:bg-slate-700 text-white font-black"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      className="input text-xs text-center font-bold font-mono bg-slate-800 border-slate-700 text-white w-16"
                      value={offsetY}
                      onChange={e => guardarConfiguracion(selectedPrinter, offsetX, parseInt(e.target.value) || 0, imprimirTalon, plaza, colTalon, colCheque, colMonto, colFechasEmi, colFechasPago)}
                    />
                    <button
                      type="button"
                      onClick={() => guardarConfiguracion(selectedPrinter, offsetX, offsetY + 1, imprimirTalon, plaza, colTalon, colCheque, colMonto, colFechasEmi, colFechasPago)}
                      className="w-8 h-8 rounded bg-slate-800 hover:bg-slate-700 text-white font-black"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* CALIBRACIÓN INDIVIDUAL DE COLUMNAS (POR CAMPO) */}
              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-200">
                    Posiciones de Columnas a 12 CPI (96 columnas máx. para Talón + Cheque):
                  </span>
                  <button
                    type="button"
                    onClick={() => guardarConfiguracion(selectedPrinter, 0, 0, true, "Pedro Juan Caballero", 1, 26, 76, 48, 68)}
                    className="text-[10px] text-purple-400 hover:text-purple-300 underline font-semibold"
                  >
                    Valores Canónicos Continental (12 CPI)
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Col. Talón (Inicio)</label>
                    <input
                      type="number"
                      value={colTalon}
                      onChange={e => guardarConfiguracion(selectedPrinter, offsetX, offsetY, imprimirTalon, plaza, parseInt(e.target.value) || 0, colCheque, colMonto, colFechasEmi, colFechasPago)}
                      className="input text-xs font-mono font-bold w-full bg-slate-900 border-slate-700 text-white py-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Col. Cheque (Inicio)</label>
                    <input
                      type="number"
                      value={colCheque}
                      onChange={e => guardarConfiguracion(selectedPrinter, offsetX, offsetY, imprimirTalon, plaza, colTalon, parseInt(e.target.value) || 0, colMonto, colFechasEmi, colFechasPago)}
                      className="input text-xs font-mono font-bold w-full bg-slate-900 border-slate-700 text-white py-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Col. Fec. Emisión</label>
                    <input
                      type="number"
                      value={colFechasEmi}
                      onChange={e => guardarConfiguracion(selectedPrinter, offsetX, offsetY, imprimirTalon, plaza, colTalon, colCheque, colMonto, parseInt(e.target.value) || 0, colFechasPago)}
                      className="input text-xs font-mono font-bold w-full bg-slate-900 border-slate-700 text-white py-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Col. Fec. Pago</label>
                    <input
                      type="number"
                      value={colFechasPago}
                      onChange={e => guardarConfiguracion(selectedPrinter, offsetX, offsetY, imprimirTalon, plaza, colTalon, colCheque, colMonto, colFechasEmi, parseInt(e.target.value) || 0)}
                      className="input text-xs font-mono font-bold w-full bg-slate-900 border-slate-700 text-white py-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Col. Monto (₲)</label>
                    <input
                      type="number"
                      value={colMonto}
                      onChange={e => guardarConfiguracion(selectedPrinter, offsetX, offsetY, imprimirTalon, plaza, colTalon, colCheque, parseInt(e.target.value) || 0, colFechasEmi, colFechasPago)}
                      className="input text-xs font-mono font-bold w-full bg-slate-900 border-slate-700 text-white py-1"
                    />
                  </div>
                </div>
              </div>

              {/* DIAGNÓSTICO RÁPIDO: SI FINGE QUE IMPRIME PERO NO SE MUEVE LA EPSON */}
              <div className="p-3 bg-slate-800/90 border border-slate-700 rounded-xl text-xs space-y-2 text-slate-300">
                <div className="flex items-center gap-1.5 font-bold text-amber-300">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>¿El sistema dice &quot;Enviado&quot; pero la Epson LX-300+ no se mueve ni imprime?</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px] text-slate-300">
                  <div className="p-2 bg-slate-900/80 rounded-lg border border-slate-800">
                    <p className="font-bold text-amber-300 mb-1">1. Botón PAUSE en la Epson</p>
                    <p className="text-slate-400 leading-normal">
                      Si la luz ámbar <strong>PAUSE</strong> en la impresora está encendida, el trabajo queda guardado en la memoria de la impresora y no avanza. <strong>Presiona el botón PAUSE</strong> una vez en el panel de la Epson.
                    </p>
                  </div>
                  <div className="p-2 bg-slate-900/80 rounded-lg border border-slate-800">
                    <p className="font-bold text-amber-300 mb-1">2. Cola Trabada en Windows</p>
                    <p className="text-slate-400 leading-normal">
                      Si hubo un error anterior, Windows retiene la cola en pausa. En Windows: <em>Impresoras ➔ Epson LX-300+ ➔ Abrir cola de impresión ➔ Impresora ➔ <strong>Cancelar todos los documentos</strong></em>.
                    </p>
                  </div>
                  <div className="p-2 bg-slate-900/80 rounded-lg border border-slate-800">
                    <p className="font-bold text-amber-300 mb-1">3. Palanca de Papel Continuo</p>
                    <p className="text-slate-400 leading-normal">
                      Verifica que la palanca de selección de papel (a la derecha) esté apuntando hacia <strong>Tractor continuo</strong> (hacia atrás) y no en fricción de hojas sueltas, para que no prenda <strong>PAPER OUT</strong>.
                    </p>
                  </div>
                </div>
              </div>

              {/* AYUDA QZ TRAY PERMISOS PERMANENTES */}
              <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-xl text-xs space-y-1 text-amber-200">
                <div className="flex items-center gap-1.5 font-bold text-amber-300">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>¿QZ Tray te pide confirmación en cada cheque o sale con candado amarillo?</span>
                </div>
                <p className="text-[11px] text-amber-300/80 leading-relaxed">
                  Para que Windows no vuelva a interrumpir con el cartel de permiso:
                  <br />
                  1. Clic derecho en el ícono verde de <strong>QZ Tray</strong> (junto al reloj de Windows) ➔ <strong>Advanced</strong> ➔ <strong>Site Manager</strong>.
                  <br />
                  2. En la pestaña <strong>Allowed</strong>, haz clic en el botón <strong>+</strong> y escribe la dirección de este ERP: <code>192.168.0.10:5173</code> (o <code>192.168.0.10</code>).
                  <br />
                  3. ¡Listo! QZ Tray recordará la autorización de forma permanente sin volver a preguntar.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-800/80 text-xs text-slate-400">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={imprimirTalon}
                      onChange={e => guardarConfiguracion(selectedPrinter, offsetX, offsetY, e.target.checked, plaza, colTalon, colCheque, colMonto, colFechasEmi, colFechasPago)}
                      className="rounded border-slate-700 text-purple-600 focus:ring-purple-500 bg-slate-800"
                    />
                    <span>Imprimir también el <strong>Talón de Control Izquierdo</strong> (stub)</span>
                  </label>
                  <span className="text-[10px] text-emerald-400 font-medium">
                    (12 CPI Elite activado: 96 columnas físicas, sin desborde de carro)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span>Plaza de emisión:</span>
                  <input
                    type="text"
                    value={plaza}
                    onChange={e => guardarConfiguracion(selectedPrinter, offsetX, offsetY, imprimirTalon, e.target.value, colTalon, colCheque, colMonto, colFechasEmi, colFechasPago)}
                    className="input text-xs font-medium py-1 px-2 w-48 bg-slate-800 border-slate-700 text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* BARRA SUPERIOR: IMPRESORA ACTIVA Y TEST RÁPIDO */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 flex-1 min-w-[280px]">
              <Printer className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-xs font-black text-slate-700 dark:text-slate-300 whitespace-nowrap">
                Impresora en Windows:
              </span>
              <select
                className="input text-xs font-mono font-bold py-1 px-2.5 flex-1 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                value={selectedPrinter}
                onChange={e => guardarConfiguracion(e.target.value, offsetX, offsetY, imprimirTalon, plaza, colTalon, colCheque, colMonto, colFechasEmi, colFechasPago)}
              >
                {printers.length === 0 && <option value="">— Sin impresoras detectadas (abrir QZ Tray) —</option>}
                {printers.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={cargarImpresoras}
                disabled={loadingPrinters}
                className="p-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:text-emerald-600"
                title="Refrescar impresoras de Windows"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingPrinters ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestConexion}
                disabled={imprimiendo || !selectedPrinter}
                className="px-3 py-1.5 text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-sm disabled:opacity-50 transition flex items-center gap-1.5"
                title="Emite un bip sonoro en la Epson LX-300+ e imprime 1 renglón para verificar respuesta instantánea"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Probar Conexión (Bip)</span>
              </button>
            </div>
          </div>

          {/* ALERTA SI LA IMPRESORA SELECCIONADA NO ES LA EPSON */}
          {selectedPrinter && !/lx-?300|epson|generic|matriz|matrix/i.test(selectedPrinter) && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5 animate-fade-in">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">
                  Atención: La impresora seleccionada es &quot;{selectedPrinter}&quot;
                </p>
                <p className="text-[11px] text-amber-800 dark:text-amber-300/90 leading-normal">
                  Si estás en la PC de Administración con la <strong>Epson LX-300+</strong> conectada por USB, asegúrate de seleccionarla en el desplegable superior. De lo contrario, los comandos ESC/P se enviarán a un archivo PDF o a otra impresora física.
                </p>
              </div>
            </div>
          )}

          {/* SELECTOR DE TIPO (A LA VISTA / DIFERIDO) */}
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Tipo de Cheque:</span>
              <div className="flex rounded-lg p-0.5 bg-slate-200 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setEsDiferido(true)}
                  className={`px-3 py-1 text-xs font-black rounded-md transition ${
                    esDiferido
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  }`}
                >
                  Cheque Diferido (Talonario Continental)
                </button>
                <button
                  type="button"
                  onClick={() => setEsDiferido(false)}
                  className={`px-3 py-1 text-xs font-black rounded-md transition ${
                    !esDiferido
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  }`}
                >
                  Cheque a la Vista
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-bold">
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={noALaOrden}
                  onChange={e => setNoALaOrden(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span>Cláusula &quot;NO A LA ORDEN&quot;</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={cruzado}
                  onChange={e => setCruzado(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span>Cheque Cruzado (//)</span>
              </label>
            </div>
          </div>

          {/* CAMPOS PRINCIPALES DE ENTRADA */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4">
            {/* Número de Cheque */}
            <div className="sm:col-span-3">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1">
                Serie - N° de Cheque
              </label>
              <div className="flex items-center">
                <span className="px-2.5 py-2 bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono text-xs font-bold border border-r-0 border-slate-300 dark:border-slate-700 rounded-l-xl">
                  CT
                </span>
                <input
                  type="text"
                  value={numero}
                  onChange={e => setNumero(e.target.value)}
                  placeholder="935451"
                  className="input text-xs font-mono font-bold w-full rounded-l-none"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Correlativo del talonario</p>
            </div>

            {/* Importe Numérico en Guaraníes (Regla 10: CurrencyInput obligatorio) */}
            <div className="sm:col-span-4">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1">
                Monto en Guaraníes (PYG) *
              </label>
              <CurrencyInput
                value={monto}
                onChangeValue={(val) => setMonto(val ? Number(val) : 0)}
                className="input font-mono font-black text-sm text-emerald-600 dark:text-emerald-400"
                currency="PYG"
                placeholder="0"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">Enteros con separador de miles</p>
            </div>

            {/* Fecha Emisión */}
            <div className="sm:col-span-2">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1">
                Fecha Emisión
              </label>
              <input
                type="date"
                value={fechaEmision}
                onChange={e => setFechaEmision(e.target.value)}
                className="input text-xs font-medium w-full"
              />
            </div>

            {/* Fecha de Pago (solo si es diferido) */}
            <div className="sm:col-span-3">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1">
                {esDiferido ? "Fecha de Pago (Vencimiento) *" : "Vigencia"}
              </label>
              {esDiferido ? (
                <input
                  type="date"
                  value={fechaPago}
                  onChange={e => setFechaPago(e.target.value)}
                  className="input text-xs font-medium w-full border-amber-400 dark:border-amber-600 bg-amber-50/40 dark:bg-amber-950/20"
                />
              ) : (
                <div className="px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs text-slate-500 font-medium">
                  Al cobro inmediato (30 días)
                </div>
              )}
            </div>

            {/* Beneficiario ("Páguese a la orden de") */}
            <div className="sm:col-span-8">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1">
                Páguese a la orden de (Beneficiario / Razón Social) *
              </label>
              <input
                type="text"
                value={beneficiario}
                onChange={e => setBeneficiario(e.target.value.toUpperCase())}
                placeholder="EJ: FRIGORÍFICO CONCEPCIÓN S.A."
                className="input text-xs font-bold w-full uppercase"
              />
            </div>

            {/* Concepto para el talón */}
            <div className="sm:col-span-4">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1">
                Concepto / Ref. (Talón)
              </label>
              <input
                type="text"
                value={concepto}
                onChange={e => setConcepto(e.target.value)}
                placeholder="EJ: OP #1042 - FAC 1520"
                className="input text-xs w-full"
              />
            </div>
          </div>

          {/* NOTA NORMATIVA DE CONVERSIÓN A LETRAS */}
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800/50 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Conversión en Letras (Sin redundancia &quot;GUARANÍES&quot; conforme al formulario preimpreso):
              </span>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono">
                {textoLetras.length} caracteres
              </span>
            </div>
            <p className="font-mono font-black text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 p-2 rounded-lg border border-emerald-300/50 dark:border-emerald-700/50 text-[11px] select-all">
              {letrasConSeguridad.linea1}
              {letrasConSeguridad.linea2 && <br />}
              {letrasConSeguridad.linea2}
            </p>
          </div>

          {/* ── SIMULADOR GRÁFICO IDÉNTICO AL CHEQUE CONTINENTAL ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                <Eye className="w-3.5 h-3.5 text-emerald-500" />
                <span>Vista Previa del Formulario Continuo Banco Continental</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                Escala visual 1:1 aproximada (2.75&quot; de altura)
              </span>
            </div>

            {/* CONTENEDOR VERDE DEL CHEQUE (SIMULANDO EL PAPEL FÍSICO) */}
            <div className="w-full bg-[#e8f5ed] text-[#133824] rounded-xl border-2 border-[#a3d4b6] shadow-md p-3 sm:p-4 font-mono text-[11px] relative overflow-hidden select-none">
              
              <div className="flex gap-3">
                {/* ── TALÓN IZQUIERDO DE CONTROL (STUB) ── */}
                <div className={`w-44 pr-3 border-r-2 border-dashed border-[#82ba97] space-y-1 text-[10px] ${!imprimirTalon ? "opacity-30" : ""}`}>
                  <p className="font-bold text-[9px] text-slate-600">Cta: 380064779308</p>
                  <p className="font-bold text-[9px] text-slate-600">Ser:CT Nro:{numero || "935451"}</p>
                  <div className="border-t border-[#82ba97]/50 pt-1 space-y-0.5">
                    <p className="text-[9px] text-slate-500">VENCIMIENTO:</p>
                    <p className="font-bold text-slate-800">{esDiferido ? partesFechaPago.dd + "/" + partesFechaPago.mm + "/20" + partesFechaPago.aa : "AL DÍA"}</p>
                    <p className="text-[9px] text-slate-500">FECHA:</p>
                    <p className="font-bold text-slate-800">{partesFechaEmi.dd}/{partesFechaEmi.mm}/20{partesFechaEmi.aa}</p>
                    <p className="text-[9px] text-slate-500">ORDEN:</p>
                    <p className="font-bold truncate text-slate-800" title={beneficiario}>{beneficiario || "—"}</p>
                    <p className="text-[9px] text-slate-500">CONCEPTO:</p>
                    <p className="font-bold truncate text-slate-800">{concepto || "—"}</p>
                    <div className="border-t border-[#82ba97]/50 pt-0.5">
                      <p className="text-[9px] text-slate-500">ESTE CHEQUE:</p>
                      <p className="font-bold text-emerald-800">*{Math.round(monto).toLocaleString("es-PY")}*</p>
                    </div>
                  </div>
                </div>

                {/* ── CUERPO PRINCIPAL DEL CHEQUE CONTINENTAL ── */}
                <div className="flex-1 space-y-2 relative pl-1">
                  
                  {/* Cruce // */}
                  {cruzado && (
                    <div className="absolute top-0 left-0 font-serif font-black text-base text-slate-700 tracking-tighter">
                      //
                    </div>
                  )}

                  {/* Fila Superior: Banco + Cta/Nro + Recuadro Monto */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="pl-4">
                      <div className="flex items-center gap-1.5 font-sans font-black text-base tracking-tighter text-[#1b5e39]">
                        <span>continental</span>
                        <div className="w-3.5 h-3.5 bg-[#1b5e39] rounded-sm flex items-center justify-center text-white text-[9px]">▲</div>
                      </div>
                      <p className="text-[9px] font-sans font-semibold text-slate-600">
                        BCNA D1038 01PYG · Sucursal Pedro Juan Caballero
                      </p>
                    </div>

                    {/* Casilla Cuenta, Número y Monto Gs. */}
                    <div className="flex items-center gap-2">
                      <div className="border border-[#7bb290] bg-[#f4faf6] rounded px-2 py-0.5 text-[9px] text-right font-sans">
                        <span className="text-[8px] text-slate-500 block">Cuenta: 38-00647793-08</span>
                        <span className="font-bold font-mono">Serie CT Cheque N° {numero || "935451"}</span>
                      </div>
                      
                      {/* Recuadro de Monto Numérico Gs. */}
                      <div className="border-2 border-[#1b5e39] bg-white rounded-lg px-2.5 py-1 text-right flex items-center gap-1 shadow-sm">
                        <span className="font-black text-sm text-[#1b5e39]">₲</span>
                        <span className="font-black font-mono text-sm tracking-tight text-slate-900">
                          {monto > 0 ? `*${Math.round(monto).toLocaleString("es-PY")}*` : "*0*"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Título y Fechas */}
                  <div className="flex items-center justify-between border-b border-[#a3d4b6]/70 pb-1">
                    <span className="font-black text-xs font-sans tracking-wider text-[#1b5e39]">
                      {esDiferido ? "CHEQUE DIFERIDO" : "CHEQUE DE PAGO A LA VISTA"}
                    </span>

                    {/* Casillas de fecha */}
                    <div className="flex items-center gap-3 text-[9px]">
                      <div className="flex items-center gap-1">
                        <span className="text-[8px] uppercase font-bold text-slate-600">Emisión:</span>
                        <span className="bg-white px-1.5 py-0.5 rounded border border-[#7bb290] font-bold">
                          {partesFechaEmi.dd} - {partesFechaEmi.mm} - 20{partesFechaEmi.aa}
                        </span>
                      </div>
                      {esDiferido && (
                        <div className="flex items-center gap-1">
                          <span className="text-[8px] uppercase font-bold text-emerald-800">Fecha de Pago:</span>
                          <span className="bg-white px-1.5 py-0.5 rounded border-2 border-emerald-600 font-black text-emerald-900">
                            {partesFechaPago.dd} - {partesFechaPago.mm} - 20{partesFechaPago.aa}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Renglón: "Páguese a la orden de" */}
                  <div className="space-y-0.5">
                    <div className="flex items-baseline gap-1 text-[10px]">
                      <span className="font-sans text-slate-600 whitespace-nowrap">Páguese a la orden de:</span>
                      <div className="flex-1 border-b border-slate-700/60 pb-0.5 font-black text-slate-900 truncate pl-1">
                        {beneficiario ? (
                          <>
                            {beneficiario}
                            {noALaOrden && <span className="ml-2 font-bold text-purple-800">*** NO A LA ORDEN ***</span>}
                          </>
                        ) : (
                          <span className="text-slate-400 italic font-normal">Nombre o razón social del proveedor</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Renglón: "La suma de Guaraníes" */}
                  <div className="space-y-0.5">
                    <div className="flex items-baseline gap-1 text-[10px]">
                      <span className="font-sans text-slate-600 whitespace-nowrap">La suma de Guaraníes:</span>
                      <div className="flex-1 border-b border-slate-700/60 pb-0.5 font-black text-slate-900 truncate pl-1">
                        {monto > 0 ? (
                          letrasConSeguridad.linea1
                        ) : (
                          <span className="text-slate-400 italic font-normal">Importe en letras autogenerado</span>
                        )}
                      </div>
                    </div>
                    {letrasConSeguridad.linea2 && (
                      <div className="border-b border-slate-700/60 pb-0.5 font-black text-slate-900 pl-2">
                        {letrasConSeguridad.linea2}
                      </div>
                    )}
                  </div>

                  {/* Pie del Cheque: Datos Titular + Firmas */}
                  <div className="pt-2 flex items-end justify-between text-[9px]">
                    <div className="space-y-0.5">
                      <p className="font-black text-[9px] text-[#1b5e39]">GRUPO SANTA TERESA E.A.S.</p>
                      <p className="text-[8px] text-slate-600">Carlos Antonio Lopez 2301 · RUC: 80150377-9</p>
                      <p className="text-[8px] font-bold text-slate-700">
                        Plaza: {plaza}, {partesFechaEmi.dd}/{partesFechaEmi.mm}/20{partesFechaEmi.aa}
                      </p>
                    </div>

                    <div className="text-center w-40">
                      <div className="border-b border-slate-500 w-full mb-0.5"></div>
                      <p className="text-[8px] text-slate-500 uppercase tracking-tighter">
                        Firma Autorizada
                      </p>
                      <p className="text-[7px] text-slate-400">No firmar debajo de esta línea</p>
                    </div>
                  </div>

                  {/* Banda magnética CMC-7 / MICR */}
                  <div className="pt-1 text-center font-mono text-[9px] tracking-widest text-slate-500/80">
                    ⑈2002⑈380064779308⑈{numero || "935451"}⑈1⑈
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* ── PIE DE ACCIONES FIJO (SHRINK-0) ── */}
        <div className="shrink-0 px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={imprimiendo}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleImprimirRegla}
              disabled={imprimiendo || !selectedPrinter}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/60 transition flex items-center gap-1.5"
              title="Imprime la regla milimétrica de coordenadas L1..L9 en papel continuo para superponer al cheque Continental"
            >
              <Sliders className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>Imprimir Regla L1..L9 (Grid)</span>
            </button>
            <button
              type="button"
              onClick={handleImprimirPrueba}
              disabled={imprimiendo || !selectedPrinter}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition flex items-center gap-1.5"
              title="Imprime un cheque con marcas en papel borrador para verificar alineación"
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Imprimir Prueba en Borrador</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-500 hidden sm:inline">
              Impresora: <strong className="text-slate-700 dark:text-slate-300 font-mono">{selectedPrinter || "No elegida"}</strong>
            </span>
            <button
              type="button"
              onClick={handleImprimirOficial}
              disabled={imprimiendo || monto <= 0 || !beneficiario.trim()}
              className="px-5 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
            >
              {imprimiendo ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Enviando a Epson LX-300+...</span>
                </>
              ) : (
                <>
                  <Printer className="w-4 h-4" />
                  <span>Imprimir Cheque Continental</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
