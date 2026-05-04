# ROADMAP — InteliMarket

## Fase 0: Foundation (Mes 1-2)

### Infraestructura
- [ ] Setup del repo con estructura definida
- [ ] Docker compose local (PostgreSQL, Redis, API, Frontend)
- [ ] CI/CD básico (GitHub Actions)
- [ ] Sistema de migraciones (Alembic)
- [ ] Multi-tenancy: schema provisioning automático
- [ ] Auth system: JWT, login, register, MFA

### Core
- [ ] CRUD de empresas (RUC, datos fiscales)
- [ ] CRUD de sucursales y puntos de expedición
- [ ] CRUD de usuarios y roles (RBAC)
- [ ] Configuración de monedas (PYG, USD)
- [ ] Integración BCP: tipos de cambio automáticos
- [ ] Audit trail middleware

---

## Fase 1: Catálogo + Inventario (Mes 2-3)

### Productos
- [ ] CRUD de productos (SKU, código de barra, categoría)
- [ ] Categorías con jerarquía
- [ ] Variantes de productos
- [ ] Listas de precio (múltiples)
- [ ] Descuentos configurables

### Inventario
- [ ] Multi-almacén (CRUD almacenes)
- [ ] Stock por producto/almacén
- [ ] Movimientos de inventario (entradas, salidas)
- [ ] Costeo promedio ponderado
- [ ] Costeo FIFO
- [ ] Lotes con vencimiento
- [ ] Numeración de serie
- [ ] Transferencias entre almacenes
- [ ] Ajustes de inventario con aprobación
- [ ] Alertas de stock mínimo

---

## Fase 2: Ventas + POS (Mes 3-4)

### Ventas
- [ ] CRUD de clientes
- [ ] Crear ventas (cabecera + items)
- [ ] Cotizaciones
- [ ] Notas de crédito/devoluciones
- [ ] Historial de ventas

### POS
- [ ] Interfaz POS web (PWA)
- [ ] Gestión de caja (apertura, cierre, arqueos)
- [ ] Lectora de código de barras
- [ ] Impresión de tickets (WebUSB/WebSerial)
- [ ] Búsqueda rápida de productos
- [ ] Descuentos en línea
- [ ] Múltiples formas de pago en una venta

### Offline
- [ ] Service Worker para PWA offline
- [ ] IndexedDB para catálogo local
- [ ] Sync cuando vuelve la conexión
- [ ] Cola de ventas offline

---

## Fase 3: Facturación SIFEN (Mes 4-5)

### SIFEN Nativo
- [ ] Generación XML e-Kuatia
- [ ] Cálculo CDC
- [ ] Conexión API SIFEN (ambiente pruebas)
- [ ] Procesamiento respuestas SIFEN
- [ ] Gestión de timbrados
- [ ] Consulta de CDC
- [ ] Reintentos automáticos

### Integración emisores externos
- [ ] Webhook para recibir CDC de emisor externo
- [ ] Validación de CDC recibido
- [ ] Abstracción de emisor (interfaz plug-and-play)

### Cumplimiento
- [ ] Libro de ventas automático
- [ ] Libro de compras automático
- [ ] RG 90: detalle de comprobantes
- [ ] Validaciones fiscales en creación de facturas

---

## Fase 4: Compras + Proveedores (Mes 5-6)

### Proveedores
- [ ] CRUD de proveedores
- [ ] Histórico de compras por proveedor

### Órdenes de compra
- [ ] Crear órdenes de compra
- [ ] Confirmar/enviar al proveedor
- [ ] Seguimiento de estado

### Recepción
- [ ] Recepción de mercadería
- [ ] Control de cantidad recibida vs ordenada
- [ ] Actualización automática de stock
- [ ] Vinculación con factura de compra

---

## Fase 5: Cobros + Pagos (Mes 6-7)

### Medios de pago
- [ ] Configurar medios de pago
- [ ] Efectivo (arqueos)
- [ ] Tarjetas (débito/crédito)
- [ ] Transferencias bancarias
- [ ] Cheques (registro, cobro)

### Split payments
- [ ] Múltiples formas de pago por venta
- [ ] Cálculo de cambio

### Cuenta corriente
- [ ] Cuentas corrientes de clientes
- [ ] Límite de crédito
- [ ] Movimientos (cargos/abonos)
- [ ] Estado de cuenta

### Wallet
- [ ] Wallet interna por cliente
- [ ] Créditos y débitos
- [ ] Uso en POS

### Financiamiento
- [ ] Configuración de cuotas
- [ ] Tasa de interés
- [ ] Plan de pagos
- [ ] Seguimiento de cuotas (pagado/vencido)

### Pasarelas de pago
- [ ] Pagopar: checkout, callback
- [ ] Kuapay: QR dinámico, webhook

---

## Fase 6: Distribución (Mes 7-8)

### Pedidos B2B
- [ ] Portal de pedidos para clientes mayoristas
- [ ] Cotizaciones con aprobación
- [ ] Pedido mínimo por cliente
- [ ] Listas de precio por canal/volumen

### Logística
- [ ] Rutas de entrega
- [ ] Programación de entregas
- [ ] Albaranes
- [ ] Firma de recepción

### CRM básico
- [ ] Oportunidades
- [ ] Pipeline de ventas
- [ ] Seguimiento
- [ ] Cotización → Venta

---

## Fase 7: Integraciones ecosistema (Mes 8-9)

### InteliCont
- [ ] Webhook invoice.issued
- [ ] Webhook purchase.received
- [ ] Webhook payment.recorded
- [ ] Webhook period.closed
- [ ] Validación HMAC

### InteliAudit
- [ ] Snapshot mensual de comprobantes
- [ ] Consulta de hallazgos
- [ ] Drill-down a comprobantes

### SueldOK
- [ ] Pull de nómina cerrada
- [ ] Push de empleados nuevos
- [ ] Imputación de costos por centro de costo

---

## Fase 8: Reportes + Dashboard (Mes 9-10)

### Dashboard
- [ ] Ventas del día/semana/mes
- [ ] Productos más vendidos
- [ ] Stock bajo
- [ ] Cuentas por cobrar
- [ ] Cuentas por pagar

### Reportes
- [ ] Ventas por período/sucursal/vendedor
- [ ] Inventario valorizado
- [ ] Rotación de stock
- [ ] Margen por producto
- [ ] Estado de caja
- [ ] Libro IVA ventas
- [ ] Libro IVA compras
- [ ] Export Excel de todos los reportes

### IA (bonus)
- [ ] Forecasting de demanda
- [ ] Sugerencia de precios
- [ ] Detección de anomalías en ventas

---

## Fase 9: Landing + Billing (Mes 10-11)

### Landing page
- [ ] Página de producto
- [ ] Pricing
- [ ] Registro de trial

### Billing
- [ ] Planes (Starter, Professional, Business, Enterprise)
- [ ] Feature flags por plan
- [ ] Límites (sucursales, POS, facturas, usuarios)
- [ ] Facturación del SaaS
- [ ] Upgrade/downgrade

---

## Fase 10: Hardening + Launch (Mes 11-12)

### Performance
- [ ] Optimización de queries
- [ ] Caching con Redis
- [ ] Load testing

### Seguridad
- [ ] Pen testing
- [ ] Hardening de infraestructura
- [ ] Backup automático
- [ ] Disaster recovery plan

### QA
- [ ] Tests unitarios (>= 80% coverage)
- [ ] Tests de integración
- [ ] Tests E2E (POS crítico)
- [ ] UAT con beta testers

### Launch
- [ ] Producción
- [ ] Onboarding de primeros clientes
- [ ] Soporte dedicado
- [ ] Feedback loop

---

## Post-MVP (Fase 2+)

- App móvil nativa (iOS/Android)
- E-commerce integrado
- Vertical Restaurantes
- Vertical Servicios
- Vertical Manufactura
- API pública para partners
- White-label
- Facturación cross-border
- Pricing dinámico con IA
- Integración con transportistas
