const { contextBridge, ipcRenderer } = require('electron')

// ── PUENTE SEGURO DE HARDWARE POS PARA ELECTRON ────────────────────────────
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  
  // Impresión térmica 80mm
  printReceipt: (html) => ipcRenderer.invoke('pos:print-receipt', html),
  
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
