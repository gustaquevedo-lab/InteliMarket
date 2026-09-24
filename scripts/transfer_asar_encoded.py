import winrm
import threading
import http.server
import socketserver
import os
import base64

class FileUploadHandler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        with open('/tmp/working_app.asar', 'wb') as f:
            f.write(post_data)
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'OK')

socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(('0.0.0.0', 8099), FileUploadHandler)

thread = threading.Thread(target=httpd.handle_request)
thread.start()
print("1. Servidor receptor temporal levantado en 8089...")

# 2. Enviar app.asar desde Caja 5 (192.168.0.15)
s5 = winrm.Session('192.168.0.15', auth=('Caja 5', 'caja5'), transport='ntlm')
ps_send = """
$file = 'C:\\InteliMarket\\win-unpacked\\resources\\app.asar'
$bytes = [System.IO.File]::ReadAllBytes($file)
$res = Invoke-RestMethod -Uri 'http://192.168.0.10:8099' -Method Post -Body $bytes -ContentType 'application/octet-stream'
Write-Host "Enviado con exito: " $res

"""
b64_5 = base64.b64encode(ps_send.encode('utf-16le')).decode('ascii')
r5 = s5.run_cmd(f'powershell -NoProfile -NonInteractive -EncodedCommand {b64_5}')
print("Respuesta de Caja 5:", r5.std_out.decode('cp1252', errors='replace'))

thread.join(timeout=10)
httpd.server_close()

if os.path.exists('/tmp/working_app.asar'):
    size = os.path.getsize('/tmp/working_app.asar')
    print(f"2. Archivo app.asar recibido: {size} bytes")
    
    import shutil
    shutil.copy('/tmp/working_app.asar', '/home/intellihouse/intelimarket/api/static/app.asar')
    
    # 3. Descargar en Caja 3
    s3 = winrm.Session('192.168.0.13', auth=('Caja 3', 'caja3'), transport='ntlm')
    ps_caja3 = """
    Stop-Process -Name *intelimarket*, *electron* -Force -ErrorAction SilentlyContinue
    Invoke-WebRequest -Uri 'http://192.168.0.10:8000/static/app.asar' -OutFile 'C:\\InteliMarket\\win-unpacked\\resources\\app.asar' -UseBasicParsing
    Write-Host "app.asar instalado en Caja 3: " (Get-Item 'C:\\InteliMarket\\win-unpacked\\resources\\app.asar').Length " bytes"
    """
    b64_3 = base64.b64encode(ps_caja3.encode('utf-16le')).decode('ascii')
    r3 = s3.run_cmd(f'powershell -NoProfile -NonInteractive -EncodedCommand {b64_3}')
    print("3. Respuesta de Caja 3:", r3.std_out.decode('cp1252', errors='replace'))
else:
    print("No se recibió el archivo")
