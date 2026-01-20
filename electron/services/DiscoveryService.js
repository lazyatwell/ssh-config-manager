import dgram from 'node:dgram'
import os from 'node:os'

/**
 * 网络发现服务
 * 使用UDP广播发现局域网内的其他SSH配置分享设备
 */
export class DiscoveryService {
  constructor() {
    this.udpSocket = null
    this.discoveredPeers = new Map() // deviceId -> peerInfo
    this.broadcastTimer = null
    this.cleanupTimer = null
    this.isEnabled = false
    this.broadcastPort = 8888
    this.broadcastIntervalMs = 5000 // 5秒广播一次
    this.peerTimeout = 15000 // 15秒未收到视为离线
    this.localIPs = this.getLocalIPs()
  }

  /**
   * 启动发现服务
   * @param {object} deviceInfo - 本设备信息
   * @param {number} sharePort - 分享服务端口
   */
  async start(deviceInfo, sharePort) {
    if (this.isEnabled) {
      console.log('DiscoveryService is already running')
      return
    }

    this.deviceInfo = deviceInfo
    this.sharePort = sharePort

    try {
      // 创建UDP socket
      this.udpSocket = dgram.createSocket('udp4')
      
      // 设置socket选项
      this.udpSocket.bind(this.broadcastPort, () => {
        this.udpSocket.setBroadcast(true)
        console.log(`DiscoveryService listening on port ${this.broadcastPort}`)
      })

      // 监听广播消息
      this.udpSocket.on('message', (msg, rinfo) => {
        this.handleBroadcast(msg, rinfo)
      })

      // 监听错误
      this.udpSocket.on('error', (err) => {
        console.error('DiscoveryService UDP error:', err)
      })

      // 开始定期广播
      this.startBroadcasting()
      
      // 开始清理离线设备
      this.startPeerCleanup()

      this.isEnabled = true
      console.log('DiscoveryService started')
    } catch (error) {
      console.error('Failed to start DiscoveryService:', error)
      throw error
    }
  }

  /**
   * 停止发现服务
   */
  async stop() {
    if (!this.isEnabled) {
      return
    }

    // 停止广播
    if (this.broadcastTimer) {
      clearInterval(this.broadcastTimer)
      this.broadcastTimer = null
    }

    // 停止清理任务
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }

    // 关闭socket
    if (this.udpSocket) {
      this.udpSocket.close()
      this.udpSocket = null
    }

    // 清空发现的设备
    this.discoveredPeers.clear()
    this.isEnabled = false
    
    console.log('DiscoveryService stopped')
  }

  /**
   * 开始定期广播
   */
  startBroadcasting() {
    // 立即广播一次
    this.broadcast()
    
    // 设置定期广播
    this.broadcastTimer = setInterval(() => {
      this.broadcast()
    }, this.broadcastIntervalMs)
  }

  /**
   * 广播自己的存在
   */
  broadcast() {
    if (!this.udpSocket || !this.isEnabled) {
      return
    }

    const message = {
      type: 'ssh-config-discovery',
      version: '1.0',
      deviceId: this.deviceInfo.deviceId,
      deviceName: this.deviceInfo.deviceName,
      userName: this.deviceInfo.userName,
      port: this.sharePort,
      timestamp: Date.now(),
      sharedCount: this.deviceInfo.sharedCount || 0
    }

    const messageBuffer = Buffer.from(JSON.stringify(message))
    
    // 向所有网络接口广播
    this.localIPs.forEach(ip => {
      const broadcastAddress = this.getBroadcastAddress(ip)
      if (broadcastAddress) {
        this.udpSocket.send(messageBuffer, this.broadcastPort, broadcastAddress, (err) => {
          if (err) {
            console.error(`Failed to broadcast to ${broadcastAddress}:`, err)
          }
        })
      }
    })
  }

  /**
   * 处理接收到的广播消息
   */
  handleBroadcast(msg, rinfo) {
    try {
      const message = JSON.parse(msg.toString())
      
      // 验证消息格式
      if (!this.isValidBroadcastMessage(message)) {
        return
      }

      // 忽略自己的广播
      if (message.deviceId === this.deviceInfo.deviceId) {
        return
      }

      // 忽略来自本机的消息
      if (this.localIPs.includes(rinfo.address)) {
        return
      }

      // 更新或添加设备信息
      const peerInfo = {
        deviceId: message.deviceId,
        deviceName: message.deviceName,
        userName: message.userName,
        ip: rinfo.address,
        port: message.port,
        lastSeen: Date.now(),
        isOnline: true,
        sharedCount: message.sharedCount || 0,
        version: message.version
      }

      const existingPeer = this.discoveredPeers.get(message.deviceId)
      const isNewPeer = !existingPeer
      const wasOffline = existingPeer && !existingPeer.isOnline

      this.discoveredPeers.set(message.deviceId, peerInfo)

      if (isNewPeer || wasOffline) {
        console.log(`Discovered peer: ${peerInfo.deviceName} (${peerInfo.ip}:${peerInfo.port})`)
        this.emit('peer-discovered', peerInfo)
      }

    } catch (error) {
      console.error('Error parsing broadcast message:', error)
    }
  }

  /**
   * 验证广播消息格式
   */
  isValidBroadcastMessage(message) {
    return message &&
           message.type === 'ssh-config-discovery' &&
           message.deviceId &&
           message.deviceName &&
           message.userName &&
           typeof message.port === 'number' &&
           typeof message.timestamp === 'number'
  }

  /**
   * 开始清理离线设备
   */
  startPeerCleanup() {
    this.cleanupTimer = setInterval(() => {
      this.cleanupOfflinePeers()
    }, 5000) // 每5秒检查一次
  }

  /**
   * 清理离线设备
   */
  cleanupOfflinePeers() {
    const now = Date.now()
    const offlinePeers = []

    for (const [deviceId, peer] of this.discoveredPeers) {
      if (now - peer.lastSeen > this.peerTimeout) {
        if (peer.isOnline) {
          peer.isOnline = false
          offlinePeers.push(peer)
          console.log(`Peer went offline: ${peer.deviceName} (${peer.ip})`)
        }
        
        // 如果离线时间超过2倍超时时间，则完全移除
        if (now - peer.lastSeen > this.peerTimeout * 2) {
          this.discoveredPeers.delete(deviceId)
          console.log(`Removed offline peer: ${peer.deviceName}`)
        }
      }
    }

    // 通知离线设备
    offlinePeers.forEach(peer => {
      this.emit('peer-offline', peer)
    })
  }

  /**
   * 获取发现的设备列表
   */
  getDiscoveredPeers() {
    return Array.from(this.discoveredPeers.values())
      .filter(peer => peer.isOnline)
      .sort((a, b) => b.lastSeen - a.lastSeen)
  }

  /**
   * 获取所有设备（包括离线）
   */
  getAllPeers() {
    return Array.from(this.discoveredPeers.values())
      .sort((a, b) => b.lastSeen - a.lastSeen)
  }

  /**
   * 获取本机IP地址列表
   */
  getLocalIPs() {
    const interfaces = os.networkInterfaces()
    const ips = []

    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        // 跳过内部地址和IPv6
        if (iface.family === 'IPv4' && !iface.internal) {
          ips.push(iface.address)
        }
      }
    }

    return ips
  }

  /**
   * 获取广播地址
   */
  getBroadcastAddress(ip) {
    const parts = ip.split('.')
    if (parts.length !== 4) {
      return null
    }

    // 简单的C类网络广播地址计算
    // 实际应用中可能需要更复杂的子网掩码计算
    return `${parts[0]}.${parts[1]}.${parts[2]}.255`
  }

  /**
   * 事件发射器（简单实现）
   */
  emit(event, data) {
    if (this.listeners && this.listeners[event]) {
      this.listeners[event].forEach(callback => {
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
    if (!this.listeners) {
      this.listeners = {}
    }
    if (!this.listeners[event]) {
      this.listeners[event] = []
    }
    this.listeners[event].push(callback)
  }

  /**
   * 移除事件监听器
   */
  off(event, callback) {
    if (this.listeners && this.listeners[event]) {
      const index = this.listeners[event].indexOf(callback)
      if (index > -1) {
        this.listeners[event].splice(index, 1)
      }
    }
  }

  /**
   * 手动刷新设备发现
   */
  refresh() {
    if (this.isEnabled) {
      this.broadcast()
    }
  }

  /**
   * 获取服务状态
   */
  getStatus() {
    return {
      isEnabled: this.isEnabled,
      broadcastPort: this.broadcastPort,
      peerCount: this.discoveredPeers.size,
      onlinePeerCount: this.getDiscoveredPeers().length,
      localIPs: this.localIPs
    }
  }
}