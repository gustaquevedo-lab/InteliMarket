# InteliMarket — reglas canónicas

## Montos en guaraníes (obligatorio)

- Gs. no tiene decimales. Todo precio, costo, total, cuota, comisión o conversión se redondea **hacia arriba**
  al entero **en el momento del cálculo** y se guarda el entero (no es formato de pantalla): 1567,7 → 1568;
  10 unidades = 15680, nunca 15677.
- Única excepción, el **IVA: al más próximo** (DNIT). 10% = total/11, 5% = total/21; base = total − IVA.
- Usar siempre `api/src/common/money.py` (`gs`, `iva_incluido`, `iva_sobre_neto`) en el backend y
  `ui-web/src/utils/money.ts` (`gs`, `ivaIncluido`) en el frontend. No redondear montos por cuenta propia:
  `api/tests/test_money.py` falla si aparece `ROUND_CEILING` o un IVA `/11` `/21` fuera de esos módulos.
- Las listas de precio guardan el **precio final con IVA, entero** (el que se cobra). La factura imprime el IVA
  guardado en la venta, no lo recalcula.
- Proveedores con decimales: las líneas de compra van enteras y la diferencia con la factura del proveedor
  queda en `purchase_orders.ajuste_redondeo` (el total registrado es el del proveedor).
