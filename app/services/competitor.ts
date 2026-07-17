import { getSessionTokenHeader } from '~/utils/http'
import { EXTERNAL_API_DISABLED } from '~/config/externalApi'
import type {
  CompetitorBrand,
  CompetitorPageConfig,
  CompetitorShopSchedule,
  CompetitorRun,
  CompetitorFieldResult,
  CompetitorChangeLog,
  CompetitorChangeLogGroup,
  CompetitorWeeklyReport,
  CompetitorOverview,
  CompetitorPageAnalysis,
  OverviewPagesResponse,
  PageHistory,
  PaginatedResponse
} from '~/types/competitor'

const BASE = `${process.env.NODE_ENV === 'development' ? 'http://localhost:3100' : 'https://shopify.waterdropfilter.com'}/waterdrop-api/competitor`

async function request<T>(
  method: string,
  path: string,
  options?: {
    data?: unknown
    params?: Record<string, string | undefined>
  }
): Promise<T> {
  let url = `${BASE}${path}`

  // 外部接口调用总开关：关闭时短路外部请求，返回安全空值
  if (EXTERNAL_API_DISABLED) {
    console.warn(`[external-api-disabled] skip competitor ${method} ${url}`)
    return null as T
  }

  if (options?.params) {
    const entries = Object.entries(options.params).filter(([, v]) => v !== undefined) as [string, string][]
    if (entries.length > 0) {
      url += '?' + new URLSearchParams(entries).toString()
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(await getSessionTokenHeader())
  }

  const res = await fetch(url, {
    method,
    headers,
    body: options?.data ? JSON.stringify(options.data) : undefined
  })

  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText)
    if (typeof shopify !== 'undefined') shopify.toast.show(`Error: ${msg}`, { isError: true })
    throw new Error(msg)
  }

  const json = await res.json()
  if (json.code !== 200) {
    const msg = json.message || `Error (${json.code})`
    if (typeof shopify !== 'undefined') shopify.toast.show(msg, { isError: true })
    throw new Error(msg)
  }

  return json.data as T
}

async function requestBlob(path: string): Promise<Blob> {
  // 外部接口调用总开关：关闭时短路外部请求，返回空 Blob
  if (EXTERNAL_API_DISABLED) {
    console.warn(`[external-api-disabled] skip competitor blob ${BASE}${path}`)
    return new Blob()
  }

  const headers = await getSessionTokenHeader()
  const res = await fetch(`${BASE}${path}`, { headers })

  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText)
    if (typeof shopify !== 'undefined') shopify.toast.show(`Error: ${msg}`, { isError: true })
    throw new Error(msg)
  }

  return res.blob()
}

function toParams(obj: Record<string, unknown>): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(obj)) {
    result[k] = v != null ? String(v) : undefined
  }
  return result
}

export const competitorApi = {
  // ── 概览 ──
  getOverview: () => request<CompetitorOverview>('GET', '/overview'),

  getOverviewPages: (runId?: string) =>
    request<OverviewPagesResponse>('GET', '/overview/pages', { params: toParams(runId ? { runId } : {}) }),

  // ── 导出 ──
  exportWeekly: (runId?: string) => requestBlob(`/exports/weekly${runId ? `?runId=${encodeURIComponent(runId)}` : ''}`),

  // ── 品牌 ──
  getBrands: (params?: { page?: number; limit?: number; market?: string; isActive?: boolean }) =>
    request<PaginatedResponse<CompetitorBrand>>('GET', '/brands', { params: toParams(params ?? {}) }),

  createBrand: (data: { name: string; market: string; isFocus?: boolean; notes?: string }) =>
    request<CompetitorBrand>('POST', '/brands', { data }),

  updateBrand: (
    id: string,
    data: Partial<{ name: string; market: string; isActive: boolean; isFocus: boolean; notes: string }>
  ) => request<CompetitorBrand>('PATCH', `/brands/${id}`, { data }),

  deleteBrand: (id: string) => request<{ deleted: true }>('DELETE', `/brands/${id}`),

  // ── 页面 ──
  getPages: (params?: { page?: number; limit?: number; brandId?: string; pageType?: string; isActive?: boolean }) =>
    request<PaginatedResponse<CompetitorPageConfig>>('GET', '/pages', { params: toParams(params ?? {}) }),

  createPage: (data: Record<string, unknown>) => request<CompetitorPageConfig>('POST', '/pages', { data }),

  updatePage: (id: string, data: Record<string, unknown>) =>
    request<CompetitorPageConfig>('PATCH', `/pages/${id}`, { data }),

  deletePage: (id: string) => request<{ deleted: true }>('DELETE', `/pages/${id}`),

  getPageHistory: (id: string, limit = 12) =>
    request<PageHistory>('GET', `/pages/${id}/history`, { params: toParams({ limit }) }),

  getPageComparison: (id: string) => request<CompetitorChangeLogGroup | null>('GET', `/pages/${id}/comparison`),

  // ── 调度 ──
  getSchedule: () => request<CompetitorShopSchedule>('GET', '/schedule'),

  updateSchedule: (
    data: Partial<{ enabled: boolean; timezone: string; dayOfWeek: string; timeOfDay: string; aiEnabled: boolean }>
  ) => request<CompetitorShopSchedule>('PATCH', '/schedule', { data }),

  testN8n: () => request<{ ok: boolean; message: string }>('POST', '/schedule/test-n8n'),

  // ── 运行 ──
  getRuns: (params?: { page?: number; limit?: number; status?: string; triggerType?: string }) =>
    request<PaginatedResponse<CompetitorRun>>('GET', '/runs', { params: toParams(params ?? {}) }),

  getRunDetail: (id: string) => request<CompetitorRun & { snapshots: any[]; _count: any }>('GET', `/runs/${id}`),

  getSnapshotImage: (snapshotId: string) => requestBlob(`/screenshots/${snapshotId}`),

  retryPageInRun: (runId: string, pageId: string, mode: 'ANALYZE' | 'REFETCH' = 'ANALYZE') =>
    request<{ accepted: true }>('POST', `/runs/${runId}/pages/${pageId}/retry`, { data: { mode } }),

  triggerManualRun: (data: { scope: string; brandId?: string; pageId?: string }) =>
    request<CompetitorRun>('POST', '/runs/manual', { data }),

  // ── 周度页面分析(AI 运营解读) ──
  getRunAnalyses: (runId: string) => request<CompetitorPageAnalysis[]>('GET', `/runs/${runId}/analyses`),

  getPageAnalysis: (runId: string, pageId: string) =>
    request<CompetitorPageAnalysis | null>('GET', `/runs/${runId}/pages/${pageId}/analysis`),

  generatePageAnalysis: (runId: string, pageId: string) =>
    request<{ accepted: true }>('POST', `/runs/${runId}/pages/${pageId}/analysis`),

  // ── 字段结果 ──
  getFieldResults: (params?: {
    page?: number
    limit?: number
    runId?: string
    pageId?: string
    brandId?: string
    fieldKey?: string
  }) => request<PaginatedResponse<CompetitorFieldResult>>('GET', '/field-results', { params: toParams(params ?? {}) }),

  correctFieldResult: (id: string, data: { valueJson?: any; valueText?: string; correctionNote: string }) =>
    request<CompetitorFieldResult>('PATCH', `/field-results/${id}`, { data }),

  // ── 变化日志 ──
  getChangeLogs: (params?: {
    page?: number
    limit?: number
    runId?: string
    brandId?: string
    pageType?: string
    severity?: string
    reviewStatus?: string
    fieldKey?: string
    startDate?: string
    endDate?: string
  }) => request<PaginatedResponse<CompetitorChangeLogGroup>>('GET', '/change-logs', { params: toParams(params ?? {}) }),

  reviewChangeLog: (id: string, data: { reviewStatus: string; reviewNote?: string }) =>
    request<CompetitorChangeLog>('PATCH', `/change-logs/${id}/review`, { data }),

  // ── 周报 ──
  getWeeklyReports: (params?: { page?: number; limit?: number; runId?: string }) =>
    request<PaginatedResponse<CompetitorWeeklyReport>>('GET', '/weekly-reports', { params: toParams(params ?? {}) }),

  getWeeklyReport: (id: string) => request<CompetitorWeeklyReport>('GET', `/weekly-reports/${id}`),

  generateWeeklyReport: (runId: string) =>
    request<CompetitorWeeklyReport>('POST', '/weekly-reports/generate', { data: { runId } })
}
