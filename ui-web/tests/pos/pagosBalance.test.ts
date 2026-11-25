import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularTotalCubiertoPyg,
  calcularRestoParaMetodo,
  type PagosEstado,
} from '../../src/pages/pos/pagosBalance.ts';

test('calcula total cubierto solo con efectivo en guaranies', () => {
  const pagos: PagosEstado = { payCashPyg: 50000 };
  assert.equal(calcularTotalCubiertoPyg(pagos), 50000);
});

test('calcula total cubierto con divisas extranjeras usando cotizacion', () => {
  const pagos: PagosEstado = {
    payCashPyg: 10000,
    payCashBrl: 20,
    rateBrl: 1400,
    payCashUsd: 5,
    rateUsd: 7500,
  };
  // 10000 + (20 * 1400 = 28000) + (5 * 7500 = 37500) = 75500
  assert.equal(calcularTotalCubiertoPyg(pagos), 75500);
});

test('calcula total cubierto con multiples metodos no efectivo', () => {
  const pagos: PagosEstado = {
    payCashPyg: 20000,
    mixedCardPyg: 30000,
    mixedDinelcoPyg: 25000,
    mixedQrPyg: 15000,
    mixedPlugPayPyg: 10000,
    mixedExtraClubPyg: 5000,
    mixedOtrosPyg: 5000,
  };
  assert.equal(calcularTotalCubiertoPyg(pagos), 110000);
});

test('incluye tarjetas adicionales (extraPaymentLegs) en total cubierto', () => {
  const pagos: PagosEstado = {
    mixedCardPyg: 40000,
    extraCards: [
      { montoPyg: 20000 },
      { montoPyg: 15000 },
    ],
  };
  assert.equal(calcularTotalCubiertoPyg(pagos), 75000);
});

test('calcularRestoParaMetodo calcula el faltante exacto para efectivo', () => {
  const pagos: PagosEstado = {
    payCashPyg: 100000, // monto previo que sera reemplazado
    mixedCardPyg: 40000,
    mixedDinelcoPyg: 30000,
  };
  const totalVenta = 100000;
  // Los otros suman 70000, por lo que el resto para efectivo debe ser 30000
  const resto = calcularRestoParaMetodo('payCashPyg', totalVenta, pagos);
  assert.equal(resto, 30000);
});

test('calcularRestoParaMetodo calcula el faltante exacto para una tarjeta', () => {
  const pagos: PagosEstado = {
    payCashPyg: 25000,
    mixedCardPyg: 0,
    mixedDinelcoPyg: 30000,
  };
  const totalVenta = 100000;
  // Los otros suman 55000 (efectivo 25000 + dinelco 30000). Resto = 45000
  const resto = calcularRestoParaMetodo('mixedCardPyg', totalVenta, pagos);
  assert.equal(resto, 45000);
});

test('calcularRestoParaMetodo para tarjeta extra segun su indice', () => {
  const pagos: PagosEstado = {
    payCashPyg: 20000,
    mixedCardPyg: 30000,
    extraCards: [
      { montoPyg: 10000 },
      { montoPyg: 0 }, // target index 1
    ],
  };
  const totalVenta = 80000;
  // Otros: 20000 + 30000 + 10000 = 60000. Resto = 20000
  const resto = calcularRestoParaMetodo('extraCard_1', totalVenta, pagos);
  assert.equal(resto, 20000);
});

test('calcularRestoParaMetodo devuelve 0 si ya esta cubierto o superado', () => {
  const pagos: PagosEstado = {
    mixedCardPyg: 120000,
  };
  const totalVenta = 100000;
  const resto = calcularRestoParaMetodo('payCashPyg', totalVenta, pagos);
  assert.equal(resto, 0);
});

test('sanitiza valores invalidos como NaN, undefined o negativos tratandolos como 0', () => {
  const pagos: PagosEstado = {
    payCashPyg: -5000 as unknown as number,
    mixedCardPyg: NaN,
    mixedDinelcoPyg: undefined as unknown as number,
    extraCards: [{ montoPyg: NaN }, { montoPyg: 15000 }],
  };
  assert.equal(calcularTotalCubiertoPyg(pagos), 15000);
});
