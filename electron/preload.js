import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('sshApi', {
  getAll: () => ipcRenderer.invoke('ssh:get-all'),
  saveHost: (hostData) => ipcRenderer.invoke('ssh:save-host', hostData),
  deleteHost: (host) => ipcRenderer.invoke('ssh:delete-host', host),
  reorderHosts: (hostNames) => ipcRenderer.invoke('ssh:reorder-hosts', hostNames),
  copyHost: (hostName) => ipcRenderer.invoke('ssh:copy-host', hostName),
})
