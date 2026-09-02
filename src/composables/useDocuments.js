import { reactive, computed, watch } from 'vue'
import { useSettings } from './useSettings'

/**
 * 文档 / 多页签 store（单例），内容自动缓存到 localStorage 防丢失，
 * 同时支持写入磁盘文件（路径由「保存路径配置」或用户手动选择决定）。
 * 每个文档 = { id, content, path, name }；path/name 为 null 表示尚未关联磁盘文件。
 */

const STORAGE_KEY = 'macown:documents'
const { state: settingsState } = useSettings()

const WELCOME = `# 欢迎使用 Macown

这是一个 **Typora 风格** 的双栏 Markdown 编辑器。

## 功能特性

- 拖拽中间分隔线，实时调整左右比例（最小 20%）
- 多主题（白色 / 黑色 / Cyber / GitHub）、字号与代码字体可调
- 多页签编辑，内容自动保存到本地
- \`Cmd/Ctrl + F\` 搜索、\`Cmd/Ctrl + R\` 替换，双击选中后搜索更快捷
- \`Cmd/Ctrl + +\` / \`-\` 缩放页面
- 行号显示、滚动同步、代码块语法高亮

> 右上角齿轮可打开设置，试试切换主题 👉

| 语法 | 示例 |
| ---- | ---- |
| 加粗 | **文字** |
| 表格 | 见工具栏「表格」按钮 |
`

let idSeed = 0
function newId() {
  idSeed += 1
  return `doc-${Date.now().toString(36)}-${idSeed}-${Math.random()
    .toString(36)
    .slice(2, 6)}`
}

function makeDoc(content = '') {
  return { id: newId(), content, path: null, name: null, dirty: false }
}

// ---------- 路径工具（渲染进程无 node path，用字符串处理） ----------
function joinPath(dir, name) {
  return `${String(dir).replace(/[\\/]+$/, '')}/${name}`
}
function basename(p) {
  return String(p).split(/[\\/]/).pop() || p
}
function generateFileName() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `未命名-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(
    d.getHours()
  )}${pad(d.getMinutes())}${pad(d.getSeconds())}.md`
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (Array.isArray(raw) && raw.length > 0) {
      return raw
        .filter((d) => d && typeof d.content === 'string')
        .map((d) => ({
          id: d.id || newId(),
          content: d.content,
          path: d.path || null,
          name: d.name || null,
          dirty: false,
        }))
    }
  } catch (e) {
    /* ignore */
  }
  return [makeDoc(WELCOME)]
}

const state = reactive({
  documents: load(),
  activeId: null,
})

if (!state.documents.find((d) => d.id === state.activeId)) {
  state.activeId = state.documents[0].id
}

const activeDoc = computed(() => state.documents.find((d) => d.id === state.activeId) || null)

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.documents))
  } catch (e) {
    /* ignore */
  }
}

// 防抖自动保存
let saveTimer = null
function scheduleSave() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(save, 400)
}

// 内容变化时自动保存，并标记对应文档为「待保存」（dirty）
watch(
  () => state.documents.map((d) => d.content),
  (cur, prev) => {
    if (prev) {
      state.documents.forEach((doc, i) => {
        if (cur[i] !== prev[i]) doc.dirty = true
      })
    }
    scheduleSave()
  },
  { deep: true }
)

async function newDocument() {
  const doc = makeDoc('')
  state.documents.push(doc)
  state.activeId = doc.id
  scheduleSave()

  // 配置了保存路径：自动写入磁盘（默认保存到该路径）
  const sp = settingsState.savePath
  const api = window.electronAPI
  if (sp && api?.writeFile) {
    const name = generateFileName()
    const fullPath = joinPath(sp, name)
    try {
      await api.writeFile(fullPath, '')
      doc.path = fullPath
      doc.name = name
      scheduleSave()
    } catch (e) {
      /* 写入失败仍保留内存文档 */
    }
  }
  return doc
}

/**
 * 保存当前文档到磁盘。
 * @returns {'saved' | 'canceled' | 'error' | 'no-api'}
 */
async function saveActive(docOverride) {
  const doc = docOverride || activeDoc.value
  if (!doc) return 'error'
  const api = window.electronAPI
  if (!api?.writeFile || !api?.saveFileDialog) return 'no-api'

  let target = doc.path
  if (!target) {
    // 未关联文件：弹保存对话框，优先落在配置的保存路径
    const fileName = doc.name || generateFileName()
    const defaultPath = settingsState.savePath
      ? joinPath(settingsState.savePath, fileName)
      : undefined
    target = await api.saveFileDialog({ defaultPath })
    if (!target) return 'canceled'
  }

  try {
    await api.writeFile(target, doc.content)
    doc.path = target
    doc.name = basename(target)
    doc.dirty = false
    scheduleSave()
    return 'saved'
  } catch (e) {
    return 'error'
  }
}

function closeDocument(id) {
  const idx = state.documents.findIndex((d) => d.id === id)
  if (idx === -1) return
  state.documents.splice(idx, 1)
  if (state.documents.length === 0) {
    state.documents.push(makeDoc(''))
  }
  if (state.activeId === id) {
    state.activeId = state.documents[Math.min(idx, state.documents.length - 1)].id
  }
  scheduleSave()
}

/**
 * 打开磁盘文件：已存在同路径文档则激活，否则新建文档并关联路径。
 * @param {string} path 文件完整路径
 * @param {string} content 文件内容
 */
function openFile(path, content) {
  const existing = state.documents.find((d) => d.path === path)
  if (existing) {
    state.activeId = existing.id
    return existing
  }
  const doc = makeDoc(content)
  doc.path = path
  doc.name = basename(path)
  state.documents.push(doc)
  state.activeId = doc.id
  scheduleSave()
  return doc
}

function setActive(id) {
  if (state.documents.some((d) => d.id === id)) {
    state.activeId = id
  }
}

// 从内容推导标题：首个非空标题/首行，去掉 # 前缀
function deriveTitle(content) {
  if (!content) return '未命名'
  const lines = content.split('\n')
  for (const line of lines) {
    const t = line.replace(/^#+\s*/, '').trim()
    if (t) return t.slice(0, 30)
  }
  return '未命名'
}

export function useDocuments() {
  return {
    state,
    activeDoc,
    newDocument,
    closeDocument,
    setActive,
    openFile,
    deriveTitle,
    save,
    saveActive,
  }
}
