from decimal import Decimal
from datetime import date, datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from pathlib import Path
import logging
import json
import uuid
import os
import time

from fastapi import HTTPException
from sqlalchemy import select, text, func as sa_func, and_, or_, update
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

from api.src.petty_cash.models import (
    Expense, ExpenseCategory, CostCenter, PettyCashFund, PettyCashFundMovement,
    PettyCashFundCount, PettyCashRendicion, ExpenseDisbursement, ExpenseSupplierInvoice,
)
from api.src.petty_cash.schemas import (
    ExpenseCreate, ExpenseUpdate, ExpenseSummary, CostCenterCreate, PettyCashFundCreate, PettyCashFundUpdate,
    ExpenseApprovalConfig, FundCountCreate, FundCountConfirm,
    PettyCashRendicionCreate, PettyCashRendicionAuditRequest, PettyCashRendicionReplenishRequest,
    ExpenseDisburseRequest, ExpenseDisbursementLineCreate,
)

TZ_ASUNCION = ZoneInfo("America/Asuncion")


def _safe_uuid(val: object) -> uuid.UUID | None:
    if not val:
        return None
    if isinstance(val, uuid.UUID):
        return val
    try:
        return uuid.UUID(str(val))
    except (ValueError, TypeError, AttributeError):
        return None


async def _get_user_nombre(db: AsyncSession, user_id: str | None) -> str | None:
    if not user_id:
        return None
    result = await db.execute(text("SELECT nombre FROM users WHERE id = :uid"), {"uid": str(user_id)})
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
    unique_name = f"{uuid.uuid4().hex[:12]}_{Path(filename).name}"
    dest = _UPLOAD_DIR / unique_name
    dest.write_bytes(content)
    return f"/static/uploads/comprobantes/{unique_name}"


# ── Umbral de aprobacion (Fase 2) ───────────────────────────────────────────
# Por debajo se auto-aprueba, por encima requiere aprobacion de rol autorizado.
# Se guarda como JSON en settings_company bajo la key 'petty_cash_approval'.

_CONFIG_KEY = "petty_cash_approval"


async def get_approval_config(db: AsyncSession, company_id: str) -> ExpenseApprovalConfig:
    try:
        result = await db.execute(
            text("SELECT value FROM settings_company WHERE company_id = :cid AND key = :k"),
            {"cid": company_id, "k": _CONFIG_KEY},
        )
        row = result.fetchone()
        if row and row.value:
            try:
                return ExpenseApprovalConfig(**json.loads(row.value))
            except Exception:
                pass
    except Exception as e:
        logger.warning("No se pudo leer settings_company (retornando configuración por defecto): %s", e)
    return ExpenseApprovalConfig()


async def update_approval_config(db: AsyncSession, company_id: str, data: ExpenseApprovalConfig) -> ExpenseApprovalConfig:
    val = json.dumps(data.model_dump(mode="json"))
    await db.execute(
        text("""
            INSERT INTO settings_company (id, company_id, key, value, created_at, updated_at)
            VALUES (gen_random_uuid(), :cid, :k, :v, now(), now())
            ON CONFLICT (company_id, key) DO UPDATE SET value = :v, updated_at = now()
        """),
        {"cid": company_id, "k": _CONFIG_KEY, "v": val},
    )
    await db.commit()
    return data


# ── Fondo fijo (Fase 1) ─────────────────────────────────────────────────────
# El concepto central que faltaba: un monto autorizado por sucursal con un
# custodio responsable y un saldo real que baja con cada gasto.

async def create_fund(db: AsyncSession, company_id: str, data: PettyCashFundCreate, user_id: str | None) -> PettyCashFund:
    cid = uuid.UUID(company_id)
    monto = Decimal(str(data.monto_autorizado))
    monto_max = Decimal(str(data.monto_maximo_por_gasto or 500000))
    cc_id = uuid.UUID(data.cost_center_id) if data.cost_center_id else None

    caja_mov_id = None
    bank_tx_id = None
    saldo_inicial = monto

    if data.dotacion_inicial:
        user_nombre = await _get_user_nombre(db, user_id) or "Tesorería"
        if data.medio_dotacion == "EFECTIVO_BOVEDA" and data.caja_boveda_id:
            from api.src.caja.models import CashRegisterMovement
            crm = CashRegisterMovement(
                company_id=cid,
                register_id=uuid.UUID(data.caja_boveda_id),
                tipo="retiro",
                monto=monto,
                moneda="PYG",
                fecha=datetime.now(TZ_ASUNCION),
                usuario=user_nombre,
                observaciones=f"Dotación Inicial Fondo Fijo: {data.nombre}",
            )
            db.add(crm)
            await db.flush()
            caja_mov_id = crm.id
        elif data.medio_dotacion == "BANCO_TRANSFERENCIA" and data.bank_account_id:
            from api.src.financial.models import BankAccount, BankTransaction
            acc_res = await db.execute(select(BankAccount).where(BankAccount.id == uuid.UUID(data.bank_account_id)))
            acc = acc_res.scalar_one_or_none()
            if acc:
                bt = BankTransaction(
                    company_id=cid,
                    bank_account_id=acc.id,
                    fecha=date.today(),
                    tipo="debito",
                    monto=monto,
                    moneda=acc.moneda,
                    descripcion=f"Dotación Inicial Fondo Fijo: {data.nombre}",
                    categoria="caja_chica",
                )
                db.add(bt)
                acc.saldo_actual = Decimal(str(acc.saldo_actual)) - monto
                await db.flush()
                bank_tx_id = bt.id

    fund = PettyCashFund(
        company_id=cid,
        branch_id=uuid.UUID(data.branch_id) if data.branch_id else None,
        nombre=data.nombre,
        custodio_id=uuid.UUID(data.custodio_id) if data.custodio_id else None,
        cost_center_id=cc_id,
        monto_autorizado=monto,
        saldo_actual=saldo_inicial,
        monto_maximo_por_gasto=monto_max,
    )
    db.add(fund)
    await db.flush()

    db.add(PettyCashFundMovement(
        fund_id=fund.id,
        tipo="apertura",
        monto=monto,
        saldo_anterior=Decimal("0"),
        saldo_nuevo=fund.saldo_actual,
        referencia_type="cash_movement" if caja_mov_id else ("bank_transaction" if bank_tx_id else "apertura_fondo"),
        referencia_id=caja_mov_id or bank_tx_id,
        observaciones=f"Apertura del fondo '{data.nombre}' (Dotación: {data.medio_dotacion if data.dotacion_inicial else 'Directa'})",
        created_by=uuid.UUID(user_id) if user_id else None,
    ))

    await db.commit()
    await db.refresh(fund)
    return fund


async def list_funds(db: AsyncSession, company_id: str, activo: bool | None = None) -> list[dict]:
    query = text("""
        SELECT f.*, b.nombre AS branch_nombre, u.nombre AS custodio_nombre, cc.nombre AS cost_center_nombre
        FROM petty_cash_funds f
        LEFT JOIN branches b ON b.id = f.branch_id
        LEFT JOIN users u ON u.id = f.custodio_id
        LEFT JOIN cost_centers cc ON cc.id = f.cost_center_id
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
        # Se permite sobregiro en cuenta bancaria para reposición mientras se calibran saldos

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
    cid = uuid.UUID(company_id)
    fund = None
    if data.fund_id:
        fund = await get_fund(db, data.fund_id)
        if not fund or str(fund.company_id) != company_id:
            raise ValueError("Fondo de caja chica no encontrado")
    else:
        fund = await _resolve_fund_for_branch(db, company_id, data.branch_id)

    monto = Decimal(str(data.monto))
    # Nota: NO se verifica saldo del fondo aquí. El gasto se crea en estado 'pendiente'.
    # El saldo se controla en el momento de liquidación/pago (disburse_expense).

    # 1. Control Antifraude de Duplicados (RUC + Timbrado + Factura)
    if data.ruc and data.timbrado and data.numero_factura:
        clean_ruc = data.ruc.strip()
        clean_timb = data.timbrado.strip()
        clean_num = data.numero_factura.strip()
        dup_stmt = select(Expense.id, Expense.descripcion, Expense.fecha_gasto).where(
            Expense.company_id == cid,
            Expense.ruc == clean_ruc,
            Expense.timbrado == clean_timb,
            Expense.numero_factura == clean_num,
            Expense.anulado == False,
        )
        dup = (await db.execute(dup_stmt)).first()
        if dup:
            raise ValueError(
                f"Factura ya registrada: El comprobante Nro {clean_num} (Timbrado {clean_timb}, RUC {clean_ruc}) "
                f"ya fue cargado previamente el {dup.fecha_gasto} ('{dup.descripcion}')."
            )

    # 2. Desglose Impositivo DNIT / SET (Paraguay)
    grav_10 = Decimal(str(data.gravado_10 or 0))
    grav_5 = Decimal(str(data.gravado_5 or 0))
    exen = Decimal(str(data.exentas or 0))
    iva_10 = Decimal(str(data.iva_10 or 0))
    iva_5 = Decimal(str(data.iva_5 or 0))

    # Reglas específicas para Anticipo de Sueldo (Nómina)
    if data.es_anticipo_sueldo:
        data.es_pago_proveedor = False
        data.supplier_id = None
        data.supplier_invoice_id = None
        data.tipo_comprobante = "RECIBO"
        grav_10 = Decimal("0")
        grav_5 = Decimal("0")
        iva_10 = Decimal("0")
        iva_5 = Decimal("0")
        exen = monto
        if data.employee_nombre and not data.proveedor:
            data.proveedor = data.employee_nombre
        if data.employee_ci and not data.ruc:
            data.ruc = data.employee_ci
    elif grav_10 == 0 and grav_5 == 0 and exen == 0:
        tipo_c = (data.tipo_comprobante or "").upper()
        if tipo_c in ("RECIBO", "BOLETA"):
            exen = monto
        else:
            grav_10 = monto
            iva_10 = round(grav_10 / Decimal("11"))
    else:
        if grav_10 > 0 and iva_10 == 0:
            iva_10 = round(grav_10 / Decimal("11"))
        if grav_5 > 0 and iva_5 == 0:
            iva_5 = round(grav_5 / Decimal("21"))

    # 3. Control de Límite Máximo por Comprobante
    auditoria_estado = "pendiente"
    auditoria_motivo = None
    if fund and fund.monto_maximo_por_gasto and monto > Decimal(str(fund.monto_maximo_por_gasto)):
        auditoria_estado = "observado"
        auditoria_motivo = f"Supera el límite autorizado de Gs. {fund.monto_maximo_por_gasto:,.0f} por comprobante de caja chica."

    cost_center_id = None
    if data.cost_center_id:
        cost_center_id = _safe_uuid(data.cost_center_id)
    elif fund and fund.cost_center_id:
        cost_center_id = fund.cost_center_id

    exp = Expense(
        company_id=cid,
        branch_id=_safe_uuid(data.branch_id) if data.branch_id else (fund.branch_id if fund else None),
        fund_id=fund.id if fund else None,
        category_id=_safe_uuid(data.category_id),
        cost_center_id=cost_center_id,
        monto=monto,
        descripcion=data.descripcion,
        proveedor=data.proveedor,
        comprobante_url=data.comprobante_url,
        tipo_pago=data.tipo_pago or "efectivo",
        fecha_gasto=data.fecha_gasto or date.today(),
        ruc=data.ruc.strip() if data.ruc else None,
        timbrado=data.timbrado.strip() if data.timbrado else None,
        numero_factura=data.numero_factura.strip() if data.numero_factura else None,
        tipo_comprobante=data.tipo_comprobante or "FACTURA_CONTADO",
        gravado_10=grav_10,
        gravado_5=grav_5,
        exentas=exen,
        iva_10=iva_10,
        iva_5=iva_5,
        es_inversion=bool(data.es_inversion),
        vida_util_meses=data.vida_util_meses if data.es_inversion else None,
        categoria_activo=data.categoria_activo if data.es_inversion else None,
        es_pago_proveedor=bool(data.es_pago_proveedor),
        supplier_id=_safe_uuid(data.supplier_id),
        supplier_invoice_id=_safe_uuid(data.supplier_invoice_id),
        es_anticipo_sueldo=bool(data.es_anticipo_sueldo),
        employee_id=str(data.employee_id) if data.employee_id else None,
        employee_nombre=data.employee_nombre,
        employee_ci=data.employee_ci,
        periodo_nomina=data.periodo_nomina,
        cuotas_anticipo=data.cuotas_anticipo or 1,
        sueldok_sync_status="pendiente",
        sueldok_sync_id=str(data.sueldok_sync_id) if getattr(data, "sueldok_sync_id", None) else None,
        monto_brl=Decimal(str(data.monto_brl)) if data.monto_brl else None,
        auditoria_estado=auditoria_estado,
        auditoria_motivo=auditoria_motivo,
        registrado_por=_safe_uuid(user_id),
        estado="pendiente",  # Se carga siempre en pendiente para luego ser aprobado y pagado
        notas=data.notas,
    )
    db.add(exp)
    await db.flush()

    # Si se asocia a facturas comerciales pendientes (multi-factura o legacy single)
    raw_invoice_ids = data.linked_invoice_ids
    if raw_invoice_ids is None and data.supplier_invoice_id:
        raw_invoice_ids = [data.supplier_invoice_id]

    if raw_invoice_ids:
        from api.src.financial.models import SupplierInvoice, SupplierInvoicePayment
        monto_total_exp = monto
        for idx, inv_id_str in enumerate(raw_invoice_ids):
            inv_uuid = _safe_uuid(inv_id_str)
            if not inv_uuid:
                continue
            inv_res = await db.execute(select(SupplierInvoice).where(SupplierInvoice.id == inv_uuid))
            target_inv = inv_res.scalar_one_or_none()
            if not target_inv:
                continue

            saldo_actual = Decimal(str(target_inv.saldo_pendiente or 0))
            if data.linked_invoice_montos and idx < len(data.linked_invoice_montos):
                monto_deseado = Decimal(str(data.linked_invoice_montos[idx]))
            else:
                n_facturas = len(raw_invoice_ids)
                monto_deseado = (monto_total_exp / n_facturas).quantize(Decimal("1"))

            if saldo_actual > Decimal("0"):
                monto_aplicar = min(monto_deseado, saldo_actual)
                target_inv.saldo_pendiente = max(Decimal("0"), saldo_actual - monto_aplicar)
                target_inv.estado = "pagada" if target_inv.saldo_pendiente <= 0 else "parcial"
            else:
                total_inv = Decimal(str(target_inv.total or 0))
                monto_aplicar = min(monto_deseado, total_inv) if total_inv > Decimal("0") else monto_deseado

            monto_aplicar = max(Decimal("0"), monto_aplicar)

            db.add(ExpenseSupplierInvoice(
                expense_id=exp.id,
                supplier_invoice_id=inv_uuid,
                monto_aplicado=monto_aplicar,
                moneda=target_inv.moneda or "PYG",
            ))

            if monto_aplicar > 0:
                payment = SupplierInvoicePayment(
                    invoice_id=target_inv.id,
                    payment_method="fondo_fijo",
                    monto=monto_aplicar,
                    moneda=target_inv.moneda or "PYG",
                    fecha_pago=data.fecha_gasto or date.today(),
                    referencia=f"Comprobante caja chica {data.numero_factura or ''} | multi-factura",
                    petty_cash_fund_id=fund.id if fund else None,
                    estado="conciliado",
                )
                db.add(payment)

            if idx == 0:
                exp.supplier_invoice_id = inv_uuid
                if target_inv.supplier_id:
                    exp.supplier_id = target_inv.supplier_id
                if not exp.numero_factura:
                    exp.numero_factura = target_inv.numero_factura
                if not exp.timbrado:
                    exp.timbrado = target_inv.timbrado

        exp.es_pago_proveedor = True

    await db.commit()
    await db.refresh(exp)
    await _populate_linked_invoices(db, exp)
    return exp


async def disburse_expense(
    db: AsyncSession,
    company_id: str,
    expense_id: str,
    data: ExpenseDisburseRequest,
    user_id: str,
    user_nombre: str | None = None
) -> Expense:
    cid = uuid.UUID(company_id)
    exp = await get_expense(db, expense_id)
    if not exp or str(exp.company_id) != company_id:
        raise HTTPException(status_code=404, detail="Comprobante de gasto no encontrado.")

    if exp.anulado:
        raise HTTPException(status_code=400, detail="El comprobante de gasto está anulado.")
    if exp.estado == "pagado":
        raise HTTPException(status_code=400, detail="El comprobante de gasto ya se encuentra pagado.")
    if exp.estado not in ("aprobado", "pendiente"):
        raise HTTPException(status_code=400, detail=f"No se puede pagar un gasto en estado '{exp.estado}'.")

    if not data.disbursements:
        raise HTTPException(status_code=400, detail="Debe especificar al menos una forma de pago para liquidar el gasto.")

    monto_exp = Decimal(str(exp.monto))
    total_disb = sum(Decimal(str(d.monto)) for d in data.disbursements)
    if total_disb != monto_exp:
        raise HTTPException(
            status_code=400,
            detail=f"La suma de los medios de pago (₲ {total_disb:,.0f}) no coincide exactamente con el monto del gasto (₲ {monto_exp:,.0f})."
        )

    resumen_medios = []
    fecha_efectiva_pago = data.fecha_pago or date.today()

    for d in data.disbursements:
        m_pyg = Decimal(str(d.monto))
        if m_pyg <= Decimal("0"):
            continue
        fp = (d.medio_pago or "").lower().strip()

        # ── A. EFECTIVO BÓVEDA CENTRAL ───────────────────────────────────────
        if fp in ("boveda", "efectivo_boveda"):
            from api.src.caja.models import VaultEntry, CashRegisterMovement
            d_moneda = (d.moneda or "PYG").upper()
            now_dt = datetime.now(TZ_ASUNCION)

            if d_moneda == "BRL":
                q_vault_brl = select(sa_func.coalesce(sa_func.sum(VaultEntry.monto_brl), Decimal("0"))).where(
                    VaultEntry.company_id == cid,
                    VaultEntry.estado == "en_boveda"
                )
                saldo_vault_brl = (await db.execute(q_vault_brl)).scalar() or Decimal("0")
                req_brl = Decimal(str(d.monto_moneda or exp.monto_brl or (m_pyg / (d.tipo_cambio or Decimal("1")))))
                if saldo_vault_brl < req_brl:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Saldo insuficiente en Bóveda Central (Reales). Disponible: R$ {saldo_vault_brl:,.2f} | Requerido: R$ {req_brl:,.2f}"
                    )

                # Consumir entradas FIFO de bóveda en Reales
                entries_res = await db.execute(
                    select(VaultEntry).where(
                        VaultEntry.company_id == cid,
                        VaultEntry.estado == "en_boveda",
                        VaultEntry.monto_brl > Decimal("0")
                    ).order_by(VaultEntry.created_at.asc())
                )
                entries = entries_res.scalars().all()
                remaining_brl = req_brl
                for e in entries:
                    if remaining_brl <= Decimal("0"):
                        break
                    e_brl = Decimal(str(e.monto_brl or 0))
                    if e_brl <= remaining_brl:
                        if (e.monto_pyg and e.monto_pyg > 0) or (e.monto_usd and e.monto_usd > 0):
                            db.add(VaultEntry(
                                company_id=cid,
                                branch_id=e.branch_id,
                                origen="egreso_gasto",
                                handoff_id=e.handoff_id,
                                monto_pyg=Decimal("0"),
                                monto_usd=Decimal("0"),
                                monto_brl=e_brl,
                                estado="egreso_gasto",
                                fecha_deposito=now_dt,
                                observaciones=f"Egreso R$ por Pago Gasto {exp.numero_factura or exp.id} - {exp.proveedor or exp.descripcion}",
                                registrado_por=uuid.UUID(user_id) if user_id else None,
                            ))
                            e.monto_brl = Decimal("0")
                        else:
                            e.estado = "egreso_gasto"
                            e.fecha_deposito = now_dt
                            e.observaciones = f"Egreso R$ por Pago Gasto {exp.numero_factura or exp.id} - {exp.proveedor or exp.descripcion}"
                            if user_id:
                                e.registrado_por = uuid.UUID(user_id)
                        remaining_brl -= e_brl
                    else:
                        db.add(VaultEntry(
                            company_id=cid,
                            branch_id=e.branch_id,
                            origen="egreso_gasto",
                            handoff_id=e.handoff_id,
                            monto_pyg=Decimal("0"),
                            monto_usd=Decimal("0"),
                            monto_brl=remaining_brl,
                            estado="egreso_gasto",
                            fecha_deposito=now_dt,
                            observaciones=f"Egreso parcial R$ por Pago Gasto {exp.numero_factura or exp.id}",
                            registrado_por=uuid.UUID(user_id) if user_id else None,
                        ))
                        e.monto_brl = e_brl - remaining_brl
                        remaining_brl = Decimal("0")
                        break

                from api.src.caja.models import CashRegister
                reg_res = await db.execute(
                    select(CashRegister).where(CashRegister.company_id == cid).order_by(CashRegister.activo.desc(), CashRegister.created_at.asc()).limit(1)
                )
                main_reg = reg_res.scalar_one_or_none()
                if main_reg:
                    db.add(CashRegisterMovement(
                        company_id=cid,
                        register_id=main_reg.id,
                        tipo="retiro",
                        monto=req_brl,
                        moneda="BRL",
                        fecha=now_dt,
                        usuario=user_nombre or "Tesorería",
                        observaciones=f"Pago Gasto R$ {exp.numero_factura or ''} - {exp.proveedor or exp.descripcion}",
                    ))

                db.add(ExpenseDisbursement(
                    company_id=cid,
                    expense_id=exp.id,
                    medio_pago="boveda",
                    monto=m_pyg,
                    moneda="BRL",
                    numero_comprobante=d.numero_comprobante,
                    fecha_efectiva=d.fecha_efectiva or fecha_efectiva_pago,
                    created_by=uuid.UUID(user_id) if user_id else None,
                ))
                resumen_medios.append(f"BOVEDA (R$ {req_brl:,.2f})")
            else:
                q_vault = select(sa_func.coalesce(sa_func.sum(VaultEntry.monto_pyg), Decimal("0"))).where(
                    VaultEntry.company_id == cid,
                    VaultEntry.estado == "en_boveda"
                )
                saldo_vault = (await db.execute(q_vault)).scalar() or Decimal("0")
                if saldo_vault < m_pyg:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Saldo insuficiente en Bóveda Central. Disponible: ₲ {saldo_vault:,.0f} | Requerido: ₲ {m_pyg:,.0f}"
                    )

                # Consumir entradas FIFO de bóveda
                entries_res = await db.execute(
                    select(VaultEntry).where(
                        VaultEntry.company_id == cid,
                        VaultEntry.estado == "en_boveda",
                        VaultEntry.monto_pyg > Decimal("0")
                    ).order_by(VaultEntry.created_at.asc())
                )
                entries = entries_res.scalars().all()

                remaining = m_pyg
                for e in entries:
                    if remaining <= Decimal("0"):
                        break
                    e_monto = Decimal(str(e.monto_pyg or 0))
                    if e_monto <= remaining:
                        if (e.monto_brl and e.monto_brl > 0) or (e.monto_usd and e.monto_usd > 0):
                            db.add(VaultEntry(
                                company_id=cid,
                                branch_id=e.branch_id,
                                origen="egreso_gasto",
                                handoff_id=e.handoff_id,
                                monto_pyg=e_monto,
                                monto_usd=Decimal("0"),
                                monto_brl=Decimal("0"),
                                estado="egreso_gasto",
                                fecha_deposito=now_dt,
                                observaciones=f"Egreso por Pago Gasto {exp.numero_factura or exp.id} - {exp.proveedor or exp.descripcion}",
                                registrado_por=uuid.UUID(user_id) if user_id else None,
                            ))
                            e.monto_pyg = Decimal("0")
                        else:
                            e.estado = "egreso_gasto"
                            e.fecha_deposito = now_dt
                            e.observaciones = f"Egreso por Pago Gasto {exp.numero_factura or exp.id} - {exp.proveedor or exp.descripcion}"
                            if user_id:
                                e.registrado_por = uuid.UUID(user_id)
                        remaining -= e_monto
                    else:
                        db.add(VaultEntry(
                            company_id=cid,
                            branch_id=e.branch_id,
                            origen="egreso_gasto",
                            handoff_id=e.handoff_id,
                            monto_pyg=remaining,
                            monto_usd=Decimal("0"),
                            monto_brl=Decimal("0"),
                            estado="egreso_gasto",
                            fecha_deposito=now_dt,
                            observaciones=f"Egreso parcial por Pago Gasto {exp.numero_factura or exp.id}",
                            registrado_por=uuid.UUID(user_id) if user_id else None,
                        ))
                        e.monto_pyg = e_monto - remaining
                        remaining = Decimal("0")
                        break

                # Movimiento de caja/bóveda
                from api.src.caja.models import CashRegister
                reg_res = await db.execute(
                    select(CashRegister).where(CashRegister.company_id == cid).order_by(CashRegister.activo.desc(), CashRegister.created_at.asc()).limit(1)
                )
                main_reg = reg_res.scalar_one_or_none()

                if main_reg:
                    db.add(CashRegisterMovement(
                        company_id=cid,
                        register_id=main_reg.id,
                        tipo="retiro",
                        monto=m_pyg,
                        moneda="PYG",
                        fecha=now_dt,
                        usuario=user_nombre or "Tesorería",
                        observaciones=f"Pago Gasto {exp.numero_factura or ''} - {exp.proveedor or exp.descripcion}",
                    ))

                db.add(ExpenseDisbursement(
                    company_id=cid,
                    expense_id=exp.id,
                    medio_pago="boveda",
                    monto=m_pyg,
                    moneda="PYG",
                    numero_comprobante=d.numero_comprobante,
                    fecha_efectiva=d.fecha_efectiva or fecha_efectiva_pago,
                    created_by=uuid.UUID(user_id) if user_id else None,
                ))
                resumen_medios.append("BOVEDA")

        # ── B. EFECTIVO FONDO FIJO (CAJA CHICA) ──────────────────────────────
        elif fp in ("fondo_fijo", "caja_chica"):
            target_fund_id = d.petty_cash_fund_id or (str(exp.fund_id) if exp.fund_id else None)
            if not target_fund_id:
                f_res = await db.execute(
                    select(PettyCashFund).where(PettyCashFund.company_id == cid, PettyCashFund.activo == True).limit(1)
                )
                fund_obj = f_res.scalar_one_or_none()
            else:
                fund_obj = await get_fund(db, target_fund_id)

            if not fund_obj:
                raise HTTPException(status_code=400, detail="Fondo Fijo (Caja Chica) no encontrado o inactivo.")

            # Sobregiro permitido mientras se ajustan saldos contables en vivo

            s_ant = Decimal(str(fund_obj.saldo_actual))
            fund_obj.saldo_actual = s_ant - m_pyg
            s_nuevo = fund_obj.saldo_actual

            db.add(PettyCashFundMovement(
                fund_id=fund_obj.id,
                tipo="gasto",
                monto=m_pyg,
                saldo_anterior=s_ant,
                saldo_nuevo=s_nuevo,
                referencia_type="expense",
                referencia_id=exp.id,
                observaciones=f"Pago Gasto: {exp.descripcion} ({exp.proveedor or 'S/P'})",
                created_by=uuid.UUID(user_id) if user_id else None,
            ))

            db.add(ExpenseDisbursement(
                company_id=cid,
                expense_id=exp.id,
                medio_pago="fondo_fijo",
                monto=m_pyg,
                moneda="PYG",
                petty_cash_fund_id=fund_obj.id,
                numero_comprobante=d.numero_comprobante,
                fecha_efectiva=d.fecha_efectiva or fecha_efectiva_pago,
                created_by=uuid.UUID(user_id) if user_id else None,
            ))
            resumen_medios.append(f"FONDO FIJO ({fund_obj.nombre})")

        # ── C. BANCO - TRANSFERENCIA SIPAP ───────────────────────────────────
        elif fp in ("transferencia", "banco_transferencia", "sipap"):
            if not d.bank_account_id:
                raise HTTPException(status_code=400, detail="Debe seleccionar la cuenta bancaria para la transferencia.")

            from api.src.financial.models import BankAccount, BankTransaction
            b_res = await db.execute(
                select(BankAccount).where(BankAccount.id == uuid.UUID(d.bank_account_id), BankAccount.company_id == cid)
            )
            bank_acc = b_res.scalar_one_or_none()
            if not bank_acc:
                raise HTTPException(status_code=400, detail="Cuenta bancaria no encontrada.")

            # Al igual que en pagos a proveedores (AP), se permite debitar la cuenta
            # bancaria aunque opere bajo sobregiro o línea de crédito en cuenta corriente.
            bank_acc.saldo_actual = Decimal(str(bank_acc.saldo_actual)) - m_pyg

            bt = BankTransaction(
                company_id=cid,
                bank_account_id=bank_acc.id,
                fecha=d.fecha_efectiva or fecha_efectiva_pago,
                tipo="debito",
                monto=m_pyg,
                moneda="PYG",
                descripcion=f"Pago Gasto: {exp.descripcion} - {exp.proveedor or ''}",
                referencia=d.numero_comprobante,
                contraparte=exp.proveedor or "Gasto Operativo",
                conciliado=True,
                fecha_conciliacion=datetime.now(timezone.utc),
                categoria="gastos_operativos",
            )
            db.add(bt)

            db.add(ExpenseDisbursement(
                company_id=cid,
                expense_id=exp.id,
                medio_pago="transferencia",
                monto=m_pyg,
                moneda="PYG",
                bank_account_id=bank_acc.id,
                numero_comprobante=d.numero_comprobante,
                fecha_efectiva=d.fecha_efectiva or fecha_efectiva_pago,
                created_by=uuid.UUID(user_id) if user_id else None,
            ))
            resumen_medios.append(f"TRANSFERENCIA ({bank_acc.banco})")

        # ── D. BANCO - CHEQUE EMITIDO (AL DÍA O DIFERIDO) ────────────────────
        elif fp == "cheque":
            if not d.numero_cheque:
                raise HTTPException(status_code=400, detail="Debe ingresar el número de cheque.")

            from api.src.cheques.models import Cheque, ChequeHistorial
            fecha_em = d.fecha_cheque_emision or fecha_efectiva_pago
            fecha_venc = d.fecha_cheque_vencimiento or fecha_em
            es_dif = bool(d.es_cheque_diferido or (fecha_venc > fecha_em))

            cheque = Cheque(
                company_id=cid,
                numero=d.numero_cheque,
                numero_confiable=True,
                banco_emisor=d.banco_cheque or "Banco",
                bank_account_id=uuid.UUID(d.bank_account_id) if d.bank_account_id else None,
                beneficiario=d.titular_cheque or exp.proveedor or "AL PORTADOR",
                tipo_cheque="emitido",
                monto=m_pyg,
                moneda="PYG",
                fecha_emision=fecha_em,
                fecha_entrega=fecha_efectiva_pago,
                fecha_pago=fecha_venc,
                diferido=es_dif,
                estado="pendiente",
                concepto=f"Pago Gasto {exp.numero_factura or exp.id}",
                notas=f"Gasto: {exp.descripcion} - Ref: {d.numero_comprobante or ''}",
                created_by=uuid.UUID(user_id) if user_id else None,
            )
            db.add(cheque)
            await db.flush()

            db.add(ChequeHistorial(
                cheque_id=cheque.id,
                estado_anterior=None,
                estado_nuevo="pendiente",
                user_id=uuid.UUID(user_id) if user_id else None,
                user_nombre=user_nombre or "Tesorería",
                notas=f"Emitido en Pago de Gasto: {exp.descripcion}",
            ))

            db.add(ExpenseDisbursement(
                company_id=cid,
                expense_id=exp.id,
                medio_pago="cheque",
                monto=m_pyg,
                moneda="PYG",
                bank_account_id=uuid.UUID(d.bank_account_id) if d.bank_account_id else None,
                cheque_id=cheque.id,
                numero_comprobante=d.numero_cheque,
                fecha_efectiva=fecha_em,
                detalles={
                    "banco_cheque": d.banco_cheque,
                    "numero_cheque": d.numero_cheque,
                    "fecha_vencimiento": str(fecha_venc),
                    "es_diferido": es_dif,
                    "titular_cheque": d.titular_cheque or exp.proveedor,
                },
                created_by=uuid.UUID(user_id) if user_id else None,
            ))
            resumen_medios.append(f"CHEQUE N° {d.numero_cheque}")

        # ── E. OTRO MEDIO ────────────────────────────────────────────────────
        else:
            db.add(ExpenseDisbursement(
                company_id=cid,
                expense_id=exp.id,
                medio_pago=fp or "otro",
                monto=m_pyg,
                moneda="PYG",
                numero_comprobante=d.numero_comprobante,
                fecha_efectiva=d.fecha_efectiva or fecha_efectiva_pago,
                created_by=uuid.UUID(user_id) if user_id else None,
            ))
            resumen_medios.append((fp or "OTRO").upper())

    # Marcar Gasto como Pagado
    exp.estado = "pagado"
    exp.fecha_pago = fecha_efectiva_pago
    exp.pagado_por = uuid.UUID(user_id) if user_id else None
    exp.pagado_at = datetime.now(timezone.utc)
    exp.forma_pago_resumen = ", ".join(resumen_medios) if resumen_medios else "PAGADO"
    if data.notas:
        exp.notas = (exp.notas or "") + ("\n" if exp.notas else "") + data.notas

    await db.commit()
    await db.refresh(exp)
    exp.disbursements = await list_expense_disbursements(db, str(exp.id))
    return exp


async def list_expense_disbursements(db: AsyncSession, expense_id: str) -> list[ExpenseDisbursement]:
    q = select(ExpenseDisbursement).where(ExpenseDisbursement.expense_id == uuid.UUID(expense_id)).order_by(ExpenseDisbursement.created_at.asc())
    res = await db.execute(q)
    return list(res.scalars().all())



async def _populate_linked_invoices(db: AsyncSession, exp: Expense) -> None:
    if not exp:
        return
    from api.src.financial.models import SupplierInvoice

    links_res = await db.execute(
        select(ExpenseSupplierInvoice).where(ExpenseSupplierInvoice.expense_id == exp.id)
    )
    links = list(links_res.scalars().all())
    if links:
        exp.linked_invoice_ids = [l.supplier_invoice_id for l in links]
        inv_ids = [l.supplier_invoice_id for l in links]
        inv_res = await db.execute(select(SupplierInvoice).where(SupplierInvoice.id.in_(inv_ids)))
        inv_map = {i.id: i for i in inv_res.scalars().all()}
        exp.linked_invoices = [
            {
                "supplier_invoice_id": str(l.supplier_invoice_id),
                "monto_aplicado": float(l.monto_aplicado or 0),
                "moneda": l.moneda,
                "numero_factura": inv_map[l.supplier_invoice_id].numero_factura if l.supplier_invoice_id in inv_map else None,
                "timbrado": inv_map[l.supplier_invoice_id].timbrado if l.supplier_invoice_id in inv_map else None,
                "total": float(inv_map[l.supplier_invoice_id].total or 0) if l.supplier_invoice_id in inv_map else None,
                "saldo_pendiente": float(inv_map[l.supplier_invoice_id].saldo_pendiente or 0) if l.supplier_invoice_id in inv_map else None,
            }
            for l in links
        ]
    elif exp.supplier_invoice_id:
        exp.linked_invoice_ids = [exp.supplier_invoice_id]
        inv_res = await db.execute(select(SupplierInvoice).where(SupplierInvoice.id == exp.supplier_invoice_id))
        inv = inv_res.scalar_one_or_none()
        if inv:
            exp.linked_invoices = [{
                "supplier_invoice_id": str(inv.id),
                "monto_aplicado": float(exp.monto or 0),
                "moneda": inv.moneda,
                "numero_factura": inv.numero_factura,
                "timbrado": inv.timbrado,
                "total": float(inv.total or 0),
                "saldo_pendiente": float(inv.saldo_pendiente or 0),
            }]
        else:
            exp.linked_invoices = []
    else:
        exp.linked_invoice_ids = []
        exp.linked_invoices = []


async def get_expense(db: AsyncSession, expense_id: str) -> Expense | None:
    eid = _safe_uuid(expense_id)
    if not eid:
        return None
    result = await db.execute(select(Expense).where(Expense.id == eid))
    exp = result.scalar_one_or_none()
    if exp:
        exp.disbursements = await list_expense_disbursements(db, str(exp.id))
        await _populate_linked_invoices(db, exp)
    return exp


async def revert_expense_payment(
    db: AsyncSession,
    expense_id: str,
    user_id: str,
    tenant_id: str,
    fund_id: str | None = None,
    nuevo_estado: str = "aprobado",
    motivo: str | None = None,
) -> Expense:
    """Revierte la condición de 'pagado' de un comprobante de gasto (especialmente útil
    para gastos importados del legacy o liquidados previamente) para permitir incluirlo
    en una Rendición de Cuentas de Fondo Fijo o volver a pagarlo con el flujo InteliMarket."""
    exp = await get_expense(db, expense_id)
    if not exp or str(exp.company_id) != tenant_id:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")

    if exp.rendicion_id is not None:
        raise HTTPException(
            status_code=400,
            detail="Este comprobante ya está incluido en un expediente de rendición de cuentas. Debe desvincularlo de la rendición primero."
        )

    # Revertir/limpiar desembolsos registrados si existen
    disb_res = await db.execute(
        select(ExpenseDisbursement).where(ExpenseDisbursement.expense_id == exp.id)
    )
    disbursements = list(disb_res.scalars().all())
    for d in disbursements:
        if d.petty_cash_fund_id:
            fund = await db.get(PettyCashFund, d.petty_cash_fund_id)
            if fund:
                fund.saldo_actual += d.monto
                db.add(PettyCashFundMovement(
                    fund_id=fund.id,
                    tipo="ajuste",
                    monto=d.monto,
                    saldo_anterior=fund.saldo_actual - d.monto,
                    saldo_nuevo=fund.saldo_actual,
                    referencia_type="reversion_pago_gasto",
                    referencia_id=exp.id,
                    observaciones=f"Reversión de pago de gasto: {exp.descripcion}",
                    created_by=uuid.UUID(user_id) if user_id else None,
                ))
        await db.delete(d)

    # Revertir estado y campos de liquidación
    exp.estado = nuevo_estado if nuevo_estado in {"aprobado", "pendiente"} else "aprobado"
    exp.fecha_pago = None
    exp.pagado_por = None
    exp.pagado_at = None
    exp.forma_pago_resumen = None

    if fund_id:
        exp.fund_id = uuid.UUID(fund_id)

    motivo_txt = f" [Reversión de Pago: {motivo}]" if motivo else " [Reversión de Pago / Habilitado para Rendición]"
    exp.notas = ((exp.notas or "") + motivo_txt).strip()

    await db.commit()
    await db.refresh(exp)
    exp.disbursements = []
    return exp


async def revert_expenses_batch(
    db: AsyncSession,
    company_id: str,
    expense_ids: list[str],
    user_id: str,
    fund_id: str | None = None,
    nuevo_estado: str = "aprobado",
    motivo: str | None = None,
) -> dict:
    reverted = []
    errors = []
    for eid in expense_ids:
        try:
            exp = await revert_expense_payment(
                db=db,
                expense_id=eid,
                user_id=user_id,
                tenant_id=company_id,
                fund_id=fund_id,
                nuevo_estado=nuevo_estado,
                motivo=motivo,
            )
            reverted.append(str(exp.id))
        except Exception as err:
            errors.append({"id": eid, "error": str(err)})

    return {
        "success": True,
        "reverted_count": len(reverted),
        "reverted_ids": reverted,
        "errors": errors,
    }


async def batch_assign_invoice(
    db: AsyncSession,
    company_id: str,
    expense_ids: list[str],
    supplier_invoice_id: str,
    notas: str | None = None,
) -> dict:
    from api.src.financial.models import SupplierInvoice, SupplierInvoicePayment
    from api.src.purchases.models import Supplier

    inv_res = await db.execute(
        select(SupplierInvoice).where(
            SupplierInvoice.id == uuid.UUID(str(supplier_invoice_id)),
            SupplierInvoice.company_id == uuid.UUID(str(company_id)),
        )
    )
    target_inv = inv_res.scalar_one_or_none()
    if not target_inv:
        raise ValueError("Factura de compra no encontrada en Cuentas por Pagar.")

    sup_res = await db.execute(select(Supplier).where(Supplier.id == target_inv.supplier_id))
    supplier = sup_res.scalar_one_or_none()
    sup_name = supplier.razon_social or supplier.nombre_fantasia if supplier else None
    sup_ruc = supplier.ruc if supplier else None

    uuids = []
    for eid in expense_ids:
        try:
            uuids.append(uuid.UUID(str(eid)))
        except ValueError:
            pass

    exp_res = await db.execute(
        select(Expense).where(
            Expense.id.in_(uuids),
            Expense.company_id == uuid.UUID(str(company_id)),
        )
    )
    expenses = exp_res.scalars().all()

    assigned = []
    total_aplicado = Decimal("0")

    for exp in expenses:
        if exp.supplier_invoice_id == target_inv.id:
            assigned.append(str(exp.id))
            continue

        monto_gasto = Decimal(str(exp.monto or 0))
        monto_aplicar = min(monto_gasto, target_inv.saldo_pendiente)

        target_inv.saldo_pendiente = max(Decimal("0"), target_inv.saldo_pendiente - monto_aplicar)
        if target_inv.saldo_pendiente <= Decimal("0"):
            target_inv.saldo_pendiente = Decimal("0")
            target_inv.estado = "pagada"
        else:
            target_inv.estado = "parcial"

        if monto_aplicar > 0:
            payment = SupplierInvoicePayment(
                invoice_id=target_inv.id,
                payment_method="fondo_fijo",
                monto=monto_aplicar,
                moneda=target_inv.moneda or "PYG",
                fecha_pago=exp.fecha_gasto or date.today(),
                referencia=f"Imputación agrupada comprobante {exp.numero_factura or str(exp.id)[:8]} ({notas or 'Control interno'})",
                petty_cash_fund_id=exp.fund_id,
                estado="conciliado",
            )
            db.add(payment)
            total_aplicado += monto_aplicar

        exp.es_pago_proveedor = True
        exp.supplier_id = target_inv.supplier_id
        exp.supplier_invoice_id = target_inv.id
        if sup_name:
            exp.proveedor = sup_name
        if sup_ruc:
            exp.ruc = sup_ruc
        if target_inv.numero_factura:
            exp.numero_factura = target_inv.numero_factura
        if target_inv.timbrado:
            exp.timbrado = target_inv.timbrado

        assigned.append(str(exp.id))

    await db.commit()
    await db.refresh(target_inv)

    return {
        "success": True,
        "assigned_count": len(assigned),
        "assigned_ids": assigned,
        "total_aplicado": float(total_aplicado),
        "invoice_saldo_remanente": float(target_inv.saldo_pendiente),
        "invoice_estado": target_inv.estado,
    }




async def list_expenses(
    db: AsyncSession, company_id: str, branch_id: str | None = None,
    fund_id: str | None = None, rendicion_id: str | None = None,
    sin_rendicion: bool | None = None,
    category_id: str | None = None, estado: str | None = None,
    desde: date | None = None, hasta: date | None = None,
    search: str | None = None,
    monto: float | None = None,
    monto_min: float | None = None,
    monto_max: float | None = None,
    limit: int = 100, offset: int = 0, incluir_anulados: bool = False,
) -> list[Expense]:
    query = select(Expense).where(Expense.company_id == uuid.UUID(company_id))
    if not incluir_anulados:
        query = query.where(Expense.anulado == False)
    if fund_id:
        query = query.where(Expense.fund_id == uuid.UUID(fund_id))
    if rendicion_id:
        query = query.where(Expense.rendicion_id == uuid.UUID(rendicion_id))
    if sin_rendicion is True:
        query = query.where(Expense.rendicion_id.is_(None))
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
    if monto is not None:
        query = query.where(Expense.monto == Decimal(str(monto)))
    if monto_min is not None:
        query = query.where(Expense.monto >= Decimal(str(monto_min)))
    if monto_max is not None:
        query = query.where(Expense.monto <= Decimal(str(monto_max)))
    if search:
        s_clean = search.strip()
        conditions = [
            Expense.descripcion.ilike(f"%{s_clean}%"),
            Expense.proveedor.ilike(f"%{s_clean}%"),
            Expense.numero_factura.ilike(f"%{s_clean}%"),
            Expense.timbrado.ilike(f"%{s_clean}%"),
            Expense.ruc.ilike(f"%{s_clean}%"),
        ]
        digits_only = "".join(ch for ch in s_clean if ch.isdigit())
        if digits_only:
            try:
                num_val = Decimal(digits_only)
                conditions.append(Expense.monto == num_val)
            except Exception:
                pass
        query = query.where(or_(*conditions))

    query = query.order_by(Expense.fecha_gasto.desc(), Expense.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    expenses = list(result.scalars().all())
    if expenses:
        exp_ids = [e.id for e in expenses]
        disb_q = select(ExpenseDisbursement).where(ExpenseDisbursement.expense_id.in_(exp_ids)).order_by(ExpenseDisbursement.created_at.asc())
        disb_res = (await db.execute(disb_q)).scalars().all()
        disb_map = {}
        for d in disb_res:
            disb_map.setdefault(d.expense_id, []).append(d)

        rend_ids = list({e.rendicion_id for e in expenses if e.rendicion_id})
        rend_map = {}
        if rend_ids:
            rend_q = select(PettyCashRendicion).where(PettyCashRendicion.id.in_(rend_ids))
            rends = (await db.execute(rend_q)).scalars().all()
            rend_map = {r.id: r for r in rends}

        fund_ids = list({e.fund_id for e in expenses if e.fund_id})
        fund_map = {}
        if fund_ids:
            fund_q = select(PettyCashFund).where(PettyCashFund.id.in_(fund_ids))
            funds = (await db.execute(fund_q)).scalars().all()
            fund_map = {f.id: f for f in funds}

        cc_ids = list({e.cost_center_id for e in expenses if e.cost_center_id})
        cc_map = {}
        if cc_ids:
            cc_q = select(CostCenter).where(CostCenter.id.in_(cc_ids))
            ccs = (await db.execute(cc_q)).scalars().all()
            cc_map = {c.id: c.nombre for c in ccs}

        for e in expenses:
            e.disbursements = disb_map.get(e.id, [])
            rend = rend_map.get(e.rendicion_id)
            if rend:
                e.rendicion_numero = rend.numero_rendicion
                e.rendicion_estado = rend.estado
                e.rendicion_fecha = rend.fecha_presentacion or rend.created_at
            else:
                e.rendicion_numero = None
                e.rendicion_estado = None
                e.rendicion_fecha = None
            fund = fund_map.get(e.fund_id)
            e.fund_nombre = fund.nombre if fund else None
            e.cost_center_nombre = cc_map.get(e.cost_center_id)

    return expenses



async def recalculate_rendicion(db: AsyncSession, rendicion_id: uuid.UUID | str):
    rid = uuid.UUID(str(rendicion_id))
    rend = await db.get(PettyCashRendicion, rid)
    if not rend:
        return
    q_all = select(Expense).where(
        Expense.rendicion_id == rid,
        Expense.company_id == rend.company_id,
        Expense.anulado == False,
    )
    expenses = list((await db.execute(q_all)).scalars().all())

    tot_presentado = sum(Decimal(str(e.monto)) for e in expenses)
    aprobados = [e for e in expenses if e.auditoria_estado != "rechazado"]
    rechazados = [e for e in expenses if e.auditoria_estado == "rechazado"]

    rend.total_comprobantes_presentados = tot_presentado
    rend.total_comprobantes_aprobados = sum(Decimal(str(e.monto)) for e in aprobados)
    rend.total_comprobantes_rechazados = sum(Decimal(str(e.monto)) for e in rechazados)
    rend.total_gravado_10 = sum(Decimal(str(e.gravado_10 or 0)) for e in aprobados)
    rend.total_gravado_5 = sum(Decimal(str(e.gravado_5 or 0)) for e in aprobados)
    rend.total_exentas = sum(Decimal(str(e.exentas or 0)) for e in aprobados)
    rend.total_iva_10 = sum(Decimal(str(e.iva_10 or 0)) for e in aprobados)
    rend.total_iva_5 = sum(Decimal(str(e.iva_5 or 0)) for e in aprobados)
    rend.total_inversion_activos = sum(Decimal(str(e.monto)) for e in aprobados if e.es_inversion)
    rend.total_gasto_operativo = sum(Decimal(str(e.monto)) for e in aprobados if not e.es_inversion)
    rend.diferencia_arqueo = (Decimal(str(rend.efectivo_remanente_contado or 0)) + tot_presentado) - Decimal(str(rend.monto_fondo_autorizado))


async def update_expense(db: AsyncSession, expense_id: str, data: ExpenseUpdate) -> Expense | None:
    exp = await get_expense(db, expense_id)
    if not exp:
        return None

    old_rendicion_id = exp.rendicion_id
    if exp.rendicion_id is not None:
        rend = await db.get(PettyCashRendicion, exp.rendicion_id)
        if rend and rend.estado == "pagada":
            raise ValueError("Operación denegada: Este comprobante forma parte de una rendición que ya ha sido pagada y cerrada.")

    update_data = data.model_dump(exclude_unset=True)

    # Permitir cambiar o desvincular de fondo
    if "fund_id" in update_data:
        new_fid_str = update_data.pop("fund_id")
        new_fid = uuid.UUID(new_fid_str) if new_fid_str else None
        if new_fid != exp.fund_id:
            if exp.fund_id and not exp.anulado:
                old_f = await get_fund(db, str(exp.fund_id))
                if old_f:
                    old_f.saldo_actual = Decimal(str(old_f.saldo_actual)) + Decimal(str(exp.monto))
            if new_fid and not exp.anulado:
                new_f = await get_fund(db, str(new_fid))
                if new_f:
                    new_f.saldo_actual = Decimal(str(new_f.saldo_actual)) - Decimal(str(exp.monto))
            exp.fund_id = new_fid

    # Permitir desvincular o mover de rendición
    new_rend_to_recalc = None
    if "rendicion_id" in update_data:
        new_rid_str = update_data.pop("rendicion_id")
        new_rid = uuid.UUID(new_rid_str) if new_rid_str else None
        if new_rid != exp.rendicion_id:
            if new_rid is not None:
                new_rend = await db.get(PettyCashRendicion, new_rid)
                if new_rend and new_rend.estado == "pagada":
                    raise ValueError("No se puede asignar el comprobante a una rendición que ya fue pagada.")
                new_rend_to_recalc = new_rid
            exp.rendicion_id = new_rid

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

    # Convertir UUIDs
    for field in ("cost_center_id", "category_id", "supplier_id", "supplier_invoice_id"):
        if field in update_data:
            val = update_data[field]
            update_data[field] = _safe_uuid(val)

    if "employee_id" in update_data:
        val = update_data["employee_id"]
        update_data["employee_id"] = str(val) if val else None

    # Si se reclasifica como anticipo de sueldo:
    if update_data.get("es_anticipo_sueldo"):
        update_data["es_pago_proveedor"] = False
        update_data["supplier_id"] = None
        update_data["supplier_invoice_id"] = None
        update_data["tipo_comprobante"] = "RECIBO"
        update_data["gravado_10"] = Decimal("0")
        update_data["gravado_5"] = Decimal("0")
        update_data["iva_10"] = Decimal("0")
        update_data["iva_5"] = Decimal("0")
        current_monto = Decimal(str(update_data.get("monto") if update_data.get("monto") is not None else exp.monto))
        update_data["exentas"] = current_monto
        if update_data.get("employee_nombre"):
            update_data["proveedor"] = update_data["employee_nombre"]
        if update_data.get("employee_ci"):
            update_data["ruc"] = update_data["employee_ci"]

    # ── Vinculación Multi-Factura (N:M) ────────────────────────────────────────
    # Soporta linked_invoice_ids[] (nueva API multi-factura) Y supplier_invoice_id
    # (retrocompatibilidad). Si llega linked_invoice_ids, tiene prioridad total.
    from api.src.financial.models import SupplierInvoice, SupplierInvoicePayment
    from api.src.purchases.models import Supplier
    from api.src.petty_cash.models import ExpenseSupplierInvoice

    grouped_ids = update_data.pop("grouped_expense_ids", None)
    linked_invoice_ids_raw: list | None = update_data.pop("linked_invoice_ids", None)
    linked_invoice_montos_raw: list | None = update_data.pop("linked_invoice_montos", None)

    # Normalizar: si viene supplier_invoice_id solo (retrocompat), convertir a lista
    target_invoice_id_single = update_data.get("supplier_invoice_id")
    if linked_invoice_ids_raw is None and target_invoice_id_single is not None:
        linked_invoice_ids_raw = [str(target_invoice_id_single)] if target_invoice_id_single else []

    use_multi_invoice = linked_invoice_ids_raw is not None

    if use_multi_invoice:
        # ── PASO 1: Desvincular TODAS las facturas previas de este gasto ──────
        old_links_res = await db.execute(
            select(ExpenseSupplierInvoice).where(ExpenseSupplierInvoice.expense_id == exp.id)
        )
        old_links = list(old_links_res.scalars().all())
        old_link_invoice_ids = {str(ol.supplier_invoice_id) for ol in old_links}

        for old_link in old_links:
            old_inv_res = await db.execute(
                select(SupplierInvoice).where(SupplierInvoice.id == old_link.supplier_invoice_id)
            )
            old_inv = old_inv_res.scalar_one_or_none()
            if old_inv:
                monto_restituir = Decimal(str(old_link.monto_aplicado or 0))
                old_inv.saldo_pendiente = min(
                    Decimal(str(old_inv.total or 0)),
                    Decimal(str(old_inv.saldo_pendiente or 0)) + monto_restituir
                )
                old_inv.estado = "pendiente" if old_inv.saldo_pendiente >= Decimal(str(old_inv.total or 0)) else "parcial"
                await db.execute(
                    update(SupplierInvoicePayment)
                    .where(
                        SupplierInvoicePayment.invoice_id == old_link.supplier_invoice_id,
                        SupplierInvoicePayment.referencia.ilike(f"%{exp.id}%")
                    )
                    .values(estado="anulado")
                )
            await db.delete(old_link)

        # Restaurar saldo de supplier_invoice_id legacy si no estaba en la tabla join
        if exp.supplier_invoice_id and str(exp.supplier_invoice_id) not in old_link_invoice_ids:
            legacy_inv_res = await db.execute(
                select(SupplierInvoice).where(SupplierInvoice.id == exp.supplier_invoice_id)
            )
            legacy_inv = legacy_inv_res.scalar_one_or_none()
            if legacy_inv:
                monto_legacy = Decimal(str(exp.monto or 0))
                legacy_inv.saldo_pendiente = min(
                    Decimal(str(legacy_inv.total or 0)),
                    Decimal(str(legacy_inv.saldo_pendiente or 0)) + monto_legacy
                )
                legacy_inv.estado = "pendiente" if legacy_inv.saldo_pendiente >= Decimal(str(legacy_inv.total or 0)) else "parcial"
                await db.execute(
                    update(SupplierInvoicePayment)
                    .where(
                        SupplierInvoicePayment.invoice_id == exp.supplier_invoice_id,
                        SupplierInvoicePayment.referencia.ilike(f"%{exp.id}%")
                    )
                    .values(estado="anulado")
                )

        exp.supplier_invoice_id = None
        update_data["supplier_invoice_id"] = None
        await db.flush()

        # ── PASO 2: Vincular cada factura de la nueva lista ───────────────────
        new_ids = [iid for iid in linked_invoice_ids_raw if iid]
        monto_total_exp = Decimal(str(update_data.get("monto") if update_data.get("monto") is not None else exp.monto or 0))
        first_supplier_id = None
        first_supplier_name = None
        first_supplier_ruc = None
        first_inv_factura = None
        first_inv_timbrado = None

        for idx, inv_id_str in enumerate(new_ids):
            try:
                inv_uuid = uuid.UUID(str(inv_id_str))
            except ValueError:
                continue

            inv_res = await db.execute(select(SupplierInvoice).where(SupplierInvoice.id == inv_uuid))
            inv = inv_res.scalar_one_or_none()
            if not inv:
                continue

            # Monto a aplicar: usa el indicado por la UI o distribuye equitativamente
            saldo_actual = Decimal(str(inv.saldo_pendiente or 0))
            if linked_invoice_montos_raw and idx < len(linked_invoice_montos_raw):
                monto_deseado = Decimal(str(linked_invoice_montos_raw[idx]))
            else:
                n_facturas = len(new_ids)
                monto_deseado = (monto_total_exp / n_facturas).quantize(Decimal("1"))

            if saldo_actual > Decimal("0"):
                monto_aplicar = min(monto_deseado, saldo_actual)
                inv.saldo_pendiente = max(Decimal("0"), saldo_actual - monto_aplicar)
                inv.estado = "pagada" if inv.saldo_pendiente <= 0 else "parcial"
            else:
                total_inv = Decimal(str(inv.total or 0))
                monto_aplicar = min(monto_deseado, total_inv) if total_inv > Decimal("0") else monto_deseado

            monto_aplicar = max(Decimal("0"), monto_aplicar)

            db.add(ExpenseSupplierInvoice(
                expense_id=exp.id,
                supplier_invoice_id=inv_uuid,
                monto_aplicado=monto_aplicar,
                moneda=inv.moneda or "PYG",
            ))

            if monto_aplicar > 0:
                db.add(SupplierInvoicePayment(
                    invoice_id=inv.id,
                    payment_method="fondo_fijo",
                    monto=monto_aplicar,
                    moneda=inv.moneda or "PYG",
                    fecha_pago=exp.fecha_gasto or date.today(),
                    referencia=f"Comprobante gasto {exp.numero_factura or str(exp.id)[:8]} | multi-factura",
                    petty_cash_fund_id=exp.fund_id,
                    estado="conciliado",
                ))

            if idx == 0:
                exp.supplier_invoice_id = inv_uuid
                update_data["supplier_invoice_id"] = inv_uuid
                if inv.supplier_id:
                    sup_res = await db.execute(select(Supplier).where(Supplier.id == inv.supplier_id))
                    supplier = sup_res.scalar_one_or_none()
                    first_supplier_id = inv.supplier_id
                    first_supplier_name = (supplier.razon_social or supplier.nombre_fantasia) if supplier else None
                    first_supplier_ruc = supplier.ruc if supplier else None
                first_inv_factura = inv.numero_factura
                first_inv_timbrado = inv.timbrado

        if new_ids:
            update_data["es_pago_proveedor"] = True
            if first_supplier_id:
                update_data["supplier_id"] = first_supplier_id
            if first_supplier_name and not update_data.get("proveedor"):
                update_data["proveedor"] = first_supplier_name
            if first_supplier_ruc and not update_data.get("ruc"):
                update_data["ruc"] = first_supplier_ruc
            if len(new_ids) == 1:
                if first_inv_factura and not update_data.get("numero_factura"):
                    update_data["numero_factura"] = first_inv_factura
                if first_inv_timbrado and not update_data.get("timbrado"):
                    update_data["timbrado"] = first_inv_timbrado
        else:
            update_data["es_pago_proveedor"] = False
            update_data["supplier_id"] = None
            update_data["supplier_invoice_id"] = None

        # Agrupación de comprobantes adicionales
        if grouped_ids and new_ids:
            first_inv_uuid = uuid.UUID(str(new_ids[0]))
            t_res = await db.execute(select(SupplierInvoice).where(SupplierInvoice.id == first_inv_uuid))
            t_inv = t_res.scalar_one_or_none()
            if t_inv:
                for gid in grouped_ids:
                    if str(gid) == str(exp.id):
                        continue
                    try:
                        g_uuid = uuid.UUID(str(gid))
                    except ValueError:
                        continue
                    g_res = await db.execute(select(Expense).where(Expense.id == g_uuid))
                    g_exp = g_res.scalar_one_or_none()
                    if g_exp and g_exp.supplier_invoice_id != first_inv_uuid:
                        g_monto = Decimal(str(g_exp.monto or 0))
                        g_aplicar = min(g_monto, Decimal(str(t_inv.saldo_pendiente or 0)))
                        t_inv.saldo_pendiente = max(Decimal("0"), Decimal(str(t_inv.saldo_pendiente or 0)) - g_aplicar)
                        t_inv.estado = "pagada" if t_inv.saldo_pendiente <= 0 else "parcial"
                        if g_aplicar > 0:
                            db.add(SupplierInvoicePayment(
                                invoice_id=t_inv.id, payment_method="fondo_fijo", monto=g_aplicar,
                                moneda=t_inv.moneda or "PYG", fecha_pago=g_exp.fecha_gasto or date.today(),
                                referencia=f"Imputación agrupada {g_exp.numero_factura or str(g_exp.id)[:8]}",
                                petty_cash_fund_id=g_exp.fund_id, estado="conciliado",
                            ))
                        g_exp.es_pago_proveedor = True
                        g_exp.supplier_id = t_inv.supplier_id
                        g_exp.supplier_invoice_id = first_inv_uuid
                        if first_supplier_name:
                            g_exp.proveedor = first_supplier_name
                        if first_supplier_ruc:
                            g_exp.ruc = first_supplier_ruc

    for field, value in update_data.items():
        if value is not None or field in ("supplier_invoice_id", "supplier_id"):
            setattr(exp, field, value)

    await db.flush()

    if old_rendicion_id:
        await recalculate_rendicion(db, old_rendicion_id)
    if new_rend_to_recalc and new_rend_to_recalc != old_rendicion_id:
        await recalculate_rendicion(db, new_rend_to_recalc)

    await db.commit()
    await db.refresh(exp)
    await _populate_linked_invoices(db, exp)
    return exp


async def delete_expense(db: AsyncSession, expense_id: str) -> bool:
    exp = await get_expense(db, expense_id)
    if not exp:
        return False

    old_rend_id = exp.rendicion_id
    if exp.rendicion_id is not None:
        rend = await db.get(PettyCashRendicion, exp.rendicion_id)
        if rend and rend.estado == "pagada":
            raise ValueError("Operación denegada: Este comprobante forma parte de una rendición que ya ha sido pagada y cerrada.")

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
    await db.flush()
    if old_rend_id:
        await recalculate_rendicion(db, old_rend_id)
    await db.commit()
    return True


async def unlink_expense_from_rendicion(
    db: AsyncSession, company_id: str, rendicion_id: str, expense_id: str, user_id: str
) -> dict:
    cid = uuid.UUID(company_id)
    rid = uuid.UUID(rendicion_id)
    eid = uuid.UUID(expense_id)

    rend = await db.get(PettyCashRendicion, rid)
    if not rend or rend.company_id != cid:
        raise ValueError("Rendición no encontrada")
    if rend.estado == "pagada":
        raise ValueError("No se pueden quitar comprobantes de una rendición que ya fue pagada")

    exp_res = await db.execute(
        select(Expense).where(Expense.id == eid, Expense.rendicion_id == rid, Expense.company_id == cid)
    )
    exp = exp_res.scalar_one_or_none()
    if not exp:
        raise ValueError("El comprobante no pertenece a esta rendición")

    exp.rendicion_id = None
    exp.auditoria_estado = "pendiente"
    await db.flush()

    await recalculate_rendicion(db, rid)
    await db.commit()

    return {
        "success": True,
        "rendicion_id": str(rid),
        "expense_id": str(eid),
        "message": "Comprobante desvinculado de la rendición exitosamente",
    }


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
    if exp.rendicion_id is not None:
        return {"error": "Operación denegada: Este comprobante ya está incluido en un expediente de rendición de cuentas."}
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
        .where(Expense.company_id == cid, Expense.anulado == False, Expense.es_pago_proveedor == False, Expense.fecha_gasto == today)
    )
    total_dia = float(r1.scalar())

    # Weekly total (lunes a hoy)
    week_start = today - timedelta(days=today.weekday())
    r2 = await db.execute(
        select(sa_func.coalesce(sa_func.sum(Expense.monto), 0))
        .where(Expense.company_id == cid, Expense.anulado == False, Expense.es_pago_proveedor == False, Expense.fecha_gasto >= week_start)
    )
    total_semana = float(r2.scalar())

    # Monthly total
    month_start = today.replace(day=1)
    r3 = await db.execute(
        select(sa_func.coalesce(sa_func.sum(Expense.monto), 0))
        .where(Expense.company_id == cid, Expense.anulado == False, Expense.es_pago_proveedor == False, Expense.fecha_gasto >= month_start)
    )
    total_mes = float(r3.scalar())

    # By category
    r4 = await db.execute(
        select(Expense.category_id, sa_func.sum(Expense.monto))
        .where(Expense.company_id == cid, Expense.anulado == False, Expense.es_pago_proveedor == False, Expense.fecha_gasto >= month_start)
        .group_by(Expense.category_id)
    )
    por_categoria = [{"category_id": str(k) if k else None, "total": float(v)} for k, v in r4.all()]

    # By branch
    r5 = await db.execute(
        select(Expense.branch_id, sa_func.sum(Expense.monto))
        .where(Expense.company_id == cid, Expense.anulado == False, Expense.es_pago_proveedor == False, Expense.fecha_gasto >= month_start)
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


# ── Reportes Especializados de Fondos Fijos y Rendiciones ─────────────────────

async def get_expenses_by_sector_report(
    db: AsyncSession, company_id: str, fecha_desde: date, fecha_hasta: date
) -> dict:
    cid = uuid.UUID(company_id)
    cost_centers = await list_cost_centers(db, company_id)

    # 1. Agrupación directa por centro de costo
    r_sector = await db.execute(
        select(Expense.cost_center_id, sa_func.sum(Expense.monto))
        .where(
            Expense.company_id == cid,
            Expense.anulado == False,
            Expense.fecha_gasto >= fecha_desde,
            Expense.fecha_gasto <= fecha_hasta,
        )
        .group_by(Expense.cost_center_id)
    )
    directo_by_cc = {cc_id: Decimal(str(total)) for cc_id, total in r_sector.all()}

    sectores_activos = [cc for cc in cost_centers if cc.tipo == "sector"]
    global_pool = sum((directo_by_cc.get(cc.id, Decimal("0")) for cc in cost_centers if cc.tipo == "global"), Decimal("0"))
    peso_total = sum((cc.peso_prorateo for cc in sectores_activos), Decimal("0"))

    total_periodo = await _sum_expenses(db, cid, fecha_desde, fecha_hasta)
    sin_asignar = directo_by_cc.get(None, Decimal("0"))

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

    # 2. Detalle de comprobantes con sus imputaciones
    q_detalle = (
        select(
            Expense.id,
            Expense.fecha_gasto,
            Expense.descripcion,
            Expense.proveedor,
            Expense.monto,
            Expense.comprobante_url,
            Expense.tipo_pago,
            Expense.estado,
            Expense.notas,
            CostCenter.nombre.label("sector_nombre"),
            PettyCashFund.nombre.label("fund_nombre"),
            ExpenseCategory.nombre.label("categoria_nombre"),
        )
        .outerjoin(CostCenter, Expense.cost_center_id == CostCenter.id)
        .outerjoin(PettyCashFund, Expense.fund_id == PettyCashFund.id)
        .outerjoin(ExpenseCategory, Expense.category_id == ExpenseCategory.id)
        .where(
            Expense.company_id == cid,
            Expense.anulado == False,
            Expense.fecha_gasto >= fecha_desde,
            Expense.fecha_gasto <= fecha_hasta,
        )
        .order_by(Expense.fecha_gasto.desc(), Expense.created_at.desc())
    )
    res_det = await db.execute(q_detalle)
    detalle_gastos = []
    for row in res_det.mappings().all():
        detalle_gastos.append({
            "id": str(row["id"]),
            "fecha_gasto": row["fecha_gasto"],
            "descripcion": row["descripcion"],
            "proveedor": row["proveedor"],
            "monto": float(row["monto"] or 0),
            "comprobante_url": row["comprobante_url"],
            "tipo_pago": row["tipo_pago"],
            "estado": row["estado"],
            "notas": row["notas"],
            "sector_nombre": row["sector_nombre"],
            "fund_nombre": row["fund_nombre"],
            "categoria_nombre": row["categoria_nombre"],
        })

    return {
        "fecha_desde": fecha_desde,
        "fecha_hasta": fecha_hasta,
        "total_periodo": float(total_periodo),
        "por_sector": por_sector,
        "sin_asignar": float(sin_asignar),
        "total_gastos_count": len(detalle_gastos),
        "detalle_gastos": detalle_gastos,
    }


async def get_funds_detailed_summary(db: AsyncSession, company_id: str) -> list[dict]:
    funds_raw = await list_funds(db, company_id)
    summary = []
    for f in funds_raw:
        aut = float(f.get("monto_autorizado") or 0)
        sal = float(f.get("saldo_actual") or 0)
        gast = aut - sal
        liq = (sal / aut * 100) if aut > 0 else 0.0
        
        if not f.get("activo", True):
            estado_desc = "INACTIVO"
        elif liq < 20.0:
            estado_desc = "CRÍTICO (REPONER)"
        elif liq < 40.0:
            estado_desc = "PREVENTIVO"
        else:
            estado_desc = "NORMAL (ÓPTIMO)"

        summary.append({
            "id": str(f["id"]),
            "nombre": f["nombre"],
            "branch_id": str(f["branch_id"]) if f.get("branch_id") else None,
            "branch_nombre": f.get("branch_nombre"),
            "custodio_id": str(f["custodio_id"]) if f.get("custodio_id") else None,
            "custodio_nombre": f.get("custodio_nombre"),
            "monto_autorizado": aut,
            "saldo_actual": sal,
            "gastado": gast,
            "liquidez_pct": round(liq, 1),
            "alerta_reposicion": liq < 20.0,
            "estado_desc": estado_desc,
            "activo": f.get("activo", True),
            "created_at": f.get("created_at"),
        })
    # Mostramos primero los fondos con menor liquidez
    summary.sort(key=lambda x: (not x["activo"], x["liquidez_pct"]))
    return summary


async def get_fiscal_purchases_report(
    db: AsyncSession, company_id: str, fecha_desde: date, fecha_hasta: date, fund_id: str | None = None
) -> dict:
    cid = uuid.UUID(company_id)
    query = (
        select(
            Expense.id,
            Expense.fecha_gasto,
            Expense.descripcion,
            Expense.proveedor,
            Expense.monto,
            Expense.notas,
            CostCenter.nombre.label("sector_nombre"),
            PettyCashFund.nombre.label("fund_nombre"),
        )
        .outerjoin(CostCenter, Expense.cost_center_id == CostCenter.id)
        .outerjoin(PettyCashFund, Expense.fund_id == PettyCashFund.id)
        .where(
            Expense.company_id == cid,
            Expense.anulado == False,
            Expense.fecha_gasto >= fecha_desde,
            Expense.fecha_gasto <= fecha_hasta,
        )
    )
    if fund_id:
        query = query.where(Expense.fund_id == uuid.UUID(fund_id))

    query = query.order_by(Expense.fecha_gasto.asc(), Expense.created_at.asc())
    rows = (await db.execute(query)).mappings().all()

    items = []
    tot_general = 0.0
    tot_grav10 = 0.0
    tot_iva10 = 0.0
    tot_iva5 = 0.0
    tot_exentas = 0.0

    for r in rows:
        monto = float(r["monto"] or 0)
        tot_general += monto
        notas_str = r["notas"] or ""
        
        # Extracción de campos fiscales estructurados o cálculo estándar
        fiscal_data = {}
        if notas_str.strip().startswith("{") and notas_str.strip().endswith("}"):
            try:
                fiscal_data = json.loads(notas_str)
            except Exception:
                fiscal_data = {}

        ruc = fiscal_data.get("ruc")
        timbrado = fiscal_data.get("timbrado")
        nro_factura = fiscal_data.get("numero_factura")

        # Discriminación impositiva
        iva_10_val = fiscal_data.get("iva_10")
        iva_5_val = fiscal_data.get("iva_5")
        exentas_val = fiscal_data.get("exentas")

        desc_lower = (r["descripcion"] or "").lower()
        if exentas_val is not None and exentas_val > 0:
            ex = float(exentas_val)
            g10 = monto - ex
            i10 = round(g10 / 11) if g10 > 0 else 0.0
            g10 = g10 - i10
            i5 = 0.0
        elif any(k in desc_lower for k in ["combustible", "nafta", "diesel", "gasoil", "peaje", "exenta"]):
            # Combustibles y tasas en Paraguay son exentas de IVA crédito
            ex = monto
            g10 = 0.0
            i10 = 0.0
            i5 = 0.0
        elif iva_10_val is not None:
            i10 = float(iva_10_val)
            g10 = monto - i10
            i5 = float(iva_5_val or 0)
            ex = float(exentas_val or 0)
        else:
            # Estándar IVA 10% incluido en el total
            i10 = round(monto / 11)
            g10 = monto - i10
            i5 = 0.0
            ex = 0.0

        tot_grav10 += g10
        tot_iva10 += i10
        tot_iva5 += i5
        tot_exentas += ex

        items.append({
            "id": str(r["id"]),
            "fecha": r["fecha_gasto"],
            "ruc": ruc or "—",
            "proveedor": r["proveedor"] or "Varios",
            "numero_factura": nro_factura or "S/N",
            "timbrado": timbrado or "—",
            "sector": r["sector_nombre"] or "General",
            "fund_nombre": r["fund_nombre"] or "Caja Chica",
            "descripcion": r["descripcion"],
            "gravada_10": g10,
            "iva_10": i10,
            "iva_5": i5,
            "exentas": ex,
            "total": monto,
        })

    return {
        "fecha_desde": fecha_desde,
        "fecha_hasta": fecha_hasta,
        "total_general": tot_general,
        "total_gravada_10": tot_grav10,
        "total_iva_10": tot_iva10,
        "total_iva_5": tot_iva5,
        "total_exentas": tot_exentas,
        "items": items,
    }


async def get_fund_rendicion_data(db: AsyncSession, company_id: str, fund_id: str) -> dict:
    fund = await get_fund(db, fund_id)
    if not fund or str(fund.company_id) != company_id:
        return {"error": "Fondo no encontrado"}

    custodio_nombre = await _get_user_nombre(db, str(fund.custodio_id)) if fund.custodio_id else "Sin asignar"
    fund_dict = {
        "id": str(fund.id),
        "nombre": fund.nombre,
        "custodio_nombre": custodio_nombre,
        "monto_autorizado": float(fund.monto_autorizado),
        "saldo_actual": float(fund.saldo_actual),
        "gastado": float(fund.monto_autorizado - fund.saldo_actual),
    }

    q_expenses = (
        select(
            Expense.id,
            Expense.fecha_gasto,
            Expense.descripcion,
            Expense.proveedor,
            Expense.monto,
            CostCenter.nombre.label("sector_nombre"),
        )
        .outerjoin(CostCenter, Expense.cost_center_id == CostCenter.id)
        .where(
            Expense.fund_id == fund.id,
            Expense.anulado == False,
            Expense.estado != "rechazado",
        )
        .order_by(Expense.fecha_gasto.asc(), Expense.created_at.asc())
        .limit(100)
    )
    rows = (await db.execute(q_expenses)).mappings().all()
    expenses = [
        {
            "id": str(r["id"]),
            "fecha_gasto": r["fecha_gasto"],
            "descripcion": r["descripcion"],
            "proveedor": r["proveedor"],
            "monto": float(r["monto"] or 0),
            "sector_nombre": r["sector_nombre"],
        }
        for r in rows
    ]

    return {
        "fund": fund_dict,
        "expenses": expenses,
    }


# ── Rendición de Cuentas y Solicitud de Reposición Formal ───────────────────

async def create_rendicion(db: AsyncSession, company_id: str, data: PettyCashRendicionCreate, user_id: str) -> dict:
    cid = uuid.UUID(company_id)
    fid = uuid.UUID(data.fund_id)
    fund = await get_fund(db, data.fund_id)
    if not fund or str(fund.company_id) != company_id:
        raise ValueError("Fondo fijo no encontrado")

    if not data.expense_ids:
        raise ValueError("Debe incluir al menos un comprobante en la rendición de cuentas")

    expense_uuids = [uuid.UUID(eid) for eid in data.expense_ids]
    q_exp = select(Expense).where(
        Expense.id.in_(expense_uuids),
        Expense.fund_id == fid,
        Expense.company_id == cid,
        Expense.anulado == False,
    )
    expenses = list((await db.execute(q_exp)).scalars().all())
    if not expenses:
        raise ValueError("Ninguno de los comprobantes seleccionados es válido para este fondo")

    for e in expenses:
        if e.rendicion_id is not None:
            raise ValueError(f"El comprobante '{e.descripcion}' ya forma parte de otra rendición.")

    now = datetime.now(TZ_ASUNCION)
    periodo_prefix = f"REND-{now.strftime('%Y%m')}-"
    cnt_res = await db.execute(
        select(sa_func.count(PettyCashRendicion.id)).where(
            PettyCashRendicion.company_id == cid,
            PettyCashRendicion.numero_rendicion.like(f"{periodo_prefix}%"),
        )
    )
    seq = (cnt_res.scalar_one() or 0) + 1
    numero_rendicion = f"{periodo_prefix}{seq:04d}"

    tot_presentado = sum(Decimal(str(e.monto)) for e in expenses)
    tot_g10 = sum(Decimal(str(e.gravado_10 or 0)) for e in expenses)
    tot_g5 = sum(Decimal(str(e.gravado_5 or 0)) for e in expenses)
    tot_ex = sum(Decimal(str(e.exentas or 0)) for e in expenses)
    tot_iva10 = sum(Decimal(str(e.iva_10 or 0)) for e in expenses)
    tot_iva5 = sum(Decimal(str(e.iva_5 or 0)) for e in expenses)
    tot_inv = sum(Decimal(str(e.monto)) for e in expenses if e.es_inversion)
    tot_gas = sum(Decimal(str(e.monto)) for e in expenses if not e.es_inversion)

    efectivo_rem = Decimal(str(data.efectivo_remanente_contado or 0))
    diferencia = (efectivo_rem + tot_presentado) - Decimal(str(fund.monto_autorizado))

    custodio_nombre = await _get_user_nombre(db, str(fund.custodio_id or user_id)) or "Custodio"

    rendicion = PettyCashRendicion(
        company_id=cid,
        fund_id=fid,
        numero_rendicion=numero_rendicion,
        custodio_id=fund.custodio_id or uuid.UUID(user_id),
        custodio_nombre=custodio_nombre,
        estado="presentada",
        monto_fondo_autorizado=fund.monto_autorizado,
        efectivo_remanente_contado=efectivo_rem,
        total_comprobantes_presentados=tot_presentado,
        total_comprobantes_aprobados=tot_presentado,
        total_comprobantes_rechazados=Decimal("0"),
        diferencia_arqueo=diferencia,
        total_gravado_10=tot_g10,
        total_gravado_5=tot_g5,
        total_exentas=tot_ex,
        total_iva_10=tot_iva10,
        total_iva_5=tot_iva5,
        total_inversion_activos=tot_inv,
        total_gasto_operativo=tot_gas,
        fecha_presentacion=now,
        observaciones_custodio=data.observaciones,
    )
    db.add(rendicion)
    await db.flush()

    for e in expenses:
        e.rendicion_id = rendicion.id
        if e.auditoria_estado == "pendiente":
            e.auditoria_estado = "presentado"

    await db.commit()
    await db.refresh(rendicion)

    return {
        "success": True,
        "rendicion_id": str(rendicion.id),
        "numero_rendicion": rendicion.numero_rendicion,
        "total_presentado": float(tot_presentado),
        "diferencia_arqueo": float(diferencia),
    }


async def list_rendiciones(
    db: AsyncSession, company_id: str, fund_id: str | None = None, estado: str | None = None
) -> list[dict]:
    cid = uuid.UUID(company_id)
    q = (
        select(PettyCashRendicion, PettyCashFund.nombre.label("fund_nombre"))
        .join(PettyCashFund, PettyCashFund.id == PettyCashRendicion.fund_id)
        .where(PettyCashRendicion.company_id == cid)
    )
    if fund_id:
        q = q.where(PettyCashRendicion.fund_id == uuid.UUID(fund_id))
    if estado:
        q = q.where(PettyCashRendicion.estado == estado)
    q = q.order_by(PettyCashRendicion.created_at.desc())

    rows = (await db.execute(q)).all()
    out = []
    for r, f_nom in rows:
        d = {c.name: getattr(r, c.name) for c in r.__table__.columns}
        d["fund_nombre"] = f_nom
        out.append(d)
    return out


async def get_rendicion_detail(db: AsyncSession, company_id: str, rendicion_id: str) -> dict:
    cid = uuid.UUID(company_id)
    rid = uuid.UUID(rendicion_id)
    r_res = await db.execute(
        select(PettyCashRendicion, PettyCashFund.nombre.label("fund_nombre"))
        .join(PettyCashFund, PettyCashFund.id == PettyCashRendicion.fund_id)
        .where(PettyCashRendicion.id == rid, PettyCashRendicion.company_id == cid)
    )
    row = r_res.first()
    if not row:
        raise ValueError("Expediente de rendición no encontrado")
    rendicion_obj, fund_nombre = row

    fund_obj = await get_fund(db, str(rendicion_obj.fund_id))

    # Comprobantes asociados
    q_exp = (
        select(Expense, CostCenter.nombre.label("cost_center_nombre"))
        .outerjoin(CostCenter, CostCenter.id == Expense.cost_center_id)
        .where(Expense.rendicion_id == rid, Expense.company_id == cid)
        .order_by(Expense.fecha_gasto.asc(), Expense.created_at.asc())
    )
    exp_rows = (await db.execute(q_exp)).all()

    expenses = []
    for e, cc_nom in exp_rows:
        ed = {c.name: getattr(e, c.name) for c in e.__table__.columns}
        ed["cost_center_nombre"] = cc_nom
        expenses.append(ed)

    rend_dict = {c.name: getattr(rendicion_obj, c.name) for c in rendicion_obj.__table__.columns}
    rend_dict["fund_nombre"] = fund_nombre

    fund_dict = {c.name: getattr(fund_obj, c.name) for c in fund_obj.__table__.columns} if fund_obj else {}

    return {
        "rendicion": rend_dict,
        "expenses": expenses,
        "fund": fund_dict,
    }


async def audit_rendicion(
    db: AsyncSession, company_id: str, rendicion_id: str, data: PettyCashRendicionAuditRequest, user_id: str
) -> dict:
    cid = uuid.UUID(company_id)
    rid = uuid.UUID(rendicion_id)

    r_res = await db.execute(
        select(PettyCashRendicion).where(PettyCashRendicion.id == rid, PettyCashRendicion.company_id == cid)
    )
    rendicion = r_res.scalar_one_or_none()
    if not rendicion:
        raise ValueError("Rendición no encontrada")
    if rendicion.estado in ("pagada", "anulada"):
        raise ValueError(f"No se puede auditar una rendición en estado '{rendicion.estado}'")

    auditor_nombre = await _get_user_nombre(db, user_id) or "Auditor Tesorería"

    # Actualizar estado comprobante por comprobante
    for it in data.items:
        eid = uuid.UUID(it.expense_id)
        e_res = await db.execute(
            select(Expense).where(Expense.id == eid, Expense.rendicion_id == rid, Expense.company_id == cid)
        )
        exp = e_res.scalar_one_or_none()
        if exp:
            exp.auditoria_estado = it.estado
            exp.auditoria_motivo = it.motivo
            if it.estado == "aprobado":
                exp.estado = "aprobado"
                exp.aprobado_por = uuid.UUID(user_id)
                exp.aprobado_at = datetime.now(timezone.utc)
            elif it.estado == "rechazado":
                exp.estado = "rechazado"
                exp.rechazado_por = uuid.UUID(user_id)
                exp.rechazado_at = datetime.now(timezone.utc)
                exp.rechazado_motivo = it.motivo

    # Recalcular totales aprobados vs rechazados
    q_all = select(Expense).where(Expense.rendicion_id == rid, Expense.company_id == cid)
    all_exp = list((await db.execute(q_all)).scalars().all())

    aprobados = [e for e in all_exp if e.auditoria_estado == "aprobado"]
    rechazados = [e for e in all_exp if e.auditoria_estado == "rechazado"]

    rendicion.total_comprobantes_aprobados = sum(Decimal(str(e.monto)) for e in aprobados)
    rendicion.total_comprobantes_rechazados = sum(Decimal(str(e.monto)) for e in rechazados)
    rendicion.total_gravado_10 = sum(Decimal(str(e.gravado_10 or 0)) for e in aprobados)
    rendicion.total_gravado_5 = sum(Decimal(str(e.gravado_5 or 0)) for e in aprobados)
    rendicion.total_exentas = sum(Decimal(str(e.exentas or 0)) for e in aprobados)
    rendicion.total_iva_10 = sum(Decimal(str(e.iva_10 or 0)) for e in aprobados)
    rendicion.total_iva_5 = sum(Decimal(str(e.iva_5 or 0)) for e in aprobados)
    rendicion.total_inversion_activos = sum(Decimal(str(e.monto)) for e in aprobados if e.es_inversion)
    rendicion.total_gasto_operativo = sum(Decimal(str(e.monto)) for e in aprobados if not e.es_inversion)

    rendicion.auditado_por_id = uuid.UUID(user_id)
    rendicion.auditado_por_nombre = auditor_nombre
    rendicion.fecha_aprobacion = datetime.now(TZ_ASUNCION)
    rendicion.estado = "aprobada"
    if data.observaciones:
        rendicion.observaciones_tesoreria = data.observaciones

    await db.commit()
    await db.refresh(rendicion)

    return {
        "success": True,
        "rendicion_id": str(rendicion.id),
        "total_aprobado": float(rendicion.total_comprobantes_aprobados),
        "total_rechazado": float(rendicion.total_comprobantes_rechazados),
        "estado": rendicion.estado,
    }


async def replenish_rendicion(
    db: AsyncSession, company_id: str, rendicion_id: str, data: PettyCashRendicionReplenishRequest, user_id: str
) -> dict:
    cid = uuid.UUID(company_id)
    rid = uuid.UUID(rendicion_id)

    r_res = await db.execute(
        select(PettyCashRendicion).where(PettyCashRendicion.id == rid, PettyCashRendicion.company_id == cid)
    )
    rendicion = r_res.scalar_one_or_none()
    if not rendicion:
        raise ValueError("Rendición no encontrada")
    if rendicion.estado == "pagada":
        raise ValueError("Esta rendición ya ha sido repuesta y pagada previamente")

    fund = await get_fund(db, str(rendicion.fund_id))
    if not fund:
        raise ValueError("Fondo fijo asociado no encontrado")

    monto_repuesto = Decimal(str(rendicion.total_comprobantes_aprobados))
    if monto_repuesto <= 0:
        raise ValueError("No existen comprobantes aprobados para reponer fondos")

    tesorero_nombre = await _get_user_nombre(db, user_id) or "Tesorería"
    caja_mov_id = None
    bank_tx_id = None

    # 1. Desembolso desde origen de fondos seleccionado
    if data.medio_reposicion == "EFECTIVO_BOVEDA":
        from api.src.caja.models import VaultEntry, CashRegister, CashRegisterMovement
        now_dt = datetime.now(TZ_ASUNCION)

        # 1. Verificar saldo en Bóveda Central (PYG)
        q_vault = select(sa_func.coalesce(sa_func.sum(VaultEntry.monto_pyg), Decimal("0"))).where(
            VaultEntry.company_id == cid,
            VaultEntry.estado == "en_boveda"
        )
        saldo_vault = (await db.execute(q_vault)).scalar() or Decimal("0")
        if saldo_vault < monto_repuesto:
            raise ValueError(
                f"Saldo insuficiente en Bóveda Central. Disponible: ₲ {saldo_vault:,.0f} | Requerido: ₲ {monto_repuesto:,.0f}"
            )

        # 2. Consumir entradas FIFO de bóveda
        entries_res = await db.execute(
            select(VaultEntry).where(
                VaultEntry.company_id == cid,
                VaultEntry.estado == "en_boveda",
                VaultEntry.monto_pyg > Decimal("0")
            ).order_by(VaultEntry.created_at.asc())
        )
        entries = entries_res.scalars().all()

        remaining = monto_repuesto
        for e in entries:
            if remaining <= Decimal("0"):
                break
            e_monto = Decimal(str(e.monto_pyg or 0))
            if e_monto <= remaining:
                if (e.monto_brl and e.monto_brl > 0) or (e.monto_usd and e.monto_usd > 0):
                    db.add(VaultEntry(
                        company_id=cid,
                        branch_id=e.branch_id,
                        origen="egreso_fondo",
                        handoff_id=e.handoff_id,
                        monto_pyg=e_monto,
                        monto_usd=Decimal("0"),
                        monto_brl=Decimal("0"),
                        estado="egreso_gasto",
                        fecha_deposito=now_dt,
                        observaciones=f"Reposición Fondo Fijo '{fund.nombre}' — Rendición {rendicion.numero_rendicion}",
                        registrado_por=uuid.UUID(user_id) if user_id else None,
                    ))
                    e.monto_pyg = Decimal("0")
                else:
                    e.estado = "egreso_gasto"
                    e.fecha_deposito = now_dt
                    e.observaciones = f"Reposición Fondo Fijo '{fund.nombre}' — Rendición {rendicion.numero_rendicion}"
                    if user_id:
                        e.registrado_por = uuid.UUID(user_id)
                remaining -= e_monto
            else:
                db.add(VaultEntry(
                    company_id=cid,
                    branch_id=e.branch_id,
                    origen="egreso_fondo",
                    handoff_id=e.handoff_id,
                    monto_pyg=remaining,
                    monto_usd=Decimal("0"),
                    monto_brl=Decimal("0"),
                    estado="egreso_gasto",
                    fecha_deposito=now_dt,
                    observaciones=f"Reposición parcial Fondo Fijo '{fund.nombre}' — Rendición {rendicion.numero_rendicion}",
                    registrado_por=uuid.UUID(user_id) if user_id else None,
                ))
                e.monto_pyg = e_monto - remaining
                remaining = Decimal("0")
                break

        # 3. Trazabilidad opcional en movimiento de caja
        reg_id = uuid.UUID(data.caja_boveda_id) if data.caja_boveda_id else None
        if not reg_id:
            reg_res = await db.execute(
                select(CashRegister).where(CashRegister.company_id == cid).order_by(CashRegister.activo.desc(), CashRegister.created_at.asc()).limit(1)
            )
            main_reg = reg_res.scalar_one_or_none()
            if main_reg:
                reg_id = main_reg.id

        if reg_id:
            crm = CashRegisterMovement(
                company_id=cid,
                register_id=reg_id,
                tipo="retiro",
                monto=monto_repuesto,
                moneda="PYG",
                fecha=now_dt,
                usuario=tesorero_nombre,
                observaciones=f"Reposición Fondo Fijo '{fund.nombre}' — Rendición {rendicion.numero_rendicion}",
            )
            db.add(crm)
            await db.flush()
            caja_mov_id = crm.id
    elif data.medio_reposicion in ("BANCO_TRANSFERENCIA", "CHEQUE"):
        if not data.bank_account_id:
            raise ValueError("Debe seleccionar la cuenta bancaria para la reposición")
        from api.src.financial.models import BankAccount, BankTransaction
        acc_res = await db.execute(select(BankAccount).where(BankAccount.id == uuid.UUID(data.bank_account_id)))
        acc = acc_res.scalar_one_or_none()
        if not acc:
            raise ValueError("Cuenta bancaria no encontrada")
        if Decimal(str(acc.saldo_actual)) < monto_repuesto:
            raise ValueError(f"Saldo bancario insuficiente: disponible Gs. {acc.saldo_actual:,.0f}, requerido Gs. {monto_repuesto:,.0f}")

        bt = BankTransaction(
            company_id=cid,
            bank_account_id=acc.id,
            fecha=date.today(),
            tipo="debito",
            monto=monto_repuesto,
            moneda=acc.moneda,
            descripcion=f"Reposición Fondo Fijo '{fund.nombre}' — Rendición {rendicion.numero_rendicion}",
            referencia=data.comprobante_pago_ref,
            categoria="caja_chica",
        )
        db.add(bt)
        acc.saldo_actual = Decimal(str(acc.saldo_actual)) - monto_repuesto
        await db.flush()
        bank_tx_id = bt.id

    # 2. Reconstitución del saldo en el fondo fijo
    saldo_ant = Decimal(str(fund.saldo_actual))
    fund.saldo_actual = min(Decimal(str(fund.monto_autorizado)), saldo_ant + monto_repuesto)
    db.add(PettyCashFundMovement(
        fund_id=fund.id,
        tipo="reposicion",
        monto=monto_repuesto,
        saldo_anterior=saldo_ant,
        saldo_nuevo=fund.saldo_actual,
        referencia_type="rendicion",
        referencia_id=rendicion.id,
        observaciones=f"Reposición {data.medio_reposicion} por Rendición {rendicion.numero_rendicion}",
        created_by=uuid.UUID(user_id),
    ))

    # 3. Alta Automática en Activos Fijos para Comprobantes Marcados como Inversión
    q_inv = select(Expense).where(
        Expense.rendicion_id == rid,
        Expense.es_inversion == True,
        Expense.auditoria_estado == "aprobado",
        Expense.fixed_asset_id.is_(None),
    )
    inv_expenses = list((await db.execute(q_inv)).scalars().all())
    if inv_expenses:
        from api.src.fixed_assets.models import FixedAsset
        for ie in inv_expenses:
            neto_activo = Decimal(str(ie.monto)) - Decimal(str(ie.iva_10 or 0)) - Decimal(str(ie.iva_5 or 0))
            if neto_activo <= 0:
                neto_activo = Decimal(str(ie.monto))
            fa = FixedAsset(
                company_id=cid,
                nombre=f"{ie.descripcion} ({ie.proveedor or 'S/P'})",
                categoria=ie.categoria_activo or "Maquinarias y Equipos",
                fecha_adquisicion=ie.fecha_gasto or date.today(),
                valor_adquisicion=neto_activo,
                valor_residual=Decimal("0"),
                vida_util_meses=ie.vida_util_meses or 60,
                estado="activo",
            )
            db.add(fa)
            await db.flush()
            ie.fixed_asset_id = fa.id

    # 4. Asiento Contable Automático en Contabilidad Integrada
    asiento_id = None
    try:
        from api.src.integrated_finance.service import create_manual_entry
        from api.src.integrated_finance.schemas import ManualEntryCreate, ManualEntryLine
        from api.src.integrated_finance.models import AccountPlan

        # Cuentas requeridas en account_plans
        acc_caja = await db.execute(select(AccountPlan).where(AccountPlan.company_id == cid, AccountPlan.codigo == "1.1.01"))
        caja_plan = acc_caja.scalar_one_or_none()

        acc_gasto = await db.execute(select(AccountPlan).where(AccountPlan.company_id == cid, AccountPlan.codigo == "6.1.07"))
        gasto_plan = acc_gasto.scalar_one_or_none()

        acc_iva = await db.execute(select(AccountPlan).where(AccountPlan.company_id == cid, AccountPlan.codigo == "1.1.05"))
        iva_plan = acc_iva.scalar_one_or_none()

        acc_af = await db.execute(select(AccountPlan).where(AccountPlan.company_id == cid, AccountPlan.codigo.in_(["1.2.01", "1.1.06"])))
        af_plan = acc_af.scalars().first()

        if caja_plan and gasto_plan and iva_plan:
            lines = []
            tot_iva = rendicion.total_iva_10 + rendicion.total_iva_5
            tot_inv_net = rendicion.total_inversion_activos
            tot_gas_net = rendicion.total_gasto_operativo

            if tot_gas_net > 0:
                lines.append(ManualEntryLine(
                    account_id=str(gasto_plan.id),
                    tipo="debe",
                    monto=float(tot_gas_net),
                    concepto=f"Gastos Operativos Fondo Fijo {fund.nombre}",
                ))

            if tot_inv_net > 0 and af_plan:
                lines.append(ManualEntryLine(
                    account_id=str(af_plan.id),
                    tipo="debe",
                    monto=float(tot_inv_net),
                    concepto=f"Inversión Activo Fijo Fondo Fijo {fund.nombre}",
                ))

            if tot_iva > 0:
                lines.append(ManualEntryLine(
                    account_id=str(iva_plan.id),
                    tipo="debe",
                    monto=float(tot_iva),
                    concepto=f"IVA Crédito Fiscal Rendición {rendicion.numero_rendicion}",
                ))

            lines.append(ManualEntryLine(
                account_id=str(caja_plan.id),
                tipo="haber",
                monto=float(monto_repuesto),
                concepto=f"Salida Reposición {rendicion.numero_rendicion}",
            ))

            entry_payload = ManualEntryCreate(
                fecha=date.today(),
                concepto=f"Reposición Fondo Fijo {fund.nombre} — {rendicion.numero_rendicion}",
                lines=lines,
            )
            res_entry = await create_manual_entry(db, company_id, entry_payload, user_id)
            if "id" in res_entry:
                asiento_id = uuid.UUID(res_entry["id"])
    except Exception:
        pass  # Si la contabilidad no está inicializada para este tenant, continúa sin bloquear

    # 5. Actualizar estado de la Rendición a Pagada
    rendicion.monto_repuesto = monto_repuesto
    rendicion.medio_reposicion = data.medio_reposicion
    rendicion.caja_boveda_id = uuid.UUID(data.caja_boveda_id) if data.caja_boveda_id else (reg_id if 'reg_id' in locals() and reg_id else None)
    rendicion.cash_movement_id = caja_mov_id
    rendicion.bank_account_id = uuid.UUID(data.bank_account_id) if data.bank_account_id else None
    rendicion.bank_transaction_id = bank_tx_id
    rendicion.comprobante_pago_ref = data.comprobante_pago_ref
    rendicion.asiento_contable_id = asiento_id
    rendicion.fecha_pago = datetime.now(TZ_ASUNCION)
    rendicion.estado = "pagada"
    if data.observaciones:
        rendicion.observaciones_tesoreria = (rendicion.observaciones_tesoreria or "") + "\n" + data.observaciones

    await db.commit()
    await db.refresh(rendicion)

    return {
        "success": True,
        "rendicion_id": str(rendicion.id),
        "monto_repuesto": float(monto_repuesto),
        "medio_reposicion": rendicion.medio_reposicion,
        "estado": rendicion.estado,
    }


async def get_rendicion_pdf_data(db: AsyncSession, company_id: str, rendicion_id: str) -> dict:
    detail = await get_rendicion_detail(db, company_id, rendicion_id)
    return detail


# ── Integración exclusiva de Nómina y Anticipos con SueldOK ───────────────
SUELDOK_BASE_URL = os.environ.get("SUELDOK_URL", "https://sueldok.intellihouse.lat")
SUELDOK_API_KEY = os.environ.get("SUELDOK_API_KEY", "ifk_santateresa_live_api_key_2026")
_SUELDOK_CACHE: dict = {"data": None, "timestamp": 0}


async def fetch_sueldok_overview_data() -> dict:
    """Consulta la API de SueldOK con caché ligero en memoria para no saturar la red."""
    global _SUELDOK_CACHE
    now = time.time()
    if _SUELDOK_CACHE.get("data") and (now - _SUELDOK_CACHE.get("timestamp", 0)) < 15:
        return _SUELDOK_CACHE["data"]

    url = f"{SUELDOK_BASE_URL.rstrip('/')}/http/api/intelimarket/overview?apiKey={SUELDOK_API_KEY}"
    try:
        import httpx
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(url, headers={"User-Agent": "InteliMarket/1.0", "Accept": "application/json"})
            if res.status_code == 200:
                data = res.json()
                _SUELDOK_CACHE = {"data": data, "timestamp": now}
                return data
            else:
                logger.warning(f"SueldOK overview returned status {res.status_code}")
    except Exception as e:
        logger.warning(f"Error connecting to SueldOK overview: {e}")
        if _SUELDOK_CACHE.get("data"):
            return _SUELDOK_CACHE["data"]
    return _SUELDOK_CACHE.get("data") or {}


async def get_staff_candidates(db: AsyncSession, company_id: str, search: str | None = None) -> list[dict]:
    """Retorna EXCLUSIVAMENTE los colaboradores activos cargados en SueldOK."""
    data = await fetch_sueldok_overview_data()
    raw_employees = data.get("employees", [])

    staff = []
    for emp in raw_employees:
        estado = (emp.get("estado") or "").strip().lower()
        if estado and estado not in ("activo", "active"):
            continue

        nombre = (emp.get("nombre") or "").strip()
        ci = str(emp.get("ci") or "").strip()
        cargo = (emp.get("cargo") or "").strip()
        depto = (emp.get("depto") or "").strip()
        salario = emp.get("salario") or 0

        if search:
            q = search.strip().lower()
            if q not in nombre.lower() and q not in ci.lower() and q not in cargo.lower():
                continue

        staff.append({
            "id": str(emp.get("id") or ""),
            "nombre": nombre,
            "ci": ci,
            "cargo": cargo,
            "depto": depto,
            "salario": salario,
            "estado": estado or "activo",
            "biometricId": emp.get("biometricId"),
        })

    staff.sort(key=lambda x: x["nombre"])
    return staff


async def get_sueldok_approved_advances(db: AsyncSession, company_id: str, search: str | None = None) -> list[dict]:
    """Retorna los anticipos cargados en SueldOK y APROBADOS allí, cotejando si ya fueron desembolsados en caja chica."""
    data = await fetch_sueldok_overview_data()
    raw_advances = data.get("advances", [])

    # Obtener los sueldok_sync_id ya desembolsados/usados en gastos de caja chica
    used_res = await db.execute(
        text("SELECT id, sueldok_sync_id, monto, fecha_gasto, estado FROM expenses WHERE sueldok_sync_id IS NOT NULL AND estado != 'anulado'")
    )
    used_advances_map = {row.sueldok_sync_id: row for row in used_res.fetchall()}

    advances = []
    for adv in raw_advances:
        estado = (adv.get("estado") or "").strip().lower()
        # Solo los cargados en SueldOK y APROBADOS allí
        if estado not in ("approved", "aprobado"):
            continue

        adv_id = str(adv.get("id") or "")
        nombre = (adv.get("nombre") or "").strip()
        ci = str(adv.get("ci") or "").strip()
        monto = adv.get("monto") or 0
        motivo = (adv.get("motivo") or "").strip()
        cargo = (adv.get("cargo") or "").strip()
        depto = (adv.get("depto") or "").strip()
        fecha = str(adv.get("fecha") or "")

        if search:
            q = search.strip().lower()
            if (q not in nombre.lower() and q not in ci.lower() and 
                q not in motivo.lower() and q not in cargo.lower()):
                continue

        ya_usado = adv_id in used_advances_map
        expense_info = used_advances_map.get(adv_id)

        advances.append({
            "id": adv_id,
            "employeeId": str(adv.get("employeeId") or ""),
            "nombre": nombre,
            "ci": ci,
            "cargo": cargo,
            "depto": depto,
            "monto": monto,
            "motivo": motivo,
            "fecha": fecha,
            "estado": estado,
            "ya_desembolsado": ya_usado,
            "expense_id": str(expense_info.id) if expense_info else None,
            "expense_estado": expense_info.estado if expense_info else None,
        })

    # Mostrar primero los pendientes de desembolso
    advances.sort(key=lambda x: (x["ya_desembolsado"], x["nombre"]))
    return advances



