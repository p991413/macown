import { watch, onBeforeUnmount } from 'vue'

/**
 * 双栏滚动同步 composable —— 「行号中介」算法
 *
 * 编辑区是等行高、预览区是渲染后的实际高度，两者像素高度不成比例，
 * 用「像素比例」或「标题区间像素插值」都会漂移。改为：
 *
 *   1. 两侧各自把 scrollTop 换算成「逻辑行号」（浮点，1-based）；
 *   2. 以行号作为共同坐标，再换算回另一侧的 scrollTop。
 *
 * 这样编辑区的第 N 行，恒对应预览区渲染出的同一处内容。
 *
 * 元素通过 getLeft()/getRight() 动态获取；当 DOM 重建（如切换显示模式、
 * 编辑器卸载后重挂载）时，watch 会重新绑定 scroll 监听。
 *
 * @param {() => HTMLElement | null} getLeft          左侧滚动元素
 * @param {() => HTMLElement | null} getRight         右侧滚动元素
 * @param {() => ({scrollTopToLine:Function,lineToScrollTop:Function}) | null} getLeftMapper
 * @param {() => ({scrollTopToLine:Function,lineToScrollTop:Function}) | null} getRightMapper
 * @param {import('vue').Ref<boolean>} enabled        是否启用同步
 */
export function useScrollSync(getLeft, getRight, getLeftMapper, getRightMapper, enabled) {
  let leftEl = null
  let rightEl = null

  function sync(source, target, srcMapper, tgtMapper) {
    if (!enabled.value) return
    if (!srcMapper || !tgtMapper) return
    const sourceMax = source.scrollHeight - source.clientHeight
    const targetMax = target.scrollHeight - target.clientHeight
    if (sourceMax <= 0 || targetMax <= 0) return

    // 源 scrollTop → 逻辑行号 → 目标 scrollTop
    const line = srcMapper.scrollTopToLine(source.scrollTop)
    const next = tgtMapper.lineToScrollTop(line)

    // 差值极小说明目标位置已就位，跳过以避免回环
    if (Math.abs(target.scrollTop - next) > 1) {
      target.scrollTop = next
    }
  }

  const onLeftScroll = () => {
    if (!leftEl || !rightEl) return
    sync(leftEl, rightEl, getLeftMapper?.(), getRightMapper?.())
  }
  const onRightScroll = () => {
    if (!leftEl || !rightEl) return
    sync(rightEl, leftEl, getRightMapper?.(), getLeftMapper?.())
  }

  function bind() {
    const l = getLeft()
    const r = getRight()
    if (l === leftEl && r === rightEl) return
    unbind()
    leftEl = l
    rightEl = r
    if (leftEl) leftEl.addEventListener('scroll', onLeftScroll, { passive: true })
    if (rightEl) rightEl.addEventListener('scroll', onRightScroll, { passive: true })
  }

  function unbind() {
    if (leftEl) leftEl.removeEventListener('scroll', onLeftScroll)
    if (rightEl) rightEl.removeEventListener('scroll', onRightScroll)
    leftEl = null
    rightEl = null
  }

  // 首次挂载与元素变化时（DOM 重建/模式切换）重新绑定
  watch(
    () => [getLeft(), getRight()],
    () => bind(),
    { flush: 'post', immediate: true }
  )

  onBeforeUnmount(unbind)
}
