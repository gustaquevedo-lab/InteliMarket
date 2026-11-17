import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import select, func as sa_func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.cheques.models import Cheque, ChequeHistorial
from api.src.cheques.schemas import ChequeCreate, ChequeUpdate, TRANSICIONES_VALIDAS


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
        tipo_val = getattr(c, "tipo_cheque", None) or ("emitido" if (c.bank_account_id or c.supplier_id) else "recibido")
        out.append({
            "id": c.id, "company_id": c.company_id, "numero": c.numero,
            "numero_confiable": c.numero_confiable,
            "banco_emisor": c.banco_emisor, "bank_account_id": c.bank_account_id,
            "beneficiario": c.beneficiario, "supplier_id": c.supplier_id,
            "supplier_nombre": names.get(c.supplier_id) if c.supplier_id else None,
            "monto": float(c.monto), "moneda": c.moneda, "fecha_emision": c.fecha_emision,
            "fecha_entrega": c.fecha_entrega,
            "fecha_pago": c.fecha_pago, "diferido": c.diferido, "estado": c.estado,
            "tipo": tipo_val,
            "invoice_payment_id": c.invoice_payment_id, "concepto": c.concepto,
            "notas": c.notas, "dias_para_vencer": dias,
            "created_at": c.created_at, "updated_at": c.updated_at,
        })
    return out


async def _sync_cheque_bancario(
    db: AsyncSession,
    cheque: Cheque,
    estado_anterior: str,
    nuevo_estado: str,
    target_bank_account_id: uuid.UUID | str | None = None,
) -> None:
    """Sincroniza atómicamente el estado del cheque emitido con el módulo de Cuentas Bancarias.
    1. Al pasar a 'cobrado': crea el débito en bank_transactions y resta bank_accounts.saldo_actual.
    2. Al revertir de 'cobrado' a otro estado: elimina el débito y restituye bank_accounts.saldo_actual."""
    ba_id = target_bank_account_id or cheque.bank_account_id
    if not ba_id:
        return
    if isinstance(ba_id, str):
        ba_id = uuid.UUID(ba_id)

    from api.src.financial.models import BankAccount, BankTransaction

    # Transición 1: Cheque compensado / cobrado en banco
    if nuevo_estado == "cobrado" and estado_anterior != "cobrado":
        # Validar si ya existe un débito para este cheque (idempotencia)
        tx_existente = await db.execute(
            select(BankTransaction).where(
                BankTransaction.cheque_id == cheque.id,
                BankTransaction.tipo.in_(["debito", "egreso"]),
            )
        )
        if not tx_existente.scalars().first():
            bank_acc = await db.get(BankAccount, ba_id)
            if bank_acc:
                f_pago = cheque.fecha_pago or cheque.fecha_emision or date.today()
                beneficiario_txt = cheque.beneficiario or "PROVEEDOR"
                tx = BankTransaction(
                    company_id=cheque.company_id,
                    bank_account_id=bank_acc.id,
                    fecha=f_pago,
                    tipo="debito",
                    monto=Decimal(str(cheque.monto)),
                    moneda=cheque.moneda or bank_acc.moneda or "PYG",
                    descripcion=f"PAGO A {beneficiario_txt} (Clearing Cheque #{cheque.numero})",
                    referencia=str(cheque.numero),
                    contraparte=beneficiario_txt,
                    categoria="pago_cheque",
                    cheque_id=cheque.id,
                    conciliado=True,
                    fecha_conciliacion=datetime.now(timezone.utc),
                )
                db.add(tx)
                bank_acc.saldo_actual = (bank_acc.saldo_actual or Decimal("0")) - Decimal(str(cheque.monto))
                db.add(bank_acc)

    # Transición 2: Reversión (desmarcar de cobrado a pendiente/entregado/anulado/etc)
    elif estado_anterior == "cobrado" and nuevo_estado != "cobrado":
        tx_res = await db.execute(
            select(BankTransaction).where(
                BankTransaction.cheque_id == cheque.id,
                BankTransaction.tipo.in_(["debito", "egreso"]),
            )
        )
        for tx in tx_res.scalars().all():
            bank_acc = await db.get(BankAccount, tx.bank_account_id)
            if bank_acc:
                bank_acc.saldo_actual = (bank_acc.saldo_actual or Decimal("0")) + Decimal(str(tx.monto))
                db.add(bank_acc)
            await db.delete(tx)


async def update_cheque(
    db: AsyncSession,
    cheque_id: str,
    data: ChequeUpdate,
    user_id: str | None,
    user_nombre: str | None,
) -> Cheque:
    cheque = await get_cheque(db, cheque_id)
    if not cheque:
        raise ValueError("Cheque no encontrado")

    cambios = []
    if data.numero is not None and data.numero.strip() != cheque.numero:
        cambios.append(f"Número: {cheque.numero} -> {data.numero.strip()}")
        cheque.numero = data.numero.strip()
    if data.banco_emisor is not None and data.banco_emisor != cheque.banco_emisor:
        cambios.append(f"Banco: {cheque.banco_emisor} -> {data.banco_emisor}")
        cheque.banco_emisor = data.banco_emisor
    if data.bank_account_id is not None and data.bank_account_id != cheque.bank_account_id:
        from api.src.financial.models import BankAccount
        bank_acc = await db.get(BankAccount, data.bank_account_id)
        if bank_acc and not data.banco_emisor:
            cheque.banco_emisor = bank_acc.banco or cheque.banco_emisor
        cambios.append("Cuenta bancaria actualizada")
        cheque.bank_account_id = data.bank_account_id
    if data.beneficiario is not None and data.beneficiario.strip() != cheque.beneficiario:
        cambios.append(f"Beneficiario: {cheque.beneficiario} -> {data.beneficiario.strip()}")
        cheque.beneficiario = data.beneficiario.strip()
    if data.supplier_id is not None and data.supplier_id != cheque.supplier_id:
        cambios.append("Proveedor actualizado")
        cheque.supplier_id = data.supplier_id
    if data.monto is not None and data.monto != cheque.monto:
        cambios.append(f"Monto: {cheque.monto} -> {data.monto}")
        cheque.monto = data.monto
    if data.moneda is not None and data.moneda != cheque.moneda:
        cheque.moneda = data.moneda
    if data.fecha_emision is not None and data.fecha_emision != cheque.fecha_emision:
        cambios.append(f"Emisión: {cheque.fecha_emision} -> {data.fecha_emision}")
        cheque.fecha_emision = data.fecha_emision
    if data.fecha_entrega is not None and data.fecha_entrega != cheque.fecha_entrega:
        cambios.append(f"Entrega: {cheque.fecha_entrega} -> {data.fecha_entrega}")
        cheque.fecha_entrega = data.fecha_entrega
    if data.fecha_pago is not None and data.fecha_pago != cheque.fecha_pago:
        cambios.append(f"Vencimiento/Pago: {cheque.fecha_pago} -> {data.fecha_pago}")
        cheque.fecha_pago = data.fecha_pago
    if data.diferido is not None and data.diferido != cheque.diferido:
        cambios.append(f"Diferido: {'Sí' if data.diferido else 'No'}")
        cheque.diferido = data.diferido
    if data.concepto is not None and data.concepto != cheque.concepto:
        cheque.concepto = data.concepto
    if data.notas is not None and data.notas != cheque.notas:
        cheque.notas = data.notas

    # Si cambia el estado
    if data.estado is not None and data.estado != cheque.estado:
        permitidos = TRANSICIONES_VALIDAS.get(cheque.estado, set())
        if permitidos and data.estado not in permitidos:
            raise ValueError(f"No se puede pasar de '{cheque.estado}' a '{data.estado}'")
        estado_ant = cheque.estado
        cheque.estado = data.estado
        cheque.estado_updated_by = uuid.UUID(user_id) if user_id else None
        cheque.estado_updated_at = datetime.now(timezone.utc)
        cambios.append(f"Estado: {estado_ant} -> {data.estado}")
        nota_hist = data.notas or (f"Cambio de estado: {', '.join(cambios)}" if cambios else "Actualización de estado")
        db.add(ChequeHistorial(
            cheque_id=cheque.id,
            estado_anterior=estado_ant,
            estado_nuevo=data.estado,
            user_id=uuid.UUID(user_id) if user_id else None,
            user_nombre=user_nombre,
            notas=nota_hist,
        ))
        await _sync_cheque_bancario(db, cheque, estado_ant, data.estado)
    elif cambios:
        db.add(ChequeHistorial(
            cheque_id=cheque.id,
            estado_anterior=cheque.estado,
            estado_nuevo=cheque.estado,
            user_id=uuid.UUID(user_id) if user_id else None,
            user_nombre=user_nombre,
            notas=data.notas or f"Edición de datos: {'; '.join(cambios)}",
        ))

    # Si sigue cobrado y se modificaron datos como monto o número o fecha, sincronizar con bank_transactions
    if cheque.estado == "cobrado":
        from api.src.financial.models import BankTransaction, BankAccount
        tx_res = await db.execute(
            select(BankTransaction).where(
                BankTransaction.cheque_id == cheque.id,
                BankTransaction.tipo.in_(["debito", "egreso"]),
            )
        )
        for tx in tx_res.scalars().all():
            if data.monto is not None and Decimal(str(data.monto)) != Decimal(str(tx.monto)):
                diff = Decimal(str(data.monto)) - Decimal(str(tx.monto))
                tx.monto = Decimal(str(data.monto))
                bank_acc = await db.get(BankAccount, tx.bank_account_id)
                if bank_acc:
                    bank_acc.saldo_actual = (bank_acc.saldo_actual or Decimal("0")) - diff
                    db.add(bank_acc)
            if data.numero is not None:
                tx.referencia = str(data.numero).strip()
            if data.fecha_pago is not None:
                tx.fecha = data.fecha_pago
            if data.beneficiario is not None:
                tx.contraparte = data.beneficiario.strip()
                tx.descripcion = f"PAGO A {data.beneficiario.strip()} (Clearing Cheque #{cheque.numero})"
            db.add(tx)

    cheque.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(cheque)
    return cheque


async def marcar_cheques_entregados(
    db: AsyncSession,
    company_id: str,
    cheque_ids: list[str] | None,
    user_id: str | None,
    user_nombre: str | None,
) -> int:
    cid = uuid.UUID(company_id)
    query = select(Cheque).where(
        Cheque.company_id == cid,
        Cheque.estado == "pendiente",
    )
    if cheque_ids:
        query = query.where(Cheque.id.in_([uuid.UUID(i) for i in cheque_ids]))

    result = await db.execute(query)
    cheques = list(result.scalars().all())
    now = datetime.now(timezone.utc)
    today = date.today()

    count = 0
    for c in cheques:
        c.estado = "entregado"
        if not c.fecha_entrega:
            c.fecha_entrega = today
        c.estado_updated_by = uuid.UUID(user_id) if user_id else None
        c.estado_updated_at = now
        c.updated_at = now
        db.add(ChequeHistorial(
            cheque_id=c.id,
            estado_anterior="pendiente",
            estado_nuevo="entregado",
            user_id=uuid.UUID(user_id) if user_id else None,
            user_nombre=user_nombre,
            notas="Marcado como entregado masivamente",
        ))
        count += 1

    await db.flush()
    return count



async def update_estado(
    db: AsyncSession,
    cheque_id: str,
    nuevo_estado: str,
    notas: str | None,
    user_id: str | None,
    user_nombre: str | None,
    motivo_rechazo: str | None = None,
    costo_rechazo: Decimal | None = None,
    bank_account_id: uuid.UUID | str | None = None,
) -> Cheque:
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
    if nuevo_estado == "entregado" and not cheque.fecha_entrega:
        cheque.fecha_entrega = date.today()
    if motivo_rechazo:
        cheque.motivo_rechazo = motivo_rechazo

    # Imputar costo bancario de rechazo si aplica (a la cuenta indicada o a la del cheque)
    target_ba_id = bank_account_id or cheque.bank_account_id
    if nuevo_estado == "rechazado" and costo_rechazo and costo_rechazo > 0 and target_ba_id:
        target_bid = uuid.UUID(str(target_ba_id))
        from api.src.financial.models import BankAccount, BankTransaction
        bank_acc = await db.get(BankAccount, target_bid)
        if bank_acc:
            bank_acc.saldo_actual = (bank_acc.saldo_actual or 0) - Decimal(str(costo_rechazo))
            tx = BankTransaction(
                company_id=cheque.company_id,
                bank_account_id=target_bid,
                fecha=date.today(),
                tipo="egreso",
                monto=costo_rechazo,
                moneda=bank_acc.moneda or cheque.moneda or "PYG",
                descripcion=f"Comisión / Gasto por cheque rechazado N° {cheque.numero} - Motivo: {motivo_rechazo or 'Sin fondos'}",
                referencia=f"CHQ-RECHAZO-{cheque.numero}",
                cheque_id=cheque.id,
                categoria="comision",
            )
            db.add(tx)
            if not cheque.bank_account_id:
                cheque.bank_account_id = target_bid

    # Sincronización automática con Cuentas Bancarias (débito/reversión al cobrar o anular)
    await _sync_cheque_bancario(db, cheque, estado_anterior, nuevo_estado, target_ba_id)

    await db.flush()

    hist_notas = notas or ""
    if motivo_rechazo:
        hist_notas = f"Motivo: {motivo_rechazo}. {hist_notas}".strip()
    if costo_rechazo and costo_rechazo > 0:
        hist_notas = f"{hist_notas} (Costo bancario imputado: ₲ {costo_rechazo:,.0f})".strip()

    db.add(ChequeHistorial(
        cheque_id=cheque.id,
        estado_anterior=estado_anterior,
        estado_nuevo=nuevo_estado,
        user_id=uuid.UUID(user_id) if user_id else None,
        user_nombre=user_nombre,
        notas=hist_notas or None,
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
