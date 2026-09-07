import winrm
import base64
import time

s = winrm.Session('192.168.0.13', auth=('Caja 3', 'caja3'), transport='ntlm')

def ps(cmd):
    b64 = base64.b64encode(cmd.encode('utf-16le')).decode('ascii')
    r = s.run_cmd(f'powershell -NoProfile -NonInteractive -EncodedCommand {b64}')
    out = r.std_out.decode('cp1252', errors='replace').strip()
    err = r.std_err.decode('cp1252', errors='replace').strip()
    return out, err

ps_script = """
# 1. Matar instancias previas para prueba limpia
Stop-Process -Name *intelimarket*, *electron* -Force -ErrorAction SilentlyContinue

# 2. Crear y ejecutar tarea interactiva en la pantalla de Caja 3 (Session 1)
$action = New-ScheduledTaskAction -Execute "C:\\InteliMarket\\win-unpacked\\InteliMarket POS.exe" -WorkingDirectory "C:\\InteliMarket\\win-unpacked"
$principal = New-ScheduledTaskPrincipal -UserId "caja 3" -LogonType Interactive
Register-ScheduledTask -TaskName "TestLaunchPOS" -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName "TestLaunchPOS"

Start-Sleep -Seconds 5

# 3. Verificar procesos activos y su SessionId
Write-Host "=== PROCESOS DE INTELIMARKET EN EJECUCION ==="
Get-Process -Name "*InteliMarket*" -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, SessionId, WorkingSet64 | Format-Table -AutoSize | Out-String

# 4. Leer logs de consola generados en tiempo real
Write-Host "=== LOGS GENERADOS POR ELECTRON ==="
$logPath = Join-Path $env:APPDATA "InteliMarket POS\\pos-console.log"
if (!(Test-Path $logPath)) {
    $logFiles = Get-ChildItem -Path $env:APPDATA -Filter "*pos-console.log" -Recurse -ErrorAction SilentlyContinue
    if ($logFiles) { $logPath = $logFiles[0].FullName }
}

if (Test-Path $logPath) {
    Write-Host "Archivo de log: $logPath"
    Get-Content $logPath -Tail 20 | Out-String
} else {
    Write-Host "No se genero log de error (app corriendo limpia)"
}

# 5. Limpiar tarea programada de prueba
Unregister-ScheduledTask -TaskName "TestLaunchPOS" -Confirm:$false | Out-Null
"""

out, err = ps(ps_script)
print("=== PRUEBA DE ARRANQUE EN CAJA 3 ===")
print(out)
if err:
    print("ERRORES:", err)
