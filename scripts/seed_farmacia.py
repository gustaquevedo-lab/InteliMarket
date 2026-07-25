"""Seed Farmacia Paraguay — 42 principios activos, 52 medicamentos, 20 equivalentes, 44 DDI, 5 OS, 10 médicos, 30 pacientes."""
import asyncio
import sys
from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID

sys.path.insert(0, "/app")
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from api.src.db import Base
from api.src.farmacia import models


DB_URL = "postgresql+asyncpg://intelimarket:intelimarket_dev@db:5432/intelimarket"
COMPANY_ID = UUID("00000000-0000-0000-0000-000000000010")


async def seed():
    engine = create_async_engine(DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as s:
        # Verify company exists
        r = await s.execute(text("SELECT id FROM companies WHERE id = :id"), {"id": str(COMPANY_ID)})
        if not r.first():
            print(f"❌ Company {COMPANY_ID} no existe. Crear primero.")
            return

        # ============================================================
        # 1. PRINCIPIOS ACTIVOS (42)
        # ============================================================
        principios = [
            # nombre, dci, codigo_atc, categoria, embarazo, controlado, categoria_controlado
            ("Paracetamol", "Acetaminofén", "N02BE01", "Analgésico antipirético", "B", False, None),
            ("Ibuprofeno", "Ibuprofen", "M01AE01", "AINE", "C", False, None),
            ("Naproxeno", "Naproxen", "M01AE02", "AINE", "C", False, None),
            ("Diclofenaco", "Diclofenac", "M01AB05", "AINE", "C", False, None),
            ("Ketorolaco", "Ketorolac", "M01AB15", "AINE", "C", False, None),
            ("Aspirina", "Ácido Acetilsalicílico", "N02BA01", "Salicilato / Antiagregante", "D", False, None),
            ("Metamizol", "Dipirona", "N02BB02", "Analgésico", "C", False, None),
            ("Tramadol", "Tramadol", "N02AX02", "Opioide menor", "C", True, "lista_2"),
            ("Codeína", "Codeine", "R05DA04", "Opioide antitusivo", "C", True, "lista_1"),
            ("Morfina", "Morphine", "N02AA01", "Opioide mayor", "C", True, "lista_1"),
            ("Fentanilo", "Fentanyl", "N02AB03", "Opioide mayor", "C", True, "lista_1"),
            ("Amoxicilina", "Amoxicillin", "J01CA04", "Antibiótico penicilina", "B", False, None),
            ("Ampicilina", "Ampicillin", "J01CA01", "Antibiótico penicilina", "B", False, None),
            ("Azitromicina", "Azithromycin", "J01FA10", "Antibiótico macrólido", "B", False, None),
            ("Ciprofloxacino", "Ciprofloxacin", "J01MA02", "Antibiótico quinolona", "C", False, None),
            ("Levofloxacino", "Levofloxacin", "J01MA12", "Antibiótico quinolona", "C", False, None),
            ("Cefalexina", "Cefalexin", "J01DB01", "Antibiótico cefalosporina", "B", False, None),
            ("Ceftriaxona", "Ceftriaxone", "J01DD04", "Antibiótico cefalosporina", "B", False, None),
            ("Sulfametoxazol", "Sulfamethoxazole", "J01EC01", "Antibiótico sulfonamida", "C", False, None),
            ("Trimetoprima", "Trimethoprim", "J01EA01", "Antibiótico", "C", False, None),
            ("Metronidazol", "Metronidazole", "J01XD01", "Antibiótico nitroimidazol", "B", False, None),
            ("Enalapril", "Enalapril", "C09AA02", "IECA antihipertensivo", "D", False, None),
            ("Losartán", "Losartan", "C09CA01", "ARA-II antihipertensivo", "D", False, None),
            ("Amlodipina", "Amlodipine", "C08CA01", "Calcioantagonista", "C", False, None),
            ("Hidroclorotiazida", "Hydrochlorothiazide", "C03AA03", "Diurético", "B", False, None),
            ("Metoprolol", "Metoprolol", "C07AB02", "Betabloqueante", "C", False, None),
            ("Atorvastatina", "Atorvastatin", "C10AA05", "Estatina", "X", False, None),
            ("Simvastatina", "Simvastatin", "C10AA01", "Estatina", "X", False, None),
            ("Metformina", "Metformin", "A10BA02", "Antidiabético biguanida", "B", False, None),
            ("Glibenclamida", "Glyburide", "A10BB01", "Antidiabético sulfonilurea", "C", False, None),
            ("Insulina NPH", "Insulin NPH", "A10AC01", "Insulina", "B", False, None),
            ("Insulina Glargina", "Insulin Glargine", "A10AE04", "Insulina basal", "C", False, None),
            ("Omeprazol", "Omeprazole", "A02BC01", "IBP", "C", False, None),
            ("Pantoprazol", "Pantoprazole", "A02BC02", "IBP", "B", False, None),
            ("Ranitidina", "Ranitidine", "A02BA02", "Anti-H2 (retirado)", "B", False, None),
            ("Diazepam", "Diazepam", "N05BA01", "Benzodiazepina", "D", True, "lista_2"),
            ("Alprazolam", "Alprazolam", "N05BA12", "Benzodiazepina", "D", True, "lista_2"),
            ("Clonazepam", "Clonazepam", "N03AE01", "Benzodiazepina anticonvulsivante", "D", True, "lista_2"),
            ("Lorazepam", "Lorazepam", "N05BA06", "Benzodiazepina", "D", True, "lista_2"),
            ("Sertralina", "Sertraline", "N06AB06", "ISRS antidepresivo", "C", False, None),
            ("Fluoxetina", "Fluoxetine", "N06AB03", "ISRS antidepresivo", "C", False, None),
            ("Levotiroxina", "Levothyroxine", "H03AA01", "Hormona tiroidea", "A", False, None),
            ("Warfarina", "Warfarin", "B01AA03", "Anticoagulante cumarínico", "X", False, None),
        ]

        # Check existing
        existing_pa = await s.execute(select(models.ActiveIngredient).where(models.ActiveIngredient.company_id == COMPANY_ID))
        pa_map = {p.nombre: p for p in existing_pa.scalars().all()}
        if not pa_map:
            for nombre, dci, atc, cat, emb, ctrl, cat_ctrl in principios:
                pa = models.ActiveIngredient(
                    company_id=COMPANY_ID,
                    nombre=nombre, dci=dci, codigo_atc=atc, categoria=cat,
                    embarazo_categoria=emb, es_controlado=ctrl, categoria_controlado=cat_ctrl,
                    requiere_receta=ctrl or cat in ("Antibiótico", "Opioide menor", "Opioide mayor"),
                )
                s.add(pa)
            await s.flush()
            existing_pa = await s.execute(select(models.ActiveIngredient).where(models.ActiveIngredient.company_id == COMPANY_ID))
            pa_map = {p.nombre: p for p in existing_pa.scalars().all()}
            print(f"✅ {len(pa_map)} principios activos creados")
        else:
            print(f"ℹ️  {len(pa_map)} principios activos ya existen")

        # ============================================================
        # 2. MEDICAMENTOS (52)
        # ============================================================
        meds_data = [
            # (marca, PA_nombre, concentracion, forma, via, laboratorio, generico, controlado, cat_ctrl, retencion, cadena_frio, precio)
            ("Tafirol", "Paracetamol", "500 mg", "comprimido", "oral", "Gramon", False, False, None, False, False, 4500),
            ("Paracetamol Genérico", "Paracetamol", "500 mg", "comprimido", "oral", "MK", True, False, None, False, False, 1800),
            ("Paracetamol Genérico", "Paracetamol", "120 mg/5 ml", "jarabe", "oral", "MK", True, False, None, False, False, 8500),
            ("Ibupirac", "Ibuprofeno", "400 mg", "comprimido", "oral", "Bayer", False, False, None, False, False, 8500),
            ("Ibupirac Forte", "Ibuprofeno", "600 mg", "comprimido", "oral", "Bayer", False, False, None, False, False, 12500),
            ("Ibuprofeno Genérico", "Ibuprofeno", "400 mg", "comprimido", "oral", "MK", True, False, None, False, False, 4200),
            ("Naproxeno", "Naproxeno", "550 mg", "comprimido", "oral", "MK", True, False, None, False, False, 9800),
            ("Voltaren", "Diclofenaco", "50 mg", "comprimido", "oral", "Novartis", False, False, None, False, False, 14200),
            ("Diclofenaco Genérico", "Diclofenaco", "50 mg", "comprimido", "oral", "MK", True, False, None, False, False, 6500),
            ("Dolac", "Ketorolaco", "10 mg", "comprimido", "oral", "Siegfried", False, False, None, False, False, 18900),
            ("Bayaspirina", "Aspirina", "100 mg", "comprimido", "oral", "Bayer", False, False, None, False, False, 5500),
            ("Aspirina Prevent", "Aspirina", "325 mg", "comprimido", "oral", "Bayer", False, False, None, False, False, 8200),
            ("Metamizol", "Metamizol", "500 mg", "comprimido", "oral", "MK", True, False, None, False, False, 3800),
            ("Tramal", "Tramadol", "50 mg", "capsula", "oral", "Grunenthal", False, True, "lista_2", True, False, 22500),
            ("Tramadol Genérico", "Tramadol", "50 mg", "capsula", "oral", "MK", True, True, "lista_2", True, False, 12800),
            ("Codeína", "Codeína", "30 mg", "comprimido", "oral", "MK", True, True, "lista_1", True, False, 15800),
            ("Morfina", "Morfina", "10 mg/ml", "inyectable", "intravenosa", "Cristália", False, True, "lista_1", True, False, 38500),
            ("Fentanilo", "Fentanilo", "100 mcg/h", "parche", "transdermica", "Janssen", False, True, "lista_1", True, False, 128500),
            ("Amoxil", "Amoxicilina", "500 mg", "capsula", "oral", "GSK", False, False, None, False, False, 18900),
            ("Amoxicilina Genérica", "Amoxicilina", "500 mg", "capsula", "oral", "MK", True, False, None, False, False, 8500),
            ("Amoxicilina", "Amoxicilina", "250 mg/5 ml", "suspension", "oral", "MK", True, False, None, False, False, 15800),
            ("Ampicilina", "Ampicilina", "500 mg", "capsula", "oral", "MK", True, False, None, False, False, 12500),
            ("Zitromax", "Azitromicina", "500 mg", "comprimido", "oral", "Pfizer", False, False, None, False, False, 35800),
            ("Azitromicina", "Azitromicina", "500 mg", "comprimido", "oral", "MK", True, False, None, False, False, 18900),
            ("Ciprofloxacino", "Ciprofloxacino", "500 mg", "comprimido", "oral", "Bayer", True, False, None, False, False, 22500),
            ("Tavanic", "Levofloxacino", "500 mg", "comprimido", "oral", "Sanofi", False, False, None, False, False, 42800),
            ("Cefalexina", "Cefalexina", "500 mg", "capsula", "oral", "MK", True, False, None, False, False, 14200),
            ("Ceftriaxona", "Ceftriaxona", "1 g", "inyectable", "intravenosa", "MK", True, False, None, False, False, 38900),
            ("Bactrim", "Sulfametoxazol", "400/80 mg", "comprimido", "oral", "Roche", False, False, None, False, False, 16800),
            ("Flagyl", "Metronidazol", "500 mg", "comprimido", "oral", "Sanofi", False, False, None, False, False, 12500),
            ("Renitec", "Enalapril", "10 mg", "comprimido", "oral", "MSD", False, False, None, False, False, 18900),
            ("Enalapril", "Enalapril", "10 mg", "comprimido", "oral", "MK", True, False, None, False, False, 8500),
            ("Cozaar", "Losartán", "50 mg", "comprimido", "oral", "MSD", False, False, None, False, False, 24500),
            ("Losartán", "Losartán", "50 mg", "comprimido", "oral", "MK", True, False, None, False, False, 12500),
            ("Norvas", "Amlodipina", "5 mg", "comprimido", "oral", "Pfizer", False, False, None, False, False, 22400),
            ("Hidroclorotiazida", "Hidroclorotiazida", "25 mg", "comprimido", "oral", "MK", True, False, None, False, False, 5800),
            ("Seloken", "Metoprolol", "50 mg", "comprimido", "oral", "AstraZeneca", False, False, None, False, False, 19800),
            ("Lipitor", "Atorvastatina", "20 mg", "comprimido", "oral", "Pfizer", False, False, None, False, False, 45800),
            ("Atorvastatina", "Atorvastatina", "20 mg", "comprimido", "oral", "MK", True, False, None, False, None, 18900),
            ("Glucophage", "Metformina", "850 mg", "comprimido", "oral", "Merck", False, False, None, False, False, 22500),
            ("Metformina", "Metformina", "850 mg", "comprimido", "oral", "MK", True, False, None, False, False, 9500),
            ("Insulina NPH", "Insulina NPH", "100 UI/ml", "inyectable", "subcutanea", "Novo Nordisk", False, False, None, False, True, 89500),
            ("Lantus", "Insulina Glargina", "100 UI/ml", "inyectable", "subcutanea", "Sanofi", False, False, None, False, True, 168500),
            ("Losec", "Omeprazol", "20 mg", "capsula", "oral", "AstraZeneca", False, False, None, False, False, 28500),
            ("Omeprazol", "Omeprazol", "20 mg", "capsula", "oral", "MK", True, False, None, False, False, 12500),
            ("Pantoprazol", "Pantoprazol", "40 mg", "comprimido", "oral", "MK", True, False, None, False, False, 14200),
            ("Valium", "Diazepam", "10 mg", "comprimido", "oral", "Roche", False, True, "lista_2", True, False, 24500),
            ("Xanax", "Alprazolam", "0.5 mg", "comprimido", "oral", "Pfizer", False, True, "lista_2", True, False, 32500),
            ("Rivotril", "Clonazepam", "2 mg", "comprimido", "oral", "Roche", False, True, "lista_2", True, False, 28500),
            ("Zoloft", "Sertralina", "50 mg", "comprimido", "oral", "Pfizer", False, False, None, False, False, 38500),
            ("Prozac", "Fluoxetina", "20 mg", "capsula", "oral", "Lilly", False, False, None, False, False, 42800),
            ("Eutirox", "Levotiroxina", "100 mcg", "comprimido", "oral", "Merck", False, False, None, False, False, 18900),
            ("Coumadin", "Warfarina", "5 mg", "comprimido", "oral", "BMS", False, False, None, False, False, 24500),
        ]

        existing_meds = await s.execute(select(models.Medication).where(models.Medication.company_id == COMPANY_ID))
        if not existing_meds.scalars().first():
            # Create products first (stub products in products table for FK)
            from api.src.products.models import Product
            r_prod = await s.execute(text(f"SELECT id FROM products WHERE company_id = '{COMPANY_ID}' LIMIT 1"))
            first_prod = r_prod.first()
            if not first_prod:
                # Create stub products
                for i, m_data in enumerate(meds_data):
                    marca = m_data[0]
                    p = Product(
                        company_id=COMPANY_ID,
                        sku=f"FARM-MED-{i+1:04d}",
                        nombre=marca,
                        precio_venta=Decimal(str(m_data[11])),
                        precio_costo=Decimal(str(m_data[11] * 0.6)),
                        activo=True,
                    )
                    s.add(p)
                await s.flush()
                r_prod2 = await s.execute(text(f"SELECT id FROM products WHERE company_id = '{COMPANY_ID}' AND sku LIKE 'FARM-MED-%' ORDER BY sku"))
                product_ids = [row[0] for row in r_prod2.all()]
            else:
                r_prod2 = await s.execute(text(f"SELECT id FROM products WHERE company_id = '{COMPANY_ID}' AND sku LIKE 'FARM-MED-%' ORDER BY sku"))
                product_ids = [row[0] for row in r_prod2.all()]
                if len(product_ids) < len(meds_data):
                    extra = len(meds_data) - len(product_ids)
                    for i in range(extra):
                        m_data = meds_data[len(product_ids)]
                        p = Product(
                            company_id=COMPANY_ID,
                            sku=f"FARM-MED-{len(product_ids)+1+i:04d}",
                            nombre=m_data[0],
                            precio_venta=Decimal(str(m_data[11])),
                            costo_promedio=Decimal(str(m_data[11] * 0.6)),
                            ultimo_costo=Decimal(str(m_data[11] * 0.6)),
                            activo=True,
                        )
                        s.add(p)
                    await s.flush()
                    r_prod2 = await s.execute(text(f"SELECT id FROM products WHERE company_id = '{COMPANY_ID}' AND sku LIKE 'FARM-MED-%' ORDER BY sku"))
                    product_ids = [row[0] for row in r_prod2.all()]

            for i, m_data in enumerate(meds_data):
                (marca, pa_nombre, conc, forma, via, lab, generico, controlado, cat_ctrl, retencion, cadena_frio, precio) = m_data
                pa = pa_map.get(pa_nombre)
                if not pa:
                    continue
                med = models.Medication(
                    company_id=COMPANY_ID,
                    product_id=product_ids[i] if i < len(product_ids) else product_ids[0],
                    principio_activo_id=pa.id,
                    concentracion=conc,
                    concentracion_numerica=Decimal(conc.split()[0]) if conc.split()[0].replace(".", "").isdigit() else None,
                    concentracion_unidad=conc.split()[1] if len(conc.split()) > 1 else None,
                    forma_farmaceutica=forma,
                    via_administracion=via,
                    laboratorio=lab,
                    marca_comercial=marca,
                    es_generico=generico,
                    es_controlado=controlado,
                    categoria_controlado=cat_ctrl,
                    requiere_receta_retencion=retencion,
                    requiere_cadena_frio=cadena_frio,
                    temp_min=Decimal("2.0") if cadena_frio else None,
                    temp_max=Decimal("8.0") if cadena_frio else None,
                    registro_sanitario=f"MSPBS-{i+1:05d}",
                )
                s.add(med)
            await s.flush()
            print(f"✅ {len(meds_data)} medicamentos creados")
        else:
            print(f"ℹ️  Medicamentos ya existen")

        # ============================================================
        # 3. EQUIVALENTES (20)
        # ============================================================
        existing_eq = await s.execute(select(models.MedicationEquivalent).where(models.MedicationEquivalent.company_id == COMPANY_ID))
        if not existing_eq.scalars().first():
            r_meds = await s.execute(select(models.Medication).where(models.Medication.company_id == COMPANY_ID))
            med_list = list(r_meds.scalars().all())
            # Find pairs by principio_activo
            by_pa = {}
            for m in med_list:
                by_pa.setdefault(m.principio_activo_id, []).append(m)
            added = 0
            for pa_id, meds in by_pa.items():
                if len(meds) < 2:
                    continue
                # First one is "marca", others are "generico"
                marca = next((m for m in meds if not m.es_generico), meds[0])
                genericos = [m for m in meds if m.es_generico]
                for g in genericos[:1]:  # Solo 1 equivalente por PA
                    eq = models.MedicationEquivalent(
                        company_id=COMPANY_ID,
                        medication_id=marca.id,
                        equivalent_medication_id=g.id,
                        tipo="generico",
                        diferencia_precio_pct=Decimal("40"),
                        sustitucion_automatica=True,
                    )
                    s.add(eq)
                    added += 1
                    if added >= 20:
                        break
                if added >= 20:
                    break
            await s.flush()
            print(f"✅ {added} equivalentes creados")

        # ============================================================
        # 4. INTERACCIONES DDI (44)
        # ============================================================
        existing_ddi = await s.execute(select(models.DrugInteraction).where(models.DrugInteraction.company_id.is_(None)))
        if not existing_ddi.scalars().first():
            interacciones = [
                # (PA_a, PA_b, severidad, mecanismo, efecto, recomendacion)
                ("Warfarina", "Aspirina", "grave", "Antiagregante + anticoagulante", "Riesgo hemorragia mayor", "Evitar. Usar paracetamol."),
                ("Warfarina", "Ibuprofeno", "grave", "AINEs desplazan warfarina de proteínas", "Aumento INR, sangrado", "Evitar AINEs. Usar paracetamol."),
                ("Warfarina", "Naproxeno", "grave", "Mismo mecanismo", "Sangrado GI", "Evitar. Alternativa: paracetamol."),
                ("Warfarina", "Diclofenaco", "grave", "Mismo mecanismo", "Sangrado GI mayor", "Evitar combinación."),
                ("Warfarina", "Tramadol", "moderada", "Tramadol inhibe recaptación serotonina", "Aumento riesgo sangrado", "Monitorear INR."),
                ("Warfarina", "Amiodarona", "grave", "Inhibición CYP2C9", "Aumento 50-100% efecto warfarina", "Reducir dosis warfarina 30-50%."),
                ("Morfina", "Diazepam", "grave", "Depresión SNC aditiva", "Sedación severa, riesgo paro respiratorio", "Evitar BZD con opioides."),
                ("Morfina", "Alprazolam", "grave", "Mismo mecanismo", "Sedación severa", "FDA Black Box Warning. Evitar."),
                ("Fentanilo", "Diazepam", "contraindicada", "Mismo mecanismo", "Riesgo paro respiratorio", "FDA Black Box. NO combinar."),
                ("Fentanilo", "Alprazolam", "contraindicada", "Mismo mecanismo", "Riesgo paro respiratorio", "NO combinar."),
                ("Tramadol", "Sertralina", "grave", "Síndrome serotoninérgico", "Agitación, hipertermia, mioclonías", "Evitar. Usar otro opioide."),
                ("Tramadol", "Fluoxetina", "grave", "Síndrome serotoninérgico", "Mismo efecto", "Evitar combinación."),
                ("Linezolid", "Sertralina", "contraindicada", "IMAO + ISRS", "Síndrome serotoninérgico fatal", "NO combinar."),
                ("Aspirina", "Ibuprofeno", "moderada", "Ibuprofeno antagoniza antiagregante", "Reduce efecto cardioprotector", "Administrar aspirina 2h antes que ibuprofeno."),
                ("Enalapril", "Ibuprofeno", "moderada", "AINEs inhiben prostaglandinas renales", "Reduce efecto antihipertensivo, riesgo renal", "Monitorear PA y función renal."),
                ("Enalapril", "Diclofenaco", "moderada", "Mismo mecanismo", "Mismo efecto", "Monitorear PA."),
                ("Enalapril", "Espironolactona", "moderada", "Hiperkalemia", "Aumento K+ sérico", "Monitorear K+."),
                ("Metformina", "Furosemida", "leve", "Interacción menor", "Sin efecto clínico", "No requiere acción."),
                ("Digoxina", "Furosemida", "moderada", "Hipokalemia sensibiliza a digoxina", "Arritmias", "Monitorear K+ y digoxinemia."),
                ("Digoxina", "Amiodarona", "grave", "Aumento niveles digoxina", "Toxicidad digitálica", "Reducir digoxina 50%."),
                ("Sildenafil", "Nitratos", "contraindicada", "Potenciación vasodilatación", "Hipotensión severa", "NO combinar. Riesgo fatal."),
                ("Litio", "Ibuprofeno", "moderada", "AINEs reducen clearence litio", "Toxicidad por litio", "Monitorear litemia."),
                ("Litio", "Diclofenaco", "moderada", "Mismo mecanismo", "Misma toxicidad", "Monitorear litemia."),
                ("Litio", "Hidroclorotiazida", "moderada", "Reduce clearence litio", "Toxicidad", "Monitorear litemia."),
                ("Clonazepam", "Omeprazol", "leve", "Inhibición CYP leve", "Sin efecto clínico", "Sin acción."),
                ("Omeprazol", "Clopidogrel", "grave", "Omeprazol inhibe CYP2C19", "Reduce activación clopidogrel", "Usar pantoprazol en su lugar."),
                ("Insulina NPH", "Betabloqueantes", "moderada", "Enmascaran hipoglucemia", "Dificultad detectar hipoglucemia", "Monitoreo estricto de glucemia."),
                ("Corticoides", "AINEs", "moderada", "Aumento riesgo úlcera", "Úlcera péptica", "Considerar IBP profiláctico."),
                ("Metotrexato", "AINEs", "grave", "Reducen clearence metotrexato", "Toxicidad medular", "Evitar AINEs en quimioterapia."),
                ("Metotrexato", "Trimetoprima", "grave", "Mismo mecanismo antifolato", "Toxicidad medular severa", "Evitar combinación."),
                ("Teofilina", "Ciprofloxacino", "grave", "Cipro inhibe CYP1A2", "Toxicidad teofilina", "Reducir dosis teofilina 50%."),
                ("Teofilina", "Fluvoxamina", "contraindicada", "Inhibición CYP1A2 severa", "Toxicidad teofilina", "NO combinar."),
                ("Sulfametoxazol", "Metotrexato", "grave", "Desplazamiento + antifolato", "Toxicidad medular", "Evitar."),
                ("Sulfametoxazol", "Warfarina", "grave", "Desplaza warfarina", "Aumento INR", "Monitorear INR estrecho."),
                ("Ketoconazol", "Atorvastatina", "contraindicada", "Inhibición CYP3A4 severa", "Rabdomiólisis", "NO combinar o usar pravastatina."),
                ("Eritromicina", "Atorvastatina", "grave", "Mismo mecanismo", "Rabdomiólisis", "Suspender estatina o usar azitromicina."),
                ("Claritromicina", "Atorvastatina", "grave", "Mismo mecanismo", "Rabdomiólisis", "Misma acción."),
                ("Rifampicina", "Anticonceptivos", "grave", "Inducción CYP3A4", "Falla anticonceptiva", "Usar método barrera adicional."),
                ("Rifampicina", "Warfarina", "grave", "Inducción CYP", "Reducción efecto warfarina", "Aumentar dosis warfarina, monitorear INR."),
                ("Carbamazepina", "Anticonceptivos", "grave", "Inducción CYP3A4", "Falla anticonceptiva", "Método barrera."),
                ("Carbamazepina", "Warfarina", "grave", "Inducción CYP", "Reducción efecto", "Ajustar warfarina."),
                ("Fenitoína", "Anticonceptivos", "grave", "Inducción CYP", "Falla anticonceptiva", "Método barrera."),
                ("Fenitoína", "Warfarina", "grave", "Inducción CYP", "Reducción efecto", "Ajustar warfarina."),
                ("Alopurinol", "Azatioprina", "contraindicada", "Inhibe xantina oxidasa", "Toxicidad azatioprina fatal", "NO combinar."),
                ("Alopurinol", "Ampicilina", "moderada", "Mecanismo no claro", "Erupciones cutáneas", "Usar otra penicilina."),
            ]
            for pa_a, pa_b, sev, mec, ef, rec in interacciones:
                pa_a_obj = pa_map.get(pa_a)
                pa_b_obj = pa_map.get(pa_b)
                if not pa_a_obj or not pa_b_obj:
                    continue
                ddi = models.DrugInteraction(
                    company_id=None,  # Global catalog
                    principio_activo_a_id=pa_a_obj.id,
                    principio_activo_b_id=pa_b_obj.id,
                    severidad=sev,
                    mecanismo=mec,
                    efecto_clinico=ef,
                    recomendacion=rec,
                    nivel_evidencia="alto",
                    fuente="Stockley 11va Ed.",
                )
                s.add(ddi)
            await s.flush()
            print(f"✅ {len(interacciones)} interacciones creadas")

        # ============================================================
        # 5. OBRAS SOCIALES (5)
        # ============================================================
        existing_os = await s.execute(select(models.ObraSocial).where(models.ObraSocial.company_id == COMPANY_ID))
        if not existing_os.scalars().first():
            obras = [
                # nombre, codigo, ruc, tipo, cobertura_default_pct, plazo_pago, requiere_autorizacion
                ("IPS - Instituto de Previsión Social", "IPS", "80000001-1", "obra_social", 70, 60, True),
                ("Particular", "PART", None, "particular", 0, 0, False),
                ("SMP - Servicio Médico del Personal", "SMP", "80000002-1", "obra_social", 60, 45, True),
                ("Sanidad Policial", "SANPOL", "80000003-1", "obra_social", 80, 60, True),
                ("Unimed Paraguay", "UNIMED", "80000004-1", "prepaga", 50, 30, False),
            ]
            for nombre, codigo, ruc, tipo, cob, plazo, aut in obras:
                os_obj = models.ObraSocial(
                    company_id=COMPANY_ID,
                    nombre=nombre, codigo=codigo, ruc=ruc, tipo=tipo,
                    cobertura_default_pct=Decimal(str(cob)),
                    plazo_pago_dias=plazo,
                    requiere_autorizacion=aut,
                )
                s.add(os_obj)
            await s.flush()
            print(f"✅ {len(obras)} obras sociales creadas")

        # ============================================================
        # 6. MÉDICOS (10)
        # ============================================================
        existing_med = await s.execute(select(models.Medico).where(models.Medico.company_id == COMPANY_ID))
        if not existing_med.scalars().first():
            medicos = [
                ("Dr. Juan Carlos Pérez", "1234", "Clínica Médica", "Hospital de Clínicas", True, "MSPBS"),
                ("Dra. María José González", "2345", "Pediatría", "Hospital Nacional de Itauguá", True, "MSPBS"),
                ("Dr. Carlos Raúl Martínez", "3456", "Cardiología", "Sanatorio San Roque", True, "Colegio Médico"),
                ("Dra. Ana Lucía Fernández", "4567", "Ginecología", "Centro Médico La Costa", True, "MSPBS"),
                ("Dr. Roberto Silva", "5678", "Traumatología", "Hospital de Trauma", True, "MSPBS"),
                ("Dra. Patricia Romero", "6789", "Dermatología", "Consultorio Particular", False, None),
                ("Dr. Miguel Ángel López", "7890", "Endocrinología", "Hospital de Clínicas", True, "MSPBS"),
                ("Dra. Laura Beatriz Caballero", "8901", "Neumología", "Instituto Nacional de Enfermedades Respiratorias", True, "MSPBS"),
                ("Dr. Fernando Ortiz", "9012", "Psiquiatría", "Centro de Salud Mental", True, "Colegio Médico"),
                ("Dra. Silvia Ramírez", "0123", "Geriatría", "Hospital Geriátrico", True, "MSPBS"),
            ]
            for nombre, mat, esp, inst, verif, fuente in medicos:
                m = models.Medico(
                    company_id=COMPANY_ID,
                    nombre=nombre, matricula=mat, especialidad=esp,
                    institucion=inst, verificado=verif, fuente_verificacion=fuente,
                )
                s.add(m)
            await s.flush()
            print(f"✅ {len(medicos)} médicos creados")

        # ============================================================
        # 7. PACIENTES (30)
        # ============================================================
        existing_pac = await s.execute(select(models.Paciente).where(models.Paciente.company_id == COMPANY_ID))
        if not existing_pac.scalars().first():
            r_os = await s.execute(select(models.ObraSocial).where(models.ObraSocial.company_id == COMPANY_ID))
            os_list = list(r_os.scalars().all())
            ips = next((o for o in os_list if o.codigo == "IPS"), os_list[0])
            part = next((o for o in os_list if o.codigo == "PART"), os_list[1] if len(os_list) > 1 else os_list[0])

            import random
            random.seed(42)
            nombres = [
                "Juan Pérez", "María González", "Carlos Martínez", "Ana Fernández", "Luis Rodríguez",
                "Laura Silva", "Pedro Romero", "Sofía López", "Diego Caballero", "Valentina Ortiz",
                "José Ramírez", "Lucía Méndez", "Andrés Acosta", "Camila Torres", "Sebastián Vega",
                "Isabella Benítez", "Mateo Barrios", "Martina Rolón", "Santiago Villalba", "Renata Cabrera",
                "Tomás Galeano", "Emilia Duarte", "Benjamín Esquivel", "Victoria Fleitas", "Joaquín Garcete",
                "Catalina Insfrán", "Lucas Jara", "Amanda Lird", "Gael Monges", "Elena Narváez",
            ]
            for i, nombre in enumerate(nombres):
                # Perfil clínico variable
                edad = random.randint(5, 85)
                anio_nac = date.today().year - edad
                mes_nac = random.randint(1, 12)
                dia_nac = random.randint(1, 28)
                fecha_nac = date(anio_nac, mes_nac, dia_nac)
                sexo = random.choice(["M", "F"])
                embarazada = (sexo == "F" and 18 <= edad <= 45 and random.random() < 0.15)
                lactando = (sexo == "F" and 20 <= edad <= 40 and random.random() < 0.1)
                insuf_renal = random.random() < 0.08
                tfg = random.uniform(20, 90) if insuf_renal else random.uniform(60, 120)
                peso = random.uniform(15, 110) if edad > 12 else random.uniform(10, 60)
                altura = random.uniform(100, 185) if edad > 12 else random.uniform(80, 150)
                condiciones_pool = ["HTA", "DM2", "EPOC", "Asma", "Dislipidemia", "Cardiopatía isquémica", "Depresión", "Ansiedad", "Artritis", "Gastritis", "Obesidad", "Hipotiroidismo"]
                n_condiciones = random.choices([0, 1, 2, 3, 4], weights=[30, 30, 20, 12, 8])[0]
                condiciones = random.sample(condiciones_pool, min(n_condiciones, len(condiciones_pool)))
                os_asign = ips if random.random() < 0.7 else part
                p = models.Paciente(
                    company_id=COMPANY_ID,
                    cedula=f"{random.randint(1000000, 6500000)}-{random.choice('ABCDEFGHIJKLMNOPQRSTUVWXYZ')}",
                    nombre=nombre,
                    fecha_nacimiento=fecha_nac,
                    sexo=sexo,
                    peso_kg=Decimal(str(round(peso, 1))),
                    altura_cm=Decimal(str(round(altura, 0))),
                    telefono=f"+5959{random.randint(81000000, 99999999)}",
                    email=f"paciente{i+1}@demo.com.py",
                    direccion=f"Av. Mariscal López {random.randint(100, 9999)}, Asunción",
                    embarazada=embarazada,
                    fecha_ultima_menstruacion=date.today() - timedelta(days=random.randint(30, 200)) if embarazada else None,
                    lactando=lactando,
                    insuficiencia_renal=insuf_renal,
                    insuficiencia_hepatica=random.random() < 0.04,
                    creatinina_mg_dl=Decimal(str(round(random.uniform(0.8, 4.5) if insuf_renal else random.uniform(0.6, 1.2), 2))),
                    tfg_ml_min=Decimal(str(round(tfg, 1))),
                    condiciones_cronicas=condiciones,
                    obra_social_id=os_asign.id,
                    numero_afiliado=f"{os_asign.codigo}-{random.randint(100000, 999999)}",
                )
                s.add(p)
            await s.flush()
            print(f"✅ 30 pacientes creados")

            # ============================================================
            # 8. ALERGIAS (asignar a ~20% de pacientes)
            # ============================================================
            r_pac = await s.execute(select(models.Paciente).where(models.Paciente.company_id == COMPANY_ID))
            pacientes = list(r_pac.scalars().all())
            alergias_comunes = [
                ("Paracetamol", "leve", "Urticaria leve"),
                ("Aspirina", "moderada", "Broncoespasmo"),
                ("Penicilina", "severa", "Anafilaxia - shock"),
                ("AINEs", "moderada", "Urticaria generalizada"),
                ("Sulfas", "moderada", "Eritema multiforme"),
                ("Látex", "leve", "Dermatitis de contacto"),
                ("Ibuprofeno", "leve", "Erupciones cutáneas"),
            ]
            for pac in pacientes:
                if random.random() < 0.2:
                    sustancia, sev, reacc = random.choice(alergias_comunes)
                    pa_id = None
                    if sustancia in pa_map:
                        pa_id = pa_map[sustancia].id
                    a = models.AlergiaPaciente(
                        company_id=COMPANY_ID,
                        paciente_id=pac.id,
                        principio_activo_id=pa_id,
                        sustancia=sustancia,
                        severidad=sev,
                        reaccion=reacc,
                        fecha_deteccion=date.today() - timedelta(days=random.randint(30, 2000)),
                    )
                    s.add(a)
            await s.flush()
            print(f"✅ Alergias asignadas")

        await s.commit()
        print("\n🎉 Seed farmacia Paraguay completo!")

    await engine.dispose()


if __name__ == "__main__":
    from datetime import timedelta
    asyncio.run(seed())
