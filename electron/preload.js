import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('sshApi', {
  getAll: () => ipcRenderer.invoke('ssh:get-all'),
  saveHost: (hostData) => ipcRenderer.invoke('ssh:save-host', hostData),
  deleteHost: (host) => ipcRenderer.invoke('ssh:delete-host', host),
  reorderHosts: (hostNames) => ipcRenderer.invoke('ssh:reorder-hosts', hostNames),
  copyHost: (hostName) => ipcRenderer.invoke('ssh:copy-host', hostName),
})

contextBridge.exposeInMainWorld('updaterApi', {
  // 检查更新
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  // 下载更新
  downloadUpdate: () => ipcRenderer.invoke('updater:download'),
  // 安装更新并重启
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  // 获取当前版本
  getVersion: () => ipcRenderer.invoke('updater:get-version'),
  // 监听更新状态
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (_, data) => callback(data))
  },
  // 移除更新状态监听
  removeUpdateStatusListener: () => {
    ipcRenderer.removeAllListeners('update-status')
  }
})