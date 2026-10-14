const { app, BrowserWindow, ipcMain, Menu } = require('electron')
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

  removeMenu()

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'ui-web-dist', 'index.html'))
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

function removeMenu() {
  Menu.setApplicationMenu(null)
}

// IPC Handlers — Hardware
ipcMain.handle('pos:print-receipt', async (_event, html) => {
  const { BrowserWindow } = require('electron')
  const printWin = new BrowserWindow({ show: false, width: 300, height: 600 })
  await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  printWin.webContents.print({ silent: true, printBackground: false, copies: 1 })
  printWin.close()
  return { success: true }
})

ipcMain.handle('pos:open-cash-drawer', async () => {
  // Cash drawer is typically connected to thermal printer via RJ11
  // Sends ESC/POS command to kick drawer on printer port
  try {
    const { exec } = require('child_process')
    exec('echo "\\x1B\\x70\\x00\\x19\\xFA" > COM1', () => {})
    exec('echo "\\x1B\\x70\\x00\\x19\\xFA" > COM2', () => {})
    exec('echo "\\x1B\\x70\\x00\\x19\\xFA" > COM3', () => {})
  } catch {}
  return { success: true }
})

ipcMain.handle('pos:print-test', async () => {
  const { BrowserWindow } = require('electron')
  const printWin = new BrowserWindow({ show: false })
  await printWin.loadURL('about:blank')
  printWin.webContents.print({ silent: false })
  printWin.close()
  return { success: true }
})

ipcMain.handle('pos:get-status', async () => {
  return {
    platform: process.platform,
    arch: process.arch,
    electronVersion: process.versions.electron,
    isDev,
    appVersion: app.getVersion(),
  }
})

ipcMain.handle('app:minimize', () => mainWindow?.minimize())
ipcMain.handle('app:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.handle('app:close', () => mainWindow?.close())

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
