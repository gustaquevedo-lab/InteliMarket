import winrm
import json

s = winrm.Session('192.168.0.15', auth=('Caja 5', 'caja5'), transport='ntlm')

def ps(script):
    r = s.run_ps(script)
    out = r.std_out.decode('cp1252', errors='replace').strip()
    return out

# 1. Leer Preferences de Edge para encontrar la homepage y startup URLs
print("=== EDGE PREFERENCES (homepage / startup URLs) ===")
out = ps(r"""
$prefs = "C:\Users\Caja 5\AppData\Local\Microsoft\Edge\User Data\Default\Preferences"
if (Test-Path $prefs) {
    $content = Get-Content $prefs -Raw
    # Buscar session/startup
    $json = $content | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($json) {
        Write-Output "=== session.startup_urls ==="
        $json.session.startup_urls
        Write-Output "=== browser.last_known_google_url ==="
        $json.browser.last_known_google_url
        Write-Output "=== extensions home_page ==="
        $json.extensions.last_chrome_version
        Write-Output "=== homepage ==="
        $json.homepage
    }
}
""")
print(out)

# 2. Buscar en Preferences el string 5174 o 8001
print("\n=== BUSCAR '5174' EN PREFERENCES DE EDGE ===")
out2 = ps(r"""
$prefs = "C:\Users\Caja 5\AppData\Local\Microsoft\Edge\User Data\Default\Preferences"
if (Test-Path $prefs) {
    $content = Get-Content $prefs -Raw
    $idx = $content.IndexOf('5174')
    if ($idx -gt 0) {
        Write-Output ("Context: " + $content.Substring([Math]::Max(0, $idx-200), 500))
    } else {
        Write-Output "5174 NO encontrado en Preferences"
    }
    $idx2 = $content.IndexOf('8001')
    if ($idx2 -gt 0) {
        Write-Output ("8001 Context: " + $content.Substring([Math]::Max(0, $idx2-200), 500))
    } else {
        Write-Output "8001 NO encontrado en Preferences"
    }
    $idx3 = $content.IndexOf('superextra')
    if ($idx3 -gt 0) {
        Write-Output ("superextra Context: " + $content.Substring([Math]::Max(0, $idx3-100), 300))
    }
}
""")
print(out2[:3000])

# 3. Encontrar Bookmarks en Edge
print("\n=== BOOKMARKS DE EDGE ===")
out3 = ps(r"""
$bookmarks = "C:\Users\Caja 5\AppData\Local\Microsoft\Edge\User Data\Default\Bookmarks"
if (Test-Path $bookmarks) {
    $content = Get-Content $bookmarks -Raw
    $json = $content | ConvertFrom-Json
    function Get-Bookmarks($node) {
        if ($node.type -eq 'url') {
            Write-Output ($node.name + " => " + $node.url)
        }
        if ($node.children) {
            $node.children | ForEach-Object { Get-Bookmarks $_ }
        }
    }
    Get-Bookmarks $json.roots.bookmark_bar
    Get-Bookmarks $json.roots.other
}
""")
print(out3)
