<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { buildHighlightedHtml, lineNumberOf } from '../utils/search'

/**
 * 左侧 Markdown 编辑区
 * - 原生 textarea（轻量、无外部编辑器依赖）
 * - 可选行号 gutter（按「视觉行」计算，软换行折行时行号仍对齐）
 * - 搜索高亮：采用 backdrop 覆盖层技术，在 textarea 后方渲染高亮 HTML
 *   （textarea 文本在搜索时变透明，露出后方的高亮层）
 */
const props = defineProps({
  modelValue: { type: String, default: '' },
  /** 搜索匹配区间（原始下标），空数组表示未搜索 */
  matches: { type: Array, default: () => [] },
  /** 当前匹配下标 */
  currentMatchIndex: { type: Number, default: 0 },
  /** 是否显示行号 */
  showLineNumbers: { type: Boolean, default: true },
  /** 当前文档 id（切换文档时重置撤销栈，避免跨文档撤销） */
  docId: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const textareaRef = ref(null)
const backdropRef = ref(null)
const gutterRef = ref(null)

// ---------- 撤销 / 重做历史栈（自实现，不依赖浏览器原生 undo 栈） ----------
// 受控 textarea（:value + @input）每次输入 Vue 都会重设 el.value，
// 原生撤销栈会被破坏；故自维护「值 + 光标」快照栈，菜单/快捷键都走这里。
// 快照结构：{ value, start, end }（start/end 为编辑器在该状态下的光标/选区）
const MAX_HISTORY = 100
const undoStack = ref([])
const redoStack = ref([])
let coalesceTimer = null
let pendingSnapshot = null // 待合并的旧值
let pendingCursor = null // 待合并的编辑前光标 { start, end }
let pendingEditCursor = null // beforeinput 捕获到的本次编辑前光标

function flushPending() {
  if (pendingSnapshot != null) {
    undoStack.value.push({
      value: pendingSnapshot,
      start: pendingCursor?.start ?? 0,
      end: pendingCursor?.end ?? 0,
    })
    if (undoStack.value.length > MAX_HISTORY) undoStack.value.shift()
    pendingSnapshot = null
    pendingCursor = null
  }
  clearTimeout(coalesceTimer)
}

function pushHistory(oldValue, cursor) {
  // 快速连续输入合并为一步：只保留输入序列最早的「值 + 光标」
  if (pendingSnapshot == null) {
    pendingSnapshot = oldValue
    pendingCursor = cursor ? { start: cursor.start, end: cursor.end } : null
  }
  clearTimeout(coalesceTimer)
  coalesceTimer = setTimeout(flushPending, 500)
}

function currentSnapshot() {
  const ta = textareaRef.value
  return {
    value: props.modelValue,
    start: ta?.selectionStart ?? 0,
    end: ta?.selectionEnd ?? 0,
  }
}

function setValue(v, cursor) {
  emit('update:modelValue', v)
  const ta = textareaRef.value
  nextTick(() => {
    if (ta && ta.value !== v) ta.value = v
    if (ta) {
      const start = cursor ? cursor.start : Math.min(ta.selectionStart ?? v.length, v.length)
      const end = cursor ? cursor.end : start
      ta.setSelectionRange(start, end)
    }
  })
}

function undo() {
  flushPending()
  if (!undoStack.value.length) return
  const current = currentSnapshot()
  const prev = undoStack.value.pop()
  redoStack.value.push(current)
  if (redoStack.value.length > MAX_HISTORY) redoStack.value.shift()
  setValue(prev.value, { start: prev.start, end: prev.end })
}

function redo() {
  if (!redoStack.value.length) return
  const current = currentSnapshot()
  const next = redoStack.value.pop()
  undoStack.value.push(current)
  if (undoStack.value.length > MAX_HISTORY) undoStack.value.shift()
  setValue(next.value, { start: next.start, end: next.end })
}

const searching = computed(() => props.matches.length > 0)

// 高亮覆盖层 HTML：每个逻辑行包裹 .ll（供行号测量/折行对齐），
// 所有匹配包裹 <mark>，当前匹配用 <mark class="mark-current"> 强调。
// 未搜索时（matches 为空）仍会生成 .ll，保证行号测量始终可用。
const highlightedHtml = computed(() =>
  buildHighlightedHtml(props.modelValue, props.matches, props.currentMatchIndex)
)

// 每个逻辑行占用的视觉行数（考虑软换行折行）
const visualLineCounts = ref([])
const lineHeightPx = ref(0) // 编辑器行高（px，测量得到）
const padTopPx = ref(0) // 编辑器顶部内边距（px）

// 逻辑行（1-based）→ 其第一个视觉行的 Y 坐标（相对文本内容顶部）
function lineTopOfLogicalLine(line) {
  if (line < 1) return -1
  const counts = visualLineCounts.value
  let visualIdx = 0
  for (let i = 0; i < line - 1; i++) visualIdx += counts[i] || 1
  return visualIdx * lineHeightPx.value + padTopPx.value
}

// 生成行号 gutter 条目：每个视觉行一项，折行续行留空
const gutterLines = computed(() => {
  const lines = props.modelValue.split('\n')
  const counts = visualLineCounts.value
  const ok = counts.length === lines.length
  const result = []
  for (let i = 0; i < lines.length; i++) {
    const c = ok ? Math.max(1, counts[i]) : 1
    result.push({ num: i + 1 })
    for (let j = 1; j < c; j++) result.push({ num: '' })
  }
  return result
})

// 测量每个逻辑行折了几行：直接数 backdrop 中每个 .ll（逻辑行 span）的视觉行数，
// 与用户实际看到的换行完全一致（不再用镜像估算，避免表格长行行号错位）
function measureLines() {
  const ta = textareaRef.value
  const backdrop = backdropRef.value
  const lines = props.modelValue.split('\n')
  if (ta) {
    const cs = getComputedStyle(ta)
    lineHeightPx.value = parseFloat(cs.lineHeight) || 0
    padTopPx.value = parseFloat(cs.paddingTop) || 0
  }
  if (!backdrop) return
  const spans = backdrop.querySelectorAll('.ll')
  const counts = new Array(lines.length).fill(1)
  for (let i = 0; i < spans.length && i < lines.length; i++) {
    counts[i] = Math.max(1, spans[i].getClientRects().length)
  }
  visualLineCounts.value = counts
}

let measureTimer = null
function scheduleMeasure() {
  clearTimeout(measureTimer)
  measureTimer = setTimeout(measureLines, 60)
}

let resizeObserver = null
let styleObserver = null

onMounted(() => {
  measureLines()
  if (textareaRef.value) {
    resizeObserver = new ResizeObserver(scheduleMeasure)
    resizeObserver.observe(textareaRef.value)
  }
  // 缩放/字号变化会改 documentElement 的 inline style，需要重新测量行高与折行
  styleObserver = new MutationObserver(() => scheduleMeasure())
  styleObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['style'],
  })
})

onBeforeUnmount(() => {
  clearTimeout(measureTimer)
  resizeObserver?.disconnect()
  styleObserver?.disconnect()
})

// 内容变化时重新测量（防抖 60ms）
watch(() => props.modelValue, scheduleMeasure)

// 切换文档时重置撤销/重做栈，避免跨文档撤销串味
watch(
  () => props.docId,
  () => {
    flushPending()
    undoStack.value = []
    redoStack.value = []
    pendingEditCursor = null
  }
)
// 开关行号时重新测量
watch(
  () => props.showLineNumbers,
  (v) => {
    if (v) measureLines()
  }
)
// beforeinput 在编辑真正发生前触发，此刻光标还是「编辑前」的位置，用它记录快照最精确
function onBeforeInput(e) {
  const ta = textareaRef.value
  if (ta) {
    pendingEditCursor = { start: ta.selectionStart, end: ta.selectionEnd }
  }
}

function onInput(e) {
  const next = e.target.value
  const prev = props.modelValue
  if (next !== prev) {
    // 记录旧值 + 编辑前光标（快速连续输入自动合并为一步）
    pushHistory(prev, pendingEditCursor)
    pendingEditCursor = null
    // 清空重做栈：新输入后无法重做
    redoStack.value = []
    emit('update:modelValue', next)
  }
}

// 滚动同步：textarea 滚动时，同步 backdrop 与 gutter 的 scrollTop
function onScroll() {
  const ta = textareaRef.value
  if (!ta) return
  if (backdropRef.value) backdropRef.value.scrollTop = ta.scrollTop
  if (gutterRef.value) gutterRef.value.scrollTop = ta.scrollTop
}

/**
 * 在光标处插入文本，并自动选中 placeholder 方便直接替换。
 */
function insertAtCursor(before, after = '', placeholder = '') {
  const ta = textareaRef.value
  if (!ta) return

  const start = ta.selectionStart
  const end = ta.selectionEnd
  const inserted = before + placeholder + after
  const newValue = props.modelValue.slice(0, start) + inserted + props.modelValue.slice(end)

  // 程序化插入也进撤销历史，工具栏操作可撤销（记录操作前光标）
  flushPending()
  undoStack.value.push({ value: props.modelValue, start, end })
  if (undoStack.value.length > MAX_HISTORY) undoStack.value.shift()
  redoStack.value = []
  emit('update:modelValue', newValue)

  requestAnimationFrame(() => {
    ta.focus()
    const selStart = start + before.length
    ta.setSelectionRange(selStart, selStart + placeholder.length)
  })
}

/** 返回当前选中的文本（供 Cmd+F 预填搜索词） */
function getSelection() {
  const ta = textareaRef.value
  if (!ta) return ''
  return ta.value.slice(ta.selectionStart, ta.selectionEnd)
}

/** 定位到某个匹配（选中并滚动到可见区域） */
function focusMatch(start, end) {
  const ta = textareaRef.value
  if (!ta) return
  ta.focus()
  ta.setSelectionRange(start, end)
  // 按行号滚动到目标行（行高恒定，行号→scrollTop 精确，无需 DOM 二次精修）
  scrollToMatch(start)
}

/** 滚动到指定字符位置所在行（居中，按测量行高估算） */
function scrollToMatch(start) {
  const ta = textareaRef.value
  if (!ta) return
  const top = lineTopOfLogicalLine(lineNumberOf(props.modelValue, start))
  if (top < 0) return
  const max = ta.scrollHeight - ta.clientHeight
  ta.scrollTop = Math.max(0, Math.min(top - ta.clientHeight / 2, max))
}

/** 复制当前行（或选中的多行）到下一行 */
function duplicateLine() {
  const ta = textareaRef.value
  if (!ta) return
  const value = props.modelValue
  const selStart = ta.selectionStart
  const selEnd = ta.selectionEnd
  const ls = value.lastIndexOf('\n', selStart - 1) + 1
  let le = value.indexOf('\n', selEnd)
  if (le === -1) le = value.length
  const block = value.slice(ls, le) // 要复制的文本（不含结尾换行）
  const hasTrailing = le < value.length
  const insertPos = hasTrailing ? le + 1 : le
  const inserted = hasTrailing ? block + '\n' : le === 0 ? block : '\n' + block
  const newValue = value.slice(0, insertPos) + inserted + value.slice(insertPos)

  flushPending()
  undoStack.value.push({ value: props.modelValue, start: selStart, end: selEnd })
  if (undoStack.value.length > MAX_HISTORY) undoStack.value.shift()
  redoStack.value = []
  emit('update:modelValue', newValue)
  requestAnimationFrame(() => {
    ta.focus()
    ta.setSelectionRange(insertPos, insertPos + block.length)
  })
}

/** 滚动到指定逻辑行（1-based），供大纲点击跳转 */
function scrollToLine(line) {
  const ta = textareaRef.value
  if (!ta) return
  const top = lineTopOfLogicalLine(line)
  if (top < 0) return
  const max = ta.scrollHeight - ta.clientHeight
  ta.scrollTop = Math.max(0, Math.min(top - 8, max))
}

// ---------- 源映射：scrollTop ↔ 逻辑行号（供滚动同步对齐） ----------

/**
 * 逻辑行号（浮点，1-based；1.5 表示第 1 行中部）→ scrollTop。
 * 基于 visualLineCounts 精确换算（含软换行折行）。
 */
function lineToScrollTop(line) {
  const counts = visualLineCounts.value
  const lh = lineHeightPx.value
  if (!lh || !counts.length) return padTopPx.value
  if (line <= 1) return padTopPx.value
  const idx = Math.floor(line - 1)
  const frac = line - 1 - idx
  let visual = 0
  for (let k = 0; k < idx && k < counts.length; k++) visual += counts[k] || 1
  if (idx < counts.length) visual += frac * (counts[idx] || 1)
  return visual * lh + padTopPx.value
}

/** scrollTop → 逻辑行号（浮点，1-based） */
function scrollTopToLine(scrollTop) {
  const counts = visualLineCounts.value
  const lh = lineHeightPx.value
  if (!lh || !counts.length) return 1
  const visual = (scrollTop - padTopPx.value) / lh
  if (visual <= 0) return 1
  let remain = visual
  for (let i = 0; i < counts.length; i++) {
    const c = counts[i] || 1
    if (remain < c) return i + 1 + remain / c
    remain -= c
  }
  return Math.max(1, counts.length)
}

function getScrollMapper() {
  return { scrollTopToLine, lineToScrollTop }
}

defineExpose({
  insertAtCursor,
  getSelection,
  focusMatch,
  duplicateLine,
  scrollToLine,
  getScrollMapper,
  getScrollEl: () => textareaRef.value,
  undo,
  redo,
  undoStack,
  redoStack,
})
</script>

<template>
  <div class="editor" :class="{ 'is-searching': searching }">
    <div v-show="showLineNumbers" ref="gutterRef" class="editor__gutter" aria-hidden="true">
      <div class="editor__gutter-inner">
        <div
          v-for="(ln, idx) in gutterLines"
          :key="idx"
          class="editor__ln"
        >
          {{ ln.num }}
        </div>
      </div>
    </div>

    <div class="editor__scroll">
      <div ref="backdropRef" class="editor__backdrop" aria-hidden="true">
        <div class="editor__hl" v-html="highlightedHtml"></div>
      </div>
      <textarea
        ref="textareaRef"
        class="editor__textarea"
        :value="modelValue"
        @beforeinput="onBeforeInput"
        @input="onInput"
        @scroll="onScroll"
        spellcheck="false"
        autocapitalize="off"
        autocorrect="off"
        wrap="soft"
        placeholder="在此输入 Markdown…"
      ></textarea>
    </div>
  </div>
</template>

<style scoped>
.editor {
  display: flex;
  width: 100%;
  height: 100%;
  background: var(--editor-bg);
}

/* ---------- 行号 gutter ---------- */
.editor__gutter {
  flex: 0 0 44px;
  overflow: hidden;
  background: var(--gutter-bg);
  user-select: none;
  border-right: 1px solid var(--border-color);
}
.editor__gutter-inner {
  padding: 16px 8px;
}
.editor__ln {
  text-align: right;
  font-family: var(--code-font-family);
  font-size: var(--editor-font-size);
  line-height: var(--editor-line-height);
  color: var(--gutter-text);
}

/* ---------- 正文区（textarea + backdrop 覆盖层） ---------- */
.editor__scroll {
  flex: 1;
  position: relative;
  min-width: 0;
}

.editor__backdrop {
  position: absolute;
  inset: 0;
  overflow: hidden;
  scrollbar-gutter: stable; /* 与 textarea 相同的滚动条预留，保证高亮层与文本区域等宽、换行一致 */
  pointer-events: none;
  z-index: 2; /* 覆盖在 textarea 之上；文字透明，仅搜索时叠加半透明高亮框 */
}

/* 高亮覆盖层：与 textarea 完全相同的字体/行高/内边距，保证逐像素对齐；
   文字透明（正文由下方 textarea 呈现），只露出 mark 的半透明高亮框 */
.editor__hl {
  margin: 0;
  padding: 16px 20px;
  font-family: var(--code-font-family);
  font-size: var(--editor-font-size);
  line-height: var(--editor-line-height);
  white-space: pre-wrap;
  overflow-wrap: break-word;
  word-break: normal;
  font-kerning: normal;
  letter-spacing: normal;
  word-spacing: normal;
  color: transparent;
}

.editor__textarea {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: none;
  outline: none;
  resize: none;
  padding: 16px 20px;
  font-family: var(--code-font-family);
  font-size: var(--editor-font-size);
  line-height: var(--editor-line-height);
  white-space: pre-wrap;
  overflow-wrap: break-word;
  word-break: normal;
  font-kerning: normal;
  letter-spacing: normal;
  word-spacing: normal;
  scrollbar-gutter: stable;
  background: transparent;
  color: var(--editor-text);
  caret-color: var(--editor-caret);
  z-index: 1; /* 位于高亮覆盖层之下，文字始终可见 */
}
.editor__textarea::placeholder {
  color: var(--editor-placeholder);
}
.editor__textarea::selection {
  background: var(--selection-bg);
}
</style>
