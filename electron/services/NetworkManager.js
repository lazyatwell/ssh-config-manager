import { ShareService } from './ShareService.js'
import { DiscoveryService } from './DiscoveryService.js'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import http from 'node:http'

/**
 * 网络管理器
 * 统一管理分享服务和发现服务
 */
export class NetworkManager {
  constructor() {
    this.shareService = new ShareService()
    this.discoveryService = new DiscoveryService()
    this.isInitialized = false
    this.configPath = path.join(os.homedir(), '.ssh/.ssh-config-share.json')
    this.config = null
    this.eventListeners = {}
  }

  /**
   * 初始化网络服务
   */
  async initialize() {
    if (this.isInitialized) {
      console.log('NetworkManager is already initialized')
      return
    }

    try {
      // 确保ShareService的deviceInfo已初始化
      if (!this.shareService.deviceInfo) {
        console.error('ShareService deviceInfo not initialized')
        throw new Error('ShareService not properly initialized')
      }

      // 加载配置
      await this.loadConfig()
      
      // 设置事件监听
      this.setupEventListeners()
      
      // 如果配置启用了分享功能，则启动服务
      if (this.config.enabled) {
        await this.startServices()
      }

      this.isInitialized = true
      console.log('NetworkManager initialized successfully')
    } catch (error) {
      console.error('Failed to initialize NetworkManager:', error)
      throw error
    }
  }

  /**
   * 启动网络服务
   */
  async startServices() {
    try {
      // 启动分享服务
      await this.shareService.start()
      
      // 启动发现服务
      const deviceInfo = this.shareService.getDeviceInfo()
      await this.discoveryService.start(deviceInfo, this.shareService.port)
      
      console.log('Network services started')
      this.emit('services-started')
    } catch (error) {
      console.error('Failed to start network services:', error)
      throw error
    }
  }

  /**
   * 停止网络服务
   */
  async stopServices() {
    try {
      await this.discoveryService.stop()
      await this.shareService.stop()
      
      console.log('Network services stopped')
      this.emit('services-stopped')
    } catch (error) {
      console.error('Failed to stop network services:', error)
      throw error
    }
  }

  /**
   * 恢复分享的节点
   * @param {Array} allNodes - 所有SSH节点数据
   */
  async restoreSharedNodes(allNodes = null) {
    try {
      // 如果没有传入节点数据，则无法恢复
      if (!allNodes) {
        console.log('No SSH nodes provided for restoration')
        return
      }

      let restoredCount = 0
      
      // 遍历配置中的分享节点
      for (const [nodeId, nodeConfig] of Object.entries(this.config.sharedNodes)) {
        if (nodeConfig.enabled) {
          // 查找对应的SSH节点数据
          const sshNode = allNodes.find(node => node.Host === nodeId)
          if (sshNode) {
            // 恢复到ShareService中
            this.shareService.shareNode(nodeId, sshNode)
            restoredCount++
            console.log(`Restored shared node: ${nodeId}`)
          } else {
            console.warn(`SSH node not found for shared node: ${nodeId}`)
          }
        }
      }
      
      console.log(`Restored ${restoredCount} shared nodes`)
    } catch (error) {
      console.error('Failed to restore shared nodes:', error)
    }
  }

  /**
   * 启用分享功能
   * 启用时会恢复之前配置的分享节点
   */
  async enableSharing() {
    if (!this.config.enabled) {
      this.config.enabled = true
      await this.saveConfig()
    }

    if (!this.shareService.isEnabled) {
      await this.startServices()
      
      // 启用分享功能时，恢复之前配置的分享节点
      this.emit('sharing-enabled')
    }
  }

  /**
   * 禁用分享功能
   * 注意：只关闭网络服务，不影响分享节点的配置状态
   */
  async disableSharing() {
    if (this.config.enabled) {
      this.config.enabled = false
      await this.saveConfig()
    }

    if (this.shareService.isEnabled) {
      await this.stopServices()
    }
    
    // 注意：不发送sharing-disabled事件，因为节点状态不变
    console.log('Network sharing disabled, but shared nodes configuration preserved')
  }

  /**
   * 分享节点
   */
  async shareNode(nodeId, nodeData) {
    try {
      // 确保网络服务已启动
      if (!this.shareService.isEnabled) {
        console.log('Starting network services for sharing...')
        await this.startServices()
      }

      // 更新配置
      if (!this.config.sharedNodes[nodeId]) {
        this.config.sharedNodes[nodeId] = {}
      }
      this.config.sharedNodes[nodeId].enabled = true
      this.config.sharedNodes[nodeId].sharedAt = Date.now()
      await this.saveConfig()

      // 添加到分享服务
      this.shareService.shareNode(nodeId, nodeData)
      
      this.emit('node-shared', { nodeId, nodeData })
      
      console.log(`Node shared successfully: ${nodeId}`)
    } catch (error) {
      console.error(`Failed to share node ${nodeId}:`, error)
      throw error
    }
  }

  /**
   * 取消分享节点
   */
  async unshareNode(nodeId) {
    try {
      // 更新配置
      if (this.config.sharedNodes[nodeId]) {
        this.config.sharedNodes[nodeId].enabled = false
        await this.saveConfig()
      }

      // 从分享服务移除
      this.shareService.unshareNode(nodeId)
      
      this.emit('node-unshared', { nodeId })
      
      console.log(`Node unshared successfully: ${nodeId}`)
    } catch (error) {
      console.error(`Failed to unshare node ${nodeId}:`, error)
      throw error
    }
  }

  /**
   * 获取节点分享状态
   * 注意：这里只检查节点本身的分享状态，不受全局分享开关影响
   */
  isNodeShared(nodeId) {
    return this.config.sharedNodes[nodeId]?.enabled || false
  }

  /**
   * 获取所有分享的节点配置状态
   * 注意：返回所有配置为分享的节点，不受全局分享开关影响
   */
  getSharedNodesConfig() {
    const sharedNodes = []
    for (const [nodeId, nodeConfig] of Object.entries(this.config.sharedNodes)) {
      if (nodeConfig.enabled) {
        sharedNodes.push({
          id: nodeId,
          enabled: nodeConfig.enabled,
          sharedAt: nodeConfig.sharedAt
        })
      }
    }
    return sharedNodes
  }

  

  /**
   * 获取所有分享的节点
   */
  getSharedNodes() {
    return this.shareService.getSharedNodes()
  }

  /**
   * 获取发现的设备
   */
  getDiscoveredPeers() {
    return this.discoveryService.getDiscoveredPeers()
  }

  /**
   * 从远程设备获取节点列表
   */
  async fetchRemoteNodes(peerInfo) {
    try {
      const data = await this.makeHttpRequest(peerInfo.ip, peerInfo.port, '/api/nodes')
      if (data.success) {
        return data.data.nodes || []
      } else {
        throw new Error(data.error?.message || 'Unknown error')
      }
    } catch (error) {
      console.error(`Failed to fetch nodes from ${peerInfo.ip}:`, error)
      throw error
    }
  }

  /**
   * 导入远程节点
   */
  async importRemoteNode(peerInfo, nodeId, sshService) {
    try {
      // 获取节点详情
      const data = await this.makeHttpRequest(peerInfo.ip, peerInfo.port, `/api/node/${nodeId}`)
      if (!data.success) {
        throw new Error(data.error?.message || 'Unknown error')
      }

      const remoteNode = data.data
      
      // 处理节点名称冲突
      const localNodes = await sshService.getAll()
      let finalHostName = remoteNode.Host
      let counter = 1
      
      while (localNodes.some(node => node.Host === finalHostName)) {
        finalHostName = `${remoteNode.Host}-${counter}`
        counter++
      }

      // 准备导入数据
      const importData = {
        Host: finalHostName,
        HostName: remoteNode.HostName,
        User: remoteNode.User,
        Port: remoteNode.Port,
        Remark: remoteNode.Remark ? `${remoteNode.Remark} (来自 ${peerInfo.deviceName})` : `来自 ${peerInfo.deviceName}`
      }

      // 导入到本地
      await sshService.saveHost(importData)
      
      this.emit('node-imported', { 
        originalNode: remoteNode, 
        importedNode: importData, 
        source: peerInfo 
      })

      return importData
    } catch (error) {
      console.error(`Failed to import node ${nodeId} from ${peerInfo.ip}:`, error)
      throw error
    }
  }

  /**
   * 发起HTTP请求
   */
  async makeHttpRequest(ip, port, path) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: ip,
        port: port,
        path: path,
        method: 'GET',
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json'
        }
      }

      const req = http.request(options, (res) => {
        let data = ''
        
        res.on('data', (chunk) => {
          data += chunk
        })
        
        res.on('end', () => {
          try {
            const jsonData = JSON.parse(data)
            resolve(jsonData)
          } catch (error) {
            reject(new Error('Invalid JSON response'))
          }
        })
      })

      req.on('error', (error) => {
        reject(error)
      })

      req.on('timeout', () => {
        req.destroy()
        reject(new Error('Request timeout'))
      })

      req.end()
    })
  }

  /**
   * 刷新网络发现
   */
  refreshDiscovery() {
    this.discoveryService.refresh()
  }

  /**
   * 获取网络状态
   */
  getNetworkStatus() {
    return {
      isInitialized: this.isInitialized,
      sharingEnabled: this.config?.enabled || false,
      shareService: {
        isEnabled: this.shareService.isEnabled,
        port: this.shareService.port,
        sharedCount: this.shareService.getSharedCount()
      },
      discoveryService: this.discoveryService.getStatus(),
      deviceInfo: this.shareService.getDeviceInfo()
    }
  }

  /**
   * 设置事件监听
   */
  setupEventListeners() {
    // 监听设备发现事件
    this.discoveryService.on('peer-discovered', (peer) => {
      this.emit('peer-discovered', peer)
    })

    this.discoveryService.on('peer-offline', (peer) => {
      this.emit('peer-offline', peer)
    })
  }

  /**
   * 加载配置文件
   */
  async loadConfig() {
    try {
      const configData = await fs.readFile(this.configPath, 'utf8')
      this.config = JSON.parse(configData)
      
      // 验证配置格式
      this.validateConfig()
    } catch (error) {
      if (error.code === 'ENOENT') {
        // 配置文件不存在，创建默认配置
        this.config = this.createDefaultConfig()
        await this.saveConfig()
      } else {
        console.error('Failed to load config:', error)
        // 使用默认配置
        this.config = this.createDefaultConfig()
      }
    }
  }

  /**
   * 保存配置文件
   */
  async saveConfig() {
    try {
      const configData = JSON.stringify(this.config, null, 2)
      await fs.writeFile(this.configPath, configData, 'utf8')
    } catch (error) {
      console.error('Failed to save config:', error)
      throw error
    }
  }

  /**
   * 创建默认配置
   */
  createDefaultConfig() {
    // 确保ShareService已经初始化
    const deviceInfo = this.shareService.deviceInfo
    if (!deviceInfo) {
      throw new Error('ShareService deviceInfo not available for config creation')
    }
    
    return {
      enabled: false, // 默认关闭局域网分享功能
      deviceId: deviceInfo.deviceId,
      deviceName: deviceInfo.deviceName,
      userName: deviceInfo.userName,
      sharedNodes: {},
      network: {
        broadcastPort: 8888,
        httpPortRange: {
          start: 8889,
          end: 8999
        }
      },
      version: '1.0'
    }
  }

  /**
   * 验证配置格式
   */
  validateConfig() {
    if (!this.config.hasOwnProperty('enabled')) {
      this.config.enabled = false
    }
    if (!this.config.sharedNodes) {
      this.config.sharedNodes = {}
    }
    if (!this.config.network) {
      this.config.network = {
        broadcastPort: 8888,
        httpPortRange: { start: 8889, end: 8999 }
      }
    }
    if (!this.config.version) {
      this.config.version = '1.0'
    }
  }

  /**
   * 事件发射器
   */
  emit(event, data) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error)
        }
      })
    }
  }

  /**
   * 添加事件监听器
   */
  on(event, callback) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = []
    }
    this.eventListeners[event].push(callback)
  }

  /**
   * 移除事件监听器
   */
  off(event, callback) {
    if (this.eventListeners[event]) {
      const index = this.eventListeners[event].indexOf(callback)
      if (index > -1) {
        this.eventListeners[event].splice(index, 1)
      }
    }
  }

  /**
   * 清理资源
   */
  async cleanup() {
    if (this.isInitialized) {
      await this.stopServices()
      this.eventListeners = {}
      this.isInitialized = false
      console.log('NetworkManager cleaned up')
    }
  }
}