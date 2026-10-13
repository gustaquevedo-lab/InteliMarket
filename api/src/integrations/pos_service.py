"""POS Integrations Service — Real-time live transactions from POS Bancard & Dinelco (Ñemuha / Extra Supermercado)"""

import os
import pymysql
from typing import Optional
from datetime import datetime
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)

MYSQL_HOST = os.getenv("NEMUHA_MYSQL_HOST", "100.76.95.42")
MYSQL_PORT = int(os.getenv("NEMUHA_MYSQL_PORT", "3306"))
MYSQL_USER = os.getenv("NEMUHA_MYSQL_USER", "intelimarket_ro")
MYSQL_PASSWORD = os.getenv("NEMUHA_MYSQL_PASSWORD", "Luzma7834")
MYSQL_DB = os.getenv("NEMUHA_MYSQL_DATABASE", "comercial_extra_py")


def get_mysql_connection():
    return pymysql.connect(
        host=MYSQL_HOST,
        port=MYSQL_PORT,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        database=MYSQL_DB,
        connect_timeout=4,
        cursorclass=pymysql.cursors.DictCursor,
    )


async def get_pos_kpis() -> dict:
    """Get aggregated, sanitized, accurate KPIs for Bancard & Dinelco from real live transactions."""
    try:
        conn = get_mysql_connection()
        with conn.cursor() as cur:
            # Query sanitized sums (cleans up any scanner barcode errors in amount field)
            cur.execute("""
                SELECT 
                    p.ORIGEM_OPERCAO as procesador,
                    COUNT(*) as total_txs,
                    SUM(CASE 
                        WHEN p.VL_OPERACAO > 50000000 AND v.VL_TOTAL IS NOT NULL THEN v.VL_TOTAL 
                        WHEN p.VL_OPERACAO > 50000000 THEN 0
                        ELSE p.VL_OPERACAO 
                    END) as total_monto
                FROM fin_operacao_pos p
                LEFT JOIN ven_venda v ON v.ID_VENDA = p.ID_VENDA
                GROUP BY p.ORIGEM_OPERCAO
            """)
            rows = cur.fetchall()

            # QR Code Bancard Zimple
            cur.execute("""
                SELECT 
                    COUNT(*) as qr_count, 
                    SUM(CASE 
                        WHEN p.VL_OPERACAO > 50000000 AND v.VL_TOTAL IS NOT NULL THEN v.VL_TOTAL 
                        WHEN p.VL_OPERACAO > 50000000 THEN 0
                        ELSE p.VL_OPERACAO 
                    END) as qr_monto
                FROM fin_operacao_pos p
                LEFT JOIN ven_venda v ON v.ID_VENDA = p.ID_VENDA
                WHERE p.CREDITO_DEBITO = 'QR CODE'
            """)
            qr_row = cur.fetchone() or {"qr_count": 0, "qr_monto": 0}

            # Tarjetas Físicas Bancard (Débito + Crédito sin QR)
            cur.execute("""
                SELECT 
                    COUNT(*) as card_count, 
                    SUM(CASE 
                        WHEN p.VL_OPERACAO > 50000000 AND v.VL_TOTAL IS NOT NULL THEN v.VL_TOTAL 
                        WHEN p.VL_OPERACAO > 50000000 THEN 0
                        ELSE p.VL_OPERACAO 
                    END) as card_monto
                FROM fin_operacao_pos p
                LEFT JOIN ven_venda v ON v.ID_VENDA = p.ID_VENDA
                WHERE p.ORIGEM_OPERCAO = 'BANCARD' AND p.CREDITO_DEBITO != 'QR CODE'
            """)
            card_row = cur.fetchone() or {"card_count": 0, "card_monto": 0}

            # Operaciones de hoy
            cur.execute("""
                SELECT COUNT(*) as hoy_count, SUM(VL_OPERACAO) as hoy_monto
                FROM fin_operacao_pos
                WHERE DATE(DT_OPERACAO) = CURDATE()
            """)
            hoy_row = cur.fetchone() or {"hoy_count": 0, "hoy_monto": 0}

        conn.close()

        bancard_total = 0
        dinelco_total = 0
        bancard_txs = 0
        dinelco_txs = 0
        total_operaciones = 0
        for r in rows:
            proc = str(r["procesador"]).upper()
            monto = float(r["total_monto"] or 0)
            txs = int(r["total_txs"] or 0)
            total_operaciones += txs
            if "BANCARD" in proc:
                bancard_total += monto
                bancard_txs += txs
            elif "DINELCO" in proc:
                dinelco_total += monto
                dinelco_txs += txs

        # connected=True significa que la consulta a la base real del legacy
        # funcionó -- los totales pueden ser 0 de verdad si no hubo ventas
        # con tarjeta, eso NO es un error y no debe mostrarse como tal.
        return {
            "connected": True,
            "bancard_total_gs": int(bancard_total),
            "bancard_tarjetas_gs": int(card_row.get("card_monto") or 0),
            "bancard_tarjetas_txs": int(card_row.get("card_count") or 0),
            "dinelco_total_gs": int(dinelco_total),
            "dinelco_txs": dinelco_txs,
            "qr_total_gs": int(qr_row.get("qr_monto") or 0),
            "qr_total_txs": int(qr_row.get("qr_count") or 0),
            "hoy_total_gs": int(hoy_row.get("hoy_monto") or 0),
            "hoy_total_txs": int(hoy_row.get("hoy_count") or 0),
            "total_operaciones": total_operaciones,
        }
    except Exception as e:
        # Antes esto devolvía numeros fijos que parecian datos reales --
        # si la conexion a la base del legacy falla, hay que decirlo, no
        # disfrazarlo de "todo funciona".
        logger.error(f"Error fetching live POS KPIs from MySQL: {e}")
        return {
            "connected": False,
            "error": str(e),
            "bancard_total_gs": 0,
            "bancard_tarjetas_gs": 0,
            "bancard_tarjetas_txs": 0,
            "dinelco_total_gs": 0,
            "dinelco_txs": 0,
            "qr_total_gs": 0,
            "qr_total_txs": 0,
            "hoy_total_gs": 0,
            "hoy_total_txs": 0,
            "total_operaciones": 0,
        }


async def list_live_pos_transactions(limit: int = 100, procesador: Optional[str] = None) -> list[dict]:
    """List recent POS transactions with card brands, vouchers, and cashiers, properly sanitized."""
    try:
        conn = get_mysql_connection()
        with conn.cursor() as cur:
            query = """
                SELECT 
                    p.ID_OPERACAO_POS as id,
                    p.DT_OPERACAO as fecha,
                    p.CLIENTE as cliente,
                    p.ORIGEM_OPERCAO as procesador,
                    p.TP_OPERCAO as tipo,
                    p.CREDITO_DEBITO as tarjeta_marca,
                    CASE 
                        WHEN p.VL_OPERACAO > 50000000 AND v.VL_TOTAL IS NOT NULL THEN v.VL_TOTAL 
                        WHEN p.VL_OPERACAO > 50000000 THEN 0
                        ELSE p.VL_OPERACAO 
                    END as monto,
                    p.NR_BOLETA as voucher,
                    p.USUARIO as cajero,
                    p.ID_VENDA as venta_id
                FROM fin_operacao_pos p
                LEFT JOIN ven_venda v ON v.ID_VENDA = p.ID_VENDA
            """
            params = []
            if procesador:
                query += " WHERE p.ORIGEM_OPERCAO = %s"
                params.append(procesador.upper())
            
            query += " ORDER BY p.DT_OPERACAO DESC LIMIT %s"
            params.append(limit)

            cur.execute(query, tuple(params))
            rows = cur.fetchall()
        conn.close()

        result = []
        for r in rows:
            marca = (r.get("tarjeta_marca") or "").strip()
            tipo_label = "QR CODE" if "QR" in marca.upper() else ("CRÉDITO" if "CREDIT" in (r.get("tipo") or "").upper() or "ORO" in marca or "PLATIN" in marca or "INFINITE" in marca else "DÉBITO")
            result.append({
                "id": str(r["id"]),
                "fecha": r["fecha"].strftime("%Y-%m-%d %H:%M:%S") if r.get("fecha") else "",
                "cliente": r.get("cliente") or "CONSUMIDOR FINAL",
                "procesador": (r.get("procesador") or "BANCARD").strip(),
                "tipo": tipo_label,
                "tarjeta_marca": marca or "BANCARD ELECTRON",
                "monto": float(r.get("monto") or 0),
                "voucher": (r.get("voucher") or "").strip() or "—",
                "cajero": (r.get("cajero") or "Caja").strip(),
                "venta_id": r.get("venta_id"),
                "estado": "APROBADO",
            })
        return result
    except Exception as e:
        logger.error(f"Error fetching live POS transactions from MySQL: {e}")
        return []


async def find_matching_transactions(
    procesador: str, monto: int, desde: datetime, claimed_ids: set[str], tolerancia: int = 5,
) -> list[dict]:
    """Busca en fin_operacao_pos (tabla real, viva, escrita por las
    maquinitas físicas de Bancard/Dinelco -- confirmado con el cliente que
    están en red propia, no atadas a Ñemuha) una transacción reciente que
    coincida con el monto cobrado en InteliMarket, para reemplazar la carga
    manual de lote/cupón por una verificación real. No hay columna de
    terminal/caja en esta tabla, así que el único criterio posible es
    procesador + monto + ventana de tiempo corta desde que se abrió el
    cobro -- no es perfecto si dos cajas cobran el mismo monto en el mismo
    instante, por eso se excluyen ids ya reclamados (claimed_ids) y se
    devuelven todos los candidatos para que el cajero elija si hay más de
    uno."""
    try:
        conn = get_mysql_connection()
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    p.ID_OPERACAO_POS as id,
                    p.DT_OPERACAO as fecha,
                    p.CREDITO_DEBITO as tarjeta_marca,
                    p.VL_OPERACAO as monto,
                    p.NR_BOLETA as voucher,
                    p.USUARIO as cajero
                FROM fin_operacao_pos p
                WHERE p.ORIGEM_OPERCAO = %s
                  AND p.DT_OPERACAO >= %s
                  AND ABS(p.VL_OPERACAO - %s) <= %s
                ORDER BY p.DT_OPERACAO DESC
                LIMIT 10
                """,
                (procesador.upper(), desde, monto, tolerancia),
            )
            rows = cur.fetchall()
        conn.close()

        return [
            {
                "id": str(r["id"]),
                "fecha": r["fecha"].strftime("%Y-%m-%d %H:%M:%S") if r.get("fecha") else "",
                "tarjeta_marca": (r.get("tarjeta_marca") or "").strip(),
                "monto": float(r.get("monto") or 0),
                "voucher": (r.get("voucher") or "").strip() or "—",
                "cajero": (r.get("cajero") or "").strip(),
            }
            for r in rows
            if str(r["id"]) not in claimed_ids
        ]
    except Exception as e:
        logger.error(f"Error buscando transacción POS coincidente: {e}")
        return []
