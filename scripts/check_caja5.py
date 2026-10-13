import winrm
import json

s = winrm.Session('192.168.0.15', auth=('Caja 5', 'caja5'), transport='ntlm')

def ps(cmd):
    encoded_cmd = f"powershell -NoProfile -NonInteractive -Command \"{cmd}\""
    r = s.run_cmd(encoded_cmd)
    return r.std_out.decode('cp1252', errors='replace').strip(), r.std_err.decode('cp1252', errors='replace').strip()

print("=== VER CONFIGURACIÓN EN CAJA 5 (192.168.0.15) ===")
out, err = ps("""
if (Test-Path 'C:\\InteliMarket\\win-unpacked\\pos-config.json') {
    Get-Content 'C:\\InteliMarket\\win-unpacked\\pos-config.json'
} else {
    'NO EXISTE pos-config.json en C:\\InteliMarket\\win-unpacked'
}
""")
print(out or err)

print("\n=== VER IMPRESORA EN CAJA 5 ===")
out2, err2 = ps("Get-Printer | Format-Table Name, DriverName, PortName -AutoSize")
print(out2 or err2)

print("\n=== VER ACCESOS DIRECTOS EN CAJA 5 ===")
out3, err3 = ps("""
$w = New-Object -ComObject WScript.Shell
Get-ChildItem -Path 'C:\\Users\\*\\Desktop\\*.lnk', 'C:\\Users\\Public\\Desktop\\*.lnk' -ErrorAction SilentlyContinue | ForEach-Object {
    $sc = $w.CreateShortcut($_.FullName)
    $_.FullName + " -> " + $sc.TargetPath + " (Args: " + $sc.Arguments + ")"
}
""")
print(out3 or err3)
