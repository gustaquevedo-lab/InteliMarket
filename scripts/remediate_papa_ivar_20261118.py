import asyncio
import sys
from decimal import Decimal
from sqlalchemy import text
from api.src.db import engine

SID = '6cf8d3de-2556-4d15-a372-398a36dacfec'

PAIRS = [
    {
        "num": "001-001-0084068",
        "real_id": "a21eae14-748f-44fa-8bb4-41dfd6fca31a",
        "real_total": Decimal("538082"),
        "real_rec": "REC-3608",
        "ghost_id": "6a148525-d6b9-418d-ae3a-f79aeb2e378a",
    },
    {
        "num": "001-001-0084069",
        "real_id": "afc48120-1dc8-43f6-a7f6-ae809d825eab",
        "real_total": Decimal("684786"),
        "real_rec": "REC-3609",
        "ghost_id": "20279af7-8e8a-4499-8500-bc3198a2544a",
    },
    {
        "num": "001-001-0087249",
        "real_id": "b4acc047-45e4-4baf-b17b-ded00a4ac10c",
        "real_total": Decimal("1598457"),
        "real_rec": "REC-3868",
        "ghost_id": "b853bb92-c65b-4517-b083-83a2951fad61",
    },
    {
        "num": "001-001-0087250",
        "real_id": "6d1f0b4d-61ef-4e26-b560-0c2b8036f351",
        "real_total": Decimal("2554238"),
        "real_rec": "REC-3869",
        "ghost_id": "591b5722-cc1a-42c0-a48d-4421082e733d",
    },
    {
        "num": "001-001-0087251",
        "real_id": "638efcbf-525f-470b-943e-7e9d67016c05",
        "real_total": Decimal("628347"),
        "real_rec": "REC-3870",
        "ghost_id": "6d4392ff-38d4-4c6e-b270-0e081b0c5733",
    },
]

SEPTEMBER_PENDING = [
    '001-001-0097360', '001-001-0097696', '001-001-0097697', '001-001-0097698',
    '001-001-0097699', '001-001-0097700', '001-001-0097701', '001-001-0097702',
    '001-001-0097703', '001-001-0097704', '001-001-0097705', '001-001-0097706',
    '001-001-0097707', '001-001-0097708', '001-001-0097866', '001-001-0098560',
]

async def run(commit_changes: bool = False):
    print("=" * 80)
    print(f"REMEDIACIÓN CUENTAS POR PAGAR — PAPA IVAR (MODO: {'COMMIT REAL' if commit_changes else 'DRY RUN'})")
    print("=" * 80)

    async with engine.begin() as conn:
        # 1. Crear tabla de respaldo si no existe
        if commit_changes:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS audit_remediation_papa_ivar_20261118 (
                    id UUID PRIMARY KEY,
                    numero_factura VARCHAR(100),
                    total NUMERIC(18, 4),
                    saldo_pendiente_prev NUMERIC(18, 4),
                    saldo_pendiente_new NUMERIC(18, 4),
                    estado_prev VARCHAR(50),
                    estado_new VARCHAR(50),
                    motivo TEXT,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                );
            """))

        # 2. Procesar los 5 pares de Julio
        print("\n--- PASO 1: REMEDIACIÓN DE LAS 5 FACTURAS DE JULIO ---")
        total_deuda_restaurada = Decimal("0")

        for p in PAIRS:
            num = p["num"]
            real_id = p["real_id"]
            real_tot = p["real_total"]
            real_rec = p["real_rec"]
            ghost_id = p["ghost_id"]

            # Obtener estado actual
            r_real = (await conn.execute(text("SELECT id, numero_factura, total, saldo_pendiente, estado FROM supplier_invoices WHERE id = :id"), {"id": real_id})).fetchone()
            r_ghost = (await conn.execute(text("SELECT id, numero_factura, total, saldo_pendiente, estado FROM supplier_invoices WHERE id = :id"), {"id": ghost_id})).fetchone()

            print(f"\nFactura: {num}")
            print(f"  REAL PREVIA:  ID: {real_id} | Total: {r_real.total:,.0f} | Saldo: {r_real.saldo_pendiente:,.0f} | Est: {r_real.estado}")
            print(f"  GHOST PREVIA: ID: {ghost_id} | Total: {r_ghost.total:,.0f} | Saldo: {r_ghost.saldo_pendiente:,.0f} | Est: {r_ghost.estado}")

            if commit_changes:
                # Primero: marcar el fantasma como cancelada
                await conn.execute(text("""
                    INSERT INTO audit_remediation_papa_ivar_20261118 (id, numero_factura, total, saldo_pendiente_prev, saldo_pendiente_new, estado_prev, estado_new, motivo)
                    VALUES (:id, :num, :tot, :saldo_prev, 0, :est_prev, 'cancelada', 'Ghost record anulado definitivamente')
                    ON CONFLICT (id) DO UPDATE SET saldo_pendiente_new = 0, estado_new = 'cancelada';
                """), {
                    "id": ghost_id,
                    "num": r_ghost.numero_factura,
                    "tot": r_ghost.total,
                    "saldo_prev": r_ghost.saldo_pendiente,
                    "est_prev": r_ghost.estado,
                })

                await conn.execute(text("""
                    UPDATE supplier_invoices
                    SET estado = 'cancelada',
                        saldo_pendiente = 0,
                        notas = :nota,
                        updated_at = NOW()
                    WHERE id = :id
                """), {
                    "id": ghost_id,
                    "nota": f"[ANULADO DEFINITIVAMENTE: Registro residual sustituido por factura real {real_tot:,.0f} {real_id}]",
                })

                # Segundo: reactivar la factura real a aprobada con saldo completo
                await conn.execute(text("""
                    INSERT INTO audit_remediation_papa_ivar_20261118 (id, numero_factura, total, saldo_pendiente_prev, saldo_pendiente_new, estado_prev, estado_new, motivo)
                    VALUES (:id, :num, :tot, :saldo_prev, :saldo_new, :est_prev, 'aprobada', :motivo)
                    ON CONFLICT (id) DO UPDATE SET saldo_pendiente_new = :saldo_new, estado_new = 'aprobada';
                """), {
                    "id": real_id,
                    "num": r_real.numero_factura,
                    "tot": real_tot,
                    "saldo_prev": r_real.saldo_pendiente,
                    "saldo_new": real_tot,
                    "est_prev": r_real.estado,
                    "motivo": f"Reactivación canónica de factura muelle {real_rec}",
                })

                await conn.execute(text("""
                    UPDATE supplier_invoices
                    SET estado = 'aprobada',
                        saldo_pendiente = :saldo,
                        notas = :nota,
                        updated_at = NOW()
                    WHERE id = :id
                """), {
                    "id": real_id,
                    "saldo": real_tot,
                    "nota": f"Reactivada según auditoría consolidada de muelle {real_rec}.",
                })

            total_deuda_restaurada += real_tot
            print(f"  -> ACCIÓN: Reactivar {real_id} ({real_tot:,.0f} Gs., saldo={real_tot:,.0f}, estado='aprobada') y Anular {ghost_id}")

        print(f"\nTotal deuda restaurada en Paso 1: {total_deuda_restaurada:,.0f} Gs.")

        # 3. Pasar facturas de septiembre de 'pendiente' a 'aprobada'
        print("\n--- PASO 2: APROBACIÓN DE FACTURAS DE SEPTIEMBRE EN ESTADO PENDIENTE ---")
        nums_quoted = ", ".join([f"'{n}'" for n in SEPTEMBER_PENDING])
        sep_rows = (await conn.execute(text(f"""
            SELECT id, numero_factura, total, saldo_pendiente, estado
            FROM supplier_invoices
            WHERE supplier_id = :sid 
              AND numero_factura IN ({nums_quoted})
              AND estado = 'pendiente'
        """), {"sid": SID})).fetchall()

        print(f"Facturas encontradas en estado 'pendiente': {len(sep_rows)}")
        total_sept = Decimal("0")
        for s in sep_rows:
            total_sept += s.saldo_pendiente
            print(f"  Aprobar: {s.numero_factura} | Total: {s.total:,.0f} | Saldo: {s.saldo_pendiente:,.0f}")
            if commit_changes:
                await conn.execute(text("""
                    INSERT INTO audit_remediation_papa_ivar_20261118 (id, numero_factura, total, saldo_pendiente_prev, saldo_pendiente_new, estado_prev, estado_new, motivo)
                    VALUES (:id, :num, :tot, :saldo, :saldo, 'pendiente', 'aprobada', 'Aprobación formal de facturas recibidas de setiembre')
                    ON CONFLICT (id) DO UPDATE SET estado_new = 'aprobada';
                """), {
                    "id": s.id,
                    "num": s.numero_factura,
                    "tot": s.total,
                    "saldo": s.saldo_pendiente,
                })
                await conn.execute(text("""
                    UPDATE supplier_invoices
                    SET estado = 'aprobada',
                        updated_at = NOW()
                    WHERE id = :id
                """), {"id": s.id})

        print(f"Total importe formalizado en Paso 2: {total_sept:,.0f} Gs.")

        if not commit_changes:
            print("\n*** MODO DRY-RUN COMPLETADO. NO SE GUARDARON CAMBIOS EN LA BASE DE DATOS. ***")
        else:
            print("\n✓ REMEDIACIÓN APLICADA Y PERSISTIDA CON ÉXITO EN POSTGRESQL.")

if __name__ == "__main__":
    commit = "--commit" in sys.argv
    asyncio.run(run(commit_changes=commit))
