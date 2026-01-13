<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import draggable from 'vuedraggable'
import HostEditor from './components/HostEditor.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import AlertDialog from './components/AlertDialog.vue'

const hosts = ref([])
const searchQuery = ref('')
const isEditorOpen = ref(false)
const editingHost = ref(null)
const loading = ref(false)
const error = ref('')

// 确认对话框状态
const confirmDialog = ref({
  isOpen: false,
  title: '',
  message: '',
  confirmType: 'primary',
  onConfirm: null
})

// 提示对话框状态
const alertDialog = ref({
  isOpen: false,
  title: '',
  message: '',
  type: 'error'
})

// 自动更新相关状态
const updateStatus = ref('idle') // idle, checking, available, downloading, downloaded, not-available, error
const updateInfo = ref({})
const downloadProgress = ref(0)
const currentVersion = ref('')
const showUpdateBanner = ref(false)
let unsubscribeUpdateStatus = null

// 是否启用拖拽（搜索时禁用）
const isDragEnabled = computed(() => !searchQuery.value)

const filteredHosts = computed(() => {
  let result = hosts.value
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(h => 
      h.Host.toLowerCase().includes(q) || 
      (h.HostName && h.HostName.toLowerCase().includes(q)) ||
      (h.User && h.User.toLowerCase().includes(q)) ||
      (h.Remark && h.Remark.toLowerCase().includes(q))
    )
  }
  return result
})

async function loadHosts() {
  try {
    loading.value = true
    if (window.sshApi) {
      hosts.value = await window.sshApi.getAll()
      error.value = ''
    } else {
      error.value = 'SSH API not available (Are you running in Electron?)'
    }
  } catch (e) {
    error.value = e.message
    console.error(e)
  } finally {
    loading.value = false
  }
}

function openAdd() {
  editingHost.value = null
  isEditorOpen.value = true
}

function openEdit(host) {
  editingHost.value = host
  isEditorOpen.value = true
}

async function handleSave(data) {
  try {
    await window.sshApi.saveHost(data)
    isEditorOpen.value = false
    await loadHosts()
  } catch (e) {
    showAlert('保存失败', e.message)
  }
}

async function handleDelete(hostName) {
  confirmDialog.value = {
    isOpen: true,
    title: '删除确认',
    message: `确定要删除配置 "${hostName}" 吗？`,
    confirmType: 'danger',
    onConfirm: async () => {
      confirmDialog.value.isOpen = false
      try {
        await window.sshApi.deleteHost(hostName)
        await loadHosts()
      } catch (e) {
        showAlert('删除失败', e.message)
      }
    }
  }
}

async function handleCopy(hostName) {
  confirmDialog.value = {
    isOpen: true,
    title: '复制确认',
    message: `确定要复制配置 "${hostName}" 吗？`,
    confirmType: 'primary',
    onConfirm: async () => {
      confirmDialog.value.isOpen = false
      try {
        await window.sshApi.copyHost(hostName)
        await loadHosts()
      } catch (e) {
        showAlert('复制失败', e.message)
      }
    }
  }
}

function closeConfirmDialog() {
  confirmDialog.value.isOpen = false
}

function handleConfirmDialogConfirm() {
  if (confirmDialog.value.onConfirm) {
    confirmDialog.value.onConfirm()
  }
}

// 显示提示对话框
function showAlert(title, message, type = 'error') {
  alertDialog.value = {
    isOpen: true,
    title,
    message,
    type
  }
}

function closeAlertDialog() {
  alertDialog.value.isOpen = false
}

// 拖拽结束后保存新顺序
async function handleDragEnd() {
  try {
    const hostNames = hosts.value.map(h => h.Host)
    await window.sshApi.reorderHosts(hostNames)
  } catch (e) {
    console.error('Failed to save order:', e)
  }
}

// 自动更新相关函数
function handleUpdateStatus(data) {
  updateStatus.value = data.status
  
  switch (data.status) {
    case 'available':
      updateInfo.value = {
        version: data.version,
        releaseDate: data.releaseDate,
        releaseNotes: data.releaseNotes
      }
      showUpdateBanner.value = true
      break
    case 'downloading':
      downloadProgress.value = Math.round(data.percent || 0)
      break
    case 'downloaded':
      updateInfo.value.version = data.version
      break
    case 'error':
      console.error('Update error:', data.message)
      break
    case 'not-available':
      console.warn('No update available')
      break
    default:
      console.log('Update status:', data.status)
      break
  }
}

async function checkForUpdates() {
  if (window.updaterApi) {
    updateStatus.value = 'checking'
    await window.updaterApi.checkForUpdates()
  }
}

async function downloadUpdate() {
  if (window.updaterApi) {
    await window.updaterApi.downloadUpdate()
  }
}

function installUpdate() {
  if (window.updaterApi) {
    window.updaterApi.installUpdate()
  }
}

function dismissUpdateBanner() {
  showUpdateBanner.value = false
}

onMounted(async () => {
  loadHosts()
  
  // 获取当前版本
  if (window.updaterApi) {
    currentVersion.value = await window.updaterApi.getVersion()
    // 监听更新状态，保存取消订阅函数
    unsubscribeUpdateStatus = window.updaterApi.onUpdateStatus(handleUpdateStatus)
  }
})

onUnmounted(() => {
  // 清理监听器 - 只移除当前组件注册的监听器
  if (unsubscribeUpdateStatus) {
    unsubscribeUpdateStatus()
    unsubscribeUpdateStatus = null
  }
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-blue-100 selection:text-blue-900">
    <!-- 更新提示横幅 -->
    <Transition name="slide-down">
      <div v-if="showUpdateBanner" class="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div class="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span class="text-sm">
              <template v-if="updateStatus === 'available'">
                新版本 <strong>v{{ updateInfo.version }}</strong> 可用！
              </template>
              <template v-else-if="updateStatus === 'downloading'">
                正在下载更新... {{ downloadProgress }}%
              </template>
              <template v-else-if="updateStatus === 'downloaded'">
                更新已下载完成，重启应用以完成安装
              </template>
            </span>
          </div>
          <div class="flex items-center gap-2">
            <template v-if="updateStatus === 'available'">
              <button @click="downloadUpdate" class="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-md text-sm font-medium transition">
                下载更新
              </button>
            </template>
            <template v-else-if="updateStatus === 'downloading'">
              <div class="w-32 h-2 bg-white/20 rounded-full overflow-hidden">
                <div class="h-full bg-white transition-all duration-300" :style="{ width: downloadProgress + '%' }"></div>
              </div>
            </template>
            <template v-else-if="updateStatus === 'downloaded'">
              <button @click="installUpdate" class="bg-white text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-md text-sm font-medium transition">
                立即重启
              </button>
            </template>
            <button @click="dismissUpdateBanner" class="p-1 hover:bg-white/20 rounded transition" title="稍后提醒">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <div class="max-w-5xl mx-auto p-6 md:p-10">
      <header class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 class="text-3xl font-bold text-gray-900 tracking-tight">SSH Config Manager</h1>
          <p class="text-gray-500 text-sm mt-1">
            Manage your local SSH configurations easily
            <span v-if="currentVersion" @dblclick="checkForUpdates" class="ml-2 text-xs text-gray-400">v{{ currentVersion }}</span>
          </p>
        </div>
        <button @click="openAdd" class="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-5 py-2.5 rounded-lg shadow-sm hover:shadow flex items-center gap-2 transition font-medium">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
          </svg>
          New Host
        </button>
      </header>

      <div class="mb-8 relative group">
        <input v-model="searchQuery" type="text" placeholder="Search hosts by alias, IP, or user..." class="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-gray-700 placeholder-gray-400" />
        <span class="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-blue-500 transition">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </span>
      </div>

      <div v-if="loading" class="text-center py-20">
        <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p class="text-gray-500">Loading configurations...</p>
      </div>
      
      <div v-else-if="error" class="text-center py-20 bg-red-50 rounded-xl border border-red-100">
        <p class="text-red-600 font-medium">{{ error }}</p>
      </div>
      
      <draggable
        v-else
        v-model="hosts"
        item-key="Host"
        handle=".drag-handle"
        :disabled="!isDragEnabled"
        ghost-class="opacity-40"
        chosen-class="shadow-lg"
        drag-class="shadow-2xl"
        animation="200"
        class="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
        @end="handleDragEnd"
      >
        <template #item="{ element: host }">
          <div
            v-show="!searchQuery || filteredHosts.some(h => h.Host === host.Host)"
            class="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 transition group flex"
          >
            <!-- 拖拽手柄 -->
            <div
              v-if="isDragEnabled"
              class="drag-handle w-6 shrink-0 flex items-center justify-center rounded-l-xl bg-gray-50 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing hover:bg-gray-100"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="9" cy="5" r="1.5" />
                <circle cx="15" cy="5" r="1.5" />
                <circle cx="9" cy="12" r="1.5" />
                <circle cx="15" cy="12" r="1.5" />
                <circle cx="9" cy="19" r="1.5" />
                <circle cx="15" cy="19" r="1.5" />
              </svg>
            </div>
            
            <div class="flex-1 p-5 flex flex-col">
            <div class="flex justify-between items-start mb-4 border-b border-gray-50">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <div class="w-2 h-2 rounded-full bg-green-400 shrink-0"></div>
                  <h3 class="text-lg font-bold text-gray-800 truncate" :title="host.Host">{{ host.Host }}</h3>
                </div>
                <p v-if="host.Remark" class="text-xs text-gray-400 mt-1 ml-4 truncate" :title="host.Remark">{{ host.Remark }}</p>
              </div>
              <div class="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button @click="openEdit(host)" class="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition" title="Edit">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button @click="handleCopy(host.Host)" class="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md transition" title="Copy">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
                <button @click="handleDelete(host.Host)" class="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition" title="Delete">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div class="text-sm text-gray-600 space-y-2.5 grow">
              <div v-if="host.HostName" class="flex items-start">
                <span class="w-20 text-xs font-semibold text-gray-400 uppercase tracking-wider mt-0.5">HostName</span> 
                <span class="font-mono text-gray-800 bg-gray-50 px-1.5 py-0.5 rounded text-xs select-all">{{ host.HostName }}</span>
              </div>
              <div v-if="host.User" class="flex items-center">
                <span class="w-20 text-xs font-semibold text-gray-400 uppercase tracking-wider">User</span> 
                <span class="text-gray-800 font-medium">{{ host.User }}</span>
              </div>
              <div v-if="host.Port" class="flex items-center">
                <span class="w-20 text-xs font-semibold text-gray-400 uppercase tracking-wider">Port</span> 
                <span class="text-gray-800">{{ host.Port }}</span>
              </div>
              <div v-if="host.IdentityFile" class="flex items-center">
                <span class="w-20 text-xs font-semibold text-gray-400 uppercase tracking-wider">Identity</span> 
                <span class="truncate text-gray-500 text-xs" :title="host.IdentityFile">{{ host.IdentityFile }}</span>
              </div>
            </div>
            </div>
          </div>
        </template>
      </draggable>
      
      <div v-if="filteredHosts.length === 0 && !loading && !error" class="flex flex-col items-center justify-center py-16 text-gray-500 bg-white rounded-xl border-2 border-dashed border-gray-200">
        <div class="bg-gray-50 p-4 rounded-full mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
        <p class="font-medium text-lg">No hosts found</p>
        <p class="text-sm text-gray-400 mt-1">Try adjusting your search or add a new host.</p>
      </div>
    </div>

    <HostEditor :is-open="isEditorOpen" :initial-data="editingHost" @save="handleSave" @close="isEditorOpen = false" />
    
    <ConfirmDialog
      :is-open="confirmDialog.isOpen"
      :title="confirmDialog.title"
      :message="confirmDialog.message"
      :confirm-type="confirmDialog.confirmType"
      @confirm="handleConfirmDialogConfirm"
      @cancel="closeConfirmDialog"
    />
    
    <AlertDialog
      :is-open="alertDialog.isOpen"
      :title="alertDialog.title"
      :message="alertDialog.message"
      :type="alertDialog.type"
      @close="closeAlertDialog"
    />
  </div>
</template>

<style scoped>
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}
.slide-down-enter-from,
.slide-down-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
