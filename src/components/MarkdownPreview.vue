<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import { Marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'
import { collectBlockLines } from '../utils/sourceMap'

/**
 * 右侧实时预览区
 * - marked 解析 Markdown
 * - marked-highlight + highlight.js 实现代码块语法高亮
 * - 搜索时对渲染结果做文本节点级高亮（黄色 <mark>），并定位到当前匹配
 */
const props = defineProps({
  source: { type: String, default: '' },
  searchQuery: { type: String, default: '' },
  /** 当前匹配下标（用于预览区当前匹配高亮与滚动定位） */
  currentMatchIndex: { type: Number, default: 0 },
})

const scrollEl = ref(null)

// 配置 marked：接入 highlight.js 高亮扩展
const marked = new Marked(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext'
      return hljs.highlight(code, { language }).value
    },
  })
)

marked.setOptions({
  gfm: true, // GitHub Flavored Markdown
  breaks: true, // 单个换行也渲染为 <br>
})

// 预览区禁用超链接：链接渲染为纯文本，避免点击触发外部导航导致卡死
marked.use({
  renderer: {
    link: (_href, _title, text) => text,
  },
})

// 在渲染后的 HTML 文本节点中高亮搜索词（不破坏标签结构）
function highlightInHtml(htmlString, query, currentIndex) {
  const needle = query.toLowerCase()
  if (!needle) return htmlString
  const container = document.createElement('div')
  container.innerHTML = htmlString
  const textNodes = []
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) textNodes.push(walker.currentNode)
  for (const node of textNodes) {
    const text = node.nodeValue || ''
    const hay = text.toLowerCase()
    if (!hay.includes(needle)) continue
    const frag = document.createDocumentFragment()
    let pos = 0
    let idx
    while ((idx = hay.indexOf(needle, pos)) !== -1) {
      if (idx > pos) frag.appendChild(document.createTextNode(text.slice(pos, idx)))
      const mark = document.createElement('mark')
      mark.className = 'preview-mark'
      mark.textContent = text.slice(idx, idx + needle.length)
      frag.appendChild(mark)
      pos = idx + needle.length
    }
    if (pos < text.length) frag.appendChild(document.createTextNode(text.slice(pos)))
    node.parentNode?.replaceChild(frag, node)
  }
  // 按顺序把「当前」匹配标记出来（渲染顺序与源文档一致）
  const marks = container.querySelectorAll('mark.preview-mark')
  if (currentIndex >= 0 && marks.length) {
    marks[Math.min(currentIndex, marks.length - 1)]?.classList.add('mark-current')
  }
  return container.innerHTML
}

const html = computed(() => {
  try {
    const raw = marked.parse(props.source)
    return props.searchQuery
      ? highlightInHtml(raw, props.searchQuery, props.currentMatchIndex)
      : raw
  } catch (e) {
    return `<pre>Markdown 渲染错误：${e.message}</pre>`
  }
})

// 搜索词/当前匹配变化时，滚动预览区到当前匹配（DOM 更新后）
watch(
  () => [props.searchQuery, props.currentMatchIndex],
  () => {
    nextTick(() => {
      const mark = scrollEl.value?.querySelector('mark.preview-mark.mark-current')
      mark?.scrollIntoView({ block: 'center' })
    })
  },
  { flush: 'post' }
)

// ---------- 源映射：scrollTop ↔ 逻辑行号（供滚动同步对齐） ----------

// 块级元素标签集合（与 sourceMap.js 的 BLOCK_TYPES 对应）
const BLOCK_TAG = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'pre', 'ul', 'ol', 'blockquote', 'table', 'hr',
])

// 源文本的块级行号列表（source 变化时重算）
const blockLines = computed(() => collectBlockLines(props.source))

// 收集渲染后的块级元素，顺序与 blockLines 严格对应：
// ul/ol 展开为「ul/ol 整体 + 每个 li」，其余块取自身，不递归内部
function collectBlockElements(inner) {
  const els = []
  for (const child of inner.children) {
    const tag = child.tagName.toLowerCase()
    if (tag === 'ul' || tag === 'ol') {
      els.push(child)
      for (const li of child.children) {
        if (li.tagName.toLowerCase() === 'li') els.push(li)
      }
    } else if (BLOCK_TAG.has(tag)) {
      els.push(child)
    }
  }
  return els
}

// 计算块锚点 [{ line, top }]（top 为相对滚动容器内容顶部的像素位置）
function getBlockAnchors() {
  const el = scrollEl.value
  const inner = el?.querySelector('.preview-pane__inner')
  const lines = blockLines.value
  if (!el || !inner || !lines.length) return []
  const els = collectBlockElements(inner)
  const anchors = []
  const rect = el.getBoundingClientRect()
  const n = Math.min(lines.length, els.length)
  for (let i = 0; i < n; i++) {
    const top = els[i].getBoundingClientRect().top - rect.top + el.scrollTop
    anchors.push({ line: lines[i].line, top })
  }
  return anchors
}

// 源文本的总行数（用于首尾边界映射）
const totalLines = computed(() => props.source.split('\n').length)

/** 预览区 scrollTop → 逻辑行号（浮点，块间按行号插值，首尾边界线性外推） */
function scrollTopToLine(scrollTop) {
  const el = scrollEl.value
  const anchors = getBlockAnchors()
  if (!anchors.length) return 1
  const first = anchors[0]
  const last = anchors[anchors.length - 1]
  const total = totalLines.value

  // 顶部 → 第一块之间：第 1 行 线性映射到 第一块行号
  if (scrollTop <= first.top) {
    const t = first.top > 0 ? Math.max(0, scrollTop) / first.top : 1
    return 1 + t * (first.line - 1)
  }
  // 中间块区间
  for (let i = 0; i < anchors.length - 1; i++) {
    if (scrollTop >= anchors[i].top && scrollTop <= anchors[i + 1].top) {
      const seg = anchors[i + 1].top - anchors[i].top
      const t = seg > 0 ? (scrollTop - anchors[i].top) / seg : 0
      const dl = anchors[i + 1].line - anchors[i].line
      return anchors[i].line + t * dl
    }
  }
  // 最后一块 → 底部：最后一块行号 线性映射到 总行数
  const max = el ? el.scrollHeight - el.clientHeight : last.top
  const after = max - last.top
  const t = after > 0 ? (scrollTop - last.top) / after : 0
  return last.line + t * (total - last.line)
}

/** 逻辑行号（浮点）→ 预览区 scrollTop（首尾边界线性外推） */
function lineToScrollTop(line) {
  const el = scrollEl.value
  const anchors = getBlockAnchors()
  if (!anchors.length) return 0
  const first = anchors[0]
  const last = anchors[anchors.length - 1]
  const total = totalLines.value

  // 第 1 行 → 第一块之间
  if (line <= first.line) {
    const span = first.line - 1
    const t = span > 0 ? (line - 1) / span : 0
    return t * first.top
  }
  // 中间块区间
  for (let i = 0; i < anchors.length - 1; i++) {
    if (line >= anchors[i].line && line <= anchors[i + 1].line) {
      const dl = anchors[i + 1].line - anchors[i].line
      const t = dl > 0 ? (line - anchors[i].line) / dl : 0
      return anchors[i].top + t * (anchors[i + 1].top - anchors[i].top)
    }
  }
  // 最后一块 → 底部
  const max = el ? el.scrollHeight - el.clientHeight : last.top
  const span = total - last.line
  const t = span > 0 ? (line - last.line) / span : 0
  return last.top + t * (max - last.top)
}

function getScrollMapper() {
  return { scrollTopToLine, lineToScrollTop }
}

defineExpose({
  getScrollEl: () => scrollEl.value,
  getScrollMapper,
  scrollToHeadingIndex,
})

/** 滚动到第 index 个标题（与编辑区 extractHeadings 顺序对应），供大纲跳转 */
function scrollToHeadingIndex(index) {
  const el = scrollEl.value
  if (!el) return
  const hs = el.querySelectorAll(
    '.markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4, .markdown-body h5, .markdown-body h6'
  )
  const h = hs[index]
  if (!h) return
  const top = h.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop
  const max = el.scrollHeight - el.clientHeight
  el.scrollTop = Math.max(0, Math.min(top - 8, max))
}
</script>

<template>
  <div ref="scrollEl" class="preview-pane">
    <div class="markdown-body preview-pane__inner" v-html="html"></div>
  </div>
</template>

<style scoped>
.preview-pane {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  padding: 20px 24px;
  background: var(--preview-bg);
}

.preview-pane__inner {
  max-width: 820px;
  margin: 0 auto;
}
</style>
