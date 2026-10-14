const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  printReceipt: (html) => ipcRenderer.invoke('pos:print-receipt', html),
  openCashDrawer: () => ipcRenderer.invoke('pos:open-cash-drawer'),
  printTest: () => ipcRenderer.invoke('pos:print-test'),
  getStatus: () => ipcRenderer.invoke('pos:get-status'),
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
