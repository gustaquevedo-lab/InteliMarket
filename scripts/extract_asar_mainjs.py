import winrm

s = winrm.Session('192.168.0.15', auth=('Caja 5', 'caja5'), transport='ntlm')

def ps(cmd):
    encoded = f'powershell -NoProfile -NonInteractive -Command "{cmd}"'
    r = s.run_cmd(encoded)
    out = r.std_out.decode('cp1252', errors='replace').strip()
    err = r.std_err.decode('cp1252', errors='replace').strip()
    return out, err

# EXTRAER EL MAIN.CJS DE DENTRO DEL APP.ASAR usando 7zip o similar
print("=== INTENTAR EXTRAER APP.ASAR CON NPX ASAR ===")
out, err = ps(r"""
if (Test-Path "C:\Program Files\nodejs\node.exe") {
    Write-Output "Node disponible"
    cmd /c "cd C:\Temp && node -e ""const asar=require('asar'); asar.extractAll('C:\InteliMarket\win-unpacked\resources\app.asar','C:\Temp\asar-extracted')"""
} else {
    Write-Output "Node no encontrado en esa ruta"
}
""")
print(out, err)

# Buscar node en otras rutas
print("\n=== BUSCAR NODE EN CAJA 5 ===")
out2, _ = ps(r"""
$locs = @("C:\Program Files\nodejs", "C:\Program Files (x86)\nodejs", "$env:APPDATA\npm", "$env:LOCALAPPDATA\Programs\nodejs")
foreach ($l in $locs) {
    if (Test-Path "$l\node.exe") { Write-Output "ENCONTRADO: $l\node.exe" }
}
# O usar el node embebido de InteliMarket
Get-ChildItem "C:\InteliMarket" -Recurse -Filter "node.exe" -ErrorAction SilentlyContinue | Select-Object FullName
""")
print(out2)

# Leer directamente el main.cjs binario del asar
print("\n=== LEER MAIN.CJS DEL ASAR BINARIO ===")
out3, _ = ps(r"""
$bytes = [System.IO.File]::ReadAllBytes('C:\InteliMarket\win-unpacked\resources\app.asar')
$text = [System.Text.Encoding]::UTF8.GetString($bytes)
# Buscar la URL que carga la ventana
$match = [regex]::Matches($text, '(loadURL|loadFile|mainWindow|BrowserWindow).{0,500}')
foreach ($m in $match) {
    $val = $m.Value -replace '[^\x20-\x7E]', '.'
    Write-Output $val.Substring(0, [Math]::Min(300, $val.Length))
    Write-Output "---"
}
""")
print(out3[:3000])
