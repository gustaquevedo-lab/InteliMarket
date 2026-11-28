"""
Pruebas E2E para:
1. Fuente canónica única de datos de empresa (sin 'Cnel. Oviedo').
2. Generación automática de recibos individuales por funcionario al cobrar una remisión corporativa.
3. No duplicación en list_payments_period / Tesorería.
4. Generación real de PDFs (REC-CORP y Consolidado Multi-Página de Recibos Individuales).
5. Reversión atómica limpiando padre e hijos.
"""
import asyncio
import io
import uuid
from datetime import date, datetime
from decimal import Decimal
from pypdf import PdfReader
from sqlalchemy import text

from api.src.db import async_session_factory
from api.src.companies.service import get_canonical_company_info
from api.src.accounts_receivable import service as ar_service
from api.src.accounts_receivable import pdf_reports as ar_pdf_reports
from api.src.accounts_receivable.schemas import CorporateRemissionPayInput


COMPANY_ID = "00000000-0000-0000-0000-000000000010"


def _extract_pdf_text(pdf_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(pdf_bytes))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


async def run_e2e():
    print("=== 1. VERIFICANDO FUENTE CANÓNICA DE EMPRESA ===")
    async with async_session_factory() as db:
        comp = await get_canonical_company_info(db, COMPANY_ID)
        print("Empresa canónica:", comp["razon_social"], "| RUC:", comp["ruc"], "| Ciudad:", comp["ciudad"])
        assert comp["ciudad"] == "Pedro Juan Caballero", f"Ciudad inesperada: {comp['ciudad']}"
        assert "oviedo" not in comp["ciudad"].lower()

        print("\n=== 2. CREANDO ESCENARIO DE REMISIÓN CORPORATIVA CON 2 FUNCIONARIOS Y 3 FACTURAS ===")
        # Buscar 3 clientes reales o crear 2 funcionarios temporales
        c_emp_row = (await db.execute(
            text("SELECT id, razon_social, ruc FROM customers WHERE company_id = :cid LIMIT 1"),
            {"cid": COMPANY_ID},
        )).first()
        assert c_emp_row, "No hay clientes en DB"
        empresa_cust_id = c_emp_row.id

        func1_id = uuid.uuid4()
        func2_id = uuid.uuid4()
        await db.execute(
            text("""
                INSERT INTO customers (id, company_id, razon_social, ruc, tipo, activo)
                VALUES
                    (:f1, :cid, 'JUAN PEREZ E2E', '4000111-1', 'persona', true),
                    (:f2, :cid, 'MARIA GOMEZ E2E', '5000222-2', 'persona', true)
            """),
            {"f1": func1_id, "f2": func2_id, "cid": COMPANY_ID},
        )

        rem_id = uuid.uuid4()
        rem_num = f"REM-E2E-{uuid.uuid4().hex[:6].upper()}"
        await db.execute(
            text("""
                INSERT INTO ar_corporate_remissions
                    (id, company_id, empresa_customer_id, empresa_vinculada_nombre, empresa_vinculada_ruc,
                     numero_remision, periodo_mes, fecha_corte, fecha_remision, monto_total, saldo_pendiente,
                     cantidad_funcionarios, cantidad_documentos, estado)
                VALUES
                    (:id, :cid, :ecid, 'CASA GONZALITO E2E TEST', '80000000-1',
                     :num, '2026-11', CURRENT_DATE, CURRENT_DATE, 350000, 350000,
                     2, 3, 'REMITIDO')
            """),
            {"id": rem_id, "cid": COMPANY_ID, "ecid": empresa_cust_id, "num": rem_num},
        )

        ar1, ar2, ar3 = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
        await db.execute(
            text("""
                INSERT INTO accounts_receivable
                    (id, company_id, customer_id, numero_documento, fecha_emision, fecha_vencimiento,
                     monto_original, saldo_pendiente, estado, corporate_remission_id)
                VALUES
                    (:ar1, :cid, :f1, '001-001-0000101', CURRENT_DATE, CURRENT_DATE, 100000, 100000, 'REMITIDO_EMPRESA', :rem_id),
                    (:ar2, :cid, :f1, '001-001-0000102', CURRENT_DATE, CURRENT_DATE, 150000, 150000, 'REMITIDO_EMPRESA', :rem_id),
                    (:ar3, :cid, :f2, '001-001-0000103', CURRENT_DATE, CURRENT_DATE, 100000, 100000, 'REMITIDO_EMPRESA', :rem_id)
            """),
            {"ar1": ar1, "ar2": ar2, "ar3": ar3, "cid": COMPANY_ID, "f1": func1_id, "f2": func2_id, "rem_id": rem_id},
        )
        await db.commit()

    try:
        async with async_session_factory() as db:
            print("\n=== 3. COBRANDO REMISIÓN CORPORATIVA ===")
            # Obtener caja o banco válido
            ba_id = (await db.execute(
                text("SELECT id FROM bank_accounts WHERE company_id = :cid LIMIT 1"),
                {"cid": COMPANY_ID},
            )).scalar()
            pay_in = CorporateRemissionPayInput(
                monto=Decimal("350000"),
                forma_pago="transferencia",
                bank_account_id=str(ba_id) if ba_id else None,
                referencia=f"TRF-E2E-{rem_num}",
                fecha_pago=date.today(),
            )
            res_pay = await ar_service.pay_corporate_remission(db, COMPANY_ID, str(rem_id), pay_in, None)
            await db.commit()
            print("Pago registrado:", res_pay)
            assert res_pay["estado"] == "PAGADO"
            corp_pid = res_pay["payment_id"]

            # Verificar hijos generados (deben ser 2: 1 por Juan Perez = 250.000 y 1 por Maria Gomez = 100.000)
            children = (await db.execute(
                text("""
                    SELECT rp.id, rp.numero_recibo, rp.customer_id, rp.monto_total, rp.parent_payment_id, c.razon_social
                    FROM receivable_payments rp
                    JOIN customers c ON c.id = rp.customer_id
                    WHERE rp.parent_payment_id = :pid
                    ORDER BY c.razon_social ASC
                """),
                {"pid": corp_pid},
            )).fetchall()
            print(f"Recibos individuales generados: {len(children)}")
            for ch in children:
                print(f"  - {ch.numero_recibo} | {ch.razon_social} | ₲ {int(ch.monto_total):,}")
            assert len(children) == 2, f"Se esperaban 2 recibos individuales, hay {len(children)}"

            # Verificar que list_payments_period NO duplique (solo debe traer al padre)
            period_rows = await ar_service.list_payments_period(db, COMPANY_ID, date.today(), date.today())
            matching_period = [r for r in period_rows if str(r["id"]) == corp_pid or str(r["id"]) in [str(c.id) for c in children]]
            assert len(matching_period) == 1, f"list_payments_period duplicó cobros: {len(matching_period)}"
            print("✓ list_payments_period contabiliza únicamente el REC-CORP padre (cero duplicación).")

            print("\n=== 4. GENERANDO Y AUDITANDO PDFs ===")
            corp_data = await ar_service.get_corporate_remission_receipt_data(db, COMPANY_ID, str(rem_id))
            assert corp_data is not None
            corp_pdf = ar_pdf_reports.generate_recibo_a6_pdf(comp, corp_data)
            corp_text = _extract_pdf_text(corp_pdf)
            assert "Pedro Juan Caballero" in corp_text, "El PDF debe incluir Pedro Juan Caballero"
            assert "Oviedo" not in corp_text, "El PDF NO debe decir Oviedo"
            assert "JUAN PEREZ E2E" in corp_text or "MARIA GOMEZ E2E" in corp_text, "El REC-CORP debe mostrar los titulares reales"
            print("✓ PDF REC-CORP verificado (Pedro Juan Caballero + titulares reales).")

            ind_list = await ar_service.get_corporate_remission_individual_receipts_data(db, COMPANY_ID, str(rem_id))
            assert len(ind_list) == 2
            ind_pdf = ar_pdf_reports.generate_recibos_individuales_consolidados_pdf(comp, ind_list)
            reader = PdfReader(io.BytesIO(ind_pdf))
            assert len(reader.pages) == 2, f"El PDF consolidado debe tener 2 páginas, tiene {len(reader.pages)}"
            ind_text = _extract_pdf_text(ind_pdf)
            assert "Pedro Juan Caballero" in ind_text
            assert "Oviedo" not in ind_text
            assert "JUAN PEREZ E2E" in ind_text and "MARIA GOMEZ E2E" in ind_text
            print("✓ PDF Consolidado Individuales verificado (2 páginas A6, datos canónicos, cada titular con su recibo).")

            print("\n=== 5. PROBANDO REVERSIÓN ATÓMICA ===")
            rev_res = await ar_service.revert_corporate_remission_payment(db, COMPANY_ID, str(rem_id), "Test E2E Revert", None)
            await db.commit()
            assert "error" not in rev_res, rev_res
            rem_left = (await db.execute(
                text("SELECT count(*) FROM receivable_payments WHERE id = :pid OR parent_payment_id = :pid"),
                {"pid": corp_pid},
            )).scalar()
            assert rem_left == 0, f"Quedaron {rem_left} recibos sin revertir"
            print("✓ Reversión atómica eliminó tanto REC-CORP como sus 2 recibos individuales hijos.")
    finally:
        # Limpieza total de datos E2E
        async with async_session_factory() as db:
            await db.execute(text("DELETE FROM accounts_receivable WHERE corporate_remission_id = :rid"), {"rid": rem_id})
            await db.execute(text("DELETE FROM ar_corporate_remissions WHERE id = :rid"), {"rid": rem_id})
            await db.execute(text("DELETE FROM customers WHERE id IN (:f1, :f2)"), {"f1": func1_id, "f2": func2_id})
            await db.commit()
            print("✓ Limpieza de registros E2E completada.")


if __name__ == "__main__":
    asyncio.run(run_e2e())
