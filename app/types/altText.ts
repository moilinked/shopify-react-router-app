/**
 * AI 替代文本相关类型与状态机常量
 *
 * SQLite 不支持 enum，统一使用 String 存储；取值约束在应用层维护。
 * 详细设计见 docs/AI替代文本功能技术方案.md §4.2
 */

// ── Job ────────────────────────────────────────────────

export const JOB_TYPES = ['SCAN', 'GENERATE', 'APPLY'] as const
export type JobType = (typeof JOB_TYPES)[number]

export const JOB_STATUSES = ['PENDING', 'RUNNING', 'REVIEWING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED'] as const
export type JobStatus = (typeof JOB_STATUSES)[number]

export const JOB_SOURCES = [
  'products',
  'collections',
  'all-products',
  'files-all',
  'files-missing-alt',
  'files-ai-optimized'
] as const
export type JobSource = (typeof JOB_SOURCES)[number]

// ── Item ───────────────────────────────────────────────

export const RESOURCE_TYPES = ['PRODUCT_IMAGE', 'FILE_MEDIA_IMAGE', 'FILE_GENERIC'] as const
export type ResourceType = (typeof RESOURCE_TYPES)[number]

export const ITEM_STATUSES = [
  'PENDING',
  'GENERATING',
  'READY_FOR_REVIEW',
  'EDITED',
  'APPLIED',
  'REJECTED',
  'FAILED'
] as const
export type ItemStatus = (typeof ITEM_STATUSES)[number]

/** 允许 apply 写回 Shopify 的 item 状态（关键二次确认守卫） */
export const APPLYABLE_ITEM_STATUSES: readonly ItemStatus[] = ['READY_FOR_REVIEW', 'EDITED']

/** 允许用户编辑 alt 的状态 */
export const EDITABLE_ITEM_STATUSES: readonly ItemStatus[] = ['READY_FOR_REVIEW', 'EDITED', 'APPLIED']

export const isApplyableStatus = (s: string): s is 'READY_FOR_REVIEW' | 'EDITED' =>
  s === 'READY_FOR_REVIEW' || s === 'EDITED'

// ── Files 筛选 ─────────────────────────────────────────

export const FILES_FILTERS = ['all', 'missing-alt', 'ai-optimized'] as const
export type FilesFilter = (typeof FILES_FILTERS)[number]

// ── 语言（前后端共享，不放 .server.ts 以便客户端可用） ──

export const SUPPORTED_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文（简体）' },
  { value: 'de', label: '德语' },
  { value: 'fr', label: '法语' },
  { value: 'ja', label: '日语' },
  { value: 'es', label: '西班牙语' },
  { value: 'it', label: '意大利语' },
  { value: 'pt', label: '葡萄牙语' },
  { value: 'ru', label: '俄语' }
] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]['value']

export const ALT_TEXT_DEFAULT_LANG: SupportedLanguage = 'en'

export const isSupportedLanguage = (v: unknown): v is SupportedLanguage =>
  typeof v === 'string' && SUPPORTED_LANGUAGES.some((l) => l.value === v)

/**
 * 生成弹窗 brand 输入框的初始默认值。
 * - 仅作为 UI 占位/初值，不再作为后端兜底；
 * - 用户可以在弹窗里改成任意值，也可以清空；
 * - 所改值随 Job 持久化到 `AltTextJob.brand`，retry 时复用。
 */
export const DEFAULT_BRAND_NAME = 'Waterdrop'

// ── DTOs ───────────────────────────────────────────────

export interface CandidateImage {
  id: string
  url: string
  alt: string | null
  resourceType: ResourceType
}

export interface CandidateProduct {
  id: string
  title: string
  totalImages: number
  imagesWithAlt: number
  images: Array<CandidateImage & { selected?: boolean }>
}

export interface AltTextSummaryDTO {
  totalImages: number
  missingAlt: number
  aiOptimized: number
  lastScanAt: string | null
}

export interface AltTextJobStatsDTO {
  pendingReview: number
  failed: number
}

export interface JobProgressDTO {
  id: string
  type: JobType
  status: JobStatus
  source: JobSource | string
  total: number
  processed: number
  failed: number
  pendingReview: number
  language: string
  createdAt: string
  updatedAt: string
}
