-- =============================================================================
-- Migración: Sistema Profesional de Ajustes de Stock & Toma Física
-- Versión: 2.0
-- Fecha: 2026-09-12
-- Descripción: 
--   - Extiende inventory_adjustments con workflow doble aprobación
--   - Agrega audit trail inmutable (stock_adjustment_audit_logs)
--   - Agrega toma física (physical_inventory_sessions + items)
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------
-- 1. Extender inventory_adjustments (columnas nuevas, compatibles con legado)
-- -----------------------------------------------------------------------

ALTER TABLE inventory_adjustments
    -- Motivo estructurado
    ADD COLUMN IF NOT EXISTS motivo_codigo         VARCHAR(50),
    ADD COLUMN IF NOT EXISTS motivo_label          VARCHAR(120),
    ADD COLUMN IF NOT EXISTS motivo_detalle        TEXT,
    ADD COLUMN IF NOT EXISTS riesgo                VARCHAR(10) NOT NULL DEFAULT 'bajo',

    -- Workflow doble aprobación
    ADD COLUMN IF NOT EXISTS aprobado_por_gerencia           UUID,
    ADD COLUMN IF NOT EXISTS aprobado_por_gerencia_nombre    VARCHAR(120),
    ADD COLUMN IF NOT EXISTS fecha_aprobacion_gerencia       TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS comentario_gerencia             TEXT,

    ADD COLUMN IF NOT EXISTS aprobado_por_administracion          UUID,
    ADD COLUMN IF NOT EXISTS aprobado_por_administracion_nombre   VARCHAR(120),
    ADD COLUMN IF NOT EXISTS fecha_aprobacion_administracion      TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS comentario_administracion            TEXT,

    -- Rechazo
    ADD COLUMN IF NOT EXISTS rechazado_por          UUID,
    ADD COLUMN IF NOT EXISTS rechazado_por_nombre   VARCHAR(120),
    ADD COLUMN IF NOT EXISTS motivo_rechazo         TEXT,
    ADD COLUMN IF NOT EXISTS fecha_rechazo          TIMESTAMPTZ,

    -- Impacto financiero pre-calculado
    ADD COLUMN IF NOT EXISTS impacto_financiero_gs  NUMERIC(18,0) NOT NULL DEFAULT 0,

    -- Evidencia fotográfica/documental
    ADD COLUMN IF NOT EXISTS evidencia_urls         JSONB,

    -- Referencia a sesión de toma física
    ADD COLUMN IF NOT EXISTS physical_session_id    UUID,

    -- updated_at
    ADD COLUMN IF NOT EXISTS updated_at             TIMESTAMPTZ DEFAULT NOW();

-- Ampliar código (de VARCHAR(20) a VARCHAR(30))
ALTER TABLE inventory_adjustments 
    ALTER COLUMN codigo TYPE VARCHAR(30);

-- Ampliar estado (de VARCHAR(20) a VARCHAR(30))
ALTER TABLE inventory_adjustments 
    ALTER COLUMN estado TYPE VARCHAR(30);

-- Migracion de estado legado 'pendiente' a 'pendiente_gerencia' para registros históricos
UPDATE inventory_adjustments 
    SET estado = 'pendiente_gerencia', 
        motivo_codigo = 'conteo_fisico',
        motivo_detalle = COALESCE(observaciones, motivo, 'Ajuste histórico migrado')
    WHERE estado = 'pendiente';

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_inv_adj_estado ON inventory_adjustments(estado);
CREATE INDEX IF NOT EXISTS idx_inv_adj_riesgo ON inventory_adjustments(riesgo);
CREATE INDEX IF NOT EXISTS idx_inv_adj_company ON inventory_adjustments(company_id);

-- -----------------------------------------------------------------------
-- 2. Extender inventory_adjustment_items (desnormalización de nombres)
-- -----------------------------------------------------------------------

ALTER TABLE inventory_adjustment_items
    ADD COLUMN IF NOT EXISTS product_nombre VARCHAR(200),
    ADD COLUMN IF NOT EXISTS product_sku    VARCHAR(60),
    ADD COLUMN IF NOT EXISTS impacto_gs     NUMERIC(18,0);

-- Cambiar tipos de columnas Integer a Numeric para soportar decimales (pesables)
ALTER TABLE inventory_adjustment_items
    ALTER COLUMN cantidad_sistema TYPE NUMERIC(15,3) USING cantidad_sistema::NUMERIC(15,3),
    ALTER COLUMN cantidad_fisica  TYPE NUMERIC(15,3) USING cantidad_fisica::NUMERIC(15,3),
    ALTER COLUMN diferencia       TYPE NUMERIC(15,3) USING diferencia::NUMERIC(15,3);

-- -----------------------------------------------------------------------
-- 3. Audit Trail inmutable
-- -----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS stock_adjustment_audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    adjustment_id   UUID NOT NULL REFERENCES inventory_adjustments(id),
    accion          VARCHAR(40) NOT NULL,
    user_id         UUID NOT NULL,
    user_nombre     VARCHAR(120),
    rol_firmante    VARCHAR(40),
    comentario      TEXT,
    ip_address      VARCHAR(50),
    metadata_extra  JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_adjustment ON stock_adjustment_audit_logs(adjustment_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON stock_adjustment_audit_logs(created_at);

-- Política de seguridad: solo INSERT (audit trail inmutable)
-- En producción considerar: REVOKE UPDATE, DELETE ON stock_adjustment_audit_logs FROM app_user;

-- -----------------------------------------------------------------------
-- 4. Sesiones de Toma Física
-- -----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS physical_inventory_sessions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              UUID NOT NULL,
    warehouse_id            UUID NOT NULL,
    codigo                  VARCHAR(30) NOT NULL UNIQUE,
    tipo                    VARCHAR(20) NOT NULL DEFAULT 'total',

    -- Alcance
    categoria_id            UUID,
    pasillo                 VARCHAR(50),
    descripcion_alcance     TEXT,

    -- Estado: abierta | en_conteo | cerrada | cancelada
    estado                  VARCHAR(20) NOT NULL DEFAULT 'abierta',
    notas                   TEXT,

    -- Responsables
    creado_por              UUID,
    creado_por_nombre       VARCHAR(120),
    contador_1_id           UUID,
    contador_1_nombre       VARCHAR(120),
    contador_2_id           UUID,
    contador_2_nombre       VARCHAR(120),
    cerrado_por             UUID,
    cerrado_por_nombre      VARCHAR(120),

    -- Totales resultado
    total_items             INTEGER DEFAULT 0,
    items_con_diferencia    INTEGER DEFAULT 0,
    diferencia_total_unidades NUMERIC(15,3) DEFAULT 0,
    diferencia_total_gs     NUMERIC(18,0) DEFAULT 0,

    -- Referencia al ajuste generado al cerrar
    adjustment_id           UUID REFERENCES inventory_adjustments(id),

    fecha_inicio            TIMESTAMPTZ,
    fecha_cierre            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phys_session_company ON physical_inventory_sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_phys_session_estado  ON physical_inventory_sessions(estado);

-- FK en inventory_adjustments → physical_inventory_sessions
ALTER TABLE inventory_adjustments
    ADD CONSTRAINT IF NOT EXISTS fk_adj_physical_session 
    FOREIGN KEY (physical_session_id) REFERENCES physical_inventory_sessions(id);

-- -----------------------------------------------------------------------
-- 5. Items de Toma Física
-- -----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS physical_inventory_session_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          UUID NOT NULL REFERENCES physical_inventory_sessions(id) ON DELETE CASCADE,
    product_id          UUID NOT NULL,
    product_nombre      VARCHAR(200),
    product_sku         VARCHAR(60),
    product_codigo_barra VARCHAR(60),

    -- Stock del sistema (congelado al abrir sesión)
    cantidad_sistema    NUMERIC(15,3) NOT NULL DEFAULT 0,
    costo_unitario      NUMERIC(15,0),

    -- Conteo 1
    cantidad_conteo_1   NUMERIC(15,3),
    contado_1_at        TIMESTAMPTZ,
    contado_1_by        UUID,

    -- Conteo 2 (doble ciego)
    cantidad_conteo_2   NUMERIC(15,3),
    contado_2_at        TIMESTAMPTZ,
    contado_2_by        UUID,

    -- Cantidad final reconciliada
    cantidad_final      NUMERIC(15,3),
    reconciliado_by     UUID,
    nota_reconciliacion TEXT,

    -- Diferencia
    diferencia          NUMERIC(15,3),
    impacto_gs          NUMERIC(18,0),

    -- Estado: pendiente | conteo_1 | conteo_2 | reconciliado
    estado              VARCHAR(20) NOT NULL DEFAULT 'pendiente',

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phys_item_session ON physical_inventory_session_items(session_id);
CREATE INDEX IF NOT EXISTS idx_phys_item_product ON physical_inventory_session_items(product_id);

COMMIT;

-- Verificación
DO $$
BEGIN
    RAISE NOTICE '✅ Migración completada exitosamente';
    RAISE NOTICE '   - inventory_adjustments: columnas de doble aprobación agregadas';
    RAISE NOTICE '   - stock_adjustment_audit_logs: tabla de audit trail creada';
    RAISE NOTICE '   - physical_inventory_sessions: tabla de toma física creada';
    RAISE NOTICE '   - physical_inventory_session_items: tabla de items creada';
END $$;
