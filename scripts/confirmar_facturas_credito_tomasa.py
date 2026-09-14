import asyncio
import uuid
from datetime import timedelta
from sqlalchemy import select, text
from api.src.db import async_session_factory
from api.src.sales.models import Sale, SalePayment
from api.src.credit_accounts.models import CreditApprovalRequest
from api.src.sales.service import finalize_approved_credit_sale
from api.src.caja.service import get_session_reconciliation_data, get_session_punteo_data

async def run():
    target_numeros = ["001-015-0002624", "001-015-0002647"]
    session_id = "f5926ada-8865-4b17-a0a0-3d5bf4d8c5ea"
    zunilda_id = uuid.UUID("c8980a12-5c0e-4112-a366-a1564c0be288")
    gerencia_id = uuid.UUID("76c867b5-a507-4689-a5e5-bf4cdd6fb5e9")

    async with async_session_factory() as db:
        print("=== INICIANDO CONFIRMACION DE FACTURAS CREDITO ===")
        
        # 1. Obtener datos previos de la sesion
        recon_before = await get_session_reconciliation_data(db, session_id)
        ec_before = [(m["label"], m["cantidad"], m["monto_gs"]) for m in recon_before.get("medios_pago_detallados", []) if "Extra Club" in m["label"]]
        print(f"Estado previo en rendicion de Tomasa: {ec_before}")

        for numero in target_numeros:
            print(f"\n--- Procesando {numero} ---")
            s_res = await db.execute(select(Sale).where(Sale.numero == numero))
            sale = s_res.scalar_one_or_none()
            if not sale:
                print(f"ERROR: No se encontro venta {numero}")
                return

            req_res = await db.execute(select(CreditApprovalRequest).where(CreditApprovalRequest.sale_id == sale.id))
            req = req_res.scalar_one_or_none()
            if not req:
                print(f"ERROR: No se encontro solicitud de credito para {numero}")
                return

            # Corregir monto de sale_payment si hay diferencia de 1 Gs de redondeo
            pay_res = await db.execute(select(SalePayment).where(SalePayment.sale_id == sale.id, SalePayment.forma_pago == "EXTRA_CLUB"))
            payment = pay_res.scalar_one_or_none()
            if payment and payment.monto != sale.total:
                print(f"Ajustando SalePayment de {payment.monto} a {sale.total} para cuadre exacto...")
                payment.monto = sale.total
                await db.flush()

            # Configurar solicitud de credito aprobada por Supervisor y Gerencia
            req.estado = "aprobado"
            req.aprobado_supervisor_id = zunilda_id
            if not req.aprobado_supervisor_at:
                req.aprobado_supervisor_at = sale.fecha
            req.aprobado_gerente_id = gerencia_id
            req.aprobado_gerente_at = sale.fecha
            req.rechazado_por = None
            req.rechazado_at = None
            req.rechazado_motivo = None
            await db.flush()

            # Finalizar la venta a credito oficial
            updated_sale = await finalize_approved_credit_sale(db, req)
            print(f"Venta {numero} finalizada con estado: {updated_sale.estado}, total_pagado: {updated_sale.total_pagado}, saldo: {updated_sale.saldo}")

            # Asegurar fecha_emision en accounts_receivable correspondiente a la fecha real de la venta (10/09/2026)
            f_venc = (sale.fecha.date() + timedelta(days=30)) if hasattr(sale.fecha, "date") else None
            await db.execute(
                text("""
                    UPDATE accounts_receivable 
                    SET fecha_emision = :f_emision,
                        fecha_vencimiento = :f_venc,
                        updated_at = NOW()
                    WHERE sale_id = :sale_id
                """),
                {
                    "sale_id": sale.id,
                    "f_emision": sale.fecha,
                    "f_venc": f_venc,
                }
            )

            # Ajustar created_at en credit_movements para reflejar la fecha original de la compra
            await db.execute(
                text("""
                    UPDATE credit_movements 
                    SET created_at = :f_emision
                    WHERE referencia_type = 'sale' AND referencia_id = :sale_id
                """),
                {
                    "sale_id": sale.id,
                    "f_emision": sale.fecha,
                }
            )

        await db.commit()
        print("\n>>> COMMIT EXITOSO EN BASE DE DATOS <<<")

        # 2. Verificar datos posteriores en la sesion de Tomasa
        recon_after = await get_session_reconciliation_data(db, session_id)
        ec_after = [(m["label"], m["cantidad"], m["monto_gs"]) for m in recon_after.get("medios_pago_detallados", []) if "Extra Club" in m["label"]]
        print(f"\nEstado posterior en rendicion de Tomasa: {ec_after}")
        print(f"Total cobrado general sesion: {recon_after.get('total_cobrado_gs')} Gs")

        punteo = await get_session_punteo_data(db, session_id, str(sale.company_id))
        extra_club_punteo = [v for v in punteo.get("vouchers", []) if v.get("canal_key") == "EXTRA_CLUB"]
        print(f"\nVouchers Extra Club en el Punteo de Tomasa: {len(extra_club_punteo)} comprobantes:")
        for v in extra_club_punteo:
            print(f"  - Ticket #{v.get('numero_ticket')} | Venta #{v.get('numero_venta')} | Monto: {v.get('monto_gs'):,.0f} Gs")

if __name__ == "__main__":
    asyncio.run(run())
