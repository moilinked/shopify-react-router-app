import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { competitorApi } from '~/services/competitor'
import { useLoading } from '~/hooks/useLoading'
import {
  PageChangeCompareModal,
  formatCompactValue,
  formatStructuredValue,
  isEmptyDisplayValue,
  normalizeChangeLogGroup
} from '~/components/competitor/PageChangeCompareModal'
import type {
  CompetitorChangeLogGroup,
  CompetitorOverview,
  OverviewPageEntry,
  OverviewPageField
} from '~/types/competitor'
import { RUN_STATUS_MAP, RUN_STATUS_TONE, SEVERITY_TONE } from '~/types/competitor'

const FIELD_PRIORITY: Record<string, 'P0' | 'P1'> = {
  hero_main_title: 'P0',
  hero_sub_title: 'P1',
  hero_cta_text: 'P1',
  hero_cta_link: 'P1',
  hero_product_name: 'P0',
  hero_promo_text: 'P0',
  announcement_bar: 'P1',
  trust_badges: 'P1',
  homepage_coupon_text: 'P0',
  homepage_bundle_entry: 'P1',
  homepage_subscription_entry: 'P1',
  product_name: 'P0',
  product_model: 'P0',
  product_category: 'P0',
  current_price: 'P0',
  compare_at_price: 'P0',
  discount_amount: 'P1',
  discount_rate: 'P0',
  coupon_available: 'P0',
  coupon_text: 'P0',
  stock_status: 'P0',
  estimated_delivery: 'P1',
  shipping_benefit: 'P1',
  warranty_text: 'P0',
  return_text: 'P0',
  main_cta_text: 'P1',
  key_selling_points: 'P0',
  certification_claims: 'P1',
  review_score: 'P1',
  review_count: 'P1',
  subscription_discount: 'P1',
  subscription_benefits: 'P1'
}

interface CompetitorInfoRow {
  entry: OverviewPageEntry
  p0Fields: OverviewPageField[]
}

function fmtTime(iso: string | null | undefined) {
  if (!iso) return '-'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

export default function CompetitorOverviewPage() {
  const navigate = useNavigate()
  const { loading, run } = useLoading()
  const { loading: compareLoading, run: runCompare } = useLoading()
  const compareModalRef = useRef<any>(null)
  const [overview, setOverview] = useState<CompetitorOverview | null>(null)
  const [entries, setEntries] = useState<OverviewPageEntry[]>([])
  const [changeGroups, setChangeGroups] = useState<CompetitorChangeLogGroup[]>([])
  const [selectedRow, setSelectedRow] = useState<CompetitorInfoRow | null>(null)
  const [fetchedGroup, setFetchedGroup] = useState<CompetitorChangeLogGroup | null>(null)
  const [onlyChanged, setOnlyChanged] = useState(false)
  const [brandFilter, setBrandFilter] = useState('')
  const [exporting, setExporting] = useState(false)

  const loadData = useCallback(() => {
    run(async () => {
      const [ov, pagesData] = await Promise.all([competitorApi.getOverview(), competitorApi.getOverviewPages()])
      setOverview(ov)
      setEntries(pagesData.pages)

      if (!pagesData.runId) {
        setChangeGroups([])
        return
      }
      const changeRes = await competitorApi.getChangeLogs({ page: 1, limit: 100, runId: pagesData.runId })
      setChangeGroups(changeRes.data.map(normalizeChangeLogGroup))
    })
  }, [run])

  useEffect(() => {
    loadData()
  }, [loadData])

  const rows = useMemo(
    () =>
      entries.map((entry) => ({
        entry,
        p0Fields: entry.fields.filter((field) => FIELD_PRIORITY[field.fieldKey] === 'P0')
      })),
    [entries]
  )

  const brandOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const entry of entries) {
      if (entry.brand) map.set(entry.brand.id, entry.brand.name)
    }
    return Array.from(map.entries())
  }, [entries])

  const visibleRows = useMemo(
    () =>
      rows.filter(
        (row) => (!onlyChanged || row.entry.changeCount > 0) && (!brandFilter || row.entry.brand?.id === brandFilter)
      ),
    [rows, onlyChanged, brandFilter]
  )

  const selectedChangeGroup = selectedRow
    ? (changeGroups.find((group) => group.pageId === selectedRow.entry.page.id) ?? null)
    : null
  // 只用真实对比:变化日志 group(有旧值)优先,其次按页拉取的真实对比(含旧值);不再用空壳假展示
  const selectedCompareGroup = selectedRow ? (selectedChangeGroup ?? fetchedGroup) : null

  const handleManualRun = async () => {
    await run(async () => {
      await competitorApi.triggerManualRun({ scope: 'ALL' })
      shopify.toast.show('手动运行已触发')
      loadData()
    })
  }

  const handleExport = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const blob = await competitorApi.exportWeekly()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `竞品周报_${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      /* requestBlob 内已 toast */
    } finally {
      setExporting(false)
    }
  }

  const openCompare = (row: CompetitorInfoRow) => {
    setSelectedRow(row)
    setFetchedGroup(null)
    compareModalRef.current?.showOverlay?.()
    // 该页若没有变化日志 group(0 变化),按页拉取真实对比以拿到旧值(带 loading,避免假展示)
    const hasChangeGroup = changeGroups.some((group) => group.pageId === row.entry.page.id)
    if (!hasChangeGroup) {
      runCompare(async () => {
        const group = await competitorApi.getPageComparison(row.entry.page.id)
        if (group) setFetchedGroup(normalizeChangeLogGroup(group))
      })
    }
  }

  return (
    <s-page heading="竞品监控">
      <s-button slot="primary-action" variant="primary" onClick={handleManualRun} disabled={loading || undefined}>
        手动运行
      </s-button>
      <s-button slot="secondary-actions" variant="secondary" onClick={handleExport} disabled={exporting || undefined}>
        {exporting ? '导出中…' : '导出周报表格'}
      </s-button>

      <s-box padding="large">
        <s-stack direction="block" gap="large-200">
          <s-section heading="运营概览">
            <s-stack direction="inline" gap="large-100">
              <MetricCard label="监控页面" value={overview?.pageCount ?? 0} tone="info" />
              <MetricCard label="有变化页面" value={overview?.changedPageCount ?? 0} tone="warning" />
              <MetricCard label="高优先级变化" value={overview?.highSeverityChanges ?? 0} tone="critical" />
              <MetricCard label="失败页面" value={overview?.failedPages ?? 0} tone="warning" />
            </s-stack>
          </s-section>

          <s-section heading="本次监控">
            {overview?.latestRun ? (
              <s-box padding="base" borderWidth="base" borderRadius="base">
                <s-stack direction="block" gap="base">
                  <s-stack direction="inline" gap="base" alignItems="center">
                    <s-badge tone={RUN_STATUS_TONE[overview.latestRun.status]}>
                      {RUN_STATUS_MAP[overview.latestRun.status]}
                    </s-badge>
                    <s-text>
                      成功 {overview.latestRun.successCount}，失败 {overview.latestRun.failedCount}，发现{' '}
                      {overview.changedPageCount} 个页面有变化
                    </s-text>
                    <s-text tone="neutral">
                      {fmtTime(overview.latestRun.completedAt ?? overview.latestRun.startedAt)}
                    </s-text>
                  </s-stack>
                  <s-stack direction="inline" gap="base">
                    <s-button variant="tertiary" onClick={() => navigate('/app/competitor/change-logs')}>
                      查看变化洞察
                    </s-button>
                    <s-button
                      variant="tertiary"
                      onClick={() => navigate(`/app/competitor/runs/${overview.latestRun!.id}`)}
                    >
                      查看运行详情
                    </s-button>
                  </s-stack>
                </s-stack>
              </s-box>
            ) : (
              <s-text tone="neutral">暂无运行记录</s-text>
            )}
          </s-section>

          <s-section heading="竞品信息">
            <s-stack direction="block" gap="base">
              <s-stack direction="inline" gap="base" alignItems="end">
                {/* s-option 空 value 会回退用文本当值,「全部」用显式哨兵 ALL */}
                <s-select
                  label="品牌"
                  value={brandFilter || 'ALL'}
                  onChange={(e: Event) => {
                    const value = (e.target as HTMLSelectElement).value
                    setBrandFilter(value === 'ALL' ? '' : value)
                  }}
                >
                  <s-option value="ALL">全部品牌</s-option>
                  {brandOptions.map(([id, name]) => (
                    <s-option key={id} value={id}>
                      {name}
                    </s-option>
                  ))}
                </s-select>
                <s-checkbox
                  label="仅看有变化"
                  checked={onlyChanged || undefined}
                  onChange={(e: Event) => setOnlyChanged((e.target as HTMLInputElement).checked)}
                />
              </s-stack>
              <s-table>
                <s-table-header-row>
                  <s-table-header>品牌</s-table-header>
                  <s-table-header>页面</s-table-header>
                  <s-table-header>URL</s-table-header>
                  <s-table-header>P0 数据</s-table-header>
                  <s-table-header>操作</s-table-header>
                </s-table-header-row>
                <s-table-body>
                  {visibleRows.map((row) => (
                    <s-table-row key={row.entry.page.id}>
                      <s-table-cell>{row.entry.brand?.name ?? '-'}</s-table-cell>
                      <s-table-cell>
                        <s-stack direction="block" gap="small-100">
                          <s-text type="strong">{row.entry.page.pageName}</s-text>
                          <s-text tone="neutral">{row.entry.page.pageType}</s-text>
                          <ChangeTag entry={row.entry} />
                        </s-stack>
                      </s-table-cell>
                      <s-table-cell>
                        <div className="max-w-[320px] break-all text-sm">{row.entry.page.pageUrl}</div>
                      </s-table-cell>
                      <s-table-cell>
                        <P0FieldSummary fields={row.p0Fields} />
                      </s-table-cell>
                      <s-table-cell>
                        <s-button variant="tertiary" onClick={() => openCompare(row)}>
                          查看对比
                        </s-button>
                      </s-table-cell>
                    </s-table-row>
                  ))}
                  {visibleRows.length === 0 && (
                    <s-table-row>
                      <s-table-cell>
                        <s-text tone="neutral">{rows.length === 0 ? '暂无竞品页面' : '当前筛选下无页面'}</s-text>
                      </s-table-cell>
                    </s-table-row>
                  )}
                </s-table-body>
              </s-table>
            </s-stack>
          </s-section>
        </s-stack>
      </s-box>

      <PageChangeCompareModal
        modalRef={compareModalRef}
        group={selectedCompareGroup}
        loading={compareLoading}
        onClose={() => {
          setSelectedRow(null)
          setFetchedGroup(null)
        }}
        onReviewed={loadData}
      />
    </s-page>
  )
}

function ChangeTag({ entry }: { entry: OverviewPageEntry }) {
  if (entry.changeCount > 0) {
    return <s-badge tone={SEVERITY_TONE[entry.maxSeverity ?? 'LOW'] ?? 'warning'}>▲ {entry.changeCount} 处变化</s-badge>
  }
  if (entry.snapshotStatus === 'FAILED') {
    return <s-badge tone="critical">抓取失败</s-badge>
  }
  return <s-badge tone="neutral">无变化</s-badge>
}

function P0FieldSummary({ fields }: { fields: OverviewPageField[] }) {
  const display = (field: OverviewPageField) => formatStructuredValue(field.valueJson, field.valueText)
  const filledCount = fields.filter((field) => !isEmptyDisplayValue(display(field))).length
  return (
    <s-stack direction="block" gap="small-200">
      <s-text tone="neutral">
        P0 已识别 {filledCount} / {fields.length}
      </s-text>
      <div className="grid max-w-[560px] grid-cols-1 gap-2 md:grid-cols-2">
        {fields.slice(0, 8).map((field) => (
          <div
            key={field.fieldKey}
            className={`min-w-0 rounded border px-2 py-1 text-sm ${
              field.changed ? 'border-[#e0701e] bg-[#fff4e5]' : 'border-[#d9d9d9]'
            }`}
          >
            <span className="mr-1 text-[#6d7175]">{field.label}：</span>
            <span className="break-words">{formatCompactValue(display(field), 64)}</span>
            {field.changed && (
              <span
                className="ml-1 text-xs font-medium text-[#e0701e]"
                title={`本轮有变化 | 旧值: ${field.previousValueText ?? '(空)'}`}
              >
                ▲
              </span>
            )}
            {field.source === 'STRUCTURED' && (
              <span className="ml-1 text-xs text-[#108043]" title="来自结构化数据(确定性来源)">
                🔗
              </span>
            )}
          </div>
        ))}
      </div>
      {fields.length > 8 && <s-text tone="neutral">还有 {fields.length - 8} 个 P0 字段，点击查看对比</s-text>}
    </s-stack>
  )
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <s-box padding="base" borderWidth="base" borderRadius="base" inlineSize="160px">
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
