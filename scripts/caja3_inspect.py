import winrm

s = winrm.Session('192.168.0.13', auth=('Caja 3', 'caja3'), transport='ntlm')

def ps(cmd):
    encoded_cmd = f"powershell -NoProfile -NonInteractive -Command \"{cmd}\""
    r = s.run_cmd(encoded_cmd)
    return r.std_out.decode('cp1252', errors='replace').strip(), r.std_err.decode('cp1252', errors='replace').strip()

print("=== 1. PROCESOS VISIBLES CON TITULO ===")
out, err = ps("Get-Process | Where-Object { $_.MainWindowTitle } | Format-Table Id, ProcessName, MainWindowTitle -AutoSize")
print(out or err)

print("\n=== 2. TODOS LOS PROCESOS EN EJECUCION ===")
out, err = ps("Get-Process | Select-Object ProcessName | Group-Object ProcessName | Select-Object Count, Name | Sort-Object Count -Descending")
print(out or err)

print("\n=== 3. ARCHIVOS EN ESCRITORIO DE TODOS LOS USUARIOS ===")
out, err = ps("Get-ChildItem -Path C:\\Users\\*\\Desktop\\* | Select-Object FullName")
print(out or err)

print("\n=== 4. SHORTCUTS Y RUTAS ===")
out, err = ps("""
$WshShell = New-Object -ComObject WScript.Shell
Get-ChildItem -Path 'C:\\Users\\*\\Desktop\\*.lnk' | ForEach-Object {
    $Shortcut = $WshShell.CreateShortcut($_.FullName)
    [PSCustomObject]@{
        Name = $_.Name
        TargetPath = $Shortcut.TargetPath
        Arguments = $Shortcut.Arguments
    }
} | Format-Table -AutoSize
""")
print(out or err)
