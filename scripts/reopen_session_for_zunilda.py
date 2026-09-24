import asyncio
from sqlalchemy import text
from api.src.db import async_session_factory

SESSION_ID = "c64d4688-9c20-45a6-8d45-97a4b6fcca7e"

async def reopen_session_for_zunilda():
    async with async_session_factory() as db:
        # Poner la sesion en estado abierta
        await db.execute(text("""
            UPDATE cash_sessions 
            SET estado = 'abierta',
                fecha_cierre = NULL,
                monto_cierre = NULL,
                cajero_nombre = 'ZUNILDA RODRIGUEZ'
            WHERE id = :sid;
        """), {"sid": SESSION_ID})

        # Eliminar cash_counts y handoffs previos si se crearon durante el intento fallido
        await db.execute(text("DELETE FROM cash_handoffs WHERE session_id = :sid;"), {"sid": SESSION_ID})
        await db.execute(text("DELETE FROM cash_counts WHERE session_id = :sid;"), {"sid": SESSION_ID})

        await db.commit()
        print("Sesión c64d4688 reabierta exitosamente para Zunilda Rodriguez en Caja 5.")

asyncio.run(reopen_session_for_zunilda())
