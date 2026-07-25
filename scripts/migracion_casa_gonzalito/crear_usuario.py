#!/usr/bin/env python3
"""
Crea (o actualiza) un usuario de login para Intelimarket, en public.users.
Usa el mismo hash bcrypt que la app (passlib), así el login funciona.

    uv run python crear_usuario.py [email] [password]

Requiere en este venv:  uv add "passlib[bcrypt]" "bcrypt<4.1"
"""
import os
import sys
from passlib.context import CryptContext
import psycopg

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

email = sys.argv[1] if len(sys.argv) > 1 else "admin@casagonzalito.py"
password = sys.argv[2] if len(sys.argv) > 2 else "casa1234"
PG_DSN = os.getenv("PG_DSN", "postgresql://intelimarket:intelimarket_dev@localhost:5432/intelimarket")

h = pwd.hash(password)
with psycopg.connect(PG_DSN) as c:
    with c.cursor() as cur:
        cur.execute(
            """INSERT INTO users (email, password_hash, nombre, rol, is_superadmin, activo)
               VALUES (%s,%s,%s,'super_admin',true,true)
               ON CONFLICT (email) DO UPDATE
                 SET password_hash=EXCLUDED.password_hash, activo=true""",
            (email, h, "Admin Casa Gonzalito"))
    c.commit()

print(f"✓ Usuario listo:  {email}  /  {password}")
