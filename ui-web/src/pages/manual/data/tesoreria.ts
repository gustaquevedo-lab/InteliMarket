import { Banknote, Landmark, CreditCard } from "lucide-react"
import type { ManualCategory } from "../types"

export const tesoreriaCategory: ManualCategory = {
  id: "tesoreria",
  label: "Finanzas & Tesorería",
  icon: Banknote,
  gradient: "from-amber-600 to-orange-700",
  description: "La plata del negocio de punta a punta: caja, bóveda, bancos y cheques. Control total del efectivo, la custodia y los medios de cobro.",
  subtitle: "Control total del efectivo y las cuentas",
  modules: [
    {
      id: "caja",
      label: "Arqueo de Caja",
      path: "/caja",
      icon: Banknote,
      tagline: "Cierres, cortes y arqueos de las cajeras",
      category: "Finanzas & Tesorería",
      color: "amber",
      description:
        "Gestiona la operación de cada caja: apertura, movimientos del turno, arqueo de cierre (efectivo real vs sistema), pagos de clientes y corte final. Incluye el ranking de cajeros solidarios (donaciones).",
      steps: [
        {
          title: "Abra la caja",
          detail: "El cajero abre sesión con su usuario y el fondo de arranque (ej: ₲ 2.000.000 en billetes). La sesión queda asociada a su punto de emisión.",
        },
        {
          title: "Registre movimientos",
          detail: "Durante el turno: pagos de clientes, retiros a bóveda (cuando la caja se llena), ingresos y la donación del cajero solidario.",
          mockKey: "movimientos",
        },
        {
          title: "Cierre el arqueo",
          detail: "Al cierre, el cajero cuenta el efectivo real y el sistema lo compara contra lo facturado. Las diferencias se cuadran con su motivo.",
          mockKey: "arqueo",
        },
        {
          title: "Revise el ranking solidario",
          detail: "El módulo Cajero Solidario suma las donaciones redondeadas de cada caja: quién recaudó más, con qué monto y qué liquidez se entregó.",
        },
      ],
      mocks: {
        movimientos: {
          type: "table",
          title: "Movimientos de la caja",
          columns: [
            { label: "Hora", value: "hora" },
            { label: "Tipo", value: "tipo" },
            { label: "Detalle", value: "detalle" },
            { label: "Monto", value: "monto", currency: true },
          ],
          rows: [
            { hora: "07:00", tipo: "Apertura", detalle: "Fondo inicial", monto: 2000000 },
            { hora: "11:30", tipo: "Retiro", detalle: "Remesa a bóveda", monto: -8500000 },
            { hora: "13:00", tipo: "Ingreso", detalle: "Pago cuenta a crédito", monto: 1250000 },
            { hora: "19:45", tipo: "Donación", detalle: "Cajero solidario", monto: -38400 },
          ],
        },
        arqueo: {
          type: "kpiGrid",
          title: "Cierre de caja",
          kpis: [
            { label: "Efectivo según sistema", value: "₲ 18.540.000", color: "blue" },
            { label: "Efectivo contado", value: "₲ 18.500.000", color: "amber" },
            { label: "Diferencia", value: "−₲ 40.000", sub: "faltante a analizar", color: "red", trend: "down" },
            { label: "Resultado del turno", value: "CAJA 2", sub: "8 horas · 412 tickets", color: "green" },
          ],
        },
      },
      tips: [
        "Analice el faltante el mismo día: el tiempo borra la memoria de qué pudo pasar.",
        "Retire efectivo a bóveda cuando supere el umbral configurado: reduce robo y errores de caja.",
      ],
      faq: [
        { q: "¿Puedo abrir la caja de nuevo el mismo día?", a: "Sí, con aperturas múltiples. Cada apertura mantiene su propio arqueo de cierre." },
      ],
    },
    {
      id: "boveda",
      label: "Bóveda Central",
      path: "/boveda",
      icon: Landmark,
      tagline: "La custodia del efectivo del negocio",
      category: "Finanzas & Tesorería",
      color: "amber",
      description:
        "La bóveda es el punto central de custodia: recibe las remesas de las cajas, administra remesas a bancos, concilia el calce de efectivo y genera informes de movimientos.",
      steps: [
        {
          title: "Reciba las remesas de caja",
          detail: "Las cajas envían su efectivo a bóveda en remesas. La bóveda verifica el sobre, registra y actualiza el fondo de custodia.",
          mockKey: "custodia",
        },
        {
          title: "Emita remesas a bancos",
          detail: "Cuando la custodia supera el límite, se arma una remesa al banco: se registra el depósito y el movimiento bancario.",
        },
        {
          title: "Vea el calce",
          detail: "El calce compara lo que hay en bóveda vs lo que las cajas deberían haber enviado: detecta faltantes en la cadena de custodia.",
          mockKey: "calce",
        },
        {
          title: "Exporte movimientos",
          detail: "Los movimientos de bóveda se exportan a PDF o Excel para la conciliación y la auditoría.",
        },
      ],
      mocks: {
        custodia: {
          type: "kpiGrid",
          title: "Estado de custodia",
          kpis: [
            { label: "En bóveda hoy", value: "₲ 96.400.000", sub: "5 remesas recibidas", color: "green", trend: "up" },
            { label: "Remesas hoy", value: "5", sub: "desde 4 cajas", color: "blue" },
            { label: "Límite de custodia", value: "₲ 80.000.000", sub: "superado → remesa al banco", color: "amber" },
            { label: "En tránsito al banco", value: "₲ 35.200.000", sub: "1 remesa", color: "purple" },
          ],
        },
        calce: {
          type: "table",
          title: "Calce por caja",
          columns: [
            { label: "Caja", value: "caja" },
            { label: "Debió enviar", value: "debio", currency: true },
            { label: "Recibido", value: "recibido", currency: true },
            { label: "Diferencia", value: "dif", badge: true },
          ],
          rows: [
            { caja: "CAJA 1", debio: 24500000, recibido: 24500000, dif: "0 ✓", badge: "green" },
            { caja: "CAJA 2", debio: 21890000, recibido: 21850000, dif: "−40.000", badge: "red" },
            { caja: "CAJA 3", debio: 19740000, recibido: 19740000, dif: "0 ✓", badge: "green" },
          ],
        },
      },
      faq: [
        { q: "¿Quién puede operar la bóveda?", a: "Solo usuarios con rol de tesorería o bóveda. Cada movimiento registra quién lo hizo y se audita." },
      ],
    },
    {
      id: "bancos",
      label: "Cuentas Bancarias",
      path: "/bancos",
      icon: Landmark,
      tagline: "Posición bancaria y conciliación",
      category: "Finanzas & Tesorería",
      color: "blue",
      description:
        "Consolida las cuentas bancarias de la empresa: saldos, movimientos, conciliación bancaria y el flujo entre bancos. Los movimientos se clasifican (depósitos, pagos, cheques) para alimentar la gestión financiera.",
      steps: [
        {
          title: "Vea la posición bancaria",
          detail: "La posición consolida los saldos de todas las cuentas y su evolución en el período.",
          mockKey: "posicion",
        },
        {
          title: "Concilie movimientos",
          detail: "La conciliación compara los movimientos del banco contra los del sistema: el pareo sugiere coincidencias y marca pendientes.",
          mockKey: "conciliacion",
        },
        {
          title: "Clasifique y analice",
          detail: "Los movimientos se clasifican (liquidación de tarjeta, pago a proveedor, depósito de caja) para el flujo de caja.",
        },
      ],
      mocks: {
        posicion: {
          type: "kpiGrid",
          title: "Posición bancaria",
          kpis: [
            { label: "Banco Continental", value: "₲ 218.500.000", sub: "cta. corriente", color: "green" },
            { label: "Itaú", value: "₲ 96.200.000", sub: "cta. corriente", color: "blue" },
            { label: "Visión", value: "₲ 54.800.000", sub: "cta. ahorro", color: "purple" },
            { label: "Total disponible", value: "₲ 369.500.000", sub: "3 cuentas", color: "green", trend: "up" },
          ],
        },
        conciliacion: {
          type: "table",
          title: "Conciliación del mes",
          columns: [
            { label: "Fecha", value: "fecha" },
            { label: "Descripción", value: "descripcion" },
            { label: "Banco", value: "banco", currency: true },
            { label: "Sistema", value: "sistema", currency: true },
            { label: "Estado", value: "estado", badge: true },
          ],
          rows: [
            { fecha: "01/09", descripcion: "Depósito caja 01", banco: 24500000, sistema: 24500000, estado: "Conciliado", badge: "green" },
            { fecha: "03/09", descripcion: "Pago proveedor", banco: -8750000, sistema: -8750000, estado: "Conciliado", badge: "green" },
            { fecha: "05/09", descripcion: "Liquidación tarjeta", banco: 32100000, sistema: 31500000, estado: "Revisar", badge: "amber" },
            { fecha: "06/09", descripcion: "Comisión bancaria", banco: -185000, sistema: 0, estado: "Pendiente", badge: "red" },
          ],
        },
      },
      faq: [
        { q: "¿Puedo importar el extracto del banco?", a: "Sí, el extracto se importa (Excel/CSV) y se concilia automáticamente contra los movimientos del sistema." },
      ],
    },
    {
      id: "cheques",
      label: "Gestión de Cheques",
      path: "/cheques",
      icon: CreditCard,
      tagline: "Cartera de cheques recibidos y emitidos",
      category: "Finanzas & Tesorería",
      color: "indigo",
      description:
        "Gestione los cheques del negocio: recibidos de clientes (en cartera, depositados, cobrados, rechazados) y emitidos a proveedores, con el detalle de los bancos paraguayos.",
      steps: [
        {
          title: "Registre el cheque recibido",
          detail: "Un cliente paga con cheque: cargue número, banco, monto, fecha de pago y fecha de cobro. El cheque entra a cartera.",
          mockKey: "cartera",
        },
        {
          title: "Deposite y cobre",
          detail: "Al depositarlo pasa a «depositado»; al cobrar, a «cobrado». El dinero reflejado en el banco concilia automáticamente.",
        },
        {
          title: "Maneje los rechazados",
          detail: "Los cheques rechazados (sin fondos, endoso) se marcan para cobranza y generan alerta al cliente con el saldo pendiente.",
          mockKey: "rechazados",
        },
      ],
      mocks: {
        cartera: {
          type: "table",
          title: "Cheques en cartera",
          columns: [
            { label: "Nº cheque", value: "numero" },
            { label: "Banco", value: "banco" },
            { label: "Cliente", value: "cliente" },
            { label: "Monto", value: "monto", currency: true },
            { label: "Fecha cobro", value: "fecha" },
          ],
          rows: [
            { numero: "2581147", banco: "Continental", cliente: "Despensa Don Pedro", monto: 8500000, fecha: "12/09/2026" },
            { numero: "9931204", banco: "Itaú", cliente: "Minimarket ABC", monto: 4200000, fecha: "15/09/2026" },
            { numero: "4410877", banco: "Visión", cliente: "Almacenes Norte", monto: 11800000, fecha: "20/09/2026" },
          ],
        },
        rechazados: {
          type: "list",
          title: "Cheques rechazados",
          items: [
            { title: "Nº 7741201 — Itaú — ₲ 3.200.000", sub: "Motivo: fondos insuficientes · cliente: Mi Casa", badge: "Rechazado", badgeColor: "red" },
            { title: "Nº 8900112 — Continental — ₲ 5.500.000", sub: "Motivo: firma no coincide", badge: "Rechazado", badgeColor: "red" },
          ],
        },
      },
      tips: [
        "Solicite siempre un segundo cheque de garantía para cheques a fecha larga.",
        "Los cheques rechazados pasan automáticamente a la deuda del cliente.",
      ],
    },
  ],
}