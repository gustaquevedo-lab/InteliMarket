from sqlalchemy import Column, String, Boolean, DateTime, Float, Integer, Text, Date, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from api.src.db import Base


class HolidayCalendar(Base):
    __tablename__ = "sm_holiday_calendar"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    name = Column(String(200), nullable=False)
    holiday_date = Column(Date, nullable=False, index=True)
    category = Column(String(50), nullable=False)
    impact_weight = Column(Float, default=1.0)
    repeat_yearly = Column(Boolean, default=True)
    affected_categories = Column(JSON, nullable=True)
    lift_multiplier = Column(Float, default=1.0)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ExternalFactor(Base):
    __tablename__ = "sm_external_factors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    factor_type = Column(String(30), nullable=False)
    name = Column(String(200), nullable=False)
    factor_date = Column(Date, nullable=False, index=True)
    value = Column(Float, default=0)
    affected_categories = Column(JSON, nullable=True)
    description = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ForecastModelConfig(Base):
    __tablename__ = "sm_forecast_model_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    target_type = Column(String(30), nullable=False)
    target_id = Column(String(100), nullable=False)
    target_name = Column(String(200), nullable=True)

    base_daily_sales = Column(Float, default=0)
    dow_coefficients = Column(JSON, nullable=True)
    holiday_coefficient = Column(Float, default=1.0)
    weather_coefficient = Column(Float, default=0.01)
    promo_lift_by_type = Column(JSON, nullable=True)
    seasonality_factors = Column(JSON, nullable=True)

    last_calibrated_at = Column(DateTime(timezone=True), nullable=True)
    calibration_samples = Column(Integer, default=0)
    mape_score = Column(Float, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class AdvanceForecastResult(Base):
    __tablename__ = "sm_forecast_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    target_type = Column(String(30), nullable=False)
    target_id = Column(String(100), nullable=False)
    target_name = Column(String(200), nullable=True)

    forecast_date = Column(Date, nullable=False, index=True)
    baseline = Column(Float, default=0)
    adjusted_forecast = Column(Float, default=0)
    lower_bound = Column(Float, default=0)
    upper_bound = Column(Float, default=0)

    factor_decomposition = Column(JSON, nullable=True)
    confidence_level = Column(Float, default=0.95)

    is_revised = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
