# REGLAS ESTRICTAS DE ARQUEO, FONDOS Y CIERRE DE CAJA
## Extra Supermercado Mayorista — Grupo Santa Teresa E.A.S.

> [!IMPORTANT]
> Este documento define la **LÓGICA INMUTABLE DE NEGOCIO** para el arqueo físico, fondos de gaveta, conciliación de ventas y cierre de turno de caja. Debe respetarse sin excepciones en el frontend, backend, reportes PDF y tickets térmicos de impresión.

---

### 1. La Venta es Exclusivamente en Guaraníes (PYG)
- El supermercado **NO vende en moneda extranjera**. Todos los precios de productos, totales de tickets y facturas se emiten al 100% en Guaraníes (PYG).
- La moneda extranjera (Reales brasileños R$, Dólares estadounidenses US$) **se acepta únicamente como medio de pago**.
- Al recibir un pago en moneda extranjera, el monto en divisa se registra al tipo de cambio de la sesión y se entrega el vuelto correspondiente.

---

### 2. Fondo Inicial de Apertura Bimonetario (Separado por Moneda)
- Toda cajera regular (no supervisora) inicia su turno recibiendo un **Fondo de Gaveta Bimonetario** para cambio/vuelto:
  - **Fondo Inicial en Guaraníes:** Típicamente `Gs. 500.000` (en billetes y monedas).
  - **Fondo Inicial en Reales:** Típicamente `R$ 300,00` (en billetes y monedas para vuelto en reales).
- **Regla de presentación:** En el informe de caja y en la pantalla, el fondo **NUNCA se unifica ni se convierte a una sola bola de dinero**. La cajera debe ver:
  - `Fondo Inicial Gs.: Gs. 500.000`
  - `Fondo Inicial R$:  R$ 300,00`
  *(Tal cual ingresó al abrir su caja).*
- Las supervisoras o administradoras abren turno sin fondo inicial (`Gs. 0` y `R$ 0,00`).

---

### 3. Total Efectivo Esperado en Gaveta
Para la conciliación, el concepto contable indica que se espera **Efectivo Físico** (desglosado en las monedas recibidas), el cual resulta de la diferencia entre el total vendido y los pagos cobrados mediante medios electrónicos o no efectivo.

#### A. En Guaraníes (PYG):
```text
Ventas Netas en Efectivo Gs. = Total Facturado - Total Cobros No Efectivo
                              (Bancard, Dinelco, QR, PIX, Extra Club, SIPAP, Cheques)
                              (Incluyendo pagos mixtos: la porción cobrada en efectivo es la que cuenta).

Total Efectivo Esperado Gs.   = Devolución Fondo Inicial Gs. (ej. 500.000) 
                              + Ventas Netas en Efectivo Gs. 
                              - Retiros Parciales Confirmados (Cash Drops)
```

#### B. En Reales (BRL):
```text
Total Esperado R$ = Devolución Fondo Inicial R$ (ej. 300,00) 
                  + Recaudación en Efectivo Reales por Cobros en R$
```
- **El fondo de R$ 300,00 para vuelto es un esperado:** la cajera debe devolver como mínimo el fondo en R$ que se le entregó al abrir, más lo que haya cobrado en reales.

---

### 4. Arqueo Real Físico en Gaveta (Dinero Contado)
Al finalizar el turno, la cajera realiza el conteo físico de todo el dinero presente en su gaveta:
1. **Guaraníes (PYG):** Billetes y monedas = **(DEVOLUCIÓN DE FONDO + Recaudación en Gs)**.
2. **Reales (BRL):** Billetes y monedas = **(DEVOLUCIÓN DE FONDO + Recaudación en R$)**.
3. **Dólares (USD):** Billetes = **Recaudación en US$** (si hubo clientes que pagaron en dólares).

---

### 5. Cotejo de Comprobantes de Pago No Efectivo
El arqueo real se complementa corroborando físicamente la existencia, cantidad y pertinencia de cada comprobante que respalda las ventas no cobradas en efectivo:
- **Lotes de Vouchers POS Bancard** (débito / crédito).
- **Lotes de Vouchers POS Dinelco** (débito / crédito).
- **Comprobantes de Cobro QR** (Bancard / Dinelco).
- **Comprobantes de Cobro PIX** (Plug Pay).
- **Vales y Cupones firmados de Extra Club** (Créditos a clientes con convenio).
- **Boletas de Transferencia Bancaria SIPAP** confirmadas.
- **Cheques físicos** en custodia en gaveta.

---

### 6. Conciliación y Determinación de la Diferencia
1. El informe desglosa:
   - **Fondos de Apertura:** `Gs. 500.000` y `R$ 300,00` (por separado).
   - **Ventas Totales Cobradas:** desglosadas por canal (Efectivo PYG, Efectivo BRL, Bancard, Dinelco, QR, PIX, Extra Club, Cheques, etc.).
   - **Esperado en Gaveta:**
     - Esperado Guaraníes: `Gs. [Fondo Gs. + Ventas Efectivo Gs. - Drops]`
     - Esperado Reales: `R$ [Fondo R$ + Cobros R$]`
   - **Contado Físico en Gaveta:**
     - Contado Guaraníes: `Gs. [Billetes y monedas contados]`
     - Contado Reales: `R$ [Billetes y monedas contados]`
     - Contado Dólares: `US$ [Billetes contados]`
2. **Compensación de Vueltos Multimoneda:**
   - Cuando un cliente paga en Reales o Dólares, el vuelto con frecuencia se entrega en Guaraníes (o viceversa).
   - Por tanto, cualquier excedente en Reales o Dólares se compensa contra el efectivo en Guaraníes utilizando la cotización pactada de la sesión.
3. **Diferencia Final:**
   - Se halla entre lo **Esperado** y lo **Recaudado Efectivamente**.
   - Se dictamina el estado de caja:
     - `CUADRADO` (diferencia dentro de tolerancia).
     - `SOBRANTE` (ingresó más dinero del esperado).
     - `FALTANTE` (falta dinero para cubrir las ventas y el fondo).
