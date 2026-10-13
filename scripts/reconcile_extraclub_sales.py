"""Script para auditar y regularizar ventas Extra Club sin cuenta por cobrar creada.
Uso:
  python scripts/reconcile_extraclub_sales.py --dry-run
  python scripts/reconcile_extraclub_sales.py --apply
"""

import sys
import asyncio
from decimal import Decimal
from datetime import datetime, timezone, timedelta, date
import argparse
from sqlalchemy import select, text

from api.src.db import async_session_factory
from api.src.sales.models import Sale, SalePayment
from api.src.customers.models import Customer
from api.src.credit_accounts.models import CreditAccount, CreditMovement
from api.src.accounts_receivable.service import create_accounts_receivable_for_sale


async def reconcile(apply_changes: bool = False):
    async with async_session_factory() as db:
        print("=" * 70)
        print("RECONCILIACIÓN DE VENTAS EXTRA CLUB / CRÉDITO SIN CUENTAS POR COBRAR")
        print(f"Modo: {'APLICAR CAMBIOS' if apply_changes else 'DRY RUN (Solo lectura)'}")
        print("=" * 70)

        # 1. Buscar ventas con pago EXTRA_CLUB o CREDITO que no tengan cuentas por cobrar
        # Excluyendo ventas canceladas o devueltas
        query = text("""
            SELECT 
                s.id AS sale_id,
                s.company_id,
                s.customer_id,
                s.numero,
                s.condicion,
                s.total,
                s.estado,
                s.fecha,
                s.created_at,
                COALESCE(c.razon_social, c.nombre_fantasia, c.ruc) AS customer_nombre,
                c.ruc AS customer_ruc,
                c.extra_club_numero,
                sp.monto AS payment_monto,
                sp.forma_pago
            FROM sales s
            JOIN sale_payments sp ON s.id = sp.sale_id
            LEFT JOIN accounts_receivable ar ON s.id = ar.sale_id
            LEFT JOIN customers c ON s.customer_id = c.id
            WHERE sp.forma_pago IN ('EXTRA_CLUB', 'CREDITO')
              AND s.estado NOT IN ('cancelado', 'devuelto')
              AND ar.id IS NULL
            ORDER BY s.created_at ASC
        """)

        res = await db.execute(query)
        rows = res.fetchall()

        print(f"\nTotal de ventas con pago a crédito sin cuenta por cobrar: {len(rows)}")

        if not rows:
            print("No hay ventas pendientes de regularización.")
            return

        total_monto = sum(Decimal(str(r.payment_monto)) for r in rows)
        print(f"Monto total a regularizar en cuentas por cobrar: ₲ {total_monto:,.0f}\n")

        processed_sales = 0
        accounts_created = 0
        credit_movements_created = 0

        for r in rows:
            sale_id = r.sale_id
            company_id = r.company_id
            customer_id = r.customer_id
            monto_credito = Decimal(str(r.payment_monto))
            numero = r.numero
            fecha_emision = r.fecha or r.created_at

            print(f"-> Venta {numero} ({fecha_emision.strftime('%Y-%m-%d %H:%M')}) | Cliente: {r.customer_nombre} | ₲ {monto_credito:,.0f}")

            if not customer_id:
                print(f"   [AVISO] Venta {numero} no tiene customer_id, omitiendo...")
                continue

            if apply_changes:
                # 1. Actualizar sale.condicion = 'credito'
                await db.execute(
                    text("UPDATE sales SET condicion = 'credito', updated_at = now() WHERE id = :sid"),
                    {"sid": sale_id}
                )

                # 2. Crear cuenta por cobrar usando la función oficial del sistema preservando la fecha de emisión original
                fecha_venc = fecha_emision.date() + timedelta(days=30)
                await create_accounts_receivable_for_sale(
                    db=db,
                    company_id=str(company_id),
                    customer_id=str(customer_id),
                    sale_id=str(sale_id),
                    total=monto_credito,
                    numero=numero,
                    fecha_vencimiento=fecha_venc,
                    fecha_emision=fecha_emision,
                )
                accounts_created += 1

                # 3. Actualizar CreditAccount si existe
                acc_res = await db.execute(
                    select(CreditAccount).where(
                        CreditAccount.company_id == company_id,
                        CreditAccount.customer_id == customer_id,
                    )
                )
                account = acc_res.scalar_one_or_none()

                if account:
                    saldo_anterior = account.saldo_utilizado
                    account.saldo_utilizado += monto_credito
                    account.saldo_disponible = max(Decimal("0"), account.limite_credito - account.saldo_utilizado)
                    account.updated_at = datetime.now(timezone.utc)

                    mov = CreditMovement(
                        company_id=company_id,
                        credit_account_id=account.id,
                        customer_id=customer_id,
                        tipo="compra",
                        monto=monto_credito,
                        saldo_anterior=saldo_anterior,
                        saldo_nuevo=account.saldo_utilizado,
                        referencia_type="sale",
                        referencia_id=sale_id,
                        observaciones=f"Regularizacion venta {numero}",
                        created_at=fecha_emision,
                    )
                    db.add(mov)
                    credit_movements_created += 1

                processed_sales += 1

        if apply_changes:
            await db.commit()
            print("\n" + "=" * 70)
            print(f"REGULARIZACIÓN COMPLETADA CON ÉXITO:")
            print(f"- Ventas actualizadas a crédito: {processed_sales}")
            print(f"- Cuentas por cobrar creadas: {accounts_created}")
            print(f"- Movimientos de crédito registrados: {credit_movements_created}")
            print("=" * 70)
        else:
            print("\n" + "=" * 70)
            print("EJECUCIÓN EN MODO DRY-RUN -- NO SE MODIFICARON DATOS")
            print("Para aplicar los cambios, ejecute con: --apply")
            print("=" * 70)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Reconciliar ventas Extra Club sin AR")
    parser.add_argument("--apply", action="store_true", help="Aplicar los cambios a la base de datos")
    args = parser.parse_args()

    asyncio.run(reconcile(apply_changes=args.apply))
