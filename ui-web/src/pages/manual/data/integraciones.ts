import { ShieldCheck, FileSignature, Scale, CreditCard } from "lucide-react"
import type { ManualCategory } from "../types"

export const integracionesCategory: ManualCategory = {
  id: "integraciones",
  label: "Integraciones",
  icon: ShieldCheck,
  gradient: "from-teal-600 to-emerald-700",
  description: "El sistema conectado con el mundo: facturación DNIT con autoimpresor, facturación electrónica, básculas y balanzas, y los medios de pago.",
  subtitle: "Facturación, hardware y pagos conectados",
  modules: [
    {
      id: "sifen",
      label: "Facturación & Autoimpresor (DNIT)",
      path: "/sifen",
      icon: ShieldCheck,
      tagline: "Facturas, libros de IVA y autoimpresor",
      category: "Integraciones",
      color: "emerald",
      description:
        "La relación con la DNIT: configuración de puntos de emisión (cajas), libros de IVA y timbrados del autoimpresor. Regula la numeración fiscal de cada comprobante y garantiza que las facturas sean válidas.",
      tabs: [
        { id: "puntos", label: "Puntos de emisión" },
        { id: "libros", label: "Libros de IVA" },
        { id: "timbrados", label: "Timbrados" },
      ],
      steps: [
        {
          title: "Administre los puntos de emisión",
          detail: "Cada caja es un punto de emisión con su rango de numeración (ej: 001-011 a 001-020). Los comprobantes salen con la numeración correcta y secuencial.",
          mockKey: "puntos",
        },
        {
          title: "Consulte los libros de IVA",
          detail: "Los libros de IVA (ventas y compras) se generan desde los comprobantes emitidos y recibidos. Listos para la declaración mensual.",
          mockKey: "libros",
        },
        {
          title: "Gestione los timbrados",
          detail: "El autoimpresor DNIT usa timbrados (autorizaciones). El sistema controla vigencia y rango disponible, avisando antes de que se agote.",
          mockKey: "timbrado",
        },
      ],
      mocks: {
        puntos: {
          type: "table",
          title: "Puntos de emisión",
          columns: [
            { label: "Punto", value: "punto" },
            { label: "Caja", value: "caja" },
            { label: "Rango", value: "rango" },
            { label: "Último emitido", value: "ultimo" },
            { label: "Estado", value: "estado", badge: true },
          ],
          rows: [
            { punto: "001-011", caja: "CAJA 1", rango: "1 – 40.000", ultimo: "14.825", estado: "Activo", badge: "green" },
            { punto: "001-012", caja: "CAJA 2", rango: "1 – 40.000", ultimo: "14.520", estado: "Activo", badge: "green" },
            { punto: "001-013", caja: "CAJA 3", rango: "1 – 20.000", ultimo: "19.940", estado: "Por agotar", badge: "amber" },
          ],
        },
        libros: {
          type: "kpiGrid",
          title: "Libro de IVA del mes",
          kpis: [
            { label: "Ventas con 10%", value: "₲ 3.164.090.910", sub: "IVA 10%", color: "green" },
            { label: "Ventas con 5%", value: "₲ 809.714.280", sub: "IVA 5%", color: "blue" },
            { label: "IVA total", value: "₲ 356.860.914", sub: "a favor del fisco", color: "amber" },
            { label: "Comprobantes", value: "124.800", sub: "incluye NC", color: "purple" },
          ],
        },
        timbrado: {
          type: "kpiGrid",
          title: "Timbrado autoimpresor",
          kpis: [
            { label: "Nº timbrado", value: "18.545.636", sub: "Autoimpresor DNIT", color: "blue" },
            { label: "Rango", value: "1 – 40.000", sub: "válido hasta 31/01/2027", color: "green" },
            { label: "Emitidos", value: "38.112", sub: "72% del rango", color: "amber" },
            { label: "Días restantes", value: "164", sub: "renovar antes de agotar", color: "purple" },
          ],
        },
      },
      faq: [
        { q: "¿Qué pasa si se agota el timbrado?", a: "El sistema impide emitir y avisa con anticipación. Renueve el timbrado en DNIT y cárguelo en Configuración > Fiscal." },
      ],
    },
    {
      id: "facturacion-electronica",
      label: "Facturación Electrónica",
      path: "/facturacion-electronica",
      icon: FileSignature,
      tagline: "Próximamente: facturación electrónica oficial",
      category: "Integraciones",
      color: "blue",
      description:
        "Módulo preparado para la transición a la facturación electrónica oficial (KUSU/DE). Muestra la telemetría del servicio y las configuraciones del certificado digital.",
      steps: [
        {
          title: "Revise el estado del servicio",
          detail: "La telemetría muestra si el servicio de facturación electrónica está operativo y conectado.",
          mockKey: "telemetria",
        },
        {
          title: "Cargue el certificado digital",
          detail: "El módulo permite subir el certificado (.p12) y configurar la clave antes de la habilitación definitiva.",
        },
      ],
      mocks: {
        telemetria: {
          type: "kpiGrid",
          title: "Telemetría",
          kpis: [
            { label: "Estado del servicio", value: "Operativo", sub: "última verificación 14:30", color: "green" },
            { label: "Firmas realizadas", value: "0", sub: "pendiente de habilitación DNIT", color: "amber" },
            { label: "Certificado", value: "Sin cargar", sub: "subir .p12 cuando corresponda", color: "red" },
          ],
        },
      },
      faq: [
        { q: "¿Cuándo se habilita?", a: "El módulo está listo en el sistema. Se habilita cuando el negocio realice la transición a la facturación electrónica con la DNIT." },
      ],
    },
    {
      id: "escalas",
      label: "Básculas & Balanzas",
      path: "/escalas",
      icon: Scale,
      tagline: "PLU, sincronización y verificación de balanzas",
      category: "Integraciones",
      color: "slate",
      description:
        "Integración con las básculas de la verdulería y carnicería: configuraciones por modelo, sincronización de PLUs (códigos de producto) desde el catálogo y verificación de comunicación.",
      steps: [
        {
          title: "Configure la báscula",
          detail: "Elija el modelo de balanza y defina cómo se comunicará (red/USB). Pruebe la conexión con el botón de verificación.",
          mockKey: "config",
        },
        {
          title: "Sincronice los PLUs",
          detail: "Los productos (código, nombre, precio por kg) se sincronizan a la balanza como PLUs. Así el precio de góndola y el de la balanza van juntos.",
          mockKey: "plus",
        },
        {
          title: "Verifique el estado",
          detail: "La pestaña de logs muestra las últimas sincronizaciones y errores de comunicación con cada equipo.",
        },
      ],
      mocks: {
        config: {
          type: "form",
          title: "Configuración de báscula",
          formFields: [
            { label: "Equipo", type: "select", value: "Báscula verdulería", options: ["Báscula verdulería", "Báscula carnicería"] },
            { label: "Modelo", type: "select", value: "CAS LP-500", options: ["CAS LP-500", "Toledo 9201"] },
            { label: "Conexión", type: "select", value: "Red / TCP", options: ["Red / TCP", "USB"] },
            { label: "Prueba de comunicación", type: "text", value: "Estado: conectada (14 ms)" },
          ],
        },
        plus: {
          type: "list",
          title: "Sincronización de PLUs",
          items: [
            { title: "Vacío — PLU 0100 — ₲ 69.000/kg", sub: "Sincronizado hoy 14:05", badge: "OK", badgeColor: "green" },
            { title: "Milanesa — PLU 0101 — ₲ 72.000/kg", sub: "Sincronizado hoy 14:05", badge: "OK", badgeColor: "green" },
            { title: "Nuevo: Frutilla — PLU 0118", sub: "Falta sincronizar", badge: "Pendiente", badgeColor: "amber" },
          ],
        },
      },
      faq: [
        { q: "¿Cambio el precio en la balanza al cambiar la lista de precios?", a: "No automáticamente: debe sincronizar los PLUs después de re-preciar. El sistema avisa de los productos cuyo precio cambió." },
      ],
    },
    {
      id: "medios-pago",
      label: "Integración Medios de Pago",
      path: "/integrations",
      icon: CreditCard,
      tagline: "Tarjetas (Bancard/Dinelco), QR y hardware",
      category: "Integraciones",
      color: "indigo",
      description:
        "La central de pagos: integración de terminales Bancard y Dinelco, pagos QR (Pix/pluggpay), cierres de lote de tarjetas y la configuración de impresoras (Pantum rollo, Zebra ZPL).",
      tabs: [
        { id: "bancard", label: "Bancard" },
        { id: "dinelco", label: "Dinelco" },
        { id: "qr", label: "QR / Pix" },
        { id: "hardware", label: "Hardware" },
        { id: "config", label: "Configuración" },
      ],
      steps: [
        {
          title: "Vea las transacciones de tarjetas",
          detail: "Consulte cada venta con tarjeta: voucher, marca (Visa/Mastercard), tipo (débito/crédito/QR), cliente, cajero y monto. Los cierres de lote concilian con los resúmenes de la procesadora.",
          mockKey: "transacciones",
        },
        {
          title: "Gestione el QR / Pix",
          detail: "Los pagos QR se procesan por plugpay: vea los pagos con su valor, cuotas, resultado y estado (éxito/fallido) con el detalle del error.",
          mockKey: "qr",
        },
        {
          title: "Configure el hardware",
          detail: "Impresoras: Pantum PT-D160 (ticket de rollo) y Zebra ZD-220 (ZPL) con su conexión (USB, Red TCP puerto 9100). Incluye la impresión de calibración.",
        },
        {
          title: "Gestione las configuraciones de pago",
          detail: "Para Bancard/Dinelco, las IPs por punto de emisión; para plugpay, credenciales de comercio y modo (sandbox/producción).",
          mockKey: "config",
        },
      ],
      mocks: {
        transacciones: {
          type: "table",
          title: "Transacciones de tarjeta — hoy",
          columns: [
            { label: "Voucher", value: "voucher" },
            { label: "Tarjeta", value: "tarjeta" },
            { label: "Tipo", value: "tipo" },
            { label: "Cliente", value: "cliente" },
            { label: "Monto", value: "monto", currency: true },
          ],
          rows: [
            { voucher: "DB-88421", tarjeta: "Visa Débito", tipo: "Crédito", cliente: "María Benítez", monto: 452000 },
            { voucher: "DB-88422", tarjeta: "Mastercard", tipo: "Débito", cliente: "Mostrador", monto: 128500 },
            { voucher: "QR-01245", tarjeta: "QR Image", tipo: "QR CODE", cliente: "Pedro Ruiz", monto: 86300 },
          ],
        },
        qr: {
          type: "table",
          title: "Pagos QR / Pix",
          columns: [
            { label: "Fecha", value: "fecha" },
            { label: "Monto PYG", value: "pyg", currency: true },
            { label: "Valor Pix (BRL)", value: "brl" },
            { label: "Cuotas", value: "cuotas" },
            { label: "Estado", value: "estado", badge: true },
          ],
          rows: [
            { fecha: "06/09 18:22", pyg: 86300, brl: "R$ 62,50", cuotas: 1, estado: "Éxito", badge: "green" },
            { fecha: "06/09 18:45", pyg: 185000, brl: "R$ 134,00", cuotas: 3, estado: "Éxito", badge: "green" },
            { fecha: "06/09 19:02", pyg: 452000, brl: "R$ 327,50", cuotas: 0, estado: "Fallido", badge: "red" },
          ],
        },
        config: {
          type: "list",
          title: "Configuración de medios de pago",
          items: [
            { title: "Bancard — IPs por punto de emisión", sub: "001-011 → 10.0.0.21 · 001-012 → 10.0.0.22", badge: "Bancard", badgeColor: "blue" },
            { title: "Plugpay — documento del comercio", sub: "GRUPO SANTA TERESA E.A.S. (80150377-9) · modo producción", badge: "QR", badgeColor: "purple" },
            { title: "Impresora Pantum — modelo PT-D160", sub: "Ticket de rollo · 3 columnas · USB", badge: "Hardware", badgeColor: "green" },
          ],
        },
      },
      faq: [
        { q: "¿Qué hago con un pago QR fallido?", a: "Revise el detalle del error (el sistema lo guarda). Suele ser fondos insuficientes, QR vencido o timeout del banco. Puede re-procesarlo o cobrar por otra vía." },
      ],
    },
  ],
}