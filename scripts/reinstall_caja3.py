import winrm

s = winrm.Session('192.168.0.13', auth=('Caja 3', 'caja3'), transport='ntlm')

def ps(cmd):
    encoded_cmd = f"powershell -NoProfile -NonInteractive -Command \"{cmd}\""
    r = s.run_cmd(encoded_cmd)
    return r.std_out.decode('cp1252', errors='replace').strip(), r.std_err.decode('cp1252', errors='replace').strip()

print("=== 1. DETENER PROCESOS EN CAJA 3 ===")
out, err = ps("Stop-Process -Name *intelimarket*, *electron* -Force -ErrorAction SilentlyContinue")
print("Procesos detenidos.")

print("\n=== 2. LIMPIAR APPDATA Y CACHE EN CAJA 3 ===")
out, err = ps("""
Remove-Item -Path "C:\\Users\\*\\AppData\\Roaming\\*inteli*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "C:\\Users\\*\\AppData\\Local\\*inteli*" -Recurse -Force -ErrorAction SilentlyContinue
""")
print("Cache limpiado.")

print("\n=== 3. DESCARGAR PAQUETE LIMPIO DE INTELIMARKET POS DESDE EL SERVIDOR ===")
cmd_download = """
$url = 'http://192.168.0.10:8000/download/windows'
$zip = 'C:\\InteliMarket-POS-Windows.zip'
$dest = 'C:\\InteliMarket'

Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
if (Test-Path $zip) {
    Write-Output ("Descarga exitosa: " + (Get-Item $zip).Length + " bytes")
    if (Test-Path $dest) {
        Remove-Item -Path $dest -Recurse -Force -ErrorAction SilentlyContinue
    }
    Expand-Archive -Path $zip -DestinationPath 'C:\\' -Force
    Remove-Item $zip -Force -ErrorAction SilentlyContinue
    Write-Output "Extraccion completada en C:\\"
} else {
    Write-Output "Error en descarga"
}
"""
out, err = ps(cmd_download)
print(out or err)

print("\n=== 4. CONFIGURAR POS-CONFIG.JSON ===")
cmd_cfg = """
$json = @'
{
  "env": "production",
  "serverUrl": "http://192.168.0.10:5173/pos",
  "apiUrl": "http://192.168.0.10:8000",
  "ruc": "80150377-9",
  "company": "Extra Supermercado Mayorista"
}
'@
if (!(Test-Path 'C:\\InteliMarket\\win-unpacked')) {
    New-Item -ItemType Directory -Path 'C:\\InteliMarket\\win-unpacked' -Force
}
[System.IO.File]::WriteAllText('C:\\InteliMarket\\win-unpacked\\pos-config.json', $json, [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText('C:\\Users\\Public\\Desktop\\pos-config.json', $json, [System.Text.UTF8Encoding]::new($false))
Write-Output "pos-config.json configurado"
"""
out, err = ps(cmd_cfg)
print(out or err)

print("\n=== 5. CREAR ACCESO DIRECTO EN ESCRITORIO ===")
cmd_sc = """
$w = New-Object -ComObject WScript.Shell
$sc = $w.CreateShortcut('C:\\Users\\Public\\Desktop\\Intelimarket POS.lnk')
$sc.TargetPath = 'C:\\InteliMarket\\win-unpacked\\InteliMarket POS.exe'
$sc.Arguments = '--url=http://192.168.0.10:5173/pos'
$sc.WorkingDirectory = 'C:\\InteliMarket\\win-unpacked'
$sc.Save()

Get-ChildItem -Path 'C:\\Users\\*\\Desktop' -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    $userSc = $w.CreateShortcut($_.FullName + '\\Intelimarket POS.lnk')
    $userSc.TargetPath = 'C:\\InteliMarket\\win-unpacked\\InteliMarket POS.exe'
    $userSc.Arguments = '--url=http://192.168.0.10:5173/pos'
    $userSc.WorkingDirectory = 'C:\\InteliMarket\\win-unpacked'
    $userSc.Save()
}
Write-Output "Accesos directos guardados"
"""
out, err = ps(cmd_sc)
print(out or err)

print("\n=== 6. CREAR TAREA PROGRAMADA PARA ABRIR EN SESION DE PANTALLA ===")
cmd_task = """
$action = New-ScheduledTaskAction -Execute 'C:\\InteliMarket\\win-unpacked\\InteliMarket POS.exe' -Argument '--url=http://192.168.0.10:5173/pos' -WorkingDirectory 'C:\\InteliMarket\\win-unpacked'
$principal = New-ScheduledTaskPrincipal -UserId 'caja 3' -LogonType Interactive
Register-ScheduledTask -TaskName 'LaunchPOS' -Action $action -Principal $principal -Force
Start-ScheduledTask -TaskName 'LaunchPOS'
Start-Sleep -Seconds 3
Unregister-ScheduledTask -TaskName 'LaunchPOS' -Confirm:$false
Write-Output "Lanzado en pantalla fisica"
"""
out, err = ps(cmd_task)
print(out or err)
