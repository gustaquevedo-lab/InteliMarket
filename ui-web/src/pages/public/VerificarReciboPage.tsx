import React, { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { CheckCircle2, AlertCircle, Loader2, Download, ShieldCheck, FileText, Calendar, Building2, User, CreditCard } from "lucide-react"

export default function VerificarReciboPage() {
  const { paymentId } = useParams<{ paymentId: string }>()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (!paymentId) {
      setError("Identificador de recibo no proporcionado.")
      setLoading(false)
      return
    }

    const fetchReceipt = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/v1/accounts-receivable/receipts/${paymentId}/verify`)
        if (!res.ok) {
          throw new Error("El recibo consultado no existe o no pudo ser verificado.")
        }
        const json = await res.json()
        setData(json)
      } catch (err: any) {
        setError(err.message || "Error al verificar el recibo.")
      } finally {
        setLoading(false)
      }
    }

    fetchReceipt()
  }, [paymentId])

  const formatPYG = (val: number) => {
    return `₲ ${Math.round(val || 0).toLocaleString("es-PY")}`
  }

  const handleDownloadPdf = async () => {
    if (!paymentId || !data) return
    try {
      setDownloading(true)
      // Usar el endpoint público o directo si existe
      const url = `/api/v1/accounts-receivable/receipts/${paymentId}/verify`
      window.print()
    } catch {
      alert("No se pudo iniciar la impresión del recibo.")
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-4" />
        <p className="text-sm text-slate-400 font-medium">Verificando autenticidad del recibo en línea...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800/80 border border-red-500/30 rounded-2xl p-6 text-center shadow-xl">
          <div className="w-14 h-14 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Comprobante No Válido</h2>
          <p className="text-xs text-slate-400 mb-6">{error || "No se encontró registro de este recibo de cobranza."}</p>
          <div className="text-[11px] text-slate-400 border-t border-slate-700/60 pt-4">
            GRUPO SANTA TERESA E.A.S. · Extra Supermercado Mayorista
          </div>
        </div>
      </div>
    )
  }

  const { cliente, empresa, allocations } = data

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8 flex justify-center">
      <div className="max-w-2xl w-full space-y-5">
        
        {/* Encabezado Institucional */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-md relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4 border-b border-slate-800 pb-5">
            <div className="flex items-center gap-3">
              <img src="/logo_extra.png" alt="Extra Supermercado" className="h-12 w-auto object-contain" onError={(e) => { (e.target as any).style.display = 'none' }} />
              <div>
                <h1 className="text-base font-extrabold text-white">{empresa.nombre_fantasia || "Extra Supermercado Mayorista"}</h1>
                <p className="text-xs text-slate-400">{empresa.razon_social || "GRUPO SANTA TERESA E.A.S."} · RUC: {empresa.ruc || "80150377-9"}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold tracking-wide uppercase">
              <ShieldCheck className="w-4 h-4" />
              <span>Verificado Oficial</span>
            </div>
          </div>

          {/* Badge y Monto Principal */}
          <div className="mt-5 text-center sm:text-left flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Recibo de Cobranza Oficial</span>
              <div className="text-xl font-mono font-black text-indigo-400 mt-0.5">{data.numero_recibo}</div>
              <div className="text-xs text-slate-400 flex items-center justify-center sm:justify-start gap-1.5 mt-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>{data.fecha_hora || data.fecha} (Hora Local PY)</span>
              </div>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-center sm:text-right">
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">Total Cobrado</span>
              <span className="text-2xl font-black font-mono text-emerald-400 tracking-tight">
                {formatPYG(data.monto_total)}
              </span>
            </div>
          </div>
        </div>

        {/* Tarjeta de Cliente y Forma de Pago */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2">
              <User className="w-4 h-4 text-indigo-400" />
              <span>Datos del Cliente</span>
            </div>
            <div className="text-sm font-bold text-white">{cliente.razon_social}</div>
            <div className="text-xs text-slate-400 space-y-1">
              <div><span className="text-slate-400">R.U.C. / C.I.:</span> <span className="text-slate-200 font-mono font-semibold">{cliente.ruc}</span></div>
              <div><span className="text-slate-400">Teléfono:</span> <span className="text-slate-200">{cliente.telefono}</span></div>
              {cliente.empresa_vinculada && (
                <div className="mt-2 pt-2 border-t border-slate-800/80">
                  <span className="text-slate-400">Empresa Vinculada:</span>{" "}
                  <span className="text-indigo-400 font-semibold">{cliente.empresa_vinculada}</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2">
              <CreditCard className="w-4 h-4 text-indigo-400" />
              <span>Detalles del Cobro</span>
            </div>
            <div className="text-xs text-slate-400 space-y-2">
              <div>
                <span className="text-slate-400 block text-[11px]">Forma de Pago:</span>
                <span className="text-sm font-bold text-white capitalize">{data.forma_pago.replace("_", " ")}</span>
              </div>
              {data.referencia && (
                <div>
                  <span className="text-slate-400 block text-[11px]">Comprobante / N° Referencia:</span>
                  <span className="text-xs font-mono text-slate-200 font-semibold">{data.referencia}</span>
                </div>
              )}
              {data.observaciones && (
                <div>
                  <span className="text-slate-400 block text-[11px]">Observaciones:</span>
                  <span className="text-xs text-slate-300 italic">{data.observaciones}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Facturas Imputadas */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>Documentos e Imputaciones ({allocations.length})</span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">Aplicado en Cascada (FIFO)</span>
          </div>

          <div className="space-y-2.5">
            {allocations.map((alloc: any, idx: number) => (
              <div key={idx} className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <div className="font-mono font-bold text-white text-sm">{alloc.numero_documento}</div>
                  <div className="text-slate-400 text-[11px] mt-0.5">
                    {alloc.fecha_vencimiento ? `Vencimiento: ${alloc.fecha_vencimiento}` : "Sin vencimiento fijo"} · Monto Original: {formatPYG(alloc.monto_original)}
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 border-slate-700 pt-2 sm:pt-0">
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] text-slate-400 block">Cobrado</span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">{formatPYG(alloc.monto_aplicado)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">Saldo Restante</span>
                    <span className="font-mono font-bold text-slate-300 text-sm">{formatPYG(alloc.saldo_pendiente)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer y Acciones */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="text-[11px] text-slate-400">
            Comprobante fiscal respaldado por el sistema de gestión Extra Supermercado.
          </div>
          <button
            onClick={handleDownloadPdf}
            className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
          >
            <Download className="w-4 h-4" />
            <span>Imprimir / Guardar Copia</span>
          </button>
        </div>

      </div>
    </div>
  )
}
