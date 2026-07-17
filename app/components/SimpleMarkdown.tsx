import type { ReactNode } from 'react'

/**
 * 轻量 Markdown 渲染(零依赖):支持标题、粗体、有序/无序列表、段落。
 * 仅渲染为 React 元素,不注入原始 HTML,安全。
 */

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts
    .filter((p) => p !== '')
    .map((p, i) => {
      const key = `${keyPrefix}-${i}`
      if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={key}>{p.slice(2, -2)}</strong>
      if (/^`[^`]+`$/.test(p)) {
        return (
          <code key={key} className="rounded bg-[#f1f1f1] px-1 text-[0.92em]">
            {p.slice(1, -1)}
          </code>
        )
      }
      return <span key={key}>{p}</span>
    })
}

export function SimpleMarkdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let list: { ordered: boolean; items: string[] } | null = null

  const flushList = (key: string) => {
    if (!list) return
    const items = list.items.map((it, i) => <li key={`${key}-li-${i}`}>{renderInline(it, `${key}-li-${i}`)}</li>)
    blocks.push(
      list.ordered ? (
        <ol key={key} className="m-0 list-decimal space-y-1 pl-6">
          {items}
        </ol>
      ) : (
        <ul key={key} className="m-0 list-disc space-y-1 pl-6">
          {items}
        </ul>
      )
    )
    list = null
  }

  lines.forEach((rawLine, index) => {
    const line = rawLine.trimEnd()
    const key = `md-${index}`

    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      flushList(`${key}-pre`)
      const level = heading[1].length
      const sizes = ['text-xl', 'text-lg', 'text-base', 'text-base', 'text-sm', 'text-sm']
      blocks.push(
        <div key={key} className={`font-semibold ${sizes[level - 1]} mt-2`}>
          {renderInline(heading[2], key)}
        </div>
      )
      return
    }

    const ordered = line.match(/^\s*\d+\.\s+(.*)$/)
    const unordered = line.match(/^\s*[-*]\s+(.*)$/)
    if (ordered || unordered) {
      const isOrdered = Boolean(ordered)
      const content = (ordered ? ordered[1] : unordered![1]) ?? ''
      if (!list || list.ordered !== isOrdered) {
        flushList(`${key}-pre`)
        list = { ordered: isOrdered, items: [] }
      }
      list.items.push(content)
      return
    }

    if (line.trim() === '') {
      flushList(key)
      return
    }

    flushList(`${key}-pre`)
    blocks.push(
      <p key={key} className="m-0">
        {renderInline(line, key)}
      </p>
    )
  })

  flushList('md-tail')

  return <div className="space-y-2 text-sm text-[#202223]">{blocks}</div>
}
