"""Script de Reconciliación Integral y Emancipación de Stock de InteliMarket.

Objetivos:
1. Importar las 12 Órdenes de Compra históricas pendientes de Ñemuha (4954 a 4965).
2. Importar las 21 Recepciones de Mercadería históricas de Ñemuha (4699 a 4719) que llegaron
   entre el 21 y 23 de septiembre de 2026 (~₲120.000.000 en mercaderías físicas).
3. Acreditar las existencias recibidas al inventario nativo de InteliMarket (Stock.cantidad,
   Stock.costo_unitario, StockLot, InventoryMovement).
4. Importar el Ajuste de Inventario #564 (conteo de cortes de carnicería del 21/09).
5. Cuantificar el impacto en productos con stock negativo y reportar la situación final.
6. Admite flag --dry-run para simulación sin commit.
"""

import argparse
import asyncio
from datetime import date, datetime, timezone
from decimal import Decimal
import logging
import sys
from uuid import UUID

from sqlalchemy import func, select, text

from api.src.db import async_session_factory
from api.src.inventory.models import InventoryAdjustment, InventoryAdjustmentItem, InventoryMovement, Stock, StockLot
from api.src.nemuha_connector.service import (
    _fetch,
    _get_mapped_target,
    _iva_monto,
    _resolve_deposito,
    _resolve_pessoa,
    _resolve_producto,
    _save_map,
    MONEDA_MAP,
)
from api.src.purchases.models import PurchaseOrder, PurchaseOrderItem, PurchaseReceipt, PurchaseReceiptItem

COMPANY_ID = "00000000-0000-0000-0000-000000000010"
CID = UUID(COMPANY_ID)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("reconcile_stock")


async def run_reconciliation(dry_run: bool = True, fix_negatives: bool = False):
    log.info("Iniciando reconciliación y corte de inventario (dry_run=%s, fix_negatives=%s)...", dry_run, fix_negatives)

    async with async_session_factory() as db:
        # ── 1. AUDITORÍA PREVIA ───────────────────────────────────────────────────────
        neg_before = await db.execute(
            text("SELECT count(*) FROM stock WHERE cantidad < 0")
        )
        total_neg_before = neg_before.scalar_one()
        log.info("Productos con stock negativo ANTES de la reconciliación: %d", total_neg_before)

        # ── 2. IMPORTAR ÓRDENES DE COMPRA (4954 - 4965) ──────────────────────────────
        sql_pos = """
            SELECT o.*, p.NOME as PROVEEDOR_NOME
            FROM est_ordem_compra o
            LEFT JOIN bs_pessoa p ON p.ID_PESSOA = o.ID_PESSOA
            WHERE o.ID_ORDEM_COMPRA >= 4954
            ORDER BY o.ID_ORDEM_COMPRA
        """
        ordenes = await _fetch(sql_pos)
        log.info("Órdenes de compra encontradas en MySQL >= 4954: %d", len(ordenes))

        pos_creadas = 0
        po_map: dict[int, UUID] = {}

        for o in ordenes:
            existing_id = await _get_mapped_target(db, COMPANY_ID, "est_ordem_compra", o["ID_ORDEM_COMPRA"])
            if existing_id:
                po_map[o["ID_ORDEM_COMPRA"]] = existing_id
                continue

            supplier_id = await _resolve_pessoa(db, COMPANY_ID, o["ID_PESSOA"], "supplier")
            items_rows = await _fetch(
                "SELECT * FROM est_item_ordem_compra WHERE ID_ORDEM_COMPRA = %s",
                (o["ID_ORDEM_COMPRA"],),
            )

            cancelado = bool(o["BO_CANCELADO"])
            finalizado = bool(o["BO_FINALIZADO"])
            confirmado = bool(o["BO_CONFIRMADO"])
            algo_entregado = any((it["QTD_PRODUTO_ENTREGUE"] or 0) > 0 for it in items_rows)

            if cancelado:
                estado = "cancelado"
            elif finalizado:
                estado = "completado"
            elif algo_entregado:
                estado = "parcial"
            elif confirmado:
                estado = "confirmado"
            else:
                estado = "borrador"

            subtotal = Decimal("0")
            iva_10 = iva_5 = Decimal("0")
            order_items = []
            for it in items_rows:
                tasa = Decimal(str(it["IVA"])) if it["IVA"] is not None else Decimal("10")
                total_item = Decimal(str(it["VL_TOTAL"] or 0))
                iva_monto = _iva_monto(total_item, tasa)
                base = total_item - iva_monto
                if tasa == 10:
                    iva_10 += iva_monto
                elif tasa == 5:
                    iva_5 += iva_monto
                subtotal += base

                product_id = await _resolve_producto(db, COMPANY_ID, it["ID_PRODUTO"], it["CODIGO_BARRA"], tasa)
                order_items.append(
                    PurchaseOrderItem(
                        product_id=product_id,
                        descripcion=it.get("DS_PRODUTO"),
                        cantidad=Decimal(str(it["QTD_PRODUTO"] or 0)),
                        cantidad_recibida=Decimal(str(it["QTD_PRODUTO_ENTREGUE"] or 0)),
                        precio_unitario=Decimal(str(it["VL_UNITARIO"] or 0)),
                        iva_tasa=tasa,
                        total=total_item,
                    )
                )

            order = PurchaseOrder(
                company_id=COMPANY_ID,
                supplier_id=supplier_id,
                numero=f"OC-{o['ID_ORDEM_COMPRA']}",
                fecha=o["DT_ORDEM_COMPRA"] or o["DT_EMISSAO"],
                estado=estado,
                moneda=MONEDA_MAP.get(o["ID_MOEDA"], "PYG"),
                subtotal=subtotal,
                descuento_total=Decimal(str(o["VL_DESCONTO"] or 0)),
                iva_10=iva_10,
                iva_5=iva_5,
                total=Decimal(str(o["VL_DOCUMENTO"] or 0)),
            )
            order.items = order_items
            db.add(order)
            await db.flush()
            await _save_map(db, COMPANY_ID, "est_ordem_compra", o["ID_ORDEM_COMPRA"], "purchase_orders", order.id)
            po_map[o["ID_ORDEM_COMPRA"]] = order.id
            pos_creadas += 1
            log.info("  -> Creada PO %s (ID %s, Proveedor: %s)", order.numero, order.id, o["PROVEEDOR_NOME"])

        log.info("Total Órdenes de Compra importadas: %d", pos_creadas)

        # ── 3. IMPORTAR RECEPCIONES Y ACREDITAR STOCK (4699 - 4719) ───────────────────
        warehouse_id = await _resolve_deposito(db, COMPANY_ID, 1)

        sql_recs = """
            SELECT r.*, o.ID_PESSOA, p.NOME as PROVEEDOR_NOME
            FROM est_recepcao_ordem_compra r
            JOIN est_ordem_compra o ON o.ID_ORDEM_COMPRA = r.ID_ORDEM_COMPRA
            LEFT JOIN bs_pessoa p ON p.ID_PESSOA = o.ID_PESSOA
            WHERE r.ID_RECEPCAO_ORDEM_COMPRA >= 4699
            ORDER BY r.ID_RECEPCAO_ORDEM_COMPRA
        """
        recepciones = await _fetch(sql_recs)
        log.info("Recepciones encontradas en MySQL >= 4699: %d", len(recepciones))

        recs_creadas = 0
        items_acreditados = 0
        monto_acreditado = Decimal("0")

        # Pre-cargar mapa de stock actual para el depósito
        stock_rows = await db.execute(select(Stock).where(Stock.warehouse_id == warehouse_id))
        stock_map: dict[UUID, Stock] = {s.product_id: s for s in stock_rows.scalars().all()}

        for r in recepciones:
            existing_rec_id = await _get_mapped_target(
                db, COMPANY_ID, "est_recepcao_ordem_compra", r["ID_RECEPCAO_ORDEM_COMPRA"]
            )
            if existing_rec_id:
                log.info("Recepción %d ya existe en PostgreSQL, omitiendo.", r["ID_RECEPCAO_ORDEM_COMPRA"])
                continue

            po_id = po_map.get(r["ID_ORDEM_COMPRA"])
            if not po_id:
                po_id = await _get_mapped_target(db, COMPANY_ID, "est_ordem_compra", r["ID_ORDEM_COMPRA"])
                if not po_id:
                    log.error("No se pudo hallar purchase_order_id para recepción %d (PO %d)", r["ID_RECEPCAO_ORDEM_COMPRA"], r["ID_ORDEM_COMPRA"])
                    continue
                po_map[r["ID_ORDEM_COMPRA"]] = po_id

            supplier_id = await _resolve_pessoa(db, COMPANY_ID, r["ID_PESSOA"], "supplier")

            items_rows = await _fetch(
                """
                SELECT ir.*
                FROM est_item_recepcao_ordem_compra ir
                WHERE ir.ID_RECEPCAO_ORDEM_COMPRA = %s
                """,
                (r["ID_RECEPCAO_ORDEM_COMPRA"],),
            )

            receipt_items = []
            rec_total = Decimal(str(r["VL_RECEPCAO"] or 0))

            for it in items_rows:
                product_id = await _resolve_producto(db, COMPANY_ID, it["ID_PRODUTO"], None, Decimal("10"))
                cant_rec = Decimal(str(it["QTD_RECEBIDA"] or 0))
                cant_ord = Decimal(str(it["QTD_PRODUTO_FATURA"] or it["QTD_RECEBIDA"] or 0))
                vl_unit = Decimal(str(it["VL_UNITARIO"] or 0))
                vl_tot = Decimal(str(it["VL_TOTAL"] or 0))

                receipt_items.append(
                    PurchaseReceiptItem(
                        product_id=product_id,
                        cantidad_ordenada=cant_ord,
                        cantidad_recibida=cant_rec,
                        precio_unitario=vl_unit,
                        costo_unitario=vl_unit,
                        total=vl_tot,
                    )
                )

            # Si tiene ítems recibidos reales, la recepción se considera completada
            # ya que la mercadería fue ingresada y descargada físicamente.
            estado_rec = "cancelado" if r["BO_CANCELADO"] else "completado"

            receipt = PurchaseReceipt(
                company_id=COMPANY_ID,
                purchase_order_id=po_id,
                supplier_id=supplier_id,
                warehouse_id=warehouse_id,
                numero=f"REC-{r['ID_RECEPCAO_ORDEM_COMPRA']}",
                fecha=r["DT_CADASTRO"],
                total=rec_total,
                proveedor_ref=r["REMITO"] or r["NR_DOCUMENTO"],
                estado=estado_rec,
                observaciones=f"Factura proveedor: {r['NR_DOCUMENTO']}" if r["NR_DOCUMENTO"] else "Recepción legado",
            )
            receipt.items = receipt_items
            db.add(receipt)
            await db.flush()

            # Acreditar Stock físico, Lotes y Movimientos
            if estado_rec == "completado":
                for it_item in receipt_items:
                    qty = int(it_item.cantidad_recibida)
                    if qty <= 0:
                        continue

                    cost = it_item.costo_unitario or Decimal("0")

                    # 1. StockLot
                    db.add(
                        StockLot(
                            company_id=CID,
                            warehouse_id=warehouse_id,
                            product_id=it_item.product_id,
                            cantidad=qty,
                            cantidad_disponible=qty,
                            costo_unitario=cost,
                            costo_total=cost * qty,
                            referencia=f"REC-{r['ID_RECEPCAO_ORDEM_COMPRA']}",
                            fecha_ingreso=receipt.fecha,
                        )
                    )

                    # 2. Stock físico
                    stk = stock_map.get(it_item.product_id)
                    if not stk:
                        stk = Stock(
                            warehouse_id=warehouse_id,
                            product_id=it_item.product_id,
                            cantidad=qty,
                            costo_unitario=cost,
                        )
                        db.add(stk)
                        stock_map[it_item.product_id] = stk
                    else:
                        old_qty = stk.cantidad
                        old_cost = stk.costo_unitario or Decimal("0")
                        stk.cantidad += qty
                        if old_qty + qty > 0 and cost > 0:
                            stk.costo_unitario = (
                                (old_cost * max(0, old_qty) + cost * qty) / (max(0, old_qty) + qty)
                            ).quantize(Decimal("1"), rounding="ROUND_HALF_UP")
                        stk.updated_at = func.now()

                    # 3. InventoryMovement
                    db.add(
                        InventoryMovement(
                            company_id=CID,
                            warehouse_id=warehouse_id,
                            product_id=it_item.product_id,
                            tipo="entrada_compra",
                            cantidad=qty,
                            costo_unitario=cost,
                            referencia_type="purchase_receipt",
                            referencia_id=receipt.id,
                        )
                    )

                    items_acreditados += 1
                    monto_acreditado += cost * qty

                # Actualizar cantidades recibidas en la orden de compra
                for it_item in receipt_items:
                    await db.execute(
                        text("""
                            UPDATE purchase_order_items
                            SET cantidad_recibida = COALESCE(cantidad_recibida, 0) + :rec
                            WHERE purchase_order_id = :po_id AND product_id = :pid
                        """),
                        {"rec": float(it_item.cantidad_recibida), "po_id": str(po_id), "pid": str(it_item.product_id)},
                    )

                # Marcar la orden como completada
                await db.execute(
                    text("UPDATE purchase_orders SET estado = 'completado', updated_at = now() WHERE id = :po_id"),
                    {"po_id": str(po_id)},
                )

            await _save_map(
                db, COMPANY_ID, "est_recepcao_ordem_compra", r["ID_RECEPCAO_ORDEM_COMPRA"], "purchase_receipts", receipt.id
            )
            recs_creadas += 1
            log.info(
                "  -> Recepción %s (PO %s, Proveedor: %s, Total: ₲%s, Items: %d)",
                receipt.numero,
                r["ID_ORDEM_COMPRA"],
                r["PROVEEDOR_NOME"],
                f"{rec_total:,.0f}".replace(",", "."),
                len(receipt_items),
            )

        log.info(
            "Recepciones importadas: %d | Ítems acreditados al stock: %d | Valor total acreditado: ₲%s",
            recs_creadas,
            items_acreditados,
            f"{monto_acreditado:,.0f}".replace(",", "."),
        )

        # ── 4. IMPORTAR AJUSTE DE INVENTARIO #564 (CARNICERÍA) ────────────────────────
        existing_adj = await _get_mapped_target(db, COMPANY_ID, "est_ajuste_estoque", 564)
        if not existing_adj:
            adj_data = await _fetch("SELECT * FROM est_ajuste_estoque WHERE ID_AJUSTE_ESTOQUE = 564")
            if adj_data:
                a = adj_data[0]
                items_adj = await _fetch(
                    "SELECT * FROM est_item_ajuste_estoque WHERE ID_AJUSTE_ESTOQUE = 564"
                )
                adj = InventoryAdjustment(
                    company_id=COMPANY_ID,
                    warehouse_id=warehouse_id,
                    codigo=f"NEMUHA-{a['CD_AJUSTE_ESTOQUE']}",
                    motivo=a["OBSERVACAO"] or "Ajuste de inventario carnicería 21/09",
                    estado="aprobado",
                    observaciones=a["OBSERVACAO"],
                    fecha_aprobacion=a["DT_AJUSTE"],
                )
                db.add(adj)
                await db.flush()

                adj_items_count = 0
                for it in items_adj:
                    tasa_iva = Decimal("10")
                    pid = await _resolve_producto(db, COMPANY_ID, it["ID_PRODUTO"], it.get("CODIGO_BARRA"), tasa_iva)
                    cant_sis = round(Decimal(str(it["QTD_EXISTENCIA_ATUAL"] or 0)))
                    cant_fis = round(Decimal(str(it["QTD_NOVA_EXISTENCIA"] or 0)))
                    diff = cant_fis - cant_sis

                    db.add(
                        InventoryAdjustmentItem(
                            adjustment_id=adj.id,
                            product_id=pid,
                            cantidad_sistema=int(cant_sis),
                            cantidad_fisica=int(cant_fis),
                            diferencia=int(diff),
                        )
                    )

                    # Actualizar Stock físico al conteo real
                    stk = stock_map.get(pid)
                    if stk:
                        stk.cantidad = int(cant_fis)
                        stk.updated_at = func.now()

                    db.add(
                        InventoryMovement(
                            company_id=CID,
                            warehouse_id=warehouse_id,
                            product_id=pid,
                            tipo="ajuste_positivo" if diff >= 0 else "ajuste_negativo",
                            cantidad=abs(int(diff)),
                            costo_unitario=stk.costo_unitario if stk else Decimal("0"),
                            referencia_type="inventory_adjustment",
                            referencia_id=adj.id,
                        )
                    )
                    adj_items_count += 1

                await _save_map(db, COMPANY_ID, "est_ajuste_estoque", 564, "inventory_adjustments", adj.id)
                log.info("Ajuste de carnicería #564 importado con %d cortes ajustados.", adj_items_count)

        # ── 5. SANEAMIENTO FORMAL DE NEGATIVOS RESIDUALES (OPCIONAL) ─────────────────
        if fix_negatives:
            neg_res_query = await db.execute(
                text("""
                    SELECT s.product_id, s.cantidad, s.costo_unitario, p.nombre, p.sku
                    FROM stock s
                    JOIN products p ON p.id = s.product_id
                    WHERE s.warehouse_id = :wid AND s.cantidad < 0
                    ORDER BY s.cantidad ASC
                """),
                {"wid": str(warehouse_id)},
            )
            neg_residuals = neg_res_query.fetchall()

            if neg_residuals:
                now_utc = datetime.now(timezone.utc)
                adj_corte = InventoryAdjustment(
                    company_id=COMPANY_ID,
                    warehouse_id=warehouse_id,
                    codigo=f"CORTE-{now_utc.strftime('%Y%m%d')}",
                    motivo="Corte emancipacion legacy",
                    estado="aprobado",
                    observaciones=(
                        "Ajuste formal de corte por transición a InteliMarket autoritativo. "
                        "Fija en cero los productos con déficit histórico (panadería/carnicería/insumos)."
                    ),
                    fecha_aprobacion=now_utc,
                )
                db.add(adj_corte)
                await db.flush()

                for r_neg in neg_residuals:
                    p_id, cant_neg, cost_u, p_nombre, p_sku = r_neg
                    diff = abs(cant_neg)

                    db.add(
                        InventoryAdjustmentItem(
                            adjustment_id=adj_corte.id,
                            product_id=p_id,
                            cantidad_sistema=cant_neg,
                            cantidad_fisica=0,
                            diferencia=diff,
                        )
                    )

                    stk = stock_map.get(p_id)
                    if stk:
                        stk.cantidad = 0
                        stk.updated_at = func.now()

                    db.add(
                        InventoryMovement(
                            company_id=CID,
                            warehouse_id=warehouse_id,
                            product_id=p_id,
                            tipo="ajuste_positivo",
                            cantidad=diff,
                            costo_unitario=cost_u or Decimal("0"),
                            referencia_type="inventory_adjustment",
                            referencia_id=adj_corte.id,
                        )
                    )

                log.info("Ajuste de corte formal aplicado a %d productos con stock negativo residual.", len(neg_residuals))

        # ── 6. AUDITORÍA FINAL ───────────────────────────────────────────────────────
        await db.flush()
        neg_final = await db.execute(
            text("SELECT count(*) FROM stock WHERE cantidad < 0")
        )
        total_neg_final = neg_final.scalar_one()
        log.info(
            "Productos con stock negativo FINAL: %d (reducción total: %d productos)",
            total_neg_final,
            total_neg_before - total_neg_final,
        )

        if dry_run:
            log.warning("MODO DRY-RUN: Se revierten todos los cambios (rollback).")
            await db.rollback()
        else:
            log.info("MODO PRODUCCIÓN: Confirmando cambios en la base de datos (commit)...")
            await db.commit()
            log.info("¡Reconciliación y emancipación completada con éxito!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--commit", action="store_true", help="Ejecutar y confirmar cambios en BD")
    parser.add_argument(
        "--fix-negatives",
        action="store_true",
        help="Ajustar formalmente a cero los negativos residuales mediante InventoryAdjustment auditado",
    )
    args = parser.parse_args()
    asyncio.run(run_reconciliation(dry_run=not args.commit, fix_negatives=args.fix_negatives))
