<script setup>
/**
 * 文档大纲侧边栏：展示 Markdown 标题层级，点击跳转到对应行
 */
defineProps({
  headings: { type: Array, default: () => [] },
})

const emit = defineEmits(['jump', 'close'])

function jumpTo(h, idx) {
  emit('jump', h.line, idx)
}
</script>

<template>
  <aside class="outline">
    <header class="outline__header">
      <span class="outline__title">大纲</span>
      <button class="outline__close" title="关闭大纲" @click="emit('close')">×</button>
    </header>

    <div class="outline__body">
      <p v-if="!headings.length" class="outline__empty">暂无标题</p>
      <nav v-else class="outline__list">
        <button
          v-for="(h, idx) in headings"
          :key="idx"
          class="outline__item"
          :style="{ paddingLeft: (8 + (h.level - 1) * 14) + 'px' }"
          :title="h.text"
          @click="jumpTo(h, idx)"
        >
          {{ h.text }}
        </button>
      </nav>
    </div>
  </aside>
</template>

<style scoped>
.outline {
  flex: 0 0 200px;
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--gutter-bg);
  border-right: 1px solid var(--border-color);
}
.outline__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: calc(36px * var(--zoom));
  padding: 0 8px 0 14px;
  border-bottom: 1px solid var(--border-color);
}
.outline__title {
  font-size: calc(12px * var(--zoom));
  font-weight: 600;
  color: var(--muted);
  letter-spacing: 0.04em;
}
.outline__close {
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: calc(16px * var(--zoom));
  cursor: pointer;
  line-height: 1;
  padding: 4px 6px;
  border-radius: 4px;
}
.outline__close:hover {
  background: var(--hover-bg);
  color: var(--text);
}
.outline__body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}
.outline__empty {
  margin: 12px 14px;
  font-size: calc(12px * var(--zoom));
  color: var(--muted);
  opacity: 0.7;
}
.outline__list {
  display: flex;
  flex-direction: column;
}
.outline__item {
  display: block;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  color: var(--text);
  font-size: calc(13px * var(--zoom));
  line-height: 1.9;
  padding-top: 2px;
  padding-bottom: 2px;
  padding-right: 12px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.outline__item:hover {
  background: var(--hover-bg);
}
</style>
