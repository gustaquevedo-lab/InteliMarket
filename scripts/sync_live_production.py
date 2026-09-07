import asyncio
import pymysql
from decimal import Decimal
from api.src.config import settings
from api.src.db import async_session_factory
from sqlalchemy import text

COMPANY_ID = "00000000-0000-0000-0000-000000000010"

async def sync_live_production():
    # 1. Conectar a MySQL
    conn = pymysql.connect(
        host=settings.nemuha_mysql_host or '127.0.0.1',
        port=settings.nemuha_mysql_port or 3306,
        user=settings.nemuha_mysql_user or 'root',
        password=settings.nemuha_mysql_password or '',
        database=settings.nemuha_mysql_database or 'comercial_extra_py',
        cursorclass=pymysql.cursors.DictCursor
    )

    with conn.cursor() as cur:
        # A. Secuencias de timbrado y facturas por boca
        cur.execute("SELECT boca_emissao, tipo, proximo, nr_final FROM con_secuencia_fatura;")
        secuencias = cur.fetchall()

        # B. Sesiones de caja activas e históricas
        cur.execute("""
            SELECT fcc.*, u.NM_USUARIO, u.LOGIN 
            FROM fin_caixa_chica fcc
            LEFT JOIN sys_usuario u ON fcc.ID_USUARIO = u.id_usuario
            ORDER BY fcc.ID_CAIXA_CHICA DESC
            LIMIT 50;
        """)
        sesiones_mysql = cur.fetchall()

        # C. Ventas de hoy con su detalle de caja y cobros
        cur.execute("""
            SELECT v.ID_VENDA, v.ID_CAIXA_CHICA, v.CD_VENDA, v.NR_FATURA, v.VL_TOTAL, v.BO_CANCELADO, v.DT_VENDA
            FROM ven_venda v
            WHERE v.DT_VENDA >= '2026-08-30' OR v.ID_CAIXA_CHICA IN (2209, 2210, 2211);
        """)
        ventas_mysql = cur.fetchall()

        # D. Pagos de ventas (efectivo, tarjeta, etc.)
        cur.execute("""
            SELECT r.ID_RECEBIMENTO, r.ID_VENDA, fr.DS_FORMA_RECEBIMENTO, r.VL_RECEBIDO, r.DT_RECEBIMENTO, r.ID_MOEDA
            FROM fin_recebimento r
            JOIN fin_forma_recebimento fr ON r.ID_FORMA_RECEBIMENTO = fr.ID_FORMA_RECEBIMENTO
            WHERE r.DT_RECEBIMENTO >= '2026-08-30';
        """)
        pagos_mysql = cur.fetchall()

    conn.close()

    print(f"Leídas {len(secuencias)} secuencias, {len(sesiones_mysql)} sesiones, {len(ventas_mysql)} ventas y {len(pagos_mysql)} pagos desde MySQL.")

    async with async_session_factory() as db:
        # Obtener timbrado activo
        timb_res = await db.execute(text("SELECT id FROM sifen_timbrados WHERE company_id = :comp AND activo = true LIMIT 1;"), {"comp": COMPANY_ID})
        timbrado_id = timb_res.scalar() or "2cf321bd-70e3-46e7-98e6-521fca775e8e"

        # 1. Actualizar punto_emision_secuencias con la numeración exacta de producción
        for sec in secuencias:
            pto = str(sec["boca_emissao"]).zfill(3)
            doc_tipo = "nota_credito" if "CREDITO" in sec["tipo"].upper() else "factura"
            num_actual = int(sec["proximo"])
            num_final = int(sec["nr_final"] or 40000)

            await db.execute(text("""
                INSERT INTO punto_emision_secuencias (
                    company_id, timbrado_id, establecimiento, punto_emision, tipo_documento, numero_actual, numero_final, activo
                ) VALUES (
                    :comp, :timb, '001', :pto, :doc, :num, :num_final, true
                )
                ON CONFLICT (company_id, establecimiento, punto_emision, tipo_documento)
                DO UPDATE SET 
                    timbrado_id = EXCLUDED.timbrado_id,
                    numero_actual = EXCLUDED.numero_actual,
                    numero_final = EXCLUDED.numero_final,
                    activo = true,
                    updated_at = now();
            """), {
                "comp": COMPANY_ID,
                "timb": timbrado_id,
                "pto": pto,
                "doc": doc_tipo,
                "num": num_actual,
                "num_final": num_final
            })
            print(f"Secuencia actualizada: Punto {pto} [{doc_tipo}] -> Nº actual {num_actual}")


        # 2. Mapear Cajas Reales en PostgreSQL
        cajas_res = await db.execute(text("SELECT id, codigo, nombre FROM cash_registers WHERE company_id = :comp;"), {"comp": COMPANY_ID})
        cajas_map = {r.codigo: r.id for r in cajas_res.fetchall()}

        # Asignar cada sesión de caja a su caja física real según las facturas emitidas:
        # - Tomasa (ID 2209) emitió facturas en boca 014 -> POS-014 (Caja 4)
        # - Evelin (ID 2210) emitió facturas en boca 013 -> POS-013 (Caja 3)
        # - Zunilda (ID 2211) emitió en boca 012 -> POS-012 (Caja 2)
        caja_por_sesion = {
            2209: cajas_map.get("POS-014"), # Caja 4
            2210: cajas_map.get("POS-013"), # Caja 3
            2211: cajas_map.get("POS-012"), # Caja 2
        }

        # 3. Sincronizar o actualizar las sesiones de caja en PostgreSQL
        for s in sesiones_mysql:
            cid = s["ID_CAIXA_CHICA"]
            cajero_name = s["NM_USUARIO"] or s["LOGIN"] or f"Cajero {s['ID_USUARIO']}"
            reg_id = caja_por_sesion.get(cid) or cajas_map.get("POS-012")
            st = "abierta" if s["STATUS_CAIXA"] == "AB" else "cerrada"
            monto_apertura = float(s["VL_ABERTURA_GUARANI"] or 0)
            monto_cierre = float(s["VL_FECHAMENTO_GUARANI"] or 0) if st == "cerrada" else None
            fecha_apertura = s["DT_ABERTURA"]
            fecha_cierre = s["DT_FECHAMENTO"] if st == "cerrada" else None

            # Obtener target_id si existe
            map_res = await db.execute(text("""
                SELECT target_id FROM nemuha_record_map 
                WHERE company_id = :comp AND source_table = 'fin_caixa_chica' AND source_pk = :pk;
            """), {"comp": COMPANY_ID, "pk": cid})
            existing_target = map_res.scalar()

            if existing_target:
                await db.execute(text("""
                    UPDATE cash_sessions 
                    SET register_id = :reg_id,
                        cajero_nombre = :cajero,
                        monto_apertura = :apertura,
                        monto_cierre = :cierre,
                        fecha_apertura = :fa,
                        fecha_cierre = :fc,
                        estado = :st
                    WHERE id = :target_id;
                """), {
                    "reg_id": reg_id,
                    "cajero": cajero_name,
                    "apertura": monto_apertura,
                    "cierre": monto_cierre,
                    "fa": fecha_apertura,
                    "fc": fecha_cierre,
                    "st": st,
                    "target_id": existing_target
                })
            else:
                ins_res = await db.execute(text("""
                    INSERT INTO cash_sessions (
                        register_id, user_id, cajero_nombre, monto_apertura, fecha_apertura, fecha_cierre, monto_cierre, estado
                    ) VALUES (
                        :reg_id, gen_random_uuid(), :cajero, :apertura, :fa, :fc, :cierre, :st
                    ) RETURNING id;
                """), {
                    "reg_id": reg_id,
                    "cajero": cajero_name,
                    "apertura": monto_apertura,
                    "fa": fecha_apertura,
                    "fc": fecha_cierre,
                    "cierre": monto_cierre,
                    "st": st
                })
                new_sid = ins_res.scalar()
                await db.execute(text("""
                    INSERT INTO nemuha_record_map (company_id, source_table, source_pk, target_table, target_id)
                    VALUES (:comp, 'fin_caixa_chica', :pk, 'cash_sessions', :tid);
                """), {"comp": COMPANY_ID, "pk": cid, "tid": new_sid})

        await db.commit()

        # 4. Vincular todas las ventas a sus sesiones y registrar los montos cobrados
        map_sessions_res = await db.execute(text("""
            SELECT source_pk, target_id 
            FROM nemuha_record_map 
            WHERE company_id = :comp AND source_table = 'fin_caixa_chica';
        """), {"comp": COMPANY_ID})
        caixa_map_dict = {row.source_pk: row.target_id for row in map_sessions_res.fetchall()}

        for v in ventas_mysql:
            session_uuid = caixa_map_dict.get(v["ID_CAIXA_CHICA"])
            if not session_uuid:
                continue

            # Buscar la venta en Postgres
            sale_map = await db.execute(text("""
                SELECT target_id FROM nemuha_record_map 
                WHERE company_id = :comp AND source_table = 'ven_venda' AND source_pk = :pk;
            """), {"comp": COMPANY_ID, "pk": v["ID_VENDA"]})
            sale_uuid = sale_map.scalar()

            if sale_uuid:
                await db.execute(text("""
                    UPDATE sales 
                    SET session_id = :sid,
                        total = :tot,
                        estado = :st
                    WHERE id = :sale_id;
                """), {
                    "sid": session_uuid,
                    "tot": float(v["VL_TOTAL"]),
                    "st": "cancelado" if v["BO_CANCELADO"] else "confirmado",
                    "sale_id": sale_uuid
                })

        await db.commit()

        # 5. Insertar los SalePayments de efectivo de hoy para que el cálculo de efectivo en gaveta sea exacto
        forma_pago_map = {
            "DINHEIRO": "EFECTIVO",
            "EFECTIVO": "EFECTIVO",
            "CARTAO DE CREDITO": "TARJETA_CREDITO",
            "CARTAO DE DEBITO": "TARJETA_DEBITO",
            "PIX": "PIX",
            "QR": "QR_CODE",
        }
        moeda_map = {1: "PYG", 2: "USD", 3: "BRL"}

        for p in pagos_mysql:
            sale_map = await db.execute(text("""
                SELECT target_id FROM nemuha_record_map 
                WHERE company_id = :comp AND source_table = 'ven_venda' AND source_pk = :pk;
            """), {"comp": COMPANY_ID, "pk": p["ID_VENDA"]})
            sale_uuid = sale_map.scalar()
            if not sale_uuid:
                continue

            forma = "EFECTIVO"
            for k, v in forma_pago_map.items():
                if k in str(p["DS_FORMA_RECEBIMENTO"]).upper():
                    forma = v
                    break

            moneda = moeda_map.get(p["ID_MOEDA"], "PYG")
            monto = float(p["VL_RECEBIDO"] or 0)

            # Insertar SalePayment si no existe
            await db.execute(text("""
                INSERT INTO sale_payments (id, company_id, sale_id, forma_pago, monto, moneda, fecha)
                VALUES (gen_random_uuid(), :comp, :sid, :forma, :monto, :moneda, :fecha)
                ON CONFLICT DO NOTHING;
            """), {
                "comp": COMPANY_ID,
                "sid": sale_uuid,
                "forma": forma,
                "monto": monto,
                "moneda": moneda,
                "fecha": p["DT_RECEBIMENTO"]
            })

        await db.commit()
        print("Sincronización en vivo completada al 100%.")

if __name__ == "__main__":
    asyncio.run(sync_live_production())
