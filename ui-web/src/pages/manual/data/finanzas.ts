import { Banknote, Landmark, CreditCard, DollarSign, ReceiptText, Building } from "lucide-react"
import type { ManualCategory } from "../types"

export const finanzasCategory: ManualCategory = {
  id: "finanzas",
  label: "Tesorería & Finanzas",
  icon: Landmark,
  gradient: "from-amber-600 via-orange-600 to-amber-700",
  description:
    "El circuito integral del dinero en Extra Supermercado: apertura y cierre de caja con arqueo ciego, custodia y remesas en bóveda central, cuentas bancarias y conciliación, cheques en cartera, cuentas por cobrar, pagos a proveedores con retenciones, gastos operativos y flujo de caja proyectado.",
  subtitle: "Control total del efectivo, créditos, bancos, pasivos y rentabilidad operativa",
  modules: [
    {
      id: "caja",
      label: "Arqueo y Cierre de Caja",
      path: "/caja",
      icon: Banknote,
      tagline: "Apertura multimoneda, control de turno, arqueo ciego y cierre fiscal",
      category: "Tesorería & Finanzas",
      color: "amber",
      role: "Cajeras/os de turno, Supervisores de Salón y Encargados de Tesorería",
      prerequisites: [
        "Usuario personal habilitado con rol de Cajero y contraseña activa.",
        "Punto de emisión fiscal asignado y timbrado legal vigente (Timbrado 18545636).",
        "Fondo fijo de arranque entregado en sobre sellado por Bóveda Central (ej: ₲ 2.000.000 y R$ 200 en cambio menudo).",
        "Impresora térmica de tickets conectada con papel continuo de 80mm cargado.",
      ],
      workflowOverview:
        "Cada cajero inicia su turno con un fondo fijo en guaraníes y reales. Durante la jornada cobra ventas en múltiples medios de pago. Cuando la gaveta acumula exceso de efectivo, realiza retiros parciales (sangrías) a Bóveda Central con sobre precintado. Al finalizar, ejecuta el arqueo ciego contando billete por billete; el sistema compara el dinero físico contra las ventas del sistema, emite el acta fiscal de cierre y detecta cualquier faltante o sobrante.",
      description:
        "Gestiona el ciclo de vida completo de la sesión de caja a través de sus 4 pestañas operativas: Apertura con fondo multimoneda, Registro de movimientos y retiros de seguridad a Bóveda, Arqueo ciego final con desglose por denominación y Auditoría del Cajero Solidario.",
      tabs: [
        { id: "apertura", label: "1. Apertura & Turno" },
        { id: "movimientos", label: "2. Movimientos & Retiros" },
        { id: "arqueo", label: "3. Arqueo & Cierre Ciego" },
        { id: "solidario", label: "4. Cajero Solidario" },
      ],
      steps: [
        {
          title: "Pestaña 1: Apertura de Turno con Fondo Fijo Multimoneda",
          detail:
            "Al iniciar la jornada, ingrese a la pestaña 'Apertura & Turno'. El sistema solicita confirmar el fondo inicial entregado por Bóveda Central. Verifique y cuente el dinero físico antes de aceptar. Ingrese el importe en Guaraníes (ej. ₲ 2.000.000) y, si su caja atiende cambio fronterizo, el monto en Reales (ej. R$ 200). Al pulsar 'Abrir Sesión de Caja', la sesión queda bloqueada con su usuario y vinculada al Punto de Emisión fiscal asignado.",
        },
        {
          title: "Pestaña 2: Movimientos del Turno, Ingresos y Retiros (Sangrías)",
          detail:
            "Esta pestaña audita en vivo todo lo que entra y sale de la gaveta:\n" +
            "• Cobros del POS: Se desglosan automáticamente por medio (Efectivo ₲, Efectivo R$, Tarjetas Dinelco/Bancard, QR y Créditos).\n" +
            "• Ingresos Diversos: Registre cobros de cuotas de clientes que se acercan a pagar su cuenta corriente en mostrador.\n" +
            "• Retiros de Seguridad a Bóveda (Sangría): Por norma de Extra Supermercado, cuando el efectivo acumulado supera ₲ 10.000.000, pulse 'Nuevo Retiro a Bóveda'. Digite el monto, imprima el comprobante por duplicado, coloque el dinero en el sobre precintado y entréguelo al tesorero supervisor.",
          mockKey: "movimientos",
        },
        {
          title: "Pestaña 3: Arqueo Ciego de Cierre y Emisión de Acta Fiscal",
          detail:
            "Al terminar el turno laboral, pase a la pestaña 'Arqueo & Cierre'. El sistema implementa la modalidad de Arqueo Ciego: la pantalla NO muestra lo que debería haber, obligando al cajero a contar y declarar la cantidad física exacta de billetes de ₲ 100.000, ₲ 50.000, ₲ 20.000, ₲ 10.000, ₲ 5.000, ₲ 2.000, monedas y billetes de Reales.\n" +
            "Al confirmar el conteo, el sistema revela el calce:\n" +
            "• Diferencia Cero (Exacto): Cierre perfecto.\n" +
            "• Faltante: El cajero debe justificar la causa y firmar el acta de descuento o descargo.\n" +
            "• Sobrante: Se ingresa como ingreso extraordinario de caja.\n" +
            "Se imprime el Acta de Cierre Fiscal con firma obligatoria del cajero y supervisor.",
          mockKey: "arqueo",
        },
        {
          title: "Pestaña 4: Cajero Solidario (Auditoría de Redondeo Social)",
          detail:
            "En esta pestaña se audita el micro-redondeo donado voluntariamente por los clientes durante el día (ej. vueltos redondeados a favor de la campaña solidaria). Muestra la cantidad de clientes que aceptaron donar, el importe total recaudado en la caja y su derivación contable a la cuenta de custodia social, asegurando que no se mezcle con la ganancia operativa del supermercado.",
        },
      ],
      mocks: {
        movimientos: {
          type: "table",
          title: "Movimientos del Turno — Caja 02 (Turno Tarde)",
          columns: [
            { label: "Hora", value: "hora" },
            { label: "Tipo Movimiento", value: "tipo" },
            { label: "Detalle / Comprobante", value: "detalle" },
            { label: "Medio Pago", value: "medio" },
            { label: "Importe (₲)", value: "monto", currency: true },
          ],
          rows: [
            { hora: "14:00", tipo: "Apertura de Turno", detalle: "Fondo fijo de arranque inicial", medio: "Efectivo ₲", monto: 2000000 },
            { hora: "15:20", tipo: "Ventas Acumuladas POS", detalle: "Cobranza tickets #1040 a #1085", medio: "Efectivo ₲", monto: 6850000 },
            { hora: "16:45", tipo: "Retiro a Bóveda (Sangría)", detalle: "Sobre precintado #B-4412 entregado a tesorero", medio: "Efectivo ₲", monto: -5000000 },
            { hora: "17:10", tipo: "Ingreso Diverso", detalle: "Cobro cuota crédito cliente RUC 4521098-1", medio: "Efectivo ₲", monto: 1200000 },
          ],
        },
        arqueo: {
          type: "table",
          title: "Planilla de Arqueo Ciego de Cierre — Desglose de Billetes",
          columns: [
            { label: "Denominación", value: "denominacion" },
            { label: "Cantidad Contada Físicamente", value: "cantidad" },
            { label: "Subtotal Declarado", value: "subtotal", currency: true },
          ],
          rows: [
            { denominacion: "Billetes de ₲ 100.000", cantidad: "42 unidades", subtotal: 4200000 },
            { denominacion: "Billetes de ₲ 50.000", cantidad: "26 unidades", subtotal: 1300000 },
            { denominacion: "Billetes de ₲ 20.000", cantidad: "18 unidades", subtotal: 360000 },
            { denominacion: "Billetes de ₲ 10.000", cantidad: "35 unidades", subtotal: 350000 },
            { denominacion: "Monedas y Menudo ₲", cantidad: "Lote monedas", subtotal: 140000 },
            { denominacion: "Billetes Reales (R$ 100)", cantidad: "4 billetes (x 1.450)", subtotal: 580000 },
          ],
        },
      },
      useCases: [
        {
          title: "Caso 1: Ejecución de un retiro parcial (sangría) por acumulación de efectivo en hora pico",
          scenario:
            "A las 18:30 hs, el cajero nota que su gaveta física contiene más de ₲ 12.000.000 en billetes tras una racha intensa de ventas en efectivo.",
          stepByStep: [
            "1. En el módulo de Caja, pulse 'Nuevo Retiro a Bóveda'.",
            "2. Ingrese el monto a evacuar: ₲ 8.000.000.",
            "3. El sistema imprime el Vale de Sangría por duplicado con fecha, hora y número de sesión.",
            "4. Coloque los billetes junto con la copia del vale dentro del sobre de seguridad y anote el número de precinto plástico.",
            "5. Entregue el sobre en ventanilla de Bóveda Central. El tesorero firma la copia del cajero y confirma la recepción en el sistema.",
            "6. La gaveta queda descongestionada con ₲ 4.000.000 para seguir dando vuelto con total seguridad.",
          ],
          keyLesson:
            "Las sangrías periódicas reducen al mínimo el riesgo de pérdidas ante eventuales siniestros en el salón de ventas.",
        },
      ],
      commonErrors: [
        {
          error: "Diferencia en arqueo ciego: 'Faltante de ₲ 20.000'",
          cause: "Error de vuelto entregado de más a un cliente durante una venta rápida.",
          solution:
            "El cajero debe revisar debajo de la gaveta extraíble por si cayó algún billete. Si persiste la diferencia, se asienta en el acta con la firma del supervisor para su tratamiento según política interna.",
        },
      ],
      shortcutsOrHotkeys: [
        { key: "F7", action: "Abrir formulario de Arqueo Ciego" },
        { key: "F9", action: "Registrar Retiro a Bóveda (Sangría)" },
      ],
      tips: [
        "Cuente siempre los billetes de mayor denominación (₲ 100.000 y ₲ 50.000) dos veces antes de cerrar el sobre de entrega.",
      ],
      faq: [
        {
          q: "¿Qué sucede si el cajero debe entregar su caja a un relevo?",
          a: "Debe realizar el cierre completo de su sesión con su propio arqueo ciego. El cajero que toma el relevo iniciará una nueva sesión con su propio fondo de arranque.",
        },
      ],
    },
    {
      id: "boveda",
      label: "Bóveda Central y Custodia",
      path: "/boveda",
      icon: Landmark,
      tagline: "Custodia de caudales, recepción de remesas de cajas y depósitos blindados",
      category: "Tesorería & Finanzas",
      color: "amber",
      role: "Tesorero General, Jefe de Finanzas y Gerente de Tienda",
      prerequisites: [
        "Permisos de alta seguridad asignados en el sistema.",
        "Llaves y combinación de la caja fuerte de seguridad de Bóveda Central.",
        "Precintos numerados inviolables y talonarios de remesa bancaria.",
      ],
      workflowOverview:
        "Bóveda Central administra el fondo maestro de efectivo de Extra Supermercado. Recibe los sobres de sangría y de cierre de las cajas registradoras, verifica que lo físico recibido coincida con lo registrado en el sistema (Calce de Cajas), custodia las divisas extranjeras (R$ y USD) y prepara las valijas de caudales para los camiones blindados hacia las cuentas corrientes bancarias.",
      description:
        "La torre de seguridad física del dinero. Se compone de 4 pestañas operativas: Estado de Custodia de fondos en bóveda, Recepción de Remesas de cajas, Calce Diario de Cajas con auditoría de discrepancias por cajero, y Preparación de Remesas Bancarias.",
      tabs: [
        { id: "custodia", label: "1. Estado de Custodia" },
        { id: "recepcion-cajas", label: "2. Recepción de Remesas" },
        { id: "calce", label: "3. Calce Diario de Cajas" },
        { id: "depositos", label: "4. Remesas a Bancos" },
      ],
      steps: [
        {
          title: "Pestaña 1: Estado de Custodia en Bóveda Central",
          detail:
            "Monitorea el saldo físico total resguardado en la caja fuerte de seguridad. Desglosa los importes por moneda: Guaraníes, Reales (R$) y Dólares (USD). Compara el saldo actual contra el límite máximo cubierto por la póliza de seguros de la tienda (ej. límite ₲ 100.000.000), advirtiendo en amarillo cuando se debe programar el retiro del camión blindado.",
          mockKey: "custodia",
        },
        {
          title: "Pestaña 2: Recepción y Validación de Remesas de Cajas",
          detail:
            "Al recibir un sobre de retiro de una caja registradora, el tesorero abre esta pestaña. Selecciona la caja emisora (ej. Caja 03), ingresa el número de precinto del sobre, cuenta el efectivo físico en la estación de conteo bajo cámara de seguridad y pulsa 'Confirmar Recepción'. El dinero ingresa formalmente al stock de custodia de Bóveda.",
        },
        {
          title: "Pestaña 3: Calce Diario de Cajas (Auditoría de Diferencias)",
          detail:
            "Cruza de forma automática lo facturado por el sistema en cada caja versus los retiros entregados en Bóveda versus el sobre final de cierre. Si una caja arroja faltante o sobrante, la fila se resalta en rojo con el nombre del cajero responsable, la terminal y el monto exacto de descuadre para su análisis.",
          mockKey: "calce",
        },
        {
          title: "Pestaña 4: Armado de Remesas Bancarias (Camión Blindado)",
          detail:
            "Cuando se programa el depósito en el banco, ingrese a 'Remesas a Bancos'. Pulse '+ Nueva Remesa'. Seleccione la cuenta bancaria de destino (ej. Banco Continental cta. 80150377-9), faje los billetes de a 100 unidades por denominación, coloque los fajos en la tula de seguridad con su precinto y genere la Guía de Remesa por triplicado para la entrega a los custodios del camión de caudales. Los fondos pasan al estado 'En Tránsito'.",
        },
      ],
      mocks: {
        custodia: {
          type: "kpiGrid",
          title: "Posición Física en Bóveda Central — Extra Supermercado",
          kpis: [
            { label: "Saldo Total en Custodia", value: "₲ 84.350.000", sub: "Efectivo físico auditado", color: "green", trend: "up" },
            { label: "Custodia en Reales", value: "R$ 6.840,00", sub: "Equiv. ₲ 9.918.000", color: "purple" },
            { label: "Límite Máximo Asegurado", value: "₲ 100.000.000", sub: "84,3% de capacidad utilizada", color: "amber" },
            { label: "Remesa en Tránsito (Blindado)", value: "₲ 45.000.000", sub: "Banco Continental — Dep. #7721", color: "blue" },
          ],
        },
        calce: {
          type: "table",
          title: "Calce Diario de Remesas por Caja — Turno Tarde",
          columns: [
            { label: "Caja / Terminal", value: "caja" },
            { label: "Cajero Responsable", value: "cajero" },
            { label: "Ventas Sistema", value: "sistema", currency: true },
            { label: "Recibido en Bóveda", value: "recibido", currency: true },
            { label: "Diferencia de Calce", value: "dif", badge: true },
          ],
          rows: [
            { caja: "Caja 01", cajero: "Marta Benítez", sistema: 24500000, recibido: 24500000, dif: "Exacto (₲ 0)", badge: "green" },
            { caja: "Caja 02", cajero: "Esteban Duarte", sistema: 18900000, recibido: 18900000, dif: "Exacto (₲ 0)", badge: "green" },
            { caja: "Caja 03", cajero: "Claudia Vera", sistema: 21350000, recibido: 21350000, dif: "Exacto (₲ 0)", badge: "green" },
            { caja: "Caja 04", cajero: "Marcos Rolón", sistema: 15400000, recibido: 15390000, dif: "−₲ 10.000", badge: "red" },
          ],
        },
      },
      useCases: [
        {
          title: "Caso 1: Entrega de valija de depósito blindado a transportadora de caudales",
          scenario:
            "El camión de caudales arriba a la sucursal para retirar ₲ 75.000.000 de la recaudación del fin de semana.",
          stepByStep: [
            "1. En Bóveda -> pestaña 'Remesas a Bancos', pulse '+ Nueva Remesa'.",
            "2. Seleccione la cuenta corriente de Banco Continental.",
            "3. Ingrese el desglose de los 750 billetes de ₲ 100.000 fajados.",
            "4. Coloque los fajos en la tula inviolable y anote el número de precinto.",
            "5. Imprima la Guía de Remesa por triplicado.",
            "6. Verifique el carnet de los custodios del camión blindado, entregue la tula y haga firmar las copias.",
          ],
          keyLesson:
            "Nunca marque un depósito como 'Acreditado' hasta que el dinero figure efectivamente en el extracto online del banco. Mientras tanto, debe permanecer en 'Fondos en Tránsito'.",
        },
      ],
      commonErrors: [
        {
          error: "Diferencia entre el monto declarado en el sobre y el dinero físico contado",
          cause: "El cajero empaquetó un billete de menor valor o contó erróneamente.",
          solution:
            "Detenga la validación, convoque de inmediato al cajero y supervisor para realizar el reconteo bajo cámara de seguridad y emita la constancia de discrepancia firmada.",
        },
      ],
      shortcutsOrHotkeys: [
        { key: "F4", action: "Validar nuevo sobre de remesa de caja" },
        { key: "F8", action: "Generar nueva remesa a banco" },
      ],
      tips: [
        "Mantenga siempre fajos preparados de billetes menudos (₲ 2.000, ₲ 5.000 y ₲ 10.000) para abastecer rápidamente de cambio a las cajas en horas pico.",
      ],
      faq: [
        {
          q: "¿Quién autoriza ajustes por diferencias de calce en bóveda?",
          a: "Exclusivamente la Gerencia de Tienda o la Jefatura Administrativa tras auditar la grabación de la cámara de conteo.",
        },
      ],
    },
    {
      id: "bancos",
      label: "Cuentas Bancarias & Conciliación",
      path: "/bancos",
      icon: Landmark,
      tagline: "Saldos bancarios, importación de extractos y conciliación automática",
      category: "Tesorería & Finanzas",
      color: "blue",
      role: "Jefe de Finanzas, Contador General y Auxiliar de Tesorería",
      prerequisites: [
        "Cuentas corrientes y cajas de ahorro creadas en el sistema con sus números y bancos oficiales.",
        "Acceso a Home Banking corporativo (Banco Continental, Itaú) para descarga de extractos.",
        "Configuración de cuentas recaudadoras de procesadoras de tarjetas (Bancard / Dinelco).",
      ],
      workflowOverview:
        "Consolida todas las cuentas bancarias de Extra Supermercado. Permite importar los extractos oficiales del banco en Excel/CSV, ejecutar el pareo inteligente entre los movimientos del sistema y los movimientos del banco, registrar transferencias entre cuentas propias y conciliar liquidaciones de tarjetas de crédito y QR descontando comisiones bancarias.",
      description:
        "Control bancario integral estructurado en 4 pestañas: Posición Consolidada de liquidez en bancos, Libro de Movimientos Bancarios, Conciliación Bancaria con pareo automático inteligente y Transferencias entre Cuentas Propias.",
      tabs: [
        { id: "posicion", label: "1. Posición Consolidada" },
        { id: "movimientos", label: "2. Movimientos Bancarios" },
        { id: "conciliacion", label: "3. Conciliación Bancaria" },
        { id: "transferencias", label: "4. Transferencias Propias" },
      ],
      steps: [
        {
          title: "Pestaña 1: Posición Consolidada de Cuentas Bancarias",
          detail:
            "Presenta el saldo disponible en tiempo real en cada cuenta corriente y caja de ahorro habilitada (Banco Continental en ₲ y R$, Banco Itaú). Muestra tres indicadores clave: Disponible Líquido Inmediato, Cheques Girados Pendientes de Débito y Depósitos en Compensación.",
          mockKey: "posicion",
        },
        {
          title: "Pestaña 2: Libro Mayor de Movimientos Bancarios",
          detail:
            "Audite la totalidad de débitos (pagos a proveedores por transferencia SIPAP, débitos de cheques, comisiones bancarias) y créditos (acreditación de remesas de bóveda, liquidación de ventas por tarjeta Bancard/Dinelco, transferencias recibidas de clientes). Permite filtrar por fecha, banco, tipo de operación o número de referencia.",
        },
        {
          title: "Pestaña 3: Conciliación Bancaria y Pareo Automático",
          detail:
            "Descargue el extracto oficial de su banco e impórtelo en esta pestaña. Al pulsar 'Ejecutar Pareo Inteligente', el sistema cruza cada renglón del extracto contra los registros del sistema por coincidencia de monto, fecha y número de comprobante. Las partidas que coinciden se marcan en verde ('Conciliado'). Para comisiones de tarjetas o gastos de cuenta, pulse 'Contabilizar Gasto' para imputar la diferencia al instante.",
          mockKey: "conciliacion",
        },
        {
          title: "Pestaña 4: Transferencias entre Cuentas Propias",
          detail:
            "Cuando se requiere redistribuir fondos (ej. trasladar recaudación acumulada en Banco Itaú hacia Banco Continental para cubrir un lote de pagos a proveedores), pulse 'Nueva Transferencia Propia'. Indique cuenta de origen, cuenta de destino, importe y referencia bancaria. La operación genera el débito y crédito simultáneo en el sistema sin distorsionar los ingresos operativos.",
        },
      ],
      mocks: {
        posicion: {
          type: "kpiGrid",
          title: "Posición Bancaria Consolidada — Extra Supermercado",
          kpis: [
            { label: "Banco Continental Cta Cte", value: "₲ 284.500.000", sub: "Cta. 80150377-9 (Principal)", color: "green", trend: "up" },
            { label: "Banco Itaú Cta Cte", value: "₲ 142.800.000", sub: "Cta. 12004561-2 (Recaudación)", color: "blue" },
            { label: "Continental (Caja Ahorro R$)", value: "R$ 48.200,00", sub: "Equiv. ₲ 69.890.000", color: "purple" },
            { label: "Total Liquidez Disponible", value: "₲ 497.190.000", sub: "En 3 cuentas bancarias activas", color: "green" },
          ],
        },
        conciliacion: {
          type: "table",
          title: "Conciliación Bancaria con Pareo — Banco Continental",
          columns: [
            { label: "Fecha", value: "fecha" },
            { label: "Concepto / Descripción del Banco", value: "concepto" },
            { label: "Monto Banco", value: "banco", currency: true },
            { label: "Monto Sistema", value: "sistema", currency: true },
            { label: "Estado", value: "estado", badge: true },
          ],
          rows: [
            { fecha: "05/09", concepto: "Depósito Remesa Bóveda #7721", banco: 45000000, sistema: 45000000, estado: "Conciliado", badge: "green" },
            { fecha: "06/09", concepto: "Liquidación POS Bancard/Dinelco", banco: 38420000, sistema: 38420000, estado: "Conciliado", badge: "green" },
            { fecha: "06/09", concepto: "Comisión POS Tarjetas (2,5%)", banco: -960500, sistema: -960500, estado: "Conciliado", badge: "green" },
            { fecha: "07/09", concepto: "Impuesto / Retención IVA Bancario", banco: -96050, sistema: 0, estado: "Por Contabilizar", badge: "amber" },
          ],
        },
      },
      useCases: [
        {
          title: "Caso 1: Conciliación de liquidación de ventas por tarjeta con retención de comisión",
          scenario:
            "El banco acredita ₲ 9.750.000 por ventas con tarjeta del fin de semana, pero el POS totalizó ₲ 10.000.000. La diferencia de ₲ 250.000 corresponde a la retención de la procesadora.",
          stepByStep: [
            "1. En Bancos -> pestaña 'Conciliación Bancaria', seleccione el renglón del extracto de ₲ 9.750.000.",
            "2. En la lista de ventas del sistema, seleccione el lote de ₲ 10.000.000.",
            "3. Pulse 'Conciliar con Diferencia de Comisión'.",
            "4. El sistema imputa automáticamente los ₲ 250.000 a la cuenta de gastos 'Comisiones Bancarias y Tarjetas'.",
            "5. Ambos lados quedan perfectamente en cero y conciliados.",
          ],
          keyLesson:
            "Nunca modifique las ventas del POS para que cuadren con el banco. El POS refleja la venta al cliente y el módulo bancario contabiliza el costo de intermediación.",
        },
      ],
      commonErrors: [
        {
          error: "Diferencia persistente entre el saldo contable y el extracto del banco",
          cause: "Cheques entregados a proveedores que aún no fueron cobrados en ventanilla bancaria.",
          solution:
            "Consulte el reporte de 'Cheques Girados y no Cobrados' para conciliar la partida flotante.",
        },
      ],
      shortcutsOrHotkeys: [
        { key: "Ctrl + I", action: "Importar extracto bancario en Excel/CSV" },
        { key: "Ctrl + M", action: "Ejecutar pareo automático inteligente" },
      ],
      tips: [
        "Concilie las cuentas bancarias todas las mañanas antes de las 10:00 hs para tener certeza del saldo disponible antes de autorizar compras.",
      ],
      faq: [
        {
          q: "¿Qué formato de archivo bancario se debe importar?",
          a: "Archivos Excel (.xlsx) o texto (.csv) estándar descargados del Home Banking corporativo de Banco Continental o Itaú.",
        },
      ],
    },
    {
      id: "cheques",
      label: "Gestión de Cheques",
      path: "/cheques",
      icon: CreditCard,
      tagline: "Custodia de cheques de clientes, cheques propios emitidos y rechazos",
      category: "Tesorería & Finanzas",
      color: "indigo",
      role: "Tesorero, Encargado de Créditos y Cobranzas, Gerencia Administrativa",
      prerequisites: [
        "Cheque físico original recibido con firmas, importes y fechas legibles.",
        "Evaluación previa de antecedentes del librador (sin antecedentes de cheques rechazados).",
      ],
      workflowOverview:
        "Administra la cartera de cheques físicos recibidos de clientes como medio de pago o cobranza de crédito, así como los cheques emitidos por Extra Supermercado para pagar a proveedores. Controla los vencimientos de cheques diferidos, coordina el depósito bancario y activa alertas automáticas ante cheques rechazados por falta de fondos.",
      description:
        "Panel especializado de control de cheques estructurado en 4 pestañas operativas: Cartera de cheques recibidos, Cheques propios emitidos a proveedores, Cheques depositados en compensación y Cheques rechazados en mora.",
      tabs: [
        { id: "cartera", label: "1. Cheques en Cartera" },
        { id: "emitidos", label: "2. Cheques Emitidos" },
        { id: "depositados", label: "3. Depositados (Compensación)" },
        { id: "rechazados", label: "4. Rechazados / En Mora" },
      ],
      steps: [
        {
          title: "Pestaña 1: Cheques Recibidos en Cartera",
          detail:
            "Al recibir un cheque como pago en caja o en cobranzas, regístrelo en esta pestaña: Banco emisor (Continental, Itaú, GNB, etc.), número de cheque, RUC/C.I. del librador, monto en ₲, fecha de emisión y fecha pactada de cobro diferido. El cheque queda bajo custodia de Bóveda en estado 'En Cartera'.",
          mockKey: "cartera",
        },
        {
          title: "Pestaña 2: Cheques Propios Emitidos a Proveedores",
          detail:
            "Controla todos los cheques emitidos por la empresa para cancelar facturas de proveedores. Permite auditar qué cheques tienen vencimiento en la semana corriente para asegurar que la cuenta corriente de Banco Continental mantenga los fondos suficientes para su débito.",
        },
        {
          title: "Pestaña 3: Cheques Depositados en Compensación Bancaria",
          detail:
            "Cuando se cumple la fecha de cobro de un cheque de cliente, márquelo y pulse 'Depositar en Banco'. Seleccione la cuenta receptora. El cheque pasa a la pestaña 'Depositados' durante las 48 horas hábiles de compensación de la Cámara Compensadora de Cheques.",
        },
        {
          title: "Pestaña 4: Tratamiento Urgente de Cheques Rechazados",
          detail:
            "Si el banco rechaza un cheque (por falta de fondos, cuenta cancelada o firma desconforme), trasládelo a 'Rechazados'. El sistema reabre automáticamente la deuda en la cuenta corriente del cliente, anula el recibo original, suma los gastos bancarios de rechazo y bloquea el crédito del cliente en todas las cajas.",
          mockKey: "rechazados",
        },
      ],
      mocks: {
        cartera: {
          type: "table",
          title: "Cheques Recibidos en Cartera — Bóveda Central",
          columns: [
            { label: "Nº Cheque", value: "numero" },
            { label: "Banco Emisor", value: "banco" },
            { label: "Cliente / Titular", value: "cliente" },
            { label: "Importe", value: "monto", currency: true },
            { label: "Fecha Cobro", value: "vence" },
            { label: "Estado", value: "estado", badge: true },
          ],
          rows: [
            { numero: "8412091", banco: "Banco Continental", cliente: "Despensa Don Pedro", monto: 12500000, vence: "Hoy (07/09)", estado: "Por Depositar", badge: "amber" },
            { numero: "3319024", banco: "Banco Itaú", cliente: "Comercial San Cayetano", monto: 8700000, vence: "12/09/2026", estado: "En Cartera", badge: "blue" },
            { numero: "5512001", banco: "Banco GNB", cliente: "Distribuidora del Este", monto: 19400000, vence: "18/09/2026", estado: "En Cartera", badge: "blue" },
          ],
        },
        rechazados: {
          type: "list",
          title: "Gestión de Cheques Rechazados — Alertas de Cobranza",
          items: [
            { title: "Nº 119842 — Itaú — ₲ 6.500.000", sub: "Cliente: Minimarket Los Amigos · Motivo: Sin fondos suficientes · Rechazado el 04/09", badge: "Crédito Bloqueado", badgeColor: "red" },
            { title: "Nº 772109 — Sudameris — ₲ 4.200.000", sub: "Cliente: Autoservice Central · Motivo: Firma no coincide · Rechazado el 02/09", badge: "En Canje", badgeColor: "amber" },
          ],
        },
      },
      useCases: [
        {
          title: "Caso 1: Cobro de compra mayorista con cheque diferido a 30 días",
          scenario:
            "Un cliente mayorista realiza una compra de ₲ 15.000.000 en artículos de almacén y entrega un cheque diferido a 30 días de Banco Continental.",
          stepByStep: [
            "1. Verifique en el sistema que el cliente no tenga cheques rechazados previos.",
            "2. En el POS o en Cobranzas, cargue el cheque con su número, banco e importe.",
            "3. Solicite al cliente que endose el cheque con su firma, C.I. y teléfono.",
            "4. Guarde el cheque en la gaveta de Bóveda: el sistema emitirá la alerta automática a los 30 días para su depósito.",
          ],
          keyLesson:
            "Verifique siempre que el importe en letras coincida con el número y que la fecha de cobro no exceda los 30 días de la política comercial.",
        },
      ],
      commonErrors: [
        {
          error: "Cheque caducado por superar el plazo legal de presentación",
          cause: "Pasaron más de 30 días de la fecha de cobro indicada en el cheque y no fue presentado al banco.",
          solution:
            "Contacte de inmediato al librador para gestionar el canje físico del cheque por uno nuevo o pago en efectivo.",
        },
      ],
      shortcutsOrHotkeys: [
        { key: "Ctrl + C", action: "Registrar nuevo cheque en cartera" },
      ],
      tips: [
        "Fotocopie o digitalice el anverso y reverso de todo cheque de monto superior a ₲ 10.000.000 antes de enviarlo al banco.",
      ],
      faq: [
        {
          q: "¿Qué sucede con el cliente cuando su cheque es rechazado?",
          a: "El sistema lo clasifica automáticamente como deudor moroso y bloquea cualquier venta a crédito en las cajas.",
        },
      ],
    },
    {
      id: "cuentas-cobrar",
      label: "Cuentas por Cobrar & Créditos",
      path: "/accounts-receivable",
      icon: DollarSign,
      tagline: "Facturas a crédito, matriz de aging (antigüedad de deuda) y recibos oficiales",
      category: "Tesorería & Finanzas",
      color: "emerald",
      role: "Encargado de Créditos y Cobranzas, Tesorería, Facturación",
      prerequisites: [
        "Cliente registrado en el maestro con RUC o Cédula y límite de crédito habilitado.",
        "Factura fiscal emitida a crédito en POS o mostrador mayorista.",
      ],
      workflowOverview:
        "Administra la cartera de deudores de Extra Supermercado. Clasifica las deudas de clientes por franjas de vencimiento (Aging), califica el comportamiento de pago (Scoring crediticio), emite Recibos Oficiales de Cobranza e imputa los pagos cancelando comprobantes pendientes.",
      description:
        "Control exhaustivo de la cartera de deudores organizado en 4 pestañas: Facturas con Saldo pendiente, Matriz de Aging de deuda, Scoring Crediticio de clientes y Emisión de Recibos Oficiales de Cobranza.",
      tabs: [
        { id: "documentos", label: "1. Facturas con Saldo" },
        { id: "aging", label: "2. Matriz de Aging" },
        { id: "scoring", label: "3. Scoring de Clientes" },
        { id: "recibos", label: "4. Recibos de Cobranza" },
      ],
      steps: [
        {
          title: "Pestaña 1: Facturas a Crédito con Saldo Pendiente",
          detail:
            "Lista todas las facturas emitidas bajo condición Crédito que aún no fueron saldadas. Muestra: número de factura timbrada, razón social del cliente, fecha de emisión, fecha de vencimiento pactado, monto original, abonos parciales y saldo neto adeudado. Permite filtrar por cliente o estado (Corriente, Por Vencer en 7 días, Vencida).",
          mockKey: "docs",
        },
        {
          title: "Pestaña 2: Matriz de Aging (Antigüedad de Cartera)",
          detail:
            "Agrupa la totalidad de la deuda en 5 franjas cronológicas: Corriente (sin vencer), Mora de 1 a 30 días, Mora de 31 a 60 días, Mora de 61 a 90 días y Más de 90 días (crítico). Permite priorizar la gestión telefónica y judicial de cobranzas antes de que la deuda se vuelva incobrable.",
          mockKey: "aging",
        },
        {
          title: "Pestaña 3: Scoring y Evaluación Crediticia de Clientes",
          detail:
            "El sistema evalúa el historial de pago de cada cliente mayorista y le asigna una categoría (A: Excelente, B: Regular, C: Riesgoso, D: Moroso Bloqueado). Permite aumentar o reducir el límite de crédito disponible según su puntualidad histórica.",
        },
        {
          title: "Pestaña 4: Emisión de Recibos Oficiales de Cobranza",
          detail:
            "Al recibir el pago de un cliente en efectivo, cheque o transferencia bancaria, pulse 'Nuevo Recibo'. Indique el monto cobrado e impute a la factura correspondiente (por defecto a la más antigua). Al confirmar, el sistema emite el Recibo Oficial timbrado numerado y cancela el saldo de la factura.",
        },
      ],
      mocks: {
        docs: {
          type: "table",
          title: "Facturas a Crédito Pendientes de Cobro",
          columns: [
            { label: "Nº Factura Fiscal", value: "factura" },
            { label: "Cliente / Razón Social", value: "cliente" },
            { label: "Fecha Venc.", value: "vence" },
            { label: "Saldo Pendiente", value: "saldo", currency: true },
            { label: "Días Atraso", value: "dias" },
            { label: "Estado", value: "estado", badge: true },
          ],
          rows: [
            { factura: "001-012-00014501", cliente: "Supermercado Don Pedro", vence: "05/09", saldo: 45200000, dias: "2 días", estado: "Vencida", badge: "red" },
            { factura: "001-012-00014577", cliente: "Despensa El Centro", vence: "12/09", saldo: 12850000, dias: "En plazo", estado: "Corriente", badge: "green" },
            { factura: "001-012-00014612", cliente: "Carnicería Santa Rosa", vence: "20/09", saldo: 9810000, dias: "En plazo", estado: "Corriente", badge: "green" },
          ],
        },
        aging: {
          type: "chart",
          title: "Distribución de Cartera por Antigüedad (Aging)",
          chart: {
            kind: "bar",
            unit: "₲ Millones",
            points: [
              { label: "Al Día (Corriente)", value: 148 },
              { label: "1 a 30 Días", value: 72 },
              { label: "31 a 60 Días", value: 38 },
              { label: "61 a 90 Días", value: 19 },
              { label: "+90 Días (Crítico)", value: 12 },
            ],
          },
        },
      },
      useCases: [
        {
          title: "Caso 1: Imputación de pago mixto para cancelar una factura vencida y abonar a una corriente",
          scenario:
            "Un cliente adeuda una factura de ₲ 5.000.000 vencida y otra de ₲ 3.000.000 al día. Abona ₲ 6.000.000 por transferencia bancaria.",
          stepByStep: [
            "1. En Cuentas por Cobrar -> pestaña 'Recibos', pulse 'Nuevo Recibo'.",
            "2. Cargue la transferencia bancaria comprobada de ₲ 6.000.000.",
            "3. Impute ₲ 5.000.000 a la factura vencida (saldo ₲ 0, cancelada).",
            "4. Impute ₲ 1.000.000 a la factura corriente (saldo restante ₲ 2.000.000).",
            "5. Guarde y envíe el Recibo Oficial en PDF por WhatsApp al cliente.",
          ],
          keyLesson:
            "Impute siempre los pagos a los documentos más antiguos para mantener el historial de crédito saneado.",
        },
      ],
      commonErrors: [
        {
          error: "Venta a crédito bloqueada en caja por límite de crédito excedido",
          cause: "El cliente superó el monto asignado o registra facturas vencidas impagas.",
          solution:
            "El cliente debe abonar sus facturas pendientes para liberar saldo disponible de crédito.",
        },
      ],
      shortcutsOrHotkeys: [
        { key: "F3", action: "Buscar estado de cuenta de cliente" },
        { key: "Ctrl + R", action: "Generar nuevo Recibo de Cobranza" },
      ],
      tips: [
        "Revise la matriz de Aging los lunes antes del mediodía para coordinar los avisos de cobranza preventiva.",
      ],
      faq: [
        {
          q: "¿Qué ocurre si un cliente abona de más?",
          a: "El excedente se registra automáticamente como anticipo / saldo a favor para sus próximas compras.",
        },
      ],
    },
    {
      id: "cuentas-pagar",
      label: "Cuentas por Pagar (AP)",
      path: "/payments",
      icon: ReceiptText,
      tagline: "Facturas de proveedores, calendario de pagos, retenciones fiscales y lotes SIPAP",
      category: "Tesorería & Finanzas",
      color: "blue",
      role: "Encargado de Cuentas a Pagar, Jefe de Compras, Tesorería",
      prerequisites: [
        "Factura del proveedor conciliada mediante Matching a 3 Vías.",
        "Perfil fiscal del proveedor configurado para retenciones de IVA/Renta de la SET/DNIT.",
        "Disponibilidad de fondos en la cuenta bancaria pagadora.",
      ],
      workflowOverview:
        "Administra los compromisos financieros de Extra Supermercado con sus proveedores comerciales (Casa Gonzalito S.R.L., frigoríficos, distribuidores de bebidas). Organiza las facturas por fecha de vencimiento, conforma lotes de pago masivos para transferencia bancaria SIPAP o cheques, emite comprobantes de retención fiscal y mantiene la relación comercial impecable.",
      description:
        "Control de pasivos comerciales organizado en 4 pestañas operativas: Facturas por Pagar habilitadas, Matriz de Aging de Proveedores, Generación de Lotes de Pago Masivo y Comprobantes de Retención Tributaria.",
      tabs: [
        { id: "facturas", label: "1. Facturas por Pagar" },
        { id: "aging-ap", label: "2. Aging Proveedores" },
        { id: "lotes", label: "3. Lotes de Pago Masivo" },
        { id: "retenciones", label: "4. Comprobantes de Retención" },
      ],
      steps: [
        {
          title: "Pestaña 1: Facturas Habilitadas para Pago",
          detail:
            "Lista todas las facturas de compra aprobadas por el Matching a 3 Vías. Cada renglón detalla: proveedor, RUC, número de factura timbrada, fecha de emisión, fecha límite de pago y condición comercial (ej. 30 o 45 días). Solo los documentos conciliados pueden seleccionarse para pago.",
          mockKey: "facturas",
        },
        {
          title: "Pestaña 2: Aging de Proveedores (Calendario de Obligaciones)",
          detail:
            "Presenta el cronograma de vencimientos de pasivos comerciales distribuidos por semanas. Permite a Tesorería prever cuántos guaraníes se requerirán en Banco Continental los martes y jueves (días habituales de pago a proveedores de Extra Supermercado).",
        },
        {
          title: "Pestaña 3: Generación de Lotes de Pago Masivo",
          detail:
            "Seleccione múltiples facturas de un mismo proveedor o de varios proveedores. El sistema calcula el importe total bruto, descuenta las retenciones fiscales automáticas y genera la Orden de Pago por el monto neto. Permite exportar el archivo para transferencias bancarias SIPAP masivas en Banco Continental o generar los cheques correspondientes.",
          mockKey: "lotes",
        },
        {
          title: "Pestaña 4: Emisión de Comprobantes de Retención Fiscal",
          detail:
            "Al procesar el pago, el sistema emite el Comprobante de Retención Electrónico oficial (con numeración timbrada de la empresa) aplicando la tasa legal correspondiente (ej. 30% del IVA consignado en la factura). Se exporta en PDF para su remisión al proveedor.",
        },
      ],
      mocks: {
        facturas: {
          type: "table",
          title: "Facturas de Proveedores Habilitadas para Pago",
          columns: [
            { label: "Nº Factura Proveedor", value: "numero" },
            { label: "Proveedor / Razón Social", value: "proveedor" },
            { label: "Vencimiento", value: "vence" },
            { label: "Monto Bruto", value: "total", currency: true },
            { label: "Retención Est.", value: "ret", currency: true },
            { label: "Estado", value: "estado", badge: true },
          ],
          rows: [
            { numero: "001-004-0001122", proveedor: "Frigorífico Concepción S.A.", vence: "10/09", total: 22350000, ret: 609545, estado: "En Fecha", badge: "green" },
            { numero: "001-002-0008891", proveedor: "La Pradera Lácteos", vence: "12/09", total: 15840000, ret: 432000, estado: "En Fecha", badge: "green" },
            { numero: "001-001-0002210", proveedor: "Cervepar S.A.", vence: "05/09", total: 42100000, ret: 1148181, estado: "Vencida", badge: "red" },
          ],
        },
        lotes: {
          type: "form",
          title: "Generación de Lote de Pago Masivo — Proveedores",
          formFields: [
            { label: "Proveedor Seleccionado", type: "select", value: "Frigorífico Concepción S.A." },
            { label: "Facturas a Cancelar", type: "text", value: "Facturas #001-004-0001122 y #001-004-0001180 (2 docs)" },
            { label: "Monto Neto a Transferir", type: "number", value: "₲ 38.450.000" },
            { label: "Cuenta Bancaria Pagadora", type: "select", value: "Banco Continental Cta Cte Gs 80150377-9" },
            { label: "Retención Aplicada (IVA 30%)", type: "text", value: "₲ 1.048.636 (Comprobante Retención #001-001-00214)" },
          ],
        },
      },
      useCases: [
        {
          title: "Caso 1: Pago a proveedor mayorista con retención fiscal de IVA del 30%",
          scenario:
            "Se procesa el pago de una factura de ₲ 22.000.000 de Casa Gonzalito S.R.L. con condición crédito 30 días.",
          stepByStep: [
            "1. En Cuentas por Pagar -> 'Lotes de Pago Masivo', seleccione la factura.",
            "2. El sistema calcula la base imponible y aplica la retención del 30% del IVA (₲ 600.000).",
            "3. El importe neto a transferir queda fijado en ₲ 21.400.000.",
            "4. Confirme la transferencia vía Banco Continental.",
            "5. El sistema emite la constancia de retención oficial para remitir por correo al proveedor.",
          ],
          keyLesson:
            "Aplicar las retenciones tributarias en el momento exacto del pago evita inconsistencias impositivas ante la SET/DNIT.",
        },
      ],
      commonErrors: [
        {
          error: "Factura bloqueada para pago con aviso 'Matching a 3 vías no superado'",
          cause: "Hubo diferencias de precio o faltantes en el muelle de descarga que requieren Nota de Crédito.",
          solution:
            "Compras debe gestionar la Nota de Crédito del proveedor antes de que Tesorería pueda liberar el pago.",
        },
      ],
      shortcutsOrHotkeys: [
        { key: "Ctrl + L", action: "Generar nuevo Lote de Pago" },
      ],
      tips: [
        "Programe los pagos a proveedores con 24 horas de antelación para que Tesorería confirme los saldos disponibles.",
      ],
      faq: [
        {
          q: "¿Qué porcentaje de retención de IVA aplica el sistema?",
          a: "Aplica el 30% del IVA consignado en la factura de bienes para proveedores locales, según normativa de la SET/DNIT.",
        },
      ],
    },
    {
      id: "gastos",
      label: "Gastos Operativos & Fondos Rotativos",
      path: "/gastos",
      icon: ReceiptText,
      tagline: "Caja chica por sector, rendición de gastos y centros de costo",
      category: "Tesorería & Finanzas",
      color: "orange",
      role: "Administración, Jefes de Sector (Carnicería, Salón, Depósito), Tesorería",
      prerequisites: [
        "Fondo fijo de caja chica asignado a los responsables de sector.",
        "Comprobantes legales válidos con RUC 80150377-9 (Grupo Santa Teresa E.A.S.).",
      ],
      workflowOverview:
        "Registra todos los egresos menores y gastos operativos diarios del supermercado (artículos de limpieza, reparaciones urgentes, fletes menores, insumos de panadería y carnicería). Administra los fondos rotativos asignados a cada área, controla los comprobantes con IVA deducible y alimenta los Centros de Costo para el Estado de Resultados.",
      description:
        "Control exhaustivo de gastos menores organizado en 4 pestañas operativas: Registro de Gastos con factura legal, Estado de Fondos Rotativos de cada sector, Rendición y Reposición de Fondos, y Análisis de Gastos por Centro de Costo.",
      tabs: [
        { id: "registro", label: "1. Registrar Gasto" },
        { id: "fondos", label: "2. Fondos Rotativos" },
        { id: "rendiciones", label: "3. Rendición de Fondos" },
        { id: "analisis", label: "4. Gastos por Centro de Costo" },
      ],
      steps: [
        {
          title: "Pestaña 1: Registro del Gasto con Comprobante Legal",
          detail:
            "Ingrese el comprobante del gasto: RUC y razón social del comercio emisor, número timbrado, fecha, concepto claro (ej. 'Compra de cinta de embalaje y bolsas para fiambrería') e importe total desglosando la tasa de IVA (10% o 5%).",
          mockKey: "gasto",
        },
        {
          title: "Pestaña 2: Monitoreo de Fondos Rotativos por Sector",
          detail:
            "Visualice el saldo disponible de cada fondo fijo asignado: Caja Chica Administración (₲ 2.000.000), Fondo Rotativo Carnicería (₲ 1.000.000), Fondo Depósito & Logística (₲ 1.500.000). Alerta en rojo cuando el disponible cae bajo el 30%.",
          mockKey: "fondos",
        },
        {
          title: "Pestaña 3: Rendición de Cajas Chicas y Reposición",
          detail:
            "Cuando el fondo se agota, el responsable compila los comprobantes físicos y genera la rendición en el sistema. Tesorería audita las facturas y emite la reposición por cheque o transferencia para restablecer el fondo al 100%.",
        },
        {
          title: "Pestaña 4: Análisis de Gastos por Centro de Costo",
          detail:
            "Grafica la distribución del gasto operativo entre los sectores: Salón de Ventas, Depósito Central, Carnicería, Panadería/Rotisería y Administración, permitiendo detectar desviaciones presupuestarias.",
        },
      ],
      mocks: {
        gasto: {
          type: "form",
          title: "Nuevo Registro de Gasto Operativo",
          formFields: [
            { label: "Descripción / Concepto", type: "text", value: "Reparación motor compresor cámara de frío carnicería", required: true },
            { label: "Categoría de Gasto", type: "select", value: "Mantenimiento & Reparaciones" },
            { label: "Centro de Costo Destino", type: "select", value: "Carnicería & Fiambrería" },
            { label: "Monto Total Pagado", type: "number", value: "₲ 850.000", required: true },
            { label: "IVA Discriminado", type: "select", value: "IVA 10% (₲ 77.273)" },
            { label: "Fondo Utilizado", type: "select", value: "Fondo Rotativo Carnicería" },
          ],
        },
        fondos: {
          type: "list",
          title: "Estado de Fondos Rotativos por Área",
          items: [
            { title: "Caja Chica Administración — ₲ 2.000.000", sub: "Disponible: ₲ 1.420.000 · Estado operativo", badge: "Operativo", badgeColor: "green" },
            { title: "Fondo Depósito & Logística — ₲ 1.500.000", sub: "Disponible: ₲ 280.000 · Umbral mínimo superado", badge: "Reponer Urgente", badgeColor: "red" },
            { title: "Fondo Carnicería & Elaboración — ₲ 1.000.000", sub: "Disponible: ₲ 850.000 · Estado operativo", badge: "Operativo", badgeColor: "green" },
          ],
        },
      },
      useCases: [
        {
          title: "Caso 1: Rendición semanal de fondo fijo de depósito para reposición",
          scenario:
            "El jefe de depósito gastó ₲ 1.220.000 en insumos de embalaje y flete de emergencia.",
          stepByStep: [
            "1. En Gastos -> 'Rendición de Fondos', seleccione 'Fondo Depósito'.",
            "2. Marque las facturas que componen los ₲ 1.220.000.",
            "3. Verifique que todas tengan el RUC 80150377-9 de Extra Supermercado.",
            "4. Pulse 'Cerrar Rendición y Solicitar Reposición'.",
            "5. Tesorería audita los comprobantes y emite el cheque de reposición por ₲ 1.220.000.",
          ],
          keyLesson:
            "Ningún fondo se repone sin la presentación de comprobantes fiscales válidos que justifiquen el gasto.",
        },
      ],
      commonErrors: [
        {
          error: "Comprobante rechazado por timbrado vencido o sin RUC del supermercado",
          cause: "El empleado trajo una boleta simple o una factura con fecha posterior a la vigencia del timbrado.",
          solution:
            "El proveedor emisor debe anular el documento y emitir una factura legal válida.",
        },
      ],
      shortcutsOrHotkeys: [
        { key: "Ctrl + G", action: "Abrir formulario rápido de carga de gasto" },
      ],
      tips: [
        "Exija siempre facturas a nombre de 'GRUPO SANTA TERESA E.A.S.' con RUC '80150377-9' para aprovechar el crédito fiscal del IVA.",
      ],
      faq: [
        {
          q: "¿Cada cuánto tiempo se debe rendir un fondo rotativo?",
          a: "Todos los viernes o en el momento en que se haya utilizado más del 70% del fondo disponible.",
        },
      ],
    },
    {
      id: "pyg-diario",
      label: "PyG Diario por Departamento",
      path: "/pyg-diario",
      icon: DollarSign,
      tagline: "Estado de resultados diario por sección comercial (Carnes, Almacén, Frescos)",
      category: "Tesorería & Finanzas",
      color: "fuchsia",
      role: "Gerente General, Gerente de Tienda, Jefes de Departamento Comercial",
      prerequisites: [
        "Cierre de ventas del día consolidado en las cajas de cobro.",
        "Costeo de mercadería actualizado (CMV automático).",
        "Imputación de mermas y gastos directos del sector.",
      ],
      workflowOverview:
        "Proporciona la radiografía más potente del supermercado: el Estado de Pérdidas y Ganancias (PyG) en tiempo real por departamento (Carnicería, Verdulería/Frutería, Panadería, Almacén, Bebidas, Limpieza). Muestra cuánto vendió cada sector, cuál fue su costo de mercadería, su margen comercial bruto, sus mermas operativas y sus gastos directos, determinando la utilidad neta real de cada área.",
      description:
        "Cuadro de resultados económico organizado en 4 pestañas operativas: Dashboard Ejecutivo del PyG del día, Desglose por Departamento comercial, Análisis de Margen Bruto % y Control de Gastos y Mermas Directas.",
      tabs: [
        { id: "dashboard", label: "1. Dashboard Ejecutivo" },
        { id: "departamentos", label: "2. Desglose por Depto" },
        { id: "margenes", label: "3. Análisis de Margen %" },
        { id: "gastos-directos", label: "4. Gastos y Mermas Directas" },
      ],
      steps: [
        {
          title: "Pestaña 1: Dashboard Ejecutivo de Resultados del Día",
          detail:
            "Presenta la rentabilidad global de la jornada: Ventas Netas Totales, Costo de Mercadería Vendida (CMV), Margen Bruto en guaraníes y en porcentaje (meta promedio: 24%), y el impacto total de mermas del día.",
          mockKey: "resultado",
        },
        {
          title: "Pestaña 2: Desglose por Departamento Comercial",
          detail:
            "Segrega la operación entre las áreas: Carnicería & Fiambrería, Panadería & Rotisería, Verdulería & Frutería, y Almacén/Bebidas. Permite identificar qué sectores aportan volumen con bajo margen (Almacén 16-18%) y cuáles aportan margen alto (Panadería 45-50%).",
          mockKey: "deptos",
        },
        {
          title: "Pestaña 3: Análisis de Margen % y Rentabilidad de Góndola",
          detail:
            "Compara el margen bruto obtenido contra la meta presupuestada de cada sector, identificando qué familias comerciales sufrieron deterioro de rentabilidad debido a promociones o aumentos de costo no trasladados a góndola.",
        },
        {
          title: "Pestaña 4: Gastos y Mermas Directas por Sector",
          detail:
            "Audita el impacto de las mermas registradas (descartes biológicos en frescos, roturas en salón) y los costos directos de personal del área para calcular la verdadera 'Utilidad Operativa Neta' del departamento.",
        },
      ],
      mocks: {
        resultado: {
          type: "kpiGrid",
          title: "Estado de Resultados Diario — Extra Supermercado",
          kpis: [
            { label: "Ventas Netas Hoy", value: "₲ 148.350.000", sub: "+8,2% vs meta diaria", color: "green", trend: "up" },
            { label: "Costo de Venta (CMV)", value: "₲ 112.540.000", sub: "75,8% de la venta total", color: "blue" },
            { label: "Margen Bruto Total", value: "₲ 35.810.000", sub: "Margen promedio: 24,2%", color: "purple", trend: "up" },
            { label: "Mermas y Desperdicios", value: "₲ 2.150.000", sub: "1,45% sobre venta (Normal)", color: "amber" },
          ],
        },
        deptos: {
          type: "table",
          title: "Rentabilidad por Departamento Comercial — Hoy",
          columns: [
            { label: "Departamento", value: "depto" },
            { label: "Venta Neta", value: "ventas", currency: true },
            { label: "Margen Bruto", value: "margen", badge: true },
            { label: "Gastos y Mermas", value: "gastos", currency: true },
            { label: "Resultado Neto", value: "resultado", currency: true },
          ],
          rows: [
            { depto: "Panadería & Rotisería", ventas: 38600000, margen: "49,5%", badge: "green", gastos: 6800000, resultado: 12307000 },
            { depto: "Carnicería & Fiambrería", ventas: 87200000, margen: "28,2%", badge: "green", gastos: 14200000, resultado: 10390400 },
            { depto: "Verdulería & Frutería", ventas: 41500000, margen: "22,0%", badge: "amber", gastos: 7900000, resultado: 1230000 },
            { depto: "Almacén, Bebidas y Limpieza", ventas: 128400000, margen: "17,8%", badge: "blue", gastos: 11500000, resultado: 11355200 },
          ],
        },
      },
      useCases: [
        {
          title: "Caso 1: Detección de pérdida oculta en verdulería por exceso de merma y ajuste de compras",
          scenario:
            "El PyG diario revela que Verdulería tuvo mermas de ₲ 4.800.000 (más del 10% de su venta), arrojando resultado negativo.",
          stepByStep: [
            "1. En el PyG Diario, abra el detalle de 'Verdulería & Frutería'.",
            "2. En la pestaña 'Gastos y Mermas Directas', identifique los productos con mayor descarte (tomate y lechuga).",
            "3. Se comprueba que se compraron 50 cajones cuando la venta histórica era de solo 30 cajones.",
            "4. Acción correctiva: Reducir el pedido de compra del día siguiente y activar oferta 2x1 antes de las 14:00 hs.",
          ],
          keyLesson:
            "El PyG diario permite detectar fugas de dinero en el mismo día en que ocurren, evitando sorpresas al cierre de mes.",
        },
      ],
      commonErrors: [
        {
          error: "Margen negativo en un departamento",
          cause: "Se cargó un producto con costo erróneo superior al precio de venta.",
          solution:
            "Verifique el costo del artículo en Catálogo y ajuste la recepción de compra errónea.",
        },
      ],
      shortcutsOrHotkeys: [
        { key: "Ctrl + D", action: "Filtrar PyG por departamento" },
      ],
      tips: [
        "Comparta el porcentaje de margen semanal con los encargados de carnicería y panadería para incentivar el control de desperdicios.",
      ],
      faq: [
        {
          q: "¿Con qué frecuencia se actualiza el PyG Diario?",
          a: "En tiempo real con cada ticket cobrado en el POS y cada comprobante de gasto o merma asentado.",
        },
      ],
    },
    {
      id: "financiero",
      label: "Gestión Financiera & Cashflow",
      path: "/financiero",
      icon: Building,
      tagline: "Tablero financiero general, presupuestos mensuales y proyección de flujo de fondos",
      category: "Tesorería & Finanzas",
      color: "slate",
      role: "Director Financiero, Gerente General, Socios Propietarios",
      prerequisites: [
        "Presupuesto operativo mensual cargado por partidas.",
        "Saldos bancarios y compromisos de pago a proveedores actualizados.",
      ],
      workflowOverview:
        "Proporciona la visión macro de la salud financiera de Extra Supermercado. Integra los ingresos por ventas proyectadas y cobranzas, con los egresos obligatorios (proveedores, nómina de sueldos, energía ANDE, impuestos). Proyecta el Flujo de Caja (Cashflow) a 30 y 60 días, alertando anticipadamente si la liquidez proyectada perfora el umbral del colchón de contingencia.",
      description:
        "Panel financiero de alta dirección organizado en 4 pestañas operativas: Dashboard Ejecutivo de indicadores consolidados (EBITDA, margen operativo), Flujo de Caja (Cashflow proyectado), Control Presupuestario (Presupuesto vs Ejecutado) y Ratios Financieros de liquidez.",
      tabs: [
        { id: "dashboard", label: "1. Dashboard Ejecutivo" },
        { id: "cashflow", label: "2. Flujo de Caja (Cashflow)" },
        { id: "presupuestos", label: "3. Control Presupuestario" },
        { id: "indicadores", label: "4. Ratios Financieros" },
      ],
      steps: [
        {
          title: "Pestaña 1: Dashboard Ejecutivo de Indicadores Consolidados",
          detail:
            "Monitorea los 4 pilares financieros del mes: Facturación Total Neta, Costo de Mercadería Vendida (CMV), Gastos Operativos Totales (OPEX) y el EBITDA generado en guaraníes y porcentaje sobre ventas.",
          mockKey: "dash",
        },
        {
          title: "Pestaña 2: Proyección de Flujo de Fondos (Cashflow a 30 Días)",
          detail:
            "Grafica día a día las entradas estimadas de dinero versus los egresos comprometidos. Una línea roja horizontal marca el 'Colchón de Seguridad Mínimo' (₲ 100.000.000). Si la curva desciende por debajo de esa línea en alguna semana, el sistema alerta un posible déficit para reprogramar pagos.",
          mockKey: "flujo",
        },
        {
          title: "Pestaña 3: Control Presupuestario por Partida (Presupuesto vs Ejecutado)",
          detail:
            "Compara el gasto presupuestado vs el gasto ejecutado a la fecha para cada partida operativa: Nómina Salarial, Energía Eléctrica ANDE, Publicidad/Marketing y Mantenimiento Edilicio, con semáforos verde, amarillo y rojo.",
          mockKey: "presup",
        },
        {
          title: "Pestaña 4: Ratios Financieros & Días de Caja",
          detail:
            "Calcula en tiempo real los ratios clave de la empresa: Días de Caja Disponible (meta: > 45 días de cobertura sin ventas), Período Medio de Cobranza (DSO) y Rotación de Cuentas por Pagar (DPO).",
        },
      ],
      mocks: {
        dash: {
          type: "kpiGrid",
          title: "Indicadores Financieros Consolidados — Mes Actual",
          kpis: [
            { label: "Facturación Total", value: "₲ 4.405.900.000", sub: "Cumplimiento meta: 104,2%", color: "green", trend: "up" },
            { label: "Costo de Mercadería (CMV)", value: "₲ 3.348.484.000", sub: "76,0% de las ventas", color: "blue" },
            { label: "Gastos Operativos (OPEX)", value: "₲ 531.860.000", sub: "12,1% de las ventas", color: "amber" },
            { label: "EBITDA Operativo", value: "₲ 525.556.000", sub: "11,9% de margen neto operativo", color: "purple", trend: "up" },
          ],
        },
        flujo: {
          type: "chart",
          title: "Curva de Flujo de Fondos Proyectado (Próximas 5 Semanas)",
          chart: {
            kind: "area",
            unit: "₲ Millones",
            points: [
              { label: "Sem 1", value: 340 },
              { label: "Sem 2", value: 385 },
              { label: "Sem 3 (Pago Prov.)", value: 210 },
              { label: "Sem 4 (Sueldos)", value: 165 },
              { label: "Sem 5 (Recuperación)", value: 295 },
            ],
          },
        },
        presup: {
          type: "table",
          title: "Control Presupuestario Mensual por Rubro",
          columns: [
            { label: "Rubro de Gasto", value: "rubro" },
            { label: "Presupuesto Asignado", value: "presupuesto", currency: true },
            { label: "Ejecutado a la Fecha", value: "ejecutado", currency: true },
            { label: "Desvío / Uso", value: "uso", badge: true },
          ],
          rows: [
            { rubro: "Nómina Salarial & Cargas Sociales", presupuesto: 285000000, ejecutado: 210000000, uso: "73,7% (Normal)", badge: "green" },
            { rubro: "Energía Eléctrica (ANDE) & Frío", presupuesto: 68500000, ejecutado: 41200000, uso: "60,1% (Normal)", badge: "green" },
            { rubro: "Publicidad, Folletos & Promociones", presupuesto: 25000000, ejecutado: 23800000, uso: "95,2% (Alerta)", badge: "amber" },
            { rubro: "Mantenimiento Preventivo & Maquinaria", presupuesto: 30000000, ejecutado: 21400000, uso: "71,3% (Normal)", badge: "green" },
          ],
        },
      },
      useCases: [
        {
          title: "Caso 1: Detección de valle de liquidez por coincidencia de sueldos y facturas mayoristas",
          scenario:
            "El Flujo de Caja proyecta que el día 30 coincidirán sueldos del personal (₲ 285.000.000) y facturas de bebidas (₲ 80.000.000), dejando la cuenta por debajo del colchón de contingencia.",
          stepByStep: [
            "1. En el gráfico de Cashflow, identifique la caída proyectada de la Semana 4.",
            "2. Hable con el proveedor mayorista y acuerde reprogramar el 50% de su factura para el día 5 del mes siguiente.",
            "3. En Cuentas por Pagar, actualice la fecha de compromiso de pago.",
            "4. La curva del Cashflow se recalcula, garantizando un saldo disponible seguro superior a ₲ 90.000.000.",
          ],
          keyLesson:
            "Proyectar el flujo de fondos a 3 semanas permite negociar plazos con proveedores sin incurrir en mora ni recurrir a sobregiros bancarios costosos.",
        },
      ],
      commonErrors: [
        {
          error: "Alerta: 'La proyección de liquidez perfora el colchón de contingencia'",
          cause: "Concentración de pagos en una misma fecha sin ingresos compensatorios previstos.",
          solution:
            "Reprograme los pagos a proveedores flexibles o acelere la cobranza de créditos comerciales.",
        },
      ],
      shortcutsOrHotkeys: [
        { key: "Ctrl + F", action: "Abrir simulador de flujo de caja" },
      ],
      tips: [
        "Revise el Cashflow cada viernes para programar los compromisos financieros de la siguiente semana.",
      ],
      faq: [
        {
          q: "¿Cuál es el colchón de seguridad financiero fijado para Extra Supermercado?",
          a: "Un mínimo de ₲ 100.000.000 en disponible líquido para cubrir imprevistos y emergencias operativas.",
        },
      ],
    },
  ],
}
