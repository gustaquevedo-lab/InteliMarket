import winrm

s = winrm.Session('192.168.0.15', auth=('Caja 5', 'caja5'), transport='ntlm')

print("=== ARCHIVOS EN C:\\InteliMarket\\win-unpacked ===")
r = s.run_cmd('dir "C:\\InteliMarket\\win-unpacked"')
print(r.std_out.decode('cp1252'))

print("=== ARCHIVOS EN C:\\InteliMarket\\win-unpacked\\resources ===")
r2 = s.run_cmd('dir "C:\\InteliMarket\\win-unpacked\\resources"')
print(r2.std_out.decode('cp1252'))
