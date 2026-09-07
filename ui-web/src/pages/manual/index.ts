import type { ManualCategory } from "./types"
import { inicioCategory } from "./data/inicio"
import { ventasCategory } from "./data/ventas"
import { inventarioCategory } from "./data/inventario"
import { operacionesCategory } from "./data/operaciones"
import { abastecimientoCategory } from "./data/abastecimiento"
import { tesoreriaCategory } from "./data/tesoreria"
import { cuentasCategory } from "./data/cuentas"
import { crmCategory } from "./data/crm"
import { integracionesCategory } from "./data/integraciones"
import { sistemaCategory } from "./data/sistema"

export const MANUAL_CATEGORIES: ManualCategory[] = [
  inicioCategory,
  ventasCategory,
  inventarioCategory,
  operacionesCategory,
  abastecimientoCategory,
  tesoreriaCategory,
  cuentasCategory,
  crmCategory,
  integracionesCategory,
  sistemaCategory,
]

export const ALL_MANUAL_MODULES = MANUAL_CATEGORIES.flatMap((c) =>
  c.modules.map((m) => ({ ...m, categoryLabel: c.label }))
)

export * from "./types"