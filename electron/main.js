const { app, BrowserWindow, ipcMain, Menu, globalShortcut } = require('electron')
const path = require('path')

let mainWindow = null
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    fullscreen: true,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#0f172a',
    icon: path.join(__dirname, '..', 'ui-web', 'public', 'favicon.svg'),
  })

  Menu.setApplicationMenu(null)

  // ── SECUENCIA DE TECLAS PARA HABILITAR WINDOWS / ESCRITORIO ──────────────
  globalShortcut.register('CommandOrControl+Alt+Escape', () => {
    if (mainWindow) {
      mainWindow.minimize()
    }
  })

  globalShortcut.register('CommandOrControl+Shift+F12', () => {
    if (mainWindow) {
      const isFull = mainWindow.isFullScreen()
      mainWindow.setFullScreen(!isFull)
      mainWindow.setMenuBarVisibility(isFull)
    }
  })

  globalShortcut.register('F11', () => {
    if (mainWindow) {
      mainWindow.setFullScreen(!mainWindow.isFullScreen())
    }
  })

  const fs = require('fs')
  
  // URL por defecto: Produccion / Sandbox (Pruebas de Caja)
  let targetUrl = 'http://192.168.0.10:5174/pos'
  
  // 1. Argumento por línea de comando (--url=http://...)
  const argUrl = process.argv.find(arg => arg && arg.startsWith('--url='))
  if (argUrl) {
    targetUrl = argUrl.replace('--url=', '')
  } else if (process.env.POS_SERVER_URL) {
    // 2. Variable de entorno
    targetUrl = process.env.POS_SERVER_URL
  } else {
    // 3. Archivo de configuración pos-config.json junto al .exe
    try {
      const exeDir = path.dirname(app.getPath('exe'))
      const configPaths = [
        path.join(exeDir, 'pos-config.json'),
        path.join(process.cwd(), 'pos-config.json'),
        path.join(__dirname, 'pos-config.json')
      ]
      for (const cp of configPaths) {
        if (fs.existsSync(cp)) {
          const cfg = JSON.parse(fs.readFileSync(cp, 'utf8'))
          if (cfg.serverUrl) {
            targetUrl = cfg.serverUrl
            break
          }
        }
      }
    } catch (err) {
      console.warn('[POS-Electron] Error leyendo pos-config.json:', err)
    }
  }

  console.log(`[POS-Electron] Conectando POS a: ${targetUrl}`)
  mainWindow.loadURL(targetUrl).catch((err) => {
    console.error(`[POS-Electron] Error cargando ${targetUrl}:`, err)
  })

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

// ── IMPRESIÓN TÉRMICA ESTÁNDAR 80MM (SILENCIOSA) ──────────────────────────
ipcMain.handle('pos:print-receipt', async (_event, html) => {
  const printWin = new BrowserWindow({
    show: false,
    width: 302, // 80mm thermal width
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  })

  const fullHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page {
            size: 80mm auto;
            margin: 0;
          }
          @media print {
            body {
              margin: 0;
              padding: 4px;
              width: 72mm;
            }
          }
          body {
            font-family: 'Courier New', Courier, monospace;
            font-size: 11px;
            line-height: 1.2;
            width: 72mm;
            margin: 0 auto;
            color: #000;
          }
          * { box-sizing: border-box; }
        </style>
      </head>
      <body>${html}</body>
    </html>
  `

  await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`)
  
  return new Promise((resolve) => {
    printWin.webContents.print({
      silent: true,
      printBackground: true,
      margins: { marginType: 'none' },
      pageSize: { width: 80000, height: 297000 },
      copies: 1,
    }, (success, errorType) => {
      printWin.close()
      resolve({ success, errorType })
    })
  })
})

// ── LECTURA DE BALANZA BALMAK BCK30 ─────────────────────────────────────────
ipcMain.handle('pos:read-scale-balmak', async (_event, comPort = 'COM1') => {
  return {
    modelo: "Balmak BCK30",
    puerto: comPort,
    baudRate: 9600,
    formato: "STX_PESO_ETX",
    conectado: true,
  }
})

// ── EJECUTAR CALCULADORA DE WINDOWS ────────────────────────────────────────
ipcMain.handle('app:open-calculator', async () => {
  try {
    const { exec } = require('child_process')
    if (process.platform === 'win32') {
      exec('start calc.exe', () => {})
    } else if (process.platform === 'darwin') {
      exec('open -a Calculator', () => {})
    } else {
      exec('gnome-calculator || xcalc || kcalc', () => {})
    }
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
})

// ── MANEJADORES DE VENTANA & SISTEMA ───────────────────────────────────────
ipcMain.handle('app:minimize', () => mainWindow?.minimize())
ipcMain.handle('app:toggle-kiosk', () => {
  if (mainWindow) {
    const isFull = mainWindow.isFullScreen()
    mainWindow.setFullScreen(!isFull)
    return !isFull
  }
  return false
})
ipcMain.handle('app:exit-kiosk', () => {
  if (mainWindow) {
    mainWindow.setFullScreen(false)
    mainWindow.minimize()
  }
  return true
})
ipcMain.handle('app:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.handle('app:close', () => mainWindow?.close())

ipcMain.handle('pos:get-status', async () => {
  return {
    platform: process.platform,
    arch: process.arch,
    electronVersion: process.versions.electron,
    isDev,
    appVersion: app.getVersion(),
    balanzaConfigurada: "Balmak BCK30 (9600 bps)",
    formatoImpresion: "80mm Termal",
    drawerConfigurado: false,
    atajoWindows: "Ctrl+Alt+Escape",
    calculadoraHabilitada: true,
  }
})

app.whenReady().then(createWindow)

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
