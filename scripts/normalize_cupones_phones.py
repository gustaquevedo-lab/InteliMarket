#!/usr/bin/env python3
"""
Normalización de Teléfonos en cupones_clientes a formato E.164 (+595 / +55).
InteliMarket — Extra Supermercado
"""

import os
import re
import asyncio
import asyncpg

DB_URL = os.environ.get("DATABASE_URL", "postgresql://intelimarket:password@localhost:5432/intelimarket")


def normalize_phone_e164(raw: str) -> str | None:
    if not raw:
        return None
    digits = re.sub(r"[^\d]", "", str(raw).strip())
    if not digits:
        return None

    # Caso 1: Doble prefijo 595 (595595...)
    while digits.startswith("595595"):
        digits = digits[3:]

    # Caso 2: Error 5509... (550982528386) -> Paraguay
    if digits.startswith("5509") and len(digits) == 12:
        digits = "595" + digits[3:]

    # Caso 3: 59509... -> 5959...
    if digits.startswith("59509") and len(digits) == 13:
        digits = "595" + digits[4:]

    # Caso 4: Prefijo 55 en número móvil paraguayo (5597..., 5598..., 5599..., 5596...)
    if digits.startswith("55") and len(digits) == 11 and digits[2:4] in ("96", "97", "98", "99"):
        digits = "595" + digits[2:]

    # Caso 5: Local paraguayo con 0 (09XXXXXXXX)
    if digits.startswith("09") and len(digits) == 10:
        return "+595" + digits[1:]

    # Caso 6: Local paraguayo sin 0 (9XXXXXXXX)
    if digits.startswith("9") and len(digits) == 9:
        return "+595" + digits

    # Caso 7: Ya tiene 595
    if digits.startswith("595"):
        return "+" + digits

    # Caso 8: Celular brasileño frontera (DDD 67 u otros de 10 u 11 dígitos)
    if len(digits) in (10, 11) and digits.startswith("67"):
        return "+55" + digits

    # Caso 9: Legacy Brasil celular 8 dígitos
    if digits.startswith("55") and len(digits) == 12:
        return "+55" + digits[2:4] + "9" + digits[4:]

    if digits.startswith("55"):
        return "+" + digits

    if len(digits) >= 8:
        return "+" + digits

    return None


async def main():
    print(f"Conectando a {DB_URL}...")
    conn = await asyncpg.connect(DB_URL)
    rows = await conn.fetch("SELECT id, documento, nombre, telefono FROM cupones_clientes WHERE telefono IS NOT NULL AND telefono != '';")

    updated = 0
    for r in rows:
        cid = r["id"]
        tel = r["telefono"]
        new_tel = normalize_phone_e164(tel)
        if new_tel and new_tel != tel:
            await conn.execute("UPDATE cupones_clientes SET telefono = $1 WHERE id = $2", new_tel, cid)
            updated += 1

    await conn.close()
    print(f"Finalizado: {len(rows)} teléfonos revisados, {updated} normalizados a formato E.164.")


if __name__ == "__main__":
    asyncio.run(main())
