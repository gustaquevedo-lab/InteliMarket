-- InteliMarket — Schema maestro PostgreSQL
-- Modelo: Schema por tenant (cada tenant tiene su propio schema)
-- Este archivo define las tablas que se crean en CADA schema de tenant

-- ==========================================
-- MAESTROS
-- ==========================================

-- Empresas (un tenant puede tener múltiples empresas/RUC)
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ruc VARCHAR(15) NOT NULL UNIQUE,
    razon_social VARCHAR(255) NOT NULL,
    nombre_fantasia VARCHAR(255),
    actividad_principal VARCHAR(255),
    regimen_tributario VARCHAR(50) NOT NULL,  -- general, simplificado, single, small
    iva_condition VARCHAR(20) NOT NULL,       -- exento, gravado
    direccion TEXT,
    ciudad VARCHAR(100),
    departamento VARCHAR(100),
    telefono VARCHAR(20),
    email VARCHAR(255),
    logo_url TEXT,
    timbrado_numero VARCHAR(20),
    timbrado_vigencia_desde DATE,
    timbrado_vigencia_hasta DATE,
    sifen_enabled BOOLEAN DEFAULT false,
    sifen_cert_path TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sucursales
CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    codigo VARCHAR(3) NOT NULL,  -- Establecimiento SIFEN (001, 002...)
    nombre VARCHAR(100) NOT NULL,
    direccion TEXT,
    ciudad VARCHAR(100),
    telefono VARCHAR(20),
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Puntos de expedición (por sucursal)
CREATE TABLE emission_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id),
    codigo VARCHAR(3) NOT NULL,  -- 001, 002...
    tipo VARCHAR(20) NOT NULL,   -- electronico, fisico
    secuencia_actual BIGINT DEFAULT 0,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- PRODUCTOS Y SERVICIOS
-- ==========================================

-- Categorías de productos
CREATE TABLE product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    parent_id UUID REFERENCES product_categories(id),
    nombre VARCHAR(100) NOT NULL,
    codigo VARCHAR(20) UNIQUE,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Productos
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    category_id UUID REFERENCES product_categories(id),
    sku VARCHAR(50) NOT NULL,
    codigo_barra VARCHAR(50),
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    tipo VARCHAR(20) NOT NULL DEFAULT 'producto',  -- producto, servicio
    unidad_medida VARCHAR(10) DEFAULT 'UN',        -- UN, KG, LT, MT, etc.
    iva_tasa NUMERIC(5,2) DEFAULT 10,             -- 0, 5, 10
    metodo_costeo VARCHAR(10) DEFAULT 'promedio',  -- promedio, fifo, lifo
    tiene_lotes BOOLEAN DEFAULT false,
    tiene_vencimiento BOOLEAN DEFAULT false,
    tiene_serial BOOLEAN DEFAULT false,
    stock_minimo INTEGER DEFAULT 0,
    stock_maximo INTEGER,
    peso_kg NUMERIC(10,3),
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, sku)
);

-- Variantes de productos (talles, colores, etc.)
CREATE TABLE product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id),
    sku VARCHAR(50) NOT NULL,
    codigo_barra VARCHAR(50),
    atributos JSONB,  -- {"color": "rojo", "talle": "M"}
    costo NUMERIC(15,0),
    precio_base NUMERIC(15,0),
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(product_id, sku)
);

-- ==========================================
-- PRECIOS
-- ==========================================

-- Listas de precio
CREATE TABLE price_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    nombre VARCHAR(100) NOT NULL,
    moneda VARCHAR(3) NOT NULL DEFAULT 'PYG',
    tipo VARCHAR(20) NOT NULL DEFAULT 'venta',  -- venta, compra, especial
    activa BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Precios por producto en cada lista
CREATE TABLE product_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    price_list_id UUID NOT NULL REFERENCES price_lists(id),
    product_id UUID NOT NULL REFERENCES products(id),
    variant_id UUID REFERENCES product_variants(id),
    precio NUMERIC(15,0) NOT NULL,
    precio_minimo NUMERIC(15,0),
    valido_desde DATE,
    valido_hasta DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(price_list_id, product_id, variant_id)
);

-- Descuentos
CREATE TABLE discounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    nombre VARCHAR(100) NOT NULL,
    tipo VARCHAR(20) NOT NULL,  -- porcentaje, monto
    valor NUMERIC(15,0),
    aplica_a VARCHAR(20) NOT NULL,  -- producto, categoria, total
    producto_ids UUID[],
    categoria_ids UUID[],
    monto_minimo NUMERIC(15,0),
    valido_desde DATE,
    valido_hasta DATE,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- INVENTARIO
-- ==========================================

-- Almacenes
CREATE TABLE warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    branch_id UUID REFERENCES branches(id),
    codigo VARCHAR(10) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    direccion TEXT,
    tipo VARCHAR(20) DEFAULT 'principal',  -- principal, sucursal, transito, devoluciones
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stock actual (por producto, por almacén)
CREATE TABLE stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    product_id UUID NOT NULL REFERENCES products(id),
    variant_id UUID REFERENCES product_variants(id),
    cantidad INTEGER NOT NULL DEFAULT 0,
    cantidad_reservada INTEGER NOT NULL DEFAULT 0,
    costo_unitario NUMERIC(15,0),  -- costo actual según método de costeo
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(warehouse_id, product_id, variant_id)
);

-- Lotes de stock para FIFO/LIFO (tracking por costo y fecha)
CREATE TABLE stock_lots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    product_id UUID NOT NULL REFERENCES products(id),
    variant_id UUID REFERENCES product_variants(id),
    cantidad INTEGER NOT NULL DEFAULT 0,
    cantidad_disponible INTEGER NOT NULL DEFAULT 0,
    costo_unitario NUMERIC(15,0) NOT NULL,
    costo_total NUMERIC(18,0) NOT NULL,
    referencia VARCHAR(100),  -- nro compra, orden, etc
    fecha_ingreso TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_vencimiento TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_stock_lots_product ON stock_lots(product_id);
CREATE INDEX idx_stock_lots_company ON stock_lots(company_id);
CREATE INDEX idx_stock_lots_fecha ON stock_lots(fecha_ingreso);

-- Lotes
CREATE TABLE batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    product_id UUID NOT NULL REFERENCES products(id),
    lote VARCHAR(50) NOT NULL,
    cantidad_inicial INTEGER NOT NULL,
    cantidad_actual INTEGER NOT NULL,
    fecha_vencimiento DATE,
    costo_unitario NUMERIC(15,0),
    fecha_ingreso TIMESTAMPTZ DEFAULT NOW(),
    origen VARCHAR(20),  -- compra, produccion, ajuste, devolucion
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Numeración de serie
CREATE TABLE serial_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    product_id UUID NOT NULL REFERENCES products(id),
    variant_id UUID REFERENCES product_variants(id),
    serial VARCHAR(100) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'disponible',  -- disponible, vendido, devuelto, garantia
    venta_id UUID,
    fecha_ingreso TIMESTAMPTZ DEFAULT NOW(),
    fecha_salida TIMESTAMPTZ,
    UNIQUE(company_id, product_id, serial)
);

-- Movimientos de inventario (todas las entradas/salidas)
CREATE TABLE inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    product_id UUID NOT NULL REFERENCES products(id),
    variant_id UUID REFERENCES product_variants(id),
    batch_id UUID REFERENCES batches(id),
    tipo VARCHAR(30) NOT NULL,  -- entrada_compra, salida_venta, transferencia, ajuste, devolucion, merma
    cantidad INTEGER NOT NULL,  -- positivo = entrada, negativo = salida
    costo_unitario NUMERIC(15,0),
    referencia_type VARCHAR(30),  -- sale, purchase_order, transfer, adjustment
    referencia_id UUID,
    motivo TEXT,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transferencias entre almacenes
CREATE TABLE stock_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    codigo VARCHAR(20) NOT NULL UNIQUE,
    warehouse_origen_id UUID NOT NULL REFERENCES warehouses(id),
    warehouse_destino_id UUID NOT NULL REFERENCES warehouses(id),
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',  -- pendiente, en_transito, completada, cancelada
    fecha_envio TIMESTAMPTZ,
    fecha_recepcion TIMESTAMPTZ,
    observaciones TEXT,
    user_id_envio UUID,
    user_id_recepcion UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE stock_transfer_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id UUID NOT NULL REFERENCES stock_transfers(id),
    product_id UUID NOT NULL REFERENCES products(id),
    variant_id UUID REFERENCES product_variants(id),
    cantidad_enviada INTEGER NOT NULL,
    cantidad_recibida INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ajustes de inventario
CREATE TABLE inventory_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    codigo VARCHAR(20) NOT NULL UNIQUE,
    motivo VARCHAR(50) NOT NULL,  -- conteo_fisico, merma, daño, error, otro
    estado VARCHAR(20) DEFAULT 'pendiente',  -- pendiente, aprobado, rechazado
    observaciones TEXT,
    user_id UUID,
    aprobado_por UUID,
    fecha_aprobacion TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE inventory_adjustment_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    adjustment_id UUID NOT NULL REFERENCES inventory_adjustments(id),
    product_id UUID NOT NULL REFERENCES products(id),
    variant_id UUID REFERENCES product_variants(id),
    cantidad_sistema INTEGER NOT NULL,
    cantidad_fisica INTEGER NOT NULL,
    diferencia INTEGER NOT NULL,  -- cantidad_fisica - cantidad_sistema
    costo_unitario NUMERIC(15,0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- CLIENTES
-- ==========================================

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    tipo_persona VARCHAR(20) NOT NULL DEFAULT 'juridica',  -- fisica, juridica
    ruc VARCHAR(15),
    ci VARCHAR(20),
    razon_social VARCHAR(255) NOT NULL,
    nombre_fantasia VARCHAR(255),
    condicion_iva VARCHAR(20),  -- exento, gravado
    direccion TEXT,
    ciudad VARCHAR(100),
    departamento VARCHAR(100),
    telefono VARCHAR(20),
    email VARCHAR(255),
    price_list_id UUID REFERENCES price_lists(id),
    credito_limite NUMERIC(15,0) DEFAULT 0,
    credito_usado NUMERIC(15,0) DEFAULT 0,
    pago_default VARCHAR(20),  -- contado, credito
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CRM: Oportunidades
CREATE TABLE opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT,
    estado VARCHAR(20) NOT NULL DEFAULT 'nuevo',  -- nuevo, contactado, propuesta, negociacion, ganado, perdido
    monto_estimado NUMERIC(15,0),
    probabilidad INTEGER,  -- 0-100
    fecha_cierre_estimada DATE,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- PROVEEDORES
-- ==========================================

CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    tipo_persona VARCHAR(20) NOT NULL DEFAULT 'juridica',
    ruc VARCHAR(15),
    ci VARCHAR(20),
    razon_social VARCHAR(255) NOT NULL,
    condicion_iva VARCHAR(20),
    direccion TEXT,
    ciudad VARCHAR(100),
    telefono VARCHAR(20),
    email VARCHAR(255),
    plazo_pago_dias INTEGER DEFAULT 0,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- VENTAS
-- ==========================================

-- Ventas (cabecera)
CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    branch_id UUID REFERENCES branches(id),
    customer_id UUID REFERENCES customers(id),
    emission_point_id UUID REFERENCES emission_points(id),
    numero VARCHAR(20) NOT NULL UNIQUE,
    fecha TIMESTAMPTZ DEFAULT NOW(),
    tipo_comprobante VARCHAR(20) NOT NULL,  -- ticket, factura, notacredito, notadebito, remito
    condicion VARCHAR(20) NOT NULL DEFAULT 'contado',  -- contado, credito
    moneda VARCHAR(3) NOT NULL DEFAULT 'PYG',
    tipo_cambio NUMERIC(10,2) DEFAULT 1,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',  -- pendiente, confirmado, facturado, enviado, completado, cancelado, devuelto

    -- Totales
    subtotal NUMERIC(15,0) NOT NULL,
    descuento_total NUMERIC(15,0) DEFAULT 0,
    base_gravada_10 NUMERIC(15,0) DEFAULT 0,
    base_gravada_5 NUMERIC(15,0) DEFAULT 0,
    base_exenta NUMERIC(15,0) DEFAULT 0,
    iva_10 NUMERIC(15,0) DEFAULT 0,
    iva_5 NUMERIC(15,0) DEFAULT 0,
    total NUMERIC(15,0) NOT NULL,
    total_pagado NUMERIC(15,0) DEFAULT 0,
    saldo NUMERIC(15,0),  -- total - total_pagado

    -- SIFEN
    cdc VARCHAR(44),  -- Código de Control Digital
    sifen_estado VARCHAR(20),  -- enviado, aprobado, rechazado
    sifen_fecha_respuesta TIMESTAMPTZ,
    sifen_xml_sent TEXT,
    sifen_xml_response TEXT,

    -- Logística
    delivery_route_id UUID,
    delivery_status VARCHAR(20),
    delivery_notes TEXT,

    -- Observaciones
    observaciones TEXT,

    -- Usuario
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Items de venta
CREATE TABLE sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES sales(id),
    product_id UUID NOT NULL REFERENCES products(id),
    variant_id UUID REFERENCES product_variants(id),
    descripcion VARCHAR(300),
    cantidad NUMERIC(10,3) NOT NULL,
    precio_unitario NUMERIC(15,0) NOT NULL,
    descuento_pct NUMERIC(5,2) DEFAULT 0,
    descuento_monto NUMERIC(15,0) DEFAULT 0,
    iva_tasa NUMERIC(5,2) NOT NULL,
    iva_monto NUMERIC(15,0) NOT NULL,
    total NUMERIC(15,0) NOT NULL,
    costo_unitario NUMERIC(15,0),  -- para cálculo de margen
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cotizaciones
CREATE TABLE quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    numero VARCHAR(20) NOT NULL UNIQUE,
    fecha TIMESTAMPTZ DEFAULT NOW(),
    valido_hasta DATE,
    estado VARCHAR(20) DEFAULT 'vigente',  -- vigente, aceptada, rechazada, expirada, convertida
    moneda VARCHAR(3) DEFAULT 'PYG',
    tipo_cambio NUMERIC(10,2) DEFAULT 1,
    subtotal NUMERIC(15,0),
    descuento_total NUMERIC(15,0) DEFAULT 0,
    total NUMERIC(15,0),
    observaciones TEXT,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE quote_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id UUID NOT NULL REFERENCES quotes(id),
    product_id UUID NOT NULL REFERENCES products(id),
    variant_id UUID REFERENCES product_variants(id),
    descripcion VARCHAR(300),
    cantidad NUMERIC(10,3) NOT NULL,
    precio_unitario NUMERIC(15,0) NOT NULL,
    descuento_pct NUMERIC(5,2) DEFAULT 0,
    total NUMERIC(15,0) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- COMPRAS
-- ==========================================

-- Órdenes de compra
CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    numero VARCHAR(20) NOT NULL UNIQUE,
    fecha TIMESTAMPTZ DEFAULT NOW(),
    fecha_entrega_estimada DATE,
    estado VARCHAR(20) NOT NULL DEFAULT 'borrador',  -- borrador, confirmado, enviado, parcial, recibido, cancelado
    moneda VARCHAR(3) DEFAULT 'PYG',
    tipo_cambio NUMERIC(10,2) DEFAULT 1,
    subtotal NUMERIC(15,0),
    descuento_total NUMERIC(15,0) DEFAULT 0,
    iva_10 NUMERIC(15,0) DEFAULT 0,
    iva_5 NUMERIC(15,0) DEFAULT 0,
    total NUMERIC(15,0),
    observaciones TEXT,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id),
    product_id UUID NOT NULL REFERENCES products(id),
    variant_id UUID REFERENCES product_variants(id),
    descripcion VARCHAR(300),
    cantidad NUMERIC(10,3) NOT NULL,
    cantidad_recibida NUMERIC(10,3) DEFAULT 0,
    precio_unitario NUMERIC(15,0) NOT NULL,
    descuento_pct NUMERIC(5,2) DEFAULT 0,
    iva_tasa NUMERIC(5,2),
    total NUMERIC(15,0) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recepciones de compra
CREATE TABLE purchase_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    purchase_order_id UUID REFERENCES purchase_orders(id),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    numero VARCHAR(20) NOT NULL UNIQUE,
    fecha TIMESTAMPTZ DEFAULT NOW(),
    proveedor_ref VARCHAR(50),  -- referencia del proveedor (factura, remito)
    estado VARCHAR(20) DEFAULT 'completado',
    observaciones TEXT,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE purchase_receipt_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID NOT NULL REFERENCES purchase_receipts(id),
    product_id UUID NOT NULL REFERENCES products(id),
    variant_id UUID REFERENCES product_variants(id),
    cantidad_ordenada NUMERIC(10,3),
    cantidad_recibida NUMERIC(10,3) NOT NULL,
    costo_unitario NUMERIC(15,0) NOT NULL,
    batch_id UUID REFERENCES batches(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- PAGOS Y COBROS
-- ==========================================

-- Medios de pago configurados
CREATE TABLE payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    tipo VARCHAR(30) NOT NULL,  -- efectivo, tarjeta_debito, tarjeta_credito, transferencia, cheque, wallet, credito_cuenta, financiamiento
    nombre VARCHAR(100) NOT NULL,
    moneda VARCHAR(3) DEFAULT 'PYG',
    activo BOOLEAN DEFAULT true,
    config JSONB,  -- configuración específica del medio
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pagos/cobros
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    tipo VARCHAR(20) NOT NULL,  -- cobro (ingreso), pago (egreso)
    payment_method_id UUID NOT NULL REFERENCES payment_methods(id),
    moneda VARCHAR(3) NOT NULL DEFAULT 'PYG',
    tipo_cambio NUMERIC(10,2) DEFAULT 1,
    monto NUMERIC(15,0) NOT NULL,
    monto_pyg NUMERIC(15,0),
    fecha TIMESTAMPTZ DEFAULT NOW(),
    referencia VARCHAR(100),  -- nro. transferencia, nro. cheque, etc.
    estado VARCHAR(20) DEFAULT 'confirmado',  -- pendiente, confirmado, rechazado, revertido
    gateway_response JSONB,  -- respuesta de pasarela
    observaciones TEXT,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Asignación de pagos a ventas (split payments)
CREATE TABLE payment_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id),
    sale_id UUID NOT NULL REFERENCES sales(id),
    monto_asignado NUMERIC(15,0) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wallet interna del cliente
CREATE TABLE customer_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    saldo NUMERIC(15,0) DEFAULT 0,
    moneda VARCHAR(3) DEFAULT 'PYG',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, customer_id, moneda)
);

-- Movimientos de wallet
CREATE TABLE wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES customer_wallets(id),
    tipo VARCHAR(20) NOT NULL,  -- credito, debito
    monto NUMERIC(15,0) NOT NULL,
    referencia_type VARCHAR(30),
    referencia_id UUID,
    motivo TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cuentas corrientes (crédito rotativo)
CREATE TABLE customer_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id),
    moneda VARCHAR(3) DEFAULT 'PYG',
    limite_credito NUMERIC(15,0) NOT NULL,
    saldo_actual NUMERIC(15,0) DEFAULT 0,
    dias_plazo INTEGER DEFAULT 30,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(customer_id, moneda)
);

-- Movimientos de cuenta corriente
CREATE TABLE account_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES customer_accounts(id),
    tipo VARCHAR(20) NOT NULL,  -- cargo (compra), abono (pago)
    monto NUMERIC(15,0) NOT NULL,
    sale_id UUID,
    payment_id UUID,
    saldo_anterior NUMERIC(15,0),
    saldo_nuevo NUMERIC(15,0),
    fecha TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Financiamiento en cuotas
CREATE TABLE financings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    sale_id UUID NOT NULL REFERENCES sales(id),
    monto_financiado NUMERIC(15,0) NOT NULL,
    tasa_interes_mensual NUMERIC(5,2),
    cantidad_cuotas INTEGER NOT NULL,
    monto_cuota NUMERIC(15,0) NOT NULL,
    moneda VARCHAR(3) DEFAULT 'PYG',
    fecha_primera_cuota DATE NOT NULL,
    estado VARCHAR(20) DEFAULT 'activo',  -- activo, pagado, moroso, cancelado
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE financing_installments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    financing_id UUID NOT NULL REFERENCES financings(id),
    numero_cuota INTEGER NOT NULL,
    fecha_vencimiento DATE NOT NULL,
    monto NUMERIC(15,0) NOT NULL,
    monto_pagado NUMERIC(15,0) DEFAULT 0,
    estado VARCHAR(20) DEFAULT 'pendiente',  -- pendiente, pagado, vencido, parcial
    fecha_pago TIMESTAMPTZ,
    payment_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- CAJA (POS)
-- ==========================================

-- Cajas
CREATE TABLE cash_registers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id),
    nombre VARCHAR(100) NOT NULL,
    tipo VARCHAR(20) DEFAULT 'principal',
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sesiones de caja (apertura/cierre)
CREATE TABLE cash_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cash_register_id UUID NOT NULL REFERENCES cash_registers(id),
    user_id UUID NOT NULL,
    fecha_apertura TIMESTAMPTZ DEFAULT NOW(),
    monto_apertura NUMERIC(15,0) NOT NULL DEFAULT 0,  -- fondo de caja
    fecha_cierre TIMESTAMPTZ,
    monto_cierre_esperado NUMERIC(15,0),
    monto_cierre_real NUMERIC(15,0),
    diferencia NUMERIC(15,0),
    estado VARCHAR(20) DEFAULT 'abierta',  -- abierta, cerrada
    observaciones_cierre TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Arqueos de caja
CREATE TABLE cash_counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cash_session_id UUID NOT NULL REFERENCES cash_sessions(id),
    denominacion VARCHAR(20) NOT NULL,  -- "1000", "2000", "5000", "10000", "20000", "50000", "100000"
    cantidad INTEGER NOT NULL,
    total NUMERIC(15,0) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- LOGÍSTICA
-- ==========================================

-- Rutas de entrega
CREATE TABLE delivery_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    dia_semana INTEGER,  -- 0-6 (domingo-sábado), null = todos
    zona VARCHAR(100),
    vehiculo VARCHAR(50),
    conductor VARCHAR(100),
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Entregas
CREATE TABLE deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    route_id UUID REFERENCES delivery_routes(id),
    sale_id UUID NOT NULL REFERENCES sales(id),
    estado VARCHAR(20) DEFAULT 'pendiente',  -- pendiente, en_camino, entregado, devuelto, fallido
    fecha_programada DATE,
    fecha_entrega TIMESTAMPTZ,
    direccion_entrega TEXT,
    receptor_nombre VARCHAR(200),
    receptor_firma TEXT,  -- base64 de firma digitalizada
    observaciones TEXT,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Albaranes
CREATE TABLE delivery_slips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id UUID NOT NULL REFERENCES deliveries(id),
    numero VARCHAR(20) NOT NULL UNIQUE,
    fecha TIMESTAMPTZ DEFAULT NOW(),
    estado VARCHAR(20) DEFAULT 'pendiente',  -- pendiente, firmado, rechazado
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- SIFEN
-- ==========================================

-- Timbrados
CREATE TABLE sifen_timbrados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    numero VARCHAR(20) NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    rango_desde INTEGER NOT NULL,
    rango_hasta INTEGER NOT NULL,
    tipo_comprobante VARCHAR(20),
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Respuestas SIFEN
CREATE TABLE sifen_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES sales(id),
    cdc VARCHAR(44),
    estado VARCHAR(20) NOT NULL,  -- aprobado, rechazado
    codigo_error VARCHAR(10),
    mensaje_error TEXT,
    xml_sent TEXT,
    xml_response TEXT,
    fecha_envio TIMESTAMPTZ,
    fecha_respuesta TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- MONEDA
-- ==========================================

-- Tipos de cambio (histórico)
CREATE TABLE exchange_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    moneda VARCHAR(3) NOT NULL,
    tasa_compra NUMERIC(10,2),
    tasa_venta NUMERIC(10,2),
    fuente VARCHAR(20) DEFAULT 'bcp',  -- bcp, manual
    fecha DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, moneda, fecha)
);

-- Monedas configuradas por tenant
CREATE TABLE currencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    codigo VARCHAR(3) NOT NULL,  -- PYG, USD, BRL
    nombre VARCHAR(50) NOT NULL,
    simbolo VARCHAR(5),
    activa BOOLEAN DEFAULT true,
    es_moneda_local BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, codigo)
);

-- ==========================================
-- AUDIT
-- ==========================================

-- Audit trail
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    user_id UUID,
    accion VARCHAR(50) NOT NULL,  -- create, update, delete, login, logout, approve, reject
    entidad VARCHAR(50) NOT NULL,  -- nombre de la tabla
    entidad_id UUID,
    datos_anteriores JSONB,
    datos_nuevos JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- ÍNDICES
-- ==========================================

CREATE INDEX idx_sales_company_fecha ON sales(company_id, fecha DESC);
CREATE INDEX idx_sales_customer ON sales(customer_id);
CREATE INDEX idx_sales_cdc ON sales(cdc) WHERE cdc IS NOT NULL;
CREATE INDEX idx_sales_estado ON sales(estado);
CREATE INDEX idx_stock_warehouse_product ON stock(warehouse_id, product_id);
CREATE INDEX idx_inventory_movements_product ON inventory_movements(product_id, created_at DESC);
CREATE INDEX idx_payments_company_fecha ON payments(company_id, fecha DESC);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_barcode ON products(codigo_barra);

-- ==========================================
-- SCHEMA MASTER (public) — se crea solo una vez
-- ==========================================

-- Tenants
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL,
    slug VARCHAR(50) NOT NULL UNIQUE,
    plan VARCHAR(20) NOT NULL DEFAULT 'starter',  -- starter, professional, business, enterprise
    schema_name VARCHAR(100) NOT NULL UNIQUE,  -- tenant_{uuid}
    estado VARCHAR(20) NOT NULL DEFAULT 'activo',  -- activo, suspendido, cancelado
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE,
    config JSONB,  -- límites del plan, feature flags
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usuarios (global, accesibles desde cualquier tenant)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    telefono VARCHAR(20),
    rol VARCHAR(30) NOT NULL DEFAULT 'operador',  -- admin, gerente, operador, contador, auditor
    mfa_enabled BOOLEAN DEFAULT false,
    mfa_secret VARCHAR(100),
    activo BOOLEAN DEFAULT true,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Relación usuario-tenant
CREATE TABLE IF NOT EXISTS user_tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    rol VARCHAR(30) NOT NULL DEFAULT 'operador',
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, tenant_id)
);

-- Suscripciones
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    plan VARCHAR(20) NOT NULL,
    monto_mensual NUMERIC(15,0) NOT NULL,
    moneda VARCHAR(3) DEFAULT 'PYG',
    fecha_inicio DATE NOT NULL,
    fecha_renovacion DATE,
    fecha_fin DATE,
    estado VARCHAR(20) DEFAULT 'activo',  -- activo, pendiente_pago, cancelado
    metodo_pago VARCHAR(30),
    auto_renovar BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- INTEGRATIONS (Webhooks)
-- ==========================================

-- Configuraciones de integraciones (ecosistema + custom)
CREATE TABLE integration_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id),
    destino VARCHAR(30) NOT NULL,  -- intelicont, inteliaudit, sueldok, custom
    url VARCHAR(500) NOT NULL,
    secret VARCHAR(255),
    eventos JSONB,  -- ["venta.creada", "pago.recibido", ...]
    activo BOOLEAN DEFAULT true,
    creado TIMESTAMPTZ DEFAULT NOW(),
    actualizado TIMESTAMPTZ DEFAULT NOW()
);

-- Historial de entregas de webhooks
CREATE TABLE webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID REFERENCES integration_configs(id),
    evento VARCHAR(50) NOT NULL,
    url VARCHAR(500) NOT NULL,
    status INTEGER,
    payload_size INTEGER,
    intento INTEGER DEFAULT 1,
    creado TIMESTAMPTZ DEFAULT NOW()
);

-- Cuentas por pagar
CREATE TABLE accounts_payable (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id),
    supplier_id UUID REFERENCES suppliers(id),
    purchase_order_id UUID REFERENCES purchase_orders(id),
    monto NUMERIC(15,0) NOT NULL,
    saldo NUMERIC(15,0) NOT NULL,
    fecha_vencimiento DATE,
    estado VARCHAR(20) DEFAULT 'pendiente',  -- pendiente, pagado, vencido
    creado TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- INTEGRATION TABLES (InteliCont, InteliAudit, SueldOK)
-- ==========================================

-- InteliCont Sync Configuration
CREATE TABLE intelicont_sync_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(100) NOT NULL UNIQUE,
    enabled BOOLEAN DEFAULT true,
    auto_sync BOOLEAN DEFAULT false,
    sync_interval_minutes INTEGER DEFAULT 60,
    last_sync_at TIMESTAMPTZ,
    url_base VARCHAR(500) NOT NULL,
    api_key VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- InteliCont Accounting Entries
CREATE TABLE intelicont_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha TIMESTAMPTZ NOT NULL,
    tipo_asiento VARCHAR(30) NOT NULL,  -- venta, compra, cobro, pago, ajuste, cierre
    descripcion TEXT,
    referencia_tipo VARCHAR(30) NOT NULL,  -- sale, purchase, payment, session, inventory
    referencia_id UUID NOT NULL,
    total_debe NUMERIC(15,0) NOT NULL,
    total_haber NUMERIC(15,0) NOT NULL,
    estado VARCHAR(20) DEFAULT 'generado',  -- generado, validado, sincronizado, error
    sync_status VARCHAR(20) DEFAULT 'pendiente',  -- pendiente, sincronizado, error
    synced_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- InteliCont Entry Lines
CREATE TABLE intelicont_entry_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID NOT NULL REFERENCES intelicont_entries(id) ON DELETE CASCADE,
    cuenta_codigo VARCHAR(20) NOT NULL,
    cuenta_nombre VARCHAR(100) NOT NULL,
    debe NUMERIC(15,0) DEFAULT 0,
    haber NUMERIC(15,0) DEFAULT 0,
    descripcion TEXT
);

CREATE INDEX idx_intelicont_entries_sync ON intelicont_entries(sync_status);
CREATE INDEX idx_intelicont_entries_referencia ON intelicont_entries(referencia_tipo, referencia_id);
CREATE INDEX idx_intelicont_entries_fecha ON intelicont_entries(fecha DESC);

-- InteliAudit Sync Configuration
CREATE TABLE inteliaudit_sync_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(100) NOT NULL UNIQUE,
    enabled BOOLEAN DEFAULT true,
    auto_sync BOOLEAN DEFAULT false,
    url_base VARCHAR(500) NOT NULL,
    api_key VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SueldOK Sync Configuration
CREATE TABLE sueldok_sync_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(100) NOT NULL UNIQUE,
    enabled BOOLEAN DEFAULT true,
    auto_sync BOOLEAN DEFAULT false,
    url_base VARCHAR(500) NOT NULL,
    api_key VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- PAGOPAR PAYMENT GATEWAY
-- ==========================================

CREATE TABLE pagopar_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    order_id VARCHAR(100) NOT NULL,
    amount BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    payment_method VARCHAR(50),
    card_brand VARCHAR(50),
    card_last4 VARCHAR(4),
    customer_email VARCHAR(200) NOT NULL,
    customer_name VARCHAR(200) NOT NULL,
    checkout_url TEXT,
    pagopar_id VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pagopar_company ON pagopar_transactions(company_id);
CREATE INDEX idx_pagopar_order ON pagopar_transactions(order_id);
CREATE INDEX idx_pagopar_status ON pagopar_transactions(status);

-- ==========================================
-- BACKUPS
-- ==========================================

CREATE TABLE backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    tenant_slug VARCHAR(100),
    schema_name VARCHAR(100) NOT NULL,
    filename VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    backup_type VARCHAR(20) NOT NULL DEFAULT 'manual',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
);

CREATE INDEX idx_backups_tenant ON backups(tenant_id);
CREATE INDEX idx_backups_status ON backups(status);
CREATE INDEX idx_backups_expires ON backups(expires_at);

-- Configuración de programación de backups
CREATE TABLE backup_schedule_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    enabled BOOLEAN NOT NULL DEFAULT true,
    frequency VARCHAR(20) NOT NULL DEFAULT 'daily',  -- hourly, daily, weekly, monthly
    hour INTEGER NOT NULL DEFAULT 2,  -- 0-23
    minute INTEGER NOT NULL DEFAULT 0,  -- 0-59
    day_of_week INTEGER,  -- 0-6 (0=Monday), used for weekly
    day_of_month INTEGER,  -- 1-31, used for monthly
    retention_days INTEGER NOT NULL DEFAULT 30,
    max_backups INTEGER,  -- null = unlimited
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_backup_schedule_tenant ON backup_schedule_config(tenant_id);
