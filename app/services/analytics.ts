// 数据分析模块真实 API 客户端(替换 analytics.mock)。镜像 services/competitor.ts:
// 自带 BASE + request<T>(解 {code,message,data} 信封)+ downloadFile(xlsx);后端响应 → 前端类型用适配器对齐。
import { getSessionTokenHeader } from '~/utils/http'
import { EXTERNAL_API_DISABLED } from '~/config/externalApi'
import type {
  AnalyticsReportDetail,
  AnalyticsReportListItem,
  AnalyticsSettings,
  AnalyticsTable,
  ChannelGroupDef,
  ChannelMapRow,
  ChannelTrendResult,
  CollectionTrendResult,
  CollectionOrderRow,
  Granularity,
  PeriodArchivePage,
  PeriodOption,
  ProductDictRow,
  ReportStatus,
  SkuTrendResult,
  TableType,
  UnmatchedSummary
} from '~/types/analytics'

const BASE = `${process.env.NODE_ENV === 'development' ? 'http://localhost:3100' : 'https://shopify.waterdropfilter.com'}/waterdrop-api/analytics`

async function request<T>(
  method: string,
  path: string,
  options?: { data?: unknown; params?: Record<string, string | undefined> }
): Promise<T> {
  let url = `${BASE}${path}`

  // 外部接口调用总开关：关闭时短路外部请求，返回安全空值
  if (EXTERNAL_API_DISABLED) {
    console.warn(`[external-api-disabled] skip analytics ${method} ${url}`)
    return null as T
  }

  if (options?.params) {
    const entries = Object.entries(options.params).filter(([, v]) => v !== undefined) as [string, string][]
    if (entries.length > 0) url += '?' + new URLSearchParams(entries).toString()
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

/** xlsx 下载:带 session token,读 Content-Disposition 文件名,触发浏览器下载 */
async function downloadFile(path: string): Promise<void> {
  // 外部接口调用总开关：关闭时不发起下载请求
  if (EXTERNAL_API_DISABLED) {
    console.warn(`[external-api-disabled] skip analytics download ${BASE}${path}`)
    return
  }

  const headers = await getSessionTokenHeader()
  const res = await fetch(`${BASE}${path}`, { headers })
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText)
    if (typeof shopify !== 'undefined') shopify.toast.show(`Error: ${msg}`, { isError: true })
    throw new Error(msg)
  }
  const disposition = res.headers.get('Content-Disposition') || ''
  const match = disposition.match(/filename="?([^";]+)"?/)
  const filename = match?.[1] || 'analytics.xlsx'
  const blob = await res.blob()
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(blobUrl)
}

// ── 后端原始形状(仅本文件适配用)──────────────────────
interface RawConfig {
  ga4PropertyId: string | null
  currency: string | null
  isActive: boolean
}
interface RawSchedule {
  timezone: string
  weeklyEnabled: boolean
  weeklyDayOfWeek: string | null
  weeklyTimeOfDay: string | null
  monthlyEnabled: boolean
  monthlyDayOfMonth: number | null
  monthlyTimeOfDay: string | null
}
interface RawCollection {
  id: string
  collectionId: string
  title: string
  sortOrder: number
  isActive: boolean
  productCount: number
}
interface RawProduct {
  id: string
  productId: string
  title: string | null
  model: string | null
  modelOverride: string | null
  collectionTitle: string | null
  status: 'OK' | 'MISSING_MODEL'
}
interface RawChannelGroup {
  id: string
  name: string
  sortOrder: number
  isActive: boolean
}
interface RawChannelMap {
  id: string
  sourceMedium: string
  channelGroupId: string | null
  isActive: boolean
}
interface RawReportDetail extends AnalyticsReportListItem {
  dataThrough: string
  tables: Record<TableType, AnalyticsTable> | null
  ai: AnalyticsReportDetail['ai']
  unmatched: UnmatchedSummary
  errorMessage: string | null
}

export const analyticsApi = {
  // ── 报表浏览(M2 实时组表)──
  getPeriods: (granularity: Granularity) => request<PeriodOption[]>('GET', '/periods', { params: { granularity } }),

  getTable: (
    tableType: TableType,
    granularity: Granularity,
    period: string,
    periods?: number,
    pagination?: { page?: number; pageSize?: number; search?: string }
  ) =>
    request<AnalyticsTable>('GET', `/tables/${tableType}`, {
      params: {
        granularity,
        period,
        periods: periods != null ? String(periods) : undefined,
        page: pagination?.page != null ? String(pagination.page) : undefined,
        pageSize: pagination?.pageSize != null ? String(pagination.pageSize) : undefined,
        search: pagination?.search?.trim() || undefined
      }
    }),

  /** 销售-SKU 下 3 张「周×SKU」矩阵表(销量/销额/转化率) */
  getSkuTrends: (granularity: Granularity, period: string, periods?: number) =>
    request<SkuTrendResult>('GET', '/tables/sku-trends', {
      params: { granularity, period, periods: periods != null ? String(periods) : undefined }
    }),

  /** 销售-Collections 下 2 张「周×Collection」矩阵表(销量/销额) */
  getCollectionTrends: (granularity: Granularity, period: string, periods?: number) =>
    request<CollectionTrendResult>('GET', '/tables/collection-trends', {
      params: { granularity, period, periods: periods != null ? String(periods) : undefined }
    }),

  /** 渠道-整站下 3 张「周×渠道」矩阵表(转化率/流量/销额) */
  getChannelTrends: (granularity: Granularity, period: string, periods?: number) =>
    request<ChannelTrendResult>('GET', '/tables/channel-trends', {
      params: { granularity, period, periods: periods != null ? String(periods) : undefined }
    }),

  exportTable: (tableType: TableType, granularity: Granularity, period: string) =>
    downloadFile(`/tables/${tableType}/export?granularity=${granularity}&period=${encodeURIComponent(period)}`),

  /** 导出某周期全部启用表 + SKU/Collection/渠道矩阵(单文件多 sheet;R5 暂下线) */
  exportPeriod: (granularity: Granularity, period: string) =>
    downloadFile(`/export?granularity=${granularity}&period=${encodeURIComponent(period)}`),

  collect: (granularity: Granularity, period: string) =>
    request<{ queued: boolean }>('POST', '/collect', { data: { granularity, period } }),

  // ── 报告存档 ──
  /** 周期归档:有数据的周期 + 报告状态(分页 20/页;筛选 granularity / period) */
  getPeriodArchive: (granularity: Granularity, period: string | undefined, page: number, pageSize = 20) =>
    request<PeriodArchivePage>('GET', '/reports/periods', {
      params: { granularity, page: String(page), pageSize: String(pageSize), ...(period ? { period } : {}) }
    }),

  /** 报告详情。未找到 → null;已找到但未生成完成(PENDING/RUNNING/FAILED)→ tables 为 null,errorMessage 携失败原因 */
  getReportDetail: async (id: string): Promise<AnalyticsReportDetail | null> => {
    const d = await request<RawReportDetail | null>('GET', `/reports/${id}`)
    if (!d) return null // 报告不存在(或不属于当前店铺)
    return { ...d, status: d.status as ReportStatus, tables: d.tables ?? null }
  },

  generateReport: (granularity: Granularity, period?: string) =>
    request<AnalyticsReportListItem>('POST', '/reports/generate', { data: { granularity, period } }),

  exportReport: (id: string) => downloadFile(`/reports/${id}/export`),

  // ── 目录同步 ──
  syncCatalog: () => request<{ queued: boolean }>('POST', '/products/sync'),

  // ── Collection 排序 ──
  getCollections: async (): Promise<CollectionOrderRow[]> => {
    const rows = await request<RawCollection[]>('GET', '/collections')
    return rows.map((r) => ({
      id: r.id,
      collectionId: r.collectionId,
      title: r.title,
      productCount: r.productCount,
      sortOrder: r.sortOrder,
      isActive: r.isActive
    }))
  },

  reorderCollections: (items: Array<{ collectionId: string; sortOrder: number }>) =>
    request<{ updated: number }>('PUT', '/collections/order', { data: { items } }),

  addCollections: (collectionIds: string[]) =>
    request<{ added: number }>('POST', '/collections/add', { data: { collectionIds } }),

  removeCollection: (collectionId: string) =>
    request<{ ok: true }>('DELETE', `/collections/${encodeURIComponent(collectionId)}`),

  removeCollections: (collectionIds: string[]) =>
    request<{ removed: number }>('POST', '/collections/remove', { data: { collectionIds } }),

  // ── 产品字典 ──
  getProducts: async (): Promise<ProductDictRow[]> => {
    const rows = await request<RawProduct[]>('GET', '/products')
    return rows.map((r) => ({
      id: r.id,
      productId: r.productId,
      title: r.title ?? '',
      bizSku: r.model, // 业务SKU = metafield Model
      modelOverride: r.modelOverride,
      collectionTitle: r.collectionTitle,
      ga4Aligned: true, // 逐商品 GA4 对齐标记为后续增强,暂不阻塞
      status: r.status
    }))
  },

  overrideProduct: (productId: string, modelOverride: string) =>
    request<RawProduct>('PATCH', `/products/${encodeURIComponent(productId)}`, { data: { modelOverride } }),

  addProducts: (productIds: string[]) =>
    request<{ added: number; missingModel: number }>('POST', '/products/add', { data: { productIds } }),

  removeProduct: (productId: string) => request<{ ok: true }>('DELETE', `/products/${encodeURIComponent(productId)}`),

  removeProducts: (productIds: string[]) =>
    request<{ removed: number }>('POST', '/products/remove', { data: { productIds } }),

  // ── 渠道分组字典 ──
  getChannelGroups: async (): Promise<ChannelGroupDef[]> => {
    const rows = await request<RawChannelGroup[]>('GET', '/channel-groups')
    return rows.map((g) => ({ id: g.id, name: g.name, sortOrder: g.sortOrder, isActive: g.isActive }))
  },

  createChannelGroup: (name: string) => request<RawChannelGroup>('POST', '/channel-groups', { data: { name } }),

  updateChannelGroup: (id: string, data: Partial<{ name: string; sortOrder: number; isActive: boolean }>) =>
    request<RawChannelGroup>('PATCH', `/channel-groups/${id}`, { data }),

  deleteChannelGroup: (id: string) => request<{ ok: true }>('DELETE', `/channel-groups/${id}`),

  // ── 渠道映射 ──
  getChannelMaps: async (): Promise<ChannelMapRow[]> => {
    const rows = await request<RawChannelMap[]>('GET', '/maps/channel')
    return rows.map((r) => ({
      id: r.id,
      sourceMedium: r.sourceMedium,
      channelGroupId: r.channelGroupId,
      suggestedGroupId: null, // 系统建议分组为后续增强
      isActive: r.isActive,
      matched: !!r.channelGroupId
    }))
  },

  updateChannelMap: (id: string, data: { channelGroupId?: string | null; isActive?: boolean }) =>
    request<RawChannelMap>('PATCH', `/maps/channel/${id}`, { data }),

  // ── 口径概览(红点计数)──
  getCaliberSummary: () =>
    request<{ missingModel: number; ga4Unaligned: number; sourceMediums: number }>('GET', '/caliber/summary'),

  // ── 配置 / 调度 ──
  getSettings: async (currency: string, timezone: string): Promise<AnalyticsSettings> => {
    const [config, schedule] = await Promise.all([
      request<RawConfig | null>('GET', '/config'),
      request<RawSchedule | null>('GET', '/schedule')
    ])
    return {
      ga4PropertyId: config?.ga4PropertyId ?? '',
      currency,
      weeklyEnabled: schedule?.weeklyEnabled ?? false,
      weeklyDayOfWeek: schedule?.weeklyDayOfWeek ?? 'TUESDAY',
      weeklyTimeOfDay: schedule?.weeklyTimeOfDay ?? '09:00',
      monthlyEnabled: schedule?.monthlyEnabled ?? false,
      monthlyDayOfMonth: schedule?.monthlyDayOfMonth ?? 2,
      monthlyTimeOfDay: schedule?.monthlyTimeOfDay ?? '09:00',
      timezone: schedule?.timezone ?? timezone
    }
  },

  saveSettings: async (s: AnalyticsSettings): Promise<void> => {
    await Promise.all([
      request<RawConfig>('PUT', '/config', { data: { ga4PropertyId: s.ga4PropertyId } }),
      request<RawSchedule>('PUT', '/schedule', {
        data: {
          timezone: s.timezone,
          weeklyEnabled: s.weeklyEnabled,
          weeklyDayOfWeek: s.weeklyDayOfWeek,
          weeklyTimeOfDay: s.weeklyTimeOfDay,
          monthlyEnabled: s.monthlyEnabled,
          monthlyDayOfMonth: s.monthlyDayOfMonth,
          monthlyTimeOfDay: s.monthlyTimeOfDay
        }
      })
    ])
  },

  testGa4: (ga4PropertyId: string) =>
    request<{ ok: boolean; message: string }>('POST', '/config/test-ga4', { data: { ga4PropertyId } })
}
