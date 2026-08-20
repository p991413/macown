<script setup>
import { ref, nextTick } from 'vue'

/**
 * 浮动搜索 / 替换栏（Cmd/Ctrl+F 搜索，Cmd/Ctrl+R 替换）
 */
const props = defineProps({
  query: { type: String, default: '' },
  replaceText: { type: String, default: '' },
  mode: { type: String, default: 'search' }, // 'search' | 'replace'
  total: { type: Number, default: 0 },
  current: { type: Number, default: 0 }, // 1-based；0 表示无匹配
  caseSensitive: { type: Boolean, default: false },
})
const emit = defineEmits([
  'update:query',
  'update:replaceText',
  'update:caseSensitive',
  'next',
  'prev',
  'replace',
  'replaceAll',
  'close',
  'toggle-mode',
])

const searchInput = ref(null)

function focusSearch() {
  nextTick(() => searchInput.value?.focus())
}
defineExpose({ focusSearch })

function onSearchKeydown(e) {
  if (e.key === 'Enter') {
    e.preventDefault()
    if (e.shiftKey) emit('prev')
    else emit('next')
  }
}
</script>

<template>
  <div class="searchbar">
    <div class="searchbar__row">
      <input
        ref="searchInput"
        class="searchbar__input"
        type="text"
        :value="query"
        placeholder="查找"
        @input="emit('update:query', $event.target.value)"
        @keydown="onSearchKeydown"
      />
      <span class="searchbar__count" :class="{ 'is-none': total === 0 }">
        {{ total === 0 ? '0/0' : `${current}/${total}` }}
      </span>
      <button class="searchbar__btn" title="上一个 (Shift+Enter)" @click="emit('prev')">↑</button>
      <button class="searchbar__btn" title="下一个 (Enter)" @click="emit('next')">↓</button>
      <button
        class="searchbar__btn searchbar__btn--toggle"
        :class="{ 'is-on': caseSensitive }"
        title="区分大小写"
        @click="emit('update:caseSensitive', !caseSensitive)"
      >
        Aa
      </button>
      <button class="searchbar__btn" title="关闭 (Esc)" @click="emit('close')">×</button>
    </div>

    <div v-if="mode === 'replace'" class="searchbar__row">
      <input
        class="searchbar__input"
        type="text"
        :value="replaceText"
        placeholder="替换为"
        @input="emit('update:replaceText', $event.target.value)"
        @keydown.enter="emit('replace')"
      />
      <button class="searchbar__btn searchbar__btn--text" @click="emit('replace')">替换</button>
      <button class="searchbar__btn searchbar__btn--text" @click="emit('replaceAll')">
        全部替换
      </button>
    </div>
  </div>
</template>

<style scoped>
.searchbar {
  position: absolute;
  top: calc(var(--toolbar-height) + 12px);
  right: 16px;
  z-index: 50;
  min-width: 340px;
  background: var(--panel-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: var(--shadow);
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.searchbar__row {
  display: flex;
  align-items: center;
  gap: 4px;
}
.searchbar__input {
  flex: 1;
  min-width: 0;
  height: calc(28px * var(--zoom));
  padding: 0 8px;
  border: 1px solid var(--input-border);
  border-radius: 6px;
  background: var(--input-bg);
  color: var(--text);
  font-size: calc(13px * var(--zoom));
  outline: none;
}
.searchbar__input:focus {
  border-color: var(--accent);
}
.searchbar__count {
  font-size: calc(12px * var(--zoom));
  color: var(--muted);
  min-width: 44px;
  text-align: center;
  white-space: nowrap;
}
.searchbar__count.is-none {
  color: var(--danger);
}
.searchbar__btn {
  min-width: calc(26px * var(--zoom));
  height: calc(26px * var(--zoom));
  padding: 0 6px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  font-size: calc(13px * var(--zoom));
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.searchbar__btn:hover {
  background: var(--hover-bg);
  color: var(--text);
}
.searchbar__btn--text {
  padding: 0 10px;
  white-space: nowrap;
}
.searchbar__btn--toggle.is-on {
  color: var(--accent);
  background: var(--hover-bg);
}
</style>
