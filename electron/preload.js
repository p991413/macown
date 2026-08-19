const { contextBridge } = require('electron')

// 当前示例仅做纯前端渲染，这里预留一个安全的桥接接口，
// 后续如需文件读写（保存/打开 .md），可在此暴露 IPC 能力。
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
})
