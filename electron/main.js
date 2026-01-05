import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import electronUpdater from 'electron-updater'
import * as sshService from './ssh-service.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.join(__dirname, '..')
const { autoUpdater } = electronUpdater

// 自动更新配置
autoUpdater.autoDownload = false // 不自动下载，让用户确认
autoUpdater.autoInstallOnAppQuit = true // 退出时自动安装

let mainWindow = null

// 发送更新状态到渲染进程
function sendUpdateStatus(status, data = {}) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('update-status', { status, ...data })
  }
}

// 设置自动更新事件监听
function setupAutoUpdater() {
  // 检查更新出错
  autoUpdater.on('error', (error) => {
    sendUpdateStatus('error', { message: error.message })
  })

  // 检查更新中
  autoUpdater.on('checking-for-update', () => {
    sendUpdateStatus('checking')
  })

  // 有可用更新
  autoUpdater.on('update-available', (info) => {
    sendUpdateStatus('available', { 
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes
    })
  })

  // 没有可用更新
  autoUpdater.on('update-not-available', (info) => {
    sendUpdateStatus('not-available', { version: info.version })
  })

  // 下载进度
  autoUpdater.on('download-progress', (progress) => {
    sendUpdateStatus('downloading', {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond
    })
  })

  // 下载完成
  autoUpdater.on('update-downloaded', (info) => {
    sendUpdateStatus('downloaded', { version: info.version })
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
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
    // 设置图标
    icon: path.join(__dirname, 'assets/icon.jpeg') 
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
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(PROJECT_ROOT, 'dist', 'index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  // Register IPC handlers for SSH
  ipcMain.handle('ssh:get-all', () => sshService.getAll())
  ipcMain.handle('ssh:save-host', (_, data) => sshService.saveHost(data))
  ipcMain.handle('ssh:delete-host', (_, host) => sshService.deleteHost(host))
  ipcMain.handle('ssh:reorder-hosts', (_, hostNames) => sshService.reorderHosts(hostNames))
  ipcMain.handle('ssh:copy-host', (_, hostName) => sshService.copyHost(hostName))

  // Register IPC handlers for auto-update
  ipcMain.handle('updater:check', () => {
    return autoUpdater.checkForUpdates()
  })
  ipcMain.handle('updater:download', () => {
    return autoUpdater.downloadUpdate()
  })
  ipcMain.handle('updater:install', () => {
    autoUpdater.quitAndInstall(false, true)
  })
  ipcMain.handle('updater:get-version', () => {
    return app.getVersion()
  })
  
  // 设置自动更新
  setupAutoUpdater()
  
  createWindow()

  // 非开发环境下，启动后自动检查更新
  const isDev = process.env.npm_lifecycle_event === 'dev'
  if (!isDev) {
    // 延迟 3 秒检查更新，避免影响启动体验
    setTimeout(() => {
      autoUpdater.checkForUpdates()
    }, 3000)
  }

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
