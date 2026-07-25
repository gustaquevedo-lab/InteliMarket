import { useState } from "react"
import { Banknote, ShieldAlert, ArrowUpRight, ArrowDownLeft, ShieldCheck, History, Users, RefreshCw, Send, Plus } from "lucide-react"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"

interface BovedaTrans {
  id: string
  tipo: "Ingreso" | "Egreso" | "Retiro Blindado"
  monto: number
  cajera: string
  cajaNumero: string
  fecha: string
  hora: string
  estado: "Confirmado" | "Pendiente"
  bolsaSeguridad?: string
}

const INITIAL_TRANS: BovedaTrans[] = [
  {
    id: "TRX-101",
    tipo: "Ingreso",
    monto: 3000000,
    cajera: "Alicia Gimenez",
    cajaNumero: "Caja 01",
    fecha: "2026-05-27",
    hora: "10:15",
    estado: "Confirmado"
  },
  {
    id: "TRX-102",
    tipo: "Ingreso",
    monto: 2500000,
    cajera: "Pedro Rolon",
    cajaNumero: "Caja 03",
    fecha: "2026-05-27",
    hora: "11:30",
    estado: "Confirmado"
  },
  {
    id: "TRX-103",
    tipo: "Retiro Blindado",
    monto: 15000000,
    cajera: "Supervisor Central",
    cajaNumero: "Bóveda Principal",
    fecha: "2026-05-27",
    hora: "12:00",
    estado: "Confirmado",
    bolsaSeguridad: "BAG-889901-PY"
  },
  {
    id: "TRX-104",
    tipo: "Ingreso",
    monto: 3500000,
    cajera: "Alicia Gimenez",
    cajaNumero: "Caja 01",
    fecha: "2026-05-27",
    hora: "13:45",
    estado: "Confirmado"
  }
]

export default function BovedaPage() {
  const [bovedaBalance, setBovedaBalance] = useState(48500000) // ~48.5M Gs.
  const [transactions, setTransactions] = useState<BovedaTrans[]>(INITIAL_TRANS)
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [showBlindadoModal, setShowBlindadoModal] = useState(false)
  const toast = useToast()

  // Form states
  const [depositCajera, setDepositCajera] = useState("Alicia Gimenez")
  const [depositCaja, setDepositCaja] = useState("Caja 01")
  const [depositMonto, setDepositMonto] = useState("")

  const [blindadoMonto, setBlindadoMonto] = useState("")
  const [blindadoBolsa, setBlindadoBolsa] = useState("")
  const [blindadoTransportadora, setBlindadoTransportadora] = useState("Prosegur")

  const handleCreateDeposit = (e: React.FormEvent) => {
    e.preventDefault()
    const amount = parseFloat(depositMonto)
    if (!amount || amount <= 0) {
      toast.error("Monto Inválido", "Por favor ingresa un monto válido.")
      return
    }

    const newTx: BovedaTrans = {
      id: `TRX-${100 + transactions.length + 1}`,
      tipo: "Ingreso",
      monto: amount,
      cajera: depositCajera,
      cajaNumero: depositCaja,
      fecha: new Date().toISOString().split("T")[0],
      hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      estado: "Confirmado"
    }

    setTransactions([newTx, ...transactions])
    setBovedaBalance(prev => prev + amount)
    setShowDepositModal(false)
    setDepositMonto("")
    toast.success("Depósito Confirmado", `Se ingresaron ${formatPYG(amount)} a Bóveda.`)
  }

  const handleCreateBlindado = (e: React.FormEvent) => {
    e.preventDefault()
    const amount = parseFloat(blindadoMonto)
    if (!amount || amount <= 0) {
      toast.error("Monto Inválido", "Por favor ingresa un monto válido.")
      return
    }
    if (amount > bovedaBalance) {
      toast.error("Fondos Insuficientes", "El monto de retiro supera los fondos en bóveda.")
      return
    }
    if (!blindadoBolsa.trim()) {
      toast.error("Bolsa Requerida", "Debes ingresar el precinto/código de la bolsa de seguridad.")
      return
    }

    const newTx: BovedaTrans = {
      id: `TRX-${100 + transactions.length + 1}`,
      tipo: "Retiro Blindado",
      monto: amount,
      cajera: `Remesa a ${blindadoTransportadora}`,
      cajaNumero: "Bóveda Principal",
      fecha: new Date().toISOString().split("T")[0],
      hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      estado: "Confirmado",
      bolsaSeguridad: blindadoBolsa
    }

    setTransactions([newTx, ...transactions])
    setBovedaBalance(prev => prev - amount)
    setShowBlindadoModal(false)
    setBlindadoMonto("")
    setBlindadoBolsa("")
    toast.success("Despacho Exitoso", `Remesa de ${formatPYG(amount)} transferida a ${blindadoTransportadora}.`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Banknote className="w-6 h-6 text-green-500" />
            Gestión de Bóveda & Depósitos (Vault & Cash Drop)
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Tesorería centralizada: custodia de efectivo total de cajas rápidas y despachos a transportadoras de caudales.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowDepositModal(true)} className="btn-outline flex items-center gap-2">
            <ArrowDownLeft className="w-4 h-4 text-green-500" /> Registrar Drop Cash
          </button>
          <button onClick={() => setShowBlindadoModal(true)} className="btn-primary flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4 text-white" /> Despacho Blindado
          </button>
        </div>
      </div>

      {/* Caja Fuerte Principal Balance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6 bg-gradient-to-br from-green-900/10 to-slate-900 border border-green-500/20 md:col-span-2 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-green-400 font-black uppercase tracking-wider block">Saldo Disponible en Bóveda</span>
            <p className="text-4xl font-extrabold text-white font-mono mt-2">{formatPYG(bovedaBalance)}</p>
            <div className="flex items-center gap-2 mt-3 text-xs text-green-400 font-semibold bg-green-500/10 py-1 px-3 rounded-full w-max">
              <ShieldCheck className="w-4 h-4" /> Bóveda Asegurada & Blindada
            </div>
          </div>
          <Banknote className="w-20 h-20 text-green-500/20 hidden sm:block" />
        </div>

        <div className="card p-6 space-y-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-amber-500" /> Alertas de Caja POS
          </h3>
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-xl text-xs space-y-1">
            <p className="font-bold">Caja 01 supera límite</p>
            <p className="text-gray-500 dark:text-gray-400">Efectivo actual: {formatPYG(3450000)} (Excede límite de 3M Gs).</p>
            <button 
              onClick={() => {
                setDepositCajera("Alicia Gimenez")
                setDepositCaja("Caja 01")
                setDepositMonto("3000000")
                setShowDepositModal(true)
              }} 
              className="mt-2 text-amber-500 hover:text-amber-600 font-bold block underline"
            >
              Registrar retiro parcial ahora
            </button>
          </div>
        </div>
      </div>

      {/* Historial de transacciones de bóveda */}
      <div className="card p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-md font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <History className="w-5 h-5 text-primary" /> Historial de Movimientos de Tesorería
          </h3>
          <button onClick={() => toast.info("Historial Actualizado", "Bóveda sincronizada con arqueo.")} className="text-gray-400 hover:text-gray-200">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="table-cell">Código / Precinto</th>
                <th className="table-cell">Operación / Tipo</th>
                <th className="table-cell">Origen/Destino</th>
                <th className="table-cell">Cajera/Supervisor</th>
                <th className="table-cell">Fecha / Hora</th>
                <th className="table-cell text-right">Monto</th>
                <th className="table-cell">Estado</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} className="table-row">
                  <td className="table-td font-mono font-bold text-xs text-primary">{tx.id}</td>
                  <td className="table-td font-semibold">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                      tx.tipo === "Ingreso" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    }`}>
                      {tx.tipo}
                    </span>
                  </td>
                  <td className="table-td font-medium">{tx.cajaNumero}</td>
                  <td className="table-td text-gray-600 dark:text-gray-300">{tx.cajera}</td>
                  <td className="table-td text-xs text-gray-400">{tx.fecha} &middot; {tx.hora}</td>
                  <td className={`table-td text-right font-mono font-bold ${tx.tipo === "Ingreso" ? "text-green-600" : "text-red-500"}`}>
                    {tx.tipo === "Ingreso" ? "+" : "-"}{formatPYG(tx.monto)}
                  </td>
                  <td className="table-td">
                    <span className="inline-flex items-center gap-1 bg-green-500/10 text-green-500 rounded-full px-2 py-0.5 text-[10px] font-bold">
                      <ShieldCheck className="w-3.5 h-3.5" /> {tx.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Drop Cash */}
      {showDepositModal && (
        <div className="modal-overlay" onClick={() => setShowDepositModal(false)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Registrar Drop Cash / Retiro de Caja</h3>
              <form onSubmit={handleCreateDeposit} className="space-y-4">
                <div>
                  <label className="input-label label-required">Cajera de POS</label>
                  <select className="input-field" value={depositCajera} onChange={e => setDepositCajera(e.target.value)}>
                    <option value="Alicia Gimenez">Alicia Gimenez</option>
                    <option value="Pedro Rolon">Pedro Rolon</option>
                    <option value="Laura Estigarribia">Laura Estigarribia</option>
                  </select>
                </div>
                <div>
                  <label className="input-label label-required">Origen Caja</label>
                  <select className="input-field" value={depositCaja} onChange={e => setDepositCaja(e.target.value)}>
                    <option value="Caja 01">Caja 01 - Caja Rápida</option>
                    <option value="Caja 02">Caja 02 - Central</option>
                    <option value="Caja 03">Caja 03 - Autoservicio</option>
                  </select>
                </div>
                <div>
                  <label className="input-label label-required">Monto a Retirar (Guaraníes)</label>
                  <input type="number" className="input-field" placeholder="3000000" value={depositMonto} onChange={e => setDepositMonto(e.target.value)} required />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" className="btn-outline flex-1" onClick={() => setShowDepositModal(false)}>Cancelar</button>
                  <button type="submit" className="btn-primary flex-1">Confirmar Ingreso</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Despacho Blindado */}
      {showBlindadoModal && (
        <div className="modal-overlay" onClick={() => setShowBlindadoModal(false)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Despachar Remesa a Blindado</h3>
              <form onSubmit={handleCreateBlindado} className="space-y-4">
                <div>
                  <label className="input-label label-required">Transportadora de Caudales</label>
                  <select className="input-field" value={blindadoTransportadora} onChange={e => setBlindadoTransportadora(e.target.value)}>
                    <option value="Prosegur">Prosegur Paraguay</option>
                    <option value="Yrendague">Yrendague S.A.</option>
                    <option value="Mbarete Seguros">Mbarete Seguros</option>
                  </select>
                </div>
                <div>
                  <label className="input-label label-required">Precinto / Bolsa de Seguridad</label>
                  <input type="text" className="input-field" placeholder="BAG-7788-PY" value={blindadoBolsa} onChange={e => setBlindadoBolsa(e.target.value)} required />
                </div>
                <div>
                  <label className="input-label label-required">Monto a Enviar (Guaraníes)</label>
                  <input type="number" className="input-field" placeholder="15000000" value={blindadoMonto} onChange={e => setBlindadoMonto(e.target.value)} required />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" className="btn-outline flex-1" onClick={() => setShowBlindadoModal(false)}>Cancelar</button>
                  <button type="submit" className="btn-primary flex-1">Despachar Remesa</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
