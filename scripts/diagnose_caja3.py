import winrm

s = winrm.Session('192.168.0.13', auth=('Caja 3', 'caja3'), transport='ntlm')

def ps(cmd):
    encoded_cmd = f"powershell -NoProfile -NonInteractive -Command \"{cmd}\""
    r = s.run_cmd(encoded_cmd)
    return r.std_out.decode('cp1252', errors='replace').strip()

print("=== 1. ARCHIVOS EN DESKTOP DE CAJA 3 ===")
print(ps("Get-ChildItem -Path C:\\Users\\*\\Desktop | Select-Object FullName"))

print("\n=== 2. VENTANAS Y PROCESOS VISIBLES ===")
print(ps("Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | Select-Object Id, ProcessName, MainWindowTitle"))

print("\n=== 3. CONECTIVIDAD DESDE CAJA 3 AL BACKEND ===")
print(ps("Test-NetConnection -ComputerName 100.83.91.76 -Port 8000 -InformationLevel Detailed"))
print(ps("Test-NetConnection -ComputerName 192.168.0.10 -Port 8000 -InformationLevel Detailed"))

print("\n=== 4. CURL DESDE POWERSHELL EN CAJA 3 ===")
print(ps("try { (Invoke-WebRequest -Uri 'http://192.168.0.10:8000/v1/auth/pos-staff' -UseBasicParsing -TimeoutSec 3).Content } catch { $_.Exception.Message }"))
print(ps("try { (Invoke-WebRequest -Uri 'http://100.83.91.76:8000/v1/auth/pos-staff' -UseBasicParsing -TimeoutSec 3).Content } catch { $_.Exception.Message }"))
