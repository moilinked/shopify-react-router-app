import { http } from '~/utils/http'
import type {
  ActivityListItem,
  ActivityListResponse,
  ActivityListParams,
  ActivityDetail,
  ActivityFormData,
  DashboardData,
  DashboardParams,
  WinRecordsResponse,
  WinRecordsParams,
  Prize,
  WinRecordsExportResponse
} from '~/types/activity'

function toQueryParams(params: Record<string, unknown>): Record<string, string> | undefined {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
  return entries.length > 0 ? Object.fromEntries(entries.map(([k, v]) => [k, String(v)])) : undefined
}

// ── API Service ──

export const activityApi = {
  getList(params?: ActivityListParams): Promise<ActivityListResponse> {
    return http.get<ActivityListResponse>({
      url: '/admin/activities',
      params: toQueryParams({ page: params?.page, limit: params?.limit })
    })
  },

  getById(id: string): Promise<ActivityDetail> {
    return http.get<ActivityDetail>({ url: `/admin/activities/${id}` })
  },

  create(data: ActivityFormData): Promise<ActivityListItem> {
    return http.post<ActivityListItem>({ url: '/admin/activities', data })
  },

  update(id: string, data: ActivityFormData): Promise<ActivityListItem> {
    return http.put<ActivityListItem>({ url: `/admin/activities/${id}`, data })
  },

  remove(id: string): Promise<null> {
    return http.delete<null>({ url: `/admin/activities/${id}` })
  },

  getDashboard(params: DashboardParams): Promise<DashboardData> {
    return http.get<DashboardData>({
      url: '/admin/activities/dashboard',
      params: toQueryParams({
        id: params.id,
        start_date: params.start_date,
        end_date: params.end_date
      })
    })
  },

  getWinRecords(params: WinRecordsParams): Promise<WinRecordsResponse> {
    return http.get<WinRecordsResponse>({
      url: '/admin/activities/records',
      params: toQueryParams({
        activity_id: params.activity_id,
        prize_type: params.prize_type,
        status: params.status,
        search: params.search,
        draw_time_start: params.draw_time_start,
        draw_time_end: params.draw_time_end,
        page: params.page,
        limit: params.limit
      })
    })
  },

  exportRecords(params: WinRecordsParams): Promise<WinRecordsExportResponse> {
    return http.get<WinRecordsExportResponse>({
      url: '/admin/activities/records/export',
      params: toQueryParams({
        activity_id: params.activity_id,
        prize_type: params.prize_type,
        status: params.status,
        search: params.search,
        draw_time_start: params.draw_time_start,
        draw_time_end: params.draw_time_end
      })
    })
  },

  downloadRecords(url: string): Promise<void> {
    return http.downloadFile({ url })
  }
}

export type { Prize }
