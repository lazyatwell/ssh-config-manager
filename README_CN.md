<p align="center">
  <strong>简体中文</strong> | <a href="./README.md">English</a>
</p>

<p align="center">
  <pre align="center">
   _____ _____ _   _    _____             __ _         __  __                                   
  / ____/ ____| | | |  / ____|           / _(_)       |  \/  |                                  
 | (___| (___ | |_| | | |     ___  _ __ | |_ _  __ _  | \  / | __ _ _ __   __ _  __ _  ___ _ __ 
  \___ \\___ \|  _  | | |    / _ \| '_ \|  _| |/ _` | | |\/| |/ _` | '_ \ / _` |/ _` |/ _ \ '__|
  ____) |___) | | | | | |___| (_) | | | | | | | (_| | | |  | | (_| | | | | (_| | (_| |  __/ |   
 |_____/_____/|_| |_|  \_____\___/|_| |_|_| |_|\__, | |_|  |_|\__,_|_| |_|\__,_|\__, |\___|_|   
                                                __/ |                           __/ |          
                                               |___/                           |___/           
  </pre>
</p>

<p align="center">
  <strong>🔐 优雅地管理你的本地 SSH 配置</strong>
</p>

<p align="center">
  <a href="#功能特性">功能特性</a> •
  <a href="#安装">安装</a> •
  <a href="#使用方法">使用方法</a> •
  <a href="#技术栈">技术栈</a> •
  <a href="#开发">开发</a> •
  <a href="#许可证">许可证</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-39.x-47848F?style=flat-square&logo=electron&logoColor=white" alt="Electron">
  <img src="https://img.shields.io/badge/Vue-3.5-4FC08D?style=flat-square&logo=vue.js&logoColor=white" alt="Vue 3">
  <img src="https://img.shields.io/badge/Vite-7.x-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite">
  <img src="https://img.shields.io/badge/TailwindCSS-4.x-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white" alt="TailwindCSS">
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License">
</p>

---

## 📖 简介

**SSH Config Manager** 是一款现代化的桌面应用程序，专为管理本地 `~/.ssh/config` 文件而设计。告别繁琐的手动编辑配置文件，通过直观的图形界面轻松管理你的所有 SSH 主机连接配置。

## ✨ 功能特性

- 🔍 **快速搜索** - 支持按主机别名、IP 地址、用户名或备注进行实时过滤
- ➕ **添加配置** - 通过表单快速添加新的 SSH 主机配置
- ✏️ **编辑配置** - 一键编辑现有的主机配置信息
- 🗑️ **删除配置** - 安全删除不再需要的主机配置
- 📋 **复制配置** - 快速复制现有配置作为新主机的模板
- 🔀 **拖拽排序** - 通过拖拽自由调整主机配置的显示顺序
- 🎨 **现代 UI** - 基于 TailwindCSS 的清新现代界面设计
- 🖥️ **跨平台** - 支持 Windows、macOS 和 Linux

## 📦 安装

### 前置要求

- [Node.js](https://nodejs.org/) 18.x 或更高版本
- [pnpm](https://pnpm.io/) 包管理器

### 安装步骤

```bash
# 克隆仓库
git clone https://github.com/your-username/ssh-config-manager.git

# 进入项目目录
cd ssh-config-manager

# 安装依赖
pnpm install
```

## 🚀 使用方法

### 开发模式

```bash
pnpm dev
```

这将同时启动 Vite 开发服务器和 Electron 应用，支持热重载。

### 构建生产版本

```bash
# 生成图标
pnpm icon

# 构建
pnpm build

# 打包

# Windows, 需要管理员权限运行，进行签名
pnpm pack:win
# Windows, 便携版
pnpm pack:win:portable
# macOS
pnpm pack:mac
# Linux
pnpm pack:linux
```

构建产物将输出到 `release` 目录。

## 🛠️ 技术栈

| 技术 | 版本 | 说明 |
|------|------|------|
| [Electron](https://www.electronjs.org/) | 39.x | 跨平台桌面应用框架 |
| [Vue 3](https://vuejs.org/) | 3.5 | 渐进式 JavaScript 框架 |
| [Vite](https://vitejs.dev/) | 7.x | 下一代前端构建工具 |
| [TailwindCSS](https://tailwindcss.com/) | 4.x | 实用优先的 CSS 框架 |
| [vuedraggable](https://github.com/SortableJS/Vue.Draggable) | 4.x | Vue 拖拽组件 |
| [ssh-config](https://github.com/cyjake/ssh-config) | 5.x | SSH 配置文件解析器 |

## 📁 项目结构

```
ssh-config-manager/
├── electron/                 # Electron 主进程
│   ├── main.js              # 主进程入口
│   ├── preload.js           # 预加载脚本
│   └── ssh-service.js       # SSH 配置服务
├── src/                      # Vue 渲染进程
│   ├── components/          # Vue 组件
│   │   └── HostEditor.vue   # 主机编辑器组件
│   ├── App.vue              # 根组件
│   ├── main.js              # 渲染进程入口
│   └── style.css            # 全局样式
├── index.html               # HTML 模板
├── vite.config.js           # Vite 配置
├── package.json             # 项目配置
└── README.md                # 项目文档
```

## 🔧 开发

### 环境设置

1. 确保已安装 Node.js 18+ 和 pnpm
2. 运行 `pnpm install` 安装依赖
3. 运行 `pnpm dev` 启动开发环境

### SSH 配置文件位置

应用会自动读取和写入用户主目录下的 SSH 配置文件：

- **Windows**: `C:\Users\<用户名>\.ssh\config`
- **macOS/Linux**: `~/.ssh/config`

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建你的功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启一个 Pull Request

## 📄 许可证

本项目基于 [MIT 许可证](LICENSE) 开源。

---

<p align="center">
  Made with ❤️ by developers, for developers.
</p>

