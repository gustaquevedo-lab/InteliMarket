import asyncio
import pymysql
import winrm
import base64
from api.src.config import settings
from api.src.db import async_session_factory
from sqlalchemy import text
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def prepare_caja4():
    print("=== 1. OBTENER SECUENCIAS DESDE MYSQL (LEGACY) ===")
    conn = pymysql.connect(
        host=settings.nemuha_mysql_host or '127.0.0.1',
        port=settings.nemuha_mysql_port or 3306,
        user=settings.nemuha_mysql_user or 'root',
        password=settings.nemuha_mysql_password or '',
        database=settings.nemuha_mysql_database or 'comercial_extra_py',
        cursorclass=pymysql.cursors.DictCursor
    )
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM con_secuencia_fatura WHERE boca_emissao IN ('014', '14', '001-014');")
        sec_mysql = cur.fetchall()
        for s in sec_mysql:
            print("MySQL Secuencia:", s)
    conn.close()

    factura_next = 33024
    nc_next = 75
    for s in sec_mysql:
        if s.get('tipo') == 'VENTA':
            factura_next = int(s.get('proximo'))
        elif s.get('tipo') == 'NOTA CREDITO':
            nc_next = int(s.get('proximo'))

    print(f"\nSecuencia final a sincronizar: Factura={factura_next}, NC={nc_next}")

    # 2. Actualizar PostgreSQL punto_emision_secuencias y usuario Tomasa
    async with async_session_factory() as db:
        # Actualizar secuencia factura 014
        await db.execute(text("""
            UPDATE punto_emision_secuencias 
            SET numero_actual = :num, updated_at = NOW(), activo = true 
            WHERE punto_emision = '014' AND tipo_documento = 'factura';
        """), {"num": factura_next})

        # Actualizar secuencia NC 014
        await db.execute(text("""
            UPDATE punto_emision_secuencias 
            SET numero_actual = :num, updated_at = NOW(), activo = true 
            WHERE punto_emision = '014' AND tipo_documento = 'nota_credito';
        """), {"num": nc_next})

        # Asegurar contraseña de Tomasa
        tomasa_hash = pwd_context.hash("Extra8055*")
        await db.execute(text("""
            UPDATE users 
            SET password_hash = :ph, activo = true, rol = 'cajero'
            WHERE email = 'tomasa@intelimarket.com.py' OR nombre ILIKE '%TOMASA%';
        """), {"ph": tomasa_hash})

        await db.commit()
        print("Postgres actualizado con éxito.")

        # Verificar
        res = await db.execute(text("""
            SELECT id, establecimiento, punto_emision, tipo_documento, numero_actual, numero_final, activo
            FROM punto_emision_secuencias
            WHERE punto_emision = '014';
        """))
        print("\n=== SECUENCIAS ACTIVAS EN POSTGRES (PUNTO 014) ===")
        for r in res.fetchall():
            print(dict(r._mapping))

    # 3. Configurar Caja 4 física (192.168.0.14) vía WinRM
    print("\n=== 3. CONFIGURAR CAJA 4 FISICA (192.168.0.14) ===")
    s4 = winrm.Session('192.168.0.14', auth=('Caja 4', 'caja4'), transport='ntlm')
    ps_caja4 = """
    # 1. Copiar app.asar funcional
    Invoke-WebRequest -Uri 'http://192.168.0.10:8000/static/app.asar' -OutFile 'C:\\InteliMarket\\win-unpacked\\resources\\app.asar' -UseBasicParsing
    
    # 2. Descargar icono oficial
    $icoPath = 'C:\\InteliMarket\\win-unpacked\\icon.ico'
    Invoke-WebRequest -Uri 'http://192.168.0.10:8000/static/icon.ico' -OutFile $icoPath -UseBasicParsing

    # 3. Asegurar pos-config.json
    $cfg = @'
{
  "env": "production",
  "serverUrl": "http://192.168.0.10:5173/pos",
  "apiUrl": "http://192.168.0.10:8000",
  "ruc": "80150377-9",
  "company": "Extra Supermercado Mayorista"
}
'@
    [System.IO.File]::WriteAllText('C:\\InteliMarket\\win-unpacked\\pos-config.json', $cfg, [System.Text.UTF8Encoding]::new($false))

    # 4. Configurar accesos directos
    $w = New-Object -ComObject WScript.Shell
    $exe = 'C:\\InteliMarket\\win-unpacked\\InteliMarket POS.exe'
    Remove-Item -Path "C:\\Users\\*\\Desktop\\*Inteli*.lnk" -Force -ErrorAction SilentlyContinue

    $desktops = @("C:\\Users\\Public\\Desktop", "C:\\Users\\caja 4\\Desktop", "C:\\Users\\Caja 4\\Desktop")
    foreach ($d in ($desktops | Select-Object -Unique)) {
        if (Test-Path $d) {
            $sc = $w.CreateShortcut((Join-Path $d "InteliMarket POS.lnk"))
            $sc.TargetPath = $exe
            $sc.WorkingDirectory = 'C:\\InteliMarket\\win-unpacked'
            $sc.IconLocation = "$icoPath,0"
            $sc.Save()
            Write-Host "Acceso directo creado en: $d"
        }
    }
    
    # 5. Listar impresoras
    Get-Printer | Select-Object Name, PortName, DriverName | Format-Table -AutoSize | Out-String
    """
    b64_4 = base64.b64encode(ps_caja4.encode('utf-16le')).decode('ascii')
    r4 = s4.run_cmd(f'powershell -NoProfile -NonInteractive -EncodedCommand {b64_4}')
    print("Resultado en Caja 4:")
    print(r4.std_out.decode('cp1252', errors='replace'))

asyncio.run(prepare_caja4())
