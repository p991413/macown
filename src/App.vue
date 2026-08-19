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
import { useScrollSync } from './composables/useScrollSync'
import { useSettings } from './composables/useSettings'
import { useDocuments } from './composables/useDocuments'
import { findMatches } from './utils/search'

// ---------- 全局 store ----------
const settings = useSettings()
const settingsState = settings.state
const { state: docsState, activeDoc, newDocument, closeDocument, setActive } = useDocuments()

settings.init()

// ---------- 布局 ----------
const split = ref(50)
const syncEnabled = ref(true)
const settingsOpen = ref(false)

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
  if (mod && (e.key === '=' || e.key === '+')) {
    e.preventDefault()
    zoomIn()
  } else if (mod && e.key === '-') {
    e.preventDefault()
    zoomOut()
  } else if (mod && e.key === '0') {
    e.preventDefault()
    zoomReset()
  } else if (mod && (e.key === 'f' || e.key === 'F')) {
    e.preventDefault()
    openSearch(editorPane.value?.getSelection() || '')
  } else if (mod && (e.key === 'r' || e.key === 'R')) {
    e.preventDefault()
    openReplace(editorPane.value?.getSelection() || '')
  } else if (e.key === 'Escape') {
    if (settingsOpen.value) settingsOpen.value = false
    else if (search.open) closeSearch()
  }
}

const showTabs = computed(() => docsState.documents.length > 1)

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    systemDark.value = mq.matches
    mq.addEventListener('change', (ev) => (systemDark.value = ev.matches))
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})

// ---------- 拖拽回调 ----------
function onDragStart() {}
function onDragEnd() {}
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
        <button class="toolbar__btn" title="加粗" @click="insertFormat('**', '**', '加粗')">
          <strong>B</strong>
        </button>
        <button class="toolbar__btn" title="斜体" @click="insertFormat('*', '*', '斜体')">
          <em>I</em>
        </button>
        <button class="toolbar__btn" title="一级标题" @click="insertFormat('# ', '', '标题')">
          H
        </button>
        <button class="toolbar__btn" title="行内代码" @click="insertFormat('`', '`', '代码')">
          &lt;/&gt;
        </button>
        <button
          class="toolbar__btn"
          title="代码块"
          @click="insertFormat('\n```\n', '\n```\n', '代码')"
        >
          { }
        </button>
        <button class="toolbar__btn" title="引用" @click="insertFormat('\n> ', '', '引用')">
          ❝
        </button>
        <button
          class="toolbar__btn"
          title="链接"
          @click="insertFormat('[', '](https://)', '链接文字')"
        >
          🔗
        </button>
        <button class="toolbar__btn" title="表格" @click="insertTable">
          <svg
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
        </button>
      </div>

      <div class="toolbar__right">
        <span class="toolbar__stats">字数 {{ wordCount }} · 字符 {{ charCount }}</span>
        <label class="toolbar__toggle" title="开关滚动同步">
          <input v-model="syncEnabled" type="checkbox" />
          <span>同步滚动</span>
        </label>
        <button class="toolbar__btn" title="设置" @click="settingsOpen = true">
          <svg
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
        </button>
        <button class="toolbar__btn toolbar__clear" @click="clearContent">清空</button>
      </div>
    </header>

    <!-- 页签栏（顶部） -->
    <TabBar
      v-if="showTabs && settingsState.tabPosition === 'top'"
      :documents="docsState.documents"
      :active-id="docsState.activeId"
      position="top"
      @select="setActive"
      @close="closeDocument"
      @new="newDocument"
    />

    <!-- 主体 -->
    <div class="app__main">
      <TabBar
        v-if="showTabs && settingsState.tabPosition === 'left'"
        :documents="docsState.documents"
        :active-id="docsState.activeId"
        position="left"
        @select="setActive"
        @close="closeDocument"
        @new="newDocument"
      />

      <SplitPane
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
            :matches="matches"
            :current-match-index="safeCurrentIndex"
            :show-line-numbers="settingsState.showLineNumbers"
          />
        </template>
        <template #right>
          <MarkdownPreview ref="previewPane" :source="activeContent" />
        </template>
      </SplitPane>

      <TabBar
        v-if="showTabs && settingsState.tabPosition === 'right'"
        :documents="docsState.documents"
        :active-id="docsState.activeId"
        position="right"
        @select="setActive"
        @close="closeDocument"
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

/* ---------- 工具栏 ---------- */
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  height: var(--toolbar-height, 46px);
  padding: 0 12px;
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
  font-size: 14px;
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

.toolbar__btn {
  min-width: 28px;
  height: 28px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--text);
  font-size: 13px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.toolbar__btn:hover {
  background: var(--hover-bg);
}
.toolbar__btn:active {
  background: var(--active-bg);
}

.toolbar__right {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}

.toolbar__stats {
  font-size: 13px;
  color: var(--muted);
  white-space: nowrap;
}

.toolbar__toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--muted);
  cursor: pointer;
  white-space: nowrap;
}
.toolbar__toggle input {
  cursor: pointer;
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
</style>
