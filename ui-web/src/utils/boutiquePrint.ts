export function generatePedidoTicket(
  pedido: {
    numero: string
    fecha?: string
    customer_id?: string
    customer_data?: string
    items: Array<{ producto_id?: string; cantidad: number; precio_unitario: number; subtotal?: number; iva_tasa?: number }>
    total: number
    subtotal?: number
    total_iva?: number
    direccion_entrega?: string
    observaciones?: string
    intelientregas_delivery_id?: string
    sale_id?: string
    cdc?: string
    timbrado?: string
  },
  branchName: string = "InteliMarket",
  ruc?: string,
) {
  const now = new Date(pedido.fecha || Date.now()).toLocaleString("es-PY")
  const lines = pedido.items.map((i, idx) => {
    const precio = i.precio_unitario.toLocaleString("es-PY")
    const subtotal = (i.subtotal || i.cantidad * i.precio_unitario).toLocaleString("es-PY")
    return `<tr><td>${i.producto_id || idx + 1}</td><td align="right">${i.cantidad}</td><td align="right">${precio}</td><td align="right">${subtotal}</td></tr>`
  }).join("")

  // Tax breakdown
  let iva10 = 0, iva5 = 0, exenta = 0
  pedido.items.forEach((i) => {
    const sub = i.subtotal || i.cantidad * i.precio_unitario
    if (i.iva_tasa === 10) iva10 += sub
    else if (i.iva_tasa === 5) iva5 += sub
    else exenta += sub
  })

  const qrData = pedido.cdc
    ? `https://intelimarket.app/sifen/qr/${pedido.cdc}`
    : pedido.intelientregas_delivery_id
      ? `https://intelimarket.app/track/${pedido.intelientregas_delivery_id}`
      : `https://intelimarket.app/pedidos/${pedido.numero}`

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Pedido ${pedido.numero}</title>
<style>
  @page { margin: 0; }
  body { font-family: 'Courier New', monospace; font-size: 12px; width: 72mm; margin: 0 auto; padding: 6px; }
  .center { text-align: center; }
  .line { border-top: 1px dashed #000; margin: 3px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th { border-bottom: 1px solid #000; text-align: left; font-size: 9px; padding: 2px 0; }
  td { padding: 1px 0; }
  .total { font-size: 15px; font-weight: bold; }
  .mini { font-size: 8px; color: #555; }
</style></head><body>
<div class="center">
  <h2 style="margin:0;font-size:13px;">${branchName}</h2>
  ${ruc ? `<p style="margin:2px 0;font-size:9px;">RUC: ${ruc}</p>` : ""}
  <h3 style="margin:2px 0;font-size:11px;">PEDIDO / TICKET</h3>
  <p style="margin:2px 0;font-size:9px;">${now}</p>
</div>
<div class="line"></div>
<p style="margin:2px 0;">N°: <strong>${pedido.numero}</strong></p>
${pedido.customer_data ? `<p style="margin:2px 0;">Cliente: ${pedido.customer_data}</p>` : pedido.customer_id ? `<p style="margin:2px 0;">Cliente: ${pedido.customer_id}</p>` : ""}
${pedido.direccion_entrega ? `<p style="margin:2px 0;">Dirección: ${pedido.direccion_entrega}</p>` : ""}
${pedido.observaciones ? `<p style="margin:2px 0;" class="mini">Obs: ${pedido.observaciones}</p>` : ""}
<div class="line"></div>
<table>
  <tr><th>Producto</th><th align="right">Cant</th><th align="right">P.U.</th><th align="right">Subtotal</th></tr>
  ${lines}
</table>
<div class="line"></div>
<div style="font-size:10px;">
  ${iva10 > 0 ? `<p style="margin:1px 0;display:flex;justify-content:space-between;"><span>Gravada IVA 10%</span><span>Gs. ${iva10.toLocaleString("es-PY")}</span></p>` : ""}
  ${iva5 > 0 ? `<p style="margin:1px 0;display:flex;justify-content:space-between;"><span>Gravada IVA 5%</span><span>Gs. ${iva5.toLocaleString("es-PY")}</span></p>` : ""}
  ${exenta > 0 ? `<p style="margin:1px 0;display:flex;justify-content:space-between;"><span>Exenta</span><span>Gs. ${exenta.toLocaleString("es-PY")}</span></p>` : ""}
  ${pedido.total_iva != null && pedido.total_iva > 0 ? `<p style="margin:1px 0;display:flex;justify-content:space-between;"><span>IVA total</span><span>Gs. ${pedido.total_iva.toLocaleString("es-PY")}</span></p>` : ""}
</div>
<div class="line"></div>
<div class="center">
  <p class="total">TOTAL: Gs. ${pedido.total.toLocaleString("es-PY")}</p>
</div>
${pedido.cdc ? `
<div class="line"></div>
<div class="center" style="font-size:9px;">
  <p style="font-weight:bold;">FACTURA ELECTRÓNICA</p>
  <p>CDC: ${pedido.cdc}</p>
  ${pedido.timbrado ? `<p>Timbrado: ${pedido.timbrado}</p>` : ""}
</div>` : ""}
${pedido.intelientregas_delivery_id ? `
<div class="line"></div>
<div class="center">
  <p style="font-size:9px;font-weight:bold;">InteliEntregas</p>
  <p class="mini">Delivery: ${pedido.intelientregas_delivery_id}</p>
</div>` : ""}
<div class="line"></div>
<div class="center mini">
  <p>Entregá este código al delivery</p>
  <div style="word-break:break-all;margin:2px 0;">${qrData}</div>
  <p>InteliMarket ERP</p>
</div>
</body></html>`

  return {
    html,
    print: () => {
      const win = window.open("", "_blank", "width=350,height=600")
      if (win) {
        win.document.write(html)
        win.document.close()
        win.focus()
        win.print()
      }
    },
  }
}
