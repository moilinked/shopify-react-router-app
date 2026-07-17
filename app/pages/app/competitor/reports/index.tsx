import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { competitorApi } from '~/services/competitor'
import { useLoading } from '~/hooks/useLoading'
import type { CompetitorWeeklyReport } from '~/types/competitor'
import { REPORT_STATUS_MAP, REPORT_STATUS_TONE } from '~/types/competitor'

const LIMIT = 20

function fmtTime(iso: string | null | undefined) {
  if (!iso) return '-'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '-'
  return iso.slice(0, 10)
}

export default function ReportsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const runIdFilter = searchParams.get('runId') ?? ''
  const { loading, run } = useLoading()
  const [reports, setReports] = useState<CompetitorWeeklyReport[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [generating, setGenerating] = useState(false)

  const loadReports = useCallback(() => {
    run(async () => {
      const res = await competitorApi.getWeeklyReports({
        page,
        limit: LIMIT,
        ...(runIdFilter ? { runId: runIdFilter } : {})
      })
      setReports(res.data)
      setTotal(res.total)
    })
  }, [run, page, runIdFilter])

  useEffect(() => {
    loadReports()
  }, [loadReports])

  // 有生成中的周报时 5s 轮询,直到全部进入终态
  useEffect(() => {
    if (!reports.some((r) => r.status === 'GENERATING')) return
    const timer = setTimeout(loadReports, 5000)
    return () => clearTimeout(timer)
  }, [reports, loadReports])

  // 生成周报:优先用 URL 上的 runId(运行详情跳转带入),否则取最新已收敛 run
  const handleGenerate = async () => {
    if (generating) return
    setGenerating(true)
    try {
      let targetRunId = runIdFilter
      if (!targetRunId) {
        const runs = await competitorApi.getRuns({ page: 1, limit: 10 })
        const target = runs.data.find((r) => r.status === 'SUCCEEDED' || r.status === 'PARTIAL_FAILED')
        if (!target) {
          if (typeof shopify !== 'undefined') shopify.toast.show('暂无已完成的运行,无法生成周报', { isError: true })
          return
        }
        targetRunId = target.id
      }
      await competitorApi.generateWeeklyReport(targetRunId)
      if (typeof shopify !== 'undefined') shopify.toast.show('周报生成中…')
      loadReports()
    } catch {
      /* request 内已 toast */
    } finally {
      setGenerating(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  return (
    <s-page heading="竞品周报">
      <s-button slot="primary-action" variant="primary" onClick={handleGenerate} disabled={generating || undefined}>
        {generating ? '触发中…' : runIdFilter ? '生成本次运行周报' : '生成最新周报'}
      </s-button>
      <s-button slot="secondary-actions" variant="secondary" onClick={() => navigate('/app/competitor')}>
        返回概览
      </s-button>

      <s-box padding="large">
        {runIdFilter && (
          <s-box paddingBlockEnd="base">
            <s-stack direction="inline" gap="small-200" alignItems="center">
              <s-badge tone="info">已按运行过滤: {runIdFilter.slice(0, 8)}…</s-badge>
              <s-button
                variant="tertiary"
                onClick={() => {
                  setSearchParams({})
                  setPage(1)
                }}
              >
                查看全部
              </s-button>
            </s-stack>
          </s-box>
        )}
        <s-table
          paginate={totalPages > 1 || undefined}
          hasPreviousPage={page > 1 || undefined}
          hasNextPage={page < totalPages || undefined}
          loading={loading || undefined}
          onPreviousPage={() => setPage((p) => Math.max(1, p - 1))}
          onNextPage={() => setPage((p) => p + 1)}
        >
          <s-table-header-row>
            <s-table-header>周期</s-table-header>
            <s-table-header>状态</s-table-header>
            <s-table-header>触发方式</s-table-header>
            <s-table-header>模型</s-table-header>
            <s-table-header>生成时间</s-table-header>
            <s-table-header>操作</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {reports.map((r) => (
              <s-table-row key={r.id}>
                <s-table-cell>
                  {fmtDate(r.periodStart)} ~ {fmtDate(r.periodEnd)}
                </s-table-cell>
                <s-table-cell>
                  <s-badge tone={REPORT_STATUS_TONE[r.status]}>{REPORT_STATUS_MAP[r.status]}</s-badge>
                </s-table-cell>
                <s-table-cell>{r.triggerType}</s-table-cell>
                <s-table-cell>{r.modelUsed ?? '-'}</s-table-cell>
                <s-table-cell>{fmtTime(r.createdAt)}</s-table-cell>
                <s-table-cell>
                  <s-button variant="tertiary" onClick={() => navigate(`/app/competitor/reports/${r.id}`)}>
                    查看
                  </s-button>
                </s-table-cell>
              </s-table-row>
            ))}
            {reports.length === 0 && !loading && (
              <s-table-row>
                <s-table-cell>
                  <s-text tone="neutral">暂无周报</s-text>
                </s-table-cell>
              </s-table-row>
            )}
          </s-table-body>
        </s-table>
      </s-box>
    </s-page>
  )
}
