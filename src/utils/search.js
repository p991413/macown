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
 * - 每个逻辑行包裹 <span class="ll">（供行号测量/定位）
 * - 所有匹配包裹 <mark>；当前匹配用 <mark class="mark-current">
 * - 当前匹配所在行整行包裹 <span class="line-current">（inline 背景整行高亮，随文本流精确对齐）
 * 匹配仅支持单行（跨行匹配不处理），保证 HTML 结构合法。
 */
export function buildHighlightedHtml(content, matches, currentIndex) {
  const lines = content.split('\n')

  // 无匹配：仅按逻辑行包裹 span，便于行号测量
  if (!matches || matches.length === 0) {
    return lines.map((l) => `<span class="ll">${escapeHtml(l)}</span>`).join('\n')
  }

  const ci = ((currentIndex % matches.length) + matches.length) % matches.length
  const cur = matches[ci]

  let out = ''
  let lineStart = 0
  for (let i = 0; i < lines.length; i++) {
    const lineEnd = lineStart + lines[i].length // 该行结束位置（不含换行）
    const events = []

    // 当前匹配所在行：整行包裹 line-current（供 inline 整行高亮）
    if (cur.start >= lineStart && cur.start < lineEnd) {
      events.push({ pos: lineStart, t: 0, tag: '<span class="line-current">' })
      events.push({ pos: lineEnd, t: 3, tag: '</span>' })
    }
    // 本行内完全落下的匹配
    matches.forEach((m, idx) => {
      if (m.start >= lineStart && m.start < lineEnd && m.end <= lineEnd) {
        events.push({
          pos: m.start,
          t: 1,
          tag: idx === ci ? '<mark class="mark-current">' : '<mark>',
        })
        events.push({ pos: m.end, t: 2, tag: '</mark>' })
      }
    })
    events.sort((a, b) => a.pos - b.pos || a.t - b.t)

    let lineHtml = ''
    let pos = lineStart
    for (const ev of events) {
      if (ev.pos > pos) {
        lineHtml += escapeHtml(content.slice(pos, Math.min(ev.pos, lineEnd)))
        pos = ev.pos
      }
      lineHtml += ev.tag
    }
    if (pos < lineEnd) lineHtml += escapeHtml(content.slice(pos, lineEnd))

    out += `<span class="ll">${lineHtml}</span>`
    if (i < lines.length - 1) out += '\n'
    lineStart = lineEnd + 1 // 跳过换行符
  }
  return out
}

/** 计算下标 pos 所在的行号（从 1 开始） */
export function lineNumberOf(content, pos) {
  return content.slice(0, pos).split('\n').length
}
