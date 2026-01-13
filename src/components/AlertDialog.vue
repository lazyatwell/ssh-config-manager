<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  isOpen: Boolean,
  title: {
    type: String,
    default: '提示'
  },
  message: {
    type: String,
    required: true
  },
  buttonText: {
    type: String,
    default: '确定'
  },
  type: {
    type: String,
    default: 'info', // 'info' | 'success' | 'warning' | 'error'
    validator: (value) => ['info', 'success', 'warning', 'error'].includes(value)
  }
})

const emit = defineEmits(['close'])

const okBtnRef = ref(null)

// 弹窗打开时自动聚焦到确定按钮
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    nextTick(() => {
      setTimeout(() => {
        okBtnRef.value?.focus()
      }, 50)
    })
  }
})

function handleClose() {
  emit('close')
}

// 处理键盘事件
function handleKeydown(e) {
  if (e.key === 'Escape' || e.key === 'Enter') {
    handleClose()
  }
}

// 图标和颜色配置
const typeConfig = {
  info: {
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-50',
    icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
  },
  success: {
    iconColor: 'text-green-500',
    bgColor: 'bg-green-50',
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
  },
  warning: {
    iconColor: 'text-yellow-500',
    bgColor: 'bg-yellow-50',
    icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
  },
  error: {
    iconColor: 'text-red-500',
    bgColor: 'bg-red-50',
    icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z'
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="isOpen"
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] backdrop-blur-sm"
        @click.self="handleClose"
        @keydown="handleKeydown"
      >
        <Transition name="scale">
          <div
            v-if="isOpen"
            class="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 transform"
          >
            <div class="flex items-start gap-4">
              <div :class="['shrink-0 w-10 h-10 rounded-full flex items-center justify-center', typeConfig[type].bgColor]">
                <svg xmlns="http://www.w3.org/2000/svg" :class="['h-6 w-6', typeConfig[type].iconColor]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="typeConfig[type].icon" />
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="text-lg font-bold text-gray-800 mb-1">{{ title }}</h3>
                <p class="text-gray-600 text-sm break-words">{{ message }}</p>
              </div>
            </div>
            
            <div class="mt-6 flex justify-end">
              <button
                ref="okBtnRef"
                @click="handleClose"
                class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {{ buttonText }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.scale-enter-active,
.scale-leave-active {
  transition: all 0.2s ease;
}
.scale-enter-from,
.scale-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
