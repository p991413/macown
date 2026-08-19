<script setup>
import { computed, ref } from 'vue'
import { Marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'

/**
 * 右侧实时预览区
 * - marked 解析 Markdown
 * - marked-highlight + highlight.js 实现代码块语法高亮
 */
const props = defineProps({
  source: { type: String, default: '' },
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

const html = computed(() => {
  try {
    return marked.parse(props.source)
  } catch (e) {
    return `<pre>Markdown 渲染错误：${e.message}</pre>`
  }
})

defineExpose({
  getScrollEl: () => scrollEl.value,
})
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
  background: #ffffff;
}

.preview-pane__inner {
  max-width: 820px;
  margin: 0 auto;
}
</style>
