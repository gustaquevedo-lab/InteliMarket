import { Tags, Copy, Package, Warehouse, AlertTriangle } from "lucide-react"
import type { ManualCategory } from "../types"

export const inventarioCategory: ManualCategory = {
  id: "inventario",
  label: "Inventario",
  icon: Tags,
  gradient: "from-orange-600 to-amber-700",
  description:
    "Domine el catálogo maestro de 11.000+ artículos, variantes, kits y el control de stock en tiempo real: entradas por compra, salidas por venta en POS, auditoría de Kardex con consulta directa a BD, tomas físicas y prevención de mermas.",
  subtitle: "Control absoluto de existencia, cero quiebres de góndola y auditoría de Kardex",
  modules: [
    {
      id: "products",
      label: "Catálogo de Productos",
      path: "/products",
      icon: Tags,
      tagline: "Maestro de artículos con stock físico neto y proveedor vinculado",
      category: "Inventario",
      color: "orange",
      role: "Jefes de Salón, Encargados de Compras, Auxiliares de Catálogo y Auditores de Precios",
      prerequisites: [
        "Código de barras EAN-13 oficial del fabricante o código interno asignado para balanza (iniciando con prefijo '20').",
        "Proveedor previamente registrado en el sistema con su RUC y Razón Social (ej. Casa Gonzalito S.R.L.).",
        "Categoría o familia comercial asignada (Almacén, Bebidas, Carnicería, Fiambrería, Lácteos, Limpieza, Verdulería).",
        "Tasa de IVA legal verificada según normativa DNIT/SET (10% régimen general, 5% canasta básica familiar, o Exenta).",
      ],
      workflowOverview:
        "Cada artículo que se comercializa en Extra Supermercado nace en este catálogo. Aquí se le asigna su proveedor habitual, su costo de compra, el margen comercial esperado y su precio de venta al público. Si el producto se vende por volumen (packs, fardos o cajas cerradas), se configuran sus escalas mayoristas. Además, la pantalla muestra el Stock Físico Real actualizado con badges de semáforo (Verde: En Stock, Amarillo: Bajo Mínimo, Rojo: Quiebre).",
      description:
        "El catálogo maestro centraliza más de 11.000 artículos activos. Permite buscar al instante por nombre, código de barras o SKU, filtrar por proveedor o nivel de stock, dar de alta nuevos productos bloqueando códigos duplicados, y acceder a la ficha 360 del producto con su historial de costos y precios.",
      tabs: [
        { id: "lista", label: "Catálogo & Stock Real" },
        { id: "crear", label: "Alta de Producto" },
        { id: "escalas", label: "Precios Mayoristas" },
        { id: "360", label: "Ficha 360" },
      ],
      steps: [
        {
          title: "1. Búsqueda y Monitoreo del Inventario en Góndola",
          detail:
            "En la barra de búsqueda superior, digite el nombre del producto, su SKU o pase el código de barras bajo el lector. Utilice los filtros rápidos de stock: 'En Stock' (existencia normal), 'Bajo Stock' (por debajo del stock de seguridad pero aún disponible) o 'Quiebre de Stock' (stock en cero o negativo que requiere reposición inmediata). La columna 'Stock Físico' refleja la cantidad real descontando las ventas del nuevo POS.",
          mockKey: "lista",
        },
        {
          title: "2. Alta de un Nuevo Producto en el Sistema",
          detail:
            "Haga clic en el botón '+ Nuevo Producto' (o presione F8). Complete obligatoriamente: Nombre Comercial claro (ej. 'ARROZ TIPO 1 5KG'), Familia/Categoría, Proveedor asignado, Código de Barras (el sistema alerta de inmediato si ya existe en otro producto para evitar duplicados), Unidad de Medida (Unidad, Kilogramo, Litro), Tasa de IVA (10% o 5%), Costo de Adquisición y Precio de Venta Minorista.",
          mockKey: "crear",
        },
        {
          title: "3. Configuración de Escalas de Precios Mayoristas (Fardos y Cajas)",
          detail:
            "Para productos de alta rotación (gaseosas, cervezas, azúcar, harina, aceites), abra la pestaña 'Precios & Escalas' dentro de la edición del producto. Defina el precio unitario base, el precio intermedio a partir de X unidades (ej. pack de 6), y el precio mayorista por bulto cerrado (ej. fardo de 12 o caja de 24). Al pasar los artículos en el Punto de Venta (POS), el cajero solo ingresa la cantidad y el descuento por escala se aplica de forma automática.",
        },
        {
          title: "4. Auditoría de Margen Comercial y Costo Landed",
          detail:
            "El sistema calcula en tiempo real el Margen Bruto % sobre la venta. Si el costo del proveedor aumenta tras una nueva factura de compra, el catálogo recalcula el margen proyectado y emite una sugerencia de actualización de precio para proteger la rentabilidad de la tienda.",
        },
        {
          title: "5. Ficha 360 del Producto y Acceso Rápido al Kardex",
          detail:
            "Al hacer clic sobre cualquier producto de la grilla, se abre el panel 'Ficha 360' que resume: existencias por depósito, proveedor principal, rotación de ventas de los últimos 30 días, y un botón directo 'Ver Movimientos en Kardex' para auditar cada ingreso y salida con fecha y hora exacta.",
          mockKey: "360",
        },
      ],
      mocks: {
        lista: {
          type: "table",
          title: "Catálogo de Productos — Filtro «Bajo Stock y Quiebre»",
          columns: [
            { label: "SKU", value: "sku" },
            { label: "Producto", value: "nombre" },
            { label: "Proveedor", value: "proveedor" },
            { label: "Costo (₲)", value: "costo", currency: true },
            { label: "Precio Venta (₲)", value: "precio", currency: true },
            { label: "Stock Físico", value: "stock", badge: true },
          ],
          rows: [
            { sku: "22243", nombre: "COCA COLA ZERO LT 354ML (6)", proveedor: "CASA GONZALITO S.R.L.", costo: 4200, precio: 5500, stock: "207 un", badge: "green" },
            { sku: "119895", nombre: "COCA COLA RETORN 1.5L (8)", proveedor: "CASA GONZALITO S.R.L.", costo: 7100, precio: 9000, stock: "64 un", badge: "green" },
            { sku: "000345", nombre: "QUESO PARAGUAY ARTESANAL X KG", proveedor: "LACTEOS DEL SUR", costo: 28500, precio: 36900, stock: "4 kg (min 20)", badge: "amber" },
            { sku: "000477", nombre: "HARINA COMUN TIPO 000 1KG", proveedor: "MOLINOS SAN LUIS", costo: 4100, precio: 5800, stock: "0 un (QUIEBRE)", badge: "red" },
          ],
        },
        crear: {
          type: "form",
          title: "Alta de Nuevo Producto en Catálogo",
          formFields: [
            { label: "Nombre Comercial", type: "text", value: "YERBA MATE CAMPESINA MENTA Y LIMON 500G", required: true },
            { label: "Familia Comercial", type: "select", value: "Almacén", options: ["Almacén", "Bebidas", "Carnicería", "Fiambrería", "Lácteos", "Limpieza", "Verdulería"] },
            { label: "Proveedor Principal", type: "text", value: "CASA GONZALITO S.R.L.", required: true },
            { label: "Código de Barras (EAN-13)", type: "text", value: "7840058001887", required: true },
            { label: "Tasa de IVA", type: "select", value: "10% (General)", options: ["10% (General)", "5% (Canasta Básica)", "Exenta"] },
            { label: "Costo de Adquisición (₲)", type: "number", value: "7.800" },
            { label: "Precio de Venta Minorista (₲)", type: "number", value: "10.500" },
            { label: "Stock Mínimo de Alerta", type: "number", value: "24" },
          ],
          caption: "Margen Bruto Calculado: 25.7% · Alerta de reposición automática al llegar a 24 unidades.",
        },
        "360": {
          type: "kpiGrid",
          title: "Ficha 360 — COCA COLA ZERO LT 354ML (6)",
          kpis: [
            { label: "Stock Físico Neto", value: "207 unidades", sub: "Salón: 147 · Depósito: 60", color: "green" },
            { label: "Costo Promedio", value: "₲ 4.200", sub: "Última compra: 02/09/2026", color: "blue" },
            { label: "Precio Venta", value: "₲ 5.500", sub: "Escala x12: ₲ 5.000", color: "purple" },
            { label: "Ventas (Últimos 7 días)", value: "184 unidades", sub: "Rotación promedio: 3.2 días", color: "amber" },
          ],
        },
      },
      useCases: [
        {
          title: "Caso 1: Alta de artículo pesable para balanza de carnicería o fiambrería",
          scenario:
            "El sector de carnicería incorpora un nuevo corte: 'TAPA CUADRIL ENVASADA AL VACÍO' que se pesará en la balanza electrónica y emitirá una etiqueta con código de barras.",
          stepByStep: [
            "1. En Catálogo de Productos, pulse '+ Nuevo Producto' (F8).",
            "2. En Nombre Comercial cargue 'TAPA CUADRIL AL VACIO X KG' y asigne la categoría 'Carnicería'.",
            "3. En Código de Barras, asigne un código PLU de 4 dígitos que coincida con la memoria de la balanza (ej. '0185'). El sistema autogenera el prefijo '200185' para que el lector del POS lo identifique como pesable.",
            "4. Marque la casilla 'Producto Pesable / Balanza' y elija la unidad 'Kilogramos (kg)'.",
            "5. Ingrese el precio de venta por kilogramo (ej. ₲ 58.900) y guarde los cambios.",
            "6. Al pesar el corte en la balanza, la etiqueta saldrá con el código '200185XXXXXX'. Al pasarlo en el POS, el sistema leerá el peso exacto y cobrará el importe correspondiente al gramaje pesado.",
          ],
          keyLesson:
            "Los productos de balanza SIEMPRE deben iniciar con prefijo '20' para que el escáner del Punto de Venta sepa que no es un EAN comercial sino un pesable con precio o peso embebido.",
        },
        {
          title: "Caso 2: Aplicación de escalas automáticas para venta de gaseosas o fardos de cerveza",
          scenario:
            "La Cerveza Brahma 269ml cuesta ₲ 4.500 al por menor por unidad, pero comprando el pack de 12 latas baja a ₲ 4.000 por lata, y comprando 5 packs (60 latas) baja a ₲ 3.750.",
          stepByStep: [
            "1. Localice el producto 'BRAHMITA CERV ULTRA CERO LT 269ML' en el catálogo y pulse 'Editar'.",
            "2. Abra la solapa 'Precios Escalonados'.",
            "3. Escala 1 (Base): Cantidad 1 unidad -> ₲ 4.500.",
            "4. Escala 2 (Pack): Cantidad mínima 12 unidades -> ₲ 4.000 cada una.",
            "5. Escala 3 (Mayorista): Cantidad mínima 60 unidades -> ₲ 3.750 cada una.",
            "6. Guarde el registro. En el POS, si el cajero escanea 12 latas o escribe '12 * [Código]', el sistema cobra automáticamente ₲ 48.000 en vez de ₲ 54.000 sin intervención del supervisor.",
          ],
          keyLesson:
            "Configurar escalas mayoristas en el catálogo agiliza las cajas, previene discusiones de precios con clientes mayoristas y elimina la necesidad de autorizaciones manuales de descuento.",
        },
        {
          title: "Caso 3: Actualización de precio ante aumento de costo del proveedor",
          scenario:
            "El proveedor Casa Gonzalito S.R.L. entrega una nueva factura con aumento del 8% en aceites. El encargado debe ajustar el precio de góndola manteniendo el margen del 22%.",
          stepByStep: [
            "1. Busque 'ACEITE DE GIRASOL 900ML' en el catálogo.",
            "2. Observe el nuevo costo registrado por la recepción de compra (ej. subió de ₲ 8.000 a ₲ 8.650).",
            "3. En la ficha de precios, pulse 'Calcular según Margen Objetivo': ingrese '22%'.",
            "4. El sistema sugiere el nuevo precio al público: ₲ 11.100 (redondeado).",
            "5. Confirme el cambio de precio. Al instante, todas las cajas de cobro ya tienen el nuevo precio y se puede imprimir la nueva etiqueta de góndola desde el menú de impresión de cartelería.",
          ],
          keyLesson:
            "No actualizar los precios de venta tras un aumento de costo deteriora el margen bruto del supermercado sin que la gerencia lo perciba hasta el cierre de mes.",
        },
      ],
      commonErrors: [
        {
          error: "Error: 'El código de barras 7840058... ya pertenece a otro artículo'",
          cause: "Se intentó crear un producto nuevo reutilizando un código EAN que ya está registrado en la base de datos.",
          solution:
            "Busque ese código de barras en la grilla principal. Si el producto ya existía pero estaba desactivado, reactive el producto existente en lugar de crear uno nuevo. Si es un producto con envase idéntico pero diferente gramaje, verifique el código impreso en el paquete físico.",
        },
        {
          error: "Alerta: 'Margen bruto negativo detectado'",
          cause: "El precio de venta ingresado es menor al costo de adquisición del proveedor.",
          solution:
            "Revise los ceros en el precio de venta o en el costo. El sistema exige confirmación expresa de un supervisor si un producto se va a vender bajo costo (venta a pérdida).",
        },
      ],
      shortcutsOrHotkeys: [
        { key: "F3", action: "Buscar producto por texto o código" },
        { key: "F8", action: "Crear nuevo producto en catálogo" },
        { key: "Ctrl + E", action: "Editar producto seleccionado" },
        { key: "Ctrl + P", action: "Imprimir etiqueta de góndola con código de barras" },
      ],
      tips: [
        "El lector de código de barras USB funciona en cualquier campo: haga clic en el buscador y pase el producto por el lector para saltar directo a su ficha.",
        "Use el filtro 'Proveedor' para auditar rápidamente todos los artículos de una misma distribuidora antes de una reunión de compras.",
        "El campo 'Stock Mínimo' define el semáforo amarillo: configúrelo con el consumo de 3 a 5 días para evitar quiebres de góndola.",
      ],
      faq: [
        {
          q: "¿Qué significa el Stock Físico que muestra el catálogo?",
          a: "Es la cantidad neta real en existencia en el supermercado. Proviene de la existencia física registrada menos todas las ventas cobradas en el Punto de Venta de Intelimarket.",
        },
        {
          q: "¿Puedo cambiar el proveedor asignado a un producto?",
          a: "Sí. Edite el producto y elija el nuevo proveedor en el desplegable. Toda compra futura de ese artículo quedará vinculada al nuevo proveedor sin alterar las compras históricas.",
        },
      ],
    },
    {
      id: "inventory",
      label: "Depósitos, Stock & Kardex",
      path: "/inventory",
      icon: Warehouse,
      tagline: "Auditoría de movimientos en BD, saldos acumulados y control de depósitos",
      category: "Inventario",
      color: "amber",
      role: "Jefes de Depósito, Encargados de Inventario, Auditores y Gerencia de Operaciones",
      prerequisites: [
        "Acceso a la terminal web de Intelimarket con rol de Encargado de Depósito o Auditor.",
        "Catálogo de productos activo con sus códigos SKU oficiales.",
        "Conexión estable con el servidor central para consultas de Kardex histórico.",
      ],
      workflowOverview:
        "Este módulo es el libro mayor de la mercadería: cada lata, fardo o kilo que ingresa o egresa del supermercado queda registrado de forma inmutable en el Kardex. Permite investigar cualquier discrepancia de stock consultando directamente a la base de datos entre los 11.000+ artículos, auditar existencias divididas entre Salón de Ventas y Depósito Central, ejecutar tomas físicas de inventario y registrar transferencias internas con control de transporte.",
      description:
        "La central de control físico de mercadería. Incluye el nuevo motor de consulta de Kardex conectado a la base de datos SQL con búsqueda en tiempo real, desglose de entradas, salidas y saldos acumulados, monitoreo de productos perecederos con principio FEFO (First Expired, First Out) y auditoría de tomas físicas periódicas.",
      tabs: [
        { id: "stock", label: "Stock por Depósito" },
        { id: "kardex", label: "Kardex de Movimientos (BD)" },
        { id: "venc", label: "Vencimientos & Lotes" },
        { id: "toma", label: "Toma Física de Inventario" },
      ],
      steps: [
        {
          title: "1. Consulta de Existencias por Depósito",
          detail:
            "En la solapa 'Stock', revise la distribución de cada artículo entre el Salón de Ventas (góndolas), la Cámara Fría (carnes y lácteos) y el Depósito Seco (fardos y bultos). Los productos en nivel de quiebre o cercanos al mínimo se resaltan automáticamente en rojo y amarillo.",
          mockKey: "stock",
        },
        {
          title: "2. Auditoría del Kardex con Buscador Directo a Base de Datos",
          detail:
            "En la solapa 'Kardex', utilice la barra de búsqueda conectada directamente a PostgreSQL o pulse el botón 'Consultar Producto BD'. Escriba el nombre o SKU de cualquiera de los 11.000+ productos. El sistema traerá su historial cronológico completo de entradas (compras, devoluciones de clientes, ajustes positivos) y salidas (ventas cobradas en POS, mermas por rotura, vencimientos) con su saldo acumulado exacto recalculado tras cada movimiento.",
          mockKey: "kardex",
        },
        {
          title: "3. Control de Vencimientos y Principio FEFO",
          detail:
            "En la solapa 'Vencimientos', audite los lotes ordenados por fecha de expiración. El semáforo identifica en rojo crítico los productos que vencen en menos de 7 días (ej. yogures, carnes frescas), en amarillo los de 15 a 30 días y en verde los de larga vida. Esto permite colocar carteles de oferta 'Pronto Vencimiento' para evitar la pérdida total de la mercadería.",
          mockKey: "venc",
        },
        {
          title: "4. Ejecución de Toma Física y Conteo Ciego",
          detail:
            "Para inventariar un pasillo o categoría, pulse 'Nueva Toma Física'. El sistema genera la planilla con los productos del sector. El repositor cuenta físicamente en góndola e ingresa la cantidad real. El sistema compara el stock teórico vs el contado, calcula la diferencia en unidades y valor monetario (₲), y solicita justificación antes de asentar el ajuste contable.",
          mockKey: "toma",
        },
        {
          title: "5. Transferencias Internas de Mercadería",
          detail:
            "Cuando se reponen góndolas desde el Depósito Central o la Cámara, genere una 'Transferencia Interna'. Indique depósito de origen, depósito de destino y cantidades. Esto asegura que la existencia del salón no figure en cero cuando todavía hay cajas en el depósito de reserva.",
        },
      ],
      mocks: {
        stock: {
          type: "table",
          title: "Existencia Física por Ubicación — Extra Supermercado",
          columns: [
            { label: "Producto", value: "nombre" },
            { label: "Salón Góndola", value: "salon" },
            { label: "Cámara Fría", value: "camara" },
            { label: "Dep. Central", value: "seco" },
            { label: "Stock Total", value: "total", badge: true },
            { label: "Estado", value: "estado", badge: true },
          ],
          rows: [
            { nombre: "COCA COLA ZERO LT 354ML (6)", salon: 147, camara: 0, seco: 60, total: "207 un", estado: "ÓPTIMO", badge: "green" },
            { nombre: "CARNE VACIO X KG", salon: 32, camara: 118, seco: 0, total: "150 kg", estado: "NORMAL", badge: "green" },
            { nombre: "LECHE ENTERA LARGA VIDA 1L", salon: 48, camara: 0, seco: 210, total: "258 un", estado: "NORMAL", badge: "green" },
            { nombre: "QUESO PARAGUAY X KG", salon: 4, camara: 12, seco: 0, total: "16 kg", estado: "BAJO", badge: "amber" },
          ],
        },
        kardex: {
          type: "table",
          title: "Kardex Histórico en BD — BRAHMITA CERV ULTRA CERO LT 269ML (12)",
          columns: [
            { label: "Fecha y Hora (Asunción)", value: "fecha" },
            { label: "Tipo de Movimiento", value: "tipo" },
            { label: "Comprobante / Origen", value: "comprobante" },
            { label: "Entrada", value: "entrada" },
            { label: "Salida", value: "salida" },
            { label: "Saldo Acumulado", value: "saldo", badge: true },
          ],
          rows: [
            { fecha: "31/08/2026 08:30", tipo: "Inventario Inicial", comprobante: "Corte Legacy Nemuha", entrada: "6.732", salida: "—", saldo: "6.732 un", badge: "blue" },
            { fecha: "01/09/2026 14:15", tipo: "Venta POS", comprobante: "Ticket Caja 01 #1042", entrada: "—", salida: "24", saldo: "6.708 un", badge: "green" },
            { fecha: "03/09/2026 11:20", tipo: "Recepción Compra", comprobante: "Factura Prov #8841", entrada: "1.200", salida: "—", saldo: "7.908 un", badge: "green" },
            { fecha: "07/09/2026 10:00", tipo: "Ventas Acumuladas POS", comprobante: "POS Intelimarket", entrada: "—", salida: "4.162", saldo: "2.570 un", badge: "amber" },
          ],
        },
        venc: {
          type: "table",
          title: "Alertas de Vencimiento de Lotes (FEFO)",
          columns: [
            { label: "Producto", value: "nombre" },
            { label: "Lote", value: "lote" },
            { label: "Fecha Vencimiento", value: "vence" },
            { label: "Existencia", value: "cant" },
            { label: "Semáforo Riesgo", value: "riesgo", badge: true },
          ],
          rows: [
            { nombre: "YOGURT BEBIBLE FRUTILLA 1L", lote: "L-260901", vence: "12/09/2026", cant: "84 un", riesgo: "CRÍTICO (5 DÍAS)", badge: "red" },
            { nombre: "CREMA DE LECHE 200ML", lote: "L-260910", vence: "22/09/2026", cant: "45 un", riesgo: "ATENCIÓN (15 DÍAS)", badge: "amber" },
            { nombre: "MAYONESA DOYPACK 500G", lote: "L-260815", vence: "15/12/2026", cant: "120 un", riesgo: "VIGENTE", badge: "green" },
          ],
        },
        toma: {
          type: "form",
          title: "Carga de Toma Física — Pasillo 3 (Lácteos y Quesos)",
          formFields: [
            { label: "Ubicación del Conteo", type: "select", value: "Góndola Salón Principal", options: ["Góndola Salón Principal", "Cámara Fría", "Depósito Seco"] },
            { label: "Producto (Código o Nombre)", type: "text", value: "QUESO PARAGUAY ARTESANAL X KG", required: true },
            { label: "Stock Teórico en Sistema", type: "number", value: "16 kg" },
            { label: "Stock Real Contado Físicamente", type: "number", value: "14.2 kg", required: true },
            { label: "Diferencia Neta", type: "text", value: "−1.8 kg (Faltante / Merma natural de deshidratación)" },
            { label: "Motivo de Justificación", type: "select", value: "Merma por desecación / fraccionamiento", options: ["Merma por desecación / fraccionamiento", "Vencimiento", "Rotura en manipuleo", "Error de conteo previo"] },
          ],
          caption: "Impacto monetario estimado del ajuste: −₲ 51.300. Requiere firma del auditor responsable.",
        },
      },
      useCases: [
        {
          title: "Caso 1: Investigación de una discrepancia entre lo que dice el sistema y lo que hay en góndola",
          scenario:
            "El cajero informa que un cliente quiso llevar 10 unidades de Aceite Vicentín, pero en góndola solo había 2, a pesar de que el catálogo mostraba 15 unidades.",
          stepByStep: [
            "1. Ingrese a Inventario -> solapa 'Kardex'.",
            "2. En el buscador escriba 'ACEITE VICENTIN' o su SKU correspondiente.",
            "3. Revise la lista cronológica de movimientos hacia atrás:",
            "   - Verifique la última entrada por compra: ¿ingresaron las cajas anotadas en la remisión?",
            "   - Verifique los tickets de venta en las cajas durante los últimos 3 días.",
            "   - Busque si hubo transferencias al Depósito Central que no se hayan completado.",
            "   - Verifique si se registró una baja por rotura en el pasillo de aceites.",
            "4. Si se confirma que las 13 botellas faltantes se rompieron al descargar el camión y nadie lo asentó, proceda a registrar el ajuste por 'Merma por Rotura'.",
            "5. El saldo del Kardex se ajustará al valor real de 2 botellas, evitando que el sistema siga ofreciendo mercadería inexistente.",
          ],
          keyLesson:
            "El Kardex nunca miente: auditarlo permite identificar si la diferencia se debe a mercadería que nunca ingresó del camión, mercadería cobrada erróneamente con otro código, o mercadería rota sin registrar.",
        },
        {
          title: "Caso 2: Aplicación de la regla FEFO ante lote de yogures próximo a vencer",
          scenario:
            "En la solapa de vencimientos se detecta que 84 sachets de yogurt tienen fecha de expiración en 5 días.",
          stepByStep: [
            "1. En el módulo de Vencimientos, filtre por 'Riesgo Crítico' (< 7 días).",
            "2. Emita la orden al repositor para aplicar FEFO estricto: mover el lote L-260901 al frente de la góndola (a la altura de los ojos del cliente) y colocar los lotes más nuevos detrás.",
            "3. Genere una etiqueta de góndola promocional 'OFERTA PRONTO CONSUMO' con un 20% de descuento autorizado.",
            "4. Monitoree las ventas en el POS durante el día para asegurar que el lote se agote antes de la fecha límite sin generar pérdidas por decomiso sanitario.",
          ],
          keyLesson:
            "El principio FEFO (lo que primero expira es lo que primero debe exhibirse y venderse) es la herramienta más eficaz para evitar tirar dinero en alimentos perecederos.",
        },
        {
          title: "Caso 3: Toma física sorpresiva de bebidas alcohólicas de alto valor",
          scenario:
            "La gerencia dispone un control sorpresivo del sector de whisky, licores y vinos finos un día lunes por la mañana antes de abrir la tienda.",
          stepByStep: [
            "1. En Depósitos & Stock -> 'Toma Física', cree un inventario selectivo de la categoría 'Bebidas Alcohólicas'.",
            "2. El sistema congela temporalmente las existencias teóricas del sector.",
            "3. El auditor recorre la estantería con su tablet o planilla y cuenta botella por botella.",
            "4. Digite el stock contado. Si una botella de whisky Johnnie Walker Black Label tiene teórico 6 y contado 5, el sistema marca diferencia de -1 unidad.",
            "5. Se coteja de inmediato con los tickets de la noche anterior y con las grabaciones de seguridad del pasillo.",
            "6. Se aprueba la toma física registrando el motivo correspondiente para que el stock contable coincida exactamente con la góndola.",
          ],
          keyLesson:
            "Los inventarios selectivos y sorpresivos por familias de alto valor disuaden hurtos internos y externos de forma mucho más contundente que los inventarios anuales masivos.",
        },
      ],
      commonErrors: [
        {
          error: "Error: 'No se puede registrar salida: Stock en cero o negativo'",
          cause: "Se intentó transferir mercadería o cargar una merma sobre un producto cuya existencia registrada ya está en cero.",
          solution:
            "Primero audite el Kardex del producto para corroborar si falta asentar la factura de compra o la transferencia previa desde el depósito de origen.",
        },
        {
          error: "Alerta: 'Diferencia en toma física superior a la tolerancia permitida (5%)'",
          cause: "El conteo físico arrojó una variación monetaria o de unidades muy elevada respecto al stock registrado.",
          solution:
            "El sistema bloquea la aprobación directa y exige un segundo conteo ciego por parte de un supervisor diferente para descartar un error humano en el conteo de estantería.",
        },
      ],
      shortcutsOrHotkeys: [
        { key: "Ctrl + K", action: "Abrir consulta directa de Kardex por producto" },
        { key: "F5", action: "Refrescar existencias en tiempo real desde la BD" },
        { key: "Ctrl + T", action: "Iniciar nueva toma física de inventario" },
      ],
      tips: [
        "Use siempre el botón 'Consultar Producto BD' cuando necesite auditar el historial de un producto específico entre los más de 11.000 artículos.",
        "Realice las tomas físicas en horarios sin atención al público para que las ventas en curso no alteren el conteo de stock.",
        "El Kardex almacena la hora oficial de Paraguay (America/Asuncion) para facilitar la confrontación con los registros de las cámaras de seguridad.",
      ],
      faq: [
        {
          q: "¿Por qué el Kardex muestra las ventas de Intelimarket descontadas desde el 31/08/2026?",
          a: "Porque el 31 de agosto de 2026 inició la operación oficial del nuevo Punto de Venta. El sistema toma el stock base físico del inventario y le resta todas las ventas cobradas en las cajas desde esa fecha, preservando las compras que hayan ingresado.",
        },
        {
          q: "¿Qué diferencia hay entre una Merma y un Ajuste de Inventario?",
          a: "La Merma refleja mercadería que se destruyó o perdió (vencida, rota, podrida) y se computa como pérdida operativa. El Ajuste de Inventario se utiliza cuando hubo un error de conteo o carga previa y corrige la cifra teórica.",
        },
      ],
    },
    {
      id: "shrinkage",
      label: "Control de Mermas & Pérdidas",
      path: "/shrinkage",
      icon: AlertTriangle,
      tagline: "Detección temprana y prevención de roturas, vencimientos y hurtos",
      category: "Inventario",
      color: "red",
      role: "Auditores de Pérdidas, Jefes de Salón, Encargados de Perecederos y Gerente General",
      prerequisites: [
        "Habilitación del rol de Auditor o Encargado de Calidad.",
        "Balanza de verificación de mermas calibrada en el sector de recepción/trastienda.",
      ],
      workflowOverview:
        "Cada kilogramo de fruta descompuesta, botella de aceite rota en góndola o sachet de leche vencido destruye el margen comercial del supermercado. Este módulo permite registrar de inmediato cada merma con su causa exacta, calcula el valor monetario perdido al costo de reposición, alimenta las estadísticas del sector y genera recomendaciones inteligentes para reducir el desperdicio.",
      description:
        "Panel integral de control de mermas y prevención de pérdidas (Shrinkage). Permite registrar mermas operativas en segundos, categorizarlas por causal (Vencimiento, Rotura en Transporte, Manipuleo de Clientes, Hurto, Desecación Natural en Carnicería/Verdulería), y analizar el porcentaje de merma sobre la venta total para mantenerlo dentro de los límites saludables (< 1.5%).",
      tabs: [
        { id: "panel", label: "Dashboard de Pérdidas" },
        { id: "registro", label: "Registrar Merma" },
        { id: "recom", label: "Recomendaciones IA" },
      ],
      steps: [
        {
          title: "1. Monitoreo del Indicador Global de Merma",
          detail:
            "Revise el porcentaje de merma del mes comparado contra el estándar del supermercado (meta: menor a 1.5% de la facturación). El panel desglosa el costo monetario total de mercadería dada de baja y destaca qué familia encabeza las pérdidas (habitualmente Verdulería y Carnicería por su condición de frescos).",
          mockKey: "kpis",
        },
        {
          title: "2. Registro Inmediato de Producto Averiado o Vencido",
          detail:
            "Cuando se detecta un artículo no apto para la venta, no lo descarte a la basura sin registrarlo. Ingrese a 'Registrar Merma', escanee el código de barras, seleccione la cantidad o peso exacto, indique el sector (Salón, Depósito, Cámara) y elija la causa real. Esto da de baja el stock en el Kardex y evita que la caja crea que el producto sigue disponible.",
          mockKey: "form",
        },
        {
          title: "3. Aplicación de Recomendaciones de Prevención",
          detail:
            "El sistema analiza patrones repetitivos: si los yogures vencen con frecuencia los días lunes, sugiere reducir el volumen de pedido de los días jueves; si hay roturas frecuentes de vinos en una puntera de góndola, sugiere mejorar la protección perimetral de la estantería.",
          mockKey: "recos",
        },
      ],
      mocks: {
        kpis: {
          type: "kpiGrid",
          title: "Panel de Control de Pérdidas Operativas (Septiembre 2026)",
          kpis: [
            { label: "Merma Acumulada", value: "1.42%", sub: "Meta del mes: < 1.50%", color: "green" },
            { label: "Pérdida Monetaria", value: "₲ 62.400.000", sub: "Calculado a costo de compra", color: "amber" },
            { label: "Sector Mayor Impacto", value: "Verdulería & Frutería", sub: "38% del total de bajas", color: "red" },
            { label: "Casos Registrados", value: "214 incidentes", sub: "186 roturas · 28 vencidos", color: "purple" },
          ],
        },
        form: {
          type: "form",
          title: "Acta de Registro de Merma de Mercadería",
          formFields: [
            { label: "Producto Averiado", type: "text", value: "ACEITE DE SOJA 900ML", required: true },
            { label: "Cantidad / Unidades", type: "number", value: "3", required: true },
            { label: "Causa del Descarte", type: "select", value: "Rotura por caída en góndola (cliente)", options: ["Rotura por caída en góndola (cliente)", "Vencimiento cumplido", "Avería en recepción de camión", "Descomposición natural (frescos)", "Defecto de fabricación / pérdida de gas"] },
            { label: "Ubicación del Incidente", type: "select", value: "Pasillo 4 (Salón de Ventas)", options: ["Pasillo 4 (Salón de Ventas)", "Depósito Central", "Cámara Fría de Lácteos"] },
            { label: "Disposición del Residuo", type: "select", value: "Desecho controlado en contenedor de residuos", options: ["Desecho controlado en contenedor de residuos", "Canje con proveedor (devolución acordada)", "Abono / Compostaje (orgánicos)"] },
          ],
          caption: "Valorización de la merma: ₲ 21.000. Al guardar, se genera el comprobante de baja en el Kardex.",
        },
        recos: {
          type: "list",
          title: "Acciones Correctivas Sugeridas por el Sistema",
          items: [
            { title: "Carnicería: Calibrar temperatura de exhibidora vertical", sub: "Se detectó oscilación térmica entre las 12:00 y las 15:00 hs que acelera la oxidación de cortes vacunos.", badge: "ALERTA TÉCNICA", badgeColor: "red" },
            { title: "Lácteos: Ajustar pedido de leche descremada", sub: "Se descartaron 14 unidades por vencimiento; reduzca la compra semanal en 2 cajas.", badge: "COMPRAS", badgeColor: "amber" },
            { title: "Góndola Bebidas: Instalar baranda de contención en estante superior", sub: "3 botellas de aperitivo rotas en los últimos 10 días por manipuleo de clientes.", badge: "INFRAESTRUCTURA", badgeColor: "blue" },
          ],
        },
      },
      useCases: [
        {
          title: "Caso 1: Caída accidental de mercadería frágil en el salón de ventas",
          scenario:
            "Un cliente con su carrito tropieza accidentalmente con una pila de conservas en frascos de vidrio y se rompen 4 frascos de palmitos.",
          stepByStep: [
            "1. El personal de limpieza cerca la zona para evitar que otros clientes pisen los vidrios.",
            "2. El repositor recoge los frascos rotos y los traslada al área de auditoría de mermas.",
            "3. En la pantalla 'Registrar Merma', escanea el código de barras de uno de los frascos.",
            "4. Carga cantidad '4', motivo 'Rotura accidental por cliente' y confirma el registro.",
            "5. El sistema asienta la baja contable: no se culpa al cajero ni se genera un faltante misterioso en el inventario de fin de mes.",
          ],
          keyLesson:
            "Toda rotura debe registrarse en el mismo momento en que ocurre. Postergar la anotación genera desajustes de stock y descontrol en los pasillos.",
        },
      ],
      commonErrors: [
        {
          error: "Práctica incorrecta: Tirar mercadería averiada al basurero sin pasarla por el sistema",
          cause: "El repositor descarta un producto roto sin informar al encargado.",
          solution:
            "Prohibir el descarte sin ticket de merma. Todo residuo debe ser auditado por el encargado de depósito antes de salir del local para garantizar la exactitud del Kardex.",
        },
      ],
      shortcutsOrHotkeys: [
        { key: "Ctrl + M", action: "Abrir formulario rápido de merma" },
      ],
      tips: [
        "Acuerde con distribuidores clave (ej. lácteos, panificados industriales) el 'reconocimiento de merma por vencimiento': muchos proveedores canjean mercadería vencida por producto fresco si se entrega el envase con código legible.",
      ],
    },
    {
      id: "kits",
      label: "Kits, Combos & Canastas",
      path: "/kits",
      icon: Package,
      tagline: "Combos promocionales y canastas con descuento de componentes",
      category: "Inventario",
      color: "indigo",
      role: "Jefes de Salón, Encargados de Marketing y Supervisores de Venta",
      description:
        "Cree paquetes comerciales compuestos por múltiples productos individuales (ej. 'Combo Asado Familiar': 3kg de costilla + 1 bolsa de carbón + 1 fardo de cerveza; o 'Canasta Navideña Extra'). Al facturar el combo en el POS, el cliente paga un precio especial de paquete y el sistema descuenta automáticamente el stock de cada uno de los componentes en sus respectivos depósitos.",
      steps: [
        {
          title: "1. Creación del Kit y Fijación del Precio Promocional",
          detail:
            "Defina el nombre comercial del kit, su código de barras propio (o PLU) y el precio de venta final atractivo para el cliente.",
        },
        {
          title: "2. Asignación de Componentes y Cantidades",
          detail:
            "Agregue cada producto que conforma el paquete indicando la cantidad que incluye (ej. 2 botellas de Coca-Cola 2L + 1 paquete de Galletitas). El sistema suma los costos individuales y le muestra el margen de ganancia exacto del combo.",
        },
        {
          title: "3. Venta en Cajas y Descuento Automático de Stock",
          detail:
            "El cajero solo escanea el código del combo. El ticket térmico muestra el nombre del combo y, en segundo plano, el sistema descuenta las existencias de cada componente en el Kardex.",
        },
      ],
      mocks: {
        combo: {
          type: "form",
          title: "Configuración de Combo Promocional — «Viernes de Asado Extra»",
          formFields: [
            { label: "Nombre del Combo", type: "text", value: "COMBO ASADO COMPLETO (4 PERSONAS)", required: true },
            { label: "Precio de Venta del Combo (₲)", type: "number", value: "195.000", required: true },
            { label: "Componente 1", type: "text", value: "COSTILLA DE PRIMERA X KG — 3.00 kg" },
            { label: "Componente 2", type: "text", value: "CARBON VEGETAL BOLSA 5KG — 1.00 un" },
            { label: "Componente 3", type: "text", value: "MANDIOCA FRESCA SELECCIONADA X KG — 2.00 kg" },
            { label: "Componente 4", type: "text", value: "CERVEZA BRAHMITA 269ML (PACK X12) — 1.00 un" },
          ],
          caption: "Costo total de componentes: ₲ 151.200 · Margen de ganancia: 22.5%.",
        },
      },
      tips: [
        "Si un componente del kit se queda sin stock en góndola, el Punto de Venta emitirá una advertencia preventiva para no vender combos incompletos.",
      ],
    },
  ],
}