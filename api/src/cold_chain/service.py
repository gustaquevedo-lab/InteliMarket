from sqlalchemy import select, func as sa_func, and_, desc, delete, text
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid, math, statistics
from collections import defaultdict

from api.src.cold_chain.models import ColdSensor, SensorReading, ColdChainAlert, ComplianceLog


async def create_sensor(db: AsyncSession, company_id: str, data: dict) -> dict:
    sensor = ColdSensor(
        company_id=company_id,
        name=data["name"],
        container_id=data.get("container_id"),
        vehicle_id=data.get("vehicle_id"),
        mac_address=data.get("mac_address"),
        sensor_type=data.get("sensor_type", "dht22"),
        location_type=data.get("location_type", "warehouse"),
        location_name=data.get("location_name"),
        lat=data.get("lat"),
        lng=data.get("lng"),
        min_temp=data.get("min_temp", -2.0),
        max_temp=data.get("max_temp", 8.0),
        max_humidity=data.get("max_humidity"),
    )
    db.add(sensor)
    await db.commit()
    await db.refresh(sensor)
    return _sensor_to_dict(sensor)


async def get_sensor(db: AsyncSession, company_id: str, sensor_id: str) -> Optional[dict]:
    result = await db.execute(
        select(ColdSensor).where(ColdSensor.id == sensor_id, ColdSensor.company_id == company_id)
    )
    s = result.scalar_one_or_none()
    return _sensor_to_dict(s) if s else None


async def list_sensors(db: AsyncSession, company_id: str, location_type: Optional[str] = None) -> list[dict]:
    conditions = [ColdSensor.company_id == company_id]
    if location_type:
        conditions.append(ColdSensor.location_type == location_type)
    result = await db.execute(
        select(ColdSensor).where(and_(*conditions)).order_by(ColdSensor.name)
    )
    return [_sensor_to_dict(s) for s in result.scalars().all()]


def _sensor_to_dict(s: ColdSensor) -> dict:
    return {
        "id": str(s.id),
        "company_id": str(s.company_id),
        "container_id": str(s.container_id) if s.container_id else None,
        "vehicle_id": str(s.vehicle_id) if s.vehicle_id else None,
        "name": s.name,
        "mac_address": s.mac_address,
        "sensor_type": s.sensor_type,
        "location_type": s.location_type,
        "location_name": s.location_name,
        "lat": float(s.lat) if s.lat else None,
        "lng": float(s.lng) if s.lng else None,
        "min_temp": float(s.min_temp),
        "max_temp": float(s.max_temp),
        "max_humidity": float(s.max_humidity) if s.max_humidity else None,
        "is_active": s.is_active,
        "last_temperature": float(s.last_temperature) if s.last_temperature else None,
        "last_humidity": float(s.last_humidity) if s.last_humidity else None,
        "last_reading_at": s.last_reading_at,
        "battery_level": s.battery_level,
        "signal_strength": s.signal_strength,
        "created_at": s.created_at,
        "updated_at": s.updated_at,
    }


async def register_reading(db: AsyncSession, company_id: str, data: dict) -> dict:
    sensor_id = data["sensor_id"]
    result = await db.execute(
        select(ColdSensor).where(ColdSensor.id == sensor_id, ColdSensor.company_id == company_id)
    )
    sensor = result.scalar_one_or_none()
    if not sensor:
        return None

    temp = float(data["temperature"])
    humidity = float(data["humidity"]) if data.get("humidity") is not None else None
    read_at = data.get("read_at") or datetime.now(timezone.utc)

    reading = SensorReading(
        sensor_id=sensor_id,
        company_id=company_id,
        temperature=temp,
        humidity=humidity,
        battery=data.get("battery"),
        signal_strength=data.get("signal_strength"),
        read_at=read_at,
    )
    db.add(reading)

    sensor.last_temperature = temp
    sensor.last_humidity = humidity
    sensor.last_reading_at = read_at
    if data.get("battery") is not None:
        sensor.battery_level = data["battery"]
    if data.get("signal_strength") is not None:
        sensor.signal_strength = data["signal_strength"]
    db.add(sensor)

    alerts = []
    if temp < float(sensor.min_temp):
        alerts.append(await _create_alert(db, company_id, sensor_id, sensor, {
            "alert_type": "temp_low",
            "severity": "critical" if temp < float(sensor.min_temp) - 3 else "high",
            "temperature": temp,
            "threshold_min": float(sensor.min_temp),
            "message": f"Sensor {sensor.name}: temperatura baja ({temp:.1f}°C). Mínimo permitido: {sensor.min_temp}°C",
        }))
    elif temp > float(sensor.max_temp):
        alerts.append(await _create_alert(db, company_id, sensor_id, sensor, {
            "alert_type": "temp_high",
            "severity": "critical" if temp > float(sensor.max_temp) + 3 else "high",
            "temperature": temp,
            "threshold_max": float(sensor.max_temp),
            "message": f"Sensor {sensor.name}: temperatura alta ({temp:.1f}°C). Máximo permitido: {sensor.max_temp}°C",
        }))

    if data.get("battery") is not None and data["battery"] < 15:
        alerts.append(await _create_alert(db, company_id, sensor_id, sensor, {
            "alert_type": "battery_low",
            "severity": "warning",
            "temperature": temp,
            "message": f"Sensor {sensor.name}: batería baja ({data['battery']}%). Reemplazar pronto.",
        }))

    await db.commit()
    await db.refresh(reading)

    return {
        "reading": {
            "id": str(reading.id),
            "sensor_id": str(reading.sensor_id),
            "temperature": float(reading.temperature),
            "humidity": float(reading.humidity) if reading.humidity else None,
            "battery": reading.battery,
            "signal_strength": reading.signal_strength,
            "read_at": reading.read_at,
        },
        "alerts_generated": alerts,
    }


async def _create_alert(db: AsyncSession, company_id: str, sensor_id: str, sensor: ColdSensor, data: dict) -> dict:
    alert = ColdChainAlert(
        sensor_id=sensor_id,
        company_id=company_id,
        alert_type=data["alert_type"],
        severity=data.get("severity", "warning"),
        temperature=data.get("temperature"),
        threshold_min=data.get("threshold_min"),
        threshold_max=data.get("threshold_max"),
        message=data["message"],
    )
    db.add(alert)
    await db.flush()
    return {
        "id": str(alert.id),
        "alert_type": alert.alert_type,
        "severity": alert.severity,
        "message": alert.message,
    }


async def get_readings(
    db: AsyncSession, company_id: str, sensor_id: str,
    hours_back: int = 24, limit: int = 500,
) -> list[dict]:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours_back)
    result = await db.execute(
        select(SensorReading).where(
            SensorReading.sensor_id == sensor_id,
            SensorReading.company_id == company_id,
            SensorReading.read_at >= cutoff,
        ).order_by(desc(SensorReading.read_at)).limit(limit)
    )
    return [
        {
            "id": str(r.id),
            "temperature": float(r.temperature),
            "humidity": float(r.humidity) if r.humidity else None,
            "battery": r.battery,
            "signal_strength": r.signal_strength,
            "read_at": r.read_at,
        }
        for r in result.scalars().all()
    ]


async def list_alerts(
    db: AsyncSession, company_id: str,
    alert_type: Optional[str] = None, severity: Optional[str] = None,
    unresolved_only: bool = False, limit: int = 100,
) -> list[dict]:
    conditions = [ColdChainAlert.company_id == company_id]
    if alert_type:
        conditions.append(ColdChainAlert.alert_type == alert_type)
    if severity:
        conditions.append(ColdChainAlert.severity == severity)
    if unresolved_only:
        conditions.append(ColdChainAlert.is_resolved == False)

    result = await db.execute(
        select(ColdChainAlert).where(and_(*conditions))
        .order_by(desc(ColdChainAlert.created_at)).limit(limit)
    )
    return [
        {
            "id": str(a.id),
            "sensor_id": str(a.sensor_id),
            "company_id": str(a.company_id),
            "alert_type": a.alert_type,
            "severity": a.severity,
            "temperature": float(a.temperature) if a.temperature else None,
            "threshold_min": float(a.threshold_min) if a.threshold_min else None,
            "threshold_max": float(a.threshold_max) if a.threshold_max else None,
            "message": a.message,
            "is_resolved": a.is_resolved,
            "resolved_at": a.resolved_at,
            "whatsapp_notified": a.whatsapp_notified,
            "created_at": a.created_at,
        }
        for a in result.scalars().all()
    ]


async def resolve_alert(db: AsyncSession, company_id: str, alert_id: str) -> Optional[dict]:
    result = await db.execute(
        select(ColdChainAlert).where(ColdChainAlert.id == alert_id, ColdChainAlert.company_id == company_id)
    )
    alert = result.scalar_one_or_none()
    if not alert:
        return None
    alert.is_resolved = True
    alert.resolved_at = datetime.now(timezone.utc)
    db.add(alert)
    await db.commit()
    return {"status": "resolved"}


async def notify_whatsapp(db: AsyncSession, company_id: str, alert_id: str) -> Optional[dict]:
    result = await db.execute(
        select(ColdChainAlert).where(ColdChainAlert.id == alert_id, ColdChainAlert.company_id == company_id)
    )
    alert = result.scalar_one_or_none()
    if not alert:
        return None
    alert.whatsapp_notified = True
    alert.whatsapp_notified_at = datetime.now(timezone.utc)
    db.add(alert)
    await db.commit()
    return {"status": "notified", "channel": "whatsapp"}


async def start_compliance_log(
    db: AsyncSession, company_id: str, data: dict
) -> dict:
    log = ComplianceLog(
        company_id=company_id,
        sensor_id=data.get("sensor_id"),
        container_id=data.get("container_id"),
        product_id=data.get("product_id"),
        product_name=data.get("product_name"),
        batch_number=data.get("batch_number"),
        start_time=data.get("start_time", datetime.now(timezone.utc)),
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return _log_to_dict(log)


async def close_compliance_log(db: AsyncSession, company_id: str, log_id: str) -> Optional[dict]:
    result = await db.execute(
        select(ComplianceLog).where(ComplianceLog.id == log_id, ComplianceLog.company_id == company_id)
    )
    log = result.scalar_one_or_none()
    if not log:
        return None

    now = datetime.now(timezone.utc)
    log.end_time = now

    result = await db.execute(
        select(SensorReading).where(
            SensorReading.company_id == company_id,
            SensorReading.read_at >= log.start_time,
            SensorReading.read_at <= now,
        ).order_by(SensorReading.read_at)
    )
    readings = result.scalars().all()

    if readings:
        temps = [float(r.temperature) for r in readings]
        log.min_temp = min(temps)
        log.max_temp = max(temps)
        log.avg_temp = round(sum(temps) / len(temps), 2)
        log.total_readings = len(readings)

        log.temp_violations = sum(
            1 for r in readings
            if float(r.temperature) < -2.0 or float(r.temperature) > 8.0
        )
        log.compliant = log.temp_violations == 0

    db.add(log)
    await db.commit()
    await db.refresh(log)
    return _log_to_dict(log)


async def list_compliance_logs(
    db: AsyncSession, company_id: str,
    compliant: Optional[bool] = None, limit: int = 50,
) -> list[dict]:
    conditions = [ComplianceLog.company_id == company_id]
    if compliant is not None:
        conditions.append(ComplianceLog.compliant == compliant)
    result = await db.execute(
        select(ComplianceLog).where(and_(*conditions))
        .order_by(desc(ComplianceLog.created_at)).limit(limit)
    )
    return [_log_to_dict(l) for l in result.scalars().all()]


def _log_to_dict(l: ComplianceLog) -> dict:
    return {
        "id": str(l.id),
        "company_id": str(l.company_id),
        "sensor_id": str(l.sensor_id) if l.sensor_id else None,
        "container_id": str(l.container_id) if l.container_id else None,
        "product_id": str(l.product_id) if l.product_id else None,
        "product_name": l.product_name,
        "batch_number": l.batch_number,
        "start_time": l.start_time,
        "end_time": l.end_time,
        "min_temp": float(l.min_temp) if l.min_temp else None,
        "max_temp": float(l.max_temp) if l.max_temp else None,
        "avg_temp": float(l.avg_temp) if l.avg_temp else None,
        "temp_violations": l.temp_violations or 0,
        "total_readings": l.total_readings or 0,
        "compliant": l.compliant,
        "report_generated": l.report_generated,
        "report_url": l.report_url,
        "created_at": l.created_at,
    }


async def get_dashboard(db: AsyncSession, company_id: str) -> dict:
    result = await db.execute(
        select(ColdSensor).where(ColdSensor.company_id == company_id)
    )
    sensors = result.scalars().all()

    total = len(sensors)
    active = sum(1 for s in sensors if s.is_active)
    now = datetime.now(timezone.utc)
    offline = sum(1 for s in sensors if s.last_reading_at and (now - s.last_reading_at.replace(tzinfo=timezone.utc)).total_seconds() > 900) if sensors else 0

    result = await db.execute(
        select(ColdChainAlert).where(ColdChainAlert.company_id == company_id)
    )
    all_alerts = result.scalars().all()
    unresolved = sum(1 for a in all_alerts if not a.is_resolved)

    result = await db.execute(
        select(ColdChainAlert).where(
            ColdChainAlert.company_id == company_id,
            ColdChainAlert.is_resolved == False,
        ).order_by(desc(ColdChainAlert.created_at)).limit(20)
    )
    recent_alerts_raw = result.scalars().all()
    recent_alerts = [
        {
            "id": str(a.id),
            "sensor_id": str(a.sensor_id),
            "alert_type": a.alert_type,
            "severity": a.severity,
            "message": a.message,
            "is_resolved": a.is_resolved,
            "created_at": a.created_at,
        }
        for a in recent_alerts_raw
    ]

    current_readings = [
        {
            "sensor_id": str(s.id),
            "sensor_name": s.name,
            "temperature": float(s.last_temperature) if s.last_temperature else None,
            "humidity": float(s.last_humidity) if s.last_humidity else None,
            "battery": s.battery_level,
            "location_type": s.location_type,
            "location_name": s.location_name,
            "is_active": s.is_active,
            "last_reading_at": s.last_reading_at,
            "lat": float(s.lat) if s.lat else None,
            "lng": float(s.lng) if s.lng else None,
            "min_temp": float(s.min_temp),
            "max_temp": float(s.max_temp),
        }
        for s in sensors
    ]

    status_summary = [
        {"status": "online", "count": active - offline},
        {"status": "offline", "count": offline},
        {"status": "inactive", "count": total - active},
    ]

    result = await db.execute(
        select(ComplianceLog).where(ComplianceLog.company_id == company_id)
    )
    logs = result.scalars().all()
    compliance_rate = round(sum(1 for l in logs if l.compliant) / max(len(logs), 1) * 100, 1) if logs else None

    return {
        "total_sensors": total,
        "active_sensors": active,
        "offline_sensors": offline if offline else 0,
        "total_alerts": len(all_alerts),
        "unresolved_alerts": unresolved,
        "current_readings": current_readings,
        "recent_alerts": recent_alerts,
        "sensor_status_summary": status_summary,
        "compliance_rate": compliance_rate,
    }


async def update_sensor_config(db: AsyncSession, company_id: str, sensor_id: str, data: dict) -> Optional[dict]:
    result = await db.execute(
        select(ColdSensor).where(ColdSensor.id == sensor_id, ColdSensor.company_id == company_id)
    )
    s = result.scalar_one_or_none()
    if not s:
        return None

    for key in ("name", "min_temp", "max_temp", "max_humidity", "location_type", "location_name", "is_active", "lat", "lng"):
        if key in data:
            setattr(s, key, data[key])
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return _sensor_to_dict(s)
