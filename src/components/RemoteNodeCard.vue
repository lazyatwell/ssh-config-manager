<script setup>
import { ref, onMounted } from 'vue'

const props = defineProps({
  peer: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['node-imported'])

const remoteNodes = ref([])
const isLoading = ref(false)
const error = ref('')
const importingNodes = ref(new Set())

// 获取远程节点列表
async function fetchRemoteNodes() {
  if (!props.peer.isOnline) {
    return
  }

  isLoading.value = true
  error.value = ''

  try {
    if (window.networkApi) {
      remoteNodes.value = await window.networkApi.fetchRemoteNodes(props.peer)
    }
  } catch (err) {
    console.error('Failed to fetch remote nodes:', err)
    error.value = '获取节点列表失败'
  } finally {
    isLoading.value = false
  }
}

// 导入远程节点
async function importNode(node) {
  if (importingNodes.value.has(node.id)) {
    return
  }

  importingNodes.value.add(node.id)

  try {
    if (window.networkApi) {
      const importedNode = await window.networkApi.importRemoteNode(props.peer, node.id)
      emit('node-imported', {
        originalNode: node,
        importedNode,
        source: props.peer
      })
      
      // 显示成功提示（这里可以用更好的提示组件）
      console.log(`节点 "${importedNode.Host}" 导入成功`)
    }
  } catch (err) {
    console.error('Failed to import node:', err)
    // 显示错误提示
    alert(`导入节点失败: ${err.message}`)
  } finally {
    importingNodes.value.delete(node.id)
  }
}

// 格式化端口显示
function formatPort(port) {
  return port && port !== '22' ? `:${port}` : ''
}

onMounted(() => {
  fetchRemoteNodes()
})
</script>

<template>
  <div class="remote-node-card">
    <!-- 加载状态 -->
    <div v-if="isLoading" class="text-center py-4">
      <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
      <p class="text-sm text-gray-500">加载节点列表...</p>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="text-center py-4">
      <div class="bg-red-50 p-3 rounded-lg">
        <p class="text-sm text-red-600">{{ error }}</p>
        <button 
          @click="fetchRemoteNodes" 
          class="mt-2 text-xs text-red-700 hover:text-red-800 underline"
        >
          重试
        </button>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else-if="remoteNodes.length === 0" class="text-center py-4">
      <p class="text-sm text-gray-500">该设备未分享任何节点</p>
    </div>

    <!-- 节点列表 -->
    <div v-else class="space-y-3">
      <div 
        v-for="node in remoteNodes" 
        :key="node.id"
        class="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
      >
        <div class="flex-1 min-w-0">
          <!-- 节点名称和地址 -->
          <div class="flex items-center gap-2 mb-1">
            <h5 class="font-medium text-gray-800 truncate">{{ node.Host }}</h5>
            <span class="text-xs text-gray-500 bg-white px-2 py-0.5 rounded">
              {{ node.HostName }}{{ formatPort(node.Port) }}
            </span>
          </div>
          
          <!-- 用户和备注 -->
          <div class="flex items-center gap-4 text-sm text-gray-600">
            <span v-if="node.User" class="flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {{ node.User }}
            </span>
            <span v-if="node.Remark" class="truncate text-gray-500" :title="node.Remark">
              {{ node.Remark }}
            </span>
          </div>
        </div>

        <!-- 导入按钮 -->
        <button
          @click="importNode(node)"
          :disabled="importingNodes.has(node.id)"
          class="ml-3 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-md transition flex items-center gap-1"
        >
          <svg 
            v-if="importingNodes.has(node.id)"
            xmlns="http://www.w3.org/2000/svg" 
            class="h-3 w-3 animate-spin" 
            fill="none" 
            viewBox="0 0 24 24"
          >
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
          </svg>
          <svg 
            v-else
            xmlns="http://www.w3.org/2000/svg" 
            class="h-3 w-3" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          {{ importingNodes.has(node.id) ? '导入中' : '添加' }}
        </button>
      </div>
    </div>

    <!-- 刷新按钮 -->
    <div v-if="!isLoading && !error" class="mt-3 text-center">
      <button 
        @click="fetchRemoteNodes"
        class="text-xs text-gray-500 hover:text-gray-700 underline"
      >
        刷新节点列表
      </button>
    </div>
  </div>
</template>

<style scoped>
.remote-node-card {
  /* 组件样式 */
}
</style>