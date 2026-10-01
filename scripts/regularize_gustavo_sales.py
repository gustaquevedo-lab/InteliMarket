import asyncio
import uuid
from decimal import Decimal
from datetime import datetime, timezone, timedelta, date
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text, select

DATABASE_URL = "postgresql+asyncpg://intelimarket:password@localhost:5432/intelimarket"

COMPANY_ID = "00000000-0000-0000-0000-000000000010"
CUSTOMER_ID = "62dc7bda-a1d2-4bca-be9b-f2eb73738aa3"
EXTRA_CLUB_NUM = "71761b7d-ca41-4609-aa05-7d483914b5e0"

async def main():
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    async with async_session() as db:
        async with db.begin():
            # 1. Obtener correlativos para Caja 5
            max_num_res = await db.execute(
                text("SELECT MAX(numero) FROM sales WHERE numero LIKE '001-015-%'")
            )
            curr_max_str = max_num_res.scalar() or "001-015-0005508"
            curr_seq = int(curr_max_str.split("-")[2])
            
            num1 = f"001-015-{curr_seq + 1:07d}"
            num2 = f"001-015-{curr_seq + 2:07d}"
            
            # Obtener correlativos internos
            max_int_res = await db.execute(
                text("SELECT MAX(CAST(numero_interno AS INTEGER)) FROM sales WHERE numero_interno ~ '^[0-9]+$'")
            )
            curr_int = max_int_res.scalar() or 12577
            int1 = str(curr_int + 1)
            int2 = str(curr_int + 2)

            print(f"Asignando correlativos:")
            print(f"Venta 27-Sep: {num1} (interno: {int1})")
            print(f"Venta 29-Sep: {num2} (interno: {int2})")

            # 2. Venta 1: 27-Sep-2026 (Gs. 355.231)
            sale1_id = uuid.uuid4()
            dt1 = datetime(2026, 9, 27, 10, 28, 33, tzinfo=timezone(timedelta(hours=-4)))
            user1_id = "f2ce6e50-9a00-4127-a91c-c57b5e28f477"  # Nilda Aquino
            sess1_id = "482ef193-5b59-4666-9298-bf802bb76702"
            total1 = Decimal("355231")

            base1 = round(total1 / Decimal("1.1"))
            iva1 = total1 - base1
            await db.execute(
                text("""
                    INSERT INTO sales (
                        id, company_id, customer_id, numero, numero_interno,
                        tipo_comprobante, condicion, moneda, tipo_cambio, estado,
                        subtotal, descuento_total, base_gravada_10, base_gravada_5, base_exenta,
                        iva_10, iva_5, total, total_pagado, saldo, observaciones,
                        user_id, session_id, created_at, updated_at
                    ) VALUES (
                        :id, :company_id, :customer_id, :numero, :numero_interno,
                        'ticket', 'credito', 'PYG', 1, 'confirmado',
                        :total, 0, :base10, 0, 0,
                        :iva10, 0, :total, :total, 0,
                        :observaciones, :user_id, :session_id, :dt, :dt
                    )
                """),
                {
                    "id": sale1_id, "company_id": COMPANY_ID, "customer_id": CUSTOMER_ID,
                    "numero": num1, "numero_interno": int1, "total": total1,
                    "base10": base1, "iva10": iva1,
                    "observaciones": f"Extra Club Socio {EXTRA_CLUB_NUM} (Venta recuperada de Caja 5)",
                    "user_id": user1_id, "session_id": sess1_id, "dt": dt1
                }
            )

            # Pagos venta 1
            await db.execute(
                text("""
                    INSERT INTO sale_payments (company_id, sale_id, forma_pago, monto, fecha, moneda, created_at)
                    VALUES (:company_id, :sale_id, 'EXTRA_CLUB', :monto, :dt, 'PYG', :dt)
                """),
                {"company_id": COMPANY_ID, "sale_id": sale1_id, "monto": total1, "dt": dt1}
            )

            # Items venta 1 (detalle canónico aproximado según productos detectados)
            items1 = [
                ("a44fb876-39d8-4ee9-8911-cf91dfb7e234", "ML COSTILLA DE PRIMERA / MATAMBRE KG", Decimal("2.850"), Decimal("34777"), Decimal("99114")),
                ("8d1edde2-7bd6-4931-86eb-9160fdbce3fb", "ML VACIO KG", Decimal("2.100"), Decimal("45777"), Decimal("96132")),
                ("0b297f41-3d2f-4e1c-92a0-2b35683bf9b8", "AURORA CHORIZO TOSCANA KG", Decimal("1.500"), Decimal("28000"), Decimal("42000")),
                ("3b9239e9-c90b-454d-99dd-a04edf57c9f0", "OCHSI CHORIZO VIENA KG", Decimal("1.000"), Decimal("39900"), Decimal("39900")),
                ("1f46cc7c-84a3-4b2b-bc4c-55b21991bc51", "ML CHORIZO CON PIMIENTA KG", Decimal("1.000"), Decimal("37777"), Decimal("37777")),
                ("2a70e8a4-83f8-4bf5-bc06-6f26f2268e96", "CARBON ESPECIAL 3 KILOS", Decimal("2.000"), Decimal("8000"), Decimal("16000")),
                ("079f1980-ca8f-4d47-8b6f-fa7421083912", "DE PANES PANETONE FRUTAS CRISTALIZADAS 400G (18)", Decimal("1.000"), Decimal("14977"), Decimal("14977")),
                ("42f83905-7865-43da-995f-ceb8eb872ebe", "BOLSA PLASTICA INTERNA", Decimal("1.000"), Decimal("500"), Decimal("500")),
                ("74f5464f-119d-4ff1-9f09-98d26cc25c3b", "PAN FRANCES KG", Decimal("0.903"), Decimal("9777"), Decimal("8831")),
            ]
            for p_id, p_nom, p_qty, p_pr, p_tot in items1:
                p_iva = round(p_tot / Decimal("11"))
                await db.execute(
                    text("""
                        INSERT INTO sale_items (
                            sale_id, product_id, descripcion, cantidad,
                            precio_unitario, total, iva_tasa, iva_monto, descuento_monto
                        ) VALUES (
                            :sale_id, :p_id, :p_nom, :p_qty,
                            :p_pr, :p_tot, 10, :p_iva, 0
                        )
                    """),
                    {"sale_id": sale1_id, "p_id": p_id, "p_nom": p_nom, "p_qty": p_qty, "p_pr": p_pr, "p_tot": p_tot, "p_iva": p_iva}
                )

            # Cuentas por cobrar venta 1
            await db.execute(
                text("""
                    INSERT INTO accounts_receivable (
                        company_id, customer_id, sale_id, numero_documento,
                        fecha_emision, fecha_vencimiento, moneda, monto_original,
                        saldo_pendiente, tipo, estado, created_at, updated_at
                    ) VALUES (
                        :company_id, :customer_id, :sale_id, :numero,
                        :dt, :venc, 'PYG', :monto, :monto, 'factura', 'pendiente', :dt, :dt
                    )
                """),
                {
                    "company_id": COMPANY_ID, "customer_id": CUSTOMER_ID, "sale_id": sale1_id,
                    "numero": num1, "dt": dt1, "venc": date(2026, 10, 31), "monto": total1
                }
            )

            # 3. Venta 2: 29-Sep-2026 (Gs. 38.502)
            sale2_id = uuid.uuid4()
            dt2 = datetime(2026, 9, 29, 17, 21, 37, tzinfo=timezone(timedelta(hours=-4)))
            user2_id = "7e5684e7-3cb9-4eb9-81bb-54c9ec5c0004"  # Tomasa
            sess2_id = "05c2e6c2-adf7-4afa-9332-c69d2c2c161b"
            total2 = Decimal("38502")

            base2 = round(total2 / Decimal("1.1"))
            iva2 = total2 - base2
            await db.execute(
                text("""
                    INSERT INTO sales (
                        id, company_id, customer_id, numero, numero_interno,
                        tipo_comprobante, condicion, moneda, tipo_cambio, estado,
                        subtotal, descuento_total, base_gravada_10, base_gravada_5, base_exenta,
                        iva_10, iva_5, total, total_pagado, saldo, observaciones,
                        user_id, session_id, created_at, updated_at
                    ) VALUES (
                        :id, :company_id, :customer_id, :numero, :numero_interno,
                        'ticket', 'credito', 'PYG', 1, 'confirmado',
                        :total, 0, :base10, 0, 0,
                        :iva10, 0, :total, :total, 0,
                        :observaciones, :user_id, :session_id, :dt, :dt
                    )
                """),
                {
                    "id": sale2_id, "company_id": COMPANY_ID, "customer_id": CUSTOMER_ID,
                    "numero": num2, "numero_interno": int2, "total": total2,
                    "base10": base2, "iva10": iva2,
                    "observaciones": f"Extra Club Socio {EXTRA_CLUB_NUM} (Autorizada por Katia Kallink Vecca - Venta recuperada de Caja 5)",
                    "user_id": user2_id, "session_id": sess2_id, "dt": dt2
                }
            )

            # Pagos venta 2
            await db.execute(
                text("""
                    INSERT INTO sale_payments (company_id, sale_id, forma_pago, monto, fecha, moneda, created_at)
                    VALUES (:company_id, :sale_id, 'EXTRA_CLUB', :monto, :dt, 'PYG', :dt)
                """),
                {"company_id": COMPANY_ID, "sale_id": sale2_id, "monto": total2, "dt": dt2}
            )

            # Items venta 2
            items2 = [
                ("74f5464f-119d-4ff1-9f09-98d26cc25c3b", "PAN FRANCES KG", Decimal("0.700"), Decimal("9777"), Decimal("6844")),
                ("65b4c1f3-5989-40b8-80de-76203be5395c", "QUESO MOZZARELLA B", Decimal("0.190"), Decimal("55777"), Decimal("10598")),
                ("13580c93-796a-4a58-9575-b659d12fd6e4", "TOSTADAS", Decimal("1.000"), Decimal("15000"), Decimal("15000")),
                ("e4159709-58f4-415c-b2c4-f47ac0af7128", "FUNADA REFRIG TUBAINA PET 2L (6)", Decimal("1.000"), Decimal("5477"), Decimal("5477")),
                ("42f83905-7865-43da-995f-ceb8eb872ebe", "BOLSA PLASTICA INTERNA", Decimal("1.000"), Decimal("500"), Decimal("500")),
                ("42f83905-7865-43da-995f-ceb8eb872ebe", "BOLSA PLASTICA INTERNA", Decimal("0.166"), Decimal("500"), Decimal("83")),
            ]
            for p_id, p_nom, p_qty, p_pr, p_tot in items2:
                p_iva = round(p_tot / Decimal("11"))
                await db.execute(
                    text("""
                        INSERT INTO sale_items (
                            sale_id, product_id, descripcion, cantidad,
                            precio_unitario, total, iva_tasa, iva_monto, descuento_monto
                        ) VALUES (
                            :sale_id, :p_id, :p_nom, :p_qty,
                            :p_pr, :p_tot, 10, :p_iva, 0
                        )
                    """),
                    {"sale_id": sale2_id, "p_id": p_id, "p_nom": p_nom, "p_qty": p_qty, "p_pr": p_pr, "p_tot": p_tot, "p_iva": p_iva}
                )

            # Cuentas por cobrar venta 2
            await db.execute(
                text("""
                    INSERT INTO accounts_receivable (
                        company_id, customer_id, sale_id, numero_documento,
                        fecha_emision, fecha_vencimiento, moneda, monto_original,
                        saldo_pendiente, tipo, estado, created_at, updated_at
                    ) VALUES (
                        :company_id, :customer_id, :sale_id, :numero,
                        :dt, :venc, 'PYG', :monto, :monto, 'factura', 'pendiente', :dt, :dt
                    )
                """),
                {
                    "company_id": COMPANY_ID, "customer_id": CUSTOMER_ID, "sale_id": sale2_id,
                    "numero": num2, "dt": dt2, "venc": date(2026, 10, 31), "monto": total2
                }
            )

            # 4. Actualizar cuenta de crédito y registrar movimientos
            # Obtener cuenta de crédito actual
            acc_res = await db.execute(
                text("SELECT id, saldo_utilizado, saldo_disponible, limite_credito FROM credit_accounts WHERE customer_id = :cid"),
                {"cid": CUSTOMER_ID}
            )
            acc_row = acc_res.fetchone()
            acc_id = acc_row.id
            saldo_util_inicial = Decimal(str(acc_row.saldo_utilizado))
            
            saldo_tras_venta1 = saldo_util_inicial + total1
            saldo_tras_venta2 = saldo_tras_venta1 + total2
            
            nuevo_disponible = Decimal(str(acc_row.limite_credito)) - saldo_tras_venta2

            # Movimiento 1
            await db.execute(
                text("""
                    INSERT INTO credit_movements (
                        company_id, credit_account_id, customer_id, tipo, monto,
                        saldo_anterior, saldo_nuevo, referencia_type, referencia_id,
                        observaciones, created_at
                    ) VALUES (
                        :company_id, :acc_id, :cid, 'compra', :monto,
                        :ant, :nuevo, 'sale', :sale_id, 'Compra Extra Club domingo', :dt
                    )
                """),
                {
                    "company_id": COMPANY_ID, "acc_id": acc_id, "cid": CUSTOMER_ID,
                    "monto": total1, "ant": saldo_util_inicial, "nuevo": saldo_tras_venta1,
                    "sale_id": sale1_id, "dt": dt1
                }
            )

            # Movimiento 2
            await db.execute(
                text("""
                    INSERT INTO credit_movements (
                        company_id, credit_account_id, customer_id, tipo, monto,
                        saldo_anterior, saldo_nuevo, referencia_type, referencia_id,
                        observaciones, created_at
                    ) VALUES (
                        :company_id, :acc_id, :cid, 'compra', :monto,
                        :ant, :nuevo, 'sale', :sale_id, 'Compra Extra Club martes', :dt
                    )
                """),
                {
                    "company_id": COMPANY_ID, "acc_id": acc_id, "cid": CUSTOMER_ID,
                    "monto": total2, "ant": saldo_tras_venta1, "nuevo": saldo_tras_venta2,
                    "sale_id": sale2_id, "dt": dt2
                }
            )

            # Actualizar credit_accounts
            await db.execute(
                text("""
                    UPDATE credit_accounts
                    SET saldo_utilizado = :util,
                        saldo_disponible = :disp,
                        updated_at = NOW()
                    WHERE id = :acc_id
                """),
                {"util": saldo_tras_venta2, "disp": nuevo_disponible, "acc_id": acc_id}
            )

            # Actualizar customers.credito_usado
            await db.execute(
                text("""
                    UPDATE customers
                    SET credito_usado = :util,
                        updated_at = NOW()
                    WHERE id = :cid
                """),
                {"util": saldo_tras_venta2, "cid": CUSTOMER_ID}
            )

            print("¡Regularización completada exitosamente!")
            print(f"Saldo anterior: {saldo_util_inicial:,.0f} Gs.")
            print(f"Nuevo saldo utilizado: {saldo_tras_venta2:,.0f} Gs.")
            print(f"Nuevo saldo disponible: {nuevo_disponible:,.0f} Gs.")

if __name__ == "__main__":
    asyncio.run(main())
