// Configuración por defecto de la plantilla de ticket térmico.
// Extraída a un módulo independiente para que tanto SettingsPage como
// CajaRapidaPage / POSPage puedan importarla sin crear dependencias circulares.

export interface ReceiptTemplateConfig {
  // Cabecera e Identidad
  mostrar_logo: boolean
  logo_url: string
  logo_ancho_px: number
  nombre_fantasia: string
  razon_social: string
  ruc: string
  timbrado: string
  timbrado_vencimiento: string
  establecimiento: string
  punto_expedicion: string
  direccion: string
  ciudad: string
  telefono: string
  whatsapp: string
  slogan: string

  // Formato, Dimensiones & Tipografía
  ancho_papel: "80mm" | "58mm"
  ancho_imprimible_mm: number
  margen_izq_mm: number
  margen_der_mm: number
  interlineado: number
  fuente_ticket: "Courier New" | "Consolas" | "Monospace" | "Lucida Console" | "Segoe UI" | "Arial"
  tamano_fuente_px: number
  mostrar_cajero: boolean
  mostrar_caja: boolean
  mostrar_cliente: boolean
  mostrar_ruc_cliente: boolean
  mostrar_sku: boolean
  mostrar_balanza_origen: boolean
  formato_items: "dos_lineas" | "una_linea"

  // Totales & Multimoneda
  mostrar_multimoneda: boolean
  mostrar_equivalente_brl: boolean
  mostrar_equivalente_usd: boolean
  mostrar_liquidacion_iva: boolean
  mostrar_desglose_pagos: boolean
  mostrar_vuelto_extranjero: boolean

  // Fidelización Extra Club
  habilitar_extra_club: boolean
  puntos_por_mil_gs: number
  mensaje_socio_club: string
  mensaje_invitacion_club: string
  mostrar_qr_club: boolean
  qr_url_club: string

  // Campaña Solidaria Abre tu Corazón
  donacion_activa: boolean
  donacion_titulo: string
  donacion_mensaje: string
  donacion_web: string

  // Marketing & Cuponera
  habilitar_mensaje_marketing: boolean
  mensaje_marketing: string
  habilitar_cupon_descuento: boolean
  cupon_codigo: string
  cupon_descripcion: string
  cupon_validez_dias: number

  // Recuadro Dinámico de Ahorro & Precios Mayoristas (45 columnas)
  habilitar_recuadro_ahorro: boolean
  titulo_ahorro_con_descuento: string
  subtitulo_ahorro_promo: string
  subtitulo_ahorro_mayorista: string
  titulo_invitacion_ahorro: string
  linea1_invitacion_ahorro: string
  linea2_invitacion_ahorro: string
  linea3_invitacion_ahorro: string

  // Pie de Página & Corte
  mostrar_qr_sifen: boolean
  sifen_consulta_url: string
  facturacion_electronica: boolean
  usar_numero_interno_venta: boolean
  mostrar_numero_comprobante: boolean
  mensaje_despedida: string
  lineas_salto_corte: number
  mostrar_linea_corte_visual: boolean
  corte_automatico: boolean
}

export const DEFAULT_RECEIPT_CONFIG: ReceiptTemplateConfig = {
  mostrar_logo: true,
  logo_url: "/uploads/logos/logo_00000000-0000-0000-0000-000000000010.png?t=1787497787",
  logo_ancho_px: 160,
  nombre_fantasia: "Extra Supermercado Mayorista",
  razon_social: "GRUPO SANTA TERESA E.A.S.",
  ruc: "80150377-9",
  timbrado: "18545636",
  timbrado_vencimiento: "31/12/2026",
  establecimiento: "001",
  punto_expedicion: "012",
  direccion: "Alejo Garcia esquina Carlos Antonio López",
  ciudad: "Pedro Juan Caballero · Paraguay",
  telefono: "+595992052200",
  whatsapp: "+595992052200",
  slogan: "¡Precios Mayoristas Todos los Días!",

  ancho_papel: "80mm",
  ancho_imprimible_mm: 68,
  margen_izq_mm: 0,
  margen_der_mm: 0,
  interlineado: 1.22,
  fuente_ticket: "Consolas",
  tamano_fuente_px: 10.5,
  mostrar_cajero: true,
  mostrar_caja: true,
  mostrar_cliente: true,
  mostrar_ruc_cliente: true,
  mostrar_sku: true,
  mostrar_balanza_origen: true,
  formato_items: "dos_lineas",

  mostrar_multimoneda: true,
  mostrar_equivalente_brl: true,
  mostrar_equivalente_usd: true,
  mostrar_liquidacion_iva: true,
  mostrar_desglose_pagos: true,
  mostrar_vuelto_extranjero: true,

  habilitar_extra_club: true,
  puntos_por_mil_gs: 1,
  mensaje_socio_club: "⭐ SOCIO EXTRA CLUB: Sumaste +150 Puntos. Saldo Total: 2.850 Puntos.",
  mensaje_invitacion_club: "🎁 ¿Aún no eres socio Extra Club? Regístrate gratis en caja o en club.extrasuper.com.py y acumula puntos para canjear por premios y descuentos exclusivos.",
  mostrar_qr_club: true,
  qr_url_club: "https://club.extrasuper.com.py/registro",

  donacion_activa: true,
  donacion_titulo: "* ABRE TU CORAZON *",
  donacion_mensaje: "Gracias por colaborar con el Centro Amor y Esperanza.",
  donacion_web: "www.centroamoresperanza.org",

  habilitar_mensaje_marketing: true,
  mensaje_marketing: "🔥 ¡Miércoles de Carnicería: 15% OFF en cortes seleccionados con Extra Club!",
  habilitar_cupon_descuento: true,
  cupon_codigo: "EXTRA10OFF",
  cupon_descripcion: "10% de descuento en tu próxima compra",
  cupon_validez_dias: 15,

  habilitar_recuadro_ahorro: true,
  titulo_ahorro_con_descuento: "¡FELICIDADES! TU EXTRA AHORRO HOY:",
  subtitulo_ahorro_promo: "• En Promociones:",
  subtitulo_ahorro_mayorista: "• En Precios Mayoristas:",
  titulo_invitacion_ahorro: "¡SUMATE AL EXTRA AHORRO DIARIO!",
  linea1_invitacion_ahorro: "• Comprá por fardo/caja a precio [M]",
  linea2_invitacion_ahorro: "• Aprovechá las Ofertas de la Semana",
  linea3_invitacion_ahorro: "¡Los mejores precios de la región!",

  mostrar_qr_sifen: true,
  sifen_consulta_url: "https://sifen.set.gov.py/consultas",
  facturacion_electronica: false,
  usar_numero_interno_venta: true,
  mostrar_numero_comprobante: true,
  mensaje_despedida: "¡Muchas gracias por su preferencia!",
  lineas_salto_corte: 5,
  mostrar_linea_corte_visual: true,
  corte_automatico: true,
}
