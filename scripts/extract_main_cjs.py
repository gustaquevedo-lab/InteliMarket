import winrm

s = winrm.Session('192.168.0.15', auth=('Caja 5', 'caja5'), transport='ntlm')

def ps(script):
    r = s.run_ps(script)
    out = r.std_out.decode('cp1252', errors='replace').strip()
    return out

# El header termina en byte 8 + 3484068 = 3484076
# El bloque de datos empieza en ese offset alineado a 4 bytes
# El offset del archivo dentro del bloque de datos es 499282
# Entonces el offset real en el archivo .asar es: header_start + header_size (alineado) + file_offset

print("=== EXTRAER MAIN.CJS DEL ASAR ===")
out = ps(r"""
$bytes = [System.IO.File]::ReadAllBytes('C:\InteliMarket\win-unpacked\resources\app.asar')

# ASAR format:
# bytes 0-3: Pickle size (LE uint32) = size of the next uint32 which contains header size
# bytes 4-7: Header size (LE uint32)  
# bytes 8 to 8+headerSize: JSON header
# After header, data starts aligned to 4 bytes

$pickleSize = [BitConverter]::ToUInt32($bytes[0..3], 0)  # should be 4
$headerSize = [BitConverter]::ToUInt32($bytes[4..7], 0)  # 3484068

Write-Output "pickleSize: $pickleSize, headerSize: $headerSize"

# Data block starts at: 8 + headerSize, aligned to 4 bytes
$dataStart = 8 + $headerSize
# Align to 4 bytes
$dataStart = [Math]::Ceiling($dataStart / 4) * 4

Write-Output "dataStart: $dataStart"

# main.cjs offset within data block: 499282, size: 26341
$fileOffset = $dataStart + 499282
$fileSize = 26341

Write-Output "Extracting main.cjs from offset $fileOffset, size $fileSize"

$fileBytes = $bytes[$fileOffset..($fileOffset + $fileSize - 1)]
$fileContent = [System.Text.Encoding]::UTF8.GetString($fileBytes)

# Buscar la URL
Write-Output "=== CONTENIDO DE MAIN.CJS (primeros 3000 chars) ==="
Write-Output $fileContent.Substring(0, [Math]::Min(3000, $fileContent.Length))
""")
print(out[:5000])
