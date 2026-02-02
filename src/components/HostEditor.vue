<script setup>
import { ref, watch, computed, nextTick } from 'vue'

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

// Host 输入框引用，用于自动聚焦
const hostInputRef = ref(null)

// 是否为编辑模式
const isEditMode = computed(() => !!props.initialData)

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

// 验证表单
function validate() {
  const errs = {}

  // Host: 必填，不超过50字符
  if (!form.value.Host) {
    errs.Host = 'Host 为必填项'
  } else if (form.value.Host.length > 50) {
    errs.Host = 'Host 长度不能超过50字符'
  }

  // HostName: 必填，需符合 IP 或域名格式，不超过50字符
  if (!form.value.HostName) {
    errs.HostName = 'HostName 为必填项'
  } else if (form.value.HostName.length > 50) {
    errs.HostName = 'HostName 长度不能超过50字符'
  } else if (!isValidHostName(form.value.HostName)) {
    errs.HostName = 'HostName 必须是有效的 IP 或域名格式'
  }

  // User: 编辑模式下必填，新增模式下可空（保存时默认 root）
  if (isEditMode.value) {
    if (!form.value.User) {
      errs.User = 'User 为必填项'
    } else if (form.value.User.length > 50) {
      errs.User = 'User 长度不能超过50字符'
    }
  } else {
    if (form.value.User && form.value.User.length > 50) {
      errs.User = 'User 长度不能超过50字符'
    }
  }

  // Port: 可不填，默认 22
  if (isEditMode.value) {
    if (!form.value.Port) {
      form.value.Port = ''
    } else {
      const portNum = parseInt(form.value.Port, 10)
      if (isNaN(portNum) || !/^\d+$/.test(form.value.Port)) {
        errs.Port = 'Port 必须为数字'
      } else if (portNum < 1 || portNum > 65535) {
        errs.Port = 'Port 必须在 1-65535 之间'
      }
    }
  } else {
    if (form.value.Port) {
      const portNum = parseInt(form.value.Port, 10)
      if (isNaN(portNum) || !/^\d+$/.test(form.value.Port)) {
        errs.Port = 'Port 必须为数字'
      } else if (portNum < 1 || portNum > 65535) {
        errs.Port = 'Port 必须在 1-65535 之间'
      }
    }
  }

  // IdentityFile: 可选，不超过255字符
  if (form.value.IdentityFile && form.value.IdentityFile.length > 255) {
    errs.IdentityFile = 'IdentityFile 长度不能超过255字符'
  }

  // Remark: 可选，不超过255字符
  if (form.value.Remark && form.value.Remark.length > 255) {
    errs.Remark = 'Remark 长度不能超过255字符'
  }

  errors.value = errs
  return Object.keys(errs).length === 0
}

// 监听弹窗打开状态，在打开时根据 initialData 填充表单
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    errors.value = {}
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

const title = computed(() => props.initialData ? 'Edit Host' : 'New Host')

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
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm" @click.self="$emit('close')">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 transform transition-all">
      <h2 class="text-xl font-bold mb-4 text-gray-800">{{ title }}</h2>
      
      <div class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Host (Alias) <span class="text-red-400">*</span>
          </label>
          <div class="relative group">
            <input ref="hostInputRef" v-model="form.Host" type="text" maxlength="50" :class="inputClass('Host')" placeholder="myserver" />
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
          <p v-if="errors.Host" class="text-xs text-red-500 mt-1">{{ errors.Host }}</p>
        </div>
        
        <div>
          <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            HostName (IP/Domain) <span class="text-red-400">*</span>
          </label>
          <div class="relative group">
            <input v-model="form.HostName" type="text" maxlength="50" :class="inputClass('HostName')" placeholder="192.168.1.1" />
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
          <p v-if="errors.HostName" class="text-xs text-red-500 mt-1">{{ errors.HostName }}</p>
        </div>
        
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              User <span v-if="isEditMode" class="text-red-400">*</span>
            </label>
            <div class="relative group">
              <input v-model="form.User" type="text" maxlength="50" :class="inputClass('User')" :placeholder="isEditMode ? 'root' : 'root (默认)'" />
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
            <p v-if="errors.User" class="text-xs text-red-500 mt-1">{{ errors.User }}</p>
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Port
            </label>
            <div class="relative group">
              <input v-model="form.Port" type="text" maxlength="5" :class="inputClass('Port')" :placeholder="isEditMode ? '22' : '22 (默认)'" />
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
            <p v-if="errors.Port" class="text-xs text-red-500 mt-1">{{ errors.Port }}</p>
          </div>
        </div>
        
        <div>
          <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">IdentityFile (Key Path)</label>
          <div class="relative group">
            <input v-model="form.IdentityFile" type="text" :maxlength="255" :class="inputClass('IdentityFile')" placeholder="~/.ssh/id_rsa" />
            <button
              v-show="form.IdentityFile"
              type="button"
              @click="clearField('IdentityFile')"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
          <p v-if="errors.IdentityFile" class="text-xs text-red-500 mt-1">{{ errors.IdentityFile }}</p>
        </div>

        <div>
          <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Remark</label>
          <div class="relative group">
            <input v-model="form.Remark" type="text" :maxlength="255" :class="inputClass('Remark')" placeholder="例如：生产环境主服务器" />
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
          <p v-if="errors.Remark" class="text-xs text-red-500 mt-1">{{ errors.Remark }}</p>
        </div>
      </div>
      
      <div class="mt-8 flex justify-end space-x-3">
        <button @click="$emit('close')" class="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition">Cancel</button>
        <button @click="save" class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition">Save</button>
      </div>
    </div>
  </div>
</template>
