"""Seed for Cold Chain - sensores, lecturas, alertas, compliance"""
import asyncio
import asyncpg
from datetime import date, datetime, timedelta
from uuid import uuid4
from scripts.seed_data import DB, CID, P003, WH_CENTRAL, CC_SENS1, CC_SENS2, CC_SENS3, CC_READING1, CC_ALERT1, CC_COMPLY1


async def seed():
    conn = await asyncpg.connect(DB)
    try:
        # cc_sensors
        await conn.execute("""
            INSERT INTO cc_sensors (id, company_id, container_id, vehicle_id, name, mac_address, sensor_type, location_type, location_name, lat, lng, min_temp, max_temp, max_humidity, is_active, battery_level, signal_strength, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
            ON CONFLICT (id) DO NOTHING
        """, CC_SENS1, CID, WH_CENTRAL, None, "Cámara Fría Lácteos", "AA:BB:CC:DD:EE:01", "dht22", "warehouse", "Cámara Principal", -25.282, -57.635, -2.0, 6.0, 85.0, True, 85, 92, datetime.utcnow())
        await conn.execute("""
            INSERT INTO cc_sensors (id, company_id, container_id, vehicle_id, name, mac_address, sensor_type, location_type, location_name, lat, lng, min_temp, max_temp, max_humidity, is_active, battery_level, signal_strength, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
            ON CONFLICT (id) DO NOTHING
        """, CC_SENS2, CID, WH_CENTRAL, None, "Freezer Carnes", "AA:BB:CC:DD:EE:02", "dht22", "warehouse", "Freezer Centro", -25.286, -57.638, -18.0, -10.0, None, True, 72, 88, datetime.utcnow())
        await conn.execute("""
            INSERT INTO cc_sensors (id, company_id, container_id, vehicle_id, name, mac_address, sensor_type, location_type, location_name, lat, lng, min_temp, max_temp, max_humidity, is_active, battery_level, signal_strength, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
            ON CONFLICT (id) DO NOTHING
        """, CC_SENS3, CID, WH_CENTRAL, None, "Sensor Cámara Frigorífico", "AA:BB:CC:DD:EE:03", "dht22", "warehouse", "Frigorífico Norte", -25.279, -57.632, -5.0, 8.0, None, True, 95, 76, datetime.utcnow())

        # 5 sensor readings for CC_SENS1 (30 min apart)
        base_time = datetime.utcnow() - timedelta(hours=3)
        readings = [
            (CC_READING1, CC_SENS1, 4.2, 72.0, 85, 92, base_time),
            (uuid4(), CC_SENS1, 5.1, 70.5, 84, 90, base_time + timedelta(minutes=30)),
            (uuid4(), CC_SENS1, 3.8, 74.2, 83, 91, base_time + timedelta(minutes=60)),
            (uuid4(), CC_SENS1, 7.2, 78.0, 82, 89, base_time + timedelta(minutes=90)),
            (uuid4(), CC_SENS1, 4.0, 71.8, 85, 92, base_time + timedelta(minutes=120)),
        ]
        for rid, sid, temp, hum, batt, sig, rtime in readings:
            await conn.execute("""
                INSERT INTO cc_sensor_readings (id, sensor_id, company_id, temperature, humidity, battery, signal_strength, read_at, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (id) DO NOTHING
            """, rid, sid, CID, temp, hum, batt, sig, rtime, datetime.utcnow())

        # 1 alert
        await conn.execute("""
            INSERT INTO cc_cold_chain_alerts (id, sensor_id, company_id, alert_type, severity, temperature, threshold_min, threshold_max, message, is_resolved, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (id) DO NOTHING
        """, CC_ALERT1, CC_SENS1, CID, "temp_out_of_range", "warning", 7.2, -2.0, 6.0, "Temperatura elevada: 7.2°C (máx: 6.0°C)", False, datetime.utcnow())

        # 1 compliance log
        start_t = datetime.utcnow() - timedelta(days=7)
        end_t = datetime.utcnow()
        await conn.execute("""
            INSERT INTO cc_compliance_logs (id, company_id, sensor_id, container_id, product_id, product_name, batch_number, start_time, end_time, min_temp, max_temp, avg_temp, temp_violations, total_readings, compliant, report_generated)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            ON CONFLICT (id) DO NOTHING
        """, CC_COMPLY1, CID, CC_SENS1, WH_CENTRAL, P003, "Leche Entera", "LAC-2026-001", start_t, end_t, 2.1, 5.8, 4.0, 0, 120, True, False)

        print("✅ Cold Chain seeded")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(seed())
