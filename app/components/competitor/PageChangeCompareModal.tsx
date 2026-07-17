import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts'
import { competitorApi } from '~/services/competitor'
import type { CompetitorChangeLog, CompetitorChangeLogGroup, CompetitorPageAnalysis } from '~/types/competitor'
import {
  CHANGE_TYPE_MAP,
  REVIEW_ENABLED,
  REVIEW_STATUS_MAP,
  REVIEW_STATUS_TONE,
  SEVERITY_MAP,
  SEVERITY_TONE
} from '~/types/competitor'
import { getCurrencySymbol } from '~/utils/currency'

export const FIELD_LABELS: Record<string, string> = {
  product_name: '产品名称',
  product_model: '产品型号',
  product_category: '商品分类',
  current_price: '当前价格',
  compare_at_price: '划线价',
  discount_amount: '折扣金额',
  discount_rate: '折扣比例',
  coupon_available: '是否有 coupon',
  coupon_text: 'coupon 文案',
  stock_status: '库存状态',
  estimated_delivery: '配送时效',
  shipping_benefit: '配送权益',
  warranty_text: '质保文案',
  return_text: '退货文案',
  main_cta_text: '主购买按钮文案',
  key_selling_points: '核心卖点',
  certification_claims: '认证背书',
  review_score: '评分',
  review_count: '评论数',
  trust_badges: '信任背书',
  hero_main_title: '首屏主标题',
  hero_sub_title: '首屏副标题',
  hero_cta_text: '首屏 CTA 文案',
  hero_cta_link: '首屏 CTA 链接',
  hero_product_name: '首推产品名称',
  hero_promo_text: '首页促销文案',
  announcement_bar: '顶部公告栏文案',
  homepage_coupon_text: '首页优惠码文案',
  homepage_bundle_entry: '是否有 bundle 入口',
  homepage_subscription_entry: '是否有订阅入口',
  campaign_mechanism: '活动机制',
  free_shipping_policy: '免邮政策',
  bundle_items: '套装组成',
  subscription_discount: '订阅折扣',
  subscription_benefits: '订阅权益',
  collection_name: '集合页名称',
  sku_count: 'SKU 数量',
  featured_sku_list: '主推商品列表',
  collection_filter_options: '筛选项',
  collection_promo_tag: '集合页促销标签',
  cart_free_shipping_threshold: '购物车免邮门槛',
  cart_coupon_entry: '购物车优惠码入口',
  cart_upsell_exist: '是否有购物车加购推荐',
  cart_upsell_products: '购物车推荐商品',
  cart_subscription_prompt: '购物车订阅引导',
  shipping_policy_text: '配送政策',
  return_policy_text: '退货政策',
  return_window_days: '退货窗口(天)',
  warranty_policy_text: '质保政策',
  warranty_period: '质保期限',
  refund_processing_text: '退款处理说明',
  contact_support_info: '客服联系方式'
}

export const PAGE_TYPE_FIELDS: Record<string, string[]> = {
  HOMEPAGE: [
    'hero_main_title',
    'hero_sub_title',
    'hero_cta_text',
    'hero_cta_link',
    'hero_product_name',
    'hero_promo_text',
    'announcement_bar',
    'trust_badges',
    'homepage_coupon_text',
    'homepage_bundle_entry',
    'homepage_subscription_entry'
  ],
  PDP: [
    'product_name',
    'product_model',
    'product_category',
    'current_price',
    'compare_at_price',
    'discount_amount',
    'discount_rate',
    'coupon_available',
    'coupon_text',
    'stock_status',
    'estimated_delivery',
    'shipping_benefit',
    'warranty_text',
    'return_text',
    'main_cta_text',
    'key_selling_points',
    'certification_claims',
    'review_score',
    'review_count'
  ],
  FILTER_PDP: [
    'product_name',
    'product_model',
    'product_category',
    'current_price',
    'compare_at_price',
    'discount_amount',
    'discount_rate',
    'coupon_available',
    'coupon_text',
    'stock_status',
    'estimated_delivery',
    'shipping_benefit',
    'warranty_text',
    'return_text',
    'main_cta_text',
    'key_selling_points',
    'certification_claims',
    'review_score',
    'review_count',
    'subscription_discount',
    'subscription_benefits'
  ]
}

export const FIELD_GROUPS = [
  {
    title: '价格与优惠',
    fields: [
      'current_price',
      'compare_at_price',
      'discount_amount',
      'discount_rate',
      'coupon_available',
      'coupon_text',
      'homepage_coupon_text',
      'hero_promo_text',
      'campaign_mechanism'
    ]
  },
  {
    title: '购买转化',
    fields: [
      'stock_status',
      'main_cta_text',
      'estimated_delivery',
      'shipping_benefit',
      'hero_cta_text',
      'hero_cta_link',
      'homepage_bundle_entry',
      'homepage_subscription_entry'
    ]
  },
  {
    title: '卖点与信任',
    fields: [
      'product_name',
      'product_model',
      'product_category',
      'key_selling_points',
      'trust_badges',
      'warranty_text',
      'return_text',
      'certification_claims',
      'review_score',
      'review_count',
      'hero_main_title',
      'hero_sub_title',
      'hero_product_name',
      'announcement_bar'
    ]
  }
]

function fmtTime(iso: string | null | undefined) {
  if (!iso) return '-'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

interface PageChangeCompareModalProps {
  modalRef: RefObject<any>
  group: CompetitorChangeLogGroup | null
  loading?: boolean
  onClose?: () => void
  /** 复核状态变更后通知父级刷新列表 */
  onReviewed?: () => void
}

export function PageChangeCompareModal({ modalRef, group, loading, onClose, onReviewed }: PageChangeCompareModalProps) {
  const screenshotModalRef = useRef<any>(null)
  const trendModalRef = useRef<any>(null)
  const [previousScreenshotUrl, setPreviousScreenshotUrl] = useState<string | null>(null)
  const [currentScreenshotUrl, setCurrentScreenshotUrl] = useState<string | null>(null)
  const [screenshotZoom, setScreenshotZoom] = useState(0.85)
  const previousScreenshotUrlRef = useRef<string | null>(null)
  const currentScreenshotUrlRef = useRef<string | null>(null)
  const [analysis, setAnalysis] = useState<CompetitorPageAnalysis | null>(null)
  const [analysisVersion, setAnalysisVersion] = useState(0)
  const analysisPollCountRef = useRef(0)

  // AI 运营解读:随 group 拉取;GENERATING 时 5s 轮询直到完成/失败
  useEffect(() => {
    if (!group) {
      setAnalysis(null)
      return
    }
    let cancelled = false
    competitorApi
      .getPageAnalysis(group.runId, group.pageId)
      .then((result) => {
        if (!cancelled) setAnalysis(result)
      })
      .catch(() => {
        if (!cancelled) setAnalysis(null)
      })
    return () => {
      cancelled = true
    }
  }, [group, analysisVersion])

  useEffect(() => {
    analysisPollCountRef.current = 0
  }, [group])

  useEffect(() => {
    if (analysis?.status !== 'GENERATING') return
    // 兜底:最多轮询 5 分钟(后端对超时 GENERATING 记录读取时也会自愈为 FAILED)
    if (analysisPollCountRef.current >= 60) return
    const timer = setTimeout(() => {
      analysisPollCountRef.current += 1
      setAnalysisVersion((v) => v + 1)
    }, 5000)
    return () => clearTimeout(timer)
  }, [analysis])

  const regenerateAnalysis = async () => {
    if (!group) return
    try {
      await competitorApi.generatePageAnalysis(group.runId, group.pageId)
      analysisPollCountRef.current = 0
      setAnalysis((prev) => (prev ? { ...prev, status: 'GENERATING' } : prev))
      setAnalysisVersion((v) => v + 1)
    } catch {
      /* request 内已 toast */
    }
  }

  const copyAnalysisMarkdown = async () => {
    if (!analysis?.fullMarkdown) return
    await navigator.clipboard.writeText(analysis.fullMarkdown)
    if (typeof shopify !== 'undefined') shopify.toast.show('已复制周报 Markdown')
  }

  // 组级复核:对该页该轮全部变化日志统一标记
  const reviewAll = async (status: 'REVIEWED' | 'FOLLOW_UP' | 'IGNORED') => {
    if (!group) return
    const changes = getChanges(group)
    if (changes.length === 0) return
    try {
      await Promise.all(changes.map((change) => competitorApi.reviewChangeLog(change.id, { reviewStatus: status })))
      if (typeof shopify !== 'undefined') shopify.toast.show(`已标记为「${REVIEW_STATUS_MAP[status]}」`)
      onReviewed?.()
    } catch {
      /* request 内已 toast */
    }
  }

  const clearScreenshotUrls = useCallback(() => {
    if (previousScreenshotUrlRef.current) URL.revokeObjectURL(previousScreenshotUrlRef.current)
    if (currentScreenshotUrlRef.current) URL.revokeObjectURL(currentScreenshotUrlRef.current)
    previousScreenshotUrlRef.current = null
    currentScreenshotUrlRef.current = null
    setPreviousScreenshotUrl(null)
    setCurrentScreenshotUrl(null)
  }, [])

  useEffect(() => {
    const el = modalRef.current
    if (!el) return
    const handler = () => {
      clearScreenshotUrls()
      onClose?.()
    }
    el.addEventListener('close', handler)
    el.addEventListener('hide', handler)
    return () => {
      el.removeEventListener('close', handler)
      el.removeEventListener('hide', handler)
    }
  }, [clearScreenshotUrls, modalRef, onClose])

  useEffect(() => {
    if (!group) return
    let cancelled = false
    clearScreenshotUrls()

    async function loadScreenshots() {
      const previousId = group?.snapshots?.previous?.screenshotPath ? group.snapshots.previous.id : undefined
      const currentId = group?.snapshots?.current?.screenshotPath ? group.snapshots.current.id : undefined

      const [previousBlob, currentBlob] = await Promise.all([
        previousId ? competitorApi.getSnapshotImage(previousId).catch(() => null) : Promise.resolve(null),
        currentId ? competitorApi.getSnapshotImage(currentId).catch(() => null) : Promise.resolve(null)
      ])

      if (cancelled) return
      if (previousBlob) {
        const url = URL.createObjectURL(previousBlob)
        previousScreenshotUrlRef.current = url
        setPreviousScreenshotUrl(url)
      }
      if (currentBlob) {
        const url = URL.createObjectURL(currentBlob)
        currentScreenshotUrlRef.current = url
        setCurrentScreenshotUrl(url)
      }
    }

    loadScreenshots()
    return () => {
      cancelled = true
    }
  }, [group, clearScreenshotUrls])

  const closeDetail = () => modalRef.current?.hideOverlay?.()

  return (
    <>
      <s-modal ref={modalRef} id="page-change-compare-modal" heading="页面变化对比" size="large">
        {loading && !group && (
          <s-box padding="large">
            <s-stack direction="inline" gap="base" alignItems="center">
              <s-spinner accessibilityLabel="加载对比中" />
              <s-text tone="neutral">加载对比数据中…</s-text>
            </s-stack>
          </s-box>
        )}
        {!loading && !group && (
          <s-box padding="large">
            <s-text tone="neutral">暂无对比数据(该页面还没有可用的运行结果)。</s-text>
          </s-box>
        )}
        {group && (
          <s-stack direction="block" gap="base">
            <s-box padding="base" borderWidth="base" borderRadius="base">
              <s-stack direction="block" gap="small-200">
                <s-text type="strong">
                  {group.brand?.name ?? '-'} / {group.page?.pageName ?? '-'}
                </s-text>
                <s-text tone="neutral">{group.page?.pageUrl ?? '-'}</s-text>
                <s-stack direction="inline" gap="base" alignItems="center">
                  {getChanges(group).length > 0 && (
                    <>
                      <s-badge tone={SEVERITY_TONE[group.severity]}>{SEVERITY_MAP[group.severity]}</s-badge>
                      {REVIEW_ENABLED && (
                        <>
                          <s-badge tone={REVIEW_STATUS_TONE[group.reviewStatus]}>
                            {REVIEW_STATUS_MAP[group.reviewStatus]}
                          </s-badge>
                          <s-button variant="tertiary" onClick={() => reviewAll('REVIEWED')}>
                            标记已复核
                          </s-button>
                          <s-button variant="tertiary" onClick={() => reviewAll('FOLLOW_UP')}>
                            跟进
                          </s-button>
                          <s-button variant="tertiary" onClick={() => reviewAll('IGNORED')}>
                            忽略
                          </s-button>
                        </>
                      )}
                    </>
                  )}
                  <s-text tone="neutral">{fmtTime(group.createdAt)}</s-text>
                </s-stack>
              </s-stack>
            </s-box>

            <s-banner tone="info">{buildSummary(group)}</s-banner>

            {getChanges(group).length > 0 && (
              <AnalysisSection analysis={analysis} onRegenerate={regenerateAnalysis} onCopy={copyAnalysisMarkdown} />
            )}

            <s-box padding="base" borderWidth="base" borderRadius="base">
              <s-stack direction="inline" gap="base" alignItems="center">
                <s-button
                  variant="secondary"
                  disabled={(!previousScreenshotUrl && !currentScreenshotUrl) || undefined}
                  onClick={() => {
                    setScreenshotZoom(0.85)
                    screenshotModalRef.current?.showOverlay?.()
                  }}
                >
                  查看截图对比
                </s-button>
                <s-button
                  variant="secondary"
                  disabled={!hasTrendData(group) || undefined}
                  onClick={() => trendModalRef.current?.showOverlay?.()}
                >
                  查看价格趋势
                </s-button>
              </s-stack>
            </s-box>

            <s-stack direction="block" gap="base">
              {FIELD_GROUPS.map((fieldGroup) => {
                const rows = getComparisonRows(group).filter((row) => fieldGroup.fields.includes(row.fieldKey))
                if (rows.length === 0) return null
                return (
                  <s-box key={fieldGroup.title} padding="base" borderWidth="base" borderRadius="base">
                    <s-stack direction="block" gap="base">
                      <s-text type="strong">{fieldGroup.title}</s-text>
                      <ChangeComparisonTable rows={rows} />
                    </s-stack>
                  </s-box>
                )
              })}
              {getOtherComparisonRows(group).length > 0 && (
                <s-box padding="base" borderWidth="base" borderRadius="base">
                  <s-stack direction="block" gap="base">
                    <s-text type="strong">其他字段</s-text>
                    <ChangeComparisonTable rows={getOtherComparisonRows(group)} />
                  </s-stack>
                </s-box>
              )}
            </s-stack>
          </s-stack>
        )}
        <s-button slot="primary-action" variant="primary" onClick={closeDetail}>
          关闭
        </s-button>
      </s-modal>

      <s-modal ref={screenshotModalRef} id="snapshot-comparison-modal" heading="截图对比" size="large">
        {group && (
          <SnapshotComparison
            previousUrl={previousScreenshotUrl}
            currentUrl={currentScreenshotUrl}
            previousTime={group.snapshots?.previous?.createdAt}
            currentTime={group.snapshots?.current?.createdAt}
            zoom={screenshotZoom}
            onZoomIn={() => setScreenshotZoom((zoom) => Math.min(2, Number((zoom + 0.15).toFixed(2))))}
            onZoomOut={() => setScreenshotZoom((zoom) => Math.max(0.35, Number((zoom - 0.15).toFixed(2))))}
            onResetZoom={() => setScreenshotZoom(0.85)}
          />
        )}
        <s-button slot="primary-action" variant="primary" onClick={() => screenshotModalRef.current?.hideOverlay?.()}>
          关闭
        </s-button>
      </s-modal>

      <s-modal ref={trendModalRef} id="price-trend-modal" heading="价格与优惠趋势" size="large">
        {group && <PriceTrendChart trends={group.trends ?? []} />}
        <s-button slot="primary-action" variant="primary" onClick={() => trendModalRef.current?.hideOverlay?.()}>
          关闭
        </s-button>
      </s-modal>
    </>
  )
}

const IMPACT_TONE: Record<string, string> = { HIGH: 'critical', MEDIUM: 'warning', LOW: 'neutral' }
const IMPACT_LABEL: Record<string, string> = { HIGH: '高影响', MEDIUM: '中影响', LOW: '低影响' }

/** AI 运营解读与建议(周度页面分析);未生成时保持安静不渲染 */
function AnalysisSection({
  analysis,
  onRegenerate,
  onCopy
}: {
  analysis: CompetitorPageAnalysis | null
  onRegenerate: () => void
  onCopy: () => void
}) {
  if (!analysis) return null

  if (analysis.status === 'GENERATING') {
    return <s-banner tone="info">AI 运营解读生成中,完成后自动刷新…</s-banner>
  }

  if (analysis.status === 'FAILED') {
    return (
      <s-banner tone="warning">
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-text>AI 运营解读生成失败</s-text>
          <s-button variant="tertiary" onClick={onRegenerate}>
            重新生成
          </s-button>
        </s-stack>
      </s-banner>
    )
  }

  const findings = Array.isArray(analysis.findingsJson) ? analysis.findingsJson : []
  const strategy = analysis.strategyJson

  return (
    <s-box padding="base" borderWidth="base" borderRadius="base">
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
          <s-text type="strong">运营解读与建议(AI)</s-text>
          <s-stack direction="inline" gap="small-200">
            {analysis.fullMarkdown && (
              <s-button variant="tertiary" onClick={onCopy}>
                复制周报 Markdown
              </s-button>
            )}
            <s-button variant="tertiary" onClick={onRegenerate}>
              重新生成
            </s-button>
          </s-stack>
        </s-stack>

        {analysis.overviewJson?.summary && <s-text tone="neutral">{analysis.overviewJson.summary}</s-text>}

        {findings.map((finding, index) => (
          <div key={`${finding.fieldKey}-${index}`} className="rounded-md border border-[#d9d9d9] p-3">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-sm font-medium text-[#202223]">{fieldLabel(finding.fieldKey)}</span>
              <s-badge tone={(IMPACT_TONE[finding.impactLevel ?? ''] ?? 'neutral') as any}>
                {IMPACT_LABEL[finding.impactLevel ?? ''] ?? finding.impactLevel ?? '-'}
              </s-badge>
            </div>
            {finding.interpretation && <div className="text-sm text-[#202223]">{finding.interpretation}</div>}
            {finding.suggestion && (
              <div className="mt-2 rounded bg-[#f1f8f5] px-2 py-1 text-sm text-[#108043]">
                建议:{finding.suggestion}
              </div>
            )}
          </div>
        ))}

        {strategy && (strategy.intent || (strategy.followUps?.length ?? 0) > 0) && (
          <div className="rounded-md border border-[#2c6ecb] bg-[#f2f7fe] p-3">
            <div className="mb-1 text-sm font-medium text-[#202223]">整体策略判断</div>
            {strategy.intent && <div className="text-sm text-[#202223]">{strategy.intent}</div>}
            {strategy.mainThreat && <div className="mt-1 text-sm text-[#202223]">主要威胁:{strategy.mainThreat}</div>}
            {(strategy.followUps?.length ?? 0) > 0 && (
              <ol className="m-0 mt-1 list-decimal space-y-1 pl-5 text-sm text-[#202223]">
                {strategy.followUps?.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ol>
            )}
          </div>
        )}
      </s-stack>
    </s-box>
  )
}

function SnapshotComparison({
  previousUrl,
  currentUrl,
  previousTime,
  currentTime,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom
}: {
  previousUrl: string | null
  currentUrl: string | null
  previousTime?: string | null
  currentTime?: string | null
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onResetZoom: () => void
}) {
  const [mode, setMode] = useState<'side' | 'slider'>('side')

  if (!previousUrl && !currentUrl) {
    return (
      <s-box padding="base" borderWidth="base" borderRadius="base">
        <s-text tone="neutral">暂无可对比截图</s-text>
      </s-box>
    )
  }

  const canSlide = Boolean(previousUrl && currentUrl)
  const effectiveMode = canSlide ? mode : 'side'

  return (
    <s-stack direction="block" gap="base">
      <s-stack direction="inline" gap="small-200" alignItems="center">
        <s-button variant="secondary" onClick={onZoomOut}>
          缩小
        </s-button>
        <s-text tone="neutral">{Math.round(zoom * 100)}%</s-text>
        <s-button variant="secondary" onClick={onZoomIn}>
          放大
        </s-button>
        <s-button variant="tertiary" onClick={onResetZoom}>
          重置
        </s-button>
        {canSlide && (
          <s-button variant="tertiary" onClick={() => setMode(effectiveMode === 'side' ? 'slider' : 'side')}>
            {effectiveMode === 'side' ? '滑块对比' : '并排对比'}
          </s-button>
        )}
      </s-stack>
      {effectiveMode === 'slider' ? (
        <SliderCompare previousUrl={previousUrl!} currentUrl={currentUrl!} zoom={zoom} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <ScreenshotPanel title="变化前" imageUrl={previousUrl} time={previousTime} zoom={zoom} />
          <ScreenshotPanel title="变化后" imageUrl={currentUrl} time={currentTime} zoom={zoom} />
        </div>
      )}
    </s-stack>
  )
}

/** before/after 滑块叠加对比 */
function SliderCompare({ previousUrl, currentUrl, zoom }: { previousUrl: string; currentUrl: string; zoom: number }) {
  const [pos, setPos] = useState(50)
  return (
    <s-stack direction="block" gap="small-200">
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number((e.target as HTMLInputElement).value))}
        className="w-full"
      />
      <div className="max-h-[480px] overflow-auto rounded-md border border-[#d9d9d9] bg-[#f6f6f7]">
        <div className="relative" style={{ width: `${zoom * 100}%` }}>
          {/* 旧图叠加在上层并裁剪到分割线左侧:左=变化前、右=变化后,与底部标签一致 */}
          <img src={currentUrl} alt="变化后" className="block w-full" style={{ maxWidth: 'none' }} />
          <img
            src={previousUrl}
            alt="变化前"
            className="absolute top-0 left-0 block w-full"
            style={{ maxWidth: 'none', clipPath: `inset(0 ${100 - pos}% 0 0)` }}
          />
          <div className="absolute top-0 bottom-0 w-0.5 bg-[#2c6ecb]" style={{ left: `${pos}%` }} />
        </div>
      </div>
      <s-stack direction="inline" gap="base">
        <s-text tone="neutral">左:变化前</s-text>
        <s-text tone="neutral">右:变化后</s-text>
      </s-stack>
    </s-stack>
  )
}

function ScreenshotPanel({
  title,
  imageUrl,
  time,
  zoom
}: {
  title: string
  imageUrl: string | null
  time?: string | null
  zoom: number
}) {
  return (
    <div className="rounded-md border border-[#d9d9d9] bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-sm font-medium text-[#202223]">{title}</div>
        <div className="text-xs text-[#6d7175]">{fmtTime(time)}</div>
      </div>
      <div className="max-h-[360px] overflow-auto rounded-md bg-[#f6f6f7]">
        {imageUrl ? (
          <img src={imageUrl} alt={title} className="block" style={{ width: `${zoom * 100}%`, maxWidth: 'none' }} />
        ) : (
          <div className="p-6 text-sm text-[#6d7175]">暂无截图</div>
        )}
      </div>
    </div>
  )
}

function PriceTrendChart({ trends }: { trends: NonNullable<CompetitorChangeLogGroup['trends']> }) {
  const pricePoints = trends
    .filter((trend) => trend.fieldKey === 'current_price')
    .map((trend) => ({ ...trend, value: parseNumericValue(trend.valueJson, trend.valueText) }))
    .filter((trend): trend is typeof trend & { value: number } => typeof trend.value === 'number')
  const priceCurrency = getPriceCurrency(pricePoints[pricePoints.length - 1]?.valueJson)
  const priceSymbol = priceCurrency ? getCurrencySymbol(priceCurrency) : ''
  const chartData = pricePoints.map((point) => ({
    time: fmtTime(point.createdAt),
    value: point.value
  }))

  const promoEvents = trends.filter((trend) =>
    [
      'compare_at_price',
      'discount_amount',
      'discount_rate',
      'coupon_text',
      'homepage_coupon_text',
      'hero_promo_text'
    ].includes(trend.fieldKey)
  )

  if (pricePoints.length === 0 && promoEvents.length === 0) return null

  return (
    <s-box padding="base" borderWidth="base" borderRadius="base">
      <s-stack direction="block" gap="base">
        <s-text type="strong">价格与优惠历史</s-text>
        {pricePoints.length > 0 ? (
          <div className="max-w-full overflow-x-auto">
            <LineChart width={720} height={260} data={chartData} margin={{ top: 12, right: 24, bottom: 24, left: 8 }}>
              <CartesianGrid stroke="#d9d9d9" strokeDasharray="3 3" />
              <XAxis dataKey="time" tick={{ fill: '#6d7175', fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#6d7175', fontSize: 11 }} width={64} domain={['auto', 'auto']} />
              <Tooltip formatter={(value) => [`${priceSymbol}${Number(value).toFixed(2)}`, '当前价格']} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#1f7a8c"
                strokeWidth={3}
                dot={{ r: 4, strokeWidth: 2 }}
                activeDot={{ r: 6 }}
                isAnimationActive={false}
              />
            </LineChart>
          </div>
        ) : (
          <s-text tone="neutral">暂无可绘制的价格数值</s-text>
        )}
        {promoEvents.length > 0 && (
          <div className="space-y-2">
            {promoEvents.slice(-6).map((event) => (
              <div key={`${event.fieldKey}-${event.createdAt}`} className="text-sm text-[#202223]">
                <span className="font-medium">{fieldLabel(event.fieldKey)}</span>
                <span className="text-[#6d7175]"> / {fmtTime(event.createdAt)}：</span>
                {formatValue(formatStructuredValue(event.valueJson, event.valueText), 120)}
              </div>
            ))}
          </div>
        )}
      </s-stack>
    </s-box>
  )
}

interface FieldComparisonRow {
  fieldKey: string
  change: CompetitorChangeLog | null
  previousValueJson: any
  previousValueText: string | null
  currentValueJson: any
  currentValueText: string | null
}

const PRICE_FIELD_KEYS = ['current_price', 'compare_at_price', 'discount_amount']

function getPriceCurrency(valueJson: any): string {
  const p = normalizePriceJson(valueJson)
  return p?.currency || ''
}

/** 价格涨跌徽标:▼ €5.00 (-17%) / ▲ ... */
function PriceDeltaBadge({ row }: { row: FieldComparisonRow }) {
  if (!PRICE_FIELD_KEYS.includes(row.fieldKey)) return null
  const prev = parseNumericValue(row.previousValueJson, row.previousValueText)
  const curr = parseNumericValue(row.currentValueJson, row.currentValueText)
  if (prev == null || curr == null || prev === curr) return null

  const diff = curr - prev
  const down = diff < 0
  const currency = getPriceCurrency(row.currentValueJson) || getPriceCurrency(row.previousValueJson)
  const symbol = currency ? getCurrencySymbol(currency) : ''
  const pct = prev !== 0 ? Math.round((diff / prev) * 100) : null
  const abs = Math.abs(diff).toFixed(2)

  return (
    <span className={`text-xs font-medium ${down ? 'text-[#108043]' : 'text-[#bf0711]'}`}>
      {down ? '▼' : '▲'} {symbol}
      {abs}
      {pct != null ? ` (${pct > 0 ? '+' : ''}${pct}%)` : ''}
    </span>
  )
}

/** 数组逐条 diff:相对另一侧标出新增(绿)/删除(红) */
function DiffList({
  items,
  otherItems,
  mode
}: {
  items: string[]
  otherItems: string[]
  mode: 'previous' | 'current'
}) {
  const others = new Set(otherItems)
  return (
    <ol className="m-0 list-decimal space-y-1 pl-5 text-sm text-[#202223]">
      {items.map((item, index) => {
        const changed = !others.has(item)
        const cls = changed ? (mode === 'current' ? 'bg-[#e3f1df]' : 'bg-[#fbeae5] line-through') : ''
        return (
          <li key={`${item}-${index}`} className={cls ? `rounded px-1 ${cls}` : undefined}>
            {item}
          </li>
        )
      })}
    </ol>
  )
}

/** 渲染对比单元格:数组走逐条 diff,其余走 ValueBlock */
function ComparisonSide({ row, side }: { row: FieldComparisonRow; side: 'previous' | 'current' }) {
  const valueJson = side === 'previous' ? row.previousValueJson : row.currentValueJson
  const valueText = side === 'previous' ? row.previousValueText : row.currentValueText
  const display = formatStructuredValue(valueJson, valueText)

  const items = parseListValue(display)
  const otherDisplay = formatStructuredValue(
    side === 'previous' ? row.currentValueJson : row.previousValueJson,
    side === 'previous' ? row.currentValueText : row.previousValueText
  )
  const otherItems = parseListValue(otherDisplay)

  if (items.length > 0 || otherItems.length > 0) {
    return <DiffList items={items} otherItems={otherItems} mode={side} />
  }
  return <ValueBlock value={display} />
}

function ChangeComparisonTable({ rows }: { rows: FieldComparisonRow[] }) {
  return (
    <s-table>
      <s-table-header-row>
        <s-table-header>字段</s-table-header>
        <s-table-header>变化</s-table-header>
        <s-table-header>旧值</s-table-header>
        <s-table-header>新值</s-table-header>
        <s-table-header>级别</s-table-header>
      </s-table-header-row>
      <s-table-body>
        {rows.map((row) => (
          <s-table-row key={row.fieldKey}>
            <s-table-cell>
              <div className={row.change ? 'rounded bg-[#fff4e5] px-2 py-1 font-medium' : undefined}>
                {fieldLabel(row.fieldKey)}
              </div>
            </s-table-cell>
            <s-table-cell>
              {row.change ? (
                <s-badge tone="warning">{CHANGE_TYPE_MAP[row.change.changeType] ?? row.change.changeType}</s-badge>
              ) : (
                '-'
              )}
            </s-table-cell>
            <s-table-cell>
              <ComparisonSide row={row} side="previous" />
            </s-table-cell>
            <s-table-cell>
              <s-stack direction="block" gap="small-300">
                <ComparisonSide row={row} side="current" />
                <PriceDeltaBadge row={row} />
              </s-stack>
            </s-table-cell>
            <s-table-cell>
              {row.change ? (
                <s-badge tone={SEVERITY_TONE[row.change.severity]}>{SEVERITY_MAP[row.change.severity]}</s-badge>
              ) : (
                '-'
              )}
            </s-table-cell>
          </s-table-row>
        ))}
      </s-table-body>
    </s-table>
  )
}

export function buildSummary(group: CompetitorChangeLogGroup) {
  const changes = getChanges(group)
  if (changes.length === 0) {
    return `${group.brand?.name ?? '该竞品'} 的 ${group.page?.pageName ?? '页面'} 与上一轮对比无变化。`
  }
  const highFields = changes.filter((change) => change.severity === 'HIGH').map((change) => fieldLabel(change.fieldKey))
  const visible = (highFields.length > 0 ? highFields : changes.map((change) => fieldLabel(change.fieldKey))).slice(
    0,
    4
  )
  return `${group.brand?.name ?? '该竞品'} 的 ${group.page?.pageName ?? '页面'} 有 ${changes.length} 个字段变化：${visible.join('、') || '暂无字段'}。`
}

export function getChangedCategories(group: CompetitorChangeLogGroup) {
  return FIELD_GROUPS.filter((fieldGroup) =>
    getChanges(group).some((change) => fieldGroup.fields.includes(change.fieldKey))
  ).map((fieldGroup) => fieldGroup.title)
}

function getComparisonRows(group: CompetitorChangeLogGroup): FieldComparisonRow[] {
  const changes = new Map(getChanges(group).map((change) => [change.fieldKey, change]))
  const previousResults = new Map((group.fieldSnapshots?.previous ?? []).map((result) => [result.fieldKey, result]))
  const currentResults = new Map((group.fieldSnapshots?.current ?? []).map((result) => [result.fieldKey, result]))
  const expectedFields = PAGE_TYPE_FIELDS[group.pageType] ?? PAGE_TYPE_FIELDS[group.page?.pageType ?? ''] ?? []
  const keys = unique([
    ...expectedFields,
    ...Array.from(currentResults.keys()),
    ...Array.from(previousResults.keys()),
    ...Array.from(changes.keys())
  ])

  return keys.map((fieldKey) => {
    const change = changes.get(fieldKey) ?? null
    const previousResult = previousResults.get(fieldKey)
    const currentResult = currentResults.get(fieldKey)
    return {
      fieldKey,
      change,
      previousValueJson: change?.previousValueJson ?? previousResult?.valueJson ?? null,
      previousValueText: change?.previousValueText ?? previousResult?.valueText ?? null,
      currentValueJson: change?.currentValueJson ?? currentResult?.valueJson ?? null,
      currentValueText: change?.currentValueText ?? currentResult?.valueText ?? null
    }
  })
}

function getOtherComparisonRows(group: CompetitorChangeLogGroup) {
  const knownFields = FIELD_GROUPS.flatMap((fieldGroup) => fieldGroup.fields)
  return getComparisonRows(group).filter((row) => !knownFields.includes(row.fieldKey))
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items))
}

function hasTrendData(group: CompetitorChangeLogGroup) {
  return (group.trends ?? []).some((trend) => {
    if (trend.fieldKey === 'current_price') return parseNumericValue(trend.valueJson, trend.valueText) != null
    return !isEmptyDisplayValue(formatStructuredValue(trend.valueJson, trend.valueText))
  })
}

export function getChanges(group: CompetitorChangeLogGroup) {
  return Array.isArray(group.changes) ? group.changes : []
}

export function normalizeChangeLogGroup(log: any): CompetitorChangeLogGroup {
  if (Array.isArray(log.changes)) {
    return { ...log, changeCount: log.changeCount ?? log.changes.length }
  }

  return {
    id: `${log.runId ?? 'run'}:${log.pageId ?? log.id}`,
    shop: log.shop,
    runId: log.runId,
    brandId: log.brandId,
    brand: log.brand,
    pageId: log.pageId,
    page: log.page,
    pageType: log.pageType,
    severity: log.severity,
    reviewStatus: log.reviewStatus,
    createdAt: log.createdAt,
    changeCount: 1,
    changes: [log]
  }
}

export function fieldLabel(fieldKey: string) {
  return FIELD_LABELS[fieldKey] ?? fieldKey
}

function ValueBlock({ value }: { value: string | null }) {
  const items = parseListValue(value)
  if (items.length > 0) {
    return (
      <ol className="m-0 list-decimal space-y-1 pl-5 text-sm text-[#202223]">
        {items.map((item, index) => (
          <li key={`${item}-${index}`}>{item}</li>
        ))}
      </ol>
    )
  }

  return <span>{formatValue(value, 160)}</span>
}

function parseListValue(value: string | null) {
  if (isEmptyDisplayValue(value)) return []
  const rawValue = value ?? ''

  try {
    const parsed = JSON.parse(rawValue)
    if (Array.isArray(parsed)) return parsed.map((item) => String(item)).filter(Boolean)
  } catch {
    return []
  }

  return []
}

function parseNumericValue(valueJson: any, valueText?: string | null) {
  const price = normalizePriceJson(valueJson)
  if (typeof price?.amount === 'number') return price.amount
  if (typeof price?.amount === 'string') {
    const amount = Number(price.amount.replace(/,/g, ''))
    if (Number.isFinite(amount)) return amount
  }

  if (!valueText) return null
  const matched = valueText.match(/-?\d[\d.,]*/)
  if (!matched) return null

  const numericText = matched[0]
  const lastComma = numericText.lastIndexOf(',')
  const lastDot = numericText.lastIndexOf('.')
  const normalized =
    lastComma > lastDot ? numericText.replace(/\./g, '').replace(',', '.') : numericText.replace(/,/g, '')
  const amount = Number(normalized)
  return Number.isFinite(amount) ? amount : null
}

export function formatValue(value: string | null, maxLength = 120) {
  if (isEmptyDisplayValue(value)) return '-'
  const rawValue = value ?? ''
  return rawValue.length > maxLength ? `${rawValue.slice(0, maxLength)}...` : rawValue
}

export function formatCompactValue(value: string | null, maxLength = 120) {
  const items = parseListValue(value)
  const text = items.length > 0 ? items.join('、') : value
  return formatValue(text, maxLength)
}

export function formatStructuredValue(valueJson: any, valueText: string | null) {
  const price = normalizePriceJson(valueJson)
  if (price) {
    if (typeof price.amount === 'number') {
      const symbol = price.currency ? getCurrencySymbol(price.currency) : ''
      return `${symbol}${price.amount.toFixed(2)}`
    }
    return price.raw || valueText
  }

  const unwrapped = unwrapValueJson(valueJson)
  if (Array.isArray(unwrapped)) return JSON.stringify(unwrapped)
  if (unwrapped != null && typeof unwrapped !== 'object') return String(unwrapped)
  if (unwrapped && typeof unwrapped === 'object') return JSON.stringify(unwrapped)
  return valueText
}

function normalizePriceJson(valueJson: any): {
  currency?: string
  amount?: number | string | null
  raw?: string | null
} | null {
  const value = unwrapValueJson(valueJson)
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  if (!('amount' in value) && !('currency' in value) && !('raw' in value)) return null

  const amount = typeof value.amount === 'number' || typeof value.amount === 'string' ? value.amount : null
  return {
    currency: typeof value.currency === 'string' ? value.currency : undefined,
    amount,
    raw: typeof value.raw === 'string' ? value.raw : null
  }
}

function unwrapValueJson(valueJson: any) {
  if (valueJson && typeof valueJson === 'object' && !Array.isArray(valueJson) && 'value' in valueJson) {
    return valueJson.value
  }
  return valueJson
}

export function isEmptyDisplayValue(value: string | null | undefined) {
  if (value == null) return true
  const normalized = String(value).trim().toLowerCase()
  return normalized === '' || normalized === 'null' || normalized === 'undefined' || normalized === 'n/a'
}
