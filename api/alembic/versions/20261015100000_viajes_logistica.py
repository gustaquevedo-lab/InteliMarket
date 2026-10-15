"""viajes logistica

Revision ID: 20261015100000
Revises: 20261014120000
Create Date: 2026-10-15 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "20261015100000"
down_revision = "20261014120000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE trip_vehicles (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id UUID NOT NULL,
            patente VARCHAR(15) NOT NULL,
            descripcion VARCHAR(100),
            max_weight_kg NUMERIC(10,2) NOT NULL,
            activo BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_trip_vehicle_company_patente UNIQUE (company_id, patente)
        )
    """)

    op.execute("""
        CREATE TABLE trips (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id UUID NOT NULL,
            cobrador_id UUID NOT NULL,
            patente VARCHAR(15) NOT NULL,
            fecha DATE NOT NULL,
            estado VARCHAR(20) NOT NULL DEFAULT 'armando',
            km_salida INTEGER,
            km_llegada INTEGER,
            peso_total_kg NUMERIC(10,2),
            route_session_id UUID,
            despachante_id UUID NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_trip_cobrador_fecha UNIQUE (company_id, cobrador_id, fecha)
        )
    """)
    op.execute("CREATE INDEX ix_trips_company_fecha ON trips (company_id, fecha)")

    op.execute("""
        CREATE TABLE trip_stops (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
            sales_order_id UUID NOT NULL,
            customer_id UUID NOT NULL,
            orden_visita INTEGER NOT NULL,
            estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
            firmado BOOLEAN NOT NULL DEFAULT false,
            observaciones TEXT,
            visited_at TIMESTAMPTZ
        )
    """)
    op.execute("CREATE INDEX ix_trip_stops_trip_id ON trip_stops (trip_id)")

    op.execute("""
        CREATE TABLE trip_stop_items (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            stop_id UUID NOT NULL REFERENCES trip_stops(id) ON DELETE CASCADE,
            sales_order_item_id UUID NOT NULL,
            product_id UUID NOT NULL,
            cantidad_asignada NUMERIC(12,3) NOT NULL,
            cantidad_entregada NUMERIC(12,3) NOT NULL DEFAULT 0,
            cantidad_rechazada NUMERIC(12,3) NOT NULL DEFAULT 0,
            cantidad_faltante NUMERIC(12,3) NOT NULL DEFAULT 0,
            nc_id UUID
        )
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS trip_stop_items")
    op.execute("DROP TABLE IF EXISTS trip_stops")
    op.execute("DROP TABLE IF EXISTS trips")
    op.execute("DROP TABLE IF EXISTS trip_vehicles")
