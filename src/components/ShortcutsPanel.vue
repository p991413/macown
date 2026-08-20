<script setup>
const props = defineProps({
  // [{ title: string, items: [{ icon, name, keys, run }] }]
  groups: { type: Array, required: true },
})
const emit = defineEmits(['close'])

function onClick(item) {
  item.run?.()
  emit('close')
}
</script>

<template>
  <div class="shortcuts">
    <section v-for="g in groups" :key="g.title" class="shortcuts__group">
      <div class="shortcuts__group-title">{{ g.title }}</div>
      <div class="shortcuts__items">
        <button
          v-for="it in g.items"
          :key="it.name"
          class="shortcuts__item"
          @click="onClick(it)"
        >
          <span class="shortcuts__icon">{{ it.icon }}</span>
          <span class="shortcuts__name">{{ it.name }}</span>
          <kbd class="shortcuts__keys">{{ it.keys }}</kbd>
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.shortcuts {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 60;
  min-width: 264px;
  background: var(--panel-bg);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  box-shadow: var(--shadow);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.shortcuts__group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.shortcuts__group-title {
  font-size: calc(11px * var(--zoom));
  font-weight: 600;
  color: var(--muted);
  letter-spacing: 0.5px;
  padding: 0 6px;
}
.shortcuts__items {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.shortcuts__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text);
  font-size: calc(13px * var(--zoom));
  cursor: pointer;
  text-align: left;
}
.shortcuts__item:hover {
  background: var(--hover-bg);
}
.shortcuts__icon {
  width: 20px;
  text-align: center;
  flex: 0 0 auto;
  font-style: normal;
}
.shortcuts__name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.shortcuts__keys {
  font-family: var(--code-font-family);
  font-size: calc(11px * var(--zoom));
  color: var(--muted);
  background: var(--hover-bg);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 1px 6px;
  white-space: nowrap;
  flex: 0 0 auto;
}
</style>
