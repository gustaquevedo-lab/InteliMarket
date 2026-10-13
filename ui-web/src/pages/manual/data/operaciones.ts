import { LayoutGrid, Scan, Monitor, Scale, Carrot, ChefHat, ShieldCheck, Wrench } from "lucide-react"
import type { ManualCategory } from "../types"

export const operacionesCategory: ManualCategory = {
  id: "operaciones",
  label: "Operaciones de Salón",
  icon: LayoutGrid,
  gradient: "from-rose-600 to-red-700",
  description: "Las herramientas del piso de ventas: el hub de operaciones en tablets, el verificador de precios, las pantallas de carnicería y verdulería, el control de inocuidad y el mantenimiento.",
  subtitle: "La operación diaria del salón de ventas",
  modules: [
    {
      id: "hub-operaciones",
      label: "Hub Operaciones (PWA)",
      path: "/operaciones-salon",
      icon: LayoutGrid,
      tagline: "Central de operaciones del piso de ventas",
      category: "Operaciones de Salón",
      color: "rose",
      description:
        "El hub central de tareas del salón: nace como una PWA (Progressive Web App) que corre en tablets de operaciones. Desde acá se accede a las tareas de reposición, la pantalla de carnicería digital, el verificador de precios y las estaciones de trabajo del salón.",
      steps: [
        {
          title: "Encuentre la tarea correcta",
          detail:
            "El hub lista las estaciones de trabajo: carnicería, verdulería, panadería, recepción de mercadería. Use el acceso rápido según su labor del día.",
          mockKey: "accesos",
        },
        {
          title: "Instale como app (PWA)",
          detail:
            "Desde el navegador puede «Agregar a la pantalla de inicio»: el hub se comporta como una aplicación nativa, incluso sin conexión para tareas de recepción.",
        },
        {
          title: "Coordine la recepción",
          detail:
            "El depósito recibe mercadería escaneando: verifica cantidades, controla averías y asigna a stock.",
          mockKey: "recepcion",
        },
      ],
      mocks: {
        accesos: {
          type: "list",
          title: "Estaciones de trabajo",
          items: [
            { title: "Carnicería & Desposte", sub: "Desposte, rendimientos y etiquetas", badge: "Carnicería", badgeColor: "red" },
            { title: "Verdulería & Frescos", sub: "Recepción, frescura y markdown", badge: "Frescos", badgeColor: "green" },
            { title: "Panadería & Rotisería", sub: "Recetas y planes de producción", badge: "Panadería", badgeColor: "amber" },
            { title: "Recepción de mercadería", sub: "Hub del depósito con control de averías", badge: "Depósito", badgeColor: "blue" },
          ],
        },
        recepcion: {
          type: "table",
          title: "Recepción de mercadería",
          columns: [
            { label: "Orden", value: "orden" },
            { label: "Proveedor", value: "proveedor" },
            { label: "Unidades", value: "unidades" },
            { label: "Averías", value: "averias", badge: true },
            { label: "Estado", value: "estado", badge: true },
          ],
          rows: [
            { orden: "PO-1001", proveedor: "Coca Cola Paresa", unidades: 480, averias: "0", estado: "Recibida", badges: { averias: "green", estado: "green" } },
            { orden: "PO-1002", proveedor: "Frigorífico Concepción", unidades: 125, averias: "4", estado: "En recepción", badges: { averias: "red", estado: "amber" } },
            { orden: "PO-1003", proveedor: "Abasto Central", unidades: 320, averias: "1", estado: "Pendiente", badges: { averias: "amber", estado: "gray" } },
          ],
        },
      },
      tips: [
        "La PWA funciona sin conexión: las recepciones se guardan en el equipo y se sincronizan al volver al internet.",
      ],
    },
    {
      id: "verificador",
      label: "Verificador de Precios (Kiosko)",
      path: "/verificador",
      icon: Scan,
      tagline: "Autoservicio para consultar precios",
      category: "Operaciones de Salón",
      color: "cyan",
      description:
        "El kiosko autoservicio del salón: el cliente escanea el código de barras y ve el precio en pantalla gigante. Reduce consultas en caja y mejora la experiencia de compra.",
      steps: [
        {
          title: "Deje el kiosko listo",
          detail:
            "El verificador está en modo autoservicio: sin login. El cliente escanea o escribe el código y ve el precio del producto con su presentación.",
          mockKey: "kiosko",
        },
        {
          title: "Gestione el modo consulta",
          detail:
            "Desde la pantalla se pueden ver los últimos productos consultados. Ideal ubicado en sectores de alta rotación (bebidas, almacén).",
        },
        {
          title: "Revise reportes de uso",
          detail:
            "Las consultas se registran: sirven para saber qué productos se comparan más en precio dentro del salón.",
        },
      ],
      mocks: {
        kiosko: {
          type: "form",
          title: "Pantalla del verificador",
          formFields: [
            { label: "Escanee o ingrese el código", type: "text", value: "5449000000996", placeholder: "Código de barras…", required: true },
          ],
          caption: "Resultado: Coca-Cola 2.25L · ₲ 9.800 · Lista Mostrador. Emite un beep de confirmación y muestra el precio en tamaño grande.",
        },
      },
      faq: [
        { q: "¿Qué panel muestra el precio?", a: "Monitores tipo kiosko con bandera paraguaya y visualización de precio grande. Puede configurarse el saludo y colores corporativos." },
      ],
    },
    {
      id: "tv-carniceria",
      label: "TV Digital Carnicería (55\")",
      path: "/tv/carniceria",
      icon: Monitor,
      tagline: "Pantalla de precios de carnicería en vivo",
      category: "Operaciones de Salón",
      color: "slate",
      description:
        "La pantalla digital de 55 pulgadas en el mostrador de carnicería muestra los cortes, precios por kg y promociones, con reloj en vivo. Configurable desde el salón sin tocar código.",
      steps: [
        {
          title: "Configure la pantalla",
          detail:
            "Use el panel lateral para cambiar título, colores, y activar/desactivar la fecha y el reloj. La pantalla se vuelve el rótulo digital del mostrador.",
          mockKey: "config",
        },
        {
          title: "Administre los cortes",
          detail:
            "Cada corte (vacio, costilla, milanesa) con su precio por kg. Los precios se actualizan desde la carnicería y la TV los refleja al instante.",
          mockKey: "cortes",
        },
        {
          title: "Déjela en pantalla completa",
          detail:
            "La TV funciona a pantalla completa — ideal en un monitor dedicado. También rota con las ofertas si configura el modo promoción.",
        },
      ],
      mocks: {
        config: {
          type: "form",
          title: "Configuración de la TV",
          formFields: [
            { label: "Título", type: "text", value: "CARNICERÍA INTELIMARKET" },
            { label: "Mostrar reloj", type: "select", value: "Sí", options: ["Sí", "No"] },
            { label: "Mostrar fecha", type: "select", value: "Sí", options: ["Sí", "No"] },
            { label: "Color de fondo", type: "select", value: "Rojo carnicería", options: ["Rojo carnicería", "Azul", "Oscuro"] },
          ],
        },
        cortes: {
          type: "table",
          title: "Cortes en pantalla",
          columns: [
            { label: "Corte", value: "corte" },
            { label: "Precio x kg", value: "precio", currency: true },
            { label: "Promo", value: "promo", badge: true },
          ],
          rows: [
            { corte: "Vacio", precio: 69000, promo: "Oferta Sábado", badge: "green" },
            { corte: "Costilla", precio: 54000, promo: "—", badge: "gray" },
            { corte: "Milanesa", precio: 72000, promo: "—", badge: "gray" },
            { corte: "Pechuga de pollo", precio: 25000, promo: "2x ₲ 45.000", badge: "blue" },
          ],
        },
      },
      tips: [
        "Use esta pantalla también como cartelera de promociones del día (rota automáticamente).",
      ],
    },
    {
      id: "carniceria",
      label: "Carnicería & Desposte",
      path: "/desposte",
      icon: Scale,
      tagline: "Del animal a la góndola, medido",
      category: "Operaciones de Salón",
      color: "red",
      role: "Maestro Carnicero, Jefe de Sección Carnes y Fiambrería, Encargado de Salón",
      prerequisites: [
        "Media res o cuarto vacuno ingresado formalmente en el stock de la cámara de frío.",
        "Báscula de riel y balanza de mesa de corte calibradas y taradas a cero.",
        "Plantilla de desposte paraguaya seleccionada según el tipo de cuarto (delantero o trasero).",
      ],
      workflowOverview:
        "El carnicero retira la media res de la cámara, registra el pesaje inicial en gancho y procede al despiece siguiendo la plantilla técnica. A medida que corta (Costilla, Vacío, Lomo, Tapa Cuadril, Carnaza), pesa cada fracción y la asigna a: vitrina de atención, bandejas prepack o picada/cocina. El sistema da de baja el animal entero e ingresa los cortes con su costo ponderado exacto.",
      description:
        "La herramienta clave del carnicero profesional: descompone medias reses y cuartos en cortes comerciales (asado, vacío, tapa cuadril, puchero, bola de lomo), calculando el rendimiento porcentual, controlando las mermas de grasa/hueso y asignando el costo unitario a cada corte según su valor comercial.",
      tabs: [
        { id: "wizard", label: "Desposte" },
        { id: "templates", label: "Plantillas" },
        { id: "ordenes", label: "Órdenes" },
        { id: "rendimientos", label: "Rendimientos" },
      ],
      steps: [
        {
          title: "1. Selección de Materia Prima y Plantilla Técnica",
          detail:
            "Seleccione la especie (Vacuno, Cerdo o Pollo) y la pieza a despostar (ej. Cuarto Trasero de 128 kg). Elija la plantilla técnica: 'Parrillero 7 cortes' o 'Tradicional mostrador'. La plantilla predefine la lista estándar de cortes esperados.",
          mockKey: "wizard",
        },
        {
          title: "2. Pesaje de Cortes Obtenidos en Mesa",
          detail:
            "A medida que realiza el despiece, coloque cada corte sobre la balanza digital y asigne los kilos obtenidos. Especifique el destino operativo: 'Vitrina mostrador', 'Prepack con film termoencogible' o 'Materia prima para molida/embutidos'.",
          mockKey: "cortes",
        },
        {
          title: "3. Registro de Descarte, Grasa y Hueso",
          detail:
            "Pese el hueso pelado y el sebo/grasa residual. El sistema contrasta el peso total de cortes nobles + puchero/hueso + sebo contra el peso bruto inicial del animal para calcular el 'Desbaste de Faena'.",
        },
        {
          title: "4. Asentamiento en Stock y Costeo Automático",
          detail:
            "Al confirmar la orden, el cuarto original sale del inventario y entran automáticamente al catálogo los kilos exactos de cada corte con su costo ponderado, listos para facturar en las cajas y mostrar en la TV de carnicería.",
        },
        {
          title: "5. Auditoría de Rendimiento por Carnicero",
          detail:
            "Analice la gráfica de rendimientos históricos. Si un carnicero rinde 81% de carne vendible y otro 86% en el mismo tipo de novillo, el módulo permite detectar exceso de desecho o mala técnica de corte para capacitar al personal.",
          mockKey: "rend",
        },
      ],
      mocks: {
        wizard: {
          type: "form",
          title: "Nuevo desposte",
          formFields: [
            { label: "Especie", type: "select", value: "Vacuno", options: ["Vacuno", "Cerdo", "Pollo", "Caprino"] },
            { label: "Costado", type: "select", value: "Medio costado trasero", options: ["Medio costado trasero", "Medio costado delantero"] },
            { label: "Peso total (kg)", type: "number", value: "128" },
            { label: "Plantilla", type: "select", value: "Asado 5 cortes", options: ["Asado 5 cortes", "Parrillero 7 cortes", "Personalizado"] },
          ],
        },
        cortes: {
          type: "table",
          title: "Cortes del desposte",
          columns: [
            { label: "Corte", value: "corte" },
            { label: "Kg", value: "kg" },
            { label: "Uso", value: "uso" },
            { label: "Precio x kg", value: "precio", currency: true },
          ],
          rows: [
            { corte: "Vacio", kg: 22, uso: "Vitrina", precio: 69000 },
            { corte: "Costilla", kg: 31, uso: "Vitrina / Naifa", precio: 54000 },
            { corte: "Milanesa", kg: 18, uso: "Prepack", precio: 72000 },
            { corte: "Hueso y recorte", kg: 12, uso: "Descarte", precio: 15000 },
          ],
        },
        rend: {
          type: "chart",
          title: "Rendimiento promedio por especie",
          chart: {
            kind: "bar",
            unit: "%",
            points: [
              { label: "Vacuno", value: 84 },
              { label: "Cerdo", value: 88 },
              { label: "Pollo", value: 92 },
              { label: "Caprino", value: 81 },
            ],
          },
        },
      },
      useCases: [
        {
          title: "Caso 1: Desposte de Cuarto Trasero para preparación del fin de semana",
          scenario:
            "El viernes a las 06:00 AM el carnicero desposta un cuarto trasero de 120 kg para abastecer la vitrina de cortes parrilleros antes de la afluencia de clientes.",
          stepByStep: [
            "1. En Carnicería & Desposte, seleccione 'Nueva Orden de Desposte' y elija 'Cuarto Trasero Vacuno #4412'.",
            "2. Seleccione la plantilla 'Parrillero Tradicional'.",
            "3. Despiece y pese en la balanza: Costilla (32 kg), Vacío (16 kg), Tapa Cuadril (8 kg), Colita de Cuadril (5 kg), Carnaza Negra (24 kg), Puchero de Primera (14 kg), Grasa y Hueso Blanco (19 kg).",
            "4. Verifique la suma: 118 kg netos + 2 kg de desbaste por frío = 120 kg (100% de cuadre).",
            "5. Confirme la operación: el stock de cuarto trasero baja a 0 y se dan de alta los kilos de cada corte listo para la venta.",
          ],
          keyLesson:
            "Registrar el desposte el mismo momento en que se corta evita que el POS facture cortes 'sin stock' y mantiene la rentabilidad real de la carnicería en el PyG diario.",
        },
      ],
      commonErrors: [
        {
          error: "Diferencia de peso superior al 3% entre el animal entero y los cortes",
          cause: "Se omitió pesar el hueso blanco de descarte o la balanza de corte tenía tara residual.",
          solution:
            "Reverifique el peso del hueso y la grasa residual. La balanza debe volver a 0.000 kg antes de asentar cada corte.",
        },
      ],
      shortcutsOrHotkeys: [
        { key: "F4", action: "Iniciar nuevo desposte" },
        { key: "F7", action: "Tarar balanza de carnicería" },
      ],
      tips: [
        "Las mermas de recorte magro deben enviarse de inmediato a la picadora para elaborar carne molida especial y evitar degradación por contacto con el aire.",
      ],
      faq: [
        { q: "¿Puedo vender cortes directos del desposte?", a: "Sí, cada corte queda habilitado en la vitrina y se vende por kilo en el POS con su precio cargado." },
      ],
    },
    {
      id: "verduleria",
      label: "Verdulería & Frescos",
      path: "/frescos",
      icon: Carrot,
      tagline: "Frescura, recepción y descuentos en frescos",
      category: "Operaciones de Salón",
      color: "green",
      description:
        "Maneja la operación de verdulería y frutas: recepción de mercadería con control de frescura, monitoreo del estado de los productos y markdown progresivo de descuento para vender antes de que se estropee.",
      steps: [
        {
          title: "Reciba la mercadería fresca",
          detail:
            "Cargue la recepción del día: cada caja o kilo con su estado de frescura (excelente, buena, regular). El sistema calcula la pérdida esperada por demora.",
          mockKey: "recep",
        },
        {
          title: "Monitoree la frescura",
          detail:
            "La pestaña de frescura muestra cada producto, su antigüedad y un semáforo: verde (frescura óptima), ámbar (vender pronto), rojo (marcar o descartar).",
          mockKey: "frescura",
        },
        {
          title: "Aplique markdown",
          detail:
            "Cuando un producto vira a ámbar, aplique descuento progresivo (ej: −20%, −40%, −60%) para liquidarlo. El precio en góndola y caja se actualiza automáticamente.",
          mockKey: "markdown",
        },
      ],
      mocks: {
        recep: {
          type: "table",
          title: "Recepción de frescos — hoy",
          columns: [
            { label: "Producto", value: "producto" },
            { label: "Kg / uni", value: "cant" },
            { label: "Proveedor", value: "prov" },
            { label: "Frescura", value: "frescura", badge: true },
          ],
          rows: [
            { producto: "Tomate (caja 20kg)", cant: "3 cajas / 60kg", prov: "Abasto Central", frescura: "Buena", badge: "green" },
            { producto: "Banana (caja)", cant: "5 cajas / 90kg", prov: "Mercado 4", frescura: "Buena", badge: "green" },
            { producto: "Lechuga (atada)", cant: "12 atados", prov: "Abasto Central", frescura: "Regular", badge: "amber" },
            { producto: "Frutilla (12kg)", cant: "2 bandejas", prov: "Don Julián", frescura: "Excelente", badge: "green" },
          ],
        },
        frescura: {
          type: "list",
          title: "Semáforo de frescura",
          items: [
            { title: "Frutilla — antigüedad 1 día", sub: "Frescura óptima para vitrina", badge: "OK", badgeColor: "green" },
            { title: "Tomate — antigüedad 3 días", sub: "Vender en 24–48 hs o marcar", badge: "Pronto", badgeColor: "amber" },
            { title: "Lechuga — antigüedad 4 días", sub: "Marca o descarta: pierde valor", badge: "CRÍTICO", badgeColor: "red" },
          ],
        },
        markdown: {
          type: "table",
          title: "Markdown progresivo — Tomate",
          columns: [
            { label: "Día", value: "dia" },
            { label: "Precio x kg", value: "precio", currency: true },
            { label: "Descuento", value: "desc", badge: true },
          ],
          rows: [
            { dia: "Hoy (frescura buena)", precio: 12000, desc: "—", badge: "gray" },
            { dia: "Mañana", precio: 9600, desc: "−20%", badge: "blue" },
            { dia: "Pasado mañana", precio: 7200, desc: "−40%", badge: "amber" },
            { dia: "Día 4", precio: 4800, desc: "−60%", badge: "red" },
          ],
        },
      },
      tips: [
        "Configure el markdown automático: el sistema baja el precio solo según la frescura sin intervención manual.",
      ],
    },
    {
      id: "panaderia",
      label: "Panadería & Rotisería",
      path: "/panaderia-rotiseria",
      icon: ChefHat,
      tagline: "Recetas, planes de producción y rotisería",
      category: "Operaciones de Salón",
      color: "amber",
      description:
        "La caja de herramientas del panadero y del rotisero: recetas estándar (registradas para reproducir la misma calidad), planes de producción diaria por hora, y la operación de la rotisería con sus ventas y descartes.",
      tabs: [
        { id: "dashboard", label: "Dashboard" },
        { id: "recetas", label: "Recetas" },
        { id: "planes", label: "Planes de producción" },
        { id: "rotiseria", label: "Rotisería" },
        { id: "calc", label: "Calculadora" },
      ],
      steps: [
        {
          title: "Registre la receta",
          detail:
            "Cada producto horneado (pan francés, chipá, torta) tiene su receta con insumos y rendimiento. Al producir, el sistema descuenta los insumos del depósito automáticamente.",
          mockKey: "receta",
        },
        {
          title: "Planifique la producción",
          detail:
            "Cree el plan de horno por hora: cuántas hornadas de pan, a qué hora y en qué cantidad según el forecast de demanda por día de la semana.",
          mockKey: "plan",
        },
        {
          title: "Gestione la rotisería",
          detail:
            "La rotisería registra pollos asados, milanesas y guarniciones. Los vencidos del día se descartan o se descuentan al cierre (hora de rebaja).",
        },
        {
          title: "Use la calculadora de recetas",
          detail:
            "Escalé una receta: si la receta original es para 20 kilos y necesita 35, la calculadora ajusta todos los insumos y el costo automáticamente.",
          mockKey: "calc",
        },
      ],
      mocks: {
        receta: {
          type: "table",
          title: "Receta — Pan Francés (rendimiento 100 un)",
          columns: [
            { label: "Insumo", value: "insumo" },
            { label: "Cantidad", value: "cant" },
            { label: "Costo", value: "costo", currency: true },
          ],
          rows: [
            { insumo: "Harina 000", cant: "15 kg", costo: 75000 },
            { insumo: "Levadura", cant: "150 g", costo: 2450 },
            { insumo: "Sal", cant: "250 g", costo: 850 },
            { insumo: "Agua y energía", cant: "—", costo: 3200 },
          ],
        },
        plan: {
          type: "table",
          title: "Plan de horno del domingo",
          columns: [
            { label: "Hora", value: "hora" },
            { label: "Producto", value: "producto" },
            { label: "Unidades", value: "unidades" },
            { label: "Estado", value: "estado", badge: true },
          ],
          rows: [
            { hora: "05:00", producto: "Pan francés", unidades: 800, estado: "Producido", badge: "green" },
            { hora: "06:30", producto: "Chipá", unidades: 120, estado: "En horno", badge: "amber" },
            { hora: "09:00", producto: "Pan integral", unidades: 200, estado: "Programado", badge: "gray" },
            { hora: "11:00", producto: "Torta de vainilla", unidades: 12, estado: "Programado", badge: "gray" },
          ],
        },
        calc: {
          type: "form",
          title: "Calculadora de receta",
          formFields: [
            { label: "Receta base", type: "select", value: "Chipá (rend: 60 un)", options: ["Chipá (60 un)", "Pan francés (100 un)", "Pan integral (50 un)"] },
            { label: "Cantidad deseada", type: "number", value: "150 un" },
          ],
          caption: "Ajuste automático: harina +150%, levadura +150%… Costo calculado: ₲ 184.500.",
        },
      },
      faq: [
        { q: "¿Qué pasa con la producción no vendida?", a: "Al cierre se descuenta o se descuenta con rebaja. La rotisería permite marcar el descarte y la merma se registra en el control de mermas del supermercado." },
      ],
    },
    {
      id: "haccp",
      label: "Inocuidad & HACCP",
      path: "/haccp",
      icon: ShieldCheck,
      tagline: "Control de calidad de los alimentos",
      category: "Operaciones de Salón",
      color: "emerald",
      description:
        "Cumpla con el control de inocuidad alimentaria: registro de temperaturas de cámaras y vitrinas, control de puntos críticos HACCP, y auditorías de higiene en las áreas del salón.",
      steps: [
        {
          title: "Registre las temperaturas",
          detail:
            "Cargue las mediciones de cámaras y vitrinas según el plan (ej: cada 4 horas). Los valores fuera de rango generan alertas de acción inmediata.",
          mockKey: "temps",
        },
        {
          title: "Gestione los puntos críticos",
          detail:
            "Los CCP (puntos críticos de control) monitorean: temperatura de conservación, cocción, y limpieza. Cada control tiene su procedimiento y registro.",
        },
        {
          title: "Ejecute auditorías de higiene",
          detail:
            "Las auditorías evalúan áreas (carnicería, panadería) contra una checklist. Los hallazgos generan planes de acción con responsables y fechas.",
          mockKey: "audit",
        },
      ],
      mocks: {
        temps: {
          type: "table",
          title: "Registro de temperaturas — hoy",
          columns: [
            { label: "Equipo", value: "equipo" },
            { label: "Área", value: "area" },
            { label: "Temp", value: "temp" },
            { label: "Rango", value: "rango" },
            { label: "Estado", value: "estado", badge: true },
          ],
          rows: [
            { equipo: "Cámara fría carnes", area: "Carnicería", temp: "2.4°C", rango: "0–4°C", estado: "OK", badge: "green" },
            { equipo: "Vitrina lácteos", area: "Salón", temp: "5.2°C", rango: "0–5°C", estado: "OK", badge: "green" },
            { equipo: "Cámara rotisería", area: "Rotisería", temp: "6.8°C", rango: "0–4°C", estado: "FUERA", badge: "red" },
            { equipo: "Congelador", area: "Depósito", temp: "−18.5°C", rango: "≤−18°C", estado: "OK", badge: "green" },
          ],
        },
        audit: {
          type: "list",
          title: "Auditorías recientes",
          items: [
            { title: "Higiene carnicería", sub: "9/10 — hallazgo: orden de bandejas. Plan: 09/09", badge: "9/10", badgeColor: "green" },
            { title: "Higiene verdulería", sub: "8/10 — hallazgo: cajas en pasillo. Plan: 08/09", badge: "8/10", badgeColor: "amber" },
            { title: "Higiene panadería", sub: "10/10 — sin hallazgos", badge: "10/10", badgeColor: "green" },
          ],
        },
      },
      tips: [
        "Los responsables de área confirman cada registro con usuario y hora: queda trazabilidad completa.",
      ],
    },
    {
      id: "equipos",
      label: "Mantenimiento & Equipos",
      path: "/equipos-mantenimiento",
      icon: Wrench,
      tagline: "Equipos, órdenes de trabajo y mantenimiento",
      category: "Operaciones de Salón",
      color: "blue",
      description:
        "Registre los activos (cámaras, vitrinas, balanzas, freezers), programe el mantenimiento preventivo y genere órdenes de trabajo cuando algo falla. Algunas cámaras integran sensores IoT de temperatura que alertan automáticamente.",
      steps: [
        {
          title: "Registre el equipo",
          detail:
            "Cada activo (cámara, freezer, balanza) con su ubicación, marca, modelo y fecha de garantía o próximo mantenimiento.",
          mockKey: "equipos",
        },
        {
          title: "Programe el preventivo",
          detail:
            "Defina la frecuencia (ej: limpieza de condensadora trimestral). El sistema avisa cuando vence y permite generar la orden de trabajo.",
        },
        {
          title: "Genere y cierre órdenes de trabajo",
          detail:
            "Cuando falla un equipo, cree la OT: qué equipo, qué síntoma, repuestos usados y costo. El histórico del equipo queda registrado.",
          mockKey: "ots",
        },
      ],
      mocks: {
        equipos: {
          type: "table",
          title: "Equipos del salón",
          columns: [
            { label: "Equipo", value: "equipo" },
            { label: "Área", value: "area" },
            { label: "Próx. mantenimiento", value: "prox" },
            { label: "Estado", value: "estado", badge: true },
          ],
          rows: [
            { equipo: "Cámara fría carnes", area: "Carnicería", prox: "12/09/2026", estado: "Operativo", badge: "green" },
            { equipo: "Vitrina de lácteos", area: "Salón", prox: "20/09/2026", estado: "Operativo", badge: "green" },
            { equipo: "Báscula GC-01", area: "Verdulería", prox: "05/09/2026", estado: "Vencido", badge: "red" },
            { equipo: "Freezer −18°", area: "Depósito", prox: "15/10/2026", estado: "Operativo", badge: "green" },
          ],
        },
        ots: {
          type: "list",
          title: "Órdenes de trabajo abiertas",
          items: [
            { title: "OT-021 — Báscula GC-01", sub: "No pesa correctamente · Técnico asignado · 05/09", badge: "En curso", badgeColor: "amber" },
            { title: "OT-022 — Cámara rotisería", sub: "Temperatura fuera de rango · sensor IoT", badge: "Urgente", badgeColor: "red" },
            { title: "OT-020 — Puerta freezer", sub: "Cierre defectuoso · Cotización recibida", badge: "Pendiente", badgeColor: "blue" },
          ],
        },
      },
      faq: [
        { q: "¿Cómo alertan los sensores IoT?", a: "Las cámaras con sensor ESP32 envían temperatura en vivo. Si sale del rango, se genera alerta automática y notificación por WhatsApp al responsable." },
      ],
    },
  ],
}