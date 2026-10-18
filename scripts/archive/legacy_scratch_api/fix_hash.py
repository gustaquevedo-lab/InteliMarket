import asyncio
import bcrypt
import asyncpg

async def fix():
    conn = await asyncpg.connect("postgresql://intelimarket:intelimarket_dev@db:5432/intelimarket")
    pw = bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode()
    print("new hash:", pw)
    await conn.execute("UPDATE users SET password_hash = $1 WHERE email = $2", pw, "admin@test.com")
    r = await conn.fetchrow("SELECT email, password_hash FROM users WHERE email = $1", "admin@test.com")
    print("stored:", r["password_hash"])
    await conn.close()

asyncio.run(fix())
