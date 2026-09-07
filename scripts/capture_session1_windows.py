import winrm
import base64
import time

s = winrm.Session('192.168.0.13', auth=('Caja 3', 'caja3'), transport='ntlm')

def ps(cmd):
    b64 = base64.b64encode(cmd.encode('utf-16le')).decode('ascii')
    r = s.run_cmd(f'powershell -NoProfile -NonInteractive -EncodedCommand {b64}')
    return r.std_out.decode('cp1252', errors='replace').strip(), r.std_err.decode('cp1252', errors='replace').strip()

# Script que se ejecuta dentro de Session 1 (consola fisica)
script_session1 = """
Add-Type @"
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public class WinInspector {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder strText, int maxCount);

    [DllImport("user32.dll")]
    public static extern int GetWindowTextLength(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    [DllImport("user32.dll")]
    public static extern bool EnumChildWindows(IntPtr hWnd, EnumWindowsProc enumProc, IntPtr lParam);

    public static List<string> GetAllWindows() {
        var list = new List<string>();
        EnumWindows((hWnd, lParam) => {
            if (IsWindowVisible(hWnd)) {
                int len = GetWindowTextLength(hWnd);
                var sb = new StringBuilder(len + 1);
                GetWindowText(hWnd, sb, len + 1);
                uint pid;
                GetWindowThreadProcessId(hWnd, out pid);
                string title = sb.ToString();
                if (!string.IsNullOrEmpty(title)) {
                    list.Add(string.Format("PID: {0} | HWND: {1} | Title: {2}", pid, hWnd, title));
                    
                    EnumChildWindows(hWnd, (cWnd, cParam) => {
                        int cLen = GetWindowTextLength(cWnd);
                        if (cLen > 0) {
                            var cSb = new StringBuilder(cLen + 1);
                            GetWindowText(cWnd, cSb, cLen + 1);
                            list.Add(string.Format("   -> Text: {0}", cSb.ToString()));
                        }
                        return true;
                    }, IntPtr.Zero);
                }
            }
            return true;
        }, IntPtr.Zero);
        return list;
    }
}
"@

$res = [WinInspector]::GetAllWindows()
$res | Out-File -FilePath "C:\\screen_windows.txt" -Encoding UTF8
"""

# Guardar script en C:\inspect.ps1
b64_save = base64.b64encode(script_session1.encode('utf-16le')).decode('ascii')
cmd_setup = f"""
$raw = [System.Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('{b64_save}'))
[System.IO.File]::WriteAllText('C:\\inspect.ps1', $raw, [System.Text.Encoding]::UTF8)

# Ejecutar como tarea interactiva en sesion console
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File C:\\inspect.ps1"
$principal = New-ScheduledTaskPrincipal -UserId "caja 3" -LogonType Interactive
Register-ScheduledTask -TaskName "InspectScreen" -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName "InspectScreen"
Start-Sleep -Seconds 3
Unregister-ScheduledTask -TaskName "InspectScreen" -Confirm:$false | Out-Null

if (Test-Path "C:\\screen_windows.txt") {{
    Get-Content "C:\\screen_windows.txt"
    Remove-Item "C:\\screen_windows.txt" -Force
}} else {{
    "No se genero archivo"
}}
"""

out, err = ps(cmd_setup)
print("=== VENTANAS Y DIALOGOS CAPTURADOS EN LA PANTALLA FISICA ===")
print(out)
if err:
    print("ERRORES:", err)
