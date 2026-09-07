import winrm
import re

s = winrm.Session('192.168.0.15', auth=('Caja 5', 'caja5'), transport='ntlm')

def ps(cmd):
    encoded = f'powershell -NoProfile -NonInteractive -Command "{cmd}"'
    r = s.run_cmd(encoded)
    return r.std_out.decode('cp1252', errors='replace').strip()

print("=== BUSCAR URLS EN APP.ASAR DE CAJA 5 ===")
script = """
$bytes = [System.IO.File]::ReadAllBytes('C:\\InteliMarket\\win-unpacked\\resources\\app.asar')
$text = [System.Text.Encoding]::ASCII.GetString($bytes)
[regex]::Matches($text, 'http[s]?://[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}:[0-9]{2,5}') | ForEach-Object { $_.Value } | Select-Object -Unique
"""
print(ps(script))
