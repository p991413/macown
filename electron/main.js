const { app, BrowserWindow, Menu, ipcMain, nativeTheme } = require('electron')
const path = require('path')

// 是否运行在开发模式（由 dev:electron 脚本注入环境变量）
const isDev = !!process.env.VITE_DEV_SERVER_URL

// 构建应用菜单：保留原生编辑快捷键（撤销/重做/剪切/复制/粘贴/全选）。
// 注意：不能置空菜单，否则 macOS 上 Cmd+Z 等系统编辑快捷键会失效。
function buildMenu() {
  const isMac = process.platform === 'darwin'
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
      ],
    },
  ]
  return Menu.buildFromTemplate(template)
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 700,
    minHeight: 480,
    title: 'Macown',
    autoHideMenuBar: true, // Windows/Linux 隐藏菜单栏（Alt 可唤出）；macOS 忽略
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  Menu.setApplicationMenu(buildMenu())

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

// 图标颜色 / 原生外观：深色、浅色、跟随系统
ipcMain.on('set-native-theme', (_event, source) => {
  if (['system', 'light', 'dark'].includes(source)) {
    nativeTheme.themeSource = source
  }
})

app.whenReady().then(() => {
  createWindow()

  // macOS：点击 Dock 图标且无窗口时重新创建窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // macOS 之外，关闭所有窗口即退出应用
  if (process.platform !== 'darwin') app.quit()
})
