"""Cambia la clave de un usuario de InteliMarket sin que pase por chats ni historial.

Uso (en el servidor, desde la raíz del repo):  .venv/bin/python scripts/cambiar_clave.py admin@casagonzalito.py
"""
import asyncio
import getpass
import os
import sys

import asyncpg

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from api.src.auth.jwt import hash_password  # noqa: E402


async def main(email: str) -> None:
    clave = getpass.getpass(f"Clave nueva para {email}: ")
    if len(clave) < 10 or clave != getpass.getpass("Repetir: "):
        sys.exit("No se cambió nada: las claves no coinciden o tienen menos de 10 caracteres.")
    c = await asyncpg.connect(os.environ["DATABASE_URL"].replace("postgresql+asyncpg://", "postgresql://"))
    try:
        r = await c.execute(
            "UPDATE users SET password_hash = $1, current_session_id = NULL, updated_at = now() WHERE lower(email) = lower($2)",
            hash_password(clave), email,
        )
    finally:
        await c.close()
    print("Clave cambiada; las sesiones abiertas de ese usuario se cierran." if r.endswith(" 1") else f"No existe el usuario {email}.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    asyncio.run(main(sys.argv[1]))
