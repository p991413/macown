const { app, BrowserWindow, Menu, ipcMain, nativeTheme } = require('electron')
const path = require('path')

// 是否运行在开发模式（由 dev:electron 脚本注入环境变量）
const isDev = !!process.env.VITE_DEV_SERVER_URL

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 700,
    minHeight: 480,
    title: 'Macown',
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // 隐藏默认菜单栏，界面更接近 Typora 的沉浸式体验
  Menu.setApplicationMenu(null)

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
