"""Seed data for Servicios Profesionales module (sv_*) - aligned with models.py"""
import asyncio
import secrets
import random
from datetime import date, datetime, timedelta
from uuid import UUID, uuid4
from decimal import Decimal

import asyncpg

random.seed(42)

DB = "postgresql://intelimarket:intelimarket_dev@db:5432/intelimarket"
CID = "00000000-0000-0000-0000-000000000010"

VERTICALS = [
    ("hvac", "HVAC", "Aire Acondicionado y Calefaccion", "wrench"),
    ("plomeria", "Plomeria", "Servicios de plomeria", "droplet"),
    ("electricidad", "Electricidad", "Instalaciones electricas", "zap"),
    ("belleza", "Belleza", "Servicios de belleza a domicilio", "scissors"),
    ("fitness", "Fitness", "Entrenadores personales", "activity"),
    ("salud_domiciliaria", "Salud Domiciliaria", "Cuidados de salud en el hogar", "heart"),
    ("automotriz", "Automotriz", "Mecanica vehicular", "truck"),
    ("construccion", "Construccion", "Obras y remodelaciones", "hammer"),
    ("it", "IT & Tecnologia", "Soporte tecnico informatico", "monitor"),
    ("pest_control", "Fumigacion", "Control de plagas", "bug"),
    ("jardineria", "Jardineria", "Mantenimiento de espacios verdes", "tree"),
    ("limpieza", "Limpieza", "Limpieza residencial y comercial", "sparkles"),
    ("freelance", "Freelance", "Servicios profesionales", "briefcase"),
    ("educacion", "Educacion", "Clases particulares", "book"),
    ("veterinaria", "Veterinaria", "Atencion veterinaria a domicilio", "paw"),
]

SKILLS = [
    ("hvac", "HVAC-001", "Instalacion split", "tecnico", "Instalacion de aire acondicionado split"),
    ("hvac", "HVAC-002", "Reparacion split", "tecnico", "Diagnostico y reparacion"),
    ("hvac", "HVAC-003", "Carga gas refrigerante", "tecnico", "R410A, R22, R32"),
    ("hvac", "HVAC-004", "VRF/VRV", "tecnico", "Sistemas de volumen variable"),
    ("hvac", "HVAC-005", "Calderas", "tecnico", "Calderas a gas y electricas"),
    ("plomeria", "PLO-001", "Destapaciones", "tecnico", "Pluviales y cloacas"),
    ("plomeria", "PLO-002", "Canerias", "tecnico", "Termofusion, PVC, cobre"),
    ("plomeria", "PLO-003", "Artefactos", "tecnico", "Inodoros, bachas, duchas"),
    ("plomeria", "PLO-004", "Bombas", "tecnico", "Bombas presurizadoras"),
    ("electricidad", "ELE-001", "Cableado", "tecnico", "Tendido de cables"),
    ("electricidad", "ELE-002", "Tableros", "tecnico", "Disyuntores, termicas"),
    ("electricidad", "ELE-003", "Puesta a tierra", "tecnico", "Jabalina y medicion"),
    ("electricidad", "ELE-004", "Iluminacion", "tecnico", "Spot, dicroica, LED"),
    ("belleza", "BEL-001", "Corte cabello", "servicio", "Corte dama y caballero"),
    ("belleza", "BEL-002", "Colorimetria", "servicio", "Tintura, mechas"),
    ("belleza", "BEL-003", "Manicura", "servicio", "Esmaltado semipermanente"),
    ("fitness", "FIT-001", "Funcional", "servicio", "Crossfit, TRX"),
    ("fitness", "FIT-002", "Yoga", "servicio", "Hatha, vinyasa"),
    ("salud_domiciliaria", "SAL-001", "Enfermeria", "salud", "Curaciones, inyectables"),
    ("salud_domiciliaria", "SAL-002", "Kinesiologia", "salud", "Rehabilitacion"),
    ("automotriz", "AUT-001", "Service oficial", "tecnico", "Service 10.000/20.000 km"),
    ("automotriz", "AUT-002", "Frenos", "tecnico", "Pastillas, discos, ABS"),
    ("automotriz", "AUT-003", "Diagnostico electronico", "tecnico", "Scanner OBD"),
    ("construccion", "CON-001", "Albanileria", "oficio", "Revoques, contrapisos"),
    ("construccion", "CON-002", "Pintura", "oficio", "Latex, esmalte"),
    ("construccion", "CON-003", "Drywall", "oficio", "Tabiques, cielorrasos"),
    ("it", "ITC-001", "Reparacion PC", "tecnico", "Hardware, software"),
    ("it", "ITC-002", "Redes", "tecnico", "Cableado estructurado"),
    ("it", "ITC-003", "CCTV", "tecnico", "Camaras IP, DVR"),
    ("pest_control", "FUM-001", "Fumigacion", "tecnico", "Insectos"),
    ("pest_control", "FUM-002", "Desratizacion", "tecnico", "Cebos y trampas"),
    ("jardineria", "JAR-001", "Poda", "oficio", "Arboles, arbustos"),
    ("jardineria", "JAR-002", "Riego", "tecnico", "Aspersion, goteo"),
    ("limpieza", "LIM-001", "Limpieza profunda", "servicio", "Limpieza detallada"),
    ("limpieza", "LIM-002", "Post-obra", "servicio", "Limpieza final de obra"),
    ("freelance", "FRE-001", "Diseno grafico", "servicio", "Branding, social media"),
    ("freelance", "FRE-002", "Marketing digital", "servicio", "Meta Ads, Google Ads"),
    ("educacion", "EDU-001", "Ingles", "servicio", "Clases de ingles"),
    ("educacion", "EDU-002", "Musica", "servicio", "Piano, guitarra"),
    ("veterinaria", "VET-001", "Consulta", "salud", "Examen clinico"),
    ("veterinaria", "VET-002", "Vacunacion", "salud", "Calendario vacunal"),
    ("veterinaria", "VET-003", "Cirugia menor", "salud", "Esterilizacion"),
]

ZONES = [
    ("Asuncion Centro", "Asuncion", "Central", 5.0),
    ("Asuncion Carmelitas", "Asuncion", "Central", 5.0),
    ("San Lorenzo", "San Lorenzo", "Central", 10.0),
    ("Luque", "Luque", "Central", 12.0),
    ("Ciudad del Este", "CDE", "Alto Parana", 15.0),
    ("Encarnacion", "Encarnacion", "Itapua", 12.0),
]

PROPERTY_TYPES = ["residencial", "comercial", "corporativo", "industrial"]
EQUIPMENT_TYPES = [
    ("aire_acondicionado", "AC Split 12000 BTU", "Gree", "2020", "operativo"),
    ("aire_acondicionado", "AC Split 18000 BTU", "Midea", "2021", "operativo"),
    ("aire_acondicionado", "AC Central 5TR", "Carrier", "2019", "operativo"),
    ("caldera", "Caldera Peisa", "Peisa", "2022", "operativo"),
    ("bomba", "Tanque agua 1000L", "Rotoplas", "2020", "operativo"),
    ("bomba", "Bomba presurizadora", "Rowa", "2021", "operativo"),
    ("generador", "Generador 5KVA", "Honda", "2022", "operativo"),
    ("ascensor", "Ascensor OTIS", "OTIS", "2018", "operativo"),
    ("heladera_comercial", "Heladera comercial", "Briket", "2023", "operativo"),
    ("seguridad", "Camara CCTV IP", "Hikvision", "2023", "operativo"),
]

TECH_NAMES = [
    "Roberto Acosta", "Patricia Baez", "Gustavo Candia", "Monica Duarte", "Ernesto Fleitas",
    "Laura Gimenez", "Mario Hermosilla", "Sandra Ibarra", "Carlos Jure", "Beatriz Klassen",
    "Daniel Lird", "Patricia Martinez", "Hugo Nunez", "Rosa Orue", "Sergio Paredes",
    "Alicia Rivarola", "Oscar Sanchez", "Marta Troche", "Ruben Ugarte", "Laura Valiente",
]

TECH_CI = [
    "1.234.567", "2.345.678", "3.456.789", "4.567.890", "5.678.901",
    "6.789.012", "7.890.123", "1.111.111", "2.222.222", "3.333.333",
    "4.444.444", "5.555.555", "6.666.666", "7.777.777", "1.888.888",
    "2.999.999", "3.111.222", "4.222.333", "5.333.444", "6.444.555",
]


async def main():
    conn = await asyncpg.connect(DB)
    print("Connected")

    # TRUNCATE everything first
    print("Truncating sv_* tables...")
    await conn.execute("""
        TRUNCATE TABLE
            sv_technician_metrics, sv_technician_reviews, sv_quote_requests,
            sv_invoice_payments, sv_invoices, sv_inventory_movements,
            sv_truck_inventory, sv_contract_visits, sv_service_contracts,
            sv_time_entries, sv_work_order_photos, sv_work_order_items,
            sv_work_orders, sv_appointments, sv_quote_photos, sv_quote_items,
            sv_quotes, sv_equipment, sv_properties, sv_service_zones,
            sv_team_members, sv_teams, sv_technician_availability,
            sv_technician_certifications, sv_technician_skills, sv_technicians,
            sv_skills, sv_service_verticals
        RESTART IDENTITY CASCADE
    """)

    existing_customers = await conn.fetch("SELECT id FROM customers WHERE company_id = $1 LIMIT 50", UUID(CID))
    customer_ids = [r["id"] for r in existing_customers]
    print(f"Existing customers: {len(customer_ids)}")

    # 1. Verticals
    print("\n1. Service Verticals...")
    for slug, nombre, desc, icon in VERTICALS:
        await conn.execute(
            """INSERT INTO sv_service_verticals (id, codigo, nombre, descripcion, icono, activo, created_at)
               VALUES ($1, $2, $3, $4, $5, true, NOW())""",
            uuid4(), slug, nombre, desc, icon
        )
    print(f"  Created {len(VERTICALS)} verticals")

    # 2. Skills
    print("\n2. Skills...")
    for vert_slug, codigo, nombre, categoria, desc in SKILLS:
        await conn.execute(
            """INSERT INTO sv_skills (id, codigo, nombre, categoria, descripcion, nivel_maximo, certificacion_requerida, activo, created_at)
               VALUES ($1, $2, $3, $4, $5, 5, false, true, NOW())""",
            uuid4(), codigo, nombre, categoria, desc
        )
    print(f"  Created {len(SKILLS)} skills")

    # 3. Zones
    print("\n3. Service Zones...")
    for nombre, ciudad, depto, radio in ZONES:
        await conn.execute(
            """INSERT INTO sv_service_zones (id, company_id, nombre, ciudad, departamento, radio_km, activo, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, true, NOW())""",
            uuid4(), UUID(CID), nombre, ciudad, depto, radio
        )
    print(f"  Created {len(ZONES)} zones")

    zones = await conn.fetch("SELECT id FROM sv_service_zones WHERE company_id = $1 ORDER BY nombre", UUID(CID))
    zone_ids = [r["id"] for r in zones]

    # 4. Properties
    print("\n4. Properties...")
    for i in range(80):
        cust_id = customer_ids[i % len(customer_ids)]
        zona = zone_ids[i % len(zone_ids)]
        ptipo = PROPERTY_TYPES[i % 4]
        direccion = f"Av. Espana #{random.randint(100, 9999)}"
        m2 = random.randint(60, 800)
        await conn.execute(
            """INSERT INTO sv_properties (id, company_id, customer_id, zona_id, nombre, tipo, direccion, ciudad, metros_cuadrados, activo, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, 'Asuncion', $8, true, NOW(), NOW())""",
            uuid4(), UUID(CID), cust_id, zona, f"{ptipo.title()} {i+1}", ptipo, direccion, m2
        )
    print(f"  Created 80 properties")

    properties = await conn.fetch("SELECT id FROM sv_properties WHERE company_id = $1 LIMIT 100", UUID(CID))
    property_ids = [r["id"] for r in properties]

    # 5. Equipment
    print("\n5. Equipment...")
    for i in range(100):
        prop = property_ids[i % len(property_ids)]
        etipo, emodelo, emarca, eanio, eestado = EQUIPMENT_TYPES[i % len(EQUIPMENT_TYPES)]
        await conn.execute(
            """INSERT INTO sv_equipment (id, company_id, property_id, customer_id, tipo, marca, modelo, estado, fecha_instalacion, activo, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW(), NOW())""",
            uuid4(), UUID(CID), prop, customer_ids[i % len(customer_ids)], etipo, emarca, emodelo, eestado, date(int(eanio), 1, 1)
        )
    print(f"  Created 100 equipment")

    # 6. Technicians
    print("\n6. Technicians...")
    tech_ids = []
    for i in range(20):
        tid = uuid4()
        tech_ids.append(tid)
        ci = TECH_CI[i]
        nombre = TECH_NAMES[i]
        tarifa = random.choice([35000, 45000, 55000, 65000, 75000, 85000])
        rating = round(random.uniform(3.5, 5.0), 1)
        await conn.execute(
            """INSERT INTO sv_technicians (id, company_id, nombre, ci, telefono, email, vertical_codigo, tarifa_hora_pyg, tarifa_visita_pyg, rating_promedio, color_calendario, zonas_cobertura, activo, disponible, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, $13, NOW(), NOW())""",
            tid, UUID(CID), nombre, ci, f"+5959{random.randint(91000000, 99999999)}",
            f"tecnico{i+1}@servicios.com.py", random.choice([v[0] for v in VERTICALS]),
            tarifa, tarifa * 3, rating, "#3b82f6", [str(z) for z in zone_ids[:3]], random.choice([True, False])
        )

    skills = await conn.fetch("SELECT id, codigo FROM sv_skills")
    skill_list = [(s["id"], s["codigo"]) for s in skills]
    for tid in tech_ids:
        tech_skills = random.sample(skill_list, k=random.randint(3, 5))
        for sid, scod in tech_skills:
            await conn.execute(
                """INSERT INTO sv_technician_skills (id, company_id, technician_id, skill_id, nivel, certificado, created_at)
                   VALUES ($1, $2, $3, $4, $5, $6, NOW()) ON CONFLICT DO NOTHING""",
                uuid4(), UUID(CID), tid, sid, random.randint(1, 5), random.choice([True, False])
            )

    for tid in tech_ids:
        for j in range(random.randint(1, 2)):
            fecha_venc = date.today() + timedelta(days=random.randint(-30, 730))
            await conn.execute(
                """INSERT INTO sv_technician_certifications (id, company_id, technician_id, tipo, nombre, institucion, fecha_emision, fecha_vencimiento, dias_para_vencer, created_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())""",
                uuid4(), UUID(CID), tid,
                random.choice(["matricula", "certificacion_tecnica", "seguro", "habilitacion"]),
                random.choice(["MAT - Manejo de Refrigerantes", "Seguridad Electrica", "Trabajos en Altura", "ISO 9001", "Manejo de Quimicos"]),
                random.choice(["INTN", "SENCE", "Ministerio Trabajo", "OTEC"]),
                date.today() - timedelta(days=random.randint(100, 1000)),
                fecha_venc, (fecha_venc - date.today()).days
            )
    print(f"  Created {len(tech_ids)} technicians")

    # 7. Quote Requests
    print("\n7. Quote Requests...")
    for i in range(30):
        cust = customer_ids[i % len(customer_ids)]
        prop = property_ids[i % len(property_ids)]
        vert_slug = random.choice([v[0] for v in VERTICALS])
        await conn.execute(
            """INSERT INTO sv_quote_requests (id, company_id, customer_id, property_id, vertical_codigo, nombre_contacto, telefono, descripcion, estado, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() - make_interval(days => $10), NOW())""",
            uuid4(), UUID(CID), cust, prop, vert_slug,
            f"Cliente {i+1}", f"+5959{random.randint(91000000, 99999999)}",
            f"Necesito servicio de {vert_slug}",
            random.choice(["nueva", "nueva", "contactada", "en_cotizacion", "convertida", "descartada"]),
            random.randint(0, 30)
        )
    print(f"  Created 30 quote requests")

    # 8. Quotes
    print("\n8. Quotes...")
    for i in range(20):
        qid = uuid4()
        cust = customer_ids[i % len(customer_ids)]
        prop = property_ids[i % len(property_ids)]
        vert_slug = random.choice([v[0] for v in VERTICALS])
        subt_mat = Decimal(str(random.randint(50000, 500000)))
        subt_mo = Decimal(str(random.randint(100000, 800000)))
        descuento = Decimal(str(random.randint(0, 50000)))
        iva_pct = 10
        iva_monto = (subt_mat + subt_mo - descuento) * Decimal("0.10")
        total = subt_mat + subt_mo - descuento + iva_monto
        numero = f"COT-2026-{uuid4().hex[:5].upper()}"
        fecha_cot = date.today() - timedelta(days=random.randint(1, 60))
        fecha_val = fecha_cot + timedelta(days=15)
        await conn.execute(
            """INSERT INTO sv_quotes (id, company_id, numero, customer_id, property_id, vertical_codigo, titulo, descripcion, estado, fecha_cotizacion, fecha_validez, subtmano_obra, subtotal_materiales, descuento_monto, iva_pct, iva_monto, total, tiempo_validez_dias, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 15, NOW() - make_interval(days => $18), NOW())""",
            qid, UUID(CID), numero, cust, prop, vert_slug, f"Cotizacion {vert_slug}", f"Descripcion cot {i+1}",
            random.choice(["borrador", "enviada", "aceptada", "rechazada", "vencida", "convertida_wo"]),
            fecha_cot, fecha_val, subt_mo, subt_mat, descuento, iva_pct, iva_monto, total, random.randint(1, 60)
        )
        for j in range(random.randint(1, 3)):
            tipo = random.choice(["mano_obra", "material", "equipo", "subcontrato"])
            cant = Decimal(str(random.randint(1, 5)))
            pu = Decimal(str(random.randint(20000, 200000)))
            subt = pu * cant
            await conn.execute(
                """INSERT INTO sv_quote_items (id, company_id, quote_id, tipo, descripcion, cantidad, precio_unitario, subtotal, created_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())""",
                uuid4(), UUID(CID), qid, tipo, f"Item {tipo} {j+1}", cant, pu, subt
            )
    print(f"  Created 20 quotes")

    # 9. Work Orders
    print("\n9. Work Orders...")
    for i in range(30):
        cust = customer_ids[i % len(customer_ids)]
        prop = property_ids[i % len(property_ids)]
        tech = tech_ids[i % len(tech_ids)]
        vert_slug = random.choice([v[0] for v in VERTICALS])
        numero = f"WO-2026-{uuid4().hex[:5].upper()}"
        fecha_prog = datetime.now() - timedelta(days=random.randint(-10, 60))
        subt_mat = Decimal(str(random.randint(30000, 400000)))
        subt_mo = Decimal(str(random.randint(80000, 600000)))
        iva_monto = (subt_mat + subt_mo) * Decimal("0.10")
        total = subt_mat + subt_mo + iva_monto
        estado = random.choice(["agendada", "en_camino", "en_sitio", "en_progreso", "completada", "facturada", "cancelada"])
        dur_real = random.randint(30, 480) if estado in ["completada", "facturada"] else None
        await conn.execute(
            """INSERT INTO sv_work_orders (id, company_id, numero, customer_id, property_id, technician_id, vertical_codigo, titulo, descripcion, estado, prioridad, fecha_programada, fecha_inicio_real, fecha_fin_real, duracion_real_min, subtmano_obra, subtotal_materiales, iva_monto, total, requiere_factura, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW() - make_interval(days => $21), NOW())""",
            uuid4(), UUID(CID), numero, cust, prop, tech, vert_slug, f"Trabajo {vert_slug} {i+1}",
            f"Descripcion {i+1}", estado, random.choice(["baja", "normal", "alta", "urgente"]),
            fecha_prog.date(),
            fecha_prog if estado not in ["agendada"] else None,
            fecha_prog + timedelta(hours=2) if dur_real else None,
            dur_real, subt_mo, subt_mat, iva_monto, total,
            estado in ["completada", "facturada"], random.randint(0, 60)
        )
    print(f"  Created 30 work orders")

    # 10. Service Contracts
    print("\n10. Service Contracts...")
    contract_ids = []
    for i in range(15):
        cid = uuid4()
        contract_ids.append(cid)
        cust = customer_ids[i % len(customer_ids)]
        prop = property_ids[i % len(property_ids)]
        vert_slug = random.choice([v[0] for v in VERTICALS])
        numero = f"CONT-2026-{uuid4().hex[:5].upper()}"
        fecha_ini = date.today() - timedelta(days=random.randint(30, 300))
        fecha_fin = fecha_ini + timedelta(days=365)
        visitas_anio = random.choice([4, 6, 12, 24])
        monto_mensual = Decimal(str(random.randint(150000, 1500000)))
        monto_total = monto_mensual * 12
        await conn.execute(
            """INSERT INTO sv_service_contracts (id, company_id, numero, customer_id, property_id, vertical_codigo, titulo, descripcion, estado, fecha_inicio, fecha_fin, frecuencia, visitas_totales, visitas_realizadas, monto_mensual, monto_total, dia_facturacion, renovacion_auto, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 0, $14, $15, 1, true, NOW(), NOW())""",
            cid, UUID(CID), numero, cust, prop, vert_slug, f"Contrato {vert_slug}", f"Plan de mantenimiento {i+1}",
            random.choice(["activo", "activo", "activo", "vencido", "cancelado"]),
            fecha_ini, fecha_fin,
            random.choice(["mensual", "trimestral", "semestral", "anual"]),
            visitas_anio, monto_mensual, monto_total
        )

    visits_created = 0
    for cid in contract_ids:
        c = await conn.fetchrow("SELECT visitas_totales, fecha_inicio, frecuencia FROM sv_service_contracts WHERE id = $1", cid)
        if not c: continue
        delta_days = {"mensual": 30, "trimestral": 90, "semestral": 180, "anual": 365}.get(c["frecuencia"], 30)
        for j in range(c["visitas_totales"]):
            fecha_visita = c["fecha_inicio"] + timedelta(days=delta_days * j)
            estado = "completada" if fecha_visita < date.today() else random.choice(["programada", "confirmada", "reagendada"])
            await conn.execute(
                """INSERT INTO sv_contract_visits (id, company_id, contract_id, fecha_programada, estado, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, $5, NOW(), NOW())""",
                uuid4(), UUID(CID), cid, fecha_visita, estado
            )
            visits_created += 1
    print(f"  Created 15 contracts with {visits_created} visits")

    # 11. Invoices
    print("\n11. Invoices...")
    completed_wos = await conn.fetch(
        "SELECT id, total, fecha_programada, customer_id FROM sv_work_orders WHERE company_id = $1 AND estado IN ('completada', 'facturada') ORDER BY fecha_programada DESC LIMIT 25",
        UUID(CID)
    )
    invoice_count = 0
    for i, wo in enumerate(completed_wos):
        estado = random.choice(["emitida", "pagada", "pagada", "parcial", "vencida", "anulada"])
        wo_total = Decimal(str(wo["total"]))
        monto_pagado = wo_total if estado == "pagada" else (wo_total * Decimal("0.5") if estado == "parcial" else Decimal("0"))
        iva_monto = wo_total * Decimal("0.10") / Decimal("1.10")
        subtotal = wo_total - iva_monto
        fecha_emi = (wo["fecha_programada"] + timedelta(days=1)) if wo["fecha_programada"] else date.today() - timedelta(days=random.randint(1, 30))
        fecha_venc = fecha_emi + timedelta(days=30)
        await conn.execute(
            """INSERT INTO sv_invoices (id, company_id, work_order_id, customer_id, numero, fecha_emision, fecha_vencimiento, subtotal, iva, total, monto_pagado, saldo, estado, metodo_pago, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())""",
            uuid4(), UUID(CID), wo["id"], wo["customer_id"], f"FAC-2026-{uuid4().hex[:5].upper()}",
            fecha_emi, fecha_venc, subtotal, iva_monto, wo_total, monto_pagado, wo_total - monto_pagado,
            estado, random.choice(["efectivo", "transferencia", "tarjeta", "qr"])
        )
        invoice_count += 1
    print(f"  Created {invoice_count} invoices")

    # 12. Truck Inventory
    print("\n12. Truck Inventory...")
    products = await conn.fetch("SELECT id FROM products WHERE company_id = $1 LIMIT 30", UUID(CID))
    inventory_count = 0
    for tech in tech_ids[:10]:
        for j in range(random.randint(5, 12)):
            if not products: break
            prod = random.choice(products)
            cant_actual = random.randint(1, 50)
            await conn.execute(
                """INSERT INTO sv_truck_inventory (id, company_id, technician_id, producto_id, sku, descripcion, cantidad_actual, cantidad_minima, cantidad_maxima, ubicacion_camion, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())""",
                uuid4(), UUID(CID), tech, prod["id"], f"SKU-{random.randint(1000, 9999)}",
                f"Inventario item {j+1}", cant_actual, 5, 100, f"Estante {chr(65 + j % 5)}"
            )
            inventory_count += 1
    print(f"  Created {inventory_count} truck inventory items")

    print("\n=== SEED COMPLETED ===")
    await conn.close()


asyncio.run(main())
