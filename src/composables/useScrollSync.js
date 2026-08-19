import { onMounted, onBeforeUnmount } from 'vue'

/**
 * 双栏滚动同步 composable
 *
 * @param {() => HTMLElement | null} getLeft   获取左侧滚动元素
 * @param {() => HTMLElement | null} getRight  获取右侧滚动元素
 * @param {import('vue').Ref<boolean>} enabled 是否启用同步（响应式开关）
 *
 * 实现要点：
 * 1. 监听两侧 scroll 事件，按「已滚动比例」互相映射滚动位置；
 * 2. 通过 target.scrollTop 与目标值的差值判断是否由「我们主动写入」触发，
 *    从而避免 A→B→A 的死循环回弹。
 */
export function useScrollSync(getLeft, getRight, enabled) {
  let leftEl = null
  let rightEl = null

  function sync(source, target) {
    if (!enabled.value) return
    const sourceMax = source.scrollHeight - source.clientHeight
    const targetMax = target.scrollHeight - target.clientHeight
    if (sourceMax <= 0 || targetMax <= 0) return

    const ratio = source.scrollTop / sourceMax
    const next = ratio * targetMax

    // 差值极小说明目标位置已就位，跳过以避免回环
    if (Math.abs(target.scrollTop - next) > 1) {
      target.scrollTop = next
    }
  }

  const onLeftScroll = () => leftEl && rightEl && sync(leftEl, rightEl)
  const onRightScroll = () => leftEl && rightEl && sync(rightEl, leftEl)

  onMounted(() => {
    leftEl = getLeft()
    rightEl = getRight()
    if (leftEl) leftEl.addEventListener('scroll', onLeftScroll, { passive: true })
    if (rightEl) rightEl.addEventListener('scroll', onRightScroll, { passive: true })
  })

  onBeforeUnmount(() => {
    if (leftEl) leftEl.removeEventListener('scroll', onLeftScroll)
    if (rightEl) rightEl.removeEventListener('scroll', onRightScroll)
  })
}
