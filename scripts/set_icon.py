import winrm
import base64

s = winrm.Session('192.168.0.13', auth=('Caja 3', 'caja3'), transport='ntlm')

with open('/tmp/icon.ico', 'rb') as f:
    ico_b64 = base64.b64encode(f.read()).decode('ascii')

ps_cmd = """
$b64 = '""" + ico_b64 + """'
[System.IO.File]::WriteAllBytes('C:\\InteliMarket\\win-unpacked\\icon.ico', [Convert]::FromBase64String($b64))
$w = New-Object -ComObject WScript.Shell
Get-ChildItem -Path 'C:\\Users\\*\\Desktop\\*Inteli*.lnk' | ForEach-Object {
    $sc = $w.CreateShortcut($_.FullName)
    $sc.IconLocation = 'C:\\InteliMarket\\win-unpacked\\icon.ico,0'
    $sc.Save()
}
Write-Host 'Icono oficial configurado en accesos directos'
"""

b64_script = base64.b64encode(ps_cmd.encode('utf-16le')).decode('ascii')
r = s.run_cmd(f'powershell -NoProfile -NonInteractive -EncodedCommand {b64_script}')
print(r.std_out.decode('cp1252', errors='replace'))
