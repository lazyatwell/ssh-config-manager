import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('sshApi', {
  getAll: () => ipcRenderer.invoke('ssh:get-all'),
  saveHost: (hostData) => ipcRenderer.invoke('ssh:save-host', hostData),
  deleteHost: (host) => ipcRenderer.invoke('ssh:delete-host', host),
  reorderHosts: (hostNames) => ipcRenderer.invoke('ssh:reorder-hosts', hostNames),
  copyHost: (hostName) => ipcRenderer.invoke('ssh:copy-host', hostName),
  connect: (hostName) => ipcRenderer.invoke('ssh:connect', hostName),
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
  // 监听更新状态，返回取消订阅函数
  onUpdateStatus: (callback) => {
    const listener = (_, data) => callback(data)
    ipcRenderer.on('update-status', listener)
    // 返回取消订阅函数，只移除当前监听器
    return () => {
      ipcRenderer.removeListener('update-status', listener)
    }
  }
})

contextBridge.exposeInMainWorld('networkApi', {
  // 获取网络状态
  getStatus: () => ipcRenderer.invoke('network:get-status'),
  // 启用/禁用分享功能
  enableSharing: () => ipcRenderer.invoke('network:enable-sharing'),
  disableSharing: () => ipcRenderer.invoke('network:disable-sharing'),
  // 节点分享管理
  shareNode: (nodeId, nodeData) => ipcRenderer.invoke('network:share-node', nodeId, nodeData),
  unshareNode: (nodeId) => ipcRenderer.invoke('network:unshare-node', nodeId),
  isNodeShared: (nodeId) => ipcRenderer.invoke('network:is-node-shared', nodeId),
  getSharedNodes: () => ipcRenderer.invoke('network:get-shared-nodes'),
  getSharedNodesConfig: () => ipcRenderer.invoke('network:get-shared-nodes-config'),
  // 设备发现
  getDiscoveredPeers: () => ipcRenderer.invoke('network:get-discovered-peers'),
  refreshDiscovery: () => ipcRenderer.invoke('network:refresh-discovery'),
  restoreSharedNodes: () => ipcRenderer.invoke('network:restore-shared-nodes'),
  // 远程节点操作
  fetchRemoteNodes: (peerInfo) => ipcRenderer.invoke('network:fetch-remote-nodes', peerInfo),
  importRemoteNode: (peerInfo, nodeId) => ipcRenderer.invoke('network:import-remote-node', peerInfo, nodeId),
  // 事件监听
  onPeerDiscovered: (callback) => {
    const listener = (_, data) => callback(data)
    ipcRenderer.on('network:peer-discovered', listener)
    return () => ipcRenderer.removeListener('network:peer-discovered', listener)
  },
  onPeerOffline: (callback) => {
    const listener = (_, data) => callback(data)
    ipcRenderer.on('network:peer-offline', listener)
    return () => ipcRenderer.removeListener('network:peer-offline', listener)
  },
  onNodeShared: (callback) => {
    const listener = (_, data) => callback(data)
    ipcRenderer.on('network:node-shared', listener)
    return () => ipcRenderer.removeListener('network:node-shared', listener)
  },
  onNodeUnshared: (callback) => {
    const listener = (_, data) => callback(data)
    ipcRenderer.on('network:node-unshared', listener)
    return () => ipcRenderer.removeListener('network:node-unshared', listener)
  },
  onNodeImported: (callback) => {
    const listener = (_, data) => callback(data)
    ipcRenderer.on('network:node-imported', listener)
    return () => ipcRenderer.removeListener('network:node-imported', listener)
  },
  onSharingEnabled: (callback) => {
    const listener = (_, data) => callback(data)
    ipcRenderer.on('network:sharing-enabled', listener)
    return () => ipcRenderer.removeListener('network:sharing-enabled', listener)
  }
})
