<p align="center">
  <a href="./README_CN.md">简体中文</a> | <strong>English</strong>
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
  <strong>🔐 Elegantly manage your local SSH configurations</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#development">Development</a> •
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-39.x-47848F?style=flat-square&logo=electron&logoColor=white" alt="Electron">
  <img src="https://img.shields.io/badge/Vue-3.5-4FC08D?style=flat-square&logo=vue.js&logoColor=white" alt="Vue 3">
  <img src="https://img.shields.io/badge/Vite-7.x-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite">
  <img src="https://img.shields.io/badge/TailwindCSS-4.x-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white" alt="TailwindCSS">
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License">
</p>

---

## 📖 Introduction

**SSH Config Manager** is a modern desktop application designed for managing your local `~/.ssh/config` file. Say goodbye to tedious manual configuration file editing and easily manage all your SSH host connection configurations through an intuitive graphical interface.

## ✨ Features

- 🔍 **Quick Search** - Real-time filtering by host alias, IP address, username, or remarks
- ➕ **Add Configuration** - Quickly add new SSH host configurations via form
- ✏️ **Edit Configuration** - One-click editing of existing host configuration
- 🗑️ **Delete Configuration** - Safely remove unwanted host configurations
- 📋 **Copy Configuration** - Quickly duplicate existing configurations as templates for new hosts
- 🔀 **Drag & Drop Sorting** - Freely adjust the display order of host configurations by dragging
- 🎨 **Modern UI** - Clean and modern interface design based on TailwindCSS
- 🖥️ **Cross-Platform** - Supports Windows, macOS, and Linux

## 📦 Installation

### Prerequisites

- [Node.js](https://nodejs.org/) 18.x or higher
- [pnpm](https://pnpm.io/) package manager

### Installation Steps

```bash
# Clone the repository
git clone https://github.com/your-username/ssh-config-manager.git

# Navigate to the project directory
cd ssh-config-manager

# Install dependencies
pnpm install
```

## 🚀 Usage

### Development Mode

```bash
pnpm dev
```

This will simultaneously start the Vite development server and the Electron application with hot-reload support.

### Build for Production

```bash
pnpm build
```

Build artifacts will be output to the `dist` directory.

## 🛠️ Tech Stack

| Technology | Version | Description |
|------------|---------|-------------|
| [Electron](https://www.electronjs.org/) | 39.x | Cross-platform desktop application framework |
| [Vue 3](https://vuejs.org/) | 3.5 | Progressive JavaScript framework |
| [Vite](https://vitejs.dev/) | 7.x | Next-generation frontend build tool |
| [TailwindCSS](https://tailwindcss.com/) | 4.x | Utility-first CSS framework |
| [vuedraggable](https://github.com/SortableJS/Vue.Draggable) | 4.x | Vue drag-and-drop component |
| [ssh-config](https://github.com/cyjake/ssh-config) | 5.x | SSH config file parser |

## 📁 Project Structure

```
ssh-config-manager/
├── electron/                 # Electron main process
│   ├── main.js              # Main process entry
│   ├── preload.js           # Preload script
│   └── ssh-service.js       # SSH config service
├── src/                      # Vue renderer process
│   ├── components/          # Vue components
│   │   └── HostEditor.vue   # Host editor component
│   ├── App.vue              # Root component
│   ├── main.js              # Renderer process entry
│   └── style.css            # Global styles
├── index.html               # HTML template
├── vite.config.js           # Vite configuration
├── package.json             # Project configuration
└── README.md                # Project documentation
```

## 🔧 Development

### Environment Setup

1. Ensure Node.js 18+ and pnpm are installed
2. Run `pnpm install` to install dependencies
3. Run `pnpm dev` to start the development environment

### SSH Config File Location

The application automatically reads and writes the SSH config file in the user's home directory:

- **Windows**: `C:\Users\<username>\.ssh\config`
- **macOS/Linux**: `~/.ssh/config`

## 🤝 Contributing

Issues and Pull Requests are welcome!

1. Fork this repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is open source under the [MIT License](LICENSE).

---

<p align="center">
  Made with ❤️ by developers, for developers.
</p>
