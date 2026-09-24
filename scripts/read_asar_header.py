import winrm

s = winrm.Session('192.168.0.15', auth=('Caja 5', 'caja5'), transport='ntlm')

def ps(script):
    r = s.run_ps(script)
    out = r.std_out.decode('cp1252', errors='replace').strip()
    return out

# El app.asar tiene un header JSON que describe el índice de archivos
# Necesitamos leer el header para encontrar el offset de main.cjs
print("=== LEER HEADER DEL APP.ASAR (primeros 1024 bytes) ===")
out = ps(r"""
$bytes = [System.IO.File]::ReadAllBytes('C:\InteliMarket\win-unpacked\resources\app.asar')
# Los primeros 4 bytes son el magic, bytes 4-7 son el tamaño del header
$headerSize = [BitConverter]::ToUInt32($bytes[4..7], 0)
Write-Output "Header size: $headerSize bytes"
# El header comienza en byte 8
$headerBytes = $bytes[8..([Math]::Min(8+$headerSize, $bytes.Length-1))]
$headerText = [System.Text.Encoding]::UTF8.GetString($headerBytes)
# Buscar main.cjs en el header
$idx = $headerText.IndexOf('main.cjs')
if ($idx -gt 0) {
    Write-Output ("main.cjs entry: " + $headerText.Substring([Math]::Max(0,$idx-10), 200))
} else {
    Write-Output "main.cjs NO encontrado en header"
    # Buscar main.js
    $idx2 = $headerText.IndexOf('"main.js"')
    if ($idx2 -gt 0) {
        Write-Output ("main.js entry: " + $headerText.Substring([Math]::Max(0,$idx2-10), 200))
    }
    # Buscar index.js
    $idx3 = $headerText.IndexOf('"index.js"')
    if ($idx3 -gt 0) {
        Write-Output ("index.js entry: " + $headerText.Substring([Math]::Max(0,$idx3-10), 200))
    }
    # Listar los archivos en la raíz
    Write-Output "`nPrimeros 2000 chars del header:"
    Write-Output $headerText.Substring(0, [Math]::Min(2000, $headerText.Length))
}
""")
print(out[:5000])
