import winrm
import base64

s4 = winrm.Session('192.168.0.14', auth=('Caja 4', 'caja4'), transport='ntlm')

def ps4(cmd):
    b64 = base64.b64encode(cmd.encode('utf-16le')).decode('ascii')
    r = s4.run_cmd(f'powershell -NoProfile -NonInteractive -EncodedCommand {b64}')
    out = r.std_out.decode('cp1252', errors='replace').strip()
    err = r.std_err.decode('cp1252', errors='replace').strip()
    return out, err

ps_cmd = """
Write-Host "=== ESTADO DE INTELIMARKET EN CAJA 4 ==="
$asar = 'C:\\InteliMarket\\win-unpacked\\resources\\app.asar'
if (Test-Path $asar) {
    Write-Host "app.asar presente: " (Get-Item $asar).Length " bytes"
} else {
    Write-Host "app.asar NO encontrado"
}

$cfg = 'C:\\InteliMarket\\win-unpacked\\pos-config.json'
if (Test-Path $cfg) {
    Write-Host "pos-config.json:"
    Get-Content $cfg
} else {
    Write-Host "pos-config.json NO encontrado"
}
"""

out, err = ps4(ps_cmd)
print(out)
if err:
    print("ERR:", err)
