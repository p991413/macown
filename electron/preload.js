const { contextBridge, ipcRenderer } = require('electron')

// 通过 contextBridge 安全地向渲染进程暴露能力（contextIsolation 开启）
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },

  // 图标颜色 / 原生外观：system | light | dark
  setNativeTheme: (source) => {
    ipcRenderer.send('set-native-theme', source)
  },

  // 目录选择（配置保存路径 / 打开文件夹）
  selectDirectory: () => ipcRenderer.invoke('dialog:select-directory'),

  // 打开文件对话框（返回路径数组）
  openFilesDialog: () => ipcRenderer.invoke('dialog:open-files'),

  // 另存为对话框（返回路径或 null）
  saveFileDialog: (opts) => ipcRenderer.invoke('dialog:save-file', opts),

  // 读写文件
  writeFile: (filePath, content) => ipcRenderer.invoke('fs:write-file', filePath, content),
  readFile: (filePath) => ipcRenderer.invoke('fs:read-file', filePath),

  // 菜单撤销/重做事件（主进程菜单 accelerator 触发，转发到渲染进程自实现栈）
  onMenuUndo: (cb) => ipcRenderer.on('menu:undo', cb),
  onMenuRedo: (cb) => ipcRenderer.on('menu:redo', cb),
})
