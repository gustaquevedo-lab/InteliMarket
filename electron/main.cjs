const { app, BrowserWindow, ipcMain, Menu, globalShortcut } = require('electron')
const path = require('path')
const fs = require('fs')
const { spawn, exec } = require('child_process')

let mainWindow = null
let scaleProcess = null
let currentScalePort = null
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

function createWindow() {
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
    // Si hay puertos, seleccionar automáticamente el primer puerto USB / Serial encontrado
    event.preventDefault()
    if (portList && portList.length > 0) {
      console.log('[POS-Scale] Chromium detectó puertos USB:', portList.map(p => `${p.portName} (${p.displayName || p.portId})`))
      callback(portList[0].portId)
    } else {
      callback('')
    }
  })

  mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission) => {
    return true
  })

  mainWindow.webContents.session.setDevicePermissionHandler((details) => {
    return true
  })

  Menu.setApplicationMenu(null)

  // ── ATAJOS DE TECLADO PARA ADMINISTRADORES ───────────────────────────────
  // Ctrl + Alt + Escape minimiza la caja para salir a Windows
  globalShortcut.register('CommandOrControl+Alt+Escape', () => {
    if (mainWindow) {
      mainWindow.setKiosk(false)
      mainWindow.setFullScreen(false)
      mainWindow.minimize()
    }
  })

  // F11 para alternar modo Kiosco
  globalShortcut.register('F11', () => {
    if (mainWindow) {
      const isKiosk = mainWindow.isKiosk()
      mainWindow.setKiosk(!isKiosk)
      mainWindow.setFullScreen(!isKiosk)
    }
  })

  // F12 o Ctrl+Shift+I para abrir consola
  globalShortcut.register('F12', () => {
    if (mainWindow) mainWindow.webContents.toggleDevTools()
  })
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    if (mainWindow) mainWindow.webContents.toggleDevTools()
  })

  // F5 o Ctrl+R para recargar
  globalShortcut.register('F5', () => {
    if (mainWindow) mainWindow.webContents.reload()
  })
  globalShortcut.register('CommandOrControl+R', () => {
    if (mainWindow) mainWindow.webContents.reload()
  })

  // ── DETERMINAR URL DESTINO (SANDBOX POR DEFECTO) ──────────────────────────
  let targetUrl = 'http://192.168.0.242:5174/pos'

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
        </div>
      </body>
      </html>
    `
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`)
  })

  // ── FORZAR LIMPIEZA DE CACHÉ Y SERVICE WORKERS AL ARRANCAR ───────────────
  try {
    mainWindow.webContents.session.clearCache()
    mainWindow.webContents.session.clearStorageData({
      storages: ['serviceworkers', 'cachestorage', 'websql']
    })
  } catch (e) {}

  // Cargar URL con cabeceras no-cache y arrancar auto-monitoreo de balanza
  mainWindow.loadURL(targetUrl, { extraHeaders: 'pragma: no-cache\ncache-control: no-cache\n' })
  mainWindow.webContents.on('did-finish-load', () => {
    startScaleAutoDiscovery()
  })

  mainWindow.on('closed', () => {
    stopScaleReader()
    mainWindow = null
  })
}

// ── MOTOR INDUSTRIAL DE COMUNICACIÓN CON BALANZA (WINDOWS COM / USB) ───────
function getWindowsComPorts() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve(['COM1', 'COM2', 'COM3', 'COM4'])
      return
    }
    exec('powershell -NoProfile -Command "Add-Type -AssemblyName System.IO.Ports; [System.IO.Ports.SerialPort]::GetPortNames()"', (err, stdout) => {
      if (err || !stdout) {
        resolve(['COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8'])
        return
      }
      const ports = stdout.split(/\r?\n/).map(p => p.trim()).filter(p => p.startsWith('COM'))
      resolve(ports.length > 0 ? ports : ['COM1', 'COM2', 'COM3', 'COM4'])
    })
  })
}

function startScaleReader(port = 'COM1', baudRate = 9600) {
  stopScaleReader()
  currentScalePort = port

  console.log(`[POS-Scale] Iniciando lector multi-puerto Balmak con sondeo ENQ a ${baudRate} bps (prioridad: ${port})...`)

  if (process.platform !== 'win32') {
    return { success: true, port, platform: process.platform }
  }

  // Script PowerShell optimizado para Balmak, Toledo, Filizola, CAS y Torrey
  const psScript = `
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    try { Add-Type -AssemblyName System.IO.Ports -ErrorAction SilentlyContinue } catch {}
    try { [System.Reflection.Assembly]::LoadWithPartialName("System.IO.Ports") | Out-Null } catch {}

    $targetPort = "${port}"
    $ports = @()
    try { $ports = [System.IO.Ports.SerialPort]::GetPortNames() } catch {}
    if ($targetPort -and -not ($ports -contains $targetPort)) {
      $ports = @($targetPort) + $ports
    }
    if (-not $ports -or $ports.Count -eq 0) {
      $ports = @("COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9", "COM10")
    }

    $openPorts = @()
    foreach ($p in $ports) {
      try {
        $sp = New-Object System.IO.Ports.SerialPort $p, ${baudRate}, [System.IO.Ports.Parity]::None, 8, [System.IO.Ports.StopBits]::One
        $sp.ReadTimeout = 100
        $sp.WriteTimeout = 100
        $sp.DtrEnable = $true
        $sp.RtsEnable = $true
        $sp.Open()
        $openPorts += $sp
        Write-Output ("CONNECTED:" + $p)
      } catch {}
    }

    $buffers = @{}
    $enq = [byte[]]@(0x05)
    $pCmd = [byte[]]@(0x50, 0x0D)
    $wCmd = [byte[]]@(0x57, 0x0D)
    $cycle = 0

    while ($true) {
      $cycle++
      $hasData = $false

      foreach ($sp in $openPorts) {
        if ($sp.IsOpen) {
          # Sondeo periódico cada ~300ms para balanzas a demanda
          if ($cycle % 6 -eq 0) {
            try { $sp.Write($enq, 0, 1) } catch {}
            try { $sp.Write($pCmd, 0, 2) } catch {}
            try { $sp.Write($wCmd, 0, 2) } catch {}
          }

          try {
            $chunk = $sp.ReadExisting()
            if ($chunk -and $chunk.Length -gt 0) {
              $hasData = $true
              $pName = $sp.PortName
              
              $cleanChunk = $chunk -replace '[\\r\\n]', ''
              if ($cleanChunk.Length -gt 0) {
                Write-Output ("RX:" + $pName + ":" + $cleanChunk)
              }

              if (-not $buffers.ContainsKey($pName)) { $buffers[$pName] = "" }
              $buffers[$pName] += $chunk
              $b = $buffers[$pName]

              # 1. Formato decimal explícito (ej: 0.455, 00.455, 1.250, 0,455)
              if ($b -match "([0-9]{1,3}[.,][0-9]{2,3})") {
                $w = $matches[1] -replace ',', '.'
                Write-Output ("RAW:" + $pName + ":" + $w)
                $buffers[$pName] = ""
              }
              # 2. Formato Balmak / Toledo 5 dígitos (ej: 00455 -> 0.455 kg)
              elseif ($b -match "([0-9]{5})") {
                $val = [double]$matches[1] / 1000.0
                if ($val -le 40.0) {
                  $w = $val.ToString("0.000", [System.Globalization.CultureInfo]::InvariantCulture)
                  Write-Output ("RAW:" + $pName + ":" + $w)
                  $buffers[$pName] = ""
                }
              }
              # 3. Formato 4 dígitos (ej: 0455 -> 0.455 kg)
              elseif ($b -match "([0-9]{4})") {
                $val = [double]$matches[1] / 1000.0
                if ($val -le 10.0) {
                  $w = $val.ToString("0.000", [System.Globalization.CultureInfo]::InvariantCulture)
                  Write-Output ("RAW:" + $pName + ":" + $w)
                  $buffers[$pName] = ""
                }
              }
              elseif ($buffers[$pName].Length -gt 80) {
                $buffers[$pName] = ""
              }
            }
          } catch {}
        }
      }

      Start-Sleep -Milliseconds 50
    }
  `

  scaleProcess = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript])
  if (mainWindow) {
    mainWindow.webContents.send('scale:log', `Iniciando motor de lectura serie a ${baudRate} bps...`)
  }

  scaleProcess.stdout.on('data', (data) => {
    const text = data.toString()
    const lines = text.split(/\r?\n/)
    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line) continue

      if (mainWindow) {
        mainWindow.webContents.send('scale:log', line)
      }

      if (line.startsWith('CONNECTED:')) {
        const p = line.substring(10)
        console.log(`[POS-Scale] Puerto detectado y escuchando: ${p}`)
        if (mainWindow) {
          mainWindow.webContents.send('scale:status', { connected: true, port: p })
        }
      } else if (line.startsWith('RAW:')) {
        const parts = line.substring(4).split(':')
        const activePort = parts.length > 1 ? parts[0] : port
        const rawWeight = parts.length > 1 ? parts[1] : parts[0]
        const weight = parseFloat(rawWeight)
        if (!isNaN(weight) && weight >= 0) {
          if (mainWindow) {
            mainWindow.webContents.send('scale:weight-update', {
              weight,
              isStable: true,
              port: activePort,
              raw: rawWeight,
              timestamp: Date.now()
            })
          }
        }
      }
    }
  })

  scaleProcess.stderr.on('data', (err) => {
    const errText = err.toString().trim()
    console.error(`[POS-Scale] Error proceso serial:`, errText)
    if (mainWindow && errText) {
      mainWindow.webContents.send('scale:log', `ERROR: ${errText.substring(0, 100)}`)
    }
  })

  scaleProcess.on('exit', () => {
    if (mainWindow) {
      mainWindow.webContents.send('scale:log', `Proceso de lectura finalizado.`)
    }
    scaleProcess = null
  })

  return { success: true, port }
}

function stopScaleReader() {
  if (scaleProcess) {
    try {
      scaleProcess.kill()
    } catch (e) {}
    scaleProcess = null
  }
}

async function startScaleAutoDiscovery() {
  const ports = await getWindowsComPorts()
  console.log('[POS-Scale] Puertos COM disponibles en el equipo:', ports)
  if (ports.length > 0) {
    startScaleReader(ports[0], 9600)
  }
}

// ── IPC HANDLERS PARA COMUNICACIÓN CON EL FRONTEND ─────────────────────────
ipcMain.handle('pos:get-scale-ports', async () => {
  return await getWindowsComPorts()
})

ipcMain.handle('pos:start-scale-stream', async (_event, port = 'COM1', baudRate = 9600) => {
  return startScaleReader(port, baudRate)
})

ipcMain.handle('pos:stop-scale-stream', async () => {
  stopScaleReader()
  return { success: true }
})

ipcMain.handle('pos:read-scale-balmak', async (_event, comPort = 'COM1') => {
  startScaleReader(comPort, 9600)
  return {
    modelo: "Balmak BCK30",
    puerto: comPort,
    baudRate: 9600,
    formato: "STX_PESO_ETX",
    conectado: true,
  }
})

// ── IMPRESIÓN TÉRMICA ESTÁNDAR 80MM (SILENCIOSA, SIN TRUNCAMIENTO A LA DERECHA) ─
ipcMain.handle('pos:print-receipt', async (_event, html) => {
  const printWin = new BrowserWindow({
    show: false,
    width: 280,
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
            size: 72mm auto;
            margin: 0mm !important;
          }
          @media print {
            html, body {
              margin: 0mm !important;
              padding: 0mm !important;
              width: 70mm !important;
              max-width: 70mm !important;
              box-sizing: border-box !important;
            }
          }
          html, body {
            font-family: 'Consolas', 'Segoe UI', 'Courier New', monospace;
            font-size: 10.5px;
            font-weight: 500;
            line-height: 1.22;
            width: 70mm;
            max-width: 70mm;
            margin: 0 auto !important;
            padding: 0 !important;
            color: #000;
            background: #fff;
            box-sizing: border-box;
          }
          * {
            box-sizing: border-box !important;
          }
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
      margins: {
        marginType: 'none'
      },
      pageSize: { width: 72000, height: 297000 },
      copies: 1,
    }, (success, errorType) => {
      printWin.close()
      resolve({ success, errorType })
    })
  })
})

// ── EJECUTAR CALCULADORA DE WINDOWS ────────────────────────────────────────
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

// ── MANEJADORES DE VENTANA & SISTEMA ───────────────────────────────────────
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

ipcMain.handle('pos:get-status', async () => {
  return {
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

app.whenReady().then(createWindow)

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
