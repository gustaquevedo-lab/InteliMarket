# PRD — InteliMarket

## Problema

Comercios y distribuidores en Paraguay operan con sistemas legacy, hojas de cálculo, o sistemas importados que no cumplen con la normativa fiscal local (DNIT/SET). Los sistemas contables no hablan con el POS, el inventario no cuadra, y la facturación electrónica es un proceso manual y propenso a errores.

## Usuarios

- Dueño/comerciante (primario): necesita ver su negocio en tiempo real
- Cajero/operador de POS: necesita velocidad y simplicidad
- Encargado de compras: necesita visibilidad de stock y proveedores
- Contador externo: necesita datos limpios para declaraciones
- Distribuidor/vendedor: necesita rutas, pedidos, cotizaciones

## Jobs to be done

1. Vender rápido en el punto de venta con factura electrónica automática
2. Controlar inventario en tiempo real, sin descuadres
3. Comprar a proveedores con órdenes y recepción documentada
4. Cobrar por múltiples medios (efectivo, tarjeta, transferencia, crédito)
5. Gestionar múltiples sucursales desde un solo lugar
6. Cumplir con DNIT sin esfuerzo (facturación, libros, reportes)
7. Enviar datos contables a InteliCont automáticamente
8. Preparar auditoría con InteliAudit en un click

## Métricas (12 meses)

- Tiempo de venta en POS <= 5 segundos
- Disponibilidad POS offline: 100%
- Precisión inventario >= 99.5%
- Facturas SIFEN aprobadas >= 99.9%
- Cierre de caja automático: 0 descuadres
- NPS comerciante >= 65
- 0 multas por errores fiscales

## MVP — Features

### Core
1. Crear tenant, empresa, configuración tributaria
2. Catálogo de productos con múltiples listas de precio
3. Inventario completo: multi-almacén, FIFO/promedio, lotes, series
4. POS web offline-first (PWA) con impresión local
5. Facturación electrónica SIFEN nativa + integración emisores externos
6. Cobros: efectivo, tarjetas, transferencia, cheques, cuenta corriente
7. Wallet interna + crédito rotativo + financiamiento en cuotas
8. Split payments (múltiples formas de pago por venta)
9. Multimoneda: PYG, USD + configurables, tasa BCP automática

### Ventana: Retail
10. Punto de venta con lectora de código de barras
11. Gestión de caja (apertura, cierre, arqueos)
12. Promociones y descuentos
13. Stock mínimo y alertas

### Vertical: Distribución
14. Órdenes de compra a proveedores
15. Recepción de mercadería con control de calidad
16. Listas de precio por canal/volumen
17. Pedido mínimo por cliente
18. Gestión de pedidos y cotizaciones B2B
19. Rutas de entrega con albaranes
20. CRM básico: oportunidades, seguimiento

### Integraciones
21. SIFEN: emisión, consulta CDC, recepción respuestas
22. InteliCont: webhooks de ventas, compras, pagos
23. InteliAudit: snapshots mensuales de comprobantes
24. SueldOK: API para datos de nómina
25. Pagopar: pasarela de pagos
26. Kuapay: pagos QR

### Reportes
27. Dashboard de ventas en tiempo real
28. Reporte de inventario (valorización, rotación)
29. Libro de ventas y compras (auto-generado)
30. Reporte de caja y arqueos
31. Export Excel de todos los reportes

## No-MVP (fase 2+)

- App móvil nativa (iOS/Android) para POS y dashboard
- E-commerce integrado
- Marketplace B2B
- Inteligencia artificial para forecasting de demanda
- Pricing dinámico
- Integración con transportistas
- Facturación cross-border (Brasil, Argentina)
- API pública para partners
- White-label para distribuidores de software
- Módulo de manufactura/producción
- NIIF para reportes financieros

## Diferenciadores vs competencia en Paraguay

1. **Ecosistema integrado**: POS → Contabilidad → Auditoría → RRHH, todo conectado
2. **Compliance nativo**: Facturación SIFEN, libros IVA, RG90, todo automático
3. **Offline-first**: POS funciona sin internet, sincroniza después
4. **Multimoneda real**: PYG, USD, BRL con tasas del BCP, no solo conversión decorativa
5. **Crédito y financiamiento**: Cuentas corrientes, wallet, cuotas — nativo
6. **Verticalizable**: Retail y distribución en el MVP, más verticales después
7. **Moderno**: UI responsive, dark mode, atajos de teclado, alta densidad

## Arquitectura de planes

| Feature | Starter | Professional | Business | Enterprise |
|---------|---------|-------------|----------|------------|
| Precio mensual (PYG) | 250.000 | 750.000 | 2.000.000 | A convenir |
| Sucursales | 1 | 3 | 10 | Ilimitadas |
| Puntos de venta | 1 | 3 | 10 | Ilimitados |
| Usuarios | 2 | 10 | 50 | Ilimitados |
| Facturas/mes | 500 | 5,000 | 50,000 | Ilimitadas |
| Productos | 500 | 10,000 | Ilimitados | Ilimitados |
| Almacenes | 1 | 3 | 10 | Ilimitados |
| Pasarelas | 1 | 2 | Todas | Todas |
| Soporte | Email | Email + Chat | Prioritario | Dedicado |

## Verticales futuros (post-MVP)

- **Restaurantes/Gastronomía**: mesas, comandas, recetas, delivery, propinas
- **Servicios/Profesional**: turnos, proyectos, horas facturables, contratos
- **Manufactura/Producción**: BOM, órdenes de producción, materia prima, costos
- **Salud**: turnos, historias clínicas, stock de insumos
- **Educación**: matrículas, cuotas, stock de materiales
