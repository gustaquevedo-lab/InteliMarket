"""Modulo de Metas de Venta: crea cuentas de usuario reales para los 123
sales_reps importados (cedula como usuario y contraseña, pedido explicito
del cliente). must_change_password=true en todas — se fuerza cambio en el
primer login (unica mitigacion agregada, no cambia el flujo pedido)."""
import sys
import uuid
sys.path.insert(0, ".")
import psycopg
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
COMPANY_ID = "00000000-0000-0000-0000-000000000010"

pg = psycopg.connect("postgresql://intelimarket:intelimarket_dev@localhost:5432/intelimarket")

with pg.cursor() as cur:
    cur.execute(
        "SELECT id, cedula, nombre, rol FROM sales_reps WHERE company_id = %s AND user_id IS NULL",
        (COMPANY_ID,),
    )
    reps = cur.fetchall()

print(f"sales_reps sin cuenta: {len(reps)}")

created, ya_existia = 0, 0
for rep_id, cedula, nombre, rol in reps:
    with pg.cursor() as cur:
        cur.execute("SELECT id FROM users WHERE email = %s", (cedula,))
        existing = cur.fetchone()
        if existing:
            user_id = existing[0]
            ya_existia += 1
        else:
            user_id = str(uuid.uuid4())
            pw_hash = pwd_context.hash(cedula)
            cur.execute(
                """INSERT INTO users (id, email, password_hash, nombre, rol, activo, must_change_password)
                   VALUES (%s, %s, %s, %s, %s, true, true)""",
                (user_id, cedula, pw_hash, nombre, rol),
            )
            created += 1
        cur.execute("UPDATE sales_reps SET user_id = %s WHERE id = %s", (user_id, rep_id))

pg.commit()
print(f"usuarios creados: {created}, ya existian (email=cedula duplicado): {ya_existia}")

with pg.cursor() as cur:
    cur.execute("SELECT count(*) FROM sales_reps WHERE company_id = %s AND user_id IS NOT NULL", (COMPANY_ID,))
    print("sales_reps con cuenta vinculada:", cur.fetchone())

pg.close()
