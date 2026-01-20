import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import os from 'node:os'
import electronUpdater from 'electron-updater'
import * as sshService from './ssh-service.js'
import { NetworkManager } from './services/NetworkManager.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.join(__dirname, '..')
const { autoUpdater } = electronUpdater

// 自动更新配置
autoUpdater.autoDownload = false // 不自动下载，让用户确认
autoUpdater.autoInstallOnAppQuit = true // 退出时自动安装

let mainWindow = null
let networkManager = null

/**
 * 打开SSH连接
 * @param {string} hostName - SSH主机别名
 */
async function openSSHConnection(hostName) {
  const platform = os.platform()
  
  try {
    if (platform === 'win32') {
      // Windows系统
      try {
        // 首先尝试Windows Terminal
        const child = spawn('wt', ['ssh', hostName], { 
          detached: true,
          stdio: 'ignore'
        })
        child.unref()
        console.log(`Opened SSH connection to ${hostName} using Windows Terminal`)
      } catch (error) {
        // 如果Windows Terminal不可用，使用cmd
        const child = spawn('cmd', ['/c', 'start', 'cmd', '/k', `ssh ${hostName}`], {
          detached: true,
          stdio: 'ignore'
        })
        child.unref()
        console.log(`Opened SSH connection to ${hostName} using CMD`)
      }
    } else if (platform === 'darwin') {
      // macOS系统
      const child = spawn('osascript', [
        '-e', 
        `tell application "Terminal" to do script "ssh ${hostName}"`
      ], {
        detached: true,
        stdio: 'ignore'
      })
      child.unref()
      console.log(`Opened SSH connection to ${hostName} using Terminal.app`)
    } else {
      // Linux系统
      // 尝试常见的终端应用
      const terminals = [
        { cmd: 'gnome-terminal', args: ['--', 'ssh', hostName] },
        { cmd: 'konsole', args: ['-e', 'ssh', hostName] },
        { cmd: 'xterm', args: ['-e', `ssh ${hostName}`] },
        { cmd: 'x-terminal-emulator', args: ['-e', `ssh ${hostName}`] }
      ]
      
      let success = false
      for (const terminal of terminals) {
        try {
          const child = spawn(terminal.cmd, terminal.args, {
            detached: true,
            stdio: 'ignore'
          })
          child.unref()
          console.log(`Opened SSH connection to ${hostName} using ${terminal.cmd}`)
          success = true
          break
        } catch (error) {
          continue
        }
      }
      
      if (!success) {
        throw new Error('No suitable terminal application found')
      }
    }
    
    return { success: true, message: `SSH connection opened for ${hostName}` }
  } catch (error) {
    console.error('Failed to open SSH connection:', error)
    throw new Error(`Failed to open SSH connection: ${error.message}`)
  }
}

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
    // 初始窗口尺寸
    width: 800,
    height: 600,
    
    // 最小窗口尺寸限制
    minWidth: 450,
    minHeight: 600,
    
    // 其他窗口配置
    autoHideMenuBar: true, // Hide the menu bar (File, Edit, etc.)
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      unsafeEval: true,
      sandbox: false, // Disable sandbox to ensure preload works reliably with local resources if needed
    },
    // 设置图标
    icon: path.join(__dirname, 'assets/icon.jpeg'),
    
    // 窗口显示配置
    show: false, // 初始不显示，等加载完成后再显示
    center: true, // 窗口居中显示
    
    // 可选：设置最大尺寸限制（如果需要的话）
    // maxWidth: 1920,
    // maxHeight: 1080,
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

  // 窗口加载完成后显示，避免白屏闪烁
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    
    // 开发模式下可以设置窗口焦点
    if (isDev) {
      mainWindow.focus()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  // Initialize network manager
  networkManager = new NetworkManager()
  try {
    await networkManager.initialize()
    
    // 如果分享功能已启用，恢复之前分享的节点
    const networkStatus = networkManager.getNetworkStatus()
    if (networkStatus.sharingEnabled) {
      try {
        const allNodes = await sshService.getAll()
        await networkManager.restoreSharedNodes(allNodes)
        console.log('Shared nodes restored successfully')
      } catch (error) {
        console.error('Failed to restore shared nodes:', error)
      }
    }
  } catch (error) {
    console.error('Failed to initialize network manager:', error)
  }

  // Register IPC handlers for SSH
  ipcMain.handle('ssh:get-all', () => sshService.getAll())
  ipcMain.handle('ssh:save-host', (_, data) => sshService.saveHost(data))
  ipcMain.handle('ssh:delete-host', (_, host) => sshService.deleteHost(host))
  ipcMain.handle('ssh:reorder-hosts', (_, hostNames) => sshService.reorderHosts(hostNames))
  ipcMain.handle('ssh:copy-host', (_, hostName) => sshService.copyHost(hostName))
  ipcMain.handle('ssh:connect', async (_, hostName) => {
    try {
      return await openSSHConnection(hostName)
    } catch (error) {
      console.error('Failed to open SSH connection:', error)
      throw error
    }
  })

  // Register IPC handlers for network sharing
  ipcMain.handle('network:get-status', async () => {
    try {
      return await networkManager.getNetworkStatus()
    } catch (error) {
      console.error('Failed to get network status:', error)
      throw error
    }
  })
  ipcMain.handle('network:enable-sharing', async () => {
    try {
      return await networkManager.enableSharing()
    } catch (error) {
      console.error('Failed to enable sharing:', error)
      throw error
    }
  })
  ipcMain.handle('network:disable-sharing', async () => {
    try {
      return await networkManager.disableSharing()
    } catch (error) {
      console.error('Failed to disable sharing:', error)
      throw error
    }
  })
  ipcMain.handle('network:share-node', async (_, nodeId, nodeData) => {
    try {
      console.log('IPC: Sharing node:', nodeId, nodeData)
      return await networkManager.shareNode(nodeId, nodeData)
    } catch (error) {
      console.error('Failed to share node:', error)
      throw error
    }
  })
  ipcMain.handle('network:unshare-node', async (_, nodeId) => {
    try {
      return await networkManager.unshareNode(nodeId)
    } catch (error) {
      console.error('Failed to unshare node:', error)
      throw error
    }
  })
  ipcMain.handle('network:is-node-shared', async (_, nodeId) => {
    try {
      return networkManager.isNodeShared(nodeId)
    } catch (error) {
      console.error('Failed to check node share status:', error)
      throw error
    }
  })
  ipcMain.handle('network:get-shared-nodes', async () => {
    try {
      return networkManager.getSharedNodes()
    } catch (error) {
      console.error('Failed to get shared nodes:', error)
      throw error
    }
  })
  ipcMain.handle('network:get-shared-nodes-config', async () => {
    try {
      return networkManager.getSharedNodesConfig()
    } catch (error) {
      console.error('Failed to get shared nodes config:', error)
      throw error
    }
  })
  ipcMain.handle('network:get-discovered-peers', async () => {
    try {
      return networkManager.getDiscoveredPeers()
    } catch (error) {
      console.error('Failed to get discovered peers:', error)
      throw error
    }
  })
  ipcMain.handle('network:fetch-remote-nodes', async (_, peerInfo) => {
    try {
      return await networkManager.fetchRemoteNodes(peerInfo)
    } catch (error) {
      console.error('Failed to fetch remote nodes:', error)
      throw error
    }
  })
  ipcMain.handle('network:import-remote-node', async (_, peerInfo, nodeId) => {
    try {
      return await networkManager.importRemoteNode(peerInfo, nodeId, sshService)
    } catch (error) {
      console.error('Failed to import remote node:', error)
      throw error
    }
  })
  ipcMain.handle('network:refresh-discovery', async () => {
    try {
      return networkManager.refreshDiscovery()
    } catch (error) {
      console.error('Failed to refresh discovery:', error)
      throw error
    }
  })
  ipcMain.handle('network:restore-shared-nodes', async () => {
    try {
      const allNodes = await sshService.getAll()
      return await networkManager.restoreSharedNodes(allNodes)
    } catch (error) {
      console.error('Failed to restore shared nodes:', error)
      throw error
    }
  })

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

  // Setup network event forwarding to renderer
  if (networkManager) {
    networkManager.on('peer-discovered', (peer) => {
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('network:peer-discovered', peer)
      }
    })

    networkManager.on('peer-offline', (peer) => {
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('network:peer-offline', peer)
      }
    })

    networkManager.on('node-shared', (data) => {
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('network:node-shared', data)
      }
    })

    networkManager.on('node-unshared', (data) => {
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('network:node-unshared', data)
      }
    })

    networkManager.on('node-imported', (data) => {
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('network:node-imported', data)
      }
    })

    networkManager.on('sharing-enabled', async () => {
      if (mainWindow && mainWindow.webContents) {
        // 恢复分享节点
        try {
          const allNodes = await sshService.getAll()
          await networkManager.restoreSharedNodes(allNodes)
          console.log('Shared nodes restored after enabling sharing')
        } catch (error) {
          console.error('Failed to restore shared nodes after enabling:', error)
        }
        
        mainWindow.webContents.send('network:sharing-enabled')
      }
    })

    networkManager.on('sharing-disabled', () => {
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('network:sharing-disabled')
      }
    })
  }

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

app.on('window-all-closed', async () => {
  // Cleanup network manager
  if (networkManager) {
    await networkManager.cleanup()
  }
  
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
