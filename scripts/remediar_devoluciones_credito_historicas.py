"""Script de remediación para imputar devoluciones aprobadas históricas a sus Cuentas por Cobrar
y Líneas de Crédito de Clientes (Extra Club y Ventas a Crédito).

Uso:
  python scripts/remediar_devoluciones_credito_historicas.py --dry-run
  python scripts/remediar_devoluciones_credito_historicas.py --apply
"""

import sys
import asyncio
import argparse
from decimal import Decimal
from sqlalchemy import text

from api.src.db import async_session_factory


async def remediate(apply_changes: bool = False):
    async with async_session_factory() as db:
        print("=" * 80)
        print("REMEDIACIÓN DE DEVOLUCIONES HISTÓRICAS EN CUENTAS POR COBRAR Y CRÉDITO")
        print(f"Modo: {'APLICAR CAMBIOS EN BASE DE DATOS' if apply_changes else 'DRY RUN (Solo lectura)'}")
        print("=" * 80)

        # Buscar devoluciones aprobadas asociadas a ventas que tienen accounts_receivable o pago Extra Club
        q_returns = text("""
            SELECT 
                r.id AS return_id,
                r.numero AS return_numero,
                r.fecha AS return_fecha,
                r.total AS return_total,
                r.motivo AS return_motivo,
                r.customer_id,
                r.company_id,
                s.id AS sale_id,
                s.numero AS sale_numero,
                s.fecha AS sale_fecha,
                nc.id AS nc_id,
                nc.numero AS nc_numero,
                COALESCE(c.razon_social, c.nombre_fantasia, c.ruc, 'Cliente') AS cliente_nombre,
                c.ruc AS cliente_ruc
            FROM returns r
            JOIN sales s ON s.id = r.sale_id
            LEFT JOIN notas_credito_debito nc ON nc.id = r.nota_credito_id
            LEFT JOIN customers c ON c.id = r.customer_id
            WHERE r.estado IN ('aprobado', 'aprobada', 'Aprobado', 'APROBADO')
            ORDER BY r.fecha ASC
        """)
        res_returns = await db.execute(q_returns)
        returns_rows = res_returns.fetchall()
        print(f"Total devoluciones aprobadas analizadas: {len(returns_rows)}")

        remediated_count = 0

        for ret in returns_rows:
            # 1. Verificar si ya existe un CreditMovement para esta devolución
            q_cm = text("""
                SELECT id FROM credit_movements 
                WHERE referencia_type = 'return' AND referencia_id = :ret_id
            """)
            cm_res = await db.execute(q_cm, {"ret_id": str(ret.return_id)})
            existing_cm = cm_res.first()

            # 2. Verificar si la venta tiene cuenta por cobrar
            q_ar = text("""
                SELECT id, numero_documento, monto_original, saldo_pendiente, estado, notas_cobranza
                FROM accounts_receivable
                WHERE sale_id = :sale_id
            """)
            ar_res = await db.execute(q_ar, {"sale_id": str(ret.sale_id)})
            ar_rows = ar_res.fetchall()

            if not ar_rows and not existing_cm:
                # Verificar si tuvo pagos de Extra Club / Credito
                q_pay = text("""
                    SELECT id, forma_pago, monto FROM sale_payments 
                    WHERE sale_id = :sale_id AND UPPER(forma_pago) IN ('EXTRA_CLUB', 'CREDITO_LOCAL', 'CREDITO')
                """)
                pay_res = await db.execute(q_pay, {"sale_id": str(ret.sale_id)})
                if not pay_res.fetchall():
                    continue

            ret_total = Decimal(str(ret.return_total or 0))
            print("-" * 80)
            print(f"Devolución: {ret.return_numero} ({ret.return_fecha})")
            print(f"  Cliente: {ret.cliente_nombre} (RUC/CI: {ret.cliente_ruc})")
            print(f"  Venta original: {ret.sale_numero} ({ret.sale_fecha})")
            print(f"  Nota de Crédito: {ret.nc_numero or 'S/N'}")
            print(f"  Monto devolución: ₲ {ret_total:,.0f}")

            if existing_cm:
                print(f"  [OMITIDO] Ya cuenta con movimiento de crédito asentado.")
                continue

            # Verificar Cuentas por Cobrar
            rebaja_total = Decimal(0)
            if ar_rows:
                rem_dev = ret_total
                for ar in ar_rows:
                    saldo_act = Decimal(str(ar.saldo_pendiente or 0))
                    print(f"  AR Documento: {ar.numero_documento} | Saldo Actual: ₲ {saldo_act:,.0f} | Estado: {ar.estado}")
                    if saldo_act > Decimal(0) and rem_dev > Decimal(0):
                        rebaja = min(saldo_act, rem_dev)
                        nuevo_saldo = saldo_act - rebaja
                        nuevo_estado = "pagado" if nuevo_saldo == 0 else ar.estado
                        print(f"  -> Nuevo Saldo AR: ₲ {nuevo_saldo:,.0f} | Nuevo Estado: {nuevo_estado} (Rebaja: ₲ {rebaja:,.0f})")
                        rem_dev -= rebaja
                        rebaja_total += rebaja

                        if apply_changes:
                            nota_add = f"\n[Devolución {ret.return_numero} - NC {ret.nc_numero or 'S/N'}] -₲ {rebaja:,.0f}"
                            await db.execute(
                                text("""
                                    UPDATE accounts_receivable
                                    SET saldo_pendiente = :nuevo_saldo,
                                        estado = :nuevo_estado,
                                        notas_cobranza = CONCAT(COALESCE(notas_cobranza, ''), CAST(:nota_add AS text)),
                                        updated_at = NOW()
                                    WHERE id = CAST(:ar_id AS uuid)
                                """),
                                {
                                    "nuevo_saldo": nuevo_saldo,
                                    "nuevo_estado": nuevo_estado,
                                    "nota_add": nota_add,
                                    "ar_id": str(ar.id),
                                }
                            )

            if ar_rows and rebaja_total == Decimal(0):
                print(f"  [OMITIDO] Saldo de cuentas por cobrar ya estaba en 0 (pagado/liquidado previamente).")
                continue

            monto_liberar = rebaja_total if rebaja_total > Decimal(0) else ret_total

            # Verificar Credit Account del cliente
            if ret.customer_id and monto_liberar > Decimal(0):
                q_ca = text("""
                    SELECT id, limite_credito, saldo_disponible, saldo_utilizado
                    FROM credit_accounts
                    WHERE customer_id = CAST(:cid AS uuid)
                """)
                ca_res = await db.execute(q_ca, {"cid": str(ret.customer_id)})
                ca = ca_res.first()
                if ca:
                    limite = Decimal(str(ca.limite_credito or 0))
                    saldo_util = Decimal(str(ca.saldo_utilizado or 0))
                    saldo_disp = Decimal(str(ca.saldo_disponible or 0))
                    nuevo_util = max(Decimal(0), saldo_util - monto_liberar)
                    nuevo_disp = limite - nuevo_util
                    print(f"  Línea de Crédito Cliente:")
                    print(f"    Límite: ₲ {limite:,.0f} | Utilizado Actual: ₲ {saldo_util:,.0f} | Disponible Actual: ₲ {saldo_disp:,.0f}")
                    print(f"    -> Nuevo Utilizado: ₲ {nuevo_util:,.0f} | Nuevo Disponible: ₲ {nuevo_disp:,.0f} (Liberado: ₲ {monto_liberar:,.0f})")

                    if apply_changes:
                        await db.execute(
                            text("""
                                UPDATE credit_accounts
                                SET saldo_utilizado = :nuevo_util,
                                    saldo_disponible = :nuevo_disp,
                                    updated_at = NOW()
                                WHERE id = CAST(:ca_id AS uuid)
                            """),
                            {
                                "nuevo_util": nuevo_util,
                                "nuevo_disp": nuevo_disp,
                                "ca_id": str(ca.id),
                            }
                        )

                        # Insertar CreditMovement
                        await db.execute(
                            text("""
                                INSERT INTO credit_movements (
                                    id, company_id, credit_account_id, customer_id, tipo,
                                    monto, saldo_anterior, saldo_nuevo, referencia_type, referencia_id,
                                    observaciones, created_at
                                ) VALUES (
                                    gen_random_uuid(), CAST(:comp_id AS uuid), CAST(:ca_id AS uuid), CAST(:cid AS uuid), 'devolucion',
                                    :monto, :saldo_ant, :saldo_nuevo, 'return', CAST(:ret_id AS uuid),
                                    CAST(:obs AS text), :created_at
                                )
                            """),
                            {
                                "comp_id": str(ret.company_id),
                                "ca_id": str(ca.id),
                                "cid": str(ret.customer_id),
                                "monto": monto_liberar,
                                "saldo_ant": saldo_util,
                                "saldo_nuevo": nuevo_util,
                                "ret_id": str(ret.return_id),
                                "obs": f"Devolución {ret.return_numero} — Factura {ret.sale_numero or ''}",
                                "created_at": ret.return_fecha,
                            }
                        )

            remediated_count += 1

        if apply_changes:
            await db.commit()
            print("\n" + "=" * 80)
            print(f"¡ÉXITO! Se aplicaron los cambios en {remediated_count} devoluciones.")
            print("=" * 80)
        else:
            print("\n" + "=" * 80)
            print(f"Simulación completa. Devoluciones a remediar: {remediated_count}")
            print("Para aplicar los cambios ejecute con --apply")
            print("=" * 80)


def main():
    parser = argparse.ArgumentParser(description="Remediar devoluciones históricas en AR y Crédito")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--dry-run", action="store_true", help="Modo simulación sin escribir en BD")
    group.add_argument("--apply", action="store_true", help="Aplica los cambios en base de datos")

    args = parser.parse_args()
    asyncio.run(remediate(apply_changes=args.apply))


if __name__ == "__main__":
    main()
