import { useEffect, useState } from "react"
import { api, CustomerProfile } from "../../../../api"
import { formatPYG } from "../../../../utils/format"

interface Props {
  convId: string
  onSendCampaign?: (phone: string) => void
  onClose: () => void
}

export function CustomerProfilePanel({ convId, onSendCampaign, onClose }: Props) {
  const [profile, setProfile] = useState<CustomerProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    api.whatsapp
      .getCustomerProfile(convId)
      .then((data) => {
        if (active) setProfile(data)
      })
      .catch(() => {
        if (active) setProfile({ linked: false })
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [convId])

  return (
    <aside className="w-72 shrink-0 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col h-full overflow-hidden">
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
        <span className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-200">
          👤 Ficha del Cliente
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs px-1.5 py-0.5 rounded-lg"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {loading && <p className="text-slate-400 text-xs text-center py-6">Cargando ficha...</p>}

        {!loading && !profile?.linked && (
          <div className="text-center py-6">
            <p className="text-2xl mb-2">🔍</p>
            <p className="text-slate-500 text-xs">
              Cliente no vinculado. El número no está registrado en la base de clientes.
            </p>
          </div>
        )}

        {!loading && profile?.linked && (
          <>
            <section className="space-y-1">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Datos</h3>
              <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{profile.razon_social}</p>
              {profile.ciudad && <p className="text-xs text-slate-500">📍 {profile.ciudad}</p>}
              {profile.ci && <p className="text-xs text-slate-500">CI: {profile.ci}</p>}
              {profile.ruc && <p className="text-xs text-slate-500">RUC: {profile.ruc}</p>}
              {(profile.limite_credito || 0) > 0 && (
                <p className="text-xs text-slate-500">Límite crédito: {formatPYG(profile.limite_credito || 0)}</p>
              )}
            </section>

            <section className="space-y-1">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">⭐ ExtraClub</h3>
              {profile.extra_club_is_member ? (
                <>
                  <p className="text-xs text-slate-500">N° {profile.extra_club_numero}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                      {(profile.extra_club_puntos || 0).toLocaleString("es-PY")} pts
                    </span>
                    {(profile.extra_club_puntos_por_vencer || 0) > 0 && (
                      <span className="text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 px-2 py-0.5 rounded-full border border-orange-200 dark:border-orange-700">
                        ⚠ {profile.extra_club_puntos_por_vencer} vencen pronto
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-400 italic">No es socio ExtraClub</p>
              )}
            </section>

            <section className="space-y-1">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">💳 Cuenta Corriente</h3>
              {(profile.deuda_total || 0) > 0 ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 px-2.5 py-1 rounded-full border border-red-200 dark:border-red-700 whitespace-nowrap">
                  🔴 Deuda: {formatPYG(profile.deuda_total || 0)}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-700">
                  ✅ Sin deuda
                </span>
              )}
            </section>

            {profile.ultimas_ventas && profile.ultimas_ventas.length > 0 && (
              <section className="space-y-1.5">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">🧾 Últimas ventas</h3>
                {profile.ultimas_ventas.map((v, i) => (
                  <div
                    key={i}
                    className="text-xs bg-slate-50 dark:bg-slate-800/70 rounded-xl px-3 py-2 border border-slate-200/70 dark:border-slate-700"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">{v.numero}</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {formatPYG(v.total)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400 mt-0.5">
                      <span>{v.fecha}</span>
                      {v.saldo > 0 && <span className="text-red-500 whitespace-nowrap">Saldo: {formatPYG(v.saldo)}</span>}
                    </div>
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </div>

      {profile?.linked && onSendCampaign && (
        <div className="shrink-0 px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
          <button
            type="button"
            onClick={() => onSendCampaign(profile.telefono || "")}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded-xl transition-colors"
          >
            📣 Enviar campaña
          </button>
        </div>
      )}
    </aside>
  )
}
