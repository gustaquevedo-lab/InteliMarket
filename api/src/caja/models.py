"""Caja (Cash Register) models"""

from sqlalchemy import Column, String, Boolean, DateTime, Text, Numeric, Integer, ForeignKey, ARRAY
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from api.src.db import Base


class CashRegister(Base):
    __tablename__ = "cash_registers"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False)
    branch_id = Column(UUID(as_uuid=True))
    nombre = Column(String(100), nullable=False)
    codigo = Column(String(20), nullable=False, unique=True)
    activo = Column(Boolean, default=True)
    cash_drop_threshold = Column(Numeric(15, 0))  # monto de efectivo acumulado que dispara la alerta de cash drop
    diferencia_maxima_tolerada = Column(Numeric(15, 0))  # descuadre de cierre (PYG) a partir del cual se marca para revision
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CashSession(Base):
    __tablename__ = "cash_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    register_id = Column(UUID(as_uuid=True), ForeignKey("cash_registers.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    cajero_nombre = Column(String(100))
    monto_apertura = Column(Numeric(15, 0), nullable=False)
    fecha_apertura = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    fecha_cierre = Column(DateTime(timezone=True))
    monto_cierre = Column(Numeric(15, 0))
    estado = Column(String(20), nullable=False, default="abierta")
    ultimo_cash_drop_at = Column(DateTime(timezone=True))
    observaciones = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CashCount(Base):
    __tablename__ = "cash_counts"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    session_id = Column(UUID(as_uuid=True), ForeignKey("cash_sessions.id"), nullable=False)
    monto_efectivo = Column(Numeric(15, 0), nullable=False)
    monto_tarjeta = Column(Numeric(15, 0), default=0)
    monto_transferencia = Column(Numeric(15, 0), default=0)
    monto_cheque = Column(Numeric(15, 0), default=0)
    monto_otro = Column(Numeric(15, 0), default=0)
    monto_total = Column(Numeric(15, 0), nullable=False)
    diferencia = Column(Numeric(15, 0))
    # El legado (Ñemuha) maneja efectivo en 3 monedas por caja — ~96% de los cierres
    # reales de este cliente incluyen Real brasileño. Guardamos cada moneda por
    # separado (sin inventar una conversion que el legado tampoco hacia).
    monto_efectivo_usd = Column(Numeric(12, 2), default=0)
    monto_efectivo_brl = Column(Numeric(12, 2), default=0)
    diferencia_usd = Column(Numeric(12, 2), default=0)
    diferencia_brl = Column(Numeric(12, 2), default=0)
    requiere_revision = Column(Boolean, default=False)  # diferencia superó diferencia_maxima_tolerada del register
    observaciones = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CashHandoff(Base):
    """Entrega física del efectivo contado por la cajera a un supervisor al
    cerrar sesión — el punto de custodia que antes no existía: hasta que un
    supervisor confirma, el efectivo queda 'pendiente' bajo responsabilidad
    de la cajera. No bloquea el cierre de la sesión (decisión del cliente):
    la sesión se cierra igual, la entrega queda pendiente aparte."""
    __tablename__ = "cash_handoffs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    session_id = Column(UUID(as_uuid=True), ForeignKey("cash_sessions.id"), nullable=False)
    cash_count_id = Column(UUID(as_uuid=True), ForeignKey("cash_counts.id"), nullable=False)
    entregado_por = Column(UUID(as_uuid=True), nullable=False)  # cajero
    entregado_por_nombre = Column(String(100))
    monto_pyg = Column(Numeric(15, 0), nullable=False)
    monto_usd = Column(Numeric(12, 2), default=0)
    monto_brl = Column(Numeric(12, 2), default=0)
    requiere_revision = Column(Boolean, default=False)
    estado = Column(String(20), nullable=False, default="pendiente")  # pendiente | confirmado
    recibido_por = Column(UUID(as_uuid=True))  # supervisor
    recibido_por_nombre = Column(String(100))
    # Recuento independiente: lo que el supervisor cuenta al recibir, no lo
    # que declaro la cajera — control real de doble conteo, no una simple
    # aceptacion del numero ajeno.
    monto_confirmado_pyg = Column(Numeric(15, 0))
    monto_confirmado_usd = Column(Numeric(12, 2))
    monto_confirmado_brl = Column(Numeric(12, 2))
    discrepancia_confirmacion = Column(Boolean, default=False)
    fecha_confirmacion = Column(DateTime(timezone=True))
    observaciones = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CashDropRequest(Base):
    """Retiro de efectivo a mitad de turno (cash drop), pendiente de que un
    supervisor lo confirme -- antes esto entraba a boveda de forma automatica
    apenas la cajera lo declaraba, sin ningun control de doble conteo (a
    diferencia de la entrega de cierre de turno, que si tenia ese control via
    CashHandoff). Se pidio expresamente que los retiros pasen por el mismo
    tipo de confirmacion."""
    __tablename__ = "cash_drop_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    session_id = Column(UUID(as_uuid=True), ForeignKey("cash_sessions.id"), nullable=False)
    register_id = Column(UUID(as_uuid=True))
    solicitado_por = Column(UUID(as_uuid=True), nullable=False)  # cajero
    solicitado_por_nombre = Column(String(100))
    monto_pyg = Column(Numeric(15, 0), default=0)
    monto_usd = Column(Numeric(12, 2), default=0)
    monto_brl = Column(Numeric(12, 2), default=0)
    observaciones = Column(Text)
    estado = Column(String(20), nullable=False, default="pendiente")  # pendiente | confirmado | rechazado
    confirmado_por = Column(UUID(as_uuid=True))  # supervisor
    confirmado_por_nombre = Column(String(100))
    # Mismo control de doble conteo que CashHandoff -- lo que el supervisor
    # cuenta al recibir, no lo que declaro la cajera.
    monto_confirmado_pyg = Column(Numeric(15, 0))
    monto_confirmado_usd = Column(Numeric(12, 2))
    monto_confirmado_brl = Column(Numeric(12, 2))
    discrepancia_confirmacion = Column(Boolean, default=False)
    motivo_rechazo = Column(Text)
    fecha_confirmacion = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class VaultEntry(Base):
    """Bóveda central real: cada entrada es efectivo que un supervisor recibió
    de una cajera (origen='entrega_cajero', vía CashHandoff) o un ajuste manual.
    Se acumula por moneda hasta que se deposita en el banco — ahí se enlaza con
    el bank_transaction real y queda trazada la cadena completa: cajera -> bóveda -> banco."""
    __tablename__ = "vault_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    branch_id = Column(UUID(as_uuid=True))
    origen = Column(String(20), nullable=False, default="entrega_cajero")  # entrega_cajero | ajuste | otro
    handoff_id = Column(UUID(as_uuid=True), ForeignKey("cash_handoffs.id"))
    monto_pyg = Column(Numeric(15, 0), nullable=False, default=0)
    monto_usd = Column(Numeric(12, 2), default=0)
    monto_brl = Column(Numeric(12, 2), default=0)
    estado = Column(String(20), nullable=False, default="en_boveda")  # en_boveda | depositado
    bank_transaction_id = Column(UUID(as_uuid=True))  # set cuando se concilia con el depósito real
    fecha_deposito = Column(DateTime(timezone=True))
    registrado_por = Column(UUID(as_uuid=True))
    observaciones = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class VaultDepositApprovalRequest(Base):
    """Deposito a boveda por un monto que supera el umbral configurado —
    queda retenido hasta que Supervisor Y Gerente aprueben (mismo patron de
    credit_approval_requests). Las entradas listadas en entry_ids NO cambian
    de estado hasta la aprobacion completa; deposit_vault_entries recien se
    llama ahi."""
    __tablename__ = "vault_deposit_approval_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    entry_ids = Column(ARRAY(UUID(as_uuid=True)), nullable=False)
    monto_total_pyg = Column(Numeric(15, 0), nullable=False)
    estado = Column(String(20), nullable=False, default="pendiente")  # pendiente, aprobado, rechazado
    aprobado_supervisor_id = Column(UUID(as_uuid=True))
    aprobado_supervisor_at = Column(DateTime(timezone=True))
    aprobado_gerente_id = Column(UUID(as_uuid=True))
    aprobado_gerente_at = Column(DateTime(timezone=True))
    rechazado_por = Column(UUID(as_uuid=True))
    rechazado_at = Column(DateTime(timezone=True))
    rechazado_motivo = Column(Text)
    solicitado_por = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CashRegisterMovement(Base):
    """Entradas y retiros de la caja/boveda principal (distinto de las
    sesiones de cajero: son movimientos de la caja fuerte central,
    tipicamente hacia/desde una cuenta bancaria)."""
    __tablename__ = "cash_register_movements"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    register_id = Column(UUID(as_uuid=True), ForeignKey("cash_registers.id"), nullable=False)
    tipo = Column(String(20), nullable=False)  # entrada | retiro
    monto = Column(Numeric(15, 0), nullable=False)
    moneda = Column(String(3), default="PYG")
    fecha = Column(DateTime(timezone=True), nullable=False)
    usuario = Column(String(60))
    observaciones = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class TreasuryRemittance(Base):
    """Remito de Envío de Valores: Agrupa los sobres individuales (sangrías y cierres)
    verificados por la supervisora para su traslado y entrega formal a Tesorería / Bóveda Central."""
    __tablename__ = "treasury_remittances"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    numero = Column(String(50), nullable=False, index=True)  # ej: REM-20260831-0001
    supervisor_id = Column(UUID(as_uuid=True), nullable=False)
    supervisor_nombre = Column(String(100), nullable=False)
    tesorero_id = Column(UUID(as_uuid=True))
    tesorero_nombre = Column(String(100))
    estado = Column(String(30), nullable=False, default="en_transito")  # en_transito | recibido_en_boveda | observado | anulado
    total_sobres = Column(Integer, nullable=False, default=0)
    total_pyg = Column(Numeric(15, 0), nullable=False, default=0)
    total_usd = Column(Numeric(12, 2), default=0)
    total_brl = Column(Numeric(12, 2), default=0)
    fecha_envio = Column(DateTime(timezone=True), server_default=func.now())
    fecha_recepcion = Column(DateTime(timezone=True))
    observaciones = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class TreasuryRemittanceItem(Base):
    """Detalle de cada sobre individual incluido en el remito de supervisión."""
    __tablename__ = "treasury_remittance_items"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    remittance_id = Column(UUID(as_uuid=True), ForeignKey("treasury_remittances.id", ondelete="CASCADE"), nullable=False, index=True)
    tipo_sobre = Column(String(30), nullable=False)  # sangria | cierre_turno | otro
    referencia_id = Column(UUID(as_uuid=True), nullable=True)  # cash_drop_request_id o handoff_id
    vault_entry_id = Column(UUID(as_uuid=True), ForeignKey("vault_entries.id"), nullable=True)
    caja_codigo = Column(String(50))
    caja_nombre = Column(String(100))
    cajero_nombre = Column(String(100))
    monto_pyg = Column(Numeric(15, 0), nullable=False, default=0)
    monto_usd = Column(Numeric(12, 2), default=0)
    monto_brl = Column(Numeric(12, 2), default=0)
    ticket_numero = Column(String(50))
    verificado_tesoreria = Column(Boolean, default=False)
    observaciones = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

