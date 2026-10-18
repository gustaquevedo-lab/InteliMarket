"""
Script de Clasificación y Enriquecimiento Contable de Transacciones Bancarias (Paso G)
Clasifica las transacciones con categoria 'otros' hacia categorias contables precisas:
  - liquidacion_tarjeta (POS Bancard / Dinelco)
  - cobro_pix (PlugPay / PIX)
  - deposito_efectivo (Depositos de recaudacion de caja)
  - pago_proveedor (SIPAP / Pagos directos con identificacion de contraparte)
  - sueldos_salarios (Nomina y anticipos a personal)
  - transferencia_interna (Movimientos entre cuentas propias)
  - gastos_bancarios (Comisiones, chequeras, impuestos bancarios)
  - cheque_devuelto (Cheques rechazados/devueltos)
  - gastos_operativos (Marketing, servicios generales, honorarios)

Garantías:
1. Batch ID único.
2. Manifiesto JSON en 'Datos/audit_logs/batch_classify_transactions_<batch_id>.json'.
3. Script de reversión: 'api/revert_classify_imported_transactions_step_g.py'.
4. Identificación automática de proveedores para el campo 'contraparte'.
"""
import os
import sys
import json
import uuid
import re
from datetime import datetime, timezone
import asyncio
from sqlalchemy import select
from api.src.db import async_session_factory
from api.src.financial.models import BankTransaction, BankAccount
from api.src.purchases.models import Supplier

# Diccionario canónico de alias para identificar proveedores en las descripciones bancarias
SUPPLIER_ALIASES = {
    "CASA GONZALITO": "CASA GONZALITO S.R.L.",
    "GONZALITO": "CASA GONZALITO S.R.L.",
    "SUR COMERCIAL": "SUR COMERCIAL, INDUSTRIAL Y SERVICIOS S.A.",
    "SAN GABRIEL": "DISTRIBUIDORA SAN GABRIEL DEL PARAGUAY S.A.",
    "PECHUGON": "DISTRIBUIDORA SAN GABRIEL DEL PARAGUAY S.A.",
    "PAPA IVAR": "PAPA IVAR COMPANY SRL",
    "SUPER MIX": "SUPER MIX S.A.",
    "FRONTERA IMPORT": "FRONTERA IMPORT",
    "LA HOLANDA": "SOCIEDAD DE PRODUCTORES DE LECHE LA HOLANDA LTDA.",
    "LACTEOS LA HOLANDA": "SOCIEDAD DE PRODUCTORES DE LECHE LA HOLANDA LTDA.",
    "AQUIDABAN": "DIST. AQUIDABAN S.R.L.",
    "UPISA": "UPISA",
    "ALTAJO": "ALTAJO S.A.",
    "SANA FARMA": "SANA FARMA S.A.",
    "PINGUINO": "PINGÜINO IMPORT. Y EXPORT. SRL",
    "PINGÜINO": "PINGÜINO IMPORT. Y EXPORT. SRL",
    "LA FORTUNA": "LÁCTEOS LA FORTUNA S.A.",
    "GRANJA LA FORTALEZA": "GRANJA LA FORTALEZA",
    "GRANJA FORTALEZA": "GRANJA LA FORTALEZA",
    "FENIX": "DISTRIBUIDORA FENIX",
    "MAAHASA": "MAAHASA",
    "GRUPO PREMIER": "GRUPO PREMIER S.A.",
    "FLAMMA IMPORT": "FLAMMA IMPORT",
    "INTELLIHOUSE": "INTELLIHOUSE SOLUCIONES EAS",
    "WILOHOSTING": "WILOHOSTING EAS",
    "WILOHOUSTING": "WILOHOSTING EAS",
    "VERDULERÍA BAZAN": "VERDULERÍA BAZAN",
    "VERDULERIA BAZAN": "VERDULERÍA BAZAN",
    "VERDULERÍA LA JAPONESITA": "VERDULERÍA LA JAPONESITA",
    "VERDULERIA LA JAPONESITA": "VERDULERÍA LA JAPONESITA",
    "VERDULERÍA SAN EXPEDITO": "VERDULERÍA SAN EXPEDITO",
    "FRANZ WIEBE": "FRANZ WIEBE",
    "CARNES PEDRO JUAN": "PROVEEDOR DE CARNES PEDRO JUAN",
    "PROVEEDOR DE CARNES PJC": "PROVEEDOR DE CARNES PEDRO JUAN",
    "GOSI SACI": "GOSI SACI",
    "SANTA MARIA": "DIST. SANTA MARIA EAS",
    "LÁCTEOS UNIDOS": "LÁCTEOS UNIDOS S.A.",
    "LACTEOS UNIDOS": "LÁCTEOS UNIDOS S.A.",
    "OCHSI": "LUCAS PARADEDA (OCHSI)",
    "CHACOMER": "CHACOMER",
    "CLARO": "AMX PARAGUAY S.A. (CLARO)",
    "AMX PARAGUAY": "AMX PARAGUAY S.A. (CLARO)",
    "PERSONAL": "NÚCLEO S.A. (PERSONAL)",
    "NÚCLEO S.A.": "NÚCLEO S.A. (PERSONAL)",
    "ANDE": "ADMINISTRACIÓN NACIONAL DE ELECTRICIDAD (ANDE)",
    "COPACO": "COPACO S.A.",
}


def determine_category_and_counterpart(descripcion: str, suppliers_by_name: dict) -> tuple[str, str | None]:
    d = (descripcion or "").strip().upper()
    cat = "otros"
    contraparte = None

    # 1. Liquidaciones POS de Tarjetas
    if any(k in d for k in ["EXTRA SUPERMERCADO", "BANCARD", "CREDITOS AUTOMATICO A COMERCIOS",
                            "CLEARING DE PROCESADORAS", "DEPÓSITO POR TARJETA", "REV. EXTRA SUPERMERCADO"]):
        return "liquidacion_tarjeta", "PROCESADORA DE TARJETAS (BANCARD/DINELCO)"

    # 2. Cobros PIX
    if any(k in d for k in ["PIX"]):
        return "cobro_pix", "PLUG PAY / PIX BRASIL"

    # 3. Recaudación en Efectivo
    if any(k in d for k in ["DEPÓSITO BANCARIO", "DEPÓSITO EN EFECTIVO", "DEPOSITO EFECTIVO",
                            "DEPOSITO BANCARIO", "RECAUDACIÓN", "RECAUDACION"]):
        return "deposito_efectivo", "RECAUDACIÓN DE CAJAS SALÓN EXTRA"

    # 4. Transferencias Internas entre Cuentas Propias
    if any(k in d for k in ["TRANSF. ENTRE CUENTAS", "TRANSF. OTORGADA WEB", "TRANSFERENCIA DE FONDOS CC",
                            "ENTRE CUENTAS", "TR.ENTRE CUENTAS"]):
        return "transferencia_interna", "EXTRA SUPERMERCADO (CUENTA PROPIA)"

    # 5. Salarios y Nómina
    if any(k in d for k in ["SUELDO", "SALARIO", "ANTICIPO DE SALARIO", "LIQUIDACIÓN DE FUNCIONARIO", "LIQUIDACION"]):
        return "sueldos_salarios", "NÓMINA DE FUNCIONARIOS EXTRA"

    # 6. Cheques Devueltos
    if any(k in d for k in ["CHEQUE DEVUELTO", "CH. DEVUELTO", "CHEQUE DEVULETO"]):
        return "cheque_devuelto", "BANCO EMISOR (RECHAZO/DEVOLUCIÓN)"

    # 7. Gastos Bancarios / Impuestos
    if any(k in d for k in ["PROVISIÓN DE CHEQUERAS", "COMISION", "COMISIÓN", "IVA COMISION", "MANTENIMIENTO",
                            "IMPUESTO", "GASTO", "DEBITO IVA", "COSTO", "TASA", "INTERÉS POR CHEQUE DEVUELTO"]) or "CHEQUERA" in d:
        return "gastos_bancarios", "ENTIDAD BANCARIA"

    # 8. Intereses Ganados
    if any(k in d for k in ["CAPITALIZACION", "CAPITALIZACIÓN", "INTERES GANADO", "INTERESES DEVENGADOS"]):
        return "intereses_ganados", "ENTIDAD BANCARIA"

    # 9. Transferencias de Clientes
    if any(k in d for k in ["TRANSF. RECIBIDA", "TRANSFERENCIA RECIBIDA"]):
        return "transferencia_recibida", "CLIENTES VARIOS"

    # 10. Gastos Operativos y Marketing
    if any(k in d for k in ["MARKETING", "PUBLICIDAD", "RADIO", "HONORARIOS", "FUMIGACIÓN", "FUMIGACION", "MUEBLE"]):
        # Extraer nombre si hay
        return "gastos_operativos", "PROVEEDOR DE SERVICIOS"

    # 11. Pagos a Proveedores
    is_pago = any(k in d for k in ["PAGO A", "PAGO PROVEEDOR", "PAGO DE TC", "PAGO TC", "PAGO POR"])
    # Intentar machear contraparte con alias o lista de proveedores
    for alias_k, canonical in SUPPLIER_ALIASES.items():
        if alias_k in d:
            cat = "pago_proveedor"
            contraparte = canonical
            break

    if not contraparte:
        for s_name in suppliers_by_name:
            if len(s_name) > 4 and s_name in d:
                cat = "pago_proveedor"
                contraparte = s_name
                break

    if is_pago and cat == "otros":
        cat = "pago_proveedor"
        contraparte = d.replace("PAGO A ", "").replace("PAGO POR ", "").replace("PAGO ", "").strip()

    return cat, contraparte


async def classify_transactions(commit: bool = False):
    batch_id = str(uuid.uuid4())
    now_utc = datetime.now(timezone.utc)
    now_iso = now_utc.isoformat()
    company_id = "00000000-0000-0000-0000-000000000010"

    datos_dir = "/home/intellihouse/intelimarket/Datos"
    if not os.path.exists(datos_dir):
        datos_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "Datos")

    log_dir = os.path.join(datos_dir, "audit_logs")
    os.makedirs(log_dir, exist_ok=True)
    manifest_file = os.path.join(log_dir, f"batch_classify_transactions_{batch_id}.json")

    print("="*80)
    print(f" CLASIFICACIÓN DE TRANSACCIONES BANCARIAS [{'PRODUCCIÓN' if commit else 'MODO SIMULACIÓN (DRY-RUN)'}]")
    print(f" Batch ID: {batch_id}")
    print(f" Manifiesto: {manifest_file}")
    print("="*80)

    async with async_session_factory() as session:
        # Cargar proveedores
        sup_res = await session.execute(select(Supplier.razon_social).where(Supplier.activo == True))
        suppliers_by_name = {r[0].strip().upper(): True for r in sup_res.all() if r[0]}

        # Cargar transacciones 'otros'
        tx_res = await session.execute(
            select(BankTransaction).where(BankTransaction.categoria == "otros")
        )
        transactions = tx_res.scalars().all()
        print(f"Transacciones en 'otros' encontradas: {len(transactions)}")

        manifest_items = []
        category_counts = {}

        for tx in transactions:
            old_cat = tx.categoria
            old_contra = tx.contraparte

            new_cat, new_contra = determine_category_and_counterpart(tx.descripcion, suppliers_by_name)

            if new_cat != old_cat or (new_contra and not old_contra):
                category_counts[new_cat] = category_counts.get(new_cat, 0) + 1
                tx.categoria = new_cat
                if new_contra and not tx.contraparte:
                    tx.contraparte = new_contra

                session.add(tx)
                manifest_items.append({
                    "transaction_id": str(tx.id),
                    "fecha": tx.fecha.isoformat() if tx.fecha else None,
                    "monto": float(tx.monto),
                    "descripcion": tx.descripcion,
                    "old_categoria": old_cat,
                    "new_categoria": new_cat,
                    "old_contraparte": old_contra,
                    "new_contraparte": tx.contraparte,
                })

        print("\n📊 Resumen de reclasificación:")
        for cat, cnt in sorted(category_counts.items(), key=lambda x: x[1], reverse=True):
            print(f"   - {cat:<25}: {cnt:>5} transacciones")

        print(f"\nTotal transacciones actualizadas: {len(manifest_items)}")

        # Guardar manifiesto
        manifest_data = {
            "batch_id": batch_id,
            "executed_at": now_iso,
            "company_id": company_id,
            "total_updated": len(manifest_items),
            "category_summary": category_counts,
            "items": manifest_items,
        }

        with open(manifest_file, "w", encoding="utf-8") as mf:
            json.dump(manifest_data, mf, indent=2)

        if commit:
            await session.commit()
            print("\n💾 Confirmando cambios en base de datos (COMMIT)...")
            print("✅ ¡Clasificación contable completada exitosamente!")
            print(f"ℹ️ Para revertir esta clasificación:")
            print(f"   python api/revert_classify_imported_transactions_step_g.py {manifest_file} --commit")
        else:
            await session.rollback()
            print("\n⚠️ Simulación finalizada sin cambios (rollback). Use --commit para aplicar.")


if __name__ == "__main__":
    do_commit = "--commit" in sys.argv
    asyncio.run(classify_transactions(commit=do_commit))
