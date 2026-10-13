import winrm

s = winrm.Session('192.168.0.15', auth=('Caja 5', 'caja5'), transport='ntlm')

def ps(script):
    r = s.run_ps(script)
    out = r.std_out.decode('cp1252', errors='replace').strip()
    return out

# La URL correcta de producción es http://192.168.0.10:5173/pos  
# (puerto 5173 = Vite de producción, no 5174 = sandbox)
# Pero verificar si hay Nginx en el 80 que sirva el frontend

print("=== ESCRIBIR POS-CONFIG.JSON CORRECTO ===")

# Verificar qué rutas busca el main.cjs (exeDir es donde está el .exe)
# C:\InteliMarket\win-unpacked\ <- ahí debe estar el pos-config.json
# Eso ya lo tenemos escrito, pero con serverUrl: http://192.168.0.10:8000
# Que NO incluye /pos, necesitamos serverUrl: http://192.168.0.10:5173/pos

json_content = """{
  "serverUrl": "http://192.168.0.10:5173/pos",
  "apiUrl": "http://192.168.0.10:8000/api",
  "terminalId": "015",
  "cajaNumero": "5"
}"""

script = f"""
$content = @'
{json_content}
'@
Set-Content -Path 'C:\\InteliMarket\\win-unpacked\\pos-config.json' -Value $content -Encoding UTF8 -Force
Get-Content 'C:\\InteliMarket\\win-unpacked\\pos-config.json'
"""
out = ps(script)
print(out)

# Verificar que el archivo se leyó bien (sin BOM)
print("\n=== VERIFICAR PRIMEROS BYTES ===")
out2 = ps(r"""
$bytes = [System.IO.File]::ReadAllBytes('C:\InteliMarket\win-unpacked\pos-config.json')
Write-Output ("Size: " + $bytes.Length + " bytes")
Write-Output ("First bytes: " + ($bytes[0..5] -join ','))
$text = [System.Text.Encoding]::UTF8.GetString($bytes).TrimStart([char]0xFEFF)
$json = $text | ConvertFrom-Json
Write-Output ("serverUrl: " + $json.serverUrl)
Write-Output ("apiUrl: " + $json.apiUrl)
""")
print(out2)
