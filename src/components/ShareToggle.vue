<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  nodeId: {
    type: String,
    required: true
  },
  nodeData: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['share-changed'])

const isShared = ref(false)
const isLoading = ref(false)

// 计算按钮的样式类
const buttonClass = computed(() => {
  const baseClass = 'p-1.5 rounded-md transition-all duration-200'
  if (isLoading.value) {
    return `${baseClass} text-gray-400 cursor-not-allowed`
  }
  if (isShared.value) {
    return `${baseClass} text-red-600 hover:text-red-700 hover:bg-red-50 bg-red-50`
  }
  return `${baseClass} text-gray-400 hover:text-blue-600 hover:bg-blue-50`
})

// 计算提示文本
const shareTooltip = computed(() => {
  if (isLoading.value) {
    return '处理中...'
  }
  return isShared.value ? '取消分享到局域网' : '分享到局域网'
})

// 切换分享状态
async function toggleShare() {
  if (isLoading.value) {
    return
  }

  isLoading.value = true
  
  try {
    if (isShared.value) {
      await window.networkApi.unshareNode(props.nodeId)
      isShared.value = false
    } else {
      // 只传递可序列化的数据字段，确保没有循环引用或不可序列化的对象
      const shareableData = {
        Host: String(props.nodeData.Host || ''),
        HostName: String(props.nodeData.HostName || ''),
        User: String(props.nodeData.User || ''),
        Port: String(props.nodeData.Port || ''),
        IdentityFile: String(props.nodeData.IdentityFile || ''),
        Remark: String(props.nodeData.Remark || '')
      }
      
      console.log('Sharing node data:', shareableData)
      await window.networkApi.shareNode(props.nodeId, shareableData)
      isShared.value = true
    }
    
    emit('share-changed', {
      nodeId: props.nodeId,
      isShared: isShared.value
    })
  } catch (error) {
    console.error('Failed to toggle share:', error)
    console.error('Node data:', props.nodeData)
    console.error('Node ID:', props.nodeId)
    // 可以在这里显示错误提示
  } finally {
    isLoading.value = false
  }
}

// 检查初始分享状态
async function checkShareStatus() {
  try {
    if (window.networkApi) {
      isShared.value = await window.networkApi.isNodeShared(props.nodeId)
    }
  } catch (error) {
    console.error('Failed to check share status:', error)
  }
}

onMounted(() => {
  checkShareStatus()
})

onUnmounted(() => {
  // No cleanup needed
})
</script>

<template>
  <div class="share-toggle">
    <button 
      @click="toggleShare"
      :class="buttonClass"
      :title="shareTooltip"
      :disabled="isLoading"
    >
      <!-- 加载状态图标 -->
      <svg 
        v-if="isLoading"
        xmlns="http://www.w3.org/2000/svg" 
        class="h-4 w-4 animate-spin" 
        fill="none" 
        viewBox="0 0 24 24"
      >
        <circle 
          class="opacity-25" 
          cx="12" 
          cy="12" 
          r="10" 
          stroke="currentColor" 
          stroke-width="4"
        />
        <path 
          class="opacity-75"
          fill="currentColor" 
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      
      <!-- 停止分享图标 (已分享状态) -->
      <svg 
        v-else-if="isShared"
        xmlns="http://www.w3.org/2000/svg" 
        class="h-4 w-4" 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path 
          stroke-linecap="round" 
          stroke-linejoin="round" 
          stroke-width="2" 
          d="M6 18L18 6M6 6l12 12" 
        />
      </svg>
      
      <!-- 分享图标 (未分享状态) -->
      <svg 
        v-else
        xmlns="http://www.w3.org/2000/svg" 
        class="h-4 w-4" 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path 
          stroke-linecap="round" 
          stroke-linejoin="round" 
          stroke-width="2" 
          d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" 
        />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.share-toggle {
  display: inline-block;
}
</style>