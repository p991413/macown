<script setup>
import { ref, computed } from 'vue'
import { buildHighlightedHtml, lineNumberOf } from '../utils/search'

/**
 * 左侧 Markdown 编辑区
 * - 原生 textarea（轻量、无外部编辑器依赖）
 * - 可选行号 gutter
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
})
const emit = defineEmits(['update:modelValue'])

const textareaRef = ref(null)
const backdropRef = ref(null)
const gutterRef = ref(null)

const searching = computed(() => props.matches.length > 0)
const lineCount = computed(() => props.modelValue.split('\n').length)

const highlightedHtml = computed(() =>
  buildHighlightedHtml(props.modelValue, props.matches, props.currentMatchIndex)
)

const currentLine = computed(() => {
  const m = props.matches[props.currentMatchIndex]
  return m ? lineNumberOf(props.modelValue, m.start) : -1
})

function onInput(e) {
  emit('update:modelValue', e.target.value)
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
}

defineExpose({
  insertAtCursor,
  getSelection,
  focusMatch,
  getScrollEl: () => textareaRef.value,
})
</script>

<template>
  <div class="editor" :class="{ 'is-searching': searching }">
    <div v-show="showLineNumbers" ref="gutterRef" class="editor__gutter" aria-hidden="true">
      <div class="editor__gutter-inner">
        <div
          v-for="n in lineCount"
          :key="n"
          class="editor__ln"
          :class="{ 'is-current': n === currentLine }"
        >
          {{ n }}
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
.editor__ln.is-current {
  color: var(--gutter-current-text);
  font-weight: 600;
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
  pointer-events: none;
  display: none;
}
.editor.is-searching .editor__backdrop {
  display: block;
}

/* 高亮层：与 textarea 完全相同的字体/行高/内边距，保证文字逐像素对齐
   右侧多出 10px 内边距用于补偿 textarea 的竖向滚动条宽度 */
.editor__hl {
  margin: 0;
  padding: 16px 30px 16px 20px;
  font-family: var(--code-font-family);
  font-size: var(--editor-font-size);
  line-height: var(--editor-line-height);
  white-space: pre-wrap;
  overflow-wrap: break-word;
  word-break: normal;
  color: var(--editor-text);
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
  background: transparent;
  color: var(--editor-text);
  caret-color: var(--editor-caret);
}
.editor.is-searching .editor__textarea {
  color: transparent;
}
.editor__textarea::placeholder {
  color: var(--editor-placeholder);
}
.editor__textarea::selection {
  background: var(--selection-bg);
}
</style>
