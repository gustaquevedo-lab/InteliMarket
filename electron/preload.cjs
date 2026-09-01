const { contextBridge, ipcRenderer } = require('electron')

// ── PUENTE SEGURO DE HARDWARE POS PARA ELECTRON ────────────────────────────
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  
  // Impresión térmica (silenciosa, sin diálogo de Windows)
  printReceipt: (html, paperWidthMm) => ipcRenderer.invoke('pos:print-receipt', html, paperWidthMm),

  // Impresión térmica ESC/POS cruda (bypassea el driver GDI de Windows)
  printEscPos: (escposBase64, printerName) => ipcRenderer.invoke('pos:print-escpos', escposBase64, printerName),
  
  // Balanza Serial / USB (Balmak BCK30 & Toledo Prix)
  readScale: (comPort) => ipcRenderer.invoke('pos:read-scale-balmak', comPort),
  getScalePorts: () => ipcRenderer.invoke('pos:get-scale-ports'),
  startScaleStream: (port, baudRate) => ipcRenderer.invoke('pos:start-scale-stream', port, baudRate),
  stopScaleStream: () => ipcRenderer.invoke('pos:stop-scale-stream'),
  
  // Listener de peso en tiempo real
  onScaleWeight: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('scale:weight-update', handler)
    return () => ipcRenderer.removeListener('scale:weight-update', handler)
  },
  onScaleStatus: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('scale:status', handler)
    return () => ipcRenderer.removeListener('scale:status', handler)
  },
  onScaleLog: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('scale:log', handler)
    return () => ipcRenderer.removeListener('scale:log', handler)
  },
  
  // Terminal POS Bancard (POS Android, API REST oficial via el main process
  // para evitar CORS -- ver pos:bancard-call en main.cjs)
  bancardCall: (ip, path, body, timeoutMs) => ipcRenderer.invoke('pos:bancard-call', { ip, path, body, timeoutMs }),
  dinelcoCall: (ip, tipo, params, sessionId, timeoutMs) => ipcRenderer.invoke('pos:dinelco-call', { ip, tipo, params, sessionId, timeoutMs }),
  dinelcoCancel: (sessionId) => ipcRenderer.invoke('pos:dinelco-cancel', { sessionId }),

  // Calculadora de Windows
  openCalculator: () => ipcRenderer.invoke('app:open-calculator'),
  
  // Control de Pantalla Kiosco
  toggleKiosk: () => ipcRenderer.invoke('app:toggle-kiosk'),
  exitKiosk: () => ipcRenderer.invoke('app:exit-kiosk'),
  minimize: () => ipcRenderer.invoke('app:minimize'),
  maximize: () => ipcRenderer.invoke('app:maximize'),
  close: () => ipcRenderer.invoke('app:close'),
  
  // Estado del hardware
  getStatus: () => ipcRenderer.invoke('pos:get-status'),
})
