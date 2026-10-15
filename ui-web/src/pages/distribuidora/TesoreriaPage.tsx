import { useState, useEffect } from "react"
import { api } from "../../api"
import { useAuth } from "../../context/AuthContext"
import { useToast } from "../../context/ToastContext"
import { TreasuryDailySummary } from "../../api"
import { Loader2, Building2, Truck, Plus, DollarSign } from "lucide-react"

const today = new Date().toISOString().split("T")[0]

const formatPYG = (n?: number | null) => {
  if (n == null) return "Gs 0"
  return `Gs ${Number(n).toLocaleString("es-PY")}`
}

export default function TesoreriaPage() {
  const { user } = useAuth()
  const toast = useToast()
  const companyId = user?.tenant_id || user?.id || ""

  const [summary, setSummary] = useState<TreasuryDailySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [fecha, setFecha] = useState(today)
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [depositing, setDepositing] = useState(false)
  const [depositForm, setDepositForm] = useState({
    bank_name: "",
    account_number: "",
    monto_efectivo: "",
    monto_cheques: "",
  })

  const load = async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const data = await api.distribuidora.rutaCaja.getDailySummary(companyId, fecha)
      setSummary(data)
    } catch {
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [companyId, fecha])

  const handleDeposit = async () => {
    setDepositing(true)
    try {
      const authorizedIds = summary?.rutas
        .map(r => r.liquidation_id)
        .filter(Boolean) as string[] || []

      await api.distribuidora.rutaCaja.createBankDeposit({
        company_id: companyId,
        fecha,
        bank_name: depositForm.bank_name,
        account_number: depositForm.account_number,
        monto_efectivo: Number(depositForm.monto_efectivo) || 0,
        monto_cheques: Number(depositForm.monto_cheques) || 0,
        route_liquidation_ids: authorizedIds,
        cash_session_ids: [],
        created_by: user?.id || "",
      })
      toast.success("Depósito bancario registrado")
      setShowDepositModal(false)
      setDepositForm({ bank_name: "", account_number: "", monto_efectivo: "", monto_cheques: "" })
      load()
    } catch (e: any) {
      toast.error(e?.message || "Error al registrar depósito")
    } finally {
      setDepositing(false)
    }
  }

  const totales = summary?.totales
  const retail = summary?.retail

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Tesorería</h1>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm"
          />
          <button
            onClick={() => setShowDepositModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <Plus size={16} /> Registrar depósito
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="animate-spin text-gray-400 w-8 h-8" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border p-4 bg-blue-50">
              <p className="text-xs text-gray-500 mb-1">Total efectivo rutas</p>
              <p className="text-lg font-bold text-blue-700">{formatPYG(totales?.total_efectivo)}</p>
            </div>
            <div className="rounded-xl border p-4 bg-purple-50">
              <p className="text-xs text-gray-500 mb-1">Cheques / pagarés</p>
              <p className="text-lg font-bold text-purple-700">{formatPYG((totales?.total_cheques || 0) + (totales?.total_pagares || 0))}</p>
            </div>
            <div className="rounded-xl border p-4 bg-green-50">
              <p className="text-xs text-gray-500 mb-1">Retail (efectivo)</p>
              <p className="text-lg font-bold text-green-700">{formatPYG(retail?.total_efectivo)}</p>
            </div>
            <div className="rounded-xl border p-4 bg-gray-50">
              <p className="text-xs text-gray-500 mb-1">Sesiones retail</p>
              <p className="text-lg font-bold text-gray-700">{retail?.session_count ?? 0}</p>
            </div>
          </div>

          <div>
            <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Truck size={16} className="text-gray-400" /> Resumen por cobrador
            </h2>
            {!summary?.rutas || summary.rutas.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center text-gray-500 text-sm">
                Sin sesiones registradas este día.
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Cobrador</th>
                      <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Efectivo</th>
                      <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Cheques</th>
                      <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Pagarés</th>
                      <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Diferencia</th>
                      <th className="text-center px-4 py-2 text-xs font-medium text-gray-500">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {summary.rutas.map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{r.cobrador_id}</td>
                        <td className="px-4 py-3 text-right">{formatPYG(r.efectivo)}</td>
                        <td className="px-4 py-3 text-right">{formatPYG(r.cheques)}</td>
                        <td className="px-4 py-3 text-right">{formatPYG(r.pagares)}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-500">—</td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs text-gray-400">{r.liquidation_id ? "liquidada" : "—"}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {retail && (
            <div>
              <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Building2 size={16} className="text-gray-400" /> Retail (cajas)
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3 bg-gray-50">
                  <p className="text-xs text-gray-500">Efectivo total</p>
                  <p className="font-bold">{formatPYG(retail.total_efectivo)}</p>
                </div>
                <div className="rounded-lg border p-3 bg-gray-50">
                  <p className="text-xs text-gray-500">Sesiones abiertas</p>
                  <p className="font-bold">{retail.session_count}</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {showDepositModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md space-y-4 p-5">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <DollarSign size={18} className="text-blue-600" /> Registrar depósito bancario
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Banco</label>
                <input
                  value={depositForm.bank_name}
                  onChange={e => setDepositForm(f => ({ ...f, bank_name: e.target.value }))}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej. Banco Continental"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">N° de cuenta</label>
                <input
                  value={depositForm.account_number}
                  onChange={e => setDepositForm(f => ({ ...f, account_number: e.target.value }))}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="001-001-001"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Efectivo (Gs)</label>
                  <input
                    type="number"
                    value={depositForm.monto_efectivo}
                    onChange={e => setDepositForm(f => ({ ...f, monto_efectivo: e.target.value }))}
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Cheques (Gs)</label>
                  <input
                    type="number"
                    value={depositForm.monto_cheques}
                    onChange={e => setDepositForm(f => ({ ...f, monto_cheques: e.target.value }))}
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowDepositModal(false)}
                className="flex-1 border rounded-lg py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeposit}
                disabled={depositing || !depositForm.bank_name || !depositForm.account_number}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {depositing && <Loader2 size={14} className="animate-spin" />}
                Registrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
