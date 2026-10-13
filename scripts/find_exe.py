import winrm

s = winrm.Session('192.168.0.13', auth=('Caja 3', 'caja3'), transport='ntlm')

def ps(cmd):
    encoded_cmd = f"powershell -NoProfile -NonInteractive -Command \"{cmd}\""
    r = s.run_cmd(encoded_cmd)
    return r.std_out.decode('cp1252', errors='replace').strip(), r.std_err.decode('cp1252', errors='replace').strip()

print(ps("Get-ChildItem -Path 'C:\\Users\\Public\\Desktop' | Select-Object Name, FullName, Length"))
print("---")
print(ps("Get-ChildItem -Path 'C:\\' -Filter '*.exe' -Recurse -Depth 2 -ErrorAction SilentlyContinue | Select-Object FullName"))
