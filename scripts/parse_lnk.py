import winrm
import re

s = winrm.Session('192.168.0.13', auth=('Caja 3', 'caja3'), transport='ntlm')

cmd = """powershell -NoProfile -Command "
$bytes = [System.IO.File]::ReadAllBytes('C:\\Users\\Public\\Desktop\\Intelimarket POS.lnk')
$str = [System.Text.Encoding]::ASCII.GetString($bytes)
$str -replace '[^a-zA-Z0-9_:\-\\.\\/ ]', ' '
" """

r = s.run_cmd(cmd)
text = r.std_out.decode('cp1252', errors='replace')
print("CONTENIDO DE INTELIMARKET POS.LNK:")
for word in text.split():
    if len(word) > 4 and (':' in word or '\\' in word or '/' in word or '.exe' in word or 'http' in word):
        print(" ->", word)
