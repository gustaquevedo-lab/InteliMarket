import test from "node:test"
import assert from "node:assert/strict"
import {
  validarCierre,
  totalConfirmadoPyg,
  TOLERANCIA_PAGOS_PYG,
} from "../../src/pages/pos/validarCierre.ts"
import type { LineaCobro, ContextoCierre } from "../../src/pages/pos/validarCierre.ts"

const linea = (p: Partial<LineaCobro> & Pick<LineaCobro, "metodo" | "montoPyg">): LineaCobro => ({
  id: Math.random().toString(36).slice(2),
  estado: "confirmada",
  esExtra: false,
  ...p,
})
const ctx = (p: Partial<ContextoCierre> = {}): ContextoCierre => ({
  totalPyg: 100000,
  metodosActivos: ["cash", "bancard", "dinelco", "plugpay", "qr", "plugpay_credito", "extra_club", "otros"],
  ...p,
})

test("tolerancia es 50", () => assert.equal(TOLERANCIA_PAGOS_PYG, 50))

test("doble-Enter con tarjeta en curso no cierra", () => {
  const r = validarCierre([linea({ metodo: "bancard", montoPyg: 100000, estado: "en_curso" })], ctx())
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.codigo, "linea_sin_confirmar")
})

test("linea extra qr sin metodo qr activo se rechaza", () => {
  const r = validarCierre(
    [linea({ metodo: "qr", montoPyg: 100000, esExtra: true })],
    ctx({ metodosActivos: ["cash", "bancard"] }),
  )
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.codigo, "linea_extra_sin_metodo_activo")
})

test("monto cero se rechaza", () => {
  const r = validarCierre([linea({ metodo: "cash", montoPyg: 0 })], ctx())
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.codigo, "monto_invalido")
})

test("extra club sin saldo se rechaza", () => {
  const r = validarCierre(
    [linea({ metodo: "extra_club", montoPyg: 100000 })],
    ctx({ extraClub: { tieneLinea: true, saldoDisponible: 50000 } }),
  )
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.codigo, "extra_club_sin_saldo")
})

test("otros incompleto se rechaza", () => {
  const r = validarCierre([linea({ metodo: "otros", montoPyg: 100000 })], ctx({ otrosCompleto: false }))
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.codigo, "otros_incompleto")
})

test("efectivo con vuelto cierra", () => {
  assert.deepEqual(validarCierre([linea({ metodo: "cash", montoPyg: 120000 })], ctx()), { ok: true })
})

test("exceso con solo tarjetas no cierra", () => {
  const r = validarCierre([linea({ metodo: "bancard", montoPyg: 105000 })], ctx())
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.codigo, "suma_no_cuadra")
})

test("falta cobrar no cierra", () => {
  const r = validarCierre([linea({ metodo: "bancard", montoPyg: 99000 })], ctx())
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.codigo, "suma_no_cuadra")
})

test("borde de tolerancia", () => {
  assert.deepEqual(validarCierre([linea({ metodo: "bancard", montoPyg: 99950 })], ctx()), { ok: true })
  const r = validarCierre([linea({ metodo: "bancard", montoPyg: 99949 })], ctx())
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.codigo, "suma_no_cuadra")
})

test("suma de confirmadas, no de cargadas", () => {
  const r = validarCierre(
    [linea({ metodo: "cash", montoPyg: 60000 }), linea({ metodo: "bancard", montoPyg: 40000, estado: "en_curso" })],
    ctx(),
  )
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.codigo, "linea_sin_confirmar")
})

test("totalConfirmadoPyg ignora lineas en curso y sin cobrar", () => {
  const ls = [
    linea({ metodo: "cash", montoPyg: 10000 }),
    linea({ metodo: "bancard", montoPyg: 20000, estado: "confirmada" }),
    linea({ metodo: "qr", montoPyg: 30000, estado: "en_curso" }),
    linea({ metodo: "dinelco", montoPyg: 40000, estado: "sin_cobrar" }),
  ]
  assert.equal(totalConfirmadoPyg(ls), 30000)
})
