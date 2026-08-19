<script setup>
import { ref, computed } from 'vue'
import SplitPane from './components/SplitPane.vue'
import MarkdownEditor from './components/MarkdownEditor.vue'
import MarkdownPreview from './components/MarkdownPreview.vue'
import { useScrollSync } from './composables/useScrollSync'

// ---------- 状态 ----------
const markdown = ref(`# 欢迎使用 Markdown 编辑器

这是一个 **Typora 风格** 的双栏 Markdown 编辑器示例。

## 功能特性

- 拖拽中间分隔线，实时调整左右比例（最小 20%）
- 左侧编辑、右侧实时预览
- 滚动同步（可在工具栏关闭）
- 代码块语法高亮

\`\`\`js
function greet(name) {
  console.log(\`Hello, \${name}!\`)
}
greet('World')
\`\`\`

\`\`\`python
def fib(n):
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a
\`\`\`

> 拖一拖中间的分隔线试试看 👉

| 语法 | 示例 |
| ---- | ---- |
| 加粗 | **文字** |
| 斜体 | *文字* |
| 链接 | [链接](https://example.com) |
`)

const split = ref(50) // 左侧宽度百分比
const syncEnabled = ref(true)

const editorPane = ref(null)
const previewPane = ref(null)

// 滚动同步：传入「获取滚动元素」的函数，避免依赖组件内部实现细节
useScrollSync(
  () => editorPane.value?.getScrollEl() ?? null,
  () => previewPane.value?.getScrollEl() ?? null,
  syncEnabled
)

// ---------- 字数统计 ----------
const charCount = computed(() => markdown.value.length)

// 字数 = 中文字符数 + 英文/数字单词数，符合中文写作习惯
const wordCount = computed(() => {
  const cjk = (markdown.value.match(/[\u4e00-\u9fff]/g) || []).length
  const words = (
    markdown.value.replace(/[\u4e00-\u9fff]/g, ' ').match(/[A-Za-z0-9_]+/g) || []
  ).length
  return cjk + words
})

// ---------- 工具栏动作 ----------
function clearContent() {
  if (markdown.value && !window.confirm('确定要清空编辑器内容吗？')) return
  markdown.value = ''
}

function insertFormat(before, after = '', placeholder = '') {
  editorPane.value?.insertAtCursor(before, after, placeholder)
}

// ---------- 拖拽回调（可按需扩展，如实时显示比例） ----------
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
          width="20"
          height="20"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M14.85 3.35 12.65 1.15a.5.5 0 0 0-.7 0L2.6 10.5a.5.5 0 0 0-.14.25L2 14.25a.5.5 0 0 0 .6.6l3.5-.46a.5.5 0 0 0 .25-.14l8.5-8.5a.5.5 0 0 0 0-.7ZM5.7 12.3l-2.4.32.32-2.4 6.5-6.5 2.08 2.08-6.5 6.5Z"
            fill="currentColor"
          />
        </svg>
        <span class="toolbar__title">Markdown 编辑器</span>
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
      </div>

      <div class="toolbar__right">
        <span class="toolbar__stats">字数 {{ wordCount }} · 字符 {{ charCount }}</span>
        <label class="toolbar__toggle" title="开关滚动同步">
          <input v-model="syncEnabled" type="checkbox" />
          <span>同步滚动</span>
        </label>
        <button class="toolbar__btn toolbar__clear" @click="clearContent">清空</button>
      </div>
    </header>

    <!-- 主体：可拖拽双栏 -->
    <SplitPane
      v-model:split="split"
      :min-left="20"
      :min-right="20"
      @drag-start="onDragStart"
      @drag-end="onDragEnd"
    >
      <template #left>
        <MarkdownEditor ref="editorPane" v-model="markdown" />
      </template>
      <template #right>
        <MarkdownPreview ref="previewPane" :source="markdown" />
      </template>
    </SplitPane>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100%;
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
  color: #1f2328;
}
.toolbar__logo {
  color: var(--accent, #0969da);
}
.toolbar__title {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
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
  color: #1f2328;
  font-size: 13px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.toolbar__btn:hover {
  background: #eaeef2;
}
.toolbar__btn:active {
  background: #d0d7de;
}

.toolbar__right {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}

.toolbar__stats {
  font-size: 13px;
  color: var(--muted, #656d76);
  white-space: nowrap;
}

.toolbar__toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--muted, #656d76);
  cursor: pointer;
  white-space: nowrap;
}
.toolbar__toggle input {
  cursor: pointer;
}

.toolbar__clear {
  color: #cf222e;
}
.toolbar__clear:hover {
  background: #ffebe9;
}

/* 窄屏时工具栏自动换行 */
@media (max-width: 720px) {
  .toolbar {
    height: auto;
    padding: 6px 12px;
  }
}
</style>
