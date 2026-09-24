"""Backfill one-off: etiqueta moneda real en sale_payments ya sincronizados
y completa el desglose multi-moneda de cash_counts ya sincronizados.
Corre una sola vez tras el deploy de la migracion 20260803000000.
"""
import asyncio
import uuid
from decimal import Decimal

import pymysql
from sqlalchemy import text

from api.src.config import settings
from api.src.db import async_session_factory

MONEDA_MAP = {1: "PYG", 2: "USD", 3: "BRL"}


def _legacy_connect():
    return pymysql.connect(
        host=settings.nemuha_mysql_host,
        port=settings.nemuha_mysql_port,
        user=settings.nemuha_mysql_user,
        password=settings.nemuha_mysql_password,
        database=settings.nemuha_mysql_database,
        cursorclass=pymysql.cursors.DictCursor,
        connect_timeout=10,
    )


async def backfill_sale_payments_moneda():
    conn = _legacy_connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT ID_RECEBIMENTO, ID_MOEDA FROM fin_recebimento WHERE ID_VENDA IS NOT NULL AND ID_MOEDA <> 1"
            )
            rows = cur.fetchall()
    finally:
        conn.close()

    print(f"fin_recebimento no-PYG a backfillear: {len(rows)}")
    updated = 0
    async with async_session_factory() as db:
        for r in rows:
            moneda = MONEDA_MAP.get(r["ID_MOEDA"])
            if not moneda:
                continue
            result = await db.execute(
                text(
                    "SELECT target_id FROM nemuha_record_map "
                    "WHERE source_table = 'fin_recebimento' AND source_pk = :pk"
                ),
                {"pk": r["ID_RECEBIMENTO"]},
            )
            row = result.first()
            if not row:
                continue
            await db.execute(
                text("UPDATE sale_payments SET moneda = :moneda WHERE id = :id"),
                {"moneda": moneda, "id": row.target_id},
            )
            updated += 1
        await db.commit()
    print(f"sale_payments.moneda actualizados: {updated}")


async def backfill_cash_counts_multimoneda():
    conn = _legacy_connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT ID_CAIXA_CHICA, VL_FECHAMENTO_DOLAR, VL_FECHAMENTO_REAL, "
                "VL_DIFERENCA_DOLAR, VL_DIFERENCA_REAL FROM fin_caixa_chica WHERE STATUS_CAIXA = 'FE'"
            )
            rows = cur.fetchall()
    finally:
        conn.close()

    print(f"fin_caixa_chica cerradas a backfillear: {len(rows)}")
    updated = 0
    async with async_session_factory() as db:
        for r in rows:
            result = await db.execute(
                text(
                    "SELECT target_id FROM nemuha_record_map "
                    "WHERE source_table = 'fin_caixa_chica' AND source_pk = :pk"
                ),
                {"pk": r["ID_CAIXA_CHICA"]},
            )
            row = result.first()
            if not row:
                continue
            res = await db.execute(
                text(
                    "UPDATE cash_counts SET monto_efectivo_usd = :usd, monto_efectivo_brl = :brl, "
                    "diferencia_usd = :dusd, diferencia_brl = :dbrl WHERE session_id = :session_id"
                ),
                {
                    "usd": Decimal(str(r["VL_FECHAMENTO_DOLAR"])),
                    "brl": Decimal(str(r["VL_FECHAMENTO_REAL"])),
                    "dusd": Decimal(str(r["VL_DIFERENCA_DOLAR"])),
                    "dbrl": Decimal(str(r["VL_DIFERENCA_REAL"])),
                    "session_id": row.target_id,
                },
            )
            if res.rowcount:
                updated += 1
        await db.commit()
    print(f"cash_counts multi-moneda actualizados: {updated}")


async def main():
    await backfill_sale_payments_moneda()
    await backfill_cash_counts_multimoneda()


if __name__ == "__main__":
    asyncio.run(main())
