import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { analyticsApi } from '~/services/analytics'
import { useLoading } from '~/hooks/useLoading'
import { ReportStatusBadge } from '~/components/analytics/widgets'
import type { Granularity, PeriodArchivePage } from '~/types/analytics'

// 报告存档:列出所有「有采集数据」的周期(分页 20/页),按粒度 + 周期筛选,行内可手动生成/查看报告。
export default function AnalyticsReports() {
  const navigate = useNavigate()
  const { loading, run } = useLoading()
  const [data, setData] = useState<PeriodArchivePage | null>(null)
  const [granularity, setGranularity] = useState<Granularity>('WEEK')
  const [periodFilter, setPeriodFilter] = useState('') // '' = 全部
  const [page, setPage] = useState(1)
  const [generatingPeriod, setGeneratingPeriod] = useState<string | null>(null)

  // reqRef 防竞态:快速切粒度/周期/翻页时,只让「最后一次请求」写状态
  const reqRef = useRef(0)
  const fetchArchive = useCallback(async () => {
    const myReq = ++reqRef.current
    const res = await analyticsApi.getPeriodArchive(granularity, periodFilter || undefined, page)
    if (myReq === reqRef.current) setData(res)
  }, [granularity, periodFilter, page])

  // 显式加载走 run(显示表格 loading);轮询用静默刷新(见下)避免每 5s 整表闪烁
  const load = useCallback(() => {
    run(() => fetchArchive())
  }, [run, fetchArchive])

  useEffect(() => {
    load()
  }, [load])

  // 有「生成中」报告时 5s 轮询:用稳定 interval + 静默刷新(不走 run)。
  // 单次网络抖动被 catch 吞掉、不影响后续 tick(旧版依赖 data 变化重挂 setTimeout,一次失败即永久停摆)。
  useEffect(() => {
    const pending = data?.items.some((i) => i.report?.status === 'PENDING' || i.report?.status === 'RUNNING')
    if (!pending) return
    const timer = setInterval(() => {
      fetchArchive().catch(() => {
        /* 静默重试下一个 tick */
      })
    }, 5000)
    return () => clearInterval(timer)
  }, [data, fetchArchive])

  const onGranularity = (g: Granularity) => {
    setGranularity(g)
    setPeriodFilter('')
    setPage(1)
  }

  const onGenerate = async (period: string) => {
    if (generatingPeriod) return
    setGeneratingPeriod(period)
    try {
      await analyticsApi.generateReport(granularity, period)
      shopify.toast.show('报告生成中…(采集 + 组表 + AI)')
      // 等刷新拿到新建的 PENDING 报告再清 busy,避免出现「既非 generating 又显示未生成」的闪烁
      await fetchArchive()
    } catch {
      /* toasted */
    } finally {
      setGeneratingPeriod(null)
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <s-page heading="报告存档">
      <s-box padding="large">
        <s-stack direction="block" gap="large-100">
          <s-stack direction="inline" gap="base" alignItems="end">
            <s-select
              label="粒度"
              value={granularity}
              onChange={(e: Event) => onGranularity((e.target as HTMLSelectElement).value as Granularity)}
            >
              <s-option value="WEEK">周报</s-option>
              <s-option value="MONTH">月报</s-option>
            </s-select>
            <s-select
              label="周期"
              value={periodFilter}
              onChange={(e: Event) => {
                setPeriodFilter((e.target as HTMLSelectElement).value)
                setPage(1)
              }}
            >
              <s-option value="">全部周期</s-option>
              {(data?.periods ?? []).map((p) => (
                <s-option key={p.period} value={p.period}>
                  {p.label}
                </s-option>
              ))}
            </s-select>
            <s-text tone="neutral">
              列出所有有采集数据的周期;行内「生成报告」走 采集 + 组表 + N8N AI(配置在服务端)。
            </s-text>
          </s-stack>

          <s-table loading={loading || undefined}>
            <s-table-header-row>
              <s-table-header>周期</s-table-header>
              <s-table-header>粒度</s-table-header>
              <s-table-header>报告状态</s-table-header>
              <s-table-header>AI 分析</s-table-header>
              <s-table-header>生成时间</s-table-header>
              <s-table-header>操作</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {(data?.items ?? []).map((item) => {
                const r = item.report
                const busy = generatingPeriod === item.period || r?.status === 'PENDING' || r?.status === 'RUNNING'
                return (
                  <s-table-row key={item.period}>
                    <s-table-cell>{item.periodLabel}</s-table-cell>
                    <s-table-cell>{item.granularity === 'WEEK' ? '周报' : '月报'}</s-table-cell>
                    <s-table-cell>
                      {r ? <ReportStatusBadge status={r.status} /> : <s-text tone="neutral">未生成</s-text>}
                    </s-table-cell>
                    <s-table-cell>{r?.hasAi ? '有' : '—'}</s-table-cell>
                    <s-table-cell>{r?.createdAt ?? '—'}</s-table-cell>
                    <s-table-cell>
                      {busy ? (
                        <s-button variant="tertiary" disabled>
                          生成中…
                        </s-button>
                      ) : (
                        <s-stack direction="inline" gap="base">
                          {r?.status === 'SUCCEEDED' && (
                            <s-button variant="tertiary" onClick={() => navigate(`/app/analytics/reports/${r.id}`)}>
                              查看
                            </s-button>
                          )}
                          <s-button variant="tertiary" onClick={() => onGenerate(item.period)}>
                            {r ? '重新生成' : '生成报告'}
                          </s-button>
                        </s-stack>
                      )}
                    </s-table-cell>
                  </s-table-row>
                )
              })}
              {data?.items.length === 0 && !loading && (
                <s-table-row>
                  <s-table-cell>
                    <s-text tone="neutral">暂无有数据的周期,先去「报表」页采集本期数据</s-text>
                  </s-table-cell>
                  <s-table-cell>{''}</s-table-cell>
                  <s-table-cell>{''}</s-table-cell>
                  <s-table-cell>{''}</s-table-cell>
                  <s-table-cell>{''}</s-table-cell>
                  <s-table-cell>{''}</s-table-cell>
                </s-table-row>
              )}
            </s-table-body>
          </s-table>

          <s-stack direction="inline" gap="base" alignItems="center">
            <s-button variant="tertiary" disabled={page <= 1 || undefined} onClick={() => setPage((p) => p - 1)}>
              上一页
            </s-button>
            <s-text tone="neutral">
              第 {data?.page ?? 1} / {totalPages} 页 · 共 {data?.total ?? 0} 个周期
            </s-text>
            <s-button
              variant="tertiary"
              disabled={page >= totalPages || undefined}
              onClick={() => setPage((p) => p + 1)}
            >
              下一页
            </s-button>
          </s-stack>

          <s-text tone="neutral">生成中的报告约需 1–2 分钟(采集 + 组表 + AI),列表自动刷新。</s-text>
        </s-stack>
      </s-box>
    </s-page>
  )
}
