import asyncio
from sqlalchemy import text
from api.src.db import async_session_factory

SESSION_ZUNILDA = "c64d4688-9c20-45a6-8d45-97a4b6fcca7e"

async def clean_zunilda_and_check():
    async with async_session_factory() as db:
        print("=== DESVINCULANDO VENTAS SANDBOX DE LA SESION DE ZUNILDA ===")
        
        # Desvincular ventas que no sean fiscales de Caja 5 (001-015-...)
        res = await db.execute(text("""
            UPDATE sales 
            SET session_id = NULL
            WHERE session_id = :sid AND (numero NOT LIKE '001-015-%' OR numero IS NULL);
        """), {"sid": SESSION_ZUNILDA})
        print(f"Ventas sandbox desvinculadas de la sesión: {res.rowcount}")

        # También verificar si la última venta de Tomasa pend_aprob_credito debe confirmarse
        await db.execute(text("""
            UPDATE sales
            SET estado = 'confirmado'
            WHERE numero = '001-014-0033039' AND estado = 'pend_aprob_credito';
        """))

        await db.commit()
        print("Base de datos limpia y sincronizada.")

asyncio.run(clean_zunilda_and_check())
