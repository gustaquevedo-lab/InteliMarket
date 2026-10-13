import winrm
import json

s = winrm.Session('192.168.0.13', auth=('Caja 3', 'caja3'), transport='ntlm')

def ps(cmd):
    encoded_cmd = f"powershell -NoProfile -NonInteractive -Command \"{cmd}\""
    r = s.run_cmd(encoded_cmd)
    return r.std_out.decode('cp1252', errors='replace').strip(), r.std_err.decode('cp1252', errors='replace').strip()

print("=== 1. MATAR PROCESOS PREVIOS DE INTELIMARKET EN CAJA 3 ===")
ps("Get-Process | Where-Object { $_.ProcessName -like '*InteliMarket*' } | Stop-Process -Force -ErrorAction SilentlyContinue")
print("Procesos detenidos.")

print("\n=== 2. ESCRIBIR POS-CONFIG.JSON LIMPIO SIN BOM EN C:\\InteliMarket\\win-unpacked ===")
cfg_json = json.dumps({
    "env": "production",
    "serverUrl": "http://192.168.0.10:5173/pos",
    "apiUrl": "http://192.168.0.10:8000",
    "ruc": "80150377-9",
    "company": "Extra Supermercado Mayorista"
}, indent=2)

cmd_write_cfg = f"""
$content = @'
{cfg_json}
'@
[System.IO.File]::WriteAllText('C:\\InteliMarket\\win-unpacked\\pos-config.json', $content, [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText('C:\\Users\\Public\\Desktop\\pos-config.json', $content, [System.Text.UTF8Encoding]::new($false))
"""
out, err = ps(cmd_write_cfg)
print("Config escrita.")

print("\n=== 3. CREAR / ACTUALIZAR ACCESOS DIRECTOS CON --url EXPLÍCITA ===")
cmd_shortcut = """
$w = New-Object -ComObject WScript.Shell

# Desktop Público
$sc = $w.CreateShortcut('C:\\Users\\Public\\Desktop\\Intelimarket POS.lnk')
$sc.TargetPath = 'C:\\InteliMarket\\win-unpacked\\InteliMarket POS.exe'
$sc.Arguments = '--url=http://192.168.0.10:5173/pos'
$sc.WorkingDirectory = 'C:\\InteliMarket\\win-unpacked'
$sc.Save()

# Desktop Caja 3
$sc2 = $w.CreateShortcut('C:\\Users\\caja 3\\Desktop\\Intelimarket POS.lnk')
$sc2.TargetPath = 'C:\\InteliMarket\\win-unpacked\\InteliMarket POS.exe'
$sc2.Arguments = '--url=http://192.168.0.10:5173/pos'
$sc2.WorkingDirectory = 'C:\\InteliMarket\\win-unpacked'
$sc2.Save()

# Desktop Caja 2
$sc3 = $w.CreateShortcut('C:\\Users\\Caja 2\\Desktop\\Intelimarket POS.lnk')
$sc3.TargetPath = 'C:\\InteliMarket\\win-unpacked\\InteliMarket POS.exe'
$sc3.Arguments = '--url=http://192.168.0.10:5173/pos'
$sc3.WorkingDirectory = 'C:\\InteliMarket\\win-unpacked'
$sc3.Save()
"""
out, err = ps(cmd_shortcut)
print("Accesos directos creados y actualizados.")

print("\n=== 4. LANZAR INTELIMARKET POS EN LA SESION ACTIVA DE PANTALLA ===")
cmd_launch = """
$target = 'C:\\InteliMarket\\win-unpacked\\InteliMarket POS.exe'
$args = '--url=http://192.168.0.10:5173/pos'
Start-Process -FilePath $target -ArgumentList $args -WorkingDirectory 'C:\\InteliMarket\\win-unpacked'
"""
out, err = ps(cmd_launch)
print("Comando de arranque ejecutado.")
