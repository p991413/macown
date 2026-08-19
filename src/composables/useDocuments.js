import { reactive, computed, watch } from 'vue'

/**
 * 文档 / 多页签 store（单例），自动保存到 localStorage，防止内容意外丢失。
 * 每个文档 = { id, content }；标题从内容首行自动推导。
 */

const STORAGE_KEY = 'macown:documents'

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
  return { id: newId(), content }
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (Array.isArray(raw) && raw.length > 0) {
      return raw
        .filter((d) => d && typeof d.content === 'string')
        .map((d) => ({ id: d.id || newId(), content: d.content }))
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

// 内容变化时自动保存
watch(
  () => state.documents.map((d) => d.content),
  () => scheduleSave(),
  { deep: true }
)

function newDocument() {
  const doc = makeDoc('')
  state.documents.push(doc)
  state.activeId = doc.id
  scheduleSave()
  return doc
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
    deriveTitle,
  }
}
