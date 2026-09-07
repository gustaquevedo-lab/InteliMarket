import { MonitorSmartphone, Receipt, FileSpreadsheet, Repeat, Users, BadgeDollarSign, LineChart, DollarSign, Store } from "lucide-react"
import type { ManualCategory } from "../types"

export const ventasCategory: ManualCategory = {
  id: "ventas",
  label: "Ventas",
  icon: Receipt,
  gradient: "from-emerald-600 to-teal-700",
  description: "Todo el ciclo de venta: el Punto de Venta (facturación), pedidos y cotizaciones, devoluciones, la cartera de clientes, precios y el benchmarking competitivo.",
  subtitle: "Del mostrador a la tienda online",
  modules: [
    {
      id: "pos",
      label: "Punto de Venta",
      path: "/pos",
      icon: MonitorSmartphone,
      tagline: "Factorar ventas rápido, sin perder un cliente",
      category: "Ventas",
      color: "emerald",
      description:
        "El Punto de Venta es el corazón operativo: factura en segundos, con catálogo virtual, teclado o lector de código de barras. Soporta efectivo, tarjeta/QR, transferencia, cuenta a crédito y cupón de descuento. Es la pantalla que usan las cajeras en cada caja.",
      tabs: [
        { id: "carrito", label: "Carrito" },
        { id: "pago", label: "Formas de pago" },
        { id: "extra", label: "Operaciones" },
      ],
      steps: [
        {
          title: "Arranque una venta",
          detail:
            "Al abrir el POS, busque el producto por nombre, código o escánelo con el lector. El producto se agrega al carrito con su precio. Puede modificar cantidades con los botones + / − o directamente.",
          mockKey: "carrito",
        },
        {
          title: "Identifique al cliente (opcional)",
          detail:
            "Si el cliente pertenece a ExtraClub o compra a crédito, selecciónelo para acumular puntos y registrar la cuenta. Si no, la venta es «mostrador» (consumidor final).",
        },
        {
          title: "Seleccione la forma de pago",
          detail:
            "Efectivo, Tarjeta o QR, Transferencia, Cuenta a Crédito, o Cupón. En efectivo el sistema calcula el vuelto automáticamente. Puede dividirse en varias formas de pago (ej: mitad efectivo, mitad tarjeta).",
          mockKey: "pago",
        },
        {
          title: "Cierre la venta",
          detail:
            "Confirme y el comprobante se factura. Según la configuración, se imprime el ticket (impresora térmica), se muestra en pantalla o se reenvía por WhatsApp. La venta aparece al instante en el Dashboard y en Facturación.",
        },
        {
          title: "Operaciones de cajero",
          detail:
            "Desde el POS también se puede: ver vuelto pendiente, abrir la gaveta, cierre parcial de caja, y consultar el último comprobante si el cliente lo pide de nuevo.",
          mockKey: "extra",
        },
      ],
      mocks: {
        carrito: {
          type: "pos",
          title: "Carrito de venta",
          caption: "Ejemplo con 3 productos y total a cobrar.",
        },
        pago: {
          type: "list",
          title: "Formas de pago disponibles",
          items: [
            { title: "Efectivo", sub: "Calcula el vuelto automáticamente. Suma Gs 10.000 / 20.000 / 50.000…", badge: "Rápido", badgeColor: "green" },
            { title: "Tarjeta o QR", sub: "POS Dinelco / Bancard / QR. Muestra el voucher al cliente.", badge: "Integrado", badgeColor: "blue" },
            { title: "Transferencia", sub: "Registra el comprobante de la transferencia bancaria.", badge: "Web", badgeColor: "purple" },
            { title: "Cuenta a Crédito", sub: "Carga a la cuenta del cliente. Solo si tiene habilitado el crédito.", badge: "Crédito", badgeColor: "amber" },
            { title: "Cupón de descuento", sub: "Aplica cupones del módulo de sorteos y promociones.", badge: "Promo", badgeColor: "red" },
          ],
        },
        extra: {
          type: "list",
          title: "Operaciones de caja",
          items: [
            { title: "Corte de caja parcial", sub: "Cuenta lo facturado y lo declarado en la caja.", badge: "Caja", badgeColor: "blue" },
            { title: "Vuelto pendiente", sub: "Sale de la gaveta sin necesidad de nueva venta.", badge: "Gaveta", badgeColor: "amber" },
            { title: "Reimprimir comprobante", sub: "Repite el último ticket emitido.", badge: "Ticket", badgeColor: "gray" },
            { title: "Ventas sin stock (alerta)", sub: "Avisa si el producto está por debajo del mínimo.", badge: "Stock", badgeColor: "red" },
          ],
        },
      },
      tips: [
        "Asigne teclas «rápidas» a los productos más vendidos para cobrar aún más rápido.",
        "El POS funciona también en tablets y el operador puede trabajar con botonera táctil.",
        "En efectivo, presione Enter para confirmar el pago exacto sin buscar el vuelto.",
      ],
      faq: [
        { q: "¿Cómo aplico un descuento puntual?", a: "En el carrito seleccione el producto y edite el precio o el descuento. Según sus permisos, los descuentos grandes pueden requerir habilitación del supervisor." },
        { q: "¿Puedo vender sin stock cargado?", a: "Sí, pero el sistema marca el aviso. La configuración de la sucursal determina si se permite o bloquea." },
        { q: "¿La venta queda registrada para la contabilidad?", a: "Sí, cada comprobante alimenta automáticamente Facturación, los libros de IVA y el módulo de medios de pago." },
      ],
    },
    {
      id: "sales",
      label: "Facturación",
      path: "/sales",
      icon: Receipt,
      tagline: "Comprobantes, cierres de caja y notas de crédito",
      category: "Ventas",
      color: "blue",
      description:
        "Centraliza todos los comprobantes emitidos: facturas, boletas y notas de crédito. Permite buscar, reimprimir, anular, ver el detalle de formas de pago y conciliar los cierres de caja por punto de emisión.",
      tabs: [
        { id: "comprobantes", label: "Comprobantes" },
        { id: "cierres", label: "Cierres de caja" },
        { id: "nc", label: "Notas de crédito" },
      ],
      steps: [
        {
          title: "Busque un comprobante",
          detail:
            "Filtre por fecha, punto de emisión, número de comprobante o nombre del cliente. El listado muestra el detalle: tipo (factura, boleta, NC), monto, forma de pago y estado (validado, pendiente, anulado).",
          mockKey: "comprobantes",
        },
        {
          title: "Vea el detalle y reimprima",
          detail:
            "Abra el comprobante para ver todos sus ítems, descuentos y la forma de pago. Desde aquí puede reimprimir el ticket o descargarlo en PDF.",
        },
        {
          title: "Gestione los cierres de caja",
          detail:
            "Cada caja cierra con su arqueo: se comparan los comprobantes emitidos y las formas de pago contra el efectivo declarado. Aquí se concilian los cortes de las cajeras.",
          mockKey: "cierres",
        },
        {
          title: "Emita notas de crédito",
          detail:
            "Ante devoluciones o errores de facturación, genere una nota de crédito que anula total o parcialmente un comprobante. Esto también se refleja en las cuentas del cliente.",
        },
      ],
      mocks: {
        comprobantes: {
          type: "table",
          title: "Comprobantes del día",
          columns: [
            { label: "Nº", value: "numero" },
            { label: "Fecha", value: "fecha" },
            { label: "Cliente", value: "cliente" },
            { label: "Total", value: "total", currency: true },
            { label: "Pago", value: "pago" },
            { label: "Estado", value: "estado", badge: true },
          ],
          rows: [
            { numero: "001-012-00014825", fecha: "07/09 14:02", cliente: "Mostrador", total: 128500, pago: "Efectivo", estado: "Validado", badge: "green" },
            { numero: "001-012-00014826", fecha: "07/09 14:10", cliente: "María L. Benítez", total: 45200, pago: "Tarjeta", estado: "Validado", badge: "green" },
            { numero: "001-012-00014827", fecha: "07/09 14:18", cliente: "Despensa El Centro S.A.", total: 1890000, pago: "Cuenta", estado: "Validado", badge: "green" },
            { numero: "001-012-00014828", fecha: "07/09 14:31", cliente: "Mostrador", total: 7800, pago: "Efectivo", estado: "Pendiente", badge: "amber" },
            { numero: "001-012-00014829", fecha: "07/09 14:40", cliente: "Juan Paredes", total: 96300, pago: "QR", estado: "Anulado", badge: "red" },
          ],
        },
        cierres: {
          type: "table",
          title: "Cierres de caja — Punto de emisión 001-011",
          columns: [
            { label: "Caja", value: "caja" },
            { label: "Cajera", value: "cajera" },
            { label: "Ventas", value: "ventas", currency: true },
            { label: "Efectivo", value: "efectivo", currency: true },
            { label: "Diferencia", value: "diferencia", badge: true },
          ],
          rows: [
            { caja: "CAJA 1", cajera: "Nilda Aquino", ventas: 24518000, efectivo: 24518000, diferencia: "0 ✓", badge: "green" },
            { caja: "CAJA 2", cajera: "Carmen Espínola", ventas: 21890000, efectivo: 21850000, diferencia: "−40.000", badge: "amber" },
            { caja: "CAJA 3", cajera: "Sonia Vera", ventas: 19740000, efectivo: 19740000, diferencia: "0 ✓", badge: "green" },
          ],
        },
      },
      tips: [
        "Filtre por «Anulados» para auditar por qué se deshizo cada venta.",
        "Las notas de crédito se descargan directamente a las cuentas de crédito del cliente.",
      ],
      faq: [
        { q: "¿Qué pasa si anulo un comprobante?", a: "Queda guardado con estado anulado, se libera el número para auditoría y se descuentan del cierre de caja correspondiente." },
      ],
    },
    {
      id: "pedidos",
      label: "Pedidos & Cotizaciones",
      path: "/sales-orders",
      icon: FileSpreadsheet,
      tagline: "Venta planificada: pedidos y presupuestos",
      category: "Ventas",
      color: "indigo",
      description:
        "Gestione pedidos de clientes (a crédito, con entrega o retiro) y cotizaciones que todavía no son ventas. Cada documento sigue un flujo de estado: borrador → aprobado → preparación → despacho → completado.",
      tabs: [
        { id: "pedidos", label: "Pedidos" },
        { id: "cotiz", label: "Cotizaciones" },
        { id: "estados", label: "Flujo de estados" },
      ],
      steps: [
        {
          title: "Cree un pedido nuevo",
          detail:
            "Seleccione el cliente, la prioridad (normal, alta, urgente) y agregue los productos. Si el cliente tiene crédito, puede elegir cuál vender (contado o cuenta). El pedido nace como borrador.",
          mockKey: "nuevo",
        },
        {
          title: "Apruebe y prepare",
          detail:
            "Con los permisos adecuados, apruebe el pedido. Pasa a «preparación» donde el depósito arma el bulto. Luego se asigna vehículo y repartidor para el despacho.",
          mockKey: "estados",
        },
        {
          title: "Despache y complete",
          detail:
            "Cuando el cliente recibe, el pedido se marca como completado. La venta queda facturada y, si era a crédito, la cobranza pasa a Cuentas por Cobrar.",
        },
        {
          title: "Cree una cotización",
          detail:
            "Para ventas que requieren presupuesto (ej: una empresa comprando por mayor), genere la cotización con validez, imprímala en PDF y envíela por WhatsApp. Si el cliente acepta, se convierte en pedido con un clic.",
        },
      ],
      mocks: {
        nuevo: {
          type: "form",
          title: "Nuevo pedido",
          formFields: [
            { label: "Cliente", type: "text", placeholder: "Buscar por nombre o RUC…", required: true },
            { label: "Prioridad", type: "select", value: "Normal", options: ["Normal", "Alta", "Urgente"] },
            { label: "Condición de venta", type: "select", value: "Contado", options: ["Contado", "Cuenta (crédito)"] },
            { label: "Fecha de entrega", type: "date", value: "2026-09-08" },
          ],
        },
        estados: {
          type: "workflow",
          title: "Flujo del pedido",
          caption: "Borrador → Aprobado → Preparación → Despacho → Completado",
        },
      },
      tips: [
        "Los pedidos urgentes se marcan en rojo en toda la cadena (preparación y despacho).",
        "Convierta una cotización aceptada en pedido para no tipear dos veces los ítems.",
      ],
      faq: [
        { q: "¿Puedo despachar un pedido a medias?", a: "Sí, el sistema permite entregas parciales o completar el pedido con los faltantes en una segunda remesa, manteniendo el seguimiento." },
      ],
    },
    {
      id: "returns",
      label: "Devoluciones & NC",
      path: "/returns",
      icon: Repeat,
      tagline: "Devoluciones de clientes sin papeles",
      category: "Ventas",
      color: "rose",
      description:
        "Registre devoluciones de mercadería con su motivo (producto en mal estado, vencido, error de facturación) y la condición del artículo. Genera la nota de crédito automáticamente y devuelve la mercadería al stock.",
      steps: [
        {
          title: "Abra la devolución",
          detail:
            "Busque el comprobante original o cree la devolución directa seleccionando el cliente y los productos devueltos.",
          mockKey: "form",
        },
        {
          title: "Indique motivo y condición",
          detail:
            "Motivos habituales: cambio de producto, producto dañado, vencimiento corto, error de caja. La condición (apto para reventa / a destruir / a devolver a proveedor) define el destino del stock.",
        },
        {
          title: "Confirme la nota de crédito",
          detail:
            "Al confirmar se genera automáticamente la NC que soporta la operación. Si el cliente pagó en efectivo, la caja devuelve el dinero y el corte lo refleja.",
          mockKey: "nc",
        },
      ],
      mocks: {
        form: {
          type: "form",
          title: "Nueva devolución",
          formFields: [
            { label: "Comprobante original", type: "text", placeholder: "001-012-00014825", required: true },
            { label: "Motivo", type: "select", value: "Producto en mal estado", options: ["Producto en mal estado", "Vencido", "Error de facturación", "Cambio de producto", "Cliente no conforme"] },
            { label: "Condición del artículo", type: "select", value: "A destruir", options: ["Apto para reventa", "A devolver a proveedor", "A destruir"] },
            { label: "Comentarios", type: "text", placeholder: "Detalle del problema…" },
          ],
        },
        nc: {
          type: "kpiGrid",
          title: "Generación automática de NC",
          kpis: [
            { label: "NC generada", value: "NC 001-013-0000042", sub: "automática al confirmar", color: "green" },
            { label: "Importe", value: "₲ 96.300", sub: "a favor del cliente", color: "blue" },
            { label: "Stock devuelto", value: "3 unidades", sub: "reen­terración automática", color: "purple" },
          ],
        },
      },
      faq: [
        { q: "¿Debo anular la factura para devolver?", a: "No. La devolución se apoya en una nota de crédito independiente, respetando la normativa DNIT. No se anula la factura original." },
      ],
    },
    {
      id: "customers",
      label: "Clientes",
      path: "/customers",
      icon: Users,
      tagline: "La cartera completa de clientes",
      category: "Ventas",
      color: "blue",
      description:
        "Administre la cartera de clientes: personas (física), empresas (jurídica), clientes con crédito habilitado y clientes inactivos. Cada ficha guarda datos, límites, saldos, historial y auditoría de modificaciones.",
      tabs: [
        { id: "todos", label: "Todos" },
        { id: "fisica", label: "Física" },
        { id: "juridica", label: "Jurídica" },
        { id: "credito", label: "Con crédito" },
        { id: "inactivos", label: "Inactivos" },
      ],
      steps: [
        {
          title: "Use las pestañas de clasificación",
          detail:
            "Los clientes se agrupan automáticamente: físicos, jurídicos, con crédito habilitado e inactivos. La vista predeterminada muestra todos con paginación de 25 por página.",
        },
        {
          title: "Cree o edite la ficha",
          detail:
            "Al crear, ingrese razón social/nombre, RUC o CI, teléfono, ciudad/barrio y la clasificación. La ficha incluye días de crédito, límite, condición de pago y datos de contacto.",
          mockKey: "ficha",
        },
        {
          title: "Consulte el 360 del cliente",
          detail:
            "Desde la ficha se abre el historial: compras, deuda, tickets, puntos ExtraClub. Esto es una vista previa del módulo Customer 360 que analiza el comportamiento completo.",
        },
        {
          title: "Mida riesgos",
          detail:
            "La columna de morosidad muestra días de atraso y saldo. Clientes vencidos se resaltan para decidir bloqueo de crédito o cobranza prioritaria.",
          mockKey: "lista",
        },
      ],
      mocks: {
        ficha: {
          type: "form",
          title: "Ficha de cliente",
          formFields: [
            { label: "Tipo", type: "select", value: "Persona Física", options: ["Persona Física", "Persona Jurídica"] },
            { label: "Nombre o Razón Social", type: "text", value: "María L. Benítez", required: true },
            { label: "RUC / CI", type: "text", value: "3.456.789-0" },
            { label: "Teléfono / WhatsApp", type: "text", value: "0985 123 456" },
            { label: "Días de crédito", type: "number", value: "30" },
            { label: "Límite de crédito", type: "text", value: "₲ 3.500.000" },
          ],
        },
        lista: {
          type: "table",
          title: "Clientes con deuda",
          columns: [
            { label: "Cliente", value: "nombre" },
            { label: "Saldo", value: "saldo", currency: true },
            { label: "Días atraso", value: "dias" },
            { label: "Estado", value: "estado", badge: true },
          ],
          rows: [
            { nombre: "Despensa El Centro", saldo: 12850000, dias: 15, estado: "Al día", badge: "green" },
            { nombre: "Supermercado Don Pedro", saldo: 45200000, dias: 32, estado: "Atrasado", badge: "amber" },
            { nombre: "Carnes S.A.", saldo: 9810000, dias: 68, estado: "Crítico", badge: "red" },
          ],
        },
      },
      tips: [
        "El buscador reconoce nombre, RUC o teléfono parcial.",
        "Cuando un cliente llega a su limite de crédito, el sistema avisa al facturar y puede bloquear la cuenta según la política.",
      ],
    },
    {
      id: "price-lists",
      label: "Listas de Precios",
      path: "/price-lists",
      icon: BadgeDollarSign,
      tagline: "Precios, márgenes, promociones y asignaciones",
      category: "Ventas",
      color: "amber",
      description:
        "Controla todos los precios de venta en un solo lugar: listas de precios por canal (mostrador, mayorista, tienda online), precios escalonados por cantidad, el editor de margen automático, y las asignaciones a clientes, grupos o zonas.",
      tabs: [
        { id: "dashboard", label: "Dashboard" },
        { id: "listas", label: "Listas" },
        { id: "items", label: "Precios por producto" },
        { id: "asignaciones", label: "Asignaciones" },
        { id: "margen", label: "Editor de margen" },
      ],
      steps: [
        {
          title: "Conozca las listas de precios",
          detail:
            "Cada canal puede tener su lista: Mostrador, Mayorista (a partir de X unidades), Tienda Online. Cuando un cliente tiene una lista asignada, el POS y la tienda la respetan automáticamente.",
          mockKey: "listas",
        },
        {
          title: "Edite el margen (Precios Inteligentes)",
          detail:
            "La pestaña «Editor de Margen» reemplaza a la antigua Gestión de Precios Inteligente: ajuste el margen de un producto, familia o listado completo y el sistema recalcula el precio de venta en lotes.",
        },
        {
          title: "Cree precios escalonados",
          detail:
            "Para premiar el volumen: 1 unidad ₲ 5.500, 6 unidades ₲ 5.200, 24 unidades ₲ 4.900. El POS aplica automáticamente el tramo según la cantidad del carrito.",
          mockKey: "tiers",
        },
        {
          title: "Asigne precios a clientes",
          detail:
            "Asigne una lista a un cliente, a un grupo (mayoristas, empresas) o a una zona (Centro, Ciudad del Este). La asignación define qué precio ve cada quien al comprar.",
        },
        {
          title: "Revise promociones vigentes",
          detail:
            "Las promociones (descuento por cantidad, 2x1, descuento directo) se aplican desde aquí y se reflejan en POS, tienda online y cupones.",
        },
      ],
      mocks: {
        listas: {
          type: "table",
          title: "Listas de precios",
          columns: [
            { label: "Lista", value: "nombre" },
            { label: "Canal", value: "canal" },
            { label: "Productos", value: "prod" },
            { label: "Margen prom.", value: "margen", badge: true },
            { label: "Estado", value: "estado", badge: true },
          ],
          rows: [
            { nombre: "Mostrador", canal: "POS", prod: 4850, margen: "28%", estado: "Activa", badges: { margen: "green", estado: "green" } },
            { nombre: "Mayorista", canal: "Pedidos", prod: 2410, margen: "14%", estado: "Activa", badges: { margen: "blue", estado: "green" } },
            { nombre: "Tienda Online", canal: "E-commerce", prod: 3200, margen: "25%", estado: "Activa", badges: { margen: "green", estado: "green" } },
          ],
        },
        tiers: {
          type: "table",
          title: "Precios escalonados — Coca-Cola 2.25L",
          columns: [
            { label: "Desde", value: "desde" },
            { label: "Precio unit.", value: "precio", currency: true },
            { label: "Descuento", value: "desc", badge: true },
          ],
          rows: [
            { desde: "1 unidad", precio: 9800, desc: "—", badge: "gray" },
            { desde: "6 unidades", precio: 9200, desc: "−6%", badge: "blue" },
            { desde: "24 unidades", precio: 8600, desc: "−12%", badge: "green" },
          ],
        },
      },
      tips: [
        "Use el editor de margen para re-preciar toda una familia en segundos, no producto por producto.",
        "Las promociones por cantidad se combinan con las listas: el sistema toma el menor precio válido.",
      ],
      faq: [
        { q: "¿Qué pasa si un cliente tiene lista asignada y compra online?", a: "La tienda online aplica la lista asignada automáticamente. Sin lista asignada, usa la lista predeterminada del canal." },
      ],
    },
    {
      id: "benchmarking",
      label: "Benchmarking Precios",
      path: "/benchmarking",
      icon: LineChart,
      tagline: "Compare sus precios con la competencia",
      category: "Ventas",
      color: "cyan",
      description:
        "Compare el precio de su canasta contra los competidores locales (Superseis, Fortis, Box, Real). Detecte oportunidades de margen y tome decisiones de precio informadas con relevamientos de campo.",
      steps: [
        {
          title: "Configure la canasta KPI",
          detail:
            "Defina los productos de referencia que comparará. La canasta suele incluir artículos de compra frecuente: arroz, aceite, harina, gaseosa, carne.",
          mockKey: "canasta",
        },
        {
          title: "Cargue o revise relevamientos",
          detail:
            "Un relevamiento es una visita a la competencia donde se anota el precio de cada producto de la canasta. El sistema calcula cuánto más barato o caro está usted frente a cada competidor.",
        },
        {
          title: "Explote oportunidades de margen",
          detail:
            "Si un competidor vende un producto X% más caro, usted tiene espacio para subir su precio manteniéndose competitivo, o para anunciar «precio bajo garantizado» y ganar tráfico.",
          mockKey: "oportunidades",
        },
      ],
      mocks: {
        canasta: {
          type: "table",
          title: "Canasta KPI vs competencia",
          columns: [
            { label: "Producto", value: "producto" },
            { label: "Nuestro", value: "nuestro", currency: true },
            { label: "Superseis", value: "superseis", currency: true },
            { label: "Fortis", value: "fortis", currency: true },
            { label: "Dif. vs mejor", value: "dif", badge: true },
          ],
          rows: [
            { producto: "Arroz Tipo 1 5kg", nuestro: 28500, superseis: 28900, fortis: 28300, dif: "+0.7%", badge: "green" },
            { producto: "Aceite 900ml", nuestro: 15400, superseis: 15200, fortis: 15900, dif: "−1.3%", badge: "amber" },
            { producto: "Coca-Cola 2.25L", nuestro: 9800, superseis: 10300, fortis: 10000, dif: "−4.8%", badge: "red" },
          ],
        },
        oportunidades: {
          type: "list",
          title: "Oportunidades de margen",
          items: [
            { title: "Coca-Cola 2.25L", sub: "Estamos 4.8% más baratos que el mejor competidor — evaluar subir ₲ 300.", badge: "+₲ 0,9M/año", badgeColor: "green" },
            { title: "Harina 0000 1kg", sub: "Superseis está 6% arriba. Hay espacio para re-marginar.", badge: "Oportunidad", badgeColor: "blue" },
          ],
        },
      },
      faq: [
        { q: "¿Con qué competidores comparo?", a: "Los predeterminados son Superseis, Fortis, Real y Box. Puede agregar o quitar competidores según su área comercial." },
      ],
    },
    {
      id: "commissions",
      label: "Comisiones",
      path: "/commissions",
      icon: DollarSign,
      tagline: "Vendedores cobran por lo que venden",
      category: "Ventas",
      color: "lime",
      description:
        "Configure las reglas de comisión para los vendedores de la empresa (porcentaje sobre total, sobre margen, o montos fijos por producto) y liquide lo que cada uno genera.",
      steps: [
        {
          title: "Cree la regla de comisión",
          detail:
            "Defina el tipo: porcentaje sobre el total de la venta, porcentaje sobre el margen bruto, o monto fijo. Ahóndalo en qué aplicación (venta, cobranza) y a qué vendedores aplica.",
          mockKey: "regla",
        },
        {
          title: "Vea el resumen por vendedor",
          detail:
            "El módulo agrupa las ventas de cada vendedor y calcula su comisión automáticamente según las reglas vigentes, discriminando por período.",
          mockKey: "resumen",
        },
        {
          title: "Liquide y pase a nómina",
          detail:
            "Las comisiones calculadas quedan listas para liquidar y enviarse al módulo de sueldos.",
        },
      ],
      mocks: {
        regla: {
          type: "form",
          title: "Nueva regla de comisión",
          formFields: [
            { label: "Vendedor", type: "select", value: "Todos los vendedores", options: ["Todos los vendedores", "Vendedor por vendedor"] },
            { label: "Tipo", type: "select", value: "Porcentaje", options: ["Porcentaje", "Monto fijo"] },
            { label: "Aplica a", type: "select", value: "Total de la venta", options: ["Total de la venta", "Margen bruto", "Cobranza"] },
            { label: "Porcentaje", type: "number", value: "1.5%" },
          ],
        },
        resumen: {
          type: "table",
          title: "Comisiones del mes",
          columns: [
            { label: "Vendedor", value: "vendedor" },
            { label: "Ventas", value: "ventas", currency: true },
            { label: "Comisión", value: "comision", currency: true },
            { label: "Estado", value: "estado", badge: true },
          ],
          rows: [
            { vendedor: "Carlos Marecos", ventas: 85200000, comision: 1278000, estado: "Pendiente", badge: "amber" },
            { vendedor: "Luis Cardozo", ventas: 64100000, comision: 961500, estado: "Pendiente", badge: "amber" },
            { vendedor: "Rosa Fleitas", ventas: 50300000, comision: 754500, estado: "Liquidada", badge: "green" },
          ],
        },
      },
    },
    {
      id: "tienda",
      label: "Tienda Online",
      path: "/tienda",
      icon: Store,
      tagline: "El supermercado abierto 24/7",
      category: "Ventas",
      color: "purple",
      description:
        "La tienda online pública del supermercado. El cliente navega el catálogo, arma su carrito, elige delivery o retiro, y paga online (Bancard, QR, transferencia) o contra entrega. Usted gestiona pedidos, stock y precios a distancia.",
      tabs: [
        { id: "catalogo", label: "Catálogo" },
        { id: "checkout", label: "Checkout" },
        { id: "pedidos", label: "Pedidos y estado" },
      ],
      steps: [
        {
          title: "El cliente navega el catálogo",
          detail:
            "La tienda muestra productos con foto, precio y disponibilidad. El stock se sincroniza en tiempo real con el inventario: si no hay, no se ofrece.",
        },
        {
          title: "Armado del carrito y checkout",
          detail:
            "El cliente elige cantidad, método de entrega (envío a domicilio o retiro en tienda) y forma de pago: tarjeta Bancard, QR / Pix, transferencia, o pago al recibir (efectivo o POS). Descuentos de listas y cupones se aplican automáticamente.",
          mockKey: "checkout",
        },
        {
          title: "Gestione el pedido",
          detail:
            "Desde el panel del pedido, el supermercado prepara, despacha y marca el estado: recibido → en preparación → en camino → entregado. El cliente sigue el estado desde su cuenta.",
          mockKey: "pedido",
        },
      ],
      mocks: {
        checkout: {
          type: "list",
          title: "Métodos de pago de la tienda online",
          items: [
            { title: "Tarjeta (Bancard)", sub: "Dirección segura con transacción verificada. Voucher digital.", badge: "Tarjeta", badgeColor: "blue" },
            { title: "QR / Pix", sub: "Pago con QR desde la app del banco.", badge: "QR", badgeColor: "purple" },
            { title: "Transferencia", sub: "El cliente sube el comprobante al finalizar.", badge: "Bancaria", badgeColor: "gray" },
            { title: "Contra entrega", sub: "Efectivo o POS en el momento de la entrega.", badge: "A domicilio", badgeColor: "green" },
          ],
        },
        pedido: {
          type: "table",
          title: "Pedidos web del día",
          columns: [
            { label: "Nº", value: "numero" },
            { label: "Cliente", value: "cliente" },
            { label: "Entrega", value: "entrega" },
            { label: "Total", value: "total", currency: true },
            { label: "Estado", value: "estado", badge: true },
          ],
          rows: [
            { numero: "WEB-1042", cliente: "Pedro Ruiz", entrega: "Delivery", total: 182500, estado: "En preparación", badge: "blue" },
            { numero: "WEB-1043", cliente: "Ana Benítez", entrega: "Retiro en tienda", total: 76300, estado: "En camino", badge: "purple" },
            { numero: "WEB-1044", cliente: "Carlos Giménez", entrega: "Delivery", total: 245900, estado: "Entregado", badge: "green" },
          ],
        },
      },
      tips: [
        "Los precios de la tienda usan la lista «Tienda Online» — sepárelos del mostrador si quiere.",
        "Los cupones de sorteo también redimen en la web: un cliente puede pagar promo con cupón.",
      ],
      faq: [
        { q: "¿Cómo se integra el pago contra entrega con el POS?", a: "Cuando la venta llega contra entrega, se carga al pedido y se cobra físicamente. El repartidor puede marcar el pago desde la app del conductor." },
      ],
    },
  ],
}