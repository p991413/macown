const { app, BrowserWindow, Menu, ipcMain, nativeTheme, dialog } = require('electron')
const path = require('path')
const fs = require('fs')

// 是否运行在开发模式（由 dev:electron 脚本注入环境变量）
const isDev = !!process.env.VITE_DEV_SERVER_URL

// 构建应用菜单：保留原生编辑快捷键（撤销/重做/剪切/复制/粘贴/全选）。
// 注意：不能置空菜单，否则 macOS 上 Cmd+Z 等系统编辑快捷键会失效。
// 撤销/重做改为自定义 click → IPC 通知渲染进程执行自实现撤销栈
// （受控 textarea 的原生 undo 栈被 Vue 重设 value 破坏，role:'undo' 依赖原生栈不可靠）。
function buildMenu(win) {
  const isMac = process.platform === 'darwin'
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: '编辑',
      submenu: [
        { label: '撤销', accelerator: 'CmdOrCtrl+Z', click: () => win.webContents.send('menu:undo') },
        { label: '重做', accelerator: 'CmdOrCtrl+Shift+Z', click: () => win.webContents.send('menu:redo') },
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

  Menu.setApplicationMenu(buildMenu(win))

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

// ---------- 文件系统 / 对话框（供保存路径配置、文件侧边栏、读写文件） ----------

// 选择目录（用于配置文档保存路径、打开文件夹）
ipcMain.handle('dialog:select-directory', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
  })
  if (canceled || !filePaths.length) return null
  return filePaths[0]
})

// 选择单个/多个文件（用于打开文件）
ipcMain.handle('dialog:open-files', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown', 'txt'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  })
  if (canceled || !filePaths.length) return []
  return filePaths
})

// 另存为对话框（返回选择的保存路径，取消则返回 null）
ipcMain.handle('dialog:save-file', async (_event, opts = {}) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: opts.title || '保存文档',
    defaultPath: opts.defaultPath || undefined,
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  })
  if (canceled || !filePath) return null
  return filePath
})

// 写文本文件
ipcMain.handle('fs:write-file', async (_event, filePath, content) => {
  await fs.promises.writeFile(filePath, content, 'utf-8')
  return true
})

// 读文本文件
ipcMain.handle('fs:read-file', async (_event, filePath) => {
  return await fs.promises.readFile(filePath, 'utf-8')
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
