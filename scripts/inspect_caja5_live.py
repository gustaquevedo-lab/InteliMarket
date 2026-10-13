import winrm
import asyncio
from sqlalchemy import text
from api.src.db import engine

print("=== 1. VER CONFIGURACIÓN Y ACCESOS EN CAJA 5 (192.168.0.15) ===")
try:
    s = winrm.Session('192.168.0.15', auth=('Caja 5', 'caja5'), transport='ntlm')
    def ps(cmd):
        encoded = f'powershell -NoProfile -NonInteractive -Command "{cmd}"'
        r = s.run_cmd(encoded)
        return r.std_out.decode('cp1252', errors='replace').strip()

    print("\n--- CONTENIDO DE pos-config.json ---")
    print(ps(r"Get-Content C:\InteliMarket\win-unpacked\pos-config.json -ErrorAction SilentlyContinue"))

    print("\n--- ACCESOS DIRECTOS EN EL ESCRITORIO ---")
    print(ps(r'$w = New-Object -ComObject WScript.Shell; Get-ChildItem -Path C:\Users\*\Desktop\*.lnk, C:\Users\Public\Desktop\*.lnk | ForEach-Object { $sc = $w.CreateShortcut($_.FullName); $_.FullName + " -> " + $sc.TargetPath + " (Args: " + $sc.Arguments + ")" }'))

    print("\n--- PROCESO EN EJECUCIÓN (INTELIMARKET/ELECTRON) ---")
    print(ps(r"Get-Process | Where-Object { $_.ProcessName -match 'intelimarket|electron|chrome|msedge' } | Format-Table Id, ProcessName, MainWindowTitle, Path -AutoSize"))
except Exception as e:
    print("Error conectando a Caja 5:", e)

print("\n=== 2. VENTAS REGISTRADAS HOY EN BASE DE DATOS PRINCIPAL ===")
async def check_sales():
    async with engine.connect() as conn:
        rows = await conn.execute(text("""
            SELECT s.numero, s.tipo_comprobante, s.total, s.created_at, s.session_id
            FROM sales s
            WHERE s.created_at >= '2026-09-02 00:00:00+00'
            ORDER BY s.created_at DESC
            LIMIT 30
        """))
        sales = rows.fetchall()
        print(f"Total ventas registradas hoy en producción: {len(sales)}")
        for r in sales:
            print(f"Ticket #{r[0]} | Tipo: {r[1]} | Total: ₲ {r[2]:,.0f} | Hora: {r[3]} | Sesión: {r[4]}")

asyncio.run(check_sales())
