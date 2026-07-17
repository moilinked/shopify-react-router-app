import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useCurrencySymbol } from '~/hooks/useCurrencySymbol'
import { useLoading } from '~/hooks/useLoading'
import { analyticsApi } from '~/services/analytics'
import { ReportTable, SectionCard, Tabs, UnmatchedBanner } from '~/components/analytics/widgets'
import { ACTIVE_TABLE_TYPES, TABLE_TYPE_MAP } from '~/types/analytics'
import type {
  AnalyticsTable,
  ChannelTrendResult,
  CollectionTrendResult,
  Granularity,
  PeriodOption,
  SkuTrendResult,
  TableType
} from '~/types/analytics'

const TABS = ACTIVE_TABLE_TYPES.map((key) => ({ key, label: TABLE_TYPE_MAP[key] }))
const SEARCHABLE: TableType[] = [
  'SALES_SKU',
  'SALES_COLLECTION',
  'CHANNEL_SITE',
  'CHANNEL_PRODUCT',
  'LANDING_PAGE_SITE'
]
const LANDING_PAGE_SIZE = 30

const TAB_SUBTITLE: Record<TableType, string> = {
  SALES_SITE: '最近 8 期趋势,一行一期 · 数据来源:Shopify',
  SALES_SKU: '业务SKU 口径(本期 + 环比)· Shopify 销售(含日均销量)· 下方附「周×SKU」销量/销额/转化率矩阵',
  SALES_COLLECTION:
    'Collection 口径(本期 + 环比)· 由销售-SKU 事实行按 Collection 汇总 · 下方附「周×Collection」销量/销额矩阵',
  CHANNEL_SITE: '原始 source / medium 口径(本期 + 环比)· 数据来源:GA4 · 下方附「周×渠道」转化率/流量/销额矩阵',
  CHANNEL_PRODUCT: '业务SKU × source / medium(本期 + 环比)· 数据来源:GA4',
  LANDING_PAGE_SITE: 'Landing page 口径(本期 + 环比)· 数据来源:GA4',
  CHANNEL_MARKETING: '原始 source / medium 口径(本期 + 环比)· 数据来源:Shopify Marketing(需 read_reports + 审批)'
}

export default function AnalyticsTables() {
  const symbol = useCurrencySymbol()
  const navigate = useNavigate()
  const { loading, run } = useLoading()
  const [granularity, setGranularity] = useState<Granularity>('WEEK')
  const [periods, setPeriods] = useState<PeriodOption[]>([])
  const [period, setPeriod] = useState('')
  const [tab, setTab] = useState<TableType>('SALES_SITE')
  const [keyword, setKeyword] = useState('')
  const [table, setTable] = useState<AnalyticsTable | null>(null)
  const [skuTrends, setSkuTrends] = useState<SkuTrendResult | null>(null)
  const [collectionTrends, setCollectionTrends] = useState<CollectionTrendResult | null>(null)
  const [channelTrends, setChannelTrends] = useState<ChannelTrendResult | null>(null)
  const [landingPage, setLandingPage] = useState(1)
  const [collecting, setCollecting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const landingSearch = tab === 'LANDING_PAGE_SITE' ? keyword.trim() : ''

  // 粒度变化 → 拉周期列表,默认选最新
  useEffect(() => {
    let alive = true
    analyticsApi
      .getPeriods(granularity)
      .then((list) => {
        if (!alive) return
        setPeriods(list)
        setPeriod(list[0]?.period ?? '')
      })
      .catch(() => {
        /* request 内已 toast */
      })
    return () => {
      alive = false
    }
  }, [granularity])

  // tab / 粒度 / 周期变化 → 组表。reqRef 防竞态:快速切 tab/周期时,只让「最后一次请求」写状态
  const reqRef = useRef(0)
  const loadTable = useCallback(() => {
    if (!period) {
      setTable(null)
      return
    }
    const myReq = ++reqRef.current
    run(async () => {
      const t = await analyticsApi.getTable(
        tab,
        granularity,
        period,
        undefined,
        tab === 'LANDING_PAGE_SITE'
          ? { page: landingPage, pageSize: LANDING_PAGE_SIZE, search: landingSearch || undefined }
          : undefined
      )
      if (myReq === reqRef.current) setTable(t)
    })
  }, [run, tab, granularity, period, landingPage, landingSearch])

  useEffect(() => {
    loadTable()
  }, [loadTable])

  // 销售-SKU tab:额外拉 3 张「周×SKU」矩阵表(销量/销额/转化率),渲染在单期表下方
  const trendReqRef = useRef(0)
  useEffect(() => {
    if (tab !== 'SALES_SKU' || !period) {
      setSkuTrends(null)
      return
    }
    const myReq = ++trendReqRef.current
    analyticsApi
      .getSkuTrends(granularity, period)
      .then((res) => {
        if (myReq === trendReqRef.current) setSkuTrends(res)
      })
      .catch(() => {
        /* request 内已 toast */
      })
  }, [tab, granularity, period])

  // 渠道-整站 tab:额外拉 3 张「周×渠道」矩阵表(转化率/流量/销额),渲染在单期表下方
  const channelTrendReqRef = useRef(0)
  useEffect(() => {
    if (tab !== 'CHANNEL_SITE' || !period) {
      setChannelTrends(null)
      return
    }
    const myReq = ++channelTrendReqRef.current
    analyticsApi
      .getChannelTrends(granularity, period)
      .then((res) => {
        if (myReq === channelTrendReqRef.current) setChannelTrends(res)
      })
      .catch(() => {
        /* request 内已 toast */
      })
  }, [tab, granularity, period])

  // 销售-Collections tab:额外拉 2 张「周×Collection」矩阵表(销量/销额),渲染在单期表下方
  const collectionTrendReqRef = useRef(0)
  useEffect(() => {
    if (tab !== 'SALES_COLLECTION' || !period) {
      setCollectionTrends(null)
      return
    }
    const myReq = ++collectionTrendReqRef.current
    analyticsApi
      .getCollectionTrends(granularity, period)
      .then((res) => {
        if (myReq === collectionTrendReqRef.current) setCollectionTrends(res)
      })
      .catch(() => {
        /* request 内已 toast */
      })
  }, [tab, granularity, period])

  const onCollect = async () => {
    if (!period || collecting) return
    setCollecting(true)
    try {
      await analyticsApi.collect(granularity, period)
      shopify.toast.show('已提交采集,稍后刷新查看')
    } catch {
      /* toasted */
    } finally {
      setCollecting(false)
    }
  }

  const onExport = async () => {
    if (!period || exporting) return
    setExporting(true)
    try {
      // 一次导出当期全部启用表 + 销售-SKU 3 张矩阵表(单文件多 sheet),不用逐 tab 切换
      await analyticsApi.exportPeriod(granularity, period)
    } catch {
      /* toasted */
    } finally {
      setExporting(false)
    }
  }

  const switchGranularity = (g: Granularity) => {
    setGranularity(g)
    setPeriod('')
    setLandingPage(1)
    setTable(null)
  }

  return (
    <s-page heading="报表">
      <s-button slot="primary-action" variant="primary" onClick={onExport} disabled={exporting || !period || undefined}>
        {exporting ? '导出中…' : '导出报表 Excel'}
      </s-button>
      <s-button
        slot="secondary-actions"
        variant="secondary"
        onClick={onCollect}
        disabled={collecting || !period || undefined}
      >
        {collecting ? '采集中…' : '补采本期数据'}
      </s-button>

      <s-box padding="large">
        <s-stack direction="block" gap="large-100">
          <s-stack direction="inline" gap="base" alignItems="end">
            <s-select
              label="粒度"
              value={granularity}
              onChange={(e: Event) => switchGranularity((e.target as HTMLSelectElement).value as Granularity)}
            >
              <s-option value="WEEK">周</s-option>
              <s-option value="MONTH">月</s-option>
            </s-select>
            <s-select
              label="周期"
              value={period}
              onChange={(e: Event) => {
                setPeriod((e.target as HTMLSelectElement).value)
                setLandingPage(1)
              }}
              disabled={periods.length === 0 || undefined}
            >
              {periods.map((p) => (
                <s-option key={p.period} value={p.period}>
                  {p.label}
                  {!p.hasData ? ' · 无数据' : ''}
                </s-option>
              ))}
            </s-select>
            {table && <s-text tone="neutral">数据截止 {table.dataThrough}(GA4 T+1~2)</s-text>}
          </s-stack>

          {periods.find((p) => p.period === period)?.hasData === false && !loading && (
            <s-banner tone="info" heading="本期暂无数据">
              <s-text>
                点右上角「补采本期数据」采集 Shopify 销售 + GA4 流量(约 1 分钟),完成后切换周期或刷新查看。
              </s-text>
            </s-banner>
          )}

          {table && (
            // 渠道未分组不在本期横幅展示(可选口径、不影响本期报表准确性);统一在口径管理看
            <UnmatchedBanner
              missingModel={table.unmatched.missingModel.length}
              ga4Unaligned={table.unmatched.ga4Unaligned.length}
              onGo={() => navigate('/app/analytics/maps')}
            />
          )}

          <s-section>
            <s-stack direction="block" gap="base">
              <Tabs
                tabs={TABS}
                active={tab}
                onChange={(k) => {
                  setTab(k as TableType)
                  setLandingPage(1)
                }}
              />
              <s-stack direction="inline" gap="base" alignItems="end">
                <s-text tone="neutral">{TAB_SUBTITLE[tab]}</s-text>
                {SEARCHABLE.includes(tab) && (
                  <s-text-field
                    label="搜索"
                    placeholder="业务SKU / Collection / 渠道 / 落地页"
                    value={keyword}
                    onInput={(e: Event) => {
                      setKeyword((e.target as HTMLInputElement).value)
                      setLandingPage(1)
                    }}
                  />
                )}
              </s-stack>
              {table ? (
                <>
                  <ReportTable
                    table={table}
                    symbol={symbol}
                    keyword={SEARCHABLE.includes(tab) && tab !== 'LANDING_PAGE_SITE' ? keyword : undefined}
                    pagination={
                      tab === 'LANDING_PAGE_SITE' && table.pagination
                        ? {
                            ...table.pagination,
                            loading,
                            onPrevious: () => setLandingPage((p) => Math.max(1, p - 1)),
                            onNext: () => setLandingPage((p) => p + 1)
                          }
                        : undefined
                    }
                    onUnmatchedClick={() => navigate('/app/analytics/maps')}
                  />
                  {tab === 'LANDING_PAGE_SITE' && table.pagination && (
                    <s-text tone="neutral">
                      第 {table.pagination.page} / {table.pagination.totalPages} 页 · 共 {table.pagination.total} 条 ·{' '}
                      {table.pagination.pageSize} 条/页
                    </s-text>
                  )}
                </>
              ) : (
                <s-text tone="neutral">{loading ? '加载中…' : '请选择已有数据的周期'}</s-text>
              )}
            </s-stack>
          </s-section>

          {/* 销售-SKU 下的「周×SKU」矩阵:行=最近 N 期,列=各业务SKU(按总销量降序),逐期环比 */}
          {tab === 'SALES_SKU' &&
            skuTrends?.tables.map((m) => (
              <SectionCard key={m.id} title={m.title} subtitle={m.subtitle}>
                {/* 矩阵列多(每 SKU 一列),横向滚动 */}
                <div className="overflow-x-auto">
                  <ReportTable table={m.table} symbol={symbol} columnKeyword={keyword} />
                </div>
              </SectionCard>
            ))}

          {/* 销售-Collections 下的「周×Collection」矩阵:行=最近 N 期(时间倒序),列=Collection,逐期环比 */}
          {tab === 'SALES_COLLECTION' &&
            collectionTrends?.tables.map((m) => (
              <SectionCard key={m.id} title={m.title} subtitle={m.subtitle}>
                {/* 矩阵列多(每 Collection 一列),横向滚动;搜索框可过滤 Collection 列 */}
                <div className="overflow-x-auto">
                  <ReportTable table={m.table} symbol={symbol} columnKeyword={keyword} />
                </div>
              </SectionCard>
            ))}

          {/* 渠道-整站下的「周×渠道」矩阵:行=最近 N 期(时间倒序),列=source/medium,逐期环比 */}
          {tab === 'CHANNEL_SITE' &&
            channelTrends?.tables.map((m) => (
              <SectionCard key={m.id} title={m.title} subtitle={m.subtitle}>
                {/* 矩阵列多(每个 source/medium 一列),横向滚动;搜索框可过滤渠道列 */}
                <div className="overflow-x-auto">
                  <ReportTable table={m.table} symbol={symbol} columnKeyword={keyword} />
                </div>
              </SectionCard>
            ))}
        </s-stack>
      </s-box>
    </s-page>
  )
}
