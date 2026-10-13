import winrm
import base64

s = winrm.Session('192.168.0.13', auth=('Caja 3', 'caja3'), transport='ntlm')

ps_cmd = """
# 1. Descargar icono oficial
$icoPath = 'C:\\InteliMarket\\win-unpacked\\icon.ico'
Invoke-WebRequest -Uri 'http://192.168.0.10:8000/static/icon.ico' -OutFile $icoPath -UseBasicParsing
Write-Host "Icono descargado: " (Get-Item $icoPath).Length " bytes"

# 2. Configurar icono en accesos directos
$w = New-Object -ComObject WScript.Shell
Get-ChildItem -Path 'C:\\Users\\*\\Desktop\\*Inteli*.lnk' | ForEach-Object {
    $sc = $w.CreateShortcut($_.FullName)
    $sc.IconLocation = "$icoPath,0"
    $sc.Save()
    Write-Host "Icono fijado en: " $_.FullName
}

# 3. Refrescar iconos en Windows Explorer
$code = @'
[System.Runtime.InteropServices.DllImport("Shell32.dll")]
public static extern void SHChangeNotify(int wEventId, int uFlags, IntPtr dwItem1, IntPtr dwItem2);
'@
$type = Add-Type -MemberDefinition $code -Name Shell32Notify -Namespace Win32 -PassThru
$type::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)
Write-Host "Notificacion de refresco de iconos enviada a Windows"
"""

b64 = base64.b64encode(ps_cmd.encode('utf-16le')).decode('ascii')
r = s.run_cmd(f'powershell -NoProfile -NonInteractive -EncodedCommand {b64}')
print(r.std_out.decode('cp1252', errors='replace'))
if r.std_err:
    print("ERR:", r.std_err.decode('cp1252', errors='replace'))
