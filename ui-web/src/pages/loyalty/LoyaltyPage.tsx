import { useState } from "react"
import CrmPage from "../crm/CrmPage"
import TarjetasSocioPage from "./TarjetasSocioPage"

// Fidelidad ya estaba en el menu mostrando el CRM. Las tarjetas se suman como
// pestaña en vez de como entrada nueva del menu, porque el menu se arma desde
// la configuracion del tenant en la base, no desde el codigo. La pestaña por
// defecto sigue siendo el CRM: quien entraba antes ve lo mismo que antes.
export default function LoyaltyPage() {
  const [tab, setTab] = useState<"crm" | "tarjetas">(() =>
    new URLSearchParams(window.location.search).get("tab") === "tarjetas" ? "tarjetas" : "crm",
  )
  const pestaña = (id: "crm" | "tarjetas", label: string) => (
    <button
      onClick={() => setTab(id)}
      className={`px-4 py-2 text-sm font-bold border-b-2 cursor-pointer ${
        tab === id
          ? "border-amber-500 text-slate-900 dark:text-white"
          : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
      }`}
    >
      {label}
    </button>
  )
  return (
    <div>
      <div className="flex gap-1 px-4 sm:px-6 border-b border-slate-200 dark:border-slate-800">
        {pestaña("crm", "Clientes y campañas")}
        {pestaña("tarjetas", "Tarjetas Extra Club")}
      </div>
      {tab === "crm" ? <CrmPage /> : <TarjetasSocioPage />}
    </div>
  )
}
