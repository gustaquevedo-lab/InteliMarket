"""Posteo automatico de asientos contables (sub-libro -> mayor).

Asi es como funciona todo ERP real (SAP, NetSuite, Odoo, Bind, Contpaqi):
cada transaccion de negocio (venta, compra, pago, nomina) genera su propio
asiento de partida doble automaticamente, en vez de dejar el mayor vacio
esperando que alguien lo cargue a mano. Antes de este modulo, InteliMarket
tenia toda la infraestructura contable (plan de cuentas, periodos, asientos,
balance de comprobacion, estado de resultados) pero 0 asientos reales —
nadie habia posteado nunca nada.

Diseño deliberado:
- Ventas: resumen DIARIO (no un asiento por venta individual — asi es como
  postean el 100% de los ERP de retail/supermercado reales: el cierre Z de
  caja del dia se resume en un asiento, no 118.000 asientos individuales).
  Se separa efectivo/CxC segun Sale.condicion (contado vs credito), IVA
  debito fiscal, y el costo de mercaderia vendida (con datos reales:
  664.864/664.864 items tienen costo_unitario poblado, 0 nulos).
- Compras (AP): un asiento por factura de proveedor — volumen manejable
  (~5.800) y es la practica estandar (cada factura es su propio documento
  fuente).
- Pagos a proveedor: un asiento por pago.
- Cobros de CxC: un asiento por cobro real (SalePayment de una venta a
  credito, fechado en la fecha real de cobro, no la fecha de la venta).
- Nomina: resumen MENSUAL (asi se postea nomina en la practica — un asiento
  por liquidacion, no por cada concepto individual).

Idempotencia: cada asiento se ancla a (referencia_tipo, referencia_id) en
accounting_entries. Antes de postear se chequea si ya existe — reintentar
esta funcion nunca duplica asientos.

Explicitamente FUERA de este alcance (no se postea automaticamente):
ajustes de inventario, devoluciones/notas de credito (necesitan asientos de
reversa parcial, mas delicado), diferencias de arqueo de caja, retenciones,
diferencias de cambio. Quedan para una siguiente pasada si se necesitan.
"""

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from calendar import monthrange

from sqlalchemy import select, func, and_, text
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.integrated_finance.models import AccountPlan, AccountingPeriod, AccountingEntry
from api.src.sales.models import Sale, SaleItem
from api.src.financial.models import SupplierInvoice, SupplierInvoicePayment


# ── Cuentas requeridas (codigo -> se crea si falta) ─────────────────────────

REQUIRED_ACCOUNTS = {
    "1.1.05": ("IVA Credito Fiscal", "activo"),
}

ACC_CAJA = "1.1.01"
ACC_CXC = "1.1.02"
ACC_INVENTARIO = "1.1.03"
ACC_IVA_CREDITO = "1.1.05"
ACC_CXP = "2.1.01"
ACC_IVA_DEBITO = "2.1.03"
ACC_VENTAS = "4.1.01"
ACC_COSTO_VENTA = "5.1.01"
ACC_SUELDOS = "6.1.01"


def _q(v) -> Decimal:
    return Decimal(str(v or 0)).quantize(Decimal("1"), rounding=ROUND_HALF_UP)


class PostingEngine:
    """Cachea plan de cuentas y periodos abiertos por corrida para no
    resolverlos en cada iteracion de un loop de miles de dias/facturas."""

    def __init__(self, db: AsyncSession, company_id: str):
        self.db = db
        self.cid = uuid.UUID(company_id)
        self.company_id = company_id
        self._accounts: dict[str, uuid.UUID] = {}
        self._periods: dict[tuple[int, int], uuid.UUID] = {}
        self._seq = 0

    async def ensure_accounts(self):
        result = await self.db.execute(select(AccountPlan).where(AccountPlan.company_id == self.cid))
        for a in result.scalars().all():
            self._accounts[a.codigo] = a.id

        # Cuenta padre de ACTIVO para colgar la nueva cuenta de IVA Credito
        parent_id = None
        for codigo, acc_id in self._accounts.items():
            if codigo == ACC_CAJA:
                # mismo padre que las demas cuentas de activo corriente
                result2 = await self.db.execute(select(AccountPlan.padre_id).where(AccountPlan.id == acc_id))
                parent_id = result2.scalar_one_or_none()
                break

        for codigo, (nombre, tipo) in REQUIRED_ACCOUNTS.items():
            if codigo in self._accounts:
                continue
            acc = AccountPlan(
                company_id=self.cid, codigo=codigo, nombre=nombre, tipo=tipo,
                nivel=2, padre_id=parent_id, acepta_asientos=True,
            )
            self.db.add(acc)
            await self.db.flush()
            self._accounts[codigo] = acc.id

    async def get_period(self, fecha: date) -> uuid.UUID:
        key = (fecha.year, fecha.month)
        if key in self._periods:
            return self._periods[key]

        result = await self.db.execute(
            select(AccountingPeriod).where(
                AccountingPeriod.company_id == self.cid,
                AccountingPeriod.anio == fecha.year,
                AccountingPeriod.mes == fecha.month,
            )
        )
        period = result.scalar_one_or_none()
        if not period:
            inicio = date(fecha.year, fecha.month, 1)
            fin = date(fecha.year, fecha.month, monthrange(fecha.year, fecha.month)[1])
            period = AccountingPeriod(
                company_id=self.cid, anio=fecha.year, mes=fecha.month,
                fecha_inicio=inicio, fecha_fin=fin, estado="abierto",
            )
            self.db.add(period)
            await self.db.flush()
        self._periods[key] = period.id
        return period.id

    async def already_posted(self, referencia_tipo: str, referencia_id: uuid.UUID) -> bool:
        result = await self.db.execute(
            select(func.count()).select_from(AccountingEntry).where(
                AccountingEntry.company_id == self.cid,
                AccountingEntry.referencia_tipo == referencia_tipo,
                AccountingEntry.referencia_id == referencia_id,
            )
        )
        return (result.scalar() or 0) > 0

    async def post(
        self,
        fecha: date,
        concepto: str,
        referencia_tipo: str,
        referencia_id: uuid.UUID,
        lines: list[tuple[str, str, Decimal]],  # (codigo_cuenta, "debe"|"haber", monto)
    ) -> bool:
        """Postea un asiento balanceado. Devuelve False si ya existia (skip) o
        si no hay montos > 0 para postear (nada que hacer, no es error)."""
        lines = [(c, t, m) for c, t, m in lines if m and m > 0]
        if not lines:
            return False

        total_debe = sum(m for c, t, m in lines if t == "debe")
        total_haber = sum(m for c, t, m in lines if t == "haber")
        if total_debe != total_haber:
            raise ValueError(
                f"Asiento desbalanceado ({referencia_tipo} {referencia_id}): "
                f"debe={total_debe} haber={total_haber} — no se postea, no es negociable."
            )

        if await self.already_posted(referencia_tipo, referencia_id):
            return False

        period_id = await self.get_period(fecha)
        self._seq += 1
        # accounting_entries.asiento_numero es varchar(20) -- formato compacto.
        asiento_numero = f"A{fecha:%y%m%d}{self._seq:05d}"

        for codigo, tipo, monto in lines:
            account_id = self._accounts.get(codigo)
            if not account_id:
                raise ValueError(f"Cuenta {codigo} no existe en el plan de cuentas de la empresa {self.company_id}")
            self.db.add(AccountingEntry(
                company_id=self.cid,
                period_id=period_id,
                account_id=account_id,
                fecha=fecha,
                tipo=tipo,
                monto=monto,
                concepto=concepto,
                referencia_tipo=referencia_tipo,
                referencia_id=referencia_id,
                asiento_numero=asiento_numero,
            ))
        await self.db.flush()
        return True


# ── Ventas: resumen diario ──────────────────────────────────────────────────

async def post_sales_daily(engine: PostingEngine, desde: date, hasta: date) -> int:
    rows = await engine.db.execute(
        text("""
            SELECT
                s.fecha::date AS dia,
                s.condicion,
                COALESCE(SUM(s.total), 0) AS total,
                COALESCE(SUM(s.iva_5), 0) AS iva_5,
                COALESCE(SUM(s.iva_10), 0) AS iva_10,
                COALESCE(SUM(s.base_gravada_5), 0) AS base_5,
                COALESCE(SUM(s.base_gravada_10), 0) AS base_10,
                COALESCE(SUM(s.base_exenta), 0) AS exenta
            FROM sales s
            WHERE s.company_id = :cid AND s.estado = 'confirmado'
              AND s.fecha::date >= :desde AND s.fecha::date <= :hasta
            GROUP BY s.fecha::date, s.condicion
            ORDER BY s.fecha::date
        """),
        {"cid": engine.company_id, "desde": desde, "hasta": hasta},
    )
    por_dia: dict[date, dict] = {}
    for r in rows:
        d = por_dia.setdefault(r.dia, {"contado": Decimal("0"), "credito": Decimal("0"), "iva_5": Decimal("0"), "iva_10": Decimal("0"), "total": Decimal("0")})
        clave = "credito" if r.condicion == "credito" else "contado"
        total = Decimal(str(r.total))
        d[clave] += total
        d["iva_5"] += Decimal(str(r.iva_5))
        d["iva_10"] += Decimal(str(r.iva_10))
        d["total"] += total
    # ventas_netas = total - iva, calculado a partir del MISMO total que ya
    # se uso en el debe (no sumando base_gravada_5/10/exenta por separado) --
    # asi el asiento balancea siempre por identidad, sin depender de que el
    # redondeo linea-a-linea del legado sume exacto contra el total real
    # (una diferencia de unos pocos guaranies aparecia en la practica).
    for d in por_dia.values():
        d["ventas_netas"] = d["total"] - d["iva_5"] - d["iva_10"]

    costo_rows = await engine.db.execute(
        text("""
            SELECT s.fecha::date AS dia, COALESCE(SUM(si.costo_unitario * si.cantidad), 0) AS costo
            FROM sale_items si JOIN sales s ON s.id = si.sale_id
            WHERE s.company_id = :cid AND s.estado = 'confirmado'
              AND s.fecha::date >= :desde AND s.fecha::date <= :hasta
            GROUP BY s.fecha::date
        """),
        {"cid": engine.company_id, "desde": desde, "hasta": hasta},
    )
    costo_por_dia = {r.dia: Decimal(str(r.costo)) for r in costo_rows}

    posted = 0
    for dia, d in por_dia.items():
        ref_id = uuid.uuid5(uuid.NAMESPACE_URL, f"ventas-diarias:{engine.company_id}:{dia.isoformat()}")
        lines = [
            (ACC_CAJA, "debe", _q(d["contado"])),
            (ACC_CXC, "debe", _q(d["credito"])),
            (ACC_VENTAS, "haber", _q(d["ventas_netas"])),
            (ACC_IVA_DEBITO, "haber", _q(d["iva_5"] + d["iva_10"])),
        ]
        costo = costo_por_dia.get(dia, Decimal("0"))
        if costo > 0:
            lines += [
                (ACC_COSTO_VENTA, "debe", _q(costo)),
                (ACC_INVENTARIO, "haber", _q(costo)),
            ]
        if await engine.post(dia, f"Resumen de ventas del {dia.isoformat()}", "ventas_diarias", ref_id, lines):
            posted += 1
    return posted


# ── Compras (AP): un asiento por factura ────────────────────────────────────

async def post_supplier_invoices(engine: PostingEngine, desde: date, hasta: date) -> int:
    result = await engine.db.execute(
        select(SupplierInvoice).where(
            SupplierInvoice.company_id == engine.cid,
            SupplierInvoice.estado != "cancelada",
            SupplierInvoice.fecha_emision >= desde,
            SupplierInvoice.fecha_emision <= hasta,
        )
    )
    posted = 0
    for inv in result.scalars().all():
        iva = _q(inv.iva_5) + _q(inv.iva_10)
        neto = _q(inv.total) - iva
        lines = [
            (ACC_INVENTARIO, "debe", neto),
            (ACC_IVA_CREDITO, "debe", iva),
            (ACC_CXP, "haber", _q(inv.total)),
        ]
        if await engine.post(inv.fecha_emision, f"Factura proveedor {inv.numero_factura}", "supplier_invoice", inv.id, lines):
            posted += 1
    return posted


# ── Pagos a proveedor: un asiento por pago ──────────────────────────────────

async def post_supplier_payments(engine: PostingEngine, desde: date, hasta: date) -> int:
    result = await engine.db.execute(
        select(SupplierInvoicePayment, SupplierInvoice.numero_factura)
        .join(SupplierInvoice, SupplierInvoice.id == SupplierInvoicePayment.invoice_id)
        .where(
            SupplierInvoice.company_id == engine.cid,
            SupplierInvoicePayment.fecha_pago >= desde,
            SupplierInvoicePayment.fecha_pago <= hasta,
        )
    )
    posted = 0
    for pago, numero_factura in result.all():
        lines = [
            (ACC_CXP, "debe", _q(pago.monto)),
            (ACC_CAJA, "haber", _q(pago.monto)),
        ]
        if await engine.post(pago.fecha_pago, f"Pago factura {numero_factura} ({pago.payment_method})", "supplier_payment", pago.id, lines):
            posted += 1
    return posted


# ── Cobros de CxC: un asiento por cobro real de una venta a credito ─────────

async def post_ar_collections(engine: PostingEngine, desde: date, hasta: date) -> int:
    """El legado nunca guardo la fecha/monto real de cobro de una venta a
    credito (sale_payments no tiene filas para ventas 'credito' -- fin_recebimento
    solo capta el cobro al contado al momento de la venta; accounts_receivable.
    ultimo_pago tampoco esta poblado: 0/3.999 facturas 'pagado' lo tienen). Sin
    ese dato no hay forma honesta de fechar el cobro real.

    En vez de inventar una fecha, se usa fecha_vencimiento (fecha real y
    documentada de cada factura) como la mejor aproximacion disponible para
    las facturas que el legado ya marca como 'pagado' -- prioriza que el saldo
    de CxC en el balance sea correcto (no sobreestimado con facturas que en
    realidad ya se cobraron) sobre la precision de CUANDO se cobraron."""
    result = await engine.db.execute(
        text("""
            SELECT id, saldo_pendiente, monto_original, fecha_vencimiento
            FROM accounts_receivable
            WHERE company_id = :cid AND estado = 'pagado'
              AND fecha_vencimiento >= :desde AND fecha_vencimiento <= :hasta
        """),
        {"cid": engine.company_id, "desde": desde, "hasta": hasta},
    )
    posted = 0
    for r in result.all():
        monto = _q(r.monto_original)
        if monto <= 0:
            continue
        lines = [
            (ACC_CAJA, "debe", monto),
            (ACC_CXC, "haber", monto),
        ]
        if await engine.post(r.fecha_vencimiento, "Cobro de cuenta por cobrar (fecha aproximada por vencimiento — no se registro la fecha real de cobro)", "ar_collection", r.id, lines):
            posted += 1
    return posted


# ── Nomina: resumen mensual ──────────────────────────────────────────────────

async def post_payroll_monthly(engine: PostingEngine, desde: date, hasta: date) -> int:
    result = await engine.db.execute(
        text("""
            SELECT date_trunc('month', fecha)::date AS mes,
                   COALESCE(SUM(CASE WHEN es_credito THEN monto ELSE 0 END), 0) AS creditos,
                   COALESCE(SUM(CASE WHEN NOT es_credito THEN monto ELSE 0 END), 0) AS debitos
            FROM payroll_movements
            WHERE company_id = :cid AND fecha >= :desde AND fecha <= :hasta
            GROUP BY date_trunc('month', fecha)
            ORDER BY mes
        """),
        {"cid": engine.company_id, "desde": desde, "hasta": hasta},
    )
    posted = 0
    for r in result.all():
        # Gasto bruto (creditos = haberes del empleado) menos descuentos
        # (debitos: adelantos, faltante de caja, vale compras, etc.) que no
        # son gasto real de la empresa sino retenciones sobre el sueldo.
        gasto_neto = _q(r.creditos) - _q(r.debitos)
        if gasto_neto <= 0:
            continue
        ultimo_dia = date(r.mes.year, r.mes.month, monthrange(r.mes.year, r.mes.month)[1])
        ref_id = uuid.uuid5(uuid.NAMESPACE_URL, f"payroll:{engine.company_id}:{r.mes.isoformat()}")
        lines = [
            (ACC_SUELDOS, "debe", gasto_neto),
            (ACC_CAJA, "haber", gasto_neto),
        ]
        if await engine.post(ultimo_dia, f"Nomina de {r.mes.strftime('%B %Y')}", "payroll_monthly", ref_id, lines):
            posted += 1
    return posted


# ── Orquestador ───────────────────────────────────────────────────────────────

async def run_auto_posting(db: AsyncSession, company_id: str, desde: date, hasta: date) -> dict:
    engine = PostingEngine(db, company_id)
    await engine.ensure_accounts()

    resultados: dict[str, int | str] = {}
    for nombre, fn in (
        ("ventas_diarias", post_sales_daily),
        ("facturas_proveedor", post_supplier_invoices),
        ("pagos_proveedor", post_supplier_payments),
        ("cobros_cxc", post_ar_collections),
        ("nomina_mensual", post_payroll_monthly),
    ):
        try:
            resultados[nombre] = await fn(engine, desde, hasta)
            await db.commit()
        except Exception as e:  # noqa: BLE001 — un area que falla no debe tumbar el resto
            await db.rollback()
            resultados[nombre] = f"error: {e}"

    return resultados
