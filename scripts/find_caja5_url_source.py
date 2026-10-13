import winrm

s = winrm.Session('192.168.0.15', auth=('Caja 5', 'caja5'), transport='ntlm')

def ps(cmd):
    encoded = f'powershell -NoProfile -NonInteractive -Command "{cmd}"'
    r = s.run_cmd(encoded)
    out = r.std_out.decode('cp1252', errors='replace').strip()
    err = r.std_err.decode('cp1252', errors='replace').strip()
    return out, err

# Ver historial de Edge - LastActive URLs
print("=== HISTORIAL DE EDGE (URLS ABIERTAS RECIENTEMENTE) ===")
script = r"""
$hist = "C:\Users\Caja 5\AppData\Local\Microsoft\Edge\User Data\Default\History"
if (Test-Path $hist) {
    Write-Output "Archivo History encontrado: $hist"
    Copy-Item $hist "C:\Temp\edge_history_copy" -Force -ErrorAction SilentlyContinue
} else {
    Write-Output "No encontrado en Default, buscando..."
    Get-ChildItem "C:\Users\Caja 5\AppData\Local\Microsoft\Edge\User Data" -Recurse -Include "History" -ErrorAction SilentlyContinue | Select-Object FullName
}
"""
out, err = ps(script)
print(out)
if err:
    print("ERR:", err[:200])

# Ver las URLs en localStorage de Edge
print("\n=== BUSCAR ARCHIVOS CON 5174 EN APPDATA ===")
script2 = r"""
Get-ChildItem "C:\Users\Caja 5\AppData" -Recurse -File -ErrorAction SilentlyContinue |
Select-String -Pattern "5174|8001|sandbox" -ErrorAction SilentlyContinue |
Select-Object -First 20 |
ForEach-Object { $_.Filename + " => " + $_.Line.Substring(0, [Math]::Min(150, $_.Line.Length)) }
"""
out2, err2 = ps(script2)
print(out2[:2000])

# Ver si hay un acceso directo con la URL en el escritorio
print("\n=== ACCESOS DIRECTOS EN ESCRITORIOS ===")
script3 = r"""
$desktops = @(
    "C:\Users\Caja 5\Desktop",
    "C:\Users\Public\Desktop"
)
foreach ($d in $desktops) {
    if (Test-Path $d) {
        Get-ChildItem $d -Filter "*.lnk" -ErrorAction SilentlyContinue | ForEach-Object {
            $sh = New-Object -ComObject WScript.Shell
            $lnk = $sh.CreateShortcut($_.FullName)
            Write-Output ($_.Name + " -> Target: " + $lnk.TargetPath + " | Args: " + $lnk.Arguments)
        }
    }
}
"""
out3, err3 = ps(script3)
print(out3)
