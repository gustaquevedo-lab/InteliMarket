const { app, BrowserWindow, ipcMain, Menu, globalShortcut } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const { spawn, exec } = require('child_process')
const http = require('http')
const crypto = require('crypto')
const readline = require('readline')

const {
  SCALE_BRIDGE_SHA256,
  SCALE_BRIDGE_B64,
  PRINT_BRIDGE_SHA256,
  PRINT_BRIDGE_B64
} = require('./bridges-b64.cjs')
const { dinelcoCall: dinelcoTcpCall, cancelarSesion: dinelcoCancelarSesion } = require('./dinelco-client.cjs')

let mainWindow = null
let currentScalePort = null
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

async function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.cjs')

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 900,
    kiosk: true,          // Modo Kiosco nativo POS (pantalla completa real)
    fullscreen: true,
    frame: false,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: fs.existsSync(preloadPath) ? preloadPath : undefined,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
      allowRunningInsecureContent: true,
      enableBlinkFeatures: 'Serial',
    },
    icon: path.join(__dirname, '..', 'ui-web', 'public', 'favicon.svg'),
  })

  // ── HABILITAR ACCESO NATIVO A PUERTOS SERIAL / USB PARA BALANZAS ─────────
  mainWindow.webContents.session.on('select-serial-port', (event, portList, webContents, callback) => {
    event.preventDefault()
    if (portList && portList.length > 0) {
      console.log('[POS-Scale] Chromium detectó puertos USB:', portList.map(p => `${p.portName} (${p.displayName || p.portId})`))
      callback(portList[0].portId)
    } else {
      callback('')
    }
  })

  mainWindow.webContents.session.setPermissionCheckHandler(() => true)
  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(true))
  mainWindow.webContents.session.setDevicePermissionHandler(() => true)

  Menu.setApplicationMenu(null)

  // ── ATAJOS DE TECLADO PARA ADMINISTRADORES ───────────────────────────────
  globalShortcut.register('CommandOrControl+Alt+Escape', () => {
    if (mainWindow) {
      mainWindow.setKiosk(false)
      mainWindow.setFullScreen(false)
      mainWindow.minimize()
    }
  })

  globalShortcut.register('F11', () => {
    if (mainWindow) {
      const isKiosk = mainWindow.isKiosk()
      mainWindow.setKiosk(!isKiosk)
      mainWindow.setFullScreen(!isKiosk)
    }
  })

  globalShortcut.register('F12', () => {
    if (mainWindow) mainWindow.webContents.toggleDevTools()
  })
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    if (mainWindow) mainWindow.webContents.toggleDevTools()
  })

  globalShortcut.register('F5', () => {
    if (mainWindow) mainWindow.webContents.reload()
  })
  globalShortcut.register('CommandOrControl+R', () => {
    if (mainWindow) mainWindow.webContents.reload()
  })

  // ── DETERMINAR URL DESTINO (SANDBOX POR DEFECTO) ──────────────────────────
  let targetUrl = 'http://192.168.0.10:5174/pos'

  const argUrl = process.argv.find(arg => arg && arg.startsWith('--url='))
  if (argUrl) {
    targetUrl = argUrl.replace('--url=', '')
  } else if (process.env.POS_SERVER_URL) {
    targetUrl = process.env.POS_SERVER_URL
  } else {
    try {
      const exeDir = path.dirname(app.getPath('exe'))
      const configPaths = [
        path.join(exeDir, 'pos-config.json'),
        path.join(process.cwd(), 'pos-config.json'),
        path.join(__dirname, 'pos-config.json'),
        path.join(app.getAppPath(), 'pos-config.json')
      ]
      for (const cp of configPaths) {
        if (fs.existsSync(cp)) {
          const raw = fs.readFileSync(cp, 'utf8').replace(/^\uFEFF/, '')
          const cfg = JSON.parse(raw)
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

  // Manejador de error si la URL remota no carga
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[POS-Electron] Error al cargar ${validatedURL}: ${errorDescription} (${errorCode})`)
    
    const errorHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>InteliMarket POS · Conexión</title>
        <style>
          body { background: #0f172a; color: white; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #1e293b; padding: 40px; border-radius: 24px; text-align: center; max-width: 520px; border: 1px solid #334155; }
          h1 { color: #38bdf8; font-size: 22px; margin-top: 0; }
          p { color: #94a3b8; font-size: 14px; margin-bottom: 24px; }
          .url-box { background: #0f172a; color: #f59e0b; padding: 8px 12px; border-radius: 10px; font-family: monospace; margin-bottom: 20px; }
          button { background: #2563eb; color: white; border: none; padding: 12px 24px; border-radius: 12px; font-weight: bold; cursor: pointer; font-size: 14px; }
          button:hover { background: #1d4ed8; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Conectando al Servidor de Caja...</h1>
          <div class="url-box">${validatedURL}</div>
          <p>No se pudo conectar con el servidor central.<br>Verifique que la red local esté conectada.</p>
          <button onclick="location.href='${validatedURL}'">Reintentar Conexión (F5)</button>
          <p id="autoRetryMsg" style="font-size:12px;color:#64748b;margin-top:16px;margin-bottom:0;">Reintentando automáticamente en <span id="autoRetryCount">5</span>s...</p>
        </div>
        <script>
          let secs = 5;
          const el = document.getElementById('autoRetryCount');
          setInterval(() => {
            secs -= 1;
            if (el) el.textContent = String(Math.max(secs, 0));
            if (secs <= 0) location.href = '${validatedURL}';
          }, 1000);
        </script>
      </body>
      </html>
    `
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`)
  })

  // ── LIMPIEZA ASÍNCRONA DE SERVICE WORKERS Y CACHÉ HTTP (PRESERVANDO INDEXEDDB Y LOCALSTORAGE) ──
  try {
    await mainWindow.webContents.session.clearCache()
    await mainWindow.webContents.session.clearStorageData({
      storages: ['serviceworkers', 'cachestorage', 'websql']
    })
  } catch (e) {}

  mainWindow.loadURL(targetUrl, { extraHeaders: 'pragma: no-cache\ncache-control: no-cache\n' })
  mainWindow.webContents.on('did-finish-load', () => {
    startScaleAutoDiscovery()
  })

  // ── REGISTRO DE LOGS CON ROTACIÓN AUTOMÁTICA (MÁXIMO 3 MB) ───────────────
  try {
    const consoleLogPath = path.join(app.getPath('userData'), 'pos-console.log')
    mainWindow.webContents.on('console-message', (_event, level, message) => {
      try {
        const ts = new Date().toISOString()
        const levelName = ['LOG', 'WARN', 'ERROR', 'DEBUG'][level] || level
        if (fs.existsSync(consoleLogPath)) {
          const stats = fs.statSync(consoleLogPath)
          if (stats.size > 3 * 1024 * 1024) {
            const oldPath = path.join(app.getPath('userData'), 'pos-console.log.old')
            try { if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath) } catch (_) {}
            try { fs.renameSync(consoleLogPath, oldPath) } catch (_) {}
          }
        }
        fs.appendFileSync(consoleLogPath, `[${ts}] [${levelName}] ${message}\n`)
      } catch (_) {}
    })
  } catch (e) {}

  // ── RECUPERACIÓN AUTOMÁTICA ANTE CAÍDAS DE RENDERIZADOR ──────────────────
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error(`[POS-Electron] Render process gone: ${details.reason} (exitCode ${details.exitCode})`)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadURL(targetUrl, { extraHeaders: 'pragma: no-cache\ncache-control: no-cache\n' })
    }
  })

  mainWindow.on('unresponsive', () => {
    console.error('[POS-Electron] Ventana no responde -- forzando recarga en 10s si sigue colgada.')
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.reload()
      }
    }, 10000)
  })

  mainWindow.on('closed', () => {
    stopScaleReader()
    mainWindow = null
  })
}

process.on('uncaughtException', (err) => {
  console.error('[POS-Electron] uncaughtException:', err)
})
process.on('unhandledRejection', (reason) => {
  console.error('[POS-Electron] unhandledRejection:', reason)
})

// ── GESTOR DE BINARIOS DEL BRIDGE ──────────────────────────────────────────
let scaleProcess = null
let scaleStdinWritable = null
let scaleIntentionalStop = false
let scaleRespawnTimer = null
let scaleRespawnAttempts = 0
let scaleLastPort = 'COM3'
let scaleLastBaud = 9600
let scaleWatchdogTimer = null

function scaleBridgeExePath() {
  return path.join(app.getPath('userData'), 'scale-bridge.exe')
}

function sha256File(filePath) {
  try {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
  } catch (e) {
    return null
  }
}

function ensureScaleBridgeBinary() {
  const exePath = scaleBridgeExePath()
  if (sha256File(exePath) === SCALE_BRIDGE_SHA256) {
    return exePath
  }
  try {
    fs.mkdirSync(path.dirname(exePath), { recursive: true })
    fs.writeFileSync(exePath, Buffer.from(SCALE_BRIDGE_B64, 'base64'))
    if (mainWindow) mainWindow.webContents.send('scale:log', 'scale-bridge.exe restaurado automaticamente (faltaba o no coincidia)')
    return exePath
  } catch (err) {
    // Fallback a directorio temporal si userData tiene bloqueo de permisos
    try {
      const fallbackPath = path.join(app.getPath('temp'), 'scale-bridge.exe')
      fs.writeFileSync(fallbackPath, Buffer.from(SCALE_BRIDGE_B64, 'base64'))
      return fallbackPath
    } catch (err2) {
      if (mainWindow) mainWindow.webContents.send('scale:log', `ERROR: no se pudo escribir scale-bridge.exe: ${err.message}`)
      return null
    }
  }
}

function printBridgeExePath() {
  return path.join(app.getPath('userData'), 'print-bridge.exe')
}

function ensurePrintBridgeBinary() {
  const exePath = printBridgeExePath()
  if (sha256File(exePath) === PRINT_BRIDGE_SHA256) {
    return exePath
  }
  try {
    fs.mkdirSync(path.dirname(exePath), { recursive: true })
    fs.writeFileSync(exePath, Buffer.from(PRINT_BRIDGE_B64, 'base64'))
    return exePath
  } catch (err) {
    try {
      const fallbackPath = path.join(app.getPath('temp'), 'print-bridge.exe')
      fs.writeFileSync(fallbackPath, Buffer.from(PRINT_BRIDGE_B64, 'base64'))
      return fallbackPath
    } catch (err2) {
      return null
    }
  }
}

function killOrphanScaleBridge(cb) {
  if (process.platform !== 'win32') return cb()
  exec('taskkill /IM scale-bridge.exe /F', () => cb())
}

function getWindowsComPorts() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve(['COM1', 'COM2', 'COM3', 'COM4'])
      return
    }
    const exePath = ensureScaleBridgeBinary()
    if (!exePath) {
      resolve(['COM1', 'COM2', 'COM3', 'COM4'])
      return
    }

    let isResolved = false
    const fallbackPorts = ['COM1', 'COM2', 'COM3', 'COM4']

    // Timeout de escape: 3.5 segundos maximo si el driver serial de Windows se cuelga
    const timeoutTimer = setTimeout(() => {
      if (!isResolved) {
        isResolved = true
        try { proc.kill() } catch (_) {}
        resolve(fallbackPorts)
      }
    }, 3500)

    const proc = spawn(exePath, ['list'], { windowsHide: true })
    let out = ''
    proc.stdout.on('data', (d) => { out += d.toString() })
    proc.on('close', () => {
      if (isResolved) return
      isResolved = true
      clearTimeout(timeoutTimer)
      try {
        const line = out.trim().split(/\r?\n/).pop()
        const evt = JSON.parse(line)
        if (evt.type === 'ports' && Array.isArray(evt.ports) && evt.ports.length > 0) {
          resolve(evt.ports)
          return
        }
      } catch (e) {}
      resolve(fallbackPorts)
    })
    proc.on('error', () => {
      if (isResolved) return
      isResolved = true
      clearTimeout(timeoutTimer)
      resolve(fallbackPorts)
    })
  })
}

function scheduleRespawn() {
  if (scaleIntentionalStop) return
  if (scaleRespawnTimer) return
  scaleRespawnAttempts++
  const delay = Math.min(30000, 1000 * Math.pow(2, Math.min(scaleRespawnAttempts - 1, 5)))
  if (mainWindow) mainWindow.webContents.send('scale:log', `Bridge de balanza caido, reintentando en ${Math.round(delay / 1000)}s (intento ${scaleRespawnAttempts})...`)
  scaleRespawnTimer = setTimeout(() => {
    scaleRespawnTimer = null
    startScaleReader(scaleLastPort, scaleLastBaud)
  }, delay)
}

function startScaleReader(port = 'COM3', baudRate = 9600) {
  scaleLastPort = port
  scaleLastBaud = baudRate
  currentScalePort = port
  scaleIntentionalStop = false

  if (process.platform !== 'win32') {
    return { success: true, port, platform: process.platform }
  }

  if (scaleProcess && scaleStdinWritable && !scaleProcess.killed) {
    try {
      scaleStdinWritable.write(`RECONFIGURE ${port} ${baudRate}\n`)
      return { success: true, port }
    } catch (e) {}
  }

  const exePath = ensureScaleBridgeBinary()
  if (!exePath) {
    if (mainWindow) mainWindow.webContents.send('scale:log', 'ERROR: no se pudo preparar scale-bridge.exe')
    return { success: false, port }
  }

  killOrphanScaleBridge(() => {
    scaleProcess = spawn(exePath, [port, String(baudRate)], { windowsHide: true })
    scaleStdinWritable = scaleProcess.stdin

    if (mainWindow) mainWindow.webContents.send('scale:log', `Bridge de balanza iniciado (${port} @ ${baudRate}bps)...`)

    const rl = readline.createInterface({ input: scaleProcess.stdout })
    rl.on('line', (line) => {
      let evt
      try {
        evt = JSON.parse(line)
      } catch (e) {
        return
      }
      switch (evt.type) {
        case 'status':
          if (evt.connected) scaleRespawnAttempts = 0
          if (mainWindow) mainWindow.webContents.send('scale:status', { connected: !!evt.connected, port: evt.port })
          break
        case 'weight':
          if (mainWindow) {
            mainWindow.webContents.send('scale:weight-update', {
              weight: evt.weight_kg,
              isStable: !!evt.stable,
              port: evt.port,
              raw: evt.raw,
              timestamp: Date.now(),
            })
          }
          break
        case 'log':
          if (mainWindow) mainWindow.webContents.send('scale:log', evt.message)
          break
        case 'error':
          if (mainWindow) mainWindow.webContents.send('scale:log', `ERROR: ${evt.message}`)
          break
      }
    })

    scaleProcess.stderr.on('data', (d) => {
      const text = d.toString().trim()
      if (text && mainWindow) mainWindow.webContents.send('scale:log', `ERROR: ${text.substring(0, 200)}`)
    })

    scaleProcess.on('exit', () => {
      scaleProcess = null
      scaleStdinWritable = null
      if (mainWindow) mainWindow.webContents.send('scale:status', { connected: false, port: scaleLastPort })
      scheduleRespawn()
    })

    scaleProcess.on('error', (err) => {
      if (mainWindow) mainWindow.webContents.send('scale:log', `ERROR: no se pudo lanzar scale-bridge.exe: ${err.message}`)
    })
  })

  return { success: true, port }
}

function stopScaleReader() {
  scaleIntentionalStop = true
  if (scaleRespawnTimer) {
    clearTimeout(scaleRespawnTimer)
    scaleRespawnTimer = null
  }
  if (scaleWatchdogTimer) {
    clearInterval(scaleWatchdogTimer)
    scaleWatchdogTimer = null
  }
  if (scaleProcess) {
    try {
      if (scaleStdinWritable) scaleStdinWritable.write('STOP\n')
      else scaleProcess.kill()
    } catch (e) {
      try { scaleProcess.kill() } catch (e2) {}
    }
    scaleProcess = null
    scaleStdinWritable = null
  }
}

async function startScaleAutoDiscovery() {
  const ports = await getWindowsComPorts()
  console.log('[POS-Scale] Puertos COM disponibles en el equipo:', ports)
  const preferred = ports.includes('COM3') ? 'COM3' : (ports[0] || 'COM3')
  startScaleReader(preferred, 9600)

  if (scaleWatchdogTimer) clearInterval(scaleWatchdogTimer)
  scaleWatchdogTimer = setInterval(() => {
    if (!scaleIntentionalStop && !scaleProcess && !scaleRespawnTimer) {
      startScaleReader(scaleLastPort, scaleLastBaud)
    }
  }, 20000)
}

// ── IPC HANDLERS DE BALANZA ─────────────────────────────────────────────────
ipcMain.handle('pos:get-scale-ports', async () => {
  return await getWindowsComPorts()
})

ipcMain.handle('pos:start-scale-stream', async (_event, port = 'COM3', baudRate = 9600) => {
  return startScaleReader(port, baudRate)
})

ipcMain.handle('pos:stop-scale-stream', async () => {
  stopScaleReader()
  return { success: true }
})

ipcMain.handle('pos:read-scale-balmak', async (_event, comPort = 'COM3') => {
  startScaleReader(comPort, 9600)
  return {
    modelo: "Balmak BCK30",
    puerto: comPort,
    baudRate: 9600,
    formato: "STX_PESO_ETX",
    conectado: true,
  }
})

// ── IMPRESIÓN TÉRMICA ESTÁNDAR 80MM (SILENCIOSA, CON TIMEOUT DE SEGURIDAD 8S) ─
ipcMain.handle('pos:print-receipt', async (_event, html, paperWidthMm) => {
  const printWin = new BrowserWindow({
    show: false,
    width: 280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  })

  const pageWidthMm = Number(paperWidthMm) > 0 ? Number(paperWidthMm) : 80
  const contentWidthMm = pageWidthMm - 8

  const fullHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page {
            size: ${pageWidthMm}mm auto;
            margin: 0mm !important;
          }
          @media print {
            html, body {
              margin: 0mm !important;
              padding: 0mm !important;
              width: ${pageWidthMm}mm !important;
              max-width: ${pageWidthMm}mm !important;
              box-sizing: border-box !important;
            }
          }
          html, body {
            font-family: 'Consolas', 'Segoe UI', 'Courier New', monospace;
            font-size: 10.5px;
            font-weight: 500;
            line-height: 1.22;
            width: ${pageWidthMm}mm;
            max-width: ${pageWidthMm}mm;
            margin: 0 auto !important;
            padding: 0 !important;
            color: #000;
            background: #fff;
            box-sizing: border-box;
          }
          .receipt-content {
            width: ${contentWidthMm}mm;
            max-width: ${contentWidthMm}mm;
            margin: 0 auto;
          }
          * {
            box-sizing: border-box !important;
          }
        </style>
      </head>
      <body><div class="receipt-content">${html}</div></body>
    </html>
  `

  await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`)

  return new Promise((resolve) => {
    let finished = false
    const safetyTimeout = setTimeout(() => {
      if (!finished) {
        finished = true
        try { printWin.destroy() } catch (_) {}
        resolve({ success: false, errorType: 'print_spooler_timeout' })
      }
    }, 8000)

    printWin.webContents.print({
      silent: true,
      printBackground: true,
      margins: {
        marginType: 'none'
      },
      pageSize: { width: pageWidthMm * 1000, height: 297000 },
      copies: 1,
    }, (success, errorType) => {
      if (!finished) {
        finished = true
        clearTimeout(safetyTimeout)
        try { printWin.close() } catch (_) {}
        resolve({ success, errorType })
      }
    })
  })
})

// ── IMPRESIÓN TÉRMICA ESC/POS CRUDA (DIRECTO A WINSPOOL) ───────────────────
ipcMain.handle('pos:print-escpos', async (_event, escposBase64, printerName) => {
  if (process.platform !== 'win32') {
    return { success: true, platform: process.platform }
  }

  const exePath = ensurePrintBridgeBinary()
  if (!exePath) {
    return { success: false, error: 'no se pudo preparar print-bridge.exe' }
  }

  const printer = printerName || 'ZKP8008'
  const bytes = Buffer.from(escposBase64, 'base64')

  return new Promise((resolve) => {
    let finished = false
    const timeout = setTimeout(() => {
      if (!finished) {
        finished = true
        try { proc.kill() } catch (_) {}
        resolve({ success: false, error: 'print_bridge_timeout' })
      }
    }, 8000)

    const proc = spawn(exePath, [printer], { windowsHide: true })
    let stderrOut = ''
    proc.stderr.on('data', (d) => { stderrOut += d.toString() })
    proc.on('error', (err) => {
      if (!finished) {
        finished = true
        clearTimeout(timeout)
        resolve({ success: false, error: err.message })
      }
    })
    proc.on('close', (code) => {
      if (!finished) {
        finished = true
        clearTimeout(timeout)
        resolve({ success: code === 0, error: code === 0 ? null : (stderrOut || `print-bridge salio con codigo ${code}`) })
      }
    })
    proc.stdin.write(bytes)
    proc.stdin.end()
  })
})

// ── CALCULADORA ────────────────────────────────────────────────────────────
ipcMain.handle('app:open-calculator', async () => {
  try {
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

// ── VENTANA Y SISTEMA ──────────────────────────────────────────────────────
ipcMain.handle('app:minimize', () => mainWindow?.minimize())
ipcMain.handle('app:toggle-kiosk', () => {
  if (mainWindow) {
    const isKiosk = mainWindow.isKiosk()
    mainWindow.setKiosk(!isKiosk)
    mainWindow.setFullScreen(!isKiosk)
    return !isKiosk
  }
  return false
})
ipcMain.handle('app:exit-kiosk', () => {
  if (mainWindow) {
    mainWindow.setKiosk(false)
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

// ── PUENTE HTTP HACIA TERMINAL BANCARD (CON TIMEOUT SEGURO 45S) ────────────
ipcMain.handle('pos:bancard-call', async (_event, { ip, path: reqPath, body, timeoutMs }) => {
  const payload = JSON.stringify(body || {})
  const effectiveTimeout = timeoutMs || 45000

  return new Promise((resolve) => {
    const req = http.request({
      hostname: ip,
      port: 3000,
      path: reqPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: effectiveTimeout,
    }, (res) => {
      let raw = ''
      res.on('data', (chunk) => { raw += chunk })
      res.on('end', () => {
        let parsed = null
        try { parsed = JSON.parse(raw) } catch (e) { parsed = null }
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, body: parsed })
      })
    })
    req.on('timeout', () => {
      req.destroy()
      resolve({ ok: false, status: null, message: 'timeout' })
    })
    req.on('error', (err) => {
      resolve({ ok: false, status: null, message: err.code || err.message || 'connection_error' })
    })
    req.write(payload)
    req.end()
  })
})

// -- PUENTE TCP CRUDO HACIA TERMINAL DINELCO (protocolo pipe-delimited, puerto 9600) --
ipcMain.handle('pos:dinelco-call', async (_event, { ip, tipo, params, sessionId, timeoutMs }) => {
  try {
    const resultado = await dinelcoTcpCall({ ip, tipo, params, sessionId, timeoutMs })
    return resultado
  } catch (err) {
    return { ok: false, error: err.message || 'error_desconocido' }
  }
})

ipcMain.handle('pos:dinelco-cancel', async (_event, { sessionId }) => {
  try {
    return await dinelcoCancelarSesion(sessionId)
  } catch (err) {
    return { ok: false, error: err.message || 'error_desconocido' }
  }
})

ipcMain.handle('pos:get-status', async () => {
  return {
    hostname: os.hostname(),
    platform: process.platform,
    arch: process.arch,
    electronVersion: process.versions.electron,
    isDev,
    appVersion: app.getVersion(),
    balanzaConfigurada: "Balmak BCK30 (9600 bps)",
    formatoImpresion: "80mm Termal",
    puertoBalanzaActual: currentScalePort,
    drawerConfigurado: false,
    atajoWindows: "Ctrl+Alt+Escape",
    calculadoraHabilitada: true,
  }
})

// ── CONTROL DE INSTANCIA ÚNICA ─────────────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
  app.whenReady().then(createWindow)
}

app.on('will-quit', () => {
  stopScaleReader()
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
