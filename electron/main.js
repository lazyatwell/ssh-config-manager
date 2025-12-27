import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as sshService from './ssh-service.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.join(__dirname, '..')

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    autoHideMenuBar: true, // Hide the menu bar (File, Edit, etc.)
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      unsafeEval: true,
      sandbox: false, // Disable sandbox to ensure preload works reliably with local resources if needed
    },
  })

  // Determine if we are in development mode based on the presence of the dev server
  // Using a simple check or environment variable is common. 
  // Here we assume if we can fetch local dev server, we use it, otherwise file.
  // But simpler: we rely on process.env or arguments.
  // Since we use `concurrently "vite" "electron ."` we might not have NODE_ENV set to dev explicitly by electron command unless we pass it.
  // But vite runs on 5173.
  
  // A common pattern for electron-vite setups:
  const isDev = process.env.npm_lifecycle_event === 'dev'
  
  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(PROJECT_ROOT, 'dist', 'index.html'))
  }
}

app.whenReady().then(() => {
  // Register IPC handlers
  ipcMain.handle('ssh:get-all', () => sshService.getAll())
  ipcMain.handle('ssh:save-host', (_, data) => sshService.saveHost(data))
  ipcMain.handle('ssh:delete-host', (_, host) => sshService.deleteHost(host))
  ipcMain.handle('ssh:reorder-hosts', (_, hostNames) => sshService.reorderHosts(hostNames))
  
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
