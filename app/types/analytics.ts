// 数据分析模块前端类型(v2.0 table-first;scaffold 阶段配合假数据,后端就绪后对齐 API 契约)

export type Granularity = 'WEEK' | 'MONTH'

export type TableType =
  | 'SALES_SITE'
  | 'SALES_SKU'
  | 'SALES_COLLECTION'
  | 'CHANNEL_SITE'
  | 'CHANNEL_PRODUCT'
  | 'LANDING_PAGE_SITE'
  | 'CHANNEL_MARKETING'

export const TABLE_TYPE_MAP: Record<TableType, string> = {
  SALES_SITE: '销售-整站',
  SALES_SKU: '销售-SKU',
  SALES_COLLECTION: '销售-Collections',
  CHANNEL_SITE: '渠道-整站',
  CHANNEL_PRODUCT: '产品-渠道',
  LANDING_PAGE_SITE: '落地页-整站',
  CHANNEL_MARKETING: '渠道-Marketing'
}

// 报表页/报告详情实际展示的 tab 列表。
// ⚠️ CHANNEL_MARKETING(渠道-Marketing)暂下线,待 Shopify Growth API 开放后重新接入;
// 类型/标签保留,恢复时把 'CHANNEL_MARKETING' 加回此列表即可。
export const ACTIVE_TABLE_TYPES: TableType[] = [
  'SALES_SITE',
  'SALES_SKU',
  'SALES_COLLECTION',
  'CHANNEL_SITE',
  'CHANNEL_PRODUCT',
  'LANDING_PAGE_SITE'
]

export interface PeriodOption {
  period: string // "2026-W23" | "2026-05"
  label: string // "2026-W23(06-01 ~ 06-07)" | "2026年5月"
  hasData: boolean
}

export interface AnalyticsColumn {
  key: string
  label: string
  type: 'text' | 'number' | 'money' | 'percent'
  compare?: boolean // 是否在单元格下方展示环比
  hint?: string // 口径解释 tooltip
  source?: string // 数据来源(表头 hover「数据取自:X」):Shopify / GA4 / Shopify Marketing
}

export interface AnalyticsRowCompare {
  prevValue: number | null
  deltaPct: number | null // 环比百分比,正=上升;null=无对比期
}

export interface AnalyticsRow {
  dims: Record<string, string> // 维度列值(含 text 列)
  metrics: Record<string, number | null>
  compare?: Record<string, AnalyticsRowCompare>
}

export interface UnmatchedSummary {
  missingModel: string[] // 缺 metafield Model 的商品(productId 或标题)
  ga4Unaligned: string[] // GA4 itemId 未对齐到 product
  sourceMediums: string[] // 未分组的 source / medium
}

export interface AnalyticsPagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface AnalyticsTable {
  tableType: TableType
  granularity: Granularity
  period: string // 维度表:本期;SALES_SITE:最新期
  periodLabel: string
  currency: string
  dataThrough: string // GA4 数据截止日
  columns: AnalyticsColumn[]
  rows: AnalyticsRow[]
  summary: Record<string, number | null> | null // 合计行(SALES_SITE 无)
  unmatchedRow: AnalyticsRow | null // 未映射聚合行
  unmatched: UnmatchedSummary
  pagination?: AnalyticsPagination
}

// ===== 销售-SKU 下的「周×SKU」透视矩阵表(销量 / 销额 / 转化率)=====
// 行=最近 N 期,列=各业务SKU(动态列,按区间总净销量降序);复用 AnalyticsTable + ReportTable 渲染。

export interface SkuTrendMatrix {
  id: 'qty' | 'sales' | 'cvr'
  title: string
  subtitle: string
  table: AnalyticsTable
}

export interface SkuTrendResult {
  granularity: Granularity
  period: string
  periodLabel: string
  currency: string
  dataThrough: string
  isNorthAmerica: boolean // 本店是否北美(销额矩阵取 Net Sales;否则 Total Sales)
  salesMetric: 'netSales' | 'totalSales'
  tables: SkuTrendMatrix[]
}

// ===== 销售-Collections 下的「周×Collection」透视矩阵表(销量 / 销额)=====

export interface CollectionTrendMatrix {
  id: 'qty' | 'sales'
  title: string
  subtitle: string
  table: AnalyticsTable
}

export interface CollectionTrendResult {
  granularity: Granularity
  period: string
  periodLabel: string
  currency: string
  dataThrough: string
  isNorthAmerica: boolean
  salesMetric: 'netSales' | 'totalSales'
  tables: CollectionTrendMatrix[]
}

// ===== 渠道-整站下的「周×渠道」透视矩阵表(转化率 / 流量 / 销额)=====

export interface ChannelTrendMatrix {
  id: 'cvr' | 'traffic' | 'sales'
  title: string
  subtitle: string
  table: AnalyticsTable
}

export interface ChannelTrendResult {
  granularity: Granularity
  period: string
  periodLabel: string
  currency: string
  dataThrough: string
  tables: ChannelTrendMatrix[]
}

// ===== 报告存档 =====

export type ReportStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED'

export const REPORT_STATUS_MAP: Record<ReportStatus, string> = {
  PENDING: '等待中',
  RUNNING: '生成中',
  SUCCEEDED: '已完成',
  FAILED: '失败'
}

export interface AiInsight {
  /** 完整分析报告(Markdown:分节标题 + 加粗重点 + 数据来源标注;前端按 Markdown 渲染) */
  markdown: string
}

export interface AnalyticsReportListItem {
  id: string
  granularity: Granularity
  period: string
  periodLabel: string
  status: ReportStatus
  hasAi: boolean
  createdAt: string
}

export interface AnalyticsReportDetail extends AnalyticsReportListItem {
  dataThrough: string
  /** 未生成完成(PENDING/RUNNING/FAILED)时为 null */
  tables: Record<TableType, AnalyticsTable> | null
  ai: AiInsight | null
  unmatched: UnmatchedSummary
  /** 失败原因(status=FAILED 时);其余为 null */
  errorMessage: string | null
}

// 周期归档:一行一个「有数据的周期」+ 该周期最新报告(无则 report=null)
export interface PeriodArchiveItem {
  period: string
  periodLabel: string
  granularity: Granularity
  report: { id: string; status: ReportStatus; hasAi: boolean; createdAt: string } | null
}

export interface PeriodArchivePage {
  items: PeriodArchiveItem[]
  total: number
  page: number
  pageSize: number
  periods: Array<{ period: string; label: string }> // 全部有数据周期(供筛选下拉)
}

// ===== 口径管理(v2.1:Collection 排序 / 商品字典 / 渠道分组)=====

export type MapKind = 'collection' | 'product' | 'channel'

// 内置默认渠道分组种子;运营可在「渠道分组」页增删改,实际分组以 ChannelGroupDef 为准
export const CHANNEL_GROUPS = [
  'Paid Search',
  'Organic',
  'Paid Social',
  'Direct',
  'Referral',
  'Email',
  'AI Referral'
] as const

// 渠道分组定义(运营可管理:新增/改名/删除/排序)
export interface ChannelGroupDef {
  id: string
  name: string
  sortOrder: number
  isActive: boolean
}

// Collection 排序:product 命中多个 collection 时取 sortOrder 最靠前者
export interface CollectionOrderRow {
  id: string
  collectionId: string
  title: string
  productCount: number // 该 collection 下商品数(展示用)
  sortOrder: number
  isActive: boolean
}

// 商品字典:业务SKU=metafield Model(只读),GA4 itemId 自动对齐
export interface ProductDictRow {
  id: string
  productId: string // Shopify product 数字 id(只读键)
  title: string
  bizSku: string | null // = metafield Model;null 表示缺 Model
  modelOverride: string | null // 人工覆盖(优先于 metafield)
  collectionTitle: string | null // 排序命中的 Collection
  ga4Aligned: boolean // GA4 itemId 是否已解析对齐到本 product
  status: 'OK' | 'MISSING_MODEL' // 业务SKU 缺失标记
}

export interface ChannelMapRow {
  id: string
  sourceMedium: string // 只读键
  channelGroupId: string | null // 引用 ChannelGroupDef.id;null=未分组
  suggestedGroupId: string | null // 系统建议分组(引用 id)
  isActive: boolean
  matched: boolean
}

// ===== 设置(保留 v1)=====

export interface AnalyticsSettings {
  ga4PropertyId: string
  currency: string
  weeklyEnabled: boolean
  weeklyDayOfWeek: string
  weeklyTimeOfDay: string
  monthlyEnabled: boolean
  monthlyDayOfMonth: number
  monthlyTimeOfDay: string
  timezone: string
}
