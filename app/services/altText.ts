/**
 * AI 替代文本前端 API 客户端
 *
 * 全部走本 App 自己的 react-router action/loader（非 rewards 后端）。
 * 通过 ~/utils/http 统一入口，使用 `localApi: true`：
 *   - 不拼 rewardsBackendAPI 前缀，使用相对路径
 *   - 不要求 {code, message, data} 信封，返回裸 JSON
 *   - 自动注入 App Bridge session token、超时、错误 Toast
 */

import { http } from '~/utils/http'
import type {
  AltTextSummaryDTO,
  AltTextJobStatsDTO,
  CandidateImage,
  CandidateProduct,
  FilesFilter,
  ItemStatus,
  JobProgressDTO,
  JobStatus,
  ResourceType
} from '~/types/altText'

// ── 类型 ────────────────────────────────────────────────

export type { CandidateImage, CandidateProduct, FilesFilter, JobProgressDTO, ItemStatus, JobStatus }

export interface GenerateRequest {
  language: string
  includeProductTitle: boolean
  prompt?: string | null
  /** 用户在生成弹窗输入的品牌名（弹窗默认 Waterdrop，可改/可清；留空就传空串） */
  brand?: string | null
  /** 本批 SEO 关键词（无系统默认值；留空就传空串） */
  keywords?: string | null
  source: string
  items: Array<{
    resourceType: ResourceType
    resourceId: string
    parentId?: string | null
    parentTitle?: string | null
    imageUrl: string
    thumbnailUrl?: string | null
    originalAlt?: string | null
  }>
}

export interface GenerateResponse {
  jobId: string
  total: number
}

export interface ItemDTO {
  id: string
  resourceType: ResourceType
  resourceId: string
  parentId: string | null
  parentTitle: string | null
  imageUrl: string
  thumbnailUrl: string | null
  originalAlt: string | null
  generatedAlt: string | null
  editedAlt: string | null
  appliedAlt: string | null
  status: ItemStatus
  errorMessage: string | null
  language: string | null
  generatedAt: string | null
  reviewedAt: string | null
  appliedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ApplyResult {
  itemId: string
  ok: boolean
  error?: string
}

export interface ApplyResponse {
  success: number
  failed: number
  skipped: number
  results: ApplyResult[]
}

export interface PageInfo {
  hasMore: boolean
  nextCursor: string | null
}

// ── 客户端 ──────────────────────────────────────────────

export const altTextApi = {
  // 摘要
  getSummary: () => http.get<{ summary: AltTextSummaryDTO }>({ url: '/api/alt-text/summary', localApi: true }),

  getJobStats: () => http.get<{ stats: AltTextJobStatsDTO }>({ url: '/api/alt-text/jobs/summary', localApi: true }),

  scan: () => http.post<{ summary: AltTextSummaryDTO }>({ url: '/api/alt-text/scan', data: {}, localApi: true }),

  // 候选数据
  loadProducts: (
    body:
      | { source: 'all-products' }
      | { source: 'products'; productIds: string[] }
      | { source: 'collections'; collectionIds: string[] }
  ) => http.post<{ products: CandidateProduct[] }>({ url: '/api/alt-text/products', data: body, localApi: true }),

  loadFiles: (filter: FilesFilter) =>
    http.post<{ images: CandidateImage[] }>({ url: '/api/alt-text/files', data: { filter }, localApi: true }),

  // Job
  generate: (payload: GenerateRequest) =>
    http.post<GenerateResponse>({ url: '/api/alt-text/generate', data: payload, localApi: true }),

  pollJob: (jobId: string) => http.get<{ job: JobProgressDTO }>({ url: `/api/alt-text/jobs/${jobId}`, localApi: true }),

  loadJobItems: (jobId: string, opts: { status?: ItemStatus[]; cursor?: string; limit?: number } = {}) => {
    const params: Record<string, string> = {}
    if (opts.status?.length) params.status = opts.status.join(',')
    if (opts.cursor) params.cursor = opts.cursor
    if (opts.limit) params.limit = String(opts.limit)
    return http.get<{ items: ItemDTO[]; pageInfo: PageInfo }>({
      url: `/api/alt-text/jobs/${jobId}/items`,
      params,
      localApi: true
    })
  },

  loadJobs: (opts: { status?: JobStatus[]; cursor?: string; limit?: number } = {}) => {
    const params: Record<string, string> = {}
    if (opts.status?.length) params.status = opts.status.join(',')
    if (opts.cursor) params.cursor = opts.cursor
    if (opts.limit) params.limit = String(opts.limit)
    return http.get<{ jobs: JobProgressDTO[]; pageInfo: PageInfo }>({
      url: '/api/alt-text/jobs',
      params,
      localApi: true
    })
  },

  // Item 操作
  editItem: (id: string, editedAlt: string) =>
    http.patch<{ ok: true }>({ url: `/api/alt-text/items/${id}`, data: { editedAlt }, localApi: true }),

  rejectItem: (id: string) =>
    http.post<{ ok: true }>({ url: `/api/alt-text/items/${id}/reject`, data: {}, localApi: true }),

  retryItem: (id: string) =>
    http.post<{ ok: true }>({ url: `/api/alt-text/items/${id}/retry`, data: {}, localApi: true }),

  /**
   * 批量重试 Job 中所有 FAILED 条目。后端会自动复用 Job 当时的 language/prompt/brand/keywords
   * 以及切批派发；返回 retried = 实际成功派发到 n8n 的条目数量。
   */
  retryFailedJob: (jobId: string) =>
    http.post<{ retried: number; dispatchedBatches: number; failedToDispatch: number; message?: string }>({
      url: `/api/alt-text/jobs/${jobId}/retry-failed`,
      data: {},
      localApi: true
    }),

  deleteJob: (jobId: string) =>
    http.delete<{ ok: true; deletedJobs: number; deletedItems: number }>({
      url: `/api/alt-text/jobs/${jobId}`,
      localApi: true
    }),

  apply: (itemIds: string[], confirmationNonce: string) =>
    http.post<ApplyResponse>({ url: '/api/alt-text/apply', data: { itemIds, confirmationNonce }, localApi: true })
}
