import winrm

s = winrm.Session('192.168.0.13', auth=('Caja 3', 'caja3'), transport='ntlm')

r = s.run_cmd(r'cmd /c dir /s /b "C:\Users\Public\Desktop\*.lnk"')
print("PUBLIC DESKTOP LNK:")
print(r.std_out.decode('cp1252', errors='replace'))

r2 = s.run_cmd(r'cmd /c dir /s /b "C:\Users\caja 3\Desktop\*.lnk"')
print("CAJA 3 DESKTOP LNK:")
print(r2.std_out.decode('cp1252', errors='replace'))

r3 = s.run_cmd(r'cmd /c dir /s /b "C:\Users\Caja 2\Desktop\*.lnk"')
print("CAJA 2 DESKTOP LNK:")
print(r3.std_out.decode('cp1252', errors='replace'))
