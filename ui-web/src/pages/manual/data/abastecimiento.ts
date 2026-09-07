import { ShoppingBag, Tags, TrendingUp, Truck, Briefcase, Globe } from "lucide-react"
import type { ManualCategory } from "../types"

export const abastecimientoCategory: ManualCategory = {
  id: "abastecimiento",
  label: "Abastecimiento",
  icon: ShoppingBag,
  gradient: "from-sky-600 to-blue-700",
  description: "Del pedido de compra a la góndola: gestión de compras multicanal, etiquetas, forecast de reposición, recepción DSD y la relación con proveedores.",
  subtitle: "La mercadería correcta, en el momento correcto",
  modules: [
    {
      id: "purchases",
      label: "Gestión de Compras",
      path: "/purchases",
      icon: ShoppingBag,
      tagline: "El ciclo completo de compra a proveedores",
      category: "Abastecimiento",
      color: "sky",
      description:
        "La central de abastecimiento: desde la demanda de clientes y el asistente IA hasta la orden de compra, la recepción (con mermas), la factura del proveedor, el matching a 3 vías y las devoluciones.",
      tabs: [
        { id: "ia", label: "Asistente IA" },
        { id: "po", label: "Órdenes de compra" },
        { id: "recepcion", label: "Recepción" },
        { id: "facturas", label: "Facturas P2P" },
        { id: "matching", label: "Matching 3 vías" },
      ],
      steps: [
        {
          title: "Use el asistente IA de compras",
          detail:
            "El asistente propone qué comprar según forecast de demanda, stock actual y días de cobertura: por producto, por proveedor o por categoría. Revise las sugerencias y genere las órdenes con un clic.",
          mockKey: "ia",
        },
        {
          title: "Cree la orden de compra",
          detail:
            "La PO nace del asistente, de una demanda de cliente o manualmente. Incluye proveedor, precio acordado, condiciones y fecha de entrega. El estado recorre: borrador → enviada → recibida → facturada.",
          mockKey: "po",
        },
        {
          title: "Reciba la mercadería",
          detail:
            "Al llegar la mercadería, la recepción verifica unidades y controla averías/mermas. Las diferencias se registran: el proveedor recibe nota de crédito o se ajusta la PO.",
          mockKey: "recepcion",
        },
        {
          title: "Matchee la factura (3 vías)",
          detail:
            "El matching compara la factura del proveedor contra la PO y la recepción: cantidades iguales, precios iguales. Las diferencias se resuelven antes de habilitar el pago, evitando pagar de más.",
          mockKey: "matching",
        },
        {
          title: "Gestione devoluciones al proveedor",
          detail:
            "Productos defectuosos o fuera de condición se devuelven generando la nota de crédito al proveedor y la reentrada del stock.",
        },
      ],
      mocks: {
        ia: {
          type: "table",
          title: "Sugerencias del asistente IA",
          columns: [
            { label: "Producto", value: "producto" },
            { label: "Stock", value: "stock" },
            { label: "Cobertura", value: "cobertura" },
            { label: "Sugerido", value: "sugerido" },
            { label: "Proveedor", value: "proveedor" },
          ],
          rows: [
            { producto: "Leche larga vida 1L", stock: 258, cobertura: "8 días", sugerido: "600 un", proveedor: "La Lactea" },
            { producto: "Fideo tallarín 500g", stock: 22, cobertura: "3 días", sugerido: "480 un", proveedor: "Fideos Pasta Real" },
            { producto: "Queso Paraguay x kg", stock: 21, cobertura: "4 días", sugerido: "80 kg", proveedor: "Chortitzer" },
          ],
        },
        po: {
          type: "table",
          title: "Órdenes de compra activas",
          columns: [
            { label: "Nº", value: "numero" },
            { label: "Proveedor", value: "proveedor" },
            { label: "Total", value: "total", currency: true },
            { label: "Entrega", value: "entrega" },
            { label: "Estado", value: "estado", badge: true },
          ],
          rows: [
            { numero: "PO-1001", proveedor: "Coca Cola Paresa", total: 15840000, entrega: "08/09", estado: "Enviada", badge: "blue" },
            { numero: "PO-1002", proveedor: "Frigorífico Concepción", total: 22350000, entrega: "07/09", estado: "Recibida", badge: "green" },
            { numero: "PO-1003", proveedor: "Abasto Central", total: 9870000, entrega: "10/09", estado: "Borrador", badge: "gray" },
          ],
        },
        recepcion: {
          type: "table",
          title: "Recepción — PO-1002",
          columns: [
            { label: "Producto", value: "producto" },
            { label: "Pedido", value: "pedido" },
            { label: "Recibido", value: "recibido" },
            { label: "Avería", value: "averia", badge: true },
          ],
          rows: [
            { producto: "Vacio x kg", pedido: 120, recibido: 118, averia: "2 kg", badge: "red" },
            { producto: "Costilla x kg", pedido: 90, recibido: 90, averia: "0", badge: "green" },
            { producto: "Pollo entero", pedido: 60, recibido: 58, averia: "2 un", badge: "red" },
          ],
        },
        matching: {
          type: "list",
          title: "Matching de factura",
          items: [
            { title: "Factura 001-004-0001122 — Frigorífico", sub: "PO-1002 · 3 ítems conciliados · sin diferencias", badge: "OK", badgeColor: "green" },
            { title: "Factura 001-002-0008891 — La Lactea", sub: "PO-1004 · Diferencia de ₲ 1.250: revisar precio", badge: "Revisar", badgeColor: "amber" },
            { title: "Factura 003-001-0003321 — Abasto", sub: "PO-1003 · Diferencia de 4 unidades", badge: "Revisar", badgeColor: "red" },
          ],
        },
      },
      tips: [
        "El asistente IA prioriza productos con cobertura < 10 días y puntos de rotación.",
        "Exporte las POs a Excel para enviarlas por mail o WhatsApp al proveedor.",
        "El matching impide pagar facturas con diferencias sin autorización.",
      ],
      faq: [
        { q: "¿Qué es el matching a 3 vías?", a: "Compara orden de compra, recepción y factura del proveedor. Solo cuando las tres coinciden, la factura queda «conciliada» y lista para pagar." },
      ],
    },
    {
      id: "labels",
      label: "Etiquetas",
      path: "/etiquetas",
      icon: Tags,
      tagline: "Imprima etiquetas y códigos de barras",
      category: "Abastecimiento",
      color: "orange",
      description:
        "Genere e imprima etiquetas de producto: códigos de barras CODE128, precios, fechas de vencimiento y datos de la mercadería. Diseñado para impresoras térmicas (Zebra, Pantum) usadas en el depósito y el salón.",
      steps: [
        {
          title: "Seleccione producto(s)",
          detail:
            "Elija un producto o una categoría completa. El sistema lista las etiquetas que se imprimirán con nombre, código, precio y vencimiento.",
          mockKey: "seleccion",
        },
        {
          title: "Configure la impresora",
          detail:
            "Seleccione el modelo (Zebra ZD-220, Pantum PT-D160) y el tamaño de etiqueta. La utilidad de impresión se comunica con la impresora de red o USB.",
        },
        {
          title: "Imprima",
          detail:
            "Pulse imprimir: las etiquetas salen con el código de barras escaneable en caja. Útil para góndola, prepack de carnicería y mercadería suelta.",
          mockKey: "etiqueta",
        },
      ],
      mocks: {
        seleccion: {
          type: "table",
          title: "Etiquetas a imprimir",
          columns: [
            { label: "Producto", value: "producto" },
            { label: "Precio", value: "precio", currency: true },
            { label: "Cant.", value: "cant" },
            { label: "Código", value: "codigo" },
          ],
          rows: [
            { producto: "Milanesa (prepack)", precio: 72000, cant: 20, codigo: "7793000456789" },
            { producto: "Vacio x kg", precio: 69000, cant: 30, codigo: "7793000456783" },
            { producto: "Queso Paraguay x kg", precio: 16900, cant: 15, codigo: "7793000456780" },
          ],
        },
        etiqueta: {
          type: "recibo",
          title: "Vista previa de etiqueta",
          caption: "Impresión térmica 40x30 con código CODE128 escaneable en caja.",
        },
      },
      tips: [
        "Las etiquetas de banda (prepack) con precio impreso agilizan la caja: el cajero escanea y cobra directo.",
      ],
    },
    {
      id: "forecast",
      label: "Forecast & Reposición",
      path: "/demand-forecast",
      icon: TrendingUp,
      tagline: "Prediga la demanda y evite el quiebre de stock",
      category: "Abastecimiento",
      color: "purple",
      description:
        "El motor de forecast estadístico (suavizado exponencial, media móvil, descomposición estacional) predice la demanda de cada producto, calcula el stock de seguridad y genera sugerencias de compra con lead time.",
      tabs: [
        { id: "forecast", label: "Forecast" },
        { id: "picos", label: "Picos semanales" },
        { id: "sugerencias", label: "Sugerencias" },
        { id: "quiebres", label: "Quiebres" },
        { id: "formulas", label: "Fórmulas" },
      ],
      steps: [
        {
          title: "Vea el forecast por producto",
          detail:
            "Cada producto muestra: venta promedio diaria, forecast a 7 días, stock de seguridad y estado (crítico, alerta, normal). Los críticos necesitan compra urgente.",
          mockKey: "forecast",
        },
        {
          title: "Analice los picos semanales",
          detail:
            "La demanda varia por día: el sistema aprende los picos (ej: carnicería +75% los viernes, verdulería +45% miércoles, sábado pico máximo 2.1x). Use este conocimiento para ordenar las reposiciones.",
          mockKey: "picos",
        },
        {
          title: "Aplique las sugerencias de compra",
          detail:
            "Las sugerencias proponen cantidad a comprar considerando lead time del proveedor, stock actual y stock de seguridad. Se exportan directo a la orden de compra.",
          mockKey: "sugerencias",
        },
        {
          title: "Evalúe las fórmulas",
          detail:
            "La pestaña de fórmulas explica cómo se calculan: suavizado exponencial con nivel + tendencia, stock de seguridad = venta diaria × lead time + margen, y los umbrales de alerta.",
        },
      ],
      mocks: {
        forecast: {
          type: "table",
          title: "Forecast a 7 días",
          columns: [
            { label: "Producto", value: "producto" },
            { label: "Venta prom. día", value: "vpd" },
            { label: "Forecast 7d", value: "f7" },
            { label: "Stock seg.", value: "ss" },
            { label: "Estado", value: "estado", badge: true },
          ],
          rows: [
            { producto: "Carne vacío", vpd: "41 kg", f7: "287 kg", ss: "90 kg", estado: "CRÍTICO", badge: "red" },
            { producto: "Leche larga vida 1L", vpd: 34, f7: 248, ss: 100, estado: "Alerta", badge: "amber" },
            { producto: "Fideo tallarín 500g", vpd: 12, f7: 89, ss: 40, estado: "Alerta", badge: "amber" },
            { producto: "Coca-Cola 2.25L", vpd: 95, f7: 712, ss: 260, estado: "Normal", badge: "green" },
            { producto: "Arroz Tipo 1 5kg", vpd: 51, f7: 383, ss: 150, estado: "Normal", badge: "green" },
          ],
        },
        picos: {
          type: "chart",
          title: "Factor de demanda por día de la semana",
          chart: {
            kind: "bar",
            unit: "x",
            points: [
              { label: "Lun", value: 0.75 },
              { label: "Mar", value: 0.8 },
              { label: "Mié", value: 1.0 },
              { label: "Jue", value: 1.1 },
              { label: "Vie", value: 1.75 },
              { label: "Sáb", value: 2.1 },
              { label: "Dom", value: 1.35 },
            ],
          },
        },
        sugerencias: {
          type: "list",
          title: "Sugerencias de compra",
          items: [
            { title: "Carne vacío — 120 kg", sub: "Lead time 1d · stock 21kg · cobertura 1 día", badge: "Urgente", badgeColor: "red" },
            { title: "Leche larga vida — 480 un", sub: "Lead time 2d · stock 258 · cobertura 8 días", badge: "Programar", badgeColor: "amber" },
            { title: "Coca-Cola 2.25L — 360 un", sub: "Lead time 3d · stock 890 · cobertura 12 días", badge: "Normal", badgeColor: "green" },
          ],
        },
      },
      tips: [
        "El forecast aprende de los picos: programe recepciones antes del jueves para tener stock el fin de semana.",
        "Use los «quiebres» del histórico para ajustar el stock de seguridad de los productos sensibles.",
      ],
      faq: [
        { q: "¿En qué se basa el pronóstico?", a: "En el histórico de ventas del producto con modelos estadísticos puros (suavizado exponencial, media móvil y descomposición estacional). Se pueden ajustar con datos manuales si hace falta." },
      ],
    },
    {
      id: "dsd",
      label: "Recepción Directa DSD",
      path: "/dsd",
      icon: Truck,
      tagline: "Mercadería del proveedor directo al salón",
      category: "Abastecimiento",
      color: "blue",
      description:
        "DSD (Direct Store Delivery) gestiona la mercadería que el proveedor trae directo al salón sin pasar por el depósito: programación de llegadas, recepción por muelle, control de items y rechazos.",
      tabs: [
        { id: "dashboard", label: "Dashboard" },
        { id: "programacion", label: "Programación" },
        { id: "recepciones", label: "Recepciones" },
        { id: "items", label: "Items" },
        { id: "rechazos", label: "Rechazos" },
      ],
      steps: [
        {
          title: "Programe las llegadas",
          detail:
            "El proveedor avisa su visita: fecha, hora, muelle y tipo de carga. La programación ordena la recepción y evita colas.",
          mockKey: "prog",
        },
        {
          title: "Reciba en el muelle",
          detail:
            "Al llegar, registre la recepción por muelle: las unidades por producto y el estado. Los items con averías se marcan para rechazo.",
          mockKey: "recepcion",
        },
        {
          title: "Gestione los rechazos",
          detail:
            "Los productos rechazados (dañados, vencidos) se registran con su motivo. El proveedor recibe la devolución automáticamente y el stock no entra.",
          mockKey: "rechazos",
        },
      ],
      mocks: {
        prog: {
          type: "table",
          title: "Programación de recepciones",
          columns: [
            { label: "Proveedor", value: "proveedor" },
            { label: "Hora", value: "hora" },
            { label: "Muelle", value: "muelle" },
            { label: "Tipo", value: "tipo" },
            { label: "Estado", value: "estado", badge: true },
          ],
          rows: [
            { proveedor: "Coca Cola Paresa", hora: "07:00", muelle: "1", tipo: "Gaseosas", estado: "Recibido", badge: "green" },
            { proveedor: "Cervepar", hora: "08:30", muelle: "2", tipo: "Cervezas", estado: "En recepción", badge: "amber" },
            { proveedor: "Pepsi Snacks", hora: "10:00", muelle: "1", tipo: "Snacks", estado: "Programado", badge: "gray" },
          ],
        },
        recepcion: {
          type: "table",
          title: "Recepción — Cervepar",
          columns: [
            { label: "Producto", value: "producto" },
            { label: "Unidades", value: "unidades" },
            { label: "Verificado", value: "verificado" },
            { label: "Estado", value: "estado", badge: true },
          ],
          rows: [
            { producto: "Pilsen 24x355ml", unidades: 400, verificado: 400, estado: "OK", badge: "green" },
            { producto: "Bavaria 6x1L", unidades: 120, verificado: 118, estado: "2 rechazadas", badge: "amber" },
            { producto: "Keller 12x350ml", unidades: 250, verificado: 250, estado: "OK", badge: "green" },
          ],
        },
        rechazos: {
          type: "list",
          title: "Rechazos de hoy",
          items: [
            { title: "Bavaria 6x1L — 2 un", sub: "Botella dañada · Devuelto al proveedor", badge: "Rechazado", badgeColor: "red" },
            { title: "Snacks Pepsi — 1 caja", sub: "Lata abollada · Devuelto", badge: "Rechazado", badgeColor: "red" },
          ],
        },
      },
      faq: [
        { q: "¿Difiere DSD de la compra normal?", a: "Sí: en DSD la mercadería llega directo del proveedor al salón, sin orden de compra formal siempre. Es típico en gaseosas, cervezas y snacks." },
      ],
    },
    {
      id: "contratos",
      label: "Contratos & Rebates",
      path: "/contratos-proveedores",
      icon: Briefcase,
      tagline: "Acuerdos y bonificaciones con proveedores",
      category: "Abastecimiento",
      color: "amber",
      description:
        "Gestione los contratos comerciales con proveedores: plazos, precios acordados y rebates (bonificaciones por volumen). Siga el cumplimiento y las negociaciones en curso.",
      tabs: [
        { id: "dashboard", label: "Dashboard" },
        { id: "contratos", label: "Contratos" },
        { id: "rebates", label: "Rebates" },
        { id: "negociaciones", label: "Negociaciones" },
        { id: "cumplimiento", label: "Cumplimiento" },
      ],
      steps: [
        {
          title: "Registre el contrato",
          detail:
            "Cada contrato define vigencia (desde/hasta), condiciones de pago, descuentos y precios acordados por producto.",
          mockKey: "contratos",
        },
        {
          title: "Configure los rebates",
          detail:
            "Los rebates bonifican por volumen: por ejemplo, 2% sobre compras si superan ₲ 50.000.000 por trimestre. El sistema calcula el rebate devengado automáticamente.",
          mockKey: "rebates",
        },
        {
          title: "Mida el cumplimiento",
          detail:
            "Compare lo comprado vs lo comprometido en el contrato: si no llega al volumen de rebate, el sistema lo avisa para decidir si compensa comprar más para alcanzar el tramo.",
        },
      ],
      mocks: {
        contratos: {
          type: "table",
          title: "Contratos vigentes",
          columns: [
            { label: "Proveedor", value: "proveedor" },
            { label: "Vigencia", value: "vigencia" },
            { label: "Descuento", value: "desc" },
            { label: "Estado", value: "estado", badge: true },
          ],
          rows: [
            { proveedor: "Coca Cola Paresa", vigencia: "01/01/26 – 31/12/26", desc: "3%", estado: "Vigente", badge: "green" },
            { proveedor: "Cervepar", vigencia: "01/06/26 – 31/05/27", desc: "2.5%", estado: "Vigente", badge: "green" },
            { proveedor: "Chortitzer", vigencia: "01/03/26 – 31/02/27", desc: "1.8%", estado: "Por vencer", badge: "amber" },
          ],
        },
        rebates: {
          type: "table",
          title: "Rebates devengados Q3",
          columns: [
            { label: "Proveedor", value: "proveedor" },
            { label: "Compras Q3", value: "compras", currency: true },
            { label: "Meta", value: "meta", currency: true },
            { label: "Rebate", value: "rebate", currency: true },
            { label: "Estado", value: "estado", badge: true },
          ],
          rows: [
            { proveedor: "Coca Cola Paresa", compras: 128400000, meta: 100000000, rebate: 2568000, estado: "Alcanzado", badge: "green" },
            { proveedor: "Cervepar", compras: 84200000, meta: 100000000, rebate: 2105000, estado: "A 84%", badge: "amber" },
            { proveedor: "Chortitzer", compras: 39600000, meta: 60000000, rebate: 712800, estado: "A 66%", badge: "red" },
          ],
        },
      },
      faq: [
        { q: "¿Cómo se cobra el rebate?", a: "Se devenga por volumen comprado y se descuenta como nota de crédito del proveedor o crédito a cuenta, según lo pactado." },
      ],
    },
    {
      id: "portal-proveedores",
      label: "Portal Proveedores",
      path: "/portal/proveedores",
      icon: Globe,
      tagline: "El proveedor ve y gestiona su relación",
      category: "Abastecimiento",
      color: "indigo",
      description:
        "El portal de autoservicio para proveedores: ven sus órdenes de compra, facturas, pagos y documentos. Pueden invitar nuevos proveedores y consultar el estado de cada operación sin llamar por teléfono.",
      tabs: [
        { id: "usuarios", label: "Usuarios" },
        { id: "documentos", label: "Documentos" },
        { id: "invitar", label: "Invitar proveedor" },
      ],
      steps: [
        {
          title: "Gestione los usuarios del portal",
          detail:
            "Administre los proveedores con acceso: cada uno con usuario y permisos. Desde acá se invita y se da de baja.",
          mockKey: "usuarios",
        },
        {
          title: "Deje que el proveedor consulte",
          detail:
            "En el portal, el proveedor ve: POs, recepciones, facturas pagadas y pendientes, y el estado de sus contratos. Menos llamadas, más transparencia.",
          mockKey: "documentos",
        },
        {
          title: "Invite proveedores nuevos",
          detail:
            "Complete el formulario de invitación: el proveedor recibe un mail, crea su clave y entra al portal.",
        },
      ],
      mocks: {
        usuarios: {
          type: "table",
          title: "Proveedores con acceso al portal",
          columns: [
            { label: "Proveedor", value: "proveedor" },
            { label: "Usuario", value: "usuario" },
            { label: "Último acceso", value: "acceso" },
            { label: "Estado", value: "estado", badge: true },
          ],
          rows: [
            { proveedor: "Coca Cola Paresa", usuario: "copa_paresa", acceso: "06/09 10:20", estado: "Activo", badge: "green" },
            { proveedor: "Cervepar", usuario: "cervepar_spa", acceso: "05/09 16:40", estado: "Activo", badge: "green" },
            { proveedor: "Chortitzer", usuario: "chortitzer", acceso: "—", estado: "Invitado", badge: "amber" },
          ],
        },
        documentos: {
          type: "list",
          title: "Documentos visibles para el proveedor",
          items: [
            { title: "Órdenes de compra", sub: "PO, estado, fechas de entrega, recepciones", badge: "12 docs", badgeColor: "blue" },
            { title: "Facturas y pagos", sub: "Facturas conciliadas, pagos realizados y fecha", badge: "45 docs", badgeColor: "green" },
            { title: "Contratos y rebates", sub: "Vigencias, descuentos y cumplimiento", badge: "3 docs", badgeColor: "purple" },
          ],
        },
      },
      faq: [
        { q: "¿El proveedor puede cargar su propia factura?", a: "En la versión actual el proveedor consulta; la carga de facturas se habilita por rol. Es el siguiente paso del portal." },
      ],
    },
  ],
}