import winrm

try:
    s4 = winrm.Session('192.168.0.14', auth=('Caja 4', 'caja4'), transport='ntlm')
    r = s4.run_cmd('powershell -NoProfile -Command "hostname"')
    print("=== ESTADO WINRM CAJA 4 (192.168.0.14) ===")
    print("Hostname:", r.std_out.decode('cp1252', errors='replace').strip())
except Exception as e:
    print("Error conectando a Caja 4:", e)
