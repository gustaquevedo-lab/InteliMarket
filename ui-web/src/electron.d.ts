export interface ElectronAPI {
  printReceipt: (html: string) => Promise<{ success: boolean }>
  openCashDrawer: () => Promise<{ success: boolean }>
  printTest: () => Promise<{ success: boolean }>
  getStatus: () => Promise<{ platform: string; arch: string; electronVersion: string; isDev: boolean; appVersion: string }>
  minimize: () => Promise<void>
  maximize: () => Promise<void>
  close: () => Promise<void>
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
