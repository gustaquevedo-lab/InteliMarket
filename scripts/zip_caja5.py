import winrm
import base64

s5 = winrm.Session('192.168.0.15', auth=('Caja 5', 'caja5'), transport='ntlm')

def ps5(cmd):
    b64 = base64.b64encode(cmd.encode('utf-16le')).decode('ascii')
    r = s5.run_cmd(f'powershell -NoProfile -NonInteractive -EncodedCommand {b64}')
    out = r.std_out.decode('cp1252', errors='replace').strip()
    err = r.std_err.decode('cp1252', errors='replace').strip()
    return out, err

ps_cmd = """
$zip = "C:\\caja5_intelimarket.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path "C:\\InteliMarket\\*" -DestinationPath $zip -CompressionLevel Fastest
Get-Item $zip | Select-Object FullName, Length | Format-Table -AutoSize | Out-String
"""

out, err = ps5(ps_cmd)
print("=== COMPRIMIENDO INTELIMARKET DIRECTO DE CAJA 5 ===")
print(out)
if err:
    print("ERRORES:", err)
