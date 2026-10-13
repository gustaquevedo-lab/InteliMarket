import winrm
import base64

s = winrm.Session('192.168.0.13', auth=('Caja 3', 'caja3'), transport='ntlm')

def ps(cmd):
    b64 = base64.b64encode(cmd.encode('utf-16le')).decode('ascii')
    r = s.run_cmd(f'powershell -NoProfile -NonInteractive -EncodedCommand {b64}')
    out = r.std_out.decode('cp1252', errors='replace').strip()
    err = r.std_err.decode('cp1252', errors='replace').strip()
    return out, err

ps_script = """
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
                    
                    // Enum child windows (buttons, static text labels, etc)
                    EnumChildWindows(hWnd, (cWnd, cParam) => {
                        int cLen = GetWindowTextLength(cWnd);
                        if (cLen > 0) {
                            var cSb = new StringBuilder(cLen + 1);
                            GetWindowText(cWnd, cSb, cLen + 1);
                            list.Add(string.Format("   -> Child: {0}", cSb.ToString()));
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

[WinInspector]::GetAllWindows() | Out-String
"""

out, err = ps(ps_script)
print("=== TODAS LAS VENTANAS Y DIALOGOS EN PANTALLA EN CAJA 3 ===")
print(out)
if err:
    print("ERRORES:", err)
