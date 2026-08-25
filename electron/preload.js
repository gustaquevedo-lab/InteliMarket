const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  printReceipt: (html) => ipcRenderer.invoke('pos:print-receipt', html),
  readBalmakScale: (port) => ipcRenderer.invoke('pos:read-scale-balmak', port),
  openCalculator: () => ipcRenderer.invoke('app:open-calculator'),
  getStatus: () => ipcRenderer.invoke('pos:get-status'),
  toggleKiosk: () => ipcRenderer.invoke('app:toggle-kiosk'),
  exitKiosk: () => ipcRenderer.invoke('app:exit-kiosk'),
  minimize: () => ipcRenderer.invoke('app:minimize'),
  maximize: () => ipcRenderer.invoke('app:maximize'),
  close: () => ipcRenderer.invoke('app:close'),
  onOnline: (cb) => {
    window.addEventListener('online', cb)
    return () => window.removeEventListener('online', cb)
  },
  onOffline: (cb) => {
    window.addEventListener('offline', cb)
    return () => window.removeEventListener('offline', cb)
  },
})
