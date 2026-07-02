<script setup>
  import { ref, onMounted, onUnmounted, computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import draggable from 'vuedraggable'
  import HostEditor from './components/HostEditor.vue'
  import ConfirmDialog from './components/ConfirmDialog.vue'
  import AlertDialog from './components/AlertDialog.vue'
  import ShareToggle from './components/ShareToggle.vue'
  import NetworkDiscovery from './components/NetworkDiscovery.vue'
  import { setLocale, translateError } from './i18n/index.js'

  const { t, locale } = useI18n()

  // 中英互切
  function toggleLocale() {
    setLocale(locale.value === 'zh-CN' ? 'en-US' : 'zh-CN')
  }

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

  // 网络分享相关状态
  const networkStatus = ref({})
  const sharedNodes = ref(new Set()) // 跟踪分享的节点
  const dropdownOpen = ref(null) // 跟踪当前打开的下拉菜单
  let unsubscribeNodeImported = null
  let unsubscribeSharingEnabled = null

  // 是否启用拖拽（搜索时禁用）
  const isDragEnabled = computed(() => !searchQuery.value)

  const filteredHosts = computed(() => {
    let result = hosts.value
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      result = result.filter(h =>
        h.Host.toLowerCase().includes(q) ||
        (h.HostName && h.HostName.toLowerCase().includes(q)) ||
        (h.Remark && h.Remark.toLowerCase().includes(q)) ||
        (h.User && h.User.toLowerCase().includes(q)) ||
        (h.Port && h.Port.toString().includes(q))
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
        error.value = t('app.apiUnavailable')
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
      // 编辑模式会带 originalHost，新增模式没有
      const isNew = !data.originalHost
      await window.sshApi.saveHost(data)
      isEditorOpen.value = false
      await loadHosts()
      // 新增节点在配置文件里仍是末尾追加，仅界面上移到列表最前便于查看
      if (isNew) {
        const idx = hosts.value.findIndex(h => h.Host === data.Host)
        if (idx > 0) {
          const [added] = hosts.value.splice(idx, 1)
          hosts.value.unshift(added)
        }
      }
    } catch (e) {
      showAlert(t('app.saveFailed'), e.message)
    }
  }

  async function handleDelete(hostName) {
    confirmDialog.value = {
      isOpen: true,
      title: t('app.deleteConfirmTitle'),
      message: t('app.deleteConfirmMessage', { name: hostName }),
      confirmType: 'danger',
      onConfirm: async () => {
        confirmDialog.value.isOpen = false
        try {
          await window.sshApi.deleteHost(hostName)
          await loadHosts()
        } catch (e) {
          showAlert(t('app.deleteFailed'), e.message)
        }
      }
    }
  }

  async function handleCopy(hostName) {
    confirmDialog.value = {
      isOpen: true,
      title: t('app.copyConfirmTitle'),
      message: t('app.copyConfirmMessage', { name: hostName }),
      confirmType: 'primary',
      onConfirm: async () => {
        confirmDialog.value.isOpen = false
        try {
          await window.sshApi.copyHost(hostName)
          await loadHosts()
        } catch (e) {
          showAlert(t('app.copyFailed'), e.message)
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

  // 处理分享状态变化
  function handleShareChanged(data) {
    console.log('Share status changed:', data)

    // 更新本地分享状态跟踪
    if (data.isShared) {
      sharedNodes.value.add(data.nodeId)
    } else {
      sharedNodes.value.delete(data.nodeId)
    }

    // 可以在这里更新UI或显示提示
  }

  async function handleSSHConnect(hostName) {
    try {
      // ssh:connect 始终返回结果对象（{success, code?, params?}），失败码由语言包映射
      const result = await window.sshApi.connect(hostName)
      if (result && result.success === false) {
        console.error('Failed to open SSH connection:', result)
        showAlert(t('app.connectFailed'), translateError(result))
        return
      }
      console.log(`SSH connection opened for ${hostName}`)
    } catch (error) {
      console.error('Failed to open SSH connection:', error)
      showAlert(t('app.connectFailed'), t('app.connectFailedMessage', { detail: error.message }))
    }
  }

  // 处理节点导入成功
  function handleNodeImported(data) {
    showAlert(t('app.importSuccessTitle'), t('app.importSuccessMessage', { name: data.importedNode.Host }), 'success')
    // 重新加载本地节点列表
    loadHosts()
  }

  // 处理分享功能被启用
  function handleSharingEnabled() {
    console.log('Sharing enabled, refreshing shared nodes status')
    // 重新获取网络状态和分享节点
    getNetworkStatus()
  }

  // 获取网络状态和分享节点
  async function getNetworkStatus() {
    try {
      if (window.networkApi) {
        networkStatus.value = await window.networkApi.getStatus()

        // 获取当前分享的节点配置状态（持久化的状态）
        const sharedNodesConfig = await window.networkApi.getSharedNodesConfig()
        sharedNodes.value = new Set(sharedNodesConfig.map(node => node.id))
      }
    } catch (error) {
      console.error('Failed to get network status:', error)
    }
  }

  onMounted(async () => {
    loadHosts()

    // 获取当前版本
    if (window.updaterApi) {
      currentVersion.value = await window.updaterApi.getVersion()
      if (window.updaterApi.getDebugInfo) {
        const debugInfo = await window.updaterApi.getDebugInfo()
        console.log('Updater debug info:', debugInfo)
      }
      // 监听更新状态，保存取消订阅函数
      unsubscribeUpdateStatus = window.updaterApi.onUpdateStatus(handleUpdateStatus)
    }

    // 获取网络状态
    await getNetworkStatus()

    // 监听节点导入事件
    if (window.networkApi) {
      unsubscribeNodeImported = window.networkApi.onNodeImported(handleNodeImported)
      unsubscribeSharingEnabled = window.networkApi.onSharingEnabled(handleSharingEnabled)
    }

  })

  onUnmounted(() => {
    // 清理监听器 - 只移除当前组件注册的监听器
    if (unsubscribeUpdateStatus) {
      unsubscribeUpdateStatus()
      unsubscribeUpdateStatus = null
    }
    if (unsubscribeNodeImported) {
      unsubscribeNodeImported()
      unsubscribeNodeImported = null
    }
    if (unsubscribeSharingEnabled) {
      unsubscribeSharingEnabled()
      unsubscribeSharingEnabled = null
    }

  })

  // hover 打开下拉菜单
  function openDropdown(hostName) {
    dropdownOpen.value = hostName
  }

  // 点击切换下拉菜单（触屏/可访问性场景）
  function toggleDropdown(hostName) {
    dropdownOpen.value = dropdownOpen.value === hostName ? null : hostName
  }

  // 关闭下拉菜单
  function closeDropdown() {
    dropdownOpen.value = null
  }

  // 获取节点状态圆点的颜色类
  function getNodeStatusClass(host) {
    if (sharedNodes.value.has(host.Host)) {
      return 'w-2 h-2 rounded-full bg-blue-400 shrink-0'
    }
    return 'w-2 h-2 rounded-full bg-green-400 shrink-0'
  }
</script>

<template>
  <div class="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-blue-100 selection:text-blue-900">
    <!-- 更新提示横幅 -->
    <Transition name="slide-down">
      <div v-if="showUpdateBanner" class="bg-linear-to-r from-blue-600 to-indigo-600 text-white">
        <div class="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24"
              stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span class="text-sm">
              <i18n-t v-if="updateStatus === 'available'" keypath="update.available" tag="span">
                <template #version><strong>v{{ updateInfo.version }}</strong></template>
              </i18n-t>
              <template v-else-if="updateStatus === 'downloading'">
                {{ $t('update.downloading', { percent: downloadProgress }) }}
              </template>
              <template v-else-if="updateStatus === 'downloaded'">
                {{ $t('update.downloaded') }}
              </template>
            </span>
          </div>
          <div class="flex items-center gap-2">
            <template v-if="updateStatus === 'available'">
              <button @click="downloadUpdate"
                class="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-md text-sm font-medium transition">
                {{ $t('update.download') }}
              </button>
            </template>
            <template v-else-if="updateStatus === 'downloading'">
              <div class="w-32 h-2 bg-white/20 rounded-full overflow-hidden">
                <div class="h-full bg-white transition-all duration-300" :style="{ width: downloadProgress + '%' }">
                </div>
              </div>
            </template>
            <template v-else-if="updateStatus === 'downloaded'">
              <button @click="installUpdate"
                class="bg-white text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-md text-sm font-medium transition">
                {{ $t('update.restartNow') }}
              </button>
            </template>
            <button @click="dismissUpdateBanner" class="p-1 hover:bg-white/20 rounded transition" :title="$t('update.later')">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24"
                stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <div class="max-w-full mx-auto p-6 md:p-10">
      <header class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 class="text-3xl font-bold text-gray-900 tracking-tight">SSH Config Manager</h1>
          <p class="text-gray-500 text-sm mt-1 flex items-center gap-2">
            {{ $t('app.subtitle') }}
            <span v-if="currentVersion" @dblclick="checkForUpdates" class="text-xs text-gray-400">v{{
              currentVersion
              }}</span>
            <button @click="toggleLocale" :title="$t('app.switchLanguage')" type="button"
              class="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {{ locale === 'zh-CN' ? '中文' : 'EN' }}
            </button>
          </p>
        </div>
        <button @click="openAdd"
          class="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-5 py-2.5 rounded-lg shadow-sm hover:shadow flex items-center gap-2 transition font-medium">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd"
              d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
              clip-rule="evenodd" />
          </svg>
          {{ $t('app.newHost') }}
        </button>
      </header>

      <div class="mb-8 relative group">
        <input v-model="searchQuery" type="text" :placeholder="$t('app.searchPlaceholder')"
          class="w-full pl-12 pr-12 py-3 rounded-xl border border-gray-200 bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-gray-700 placeholder-gray-400" />
        <span class="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-blue-500 transition">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </span>
        <button v-if="searchQuery" @click="searchQuery = ''"
          class="absolute right-6 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition"
          type="button" :title="$t('app.clearSearch')">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clip-rule="evenodd" />
          </svg>
        </button>
      </div>

      <!-- 网络分享组件 -->
      <div class="mb-8">
        <NetworkDiscovery @node-imported="handleNodeImported" />
      </div>

      <div v-if="loading" class="text-center py-20">
        <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p class="text-gray-500">{{ $t('app.loadingConfigs') }}</p>
      </div>

      <div v-else-if="error" class="text-center py-20 bg-red-50 rounded-xl border border-red-100">
        <p class="text-red-600 font-medium">{{ error }}</p>
      </div>

      <draggable v-else v-model="hosts" item-key="Host" handle=".drag-handle" :disabled="!isDragEnabled"
        ghost-class="opacity-40" chosen-class="shadow-lg" drag-class="shadow-2xl" animation="200"
        class="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 lg:gap-2 xl:gap-1" @end="handleDragEnd">
        <template #item="{ element: host }">
          <div v-show="!searchQuery || filteredHosts.some(h => h.Host === host.Host)"
            class="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 transition group flex">
            <!-- 拖拽手柄 -->
            <div v-if="isDragEnabled"
              class="drag-handle w-6 shrink-0 flex items-center justify-center rounded-l-xl bg-gray-50 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing hover:bg-gray-100">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400" viewBox="0 0 24 24"
                fill="currentColor">
                <circle cx="9" cy="5" r="1.5" />
                <circle cx="15" cy="5" r="1.5" />
                <circle cx="9" cy="12" r="1.5" />
                <circle cx="15" cy="12" r="1.5" />
                <circle cx="9" cy="19" r="1.5" />
                <circle cx="15" cy="19" r="1.5" />
              </svg>
            </div>

            <div class="flex-1 p-5 flex flex-col min-w-0">
              <div class="flex justify-between items-start mb-4 border-b border-gray-50">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <div :class="getNodeStatusClass(host)"></div>
                    <h3 class="text-lg font-bold text-gray-800 truncate" :title="host.Host">{{ host.Host }}</h3>
                  </div>
                  <p v-if="host.Remark" class="text-xs text-gray-400 mt-1 ml-4 truncate" :title="host.Remark">{{
                    host.Remark }}</p>
                </div>
                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <!-- 始终显示的SSH连接按钮 -->
                  <button @click="handleSSHConnect(host.Host)"
                    class="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md transition"
                    :title="$t('app.sshConnect')">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24"
                      stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </button>

                  <!-- 大屏幕时显示的完整按钮组 -->
                  <div class="xl:hidden flex items-center gap-1">
                    <ShareToggle :node-id="host.Host" :node-data="host" @share-changed="handleShareChanged" />
                    <button @click="openEdit(host)"
                      class="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition" :title="$t('app.edit')">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24"
                        stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button @click="handleCopy(host.Host)"
                      class="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md transition"
                      :title="$t('app.copy')">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24"
                        stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                    <button @click="handleDelete(host.Host)"
                      class="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition" :title="$t('app.delete')">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24"
                        stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  <!-- 小屏幕时显示的下拉菜单 -->
                  <div class="hidden xl:flex relative" @mouseenter="openDropdown(host.Host)" @mouseleave="closeDropdown">
                    <button @click.stop="toggleDropdown(host.Host)"
                      class="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md transition"
                      :title="$t('app.moreActions')">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24"
                        stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>

                    <!-- 下拉菜单 -->
                    <Transition name="dropdown">
                      <div v-if="dropdownOpen === host.Host" @click.stop
                        class="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 min-w-[120px]">
                        <div class="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                          <span class="text-xs text-gray-600">{{ $t('app.shareStatus') }}</span>
                          <ShareToggle :node-id="host.Host" :node-data="host" @share-changed="handleShareChanged" />
                        </div>
                        <button @click="openEdit(host); dropdownOpen = null"
                          class="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24"
                            stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                          {{ $t('app.edit') }}
                        </button>
                        <button @click="handleCopy(host.Host); dropdownOpen = null"
                          class="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24"
                            stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          {{ $t('app.copy') }}
                        </button>
                        <button @click="handleDelete(host.Host); dropdownOpen = null"
                          class="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24"
                            stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          {{ $t('app.delete') }}
                        </button>
                      </div>
                    </Transition>
                  </div>
                </div>
              </div>

              <div class="text-sm text-gray-600 space-y-2.5 grow">
                <div v-if="host.HostName" class="flex items-start">
                  <span class="w-20 text-xs font-semibold text-gray-400 uppercase tracking-wider mt-0.5">{{ $t('app.fields.hostName') }}</span>
                  <span class="font-mono text-gray-800 bg-gray-50 px-1.5 py-0.5 rounded text-xs select-all">{{
                    host.HostName }}</span>
                </div>
                <div v-if="host.User" class="flex items-center">
                  <span class="w-20 text-xs font-semibold text-gray-400 uppercase tracking-wider">{{ $t('app.fields.user') }}</span>
                  <span class="text-gray-800 font-medium">{{ host.User }}</span>
                </div>
                <div v-if="host.Port" class="flex items-center">
                  <span class="w-20 text-xs font-semibold text-gray-400 uppercase tracking-wider">{{ $t('app.fields.port') }}</span>
                  <span class="text-gray-800">{{ host.Port }}</span>
                </div>
                <div v-if="host.IdentityFile" class="flex items-center">
                  <span class="w-20 text-xs font-semibold text-gray-400 uppercase tracking-wider">{{ $t('app.fields.identity') }}</span>
                  <span class="truncate text-gray-500 text-xs" :title="host.IdentityFile">{{ host.IdentityFile }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </draggable>

      <div v-if="filteredHosts.length === 0 && !loading && !error"
        class="flex flex-col items-center justify-center py-16 text-gray-500 bg-white rounded-xl border-2 border-dashed border-gray-200">
        <div class="bg-gray-50 p-4 rounded-full mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24"
            stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
        <p class="font-medium text-lg">{{ $t('app.noHosts') }}</p>
        <p class="text-sm text-gray-400 mt-1">{{ $t('app.noHostsHint') }}</p>
      </div>
    </div>

    <HostEditor :is-open="isEditorOpen" :initial-data="editingHost" @save="handleSave" @close="isEditorOpen = false" />

    <ConfirmDialog :is-open="confirmDialog.isOpen" :title="confirmDialog.title" :message="confirmDialog.message"
      :confirm-type="confirmDialog.confirmType" @confirm="handleConfirmDialogConfirm" @cancel="closeConfirmDialog" />

    <AlertDialog :is-open="alertDialog.isOpen" :title="alertDialog.title" :message="alertDialog.message"
      :type="alertDialog.type" @close="closeAlertDialog" />
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

  .dropdown-enter-active,
  .dropdown-leave-active {
    transition: all 0.2s ease;
  }

  .dropdown-enter-from,
  .dropdown-leave-to {
    opacity: 0;
    transform: translateY(-10px) scale(0.95);
  }
</style>