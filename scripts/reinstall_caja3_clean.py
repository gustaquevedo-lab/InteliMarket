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
# 1. Matar procesos
Stop-Process -Name *intelimarket*, *electron* -Force -ErrorAction SilentlyContinue
Write-Host "1. Procesos detenidos"

# 2. Limpiar cache
Remove-Item -Path "C:\\Users\\*\\AppData\\Roaming\\*inteli*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "C:\\Users\\*\\AppData\\Local\\*inteli*" -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "2. Cache limpiado"

# 3. Descargar y descomprimir
$zip = "C:\\InteliMarket-POS-Windows.zip"
$dest = "C:\\InteliMarket"
Invoke-WebRequest -Uri "http://192.168.0.10:8000/download/windows" -OutFile $zip -UseBasicParsing
if (Test-Path $zip) {
    Write-Host ("3. Descargado: " + (Get-Item $zip).Length + " bytes")
    if (Test-Path $dest) {
        Remove-Item -Path $dest -Recurse -Force -ErrorAction SilentlyContinue
    }
    Expand-Archive -Path $zip -DestinationPath "C:\\" -Force
    Remove-Item $zip -Force -ErrorAction SilentlyContinue
    Write-Host "3. Extraido en C:\\"
} else {
    Write-Host "3. Error en descarga"
}

# 4. Configurar JSON
$cfg = @'
{
  "env": "production",
  "serverUrl": "http://192.168.0.10:5173/pos",
  "apiUrl": "http://192.168.0.10:8000",
  "ruc": "80150377-9",
  "company": "Extra Supermercado Mayorista"
}
'@
if (!(Test-Path "C:\\InteliMarket\\win-unpacked")) {
    New-Item -ItemType Directory -Path "C:\\InteliMarket\\win-unpacked" -Force | Out-Null
}
[System.IO.File]::WriteAllText("C:\\InteliMarket\\win-unpacked\\pos-config.json", $cfg, [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText("C:\\Users\\Public\\Desktop\\pos-config.json", $cfg, [System.Text.UTF8Encoding]::new($false))
Write-Host "4. pos-config.json escrito"

# 5. Accesos directos
$w = New-Object -ComObject WScript.Shell
$sc = $w.CreateShortcut("C:\\Users\\Public\\Desktop\\Intelimarket POS.lnk")
$sc.TargetPath = "C:\\InteliMarket\\win-unpacked\\InteliMarket POS.exe"
$sc.Arguments = "--url=http://192.168.0.10:5173/pos"
$sc.WorkingDirectory = "C:\\InteliMarket\\win-unpacked"
$sc.Save()
Write-Host "5. Acceso directo guardado"

# 6. Lanzar en pantalla interactiva
$action = New-ScheduledTaskAction -Execute "C:\\InteliMarket\\win-unpacked\\InteliMarket POS.exe" -Argument "--url=http://192.168.0.10:5173/pos" -WorkingDirectory "C:\\InteliMarket\\win-unpacked"
$principal = New-ScheduledTaskPrincipal -UserId "caja 3" -LogonType Interactive
Register-ScheduledTask -TaskName "LaunchPOS" -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName "LaunchPOS"
Start-Sleep -Seconds 3
Unregister-ScheduledTask -TaskName "LaunchPOS" -Confirm:$false
Write-Host "6. Lanzado en pantalla fisica"
"""

out, err = run_ps_encoded(ps_script)
print("=== RESULTADO DE REINSTALACION EN CAJA 3 ===")
print(out)
if err:
    print("ERRORES:", err)
