<script setup>
import { ref, watch, computed, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { translateError } from '../i18n/index.js'

const { t } = useI18n()

const props = defineProps({
  isOpen: Boolean,
  initialData: Object
})

const emit = defineEmits(['save', 'close'])

const form = ref({
  Host: '',
  Remark: '',
  HostName: '',
  User: '',
  Port: '',
  IdentityFile: ''
})

const errors = ref({})

// Copy ID 临时密码：刻意不放进 form，从结构上保证不会进入 save payload / 配置文件
const password = ref('')
const copying = ref(false)
// 失败信息存主进程返回的 { code, params, message } 对象（或 { message }），
// 渲染时经 translateError 映射，切换语言后实时更新
const copyError = ref(null)
const copyErrorText = computed(() => translateError(copyError.value))
// 密码明文显示开关
const showPassword = ref(false)

// Host 输入框引用，用于自动聚焦
const hostInputRef = ref(null)

// 是否为编辑模式
const isEditMode = computed(() => !!props.initialData)

// IdentityFile 下拉选项：来自 ~/.ssh 下的 .pub 公钥（不带 .pub 后缀）
const identityFiles = ref([])
const identityLoading = ref(false)
const generating = ref(false)
const generateError = ref(null)
const generateErrorText = computed(() => translateError(generateError.value))

// 编辑历史配置时当前值可能不在 ~/.ssh 列表中（如自定义路径），补进选项避免回显丢失
const identityOptions = computed(() => {
  const opts = [...identityFiles.value]
  if (form.value.IdentityFile && !opts.includes(form.value.IdentityFile)) {
    opts.unshift(form.value.IdentityFile)
  }
  return opts
})

async function loadIdentityFiles() {
  if (!window.sshApi || !window.sshApi.listKeys) {
    return
  }
  identityLoading.value = true
  try {
    identityFiles.value = await window.sshApi.listKeys()
  } catch (e) {
    console.error('Failed to load identity files:', e)
  } finally {
    identityLoading.value = false
  }
}

// 调用 ssh-keygen 生成默认密钥，成功后刷新下拉列表并选中新密钥
async function generateIdentityKey() {
  if (!window.sshApi || !window.sshApi.generateKey) {
    generateError.value = { message: t('hostEditor.apiUnavailable') }
    return
  }
  generateError.value = null
  generating.value = true
  try {
    const result = await window.sshApi.generateKey()
    if (result && result.success) {
      await loadIdentityFiles()
      form.value.IdentityFile = result.keyPath || form.value.IdentityFile
    } else {
      generateError.value = result || { code: 'unknown' }
    }
  } catch (e) {
    generateError.value = { message: e.message }
  } finally {
    generating.value = false
  }
}

// 启动时预加载一次，弹窗每次打开时再刷新
loadIdentityFiles()

// 验证 IP 地址格式
function isValidIP(str) {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
  if (!ipv4Regex.test(str)) return false
  const parts = str.split('.')
  return parts.every(part => {
    const num = parseInt(part, 10)
    return num >= 0 && num <= 255
  })
}

// 验证域名格式
function isValidDomain(str) {
  const domainRegex = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z0-9-]{1,63})*$/
  return domainRegex.test(str)
}

// 验证 HostName（IP 或域名）
function isValidHostName(str) {
  if (!str) return false
  return isValidIP(str) || isValidDomain(str)
}

// 验证表单。errors 里存语言包 key（模板中 $t() 渲染），切换语言时报错信息实时更新
function validate() {
  const errs = {}

  // Host: 必填，不超过50字符，且不能包含空格/通配字符
  // （"Host a b" 在 SSH 中是多个 pattern，会导致条目无法编辑/删除；
  //   编辑模式下未改动的历史值放行，保证旧条目仍可修改其他字段或删除）
  const originalHost = (props.initialData && props.initialData.Host) || ''
  if (!form.value.Host) {
    errs.Host = 'hostEditor.validation.hostRequired'
  } else if (form.value.Host.length > 50) {
    errs.Host = 'hostEditor.validation.hostTooLong'
  } else if (/\s/.test(form.value.Host) && form.value.Host !== originalHost) {
    errs.Host = 'hostEditor.validation.hostNoSpaces'
  } else if (/[*?!]/.test(form.value.Host) && form.value.Host !== originalHost) {
    errs.Host = 'hostEditor.validation.hostNoWildcards'
  }

  // HostName: 必填，需符合 IP 或域名格式，不超过50字符
  if (!form.value.HostName) {
    errs.HostName = 'hostEditor.validation.hostNameRequired'
  } else if (form.value.HostName.length > 50) {
    errs.HostName = 'hostEditor.validation.hostNameTooLong'
  } else if (!isValidHostName(form.value.HostName)) {
    errs.HostName = 'hostEditor.validation.hostNameInvalid'
  }

  // User: 编辑模式下必填，新增模式下可空（保存时默认 root）
  if (isEditMode.value) {
    if (!form.value.User) {
      errs.User = 'hostEditor.validation.userRequired'
    } else if (form.value.User.length > 50) {
      errs.User = 'hostEditor.validation.userTooLong'
    }
  } else {
    if (form.value.User && form.value.User.length > 50) {
      errs.User = 'hostEditor.validation.userTooLong'
    }
  }

  // Port: 可不填，默认 22
  if (isEditMode.value) {
    if (!form.value.Port) {
      form.value.Port = ''
    } else {
      const portNum = parseInt(form.value.Port, 10)
      if (isNaN(portNum) || !/^\d+$/.test(form.value.Port)) {
        errs.Port = 'hostEditor.validation.portInvalid'
      } else if (portNum < 1 || portNum > 65535) {
        errs.Port = 'hostEditor.validation.portRange'
      }
    }
  } else {
    if (form.value.Port) {
      const portNum = parseInt(form.value.Port, 10)
      if (isNaN(portNum) || !/^\d+$/.test(form.value.Port)) {
        errs.Port = 'hostEditor.validation.portInvalid'
      } else if (portNum < 1 || portNum > 65535) {
        errs.Port = 'hostEditor.validation.portRange'
      }
    }
  }

  // IdentityFile: 可选，不超过255字符
  if (form.value.IdentityFile && form.value.IdentityFile.length > 255) {
    errs.IdentityFile = 'hostEditor.validation.identityTooLong'
  }

  // Remark: 可选，不超过255字符
  if (form.value.Remark && form.value.Remark.length > 255) {
    errs.Remark = 'hostEditor.validation.remarkTooLong'
  }

  errors.value = errs
  return Object.keys(errs).length === 0
}

// 监听弹窗打开状态，在打开时根据 initialData 填充表单
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    errors.value = {}
    password.value = ''
    showPassword.value = false
    copying.value = false
    copyError.value = null
    generateError.value = null
    loadIdentityFiles()
    const data = props.initialData
    if (data) {
      form.value = {
        Host: data.Host || '',
        Remark: data.Remark || '',
        HostName: data.HostName || '',
        User: data.User || '',
        Port: data.Port || '',
        IdentityFile: data.IdentityFile || ''
      }
    } else {
      form.value = {
        Host: '',
        Remark: '',
        HostName: '',
        User: '',
        Port: '',
        IdentityFile: ''
      }
    }
    // 等待 DOM 更新和过渡动画完成后聚焦到第一个输入框
    nextTick(() => {
      setTimeout(() => {
        hostInputRef.value?.focus()
      }, 50)
    })
  }
}, { immediate: true })

// 新增模式下实时把 Host 中的空白替换为短横杠（输入或粘贴时即生效）
watch(() => form.value.Host, (val) => {
  if (!isEditMode.value && val && /\s/.test(val)) {
    form.value.Host = val.replace(/\s+/g, '-')
  }
})

const title = computed(() => props.initialData ? t('hostEditor.titleEdit') : t('hostEditor.titleNew'))

function save() {
  if (!validate()) {
    return
  }
  // Pass originalHost to track renames
  const payload = { ...form.value }
  
  // 新增模式下，User 为空时默认 root
  if (!isEditMode.value && !payload.User) {
    payload.User = 'root'
  }
  // 新增模式下，Port 为空时默认 22
  if (!isEditMode.value && !payload.Port) {
    payload.Port = ''
  }
  
  if (props.initialData) {
    payload.originalHost = props.initialData.Host
  }
  emit('save', payload)
}

// User / IdentityFile / Password 任一为空时禁用 Copy ID（拷贝公钥三者缺一不可）
const canCopyId = computed(() =>
  !!(form.value.User && form.value.IdentityFile && password.value)
)

// 拷贝公钥到远程主机（ssh-copy-id 等价实现，仅新增模式）
// 成功后直接走 save 逻辑；密码仅本次使用，不进入 save payload
async function copyId() {
  copyError.value = null
  const ok = validate()
  if (!password.value) {
    errors.value = { ...errors.value, Password: 'hostEditor.validation.passwordRequired' }
  }
  if (!ok || !password.value) {
    return
  }
  if (!window.sshApi || !window.sshApi.copyId) {
    copyError.value = { message: t('hostEditor.apiUnavailable') }
    return
  }

  copying.value = true
  try {
    const result = await window.sshApi.copyId({
      host: form.value.HostName,
      // 与 save 相同的默认值语义：Port 默认 22，User 默认 root
      port: form.value.Port || 22,
      username: form.value.User || 'root',
      password: password.value,
      identityFile: form.value.IdentityFile
    })
    if (result && result.success) {
      // 拷贝成功，直接执行保存逻辑（payload 不含密码）
      save()
    } else {
      copyError.value = result || { code: 'unknown' }
    }
  } catch (e) {
    copyError.value = { message: e.message }
  } finally {
    copying.value = false
  }
}

// 清空指定字段
function clearField(field) {
  form.value[field] = ''
}

// 输入框样式：根据是否有错误显示不同边框颜色
function inputClass(field) {
  const base = 'w-full rounded-lg border pl-3 pr-8 py-2 text-gray-900 outline-none transition'
  if (errors.value[field]) {
    return `${base} border-red-400 bg-red-50 focus:border-red-500 focus:ring-2 focus:ring-red-100`
  }
  return `${base} border-gray-200 bg-gray-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100`
}</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm" @click.self="!copying && $emit('close')">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 transform transition-all">
      <h2 class="text-xl font-bold mb-4 text-gray-800">{{ title }}</h2>
      
      <div class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            {{ $t('hostEditor.labels.host') }} <span class="text-red-400">*</span>
          </label>
          <div class="relative group">
            <input ref="hostInputRef" v-model="form.Host" type="text" maxlength="50" :class="inputClass('Host')" :placeholder="$t('hostEditor.placeholders.host')" />
            <button
              v-show="form.Host"
              type="button"
              @click="clearField('Host')"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
          <p v-if="errors.Host" class="text-xs text-red-500 mt-1">{{ $t(errors.Host) }}</p>
        </div>
        
        <div>
          <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            {{ $t('hostEditor.labels.hostName') }} <span class="text-red-400">*</span>
          </label>
          <div class="relative group">
            <input v-model="form.HostName" type="text" maxlength="50" :class="inputClass('HostName')" :placeholder="$t('hostEditor.placeholders.hostName')" />
            <button
              v-show="form.HostName"
              type="button"
              @click="clearField('HostName')"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
          <p v-if="errors.HostName" class="text-xs text-red-500 mt-1">{{ $t(errors.HostName) }}</p>
        </div>
        
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              {{ $t('hostEditor.labels.user') }} <span v-if="isEditMode" class="text-red-400">*</span>
            </label>
            <div class="relative group">
              <input v-model="form.User" type="text" maxlength="50" :class="inputClass('User')" :placeholder="isEditMode ? $t('hostEditor.placeholders.user') : $t('hostEditor.placeholders.userDefault')" />
              <button
                v-show="form.User"
                type="button"
                @click="clearField('User')"
                class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>
            <p v-if="errors.User" class="text-xs text-red-500 mt-1">{{ $t(errors.User) }}</p>
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              {{ $t('hostEditor.labels.port') }}
            </label>
            <div class="relative group">
              <input v-model="form.Port" type="text" maxlength="5" :class="inputClass('Port')" :placeholder="isEditMode ? $t('hostEditor.placeholders.port') : $t('hostEditor.placeholders.portDefault')" />
              <button
                v-show="form.Port"
                type="button"
                @click="clearField('Port')"
                class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>
            <p v-if="errors.Port" class="text-xs text-red-500 mt-1">{{ $t(errors.Port) }}</p>
          </div>
        </div>
        
        <div>
          <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{{ $t('hostEditor.labels.identityFile') }}</label>
          <div class="flex items-stretch gap-2">
            <select v-model="form.IdentityFile" :class="inputClass('IdentityFile')">
              <option value="">{{ $t('hostEditor.noKeyOption') }}</option>
              <option v-for="key in identityOptions" :key="key" :value="key">{{ key }}</option>
            </select>
            <button
              v-if="!identityLoading && identityFiles.length === 0"
              type="button"
              @click="generateIdentityKey"
              :disabled="generating"
              class="shrink-0 px-3 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {{ generating ? $t('hostEditor.generating') : $t('hostEditor.generateKey') }}
            </button>
          </div>
          <p v-if="errors.IdentityFile" class="text-xs text-red-500 mt-1">{{ $t(errors.IdentityFile) }}</p>
          <p v-else-if="generateErrorText" class="text-xs text-red-500 mt-1 break-all">{{ $t('hostEditor.keygenFailed', { msg: generateErrorText }) }}</p>
        </div>

        <div v-if="!isEditMode">
          <div class="flex items-center gap-2 mb-1">
            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider">{{ $t('hostEditor.labels.password') }}</label>
            <button
              type="button"
              @click="showPassword = !showPassword"
              :title="showPassword ? $t('hostEditor.hidePassword') : $t('hostEditor.showPassword')"
              class="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg v-if="!showPassword" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
              </svg>
            </button>
          </div>
          <div class="relative group">
            <input v-model="password" :type="showPassword ? 'text' : 'password'" :maxlength="128" :class="inputClass('Password')" :placeholder="$t('hostEditor.placeholders.password')" autocomplete="new-password" />
            <button
              v-show="password"
              type="button"
              @click="password = ''"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
          <p v-if="errors.Password" class="text-xs text-red-500 mt-1">{{ $t(errors.Password) }}</p>
          <p v-else class="text-xs text-gray-400 mt-1">{{ $t('hostEditor.passwordHint') }}</p>
        </div>

        <div>
          <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{{ $t('hostEditor.labels.remark') }}</label>
          <div class="relative group">
            <input v-model="form.Remark" type="text" :maxlength="255" :class="inputClass('Remark')" :placeholder="$t('hostEditor.placeholders.remark')" />
            <button
              v-show="form.Remark"
              type="button"
              @click="clearField('Remark')"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
          <p v-if="errors.Remark" class="text-xs text-red-500 mt-1">{{ $t(errors.Remark) }}</p>
        </div>
      </div>
      
      <div v-if="copyErrorText" class="mt-6 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600 break-all">
        {{ $t('hostEditor.copyIdFailed', { msg: copyErrorText }) }}
      </div>

      <div class="mt-8 flex justify-end space-x-3">
        <button @click="$emit('close')" :disabled="copying" class="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition disabled:opacity-60 disabled:cursor-not-allowed">{{ $t('common.cancel') }}</button>
        <button v-if="!isEditMode" @click="copyId" :disabled="copying || !canCopyId" :title="canCopyId ? '' : $t('hostEditor.copyIdHint')" class="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow-sm transition disabled:opacity-60 disabled:cursor-not-allowed">{{ copying ? $t('hostEditor.copying') : $t('hostEditor.copyId') }}</button>
        <button @click="save" :disabled="copying" class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition disabled:opacity-60 disabled:cursor-not-allowed">{{ $t('common.save') }}</button>
      </div>
    </div>
  </div>
</template>
