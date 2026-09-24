import { ShoppingBag, Tags, TrendingUp, Truck, Briefcase, Globe } from "lucide-react"
import type { ManualCategory } from "../types"

export const abastecimientoCategory: ManualCategory = {
  id: "abastecimiento",
  label: "Abastecimiento & Compras",
  icon: ShoppingBag,
  gradient: "from-sky-600 to-blue-700",
  description:
    "El ciclo integral de compras y abastecimiento de Extra Supermercado: Asistente IA con reposición predictiva, demandas de clientes capturadas en caja, órdenes de compra (PO), recepción física con control de gancho y mermas, buzón de facturas electrónicas SIFEN/IMAP, matching a 3 vías y evaluación de proveedores OTIF.",
  subtitle: "Cadena de suministro, compras inteligentes y control Procure-to-Pay (P2P)",
  modules: [
    {
      id: "purchases",
      label: "Gestión Integral de Compras (P2P)",
      path: "/purchases",
      icon: ShoppingBag,
      tagline: "El circuito completo de compras: desde la sugerencia IA hasta el pago conciliado",
      category: "Abastecimiento & Compras",
      color: "sky",
      role: "Jefes de Compras, Compradores por Categoría, Recepcionistas de Depósito, Auditoría y Gerencia Comercial",
      prerequisites: [
        "Proveedores registrados con RUC, Razón Social y condición comercial (contado o crédito a 15/30/60 días).",
        "Artículos del catálogo con unidades de medida bien definidas (kilos, unidades, bultos/packs de 6, 12 o 24).",
        "Balanza de recepción en plataforma y báscula aérea de riel (gancho de carnicería) calibradas.",
        "Buzón de correo IMAP cPanel (facturaelectronica@superextra.com.py) configurado para recepción de XML/KUDE.",
      ],
      workflowOverview:
        "Este módulo controla las 12 etapas del circuito de compras en Extra Supermercado:\n" +
        "1. El Asistente IA analiza la velocidad de venta diaria y genera la propuesta de reposición según días de cobertura y clima.\n" +
        "2. Se incorporan las Demandas de Clientes no encontradas en góndola registradas por las cajeras en el POS.\n" +
        "3. Se emite la Orden de Compra (PO) y se remite por WhatsApp o correo al proveedor.\n" +
        "4. Al arribar el camión, Depósito ejecuta la Recepción Física pesando la mercadería en gancho o plataforma y registrando mermas o roturas.\n" +
        "5. La Factura del Proveedor ingresa automáticamente desde el buzón de correo o se carga manualmente con su Timbrado legal.\n" +
        "6. El motor de Matching a 3 Vías compara PO vs Recepción vs Factura: si todo coincide 100%, habilita la factura para pago en Tesorería.",
      description:
        "La central operativa de compras más robusta del sistema. Cuenta con 12 pestañas especializadas: Asistente IA, Demandas de Clientes, Órdenes de Compra (PO), Recepción de Mercadería, Facturas de Proveedores (P2P), Matching a 3 Vías, Devoluciones y Notas de Crédito, Maestro de Proveedores y Ficha 360° con Scorecard OTIF, Requisiciones Internas, Cotizaciones Comparativas (RFQ), Control Presupuestario y Reportes Ejecutivos de Compras.",
      tabs: [
        { id: "asistente_ia", label: "1. Asistente IA" },
        { id: "demandas_clientes", label: "2. Demandas Clientes" },
        { id: "ordenes", label: "3. Órdenes (PO)" },
        { id: "recepciones", label: "4. Recepción Muelle" },
        { id: "facturas_p2p", label: "5. Facturas Proveedor" },
        { id: "matching", label: "6. Matching 3 Vías" },
        { id: "devoluciones", label: "7. Devoluciones & NC" },
        { id: "proveedores", label: "8. Proveedores 360°" },
        { id: "requisiciones", label: "9. Requisiciones" },
        { id: "cotizaciones", label: "10. Cotizaciones (RFQ)" },
        { id: "presupuestos", label: "11. Presupuestos" },
        { id: "reportes", label: "12. Reportes & KPIs" },
      ],
      steps: [
        {
          title: "Pestaña 1: Asistente IA de Reposición Predictiva",
          detail:
            "El asistente analiza en tiempo real el stock actual (descontando ventas del POS), la velocidad de venta diaria (unidades/día), los días de cobertura deseados (ej. 5 días para carnes frescas, 20 días para secos) y variables climáticas (días calurosos elevan cerveza y bebidas; días fríos elevan panadería y chocolate). Muestra la lista de compras sugeridas agrupadas por proveedor y permite generar la Orden de Compra formal con un solo clic.",
          mockKey: "asistente_ia",
        },
        {
          title: "Pestaña 2: Demandas de Clientes (Productos no encontrados)",
          detail:
            "Cuando un cliente pregunta por un producto que no está en góndola o no existe en el catálogo, la cajera lo registra en el POS con la tecla de atajo. Esta pestaña lista todas esas solicitudes con fecha, hora, caja y cantidad de veces pedido. El comprador evalúa cada artículo y lo clasifica como: 'PENDIENTE', 'EN EVALUACIÓN' (contactando distribuidores), 'COMPRADO' (incorporado al surtido) o 'DESCARTADO'.",
          mockKey: "demandas",
        },
        {
          title: "Pestaña 3: Gestión de Órdenes de Compra (PO)",
          detail:
            "Permite crear, editar y hacer seguimiento a las POs. Al pulsar '+ Nueva Orden de Compra' seleccione el proveedor (ej. Casa Gonzalito S.R.L.), fecha de entrega prometida, condición comercial (ej. Crédito 30 Días) y agregue los artículos indicando bultos o unidades con el costo pactado. La PO pasa por los estados: Borrador -> Confirmada -> Enviada a Proveedor (exportable en PDF o Excel para remitir por WhatsApp) -> Entrega Parcial -> Completada.",
          mockKey: "ordenes",
        },
        {
          title: "Pestaña 4: Recepción Física de Mercadería en Muelle",
          detail:
            "Cuando el camión del distribuidor estaciona en la playa de descarga, el recepcionista abre la PO correspondiente. Verifica producto por producto: cuenta bultos, verifica fecha de vencimiento de lotes, mide temperatura en lácteos/congelados y pesa en gancho las medias reses de carnicería. Si hay diferencias o cajas rotas, se asientan como 'Avería / Merma de Recepción' y se emite la constancia física firmada por el chofer.",
          mockKey: "recepciones",
        },
        {
          title: "Pestaña 5: Facturas de Proveedores (Procure-to-Pay) & Buzón IMAP",
          detail:
            "Centraliza todas las facturas de compra. Se sincroniza automáticamente con el buzón de correo cPanel de la empresa (facturaelectronica@superextra.com.py) vía IMAP para descargar facturas electrónicas oficiales SIFEN en XML y PDF KUDE. También permite la carga manual registrando el Timbrado legal, RUC emisor, número de factura (ej. 001-002-0008891), condición (Contado/Crédito) y vencimiento fiscal.",
          mockKey: "facturas",
        },
        {
          title: "Pestaña 6: Matching a 3 Vías (El Candado Anti-Fraude)",
          detail:
            "Cruza de forma automática los 3 documentos clave de la operación:\n" +
            "1. La Orden de Compra (lo que se pactó pagar y comprar).\n" +
            "2. La Recepción Física (lo que efectivamente entró por el portón de descarga).\n" +
            "3. La Factura Legal del Proveedor (lo que el proveedor está cobrando).\n" +
            "Si las cantidades y los precios coinciden al 100%, el semáforo se enciende en VERDE ('Conciliada OK') y la factura viaja a Tesorería para programación de pago. Si hay sobreprecio o faltante, se bloquea en ROJO ('Discrepancia').",
          mockKey: "matching",
        },
        {
          title: "Pestaña 7: Devoluciones y Notas de Crédito de Proveedores",
          detail:
            "Registra mercadería rechazada en la recepción o mercadería vencida devuelta al proveedor según acuerdo de canje. Realiza el seguimiento de la Nota de Crédito fiscal que el proveedor debe emitir para descontarla del próximo pago de Tesorería.",
        },
        {
          title: "Pestaña 8: Maestro de Proveedores & Ficha 360° con Scorecard OTIF",
          detail:
            "Audita el desempeño de cada proveedor mediante el índice OTIF (On-Time In-Full: % de pedidos entregados a tiempo y completos). Incluye el historial cronológico de aumentos de precios del proveedor para negociar mejores condiciones de compra.",
          mockKey: "proveedor360",
        },
        {
          title: "Pestañas 9 a 12: Requisiciones, Cotizaciones (RFQ), Presupuestos y Reportes",
          detail:
            "• Requisiciones: Pedidos internos entre áreas (panadería solicita harina a depósito).\n" +
            "• Cotizaciones (RFQ): Comparativa de precios entre 3 proveedores antes de compras grandes.\n" +
            "• Presupuestos: Asignación de tope de gasto mensual por departamento.\n" +
            "• Reportes & KPIs: Indicadores de volumen de compra, concentración de gasto por proveedor y variaciones de costos.",
        },
      ],
      mocks: {
        asistente_ia: {
          type: "table",
          title: "Asistente IA — Sugerencias de Reposición por Cobertura Crítica",
          columns: [
            { label: "Producto", value: "producto" },
            { label: "Proveedor", value: "proveedor" },
            { label: "Stock Salón", value: "stock" },
            { label: "Venta Diaria", value: "velocidad" },
            { label: "Días Cobertura", value: "cobertura", badge: true },
            { label: "Cantidad Sugerida", value: "sugerido", badge: true },
          ],
          rows: [
            { producto: "LECHE ENTERA LARGA VIDA 1L", proveedor: "LA LACTEA", stock: "48 un", velocidad: "34 un/día", cobertura: "1.4 días", sugerido: "600 un (50 fardos)", badges: { cobertura: "red", sugerido: "green" } },
            { producto: "HARINA COMUN TIPO 000 1KG", proveedor: "CASA GONZALITO S.R.L.", stock: "0 un", velocidad: "28 un/día", cobertura: "0 días (QUIEBRE)", sugerido: "400 un (40 fardos)", badges: { cobertura: "red", sugerido: "green" } },
            { producto: "CERVEZA BRAHMITA 269ML", proveedor: "CERVEPAR S.A.", stock: "2.570 un", velocidad: "480 un/día", cobertura: "5.3 días", sugerido: "2.400 un (200 packs)", badges: { cobertura: "amber", sugerido: "blue" } },
          ],
        },
        demandas: {
          type: "table",
          title: "Demandas de Clientes no Encontradas en Góndola (Registradas en POS)",
          columns: [
            { label: "Producto Solicitado por el Cliente", value: "producto" },
            { label: "Veces Pedido en Cajas", value: "veces" },
            { label: "Sector Sugerido", value: "sector" },
            { label: "Último Registro", value: "fecha" },
            { label: "Estado Comercial", value: "estado", badge: true },
          ],
          rows: [
            { producto: "YERBA MATE KURUPÍ ANÍS 500G", veces: "14 solicitudes", sector: "Almacén", fecha: "Hoy 11:20 hs", estado: "EN EVALUACIÓN", badge: "amber" },
            { producto: "QUESO BRIE IMPORTADO FRANCÉS", veces: "6 solicitudes", sector: "Fiambrería Gourmet", fecha: "Ayer 18:40 hs", estado: "PENDIENTE", badge: "gray" },
            { producto: "LECHE SIN LACTOSA CHOCOLATADA 1L", veces: "22 solicitudes", sector: "Lácteos", fecha: "Hoy 09:15 hs", estado: "COMPRADO", badge: "green" },
          ],
        },
        ordenes: {
          type: "table",
          title: "Órdenes de Compra (PO) en Curso",
          columns: [
            { label: "Nº Orden", value: "numero" },
            { label: "Proveedor", value: "proveedor" },
            { label: "Condición", value: "condicion" },
            { label: "Total Orden (₲)", value: "total", currency: true },
            { label: "Fecha Entrega", value: "entrega" },
            { label: "Estado PO", value: "estado", badge: true },
          ],
          rows: [
            { numero: "PO-2026-0891", proveedor: "CASA GONZALITO S.R.L.", condicion: "Crédito 30 Días", total: 48900000, entrega: "08/09/2026", estado: "ENVIADA A PROVEEDOR", badge: "blue" },
            { numero: "PO-2026-0892", proveedor: "FRIGORÍFICO CONCEPCIÓN", condicion: "Contado Contraentrega", total: 62450000, entrega: "Hoy 14:00 hs", estado: "CONFIRMADA", badge: "green" },
            { numero: "PO-2026-0893", proveedor: "CERVEPAR S.A.", condicion: "Crédito 15 Días", total: 34800000, entrega: "09/09/2026", estado: "BORRADOR", badge: "gray" },
          ],
        },
        recepciones: {
          type: "table",
          title: "Acta de Recepción en Muelle — PO-2026-0892 (Frigorífico)",
          columns: [
            { label: "Artículo / Corte", value: "producto" },
            { label: "Cantidad Pedida en PO", value: "pedido" },
            { label: "Peso Real en Báscula", value: "pesado" },
            { label: "Diferencia / Merma", value: "merma", badge: true },
            { label: "Temperatura Cámara", value: "temp" },
          ],
          rows: [
            { producto: "MEDIA RES VACUNA DE PRIMERA", pedido: "1.200 kg", pesado: "1.182 kg", merma: "−18 kg (Desbaste flete)", temp: "3.8 °C (OK)", badge: "red" },
            { producto: "COSTILLA VACUNA EN PLANCHA", pedido: "450 kg", pesado: "450 kg", merma: "0 kg (Exacto)", temp: "3.5 °C (OK)", badge: "green" },
          ],
        },
        matching: {
          type: "list",
          title: "Resultados del Matching a 3 Vías (Verificación Automática)",
          items: [
            { title: "Factura 001-002-0008891 — CASA GONZALITO S.R.L.", sub: "PO-2026-0891 · 18 ítems cruzados · Coincidencia 100% en precio y cantidad. Habilitada para pago.", badge: "CONCILIADA OK", badgeColor: "green" },
            { title: "Factura 002-001-0014521 — LACTEOS DEL SUR", sub: "PO-2026-0888 · Diferencia: Facturaron ₲ 4.500 por leche cuando la PO pactaba ₲ 4.200. Bloqueada.", badge: "PRECIO SOBREVALUADO", badgeColor: "red" },
            { title: "Factura 001-005-0003310 — ABASTO CENTRAL", sub: "PO-2026-0889 · Faltante: Facturaron 50 bolsas pero el muelle solo recibió 46 bolsas.", badge: "CANTIDAD FALTANTE", badgeColor: "amber" },
          ],
        },
      },
      useCases: [
        {
          title: "Caso 1: Recepción de carne vacuna con báscula aérea y emisión de constancia de merma",
          scenario:
            "Llega el camión del frigorífico con remisión declarada de 1.200 kg de carne en gancho. Al colgar en la báscula de riel de Extra Supermercado, el pesaje da 1.182 kg (diferencia de 18 kg por evaporación y flete).",
          stepByStep: [
            "1. En Gestión de Compras -> solapa 'Recepciones', abra la orden del frigorífico.",
            "2. En el renglón de media res, ingrese el peso real pesado: 1.182 kg.",
            "3. El sistema calcula la merma: '−18 kg (−1.5%)'.",
            "4. Marque 'Generar Constancia de Merma de Pesaje' e imprímala en la impresora de depósito.",
            "5. Haga firmar al chofer del camión. La recepción se asienta por 1.182 kg reales para el Kardex, y contabilidad descuenta los 18 kg de la factura fiscal del frigorífico.",
          ],
          keyLesson:
            "Pagar sobre los kilos declarados en el remito del proveedor sin pesar en gancho propio representa una fuga de dinero directa para el supermercado.",
        },
        {
          title: "Caso 2: Detección y bloqueo de factura de proveedor con sobreprecio (Matching 3 Vías)",
          scenario:
            "Un distribuidor envía factura por ₲ 45.000.000, pero al cruzar con la PO se detecta que facturó el aceite a ₲ 8.900 en vez de los ₲ 8.200 acordados en la orden.",
          stepByStep: [
            "1. Ingrese a la solapa 'Matching 3 Vías'.",
            "2. Observe la factura en estado rojo 'PRECIO SOBREVALUADO'.",
            "3. El sistema resalta el ítem específico con la diferencia monetaria (₲ 700 por botella en 1.000 botellas = ₲ 700.000 de sobreprecio).",
            "4. El sistema bloquea automáticamente la autorización de pago en Tesorería.",
            "5. El comprador llama al distribuidor y exige la emisión de la Nota de Crédito por ₲ 700.000 antes de liberar el cheque o transferencia.",
          ],
          keyLesson:
            "El Matching a 3 Vías impide que los errores o avivadas de facturación de los proveedores se paguen inadvertidamente por el departamento de finanzas.",
        },
        {
          title: "Caso 3: Incorporación de producto demandado por clientes en cajas",
          scenario:
            "Durante la semana, 14 clientes preguntaron a las cajeras por 'Yerba Mate Kurupí Anís 500g' y no había en góndola.",
          stepByStep: [
            "1. El comprador abre la solapa 'Demandas Clientes'.",
            "2. Observa la alerta destacada: 14 solicitudes en 5 días.",
            "3. Contacta al representante de Yerba Kurupí y solicita 10 fardos.",
            "4. Cambia el estado de la demanda a 'COMPRADO' y carga la PO.",
            "5. Cuando el producto llega a salón, las ventas se disparan inmediatamente porque responde a una demanda insatisfecha real y validada.",
          ],
          keyLesson:
            "Escuchar y tabular lo que los clientes piden en la línea de cajas es la mejor guía para no perder ventas frente a la competencia.",
        },
      ],
      commonErrors: [
        {
          error: "Error: 'La factura no puede asociarse a la PO: RUC del emisor no coincide'",
          cause: "El proveedor tiene múltiples razones sociales o emitió la factura desde otra empresa del mismo grupo no registrada en el sistema.",
          solution:
            "Verifique el RUC en el maestro de proveedores. Si el proveedor cambió de timbrado o razón social, actualice la ficha en la solapa 'Proveedores' antes de vincular la factura.",
        },
        {
          error: "Bloqueo: 'No se puede recepcionar camión sin número de lote y vencimiento'",
          cause: "En productos perecederos (lácteos, embutidos, carnes), el sistema exige obligatoriamente cargar la fecha de expiración.",
          solution:
            "Examine la fecha impresa en el envase físico del producto e ingrésela en el formulario de recepción para habilitar el principio FEFO en depósito.",
        },
      ],
      shortcutsOrHotkeys: [
        { key: "F2", action: "Nueva Orden de Compra manual" },
        { key: "F6", action: "Ir directo a pantalla de Recepción de Muelle" },
        { key: "Ctrl + M", action: "Ejecutar Matching 3 Vías de facturas pendientes" },
      ],
      tips: [
        "Configure el Asistente IA los lunes a primera hora para programar las órdenes de compra de toda la semana.",
        "Revise diariamente la solapa de 'Demandas Clientes' para detectar faltantes de surtido antes de que los clientes se vayan a otro supermercado.",
      ],
      faq: [
        {
          q: "¿Cómo ingresan las facturas electrónicas de los proveedores al sistema?",
          a: "A través del conector IMAP configurado en la solapa de Facturas. El sistema lee el correo facturaelectronica@superextra.com.py, descarga el XML legal de SIFEN y pre-carga la factura sin necesidad de tipear a mano.",
        },
        {
          q: "¿Qué es el Scorecard OTIF en la ficha del proveedor?",
          a: "Mide la confiabilidad de cada proveedor: qué porcentaje de órdenes fueron entregadas a tiempo (On-Time) y con la cantidad completa de mercadería (In-Full). Ayuda a decidir a qué distribuidor comprar.",
        },
      ],
    },
    {
      id: "labels",
      label: "Impresión de Etiquetas de Góndola",
      path: "/etiquetas",
      icon: Tags,
      tagline: "Etiquetas térmicas de precio, ofertas destacadas y códigos CODE128",
      category: "Abastecimiento & Compras",
      color: "orange",
      role: "Repositores, Auxiliares de Salón y Encargados de Precios",
      description:
        "Generador de cartelería y etiquetas de góndola para impresoras térmicas (Zebra, Pantum). Permite imprimir etiquetas con código de barras legible por los escáneres del POS, precios regulares, precios mayoristas por fardo y cartelería amarilla de oferta.",
      steps: [
        {
          title: "1. Selección de Artículos a Etiquetar",
          detail: "Busque los artículos modificados o elija una góndola completa para reimpresión tras un cambio de precios.",
        },
        {
          title: "2. Elección del Formato de Etiqueta",
          detail: "Seleccione: Etiqueta Estándar de Góndola (40x30mm), Etiqueta Amarilla de Oferta / Promoción, o Etiqueta de Balanza Pesable.",
        },
        {
          title: "3. Impresión Térmica Directa",
          detail: "Envíe la orden a la impresora térmica Zebra conectada por USB o red local.",
        },
      ],
      mocks: {
        etiqueta: {
          type: "recibo",
          title: "Muestra de Etiqueta Térmica de Góndola (40x30mm)",
          caption: "ARROZ TIPO 1 5KG · Código EAN-13 · Precio: ₲ 28.500 · Fardo x6: ₲ 26.000 c/u.",
        },
      },
      tips: [
        "Verifique que la etiqueta impresa coincida exactamente con el precio del POS para evitar reclamos en caja.",
      ],
    },
  ],
}