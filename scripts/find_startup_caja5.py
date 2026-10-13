import winrm

s = winrm.Session('192.168.0.15', auth=('Caja 5', 'caja5'), transport='ntlm')

def ps(script):
    r = s.run_ps(script)
    out = r.std_out.decode('cp1252', errors='replace').strip()
    return out

# 1. Ver TODOS los .lnk en el sistema
print("=== TODOS LOS SHORTCUTS EN TODOS LOS ESCRITORIOS ===")
out = ps(r"""
$shell = New-Object -ComObject WScript.Shell
$paths = @(
    "C:\Users\Caja 5\Desktop",
    "C:\Users\Public\Desktop",
    "C:\ProgramData\Microsoft\Windows\Start Menu\Programs",
    "C:\Users\Caja 5\AppData\Roaming\Microsoft\Windows\Start Menu\Programs"
)
foreach ($p in $paths) {
    if (Test-Path $p) {
        Get-ChildItem $p -Recurse -Filter "*.lnk" -ErrorAction SilentlyContinue | ForEach-Object {
            $lnk = $shell.CreateShortcut($_.FullName)
            Write-Output ("FILE: " + $_.FullName)
            Write-Output ("  TARGET: " + $lnk.TargetPath)
            Write-Output ("  ARGS: " + $lnk.Arguments)
            Write-Output ""
        }
    }
}
""")
print(out)

# 2. Ver Run en el Registro (arranque automático)
print("\n=== REGISTRO - STARTUP ITEMS ===")
out2 = ps(r"""
$keys = @(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Run",
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\RunOnce"
)
foreach ($k in $keys) {
    if (Test-Path $k) {
        Write-Output "=== $k ==="
        Get-ItemProperty $k | Format-List
    }
}
""")
print(out2)

# 3. Tareas programadas de InteliMarket
print("\n=== TAREAS PROGRAMADAS ===")
out3 = ps(r"""
Get-ScheduledTask | Where-Object { $_.TaskName -match "InteliMarket|POS|Caja|superextra|192.168" } | ForEach-Object {
    $t = $_
    $a = $t.Actions | ForEach-Object { $_.Execute + " " + $_.Arguments }
    Write-Output ($t.TaskName + " -> " + ($a -join "; "))
}
""")
print(out3)
