"""
Reporte Detallado de Conciliación de Cheques vs Débitos Bancarios
Genera el informe de cotejo entre cheques emitidos y débitos en cuentas corrientes
sin modificar la base de datos.
"""
import os
import json
from decimal import Decimal
import asyncio
from sqlalchemy import select, text
from api.src.db import async_session_factory


async def generate_reconciliation_report():
    async with async_session_factory() as session:
        # 1. Matches exactos (Número de Cheque == Referencia Bancaria y Monto Exacto)
        res_exact = await session.execute(text('''
            SELECT 
                c.id as cheque_id,
                t.id as tx_id,
                c.numero,
                c.banco_emisor,
                c.beneficiario,
                c.monto,
                c.fecha_emision,
                c.fecha_pago as fecha_vencimiento,
                t.fecha as fecha_debito_banco,
                t.descripcion as descripcion_banco,
                b.numero_cuenta,
                c.estado as estado_actual
            FROM bank_transactions t
            JOIN cheques c ON c.numero = t.referencia
            JOIN bank_accounts b ON b.id = t.bank_account_id
            WHERE c.numero_confiable = True 
              AND round(c.monto) = round(t.monto)
              AND t.tipo = 'debito'
            ORDER BY t.fecha DESC, c.monto DESC;
        '''))
        exact_matches = [dict(r._mapping) for r in res_exact.fetchall()]

        # 2. Casos discrepantes (Mismo número de cheque pero distinto monto)
        res_discrep = await session.execute(text('''
            SELECT 
                c.numero,
                c.beneficiario,
                c.monto as monto_cheque,
                t.monto as monto_banco,
                abs(c.monto - t.monto) as diff,
                t.fecha as fecha_banco,
                t.descripcion as descripcion_banco
            FROM bank_transactions t
            JOIN cheques c ON c.numero = t.referencia
            WHERE c.numero_confiable = True 
              AND round(c.monto) != round(t.monto)
              AND t.tipo = 'debito';
        '''))
        discrepant_matches = [dict(r._mapping) for r in res_discrep.fetchall()]

        total_monto_exacto = sum(r["monto"] for r in exact_matches)

        print("="*80)
        print(" REPORTE DE CONCILIACIÓN: CHEQUES EMITIDOS VS DÉBITOS BANCARIOS")
        print("="*80)
        print(f" 🎯 Matches 100% Exactos (Nº Cheque + Monto Exacto): {len(exact_matches)}")
        print(f" 💰 Monto Total a Conciliar: Gs. {total_monto_exacto:,.0f}")
        print(f" ⚠️ Casos con discrepancia de monto aislados: {len(discrepant_matches)}")

        print("\n📋 Top 10 Cheques de Mayor Monto Listos para Conciliar:")
        for idx, m in enumerate(sorted(exact_matches, key=lambda x: x["monto"], reverse=True)[:10], 1):
            print(f"  {idx}. Cheque Nº {m['numero']} | {m['banco_emisor']} | Gs. {m['monto']:,.0f}")
            print(f"     Beneficiario: {m['beneficiario']}")
            print(f"     Débito en Banco: {m['fecha_debito_banco']} ({m['descripcion_banco']})")
            print(f"     Estado Actual en BD: {m['estado_actual']}")

        print("\n⚠️ Detalle de los Casos Discrepantes (Se excluyen de conciliación automática):")
        for d in discrepant_matches:
            print(f"  - Cheque Nº {d['numero']} ({d['beneficiario']}): Cheque Gs. {d['monto_cheque']:,.0f} vs Banco Gs. {d['monto_banco']:,.0f} (Dif: Gs. {d['diff']:,.0f}) en {d['fecha_banco']} ({d['descripcion_banco']})")


if __name__ == "__main__":
    asyncio.run(generate_reconciliation_report())
