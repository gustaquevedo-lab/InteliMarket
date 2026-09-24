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
# 1. Matar instancias previas
Stop-Process -Name *intelimarket*, *electron* -Force -ErrorAction SilentlyContinue

# 2. Lanzar de forma interactiva en la pantalla
$action = New-ScheduledTaskAction -Execute "C:\\InteliMarket\\win-unpacked\\InteliMarket POS.exe" -WorkingDirectory "C:\\InteliMarket\\win-unpacked"
$principal = New-ScheduledTaskPrincipal -UserId "caja 3" -LogonType Interactive
Register-ScheduledTask -TaskName "LaunchWorkingPOS" -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName "LaunchWorkingPOS"
Start-Sleep -Seconds 4
Unregister-ScheduledTask -TaskName "LaunchWorkingPOS" -Confirm:$false | Out-Null

# 3. Comprobar que esta corriendo en SessionId 1 (consola fisica)
Get-Process -Name "*InteliMarket*" | Select-Object Id, ProcessName, SessionId, WorkingSet64 | Format-Table -AutoSize | Out-String
"""

out, err = ps3(ps_script)
print("=== PRUEBA DE ARRANQUE CON EL ASAR DE CAJA 5 ===")
print(out)
if err:
    print("ERRORES:", err)
