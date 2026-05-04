"""Payment models"""

from sqlalchemy import Column, String, Boolean, DateTime, Numeric, Text, JSON, Integer, Date, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from api.src.db import Base


class PaymentMethod(Base):
    __tablename__ = "payment_methods"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False)
    tipo = Column(String(30), nullable=False)
    nombre = Column(String(100), nullable=False)
    moneda = Column(String(3), default="PYG")
    activo = Column(Boolean, default=True)
    config = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Payment(Base):
    __tablename__ = "payments"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    tipo = Column(String(20), nullable=False)
    payment_method_id = Column(UUID(as_uuid=True), nullable=False)
    moneda = Column(String(3), nullable=False, default="PYG")
    tipo_cambio = Column(Numeric(10, 2), default=1)
    monto = Column(Numeric(15, 0), nullable=False)
    monto_pyg = Column(Numeric(15, 0))
    fecha = Column(DateTime(timezone=True), server_default=func.now())
    referencia = Column(String(100))
    estado = Column(String(20), default="confirmado")
    gateway_response = Column(JSON)
    observaciones = Column(Text)
    user_id = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    allocations = relationship("PaymentAllocation", back_populates="payment", cascade="all, delete-orphan")


class PaymentAllocation(Base):
    __tablename__ = "payment_allocations"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    payment_id = Column(UUID(as_uuid=True), ForeignKey("payments.id"), nullable=False)
    sale_id = Column(UUID(as_uuid=True), nullable=False)
    monto_asignado = Column(Numeric(15, 0), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    payment = relationship("Payment", back_populates="allocations")


class CustomerWallet(Base):
    __tablename__ = "customer_wallets"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False)
    customer_id = Column(UUID(as_uuid=True), nullable=False)
    saldo = Column(Numeric(15, 0), default=0)
    moneda = Column(String(3), default="PYG")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class WalletTransaction(Base):
    __tablename__ = "wallet_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    wallet_id = Column(UUID(as_uuid=True), nullable=False)
    tipo = Column(String(20), nullable=False)
    monto = Column(Numeric(15, 0), nullable=False)
    referencia_type = Column(String(30))
    referencia_id = Column(UUID(as_uuid=True))
    motivo = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CustomerAccount(Base):
    __tablename__ = "customer_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    customer_id = Column(UUID(as_uuid=True), nullable=False, unique=True)
    moneda = Column(String(3), default="PYG")
    limite_credito = Column(Numeric(15, 0), nullable=False)
    saldo_actual = Column(Numeric(15, 0), default=0)
    dias_plazo = Column(Integer, default=30)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AccountMovement(Base):
    __tablename__ = "account_movements"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    account_id = Column(UUID(as_uuid=True), nullable=False)
    tipo = Column(String(20), nullable=False)
    monto = Column(Numeric(15, 0), nullable=False)
    sale_id = Column(UUID(as_uuid=True))
    payment_id = Column(UUID(as_uuid=True))
    saldo_anterior = Column(Numeric(15, 0))
    saldo_nuevo = Column(Numeric(15, 0))
    fecha = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Financing(Base):
    __tablename__ = "financings"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False)
    customer_id = Column(UUID(as_uuid=True), nullable=False)
    sale_id = Column(UUID(as_uuid=True), nullable=False)
    monto_financiado = Column(Numeric(15, 0), nullable=False)
    tasa_interes_mensual = Column(Numeric(5, 2))
    cantidad_cuotas = Column(Integer, nullable=False)
    monto_cuota = Column(Numeric(15, 0), nullable=False)
    moneda = Column(String(3), default="PYG")
    fecha_primera_cuota = Column(Date, nullable=False)
    estado = Column(String(20), default="activo")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    installments = relationship("FinancingInstallment", back_populates="financing", cascade="all, delete-orphan")


class FinancingInstallment(Base):
    __tablename__ = "financing_installments"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    financing_id = Column(UUID(as_uuid=True), ForeignKey("financings.id"), nullable=False)
    numero_cuota = Column(Integer, nullable=False)
    fecha_vencimiento = Column(Date, nullable=False)
    monto = Column(Numeric(15, 0), nullable=False)
    monto_pagado = Column(Numeric(15, 0), default=0)
    estado = Column(String(20), default="pendiente")
    fecha_pago = Column(DateTime(timezone=True))
    payment_id = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    financing = relationship("Financing", back_populates="installments")
