import winrm

s = winrm.Session('192.168.0.13', auth=('Caja 3', 'caja3'), transport='ntlm')

r = s.run_cmd(r'cmd /c type "C:\InteliMarket\win-unpacked\pos-config.json"')
print("CONTENIDO DE POS-CONFIG.JSON:")
print(r.std_out.decode('cp1252', errors='replace'))
