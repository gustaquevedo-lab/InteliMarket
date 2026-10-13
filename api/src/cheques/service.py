import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import select, func as sa_func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.cheques.models import Cheque, ChequeHistorial
from api.src.cheques.schemas import ChequeCreate, TRANSICIONES_VALIDAS


async def create_cheque(db: AsyncSession, company_id: str, data: ChequeCreate, user_id: str | None, user_nombre: str | None) -> Cheque:
    cheque = Cheque(
        company_id=uuid.UUID(company_id),
        numero=data.numero,
        banco_emisor=data.banco_emisor,
        bank_account_id=data.bank_account_id,
        beneficiario=data.beneficiario,
        supplier_id=data.supplier_id,
        monto=data.monto,
        moneda=data.moneda,
        fecha_emision=data.fecha_emision,
        fecha_entrega=data.fecha_entrega,
        fecha_pago=data.fecha_pago or data.fecha_emision,
        diferido=data.diferido,
        estado="pendiente",
        invoice_payment_id=data.invoice_payment_id,
        concepto=data.concepto,
        notas=data.notas,
        created_by=uuid.UUID(user_id) if user_id else None,
    )
    db.add(cheque)
    await db.flush()
    await db.refresh(cheque)

    db.add(ChequeHistorial(
        cheque_id=cheque.id,
        estado_anterior=None,
        estado_nuevo="pendiente",
        user_id=uuid.UUID(user_id) if user_id else None,
        user_nombre=user_nombre,
        notas="Cheque emitido",
    ))
    await db.flush()
    return cheque


async def create_cheque_from_legacy_payment(
    db: AsyncSession, company_id: str, *, numero: str, numero_confiable: bool,
    beneficiario: str, supplier_id: str | None, monto: Decimal, fecha_emision: date,
    fecha_pago: date | None, bank_account_id: str | None, invoice_payment_id: str,
    estado: str, concepto: str | None, notas: str,
) -> Cheque:
    """Crea un cheque a partir de un pago ya ejecutado en el pasado (backfill
    historico desde supplier_invoice_payments, o el sync legado marcando un
    pago con cheque recien llegado) -- a diferencia de create_cheque, no
    fuerza estado='pendiente': el dinero de estos cheques ya se movio, asi
    que el estado real (tipicamente 'cobrado') se pasa explicito."""
    banco_emisor = None
    if bank_account_id:
        from api.src.financial.models import BankAccount
        acct_result = await db.execute(select(BankAccount.banco).where(BankAccount.id == uuid.UUID(bank_account_id)))
        banco_emisor = acct_result.scalar_one_or_none()

    cheque = Cheque(
        company_id=uuid.UUID(company_id),
        numero=numero,
        numero_confiable=numero_confiable,
        banco_emisor=banco_emisor,
        bank_account_id=uuid.UUID(bank_account_id) if bank_account_id else None,
        beneficiario=beneficiario,
        supplier_id=uuid.UUID(supplier_id) if supplier_id else None,
        monto=monto,
        moneda="PYG",
        fecha_emision=fecha_emision,
        fecha_pago=fecha_pago or fecha_emision,
        diferido=False,
        estado=estado,
        invoice_payment_id=uuid.UUID(invoice_payment_id),
        concepto=concepto,
        notas=notas,
    )
    db.add(cheque)
    await db.flush()
    await db.refresh(cheque)

    db.add(ChequeHistorial(
        cheque_id=cheque.id,
        estado_anterior=None,
        estado_nuevo=estado,
        user_id=None,
        user_nombre="Sistema (migración histórica)",
        notas=notas,
    ))
    await db.flush()
    return cheque


async def get_cheque(db: AsyncSession, cheque_id: str) -> Cheque | None:
    result = await db.execute(select(Cheque).where(Cheque.id == uuid.UUID(cheque_id)))
    return result.scalar_one_or_none()


async def list_cheques(
    db: AsyncSession, company_id: str,
    estado: str | None = None, supplier_id: str | None = None,
    vencidos: bool | None = None, fecha_desde: date | None = None, fecha_hasta: date | None = None,
    bank_account_id: str | None = None, search: str | None = None,
    limit: int = 100, offset: int = 0,
) -> list[dict]:
    today = date.today()
    query = select(Cheque).where(Cheque.company_id == uuid.UUID(company_id))
    if estado == "por_cobrar":
        # Emitidos pero todavia no cobrados por el proveedor en el banco --
        # "pendiente" (recien registrado) o "entregado" (ya en manos del
        # proveedor) son los dos estados donde el cheque sigue afectando
        # nuestro saldo bancario disponible sin haberse hecho efectivo aun.
        query = query.where(Cheque.estado.in_(["pendiente", "entregado"]))
    elif estado:
        query = query.where(Cheque.estado == estado)
    if supplier_id:
        query = query.where(Cheque.supplier_id == uuid.UUID(supplier_id))
    if bank_account_id:
        query = query.where(Cheque.bank_account_id == uuid.UUID(bank_account_id))
    if vencidos:
        query = query.where(Cheque.estado.in_(["pendiente", "entregado"]), Cheque.fecha_pago < today)
    if fecha_desde:
        query = query.where(Cheque.fecha_emision >= fecha_desde)
    if fecha_hasta:
        query = query.where(Cheque.fecha_emision <= fecha_hasta)
    if search:
        s = f"%{search.strip()}%"
        query = query.where(
            or_(
                Cheque.numero.ilike(s),
                Cheque.beneficiario.ilike(s),
                Cheque.banco_emisor.ilike(s),
                Cheque.concepto.ilike(s),
            )
        )
    query = query.order_by(Cheque.fecha_pago.desc().nulls_last()).limit(limit).offset(offset)
    result = await db.execute(query)
    cheques = list(result.scalars().all())
    return await _enrich_with_supplier_names(db, cheques)


async def _enrich_with_supplier_names(db: AsyncSession, cheques: list[Cheque]) -> list[dict]:
    from api.src.purchases.models import Supplier
    supplier_ids = {c.supplier_id for c in cheques if c.supplier_id}
    names = {}
    if supplier_ids:
        r = await db.execute(select(Supplier.id, Supplier.razon_social).where(Supplier.id.in_(supplier_ids)))
        names = {row.id: row.razon_social for row in r.all()}

    today = date.today()
    out = []
    for c in cheques:
        dias = (c.fecha_pago - today).days if c.fecha_pago else None
        out.append({
            "id": c.id, "company_id": c.company_id, "numero": c.numero,
            "numero_confiable": c.numero_confiable,
            "banco_emisor": c.banco_emisor, "bank_account_id": c.bank_account_id,
            "beneficiario": c.beneficiario, "supplier_id": c.supplier_id,
            "supplier_nombre": names.get(c.supplier_id) if c.supplier_id else None,
            "monto": float(c.monto), "moneda": c.moneda, "fecha_emision": c.fecha_emision,
            "fecha_entrega": c.fecha_entrega,
            "fecha_pago": c.fecha_pago, "diferido": c.diferido, "estado": c.estado,
            "invoice_payment_id": c.invoice_payment_id, "concepto": c.concepto,
            "notas": c.notas, "dias_para_vencer": dias,
            "created_at": c.created_at, "updated_at": c.updated_at,
        })
    return out


async def update_estado(db: AsyncSession, cheque_id: str, nuevo_estado: str, notas: str | None, user_id: str | None, user_nombre: str | None) -> Cheque:
    cheque = await get_cheque(db, cheque_id)
    if not cheque:
        raise ValueError("Cheque no encontrado")
    permitidos = TRANSICIONES_VALIDAS.get(cheque.estado, set())
    if nuevo_estado not in permitidos:
        raise ValueError(f"No se puede pasar de '{cheque.estado}' a '{nuevo_estado}'")

    estado_anterior = cheque.estado
    cheque.estado = nuevo_estado
    cheque.estado_updated_by = uuid.UUID(user_id) if user_id else None
    cheque.estado_updated_at = datetime.now(timezone.utc)
    await db.flush()

    db.add(ChequeHistorial(
        cheque_id=cheque.id,
        estado_anterior=estado_anterior,
        estado_nuevo=nuevo_estado,
        user_id=uuid.UUID(user_id) if user_id else None,
        user_nombre=user_nombre,
        notas=notas,
    ))
    await db.flush()
    await db.refresh(cheque)
    return cheque


async def get_historial(db: AsyncSession, cheque_id: str) -> list[ChequeHistorial]:
    result = await db.execute(
        select(ChequeHistorial).where(ChequeHistorial.cheque_id == uuid.UUID(cheque_id)).order_by(ChequeHistorial.created_at.asc())
    )
    return list(result.scalars().all())


async def get_dashboard(db: AsyncSession, company_id: str) -> dict:
    today = date.today()
    cid = uuid.UUID(company_id)

    cartera_r = await db.execute(
        select(sa_func.count(Cheque.id), sa_func.coalesce(sa_func.sum(Cheque.monto), 0))
        .where(Cheque.company_id == cid, Cheque.estado.in_(["pendiente", "entregado"]))
    )
    cant_cartera, total_cartera = cartera_r.one()

    vencidos_r = await db.execute(
        select(sa_func.count(Cheque.id), sa_func.coalesce(sa_func.sum(Cheque.monto), 0))
        .where(Cheque.company_id == cid, Cheque.estado.in_(["pendiente", "entregado"]), Cheque.fecha_pago < today)
    )
    cant_vencidos, total_vencidos = vencidos_r.one()

    from datetime import timedelta

    hoy_r = await db.execute(
        select(sa_func.count(Cheque.id), sa_func.coalesce(sa_func.sum(Cheque.monto), 0))
        .where(Cheque.company_id == cid, Cheque.estado.in_(["pendiente", "entregado"]), Cheque.fecha_pago == today)
    )
    cant_hoy, total_hoy = hoy_r.one()

    por_vencer_r = await db.execute(
        select(sa_func.count(Cheque.id), sa_func.coalesce(sa_func.sum(Cheque.monto), 0))
        .where(Cheque.company_id == cid, Cheque.estado.in_(["pendiente", "entregado"]),
               Cheque.fecha_pago >= today, Cheque.fecha_pago <= today + timedelta(days=7))
    )
    cant_por_vencer, total_por_vencer = por_vencer_r.one()

    por_vencer_30_r = await db.execute(
        select(sa_func.count(Cheque.id), sa_func.coalesce(sa_func.sum(Cheque.monto), 0))
        .where(Cheque.company_id == cid, Cheque.estado.in_(["pendiente", "entregado"]),
               Cheque.fecha_pago >= today, Cheque.fecha_pago <= today + timedelta(days=30))
    )
    cant_por_vencer_30, total_por_vencer_30 = por_vencer_30_r.one()

    rechazados_r = await db.execute(
        select(sa_func.count(Cheque.id), sa_func.coalesce(sa_func.sum(Cheque.monto), 0))
        .where(Cheque.company_id == cid, Cheque.estado == "rechazado")
    )
    cant_rechazados, total_rechazados = rechazados_r.one()

    month_start = today.replace(day=1)
    cobrados_r = await db.execute(
        select(sa_func.count(Cheque.id), sa_func.coalesce(sa_func.sum(Cheque.monto), 0))
        .where(Cheque.company_id == cid, Cheque.estado == "cobrado", Cheque.estado_updated_at >= month_start)
    )
    cant_cobrados, total_cobrados = cobrados_r.one()

    return {
        "total_cartera": total_cartera, "cantidad_cartera": cant_cartera,
        "vencidos_sin_cobrar": total_vencidos, "cantidad_vencidos": cant_vencidos,
        "vence_hoy": total_hoy, "cantidad_vence_hoy": cant_hoy,
        "por_vencer_7d": total_por_vencer, "cantidad_por_vencer_7d": cant_por_vencer,
        "por_vencer_30d": total_por_vencer_30, "cantidad_por_vencer_30d": cant_por_vencer_30,
        "rechazados_monto": total_rechazados, "cantidad_rechazados": cant_rechazados,
        "cobrados_mes": total_cobrados, "cantidad_cobrados_mes": cant_cobrados,
    }
