<script setup>
import { ref, onMounted, computed } from 'vue'

const localSharedNodes = ref([])
const isExpanded = ref(false)
const isLoading = ref(false)

// 计算显示的节点（折叠时只显示前3个）
const displayedNodes = computed(() => {
  if (isExpanded.value || localSharedNodes.value.length <= 3) {
    return localSharedNodes.value
  }
  return localSharedNodes.value.slice(0, 3)
})

// 是否需要显示展开按钮
const needsExpansion = computed(() => {
  return localSharedNodes.value.length > 3
})

// 获取本地分享的节点
async function getLocalSharedNodes() {
  try {
    isLoading.value = true
    if (window.networkApi) {
      // 先尝试恢复分享节点
      await window.networkApi.restoreSharedNodes()
      // 然后获取分享节点列表
      localSharedNodes.value = await window.networkApi.getSharedNodes()
    }
  } catch (error) {
    console.error('Failed to get local shared nodes:', error)
  } finally {
    isLoading.value = false
  }
}

// 格式化端口显示
function formatPort(port) {
  return port && port !== '22' ? `:${port}` : ''
}

onMounted(() => {
  getLocalSharedNodes()
})

// 暴露刷新方法给父组件
defineExpose({
  refresh: getLocalSharedNodes
})
</script>

<template>
  <div class="local-shared-nodes">
    <!-- 本地分享节点标题 -->
    <div class="flex items-center justify-between mb-3">
      <h4 class="text-sm font-medium text-gray-700 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
        本机分享的节点
      </h4>
      <span class="text-xs text-gray-500">{{ localSharedNodes.length }} 个</span>
    </div>

    <!-- 加载状态 -->
    <div v-if="isLoading" class="text-center py-4">
      <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mx-auto mb-2"></div>
      <p class="text-xs text-gray-500">加载中...</p>
    </div>

    <!-- 空状态 -->
    <div v-else-if="localSharedNodes.length === 0" class="text-center py-6">
      <div class="bg-gray-50 p-3 rounded-full w-12 h-12 mx-auto mb-2 flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
        </svg>
      </div>
      <p class="text-sm text-gray-500">暂无分享节点</p>
      <p class="text-xs text-gray-400 mt-1">点击节点卡片上的分享按钮开始分享</p>
    </div>

    <!-- 节点列表 -->
    <div v-else class="space-y-2">
      <div 
        v-for="node in displayedNodes" 
        :key="node.id"
        class="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100"
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

        <!-- 分享状态指示 -->
        <div class="ml-3 flex items-center gap-2">
          <div class="w-2 h-2 bg-blue-400 rounded-full"></div>
          <span class="text-xs text-blue-600 font-medium">分享中</span>
        </div>
      </div>

      <!-- 展开/收起按钮 -->
      <div v-if="needsExpansion" class="text-center pt-2">
        <button 
          @click="isExpanded = !isExpanded"
          class="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 mx-auto"
        >
          <span>{{ isExpanded ? '收起' : `展开全部 (${localSharedNodes.length})` }}</span>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 transition-transform" :class="{ 'rotate-180': isExpanded }" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>