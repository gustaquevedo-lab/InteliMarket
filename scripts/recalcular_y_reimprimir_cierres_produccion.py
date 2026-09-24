#!/usr/bin/env python3
"""
Recálculo y Reimpresión de Cierres de Producción InteliMarket (31/08/2026 - Hoy).
Aplica la consolidación unificada en Guaraníes:
- La venta es 100% en Guaraníes.
- El monto esperado en moneda extranjera es ÚNICAMENTE el fondo inicial en divisas.
- Todo arqueo en divisas se compensa contra Guaraníes usando la cotización real de esa sesión/fecha.
- Se actualiza CashCount.diferencia y CashCount.monto_total en la base de datos.
- Se generan todos los tickets ESC/POS para reimpresión.
"""

import asyncio
import os
import sys
from decimal import Decimal
import asyncpg

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://intelimarket:password@localhost:5432/intelimarket")
if "+asyncpg" in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")

OUTPUT_TICKETS_FILE = "/tmp/tickets_cierres_reimpresion.txt"

def format_two_col(left: str, right: str, width: int = 42) -> str:
    space = width - len(left) - len(right)
    if space < 1:
        left = left[:max(1, width - len(right) - 1)]
        space = 1
    return left + (" " * space) + right

async def main():
    conn = await asyncpg.connect(DATABASE_URL)
    print("✓ Conectado a la base de datos PostgreSQL")

    # 1. Asegurar tasa 1.130 en exchange_rates para 2026-09-03 si no existe
    existing_er = await conn.fetchrow("""
        SELECT id FROM exchange_rates WHERE moneda = 'BRL' AND fecha = '2026-09-03'
    """)
    if not existing_er:
        comp = await conn.fetchrow("SELECT id FROM companies LIMIT 1")
        if comp:
            await conn.execute("""
                INSERT INTO exchange_rates (id, company_id, moneda, tasa_compra, tasa_venta, fecha, created_at)
                VALUES (gen_random_uuid(), $1, 'BRL', 1130.00, 1130.00, '2026-09-03', now())
            """, comp['id'])
            print("✓ Registrada cotización BRL = 1.130 para 2026-09-03 en exchange_rates")

    # 2. Obtener las sesiones de producción desde 2026-08-31
    sessions = await conn.fetch("""
        SELECT cs.id, cs.register_id, cr.nombre as register_nombre, cs.cajero_nombre,
               cs.fecha_apertura, cs.fecha_cierre, cs.estado,
               cs.monto_apertura, cs.monto_apertura_brl, cs.monto_apertura_usd,
               cs.monto_cierre, cc.id as count_id, cc.monto_efectivo, cc.monto_efectivo_brl, cc.monto_efectivo_usd,
               cc.diferencia as ant_diferencia, cc.diferencia_brl as ant_diferencia_brl, cc.diferencia_usd as ant_diferencia_usd
        FROM cash_sessions cs
        JOIN cash_registers cr ON cr.id = cs.register_id
        LEFT JOIN cash_counts cc ON cs.id = cc.session_id
        WHERE cs.fecha_apertura >= '2026-08-31'
        ORDER BY cs.fecha_apertura ASC;
    """)

    print(f"\nProcesando {len(sessions)} sesiones de producción...\n")
    
    tickets_text_list = []

    for s in sessions:
        sid = s['id']
        f_ape = s['fecha_apertura']
        f_cie = s['fecha_cierre']
        cajero = s['cajero_nombre'] or "—"
        reg_nombre = s['register_nombre'] or "Caja"

        # Tasa BRL de la sesión
        rate_row = await conn.fetchrow("""
            SELECT round((s.total / NULLIF(sp.monto, 0))::numeric, 0) as tasa, count(*) as cnt
            FROM sales s
            JOIN sale_payments sp ON s.id = sp.sale_id
            WHERE s.session_id = $1 AND sp.moneda = 'BRL' AND sp.monto > 0 AND (s.total / sp.monto) BETWEEN 900 AND 1500
            GROUP BY round((s.total / NULLIF(sp.monto, 0))::numeric, 0)
            ORDER BY count(*) DESC
            LIMIT 1;
        """, sid)
        if rate_row and rate_row['tasa']:
            tasa_brl = float(rate_row['tasa'])
        else:
            er_row = await conn.fetchrow("""
                SELECT tasa_venta FROM exchange_rates
                WHERE moneda = 'BRL' AND fecha <= $1
                ORDER BY fecha DESC, created_at DESC
                LIMIT 1
            """, f_ape.date())
            tasa_brl = float(er_row['tasa_venta']) if er_row and er_row['tasa_venta'] else 1105.0

        # Tasa USD
        er_u = await conn.fetchrow("""
            SELECT tasa_venta FROM exchange_rates
            WHERE moneda = 'USD' AND fecha <= $1
            ORDER BY fecha DESC, created_at DESC
            LIMIT 1
        """, f_ape.date())
        tasa_usd = float(er_u['tasa_venta']) if er_u and er_u['tasa_venta'] else 5840.0

        # Ventas totales
        sales_tot = await conn.fetchrow("""
            SELECT count(id) as cnt, COALESCE(sum(total), 0) as total
            FROM sales
            WHERE session_id = $1 AND estado IN ('confirmado', 'completada', 'completado', 'pagado')
        """, sid)
        ventas_cnt = sales_tot['cnt'] or 0
        ventas_tot = float(sales_tot['total'] or 0)

        # Desglose de pagos
        payments = await conn.fetch("""
            SELECT sp.forma_pago, sp.moneda, count(*) as cnt, COALESCE(sum(sp.monto), 0) as monto
            FROM sale_payments sp
            JOIN sales s ON s.id = sp.sale_id
            WHERE s.session_id = $1 AND s.estado IN ('confirmado', 'completada', 'completado', 'pagado')
            GROUP BY sp.forma_pago, sp.moneda
            ORDER BY sum(sp.monto) DESC;
        """, sid)

        ef_pyg = 0.0
        ef_brl = 0.0
        ef_usd = 0.0
        
        medios_dict = {
            "TARJETA_BANCARD": {"label": "Bancard Tarjeta", "cnt": 0, "gs": 0.0},
            "TARJETA_DINELCO": {"label": "Dinelco Tarjeta", "cnt": 0, "gs": 0.0},
            "BANCARD_QR": {"label": "Bancard QR", "cnt": 0, "gs": 0.0},
            "DINELCO_QR": {"label": "Dinelco QR", "cnt": 0, "gs": 0.0},
            "PIX": {"label": "PIX Brasil", "cnt": 0, "gs": 0.0},
            "EXTRA_CLUB": {"label": "Extra Club (Crédito)", "cnt": 0, "gs": 0.0},
            "VALES": {"label": "Vales / Cheques", "cnt": 0, "gs": 0.0},
            "TRANSFERENCIA": {"label": "Transferencia", "cnt": 0, "gs": 0.0},
            "OTROS": {"label": "Otros Medios", "cnt": 0, "gs": 0.0},
        }

        for p in payments:
            fp = (p['forma_pago'] or '').upper()
            mon = p['moneda'] or 'PYG'
            cnt = p['cnt']
            monto = float(p['monto'])

            if fp == "EFECTIVO":
                if mon == "PYG":
                    ef_pyg += monto
                elif mon == "BRL":
                    ef_brl += monto
                elif mon == "USD":
                    ef_usd += monto
                continue

            m_gs = monto * tasa_brl if mon == "BRL" else (monto * tasa_usd if mon == "USD" else monto)

            if "DINELCO" in fp and "QR" in fp:
                medios_dict["DINELCO_QR"]["cnt"] += cnt
                medios_dict["DINELCO_QR"]["gs"] += m_gs
            elif "QR" in fp:
                medios_dict["BANCARD_QR"]["cnt"] += cnt
                medios_dict["BANCARD_QR"]["gs"] += m_gs
            elif "DINELCO" in fp:
                medios_dict["TARJETA_DINELCO"]["cnt"] += cnt
                medios_dict["TARJETA_DINELCO"]["gs"] += m_gs
            elif "BANCARD" in fp or "TARJETA" in fp or "DEBITO" in fp or "CREDITO" in fp:
                medios_dict["TARJETA_BANCARD"]["cnt"] += cnt
                medios_dict["TARJETA_BANCARD"]["gs"] += m_gs
            elif "PIX" in fp:
                medios_dict["PIX"]["cnt"] += cnt
                medios_dict["PIX"]["gs"] += m_gs
            elif "EXTRA_CLUB" in fp:
                medios_dict["EXTRA_CLUB"]["cnt"] += cnt
                medios_dict["EXTRA_CLUB"]["gs"] += m_gs
            elif "VALE" in fp or "CHEQUE" in fp:
                medios_dict["VALES"]["cnt"] += cnt
                medios_dict["VALES"]["gs"] += m_gs
            elif "TRANSFERENCIA" in fp:
                medios_dict["TRANSFERENCIA"]["cnt"] += cnt
                medios_dict["TRANSFERENCIA"]["gs"] += m_gs
            else:
                medios_dict["OTROS"]["cnt"] += cnt
                medios_dict["OTROS"]["gs"] += m_gs

        # Drops confirmados
        drops = await conn.fetch("""
            SELECT COALESCE(monto_confirmado_pyg, monto_pyg, 0) as pyg,
                   COALESCE(monto_confirmado_brl, monto_brl, 0) as brl,
                   COALESCE(monto_confirmado_usd, monto_usd, 0) as usd
            FROM cash_drop_requests
            WHERE session_id = $1 AND estado = 'confirmado'
        """, sid)
        d_pyg = sum(float(r['pyg']) for r in drops)
        d_brl = sum(float(r['brl']) for r in drops)
        d_usd = sum(float(r['usd']) for r in drops)
        drops_total_gs = d_pyg + (d_brl * tasa_brl) + (d_usd * tasa_usd)

        # Apertura
        ape_pyg = float(s['monto_apertura'] or 0)
        ape_brl = float(s['monto_apertura_brl'] or 0)
        ape_usd = float(s['monto_apertura_usd'] or 0)
        ape_brl_gs = ape_brl * tasa_brl
        ape_usd_gs = ape_usd * tasa_usd
        ape_total_gs = ape_pyg + ape_brl_gs + ape_usd_gs

        # Contado declarado
        cnt_pyg = float(s['monto_efectivo'] if s['monto_efectivo'] is not None else (s['monto_cierre'] or 0))
        cnt_brl = float(s['monto_efectivo_brl'] or 0)
        cnt_usd = float(s['monto_efectivo_usd'] or 0)
        cnt_brl_gs = cnt_brl * tasa_brl
        cnt_usd_gs = cnt_usd * tasa_usd
        contado_total_gs = cnt_pyg + cnt_brl_gs + cnt_usd_gs

        # Diferencias originales registradas en el cierre
        ant_dif_gs = float(s['ant_diferencia'] or 0)
        ant_dif_b = float(s['ant_diferencia_brl'] or 0)
        ant_dif_u = float(s['ant_diferencia_usd'] or 0)

        # CONSOLIDACIÓN UNIFICADA EN GUARANÍES:
        # La diferencia en divisa se convierte a Guaraníes y se consolida en una única diferencia.
        dif_consolidada_gs = ant_dif_gs + (ant_dif_b * tasa_brl) + (ant_dif_u * tasa_usd)
        esperado_total_gs = contado_total_gs - dif_consolidada_gs
        ventas_ef_total_gs = esperado_total_gs - ape_total_gs + drops_total_gs

        # Actualizar CashCount en la DB
        if s['count_id']:
            await conn.execute("""
                UPDATE cash_counts
                SET diferencia = $1,
                    monto_total = $2,
                    diferencia_brl = 0,
                    diferencia_usd = 0
                WHERE id = $3
            """, Decimal(str(round(dif_consolidada_gs, 0))), Decimal(str(round(contado_total_gs, 0))), s['count_id'])

        # Generar ticket
        W = 42
        lines = []
        lines.append("=" * W)
        lines.append("EXTRA SUPERMERCADO MAYORISTA".center(W))
        lines.append("GRUPO SANTA TERESA E.A.S.".center(W))
        lines.append("RUC: 80150377-9".center(W))
        lines.append("TIMBRADO: 18545636".center(W))
        lines.append("=" * W)
        lines.append("REIMPRESION DE ARQUEO / CIERRE".center(W))
        lines.append("-" * W)
        lines.append(f"Cajero/a:   {cajero}")
        lines.append(f"Caja:       {reg_nombre}")
        lines.append(f"Turno ID:   {str(sid)[:8].upper()}")
        lines.append(f"Apertura:   {f_ape.strftime('%d/%m/%Y %H:%M')}")
        lines.append(f"Cierre:     {f_cie.strftime('%d/%m/%Y %H:%M') if f_cie else 'EN CURSO'}")
        lines.append(f"Cotiz. BRL: 1 R$ = {tasa_brl:,.0f} Gs.")
        lines.append(f"Cotiz. USD: 1 U$ = {tasa_usd:,.0f} Gs.")
        lines.append("-" * W)
        lines.append("[DESGLOSE DE MEDIOS DE PAGO]")
        lines.append(format_two_col("  Efectivo Gs.:", f"{ef_pyg:,.0f} Gs.", W))
        if ef_brl > 0:
            lines.append(format_two_col("  Efectivo R$:", f"R$ {ef_brl:,.2f} ({ef_brl * tasa_brl:,.0f} Gs.)", W))
        if ef_usd > 0:
            lines.append(format_two_col("  Efectivo US$:", f"US$ {ef_usd:,.2f} ({ef_usd * tasa_usd:,.0f} Gs.)", W))
        for k, v in medios_dict.items():
            if v['gs'] > 0 or v['cnt'] > 0:
                lines.append(format_two_col(f"  {v['label']} ({v['cnt']}):", f"{v['gs']:,.0f} Gs.", W))
        lines.append("-" * W)
        lines.append(format_two_col("TOTAL VENTAS COBRADAS:", f"{ventas_tot:,.0f} Gs.", W))
        lines.append("-" * W)
        lines.append("[CONCILIACION EN GUARANIES]")
        lines.append(format_two_col("  Fondo Inicial Gs.:", f"{ape_pyg:,.0f} Gs.", W))
        if ape_brl > 0:
            lines.append(format_two_col("  Fondo Inicial R$:", f"R$ {ape_brl:,.2f} ({ape_brl_gs:,.0f} Gs.)", W))
        lines.append(format_two_col("  TOTAL APERTURA GS:", f"{ape_total_gs:,.0f} Gs.", W))
        lines.append(format_two_col("  (+) Ventas Efectivo:", f"{ventas_ef_total_gs:,.0f} Gs.", W))
        if drops_total_gs > 0:
            lines.append(format_two_col("  (-) Retiros / Drops:", f"-{drops_total_gs:,.0f} Gs.", W))
        lines.append("-" * W)
        lines.append(format_two_col("TOTAL ESPERADO EN GAVETA:", f"{esperado_total_gs:,.0f} Gs.", W))
        lines.append("-" * W)
        lines.append("[ARQUEO REAL EN GAVETA]")
        lines.append(format_two_col("  Contado Gs.:", f"{cnt_pyg:,.0f} Gs.", W))
        if cnt_brl > 0 or ape_brl > 0:
            lines.append(format_two_col("  Contado R$:", f"R$ {cnt_brl:,.2f} ({cnt_brl_gs:,.0f} Gs.)", W))
        if cnt_usd > 0 or ape_usd > 0:
            lines.append(format_two_col("  Contado US$:", f"US$ {cnt_usd:,.2f} ({cnt_usd_gs:,.0f} Gs.)", W))
        lines.append(format_two_col("TOTAL CONTADO GAVETA GS:", f"{contado_total_gs:,.0f} Gs.", W))
        lines.append("=" * W)
        signo = "+" if dif_consolidada_gs > 0 else ""
        lines.append(format_two_col("DIFERENCIA CONSOLIDADA GS:", f"{signo}{dif_consolidada_gs:,.0f} Gs.", W))
        estado_cuadre = "CUADRADO" if abs(dif_consolidada_gs) < 5000 else ("SOBRANTE" if dif_consolidada_gs > 0 else "FALTANTE")
        lines.append(f"ESTADO: {estado_cuadre}".center(W))
        lines.append("=" * W)
        lines.append("")
        lines.append("")
        lines.append("Firma Cajero/a: _________________________")
        lines.append("")
        lines.append("Firma Supervisora: ______________________")
        lines.append("\n" + ("#" * W) + "\n")

        ticket_str = "\n".join(lines)
        tickets_text_list.append(ticket_str)

        print(f"{f_ape.strftime('%d/%m %H:%M')} | {cajero[:16]:16} | Tasa: {tasa_brl:4.0f} | Ant: {ant_dif_gs:+10,.0f} Gs / {ant_dif_b:+6.2f} R$ => CONSOLIDADA: {dif_consolidada_gs:+10,.0f} Gs [{estado_cuadre}]")

    with open(OUTPUT_TICKETS_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(tickets_text_list))

    print(f"\n✓ Se guardaron todos los tickets en {OUTPUT_TICKETS_FILE} ({len(tickets_text_list)} cierres).")
    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
