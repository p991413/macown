<script setup>
import { ref } from 'vue'

/**
 * 左侧 Markdown 编辑区
 * 使用原生 textarea，保证轻量、无外部编辑器依赖。
 */
const props = defineProps({
  modelValue: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const textarea = ref(null)

function onInput(e) {
  emit('update:modelValue', e.target.value)
}

/**
 * 在光标处插入文本，并自动选中 placeholder 方便直接替换。
 * 例如 insertAtCursor('**', '**', '加粗') 会得到 **加粗** 且选中「加粗」。
 */
function insertAtCursor(before, after = '', placeholder = '') {
  const ta = textarea.value
  if (!ta) return

  const start = ta.selectionStart
  const end = ta.selectionEnd
  const value = props.modelValue
  const inserted = before + placeholder + after
  const newValue = value.slice(0, start) + inserted + value.slice(end)

  emit('update:modelValue', newValue)

  requestAnimationFrame(() => {
    ta.focus()
    const selStart = start + before.length
    ta.setSelectionRange(selStart, selStart + placeholder.length)
  })
}

// 对外暴露：插入文本方法 + 滚动元素（供滚动同步使用）
defineExpose({
  insertAtCursor,
  getScrollEl: () => textarea.value,
})
</script>

<template>
  <textarea
    ref="textarea"
    class="editor-pane"
    :value="modelValue"
    @input="onInput"
    spellcheck="false"
    autocapitalize="off"
    autocorrect="off"
    wrap="soft"
    placeholder="在此输入 Markdown…"
  ></textarea>
</template>

<style scoped>
.editor-pane {
  width: 100%;
  height: 100%;
  border: none;
  outline: none;
  resize: none;
  padding: 20px 24px;
  font-family: 'SFMono-Regular', ui-monospace, Consolas, 'Liberation Mono',
    Menlo, monospace;
  font-size: 14px;
  line-height: 1.7;
  color: #1f2328;
  background: #ffffff;
  word-break: break-all;
  overflow-wrap: break-word;
}

.editor-pane::placeholder {
  color: #8c959f;
}
</style>
