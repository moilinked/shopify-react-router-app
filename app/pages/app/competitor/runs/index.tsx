import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { competitorApi } from '~/services/competitor'
import { useLoading } from '~/hooks/useLoading'
import type { CompetitorRun } from '~/types/competitor'
import { RUN_STATUS_MAP, RUN_STATUS_TONE } from '~/types/competitor'

const LIMIT = 20

function fmtTime(iso: string | null | undefined) {
  if (!iso) return '-'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

export default function RunsPage() {
  const navigate = useNavigate()
  const { loading, run } = useLoading()
  const [runs, setRuns] = useState<CompetitorRun[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)

  const loadRuns = useCallback(() => {
    run(async () => {
      const res = await competitorApi.getRuns({ page, limit: LIMIT })
      setRuns(res.data)
      setTotal(res.total)
    })
  }, [run, page])

  useEffect(() => {
    loadRuns()
  }, [loadRuns])

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  const handleManualRun = async () => {
    await run(async () => {
      await competitorApi.triggerManualRun({ scope: 'ALL' })
      shopify.toast.show('手动运行已触发')
      loadRuns()
    })
  }

  return (
    <s-page heading="运行历史">
      <s-button slot="primary-action" variant="primary" onClick={handleManualRun} disabled={loading || undefined}>
        手动运行
      </s-button>
      <s-button slot="secondary-actions" variant="secondary" onClick={() => navigate('/app/competitor')}>
        返回概览
      </s-button>

      <s-box padding="large">
        <s-table
          paginate={totalPages > 1 || undefined}
          hasPreviousPage={page > 1 || undefined}
          hasNextPage={page < totalPages || undefined}
          loading={loading || undefined}
          onPreviousPage={() => setPage((p) => Math.max(1, p - 1))}
          onNextPage={() => setPage((p) => p + 1)}
        >
          <s-table-header-row>
            <s-table-header>状态</s-table-header>
            <s-table-header>触发方式</s-table-header>
            <s-table-header>范围</s-table-header>
            <s-table-header>页面数</s-table-header>
            <s-table-header>成功</s-table-header>
            <s-table-header>失败</s-table-header>
            <s-table-header>开始时间</s-table-header>
            <s-table-header>完成时间</s-table-header>
            <s-table-header>操作</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {runs.map((r) => (
              <s-table-row key={r.id}>
                <s-table-cell>
                  <s-badge tone={RUN_STATUS_TONE[r.status]}>{RUN_STATUS_MAP[r.status]}</s-badge>
                </s-table-cell>
                <s-table-cell>{r.triggerType}</s-table-cell>
                <s-table-cell>{r.scope}</s-table-cell>
                <s-table-cell>{r.pageCount}</s-table-cell>
                <s-table-cell>{r.successCount}</s-table-cell>
                <s-table-cell>{r.failedCount}</s-table-cell>
                <s-table-cell>{fmtTime(r.startedAt)}</s-table-cell>
                <s-table-cell>{fmtTime(r.completedAt)}</s-table-cell>
                <s-table-cell>
                  <s-button variant="tertiary" onClick={() => navigate(`/app/competitor/runs/${r.id}`)}>
                    详情
                  </s-button>
                </s-table-cell>
              </s-table-row>
            ))}
            {runs.length === 0 && !loading && (
              <s-table-row>
                <s-table-cell>
                  <s-text tone="neutral">暂无运行记录</s-text>
                </s-table-cell>
              </s-table-row>
            )}
          </s-table-body>
        </s-table>
      </s-box>
    </s-page>
  )
}
