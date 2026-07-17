import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { altTextApi } from '~/services/altText'
import type { JobProgressDTO, JobStatus } from '~/types/altText'
import { JOB_STATUSES } from '~/types/altText'
import { useLoading } from '~/hooks/useLoading'
import { RetryErrorBanner } from '~/components/RetryErrorBanner'
import { EmptyState } from '~/components/EmptyState'

const STATUS_TONE: Record<JobStatus, 'info' | 'success' | 'warning' | 'critical'> = {
  PENDING: 'info',
  RUNNING: 'info',
  REVIEWING: 'warning',
  SUCCEEDED: 'success',
  PARTIAL: 'warning',
  FAILED: 'critical',
  CANCELLED: 'warning'
}

const STATUS_LABEL: Record<JobStatus, string> = {
  PENDING: '排队中',
  RUNNING: '生成中',
  REVIEWING: '待审核',
  SUCCEEDED: '已完成',
  PARTIAL: '部分成功',
  FAILED: '失败',
  CANCELLED: '已取消'
}

const displayStatus = (job: JobProgressDTO) => {
  if (job.pendingReview > 0) {
    return { label: '待审核', tone: 'warning' as const }
  }
  return {
    label: STATUS_LABEL[job.status as JobStatus] ?? job.status,
    tone: STATUS_TONE[job.status as JobStatus] ?? 'info'
  }
}

const fmt = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

export default function AltTextHistory() {
  const navigate = useNavigate()
  const { loading, error, run } = useLoading()

  const [jobs, setJobs] = useState<JobProgressDTO[]>([])
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all')
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [hasMore, setHasMore] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchFirst = useCallback(async () => {
    const res = await run(() =>
      altTextApi.loadJobs({
        status: statusFilter !== 'all' ? [statusFilter] : undefined,
        limit: 20
      })
    )
    if (res) {
      setJobs(res.jobs)
      setCursor(res.pageInfo.nextCursor ?? undefined)
      setHasMore(res.pageInfo.hasMore)
    }
  }, [run, statusFilter])

  const fetchMore = useCallback(async () => {
    if (!cursor) return
    const res = await run(() =>
      altTextApi.loadJobs({
        status: statusFilter !== 'all' ? [statusFilter] : undefined,
        cursor,
        limit: 20
      })
    )
    if (res) {
      setJobs((prev) => [...prev, ...res.jobs])
      setCursor(res.pageInfo.nextCursor ?? undefined)
      setHasMore(res.pageInfo.hasMore)
    }
  }, [run, statusFilter, cursor])

  useEffect(() => {
    fetchFirst()
  }, [fetchFirst])

  const handleDelete = useCallback(async (job: JobProgressDTO) => {
    const ok = window.confirm(`确认删除任务 ${job.id.slice(0, 12)}…？相关的历史条目也会一并删除，此操作不可恢复。`)
    if (!ok) return

    setDeletingId(job.id)
    try {
      const res = await altTextApi.deleteJob(job.id)
      setJobs((prev) => prev.filter((j) => j.id !== job.id))
      shopify.toast.show(`已删除任务，清理 ${res.deletedItems} 条相关记录`)
    } catch (e) {
      shopify.toast.show(`删除失败：${(e as Error).message}`, { isError: true })
    } finally {
      setDeletingId(null)
    }
  }, [])

  return (
    <s-page heading="生成历史">
      <s-button slot="primary-action" variant="secondary" onClick={() => navigate('/app/alt-text')}>
        返回入口
      </s-button>
      <s-box padding="large">
        <s-stack direction="block" gap="large-100">
          <s-stack direction="inline" gap="base">
            <s-select
              label="状态"
              value={statusFilter}
              onChange={(e: Event) => setStatusFilter((e.target as HTMLSelectElement).value as JobStatus | 'all')}
            >
              <s-option value="all">全部状态</s-option>
              {JOB_STATUSES.map((s) => (
                <s-option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </s-option>
              ))}
            </s-select>
            <s-button onClick={fetchFirst} disabled={loading || undefined}>
              {loading ? '加载中…' : '刷新'}
            </s-button>
          </s-stack>

          {error && <RetryErrorBanner error={error} heading="加载历史失败" onRetry={fetchFirst} />}

          {!error && jobs.length === 0 && !loading && <EmptyState message="暂无历史任务。先去入口页提交一次生成吧。" />}

          {jobs.length > 0 && (
            <s-section accessibilityLabel="History jobs">
              <s-table>
                <s-table-header-row>
                  <s-table-header listSlot="primary">任务</s-table-header>
                  <s-table-header>类型 / 来源</s-table-header>
                  <s-table-header>语言</s-table-header>
                  <s-table-header format="numeric">总数</s-table-header>
                  <s-table-header format="numeric">已处理</s-table-header>
                  <s-table-header format="numeric">待审核</s-table-header>
                  <s-table-header format="numeric">失败</s-table-header>
                  <s-table-header listSlot="secondary">状态</s-table-header>
                  <s-table-header>创建时间</s-table-header>
                  <s-table-header>操作</s-table-header>
                </s-table-header-row>
                <s-table-body>
                  {jobs.map((j) => (
                    <s-table-row key={j.id}>
                      <s-table-cell>
                        <s-clickable href={`/app/alt-text/review/${j.id}`} accessibilityLabel={`查看 ${j.id}`}>
                          <s-text type="strong">{j.id.slice(0, 12)}…</s-text>
                        </s-clickable>
                      </s-table-cell>
                      <s-table-cell>
                        <s-stack direction="block" gap="small-100">
                          <s-text>{j.type}</s-text>
                          <s-text tone="neutral">{j.source}</s-text>
                        </s-stack>
                      </s-table-cell>
                      <s-table-cell>{j.language}</s-table-cell>
                      <s-table-cell>{j.total}</s-table-cell>
                      <s-table-cell>{j.processed}</s-table-cell>
                      <s-table-cell>{j.pendingReview}</s-table-cell>
                      <s-table-cell>{j.failed}</s-table-cell>
                      <s-table-cell>
                        <s-badge tone={displayStatus(j).tone}>{displayStatus(j).label}</s-badge>
                      </s-table-cell>
                      <s-table-cell>{fmt(j.createdAt)}</s-table-cell>
                      <s-table-cell>
                        <s-stack direction="inline" gap="small-200">
                          <s-button variant="tertiary" onClick={() => navigate(`/app/alt-text/review/${j.id}`)}>
                            审核
                          </s-button>
                          <s-button
                            variant="tertiary"
                            tone="critical"
                            disabled={deletingId === j.id || undefined}
                            onClick={() => handleDelete(j)}
                          >
                            {deletingId === j.id ? '删除中…' : '删除'}
                          </s-button>
                        </s-stack>
                      </s-table-cell>
                    </s-table-row>
                  ))}
                </s-table-body>
              </s-table>
              {hasMore && (
                <s-stack direction="inline" gap="base">
                  <s-button variant="tertiary" onClick={fetchMore} disabled={loading || undefined}>
                    {loading ? '加载中…' : '加载更多'}
                  </s-button>
                </s-stack>
              )}
            </s-section>
          )}
        </s-stack>
      </s-box>
    </s-page>
  )
}
