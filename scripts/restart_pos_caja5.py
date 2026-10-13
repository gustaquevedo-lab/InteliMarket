import winrm

s = winrm.Session('192.168.0.15', auth=('Caja 5', 'caja5'), transport='ntlm')

def ps(script):
    r = s.run_ps(script)
    out = r.std_out.decode('cp1252', errors='replace').strip()
    return out

# 1. Verificar el pos-config.json actual
print("=== POS-CONFIG.JSON ACTUAL ===")
out = ps(r"Get-Content 'C:\InteliMarket\win-unpacked\pos-config.json'")
print(out)

# 2. Matar cualquier proceso del POS (InteliMarket POS.exe) si está corriendo
print("\n=== MATAR PROCESO POS SI EXISTE ===")
out2 = ps(r"Get-Process | Where-Object { $_.Name -match 'InteliMarket' } | Stop-Process -Force -ErrorAction SilentlyContinue; Write-Output 'Done'")
print(out2)

# 3. Lanzar el POS de nuevo
print("\n=== LANZAR POS CON LA NUEVA CONFIG ===")
out3 = ps(r"""
$exe = 'C:\InteliMarket\win-unpacked\InteliMarket POS.exe'
if (Test-Path $exe) {
    Start-Process $exe
    Start-Sleep 3
    $proc = Get-Process | Where-Object { $_.Name -match 'InteliMarket' }
    if ($proc) {
        Write-Output ("POS iniciado OK. PID: " + $proc.Id)
    } else {
        Write-Output "POS no aparece como proceso aun, puede estar iniciando..."
    }
} else {
    Write-Output "EJECUTABLE NO ENCONTRADO: $exe"
}
""")
print(out3)
