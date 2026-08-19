const { contextBridge, ipcRenderer, webFrame } = require('electron')

// 通过 contextBridge 安全地向渲染进程暴露能力（contextIsolation 开启）
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },

  // 页面缩放（Cmd/Ctrl + / - / 0）
  setZoom: (factor) => {
    try {
      webFrame.setZoomFactor(factor)
    } catch (e) {
      /* 非 Electron 环境（纯浏览器预览）忽略 */
    }
  },
  getZoom: () => {
    try {
      return webFrame.getZoomFactor()
    } catch (e) {
      return 1
    }
  },

  // 图标颜色 / 原生外观：system | light | dark
  setNativeTheme: (source) => {
    ipcRenderer.send('set-native-theme', source)
  },
})
