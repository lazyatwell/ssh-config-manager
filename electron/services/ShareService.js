import http from 'node:http'
import { URL } from 'node:url'
import os from 'node:os'
import crypto from 'node:crypto'

/**
 * SSH节点分享服务
 * 提供HTTP服务器，允许其他客户端获取分享的SSH节点配置
 */
export class ShareService {
  constructor() {
    this.httpServer = null
    this.sharedNodes = new Map() // nodeId -> nodeData
    this.isEnabled = false
    this.port = null
    this.deviceInfo = {
      deviceId: this.generateDeviceId(),
      deviceName: os.hostname(),
      userName: os.userInfo().username
    }
  }

  /**
   * 生成设备唯一ID
   */
  generateDeviceId() {
    const machineId = os.hostname() + os.userInfo().username
    return crypto.createHash('md5').update(machineId).digest('hex').substring(0, 16)
  }

  /**
   * 启动分享服务
   * @param {number} port - 指定端口，如果不指定则自动选择
   */
  async start(port = null) {
    if (this.isEnabled) {
      console.log('ShareService is already running')
      return
    }

    try {
      // 如果没有指定端口，自动选择可用端口
      if (!port) {
        port = await this.findAvailablePort(8889, 8999)
      }

      this.httpServer = http.createServer((req, res) => {
        this.handleRequest(req, res)
      })

      await new Promise((resolve, reject) => {
        this.httpServer.listen(port, '0.0.0.0', (err) => {
          if (err) {
            reject(err)
          } else {
            this.port = port
            this.isEnabled = true
            console.log(`ShareService started on port ${port}`)
            resolve()
          }
        })
      })
    } catch (error) {
      console.error('Failed to start ShareService:', error)
      throw error
    }
  }

  /**
   * 停止分享服务
   */
  async stop() {
    if (!this.isEnabled || !this.httpServer) {
      return
    }

    return new Promise((resolve) => {
      this.httpServer.close(() => {
        this.httpServer = null
        this.isEnabled = false
        this.port = null
        this.sharedNodes.clear()
        console.log('ShareService stopped')
        resolve()
      })
    })
  }

  /**
   * 添加分享节点
   * @param {string} nodeId - 节点ID
   * @param {object} nodeData - 节点数据
   */
  shareNode(nodeId, nodeData) {
    // 过滤敏感信息
    const filteredData = this.filterSensitiveData(nodeData)
    
    this.sharedNodes.set(nodeId, {
      ...filteredData,
      id: nodeId,
      sharedAt: Date.now(),
      owner: this.deviceInfo
    })
    
    console.log(`Node shared: ${nodeId}`)
  }

  /**
   * 取消分享节点
   * @param {string} nodeId - 节点ID
   */
  unshareNode(nodeId) {
    const removed = this.sharedNodes.delete(nodeId)
    if (removed) {
      console.log(`Node unshared: ${nodeId}`)
    }
    return removed
  }

  isNodeShared(nodeId){
    return this.sharedNodes.has(nodeId)
  }

  /**
   * 获取分享的节点列表
   */
  getSharedNodes() {
    return Array.from(this.sharedNodes.values())
  }

  /**
   * 获取分享节点数量
   */
  getSharedCount() {
    return this.sharedNodes.size
  }

  /**
   * 获取设备信息
   */
  getDeviceInfo() {
    return {
      ...this.deviceInfo,
      port: this.port,
      isEnabled: this.isEnabled,
      sharedCount: this.getSharedCount()
    }
  }

  /**
   * 处理HTTP请求
   */
  handleRequest(req, res) {
    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.setHeader('Content-Type', 'application/json')

    // 处理OPTIONS请求
    if (req.method === 'OPTIONS') {
      res.writeHead(200)
      res.end()
      return
    }

    // 只允许GET请求
    if (req.method !== 'GET') {
      this.sendError(res, 405, 'Method Not Allowed')
      return
    }

    try {
      const url = new URL(req.url, `http://localhost:${this.port}`)
      const pathname = url.pathname

      switch (pathname) {
        case '/api/nodes':
          this.handleGetNodes(res)
          break
        case '/api/health':
          this.handleHealthCheck(res)
          break
        default:
          if (pathname.startsWith('/api/node/')) {
            const nodeId = pathname.split('/').pop()
            this.handleGetNode(res, nodeId)
          } else {
            this.sendError(res, 404, 'Not Found')
          }
          break
      }
    } catch (error) {
      console.error('Error handling request:', error)
      this.sendError(res, 500, 'Internal Server Error')
    }
  }

  /**
   * 处理获取节点列表请求
   */
  handleGetNodes(res) {
    const nodes = this.getSharedNodes()
    this.sendSuccess(res, {
      nodes,
      owner: this.deviceInfo,
      timestamp: Date.now()
    })
  }

  /**
   * 处理获取单个节点请求
   */
  handleGetNode(res, nodeId) {
    const node = this.sharedNodes.get(nodeId)
    if (!node) {
      this.sendError(res, 404, 'Node not found')
      return
    }
    this.sendSuccess(res, node)
  }

  /**
   * 处理健康检查请求
   */
  handleHealthCheck(res) {
    this.sendSuccess(res, {
      status: 'online',
      timestamp: Date.now(),
      device: this.deviceInfo,
      sharedCount: this.getSharedCount()
    })
  }

  /**
   * 发送成功响应
   */
  sendSuccess(res, data) {
    res.writeHead(200)
    res.end(JSON.stringify({
      success: true,
      data
    }))
  }

  /**
   * 发送错误响应
   */
  sendError(res, statusCode, message) {
    res.writeHead(statusCode)
    res.end(JSON.stringify({
      success: false,
      error: {
        code: statusCode,
        message
      }
    }))
  }

  /**
   * 过滤敏感数据
   */
  filterSensitiveData(nodeData) {
    const filtered = { ...nodeData }
    
    // 移除内部字段
    delete filtered.originalHost
    
    // 只保留基本连接信息（包含 IdentityFile 供接收方参考）
    const allowedFields = ['Host', 'HostName', 'User', 'Port', 'IdentityFile', 'Remark']
    const result = {}
    
    allowedFields.forEach(field => {
      if (filtered[field] !== undefined) {
        result[field] = filtered[field]
      }
    })
    
    return result
  }

  /**
   * 查找可用端口
   */
  async findAvailablePort(startPort, endPort) {
    for (let port = startPort; port <= endPort; port++) {
      if (await this.isPortAvailable(port)) {
        return port
      }
    }
    throw new Error(`No available port found in range ${startPort}-${endPort}`)
  }

  /**
   * 检查端口是否可用
   */
  async isPortAvailable(port) {
    return new Promise((resolve) => {
      const server = http.createServer()
      
      server.listen(port, '0.0.0.0', () => {
        server.close(() => {
          resolve(true)
        })
      })
      
      server.on('error', () => {
        resolve(false)
      })
    })
  }
}