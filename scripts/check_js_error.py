import winrm

s = winrm.Session('192.168.0.13', auth=('Caja 3', 'caja3'), transport='ntlm')

def ps(cmd):
    encoded_cmd = f"powershell -NoProfile -NonInteractive -Command \"{cmd}\""
    r = s.run_cmd(encoded_cmd)
    return r.std_out.decode('cp1252', errors='replace').strip(), r.std_err.decode('cp1252', errors='replace').strip()

print("=== 1. BUSCAR LOGS DE JAVASCRIPT / ELECTRON EN CAJA 3 ===")
out, err = ps("""
Get-ChildItem -Path "C:\\Users\\*\\AppData" -Filter "*console*.log" -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
    $_.FullName
    Get-Content $_.FullName -Tail 50
}
""")
print(out or err)

print("\n=== 2. EVENTOS DE ERROR DE WINDOWS (ULTIMOS 10) ===")
out2, err2 = ps("""
Get-WinEvent -FilterHashtable @{LogName='Application'; Level=2} -MaxEvents 10 -ErrorAction SilentlyContinue | Format-Table TimeCreated, ProviderName, Message -AutoSize
""")
print(out2 or err2)

print("\n=== 3. ARCHIVOS EN C:\\InteliMarket\\resources ===")
out3, err3 = ps("Get-ChildItem -Path 'C:\\InteliMarket\\resources' | Select-Object Name, Length")
print(out3 or err3)

print("\n=== 4. BUSCAR ICONOS EN DISCO ===")
out4, err4 = ps("Get-ChildItem -Path 'C:\\' -Filter '*.ico' -Recurse -Depth 3 -ErrorAction SilentlyContinue | Select-Object FullName")
print(out4 or err4)
