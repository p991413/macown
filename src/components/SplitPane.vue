<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

/**
 * SplitPane —— 可拖拽的双栏布局组件
 *
 * 核心设计：
 * 1. 左右宽度以「百分比」表示（left = split%，right = 100-split%），天然响应式；
 * 2. 拖拽中间分隔线实时改变 split，并做 minLeft / minRight 约束；
 * 3. 使用 Pointer Events + window 监听，拖出分隔线也能继续拖动；
 * 4. 拖拽期间给 body 加 .is-dragging，全局禁用文本选中；
 * 5. 用 requestAnimationFrame 节流，保证拖动流畅、不抖动；
 * 6. 窗口 resize 时做防抖，并对 split 重新做边界收敛。
 */

const props = defineProps({
  /** 左侧面板宽度百分比（0 ~ 100） */
  split: { type: Number, default: 50 },
  /** 左侧最小宽度百分比 */
  minLeft: { type: Number, default: 20 },
  /** 右侧最小宽度百分比 */
  minRight: { type: Number, default: 20 },
})

const emit = defineEmits(['update:split', 'drag-start', 'drag-end'])

const containerRef = ref(null)
const dragging = ref(false)

let lastEvent = null // 最近一次 pointer 事件（配合 rAF 节流使用）
let rafId = null

const leftStyle = computed(() => ({ width: `${props.split}%` }))
const rightStyle = computed(() => ({ width: `${100 - props.split}%` }))

/** 将百分比收敛到 [minLeft, 100 - minRight] 区间 */
function clamp(value) {
  return Math.min(100 - props.minRight, Math.max(props.minLeft, value))
}

function startDrag(e) {
  if (e.button !== 0) return // 仅响应鼠标左键
  e.preventDefault()
  dragging.value = true
  lastEvent = e
  document.body.classList.add('is-dragging')
  emit('drag-start', props.split)

  // 监听在 window 上，鼠标移出分隔线后仍可持续拖动
  window.addEventListener('pointermove', onDrag, { passive: false })
  window.addEventListener('pointerup', stopDrag)
  window.addEventListener('pointercancel', stopDrag)
}

function onDrag(e) {
  lastEvent = e
  // rAF 节流：一帧内只计算一次，避免高频触发造成卡顿
  if (!rafId) rafId = requestAnimationFrame(updateSplit)
}

function updateSplit() {
  rafId = null
  if (!dragging.value || !containerRef.value || !lastEvent) return

  const rect = containerRef.value.getBoundingClientRect()
  const x = lastEvent.clientX - rect.left
  const percent = (x / rect.width) * 100
  emit('update:split', clamp(percent))
}

function stopDrag() {
  if (!dragging.value) return
  dragging.value = false
  document.body.classList.remove('is-dragging')
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  window.removeEventListener('pointermove', onDrag)
  window.removeEventListener('pointerup', stopDrag)
  window.removeEventListener('pointercancel', stopDrag)
  emit('drag-end', props.split)
}

// ---------- 防抖工具 ----------
function debounce(fn, wait = 150) {
  let timer = null
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), wait)
  }
}

// 窗口尺寸变化时，重新收敛 split（应对极端情况，例如 min 值在运行时改变）
const handleResize = debounce(() => {
  const clamped = clamp(props.split)
  if (Math.abs(clamped - props.split) > 0.01) {
    emit('update:split', clamped)
  }
}, 150)

onMounted(() => window.addEventListener('resize', handleResize))

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  stopDrag()
})
</script>

<template>
  <div
    ref="containerRef"
    class="split-pane"
    :class="{ 'is-dragging': dragging }"
  >
    <div class="split-pane__left" :style="leftStyle">
      <slot name="left" />
    </div>

    <div
      class="split-pane__divider"
      role="separator"
      aria-orientation="vertical"
      @pointerdown="startDrag"
    >
      <div class="split-pane__handle"></div>
    </div>

    <div class="split-pane__right" :style="rightStyle">
      <slot name="right" />
    </div>
  </div>
</template>

<style scoped>
.split-pane {
  display: flex;
  flex: 1;
  width: 100%;
  min-height: 0;
  overflow: hidden;
}

.split-pane__left,
.split-pane__right {
  height: 100%;
  min-width: 0;
  overflow: hidden;
  position: relative;
}

/* 中间分隔线 */
.split-pane__divider {
  flex: 0 0 6px;
  width: 6px;
  cursor: col-resize;
  background: var(--border-color, #d0d7de);
  position: relative;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none; /* 阻止移动端滚动与拖拽冲突 */
  transition: background-color 0.15s ease;
}

.split-pane__divider:hover,
.split-pane.is-dragging .split-pane__divider {
  background: var(--accent, #0969da);
}

/* 分隔线中间的小把手提示 */
.split-pane__handle {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 2px;
  height: 32px;
  border-radius: 1px;
  background: #ffffff;
  opacity: 0.65;
  pointer-events: none;
}
</style>
