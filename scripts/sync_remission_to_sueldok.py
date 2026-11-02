#!/usr/bin/env python3
import asyncio
import json
import re
import urllib.request
import asyncpg

REMISION_ID = "1b6c72fe-c930-4a30-a696-583d5b654d64"
SUELDOK_URL = "https://sueldok.intellihouse.lat/http/api/financial/sync-commercial-debts?apiKey=ifk_santateresa_live_api_key_2026"

def clean_ci(ci_val, ruc_val):
    raw = (ci_val or "").strip()
    if not raw and ruc_val:
        raw = re.sub(r'[^0-9a-zA-Z]', '', ruc_val)
    else:
        raw = re.sub(r'[^0-9a-zA-Z]', '', raw)
    
    overrides = {
        "571814": "5718147",
        "453364": "4533640",
        "392523": "3925234",
    }
    return overrides.get(raw, raw)

async def main():
    conn = await asyncpg.connect(
        user="intelimarket",
        password="password",
        database="intelimarket",
        host="127.0.0.1",
        port=5432
    )
    
    rows = await conn.fetch("""
        SELECT 
            ar.id,
            ar.numero_documento,
            ar.fecha_emision,
            ar.saldo_pendiente,
            ar.monto_original,
            c.ci as customer_ci,
            c.ruc as customer_ruc,
            c.razon_social as customer_nombre,
            r.numero_remision,
            r.periodo_mes
        FROM accounts_receivable ar
        JOIN customers c ON c.id = ar.customer_id
        JOIN ar_corporate_remissions r ON r.id = ar.corporate_remission_id
        WHERE ar.corporate_remission_id = $1
        ORDER BY c.razon_social, ar.fecha_emision;
    """, REMISION_ID)
    
    await conn.close()
    print(f"Total rows fetched from DB: {len(rows)}")
    
    debts = []
    total_amount = 0
    for r in rows:
        ci = clean_ci(r["customer_ci"], r["customer_ruc"])
        monto = float(r["saldo_pendiente"] or r["monto_original"] or 0)
        total_amount += monto
        fecha = r["fecha_emision"].strftime("%Y-%m-%d") if r["fecha_emision"] else "2026-10-15"
        ticket_ref = r["numero_documento"] or str(r["id"])
        rem_num = r["numero_remision"]
        periodo = r["periodo_mes"] or "2026-10"
        
        debts.append({
            "ci": ci,
            "originStore": "Intelimarket - Extra Supermercado",
            "ticketReference": ticket_ref,
            "description": f"Consumo crédito Extra Club (Remito {rem_num})",
            "amount": monto,
            "purchaseDate": fecha,
            "payrollPeriod": periodo,
            "remissionNumber": rem_num
        })
    
    print(f"Total debts formatted: {len(debts)}, Sum: {total_amount:,.0f} Gs.")
    
    chunk_size = 50
    total_inserted = 0
    total_updated = 0
    total_unmatched = 0
    all_unmatched = []
    
    for i in range(0, len(debts), chunk_size):
        chunk = debts[i:i + chunk_size]
        payload = json.dumps({"debts": chunk}).encode("utf-8")
        req = urllib.request.Request(
            SUELDOK_URL,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
            },
            method="POST"
        )
        try:
            with urllib.request.urlopen(req) as resp:
                res_data = json.loads(resp.read().decode("utf-8"))
                ins = res_data.get("inserted", 0)
                upd = res_data.get("updated", 0)
                unm = res_data.get("unmatchedCount", 0)
                total_inserted += ins
                total_updated += upd
                total_unmatched += unm
                if res_data.get("unmatchedCi"):
                    all_unmatched.extend(res_data["unmatchedCi"])
                print(f"Chunk {i//chunk_size + 1}/{(len(debts)+chunk_size-1)//chunk_size}: {len(chunk)} items -> Inserted: {ins}, Updated: {upd}, Unmatched: {unm}")
        except Exception as e:
            print(f"Error in chunk {i//chunk_size + 1}: {e}")
            raise e

    print(f"\n==========================================")
    print(f"RESUMEN FINAL SINCRONIZACIÓN A SUELDOK:")
    print(f"Total Vouchers Remitidos: {len(debts)}")
    print(f"Total Insertados en SueldOK: {total_inserted}")
    print(f"Total Actualizados en SueldOK: {total_updated}")
    print(f"Total Sin Coincidencia: {total_unmatched}")
    if all_unmatched:
        print(f"Cédulas no encontradas ({len(all_unmatched)}):", all_unmatched[:10])
    print(f"==========================================")

if __name__ == "__main__":
    asyncio.run(main())
