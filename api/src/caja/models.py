"""Caja (Cash Register) models"""

from sqlalchemy import Column, String, Boolean, DateTime, Text, Numeric, Integer, SmallInteger, ForeignKey, ARRAY
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func

from api.src.db import Base


class CashRegister(Base):
    __tablename__ = "cash_registers"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
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
    register_id = Column(UUID(as_uuid=True), ForeignKey("cash_registers.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    cajero_nombre = Column(String(100))
    monto_apertura = Column(Numeric(15, 0), nullable=False)
    monto_apertura_usd = Column(Numeric(15, 2), default=0)
    monto_apertura_brl = Column(Numeric(15, 2), default=0)

    fecha_apertura = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    fecha_cierre = Column(DateTime(timezone=True))
    monto_cierre = Column(Numeric(15, 0))
    estado = Column(String(20), nullable=False, default="abierta", index=True)
    ultimo_cash_drop_at = Column(DateTime(timezone=True))
    observaciones = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CashCount(Base):
    __tablename__ = "cash_counts"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    session_id = Column(UUID(as_uuid=True), ForeignKey("cash_sessions.id"), nullable=False, index=True)
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
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class CashHandoff(Base):
    """Entrega física del efectivo contado por la cajera a un supervisor al
    cerrar sesión — el punto de custodia que antes no existía: hasta que un
    supervisor confirma, el efectivo queda 'pendiente' bajo responsabilidad
    de la cajera. No bloquea el cierre de la sesión (decisión del cliente):
    la sesión se cierra igual, la entrega queda pendiente aparte."""
    __tablename__ = "cash_handoffs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    session_id = Column(UUID(as_uuid=True), ForeignKey("cash_sessions.id"), nullable=False, index=True)
    cash_count_id = Column(UUID(as_uuid=True), ForeignKey("cash_counts.id"), nullable=False)
    entregado_por = Column(UUID(as_uuid=True), nullable=False)  # cajero
    entregado_por_nombre = Column(String(100))
    monto_pyg = Column(Numeric(15, 0), nullable=False)
    monto_usd = Column(Numeric(12, 2), default=0)
    monto_brl = Column(Numeric(12, 2), default=0)
    requiere_revision = Column(Boolean, default=False)
    estado = Column(String(20), nullable=False, default="pendiente", index=True)  # pendiente | confirmado
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
    session_id = Column(UUID(as_uuid=True), ForeignKey("cash_sessions.id"), nullable=False, index=True)
    register_id = Column(UUID(as_uuid=True))
    solicitado_por = Column(UUID(as_uuid=True), nullable=False)  # cajero
    solicitado_por_nombre = Column(String(100))
    monto_pyg = Column(Numeric(15, 0), default=0)
    monto_usd = Column(Numeric(12, 2), default=0)
    monto_brl = Column(Numeric(12, 2), default=0)
    observaciones = Column(Text)
    estado = Column(String(20), nullable=False, default="pendiente", index=True)  # pendiente | confirmado | rechazado
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
    handoff_id = Column(UUID(as_uuid=True), ForeignKey("cash_handoffs.id"), index=True)
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


class PaymentMethodBankMapping(Base):
    """Mapeo dinámico y cambiante de Medios de Pago Electrónicos a Cuentas Bancarias Corrientes."""
    __tablename__ = "payment_method_bank_mappings"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    canal_key = Column(String(50), nullable=False)  # TARJETA_BANCARD, TARJETA_DINELCO, BANCARD_QR, DINELCO_QR, PIX, TRANSFERENCIA
    canal_label = Column(String(100), nullable=False)
    bank_account_id = Column(UUID(as_uuid=True), ForeignKey("bank_accounts.id"), nullable=True)
    comision_porcentaje = Column(Numeric(6, 4), default=0.0000)  # ej: 1.50% de comision procesadora
    comision_fija_gs = Column(Numeric(12, 0), default=0)         # costo fijo por transaccion en Gs
    comision_activa = Column(Boolean, nullable=False, default=False, server_default="false")  # True: la procesadora le PAGA la comision al comercio (ingreso), no es una retencion
    # Cargo que el terminal le cobra al CLIENTE (ej. adelantos de efectivo): es de la procesadora, no del comercio.
    # = max(cargo_cliente_minimo_gs, monto * cargo_cliente_porcentaje / 100)
    cargo_cliente_porcentaje = Column(Numeric(6, 4), nullable=False, default=0, server_default="0")
    cargo_cliente_minimo_gs = Column(Numeric(12, 0), nullable=False, default=0, server_default="0")
    plazo_acreditacion_dias = Column(Integer, default=1)         # ej: 0 (D+0), 1 (D+1), 2 (D+2), 30 (D+30)
    tipo_plazo = Column(String(20), default="habiles")           # habiles o corridos
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CashShortageDeductionRequest(Base):
    """Solicitud formal de deducción salarial por faltante de arqueo de caja hacia SueldOK."""
    __tablename__ = "cash_shortage_deduction_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    session_id = Column(UUID(as_uuid=True), ForeignKey("cash_sessions.id"), nullable=False, index=True)
    caja_nombre = Column(String(100))
    user_id = Column(UUID(as_uuid=True), nullable=False)  # Cajero/a responsable
    cajero_nombre = Column(String(100), nullable=False)
    monto_faltante_gs = Column(Numeric(15, 0), nullable=False)
    estado = Column(String(30), nullable=False, default="pendiente")  # pendiente | aprobado_nomina | condonado | rechazado
    resolucion = Column(String(50))  # descuento_1_pago | descuento_cuotas | perdida_empresa
    cuotas = Column(Integer, default=1)
    monto_cuota_gs = Column(Numeric(15, 0))
    periodo_nomina = Column(String(7))  # ej. 2026-09
    sueldok_sync_status = Column(String(30), default="no_sincronizado")  # no_sincronizado | enviado | confirmado
    sueldok_sync_id = Column(String(100))
    observaciones = Column(Text)
    aprobado_por = Column(String(100))
    aprobado_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CashShortageConfig(Base):
    """Configuración de umbrales y políticas de faltantes de caja por empresa."""
    __tablename__ = "cash_shortage_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, unique=True)
    umbral_aprobacion_gs = Column(Numeric(15, 0), default=10000)  # Faltantes mayores a este monto requieren aprobación
    requerir_aprobacion_siempre = Column(Boolean, default=True)
    permitir_cuotas = Column(Boolean, default=True)
    max_cuotas = Column(Integer, default=3)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CashSessionPaymentAdjustment(Base):
    """Reclasificación o ajuste de comprobantes en Tesorería.
    Casos de salón: un pago fue registrado por la cajera en el POS como 'EFECTIVO',
    pero en Tesorería se entrega un comprobante físico real (Transferencia SIPAP, Voucher POS
    manual/contingencia, PIX Brasil, Cheque, etc.).
    
    Efecto:
    1. Deduce el monto del Efectivo Esperado a Rendir en billetes de la sesión.
    2. Suma el comprobante al canal operativo correspondiente para su punteo y custodia.
    3. Al incorporar a Bóveda & Bancos, genera el crédito (BankTransaction) en la cuenta bancaria respectiva.
    """
    __tablename__ = "cash_session_payment_adjustments"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    session_id = Column(UUID(as_uuid=True), ForeignKey("cash_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    sale_id = Column(UUID(as_uuid=True), nullable=True)
    ticket_numero = Column(String(50))
    origen_forma_pago = Column(String(50), nullable=False, default="EFECTIVO")
    destino_canal_key = Column(String(50), nullable=False)
    destino_canal_label = Column(String(100), nullable=False)
    monto_gs = Column(Numeric(15, 0), nullable=False)
    moneda = Column(String(3), default="PYG")
    monto_original = Column(Numeric(15, 2))
    nro_comprobante = Column(String(100))
    banco_entidad = Column(String(100))
    titular = Column(String(150))
    codigo_autorizacion = Column(String(100))
    motivo = Column(Text)
    registrado_por_id = Column(UUID(as_uuid=True))
    registrado_por_nombre = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CashSessionPunteoItem(Base):
    """Registro individual de comprobante punteado en Tesorería.
    Almacena la verificación física de cada voucher/comprobante de la sesión,
    su estado (conforme, faltante, discrepante), monto en sistema, monto físico real,
    diferencia y observación del auditor."""
    __tablename__ = "cash_session_punteo_items"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    session_id = Column(UUID(as_uuid=True), ForeignKey("cash_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    voucher_id = Column(String(100), nullable=False, index=True)
    estado = Column(String(20), nullable=False, default="conforme")  # conforme | faltante | discrepante
    monto_sistema = Column(Numeric(15, 0), nullable=False, default=0)
    monto_fisico = Column(Numeric(15, 0), nullable=False, default=0)
    diferencia_gs = Column(Numeric(15, 0), nullable=False, default=0)
    observacion = Column(Text)
    auditor_nombre = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())






class CashAdvance(Base):
    """Adelanto de efectivo contra tarjeta ("Cobrá tu salario" de Dinelco): el cliente pide plata en caja y el
    terminal la cobra de su tarjeta. No es una venta (sin factura, sin stock): es una SALIDA de efectivo de la
    sesion de la cajera -- por eso queda atado a la sesion, para que el efectivo esperado del cierre baje por
    lo entregado -- y un voucher que la procesadora acredita al comercio (mas la comision activa, si hay)."""
    __tablename__ = "cash_advances"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    session_id = Column(UUID(as_uuid=True), ForeignKey("cash_sessions.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True))
    cajero_nombre = Column(String(100))
    punto_emision = Column(String(10))
    proveedor = Column(String(20), nullable=False, default="dinelco")
    opcion = Column(SmallInteger)                 # 1 = Red de Pagos, 2 = Dinelco (manual Feitian v1.0.5, /pos/adelanto)
    monto = Column(Numeric(15, 0), nullable=False)  # efectivo entregado al cliente
    origen = Column(String(10), nullable=False, default="terminal")  # terminal | manual
    codigo_autorizacion = Column(String(20))
    nro_referencia = Column(String(20))
    issuer_id = Column(String(5))
    nombre_tarjeta = Column(String(100))
    pan_ultimos4 = Column(String(4))
    terminal = Column(String(20))
    terminal_ip = Column(String(45))
    comision_gs = Column(Numeric(15, 2), nullable=False, default=0)   # foto de la comision al momento del adelanto
    comision_activa = Column(Boolean, nullable=False, default=True)
    comision_porcentaje = Column(Numeric(6, 4))
    comision_fija_gs = Column(Numeric(12, 0))
    cargo_cliente_gs = Column(Numeric(15, 2), nullable=False, default=0, server_default="0")  # comision que cobro el terminal al cliente (de la procesadora)
    sale_id = Column(UUID(as_uuid=True))          # compra de la misma visita (informativo)
    supervisor_id = Column(UUID(as_uuid=True))
    supervisor_nombre = Column(String(100))
    estado = Column(String(12), nullable=False, default="aprobado")  # aprobado | anulado
    observaciones = Column(Text)
    raw_response = Column(JSONB)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
