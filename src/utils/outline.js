/**
 * 文档大纲工具：从 Markdown 源文本提取标题（供大纲面板与滚动同步锚点共用）
 */

/**
 * 提取 ATX 标题（`#` ～ `######` 开头），跳过代码围栏内的 `#` 伪标题。
 * @param {string} content
 * @returns {Array<{line:number, level:number, text:string}>} line 为逻辑行号（1-based）
 */
export function extractHeadings(content) {
  const headings = []
  if (!content) return headings
  const lines = content.split('\n')
  let inFence = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const fence = line.match(/^\s*(```+|~~~+)/)
    if (fence) {
      inFence = !inFence
      continue
    }
    if (!inFence) {
      const m = line.match(/^(#{1,6})\s+(.*)$/)
      if (m) {
        headings.push({
          line: i + 1,
          level: m[1].length,
          text: m[2].trim(),
        })
      }
    }
  }
  return headings
}
