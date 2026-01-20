<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import RemoteNodeCard from './RemoteNodeCard.vue'
import LocalSharedNodes from './LocalSharedNodes.vue'

const discoveredPeers = ref([])
const networkStatus = ref({})
const isLoading = ref(false)
const error = ref('')
const isExpanded = ref(true)
const localSharedNodesRef = ref(null)

// 事件监听器清理函数
let unsubscribePeerDiscovered = null
let unsubscribePeerOffline = null
let unsubscribeNodeImported = null
let unsubscribeNodeShared = null
let unsubscribeNodeUnshared = null

// 计算在线设备数量
const onlinePeerCount = computed(() => {
  return discoveredPeers.value.filter(peer => peer.isOnline).length
})

// 计算总共分享的节点数量
const totalSharedNodes = computed(() => {
  return discoveredPeers.value.reduce((total, peer) => {
    return total + (peer.sharedCount || 0)
  }, 0)
})

// 获取网络状态
async function getNetworkStatus() {
  try {
    if (window.networkApi) {
      networkStatus.value = await window.networkApi.getStatus()
    }
  } catch (err) {
    console.error('Failed to get network status:', err)
    error.value = '获取网络状态失败'
  }
}

// 获取发现的设备
async function getDiscoveredPeers() {
  try {
    if (window.networkApi) {
      discoveredPeers.value = await window.networkApi.getDiscoveredPeers()
    }
  } catch (err) {
    console.error('Failed to get discovered peers:', err)
    error.value = '获取设备列表失败'
  }
}

// 切换分享功能
async function toggleSharing() {
  isLoading.value = true
  error.value = ''
  
  try {
    if (networkStatus.value.sharingEnabled) {
      await window.networkApi.disableSharing()
    } else {
      await window.networkApi.enableSharing()
    }
    await getNetworkStatus()
  } catch (err) {
    console.error('Failed to toggle sharing:', err)
    error.value = '切换分享功能失败'
  } finally {
    isLoading.value = false
  }
}

// 刷新设备发现
async function refreshDiscovery() {
  isLoading.value = true
  error.value = ''
  
  try {
    if (window.networkApi) {
      await window.networkApi.refreshDiscovery()
      // 延迟一下再获取，让广播有时间传播
      setTimeout(async () => {
        await getDiscoveredPeers()
        // 同时刷新本地分享节点
        if (localSharedNodesRef.value) {
          localSharedNodesRef.value.refresh()
        }
        isLoading.value = false
      }, 1000)
    }
  } catch (err) {
    console.error('Failed to refresh discovery:', err)
    error.value = '刷新发现失败'
    isLoading.value = false
  }
}

// 处理节点导入成功
function handleNodeImported(data) {
  // 可以显示成功提示
  console.log('Node imported:', data)
}

// 处理节点分享状态变化
function handleNodeShared(data) {
  console.log('Node shared:', data)
  // 刷新本地分享节点列表
  if (localSharedNodesRef.value) {
    localSharedNodesRef.value.refresh()
  }
}

function handleNodeUnshared(data) {
  console.log('Node unshared:', data)
  // 刷新本地分享节点列表
  if (localSharedNodesRef.value) {
    localSharedNodesRef.value.refresh()
  }
}

// 设置事件监听
function setupEventListeners() {
  if (window.networkApi) {
    unsubscribePeerDiscovered = window.networkApi.onPeerDiscovered((peer) => {
      console.log('Peer discovered:', peer)
      getDiscoveredPeers()
    })

    unsubscribePeerOffline = window.networkApi.onPeerOffline((peer) => {
      console.log('Peer offline:', peer)
      getDiscoveredPeers()
    })

    unsubscribeNodeImported = window.networkApi.onNodeImported((data) => {
      handleNodeImported(data)
    })

    unsubscribeNodeShared = window.networkApi.onNodeShared((data) => {
      handleNodeShared(data)
    })

    unsubscribeNodeUnshared = window.networkApi.onNodeUnshared((data) => {
      handleNodeUnshared(data)
    })
  }
}

// 清理事件监听
function cleanupEventListeners() {
  if (unsubscribePeerDiscovered) {
    unsubscribePeerDiscovered()
    unsubscribePeerDiscovered = null
  }
  if (unsubscribePeerOffline) {
    unsubscribePeerOffline()
    unsubscribePeerOffline = null
  }
  if (unsubscribeNodeImported) {
    unsubscribeNodeImported()
    unsubscribeNodeImported = null
  }
  if (unsubscribeNodeShared) {
    unsubscribeNodeShared()
    unsubscribeNodeShared = null
  }
  if (unsubscribeNodeUnshared) {
    unsubscribeNodeUnshared()
    unsubscribeNodeUnshared = null
  }
}

// 初始化数据
async function initialize() {
  await getNetworkStatus()
  if (networkStatus.value.sharingEnabled) {
    await getDiscoveredPeers()
  }
}

onMounted(() => {
  initialize()
  setupEventListeners()
  
  // 定期刷新设备列表
  const refreshInterval = setInterval(() => {
    if (networkStatus.value.sharingEnabled && !isLoading.value) {
      getDiscoveredPeers()
    }
  }, 10000) // 每10秒刷新一次

  // 清理定时器
  onUnmounted(() => {
    clearInterval(refreshInterval)
  })
})

onUnmounted(() => {
  cleanupEventListeners()
})
</script>

<template>
  <div class="network-discovery bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
    <!-- 头部 -->
    <div class="p-4 border-b border-gray-100">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
            </svg>
            <h3 class="text-lg font-semibold text-gray-800">局域网分享</h3>
          </div>
          
          <!-- 状态指示 -->
          <div class="flex items-center gap-2 text-sm">
            <div :class="networkStatus.sharingEnabled ? 'w-2 h-2 bg-green-400 rounded-full' : 'w-2 h-2 bg-gray-300 rounded-full'"></div>
            <span class="text-gray-500">
              {{ networkStatus.sharingEnabled ? '已启用' : '已禁用' }}
            </span>
            <span v-if="networkStatus.sharingEnabled && onlinePeerCount > 0" class="text-gray-400">
              • {{ onlinePeerCount }} 个设备在线
            </span>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <!-- 刷新按钮 -->
          <button 
            v-if="networkStatus.sharingEnabled"
            @click="refreshDiscovery"
            :disabled="isLoading"
            class="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition"
            title="刷新发现"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" :class="{ 'animate-spin': isLoading }" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          <!-- 开关按钮 -->
          <button 
            @click="toggleSharing"
            :disabled="isLoading"
            :class="networkStatus.sharingEnabled 
              ? 'bg-red-100 text-red-600 hover:bg-red-200' 
              : 'bg-green-100 text-green-600 hover:bg-green-200'"
            class="px-3 py-1.5 rounded-md text-sm font-medium transition"
          >
            {{ isLoading ? '处理中...' : (networkStatus.sharingEnabled ? '关闭' : '开启') }}
          </button>

          <!-- 展开/收起按钮 -->
          <button 
            v-if="networkStatus.sharingEnabled"
            @click="isExpanded = !isExpanded"
            class="p-2 text-gray-400 hover:text-gray-600 rounded-md transition"
            :title="isExpanded ? '收起' : '展开'"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform" :class="{ 'rotate-180': isExpanded }" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      <!-- 错误提示 -->
      <div v-if="error" class="mt-3 p-2 bg-red-50 border border-red-200 rounded-md">
        <p class="text-sm text-red-600">{{ error }}</p>
      </div>
    </div>

    <!-- 内容区域 -->
    <Transition name="slide-down">
      <div v-if="networkStatus.sharingEnabled && isExpanded" class="p-4 space-y-6">
        <!-- 第一部分：本地分享节点 -->
        <LocalSharedNodes ref="localSharedNodesRef" />
        
        <!-- 分割线 -->
        <div class="border-t border-gray-200"></div>
        
        <!-- 第二部分：网络发现的设备 -->
        <div class="network-peers">
          <!-- 网络设备标题 -->
          <div class="flex items-center justify-between mb-3">
            <h4 class="text-sm font-medium text-gray-700 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9" />
              </svg>
              网络发现的设备
            </h4>
            <span class="text-xs text-gray-500">{{ onlinePeerCount }} 个在线</span>
          </div>

          <!-- 空状态 -->
          <div v-if="discoveredPeers.length === 0 && !isLoading" class="text-center py-6">
            <div class="bg-gray-50 p-3 rounded-full w-12 h-12 mx-auto mb-2 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <p class="text-sm text-gray-500">未发现其他设备</p>
            <p class="text-xs text-gray-400 mt-1">确保其他设备也开启了分享功能</p>
          </div>

          <!-- 设备列表 -->
          <div v-else class="space-y-4">
            <div v-for="peer in discoveredPeers" :key="peer.deviceId" class="border border-gray-200 rounded-lg overflow-hidden">
              <!-- 设备信息头部 -->
              <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <div :class="peer.isOnline ? 'w-2 h-2 bg-green-400 rounded-full' : 'w-2 h-2 bg-gray-300 rounded-full'"></div>
                    <div>
                      <h4 class="font-medium text-gray-800">{{ peer.deviceName }}</h4>
                      <p class="text-sm text-gray-500">{{ peer.userName }} • {{ peer.ip }}</p>
                    </div>
                  </div>
                  <div class="text-sm text-gray-500">
                    {{ peer.sharedCount || 0 }} 个节点
                  </div>
                </div>
              </div>

              <!-- 远程节点列表 -->
              <div class="p-4">
                <RemoteNodeCard :peer="peer" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 简化状态显示（未展开时） -->
    <div v-if="networkStatus.sharingEnabled && !isExpanded && onlinePeerCount > 0" class="px-4 py-2 bg-gray-50 border-t border-gray-100">
      <p class="text-sm text-gray-600 text-center">
        发现 {{ onlinePeerCount }} 个设备，共 {{ totalSharedNodes }} 个分享节点
        <button @click="isExpanded = true" class="text-blue-600 hover:text-blue-700 ml-1">查看详情</button>
      </p>
    </div>
  </div>
</template>

<style scoped>
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}
.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>