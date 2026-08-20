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
})
