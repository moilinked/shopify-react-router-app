import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { competitorApi } from '~/services/competitor'
import { useLoading } from '~/hooks/useLoading'
import type { CompetitorPageSnapshot, CompetitorRun } from '~/types/competitor'
import { RUN_STATUS_MAP, RUN_STATUS_TONE } from '~/types/competitor'

function fmtTime(iso: string | null | undefined) {
  if (!iso) return '-'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

const SNAPSHOT_STATUS_TONE: Record<string, string> = {
  PENDING: 'info',
  FETCHING: 'info',
  ANALYZING: 'info',
  SUCCEEDED: 'success',
  FAILED: 'critical',
  TIMEOUT: 'warning'
}

const SNAPSHOT_STATUS_MAP: Record<string, string> = {
  PENDING: '等待中',
  FETCHING: '抓取中',
  ANALYZING: 'AI 分析中',
  SUCCEEDED: '已完成',
  FAILED: '失败',
  TIMEOUT: '超时'
}

export default function RunDetailPage() {
  const { runId } = useParams()
  const navigate = useNavigate()
  const { loading, run: runLoad } = useLoading()
  const { loading: retrying, run: runRetry } = useLoading()
  const [detail, setDetail] = useState<(CompetitorRun & { snapshots: CompetitorPageSnapshot[] }) | null>(null)
  const previewModalRef = useRef<any>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewTitle, setPreviewTitle] = useState('')
  const [zoom, setZoom] = useState(1)

  const loadDetail = useCallback(() => {
    if (!runId) return
    runLoad(async () => {
      const res = await competitorApi.getRunDetail(runId)
      setDetail(res)
    })
  }, [runLoad, runId])

  useEffect(() => {
    loadDetail()
  }, [loadDetail])

  useEffect(() => {
    if (!detail || !['PENDING', 'RUNNING'].includes(detail.status)) return
    const timer = window.setInterval(loadDetail, 5000)
    return () => window.clearInterval(timer)
  }, [detail, loadDetail])

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    },
    [previewUrl]
  )

  const openScreenshotPreview = async (snapshot: CompetitorPageSnapshot) => {
    const blob = await competitorApi.getSnapshotImage(snapshot.id)
    const objectUrl = URL.createObjectURL(blob)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(objectUrl)
    setPreviewTitle(snapshot.pageUrl)
    setZoom(1)
    previewModalRef.current?.showOverlay?.()
  }

  const closeScreenshotPreview = () => {
    previewModalRef.current?.hideOverlay?.()
  }

  const retrySnapshot = (snapshot: CompetitorPageSnapshot, mode: 'ANALYZE' | 'REFETCH') => {
    if (!detail) return

    runRetry(async () => {
      await competitorApi.retryPageInRun(detail.id, snapshot.pageId, mode)
      shopify.toast.show(mode === 'REFETCH' ? '已重新抓取该页面' : '已重试 AI 分析')
      loadDetail()
    })
  }

  if (loading && !detail) {
    return (
      <div className="rounded-lg border border-[#d9d9d9] bg-white p-6 shadow-sm">
        <s-text>加载中…</s-text>
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="rounded-lg border border-[#d9d9d9] bg-white p-6 shadow-sm">
        <s-text>未找到运行记录</s-text>
      </div>
    )
  }

  const snapshots = detail.snapshots ?? []

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#202223]">运行详情</h1>
          <p className="mt-1 text-sm text-[#6d7175]">查看页面抓取、AI 分析结果和失败重试</p>
        </div>
        <s-button variant="secondary" onClick={() => navigate('/app/competitor/runs')}>
          返回列表
        </s-button>
      </header>

      <section className="rounded-lg border border-[#d9d9d9] bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[#202223]">运行信息</h2>
          <s-badge tone={RUN_STATUS_TONE[detail.status]}>{RUN_STATUS_MAP[detail.status]}</s-badge>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <InfoItem label="触发方式">{detail.triggerType}</InfoItem>
          <InfoItem label="范围">{detail.scope}</InfoItem>
          <InfoItem label="页面数">{detail.pageCount}</InfoItem>
          <InfoItem label="结果">
            成功 {detail.successCount} / 失败 {detail.failedCount}
          </InfoItem>
          <InfoItem label="开始时间">{fmtTime(detail.startedAt)}</InfoItem>
          <InfoItem label="完成时间">{fmtTime(detail.completedAt)}</InfoItem>
          <InfoItem label="运行 ID">{detail.id}</InfoItem>
        </div>
        {detail.pageCount > 0 &&
          (() => {
            const done = detail.successCount + detail.failedCount
            const pct = Math.min(100, Math.round((done / detail.pageCount) * 100))
            const running = ['PENDING', 'RUNNING'].includes(detail.status)
            return (
              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-xs text-[#6d7175]">
                  <span>
                    进度 {done} / {detail.pageCount}
                    {running ? '(运行中,自动刷新)' : ''}
                  </span>
                  <span>{pct}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded bg-[#e4e5e7]">
                  <div
                    className={`h-full ${detail.failedCount > 0 ? 'bg-[#d4a72c]' : 'bg-[#2c6ecb]'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })()}
        {detail.errorMessage && (
          <div className="mt-4">
            <s-banner tone="critical">{detail.errorMessage}</s-banner>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-[#d9d9d9] bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[#202223]">页面快照（{snapshots.length}）</h2>
          <s-button variant="tertiary" onClick={loadDetail} disabled={loading || undefined}>
            刷新
          </s-button>
        </div>

        <s-table>
          <s-table-header-row>
            <s-table-header>页面 URL</s-table-header>
            <s-table-header>状态</s-table-header>
            <s-table-header>截图</s-table-header>
            <s-table-header>开始时间</s-table-header>
            <s-table-header>完成时间</s-table-header>
            <s-table-header>错误</s-table-header>
            <s-table-header>操作</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {snapshots.map((snapshot) => (
              <s-table-row key={snapshot.id}>
                <s-table-cell>
                  <s-text>{snapshot.pageUrl}</s-text>
                </s-table-cell>
                <s-table-cell>
                  <s-badge tone={(SNAPSHOT_STATUS_TONE[snapshot.fetchStatus] ?? 'info') as any}>
                    {SNAPSHOT_STATUS_MAP[snapshot.fetchStatus] ?? snapshot.fetchStatus}
                  </s-badge>
                </s-table-cell>
                <s-table-cell>
                  {snapshot.screenshotPath ? (
                    <s-button variant="tertiary" onClick={() => openScreenshotPreview(snapshot)}>
                      预览
                    </s-button>
                  ) : (
                    '-'
                  )}
                </s-table-cell>
                <s-table-cell>{fmtTime(snapshot.startedAt)}</s-table-cell>
                <s-table-cell>{fmtTime(snapshot.completedAt)}</s-table-cell>
                <s-table-cell>
                  {snapshot.errorMessage ? <s-text tone="critical">{snapshot.errorMessage}</s-text> : '-'}
                </s-table-cell>
                <s-table-cell>
                  {snapshot.fetchStatus === 'FAILED' ? (
                    <s-stack direction="inline" gap="small">
                      {snapshot.hasFetchResult ? (
                        <s-button
                          variant="tertiary"
                          onClick={() => retrySnapshot(snapshot, 'ANALYZE')}
                          disabled={retrying || undefined}
                        >
                          重试分析
                        </s-button>
                      ) : null}
                      <s-button
                        variant="tertiary"
                        onClick={() => retrySnapshot(snapshot, 'REFETCH')}
                        disabled={retrying || undefined}
                      >
                        重新抓取
                      </s-button>
                    </s-stack>
                  ) : (
                    '-'
                  )}
                </s-table-cell>
              </s-table-row>
            ))}
            {snapshots.length === 0 && (
              <s-table-row>
                <s-table-cell>
                  <s-text tone="neutral">暂无快照</s-text>
                </s-table-cell>
              </s-table-row>
            )}
          </s-table-body>
        </s-table>
        {snapshots.length === 0 && ['PENDING', 'RUNNING'].includes(detail.status) && detail.pageCount > 0 && (
          <div className="mt-4">
            <s-banner tone="warning">
              已创建运行并匹配到 {detail.pageCount} 个页面，但还没有生成页面快照。通常是分析队列尚未消费、Redis/Worker
              未启动，或数据库迁移未应用导致 job 在创建快照前失败。
            </s-banner>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-[#d9d9d9] bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-[#202223]">关联数据</h2>
        <s-stack direction="inline" gap="base">
          <s-button onClick={() => navigate(`/app/competitor/change-logs?runId=${detail.id}`)}>查看变化日志</s-button>
          <s-button onClick={() => navigate(`/app/competitor/reports?runId=${detail.id}`)}>查看周报</s-button>
        </s-stack>
      </section>

      <s-modal ref={previewModalRef} id="snapshot-preview-modal" heading="页面截图预览" size="large">
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" gap="base" alignItems="center">
            <s-text tone="neutral">{previewTitle}</s-text>
            <s-button variant="tertiary" onClick={() => setZoom((value) => Math.max(0.25, value - 0.25))}>
              缩小
            </s-button>
            <s-text>{Math.round(zoom * 100)}%</s-text>
            <s-button variant="tertiary" onClick={() => setZoom((value) => Math.min(3, value + 0.25))}>
              放大
            </s-button>
          </s-stack>
          <div style={{ maxHeight: '70vh', overflow: 'auto', border: '1px solid #d9d9d9', borderRadius: 8 }}>
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="页面截图"
                style={{ display: 'block', width: `${zoom * 100}%`, maxWidth: 'none' }}
              />
            ) : (
              <s-text tone="neutral">暂无截图</s-text>
            )}
          </div>
        </s-stack>
        <s-button slot="primary-action" variant="primary" onClick={closeScreenshotPreview}>
          关闭
        </s-button>
      </s-modal>
    </div>
  )
}

function InfoItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-[#6d7175]">{label}</div>
      <div className="mt-1 truncate text-sm font-medium text-[#202223]">{children}</div>
    </div>
  )
}
