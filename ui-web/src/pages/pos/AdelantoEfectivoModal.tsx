/**
 * Adelanto de efectivo contra tarjeta ("Cobrá tu salario", POS Dinelco).
 *
 * El cliente pide plata en caja y el terminal se la cobra de su tarjeta (POST /pos/adelanto del manual
 * Feitian Bepsa). No es una venta: sin factura, sin stock. Es una SALIDA de efectivo de la gaveta
 * respaldada por un voucher que la procesadora le acredita al comercio (más la comisión activa, si hay).
 *
 * Si el cliente además compra algo, se cobra la compra por el POS de siempre y este adelanto es una
 * operación aparte: dos pasadas de tarjeta, dos vouchers (el manual no tiene "compra + efectivo" en un
 * solo cobro). El simulador de arriba solo ayuda a decirle al cliente cuánto va a salir de su tarjeta.
 *
 * Tope por adelanto y supervisor se validan también en el servidor; acá es para avisar antes.
 */
import { useEffect, useState } from "react"
import { Banknote, Loader2, ShieldCheck, X, AlertTriangle, CheckCircle2 } from "lucide-react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"
import { verifySupervisorPinLocal } from "../../utils/localAuth"
import { imDinelco } from "../../monitor/integrations"
import { captureMessage } from "../../monitor"
import { dinelcoApi, dinelcoDisponible } from "../../utils/dinelcoTerminal"
import { terminalLock } from "./terminalLock"

export const ADELANTO_MAX_GS = 1_500_000
export const ADELANTO_SUPERVISOR_DESDE_GS = 500_000
// El terminal espera la tarjeta y la autorización un buen rato antes de contestar.
const ADELANTO_TIMEOUT_MS = 130_000

// Cargo que el terminal le cobra al cliente: max(mínimo, porcentaje del adelanto). Medido el 19-oct-2026 en un POS
// Dinelco (1.000 y 50.000 -> 1.000 · 150.000 -> 1.500 · 155.000 -> 1.550 · 1.500.000 -> 15.000). Estos valores son
// los de respaldo; los reales se leen de Caja > comisiones de procesadoras (canal ADELANTO_DINELCO).
const CARGO_DEFECTO = { porcentaje: 1, minimo: 1000 }
export const calcularCargoCliente = (monto: number, regla: { porcentaje: number; minimo: number }) =>
  monto > 0 ? Math.max(regla.minimo, Math.round((monto * regla.porcentaje) / 100)) : 0

interface Supervisor { id: string; email: string; nombre?: string }

interface Props {
  open: boolean
  onClose: () => void
  cashSessionId: string | null
  terminalIp?: string
  puntoEmision: string
  cajeroId?: string
  supervisores: Supervisor[]
}

type Estado = "form" | "esperando" | "aprobado" | "error"

interface Voucher {
  codigo_autorizacion: string
  nro_referencia?: string
  issuer_id?: string
  nombre_tarjeta?: string
  pan_ultimos4?: string
  terminal?: string
  raw?: Record<string, unknown>
}

const soloDigitos = (v: string) => parseInt(v.replace(/\D/g, "") || "0", 10)

export default function AdelantoEfectivoModal({ open, onClose, cashSessionId, terminalIp, puntoEmision, cajeroId, supervisores }: Props) {
  const toast = useToast()
  const [monto, setMonto] = useState("")
  const [compra, setCompra] = useState("")
  const [opcion, setOpcion] = useState<1 | 2>(2)
  const [supEmail, setSupEmail] = useState("")
  const [supPin, setSupPin] = useState("")
  const [estado, setEstado] = useState<Estado>("form")
  const [error, setError] = useState("")
  const [voucherPendiente, setVoucherPendiente] = useState<Voucher | null>(null) // aprobado por el terminal, falta guardarlo
  const [guardando, setGuardando] = useState(false)
  const [manual, setManual] = useState(false)
  const [manualAut, setManualAut] = useState("")
  const [resultado, setResultado] = useState<{ monto: number; autorizacion: string; comision: number; cargo: number; supervisor?: string } | null>(null)
  const [supUsado, setSupUsado] = useState<{ id: string; nombre: string } | null>(null)
  const [regla, setRegla] = useState(CARGO_DEFECTO)
  const [reglaLeida, setReglaLeida] = useState(false)
  const [manualCargo, setManualCargo] = useState("")

  const montoNum = soloDigitos(monto)
  const compraNum = soloDigitos(compra)
  const pideSupervisor = montoNum >= ADELANTO_SUPERVISOR_DESDE_GS
  // La comisión al cliente es solo del Adelanto Dinelco (opción 2); Red de Pagos (opción 1) pide la tarjeta directo.
  const cargoCliente = opcion === 2 ? calcularCargoCliente(montoNum, regla) : 0
  const totalTarjeta = montoNum + cargoCliente

  useEffect(() => {
    if (!open) return
    let vivo = true
    api.caja.bankMappings.list().then((lista) => {
      const c = (lista || []).find((m) => m.canal_key === "ADELANTO_DINELCO")
      if (vivo && c) { setRegla({ porcentaje: Number(c.cargo_cliente_porcentaje ?? 0), minimo: Number(c.cargo_cliente_minimo_gs ?? 0) }); setReglaLeida(true) }
    }).catch(() => { /* sin conexión: queda la regla medida como estimación */ })
    return () => { vivo = false }
  }, [open])

  useEffect(() => {
    if (!open) return
    setMonto(""); setCompra(""); setOpcion(2); setSupEmail(""); setSupPin(""); setEstado("form"); setError("")
    setVoucherPendiente(null); setManual(false); setManualAut(""); setManualCargo(""); setResultado(null); setSupUsado(null)
  }, [open])

  if (!open) return null

  const validarMonto = (): string | null => {
    if (!cashSessionId) return "No hay una sesión de caja abierta."
    if (montoNum <= 0) return "Ingresá cuánto efectivo se le entrega al cliente."
    if (montoNum > ADELANTO_MAX_GS) return `El adelanto máximo por operación es de Gs. ${formatPYG(ADELANTO_MAX_GS)}.`
    return null
  }

  /** Verifica al supervisor (PIN local si está cacheado, si no contra el servidor). Nunca el propio cajero. */
  const verificarSupervisor = async (): Promise<{ id: string; nombre: string } | null> => {
    if (!supEmail || !supPin) { setError("Elegí al supervisor e ingresá su PIN para autorizar un adelanto desde Gs. 500.000."); return null }
    const elegido = supervisores.find((s) => s.email === supEmail)
    let res: { valid: boolean; id?: string; nombre?: string } | null = null
    if (elegido) {
      const local = await verifySupervisorPinLocal(supPin, elegido.id)
      if (local.valid) res = { valid: true, id: local.id, nombre: local.nombre }
    }
    if (!res) {
      try { res = await api.auth.verifySupervisor({ email: supEmail, password: supPin }) }
      catch { setError("Sin conexión y sin PIN local válido: no se pudo verificar al supervisor."); return null }
    }
    if (!res?.valid || !res.id) { setError("Autorización rechazada: contraseña incorrecta o la cuenta no es de supervisor."); return null }
    if (cajeroId && res.id === cajeroId) { setError("El cajero no puede autorizar su propio adelanto: tiene que ser otro supervisor."); return null }
    return { id: res.id, nombre: res.nombre || "Supervisor" }
  }

  const guardar = async (v: Voucher, origen: "terminal" | "manual", sup: { id: string; nombre: string } | null) => {
    setGuardando(true)
    try {
      const r = await api.caja.cashAdvances.create(cashSessionId as string, {
        monto: montoNum, opcion, origen, codigo_autorizacion: v.codigo_autorizacion,
        nro_referencia: v.nro_referencia, issuer_id: v.issuer_id, nombre_tarjeta: v.nombre_tarjeta,
        pan_ultimos4: v.pan_ultimos4, terminal: v.terminal, terminal_ip: terminalIp, punto_emision: puntoEmision,
        supervisor_id: sup?.id, raw_response: v.raw,
        cargo_cliente_gs: origen === "manual" && manualCargo.trim() !== "" ? soloDigitos(manualCargo) : undefined,
      })
      setVoucherPendiente(null)
      setResultado({ monto: montoNum, autorizacion: v.codigo_autorizacion, comision: Number(r.comision_gs || 0), cargo: Number(r.cargo_cliente_gs || 0), supervisor: r.supervisor_nombre })
      setEstado("aprobado")
      toast.success("Adelanto registrado", `Entregá Gs. ${formatPYG(montoNum)} en efectivo al cliente.`)
    } catch (e: any) {
      // El terminal YA cobró: no se pierde el voucher, queda a la vista para reintentar el guardado.
      setVoucherPendiente(v)
      setEstado("error")
      setError(`El terminal aprobó el adelanto (autorización ${v.codigo_autorizacion}) pero no se pudo guardar en el sistema: ${e?.message || "error de red"}. Tocá "Reintentar guardado" -- no entregues el efectivo hasta que se guarde.`)
      captureMessage(`Adelanto aprobado por el terminal y NO guardado: aut ${v.codigo_autorizacion} Gs. ${montoNum}`, "error", { aut: v.codigo_autorizacion, monto: montoNum }, "AdelantoSinGuardar")
    } finally {
      setGuardando(false)
    }
  }

  const cobrarEnTerminal = async () => {
    const err = validarMonto()
    if (err) { setError(err); return }
    setError("")
    if (!terminalIp) { setError("Falta la IP del terminal Dinelco de esta caja (Configurar Terminales POS)."); return }
    if (!dinelcoDisponible()) { setError("Esta pantalla no está corriendo dentro de la app de caja: no se puede hablar con el terminal."); return }
    let sup: { id: string; nombre: string } | null = null
    if (pideSupervisor) {
      sup = await verificarSupervisor()
      if (!sup) return
      setSupUsado(sup)
    }
    const token = terminalLock.tryAcquire(terminalIp)
    if (token === null) { setError("El terminal está ocupado con otro cobro. Esperá a que termine."); return }
    setEstado("esperando")
    try {
      const res = await imDinelco(dinelcoApi, terminalIp, "adelanto", { monto: montoNum, opcion }, null, ADELANTO_TIMEOUT_MS)
      if (!res.ok) {
        setEstado("error")
        if (res.error) {
          // Sin respuesta: el terminal pudo haber cobrado. NO se entrega efectivo hasta confirmar el voucher.
          setError(`No se pudo confirmar la respuesta del terminal (${res.error}). Revisá el terminal: si imprimió el voucher y dice APROBADA, cargalo a mano abajo. Si no cobró, no entregues efectivo.`)
          setManual(true)
        } else {
          setError(`El terminal no aprobó el adelanto: ${res.desc || "operación rechazada"}. No se entrega efectivo.`)
        }
        return
      }
      const c = res.campos || []
      const d = (res as any).data || {}
      await guardar({
        codigo_autorizacion: c[0] || String(d.codigoAutorizacion || ""), issuer_id: c[1] || undefined, nro_referencia: c[3] || undefined,
        terminal: c[4] || undefined, pan_ultimos4: c[6] || undefined, nombre_tarjeta: d.nombreTarjeta, raw: d,
      }, "terminal", sup)
    } finally {
      terminalLock.release(terminalIp, token)
    }
  }

  const registrarManual = async () => {
    const err = validarMonto()
    if (err) { setError(err); return }
    if (!manualAut.trim()) { setError("Ingresá el código de autorización que figura en el voucher impreso."); return }
    setError("")
    let sup = supUsado
    if (pideSupervisor && !sup) {
      sup = await verificarSupervisor()
      if (!sup) return
      setSupUsado(sup)
    }
    await guardar({ codigo_autorizacion: manualAut.trim() }, "manual", sup)
  }

  const reintentarGuardado = async () => { if (voucherPendiente) await guardar(voucherPendiente, "terminal", supUsado) }

  const total = compraNum + montoNum

  return (
    <div className="fixed inset-0 z-[130] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border-2 border-emerald-500/60 rounded-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto p-6 shadow-2xl text-slate-900 dark:text-slate-100">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-sm shrink-0"><Banknote className="w-5 h-5" /></div>
          <div className="flex-1">
            <h2 className="text-lg font-black tracking-tight">Adelanto de efectivo · Cobrá tu salario</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">El cliente pasa su tarjeta y se le entrega efectivo. No es una venta: no lleva factura.</p>
          </div>
          <button onClick={onClose} disabled={estado === "esperando"} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer" aria-label="Cerrar"><X className="w-4 h-4" /></button>
        </div>

        {estado === "aprobado" && resultado ? (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Entregá al cliente</div>
              <div className="text-4xl font-black font-posMono tabular-nums text-emerald-600 dark:text-emerald-400">Gs. {formatPYG(resultado.monto)}</div>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5">
              <div>Autorización {resultado.autorizacion}{resultado.supervisor ? ` · autorizó ${resultado.supervisor}` : ""}</div>
              <div>El voucher lo imprime el terminal: guardalo con el cierre de caja.</div>
              {resultado.cargo > 0 && <div>Al cliente se le cobró Gs. {formatPYG(resultado.monto + Math.round(resultado.cargo))} en la tarjeta (adelanto + comisión de Gs. {formatPYG(Math.round(resultado.cargo))}, que es de la procesadora).</div>}
              {resultado.comision > 0 && <div>Comisión a favor del comercio: Gs. {formatPYG(Math.round(resultado.comision))}</div>}
            </div>
            <button onClick={onClose} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black cursor-pointer">Listo</button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Efectivo a entregar (Gs.)</label>
              <input
                type="text" inputMode="numeric" autoFocus value={monto} disabled={estado === "esperando"}
                onChange={(e) => { const n = soloDigitos(e.target.value); setMonto(n ? n.toLocaleString("es-PY") : "") }}
                placeholder="0"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-2xl font-posMono tabular-nums font-black text-emerald-600 dark:text-emerald-400 outline-none focus:border-emerald-500"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Máximo Gs. {formatPYG(ADELANTO_MAX_GS)} por adelanto · desde Gs. {formatPYG(ADELANTO_SUPERVISOR_DESDE_GS)} pide autorización de supervisor.
              </p>
              {montoNum > 0 && opcion === 1 && (
                <div className="mt-2 rounded-xl border border-slate-300/60 bg-slate-50 dark:bg-slate-800/40 p-2.5 text-xs text-slate-600 dark:text-slate-300">
                  Red de Pagos: el terminal no muestra comisión al cliente. Vos entregás <b>Gs. {formatPYG(montoNum)}</b> y ese mismo monto sale de su tarjeta.
                </div>
              )}
              {montoNum > 0 && opcion === 2 && (
                <div className="mt-2 rounded-xl border border-sky-300/60 bg-sky-50 dark:bg-sky-950/20 p-2.5 text-xs text-sky-800 dark:text-sky-200">
                  El terminal le cobra al cliente una comisión de <b>Gs. {formatPYG(cargoCliente)}</b>{!reglaLeida && " (estimada)"}: de su tarjeta salen <b>Gs. {formatPYG(totalTarjeta)}</b>.
                  Vos entregás <b>Gs. {formatPYG(montoNum)}</b>. Avisale antes de pasar la tarjeta; esa comisión es de la procesadora.
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {([2, 1] as const).map((o) => (
                <button key={o} type="button" disabled={estado === "esperando"} onClick={() => setOpcion(o)}
                  className={`py-2 rounded-xl border text-xs font-bold cursor-pointer ${opcion === o ? "bg-emerald-600 text-white border-emerald-600" : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"}`}>
                  {o === 2 ? "Adelanto Dinelco" : "Adelanto Red de Pagos"}
                </button>
              ))}
            </div>

            <details className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-xs">
              <summary className="font-bold cursor-pointer text-slate-600 dark:text-slate-300">¿El cliente también hace una compra? (calculadora)</summary>
              <div className="mt-2 space-y-2">
                <input
                  type="text" inputMode="numeric" value={compra} onChange={(e) => { const n = soloDigitos(e.target.value); setCompra(n ? n.toLocaleString("es-PY") : "") }}
                  placeholder="Monto de la compra (Gs.)"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-posMono tabular-nums outline-none"
                />
                <div className="text-slate-600 dark:text-slate-300">
                  Del plástico del cliente salen <b>Gs. {formatPYG(total + cargoCliente)}</b> en total (compra Gs. {formatPYG(compraNum)} + adelanto Gs. {formatPYG(montoNum)} + comisión Gs. {formatPYG(cargoCliente)}), pero en <b>dos pasadas</b>: cobrá la compra por el POS de siempre y este adelanto aparte.
                </div>
              </div>
            </details>

            {pideSupervisor && (
              <div className="rounded-xl border border-amber-400/60 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-black text-amber-700 dark:text-amber-400"><ShieldCheck className="w-4 h-4" />Autorización de supervisor</div>
                <select value={supEmail} onChange={(e) => setSupEmail(e.target.value)} disabled={estado === "esperando"}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-sm">
                  <option value="">Elegí al supervisor…</option>
                  {supervisores.map((s) => <option key={s.id} value={s.email}>{s.nombre || s.email}</option>)}
                </select>
                <input type="password" inputMode="numeric" value={supPin} onChange={(e) => setSupPin(e.target.value)} placeholder="PIN o contraseña" disabled={estado === "esperando"}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-sm" />
              </div>
            )}

            {error && (
              <div className="flex gap-2 rounded-xl border border-rose-400/60 bg-rose-50 dark:bg-rose-950/20 p-3 text-xs text-rose-700 dark:text-rose-300">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span>
              </div>
            )}

            {voucherPendiente && (
              <button onClick={reintentarGuardado} disabled={guardando}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
                {guardando && <Loader2 className="w-4 h-4 animate-spin" />}Reintentar guardado (autorización {voucherPendiente.codigo_autorizacion})
              </button>
            )}

            {!voucherPendiente && (
              <button onClick={cobrarEnTerminal} disabled={estado === "esperando" || guardando}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
                {estado === "esperando" ? <><Loader2 className="w-4 h-4 animate-spin" />Esperando al terminal… pasá la tarjeta</> : <>Cobrar adelanto en el terminal</>}
              </button>
            )}

            {!voucherPendiente && estado !== "esperando" && (
              <div className="pt-1">
                <button type="button" onClick={() => setManual((v) => !v)} className="text-xs font-bold text-slate-500 underline cursor-pointer">
                  {manual ? "▾ Ocultar carga manual del voucher" : "▸ El terminal no responde: cargar el voucher a mano"}
                </button>
                {manual && (
                  <div className="mt-2 space-y-2 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Solo si el terminal ya aprobó e imprimió el voucher. El código de autorización es obligatorio y no se puede repetir.</p>
                    <input type="text" value={manualAut} onChange={(e) => setManualAut(e.target.value)} placeholder="Código de autorización del voucher"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-sm font-posMono" />
                    <input type="text" inputMode="numeric" value={manualCargo} onChange={(e) => { const n = soloDigitos(e.target.value); setManualCargo(n ? n.toLocaleString("es-PY") : "") }}
                      placeholder={`Comisión impresa en el voucher (estimada Gs. ${formatPYG(cargoCliente)})`}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-sm font-posMono" />
                    <button onClick={registrarManual} disabled={guardando}
                      className="w-full py-2 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-sm font-bold cursor-pointer disabled:opacity-50">
                      {guardando ? "Guardando…" : "Registrar adelanto (manual)"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
