import winrm

s = winrm.Session('192.168.0.13', auth=('Caja 3', 'caja3'), transport='ntlm')

def ps(cmd):
    encoded_cmd = f"powershell -NoProfile -NonInteractive -Command \"{cmd}\""
    r = s.run_cmd(encoded_cmd)
    return r.std_out.decode('cp1252', errors='replace').strip(), r.std_err.decode('cp1252', errors='replace').strip()

print("=== 1. USUARIO CON SESION ACTIVA EN PANTALLA ===")
out, err = ps("quser")
print(out or err)

print("\n=== 2. PROCESOS DE INTELIMARKET POS (PATH Y CMDLINE) ===")
out, err = ps("Get-CimInstance Win32_Process -Filter \"Name like '%InteliMarket%'\" | Select-Object ProcessId, CommandLine")
print(out or err)

print("\n=== 3. CONTENIDO DEL ACCESO DIRECTO ===")
out, err = ps("""
$WshShell = New-Object -ComObject WScript.Shell
$sc = $WshShell.CreateShortcut('C:\\Users\\Public\\Desktop\\Intelimarket POS.lnk')
"TargetPath: " + $sc.TargetPath
"Arguments:  " + $sc.Arguments
"WorkingDir: " + $sc.WorkingDirectory
""")
print(out or err)
