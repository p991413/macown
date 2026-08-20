import { reactive, watch } from 'vue'

/**
 * 全局设置（单例 store），持久化到 localStorage
 * 管理：主题、字号、代码字体、行号、页签位置、图标颜色、缩放比例
 */

const STORAGE_KEY = 'macown:settings'

const DEFAULTS = {
  theme: 'github', // 'white' | 'dark' | 'cyber' | 'github'
  fontSize: 14, // 编辑器字号
  codeFont: 'default', // 'default' | 'menlo' | 'fira' | 'jetbrains'
  showLineNumbers: true,
  showOutline: true,
  tabPosition: 'top', // 'top' | 'left' | 'right'
  iconColor: 'system', // 'dark' | 'light' | 'system'
  zoom: 1, // 缩放比例
}

// 代码字体选项
export const CODE_FONTS = {
  default:
    "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
  menlo: "Menlo, Monaco, 'Courier New', monospace",
  fira: "'Fira Code', ui-monospace, SFMono-Regular, Menlo, monospace",
  jetbrains: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
}

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }
  } catch {
    return { ...DEFAULTS }
  }
}

const state = reactive(load())

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    /* 忽略存储异常 */
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
}

function applyStyle() {
  const z = state.zoom || 1
  const root = document.documentElement
  // 缩放只改变字号（不改变布局宽度）：避免列宽随缩放变窄、搜索高亮错位
  root.style.setProperty('--zoom', String(z))
  root.style.setProperty('--editor-font-size', `${(state.fontSize * z).toFixed(2)}px`)
  root.style.setProperty('--preview-font-size', `${((state.fontSize + 2) * z).toFixed(2)}px`)
  root.style.setProperty(
    '--code-font-family',
    CODE_FONTS[state.codeFont] || CODE_FONTS.default
  )
}

// 图标颜色 → 原生外观（标题栏/系统主题）
function applyNativeTheme() {
  window.electronAPI?.setNativeTheme?.(state.iconColor)
}

function init() {
  applyTheme(state.theme)
  applyStyle()
  applyNativeTheme()
}

watch(
  () => state.theme,
  (v) => applyTheme(v)
)
watch(
  () => [state.fontSize, state.codeFont, state.zoom],
  () => applyStyle()
)
watch(
  () => state.iconColor,
  () => applyNativeTheme()
)
watch(state, save, { deep: true })

export function useSettings() {
  return {
    state,
    CODE_FONTS,
    init,
    applyTheme,
    setTheme: (t) => (state.theme = t),
    setZoom: (z) => (state.zoom = z),
  }
}
