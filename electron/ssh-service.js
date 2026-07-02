import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { spawn } from 'node:child_process'
import SSHConfig from 'ssh-config'

const SSH_DIR = path.join(os.homedir(), '.ssh')
const CONFIG_PATH = path.join(SSH_DIR, 'config')

// Standardize keys for frontend consistency
const KEY_MAPPING = {
  'hostname': 'HostName',
  'user': 'User',
  'port': 'Port',
  'identityfile': 'IdentityFile',
  'remark': 'Remark'
}

// init content for ~/.ssh/config
const INIT_CONTENT = 'IgnoreUnknown Remark' + os.EOL.repeat(3)

async function ensureConfigExists() {
  try {
    console.log('Checking if config file exists:', CONFIG_PATH)
    await fs.access(CONFIG_PATH)
  } catch {
    try {
      await fs.mkdir(SSH_DIR, { recursive: true })
      await fs.writeFile(CONFIG_PATH, INIT_CONTENT, 'utf8')
    } catch (err) {
      console.error('Failed to create config file:', err)
    }
  }
}

function parseConfig(content) {
  return SSHConfig.parse(content)
}

function updateSectionProp(sectionConfig, param, value) {
  // Case-insensitive search for the parameter
  const lineIndex = sectionConfig.findIndex(line => line.param && line.param.toLowerCase() === param.toLowerCase())

  if (value) {
    if (lineIndex > -1) {
      sectionConfig[lineIndex].value = value
    } else {
      // 获取现有属性的缩进格式，保持一致
      const existingLine = sectionConfig.find(l => l.type === TYPE_DIRECTIVE)
      const indent = existingLine?.before || '  '
      // 手动构造新行，确保缩进正确
      sectionConfig.push({
        type: TYPE_DIRECTIVE,
        param,
        separator: ' ',
        value,
        before: indent,
        after: os.EOL
      })
    }
  } else if (lineIndex > -1) {
    // If value is empty/null and line exists, remove it using splice
    sectionConfig.splice(lineIndex, 1)
  }
}

// ssh-config 库的类型常量
const TYPE_DIRECTIVE = 1

// Host 行可能包含多个 pattern（如 "Host a b"），ssh-config 会解析为对象数组；
// 统一归一化为空格分隔的字符串。避免数组值流向渲染进程——Vue 响应式 Proxy
// 包装的数组无法通过 IPC 结构化克隆（"An object could not be cloned"），
// 且数组与字符串直接 === 比较永远不等，导致条目无法编辑/删除
function hostValueToString(value) {
  if (Array.isArray(value)) {
    return value.map(v => (v && typeof v === 'object' ? v.val : v)).join(' ')
  }
  return value
}

export async function getAll() {
  await ensureConfigExists()
  let isInit = false
  let config = []
  try {
    const content = await fs.readFile(CONFIG_PATH, 'utf8')
    console.log('Read config file length:', content.length)

    config = parseConfig(content)
    const hosts = []
    for (const section of config) {
      
      if(!section.param){
        continue
      }
      const param = section.param.toLowerCase()
      if (param === 'host') {
        const hostData = {
          Host: hostValueToString(section.value),
        }

        if (section.config) {
          for (const line of section.config) {
            if (line.type === TYPE_DIRECTIVE) {
              const lowerParam = line.param.toLowerCase()
              const normalizedParam = KEY_MAPPING[lowerParam] || line.param
              hostData[normalizedParam] = line.value
            }
          }
        }
        hosts.push(hostData)
      }else if(param === 'ignoreunknown'){
        isInit = true
      }
    }

    console.log('Parsed hosts count:', hosts.length)
    return hosts
  } catch (err) {
    console.error('Error reading/parsing config:', err)
    return []
  } finally {
    if(config.length && !isInit){
      const initBlock = SSHConfig.parse(INIT_CONTENT)
      config.unshift(initBlock[0])
      fs.writeFile(CONFIG_PATH, SSHConfig.stringify(config), 'utf8')
    }
  }
}

export async function saveHost(hostData) {
  await ensureConfigExists()
  const content = await fs.readFile(CONFIG_PATH, 'utf8')
  const config = parseConfig(content)

  const targetHost = hostData.originalHost
  // Find existing section
  const section = targetHost
    ? config.find(entry => entry.param && entry.param.toLowerCase() === 'host' && hostValueToString(entry.value) === targetHost)
    : null

  if (section) {
    // Update existing Host（与归一化值比较；未改名时不动 value，保留原有的多 pattern 结构）
    if (hostData.Host && hostData.Host !== hostValueToString(section.value)) {
      section.value = hostData.Host
    }

    const props = ['HostName', 'User', 'Port', 'IdentityFile', 'Remark']
    props.forEach(prop => {
      updateSectionProp(section.config, prop, hostData[prop])
    })

  } else {
    // Add new Host - 通过字符串解析避免 append 方法的自动缩进问题
    const newLines = ['', `Host ${hostData.Host}`]
    const props = ['HostName', 'User', 'Port', 'IdentityFile', 'Remark']
    props.forEach(prop => {
      if (hostData[prop]) {
        newLines.push(`    ${prop} ${hostData[prop]}`)
      }
    })
    newLines.push(os.EOL)
    const newConfigBlock = SSHConfig.parse(newLines.join(os.EOL))
    config.push(newConfigBlock[0])
  }

  await fs.writeFile(CONFIG_PATH, SSHConfig.stringify(config), 'utf8')
  return true
}

export async function deleteHost(host) {
  await ensureConfigExists()
  const content = await fs.readFile(CONFIG_PATH, 'utf8')
  const config = parseConfig(content)

  const sectionIndex = config.findIndex(entry => entry.param && entry.param.toLowerCase() === 'host' && hostValueToString(entry.value) === host)

  if (sectionIndex > -1) {
    config.splice(sectionIndex, 1)
    // 生成配置字符串并清理多余空行
    let result = SSHConfig.stringify(config)
    // 将连续3个或更多换行符替换为1个换行符
    result = result.replace(/(\r?\n){3,}/g, os.EOL)
    await fs.writeFile(CONFIG_PATH, result, 'utf8')
  }

  return true
}

// 重新排序 hosts，按照传入的 hostNames 数组顺序重写配置文件
export async function reorderHosts(hostNames) {
  await ensureConfigExists()
  const content = await fs.readFile(CONFIG_PATH, 'utf8')
  const config = parseConfig(content)

  // 提取所有 Host 块
  const hostSections = []
  const otherSections = []

  for (const section of config) {
    if (section.param && section.param.toLowerCase() === 'host') {
      hostSections.push(section)
    } else {
      otherSections.push(section)
    }
  }

  // 按 hostNames 数组的顺序重新排列
  const reorderedSections = []
  for (const hostName of hostNames) {
    const section = hostSections.find(s => hostValueToString(s.value) === hostName)
    if (section) {
      reorderedSections.push(section)
    }
  }

  // 合并非 Host 块和重排后的 Host 块
  const newConfig = SSHConfig.parse('')
  for (const section of otherSections) {
    newConfig.push(section)
  }
  for (const section of reorderedSections) {
    newConfig.push(section)
  }

  await fs.writeFile(CONFIG_PATH, SSHConfig.stringify(newConfig), 'utf8')
  return true
}

// 复制 host 配置，在原配置后插入新配置，Host 名称为原名称 + "copy"
export async function copyHost(hostName) {
  await ensureConfigExists()
  const content = await fs.readFile(CONFIG_PATH, 'utf8')
  const config = parseConfig(content)

  // 找到原配置的索引
  const sectionIndex = config.findIndex(
    entry => entry.param && entry.param.toLowerCase() === 'host' && hostValueToString(entry.value) === hostName
  )

  if (sectionIndex === -1) {
    throw new Error(`Host "${hostName}" not found`)
  }

  const originalSection = config[sectionIndex]

  // 提取原配置的属性
  const props = {}
  if (originalSection.config) {
    for (const line of originalSection.config) {
      if (line.type === TYPE_DIRECTIVE) {
        props[line.param] = line.value
      }
    }
  }

  // 构建新配置块（原名含空格时替换为短横杠，避免生成多 pattern 的 Host 行）
  const newHostName = hostName.replace(/\s+/g, '-') + '-copy'
  const newLines = ['', `Host ${newHostName}`]
  const propOrder = ['HostName', 'User', 'Port', 'IdentityFile', 'Remark']
  propOrder.forEach(prop => {
    if (props[prop]) {
      newLines.push(`    ${prop} ${props[prop]}`)
    }
  })
  newLines.push(os.EOL)

  // 解析新配置块
  const newConfigBlock = SSHConfig.parse(newLines.join(os.EOL))

  // 在原配置后面插入新配置
  config.splice(sectionIndex + 1, 0, newConfigBlock[0])

  await fs.writeFile(CONFIG_PATH, SSHConfig.stringify(config), 'utf8')
  return { newHostName }
}

async function fileExists(p) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

// 列出 ~/.ssh 下 .pub 公钥对应的密钥路径（IdentityFile 下拉数据源）。
// 返回统一的 ~/.ssh/<name> 形式（不带 .pub 后缀），该写法在各平台 ssh 配置中通用
export async function listIdentityFiles() {
  try {
    const entries = await fs.readdir(SSH_DIR, { withFileTypes: true })
    return entries
      .filter(entry => entry.isFile() && entry.name.endsWith('.pub'))
      .map(entry => '~/.ssh/' + entry.name.slice(0, -'.pub'.length))
      .sort((a, b) => a.localeCompare(b))
  } catch (err) {
    // 目录不存在等情况返回空列表
    console.error('Failed to list identity files:', err)
    return []
  }
}

// 调用 ssh-keygen 生成默认密钥（无口令）。与 CopyIdService 一致：
// 始终返回结果对象而不抛异常，避免渲染进程提示里带上 IPC 错误前缀
export async function generateDefaultKey() {
  try {
    await fs.mkdir(SSH_DIR, { recursive: true })
  } catch (err) {
    return { success: false, message: `无法创建 ~/.ssh 目录: ${err.message}` }
  }

  // 目标文件已存在时 ssh-keygen 会交互式询问是否覆盖导致进程挂起，
  // 因此只在私钥、公钥都不存在的候选名中生成
  const candidates = [
    { name: 'id_ed25519', type: 'ed25519' },
    { name: 'id_rsa', type: 'rsa' }
  ]
  let target = null
  for (const candidate of candidates) {
    const privPath = path.join(SSH_DIR, candidate.name)
    if (!(await fileExists(privPath)) && !(await fileExists(privPath + '.pub'))) {
      target = candidate
      break
    }
  }
  if (!target) {
    return { success: false, message: '默认密钥文件（id_ed25519 / id_rsa）已存在，请先手动处理' }
  }

  const keyPath = path.join(SSH_DIR, target.name)
  return new Promise((resolve) => {
    const child = spawn('ssh-keygen', ['-q', '-t', target.type, '-N', '', '-f', keyPath], {
      windowsHide: true
    })
    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    // 关闭 stdin，任何意外的交互式提问都会读到 EOF 而不是挂起
    child.stdin.end()
    child.on('error', (err) => {
      resolve({
        success: false,
        message: err.code === 'ENOENT'
          ? '未找到 ssh-keygen 命令，请确认已安装 OpenSSH 客户端'
          : err.message
      })
    })
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, keyPath: '~/.ssh/' + target.name })
      } else {
        resolve({ success: false, message: stderr.trim() || `ssh-keygen 退出码 ${code}` })
      }
    })
  })
}