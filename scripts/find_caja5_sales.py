import winrm, base64

s5 = winrm.Session('192.168.0.15', auth=('Caja 5', 'caja5'), transport='ntlm')

def run_ps(cmd):
    b64 = base64.b64encode(cmd.encode('utf-16le')).decode('ascii')
    r = s5.run_cmd(f'powershell -NoProfile -NonInteractive -EncodedCommand {b64}')
    return r.std_out.decode('cp1252', errors='replace').strip()

ps_find = r'''
Get-ChildItem -Path "C:\Users" -Directory | ForEach-Object {
    $u = $_.FullName
    Get-ChildItem -Path "$u\AppData\Roaming" -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*inteli*" -or $_.Name -like "*pos*" }
} | Select-Object -ExpandProperty FullName
'''

app_dirs = run_ps(ps_find)
print("APP DIRS:\n", app_dirs)

ps = r'''
$files = @(
    "C:\Users\Caja 5\AppData\Roaming\intelimarket-web\IndexedDB\http_192.168.0.10_5173.indexeddb.blob\1\27\27db",
    "C:\Users\Caja 5\AppData\Roaming\intelimarket-web\IndexedDB\http_192.168.0.10_5173.indexeddb.blob\1\27\27dd"
)

foreach ($f in $files) {
    Write-Output "========================================"
    Write-Output "FILE: $f"
    $bytes = [System.IO.File]::ReadAllBytes($f)
    $s_utf8 = [System.Text.Encoding]::UTF8.GetString($bytes)
    $idx = $s_utf8.IndexOf("recibo_html")
    if ($idx -ge 0) {
        # find '<' followed by '\0'
        for ($i = $idx; $i -lt $bytes.Length - 10; $i++) {
            if ($bytes[$i] -eq 60 -and $bytes[$i+1] -eq 0) {
                # UTF-16 LE starts here!
                $html_bytes = New-Object byte[] ($bytes.Length - $i)
                [Array]::Copy($bytes, $i, $html_bytes, 0, $bytes.Length - $i)
                $html = [System.Text.Encoding]::Unicode.GetString($html_bytes)
                # find end of ticket
                $end_idx = $html.IndexOf("</div")
                # find all lines
                $clean = $html -replace '<[^>]+>', "`n" -replace '&nbsp;', ' '
                $clean_lines = $clean -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_.Length -gt 0 }
                $clean_lines | ForEach-Object { Write-Output $_ }
                break
            }
        }
    }
}
'''
print(run_ps(ps))
