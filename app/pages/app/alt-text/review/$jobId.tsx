import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { altTextApi, type ItemDTO } from '~/services/altText'
import type { ItemStatus, JobProgressDTO } from '~/types/altText'
import { EmptyState } from '~/components/EmptyState'
import { RetryErrorBanner } from '~/components/RetryErrorBanner'

const POLL_INTERVAL_MS = 5000
const PAGE_SIZE = 100
const NON_GENERATING_JOB_STATUSES = new Set(['REVIEWING', 'SUCCEEDED', 'FAILED', 'PARTIAL', 'CANCELLED'])

const statusTone = (s: string): 'info' | 'success' | 'warning' | 'critical' => {
  switch (s) {
    case 'PENDING':
      return 'info'
    case 'GENERATING':
      return 'info'
    case 'REVIEWING':
      return 'warning'
    case 'PARTIAL':
      return 'warning'
    case 'SUCCEEDED':
      return 'success'
    case 'READY_FOR_REVIEW':
      return 'warning'
    case 'EDITED':
      return 'warning'
    case 'APPLIED':
      return 'success'
    case 'REJECTED':
      return 'critical'
    case 'FAILED':
      return 'critical'
    case 'CANCELLED':
      return 'warning'
    default:
      return 'info'
  }
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: '排队中',
  GENERATING: '生成中',
  REVIEWING: '审核中',
  SUCCEEDED: '已完成',
  PARTIAL: '部分成功',
  CANCELLED: '已取消',
  READY_FOR_REVIEW: '待审核',
  EDITED: '已编辑',
  APPLIED: '已应用',
  REJECTED: '已拒绝',
  FAILED: '失败'
}

const APPLYABLE = new Set(['READY_FOR_REVIEW', 'EDITED'])

// 状态过滤下拉项；'all' 表示不做服务端过滤
const STATUS_FILTER_OPTIONS: { value: 'all' | ItemStatus; label: string }[] = [
  { value: 'all', label: '全部状态' },
  { value: 'READY_FOR_REVIEW', label: '待审核' },
  { value: 'EDITED', label: '已编辑' },
  { value: 'APPLIED', label: '已应用' },
  { value: 'REJECTED', label: '已拒绝' },
  { value: 'FAILED', label: '失败' },
  { value: 'GENERATING', label: '生成中' },
  { value: 'PENDING', label: '排队中' }
]

const newNonce = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

export default function ReviewJobPage() {
  const navigate = useNavigate()
  const { jobId } = useParams<{ jobId: string }>()

  const [job, setJob] = useState<JobProgressDTO | null>(null)
  const [items, setItems] = useState<ItemDTO[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingPage, setLoadingPage] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | ItemStatus>('all')

  const [loadError, setLoadError] = useState<Error | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [busy, setBusy] = useState(false)

  const confirmModalRef = useRef<any>(null)
  const editModalRef = useRef<any>(null)

  // ── 拉取 ─────────────────────────────
  // 拉取 job 进度（轮询专用，不动 items）
  const refreshJob = useCallback(async () => {
    if (!jobId) return
    try {
      const res = await altTextApi.pollJob(jobId)
      setJob(res.job)
      setLoadError(null)
    } catch (e) {
      setLoadError(e as Error)
    }
  }, [jobId])

  /**
   * 拉取 items：
   *   - reset=true：重置 items，并用 statusFilter 重新从头分页
   *   - reset=false：用当前 nextCursor 继续往后翻
   */
  const fetchItems = useCallback(
    async (reset: boolean) => {
      if (!jobId) return
      setLoadingPage(true)
      try {
        const cursor = reset ? undefined : (nextCursor ?? undefined)
        const res = await altTextApi.loadJobItems(jobId, {
          limit: PAGE_SIZE,
          cursor,
          status: statusFilter === 'all' ? undefined : [statusFilter]
        })
        setItems((prev) => (reset ? res.items : [...prev, ...res.items]))
        setNextCursor(res.pageInfo.nextCursor)
        setHasMore(res.pageInfo.hasMore)
        setLoadError(null)
      } catch (e) {
        setLoadError(e as Error)
      } finally {
        setLoadingPage(false)
      }
    },
    [jobId, nextCursor, statusFilter]
  )

  // 初始化 + 状态过滤变化 → 同步重置 items 并拉首页
  useEffect(() => {
    if (!jobId) return
    setItems([])
    setNextCursor(null)
    setHasMore(false)
    setSelected(new Set())
    refreshJob()
    // statusFilter 变化时调用，使用最新值；这里独立 effect 保证 fetchItems 用到的是新 filter
    void fetchItems(true)
    // 故意不把 fetchItems 放进依赖：只在 jobId / statusFilter 变化时重置
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, statusFilter])

  // 轮询：未到终态时每 5s 只拉 job 进度，items 由用户手动刷新或加载更多
  useEffect(() => {
    if (!job || NON_GENERATING_JOB_STATUSES.has(job.status)) return
    const t = setInterval(refreshJob, POLL_INTERVAL_MS)
    return () => clearInterval(t)
  }, [job, refreshJob])

  // ── 派生数据 ─────────────────────────
  // 注意：counters 仅基于"已加载条目"，与 job 全量计数（job.total/processed/failed）不一定一致
  const counters = useMemo(() => {
    const c: Record<string, number> = {}
    for (const it of items) c[it.status] = (c[it.status] ?? 0) + 1
    return c
  }, [items])

  const applyableIds = useMemo(() => items.filter((i) => APPLYABLE.has(i.status)).map((i) => i.id), [items])

  const selectedApplyable = useMemo(
    () => Array.from(selected).filter((id) => items.find((i) => i.id === id && APPLYABLE.has(i.status))),
    [selected, items]
  )

  // ── 本地 patch（避免每次操作都重拉全部分页） ─────────
  const patchItem = (id: string, patch: Partial<ItemDTO>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }

  const patchManyByMap = (map: Map<string, Partial<ItemDTO>>) => {
    setItems((prev) => prev.map((it) => (map.has(it.id) ? { ...it, ...(map.get(it.id) as Partial<ItemDTO>) } : it)))
  }

  // ── 操作 ─────────────────────────────
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllApplyable = () => setSelected(new Set(applyableIds))
  const clearSelection = () => setSelected(new Set())

  const beginEdit = (it: ItemDTO) => {
    setEditingId(it.id)
    setEditingValue(it.editedAlt ?? it.generatedAlt ?? it.appliedAlt ?? '')
    editModalRef.current?.showOverlay?.()
  }

  const submitEdit = async () => {
    if (!editingId) return
    const v = editingValue.trim()
    if (!v) {
      shopify.toast.show('ALT 不能为空', { isError: true })
      return
    }
    setBusy(true)
    try {
      await altTextApi.editItem(editingId, v)
      shopify.toast.show('已保存编辑')
      editModalRef.current?.hideOverlay?.()
      patchItem(editingId, { editedAlt: v, status: 'EDITED', errorMessage: null })
      setEditingId(null)
    } catch (e) {
      shopify.toast.show(`保存失败：${(e as Error).message}`, { isError: true })
    } finally {
      setBusy(false)
    }
  }

  const handleReject = async (id: string) => {
    setBusy(true)
    try {
      await altTextApi.rejectItem(id)
      shopify.toast.show('已拒绝')
      patchItem(id, { status: 'REJECTED' })
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    } catch (e) {
      shopify.toast.show(`操作失败：${(e as Error).message}`, { isError: true })
    } finally {
      setBusy(false)
    }
  }

  const handleRetry = async (id: string) => {
    setBusy(true)
    try {
      await altTextApi.retryItem(id)
      shopify.toast.show('已重新派发')
      patchItem(id, { status: 'GENERATING', errorMessage: null })
      // retry 会改 Job 计数 → 立即刷新一次进度
      void refreshJob()
    } catch (e) {
      shopify.toast.show(`重试失败：${(e as Error).message}`, { isError: true })
    } finally {
      setBusy(false)
    }
  }

  const handleRetryAllFailed = async () => {
    if (!jobId) return
    if (!job) return
    if (job.failed === 0) {
      shopify.toast.show('当前任务没有失败条目')
      return
    }
    if (!window.confirm(`确认对该任务的全部 ${job.failed} 条失败条目发起重试？`)) return
    setBusy(true)
    try {
      const res = await altTextApi.retryFailedJob(jobId)
      const msg =
        res.retried > 0
          ? `已重新派发 ${res.retried} 条${res.failedToDispatch > 0 ? `，其中 ${res.failedToDispatch} 条派发失败` : ''}`
          : res.message || '没有可重试的失败条目'
      shopify.toast.show(msg, { isError: res.failedToDispatch > 0 })
      // 局部把当前已加载的 FAILED 条目即时改为 GENERATING（后端已批量改库 + 撤回计数）
      const map = new Map<string, Partial<ItemDTO>>()
      for (const it of items) {
        if (it.status === 'FAILED') {
          map.set(it.id, { status: 'GENERATING', errorMessage: null })
        }
      }
      if (map.size > 0) patchManyByMap(map)
      // 计数已变 → 立即刷新一次 Job 进度
      void refreshJob()
    } catch (e) {
      shopify.toast.show(`批量重试失败：${(e as Error).message}`, { isError: true })
    } finally {
      setBusy(false)
    }
  }

  const openApplyConfirm = () => {
    if (selectedApplyable.length === 0) {
      shopify.toast.show('未选中可应用的条目', { isError: true })
      return
    }
    confirmModalRef.current?.showOverlay?.()
  }

  const handleApplyConfirm = async () => {
    setBusy(true)
    const nonce = newNonce()
    try {
      const res = await altTextApi.apply(selectedApplyable, nonce)
      const msg = `应用完成：成功 ${res.success} / 失败 ${res.failed} / 跳过 ${res.skipped}`
      shopify.toast.show(msg, { isError: res.failed > 0 })
      confirmModalRef.current?.hideOverlay?.()

      // 局部 patch：根据 results 把每条状态/错误映射回去
      const map = new Map<string, Partial<ItemDTO>>()
      for (const r of res.results) {
        const it = items.find((x) => x.id === r.itemId)
        if (!it) continue
        if (r.ok) {
          map.set(r.itemId, {
            status: 'APPLIED',
            appliedAlt: it.editedAlt ?? it.generatedAlt ?? it.appliedAlt,
            appliedAt: new Date().toISOString(),
            errorMessage: null
          })
        } else {
          map.set(r.itemId, { status: 'FAILED', errorMessage: r.error ?? 'apply failed' })
        }
      }
      patchManyByMap(map)
      clearSelection()
      void refreshJob()
    } catch (e) {
      shopify.toast.show(`应用失败：${(e as Error).message}`, { isError: true })
    } finally {
      setBusy(false)
    }
  }

  // ── 渲染 ─────────────────────────────
  const progress = job ? Math.round((job.processed / Math.max(1, job.total)) * 100) : 0
  const isNonGenerating = job ? NON_GENERATING_JOB_STATUSES.has(job.status) : false

  return (
    <s-page heading="生成结果审核">
      <s-button
        slot="primary-action"
        variant="primary"
        disabled={selectedApplyable.length === 0 || busy || undefined}
        onClick={openApplyConfirm}
      >
        审核应用（{selectedApplyable.length}）
      </s-button>
      <s-button slot="secondary-actions" variant="secondary" onClick={() => navigate('/app/alt-text')}>
        返回入口
      </s-button>

      <s-box padding="large">
        <s-stack direction="block" gap="large-100">
          {loadError && <RetryErrorBanner error={loadError} heading="加载任务失败" onRetry={() => fetchItems(true)} />}

          {job && (
            <s-section heading={`任务 ${job.id.slice(0, 8)}…`}>
              <s-stack direction="block" gap="base">
                <s-stack direction="inline" gap="base">
                  <s-badge tone={isNonGenerating ? statusTone(job.status) : 'info'}>
                    {STATUS_LABEL[job.status] ?? job.status}
                  </s-badge>
                  <s-text tone="neutral">来源：{job.source}</s-text>
                  <s-text tone="neutral">语言：{job.language}</s-text>
                  <s-text tone="neutral">
                    进度：{job.processed} / {job.total}（{progress}%）
                  </s-text>
                  {job.failed > 0 && <s-badge tone="critical">失败 {job.failed}</s-badge>}
                  {job.pendingReview > 0 && <s-badge tone="warning">待审核 {job.pendingReview}</s-badge>}
                </s-stack>
                <s-box padding="small-100" borderWidth="base" borderRadius="base" inlineSize="100%">
                  <div
                    style={{
                      height: 6,
                      width: `${Math.min(100, Math.max(0, progress))}%`,
                      background: isNonGenerating ? '#1a7f37' : '#0a66c2',
                      borderRadius: 4,
                      transition: 'width 200ms'
                    }}
                  />
                </s-box>
                <s-stack direction="inline" gap="small-200">
                  {Object.entries(counters).map(([k, v]) => (
                    <s-badge key={k} tone={statusTone(k)}>
                      {STATUS_LABEL[k] ?? k}：{v}
                    </s-badge>
                  ))}
                  {(hasMore || statusFilter !== 'all') && (
                    <s-text tone="neutral">（仅统计已加载 {items.length} 条）</s-text>
                  )}
                </s-stack>
              </s-stack>
            </s-section>
          )}

          <s-section heading="审核条目">
            <s-stack direction="block" gap="base">
              <s-stack direction="inline" gap="base" alignItems="end">
                <s-select
                  label="筛选状态"
                  value={statusFilter}
                  onChange={(e: Event) => setStatusFilter((e.target as HTMLSelectElement).value as 'all' | ItemStatus)}
                >
                  {STATUS_FILTER_OPTIONS.map((o) => (
                    <s-option key={o.value} value={o.value}>
                      {o.label}
                    </s-option>
                  ))}
                </s-select>
                <s-button variant="tertiary" onClick={() => fetchItems(true)} disabled={loadingPage || undefined}>
                  {loadingPage && items.length === 0 ? '刷新中…' : '刷新'}
                </s-button>
                <s-button
                  variant="tertiary"
                  tone="critical"
                  disabled={!job || job.failed === 0 || busy || undefined}
                  onClick={handleRetryAllFailed}
                >
                  批量重试失败{job && job.failed > 0 ? `（${job.failed}）` : ''}
                </s-button>
                <s-text tone="neutral">已选 {selected.size} 条</s-text>
                <s-button variant="tertiary" onClick={selectAllApplyable}>
                  全选可应用
                </s-button>
                <s-button variant="tertiary" onClick={clearSelection}>
                  清空
                </s-button>
              </s-stack>

              {items.length === 0 && !loadingPage && !loadError && <EmptyState message="任务暂无条目。" />}

              {items.length > 0 && (
                <s-table>
                  <s-table-header-row>
                    <s-table-header>
                      <s-box inlineSize="40px">选</s-box>
                    </s-table-header>
                    <s-table-header>预览</s-table-header>
                    <s-table-header>归属</s-table-header>
                    <s-table-header listSlot="primary">ALT</s-table-header>
                    <s-table-header listSlot="secondary">状态</s-table-header>
                    <s-table-header>操作</s-table-header>
                  </s-table-header-row>
                  <s-table-body>
                    {items.map((it) => {
                      const display = it.editedAlt ?? it.generatedAlt ?? it.appliedAlt ?? '—'
                      const canApply = APPLYABLE.has(it.status)
                      return (
                        <s-table-row key={it.id}>
                          <s-table-cell>
                            <s-checkbox
                              checked={selected.has(it.id) || undefined}
                              disabled={!canApply || undefined}
                              onChange={() => toggleSelect(it.id)}
                            />
                          </s-table-cell>
                          <s-table-cell>
                            <s-thumbnail src={it.imageUrl} alt={display} size="base" />
                          </s-table-cell>
                          <s-table-cell>
                            <s-stack direction="block" gap="small-100">
                              <s-text>{it.parentTitle ?? 'Files 图片'}</s-text>
                              <s-text tone="neutral">{it.resourceType}</s-text>
                            </s-stack>
                          </s-table-cell>
                          <s-table-cell>
                            <s-stack direction="block" gap="small-100">
                              <s-text>{display}</s-text>
                              {it.errorMessage && <s-text tone="critical">{it.errorMessage}</s-text>}
                            </s-stack>
                          </s-table-cell>
                          <s-table-cell>
                            <s-badge tone={statusTone(it.status)}>{STATUS_LABEL[it.status] ?? it.status}</s-badge>
                          </s-table-cell>
                          <s-table-cell>
                            <s-stack direction="inline" gap="small-100">
                              {canApply || it.status === 'APPLIED' ? (
                                <s-button variant="tertiary" onClick={() => beginEdit(it)}>
                                  编辑
                                </s-button>
                              ) : null}
                              {canApply && (
                                <s-button variant="tertiary" tone="critical" onClick={() => handleReject(it.id)}>
                                  拒绝
                                </s-button>
                              )}
                              {it.status === 'FAILED' && (
                                <s-button variant="tertiary" onClick={() => handleRetry(it.id)}>
                                  重试
                                </s-button>
                              )}
                            </s-stack>
                          </s-table-cell>
                        </s-table-row>
                      )
                    })}
                  </s-table-body>
                </s-table>
              )}

              {hasMore && (
                <s-stack direction="inline" gap="base" alignItems="center">
                  <s-button variant="secondary" onClick={() => fetchItems(false)} disabled={loadingPage || undefined}>
                    {loadingPage ? '加载中…' : `加载更多（已显示 ${items.length}）`}
                  </s-button>
                  <s-text tone="neutral">每页 {PAGE_SIZE} 条</s-text>
                </s-stack>
              )}
            </s-stack>
          </s-section>
        </s-stack>
      </s-box>

      {/* 二次确认 modal */}
      <s-modal ref={confirmModalRef} id="alt-text-apply-confirm" heading="确认应用 ALT 到 Shopify">
        <s-stack direction="block" gap="base">
          <s-banner tone="warning">
            将把 <s-text type="strong">{selectedApplyable.length}</s-text> 条 ALT 写入 Shopify Files。
            此操作不可一键撤销，请确认。
          </s-banner>
          <s-text tone="neutral">仅状态为「待审核 / 已编辑」的条目会被写入；其它条目自动跳过。</s-text>
        </s-stack>
        <s-button slot="primary-action" variant="primary" onClick={handleApplyConfirm} disabled={busy || undefined}>
          {busy ? '应用中…' : '确认写入'}
        </s-button>
        <s-button
          slot="secondary-actions"
          variant="secondary"
          disabled={busy || undefined}
          onClick={() => confirmModalRef.current?.hideOverlay?.()}
        >
          取消
        </s-button>
      </s-modal>

      {/* 编辑 modal */}
      <s-modal ref={editModalRef} id="alt-text-edit-modal" heading="编辑 ALT 文本">
        <s-stack direction="block" gap="base">
          <s-text-area
            label="ALT 文本"
            rows={3}
            value={editingValue}
            onInput={(e: Event) => setEditingValue((e.target as HTMLInputElement).value)}
          />
          <s-text tone="neutral">保存后状态将变为「已编辑」，需再走一次「审核应用」才会写到 Shopify。</s-text>
        </s-stack>
        <s-button slot="primary-action" variant="primary" onClick={submitEdit} disabled={busy || undefined}>
          {busy ? '保存中…' : '保存'}
        </s-button>
        <s-button
          slot="secondary-actions"
          variant="secondary"
          disabled={busy || undefined}
          onClick={() => editModalRef.current?.hideOverlay?.()}
        >
          取消
        </s-button>
      </s-modal>
    </s-page>
  )
}
