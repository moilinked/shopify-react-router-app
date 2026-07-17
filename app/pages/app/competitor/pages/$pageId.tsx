import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts'
import { competitorApi } from '~/services/competitor'
import { useLoading } from '~/hooks/useLoading'
import type { PageHistory, PageHistoryCell } from '~/types/competitor'
import { PAGE_TYPE_MAP, PLATFORM_MAP, FIELD_SOURCE_MAP } from '~/types/competitor'
import { formatStructuredValue, formatCompactValue } from '~/components/competitor/PageChangeCompareModal'

const CHANGE_BG: Record<string, string> = {
  ADDED: 'bg-[#e3f1df]',
  REMOVED: 'bg-[#fbeae5]',
  MODIFIED: 'bg-[#fff5ea]'
}

function shortTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function cellDisplay(cell: PageHistoryCell): string {
  return formatCompactValue(formatStructuredValue(cell.valueJson, cell.valueText), 40)
}

export default function PageHistoryPage() {
  const { pageId } = useParams()
  const navigate = useNavigate()
  const { loading, run } = useLoading()
  const [history, setHistory] = useState<PageHistory | null>(null)

  const load = useCallback(() => {
    if (!pageId) return
    run(async () => {
      const res = await competitorApi.getPageHistory(pageId, 12)
      setHistory(res)
    })
  }, [pageId, run])

  useEffect(() => {
    load()
  }, [load])

  const page = history?.page
  const runs = history?.runs ?? []
  const fields = history?.fields ?? []
  const series = history?.series ?? {}
  const seriesKeys = Object.keys(series).filter((k) => (series[k]?.length ?? 0) >= 2)

  return (
    <s-page heading={page ? `字段历史 — ${page.pageName}` : '字段历史'}>
      <s-button slot="secondary-actions" variant="secondary" onClick={() => navigate(-1)}>
        返回
      </s-button>
      <s-button slot="primary-action" variant="tertiary" onClick={load}>
        刷新
      </s-button>

      <s-box padding="large">
        <s-stack direction="block" gap="large-100">
          {page && (
            <s-section>
              <s-stack direction="inline" gap="base" alignItems="center">
                <s-badge tone={page.platform === 'GENERIC' || !page.platform ? 'neutral' : 'info'}>
                  {PLATFORM_MAP[page.platform] ?? page.platform}
                </s-badge>
                <s-text>{PAGE_TYPE_MAP[page.pageType] ?? page.pageType}</s-text>
                {page.brand && <s-text tone="neutral">{page.brand.name}</s-text>}
                <s-link href={page.pageUrl} target="_blank">
                  打开页面
                </s-link>
              </s-stack>
            </s-section>
          )}

          {loading && !history && <s-spinner accessibilityLabel="加载中" />}

          {history && runs.length === 0 && <s-text tone="neutral">该页面暂无历史运行数据。</s-text>}

          {/* 数值字段趋势 */}
          {seriesKeys.length > 0 && (
            <s-section heading="数值趋势">
              <div className="flex flex-wrap gap-6">
                {seriesKeys.map((key) => {
                  const fieldLabel = fields.find((f) => f.fieldKey === key)?.label ?? key
                  const data = series[key].map((p) => ({ x: shortTime(p.t), v: p.v }))
                  return (
                    <div key={key} className="rounded border border-[#d9d9d9] p-2">
                      <div className="mb-1 text-sm text-[#6d7175]">{fieldLabel}</div>
                      <LineChart
                        width={320}
                        height={160}
                        data={data}
                        margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                        <XAxis dataKey="x" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} width={40} domain={['auto', 'auto']} />
                        <Tooltip />
                        <Line type="monotone" dataKey="v" stroke="#2c6ecb" strokeWidth={2} dot={{ r: 2 }} />
                      </LineChart>
                    </div>
                  )
                })}
              </div>
            </s-section>
          )}

          {/* 字段 × 运行 矩阵 */}
          {fields.length > 0 && (
            <s-section heading="字段历史矩阵">
              <div className="overflow-x-auto">
                <table className="border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 border border-[#d9d9d9] bg-[#f4f4f4] px-2 py-1 text-left">
                        字段
                      </th>
                      {runs.map((r) => (
                        <th key={r.runId} className="border border-[#d9d9d9] bg-[#f4f4f4] px-2 py-1 whitespace-nowrap">
                          {shortTime(r.runAt)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field) => (
                      <tr key={field.fieldKey}>
                        <td className="sticky left-0 z-10 border border-[#d9d9d9] bg-white px-2 py-1 whitespace-nowrap">
                          <span className="mr-1">{field.label}</span>
                          {field.priority && <span className="text-xs text-[#6d7175]">{field.priority}</span>}
                        </td>
                        {field.cells.map((cell) => {
                          const lowConf = cell.confidence != null && cell.confidence < 0.6
                          return (
                            <td
                              key={cell.runId}
                              className={`max-w-[160px] border border-[#d9d9d9] px-2 py-1 align-top ${
                                cell.changed && cell.changeType ? (CHANGE_BG[cell.changeType] ?? '') : ''
                              }`}
                              title={formatStructuredValue(cell.valueJson, cell.valueText) ?? ''}
                            >
                              <span className={`break-words ${lowConf ? 'text-[#8c9196]' : ''}`}>
                                {cellDisplay(cell) || '-'}
                              </span>
                              {cell.source === 'STRUCTURED' && (
                                <span className="ml-1 text-xs text-[#108043]" title="结构化来源">
                                  🔗
                                </span>
                              )}
                              {lowConf && (
                                <span className="ml-1 text-xs text-[#8c9196]" title="低置信,待确认">
                                  ?
                                </span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <s-text tone="neutral">{FIELD_SOURCE_MAP.STRUCTURED.label} 🔗 表示来自确定性来源;? 表示低置信字段</s-text>
            </s-section>
          )}
        </s-stack>
      </s-box>
    </s-page>
  )
}
