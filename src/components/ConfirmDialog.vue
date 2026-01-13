<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  isOpen: Boolean,
  title: {
    type: String,
    default: '确认'
  },
  message: {
    type: String,
    required: true
  },
  confirmText: {
    type: String,
    default: '确认'
  },
  cancelText: {
    type: String,
    default: '取消'
  },
  confirmType: {
    type: String,
    default: 'primary', // 'primary' | 'danger'
    validator: (value) => ['primary', 'danger'].includes(value)
  }
})

const emit = defineEmits(['confirm', 'cancel'])

const confirmBtnRef = ref(null)

// 弹窗打开时自动聚焦到确认按钮
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    nextTick(() => {
      setTimeout(() => {
        confirmBtnRef.value?.focus()
      }, 50)
    })
  }
})

function handleConfirm() {
  emit('confirm')
}

function handleCancel() {
  emit('cancel')
}

// 处理键盘事件
function handleKeydown(e) {
  if (e.key === 'Escape') {
    handleCancel()
  } else if (e.key === 'Enter') {
    handleConfirm()
  }
}

// 确认按钮样式
const confirmBtnClass = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white',
  danger: 'bg-red-600 hover:bg-red-700 text-white'
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="isOpen"
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] backdrop-blur-sm"
        @click.self="handleCancel"
        @keydown="handleKeydown"
      >
        <Transition name="scale">
          <div
            v-if="isOpen"
            class="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 transform"
          >
            <h3 class="text-lg font-bold text-gray-800 mb-2">{{ title }}</h3>
            <p class="text-gray-600 mb-6">{{ message }}</p>
            
            <div class="flex justify-end space-x-3">
              <button
                @click="handleCancel"
                class="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition focus:outline-none focus:ring-2 focus:ring-gray-200"
              >
                {{ cancelText }}
              </button>
              <button
                ref="confirmBtnRef"
                @click="handleConfirm"
                :class="[
                  'px-4 py-2 text-sm font-medium rounded-lg shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-2',
                  confirmType === 'danger' ? 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500' : 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500'
                ]"
              >
                {{ confirmText }}
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
