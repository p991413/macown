<script setup>
import { computed } from 'vue'
import { useSettings } from '../composables/useSettings'

const emit = defineEmits(['close'])

const { state } = useSettings()

const THEMES = [
  { id: 'white', name: '白色', swatch: '#ffffff', border: true },
  { id: 'dark', name: '黑色', swatch: '#0d1117' },
  { id: 'cyber', name: 'Cyber', swatch: '#0a0e14' },
  { id: 'github', name: 'GitHub', swatch: '#f6f8fa', border: true },
]

const CODE_FONT_OPTIONS = [
  { id: 'default', name: '默认（SF Mono）' },
  { id: 'menlo', name: 'Menlo' },
  { id: 'fira', name: 'Fira Code' },
  { id: 'jetbrains', name: 'JetBrains Mono' },
]

const ICON_COLOR_OPTIONS = [
  { id: 'dark', name: '深色' },
  { id: 'light', name: '浅色' },
  { id: 'system', name: '跟随系统' },
]

const TAB_POSITION_OPTIONS = [
  { id: 'top', name: '顶部' },
  { id: 'left', name: '左侧' },
  { id: 'right', name: '右侧' },
]

const zoomPercent = computed(() => Math.round(state.zoom * 100))
function zoomIn() {
  state.zoom = Math.min(2.5, +(state.zoom + 0.1).toFixed(2))
}
function zoomOut() {
  state.zoom = Math.max(0.5, +(state.zoom - 0.1).toFixed(2))
}
function zoomReset() {
  state.zoom = 1
}
</script>

<template>
  <div class="settings-mask" @click.self="emit('close')">
    <div class="settings">
      <header class="settings__header">
        <span>设置</span>
        <button class="settings__close" title="关闭" @click="emit('close')">×</button>
      </header>

      <div class="settings__body">
        <!-- 主题 -->
        <section class="settings__group">
          <div class="settings__label">主题</div>
          <div class="settings__themes">
            <button
              v-for="t in THEMES"
              :key="t.id"
              class="theme-item"
              :class="{ 'is-active': state.theme === t.id }"
              @click="state.theme = t.id"
            >
              <span
                class="theme-item__swatch"
                :class="{ 'theme-item__swatch--border': t.border }"
                :style="{ background: t.swatch }"
              ></span>
              <span class="theme-item__name">{{ t.name }}</span>
            </button>
          </div>
        </section>

        <!-- 字体大小 -->
        <section class="settings__group">
          <div class="settings__label">
            字体大小
            <span class="settings__value">{{ state.fontSize }}px</span>
          </div>
          <input
            v-model.number="state.fontSize"
            type="range"
            min="11"
            max="24"
            step="1"
            class="settings__range"
          />
        </section>

        <!-- 代码字体 -->
        <section class="settings__group">
          <div class="settings__label">代码字体</div>
          <select v-model="state.codeFont" class="settings__select">
            <option v-for="f in CODE_FONT_OPTIONS" :key="f.id" :value="f.id">
              {{ f.name }}
            </option>
          </select>
        </section>

        <!-- 显示行号 -->
        <section class="settings__group settings__group--row">
          <div class="settings__label">显示行号</div>
          <label class="switch">
            <input v-model="state.showLineNumbers" type="checkbox" />
            <span class="switch__slider"></span>
          </label>
        </section>

        <!-- 页签位置 -->
        <section class="settings__group">
          <div class="settings__label">页签位置</div>
          <div class="settings__seg">
            <button
              v-for="p in TAB_POSITION_OPTIONS"
              :key="p.id"
              class="seg-item"
              :class="{ 'is-active': state.tabPosition === p.id }"
              @click="state.tabPosition = p.id"
            >
              {{ p.name }}
            </button>
          </div>
        </section>

        <!-- 图标颜色 -->
        <section class="settings__group">
          <div class="settings__label">图标颜色</div>
          <div class="settings__seg">
            <button
              v-for="c in ICON_COLOR_OPTIONS"
              :key="c.id"
              class="seg-item"
              :class="{ 'is-active': state.iconColor === c.id }"
              @click="state.iconColor = c.id"
            >
              {{ c.name }}
            </button>
          </div>
        </section>

        <!-- 缩放 -->
        <section class="settings__group">
          <div class="settings__label">
            页面缩放
            <span class="settings__hint">Cmd/Ctrl + / - 也可调整</span>
          </div>
          <div class="settings__zoom">
            <button class="btn" @click="zoomOut">−</button>
            <span class="settings__zoom-value">{{ zoomPercent }}%</span>
            <button class="btn" @click="zoomIn">＋</button>
            <button class="btn" @click="zoomReset">重置</button>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-mask {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
}
.settings {
  width: 440px;
  max-width: 90vw;
  max-height: 86vh;
  overflow-y: auto;
  background: var(--panel-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: var(--shadow);
}
.settings__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  font-weight: 600;
  border-bottom: 1px solid var(--border-color);
}
.settings__close {
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 18px;
  cursor: pointer;
}
.settings__close:hover {
  color: var(--danger);
}
.settings__body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.settings__group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.settings__group--row {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}
.settings__label {
  font-size: 13px;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 8px;
}
.settings__value {
  color: var(--text);
  font-weight: 600;
}
.settings__hint {
  font-size: 12px;
  color: var(--muted);
  opacity: 0.8;
}

.settings__themes {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.theme-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 10px 6px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  color: var(--text);
}
.theme-item.is-active {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}
.theme-item__swatch {
  width: 28px;
  height: 28px;
  border-radius: 50%;
}
.theme-item__swatch--border {
  border: 1px solid var(--border-color);
}

.settings__range {
  width: 100%;
}
.settings__select {
  height: 30px;
  padding: 0 8px;
  border: 1px solid var(--input-border);
  border-radius: 6px;
  background: var(--input-bg);
  color: var(--text);
  font-size: 13px;
  outline: none;
}

.settings__seg {
  display: flex;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  overflow: hidden;
}
.seg-item {
  flex: 1;
  height: 30px;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 13px;
  cursor: pointer;
}
.seg-item + .seg-item {
  border-left: 1px solid var(--border-color);
}
.seg-item.is-active {
  background: var(--accent);
  color: #ffffff;
}

.settings__zoom {
  display: flex;
  align-items: center;
  gap: 8px;
}
.settings__zoom-value {
  min-width: 56px;
  text-align: center;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

/* 开关 */
.switch {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 22px;
}
.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}
.switch__slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background: var(--active-bg);
  border-radius: 22px;
  transition: background-color 0.2s;
}
.switch__slider::before {
  content: '';
  position: absolute;
  height: 16px;
  width: 16px;
  left: 3px;
  top: 3px;
  background: #ffffff;
  border-radius: 50%;
  transition: transform 0.2s;
}
.switch input:checked + .switch__slider {
  background: var(--accent);
}
.switch input:checked + .switch__slider::before {
  transform: translateX(18px);
}
</style>
