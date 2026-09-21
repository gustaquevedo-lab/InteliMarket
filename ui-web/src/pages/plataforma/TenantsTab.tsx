import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Building2, CalendarClock, CheckCircle2, ChevronRight, Info, Loader2, Mail, Phone, Plus, Save, Users, X } from "lucide-react"
import { platform, type TenantItem } from "../../api/platform"
import { Card, Chip, Empty, Skel, cx, fecha } from "./ui"

const ESTADO: Record<string, string> = {
  activo: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30",
  prueba: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/30",
  suspendido: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30",
  cancelado: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30",
}
const PLAN_LABEL: Record<string, string> = { starter: "Starter", professional: "Professional", business: "Business", enterprise: "Enterprise" }

const diasHasta = (iso?: string | null) => (iso ? Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000) : null)
const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40)

export default function TenantsTab() {
  const [, setSp] = useSearchParams()
  const [data, setData] = useState<{ planes: string[]; estados: string[]; items: TenantItem[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<TenantItem | null>(null)
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<string | null>(null)

  const load = useCallback(async () => {
    try { setData(await platform.tenants()); setError(null) } catch (e: any) { setError(e?.message || "No se pudo cargar") }
  }, [])
  useEffect(() => { void load() }, [load])

  if (error) return <Card><div className="text-sm text-rose-600 font-bold">{error}</div></Card>
  if (!data) return <div className="grid md:grid-cols-2 gap-4">{[0, 1].map((i) => <Skel key={i} className="h-48" />)}</div>

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-[11px] text-slate-400 max-w-2xl">Cada empresa es un cliente de la plataforma, con su plan, su estado y sus usuarios. Las credenciales de cobro de cada una se cargan en Integraciones.</p>
        <button onClick={() => setCreating(true)} className="ml-auto px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"><Plus className="w-3.5 h-3.5" />Nueva empresa</button>
      </div>

      {created && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1"><div className="font-black text-emerald-900 dark:text-emerald-200">Empresa «{created}» creada</div><div className="text-xs text-emerald-800/80 dark:text-emerald-200/80 mt-0.5">Siguiente paso: cargar sus códigos de cobro (Bancard, PlugPay) y las IPs de sus terminales.</div></div>
          <button onClick={() => { const n = new URLSearchParams(window.location.search); n.set("tab", "integraciones"); setSp(n) }} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-black flex items-center gap-1 cursor-pointer">Ir a Integraciones <ChevronRight className="w-3.5 h-3.5" /></button>
          <button onClick={() => setCreated(null)} className="text-emerald-700/60 hover:text-emerald-900 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
      )}

      {data.items.length === 0 ? <Card><Empty icon={<Building2 className="w-7 h-7" />} title="Todavía no hay empresas" /></Card> : (
        <div className="grid lg:grid-cols-2 gap-4">
          {data.items.map((t) => {
            const dias = diasHasta(t.fecha_vencimiento)
            return (
              <Card key={t.id} pad={false}>
                <div className="p-4 flex flex-col gap-3.5">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white flex items-center justify-center font-black text-lg shrink-0">{t.nombre.slice(0, 1).toUpperCase()}</div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[15px] font-black text-slate-900 dark:text-white truncate">{t.nombre}</h3>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <Chip className={ESTADO[t.estado] || ESTADO.activo}>{t.estado}</Chip>
                        <Chip className="bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">{PLAN_LABEL[t.plan] || t.plan}</Chip>
                        {t.vertical && <Chip className="bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/30">{t.vertical}</Chip>}
                      </div>
                    </div>
                    <button onClick={() => setEditing(t)} className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-black text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">Editar</button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <Mini icon={<Users className="w-3.5 h-3.5" />} label="Usuarios" value={String(t.usuarios)} />
                    <Mini icon={<Building2 className="w-3.5 h-3.5" />} label="Razones sociales" value={String(t.empresas.length)} />
                    <Mini icon={<CalendarClock className="w-3.5 h-3.5" />} label="Vence" value={t.fecha_vencimiento ? (dias! < 0 ? "vencida" : dias === 0 ? "hoy" : `en ${dias} d`) : "sin fecha"} tone={dias !== null && dias <= 15 ? (dias < 0 ? "rose" : "amber") : undefined} />
                  </div>

                  {t.empresas.length > 0 && (
                    <ul className="text-xs space-y-1">
                      {t.empresas.map((e) => <li key={e.id} className="flex items-center gap-2 text-slate-600 dark:text-slate-300"><span className={cx("w-1.5 h-1.5 rounded-full", e.activo ? "bg-emerald-500" : "bg-slate-300")} /><span className="font-bold truncate">{e.razon_social}</span><span className="font-mono text-slate-400 ml-auto">{e.ruc}</span></li>)}
                    </ul>
                  )}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2.5">
                    <span className="font-mono">{t.slug}</span>
                    {t.contacto_email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{t.contacto_email}</span>}
                    {t.contacto_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{t.contacto_phone}</span>}
                    {t.created_at && <span className="ml-auto">alta {fecha(t.created_at).slice(0, 10)}</span>}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {editing && <EditDrawer t={editing} planes={data.planes} estados={data.estados} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load() }} />}
      {creating && <CreateModal planes={data.planes} onClose={() => setCreating(false)} onCreated={(n) => { setCreating(false); setCreated(n); void load() }} />}
    </div>
  )
}

function Mini({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: "amber" | "rose" }) {
  return <div className="rounded-xl px-2 py-2 bg-slate-50 dark:bg-slate-800/50"><div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-400">{icon}{label}</div><div className={cx("text-sm font-black", tone === "rose" ? "text-rose-600" : tone === "amber" ? "text-amber-600" : "text-slate-800 dark:text-slate-100")}>{value}</div></div>
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <div><label className="text-xs font-black text-slate-800 dark:text-slate-100">{label}</label><div className="mt-1">{children}</div>{hint && <div className="text-[11px] text-slate-400 mt-1">{hint}</div>}</div>
}
const inputCls = "w-full px-3 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 outline-none focus:border-indigo-500"

function EditDrawer({ t, planes, estados, onClose, onSaved }: { t: TenantItem; planes: string[]; estados: string[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ nombre: t.nombre, plan: t.plan, estado: t.estado, fecha_vencimiento: (t.fecha_vencimiento || "").slice(0, 10), contacto_email: t.contacto_email || "", contacto_phone: t.contacto_phone || "" })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h) }, [onClose])
  const save = async () => {
    setSaving(true); setErr(null)
    try {
      await platform.updateTenant(t.id, { nombre: f.nombre.trim(), plan: f.plan, estado: f.estado, fecha_vencimiento: f.fecha_vencimiento || null, contacto_email: f.contacto_email.trim() || null, contacto_phone: f.contacto_phone.trim() || null })
      onSaved()
    } catch (e: any) { setErr(e?.message || "No se pudo guardar") } finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 z-[200] flex justify-end">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="relative w-full max-w-[480px] h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl overflow-y-auto">
        <div className="sticky top-0 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-5 py-4 flex items-center gap-3">
          <div className="flex-1 min-w-0"><h2 className="text-base font-black text-slate-900 dark:text-white truncate">Editar {t.nombre}</h2><p className="text-[11px] text-slate-500 font-mono">{t.slug} · {t.schema_name}</p></div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <Field label="Nombre"><input className={inputCls} value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Plan"><select className={inputCls} value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value })}>{planes.map((p) => <option key={p} value={p}>{PLAN_LABEL[p] || p}</option>)}</select></Field>
            <Field label="Estado"><select className={inputCls} value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value })}>{estados.map((p) => <option key={p} value={p}>{p}</option>)}</select></Field>
          </div>
          <Field label="Vencimiento del servicio" hint="Dejalo vacío si no vence."><input type="date" className={inputCls} value={f.fecha_vencimiento} onChange={(e) => setF({ ...f, fecha_vencimiento: e.target.value })} /></Field>
          <Field label="Email de contacto"><input className={inputCls} value={f.contacto_email} onChange={(e) => setF({ ...f, contacto_email: e.target.value })} /></Field>
          <Field label="Teléfono de contacto"><input className={inputCls} value={f.contacto_phone} onChange={(e) => setF({ ...f, contacto_phone: e.target.value })} /></Field>
          {err && <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-xs font-bold text-rose-700 dark:text-rose-300">{err}</div>}
          <div className="flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 pt-4">
            <button onClick={save} disabled={saving || f.nombre.trim().length < 2} className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black flex items-center gap-2 disabled:opacity-40 cursor-pointer">{saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}Guardar</button>
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-xs font-black text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer">Cancelar</button>
          </div>
        </div>
      </aside>
    </div>
  )
}

function CreateModal({ planes, onClose, onCreated }: { planes: string[]; onClose: () => void; onCreated: (nombre: string) => void }) {
  const [verts, setVerts] = useState<{ slug: string; nombre: string }[]>([])
  const [f, setF] = useState({ nombre: "", slug: "", plan: "starter", vertical: "", admin_nombre: "", admin_email: "", admin_password: "" })
  const [slugEdit, setSlugEdit] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => { platform.verticals().then(setVerts).catch(() => {}) }, [])
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h) }, [onClose])
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v, ...(k === "nombre" && !slugEdit ? { slug: slugify(v) } : {}) }))
  const ok = f.nombre.trim().length >= 2 && /^[a-z0-9][a-z0-9-]{2,60}$/.test(f.slug) && f.admin_nombre.trim().length >= 2 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.admin_email) && f.admin_password.length >= 10

  const create = async () => {
    setSaving(true); setErr(null)
    try {
      await platform.createTenant({ nombre: f.nombre.trim(), slug: f.slug, plan: f.plan, vertical: f.vertical || undefined, admin_nombre: f.admin_nombre.trim(), admin_email: f.admin_email.trim(), admin_password: f.admin_password })
      onCreated(f.nombre.trim())
    } catch (e: any) { setErr(e?.message || "No se pudo crear la empresa") } finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white flex items-center justify-center"><Building2 className="w-5 h-5" /></div>
          <div className="flex-1"><h2 className="text-base font-black text-slate-900 dark:text-white">Nueva empresa</h2><p className="text-[11px] text-slate-500">Crea el cliente, su administrador inicial y su espacio de datos.</p></div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 grid gap-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Nombre de la empresa"><input className={inputCls} value={f.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Supermercado San Juan" autoFocus /></Field>
            <Field label="Identificador" hint="Minúsculas, números y guiones. No se puede cambiar después."><input className={cx(inputCls, "font-mono text-[13px]")} value={f.slug} onChange={(e) => { setSlugEdit(true); setF({ ...f, slug: e.target.value.toLowerCase() }) }} /></Field>
            <Field label="Plan"><select className={inputCls} value={f.plan} onChange={(e) => set("plan", e.target.value)}>{planes.map((p) => <option key={p} value={p}>{PLAN_LABEL[p] || p}</option>)}</select></Field>
            <Field label="Rubro (módulos precargados)"><select className={inputCls} value={f.vertical} onChange={(e) => set("vertical", e.target.value)}><option value="">Sin rubro</option>{verts.map((v) => <option key={v.slug} value={v.slug}>{v.nombre}</option>)}</select></Field>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Administrador inicial</div>
            <Field label="Nombre"><input className={inputCls} value={f.admin_nombre} onChange={(e) => set("admin_nombre", e.target.value)} /></Field>
            <Field label="Email (será su usuario)"><input className={inputCls} type="email" value={f.admin_email} onChange={(e) => set("admin_email", e.target.value)} /></Field>
            <div className="sm:col-span-2"><Field label="Contraseña inicial" hint="Mínimo 10 caracteres. Se la pasás vos; que la cambie al primer ingreso."><input className={inputCls} type="password" autoComplete="new-password" value={f.admin_password} onChange={(e) => set("admin_password", e.target.value)} /></Field></div>
          </div>
          <div className="flex gap-2.5 p-3.5 rounded-xl bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/30 text-xs text-sky-900 dark:text-sky-200">
            <Info className="w-4 h-4 shrink-0 mt-px" />
            <div>Esto crea el registro de la empresa, su administrador y un espacio de datos con las tablas base. <b>El armado completo del sistema para un cliente nuevo (catálogo, cajas, impuestos, migración de datos) sigue siendo un trabajo aparte</b>; esta pantalla deja lista la primera parte y el checklist de Integraciones guía el resto.</div>
          </div>
          {err && <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-xs font-bold text-rose-700 dark:text-rose-300 break-words">{err}</div>}
          <div className="flex items-center gap-2">
            <button onClick={create} disabled={!ok || saving} className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center gap-2 disabled:opacity-40 cursor-pointer">{saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Crear empresa</button>
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-xs font-black text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer">Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  )
}
