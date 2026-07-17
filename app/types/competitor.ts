// ── 品牌 ──

export interface CompetitorBrand {
  id: string
  shop: string
  name: string
  market: string
  isActive: boolean
  isFocus: boolean
  notes: string | null
  createdAt: string
  updatedAt: string
  _count?: { pages: number }
}

// ── 页面配置 ──

export const PAGE_TYPES = [
  'HOMEPAGE',
  'PDP',
  'FILTER_PDP',
  'BUNDLE',
  'SUBSCRIPTION',
  'CAMPAIGN',
  'COLLECTION',
  'CART',
  'POLICY',
  'UNKNOWN'
] as const
export type PageType = (typeof PAGE_TYPES)[number]

export const PLATFORMS = ['SHOPIFY', 'AMAZON', 'GENERIC'] as const
export type Platform = (typeof PLATFORMS)[number]

/** 按 URL 尽力推断平台,与后端 detectPlatform 逻辑保持一致 */
export function detectPlatform(url: string | undefined | null): Platform {
  if (!url) return 'GENERIC'
  let hostname: string
  try {
    hostname = new URL(url).hostname.toLowerCase()
  } catch {
    return 'GENERIC'
  }
  if (/(^|\.)amazon\./.test(hostname)) return 'AMAZON'
  if (hostname.endsWith('.myshopify.com')) return 'SHOPIFY'
  return 'GENERIC'
}

export interface CompetitorPageConfig {
  id: string
  shop: string
  brandId: string
  brand?: { id: string; name: string; market: string }
  platform: string
  pageType: string
  pageName: string
  pageUrl: string
  competitorModel: string | null
  competitorPrice: string | null
  ourMatchModel: string | null
  ourMatchProductUrl: string | null
  competitorUsp: string | null
  competitorWeakness: string | null
  priority: string
  fetchMode: string
  proxyRegion: string | null
  popupDismissSelectors: string[] | null
  isActive: boolean
  isFocus: boolean
  lastRunAt: string | null
  lastStatus: string | null
  createdAt: string
  updatedAt: string
}

// ── 调度 ──

export const DAYS_OF_WEEK = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const

export interface CompetitorShopSchedule {
  id: string
  shop: string
  enabled: boolean
  timezone: string
  dayOfWeek: string
  timeOfDay: string
  aiEnabled: boolean
}

// ── 运行 ──

export type RunStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'PARTIAL_FAILED' | 'FAILED'

export interface CompetitorRun {
  id: string
  shop: string
  triggerType: string
  scope: string
  status: RunStatus
  scheduledAt: string | null
  startedAt: string | null
  completedAt: string | null
  pageCount: number
  successCount: number
  failedCount: number
  summary: string | null
  errorMessage: string | null
  createdAt: string
}

// ── 快照 ──

export interface CompetitorPageSnapshot {
  id: string
  pageId: string
  brandId: string
  pageUrl: string
  fetchStatus: string
  errorMessage: string | null
  screenshotPath: string | null
  hasFetchResult?: boolean
  startedAt: string | null
  completedAt: string | null
}

// ── 字段结果 ──

export type FieldSource = 'AI' | 'MANUAL' | 'STRUCTURED'

export const FIELD_SOURCE_MAP: Record<string, { label: string; tone: string }> = {
  AI: { label: 'AI', tone: 'neutral' },
  MANUAL: { label: '人工', tone: 'info' },
  STRUCTURED: { label: '结构化', tone: 'success' }
}

export interface CompetitorFieldResult {
  id: string
  shop: string
  runId: string
  snapshotId: string
  brandId: string
  brand?: { id: string; name: string; market: string }
  pageId: string
  page?: { id: string; pageName: string; pageType: string; pageUrl: string }
  pageType: string
  fieldKey: string
  fieldLabel: string | null
  fieldPriority: string | null
  valueJson: any
  valueText: string | null
  confidence: number | null
  sourceText: string | null
  source: FieldSource
  originalValueJson: any
  originalValueText: string | null
  correctedBy: string | null
  correctedAt: string | null
  correctionNote: string | null
  createdAt: string
}

// ── 变化日志 ──

export type ChangeType = 'ADDED' | 'REMOVED' | 'MODIFIED'
export type Severity = 'HIGH' | 'MEDIUM' | 'LOW'
export type ReviewStatus = 'UNREVIEWED' | 'REVIEWED' | 'FOLLOW_UP' | 'IGNORED'

export interface CompetitorChangeLog {
  id: string
  shop: string
  runId: string
  brandId: string
  brand?: { id: string; name: string; market: string }
  pageId: string
  page?: { id: string; pageName: string; pageType: string; pageUrl: string }
  pageType: string
  fieldKey: string
  changeType: ChangeType
  severity: Severity
  previousValueJson: any
  currentValueJson: any
  previousValueText: string | null
  currentValueText: string | null
  aiSummary: string | null
  reviewStatus: ReviewStatus
  reviewNote: string | null
  createdAt: string
}

export interface CompetitorChangeLogGroup {
  id: string
  shop: string
  runId: string
  brandId: string
  brand?: { id: string; name: string; market: string }
  pageId: string
  page?: { id: string; pageName: string; pageType: string; pageUrl: string }
  pageType: string
  severity: Severity
  reviewStatus: ReviewStatus
  createdAt: string
  changeCount: number
  changes: CompetitorChangeLog[]
  snapshots?: {
    previous: { id: string; screenshotPath: string | null; createdAt: string } | null
    current: { id: string; screenshotPath: string | null; createdAt: string } | null
  } | null
  fieldSnapshots?: {
    previous: CompetitorChangeFieldSnapshot[]
    current: CompetitorChangeFieldSnapshot[]
  } | null
  trends?: Array<{ fieldKey: string; valueJson?: any; valueText: string | null; createdAt: string; runId: string }>
}

export interface CompetitorChangeFieldSnapshot {
  fieldKey: string
  fieldLabel: string | null
  valueJson: any
  valueText: string | null
  confidence: number | null
  createdAt: string
  runId: string
}

// ── 周报 ──

export type ReportStatus = 'GENERATING' | 'COMPLETED' | 'FAILED' | 'SUPERSEDED'

export interface CompetitorWeeklyReport {
  id: string
  shop: string
  runId: string
  run?: CompetitorRun
  periodStart: string | null
  periodEnd: string | null
  status: ReportStatus
  triggerType: string
  overviewJson: any
  highlightsJson: any[]
  brandAnalysisJson: any[]
  actionItemsJson: any[]
  fullMarkdown: string | null
  modelUsed: string | null
  createdAt: string
}

// ── 概览 ──

export interface CompetitorOverview {
  brandCount: number
  pageCount: number
  activePageCount: number
  latestRun: {
    id: string
    status: RunStatus
    triggerType: string
    startedAt: string | null
    completedAt: string | null
    successCount: number
    failedCount: number
  } | null
  highSeverityChanges: number
  changedPageCount: number
  failedPages: number
  consecutiveFailPages: number
  scheduleEnabled: boolean
}

// ── 概览竞品信息(/overview/pages) ──

export interface OverviewPageField {
  fieldKey: string
  label: string
  valueText: string | null
  valueJson?: any
  source: string | null
  confidence: number | null
  changed: boolean
  changeType: ChangeType | null
  severity: Severity | null
  previousValueText: string | null
}

export interface OverviewPageEntry {
  page: {
    id: string
    pageName: string
    pageType: string
    pageUrl: string
    platform: string | null
    priority: string | null
  }
  brand: { id: string; name: string; market: string } | null
  fields: OverviewPageField[]
  changeCount: number
  maxSeverity: Severity | null
  snapshotStatus: string | null
}

export interface OverviewPagesResponse {
  runId: string | null
  pages: OverviewPageEntry[]
}

// ── 周度页面分析(AI 运营解读) ──

export interface PageAnalysisFinding {
  fieldKey: string
  label?: string
  changeType?: string
  previousValue?: string | null
  currentValue?: string | null
  impactLevel?: Severity | string
  interpretation?: string
  suggestion?: string
}

export interface CompetitorPageAnalysis {
  id: string
  shop: string
  runId: string
  pageId: string
  brandId: string
  pageType: string
  status: 'GENERATING' | 'COMPLETED' | 'FAILED'
  overviewJson?: { summary?: string; unchangedNote?: string } | null
  findingsJson?: PageAnalysisFinding[] | null
  strategyJson?: { intent?: string; keyImpacts?: string[]; mainThreat?: string; followUps?: string[] } | null
  fullMarkdown?: string | null
  modelUsed?: string | null
  promptVersion?: string | null
  errorMessage?: string | null
  createdAt: string
  updatedAt: string
}

// ── 分页 ──

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  /** 分页前的全量汇总(change-logs 列表返回:groupCount/changeCount/highGroupCount) */
  stats?: Record<string, number>
}

// ── Label Maps ──

export const RUN_STATUS_MAP: Record<RunStatus, string> = {
  PENDING: '等待中',
  RUNNING: '运行中',
  SUCCEEDED: '已完成',
  PARTIAL_FAILED: '部分失败',
  FAILED: '失败'
}

export const RUN_STATUS_TONE = {
  PENDING: 'info',
  RUNNING: 'info',
  SUCCEEDED: 'success',
  PARTIAL_FAILED: 'warning',
  FAILED: 'critical'
} as const

export const SEVERITY_MAP: Record<Severity, string> = {
  HIGH: '高',
  MEDIUM: '中',
  LOW: '低'
}

export const SEVERITY_TONE = {
  HIGH: 'critical',
  MEDIUM: 'warning',
  LOW: 'info'
} as const

export const CHANGE_TYPE_MAP: Record<ChangeType, string> = {
  ADDED: '新增',
  REMOVED: '移除',
  MODIFIED: '变更'
}

/**
 * 复核工作流 UI 开关:运营当前不需要人工审核变化状态,暂时屏蔽相关入口
 * (后端 API/字段保留,需要时翻开关即可恢复)。
 */
export const REVIEW_ENABLED = false

export const REVIEW_STATUS_MAP: Record<ReviewStatus, string> = {
  UNREVIEWED: '待复核',
  REVIEWED: '已复核',
  FOLLOW_UP: '待跟进',
  IGNORED: '已忽略'
}

export const REVIEW_STATUS_TONE = {
  UNREVIEWED: 'caution',
  REVIEWED: 'success',
  FOLLOW_UP: 'warning',
  IGNORED: 'info'
} as const

export const REPORT_STATUS_MAP: Record<ReportStatus, string> = {
  GENERATING: '生成中',
  COMPLETED: '已完成',
  FAILED: '失败',
  SUPERSEDED: '已替代'
}

export const REPORT_STATUS_TONE = {
  GENERATING: 'info',
  COMPLETED: 'success',
  FAILED: 'critical',
  SUPERSEDED: 'info'
} as const

export const PLATFORM_MAP: Record<string, string> = {
  SHOPIFY: 'Shopify',
  AMAZON: 'Amazon',
  GENERIC: '通用/其它'
}

// ── 市场 ──

export const MARKETS = ['US', 'EU', 'UK', 'DE', 'AU', 'CA', 'SG'] as const
export type Market = (typeof MARKETS)[number]

export const MARKET_MAP: Record<string, string> = {
  US: '美国 (US)',
  EU: '欧盟 (EU)',
  UK: '英国 (UK)',
  DE: '德国 (DE)',
  AU: '澳洲 (AU)',
  CA: '加拿大 (CA)',
  SG: '新加坡 (SG)'
}

// ── 字段历史矩阵 ──

export interface PageHistoryCell {
  runId: string
  runAt: string
  valueText: string | null
  valueJson: unknown
  valueType: string | null
  source: FieldSource | null
  confidence: number | null
  changed: boolean
  changeType: 'ADDED' | 'REMOVED' | 'MODIFIED' | null
  severity: 'HIGH' | 'MEDIUM' | 'LOW' | null
}

export interface PageHistoryField {
  fieldKey: string
  label: string
  priority: string | null
  cells: PageHistoryCell[]
}

export interface PageHistory {
  page: {
    id: string
    pageName: string
    pageType: string
    pageUrl: string
    platform: string
    brand?: { id: string; name: string; market: string }
  }
  runs: Array<{ runId: string; runAt: string; status: string; triggerType: string }>
  fields: PageHistoryField[]
  series: Record<string, Array<{ t: string; v: number }>>
}

export const PAGE_TYPE_MAP: Record<string, string> = {
  HOMEPAGE: '首页',
  PDP: '产品详情',
  FILTER_PDP: '净水器 PDP',
  BUNDLE: '套装',
  SUBSCRIPTION: '订阅',
  CAMPAIGN: '活动',
  COLLECTION: '分类',
  CART: '购物车',
  POLICY: '政策',
  UNKNOWN: '未分类'
}

export const DAY_OF_WEEK_MAP: Record<string, string> = {
  MONDAY: '周一',
  TUESDAY: '周二',
  WEDNESDAY: '周三',
  THURSDAY: '周四',
  FRIDAY: '周五',
  SATURDAY: '周六',
  SUNDAY: '周日'
}
