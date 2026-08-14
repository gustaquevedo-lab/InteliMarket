from decimal import Decimal
from datetime import date, datetime, timezone, timedelta
from pathlib import Path
import json
import uuid

from sqlalchemy import select, text, func as sa_func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.petty_cash.models import Expense, ExpenseCategory, CostCenter, PettyCashFund, PettyCashFundMovement, PettyCashFundCount
from api.src.petty_cash.schemas import (
    ExpenseCreate, ExpenseUpdate, ExpenseSummary, CostCenterCreate, PettyCashFundCreate, PettyCashFundUpdate,
    ExpenseApprovalConfig, FundCountCreate, FundCountConfirm,
)


async def _get_user_nombre(db: AsyncSession, user_id: str | None) -> str | None:
    if not user_id:
        return None
    result = await db.execute(text("SELECT nombre FROM users WHERE id = :uid"), {"uid": user_id})
    row = result.fetchone()
    return row.nombre if row else None


# ── Comprobantes reales (Fase 4) ────────────────────────────────────────────
# Primer upload de archivos real en todo el sistema -- hasta ahora
# comprobante_url era un campo de texto libre sin ningun endpoint que
# realmente subiera un archivo. Guarda en disco local (no hay S3 ni storage
# externo configurado) y sirve via StaticFiles montado en main.py.

_UPLOAD_DIR = Path(__file__).resolve().parents[3] / "uploads" / "comprobantes"
_ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".pdf"}
_MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


def save_comprobante(content: bytes, filename: str) -> str:
    ext = Path(filename).suffix.lower()
    if ext not in _ALLOWED_EXTENSIONS:
        raise ValueError(f"Tipo de archivo no permitido: '{ext}'. Se aceptan: {', '.join(sorted(_ALLOWED_EXTENSIONS))}")
    if len(content) > _MAX_FILE_SIZE:
        raise ValueError("El archivo supera el tamaño máximo permitido (10MB)")
    if len(content) == 0:
        raise ValueError("El archivo está vacío")

    _UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    unique_name = f"{uuid.uuid4()}{ext}"
    (_UPLOAD_DIR / unique_name).write_bytes(content)
    return f"/uploads/comprobantes/{unique_name}"


# ── Configuracion de aprobacion (Fase 2) ────────────────────────────────────
# Umbral por empresa: gastos por debajo se auto-aprueban (no tiene sentido
# hacer perder tiempo a un Supervisor por una compra de Gs 5.000), por
# encima quedan pendientes hasta que alguien con rol Supervisor o Gerente
# los revise de verdad -- a diferencia de antes, donde el boton "Aprobar" no
# tenia ningun control de rol detras.

_APPROVAL_CONFIG_KEY = "gastos_aprobacion"
_APPROVAL_CONFIG_DEFAULT = {"umbral_aprobacion": 200000, "tolerancia_arqueo": 2000}


async def get_approval_config(db: AsyncSession, company_id: str) -> ExpenseApprovalConfig:
    result = await db.execute(text("SELECT config FROM companies WHERE id = :cid"), {"cid": company_id})
    row = result.fetchone()
    config = (row.config or {}) if row else {}
    stored = config.get(_APPROVAL_CONFIG_KEY, {}) if isinstance(config, dict) else {}
    merged = {**_APPROVAL_CONFIG_DEFAULT, **stored}
    return ExpenseApprovalConfig(**merged)


async def update_approval_config(db: AsyncSession, company_id: str, data: ExpenseApprovalConfig) -> ExpenseApprovalConfig:
    result = await db.execute(text("SELECT config FROM companies WHERE id = :cid"), {"cid": company_id})
    row = result.fetchone()
    config = dict(row.config or {}) if row and row.config else {}
    config[_APPROVAL_CONFIG_KEY] = {"umbral_aprobacion": float(data.umbral_aprobacion), "tolerancia_arqueo": float(data.tolerancia_arqueo)}
    await db.execute(
        text("UPDATE companies SET config = :config WHERE id = :cid"),
        {"config": json.dumps(config), "cid": company_id},
    )
    await db.commit()
    return data


# ── Fondo fijo (Fase 1) ─────────────────────────────────────────────────────
# El concepto central que faltaba: un monto autorizado por sucursal con un
# custodio responsable y un saldo real que baja con cada gasto. Antes de esto
# "caja chica" era solo un log de gastos sin ningun concepto de caja.

async def create_fund(db: AsyncSession, company_id: str, data: PettyCashFundCreate, user_id: str | None) -> PettyCashFund:
    monto = Decimal(str(data.monto_autorizado))
    fund = PettyCashFund(
        company_id=uuid.UUID(company_id),
        branch_id=uuid.UUID(data.branch_id) if data.branch_id else None,
        nombre=data.nombre,
        custodio_id=uuid.UUID(data.custodio_id) if data.custodio_id else None,
        monto_autorizado=monto,
        saldo_actual=monto,
    )
    db.add(fund)
    await db.flush()
    db.add(PettyCashFundMovement(
        fund_id=fund.id, tipo="apertura", monto=monto, saldo_anterior=Decimal("0"), saldo_nuevo=monto,
        referencia_type="apertura_fondo", observaciones=f"Apertura del fondo '{data.nombre}'",
        created_by=uuid.UUID(user_id) if user_id else None,
    ))
    await db.commit()
    await db.refresh(fund)
    return fund


async def list_funds(db: AsyncSession, company_id: str, activo: bool | None = None) -> list[dict]:
    query = text("""
        SELECT f.*, b.nombre AS branch_nombre, u.nombre AS custodio_nombre
        FROM petty_cash_funds f
        LEFT JOIN branches b ON b.id = f.branch_id
        LEFT JOIN users u ON u.id = f.custodio_id
        WHERE f.company_id = :cid
    """ + (" AND f.activo = :activo" if activo is not None else "") + " ORDER BY f.created_at DESC")
    params = {"cid": company_id}
    if activo is not None:
        params["activo"] = activo
    result = await db.execute(query, params)
    return [dict(row._mapping) for row in result.fetchall()]


async def get_fund(db: AsyncSession, fund_id: str) -> PettyCashFund | None:
    result = await db.execute(select(PettyCashFund).where(PettyCashFund.id == uuid.UUID(fund_id)))
    return result.scalar_one_or_none()


async def update_fund(db: AsyncSession, fund_id: str, data: PettyCashFundUpdate) -> PettyCashFund | None:
    fund = await get_fund(db, fund_id)
    if not fund:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(fund, field, value)
    await db.commit()
    await db.refresh(fund)
    return fund


async def get_fund_movements(db: AsyncSession, fund_id: str, limit: int = 50) -> list[PettyCashFundMovement]:
    result = await db.execute(
        select(PettyCashFundMovement)
        .where(PettyCashFundMovement.fund_id == uuid.UUID(fund_id))
        .order_by(PettyCashFundMovement.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def replenish_fund(db: AsyncSession, company_id: str, fund_id: str, data, user_id: str) -> dict:
    """Reposicion del fondo (Fase 3) -- trae el saldo de vuelta hacia el
    monto autorizado. Si se indica una cuenta bancaria, el dinero sale de
    verdad de esa cuenta (un BankTransaction real, mismo patron que usa
    financial.service para pagos a proveedores) -- si no, queda como un
    ajuste de caja sin respaldo bancario (efectivo puesto por el dueño,
    por ejemplo)."""
    from api.src.financial.models import BankAccount, BankTransaction

    fund = await get_fund(db, fund_id)
    if not fund or str(fund.company_id) != company_id:
        return {"error": "Fondo no encontrado"}

    monto = Decimal(str(data.monto))
    if monto <= 0:
        return {"error": "El monto de reposición debe ser mayor a cero"}

    bank_transaction_id = None
    if data.bank_account_id:
        account_result = await db.execute(
            select(BankAccount).where(BankAccount.id == uuid.UUID(data.bank_account_id))
        )
        account = account_result.scalar_one_or_none()
        if not account or str(account.company_id) != company_id:
            return {"error": "Cuenta bancaria no encontrada"}
        if Decimal(str(account.saldo_actual)) < monto:
            return {"error": f"La cuenta '{account.banco}' no tiene saldo suficiente (disponible: {account.saldo_actual:,.0f})"}

        bt = BankTransaction(
            company_id=uuid.UUID(company_id),
            bank_account_id=account.id,
            fecha=date.today(),
            tipo="debito",
            monto=monto,
            moneda=account.moneda,
            descripcion=f"Reposición de fondo de caja chica: {fund.nombre}",
            referencia=data.referencia,
            categoria="caja_chica",
        )
        db.add(bt)
        await db.flush()
        bank_transaction_id = bt.id
        account.saldo_actual = Decimal(str(account.saldo_actual)) - monto

    saldo_anterior = Decimal(str(fund.saldo_actual))
    fund.saldo_actual = saldo_anterior + monto
    db.add(PettyCashFundMovement(
        fund_id=fund.id, tipo="reposicion", monto=monto, saldo_anterior=saldo_anterior, saldo_nuevo=fund.saldo_actual,
        referencia_type="bank_transaction" if bank_transaction_id else "reposicion_manual",
        referencia_id=bank_transaction_id,
        observaciones=data.observaciones or (f"Reposición desde cuenta bancaria" if bank_transaction_id else "Reposición sin respaldo bancario"),
        created_by=uuid.UUID(user_id),
    ))

    await db.commit()
    await db.refresh(fund)
    return {"success": True, "fund": fund}


# ── Arqueo de caja chica (Fase 5) ────────────────────────────────────────────
# Conteo ciego: el custodio declara lo que cuenta fisicamente SIN que el
# frontend le muestre antes el saldo_actual del sistema (mismo patron ya
# probado en Caja / CashCount). El backend es el unico que conoce ambos
# numeros y calcula la diferencia recien al guardar -- asi el conteo no
# queda contaminado por el numero que "deberia dar".

async def create_fund_count(db: AsyncSession, company_id: str, fund_id: str, data: FundCountCreate, user_id: str) -> dict:
    fund = await get_fund(db, fund_id)
    if not fund or str(fund.company_id) != company_id:
        return {"error": "Fondo no encontrado"}

    approval_config = await get_approval_config(db, company_id)
    tolerancia = Decimal(str(approval_config.tolerancia_arqueo))

    saldo_esperado = Decimal(str(fund.saldo_actual))
    monto_contado = Decimal(str(data.monto_contado))
    diferencia = monto_contado - saldo_esperado
    requiere_revision = abs(diferencia) > tolerancia

    count = PettyCashFundCount(
        company_id=uuid.UUID(company_id),
        fund_id=fund.id,
        contado_por=uuid.UUID(user_id),
        contado_por_nombre=await _get_user_nombre(db, user_id),
        saldo_esperado=saldo_esperado,
        monto_contado=monto_contado,
        diferencia=diferencia,
        requiere_revision=requiere_revision,
        estado="pendiente",
        observaciones=data.observaciones,
    )
    db.add(count)
    await db.commit()
    await db.refresh(count)
    return {"success": True, "count": count}


async def list_fund_counts(db: AsyncSession, fund_id: str, limit: int = 50) -> list[PettyCashFundCount]:
    result = await db.execute(
        select(PettyCashFundCount)
        .where(PettyCashFundCount.fund_id == uuid.UUID(fund_id))
        .order_by(PettyCashFundCount.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def list_pending_fund_counts(db: AsyncSession, company_id: str) -> list[PettyCashFundCount]:
    result = await db.execute(
        select(PettyCashFundCount)
        .where(PettyCashFundCount.company_id == uuid.UUID(company_id), PettyCashFundCount.estado == "pendiente")
        .order_by(PettyCashFundCount.created_at.desc())
    )
    return list(result.scalars().all())


async def confirm_fund_count(db: AsyncSession, company_id: str, count_id: str, user_id: str, tenant_id: str, data: FundCountConfirm) -> dict:
    """Confirmacion del arqueo por un Supervisor/Gerente -- el mismo control
    de doble persona que usa CashHandoff: quien cuenta no es quien confirma.
    Si ajustar=True, el saldo del fondo se corrige para que coincida con lo
    contado fisicamente (queda un movimiento tipo='ajuste' en el ledger, asi
    no se pierde el rastro de por que el saldo cambio sin pasar por un gasto
    o una reposicion)."""
    from api.src.rbac.service import get_user_roles

    result = await db.execute(select(PettyCashFundCount).where(PettyCashFundCount.id == uuid.UUID(count_id)))
    count = result.scalar_one_or_none()
    if not count or str(count.company_id) != company_id:
        return {"error": "Arqueo no encontrado"}
    if count.estado != "pendiente":
        return {"error": "Este arqueo ya fue confirmado"}

    roles = {r["role_name"] for r in await get_user_roles(db, uuid.UUID(user_id), uuid.UUID(tenant_id))}
    if not roles & {"Supervisor", "Gerente"}:
        return {"error": "No autorizado: se requiere rol Supervisor o Gerente"}

    fund = await get_fund(db, str(count.fund_id))
    if not fund:
        return {"error": "Fondo no encontrado"}

    count.estado = "confirmado"
    count.confirmado_por = uuid.UUID(user_id)
    count.confirmado_por_nombre = await _get_user_nombre(db, user_id)
    count.fecha_confirmacion = datetime.now(timezone.utc)
    if data.observaciones:
        count.observaciones = ((count.observaciones or "") + f" | Confirmación: {data.observaciones}").strip(" |")

    if data.ajustar and count.diferencia != 0:
        saldo_anterior = Decimal(str(fund.saldo_actual))
        fund.saldo_actual = Decimal(str(count.monto_contado))
        db.add(PettyCashFundMovement(
            fund_id=fund.id, tipo="ajuste", monto=Decimal(str(count.diferencia)), saldo_anterior=saldo_anterior,
            saldo_nuevo=fund.saldo_actual, referencia_type="arqueo", referencia_id=count.id,
            observaciones=f"Ajuste por arqueo confirmado (diferencia: {count.diferencia:+,.0f})",
            created_by=uuid.UUID(user_id),
        ))
        count.ajusto_saldo = True

    await db.commit()
    await db.refresh(count)
    return {"success": True, "count": count}


async def create_category(db: AsyncSession, company_id: str, data) -> ExpenseCategory:
    cat = ExpenseCategory(company_id=uuid.UUID(company_id), **data.model_dump(exclude_unset=True))
    db.add(cat)
    await db.flush()
    await db.refresh(cat)
    return cat


async def list_categories(db: AsyncSession, company_id: str) -> list[ExpenseCategory]:
    result = await db.execute(
        select(ExpenseCategory).where(
            ExpenseCategory.company_id == uuid.UUID(company_id),
            ExpenseCategory.activo == True,
        ).order_by(ExpenseCategory.nombre)
    )
    return list(result.scalars().all())


async def create_cost_center(db: AsyncSession, company_id: str, data: CostCenterCreate) -> CostCenter:
    cc = CostCenter(company_id=uuid.UUID(company_id), **data.model_dump(exclude_unset=True))
    db.add(cc)
    await db.flush()
    await db.refresh(cc)
    return cc


async def list_cost_centers(db: AsyncSession, company_id: str) -> list[CostCenter]:
    result = await db.execute(
        select(CostCenter).where(
            CostCenter.company_id == uuid.UUID(company_id),
            CostCenter.activo == True,
        ).order_by(CostCenter.tipo, CostCenter.nombre)
    )
    return list(result.scalars().all())


async def _resolve_fund_for_branch(db: AsyncSession, company_id: str, branch_id: str | None) -> PettyCashFund | None:
    query = select(PettyCashFund).where(PettyCashFund.company_id == uuid.UUID(company_id), PettyCashFund.activo == True)
    if branch_id:
        query = query.where(PettyCashFund.branch_id == uuid.UUID(branch_id))
    else:
        query = query.where(PettyCashFund.branch_id.is_(None))
    result = await db.execute(query.limit(1))
    return result.scalar_one_or_none()


async def create_expense(db: AsyncSession, company_id: str, data: ExpenseCreate, user_id: str) -> Expense:
    fund = None
    if data.fund_id:
        fund = await get_fund(db, data.fund_id)
        if not fund or str(fund.company_id) != company_id:
            raise ValueError("Fondo de caja chica no encontrado")
    else:
        fund = await _resolve_fund_for_branch(db, company_id, data.branch_id)

    monto = Decimal(str(data.monto))
    if fund:
        if Decimal(str(fund.saldo_actual)) < monto:
            raise ValueError(
                f"El fondo '{fund.nombre}' no tiene saldo suficiente "
                f"(disponible: {fund.saldo_actual:,.0f}, gasto: {monto:,.0f})"
            )

    # Umbral de aprobacion (Fase 2): por debajo se auto-aprueba (no tiene
    # sentido hacer perder tiempo a un Supervisor por una compra chica), por
    # encima queda pendiente hasta revision real por rol.
    approval_config = await get_approval_config(db, company_id)
    auto_aprobado = monto <= Decimal(str(approval_config.umbral_aprobacion))

    exp = Expense(
        company_id=uuid.UUID(company_id),
        branch_id=uuid.UUID(data.branch_id) if data.branch_id else (fund.branch_id if fund else None),
        fund_id=fund.id if fund else None,
        category_id=uuid.UUID(data.category_id) if data.category_id else None,
        cost_center_id=uuid.UUID(data.cost_center_id) if data.cost_center_id else None,
        monto=monto,
        descripcion=data.descripcion,
        proveedor=data.proveedor,
        comprobante_url=data.comprobante_url,
        tipo_pago=data.tipo_pago,
        fecha_gasto=data.fecha_gasto or date.today(),
        registrado_por=uuid.UUID(user_id),
        estado="aprobado" if auto_aprobado else "pendiente",
    )
    db.add(exp)
    await db.flush()

    if fund:
        saldo_anterior = Decimal(str(fund.saldo_actual))
        fund.saldo_actual = saldo_anterior - monto
        db.add(PettyCashFundMovement(
            fund_id=fund.id, tipo="gasto", monto=monto, saldo_anterior=saldo_anterior, saldo_nuevo=fund.saldo_actual,
            referencia_type="expense", referencia_id=exp.id, observaciones=data.descripcion,
            created_by=uuid.UUID(user_id),
        ))

    await db.commit()
    await db.refresh(exp)
    return exp


async def get_expense(db: AsyncSession, expense_id: str) -> Expense | None:
    result = await db.execute(select(Expense).where(Expense.id == uuid.UUID(expense_id)))
    return result.scalar_one_or_none()


async def list_expenses(
    db: AsyncSession, company_id: str, branch_id: str | None = None,
    category_id: str | None = None, estado: str | None = None,
    desde: date | None = None, hasta: date | None = None,
    limit: int = 50, offset: int = 0, incluir_anulados: bool = False,
) -> list[Expense]:
    query = select(Expense).where(Expense.company_id == uuid.UUID(company_id))
    if not incluir_anulados:
        query = query.where(Expense.anulado == False)
    if branch_id:
        query = query.where(Expense.branch_id == uuid.UUID(branch_id))
    if category_id:
        query = query.where(Expense.category_id == uuid.UUID(category_id))
    if estado:
        query = query.where(Expense.estado == estado)
    if desde:
        query = query.where(Expense.fecha_gasto >= desde)
    if hasta:
        query = query.where(Expense.fecha_gasto <= hasta)
    query = query.order_by(Expense.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return list(result.scalars().all())


async def update_expense(db: AsyncSession, expense_id: str, data: ExpenseUpdate) -> Expense | None:
    exp = await get_expense(db, expense_id)
    if not exp:
        return None

    update_data = data.model_dump(exclude_unset=True)
    nuevo_monto = update_data.get("monto")
    if nuevo_monto is not None and exp.fund_id:
        delta = Decimal(str(nuevo_monto)) - Decimal(str(exp.monto))
        if delta != 0:
            fund = await get_fund(db, str(exp.fund_id))
            if fund:
                if delta > 0 and Decimal(str(fund.saldo_actual)) < delta:
                    raise ValueError(f"El fondo '{fund.nombre}' no tiene saldo suficiente para el aumento")
                saldo_anterior = Decimal(str(fund.saldo_actual))
                fund.saldo_actual = saldo_anterior - delta
                db.add(PettyCashFundMovement(
                    fund_id=fund.id, tipo="ajuste", monto=abs(delta), saldo_anterior=saldo_anterior,
                    saldo_nuevo=fund.saldo_actual, referencia_type="expense_edited", referencia_id=exp.id,
                    observaciones=f"Ajuste por edición de monto de gasto: {exp.descripcion}",
                ))

    for field, value in update_data.items():
        if value is not None:
            setattr(exp, field, value)
    await db.commit()
    await db.refresh(exp)
    return exp


async def delete_expense(db: AsyncSession, expense_id: str) -> bool:
    exp = await get_expense(db, expense_id)
    if not exp:
        return False

    # Si el gasto habia descontado un fondo, hay que devolver el saldo -- si
    # no, borrar el gasto deja el fondo con menos plata de la que realmente
    # tiene disponible. Pero si ya estaba rechazado o anulado, ese reverso ya
    # paso en reject_expense/void_expense -- reversarlo de nuevo aca
    # duplicaria el saldo (bug real encontrado y corregido en verificacion
    # de Fase 4: borrar un gasto ya anulado sumaba el monto dos veces).
    # (Fase 4 reemplaza este delete fisico por anulacion como via principal.)
    if exp.fund_id and exp.estado != "rechazado" and not exp.anulado:
        fund = await get_fund(db, str(exp.fund_id))
        if fund:
            saldo_anterior = Decimal(str(fund.saldo_actual))
            fund.saldo_actual = saldo_anterior + Decimal(str(exp.monto))
            db.add(PettyCashFundMovement(
                fund_id=fund.id, tipo="ajuste", monto=Decimal(str(exp.monto)), saldo_anterior=saldo_anterior,
                saldo_nuevo=fund.saldo_actual, referencia_type="expense_deleted", referencia_id=exp.id,
                observaciones=f"Reverso por borrado de gasto: {exp.descripcion}",
            ))

    await db.delete(exp)
    await db.commit()
    return True


async def approve_expense(db: AsyncSession, expense_id: str, user_id: str, tenant_id: str) -> dict:
    from api.src.rbac.service import get_user_roles

    exp = await get_expense(db, expense_id)
    if not exp:
        return {"error": "Gasto no encontrado"}
    if exp.estado != "pendiente":
        return {"error": f"El gasto ya está en estado '{exp.estado}'"}

    roles = {r["role_name"] for r in await get_user_roles(db, uuid.UUID(user_id), uuid.UUID(tenant_id))}
    if not roles & {"Supervisor", "Gerente"}:
        return {"error": "No autorizado: se requiere rol Supervisor o Gerente"}

    exp.estado = "aprobado"
    exp.aprobado_por = uuid.UUID(user_id)
    exp.aprobado_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(exp)
    return {"success": True, "expense": exp}


async def reject_expense(db: AsyncSession, expense_id: str, user_id: str, tenant_id: str, motivo: str) -> dict:
    from api.src.rbac.service import get_user_roles

    exp = await get_expense(db, expense_id)
    if not exp:
        return {"error": "Gasto no encontrado"}
    if exp.estado != "pendiente":
        return {"error": f"El gasto ya está en estado '{exp.estado}'"}

    roles = {r["role_name"] for r in await get_user_roles(db, uuid.UUID(user_id), uuid.UUID(tenant_id))}
    if not roles & {"Supervisor", "Gerente"}:
        return {"error": "No autorizado: se requiere rol Supervisor o Gerente"}

    exp.estado = "rechazado"
    exp.rechazado_por = uuid.UUID(user_id)
    exp.rechazado_at = datetime.now(timezone.utc)
    exp.rechazado_motivo = motivo

    # Un gasto rechazado no era un uso legitimo del fondo -- se devuelve el
    # saldo, igual que un borrado. El custodio queda a cargo de justificar o
    # devolver ese efectivo por fuera del sistema.
    if exp.fund_id:
        fund = await get_fund(db, str(exp.fund_id))
        if fund:
            saldo_anterior = Decimal(str(fund.saldo_actual))
            fund.saldo_actual = saldo_anterior + Decimal(str(exp.monto))
            db.add(PettyCashFundMovement(
                fund_id=fund.id, tipo="ajuste", monto=Decimal(str(exp.monto)), saldo_anterior=saldo_anterior,
                saldo_nuevo=fund.saldo_actual, referencia_type="expense_rejected", referencia_id=exp.id,
                observaciones=f"Reverso por rechazo de gasto: {motivo}",
                created_by=uuid.UUID(user_id),
            ))

    await db.commit()
    await db.refresh(exp)
    return {"success": True, "expense": exp}


async def void_expense(db: AsyncSession, expense_id: str, user_id: str, tenant_id: str, motivo: str) -> dict:
    """Anular (Fase 4) reemplaza el borrado fisico -- el gasto queda en la
    base con su historial completo, solo marcado como anulado, igual que
    'Anular Recepcion' en Compras. A diferencia de rechazar (que solo aplica
    a un gasto pendiente, parte del flujo de aprobacion), anular se puede
    hacer sobre CUALQUIER gasto, incluso uno ya aprobado, porque el motivo
    tipico es un error descubierto despues (monto mal cargado, duplicado)."""
    from api.src.rbac.service import get_user_roles

    exp = await get_expense(db, expense_id)
    if not exp:
        return {"error": "Gasto no encontrado"}
    if exp.anulado:
        return {"error": "El gasto ya está anulado"}

    roles = {r["role_name"] for r in await get_user_roles(db, uuid.UUID(user_id), uuid.UUID(tenant_id))}
    if not roles & {"Supervisor", "Gerente"}:
        return {"error": "No autorizado: se requiere rol Supervisor o Gerente"}

    exp.anulado = True
    exp.anulado_por = uuid.UUID(user_id)
    exp.anulado_at = datetime.now(timezone.utc)
    exp.anulado_motivo = motivo

    # Si el gasto ya estaba rechazado, el fondo ya se repuso en ese momento
    # -- reversarlo de nuevo aca duplicaria el saldo (mismo bug que se
    # encontro y corrigio en el borrado fisico de la Fase 2).
    if exp.fund_id and exp.estado != "rechazado":
        fund = await get_fund(db, str(exp.fund_id))
        if fund:
            saldo_anterior = Decimal(str(fund.saldo_actual))
            fund.saldo_actual = saldo_anterior + Decimal(str(exp.monto))
            db.add(PettyCashFundMovement(
                fund_id=fund.id, tipo="ajuste", monto=Decimal(str(exp.monto)), saldo_anterior=saldo_anterior,
                saldo_nuevo=fund.saldo_actual, referencia_type="expense_voided", referencia_id=exp.id,
                observaciones=f"Reverso por anulación de gasto: {motivo}",
                created_by=uuid.UUID(user_id),
            ))

    await db.commit()
    await db.refresh(exp)
    return {"success": True, "expense": exp}


async def get_summary(db: AsyncSession, company_id: str) -> ExpenseSummary:
    cid = uuid.UUID(company_id)
    today = date.today()

    # Daily total
    r1 = await db.execute(
        select(sa_func.coalesce(sa_func.sum(Expense.monto), 0))
        .where(Expense.company_id == cid, Expense.anulado == False, Expense.fecha_gasto == today)
    )
    total_dia = float(r1.scalar())

    # Weekly total (lunes a hoy)
    week_start = today - timedelta(days=today.weekday())
    r2 = await db.execute(
        select(sa_func.coalesce(sa_func.sum(Expense.monto), 0))
        .where(Expense.company_id == cid, Expense.anulado == False, Expense.fecha_gasto >= week_start)
    )
    total_semana = float(r2.scalar())

    # Monthly total
    month_start = today.replace(day=1)
    r3 = await db.execute(
        select(sa_func.coalesce(sa_func.sum(Expense.monto), 0))
        .where(Expense.company_id == cid, Expense.anulado == False, Expense.fecha_gasto >= month_start)
    )
    total_mes = float(r3.scalar())

    # By category
    r4 = await db.execute(
        select(Expense.category_id, sa_func.sum(Expense.monto))
        .where(Expense.company_id == cid, Expense.anulado == False, Expense.fecha_gasto >= month_start)
        .group_by(Expense.category_id)
    )
    por_categoria = [{"category_id": str(k) if k else None, "total": float(v)} for k, v in r4.all()]

    # By branch
    r5 = await db.execute(
        select(Expense.branch_id, sa_func.sum(Expense.monto))
        .where(Expense.company_id == cid, Expense.anulado == False, Expense.fecha_gasto >= month_start)
        .group_by(Expense.branch_id)
    )
    por_sucursal = [{"branch_id": str(k) if k else None, "total": float(v)} for k, v in r5.all()]

    # Pending approval
    r6 = await db.execute(
        select(sa_func.count())
        .where(Expense.company_id == cid, Expense.anulado == False, Expense.estado == "pendiente")
    )
    pendientes = int(r6.scalar())

    return ExpenseSummary(
        total_dia=total_dia, total_semana=total_semana, total_mes=total_mes,
        por_categoria=por_categoria, por_sucursal=por_sucursal,
        pendientes_aprobacion=pendientes,
    )


async def _sum_expenses(db: AsyncSession, cid, desde: date, hasta: date) -> Decimal:
    r = await db.execute(
        select(sa_func.coalesce(sa_func.sum(Expense.monto), 0))
        .where(Expense.company_id == cid, Expense.anulado == False, Expense.fecha_gasto >= desde, Expense.fecha_gasto <= hasta)
    )
    return Decimal(str(r.scalar()))


async def get_expense_dashboard(db: AsyncSession, company_id: str, fecha_desde: date, fecha_hasta: date) -> dict:
    cid = uuid.UUID(company_id)
    dias_periodo = (fecha_hasta - fecha_desde).days + 1
    periodo_anterior_hasta = fecha_desde - timedelta(days=1)
    periodo_anterior_desde = periodo_anterior_hasta - timedelta(days=dias_periodo - 1)

    total_periodo = await _sum_expenses(db, cid, fecha_desde, fecha_hasta)
    total_anterior = await _sum_expenses(db, cid, periodo_anterior_desde, periodo_anterior_hasta)
    variacion_pct = float((total_periodo - total_anterior) / total_anterior * 100) if total_anterior > 0 else None

    categories = await list_categories(db, company_id)
    cost_centers = await list_cost_centers(db, company_id)

    # ── Por categoría (tipo de gasto), comparado contra presupuesto prorrateado ──
    cat_totals = {}
    r_cat2 = await db.execute(
        select(Expense.category_id, sa_func.sum(Expense.monto))
        .where(Expense.company_id == cid, Expense.anulado == False, Expense.fecha_gasto >= fecha_desde, Expense.fecha_gasto <= fecha_hasta)
        .group_by(Expense.category_id)
    )
    for cat_id, total in r_cat2.all():
        cat_totals[cat_id] = Decimal(str(total))

    r_cat_prev = await db.execute(
        select(Expense.category_id, sa_func.sum(Expense.monto))
        .where(Expense.company_id == cid, Expense.anulado == False, Expense.fecha_gasto >= periodo_anterior_desde, Expense.fecha_gasto <= periodo_anterior_hasta)
        .group_by(Expense.category_id)
    )
    cat_totals_prev = {cat_id: Decimal(str(total)) for cat_id, total in r_cat_prev.all()}

    cat_by_id = {c.id: c for c in categories}
    por_categoria = []
    for cat_id, total in cat_totals.items():
        cat = cat_by_id.get(cat_id)
        nombre = cat.nombre if cat else "Sin categoría"
        presupuesto = float(cat.presupuesto_mensual) if cat and cat.presupuesto_mensual else None
        presupuesto_prorateado = (presupuesto * dias_periodo / 30) if presupuesto else None
        pct_usado = (float(total) / presupuesto_prorateado * 100) if presupuesto_prorateado else None
        anterior = float(cat_totals_prev.get(cat_id, 0))
        variacion_cat_pct = ((float(total) - anterior) / anterior * 100) if anterior > 0 else None
        por_categoria.append({
            "category_id": str(cat_id) if cat_id else None,
            "nombre": nombre,
            "total": float(total),
            "presupuesto_prorateado": presupuesto_prorateado,
            "pct_usado": pct_usado,
            "sobre_presupuesto": bool(pct_usado and pct_usado > 100),
            "variacion_pct": variacion_cat_pct,
        })
    por_categoria.sort(key=lambda c: c["total"], reverse=True)

    # ── Por sector (centro de costo), con prorrateo de gastos globales ──
    r_sector = await db.execute(
        select(Expense.cost_center_id, sa_func.sum(Expense.monto))
        .where(Expense.company_id == cid, Expense.anulado == False, Expense.fecha_gasto >= fecha_desde, Expense.fecha_gasto <= fecha_hasta)
        .group_by(Expense.cost_center_id)
    )
    directo_by_cc = {cc_id: Decimal(str(total)) for cc_id, total in r_sector.all()}

    sectores_activos = [cc for cc in cost_centers if cc.tipo == "sector"]
    global_pool = sum((directo_by_cc.get(cc.id, Decimal("0")) for cc in cost_centers if cc.tipo == "global"), Decimal("0"))
    peso_total = sum((cc.peso_prorateo for cc in sectores_activos), Decimal("0"))

    por_sector = []
    for cc in sectores_activos:
        directo = directo_by_cc.get(cc.id, Decimal("0"))
        prorrateado = (global_pool * cc.peso_prorateo / peso_total) if peso_total > 0 else Decimal("0")
        por_sector.append({
            "cost_center_id": str(cc.id),
            "nombre": cc.nombre,
            "directo": float(directo),
            "prorrateado": float(prorrateado),
            "total": float(directo + prorrateado),
        })
    por_sector.sort(key=lambda s: s["total"], reverse=True)

    sin_asignar = directo_by_cc.get(None, Decimal("0"))

    # ── Tendencia mensual (últimos 6 meses calendario hasta el mes de fecha_hasta) ──
    tendencia_mensual = []
    cursor = fecha_hasta.replace(day=1)
    meses = []
    for _ in range(6):
        meses.append(cursor)
        cursor = (cursor - timedelta(days=1)).replace(day=1)
    meses.reverse()
    for mes_inicio in meses:
        if mes_inicio.month == 12:
            mes_fin = mes_inicio.replace(year=mes_inicio.year + 1, month=1) - timedelta(days=1)
        else:
            mes_fin = mes_inicio.replace(month=mes_inicio.month + 1) - timedelta(days=1)
        total_mes_i = await _sum_expenses(db, cid, mes_inicio, mes_fin)
        tendencia_mensual.append({"mes": mes_inicio.strftime("%Y-%m"), "total": float(total_mes_i)})

    # ── Top proveedores ──
    r_prov = await db.execute(
        select(Expense.proveedor, sa_func.sum(Expense.monto))
        .where(
            Expense.company_id == cid, Expense.anulado == False, Expense.fecha_gasto >= fecha_desde, Expense.fecha_gasto <= fecha_hasta,
            Expense.proveedor.isnot(None), Expense.proveedor != "",
        )
        .group_by(Expense.proveedor)
        .order_by(sa_func.sum(Expense.monto).desc())
        .limit(5)
    )
    top_proveedores = [{"proveedor": p, "total": float(t)} for p, t in r_prov.all()]

    # ── Sugerencias basadas en reglas (sin costo de LLM, siempre disponibles) ──
    sugerencias = []
    for c in por_categoria:
        if c["sobre_presupuesto"]:
            exceso = c["total"] - c["presupuesto_prorateado"]
            sugerencias.append({
                "tipo": "presupuesto_excedido",
                "titulo": f"{c['nombre']} superó su presupuesto",
                "detalle": f"Lleva gastado {c['total']:,.0f} Gs. contra un presupuesto de {c['presupuesto_prorateado']:,.0f} Gs. para el período — {c['pct_usado']:.0f}% usado, {exceso:,.0f} Gs. de más.",
            })
        if c["variacion_pct"] and c["variacion_pct"] > 20:
            sugerencias.append({
                "tipo": "crecimiento_inusual",
                "titulo": f"{c['nombre']} creció {c['variacion_pct']:.0f}% vs. período anterior",
                "detalle": f"Pasó de gastar en esta categoría a {c['total']:,.0f} Gs. en el período actual — revisar si es un gasto puntual o una tendencia a corregir.",
            })
    if top_proveedores and float(total_periodo) > 0:
        principal = top_proveedores[0]
        share = principal["total"] / float(total_periodo) * 100
        if share > 30:
            sugerencias.append({
                "tipo": "concentracion_proveedor",
                "titulo": f"{principal['proveedor']} concentra {share:.0f}% del gasto total",
                "detalle": f"{principal['total']:,.0f} Gs. de {float(total_periodo):,.0f} Gs. del período — vale la pena evaluar renegociar condiciones o buscar alternativas.",
            })
    if float(total_periodo) > 0 and float(sin_asignar) / float(total_periodo) > 0.1:
        pct_sin = float(sin_asignar) / float(total_periodo) * 100
        sugerencias.append({
            "tipo": "datos_incompletos",
            "titulo": f"{pct_sin:.0f}% de los gastos no tiene sector asignado",
            "detalle": f"{float(sin_asignar):,.0f} Gs. sin imputar a un sector — sin esto no se puede medir la rentabilidad real por área del supermercado.",
        })

    return {
        "fecha_desde": fecha_desde,
        "fecha_hasta": fecha_hasta,
        "total_periodo": float(total_periodo),
        "total_periodo_anterior": float(total_anterior),
        "variacion_pct": variacion_pct,
        "por_categoria": por_categoria,
        "por_sector": por_sector,
        "sin_asignar": float(sin_asignar),
        "tendencia_mensual": tendencia_mensual,
        "top_proveedores": top_proveedores,
        "sugerencias": sugerencias,
    }
