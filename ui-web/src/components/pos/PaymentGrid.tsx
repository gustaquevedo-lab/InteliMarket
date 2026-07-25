import { Banknote, CreditCard, Send, Wallet, Link, QrCode, Divide, Loader2 } from "lucide-react"

interface PaymentMethod {
  id: string
  nombre: string
  icono: "efectivo" | "tarjeta" | "transferencia" | "credito" | "pagopar" | "kuapay" | "bancard" | "qr_bcp" | "dividir"
  badge?: string
  disabled?: boolean
}

interface PaymentGridProps {
  methods: PaymentMethod[]
  onSelect: (methodId: string) => void
  loading?: boolean
  condicion?: "contado" | "credito"
}

const iconMap: Record<string, React.ReactNode> = {
  efectivo: <Banknote className="w-5 h-5 text-green-600" />,
  tarjeta: <CreditCard className="w-5 h-5 text-blue-600" />,
  transferencia: <Send className="w-5 h-5 text-purple-600" />,
  credito: <Wallet className="w-5 h-5 text-indigo-600" />,
  pagopar: <Link className="w-5 h-5 text-orange-600" />,
  kuapay: <QrCode className="w-5 h-5 text-teal-600" />,
  bancard: <CreditCard className="w-5 h-5 text-red-600" />,
  qr_bcp: <QrCode className="w-5 h-5 text-cyan-600" />,
  dividir: <Divide className="w-5 h-5 text-gray-600" />,
}

const colorMap: Record<string, { bg: string; hover: string; text: string }> = {
  efectivo: { bg: "bg-green-50 dark:bg-green-900/20", hover: "hover:bg-green-100 dark:hover:bg-green-900/40", text: "text-green-600" },
  tarjeta: { bg: "bg-blue-50 dark:bg-blue-900/20", hover: "hover:bg-blue-100 dark:hover:bg-blue-900/40", text: "text-blue-600" },
  transferencia: { bg: "bg-purple-50 dark:bg-purple-900/20", hover: "hover:bg-purple-100 dark:hover:bg-purple-900/40", text: "text-purple-600" },
  credito: { bg: "bg-indigo-50 dark:bg-indigo-900/20", hover: "hover:bg-indigo-100 dark:hover:bg-indigo-900/40", text: "text-indigo-600" },
  pagopar: { bg: "bg-orange-50 dark:bg-orange-900/20", hover: "hover:bg-orange-100 dark:hover:bg-orange-900/40", text: "text-orange-600" },
  kuapay: { bg: "bg-teal-50 dark:bg-teal-900/20", hover: "hover:bg-teal-100 dark:hover:bg-teal-900/40", text: "text-teal-600" },
  bancard: { bg: "bg-red-50 dark:bg-red-900/20", hover: "hover:bg-red-100 dark:hover:bg-red-900/40", text: "text-red-600" },
  qr_bcp: { bg: "bg-cyan-50 dark:bg-cyan-900/20", hover: "hover:bg-cyan-100 dark:hover:bg-cyan-900/40", text: "text-cyan-600" },
  dividir: { bg: "bg-gray-50 dark:bg-gray-800", hover: "hover:bg-gray-100 dark:hover:bg-gray-700", text: "text-gray-600" },
}

export default function PaymentGrid({ methods, onSelect, loading, condicion }: PaymentGridProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {methods.map((method) => {
        const colors = colorMap[method.icono] || colorMap.dividir
        const icon = iconMap[method.icono] || <CreditCard className="w-5 h-5 text-gray-600" />
        const isDisabled = method.disabled || loading

        return (
          <button
            key={method.id}
            onClick={() => onSelect(method.id)}
            disabled={isDisabled}
            className={`flex flex-col items-center gap-1 p-3 rounded-xl ${colors.bg} ${colors.hover} transition-colors relative ${
              isDisabled ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : icon}
            <span className={`text-xs font-bold ${colors.text}`}>{method.nombre}</span>
            {method.badge && (
              <span className="absolute -top-1.5 -right-1.5 bg-primary text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                {method.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
