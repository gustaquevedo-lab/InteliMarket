import winrm
import base64

s3 = winrm.Session('192.168.0.13', auth=('Caja 3', 'caja3'), transport='ntlm')

def ps3(cmd):
    b64 = base64.b64encode(cmd.encode('utf-16le')).decode('ascii')
    r = s3.run_cmd(f'powershell -NoProfile -NonInteractive -EncodedCommand {b64}')
    out = r.std_out.decode('cp1252', errors='replace').strip()
    err = r.std_err.decode('cp1252', errors='replace').strip()
    return out, err

ps_script = """
# 1. Matar procesos
Stop-Process -Name *intelimarket*, *electron* -Force -ErrorAction SilentlyContinue

# 2. Descargar zip oficial desde el servidor
$zip = "C:\\InteliMarket-POS-Windows.zip"
Invoke-WebRequest -Uri "http://192.168.0.10:8000/download/windows" -OutFile $zip -UseBasicParsing
Write-Host ("Zip descargado: " + (Get-Item $zip).Length + " bytes")

# 3. Limpiar C:\\InteliMarket y extraer
if (Test-Path "C:\\InteliMarket") {
    Remove-Item -Path "C:\\InteliMarket" -Recurse -Force -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Path "C:\\InteliMarket" -Force | Out-Null
Expand-Archive -Path $zip -DestinationPath "C:\\InteliMarket" -Force
Remove-Item $zip -Force -ErrorAction SilentlyContinue
Write-Host "Zip extraido en C:\\InteliMarket"

# Si extrajo como C:\InteliMarket\win-unpacked o flat, asegurar ambas estructuras
if (Test-Path "C:\\InteliMarket\\win-unpacked") {
    Write-Host "win-unpacked presente"
} else {
    New-Item -ItemType Directory -Path "C:\\InteliMarket\\win-unpacked" -Force | Out-Null
    Copy-Item -Path "C:\\InteliMarket\\*" -Destination "C:\\InteliMarket\\win-unpacked" -Recurse -Force -Exclude "win-unpacked" -ErrorAction SilentlyContinue
}

# 4. Escribir pos-config.json
$cfg = @'
{
  "env": "production",
  "serverUrl": "http://192.168.0.10:5173/pos",
  "apiUrl": "http://192.168.0.10:8000",
  "ruc": "80150377-9",
  "company": "Extra Supermercado Mayorista"
}
'@
[System.IO.File]::WriteAllText("C:\\InteliMarket\\pos-config.json", $cfg, [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText("C:\\InteliMarket\\win-unpacked\\pos-config.json", $cfg, [System.Text.UTF8Encoding]::new($false))
Write-Host "pos-config.json escrito"

# 5. Configurar icono y accesos directos
$w = New-Object -ComObject WScript.Shell
$exe = "C:\\InteliMarket\\win-unpacked\\InteliMarket POS.exe"
if (!(Test-Path $exe)) {
    $exe = "C:\\InteliMarket\\InteliMarket POS.exe"
}
$ico = "C:\\InteliMarket\\win-unpacked\\icon.ico"
if (!(Test-Path $ico)) {
    $ico = "C:\\InteliMarket\\icon.ico"
}

Remove-Item -Path "C:\\Users\\*\\Desktop\\*Inteli*.lnk" -Force -ErrorAction SilentlyContinue

$desktops = @(
    "C:\\Users\\Public\\Desktop",
    "C:\\Users\\caja 3\\Desktop",
    "C:\\Users\\Caja 3\\Desktop",
    "C:\\Users\\Caja 2\\Desktop"
)

foreach ($d in ($desktops | Select-Object -Unique)) {
    if (Test-Path $d) {
        $sc = $w.CreateShortcut((Join-Path $d "InteliMarket POS.lnk"))
        $sc.TargetPath = $exe
        $sc.WorkingDirectory = [System.IO.Path]::GetDirectoryName($exe)
        if (Test-Path $ico) {
            $sc.IconLocation = "$ico,0"
        } else {
            $sc.IconLocation = "$exe,0"
        }
        $sc.Save()
        Write-Host "Acceso directo creado en: $d (Icon: $($sc.IconLocation))"
    }
}

# 6. Mostrar contenido
Get-ChildItem -Path [System.IO.Path]::GetDirectoryName($exe) | Select-Object Name, Length | Format-Table -AutoSize | Out-String
"""

out, err = ps3(ps_script)
print("=== RESULTADO DE INSTALACION EN CAJA 3 ===")
print(out)
if err:
    print("ERRORES:", err)
