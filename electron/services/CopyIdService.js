import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import dns from 'node:dns/promises'
import ssh2 from 'ssh2'

// ssh2 是 CJS 包，ESM 下取默认导出再解构
const { Client } = ssh2

// 默认公钥探测顺序（与 ssh-copy-id 的默认密钥习惯一致）
const DEFAULT_PUBLIC_KEYS = ['id_ed25519.pub', 'id_ecdsa.pub', 'id_rsa.pub']

// 远程安装公钥命令：对齐真实 ssh-copy-id 的行为
// - umask 077 保证新建文件/目录权限正确
// - tail -1c 检查确保追加前文件以换行结尾
// - 公钥内容经 stdin 写入（cat >>），彻底规避 shell 引号/转义问题
const INSTALL_COMMAND =
  'cd ; umask 077 ; mkdir -p .ssh && ' +
  '{ [ -z "$(tail -1c .ssh/authorized_keys 2>/dev/null)" ] || echo >> .ssh/authorized_keys ; } && ' +
  'cat >> .ssh/authorized_keys && chmod 600 .ssh/authorized_keys'

/**
 * 展开路径中的 ~ 为用户主目录
 */
function expandHome(p) {
  if (!p) return p
  if (p === '~') return os.homedir()
  if (p.startsWith('~/') || p.startsWith('~\\')) {
    return path.join(os.homedir(), p.slice(2))
  }
  return p
}

async function fileExists(p) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

/**
 * 解析要拷贝的公钥文件路径
 * - 指定了 identityFile：展开 ~，非 .pub 结尾则追加 .pub（与 ssh-copy-id -i 行为一致）
 * - 未指定：按序探测 ~/.ssh 下的默认公钥
 * @returns {Promise<{ keyPath: string } | { error: string }>}
 */
async function resolvePublicKeyPath(identityFile) {
  if (identityFile && identityFile.trim()) {
    let p = expandHome(identityFile.trim())
    if (!p.endsWith('.pub')) {
      p = `${p}.pub`
    }
    if (await fileExists(p)) {
      return { keyPath: p }
    }
    return { error: `未找到公钥文件 ${p}，请检查 IdentityFile 路径，或先用 ssh-keygen 生成密钥` }
  }

  for (const name of DEFAULT_PUBLIC_KEYS) {
    const p = path.join(os.homedir(), '.ssh', name)
    if (await fileExists(p)) {
      return { keyPath: p }
    }
  }
  return {
    error: '未找到默认公钥（~/.ssh 下的 id_ed25519.pub / id_ecdsa.pub / id_rsa.pub），请先用 ssh-keygen 生成密钥，或在 IdentityFile 中指定私钥路径'
  }
}

/**
 * 将 ssh2 连接错误映射为具体的中文提示
 */
function mapConnectionError(err) {
  const msg = err?.message || String(err)
  if (err?.level === 'client-authentication' || msg.includes('All configured authentication methods failed')) {
    return '认证失败：用户名或密码错误'
  }
  if (err?.code === 'ECONNREFUSED' || msg.includes('ECONNREFUSED')) {
    return '连接被拒绝：请检查端口是否正确、远程主机 sshd 是否运行'
  }
  if (err?.level === 'client-timeout' || err?.code === 'ETIMEDOUT' || msg.includes('Timed out')) {
    return '连接超时：主机不可达或端口不通'
  }
  if (err?.code === 'ENOTFOUND' || err?.code === 'EHOSTUNREACH' || msg.includes('ENOTFOUND') || msg.includes('EHOSTUNREACH')) {
    return '无法解析或访问主机：请检查 HostName 是否正确'
  }
  // ssh2 在 socket 提前断开（不可路由、被 RST 等）时给出的通用错误
  if (msg.includes('Connection lost before handshake') || msg.includes('Socket is closed')) {
    return '连接失败：主机不可达或连接中断，请检查 HostName、Port 与网络'
  }
  return msg
}

/**
 * 建立 SSH 连接（密码认证，兼容 keyboard-interactive）
 */
function connectClient({ host, port, username, password }) {
  return new Promise((resolve, reject) => {
    const conn = new Client()
    conn.on('ready', () => resolve(conn))
    // 监听器保留在连接全生命周期，避免 ready 之后的 error 事件无人处理导致进程崩溃
    conn.on('error', (err) => reject(err))
    // 很多 sshd（PAM）用 keyboard-interactive 而非 password 认证，逐个提示回答密码
    conn.on('keyboard-interactive', (_name, _instructions, _lang, prompts, finish) => {
      finish(prompts.map(() => password))
    })
    conn.connect({
      host,
      port: Number(port) || 22,
      username,
      password,
      tryKeyboard: true,
      readyTimeout: 10000
    })
  })
}

/**
 * 在远程执行命令，可选地向其 stdin 写入数据
 * @returns {Promise<{ code: number|null, stdout: string, stderr: string }>}
 */
function execCommand(conn, command, stdinData = null) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) {
        reject(err)
        return
      }
      let stdout = ''
      let stderr = ''
      stream.on('data', (chunk) => { stdout += chunk })
      stream.stderr.on('data', (chunk) => { stderr += chunk })
      stream.on('close', (code) => {
        resolve({ code, stdout, stderr })
      })
      if (stdinData !== null) {
        stream.end(stdinData)
      } else {
        stream.end()
      }
    })
  })
}

/**
 * 把本机 SSH 公钥拷贝到远程主机的 authorized_keys（ssh-copy-id 等价实现）
 *
 * 始终返回结果对象而不抛异常，避免 Electron IPC 的错误前缀污染提示语。
 * 注意：password 仅在本次调用中使用，不落盘、不打日志。
 *
 * @param {object} options
 * @param {string} options.host - 远程主机 IP 或域名
 * @param {string|number} options.port - SSH 端口（默认 22）
 * @param {string} options.username - 登录用户名
 * @param {string} options.password - 登录密码（仅临时使用）
 * @param {string} [options.identityFile] - 私钥路径（自动追加 .pub），为空则用默认公钥
 * @returns {Promise<{ success: true, alreadyExists: boolean, keyPath: string } | { success: false, message: string }>}
 */
export async function copyPublicKey({ host, port, username, password, identityFile }) {
  // 1. 解析公钥
  const resolved = await resolvePublicKeyPath(identityFile)
  if (resolved.error) {
    return { success: false, message: resolved.error }
  }
  const { keyPath } = resolved

  // 2. 读取并校验公钥内容
  let keyLine
  try {
    const content = await fs.readFile(keyPath, 'utf8')
    keyLine = content.split(/\r?\n/).map(line => line.trim()).find(line => line.length > 0) || ''
  } catch (err) {
    return { success: false, message: `读取公钥文件失败：${err.message}` }
  }
  if (!/^(ssh-|ecdsa-|sk-)/.test(keyLine)) {
    return { success: false, message: `公钥文件格式无效：${keyPath}` }
  }

  // 3. 预检 DNS（ssh2 对解析失败只报通用错误，这里提前给出精确提示）
  try {
    await dns.lookup(host)
  } catch {
    return { success: false, message: `无法解析主机 ${host}：请检查 HostName 是否正确` }
  }

  // 4. 建立连接
  let conn
  try {
    conn = await connectClient({ host, port, username, password })
  } catch (err) {
    return { success: false, message: mapConnectionError(err) }
  }

  try {
    // 5. 去重：按「类型 + key 数据」比对（忽略注释部分）
    const keyParts = keyLine.split(/\s+/)
    const existing = await execCommand(conn, 'cat .ssh/authorized_keys 2>/dev/null || true')
    const alreadyExists = existing.stdout.split(/\r?\n/).some(line => {
      const parts = line.trim().split(/\s+/)
      return parts.length >= 2 && parts[0] === keyParts[0] && parts[1] === keyParts[1]
    })
    if (alreadyExists) {
      console.log(`Public key already installed on ${host}, skip appending`)
      return { success: true, alreadyExists: true, keyPath }
    }

    // 6. 追加公钥（内容经 stdin 写入）
    const result = await execCommand(conn, INSTALL_COMMAND, `${keyLine}\n`)
    if (result.code !== 0) {
      const detail = result.stderr.trim()
      return {
        success: false,
        message: `远程写入 authorized_keys 失败（exit ${result.code}）${detail ? '：' + detail : ''}`
      }
    }

    console.log(`Public key installed on ${host} from ${keyPath}`)
    return { success: true, alreadyExists: false, keyPath }
  } catch (err) {
    return { success: false, message: `执行远程命令失败：${err.message}` }
  } finally {
    conn.end()
  }
}
