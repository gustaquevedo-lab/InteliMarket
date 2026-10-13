import winrm

s = winrm.Session('192.168.0.13', auth=('Caja 3', 'caja3'), transport='ntlm')

def ps(cmd):
    encoded_cmd = f"powershell -NoProfile -NonInteractive -Command \"{cmd}\""
    r = s.run_cmd(encoded_cmd)
    return r.std_out.decode('cp1252', errors='replace').strip(), r.std_err.decode('cp1252', errors='replace').strip()

print("=== BUSCAR EXECUTABLE INTELIMARKET EN DISCO ===")
out, err = ps("""
Get-ChildItem -Path C:\\ -Filter "*intelimarket*.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object FullName
""")
print(out or err)

print("=== VER ACCESOS DIRECTOS EN ESCRITORIOS ===")
out2, err2 = ps("""
$w = New-Object -ComObject WScript.Shell
Get-ChildItem -Path C:\\Users\\*\\Desktop\\*.lnk | ForEach-Object {
    $s = $w.CreateShortcut($_.FullName)
    "LNK: " + $_.FullName + " -> " + $s.TargetPath + " (Args: " + $s.Arguments + ")"
}
""")
print(out2 or err2)
