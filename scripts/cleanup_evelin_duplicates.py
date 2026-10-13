import asyncio
from sqlalchemy import text
from api.src.db import async_session_factory
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def cleanup_duplicates():
    async with async_session_factory() as db:
        # 1. Eliminar duplicados creados hoy
        del_ids = [
            'cc6d1cb8-3101-4d3a-b4ba-45292cc98854',
            '00b48f96-f293-4039-b111-e2664e7acf82',
            '841d5b0b-9e50-41af-ae01-805ea4e1fb15',
            '1db3521b-3da9-4e22-aa3b-2ee2999bbff8'
        ]
        for uid in del_ids:
            await db.execute(text("DELETE FROM users WHERE id = :uid"), {"uid": uid})
        
        # 2. Asegurar contraseña correcta en el usuario original
        orig_hash = pwd_context.hash("Extra8055*")
        orig_id = 'f8dda96f-fd3e-4445-9e63-e7d9bdca482e'
        await db.execute(
            text("UPDATE users SET password_hash = :ph, activo = true, rol = 'cajero' WHERE id = :uid"),
            {"ph": orig_hash, "uid": orig_id}
        )
        await db.commit()
        print("Duplicados eliminados y usuario oficial actualizado.")

        # 3. Listar usuarios finales de tipo cajero / supervisor
        res = await db.execute(text("SELECT id, email, nombre, rol, activo FROM users WHERE rol IN ('cajero', 'supervisor') ORDER BY nombre ASC"))
        print("\n=== LISTA OFICIAL DE PERSONAL POS ===")
        for r in res.fetchall():
            print(f"ID: {r[0]} | Email: {r[1]} | Nombre: {r[2]} | Rol: {r[3]}")

asyncio.run(cleanup_duplicates())
