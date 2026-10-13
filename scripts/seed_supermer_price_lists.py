import asyncio
import uuid
from sqlalchemy import text
from api.src.db import async_session_factory

COMPANY_ID = uuid.UUID("00000000-0000-0000-0000-000000000010")

DEFAULT_LISTS = [
    {"nombre": "Lista General Minorista (Salón / Góndola)", "tipo": "general", "grupo": None},
    {"nombre": "Lista Mayorista (Escalas por Volumen)", "tipo": "grupo", "grupo": "Mayorista"},
    {"nombre": "Lista Clientes Corporativos / Convenios", "tipo": "grupo", "grupo": "Corporativo"},
    {"nombre": "Lista Funcionarios & Colaboradores", "tipo": "grupo", "grupo": "Funcionarios"},
]

async def seed():
    async with async_session_factory() as db:
        for item in DEFAULT_LISTS:
            exists = (await db.execute(
                text("SELECT id FROM price_lists WHERE company_id = :cid AND nombre = :nom"),
                {"cid": COMPANY_ID, "nom": item["nombre"]}
            )).scalar_one_or_none()
            if not exists:
                await db.execute(
                    text("""
                        INSERT INTO price_lists (id, company_id, nombre, tipo, grupo, activo, created_at, updated_at)
                        VALUES (gen_random_uuid(), :cid, :nom, :tipo, :grupo, true, NOW(), NOW())
                    """),
                    {"cid": COMPANY_ID, "nom": item["nombre"], "tipo": item["tipo"], "grupo": item["grupo"]}
                )
                print("Created:", item["nombre"])
            else:
                print("Already exists:", item["nombre"])
        await db.commit()
        
        rows = (await db.execute(
            text("SELECT id, nombre, tipo, grupo FROM price_lists WHERE company_id = :cid ORDER BY created_at"),
            {"cid": COMPANY_ID}
        )).fetchall()
        print("Current lists in DB:", len(rows))
        for r in rows:
            print(" -", dict(r._mapping))

if __name__ == "__main__":
    asyncio.run(seed())
