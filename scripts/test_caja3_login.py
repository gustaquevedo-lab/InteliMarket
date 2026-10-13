import winrm

s = winrm.Session('192.168.0.13', auth=('Caja 3', 'caja3'), transport='ntlm')

def ps(cmd):
    encoded_cmd = f"powershell -NoProfile -NonInteractive -Command \"{cmd}\""
    r = s.run_cmd(encoded_cmd)
    return r.std_out.decode('cp1252', errors='replace').strip(), r.std_err.decode('cp1252', errors='replace').strip()

print("=== TEST LOGIN DESDE CAJA 3 CON EVELIN ===")
cmd = "$body = @{ email = 'evelin.herrero@intelimarket.com.py'; password = 'Extra8055*' } | ConvertTo-Json; try { $res = Invoke-RestMethod -Uri 'http://192.168.0.10:8000/v1/auth/login' -Method Post -Body $body -ContentType 'application/json'; Write-Output ('LOGIN EXITOSO! Token: ' + $res.access_token.Substring(0, 30)) } catch { Write-Output ('ERROR: ' + $_.Exception.Message) }"
out, err = ps(cmd)
print(out or err)

print("=== TEST LOGIN DESDE CAJA 3 CON EVELINH ===")
cmd2 = "$body = @{ email = 'evelinh'; password = 'Extra8055*' } | ConvertTo-Json; try { $res = Invoke-RestMethod -Uri 'http://192.168.0.10:8000/v1/auth/login' -Method Post -Body $body -ContentType 'application/json'; Write-Output ('LOGIN EXITOSO! Token: ' + $res.access_token.Substring(0, 30)) } catch { Write-Output ('ERROR: ' + $_.Exception.Message) }"
out2, err2 = ps(cmd2)
print(out2 or err2)

print("=== TEST LOGIN DESDE CAJA 3 CON EVELYN ===")
cmd3 = "$body = @{ email = 'evelyn'; password = 'Extra8055*' } | ConvertTo-Json; try { $res = Invoke-RestMethod -Uri 'http://192.168.0.10:8000/v1/auth/login' -Method Post -Body $body -ContentType 'application/json'; Write-Output ('LOGIN EXITOSO! Token: ' + $res.access_token.Substring(0, 30)) } catch { Write-Output ('ERROR: ' + $_.Exception.Message) }"
out3, err3 = ps(cmd3)
print(out3 or err3)
