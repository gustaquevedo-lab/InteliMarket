from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Numeric, Integer, Text, JSON, Date
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from api.src.db import Base


class ForecastConfig(Base):
    __tablename__ = "df_forecast_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    model_type = Column(String(30), default="exponential_smoothing")  # exponential_smoothing, moving_average, seasonal_decompose
    horizon_days = Column(Integer, default=90)
    seasonality_period = Column(Integer, default=7)  # days (7 = weekly)
    confidence_level = Column(Numeric(5, 2), default=95.0)
    min_history_days = Column(Integer, default=60)
    anomaly_threshold = Column(Numeric(5, 2), default=2.5)  # z-score threshold
    reorder_weeks = Column(Integer, default=2)  # lead time in weeks for purchase suggestions
    safety_stock_days = Column(Integer, default=7)
    default_markup_pct = Column(Numeric(5, 2), default=15.0)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ForecastPrediction(Base):
    __tablename__ = "df_forecast_predictions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    zone = Column(String(100), nullable=True, index=True)
    forecast_date = Column(Date, nullable=False, index=True)
    predicted_qty = Column(Numeric(15, 2), nullable=False)
    confidence_lower = Column(Numeric(15, 2), nullable=True)
    confidence_upper = Column(Numeric(15, 2), nullable=True)
    confidence_score = Column(Numeric(5, 2), nullable=True)  # 0-100
    model_used = Column(String(30), nullable=True)
    factors = Column(JSON, nullable=True)  # {seasonality, trend, promo_impact, event_impact, ...}
    is_override = Column(Boolean, default=False)
    original_prediction = Column(Numeric(15, 2), nullable=True)
    override_reason = Column(Text, nullable=True)
    overridden_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ForecastOverride(Base):
    __tablename__ = "df_forecast_overrides"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=True)
    zone = Column(String(100), nullable=True)
    forecast_date = Column(Date, nullable=False)
    original_qty = Column(Numeric(15, 2), nullable=False)
    adjusted_qty = Column(Numeric(15, 2), nullable=False)
    reason = Column(Text, nullable=False)
    created_by = Column(UUID(as_uuid=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AnomalyDetection(Base):
    __tablename__ = "df_anomaly_detections"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=True)
    zone = Column(String(100), nullable=True)
    tipo = Column(String(30), nullable=False)  # demand_spike, unexpected_drop, no_rotation, trend_change
    severity = Column(String(20), default="info")  # critical, warning, info
    detected_date = Column(Date, nullable=False)
    expected_value = Column(Numeric(15, 2), nullable=True)
    actual_value = Column(Numeric(15, 2), nullable=True)
    deviation_pct = Column(Numeric(10, 2), nullable=True)
    z_score = Column(Numeric(10, 2), nullable=True)
    details = Column(JSON, nullable=True)
    reviewed = Column(Boolean, default=False)
    reviewed_by = Column(UUID(as_uuid=True), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PurchaseSuggestion(Base):
    __tablename__ = "df_purchase_suggestions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    supplier_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    suggested_qty = Column(Numeric(15, 2), nullable=False)
    suggested_date = Column(Date, nullable=False)
    expected_price = Column(Numeric(15, 2), nullable=True)
    expected_total = Column(Numeric(15, 2), nullable=True)
    confidence_score = Column(Numeric(5, 2), nullable=True)
    forecast_demand = Column(Numeric(15, 2), nullable=True)  # predicted demand for the period
    current_stock = Column(Numeric(15, 2), nullable=True)
    stock_after_lead = Column(Numeric(15, 2), nullable=True)  # projected stock at delivery
    lead_time_days = Column(Integer, nullable=True)
    status = Column(String(20), default="pending")  # pending, suggested, converted, rejected
    converted_order_id = Column(UUID(as_uuid=True), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ForecastAccuracy(Base):
    __tablename__ = "df_forecast_accuracy"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=True)
    zone = Column(String(100), nullable=True)
    forecast_date = Column(Date, nullable=False)
    predicted_qty = Column(Numeric(15, 2), nullable=False)
    actual_qty = Column(Numeric(15, 2), nullable=True)
    error_absolute = Column(Numeric(15, 2), nullable=True)
    error_pct = Column(Numeric(10, 2), nullable=True)  # MAPE
    error_squared = Column(Numeric(15, 2), nullable=True)
    modelo = Column(String(30), nullable=True)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
