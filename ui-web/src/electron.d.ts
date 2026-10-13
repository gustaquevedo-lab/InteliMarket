export interface ElectronAPI {
  printReceipt: (html: string) => Promise<{ success: boolean; errorType?: string }>
  readBalmakScale: (port?: string) => Promise<{ modelo: string; puerto: string; baudRate: number; formato: string; conectado: boolean }>
  openCalculator: () => Promise<{ success: boolean; error?: string }>
  getStatus: () => Promise<{
    platform: string
    arch: string
    electronVersion: string
    isDev: boolean
    appVersion: string
    balanzaConfigurada: string
    formatoImpresion: string
    drawerConfigurado: boolean
    atajoWindows: string
    calculadoraHabilitada: boolean
  }>
  toggleKiosk: () => Promise<boolean>
  exitKiosk: () => Promise<boolean>
  minimize: () => Promise<void>
  maximize: () => Promise<void>
  close: () => Promise<void>
  onOnline: (cb: () => void) => () => void
  onOffline: (cb: () => void) => () => void
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
