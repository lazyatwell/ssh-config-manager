// 中文语言包。所有用户可见文案必须放这里，组件内禁止硬编码。
// 新增 key 时必须同步更新 en-US.js，保持两包结构一致。
export default {
  common: {
    save: '保存',
    cancel: '取消',
    confirm: '确认',
    ok: '确定',
    alertTitle: '提示',
    loading: '加载中...',
    processing: '处理中...',
    retry: '重试',
    expand: '展开',
    collapse: '收起'
  },

  app: {
    subtitle: '轻松管理本地 SSH 配置',
    switchLanguage: '切换语言',
    newHost: '新增主机',
    searchPlaceholder: '按别名、IP 或用户搜索...',
    clearSearch: '清空搜索',
    loadingConfigs: '正在加载配置...',
    noHosts: '未找到主机',
    noHostsHint: '调整搜索条件，或新增一个主机。',
    apiUnavailable: 'SSH API 不可用（是否在 Electron 中运行？）',
    sshConnect: 'SSH 连接',
    edit: '编辑',
    copy: '复制',
    delete: '删除',
    moreActions: '更多操作',
    shareStatus: '分享状态',
    fields: {
      hostName: 'HostName',
      user: 'User',
      port: 'Port',
      identity: 'Identity'
    },
    deleteConfirmTitle: '删除确认',
    deleteConfirmMessage: '确定要删除配置 "{name}" 吗？',
    copyConfirmTitle: '复制确认',
    copyConfirmMessage: '确定要复制配置 "{name}" 吗？',
    saveFailed: '保存失败',
    deleteFailed: '删除失败',
    copyFailed: '复制失败',
    connectFailed: '连接失败',
    connectFailedMessage: '无法打开 SSH 连接: {detail}',
    importSuccessTitle: '导入成功',
    importSuccessMessage: '节点 "{name}" 已成功导入'
  },

  update: {
    available: '新版本 {version} 可用！',
    downloading: '正在下载更新... {percent}%',
    downloaded: '更新已下载完成，重启应用以完成安装',
    download: '下载更新',
    restartNow: '立即重启',
    later: '稍后提醒'
  },

  hostEditor: {
    titleNew: '新增主机',
    titleEdit: '编辑主机',
    labels: {
      host: 'Host（别名）',
      hostName: 'HostName（IP/域名）',
      user: 'User（用户名）',
      port: 'Port（端口）',
      identityFile: 'IdentityFile（密钥路径）',
      password: 'Password（密码）',
      remark: 'Remark（备注）'
    },
    placeholders: {
      host: 'myserver',
      hostName: '192.168.1.1',
      user: 'root',
      userDefault: 'root (默认)',
      port: '22',
      portDefault: '22 (默认)',
      password: '仅用于 Copy ID 拷贝公钥',
      remark: '例如：生产环境主服务器'
    },
    noKeyOption: '不使用密钥',
    generateKey: '新增',
    generating: '生成中...',
    keygenFailed: '生成密钥失败：{msg}',
    showPassword: '显示密码',
    hidePassword: '隐藏密码',
    passwordHint: '仅临时用于 Copy ID 拷贝公钥到远程主机，不会保存到配置文件',
    copyId: 'Copy ID',
    copying: '拷贝中...',
    copyIdHint: '需填写 User、IdentityFile 和 Password',
    copyIdFailed: 'Copy ID 失败：{msg}',
    apiUnavailable: 'SSH API 不可用（是否在 Electron 中运行？）',
    validation: {
      hostRequired: 'Host 为必填项',
      hostTooLong: 'Host 长度不能超过50字符',
      hostNoSpaces: 'Host 不能包含空格，可用 - 代替',
      hostNoWildcards: 'Host 别名不能包含通配字符 * ? !',
      hostNameRequired: 'HostName 为必填项',
      hostNameTooLong: 'HostName 长度不能超过50字符',
      hostNameInvalid: 'HostName 必须是有效的 IP 或域名格式',
      userRequired: 'User 为必填项',
      userTooLong: 'User 长度不能超过50字符',
      portInvalid: 'Port 必须为数字',
      portRange: 'Port 必须在 1-65535 之间',
      identityTooLong: 'IdentityFile 长度不能超过255字符',
      remarkTooLong: 'Remark 长度不能超过255字符',
      passwordRequired: '使用 Copy ID 需要输入密码'
    }
  },

  network: {
    title: '局域网分享',
    enabled: '已启用',
    disabled: '已禁用',
    devicesOnline: '{n} 个设备在线',
    refreshDiscovery: '刷新发现',
    turnOn: '开启',
    turnOff: '关闭',
    discoveredDevices: '网络发现的设备',
    onlineCount: '{n} 个在线',
    noDevices: '未发现其他设备',
    noDevicesHint: '确保其他设备也开启了分享功能',
    nodeCount: '{n} 个节点',
    summary: '发现 {devices} 个设备，共 {nodes} 个分享节点',
    viewDetails: '查看详情',
    statusFailed: '获取网络状态失败',
    peersFailed: '获取设备列表失败',
    toggleFailed: '切换分享功能失败',
    refreshFailed: '刷新发现失败'
  },

  localShared: {
    title: '本机分享的节点',
    count: '{n} 个',
    empty: '暂无分享节点',
    emptyHint: '点击节点卡片上的分享按钮开始分享',
    sharing: '分享中',
    expandAll: '展开全部 ({n})'
  },

  remoteNode: {
    loading: '加载节点列表...',
    fetchFailed: '获取节点列表失败',
    empty: '该设备未分享任何节点',
    importing: '导入中',
    add: '添加',
    refreshList: '刷新节点列表',
    importFailed: '导入节点失败: {detail}'
  },

  share: {
    share: '分享到局域网',
    unshare: '取消分享到局域网'
  },

  // 主进程 IPC 返回的错误码映射（code -> 文案），params 经插值填入
  errors: {
    unknown: '未知错误',
    generic: '{detail}',
    pubkeyNotFound: '未找到公钥文件 {path}，请检查 IdentityFile 路径，或先用 ssh-keygen 生成密钥',
    noDefaultPubkey: '未找到默认公钥（~/.ssh 下的 id_ed25519.pub / id_ecdsa.pub / id_rsa.pub），请先用 ssh-keygen 生成密钥，或在 IdentityFile 中指定私钥路径',
    pubkeyReadFailed: '读取公钥文件失败：{detail}',
    pubkeyInvalid: '公钥文件格式无效：{path}',
    dnsFailed: '无法解析主机 {host}：请检查 HostName 是否正确',
    authFailed: '认证失败：用户名或密码错误',
    connRefused: '连接被拒绝：请检查端口是否正确、远程主机 sshd 是否运行',
    connTimeout: '连接超时：主机不可达或端口不通',
    hostUnreachable: '无法解析或访问主机：请检查 HostName 是否正确',
    connLost: '连接失败：主机不可达或连接中断，请检查 HostName、Port 与网络',
    remoteWriteFailed: '远程写入 authorized_keys 失败：{detail}',
    remoteExecFailed: '执行远程命令失败：{detail}',
    mkdirFailed: '无法创建 ~/.ssh 目录: {detail}',
    keyExists: '默认密钥文件（id_ed25519 / id_rsa）已存在，请先手动处理',
    keygenNotFound: '未找到 ssh-keygen 命令，请确认已安装 OpenSSH 客户端',
    keygenFailed: 'ssh-keygen 执行失败：{detail}',
    noTerminalFound: '未找到可用的终端程序'
  }
}
