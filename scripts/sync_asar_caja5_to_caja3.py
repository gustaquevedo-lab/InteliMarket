import winrm
import base64

s5 = winrm.Session('192.168.0.15', auth=('Caja 5', 'caja5'), transport='ntlm')
s3 = winrm.Session('192.168.0.13', auth=('Caja 3', 'caja3'), transport='ntlm')

print("1. Leyendo app.asar desde Caja 5...")
r = s5.run_cmd(r'powershell -NoProfile -Command "[Convert]::ToBase64String([System.IO.File]::ReadAllBytes(\"C:\InteliMarket\win-unpacked\resources\app.asar\"))"')
b64_asar = r.std_out.decode().strip()
print(f"app.asar de Caja 5 leido: {len(b64_asar)} caracteres b64")

if b64_asar:
    # Guardar en VM
    with open('/tmp/caja5_app.asar', 'wb') as f:
        f.write(base64.b64decode(b64_asar))
    print("Guardado en /tmp/caja5_app.asar")
    
    # Copiar a /home/intellihouse/intelimarket/api/static/app.asar
    import shutil
    shutil.copy('/tmp/caja5_app.asar', '/home/intellihouse/intelimarket/api/static/app.asar')
    print("Publicado en http://192.168.0.10:8000/static/app.asar")
    
    # Descargar en Caja 3
    print("2. Descargando app.asar en Caja 3...")
    ps_caja3 = """
    Stop-Process -Name *intelimarket*, *electron* -Force -ErrorAction SilentlyContinue
    Invoke-WebRequest -Uri "http://192.168.0.10:8000/static/app.asar" -OutFile "C:\\InteliMarket\\win-unpacked\\resources\\app.asar" -UseBasicParsing
    Get-Item "C:\\InteliMarket\\win-unpacked\\resources\\app.asar" | Select-Object FullName, Length | Format-Table -AutoSize | Out-String
    """
    b64_cmd = base64.b64encode(ps_caja3.encode('utf-16le')).decode('ascii')
    r3 = s3.run_cmd(f'powershell -NoProfile -NonInteractive -EncodedCommand {b64_cmd}')
    print("Resultado en Caja 3:")
    print(r3.std_out.decode('cp1252', errors='replace'))
