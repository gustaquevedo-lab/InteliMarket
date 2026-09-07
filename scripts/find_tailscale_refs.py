import winrm

s = winrm.Session('192.168.0.13', auth=('Caja 3', 'caja3'), transport='ntlm')

def ps(cmd):
    encoded_cmd = f"powershell -NoProfile -NonInteractive -Command \"{cmd}\""
    r = s.run_cmd(encoded_cmd)
    return r.std_out.decode('cp1252', errors='replace').strip(), r.std_err.decode('cp1252', errors='replace').strip()

print("=== BUSCAR ARCHIVOS O SHORTCUTS CON 100.83.91.76 EN CAJA 3 ===")
out, err = ps("""
Get-ChildItem -Path C:\\Users -Filter "*.json" -Recurse -Depth 4 -ErrorAction SilentlyContinue | ForEach-Object {
    $content = Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue
    if ($content -like "*100.83.91.76*") {
        $_.FullName + " -> " + $content
    }
}
""")
print(out or err)

print("=== VER SHORTCUTS DE CHROME/EDGE/ELECTRON ===")
out2, err2 = ps("""
Get-ChildItem -Path "C:\\Users\\*\\Desktop\\*.lnk", "C:\\Users\\Public\\Desktop\\*.lnk" | ForEach-Object {
    $sh = (New-Object -ComObject WScript.Shell).CreateShortcut($_.FullName)
    "SHORTCUT: " + $_.FullName + " -> Target: " + $sh.TargetPath + " -> Args: " + $sh.Arguments
}
""")
print(out2 or err2)
