"""Pruebas de cobros sin doble aplicacion y stock sin negativos, contra un
Postgres REAL descartable (el bloqueo de filas no se puede probar con mocks).

Uso (en la VM):
    TEST_PG=postgresql+asyncpg://test@/im?host=/tmp&port=55432 \
        .venv/bin/python scripts/prueba_cobros_stock.py

La base tiene que ser una copia vacia del esquema (pg_dump -s). El script se
niega a correr si la URL no apunta al puerto 55432.
"""
import asyncio
import os
import sys
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace

URL = os.environ.get("TEST_PG", "")
if ":55432" not in URL and "port=55432" not in URL:
    sys.exit("TEST_PG debe apuntar al Postgres descartable (puerto 55432)")

from sqlalchemy import text  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine  # noqa: E402

import api.src.main  # noqa: E402,F401  registra todos los modelos

engine = create_async_engine(URL)
Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
CO = uuid.uuid4()
WH = uuid.uuid4()
WH2 = uuid.uuid4()


async def q(sql, **p):
    async with Session() as s:
        r = await s.execute(text(sql), p)
        await s.commit()
        try:
            return r.fetchall()
        except Exception:
            return None


async def setup():
    await q("INSERT INTO companies (id, ruc, razon_social, regimen_tributario, iva_condition) "
            "VALUES (:id, :ruc, 'Prueba', 'general', 'gravado')", id=CO, ruc=str(CO)[:15])
    for w in (WH, WH2):
        await q("INSERT INTO warehouses (id, company_id, nombre, codigo) VALUES (:id, :c, 'Dep', :cod)",
                id=w, c=CO, cod=str(w)[:8])


async def customer():
    cid = uuid.uuid4()
    await q("INSERT INTO customers (id, company_id, tipo_persona, razon_social) VALUES (:id, :c, 'fisica', 'Cli')",
            id=cid, c=CO)
    return cid


async def ar_doc(cid, saldo, sale_id=None):
    aid = uuid.uuid4()
    await q("INSERT INTO accounts_receivable (id, company_id, customer_id, sale_id, monto_original, saldo_pendiente, "
            "estado, fecha_emision, fecha_vencimiento) VALUES (:id, :c, :cu, :s, :m, :m, 'pendiente', CURRENT_DATE, CURRENT_DATE)",
            id=aid, c=CO, cu=cid, s=sale_id, m=saldo)
    return aid


async def product(tipo="producto"):
    pid = uuid.uuid4()
    await q("INSERT INTO products (id, company_id, sku, nombre, tipo) VALUES (:id, :c, :sku, 'Prod', :t)",
            id=pid, c=CO, sku=str(pid)[:12], t=tipo)
    return pid


async def stock(pid, cant, wh=WH):
    await q("INSERT INTO stock (id, product_id, warehouse_id, cantidad, cantidad_reservada) VALUES (:id, :p, :w, :n, 0)",
            id=uuid.uuid4(), p=pid, w=wh, n=cant)


async def cantidad(pid, wh=WH):
    r = await q("SELECT cantidad FROM stock WHERE product_id = :p AND warehouse_id = :w", p=pid, w=wh)
    return r[0][0] if r else None


async def espera_bloqueo(lock_sql, params, coro_fn):
    """Otra transaccion toma el lock; la operacion tiene que quedarse esperando."""
    async with Session() as x:
        await x.execute(text(lock_sql), params)
        task = asyncio.create_task(coro_fn())
        await asyncio.sleep(0.8)
        bloqueada = not task.done()
        await x.rollback()
    await task
    return bloqueada


async def _run(fn):
    async with Session() as s:
        r = await fn(s)
        await s.commit()
        return r


# ── Cobros ─────────────────────────────────────────────────────────────────

async def test_pago_cuenta_corriente_espera_bloqueo():
    from api.src.credit_accounts.service import process_payment
    from api.src.credit_accounts.schemas import CreditPayment
    cid = await customer()
    await q("INSERT INTO credit_accounts (id, company_id, customer_id, limite_credito, saldo_disponible, saldo_utilizado) "
            "VALUES (:id, :c, :cu, 500000, 400000, 100000)", id=uuid.uuid4(), c=CO, cu=cid)
    await ar_doc(cid, 100000)
    ok = await espera_bloqueo(
        "SELECT 1 FROM credit_accounts WHERE customer_id = :cu FOR UPDATE", {"cu": cid},
        lambda: _run(lambda s: process_payment(s, str(CO), str(cid), CreditPayment(monto=60000))))
    assert ok, "el pago no espero a la otra caja"


async def test_pago_cuenta_corriente_simultaneo_cuadra():
    from api.src.credit_accounts.service import process_payment
    from api.src.credit_accounts.schemas import CreditPayment
    cid = await customer()
    await q("INSERT INTO credit_accounts (id, company_id, customer_id, limite_credito, saldo_disponible, saldo_utilizado) "
            "VALUES (:id, :c, :cu, 500000, 400000, 100000)", id=uuid.uuid4(), c=CO, cu=cid)
    aid = await ar_doc(cid, 100000)
    await asyncio.gather(*[_run(lambda s: process_payment(s, str(CO), str(cid), CreditPayment(monto=60000)))
                           for _ in range(2)])
    (saldo_doc,), = await q("SELECT saldo_pendiente FROM accounts_receivable WHERE id = :id", id=aid)
    (usado,), = await q("SELECT saldo_utilizado FROM credit_accounts WHERE customer_id = :cu", cu=cid)
    (cobrado,), = await q("SELECT COALESCE(SUM(monto),0) FROM credit_movements WHERE customer_id = :cu", cu=cid)
    assert saldo_doc == 0 and usado == 0 and cobrado == 100000, (saldo_doc, usado, cobrado)


async def test_anticipo_espera_bloqueo():
    from api.src.credit_accounts.service import apply_advance
    cid = await customer()
    aid = await ar_doc(cid, 50000)
    adv = uuid.uuid4()
    await q("INSERT INTO customer_advances (id, company_id, customer_id, monto_total, monto_disponible, moneda) "
            "VALUES (:id, :c, :cu, 50000, 50000, 'PYG')", id=adv, c=CO, cu=cid)
    ok = await espera_bloqueo(
        "SELECT 1 FROM customer_advances WHERE id = :id FOR UPDATE", {"id": adv},
        lambda: _run(lambda s: apply_advance(s, str(CO), str(adv), str(aid), Decimal(30000), None)))
    assert ok, "el anticipo no espero a la otra caja"


async def test_anticipo_simultaneo_no_se_usa_dos_veces():
    from api.src.credit_accounts.service import apply_advance
    cid = await customer()
    a1, a2 = await ar_doc(cid, 50000), await ar_doc(cid, 50000)
    adv = uuid.uuid4()
    await q("INSERT INTO customer_advances (id, company_id, customer_id, monto_total, monto_disponible, moneda) "
            "VALUES (:id, :c, :cu, 50000, 50000, 'PYG')", id=adv, c=CO, cu=cid)
    res = await asyncio.gather(*[_run(lambda s, a=a: apply_advance(s, str(CO), str(adv), str(a), Decimal(40000), None))
                                 for a in (a1, a2)])
    (disp,), = await q("SELECT monto_disponible FROM customer_advances WHERE id = :id", id=adv)
    aplicados = sum(1 for r in res if r.get("success"))
    assert aplicados == 1 and disp == 10000, (res, disp)


async def test_recibo_repartido_no_repite_documento():
    from api.src.accounts_receivable.service import create_receivable_payment
    cid = await customer()
    aid = await ar_doc(cid, 100000)
    data = SimpleNamespace(
        customer_id=cid, monto_total=Decimal(120000), moneda="PYG", forma_pago="efectivo", referencia=None,
        fecha=None, observaciones=None,
        allocations=[SimpleNamespace(accounts_receivable_id=aid, monto=Decimal(60000))] * 2)
    r = await _run(lambda s: create_receivable_payment(s, str(CO), data, None))
    (saldo,), = await q("SELECT saldo_pendiente FROM accounts_receivable WHERE id = :id", id=aid)
    assert "error" in r and saldo == 100000, (r, saldo)


async def test_numero_de_recibo_no_se_repite():
    from api.src.accounts_receivable.service import create_receivable_payment
    cid = await customer()
    docs = [await ar_doc(cid, 10000) for _ in range(5)]

    def pago(aid):
        return SimpleNamespace(customer_id=cid, monto_total=Decimal(10000), moneda="PYG", forma_pago="efectivo",
                               referencia=None, fecha=None, observaciones=None,
                               allocations=[SimpleNamespace(accounts_receivable_id=aid, monto=Decimal(10000))])
    await asyncio.gather(*[_run(lambda s, a=a: create_receivable_payment(s, str(CO), pago(a), None)) for a in docs])
    nums = [r[0] for r in await q("SELECT numero_recibo FROM receivable_payments WHERE customer_id = :cu", cu=cid)]
    assert len(nums) == 5 and len(set(nums)) == 5, nums


async def _venta_credito(cid, total):
    sid = uuid.uuid4()
    await q("INSERT INTO sales (id, company_id, customer_id, numero, tipo_comprobante, condicion, moneda, estado, "
            "subtotal, total, total_pagado, saldo, tipo_cambio) VALUES (:id, :c, :cu, :n, 'factura', 'credito', 'PYG', "
            "'pendiente', :t, :t, 0, :t, 1)", id=sid, c=CO, cu=cid, n=str(sid)[:12], t=total)
    await ar_doc(cid, total, sale_id=sid)
    return sid


async def _metodo_pago():
    mid = uuid.uuid4()
    await q("INSERT INTO payment_methods (id, company_id, tipo, nombre) VALUES (:id, :c, 'efectivo', 'Efectivo')",
            id=mid, c=CO)
    return mid


async def test_cobro_de_factura_espera_bloqueo():
    from api.src.sales.service import add_payment
    from api.src.sales.schemas import SaleAddPayment
    cid = await customer()
    sid = await _venta_credito(cid, 100000)
    mid = await _metodo_pago()
    ok = await espera_bloqueo(
        "SELECT 1 FROM sales WHERE id = :id FOR UPDATE", {"id": sid},
        lambda: _run(lambda s: add_payment(s, str(sid), SaleAddPayment(payment_method_id=mid, monto=Decimal(40000)))))
    assert ok, "el cobro no espero a la otra caja"


async def test_cobro_de_factura_no_supera_el_saldo():
    from api.src.sales.service import add_payment
    from api.src.sales.schemas import SaleAddPayment
    cid = await customer()
    sid = await _venta_credito(cid, 100000)
    mid = await _metodo_pago()
    await asyncio.gather(*[_run(lambda s: add_payment(s, str(sid), SaleAddPayment(payment_method_id=mid, monto=Decimal(70000))))
                           for _ in range(2)], return_exceptions=True)
    (pagado, saldo), = await q("SELECT total_pagado, saldo FROM sales WHERE id = :id", id=sid)
    (cobros,), = await q("SELECT count(*) FROM payment_allocations WHERE sale_id = :id", id=sid)
    (saldo_ar,), = await q("SELECT saldo_pendiente FROM accounts_receivable WHERE sale_id = :id", id=sid)
    assert pagado == 70000 and saldo == 30000 and cobros == 1 and saldo_ar == 30000, (pagado, saldo, cobros, saldo_ar)


# ── Stock ──────────────────────────────────────────────────────────────────

def _venta(pid, n):
    data = SimpleNamespace(company_id=CO, warehouse_id=WH, user_id=None,
                           items=[SimpleNamespace(product_id=pid, variant_id=None, cantidad=n)])
    return SimpleNamespace(id=uuid.uuid4(), company_id=CO), data


async def test_venta_sin_stock_suficiente_se_bloquea():
    from api.src.sales.service import _deduct_stock_for_sale
    pid = await product()
    await stock(pid, 5)
    sale, data = _venta(pid, 6)
    try:
        await _run(lambda s: _deduct_stock_for_sale(s, sale, data))
        raise AssertionError("dejo vender 6 con 5 en stock")
    except ValueError:
        pass
    assert await cantidad(pid) == 5


async def test_venta_sin_fila_de_stock_se_bloquea():
    from api.src.sales.service import _deduct_stock_for_sale
    pid = await product()
    sale, data = _venta(pid, 1)
    try:
        await _run(lambda s: _deduct_stock_for_sale(s, sale, data))
        raise AssertionError("dejo vender sin stock cargado")
    except ValueError:
        pass
    assert await cantidad(pid) is None


async def test_venta_justa_deja_cero():
    from api.src.sales.service import _deduct_stock_for_sale
    pid = await product()
    await stock(pid, 5)
    sale, data = _venta(pid, 5)
    await _run(lambda s: _deduct_stock_for_sale(s, sale, data))
    assert await cantidad(pid) == 0


async def test_servicio_no_pide_stock():
    from api.src.sales.service import _deduct_stock_for_sale
    pid = await product("servicio")
    sale, data = _venta(pid, 1)
    await _run(lambda s: _deduct_stock_for_sale(s, sale, data))
    assert await cantidad(pid) is None


async def test_ventas_simultaneas_no_dejan_negativo():
    from api.src.sales.service import _deduct_stock_for_sale
    pid = await product()
    await stock(pid, 10)
    res = await asyncio.gather(*[_run(lambda s: _deduct_stock_for_sale(s, *_venta(pid, 6))) for _ in range(2)],
                               return_exceptions=True)
    assert await cantidad(pid) == 4, res
    assert sum(isinstance(r, ValueError) for r in res) == 1, res


async def _traspaso(pid, n):
    tid = uuid.uuid4()
    await q("INSERT INTO stock_transfers (id, company_id, codigo, warehouse_origen_id, warehouse_destino_id, estado) "
            "VALUES (:id, :c, :cod, :o, :d, 'pendiente')", id=tid, c=CO, cod=str(tid)[:10], o=WH, d=WH2)
    await q("INSERT INTO stock_transfer_items (id, transfer_id, product_id, cantidad_enviada) VALUES (:id, :t, :p, :n)",
            id=uuid.uuid4(), t=tid, p=pid, n=n)
    return tid


async def test_traspaso_sin_stock_en_origen_se_bloquea():
    from api.src.inventory.service import complete_transfer
    pid = await product()
    await stock(pid, 3)
    tid = await _traspaso(pid, 5)
    try:
        await _run(lambda s: complete_transfer(s, str(tid)))
        raise AssertionError("traspaso 5 con 3 en origen")
    except ValueError:
        pass
    assert await cantidad(pid) == 3 and await cantidad(pid, WH2) is None


async def test_traspaso_deja_salida_y_entrada():
    from api.src.inventory.service import complete_transfer
    pid = await product()
    await stock(pid, 8)
    tid = await _traspaso(pid, 5)
    await _run(lambda s: complete_transfer(s, str(tid)))
    movs = await q("SELECT warehouse_id, cantidad FROM inventory_movements WHERE product_id = :p ORDER BY cantidad", p=pid)
    assert await cantidad(pid) == 3 and await cantidad(pid, WH2) == 5
    assert [(m[0], m[1]) for m in movs] == [(WH, -5), (WH2, 5)], movs


async def test_inventorio_aplica_solo_la_diferencia():
    """Se contó 8 con 10 en sistema (falta 2); antes de aprobar se vendieron 3.
    Al aprobar el stock tiene que quedar 5, no 8."""
    from api.src.inventory.service import approve_adjustment_administracion
    pid = await product()
    await stock(pid, 7)  # 10 - 3 vendidos despues del conteo
    adj = uuid.uuid4()
    await q("INSERT INTO inventory_adjustments (id, company_id, warehouse_id, codigo, motivo, motivo_codigo, motivo_label, "
            "motivo_detalle, riesgo, estado) VALUES (:id, :c, :w, :cod, 'conteo', 'conteo_fisico', 'Conteo', 'x', 'bajo', "
            "'pendiente_administracion')", id=adj, c=CO, w=WH, cod=str(adj)[:10])
    await q("INSERT INTO inventory_adjustment_items (id, adjustment_id, product_id, cantidad_sistema, cantidad_fisica, "
            "diferencia) VALUES (:id, :a, :p, 10, 8, -2)", id=uuid.uuid4(), a=adj, p=pid)
    await _run(lambda s: approve_adjustment_administracion(s, str(adj), uuid.uuid4()))
    assert await cantidad(pid) == 5, await cantidad(pid)


async def main():
    await setup()
    only = sys.argv[1:]
    ok = fail = 0
    for name, fn in list(globals().items()):
        if name.startswith("test_") and (not only or name in only):
            try:
                await fn()
                ok += 1
                print("ok  ", name)
            except Exception as e:  # noqa: BLE001
                fail += 1
                print("FAIL", name, type(e).__name__, str(e)[:300])
    print(ok, "ok,", fail, "fail")
    await engine.dispose()
    sys.exit(1 if fail else 0)


asyncio.run(main())
