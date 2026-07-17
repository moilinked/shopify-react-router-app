// 数据分析模块共享 UI 组件(v2.0 table-first)。Polaris Web Components 优先,Tailwind 仅细节微调。
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { AiInsight, AnalyticsColumn, AnalyticsTable, ReportStatus } from '~/types/analytics'

export function SectionCard({ title, subtitle, children }: { title?: string; subtitle?: string; children: ReactNode }) {
  return (
    <s-section heading={title}>
      <s-stack direction="block" gap="base">
        {subtitle && <s-text tone="neutral">{subtitle}</s-text>}
        {children}
      </s-stack>
    </s-section>
  )
}

// Polaris unified web components 暂无 tabs 组件,沿用模块内自绘 tabs(Tailwind 仅此处)
// badge>0 时在标签右上角显示红色计数角标(口径管理用来提示各 tab 待处理项)
export function Tabs({
  tabs,
  active,
  onChange
}: {
  tabs: Array<{ key: string; label: string; badge?: number }>
  active: string
  onChange: (k: string) => void
}) {
  return (
    <div className="flex gap-1 border-b border-[#e3e3e3]">
      {tabs.map((t) => {
        const on = t.key === active
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={[
              'relative border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              on ? 'border-[#2c6ecb] text-[#202223]' : 'border-transparent text-[#6d7175] hover:text-[#202223]'
            ].join(' ')}
          >
            {t.label}
            {t.badge ? (
              <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#b3261e] px-1 text-[10px] font-semibold text-white">
                {t.badge}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

export function UnmatchedBanner({
  missingModel,
  ga4Unaligned,
  channels = 0,
  onGo
}: {
  missingModel: number
  ga4Unaligned: number
  /** 渠道未分组(可选;报表页本期横幅不展示——渠道分组属可选口径,统一在口径管理看) */
  channels?: number
  onGo: () => void
}) {
  const parts: string[] = []
  if (missingModel > 0) parts.push(`${missingModel} 个商品缺 Model`)
  if (ga4Unaligned > 0) parts.push(`${ga4Unaligned} 个 GA4 商品未对齐`)
  if (channels > 0) parts.push(`${channels} 个渠道未分组`)
  if (parts.length === 0) return null
  return (
    <s-banner tone="warning" heading="存在未映射项">
      <s-text>本期有 {parts.join('、')},相关数据计入「未映射」行。</s-text>
      <s-button slot="secondary-actions" variant="secondary" onClick={onGo}>
        去口径管理处理
      </s-button>
    </s-banner>
  )
}

const STATUS_TONE: Record<ReportStatus, 'info' | 'success' | 'critical' | 'neutral'> = {
  PENDING: 'neutral',
  RUNNING: 'info',
  SUCCEEDED: 'success',
  FAILED: 'critical'
}

const STATUS_LABEL: Record<ReportStatus, string> = {
  PENDING: '等待中',
  RUNNING: '生成中',
  SUCCEEDED: '已完成',
  FAILED: '失败'
}

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  return <s-badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</s-badge>
}

// 行内 Markdown:仅 **加粗**(报告里用于标注重点/数据来源)
function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  const regex = /\*\*([^*]+)\*\*/g
  let last = 0
  let key = 0
  let m: RegExpExecArray | null
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    parts.push(
      <strong key={key++} className="font-semibold text-[#1a1a1a]">
        {m[1]}
      </strong>
    )
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

const BLOCK_START = /^(#{1,3}\s|[-*]\s|\d+\.\s|>\s?|-{3,}$|\*{3,}$)/

// 轻量 Markdown 渲染(覆盖 AI 报告子集:## / ### 标题、**加粗**、- / 1. 列表、> 引用、--- 分隔、段落)
function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  let key = 0
  while (i < lines.length) {
    const t = lines[i].trim()
    if (!t) {
      i++
      continue
    }
    if (/^###\s+/.test(t)) {
      blocks.push(
        <div key={key++} className="mt-2 text-sm font-semibold text-[#1a1a1a]">
          {renderInline(t.replace(/^###\s+/, ''))}
        </div>
      )
      i++
    } else if (/^##\s+/.test(t)) {
      blocks.push(
        <div key={key++} className="mt-3 text-[15px] font-semibold text-[#1a1a1a] first:mt-0">
          {renderInline(t.replace(/^##\s+/, ''))}
        </div>
      )
      i++
    } else if (/^#\s+/.test(t)) {
      blocks.push(
        <div key={key++} className="mt-3 text-base font-semibold text-[#1a1a1a] first:mt-0">
          {renderInline(t.replace(/^#\s+/, ''))}
        </div>
      )
      i++
    } else if (/^-{3,}$/.test(t) || /^\*{3,}$/.test(t)) {
      blocks.push(<hr key={key++} className="border-t border-[#e3e3e3]" />)
      i++
    } else if (/^>\s?/.test(t)) {
      const quote: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        quote.push(lines[i].trim().replace(/^>\s?/, ''))
        i++
      }
      blocks.push(
        <blockquote key={key++} className="border-l-4 border-[#cdb4f6] bg-[#f6f3fc] px-3 py-2 text-sm text-[#4a4a4a]">
          {renderInline(quote.join(' '))}
        </blockquote>
      )
    } else if (/^[-*]\s+/.test(t)) {
      const items: string[] = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''))
        i++
      }
      blocks.push(
        <ul key={key++} className="list-disc space-y-1 pl-5 text-sm text-[#4a4a4a]">
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it)}</li>
          ))}
        </ul>
      )
    } else if (/^\d+\.\s+/.test(t)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''))
        i++
      }
      blocks.push(
        <ol key={key++} className="list-decimal space-y-1 pl-5 text-sm text-[#4a4a4a]">
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it)}</li>
          ))}
        </ol>
      )
    } else {
      const para: string[] = []
      while (i < lines.length && lines[i].trim() && !BLOCK_START.test(lines[i].trim())) {
        para.push(lines[i].trim())
        i++
      }
      blocks.push(
        <p key={key++} className="text-sm leading-relaxed text-[#4a4a4a]">
          {renderInline(para.join(' '))}
        </p>
      )
    }
  }
  return <div className="space-y-1.5">{blocks}</div>
}

export function AiInsightCard({ ai }: { ai: AiInsight }) {
  const md = ai.markdown?.trim()
  return (
    <s-section heading="AI 分析">
      <s-stack direction="block" gap="base">
        <s-text tone="neutral">基于服务端预计算指标自动生成(Shopify=准确口径 / GA4=趋势参考)· 仅供参考</s-text>
        {md ? <Markdown source={md} /> : <s-text tone="neutral">本期暂无 AI 分析内容</s-text>}
      </s-stack>
    </s-section>
  )
}

// ===== 核心表格 =====

function formatValue(value: number | null | undefined, type: AnalyticsColumn['type'], symbol: string): string {
  if (value === null || value === undefined) return '—'
  if (type === 'money')
    return `${symbol}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (type === 'percent') return `${(value * 100).toFixed(2)}%`
  return value.toLocaleString('en-US')
}

const landingPageColClass = (key: string): string =>
  key === 'landingPage' ? 'w-[450px] min-w-[450px] max-w-[450px] whitespace-normal break-all' : ''

function DeltaLine({
  deltaPct,
  prevValue,
  type,
  symbol
}: {
  deltaPct: number | null
  prevValue: number | null
  type: AnalyticsColumn['type']
  symbol: string
}) {
  if (deltaPct === null) return null
  const up = deltaPct >= 0
  return (
    <span
      className={`block text-[11px] leading-tight ${up ? 'text-[#1f7a3d]' : 'text-[#b3261e]'}`}
      title={`上期:${formatValue(prevValue, type, symbol)}`}
    >
      {up ? '↑' : '↓'} {Math.abs(deltaPct).toFixed(1)}%
    </span>
  )
}

export function ReportTable({
  table,
  symbol,
  keyword,
  columnKeyword,
  pagination,
  onUnmatchedClick
}: {
  table: AnalyticsTable
  symbol: string
  keyword?: string
  /** 矩阵表使用:按动态数据列 label 过滤,始终保留文本维度列 */
  columnKeyword?: string
  pagination?: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    onPrevious: () => void
    onNext: () => void
    loading?: boolean
  }
  onUnmatchedClick?: () => void
}) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null)
  const visibleColumns = useMemo(() => {
    const k = columnKeyword?.trim().toLowerCase()
    if (!k) return table.columns
    return table.columns.filter((col) => col.type === 'text' || col.label.toLowerCase().includes(k))
  }, [table.columns, columnKeyword])
  const textColCount = visibleColumns.filter((c) => c.type === 'text').length
  const firstColKey = visibleColumns[0]?.key

  const rows = useMemo(() => {
    let list = table.rows
    const k = keyword?.trim().toLowerCase()
    if (k) {
      list = list.filter((row) => Object.values(row.dims).some((v) => v.toLowerCase().includes(k)))
    }
    if (sort) {
      const col = table.columns.find((c) => c.key === sort.key)
      const dir = sort.dir === 'asc' ? 1 : -1
      list = [...list].sort((a, b) => {
        if (col?.type === 'text') return (a.dims[sort.key] ?? '').localeCompare(b.dims[sort.key] ?? '') * dir
        return ((a.metrics[sort.key] ?? -Infinity) - (b.metrics[sort.key] ?? -Infinity)) * dir
      })
    }
    return list
  }, [table, keyword, sort])

  const onSort = (key: string) => {
    setSort((s) => (s?.key === key ? (s.dir === 'desc' ? { key, dir: 'asc' } : null) : { key, dir: 'desc' }))
  }

  const numCell = (value: number | null | undefined, col: AnalyticsColumn) => (
    <span className="block text-right tabular-nums">{formatValue(value, col.type, symbol)}</span>
  )

  return (
    <s-table
      paginate={pagination ? true : undefined}
      hasPreviousPage={pagination ? pagination.page > 1 : undefined}
      hasNextPage={pagination ? pagination.page < pagination.totalPages : undefined}
      loading={pagination?.loading || undefined}
      onPreviousPage={pagination?.onPrevious}
      onNextPage={pagination?.onNext}
    >
      <s-table-header-row>
        {visibleColumns.map((col, ci) => (
          <s-table-header
            key={col.key}
            format={col.type === 'money' ? 'currency' : col.type === 'text' ? 'base' : 'numeric'}
          >
            <span
              className={`block whitespace-nowrap ${ci >= textColCount ? 'text-right' : ''} ${landingPageColClass(
                col.key
              )}`}
            >
              <s-button variant="tertiary" onClick={() => onSort(col.key)}>
                {col.label}
                {sort?.key === col.key ? (sort.dir === 'desc' ? ' ↓' : ' ↑') : ''}
              </s-button>
              {(col.source || col.hint) && (
                <span
                  className="ml-0.5 cursor-help text-[#9aa0a6]"
                  title={[col.source && `数据取自:${col.source}`, col.hint].filter(Boolean).join('\n')}
                >
                  ⓘ
                </span>
              )}
            </span>
          </s-table-header>
        ))}
      </s-table-header-row>
      <s-table-body>
        {table.summary && (
          <s-table-row>
            {visibleColumns.map((col, ci) => (
              <s-table-cell key={col.key}>
                {ci === 0 ? (
                  <span className={`block font-semibold ${landingPageColClass(col.key)}`}>合计</span>
                ) : ci < textColCount ? (
                  ''
                ) : (
                  <span className="block text-right font-semibold tabular-nums">
                    {formatValue(table.summary?.[col.key], col.type, symbol)}
                  </span>
                )}
              </s-table-cell>
            ))}
          </s-table-row>
        )}
        {rows.map((row, ri) => (
          <s-table-row key={ri}>
            {visibleColumns.map((col, ci) => {
              if (ci < textColCount) {
                return (
                  <s-table-cell key={col.key}>
                    <span className={`block ${landingPageColClass(col.key)}`}>{row.dims[col.key] ?? '—'}</span>
                    {col.key === firstColKey && row.dims.sub ? (
                      <span className="block text-[11px] leading-tight text-[#9aa0a6]">{row.dims.sub}</span>
                    ) : null}
                  </s-table-cell>
                )
              }
              const cmp = col.compare ? row.compare?.[col.key] : undefined
              return (
                <s-table-cell key={col.key}>
                  {numCell(row.metrics[col.key], col)}
                  {cmp && (
                    <span className="block text-right">
                      <DeltaLine deltaPct={cmp.deltaPct} prevValue={cmp.prevValue} type={col.type} symbol={symbol} />
                    </span>
                  )}
                </s-table-cell>
              )
            })}
          </s-table-row>
        ))}
        {table.unmatchedRow && (
          <s-table-row>
            {visibleColumns.map((col, ci) => (
              <s-table-cell key={col.key}>
                {ci === 0 ? (
                  <s-stack direction="inline" gap="small-200" alignItems="center">
                    <s-badge tone="warning">{table.unmatchedRow?.dims[col.key] ?? '未映射'}</s-badge>
                    {onUnmatchedClick && (
                      <s-button variant="tertiary" onClick={onUnmatchedClick}>
                        去补录
                      </s-button>
                    )}
                  </s-stack>
                ) : ci < textColCount ? (
                  (table.unmatchedRow?.dims[col.key] ?? '')
                ) : (
                  numCell(table.unmatchedRow?.metrics[col.key], col)
                )}
              </s-table-cell>
            ))}
          </s-table-row>
        )}
        {rows.length === 0 && (
          <s-table-row>
            {visibleColumns.map((col, ci) => (
              <s-table-cell key={col.key}>
                {ci === 0 ? <s-text tone="neutral">没有匹配的数据行</s-text> : ''}
              </s-table-cell>
            ))}
          </s-table-row>
        )}
      </s-table-body>
    </s-table>
  )
}
