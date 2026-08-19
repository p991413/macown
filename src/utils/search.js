/**
 * 文本搜索工具函数（供搜索栏与编辑器高亮共用）
 */

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * 在 content 中查找 query 的所有匹配（返回原始下标区间，供 textarea 选择定位）
 * @param {string} content
 * @param {string} query
 * @param {boolean} caseSensitive
 * @returns {Array<{start:number,end:number}>}
 */
export function findMatches(content, query, caseSensitive = false) {
  if (!query) return []
  const hay = caseSensitive ? content : content.toLowerCase()
  const needle = caseSensitive ? query : query.toLowerCase()
  const matches = []
  let i = 0
  while ((i = hay.indexOf(needle, i)) !== -1) {
    matches.push({ start: i, end: i + needle.length })
    i += needle.length || 1
  }
  return matches
}

/**
 * 生成用于编辑器 backdrop 的高亮 HTML：
 * - 所有匹配包裹 <mark>
 * - 当前匹配用 <mark class="mark-current">
 * - 当前匹配所在行包裹 <span class="line-current">
 * 注意：切片在「原始内容」上进行，逐段转义，保证与 findMatches 的下标一致。
 */
export function buildHighlightedHtml(content, matches, currentIndex) {
  if (!matches || matches.length === 0) return escapeHtml(content)

  const ci = ((currentIndex % matches.length) + matches.length) % matches.length
  const cur = matches[ci]
  const lineStart = content.lastIndexOf('\n', cur.start) + 1
  let lineEnd = content.indexOf('\n', cur.start)
  if (lineEnd === -1) lineEnd = content.length

  // 事件流：t 越小越先输出（行开启 < 匹配开启 < 匹配关闭 < 行关闭）
  const events = [
    { pos: lineStart, t: 0, tag: '<span class="line-current">' },
    { pos: lineEnd, t: 3, tag: '</span>' },
  ]
  matches.forEach((m, idx) => {
    events.push({
      pos: m.start,
      t: 1,
      tag: idx === ci ? '<mark class="mark-current">' : '<mark>',
    })
    events.push({ pos: m.end, t: 2, tag: '</mark>' })
  })
  events.sort((a, b) => a.pos - b.pos || a.t - b.t)

  let out = ''
  let pos = 0
  for (const ev of events) {
    if (ev.pos > pos) {
      out += escapeHtml(content.slice(pos, ev.pos))
      pos = ev.pos
    }
    out += ev.tag
  }
  out += escapeHtml(content.slice(pos))
  return out
}

/** 计算下标 pos 所在的行号（从 1 开始） */
export function lineNumberOf(content, pos) {
  return content.slice(0, pos).split('\n').length
}
