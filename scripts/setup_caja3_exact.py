import winrm
import base64

s = winrm.Session('192.168.0.13', auth=('Caja 3', 'caja3'), transport='ntlm')

def run_ps_encoded(ps_code):
    b64_cmd = base64.b64encode(ps_code.encode('utf-16le')).decode('ascii')
    r = s.run_cmd(f'powershell -NoProfile -NonInteractive -EncodedCommand {b64_cmd}')
    out = r.std_out.decode('cp1252', errors='replace').strip()
    err = r.std_err.decode('cp1252', errors='replace').strip()
    return out, err

ps_script = """
# 1. Detener procesos previos
Stop-Process -Name *intelimarket*, *electron* -Force -ErrorAction SilentlyContinue

# 2. Copiar/Mover todos los archivos directamente a C:\\InteliMarket\\
if (Test-Path "C:\\InteliMarket\\win-unpacked") {
    Copy-Item -Path "C:\\InteliMarket\\win-unpacked\\*" -Destination "C:\\InteliMarket" -Recurse -Force -ErrorAction SilentlyContinue
}

# Si existia en C:\\win-unpacked
if (Test-Path "C:\\win-unpacked") {
    Copy-Item -Path "C:\\win-unpacked\\*" -Destination "C:\\InteliMarket" -Recurse -Force -ErrorAction SilentlyContinue
}

# 3. Configurar pos-config.json directamente en C:\\InteliMarket y subdirectorios
$cfg = @'
{
  "env": "production",
  "serverUrl": "http://192.168.0.10:5173/pos",
  "apiUrl": "http://192.168.0.10:8000",
  "ruc": "80150377-9",
  "company": "Extra Supermercado Mayorista"
}
'@

[System.IO.File]::WriteAllText("C:\\InteliMarket\\pos-config.json", $cfg, [System.Text.UTF8Encoding]::new($false))
if (Test-Path "C:\\InteliMarket\\win-unpacked") {
    [System.IO.File]::WriteAllText("C:\\InteliMarket\\win-unpacked\\pos-config.json", $cfg, [System.Text.UTF8Encoding]::new($false))
}

# 4. Crear accesos directos en TODOS los escritorios
$w = New-Object -ComObject WScript.Shell

$desktopPaths = @(
    "C:\\Users\\Public\\Desktop",
    "C:\\Users\\caja 3\\Desktop",
    "C:\\Users\\Caja 2\\Desktop",
    "C:\\Users\\Administrador\\Desktop",
    "C:\\Users\\Administrator\\Desktop",
    "C:\\Users\\Default\\Desktop"
)

# Buscar dinamicamente todas las carpetas de Desktop existentes
Get-ChildItem -Path "C:\\Users" -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    $d = Join-Path $_.FullName "Desktop"
    if (Test-Path $d) {
        $desktopPaths += $d
    }
}

$exeDirect = "C:\\InteliMarket\\InteliMarket POS.exe"
if (!(Test-Path $exeDirect)) {
    $exeDirect = "C:\\InteliMarket\\win-unpacked\\InteliMarket POS.exe"
}

foreach ($dp in ($desktopPaths | Select-Object -Unique)) {
    if (Test-Path $dp) {
        # Acceso directo 1: Intelimarket POS.lnk
        $lnk1 = Join-Path $dp "Intelimarket POS.lnk"
        $sc1 = $w.CreateShortcut($lnk1)
        $sc1.TargetPath = $exeDirect
        $sc1.Arguments = "--url=http://192.168.0.10:5173/pos"
        $sc1.WorkingDirectory = "C:\\InteliMarket"
        $sc1.IconLocation = "$exeDirect,0"
        $sc1.Save()

        # Acceso directo 2: InteliMarket.lnk
        $lnk2 = Join-Path $dp "InteliMarket.lnk"
        $sc2 = $w.CreateShortcut($lnk2)
        $sc2.TargetPath = $exeDirect
        $sc2.Arguments = "--url=http://192.168.0.10:5173/pos"
        $sc2.WorkingDirectory = "C:\\InteliMarket"
        $sc2.IconLocation = "$exeDirect,0"
        $sc2.Save()

        Write-Host "Accesos directos creados en: $dp"
    }
}

# 5. Listar contenido final de C:\\InteliMarket
Write-Host "=== CONTENIDO DE C:\\InteliMarket ==="
Get-ChildItem -Path "C:\\InteliMarket" | Select-Object Name, Length | Format-Table -AutoSize | Out-String
"""

out, err = run_ps_encoded(ps_script)
print("=== RESULTADO DE CONFIGURACIÓN EN CAJA 3 ===")
print(out)
if err:
    print("ERRORES:", err)
