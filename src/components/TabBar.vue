<script setup>
import { useSettings } from '../composables/useSettings'

const props = defineProps({
  documents: { type: Array, required: true },
  activeId: { type: String, default: null },
  position: { type: String, default: 'top' }, // 'top' | 'left' | 'right'
})
const emit = defineEmits(['select', 'close', 'new'])

const { state: settingsState } = useSettings()

function titleOf(doc) {
  // 优先显示文件名（已关联磁盘文件）
  if (doc?.name) return doc.name
  if (!doc || !doc.content) return '未命名'
  const line = doc.content.split('\n').find((l) => l.trim())
  if (!line) return '未命名'
  return line.replace(/^#+\s*/, '').trim().slice(0, 20) || '未命名'
}
</script>

<template>
  <div class="tabbar" :class="[`tabbar--${position}`, { 'tabbar--rounded': settingsState.tabStyle === 'rounded' }]">
    <div class="tabbar__tabs">
      <div
        v-for="doc in documents"
        :key="doc.id"
        class="tabbar__tab"
        :class="{ 'is-active': doc.id === activeId }"
        :title="doc.path || titleOf(doc)"
        @click="emit('select', doc.id)"
      >
        <span class="tabbar__title">{{ titleOf(doc) }}</span>
        <span v-if="doc.dirty" class="tabbar__dot" title="待保存"></span>
        <button
          class="tabbar__close"
          title="关闭"
          @click.stop="emit('close', doc.id)"
        >
          ×
        </button>
      </div>
    </div>
    <button class="tabbar__new" title="新建文档" @click="emit('new')">+</button>
  </div>
</template>

<style scoped>
.tabbar {
  display: flex;
  flex: 0 0 auto;
  background: var(--toolbar-bg);
  user-select: none;
}
.tabbar__tabs {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow-x: auto;
  overflow-y: auto;
}
.tabbar__new {
  flex: 0 0 auto;
  width: 32px;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: calc(18px * var(--zoom));
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.tabbar__new:hover {
  color: var(--text);
  background: var(--hover-bg);
}

.tabbar__tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  color: var(--muted);
  border-right: 1px solid var(--border-color);
  cursor: pointer;
  white-space: nowrap;
  font-size: calc(var(--ui-font-size) * var(--zoom));
  flex: 0 0 auto;
  min-width: 0;
}
.tabbar__tab:hover {
  background: var(--hover-bg);
  color: var(--text);
}
.tabbar__tab.is-active {
  background: var(--bg);
  color: var(--accent);
  font-weight: 600;
  box-shadow: inset 0 -2px 0 var(--accent);
}
.tabbar__title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tabbar__dot {
  flex: 0 0 auto;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
}
.tabbar__close {
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-size: calc(14px * var(--zoom));
  line-height: 1;
  padding: 2px 4px;
  border-radius: 4px;
}
.tabbar__close:hover {
  color: var(--danger);
  background: var(--danger-bg);
}

/* ---------- 顶部（水平） ---------- */
.tabbar--top {
  flex-direction: row;
  height: calc(var(--tab-height) * var(--zoom));
  border-bottom: 1px solid var(--border-color);
}
.tabbar--top .tabbar__tab {
  height: 100%;
  width: var(--tab-item-width, 160px);
}

/* ---------- 左侧 / 右侧（垂直） ---------- */
.tabbar--left,
.tabbar--right {
  flex-direction: column;
  width: var(--tab-width);
}
.tabbar--left {
  border-right: 1px solid var(--border-color);
}
.tabbar--right {
  border-left: 1px solid var(--border-color);
}
.tabbar--left .tabbar__tabs,
.tabbar--right .tabbar__tabs {
  flex-direction: column;
}
.tabbar--left .tabbar__tab,
.tabbar--right .tabbar__tab {
  height: calc(var(--tab-height) * var(--zoom));
  border-right: none;
  border-bottom: 1px solid var(--border-color);
}
.tabbar--left .tabbar__tab.is-active {
  box-shadow: inset -2px 0 0 var(--accent);
}
.tabbar--right .tabbar__tab.is-active {
  box-shadow: inset 2px 0 0 var(--accent);
}
.tabbar--left .tabbar__title,
.tabbar--right .tabbar__title {
  max-width: 120px;
}

/* ---------- 圆角样式（弧度可调） ---------- */
.tabbar--rounded .tabbar__tab {
  border-radius: var(--tab-radius, 6px);
}
.tabbar--rounded.tabbar--top .tabbar__tab {
  border-radius: var(--tab-radius, 6px) var(--tab-radius, 6px) 0 0;
}
.tabbar--rounded.tabbar--top .tabbar__tab.is-active {
  box-shadow: inset 0 -2px 0 var(--accent);
}
.tabbar--rounded.tabbar--left .tabbar__tab {
  border-radius: var(--tab-radius, 6px) 0 0 var(--tab-radius, 6px);
}
.tabbar--rounded.tabbar--right .tabbar__tab {
  border-radius: 0 var(--tab-radius, 6px) var(--tab-radius, 6px) 0;
}
</style>
