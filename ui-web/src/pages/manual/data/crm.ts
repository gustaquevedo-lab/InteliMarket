import { Users, Ticket, PieChart, Tag } from "lucide-react"
import type { ManualCategory } from "../types"

export const crmCategory: ManualCategory = {
  id: "crm",
  label: "CRM, Clientes & Promociones",
  icon: Users,
  gradient: "from-pink-600 to-fuchsia-700",
  description:
    "Fidelización y dinamismo comercial: el programa ExtraClub, cupones de sorteo en kiosco interactivo, la ficha 360° del cliente y el potente motor de Promociones y Campañas con acuerdos Sell-Out.",
  subtitle: "Fidelidad de clientes, cupones de sorteo y campañas comerciales",
  modules: [
    {
      id: "promociones",
      label: "Promociones & Campañas Comerciales",
      path: "/promociones",
      icon: Tag,
      tagline: "Motor integral de ofertas, acuerdos Sell-Out con proveedores y reglas de caja",
      category: "CRM, Clientes & Promociones",
      color: "fuchsia",
      role: "Gerencia Comercial, Jefes de Salón, Encargados de Marketing y Auditoría",
      prerequisites: [
        "Artículos del catálogo con costo de adquisición y precio regular vigentes.",
        "Proveedor registrado con RUC para convenios con financiamiento Sell-Out.",
        "Cajas de cobro conectadas al servidor para sincronización automática de precios de oferta.",
      ],
      workflowOverview:
        "Este módulo es el cerebro promocional de Extra Supermercado. Permite crear ofertas por tiempo limitado, liquidar lotes de corto vencimiento y gestionar acuerdos comerciales con proveedores. Cuando una promoción se activa, el Punto de Venta (POS) en las cajas reconoce automáticamente el artículo y aplica el descuento en el carrito respetando límites por cliente, horarios relámpago y días de la semana. Posteriormente, el sistema liquida las unidades vendidas para emitir el reclamo formal de Nota de Crédito por Sell-Out al proveedor.",
      description:
        "La central de promociones más avanzada del supermercado. Incluye 6 pestañas de control (Activas, Corto Vencimiento, Liquidación Sell-Out, Pendientes, Pausadas e Histórico) y un modal exhaustivo con más de 10 mecánicas de descuento, financiamiento co-participado, límites anti-revendedores, terminación psicológica de precios y simulador de margen antes de guardar.",
      tabs: [
        { id: "activas", label: "Promociones Activas" },
        { id: "vencimientos", label: "Corto Vencimiento" },
        { id: "sell_out", label: "Liquidación Sell-Out (NC)" },
        { id: "pendientes", label: "Programadas a Futuro" },
        { id: "pausadas", label: "Pausadas" },
      ],
      steps: [
        {
          title: "1. Monitoreo de Promociones Activas en Góndola y Cajas",
          detail:
            "En la pestaña 'Activas', audite todas las ofertas que están impactando en las cajas. Cada tarjeta muestra el nombre de la campaña, la mecánica de descuento aplicada, el origen del financiamiento (Tienda, Proveedor o Co-financiado), el semáforo de vigencia y el contador de unidades vendidas.",
          mockKey: "activas",
        },
        {
          title: "2. Apertura del Modal Extenso de Nueva Promoción",
          detail:
            "Haga clic en el botón '+ Nueva Promoción' en la esquina superior derecha. Se abrirá el modal de configuración avanzada compuesto por 5 bloques esenciales: Datos Generales, Mecánica de Descuento, Origen y Financiamiento, Selección de Productos con Simulador y Reglas Avanzadas de Restricción.",
          mockKey: "modal_general",
        },
        {
          title: "3. Configuración de la Mecánica de Descuento (Tipos de Oferta)",
          detail:
            "Despliegue el selector 'Tipo de Promoción'. Dispone de 10 mecánicas homologadas:\n" +
            "• Precio Fijo de Oferta: Fija el precio final en guaraníes (ej. De ₲ 8.500 a ₲ 6.900).\n" +
            "• Descuento Porcentual (% OFF): Aplica un porcentaje de rebaja sobre el precio de venta o sobre el costo.\n" +
            "• Descuento Monto Fijo: Descuenta un importe directo en efectivo (ej. ₲ 2.000 menos por paquete).\n" +
            "• 2x1 (Lleva 2, Paga 1): Descuenta el 100% de la segunda unidad.\n" +
            "• 3x2 (Lleva 3, Paga 2): El cliente lleva 3 unidades y paga solo 2.\n" +
            "• NxM (Lleva N, Paga M): Mecánica flexible parametrizable (ej. Lleva 4, Paga 3).\n" +
            "• 2da Unidad con % OFF: La primera unidad a precio regular y la segunda al 50% o 70%.\n" +
            "• Combo Pack Especial: Agrupa artículos combinados a un precio promocional cerrado.",
          mockKey: "modal_tipos",
        },
        {
          title: "4. Definición de Origen y Modelo de Financiamiento",
          detail:
            "Seleccione de dónde proviene el subsidio del descuento:\n" +
            "• Sell-Out (NC Proveedor): El proveedor absorbe la diferencia de precio. Por cada unidad cobrada en el POS, el sistema acumula el crédito para exigir la Nota de Crédito al proveedor.\n" +
            "• Co-Financiado: Acuerdo mixto donde se define el porcentaje exacto de aporte del proveedor (ej. 70%) y el aporte que asume Extra Supermercado (ej. 30%).\n" +
            "• Sell-In: Descuento que ya vino bonificado en la factura de compra del lote.\n" +
            "• Gasto Comercial Tienda: Financiado 100% por el supermercado como iniciativa propia.",
        },
        {
          title: "5. Selección Múltiple de Productos y Simulador de Margen",
          detail:
            "Elija los artículos que integran la campaña mediante 3 modalidades:\n" +
            "1. Buscador individual: tipee el nombre, código SKU o pase el código de barras.\n" +
            "2. Por Proveedor: selecciona de forma masiva todos los artículos de una distribuidora (ej. Casa Gonzalito S.R.L.).\n" +
            "3. Por Categoría: selecciona una familia completa (ej. Gaseosas o Galletitas).\n" +
            "El simulador calcula en tiempo real para cada artículo: Precio Regular, Costo, Precio de Oferta y el Margen Bruto Resultante, alertando en rojo si algún precio cae por debajo del costo.",
          mockKey: "simulador",
        },
        {
          title: "6. Reglas Avanzadas de Restricción (Anti-Revendedores y Horarios)",
          detail:
            "Despliegue 'Reglas Avanzadas' para blindar la rentabilidad:\n" +
            "• Límite por Compra: Máximo X unidades por ticket (ej. máx 6 aceites por cliente para evitar que almaceneros o revendedores vacíen la estantería).\n" +
            "• Límite de Stock de Campaña: La promo se desactiva sola al alcanzar X unidades vendidas (ej. 'Hasta agotar 500 packs').\n" +
            "• Días de la Semana Específicos: Marque los días válidos (ej. 'Viernes y Sábados').\n" +
            "• Horario Relámpago (Happy Hour): Defina la franja horaria activa (ej. de 18:00 a 21:00 hs).\n" +
            "• Terminación Psicológica: Redondea automáticamente los precios de oferta a '900' o '950' guaraníes.",
        },
        {
          title: "7. Pestaña Sell-Out: Reclamo y Liquidación de Notas de Crédito",
          detail:
            "Al finalizar la campaña (o al corte mensual), abra la pestaña 'Liquidación Sell-Out'. Seleccione el proveedor y la promoción: el sistema totaliza las unidades vendidas por caja, multiplica por el aporte acordado por unidad y genera la 'Liquidación Oficial de Sell-Out' lista para imprimir o enviar en PDF al proveedor exigiendo la emisión de la Nota de Crédito fiscal.",
          mockKey: "sell_out",
        },
      ],
      mocks: {
        activas: {
          type: "table",
          title: "Promociones Vigentes en Línea de Cajas",
          columns: [
            { label: "Campaña / Promoción", value: "nombre" },
            { label: "Mecánica", value: "tipo" },
            { label: "Financiamiento", value: "origen", badge: true },
            { label: "Vigencia", value: "vigencia" },
            { label: "Vendidas", value: "vendidas" },
            { label: "Estado", value: "estado", badge: true },
          ],
          rows: [
            { nombre: "SUPER FINDE DE CERVEZAS", tipo: "Precio Oferta (₲ 4.000)", origen: "Co-Financiado (70% Prov)", vigencia: "04/09 al 07/09", vendidas: "1.840 un", estado: "EN CURSO", badges: { origen: "blue", estado: "green" } },
            { nombre: "LÁCTEOS CORTO VENCIMIENTO", tipo: "30% OFF Directo", origen: "Rescate Tienda", vigencia: "01/09 al 10/09", vendidas: "312 un", estado: "EN CURSO", badges: { origen: "amber", estado: "green" } },
            { nombre: "FIDEOS Y PASTAS 3x2", tipo: "3x2 (Lleva 3, Paga 2)", origen: "Sell-Out Proveedor", vigencia: "01/09 al 15/09", vendidas: "620 un", estado: "EN CURSO", badges: { origen: "purple", estado: "green" } },
            { nombre: "HAPPY HOUR GASEOSAS (18-21 HS)", tipo: "2da Unidad 50% OFF", origen: "Gasto Comercial", vigencia: "Vie / Sáb / Dom", vendidas: "450 un", estado: "PROGRAMADA", badges: { origen: "gray", estado: "blue" } },
          ],
        },
        modal_general: {
          type: "form",
          title: "Modal de Creación — Bloque 1: Datos Generales & Financiamiento",
          formFields: [
            { label: "Nombre de la Campaña", type: "text", value: "FESTIVAL DE PASTAS Y SALSAS — FIN DE SEMANA", required: true },
            { label: "Tipo de Promoción", type: "select", value: "🎁 3x2 (Lleva 3, Paga 2)", options: ["🏷️ Precio Fijo de Oferta", "📉 Descuento Porcentual (% OFF)", "💵 Descuento Monto Fijo", "🎁 2x1 (Lleva 2, Paga 1)", "🎁 3x2 (Lleva 3, Paga 2)", "🏷️ 2da Unidad con % OFF", "📦 Combo Especial Pack"] },
            { label: "Modelo de Financiamiento", type: "select", value: "Sell-Out (NC Proveedor)", options: ["Sell-Out (NC Proveedor)", "Co-Financiado (Proveedor + Tienda)", "Sell-In (Bonif. Compra)", "Gasto Comercial Tienda"] },
            { label: "Proveedor Asociado", type: "select", value: "CASA GONZALITO S.R.L.", options: ["CASA GONZALITO S.R.L.", "CERVEPAR S.A.", "DISTRIBUIDORA DEL SUR"] },
            { label: "Aporte Proveedor (%)", type: "number", value: "100%" },
          ],
          caption: "El proveedor absorberá el costo de la tercera unidad bonificada mediante Nota de Crédito fiscal.",
        },
        simulador: {
          type: "table",
          title: "Simulador de Margen Comercial Antes de Guardar",
          columns: [
            { label: "Producto", value: "producto" },
            { label: "Costo (₲)", value: "costo", currency: true },
            { label: "Precio Regular (₲)", value: "regular", currency: true },
            { label: "Precio Oferta (₲)", value: "promo", currency: true },
            { label: "Margen Oferta", value: "margen", badge: true },
          ],
          rows: [
            { producto: "FIDEO TALLARIN 500G", costo: 3900, regular: 5500, promo: 3666, margen: "24.5% (Con Sell-Out)", badge: "green" },
            { producto: "SALSA DE TOMATE DOYPACK", costo: 2800, regular: 4200, promo: 2800, margen: "21.0% (Con Sell-Out)", badge: "green" },
          ],
        },
        sell_out: {
          type: "table",
          title: "Liquidación de Reclamo Sell-Out — CASA GONZALITO S.R.L.",
          columns: [
            { label: "Campaña Liquidada", value: "campana" },
            { label: "Período Liquidado", value: "periodo" },
            { label: "Unidades Vendidas en Cajas", value: "unidades" },
            { label: "Reembolso Unitario Acordado", value: "reembolso", currency: true },
            { label: "Total Reclamo Nota de Crédito", value: "total", currency: true, badge: true },
          ],
          rows: [
            { campana: "Promo Fideos 3x2", periodo: "01/09 al 07/09", unidades: "1.240 un", reembolso: 1833, total: 2272920, badge: "green" },
            { campana: "Aceites Descuento Directo", periodo: "28/08 al 04/09", unidades: "850 un", reembolso: 1500, total: 1275000, badge: "green" },
          ],
        },
      },
      useCases: [
        {
          title: "Caso 1: Creación de oferta Sell-Out con Casa Gonzalito para no perder margen",
          scenario:
            "Casa Gonzalito propone poner en oferta la Harina 1kg a ₲ 4.500 (precio normal ₲ 5.800). El costo de compra es ₲ 4.100. El proveedor se compromete a devolver ₲ 1.000 por cada kilo vendido mediante Nota de Crédito.",
          stepByStep: [
            "1. En Promociones, pulse '+ Nueva Promoción'.",
            "2. En Nombre cargue: 'PROMO HARINA CASA GONZALITO ₲ 4.500'.",
            "3. En Tipo de Promoción elija 'Precio Fijo de Oferta' y digite '₲ 4.500'.",
            "4. En Modelo de Financiamiento elija 'Sell-Out (NC Proveedor)'.",
            "5. Seleccione como proveedor a 'CASA GONZALITO S.R.L.'.",
            "6. En Reglas Avanzadas, configure 'Límite por Compra: 6 unidades' (para que almaceneros revendedores no vacíen el stock).",
            "7. Al guardar, las cajas ya cobran a ₲ 4.500. Al terminar la semana, la pestaña 'Liquidación Sell-Out' muestra: 1.500 kilos vendidos x ₲ 1.000 = ₲ 1.500.000 a reclamar.",
          ],
          keyLesson:
            "Las ofertas con Sell-Out permiten competir con precios agresivos sin sacrificar el margen de ganancia de Extra Supermercado, siempre que se carguen correctamente vinculadas al proveedor.",
        },
        {
          title: "Caso 2: Rescate urgente de yogures con fecha de expiración en 4 días (Corto Vencimiento)",
          scenario:
            "El encargado de lácteos informa que 120 sachets de yogurt vencen el próximo jueves y deben rematarse antes de perder el 100% de la mercadería.",
          stepByStep: [
            "1. Vaya a Promociones -> solapa 'Corto Vencimiento'.",
            "2. Pulse '+ Oferta de Corto Vencimiento'.",
            "3. Escanee el producto 'YOGURT BEBIBLE 1L' e ingrese la fecha de vencimiento del lote.",
            "4. Seleccione el descuento agresivo: '40% OFF' (baja de ₲ 9.000 a ₲ 5.400).",
            "5. Marque 'Cartelería Amarilla de Ocasión' e imprima las etiquetas de góndola destacadas.",
            "6. El lote se vende completo en 48 horas, recuperando el costo del producto en lugar de generar una merma que va al basurero.",
          ],
          keyLesson:
            "Vender a precio de costo o con leve pérdida un producto por vencer siempre es preferible a perder el 100% del valor en el descarte sanitario.",
        },
        {
          title: "Caso 3: Happy Hour de cervezas y gaseosas de viernes por la tarde",
          scenario:
            "Se desea impulsar el tráfico de clientes los viernes de 18:00 a 21:00 hs con la promoción '2da Unidad al 50% OFF' en cervezas en lata.",
          stepByStep: [
            "1. En el modal de Nueva Promoción, seleccione '2da Unidad con % OFF' y digite '50%'.",
            "2. Seleccione la categoría 'Bebidas -> Cervezas'.",
            "3. En Reglas Avanzadas, marque exclusivamente el día 'Viernes'.",
            "4. En Horario Relámpago active: Desde '18:00' hs hasta '21:00' hs.",
            "5. Guarde la promoción. En las cajas, si un cliente compra a las 17:30 hs paga precio regular; si cobra a las 18:05 hs el POS aplica el 50% de descuento en la segunda lata de forma automática.",
          ],
          keyLesson:
            "Las promociones por franja horaria atraen a los trabajadores que regresan a sus casas en la hora pico vespertina y aumentan el ticket promedio.",
        },
      ],
      commonErrors: [
        {
          error: "Error en caja: 'La promoción no aplica el descuento al escanear el artículo'",
          cause: "La promoción está fuera de su fecha de vigencia, fuera del horario relámpago programado, o el cajero no ha refrescado la sesión.",
          solution:
            "Verifique la hora del servidor y los días activos de la promoción en la pestaña 'Activas'. Si se creó hace instantes, el cajero puede presionar F5 en el POS para forzar la actualización de precios.",
        },
        {
          error: "Alerta: 'Un cliente intentó llevar 20 unidades pero el POS solo aplicó descuento a 6'",
          cause: "La promoción tiene activa la regla de restricción 'Límite por compra' (ej. máx 6 unidades).",
          solution:
            "Esto es una protección del sistema y NO un error. Las 6 primeras unidades se cobran con precio de oferta y las 14 restantes se cobran automáticamente a precio regular.",
        },
      ],
      shortcutsOrHotkeys: [
        { key: "F4", action: "Abrir modal de Nueva Promoción" },
        { key: "Ctrl + S", action: "Ir a liquidación de Sell-Out" },
        { key: "Ctrl + V", action: "Ver alertas de Corto Vencimiento" },
      ],
      tips: [
        "Use siempre el simulador de margen antes de activar una promo masiva para cerciorarse de que ningún artículo quede con ganancia negativa no deseada.",
        "Exija a los vendedores de distribuidoras la firma de la liquidación de Sell-Out al inicio de cada mes para evitar retrasos en las Notas de Crédito.",
      ],
      faq: [
        {
          q: "¿Qué sucede si un producto tiene precio mayorista y además tiene una promoción activa?",
          a: "El motor de precios del Punto de Venta compara ambas opciones y aplica automáticamente la que resulte más ventajosa para el cliente (el menor precio), evitando duplicar descuentos erróneamente.",
        },
        {
          q: "¿Puedo pausar una promoción temporalmente si nos quedamos sin stock?",
          a: "Sí. En la pestaña 'Activas', haga clic en el botón de pausa. La promo dejará de aplicar en las cajas de inmediato y podrá reactivarla cuando ingrese nuevo camión.",
        },
      ],
    },
    {
      id: "crm",
      label: "Fidelidad ExtraClub",
      path: "/crm",
      icon: Users,
      tagline: "Puntos de fidelidad, categorías de clientes y recompensas",
      category: "CRM, Clientes & Promociones",
      color: "pink",
      role: "Atención al Cliente, Encargados de Fidelización y Cajeros",
      description:
        "El programa de fidelidad de Extra Supermercado: los clientes acumulan puntos con cada compra en caja (según su RUC o Cédula), escalan en categorías (Bronce, Plata, Oro y VIP) y canjean recompensas en góndola o descuentos en su ticket.",
      tabs: [
        { id: "miembros", label: "Socios ExtraClub" },
        { id: "rfm", label: "Segmentación RFM" },
        { id: "premios", label: "Catálogo de Premios" },
      ],
      steps: [
        {
          title: "1. Identificación y Registro del Socio en Caja",
          detail: "Al facturar en el POS, el cajero digita la Cédula o RUC del cliente (tecla F2). Si el cliente no está inscripto, se lo asocia en 10 segundos para que empiece a sumar puntos desde esa misma compra.",
        },
        {
          title: "2. Canje de Puntos por Descuentos Directos",
          detail: "Cuando el socio acumula suficientes puntos, el sistema permite canjearlos en el POS como forma de pago (1.000 puntos = ₲ 10.000 de descuento en el total de la compra).",
        },
      ],
      mocks: {
        socios: {
          type: "table",
          title: "Socios Destacados ExtraClub",
          columns: [
            { label: "Cliente", value: "cliente" },
            { label: "Categoría", value: "categoria", badge: true },
            { label: "Puntos Disponibles", value: "puntos" },
            { label: "Compras del Año", value: "compras", currency: true },
          ],
          rows: [
            { cliente: "MARÍA LUJÁN BENÍTEZ", categoria: "VIP", badge: "purple", puntos: "48.250 pts", compras: 14800000 },
            { cliente: "PEDRO RUIZ DÍAZ", categoria: "ORO", badge: "amber", puntos: "21.400 pts", compras: 7850000 },
            { cliente: "CARLOS GIMÉNEZ", categoria: "BRONCE", badge: "gray", puntos: "3.200 pts", compras: 1250000 },
          ],
        },
      },
      tips: [
        "Capacite a las cajeras para invitar a todo cliente nuevo a asociarse al ExtraClub: incrementa la retención en más de un 30%.",
      ],
    },
    {
      id: "cupones",
      label: "Cupones de Sorteo en Kiosco",
      path: "/cupones",
      icon: Ticket,
      tagline: "Generación de cupones de sorteo, captura de datos y urnas digitales",
      category: "CRM, Clientes & Promociones",
      color: "purple",
      role: "Atención al Cliente y Marketing",
      description:
        "Terminal de autoservicio (kiosco táctil) donde los clientes escanean su ticket de compra fiscal para participar en los sorteos de electrodomésticos, canastas y vehículos organizados por Extra Supermercado.",
      steps: [
        {
          title: "1. Escaneo del Ticket Fiscal en el Kiosco",
          detail: "El cliente aproxima el código de barras o QR de su factura fiscal al lector del kiosco. El sistema verifica que el ticket sea legal y no haya participado antes.",
        },
        {
          title: "2. Emisión del Cupón de la Urna Digital",
          detail: "El kiosco imprime el cupón con los datos del cliente y los deposita automáticamente en la urna digital para el sorteo de fin de mes.",
        },
      ],
      mocks: {
        kiosco: {
          type: "recibo",
          title: "Cupón de Sorteo Emitido — «Gran Premio Extra Supermercado»",
          caption: "Cupón #44129 · Cliente: María Benítez · Ticket #1042 · 3 chances por compra mayor a ₲ 100.000.",
        },
      },
      tips: [
        "El kiosco de cupones valida automáticamente el RUC y Timbrado legal de la factura para evitar cupones clonados.",
      ],
    },
  ],
}