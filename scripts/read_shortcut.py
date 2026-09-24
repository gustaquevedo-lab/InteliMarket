import winrm

s = winrm.Session('192.168.0.13', auth=('Caja 3', 'caja3'), transport='ntlm')

def ps(cmd):
    encoded_cmd = f"powershell -NoProfile -NonInteractive -Command \"{cmd}\""
    r = s.run_cmd(encoded_cmd)
    return r.std_out.decode('cp1252', errors='replace').strip(), r.std_err.decode('cp1252', errors='replace').strip()

print("=== VER ACCESO DIRECTO PUBLICO ===")
vbs_script = """
$sh = New-Object -ComObject WScript.Shell
$sc = $sh.CreateShortcut('C:\\Users\\Public\\Desktop\\Intelimarket POS.lnk')
Write-Output ("Target: " + $sc.TargetPath)
Write-Output ("Args:   " + $sc.Arguments)
Write-Output ("Dir:    " + $sc.WorkingDirectory)
"""
out, err = ps(vbs_script)
print(out or err)
