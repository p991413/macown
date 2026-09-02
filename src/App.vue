<script setup>
import {
  ref,
  computed,
  reactive,
  onMounted,
  onBeforeUnmount,
  watch,
  nextTick,
} from 'vue'
import SplitPane from './components/SplitPane.vue'
import MarkdownEditor from './components/MarkdownEditor.vue'
import MarkdownPreview from './components/MarkdownPreview.vue'
import TabBar from './components/TabBar.vue'
import SearchBar from './components/SearchBar.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import ShortcutsPanel from './components/ShortcutsPanel.vue'
import OutlinePanel from './components/OutlinePanel.vue'
import { useScrollSync } from './composables/useScrollSync'
import { useSettings } from './composables/useSettings'
import { useDocuments } from './composables/useDocuments'
import { findMatches } from './utils/search'
import { extractHeadings } from './utils/outline'

// ---------- 全局 store ----------
const settings = useSettings()
const settingsState = settings.state
const {
  state: docsState,
  activeDoc,
  newDocument,
  closeDocument,
  setActive,
  saveActive,
  openFile,
} = useDocuments()

settings.init()

// ---------- 布局 ----------
const split = ref(50)
const syncEnabled = ref(true)
const settingsOpen = ref(false)
const shortcutsOpen = ref(false)
const saveToast = ref('')
const sidebarWidth = ref(220) // 左侧栏（大纲）宽度（px）
const sidebarRef = ref(null)
let saveToastTimer = null

const editorPane = ref(null)
const previewPane = ref(null)

// 当前文档内容（v-model 双向绑定到激活文档）
const activeContent = computed({
  get: () => activeDoc.value?.content ?? '',
  set: (v) => {
    if (activeDoc.value) activeDoc.value.content = v
  },
})

useScrollSync(
  () => editorPane.value?.getScrollEl() ?? null,
  () => previewPane.value?.getScrollEl() ?? null,
  () => editorPane.value?.getScrollMapper() ?? null,
  () => previewPane.value?.getScrollMapper() ?? null,
  syncEnabled
)

// ---------- 字数统计 ----------
const charCount = computed(() => activeContent.value.length)
const wordCount = computed(() => {
  const cjk = (activeContent.value.match(/[\u4e00-\u9fff]/g) || []).length
  const words = (
    activeContent.value.replace(/[\u4e00-\u9fff]/g, ' ').match(/[A-Za-z0-9_]+/g) || []
  ).length
  return cjk + words
})

// ---------- 大纲 ----------
const headings = computed(() => extractHeadings(activeContent.value))

function jumpToHeading(line, index) {
  editorPane.value?.scrollToLine(line)
  previewPane.value?.scrollToHeadingIndex(index)
}

// ---------- 搜索 / 替换 ----------
const search = reactive({
  open: false,
  mode: 'search', // 'search' | 'replace'
  query: '',
  replaceText: '',
  caseSensitive: false,
  currentIndex: 0,
})

const matches = computed(() =>
  findMatches(activeContent.value, search.query, search.caseSensitive)
)
const safeCurrentIndex = computed(() =>
  matches.value.length ? Math.min(search.currentIndex, matches.value.length - 1) : 0
)

function scrollToCurrent() {
  const m = matches.value[safeCurrentIndex.value]
  if (m) editorPane.value?.focusMatch(m.start, m.end)
}
function openSearch(prefill = '') {
  search.open = true
  search.mode = 'search'
  if (prefill) search.query = prefill
  search.currentIndex = 0
  nextTick(scrollToCurrent)
}
function openReplace(prefill = '') {
  search.open = true
  search.mode = 'replace'
  if (prefill) search.query = prefill
  search.currentIndex = 0
  nextTick(scrollToCurrent)
}
function closeSearch() {
  search.open = false
  search.query = ''
  search.replaceText = ''
}
function goNext() {
  if (!matches.value.length) return
  search.currentIndex = (search.currentIndex + 1) % matches.value.length
  scrollToCurrent()
}
function goPrev() {
  if (!matches.value.length) return
  search.currentIndex =
    (search.currentIndex - 1 + matches.value.length) % matches.value.length
  scrollToCurrent()
}
function replaceCurrent() {
  const m = matches.value[safeCurrentIndex.value]
  if (!m) return
  const c = activeContent.value
  activeContent.value = c.slice(0, m.start) + search.replaceText + c.slice(m.end)
  nextTick(() => {
    if (search.currentIndex >= matches.value.length && matches.value.length) {
      search.currentIndex = matches.value.length - 1
    }
    scrollToCurrent()
  })
}
function replaceAll() {
  if (!matches.value.length) return
  const c = activeContent.value
  const parts = []
  let pos = 0
  for (const m of matches.value) {
    parts.push(c.slice(pos, m.start))
    parts.push(search.replaceText)
    pos = m.end
  }
  parts.push(c.slice(pos))
  activeContent.value = parts.join('')
}

// 输入搜索词时，回到第一个匹配
watch(
  () => search.query,
  () => {
    search.currentIndex = 0
    nextTick(scrollToCurrent)
  }
)

// 切换页签时：关闭搜索并重置滚动
watch(
  () => docsState.activeId,
  () => {
    closeSearch()
    nextTick(() => {
      if (editorPane.value?.getScrollEl()) editorPane.value.getScrollEl().scrollTop = 0
      if (previewPane.value?.getScrollEl()) previewPane.value.getScrollEl().scrollTop = 0
    })
  }
)

// ---------- 工具栏动作 ----------
function clearContent() {
  if (activeContent.value && !window.confirm('确定要清空当前文档内容吗？')) return
  activeContent.value = ''
}
function insertFormat(before, after = '', placeholder = '') {
  editorPane.value?.insertAtCursor(before, after, placeholder)
}
function insertTable() {
  const table = '\n| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n| 内容 | 内容 | 内容 |\n'
  editorPane.value?.insertAtCursor(table)
}

// ---------- 保存 / 页签切换 ----------
async function saveNow() {
  const result = await saveActive()
  const msg =
    result === 'saved'
      ? '已保存'
      : result === 'canceled'
        ? '已取消'
        : result === 'error'
          ? '保存失败'
          : '已保存到本地'
  saveToast.value = msg
  clearTimeout(saveToastTimer)
  saveToastTimer = setTimeout(() => (saveToast.value = ''), 1500)
}
function nextTab() {
  const docs = docsState.documents
  if (docs.length < 2) return
  const idx = docs.findIndex((d) => d.id === docsState.activeId)
  docsState.activeId = docs[(idx + 1) % docs.length].id
}
function prevTab() {
  const docs = docsState.documents
  if (docs.length < 2) return
  const idx = docs.findIndex((d) => d.id === docsState.activeId)
  docsState.activeId = docs[(idx - 1 + docs.length) % docs.length].id
}
function closeActiveTab() {
  if (docsState.documents.length > 1) closeTab(docsState.activeId)
}

/**
 * 关闭页签：若文档有未保存修改且内容非空，弹确认「是否保存」。
 * 回车/确定 → 先保存再关闭；其他操作（取消/其他按键）→ 不保存直接关闭。
 */
async function closeTab(id) {
  const doc = docsState.documents.find((d) => d.id === id)
  if (!doc) return
  const hasUnsaved = doc.dirty && doc.content.trim()
  if (hasUnsaved) {
    const ok = window.confirm(`“${doc.name || '未命名'}”有未保存的修改，是否保存？`)
    if (ok) {
      await saveActive(doc)
    }
  }
  closeDocument(id)
}

// ---------- 缩放 ----------
function zoomIn() {
  settingsState.zoom = Math.min(2.5, +(settingsState.zoom + 0.1).toFixed(2))
}
function zoomOut() {
  settingsState.zoom = Math.max(0.5, +(settingsState.zoom - 0.1).toFixed(2))
}
function zoomReset() {
  settingsState.zoom = 1
}

// ---------- 图标颜色 ----------
const systemDark = ref(false)
const logoColor = computed(() => {
  const ic = settingsState.iconColor
  if (ic === 'dark') return '#1f2328'
  if (ic === 'light') return '#ffffff'
  return systemDark.value ? '#ffffff' : '#1f2328'
})

// ---------- 键盘快捷键 ----------
function onKeydown(e) {
  const mod = e.metaKey || e.ctrlKey

  // Ctrl+Tab / Ctrl+Shift+Tab 切换页签（仅 Ctrl，避免与 macOS 应用切换冲突）
  if (e.ctrlKey && !e.metaKey && e.key === 'Tab') {
    e.preventDefault()
    if (e.shiftKey) prevTab()
    else nextTab()
    return
  }

  if (mod && (e.key === '=' || e.key === '+')) {
    e.preventDefault()
    zoomIn()
  } else if (mod && e.key === '-') {
    e.preventDefault()
    zoomOut()
  } else if (mod && e.key === '0') {
    e.preventDefault()
    zoomReset()
  } else if (mod && e.key === ',') {
    e.preventDefault()
    settingsOpen.value = true
  } else if (mod && (e.key === 'f' || e.key === 'F')) {
    e.preventDefault()
    openSearch(editorPane.value?.getSelection() || '')
  } else if (mod && (e.key === 'r' || e.key === 'R')) {
    e.preventDefault()
    openReplace(editorPane.value?.getSelection() || '')
  } else if (mod && (e.key === 'd' || e.key === 'D')) {
    e.preventDefault()
    editorPane.value?.duplicateLine()
  } else if (mod && (e.key === 's' || e.key === 'S')) {
    e.preventDefault()
    saveNow()
  } else if (mod && (e.key === 'n' || e.key === 'N')) {
    e.preventDefault()
    newDocument()
  } else if (mod && (e.key === 't' || e.key === 'T')) {
    e.preventDefault()
    newDocument()
  } else if (mod && (e.key === 'w' || e.key === 'W')) {
    e.preventDefault()
    closeActiveTab()
  } else if (mod && (e.key === 'b' || e.key === 'B')) {
    e.preventDefault()
    insertFormat('**', '**', '加粗')
  } else if (mod && (e.key === 'i' || e.key === 'I')) {
    e.preventDefault()
    insertFormat('*', '*', '斜体')
  } else if (mod && (e.key === 'k' || e.key === 'K')) {
    e.preventDefault()
    insertFormat('[', '](https://)', '链接文字')
  } else if (e.key === 'Escape') {
    if (settingsOpen.value) settingsOpen.value = false
    else if (shortcutsOpen.value) shortcutsOpen.value = false
    else if (search.open) closeSearch()
  }
  // 注意：Cmd/Ctrl+Z 撤销、Shift+Z 重做由主进程菜单的 role 处理，这里不拦截
}

const showTabs = computed(() => docsState.documents.length > 1)

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    systemDark.value = mq.matches
    mq.addEventListener('change', (ev) => (systemDark.value = ev.matches))
  }
  // 主进程菜单撤销/重做 → 转发到编辑器自实现栈
  window.electronAPI?.onMenuUndo?.(() => execUndo())
  window.electronAPI?.onMenuRedo?.(() => execRedo())
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})

// ---------- 快捷键面板数据 ----------
function execUndo() {
  editorPane.value?.undo?.()
}
function execRedo() {
  editorPane.value?.redo?.()
}

const shortcutGroups = [
  {
    title: '编辑',
    items: [
      { icon: 'B', name: '加粗', keys: '⌘B', run: () => insertFormat('**', '**', '加粗') },
      { icon: 'I', name: '斜体', keys: '⌘I', run: () => insertFormat('*', '*', '斜体') },
      { icon: '🔗', name: '插入链接', keys: '⌘K', run: () => insertFormat('[', '](https://)', '链接文字') },
      { icon: '⧉', name: '复制当前行', keys: '⌘D', run: () => editorPane.value?.duplicateLine() },
    ],
  },
  {
    title: '撤销 / 保存',
    items: [
      { icon: '↩', name: '撤销', keys: '⌘Z', run: execUndo },
      { icon: '↪', name: '重做', keys: '⇧⌘Z', run: execRedo },
      { icon: '💾', name: '保存', keys: '⌘S', run: saveNow },
    ],
  },
  {
    title: '页签',
    items: [
      { icon: '＋', name: '新建文档', keys: '⌘N', run: newDocument },
      { icon: '🗒', name: '新建标签页', keys: '⌘T', run: newDocument },
      { icon: '✕', name: '关闭页签', keys: '⌘W', run: closeActiveTab },
      { icon: '→', name: '下一个页签', keys: '⌃Tab', run: nextTab },
      { icon: '←', name: '上一个页签', keys: '⇧⌃Tab', run: prevTab },
    ],
  },
  {
    title: '查找 / 缩放',
    items: [
      { icon: '🔍', name: '搜索', keys: '⌘F', run: () => openSearch(editorPane.value?.getSelection() || '') },
      { icon: '⇄', name: '替换', keys: '⌘R', run: () => openReplace(editorPane.value?.getSelection() || '') },
      { icon: '＋', name: '放大', keys: '⌘+', run: zoomIn },
      { icon: '−', name: '缩小', keys: '⌘−', run: zoomOut },
      { icon: '100%', name: '重置缩放', keys: '⌘0', run: zoomReset },
    ],
  },
]

// ---------- 拖拽回调 ----------
function onDragStart() {}
function onDragEnd() {}

// ---------- 打开文件（工具栏「打开」按钮） ----------
async function openFiles() {
  const api = window.electronAPI
  if (!api?.openFilesDialog || !api?.readFile) return
  const paths = await api.openFilesDialog()
  for (const p of paths) {
    try {
      const content = await api.readFile(p)
      openFile(p, content)
    } catch (e) {
      /* ignore */
    }
  }
}

// ---------- 左侧栏（大纲）拖拽调宽 ----------
function startSidebarDrag(e) {
  if (e.button !== 0) return
  e.preventDefault()
  document.body.classList.add('is-dragging')
  const startX = e.clientX
  const startW = sidebarWidth.value
  const move = (ev) => {
    const w = startW + (ev.clientX - startX)
    sidebarWidth.value = Math.max(150, Math.min(480, w))
  }
  const up = () => {
    document.body.classList.remove('is-dragging')
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)
}
</script>

<template>
  <div class="app">
    <!-- 顶部工具栏 -->
    <header class="toolbar">
      <div class="toolbar__brand">
        <svg
          class="toolbar__logo"
          viewBox="0 0 16 16"
          width="18"
          height="18"
          fill="none"
          :style="{ color: logoColor }"
          aria-hidden="true"
        >
          <path
            d="M14.85 3.35 12.65 1.15a.5.5 0 0 0-.7 0L2.6 10.5a.5.5 0 0 0-.14.25L2 14.25a.5.5 0 0 0 .6.6l3.5-.46a.5.5 0 0 0 .25-.14l8.5-8.5a.5.5 0 0 0 0-.7ZM5.7 12.3l-2.4.32.32-2.4 6.5-6.5 2.08 2.08-6.5 6.5Z"
            fill="currentColor"
          />
        </svg>
        <span class="toolbar__title">Macown</span>
      </div>

      <div class="toolbar__format">
        <button
          class="toolbar__btn toolbar__btn--tool"
          title="打开文件"
          @click="openFiles"
        >
          <span class="toolbar__icon">📂</span>
          <span class="toolbar__label">打开</span>
        </button>
        <button
          class="toolbar__btn toolbar__btn--tool"
          :class="{ 'is-on': settingsState.showOutline }"
          title="显示/隐藏大纲"
          @click="settingsState.showOutline = !settingsState.showOutline"
        >
          <span class="toolbar__icon">☰</span>
          <span class="toolbar__label">大纲</span>
        </button>
        <button class="toolbar__btn toolbar__btn--tool" title="加粗" @click="insertFormat('**', '**', '加粗')">
          <strong class="toolbar__icon">B</strong>
          <span class="toolbar__label">加粗</span>
        </button>
        <button class="toolbar__btn toolbar__btn--tool" title="斜体" @click="insertFormat('*', '*', '斜体')">
          <em class="toolbar__icon">I</em>
          <span class="toolbar__label">斜体</span>
        </button>
        <button class="toolbar__btn toolbar__btn--tool" title="一级标题" @click="insertFormat('# ', '', '标题')">
          <span class="toolbar__icon">H</span>
          <span class="toolbar__label">标题</span>
        </button>
        <button class="toolbar__btn toolbar__btn--tool" title="行内代码" @click="insertFormat('`', '`', '代码')">
          <span class="toolbar__icon">&lt;/&gt;</span>
          <span class="toolbar__label">代码</span>
        </button>
        <button class="toolbar__btn toolbar__btn--tool" title="代码块" @click="insertFormat('\n```\n', '\n```\n', '代码')">
          <span class="toolbar__icon">{ }</span>
          <span class="toolbar__label">代码块</span>
        </button>
        <button class="toolbar__btn toolbar__btn--tool" title="引用" @click="insertFormat('\n> ', '', '引用')">
          <span class="toolbar__icon">❝</span>
          <span class="toolbar__label">引用</span>
        </button>
        <button class="toolbar__btn toolbar__btn--tool" title="链接" @click="insertFormat('[', '](https://)', '链接文字')">
          <span class="toolbar__icon">🔗</span>
          <span class="toolbar__label">链接</span>
        </button>
        <button class="toolbar__btn toolbar__btn--tool" title="表格" @click="insertTable">
          <svg
            class="toolbar__icon"
            viewBox="0 0 16 16"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            stroke-width="1.3"
            aria-hidden="true"
          >
            <rect x="1.5" y="2.5" width="13" height="11" rx="1" />
            <line x1="1.5" y1="6" x2="14.5" y2="6" />
            <line x1="1.5" y1="9.5" x2="14.5" y2="9.5" />
            <line x1="5.5" y1="2.5" x2="5.5" y2="13.5" />
          </svg>
          <span class="toolbar__label">表格</span>
        </button>

        <div class="shortcut-anchor">
          <button
            class="toolbar__btn toolbar__btn--tool"
            title="键盘快捷键"
            @click="shortcutsOpen = !shortcutsOpen"
          >
            <svg
              class="toolbar__icon"
              viewBox="0 0 24 24"
              width="15"
              height="15"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              aria-hidden="true"
            >
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <path
                d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M10 14h.01M14 14h.01M18 14h.01"
                stroke-linecap="round"
              />
            </svg>
            <span class="toolbar__label">快捷键</span>
          </button>
          <ShortcutsPanel
            v-if="shortcutsOpen"
            :groups="shortcutGroups"
            @close="shortcutsOpen = false"
          />
        </div>
      </div>

      <div class="toolbar__right">
        <span class="toolbar__stats">字数 {{ wordCount }} · 字符 {{ charCount }}</span>
        <div class="toolbar__view" title="显示模式">
          <button
            :class="{ 'is-active': settingsState.viewMode === 'source' }"
            @click="settingsState.viewMode = 'source'"
          >
            源码
          </button>
          <button
            :class="{ 'is-active': settingsState.viewMode === 'doc' }"
            @click="settingsState.viewMode = 'doc'"
          >
            文档
          </button>
        </div>
        <label class="toolbar__toggle" title="开关滚动同步">
          <input v-model="syncEnabled" type="checkbox" />
          <span>同步滚动</span>
        </label>
        <button class="toolbar__btn toolbar__btn--tool" title="设置" @click="settingsOpen = true">
          <svg
            class="toolbar__icon"
            viewBox="0 0 16 16"
            width="15"
            height="15"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              d="M8 5.5A2.5 2.5 0 1 0 8 10.5 2.5 2.5 0 0 0 8 5.5Zm0-3.37c.63 0 1.2.3 1.55.8l.28.4h1.62a.9.9 0 0 1 .9.9v1.1l.38.24c.35.22.74.34 1.14.34h1.03a.9.9 0 0 1 .9.9v1.38a.9.9 0 0 1-.9.9h-1.03c-.4 0-.79.12-1.14.34l-.38.24v1.1a.9.9 0 0 1-.9.9h-1.62l-.28.4a1.8 1.8 0 0 1-1.55.8 1.8 1.8 0 0 1-1.55-.8l-.28-.4H4.55a.9.9 0 0 1-.9-.9v-1.1l-.38-.24a1.8 1.8 0 0 0-1.14-.34H1.1a.9.9 0 0 1-.9-.9V8.31a.9.9 0 0 1 .9-.9h1.03c.4 0 .79-.12 1.14-.34l.38-.24v-1.1a.9.9 0 0 1 .9-.9h1.62l.28-.4c.35-.5.92-.8 1.55-.8Z"
            />
          </svg>
          <span class="toolbar__label">设置</span>
        </button>
        <button class="toolbar__btn toolbar__btn--tool toolbar__clear" @click="clearContent">
          <span class="toolbar__icon">✕</span>
          <span class="toolbar__label">清空</span>
        </button>
      </div>
    </header>

    <!-- 页签栏（顶部） -->
    <TabBar
      v-if="showTabs && settingsState.tabPosition === 'top'"
      :documents="docsState.documents"
      :active-id="docsState.activeId"
      position="top"
      @select="setActive"
      @close="closeTab"
      @new="newDocument"
    />

    <!-- 主体 -->
    <div class="app__main">
      <!-- 左侧栏：大纲 -->
      <div
        v-if="settingsState.showOutline"
        ref="sidebarRef"
        class="sidebar"
        :style="{ width: sidebarWidth + 'px' }"
      >
        <OutlinePanel
          :headings="headings"
          @jump="jumpToHeading"
          @close="settingsState.showOutline = false"
        />
      </div>

      <!-- 左侧栏 vs 编辑区：左右间隔线可拖 -->
      <div
        v-if="settingsState.showOutline"
        class="sidebar__resizer"
        title="拖动调整宽度"
        @pointerdown="startSidebarDrag"
      ></div>

      <TabBar
        v-if="showTabs && settingsState.tabPosition === 'left'"
        :documents="docsState.documents"
        :active-id="docsState.activeId"
        position="left"
        @select="setActive"
        @close="closeTab"
        @new="newDocument"
      />

      <!-- 源码模式：左编辑 + 右预览 -->
      <SplitPane
        v-if="settingsState.viewMode === 'source'"
        v-model:split="split"
        :min-left="20"
        :min-right="20"
        class="app__split"
        @drag-start="onDragStart"
        @drag-end="onDragEnd"
      >
        <template #left>
          <MarkdownEditor
            ref="editorPane"
            v-model="activeContent"
            :doc-id="docsState.activeId"
            :matches="matches"
            :current-match-index="safeCurrentIndex"
            :show-line-numbers="settingsState.showLineNumbers"
          />
        </template>
        <template #right>
          <MarkdownPreview
            ref="previewPane"
            :source="activeContent"
            :search-query="search.query"
            :current-match-index="safeCurrentIndex"
          />
        </template>
      </SplitPane>

      <!-- 文档模式：仅预览 -->
      <MarkdownPreview
        v-else
        ref="previewPane"
        class="app__split"
        :source="activeContent"
        :search-query="search.query"
        :current-match-index="safeCurrentIndex"
      />

      <TabBar
        v-if="showTabs && settingsState.tabPosition === 'right'"
        :documents="docsState.documents"
        :active-id="docsState.activeId"
        position="right"
        @select="setActive"
        @close="closeTab"
        @new="newDocument"
      />
    </div>

    <!-- 搜索 / 替换 -->
    <SearchBar
      v-if="search.open"
      v-model:query="search.query"
      v-model:replace-text="search.replaceText"
      v-model:case-sensitive="search.caseSensitive"
      :mode="search.mode"
      :total="matches.length"
      :current="matches.length ? safeCurrentIndex + 1 : 0"
      @next="goNext"
      @prev="goPrev"
      @replace="replaceCurrent"
      @replace-all="replaceAll"
      @close="closeSearch"
      @toggle-mode="search.mode = search.mode === 'search' ? 'replace' : 'search'"
    />

    <!-- 设置面板 -->
    <SettingsPanel v-if="settingsOpen" @close="settingsOpen = false" />

    <!-- 保存提示 -->
    <transition name="toast">
      <div v-if="saveToast" class="toast">{{ saveToast }}</div>
    </transition>
  </div>
</template>

<style scoped>
.app {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.app__main {
  display: flex;
  flex: 1;
  min-height: 0;
}

.app__split {
  flex: 1;
  min-width: 0;
}

/* ---------- 左侧栏（大纲） ---------- */
.sidebar {
  flex: 0 0 auto;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}
.sidebar__resizer {
  flex: 0 0 5px;
  width: 5px;
  cursor: col-resize;
  background: var(--border-color);
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
  transition: background-color 0.15s ease;
}
.sidebar__resizer:hover {
  background: var(--accent);
}

/* ---------- 工具栏 ---------- */
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  min-height: var(--toolbar-height, 46px);
  height: auto;
  padding: 5px 12px;
  background: var(--toolbar-bg, #f6f8fa);
  border-bottom: 1px solid var(--border-color, #d0d7de);
  flex: 0 0 auto;
  user-select: none;
}

.toolbar__brand {
  display: flex;
  align-items: center;
  gap: 8px;
}
.toolbar__title {
  font-size: calc(14px * var(--zoom));
  font-weight: 700;
  white-space: nowrap;
  color: var(--text);
}

.toolbar__format {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-left: 12px;
  border-left: 1px solid var(--border-color, #d0d7de);
}

/* 快捷键按钮 + 下拉面板的锚点 */
.shortcut-anchor {
  position: relative;
}

.toolbar__btn {
  min-width: calc(28px * var(--zoom));
  height: calc(28px * var(--zoom));
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--text);
  font-size: calc(var(--ui-font-size) * var(--zoom));
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
/* 带文字标签的工具按钮：图标在上、名称在下 */
.toolbar__btn--tool {
  flex-direction: column;
  height: auto;
  gap: calc(2px * var(--zoom));
  padding: calc(3px * var(--zoom)) calc(8px * var(--zoom));
}
.toolbar__icon {
  font-size: calc(var(--ui-font-size) * var(--zoom));
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.toolbar__label {
  font-size: calc(12px * var(--zoom));
  line-height: 1.1;
  color: var(--muted);
  white-space: nowrap;
}
.toolbar__btn:hover {
  background: var(--hover-bg);
}
.toolbar__btn:active {
  background: var(--active-bg);
}
.toolbar__btn.is-on {
  color: var(--accent);
  background: var(--hover-bg);
}

.toolbar__right {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}

.toolbar__stats {
  font-size: calc(var(--ui-font-size) * var(--zoom));
  color: var(--muted);
  white-space: nowrap;
}

.toolbar__toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: calc(var(--ui-font-size) * var(--zoom));
  color: var(--muted);
  cursor: pointer;
  white-space: nowrap;
}
.toolbar__toggle input {
  cursor: pointer;
}

/* 显示模式切换（源码 / 文档） */
.toolbar__view {
  display: flex;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  overflow: hidden;
}
.toolbar__view button {
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: calc(var(--ui-font-size) * var(--zoom));
  padding: 3px 10px;
  cursor: pointer;
  white-space: nowrap;
}
.toolbar__view button + button {
  border-left: 1px solid var(--border-color);
}
.toolbar__view button.is-active {
  background: var(--accent);
  color: #ffffff;
}

.toolbar__clear {
  color: var(--danger);
}
.toolbar__clear:hover {
  background: var(--danger-bg);
}

/* 窄屏时工具栏自动换行 */
@media (max-width: 720px) {
  .toolbar {
    height: auto;
    padding: 6px 12px;
  }
}

/* ---------- 保存提示 ---------- */
.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 18px;
  background: var(--text);
  color: var(--bg);
  border-radius: 6px;
  font-size: calc(var(--ui-font-size) * var(--zoom));
  box-shadow: var(--shadow);
  z-index: 200;
}
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(6px);
}
</style>
