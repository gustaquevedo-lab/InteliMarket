import winrm

s = winrm.Session('192.168.0.15', auth=('Caja 5', 'caja5'), transport='ntlm')

def ps(script):
    r = s.run_ps(script)
    out = r.std_out.decode('cp1252', errors='replace').strip()
    err = r.std_err.decode('cp1252', errors='replace').strip()
    return out, err

# Leer el app.asar y buscar la URL que carga Electron
print("=== BUSCAR loadURL EN APP.ASAR ===")
out, err = ps(r"""
$bytes = [System.IO.File]::ReadAllBytes('C:\InteliMarket\win-unpacked\resources\app.asar')
$text = [System.Text.Encoding]::UTF8.GetString($bytes)
$matches_found = [regex]::Matches($text, 'loadURL\(.{1,300}?\)')
foreach ($m in $matches_found) {
    $val = $m.Value -replace '[^\x20-\x7E]', '.'
    Write-Output ($val.Substring(0, [Math]::Min(300, $val.Length)))
    Write-Output "---"
}
""")
print(out[:3000])
if err:
    print("ERR:", err[:500])

print("\n=== BUSCAR '5174' O '8001' EN ASAR ===")
out2, _ = ps(r"""
$bytes = [System.IO.File]::ReadAllBytes('C:\InteliMarket\win-unpacked\resources\app.asar')
$text = [System.Text.Encoding]::ASCII.GetString($bytes)
$idx1 = $text.IndexOf('5174')
$idx2 = $text.IndexOf('8001')
$idx3 = $text.IndexOf('sandbox')
Write-Output "5174 at index: $idx1"
Write-Output "8001 at index: $idx2"
Write-Output "sandbox at index: $idx3"
if ($idx1 -gt 0) {
    Write-Output ("Context 5174: " + $text.Substring([Math]::Max(0,$idx1-100), 300) -replace '[^\x20-\x7E]', '.')
}
if ($idx2 -gt 0) {
    Write-Output ("Context 8001: " + $text.Substring([Math]::Max(0,$idx2-100), 300) -replace '[^\x20-\x7E]', '.')
}
""")
print(out2[:2000])

print("\n=== BUSCAR TODOS LOS ARCHIVOS EN C:\\InteliMarket ===")
out3, _ = ps(r"Get-ChildItem 'C:\InteliMarket' -Recurse -File | Where-Object { $_.Extension -in '.js','.cjs','.json','.env','.mjs' } | Select-Object -ExpandProperty FullName")
print(out3)
