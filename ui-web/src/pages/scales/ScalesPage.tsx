import { useState, useEffect } from "react"
import { api, type ScaleConfig, type ScaleLabelTemplate, type ConnectionTestResult } from "../../api"
import { useToast } from "../../context/ToastContext"
import { Search, Plus, Loader2, Plug, Wifi, Printer, Weight, FileText, Settings2, Trash2, CheckCircle, XCircle, AlertTriangle, Download } from "lucide-react"

type Tab = "configs" | "weight" | "plu" | "labels" | "logs"

interface ScaleConfigForm {
  nombre: string; marca: string; modelo: string; protocolo: string; conexion: string
  host: string; puerto_tcp: number; puerto_com: string; baudrate: number; timeout_segundos: number
  sync_automatico: boolean; etiqueta_formato: string
}

export default function ScalesPage() {
  const [tab, setTab] = useState<Tab>("configs")
  const [loading, setLoading] = useState(true)
  const [scales, setScales] = useState<ScaleConfig[]>([])
  const [selectedScale, setSelectedScale] = useState<string>("")
  const [weight, setWeight] = useState<any>(null)
  const [weightLoading, setWeightLoading] = useState(false)
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null)
  const [testLoading, setTestLoading] = useState(false)
  const [pluResult, setPluResult] = useState<any>(null)
  const [pluLoading, setPluLoading] = useState(false)
  const [templates, setTemplates] = useState<ScaleLabelTemplate[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<ScaleConfigForm>({
    nombre: "", marca: "balmak", modelo: "", protocolo: "toledo_p03", conexion: "tcp",
    host: "", puerto_tcp: 9000, puerto_com: "COM1", baudrate: 9600, timeout_segundos: 5,
    sync_automatico: false, etiqueta_formato: "40x30",
  })
  const [search, setSearch] = useState("")
  const toast = useToast()

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [s, t, l] = await Promise.all([
        api.scales.configs.list(),
        api.scales.labelTemplates.list(),
        api.scales.weightLogs(),
      ])
      setScales(s)
      setTemplates(t)
      setLogs(l)
    } catch (e: any) { toast.error("Error", e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchAll() }, [])

  const handleCreate = async () => {
    try {
      await api.scales.configs.create(form)
      toast.success("Báscula creada")
      setShowCreate(false)
      setForm({ nombre: "", marca: "balmak", modelo: "", protocolo: "toledo_p03", conexion: "tcp", host: "", puerto_tcp: 9000, puerto_com: "COM1", baudrate: 9600, timeout_segundos: 5, sync_automatico: false, etiqueta_formato: "40x30" })
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.scales.configs.delete(id)
      toast.success("Báscula eliminada")
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleTest = async () => {
    if (!selectedScale) return
    setTestLoading(true)
    try {
      const r = await api.scales.test(selectedScale)
      setTestResult(r)
    } catch (e: any) { toast.error("Error", e.message) }
    finally { setTestLoading(false) }
  }

  const handleReadWeight = async () => {
    if (!selectedScale) return
    setWeightLoading(true)
    try {
      const r = await api.scales.readWeight(selectedScale)
      setWeight(r)
    } catch (e: any) { toast.error("Error", e.message) }
    finally { setWeightLoading(false) }
  }

  const handleSyncPLU = async () => {
    if (!selectedScale) return
    setPluLoading(true)
    try {
      const r = await api.scales.syncPLU(selectedScale, { producto_ids: [], modo: "incremental" })
      setPluResult(r)
      toast.success("PLU sync", `${r.exitosos} productos enviados`)
    } catch (e: any) { toast.error("Error", e.message) }
    finally { setPluLoading(false) }
  }

  const protocolos = [
    { v: "toledo_p03", l: "Toledo P03 (Balmak, Toledo, Filizola)" },
    { v: "filizola", l: "Filizola" },
    { v: "balmak_sdl", l: "Balmak SDL (Edge)" },
    { v: "rinnert", l: "Rinnert (Jundiaí)" },
    { v: "generic_ascii", l: "Genérico ASCII" },
    { v: "usb_hid_pos", l: "USB HID POS" },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Básculas</h1>
          <p className="text-sm text-gray-500">Integración con balanzas comerciales</p>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit overflow-x-auto">
        {([["configs","Configuración"],["weight","Peso"],["plu","Sincronizar PLU"],["labels","Etiquetas"],["logs","Historial"]] as const).map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap ${
              tab===k?"bg-white dark:bg-slate-700 shadow-sm":"text-gray-500 hover:text-gray-700"
            }`}>{l}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <>
          {tab === "configs" && (
            <>
              <div className="flex justify-end">
                <button onClick={() => setShowCreate(true)} className="btn-primary text-sm"><Plus className="w-4 h-4" />Nueva báscula</button>
              </div>
              <div className="grid gap-4">
                {scales.map(s => (
                  <div key={s.id} className={`card p-4 border-l-4 ${s.activa ? "border-green-500" : "border-gray-300"}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <Weight className="w-6 h-6 text-primary" />
                        <div>
                          <h3 className="font-semibold">{s.nombre}</h3>
                          <p className="text-xs text-gray-500">
                            {s.marca} {s.modelo} · {s.protocolo} · {s.conexion}
                            {s.host && ` · ${s.host}:${s.puerto_tcp}`}
                            {s.puerto_com && ` · ${s.puerto_com}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setSelectedScale(s.id!); handleTest() }} className="text-blue-500 hover:text-blue-700" title="Probar conexión"><Plug className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(s.id!)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => { setSelectedScale(s.id!); setTab("weight") }} className="text-xs btn-ghost py-1 px-2"><Weight className="w-3 h-3" /> Leer peso</button>
                      <button onClick={() => { setSelectedScale(s.id!); setTab("plu") }} className="text-xs btn-ghost py-1 px-2"><Download className="w-3 h-3" /> Sincronizar PLU</button>
                    </div>
                  </div>
                ))}
                {scales.length === 0 && <p className="text-gray-400 text-center py-8">No hay básculas configuradas</p>}
              </div>
            </>
          )}

          {tab === "weight" && (
            <div className="max-w-xl space-y-4">
              <div className="card p-6">
                <h3 className="font-semibold mb-4">Lectura de peso</h3>
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500">Báscula</label>
                    <select className="input-field" value={selectedScale} onChange={e => setSelectedScale(e.target.value)}>
                      <option value="">Seleccionar...</option>
                      {scales.map(s => <option key={s.id} value={s.id!}>{s.nombre}</option>)}
                    </select>
                  </div>
                  <button onClick={handleReadWeight} disabled={!selectedScale || weightLoading} className="btn-primary disabled:opacity-50">
                    {weightLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Weight className="w-4 h-4" />}
                    Leer peso
                  </button>
                  <button onClick={handleTest} disabled={!selectedScale || testLoading} className="btn-ghost">
                    {testLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
                    Test
                  </button>
                </div>
                {weight && (
                  <div className="mt-6 bg-gray-50 dark:bg-gray-800 rounded-lg p-6 text-center">
                    <div className="text-5xl font-bold text-primary">{weight.peso_bruto?.toFixed(3)} <span className="text-xl">{weight.unidad}</span></div>
                    <div className="mt-2 text-sm text-gray-500">
                      {weight.estable ? <span className="text-green-600 flex items-center justify-center gap-1"><CheckCircle className="w-4 h-4" /> Estable</span> : <span className="text-amber-600 flex items-center justify-center gap-1"><AlertTriangle className="w-4 h-4" /> Inestable</span>}
                    </div>
                    {weight.peso_neto != null && <p className="text-xs text-gray-400 mt-1">Neto: {weight.peso_neto.toFixed(3)} | Tara: {weight.tara?.toFixed(3)}</p>}
                    <p className="text-xs text-gray-400 mt-1">{weight.protocolo} · {weight.timestamp}</p>
                  </div>
                )}
              </div>
              {testResult && (
                <div className={`card p-4 ${testResult.conectada ? "border-l-4 border-green-500" : "border-l-4 border-red-500"}`}>
                  <div className="flex items-center gap-3">
                    {testResult.conectada ? <CheckCircle className="w-5 h-5 text-green-600" /> : <XCircle className="w-5 h-5 text-red-600" />}
                    <div>
                      <p className="font-medium">{testResult.conectada ? "Conectada" : "Error de conexión"}</p>
                      <p className="text-sm text-gray-500">{testResult.mensaje}</p>
                      {testResult.latencia_ms != null && <p className="text-xs text-gray-400">Latencia: {testResult.latencia_ms}ms</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "plu" && (
            <div className="max-w-xl space-y-4">
              <div className="card p-6">
                <h3 className="font-semibold mb-4">Sincronizar productos (PLU)</h3>
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500">Báscula</label>
                    <select className="input-field" value={selectedScale} onChange={e => setSelectedScale(e.target.value)}>
                      <option value="">Seleccionar...</option>
                      {scales.map(s => <option key={s.id} value={s.id!}>{s.nombre}</option>)}
                    </select>
                  </div>
                  <button onClick={handleSyncPLU} disabled={!selectedScale || pluLoading} className="btn-primary disabled:opacity-50">
                    {pluLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    Sincronizar
                  </button>
                </div>
                {pluResult && (
                  <div className="mt-4 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <p className="font-medium text-green-700 dark:text-green-300">{pluResult.exitosos} productos sincronizados</p>
                    {pluResult.fallidos > 0 && <p className="text-sm text-red-500">{pluResult.fallidos} fallos</p>}
                    {pluResult.archivo_generado && <p className="text-xs text-gray-400 mt-1">Archivo: {pluResult.archivo_generado}</p>}
                    {pluResult.errores?.length > 0 && (
                      <div className="mt-2 text-xs text-red-500">
                        {pluResult.errores.slice(0, 5).map((e: any, i: number) => <p key={i}>{e.producto_id}: {e.error}</p>)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "labels" && <LabelTemplatesSection templates={templates} fetchAll={fetchAll} />}

          {tab === "logs" && (
            <div className="space-y-2">
              <h3 className="font-semibold">Historial de pesajes</h3>
              {logs.length === 0 && <p className="text-gray-400 text-sm">Sin registros</p>}
              {logs.map((l, i) => (
                <div key={i} className="card p-3 flex justify-between items-center text-sm">
                  <div>
                    <span className="font-medium">{l.peso_bruto?.toFixed(3)} kg</span>
                    <span className="text-gray-400 ml-2">{l.scale_nombre || l.scale_id}</span>
                  </div>
                  <span className="text-xs text-gray-400">{l.fecha ? new Date(l.fecha).toLocaleString() : ""}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b"><h3 className="font-semibold text-lg">Nueva báscula</h3></div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><label className="text-xs text-gray-500">Nombre</label><input className="input-field" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} /></div>
                <div><label className="text-xs text-gray-500">Marca</label>
                  <select className="input-field" value={form.marca} onChange={e => setForm({...form, marca: e.target.value})}>
                    {["balmak","toledo","filizola","jundiai","lider","digitron","generic"].map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div><label className="text-xs text-gray-500">Modelo</label><input className="input-field" value={form.modelo} onChange={e => setForm({...form, modelo: e.target.value})} /></div>
                <div><label className="text-xs text-gray-500">Protocolo</label>
                  <select className="input-field" value={form.protocolo} onChange={e => setForm({...form, protocolo: e.target.value})}>
                    {protocolos.map(p => <option key={p.v} value={p.v}>{p.l}</option>)}
                  </select>
                </div>
                <div><label className="text-xs text-gray-500">Conexión</label>
                  <select className="input-field" value={form.conexion} onChange={e => setForm({...form, conexion: e.target.value})}>
                    {["tcp","serial","wifi","usb_hid"].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              {["tcp","wifi"].includes(form.conexion) && (
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-xs text-gray-500">Host / IP</label><input className="input-field" value={form.host} onChange={e => setForm({...form, host: e.target.value})} placeholder="192.168.1.100" /></div>
                  <div><label className="text-xs text-gray-500">Puerto TCP</label><input className="input-field" type="number" value={form.puerto_tcp} onChange={e => setForm({...form, puerto_tcp: Number(e.target.value)})} /></div>
                </div>
              )}
              {form.conexion === "serial" && (
                <div className="grid grid-cols-4 gap-4">
                  <div className="col-span-2"><label className="text-xs text-gray-500">Puerto COM</label><input className="input-field" value={form.puerto_com} onChange={e => setForm({...form, puerto_com: e.target.value})} /></div>
                  <div><label className="text-xs text-gray-500">Baudrate</label>
                    <select className="input-field" value={form.baudrate} onChange={e => setForm({...form, baudrate: Number(e.target.value)})}>
                      {[1200,2400,4800,9600,19200,38400,57600,115200].map(b => <option key={b}>{b}</option>)}
                    </select>
                  </div>
                  <div><label className="text-xs text-gray-500">Timeout (s)</label><input className="input-field" type="number" value={form.timeout_segundos} onChange={e => setForm({...form, timeout_segundos: Number(e.target.value)})} /></div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={form.sync_automatico} onChange={e => setForm({...form, sync_automatico: e.target.checked})} />
                <label className="text-sm">Sync automático de PLU</label>
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowCreate(false)} className="btn-ghost">Cancelar</button>
              <button onClick={handleCreate} disabled={!form.nombre} className="btn-primary disabled:opacity-50">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function LabelTemplatesSection({ templates, fetchAll }: { templates: ScaleLabelTemplate[]; fetchAll: () => void }) {
  const toast = useToast()
  const [showCreate, setShowCreate] = useState(false)
  const [newLabel, setNewLabel] = useState({ nombre: "", ancho_mm: 40, alto_mm: 30, incluir_barcode: true, incluir_precio: true, incluir_peso: true, campos: [] as any[] })
  const [newField, setNewField] = useState({ tipo: "nombre_producto", texto: "", fuente_tamano: 8, x_mm: 0, y_mm: 0 })

  const handleCreate = async () => {
    try {
      await api.scales.labelTemplates.create(newLabel)
      toast.success("Plantilla creada")
      setShowCreate(false)
      setNewLabel({ nombre: "", ancho_mm: 40, alto_mm: 30, incluir_barcode: true, incluir_precio: true, incluir_peso: true, campos: [] })
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.scales.labelTemplates.delete(id)
      toast.success("Plantilla eliminada")
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowCreate(true)} className="btn-primary text-sm"><Plus className="w-4 h-4" />Nueva plantilla</button>
      </div>
      <div className="grid gap-4">
        {templates.map(t => (
          <div key={t.id} className="card p-4 flex justify-between items-center">
            <div>
              <h3 className="font-semibold">{t.nombre}</h3>
              <p className="text-xs text-gray-500">{t.ancho_mm}x{t.alto_mm}mm · {t.campos?.length ?? 0} campos</p>
            </div>
            <button onClick={() => handleDelete(t.id!)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b"><h3 className="font-semibold text-lg">Nueva plantilla de etiqueta</h3></div>
            <div className="p-6 space-y-4">
              <div><label className="text-xs text-gray-500">Nombre</label><input className="input-field" value={newLabel.nombre} onChange={e => setNewLabel({...newLabel, nombre: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs text-gray-500">Ancho (mm)</label><input className="input-field" type="number" value={newLabel.ancho_mm} onChange={e => setNewLabel({...newLabel, ancho_mm: Number(e.target.value)})} /></div>
                <div><label className="text-xs text-gray-500">Alto (mm)</label><input className="input-field" type="number" value={newLabel.alto_mm} onChange={e => setNewLabel({...newLabel, alto_mm: Number(e.target.value)})} /></div>
              </div>
              <div className="space-y-2">
                {["incluir_barcode","incluir_precio","incluir_peso"].map(f => (
                  <label key={f} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={(newLabel as any)[f]} onChange={e => setNewLabel({...newLabel, [f]: e.target.checked})} />
                    {f === "incluir_barcode" ? "Código de barras" : f === "incluir_precio" ? "Precio" : "Peso"}
                  </label>
                ))}
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium">Campos personalizados</label>
                {newLabel.campos.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 mt-1 text-sm">
                    <span className="flex-1">{c.tipo}</span>
                    <button onClick={() => setNewLabel({...newLabel, campos: newLabel.campos.filter((_: any, j: number) => j !== i)})} className="text-red-400"><XCircle className="w-4 h-4" /></button>
                  </div>
                ))}
                <div className="flex gap-2 mt-2">
                  <select className="input-field text-sm flex-1" value={newField.tipo} onChange={e => setNewField({...newField, tipo: e.target.value})}>
                    {["nombre_producto","precio_unitario","precio_total","peso","codigo_barras","fecha_venc","lote","info_nutricional","texto_libre"].map(t => <option key={t}>{t}</option>)}
                  </select>
                  <button onClick={() => { setNewLabel({...newLabel, campos: [...newLabel.campos, {...newField}] }) }} className="btn-primary text-sm px-3 py-2">+</button>
                </div>
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowCreate(false)} className="btn-ghost">Cancelar</button>
              <button onClick={handleCreate} disabled={!newLabel.nombre} className="btn-primary disabled:opacity-50">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
