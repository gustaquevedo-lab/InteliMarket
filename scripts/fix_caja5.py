import winrm
import json

s = winrm.Session('192.168.0.15', auth=('Caja 5', 'caja5'), transport='ntlm')

def ps(cmd):
    encoded_cmd = f"powershell -NoProfile -NonInteractive -Command \"{cmd}\""
    r = s.run_cmd(encoded_cmd)
    return r.std_out.decode('cp1252', errors='replace').strip(), r.std_err.decode('cp1252', errors='replace').strip()

print("=== 1. CONFIGURAR POS-CONFIG.JSON EN CAJA 5 PARA PRODUCCIÓN ===")
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
if (!(Test-Path 'C:\\InteliMarket\\win-unpacked')) {{
    New-Item -ItemType Directory -Path 'C:\\InteliMarket\\win-unpacked' -Force
}}
[System.IO.File]::WriteAllText('C:\\InteliMarket\\win-unpacked\\pos-config.json', $content, [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText('C:\\Users\\Public\\Desktop\\pos-config.json', $content, [System.Text.UTF8Encoding]::new($false))
"""
out, err = ps(cmd_write_cfg)
print("Config escrita en Caja 5.")

print("\n=== 2. ACTUALIZAR ACCESOS DIRECTOS EN CAJA 5 ===")
cmd_shortcut = """
$w = New-Object -ComObject WScript.Shell

$sc = $w.CreateShortcut('C:\\Users\\Public\\Desktop\\Intelimarket POS.lnk')
$sc.TargetPath = 'C:\\InteliMarket\\win-unpacked\\InteliMarket POS.exe'
$sc.Arguments = '--url=http://192.168.0.10:5173/pos'
$sc.WorkingDirectory = 'C:\\InteliMarket\\win-unpacked'
$sc.Save()

Get-ChildItem -Path 'C:\\Users\\*\\Desktop' -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    $userSc = $w.CreateShortcut($_.FullName + '\\Intelimarket POS.lnk')
    $userSc.TargetPath = 'C:\\InteliMarket\\win-unpacked\\InteliMarket POS.exe'
    $userSc.Arguments = '--url=http://192.168.0.10:5173/pos'
    $userSc.WorkingDirectory = 'C:\\InteliMarket\\win-unpacked'
    $userSc.Save()
}
"""
out, err = ps(cmd_shortcut)
print("Accesos directos en Caja 5 actualizados para Producción.")
