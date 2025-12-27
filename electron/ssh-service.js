import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
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

async function ensureConfigExists() {
  try {
    console.log('Checking if config file exists:', CONFIG_PATH)
    await fs.access(CONFIG_PATH)
  } catch {
    try {
      await fs.mkdir(SSH_DIR, { recursive: true })
      await fs.writeFile(CONFIG_PATH, '', 'utf8')
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
        after: '\n'
      })
    }
  } else if (lineIndex > -1) {
    // If value is empty/null and line exists, remove it using splice
    sectionConfig.splice(lineIndex, 1)
  }
}

// ssh-config 库的类型常量
const TYPE_DIRECTIVE = 1

export async function getAll() {
  await ensureConfigExists()
  try {
    const content = await fs.readFile(CONFIG_PATH, 'utf8')
    console.log('Read config file length:', content.length)

    const config = parseConfig(content)
    const hosts = []

    for (const section of config) {
      if (section.param && section.param.toLowerCase() === 'host') {
        const hostData = {
          Host: section.value,
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
      }
    }

    console.log('Parsed hosts count:', hosts.length)
    return hosts
  } catch (err) {
    console.error('Error reading/parsing config:', err)
    return []
  }
}

export async function saveHost(hostData) {
  await ensureConfigExists()
  const content = await fs.readFile(CONFIG_PATH, 'utf8')
  const config = parseConfig(content)

  const targetHost = hostData.originalHost
  // Find existing section
  const section = targetHost
    ? config.find(entry => entry.param && entry.param.toLowerCase() === 'host' && entry.value === targetHost)
    : null

  if (section) {
    // Update existing Host
    if (hostData.Host && hostData.Host !== section.value) {
      section.value = hostData.Host
    }

    const props = ['HostName', 'User', 'Port', 'IdentityFile', 'Remark']
    props.forEach(prop => {
      updateSectionProp(section.config, prop, hostData[prop])
    })

  } else {
    // Add new Host - 通过字符串解析避免 append 方法的自动缩进问题
    const newLines = [`Host ${hostData.Host}`]
    const props = ['HostName', 'User', 'Port', 'IdentityFile', 'Remark']
    props.forEach(prop => {
      if (hostData[prop]) {
        newLines.push(`  ${prop} ${hostData[prop]}`)
      }
    })
    const newConfigBlock = SSHConfig.parse(newLines.join('\n'))
    config.push(newConfigBlock[0])
  }

  await fs.writeFile(CONFIG_PATH, SSHConfig.stringify(config), 'utf8')
  return true
}

export async function deleteHost(host) {
  await ensureConfigExists()
  const content = await fs.readFile(CONFIG_PATH, 'utf8')
  const config = parseConfig(content)

  const sectionIndex = config.findIndex(entry => entry.param && entry.param.toLowerCase() === 'host' && entry.value === host)

  if (sectionIndex > -1) {
    config.splice(sectionIndex, 1)
    await fs.writeFile(CONFIG_PATH, SSHConfig.stringify(config), 'utf8')
  }

  return true
}
