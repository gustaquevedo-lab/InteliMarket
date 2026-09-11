import { useState, useEffect, useRef, useCallback } from "react"
import { CreditCard, Search, Printer, Loader2, CheckCircle2, AlertCircle, AlertTriangle, RefreshCw, Hash, Settings } from "lucide-react"
import { api } from "../../api"
import { renderTarjeta, canvasABase64, OPCIONES_DEFAULT, TARJETA_MM, type OpcionesTarjeta } from "../../utils/cardCanvas"
import { printImageViaQz, listarImpresoras, isQzAvailableError } from "../../utils/qzTray"

/**
 * Emision de tarjetas de socio Extra Club en la Zebra ZC300.
 *
 * Flujo: buscar socios -> elegir que datos van en la tarjeta -> ver la tarjeta
 * tal cual sale -> imprimir (una o varias). Si un cliente todavia no tiene
 * numero de socio, se le asigna al imprimir.
 */

interface Socio {
  customer_id: string
  nombre: string
  documento: string | null
  telefono: string | null
  ciudad: string | null
  extra_club_numero: string | null
  empresa_vinculada: string | null
  tiene_credito: boolean
  limite_credito: number | null
  saldo_disponible: number | null
}

interface EstadoImpresora {
  alcanzable: boolean
  host: string
  mensaje?: string
  con_error?: boolean
  sin_tarjetas?: boolean
  doble_faz?: boolean
  cinta?: string | null
  paneles_restantes?: number | null
  paneles_iniciales?: number | null
  total_impresas?: number | null
}

const CAMPOS: { k: keyof OpcionesTarjeta; label: string; nota?: string }[] = [
  { k: "mostrarDocumento", label: "Documento" },
  { k: "mostrarEmpresa", label: "Empresa del convenio" },
  { k: "mostrarCiudad", label: "Ciudad" },
  { k: "mostrarNumero", label: "Número de socio en texto", nota: "para cargarlo a mano si el QR no se lee" },
  { k: "mostrarLimite", label: "Línea de crédito", nota: "cambia con el tiempo: impresa, queda desactualizada" },
]

// La caja solo reconoce como tarjeta un UUID completo (POSPage.tsx). Un numero
// con otro formato -- por ejemplo los "EC-01234567" que genera el alta por la
// web -- se imprimiria perfecto y NO funcionaria al escanearlo. Mejor no
// imprimirlo que entregar un plastico que falla en la caja.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const esEscaneable = (n: string | null) => !n || UUID_RE.test(n.trim())

const fmtGs = (v: number | null | undefined) => (v == null ? "—" : `Gs. ${Math.round(v).toLocaleString("es-PY")}`)

export default function TarjetasSocioPage() {
  const [q, setQ] = useState("")
  const [soloSocios, setSoloSocios] = useState(true)
  const [socios, setSocios] = useState<Socio[]>([])
  const [buscando, setBuscando] = useState(false)
  const [activo, setActivo] = useState<Socio | null>(null)
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [opciones, setOpciones] = useState<OpcionesTarjeta>(OPCIONES_DEFAULT)
  const [estado, setEstado] = useState<EstadoImpresora | null>(null)
  const [impresoraQz, setImpresoraQz] = useState("")
  const [impresorasDetectadas, setImpresorasDetectadas] = useState<string[]>([])
  const [mostrarConfig, setMostrarConfig] = useState(false)
  const [imprimiendo, setImprimiendo] = useState<string | null>(null)
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const mostrar = (tipo: "ok" | "error", texto: string) => {
    setAviso({ tipo, texto })
    if (tipo === "ok") setTimeout(() => setAviso(null), 6000)
  }

  // Estado de la impresora: se consulta al entrar y cada 20 s, para enterarse
  // de que no hay tarjetas ANTES de mandar a imprimir.
  const cargarEstado = useCallback(async () => {
    try {
      setEstado(await api.loyalty.estadoImpresoraTarjetas())
    } catch {
      setEstado({ alcanzable: false, host: "192.168.0.51", mensaje: "No se pudo consultar el estado" })
    }
  }, [])
  useEffect(() => {
    cargarEstado()
    const t = setInterval(cargarEstado, 20000)
    return () => clearInterval(t)
  }, [cargarEstado])

  useEffect(() => {
    api.labelPrinting
      .getPrinterConfig("zc300_tarjeta")
      .then((c: any) => { if (c?.qz_printer_name) setImpresoraQz(c.qz_printer_name) })
      .catch(() => {})
  }, [])

  // Busqueda con demora corta: se tipea rapido y no hace falta pegarle al
  // servidor con cada tecla.
  useEffect(() => {
    const t = setTimeout(async () => {
      setBuscando(true)
      try {
        const r = await api.loyalty.tarjetasSocios({ q: q.trim() || undefined, solo_con_numero: soloSocios, limit: 60 })
        setSocios(r || [])
      } catch (e: any) {
        mostrar("error", `No se pudo buscar: ${e?.message || "error desconocido"}`)
      } finally {
        setBuscando(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [q, soloSocios])

  // Vista previa: la misma funcion que genera la imagen que se imprime.
  useEffect(() => {
    if (!activo || !canvasRef.current) return
    renderTarjeta(
      canvasRef.current,
      {
        nombre: activo.nombre,
        // Sin numero todavia: se muestra un numero de ejemplo para poder ver
        // el diseño. El real se asigna al imprimir.
        numero: activo.extra_club_numero || "00000000-0000-4000-8000-000000000000",
        documento: activo.documento,
        empresa: activo.empresa_vinculada,
        ciudad: activo.ciudad,
        limite: activo.limite_credito,
      },
      opciones,
    )
  }, [activo, opciones])

  const alternar = (id: string) =>
    setSeleccion((prev) => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })

  const guardarImpresora = async (nombre: string) => {
    setImpresoraQz(nombre)
    try {
      await api.labelPrinting.updatePrinterConfig("zc300_tarjeta", {
        nombre: "Zebra ZC300 Tarjetas",
        conexion: "qz_tray",
        qz_printer_name: nombre,
        host: estado?.host || "192.168.0.51",
        ancho_mm: TARJETA_MM.ancho,
        alto_mm: TARJETA_MM.alto,
        columnas: 1,
        activa: true,
      })
      mostrar("ok", `Impresora guardada: ${nombre}`)
    } catch (e: any) {
      mostrar("error", `No se pudo guardar la impresora: ${e?.message || ""}`)
    }
  }

  const detectarImpresoras = async () => {
    try {
      const lista = await listarImpresoras()
      setImpresorasDetectadas(lista)
      const zc = lista.find((n) => /zc3|zebra.*card|card.*zebra/i.test(n))
      if (zc && !impresoraQz) guardarImpresora(zc)
    } catch (e: any) {
      mostrar("error", isQzAvailableError(e)
        ? "QZ Tray no está abierto en esta PC. Abrilo e intentá de nuevo."
        : `No se pudieron listar las impresoras: ${e?.message || ""}`)
    }
  }

  const imprimir = async (lista: Socio[]) => {
    if (!lista.length) return
    if (!impresoraQz) {
      setMostrarConfig(true)
      mostrar("error", "Falta elegir la impresora de tarjetas (Configuración).")
      return
    }
    if (estado?.sin_tarjetas) {
      mostrar("error", "La impresora no tiene tarjetas cargadas. Cargá la bandeja y volvé a intentar.")
      return
    }
    const noEscaneables = lista.filter((s) => !esEscaneable(s.extra_club_numero))
    if (noEscaneables.length) {
      mostrar(
        "error",
        `No se imprimió nada. ${noEscaneables.map((s) => s.nombre).join(", ")} ` +
          `${noEscaneables.length === 1 ? "tiene" : "tienen"} un número de socio que la caja no reconoce al escanear ` +
          `(${noEscaneables[0].extra_club_numero}). Hay que corregir ese número antes de emitir la tarjeta.`,
      )
      return
    }
    const sinNumero = lista.filter((s) => !s.extra_club_numero)
    if (sinNumero.length) {
      const ok = window.confirm(
        `${sinNumero.length} cliente${sinNumero.length === 1 ? "" : "s"} todavía no ${sinNumero.length === 1 ? "tiene" : "tienen"} número de socio.\n\n` +
          `Se ${sinNumero.length === 1 ? "le" : "les"} va a asignar uno nuevo y definitivo antes de imprimir. ¿Continuar?`,
      )
      if (!ok) return
    }

    const off = document.createElement("canvas")
    let hechas = 0
    try {
      for (const s of lista) {
        setImprimiendo(s.nombre)
        let numero = s.extra_club_numero
        if (!numero) {
          const r = await api.loyalty.asignarNumeroSocio(s.customer_id)
          numero = r.extra_club_numero
          setSocios((prev) => prev.map((x) => (x.customer_id === s.customer_id ? { ...x, extra_club_numero: numero } : x)))
          if (activo?.customer_id === s.customer_id) setActivo({ ...s, extra_club_numero: numero })
        }
        await renderTarjeta(
          off,
          { nombre: s.nombre, numero: numero!, documento: s.documento, empresa: s.empresa_vinculada, ciudad: s.ciudad, limite: s.limite_credito },
          opciones,
        )
        await printImageViaQz({ printerName: impresoraQz, imagenBase64: canvasABase64(off), widthMm: TARJETA_MM.ancho, heightMm: TARJETA_MM.alto })
        hechas++
      }
      mostrar("ok", `${hechas} tarjeta${hechas === 1 ? "" : "s"} enviada${hechas === 1 ? "" : "s"} a la impresora.`)
      setSeleccion(new Set())
    } catch (e: any) {
      const detalle = isQzAvailableError(e) ? "QZ Tray no está abierto en esta PC." : e?.message || "error desconocido"
      mostrar("error", `Se detuvo después de ${hechas} de ${lista.length}. ${detalle}`)
    } finally {
      setImprimiendo(null)
      cargarEstado()
    }
  }

  const seleccionados = socios.filter((s) => seleccion.has(s.customer_id))
  const paneles = estado?.paneles_restantes
  const cintaBaja = paneles != null && paneles < 20

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Tarjetas Extra Club</h1>
            <p className="text-xs text-slate-500">Emisión e impresión de tarjetas de socio en la Zebra ZC300</p>
          </div>
        </div>
        <button onClick={() => setMostrarConfig((v) => !v)} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
          <Settings className="w-4 h-4" /> Configuración
        </button>
      </div>

      {/* Estado de la impresora */}
      <div className={`flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 rounded-2xl border text-sm ${
        !estado ? "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
        : !estado.alcanzable || estado.con_error ? "bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30"
        : "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30"}`}>
        <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100">
          {!estado ? <Loader2 className="w-4 h-4 animate-spin" />
            : !estado.alcanzable || estado.con_error ? <AlertCircle className="w-4 h-4 text-rose-500" />
            : <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          ZC300
          <span className="font-normal text-slate-500">
            {!estado ? "consultando…" : !estado.alcanzable ? "sin conexión" : estado.con_error ? estado.mensaje : "lista"}
          </span>
        </div>
        {estado?.alcanzable && (
          <>
            <span className="text-slate-600 dark:text-slate-300">Cinta <b>{estado.cinta || "—"}</b></span>
            <span className={cintaBaja ? "text-rose-600 font-bold" : "text-slate-600 dark:text-slate-300"}>
              {paneles ?? "—"} tarjetas de cinta restantes
            </span>
            <span className="text-slate-500">{estado.total_impresas?.toLocaleString("es-PY") ?? "—"} impresas en total</span>
          </>
        )}
        <button onClick={cargarEstado} className="ml-auto p-1.5 rounded-lg text-slate-500 hover:bg-white/60 dark:hover:bg-slate-800 cursor-pointer" title="Actualizar estado">
          <RefreshCw className="w-4 h-4" />
        </button>
        {estado?.alcanzable && estado.doble_faz === false && (
          <p className="w-full text-xs text-slate-500">
            Esta ZC300 es de <b>una sola cara</b>: todo el contenido va en el frente.
          </p>
        )}
      </div>

      {mostrarConfig && (
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col gap-3">
          <div className="text-sm font-bold text-slate-800 dark:text-slate-100">Impresora de tarjetas en esta PC</div>
          <p className="text-xs text-slate-500">
            La impresión va por QZ Tray al driver de la ZC300, así que se hace desde la PC donde está instalado ese driver.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select value={impresoraQz} onChange={(e) => guardarImpresora(e.target.value)}
              className="min-w-[260px] px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs outline-none cursor-pointer">
              <option value="">— elegir —</option>
              {[...new Set([impresoraQz, ...impresorasDetectadas].filter(Boolean))].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <button onClick={detectarImpresoras} className="px-3 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-700 cursor-pointer">
              Detectar impresoras
            </button>
          </div>
        </div>
      )}

      {aviso && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold ${aviso.tipo === "ok" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-rose-500/15 text-rose-700 dark:text-rose-300"}`}>
          {aviso.tipo === "ok" ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="flex-1">{aviso.texto}</span>
          <button onClick={() => setAviso(null)} className="text-xs opacity-60 hover:opacity-100 cursor-pointer">cerrar</button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
        {/* Lista */}
        <div className="flex flex-col gap-3 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre, documento o número de socio…"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm outline-none focus:border-amber-500" />
              {buscando && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-amber-500" />}
            </div>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
              <input type="checkbox" checked={soloSocios} onChange={(e) => setSoloSocios(e.target.checked)} className="accent-amber-500" />
              Solo socios con número
            </label>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 max-h-[60vh] overflow-y-auto">
            {socios.length === 0 && !buscando && (
              <div className="p-10 text-center text-sm text-slate-500">No hay resultados.</div>
            )}
            {socios.map((s) => (
              <div key={s.customer_id} onClick={() => setActivo(s)}
                className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer ${activo?.customer_id === s.customer_id ? "bg-amber-50 dark:bg-amber-500/10" : "hover:bg-slate-50 dark:hover:bg-slate-800/60"}`}>
                <input type="checkbox" checked={seleccion.has(s.customer_id)} onClick={(e) => e.stopPropagation()}
                  onChange={() => alternar(s.customer_id)} className="accent-amber-500 w-4 h-4" />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-sm truncate text-slate-900 dark:text-white">{s.nombre || "(sin nombre)"}</div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {s.documento || "sin documento"}
                    {s.empresa_vinculada ? ` · ${s.empresa_vinculada}` : ""}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {!s.extra_club_numero
                    ? <div className="text-[10px] font-bold text-amber-600">sin número</div>
                    : esEscaneable(s.extra_club_numero)
                      ? <div className="text-[10px] font-mono text-slate-500">{s.extra_club_numero.slice(0, 8)}…</div>
                      : <div className="text-[10px] font-bold text-rose-600" title={s.extra_club_numero}>número no escaneable</div>}
                  <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                    {s.tiene_credito ? fmtGs(s.saldo_disponible) : <span className="font-normal text-slate-400">sin crédito</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button onClick={() => imprimir(seleccionados)} disabled={!seleccionados.length || !!imprimiendo}
            className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-30 text-slate-950 font-black flex items-center justify-center gap-2 cursor-pointer">
            {imprimiendo ? <Loader2 className="w-5 h-5 animate-spin" /> : <Printer className="w-5 h-5" />}
            {imprimiendo ? `Imprimiendo ${imprimiendo}…` : `Imprimir ${seleccionados.length || ""} seleccionada${seleccionados.length === 1 ? "" : "s"}`}
          </button>
        </div>

        {/* Vista previa */}
        <div className="flex flex-col gap-3 min-w-0">
          <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            {activo ? (
              <canvas ref={canvasRef} className="w-full h-auto rounded-[14px] shadow-lg bg-white" style={{ aspectRatio: "85.6 / 53.98" }} />
            ) : (
              <div className="aspect-[85.6/53.98] rounded-[14px] border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-sm text-slate-400 text-center px-6">
                Elegí un socio de la lista para ver su tarjeta tal cual se imprime.
              </div>
            )}
          </div>

          {activo && (
            <>
              {!activo.extra_club_numero && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-xs text-amber-800 dark:text-amber-300">
                  <Hash className="w-4 h-4 shrink-0 mt-0.5" />
                  Todavía no es socio: el QR de la vista previa es de ejemplo. Al imprimir se le asigna su número definitivo.
                </div>
              )}
              {activo.tiene_credito && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <div className="text-[10px] uppercase text-slate-500">Límite</div>
                    <div className="font-black tabular-nums">{fmtGs(activo.limite_credito)}</div>
                  </div>
                  <div className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <div className="text-[10px] uppercase text-slate-500">Disponible hoy</div>
                    <div className="font-black tabular-nums text-emerald-600">{fmtGs(activo.saldo_disponible)}</div>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <div className="text-[10px] font-bold uppercase text-slate-500">Qué va en la tarjeta</div>
                {CAMPOS.map(({ k, label, nota }) => (
                  <label key={k} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
                    <input type="checkbox" checked={opciones[k]} onChange={(e) => setOpciones((o) => ({ ...o, [k]: e.target.checked }))}
                      className="accent-amber-500 mt-1" />
                    <span>{label}{nota && <span className="block text-[11px] text-slate-400">{nota}</span>}</span>
                  </label>
                ))}
                <p className="text-[11px] text-slate-400 mt-1">
                  El nombre, el logo y el QR van siempre. El QR lleva el número de socio, que es lo que la caja reconoce al escanear.
                </p>
              </div>

              {estado?.sin_tarjetas && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-xs font-bold text-rose-700 dark:text-rose-300">
                  <AlertTriangle className="w-4 h-4" /> La impresora no tiene tarjetas en la bandeja.
                </div>
              )}

              <button onClick={() => imprimir([activo])} disabled={!!imprimiendo}
                className="w-full py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer">
                <Printer className="w-4 h-4" /> Imprimir esta tarjeta
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
