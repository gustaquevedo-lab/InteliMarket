import winrm
import base64

s3 = winrm.Session('192.168.0.13', auth=('Caja 3', 'caja3'), transport='ntlm')

def ps3(cmd):
    b64 = base64.b64encode(cmd.encode('utf-16le')).decode('ascii')
    r = s3.run_cmd(f'powershell -NoProfile -NonInteractive -EncodedCommand {b64}')
    out = r.std_out.decode('cp1252', errors='replace').strip()
    err = r.std_err.decode('cp1252', errors='replace').strip()
    return out, err

ps_script = """
# 1. Matar procesos viejos
Stop-Process -Name *intelimarket*, *electron* -Force -ErrorAction SilentlyContinue

# 2. Conectar recurso compartido de Caja 5 y clonar C:\\InteliMarket
cmd.exe /c "net use \\\\192.168.0.15\\c$ caja5 /user:\"Caja 5\"" | Out-Null

if (Test-Path "\\\\192.168.0.15\\c$\\InteliMarket") {
    Write-Host "Conexion con Caja 5 exitosa. Clonando C:\\InteliMarket..."
    if (Test-Path "C:\\InteliMarket") {
        Remove-Item -Path "C:\\InteliMarket" -Recurse -Force -ErrorAction SilentlyContinue
    }
    Copy-Item -Path "\\\\192.168.0.15\\c$\\InteliMarket" -Destination "C:\\" -Recurse -Force
    Write-Host "Clonacion completada al 100%."
} else {
    Write-Host "No se pudo acceder a \\\\192.168.0.15\\c$\\InteliMarket"
}

# 3. Asegurar pos-config.json en Caja 3
$cfg = @'
{
  "env": "production",
  "serverUrl": "http://192.168.0.10:5173/pos",
  "apiUrl": "http://192.168.0.10:8000",
  "ruc": "80150377-9",
  "company": "Extra Supermercado Mayorista"
}
'@
[System.IO.File]::WriteAllText("C:\\InteliMarket\\win-unpacked\\pos-config.json", $cfg, [System.Text.UTF8Encoding]::new($false))

# 4. Crear accesos directos exactos con el icono oficial
$w = New-Object -ComObject WScript.Shell
$exe = "C:\\InteliMarket\\win-unpacked\\InteliMarket POS.exe"
$ico = "C:\\InteliMarket\\win-unpacked\\icon.ico"

# Limpiar accesos viejos rotos
Remove-Item -Path "C:\\Users\\*\\Desktop\\*Inteli*.lnk" -Force -ErrorAction SilentlyContinue

$desktops = @(
    "C:\\Users\\Public\\Desktop",
    "C:\\Users\\caja 3\\Desktop",
    "C:\\Users\\Caja 3\\Desktop",
    "C:\\Users\\Caja 2\\Desktop"
)

foreach ($d in ($desktops | Select-Object -Unique)) {
    if (Test-Path $d) {
        $sc = $w.CreateShortcut((Join-Path $d "InteliMarket POS.lnk"))
        $sc.TargetPath = $exe
        $sc.WorkingDirectory = "C:\\InteliMarket\\win-unpacked"
        if (Test-Path $ico) {
            $sc.IconLocation = "$ico,0"
        } else {
            $sc.IconLocation = "$exe,0"
        }
        $sc.Save()
        Write-Host "Acceso directo creado con icono en: $d"
    }
}

# 5. Desconectar recurso compartido
cmd.exe /c "net use \\\\192.168.0.15\\c$ /delete /y" | Out-Null
Write-Host "Listo."
"""

out, err = ps3(ps_script)
print("=== RESULTADO DE CLONACION EXACTA DE CAJA 5 A CAJA 3 ===")
print(out)
if err:
    print("ERRORES:", err)
