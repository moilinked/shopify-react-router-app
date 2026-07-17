import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { competitorApi } from '~/services/competitor'
import { useLoading } from '~/hooks/useLoading'
import {
  buildSummary,
  fieldLabel,
  formatCompactValue,
  formatStructuredValue,
  getChangedCategories,
  getChanges,
  normalizeChangeLogGroup,
  PageChangeCompareModal
} from '~/components/competitor/PageChangeCompareModal'
import type { CompetitorChangeLogGroup, CompetitorPageAnalysis, ReviewStatus } from '~/types/competitor'
import { REVIEW_ENABLED, REVIEW_STATUS_MAP, REVIEW_STATUS_TONE, SEVERITY_MAP, SEVERITY_TONE } from '~/types/competitor'
import { useAppStore } from '~/stores/useAppStore'

const LIMIT = 20

function fmtTime(iso: string | null | undefined) {
  if (!iso) return '-'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

/** 该时区下指定日期的起/止边界对应的 UTC 时刻(日期筛选按店铺时区,而非浏览器/UTC) */
function zonedDayBoundaryUtcIso(dateStr: string, timeZone: string, endOfDay: boolean): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const utcGuess = Date.UTC(y, m - 1, d, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0)
  return new Date(utcGuess - timeZoneOffsetMs(new Date(utcGuess), timeZone)).toISOString()
}

function timeZoneOffsetMs(date: Date, timeZone: string): number {
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })
        .formatToParts(date)
        .map((p) => [p.type, p.value])
    )
    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour) % 24,
      Number(parts.minute),
      Number(parts.second)
    )
    return asUtc - date.getTime()
  } catch {
    return 0
  }
}

export default function ChangeLogsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { loading, run } = useLoading()
  const ianaTimezone = useAppStore((s) => s.ianaTimezone)
  const [logs, setLogs] = useState<CompetitorChangeLogGroup[]>([])
  const [total, setTotal] = useState(0)
  const [serverStats, setServerStats] = useState<Record<string, number> | null>(null)
  const [analysesMap, setAnalysesMap] = useState<Record<string, CompetitorPageAnalysis>>({})
  const [page, setPage] = useState(1)

  const [filterSeverity, setFilterSeverity] = useState(searchParams.get('severity') ?? '')
  const [filterStartDate, setFilterStartDate] = useState(searchParams.get('startDate') ?? '')
  const [filterEndDate, setFilterEndDate] = useState(searchParams.get('endDate') ?? '')
  const initialRunId = searchParams.get('runId') ?? ''

  const detailModalRef = useRef<any>(null)
  const [selectedGroup, setSelectedGroup] = useState<CompetitorChangeLogGroup | null>(null)

  const loadLogs = useCallback(() => {
    run(async () => {
      const params: Record<string, unknown> = { page, limit: LIMIT }
      if (initialRunId) params.runId = initialRunId
      if (filterSeverity) params.severity = filterSeverity
      if (filterStartDate) params.startDate = zonedDayBoundaryUtcIso(filterStartDate, ianaTimezone, false)
      if (filterEndDate) params.endDate = zonedDayBoundaryUtcIso(filterEndDate, ianaTimezone, true)
      const res = await competitorApi.getChangeLogs(params as any)
      const groups = res.data.map(normalizeChangeLogGroup)
      setLogs(groups)
      setTotal(res.total)
      setServerStats(res.stats ?? null)

      // AI 解读摘要:按涉及的 run 拉取页面分析(通常只有一个 run),卡片摘要优先用 AI 概览
      const runIds = Array.from(new Set(groups.map((g) => g.runId).filter(Boolean)))
      const analysesLists = await Promise.all(
        runIds.map((id) => competitorApi.getRunAnalyses(id).catch(() => [] as CompetitorPageAnalysis[]))
      )
      const map: Record<string, CompetitorPageAnalysis> = {}
      for (const list of analysesLists) {
        for (const a of list) map[`${a.runId}:${a.pageId}`] = a
      }
      setAnalysesMap(map)
    })
  }, [run, page, filterSeverity, filterStartDate, filterEndDate, initialRunId, ianaTimezone])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  // 运营摘要:优先用后端分页前的全量汇总,旧后端无 stats 时回退按当前页计算
  const stats = useMemo(() => {
    if (serverStats) {
      return {
        pageCount: serverStats.groupCount ?? 0,
        changeCount: serverStats.changeCount ?? 0,
        highCount: serverStats.highGroupCount ?? 0
      }
    }
    const changeCount = logs.reduce((sum, group) => sum + getChanges(group).length, 0)
    const highCount = logs.filter((group) => group.severity === 'HIGH').length
    return { pageCount: logs.length, changeCount, highCount }
  }, [serverStats, logs])

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  const openDetail = (group: CompetitorChangeLogGroup) => {
    setSelectedGroup(group)
    detailModalRef.current?.showOverlay?.()
  }

  // 组级复核:对该组全部变化日志统一标记后刷新列表
  const reviewGroup = async (group: CompetitorChangeLogGroup, status: ReviewStatus) => {
    try {
      await Promise.all(getChanges(group).map((c) => competitorApi.reviewChangeLog(c.id, { reviewStatus: status })))
      if (typeof shopify !== 'undefined') shopify.toast.show(`已标记为「${REVIEW_STATUS_MAP[status]}」`)
      loadLogs()
    } catch {
      /* request 内已 toast */
    }
  }

  return (
    <s-page heading="变化洞察">
      <s-button slot="secondary-actions" variant="secondary" onClick={() => navigate('/app/competitor')}>
        返回概览
      </s-button>

      <s-box padding="large">
        <s-stack direction="block" gap="large-200">
          <s-section heading="运营摘要">
            <s-stack direction="inline" gap="large-100">
              <InsightMetric label="变化页面" value={stats.pageCount} tone="warning" />
              <InsightMetric label="字段变化" value={stats.changeCount} tone="info" />
              <InsightMetric label="高优先级页面" value={stats.highCount} tone="critical" />
            </s-stack>
          </s-section>

          <s-section heading="筛选">
            <s-stack direction="inline" gap="base" alignItems="end">
              {/* s-option 空 value 会回退用文本当值,「全部」用显式哨兵 ALL */}
              <s-select
                label="严重级别"
                value={filterSeverity || 'ALL'}
                onChange={(e: Event) => {
                  const value = (e.target as HTMLSelectElement).value
                  setFilterSeverity(value === 'ALL' ? '' : value)
                  setPage(1)
                }}
              >
                <s-option value="ALL">全部</s-option>
                <s-option value="HIGH">高</s-option>
                <s-option value="MEDIUM">中</s-option>
                <s-option value="LOW">低</s-option>
              </s-select>
              <div className="min-w-[180px]">
                <s-date-field
                  label="开始日期"
                  value={filterStartDate}
                  onChange={(e: Event) => {
                    const nextStart = (e.target as HTMLInputElement).value
                    setFilterStartDate(nextStart)
                    if (filterEndDate && nextStart && nextStart > filterEndDate) {
                      setFilterEndDate('')
                    }
                    setPage(1)
                  }}
                />
              </div>
              <div className="min-w-[180px]">
                <s-date-field
                  label="结束日期"
                  value={filterEndDate}
                  onChange={(e: Event) => {
                    const nextEnd = (e.target as HTMLInputElement).value
                    setFilterEndDate(nextEnd)
                    if (filterStartDate && nextEnd && nextEnd < filterStartDate) {
                      setFilterStartDate('')
                    }
                    setPage(1)
                  }}
                />
              </div>
              <s-button
                variant="tertiary"
                onClick={() => {
                  setFilterSeverity('')
                  setFilterStartDate('')
                  setFilterEndDate('')
                  setPage(1)
                }}
              >
                重置
              </s-button>
            </s-stack>
          </s-section>

          <s-section heading="页面变化">
            <s-stack direction="block" gap="base">
              {logs.map((group) => (
                <ChangeInsightCard
                  key={group.id}
                  group={group}
                  analysis={analysesMap[`${group.runId}:${group.pageId}`] ?? null}
                  onOpen={() => openDetail(group)}
                  onReview={(status) => reviewGroup(group, status)}
                />
              ))}
              {logs.length === 0 && !loading && (
                <s-box padding="large" borderWidth="base" borderRadius="base">
                  <s-text tone="neutral">暂无变化页面</s-text>
                </s-box>
              )}
              {loading && <s-text tone="neutral">加载中…</s-text>}
              {totalPages > 1 && (
                <s-stack direction="inline" gap="base" alignItems="center">
                  <s-button
                    variant="secondary"
                    disabled={page <= 1 || undefined}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    上一页
                  </s-button>
                  <s-text tone="neutral">
                    第 {page} / {totalPages} 页
                  </s-text>
                  <s-button
                    variant="secondary"
                    disabled={page >= totalPages || undefined}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    下一页
                  </s-button>
                </s-stack>
              )}
            </s-stack>
          </s-section>
        </s-stack>
      </s-box>

      <PageChangeCompareModal
        modalRef={detailModalRef}
        group={selectedGroup}
        onClose={() => setSelectedGroup(null)}
        onReviewed={loadLogs}
      />
    </s-page>
  )
}

function ChangeInsightCard({
  group,
  analysis,
  onOpen,
  onReview
}: {
  group: CompetitorChangeLogGroup
  analysis: CompetitorPageAnalysis | null
  onOpen: () => void
  onReview: (status: ReviewStatus) => void
}) {
  const changes = getChanges(group)
  const keyChanges = getKeyChanges(group)
  // 摘要优先用 AI 解读的页面概览,无分析时回退模板句
  const aiSummary = analysis?.status === 'COMPLETED' ? analysis.overviewJson?.summary : undefined

  return (
    <s-box padding="base" borderWidth="base" borderRadius="base">
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
          <s-stack direction="block" gap="small-100">
            <s-text type="strong">
              {group.brand?.name ?? '-'} / {group.page?.pageName ?? '-'}
            </s-text>
            <s-text tone="neutral">{group.page?.pageUrl ?? '-'}</s-text>
          </s-stack>
          <s-stack direction="inline" gap="small-200" alignItems="center">
            <s-badge tone={SEVERITY_TONE[group.severity]}>{SEVERITY_MAP[group.severity]}</s-badge>
            {REVIEW_ENABLED && (
              <s-badge tone={REVIEW_STATUS_TONE[group.reviewStatus]}>{REVIEW_STATUS_MAP[group.reviewStatus]}</s-badge>
            )}
            <s-button variant="tertiary" onClick={onOpen}>
              查看对比
            </s-button>
          </s-stack>
        </s-stack>

        <s-stack direction="block" gap="small-200">
          <s-text>{aiSummary || buildSummary(group)}</s-text>
          {keyChanges.length > 0 && (
            <div className="grid gap-2 md:grid-cols-3">
              {keyChanges.map((change) => (
                <div key={change.id} className="rounded-md border border-[#d9d9d9] p-3">
                  <div className="text-xs text-[#6d7175]">{fieldLabel(change.fieldKey)}</div>
                  <div className="mt-1 text-sm font-medium text-[#202223]">
                    {formatCompactValue(formatStructuredValue(change.currentValueJson, change.currentValueText), 80)}
                  </div>
                </div>
              ))}
            </div>
          )}
          <s-stack direction="inline" gap="small-200" alignItems="center">
            <s-badge tone="info">{changes.length} 个字段变化</s-badge>
            {getChangedCategories(group).map((category) => (
              <s-badge key={category} tone="neutral">
                {category}
              </s-badge>
            ))}
            <s-text tone="neutral">{fmtTime(group.createdAt)}</s-text>
            {REVIEW_ENABLED && (
              <>
                <s-button variant="tertiary" onClick={() => onReview('REVIEWED')}>
                  标记已复核
                </s-button>
                <s-button variant="tertiary" onClick={() => onReview('FOLLOW_UP')}>
                  跟进
                </s-button>
                <s-button variant="tertiary" onClick={() => onReview('IGNORED')}>
                  忽略
                </s-button>
              </>
            )}
          </s-stack>
        </s-stack>
      </s-stack>
    </s-box>
  )
}

function InsightMetric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <s-box padding="base" borderWidth="base" borderRadius="base" inlineSize="180px">
      <s-stack direction="block" gap="small-100">
        <s-text tone="neutral">{label}</s-text>
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-text type="strong">{value.toLocaleString()}</s-text>
          <s-badge tone={tone as any}>{label}</s-badge>
        </s-stack>
      </s-stack>
    </s-box>
  )
}

function getKeyChanges(group: CompetitorChangeLogGroup) {
  const keyFields = [
    'current_price',
    'compare_at_price',
    'discount_rate',
    'coupon_available',
    'coupon_text',
    'stock_status',
    'main_cta_text'
  ]
  return getChanges(group)
    .filter((change) => keyFields.includes(change.fieldKey))
    .slice(0, 3)
}
