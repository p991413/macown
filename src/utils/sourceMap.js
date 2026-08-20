import { marked } from 'marked'

/**
 * 源映射：把 Markdown 源文本的「块级结构」映射到「逻辑行号」。
 * 用于滚动同步——编辑区与预览区都以「逻辑行号」为共同坐标，避免像素比例错位。
 */

// 块级 token 类型（对应渲染后的块级元素）
const BLOCK_TYPES = new Set([
  'heading',
  'paragraph',
  'code',
  'list',
  'blockquote',
  'table',
  'hr',
])

function countNewlines(str) {
  let n = 0
  for (let i = 0; i < str.length; i++) if (str.charCodeAt(i) === 10) n++
  return n
}

/**
 * 提取块级锚点：返回 [{ type, line }]（line 为 1-based 逻辑行号）。
 * 遍历 marked lexer 的顶层 token，累加 raw 的换行数还原行号；
 * list 展开为「list 整体 + 每个 list_item」，与渲染后的 ul/ol + li 一一对应。
 * @param {string} source
 */
export function collectBlockLines(source) {
  if (!source) return []
  let tokens
  try {
    tokens = marked.lexer(source)
  } catch {
    return []
  }
  const blocks = []
  let line = 1
  const advance = (raw) => {
    line += countNewlines(raw)
  }
  for (const t of tokens) {
    if (BLOCK_TYPES.has(t.type)) {
      blocks.push({ type: t.type, line })
    }
    if (t.type === 'list') {
      for (const item of t.items || []) {
        blocks.push({ type: 'list_item', line })
        advance(item.raw)
      }
    } else {
      advance(t.raw)
    }
  }
  return blocks
}
