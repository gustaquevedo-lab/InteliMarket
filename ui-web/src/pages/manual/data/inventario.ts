import { Tags, Copy, Package, Warehouse, AlertTriangle } from "lucide-react"
import type { ManualCategory } from "../types"

export const inventarioCategory: ManualCategory = {
  id: "inventario",
  label: "Inventario",
  icon: Tags,
  gradient: "from-orange-600 to-amber-700",
  description: "Domine el catálogo, las variantes, los kits y el control de stock: entradas, salidas, vencimientos, kardex y toma física.",
  subtitle: "Cero roturas de stock, cero plata estancada",
  modules: [
    {
      id: "products",
      label: "Catálogo de Productos",
      path: "/products",
      icon: Tags,
      tagline: "Todos los artículos del supermercado",
      category: "Inventario",
      color: "orange",
      description:
        "El catálogo contiene todos los SKUs con su foto, código de barras, familia, precios (costo y venta), unidades y stock en cada depósito. Incluye la vista 360 del producto: stock, precios, movimientos e imágenes en una sola tarjeta.",
      tabs: [
        { id: "lista", label: "Lista" },
        { id: "360", label: "Producto 360" },
        { id: "crear", label: "Crear producto" },
      ],
      steps: [
        {
          title: "Busque y filtre el catálogo",
          detail:
            "Busque por nombre, código de barras o SKU. Filtre por familia, estado (activo/inactivo) o por stock (con stock, sin stock, bajo mínimo). La grilla muestra precio de venta, costo y unidades.",
          mockKey: "lista",
        },
        {
          title: "Cree un producto nuevo",
          detail:
            "Cargue nombre, familia, código de barras, presentación (ej: unidad de 1 litro), costo y precio de venta. El sistema valida duplicados por código de barras para evitar productos repetidos.",
          mockKey: "crear",
        },
        {
          title: "Abra el detalle 360",
          detail:
            "Cada producto tiene una tarjeta 360: stock por depósito, precios asignados en cada lista, historial de movimientos (kardex), vencimientos e imágenes. Es la ficha completa del artículo.",
          mockKey: "360",
        },
        {
          title: "Gestione precios de venta",
          detail:
            "El precio de venta se toma de la lista asignada al cliente. Desde aquí puede editar margen, y activar precio con decimales si la ley lo permite.",
        },
      ],
      mocks: {
        lista: {
          type: "table",
          title: "Catálogo — filtro «Stock bajo mínimo»",
          columns: [
            { label: "SKU", value: "sku" },
            { label: "Producto", value: "nombre" },
            { label: "Costo", value: "costo", currency: true },
            { label: "Precio", value: "precio", currency: true },
            { label: "Stock", value: "stock", badge: true },
          ],
          rows: [
            { sku: "000212", nombre: "Leche Larga Vida 1L", costo: 6400, precio: 8900, stock: "8 (min 24)", badge: "red" },
            { sku: "000345", nombre: "Queso Paraguay x kg", costo: 12800, precio: 16900, stock: "5 (min 30)", badge: "red" },
            { sku: "000477", nombre: "Fideo Tallarín 500g", costo: 3900, precio: 5500, stock: "22 (min 20)", badge: "amber" },
          ],
        },
        crear: {
          type: "form",
          title: "Nuevo producto",
          formFields: [
            { label: "Nombre", type: "text", placeholder: "Coca-Cola 2.25L", required: true },
            { label: "Familia", type: "select", value: "Bebidas", options: ["Almacén", "Bebidas", "Carnicería", "Lácteos", "Limpieza", "Verdulería"] },
            { label: "Código de barras", type: "text", value: "5449000000996", required: true },
            { label: "Costo unitario", type: "number", value: "7.900" },
            { label: "Precio de venta", type: "number", value: "9.800" },
          ],
        },
        "360": {
          type: "kpiGrid",
          title: "Producto 360 — Leche Larga Vida 1L",
          kpis: [
            { label: "Stock total", value: "48 uni", sub: "Dep-01: 40 · Dep-02: 8", color: "blue" },
            { label: "Costo promedio", value: "₲ 6.400", sub: "última compra 31/08", color: "amber" },
            { label: "Precio venta", value: "₲ 8.900", sub: "lista Mostrador", color: "green" },
            { label: "Rotación", value: "42 días", sub: "venta diaria ≈ 34 uni", color: "purple" },
          ],
        },
      },
      tips: [
        "El lector de código de barras llena automáticamente el producto al escanear (busca y agrega).",
        "Use los «pack presets» para empaques: configurar que un pack = 10 unidades, por ejemplo.",
        "Si cambia el costo, el historial registra el costo anterior para cálculo de márgenes.",
      ],
      faq: [
        { q: "¿Puedo tener un producto con precio por kilo y por unidad?", a: "Sí. Defina la presentación base y unidades por pack (ej: 1kg = 2 medias unidades, o hacerlo «fraccionable»)." },
      ],
    },
    {
      id: "variants",
      label: "Variantes & Empaques",
      path: "/variants",
      icon: Copy,
      tagline: "Talles, colores, pesos y presentaciones",
      category: "Inventario",
      color: "purple",
      description:
        "Gestione variantes de un mismo producto: por talle (ropa), color, peso (frescos), o presentación (ej: Coca-Cola 500ml, 1L, 2.25L). Cada variante tiene su propio SKU, código de barras, precio y stock.",
      steps: [
        {
          title: "Elija el producto base",
          detail:
            "Seleccione el producto y agregue un tipo de variante: Talle (S, M, L), Color, Peso, o Presentación.",
        },
        {
          title: "Defina cada variante",
          detail:
            "Cada variante tiene SKU propio, código de barras, precio recargo o diferencia, y stock independiente. Así el inventario y el POS saben exactamente qué se vendió.",
          mockKey: "lista",
        },
        {
          title: "Verifique en POS y tienda",
          detail:
            "Las variantes aparecen como opciones al vender: el empleado elige «Ropa deportiva – Talle M». En la tienda online, el cliente elige la variante que quiere.",
        },
      ],
      mocks: {
        lista: {
          type: "table",
          title: "Variantes — Remera Deportiva",
          columns: [
            { label: "Variante", value: "variante" },
            { label: "SKU", value: "sku" },
            { label: "Código", value: "codigo" },
            { label: "Precio", value: "precio", currency: true },
            { label: "Stock", value: "stock" },
          ],
          rows: [
            { variante: "Talle S", sku: "REM-S", codigo: "7790001000011", precio: 85000, stock: 12 },
            { variante: "Talle M", sku: "REM-M", codigo: "7790001000012", precio: 85000, stock: 23 },
            { variante: "Talle L", sku: "REM-L", codigo: "7790001000013", precio: 85000, stock: 0 },
            { variante: "Talle XL", sku: "REM-XL", codigo: "7790001000014", precio: 90000, stock: 7 },
          ],
        },
      },
      tips: [
        "El código de barras de cada variante permite vender escaneando sin buscar en el catálogo.",
      ],
    },
    {
      id: "kits",
      label: "Kits & Combos",
      path: "/kits",
      icon: Package,
      tagline: "Arme combos y paquetes promocionales",
      category: "Inventario",
      color: "indigo",
      description:
        "Cree kits y combos: un «Kit Desayuno» compuesto por varios productos, con precio de kit. Al venderlo, cada componente descuenta su stock. Útil para canastas navideñas, paquetes promocionales o combos de revolución.",
      steps: [
        {
          title: "Cree el kit",
          detail:
            "Dé un nombre (ej: «Combo Revolución: asado completo»), una descripción, el precio de venta preferido y agregue los productos componentes.",
          mockKey: "kit",
        },
        {
          title: "Defina las cantidades",
          detail:
            "Especifique cuántas unidades de cada componente entran en el kit (ej: 2 kg de vacío, 1 carbonera, 6 panes). El costo del kit se calcula automáticamente.",
        },
        {
          title: "Venda el kit",
          detail:
            "En el POS, el kit aparece como un solo ítem con su precio. Al confirmar, la venta descuenta el stock de todos los componentes.",
        },
      ],
      mocks: {
        kit: {
          type: "form",
          title: "Nuevo kit",
          formFields: [
            { label: "Nombre", type: "text", value: "Asado Familiar", required: true },
            { label: "Precio de venta del kit", type: "number", value: "₲ 185.000" },
            { label: "Componente 1", type: "text", value: "Vacio x kg — 3 kg", options: [] },
            { label: "Componente 2", type: "text", value: "Carbonera 10kg", options: [] },
            { label: "Componente 3", type: "text", value: "Pan francés — 12 un", options: [] },
          ],
          caption: "Costo calculado del kit: ₲ 152.300 → margen bruto 17,7%.",
        },
      },
      tips: [
        "El stock de los componentes se valida antes de vender: si falta un componente, el kit avisa.",
      ],
    },
    {
      id: "inventory",
      label: "Depósitos & Stock",
      path: "/inventory",
      icon: Warehouse,
      tagline: "Stock por depósito, vencimientos y kardex",
      category: "Inventario",
      color: "amber",
      description:
        "El control de inventario completo: stock actual por depósito, control de vencimientos (FEFO), el kardex (historial de movimientos de cada producto), toma física de inventario y alertas de stock bajo y crítico.",
      tabs: [
        { id: "stock", label: "Stock" },
        { id: "venc", label: "Vencimientos" },
        { id: "kardex", label: "Kardex" },
        { id: "toma", label: "Toma física" },
        { id: "depositos", label: "Depósitos" },
      ],
      steps: [
        {
          title: "Vea el stock por depósito",
          detail:
            "La pestaña «Stock» muestra cada producto con su cantidad en cada depósito (salón, cámara fría, depósito seco). Los productos bajo mínimo se resaltan en rojo o ámbar.",
          mockKey: "stock",
        },
        {
          title: "Controle los vencimientos",
          detail:
            "La pestaña de vencimientos lista los lotes por fecha de caducidad y aplica el principio FEFO (primero que expira, primero que sale). Útil para perecederos y cumplimiento de inocuidad.",
          mockKey: "venc",
        },
        {
          title: "Audite el kardex",
          detail:
            "El kardex es el historial de un producto: cada entrada (compra, devolución, ajuste) y salida (venta, merma, uso interno) con su stock resultante. Desde aquí se investigan diferencias.",
        },
        {
          title: "Ejecute la toma física",
          detail:
            "Al auditar, genere una toma física: el sistema lista el stock teórico, usted carga el stock real contado, y las diferencias se aprueban y ajustan con su motivo.",
          mockKey: "toma",
        },
        {
          title: "Transfiera entre depósitos",
          detail:
            "Desde el módulo de transferencias mueva stock de un depósito a otro (salón → cámara) con su transportista, para que el inventario siga la mercadería real.",
        },
      ],
      mocks: {
        stock: {
          type: "table",
          title: "Stock actual por depósito",
          columns: [
            { label: "Producto", value: "nombre" },
            { label: "Salón", value: "salon" },
            { label: "Cámara", value: "camara" },
            { label: "Dep. Seco", value: "seco" },
            { label: "Mini­mo", value: "min" },
            { label: "Estado", value: "estado", badge: true },
          ],
          rows: [
            { nombre: "Carne vacío x kg", salon: 32, camara: 118, seco: 0, min: 40, estado: "OK", badge: "green" },
            { nombre: "Ala de pollo x kg", salon: 8, camara: 45, seco: 0, min: 30, estado: "Bajo", badge: "amber" },
            { nombre: "Leche larga vida 1L", salon: 48, camara: 0, seco: 210, min: 100, estado: "OK", badge: "green" },
            { nombre: "Queso Paraguay x kg", salon: 3, camara: 18, seco: 0, min: 20, estado: "Crítico", badge: "red" },
          ],
        },
        venc: {
          type: "table",
          title: "Vencimientos próximos (lotes)",
          columns: [
            { label: "Producto", value: "nombre" },
            { label: "Lote", value: "lote" },
            { label: "Vence", value: "vence" },
            { label: "Cant.", value: "cant" },
            { label: "Riesgo", value: "riesgo", badge: true },
          ],
          rows: [
            { nombre: "Yogurt frutilla 1L", lote: "L260814", vence: "12/09/2026", cant: 84, riesgo: "CRÍTICO", badge: "red" },
            { nombre: "Crema 200ml", lote: "L260820", vence: "20/09/2026", cant: 45, riesgo: "Pronto", badge: "amber" },
            { nombre: "Cerveza importada 355ml", lote: "L260701", vence: "30/11/2026", cant: 120, riesgo: "OK", badge: "green" },
          ],
        },
        toma: {
          type: "form",
          title: "Toma física de inventario",
          formFields: [
            { label: "Depósito", type: "select", value: "Salón principal", options: ["Salón principal", "Cámara fría", "Depósito seco"] },
            { label: "Producto (escanee o busque)", type: "text", placeholder: "Código o nombre…", required: true },
            { label: "Stock teórico", type: "number", value: "32" },
            { label: "Stock contado", type: "number", value: "31", required: true },
          ],
          caption: "Diferencia: −1 unidad. Motivo requerido antes de aprobar el ajuste.",
        },
      },
      tips: [
        "Mantenga la toma física en silencio de stock (sin ventas activas) para un conteo coherente.",
        "Las transferencias entre depósitos deben ser aprobadas: evita pérdidas de mercadería.",
      ],
      faq: [
        { q: "¿Cómo se calcula el stock «teórico»?", a: "Stock inicial + entradas (compras, devoluciones, transferencias recibidas) − salidas (ventas, mermas, transferencias enviadas). El kardex lo audita paso a paso." },
      ],
    },
    {
      id: "shrinkage",
      label: "Mermas (Shrinkage)",
      path: "/shrinkage",
      icon: AlertTriangle,
      tagline: "Detecte y reduzca la pérdida de mercadería",
      category: "Inventario",
      color: "red",
      description:
        "El control de mermas detecta pérdidas de mercadería por vencimiento, robo, rotura o errores. Muestra alertas automáticas de quiebres sospechosos, recomendaciones de mejora y permite registrar mermas y aplicar las recomendaciones directamente.",
      steps: [
        {
          title: "Revise el panel de mermas",
          detail:
            "El dashboard muestra el % de merma del período, el valor de la pérdida y las alertas automáticas: productos con descuentos de stock sin venta registrada (posible robo o error).",
          mockKey: "kpis",
        },
        {
          title: "Aplique recomendaciones",
          detail:
            "El sistema sugiere acciones: reforzar conteo en un sector, revisar cámara de la carnicería, ajustar pedidos de lácteos. Un clic marca la recomendación como aplicada.",
          mockKey: "recos",
        },
        {
          title: "Registre la merma",
          detail:
            "Al detectar pérdida (producto roto, vencido), regístrela con motivo. La toma física y el kardex la reflejan, y se mide el impacto económico.",
          mockKey: "form",
        },
      ],
      mocks: {
        kpis: {
          type: "kpiGrid",
          title: "Panel de mermas",
          kpis: [
            { label: "Merma del mes", value: "1,9%", sub: "meta: < 1,5%", color: "red", trend: "down" },
            { label: "Pérdida estimada", value: "₲ 83.700.000", sub: "vs ventas del mes", color: "amber" },
            { label: "Alertas activas", value: "7", sub: "2 altas", color: "red" },
            { label: "Sector con más merma", value: "Verdulería", sub: "29% del total", color: "purple" },
          ],
        },
        recos: {
          type: "list",
          title: "Recomendaciones de mejora",
          items: [
            { title: "Revisar cámara de la carnicería", sub: "Temperatura oscila 0.8°C en horas pico", badge: "Aplicar", badgeColor: "blue" },
            { title: "Reforzar conteo en Limpieza", sub: "3 diferencias de stock en 15 días", badge: "Aplicar", badgeColor: "amber" },
            { title: "Reducir pedido de lácteos los jueves", sub: "Se pierde el 6% por vencimiento corto", badge: "Aplicar", badgeColor: "red" },
          ],
        },
        form: {
          type: "form",
          title: "Registrar merma",
          formFields: [
            { label: "Producto", type: "text", placeholder: "Buscar por código…", required: true },
            { label: "Cantidad", type: "number", value: "2", required: true },
            { label: "Motivo", type: "select", value: "Vencido", options: ["Vencido", "Rotura", "Robo/hurto", "Error de carga", "Diferencia de inventario"] },
            { label: "Depósito", type: "select", value: "Salón", options: ["Salón", "Cámara", "Depósito seco"] },
          ],
        },
      },
      tips: [
        "Compare el % de merma por sector: verdulería y panadería suelen ser los más altos por frescura.",
      ],
    },
  ],
}