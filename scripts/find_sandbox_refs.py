import winrm

s = winrm.Session('192.168.0.15', auth=('Caja 5', 'caja5'), transport='ntlm')

def ps(cmd):
    encoded = f'powershell -NoProfile -NonInteractive -Command "{cmd}"'
    r = s.run_cmd(encoded)
    out = r.std_out.decode('cp1252', errors='replace').strip()
    err = r.std_err.decode('cp1252', errors='replace').strip()
    return out, err

# 1. Listar todos los archivos de config en InteliMarket
print("=== ARCHIVOS DE CONFIG EN InteliMarket ===")
out, _ = ps(r"Get-ChildItem C:\InteliMarket -Recurse -Include *.json,*.env,*.cfg -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName")
print(out)

# 2. Ver contenido del app.asar buscando 5174
print("\n=== BUSCAR '5174' EN APP.ASAR ===")
script = r"""
$bytes = [System.IO.File]::ReadAllBytes('C:\InteliMarket\win-unpacked\resources\app.asar')
$text = [System.Text.Encoding]::UTF8.GetString($bytes)
$lines = $text -split "`n"
$i = 0
foreach ($line in $lines) {
    if ($line -match '5174|8001|sandbox|localhost:517') {
        Write-Output ("Line ${i}: " + $line.Substring(0, [Math]::Min(200, $line.Length)))
    }
    $i++
}
"""
out2, err2 = ps(script)
print(out2[:3000])
if err2:
    print("ERR:", err2[:500])

# 3. Buscar en environment/asar.unpacked si hay algo
print("\n=== BUSCAR CONFIG EN APPDATA DE ELECTRON ===")
out3, _ = ps(r"Get-ChildItem 'C:\Users\Caja 5\AppData\Roaming\InteliMarket POS' -Recurse -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName")
print(out3)
