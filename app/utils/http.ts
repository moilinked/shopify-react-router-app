import { APP_CONFIG } from '~/config'

// ── Types ──────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

export class BusinessError extends Error {
  code: number

  constructor(code: number, message: string) {
    super(message)
    this.name = 'BusinessError'
    this.code = code
  }
}

export class HttpError extends Error {
  status: number
  details?: unknown

  constructor(status: number, statusText: string, details?: unknown) {
    super(`HTTP ${status}: ${statusText}`)
    this.name = 'HttpError'
    this.status = status
    this.details = details
  }
}

export class TimeoutError extends Error {
  constructor(timeout: number) {
    super(`Request timeout after ${timeout}ms`)
    this.name = 'TimeoutError'
  }
}

export interface HttpRequestConfig {
  url: string
  data?: unknown
  params?: Record<string, string>
  headers?: Record<string, string>
  skipErrorToast?: boolean
  signal?: AbortSignal
  timeout?: number | null
  /**
   * 调用本 App 自己的 react-router action/loader。
   * - 不会拼 `rewardsBackendAPI` 前缀，使用相对路径
   * - 不要求 `{code, message, data}` 信封，直接返回裸 JSON
   * - 仍然会带 App Bridge session token、错误 Toast
   */
  localApi?: boolean
}

// ── Interceptors ───────────────────────────────────────

type RequestInterceptor = (url: string, init: RequestInit) => [string, RequestInit] | Promise<[string, RequestInit]>
type ResponseInterceptor = <T>(response: ApiResponse<T>) => ApiResponse<T> | Promise<ApiResponse<T>>

const requestInterceptors: RequestInterceptor[] = []
const responseInterceptors: ResponseInterceptor[] = []

export function onRequest(fn: RequestInterceptor) {
  requestInterceptors.push(fn)
  return () => {
    const idx = requestInterceptors.indexOf(fn)
    if (idx !== -1) requestInterceptors.splice(idx, 1)
  }
}

export function onResponse(fn: ResponseInterceptor) {
  responseInterceptors.push(fn)
  return () => {
    const idx = responseInterceptors.indexOf(fn)
    if (idx !== -1) responseInterceptors.splice(idx, 1)
  }
}

// ── Toast helper ───────────────────────────────────────

function showErrorToast(message: string) {
  if (typeof shopify !== 'undefined') {
    shopify.toast.show(message, { isError: true })
  }
}

export async function getSessionTokenHeader(): Promise<Record<string, string>> {
  if (typeof shopify === 'undefined') return {}

  try {
    const token = await shopify.idToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

// ── Core request ───────────────────────────────────────

async function request<T>(method: string, config: HttpRequestConfig): Promise<T> {
  let { url } = config
  const {
    data,
    params,
    headers: extraHeaders,
    skipErrorToast,
    signal,
    timeout = APP_CONFIG.api.timeout,
    localApi = false
  } = config

  // 本 App 内部接口走相对路径；外部接口才拼 rewardsBackendAPI 前缀
  if (!localApi && !url.startsWith('http://') && !url.startsWith('https://')) {
    url = APP_CONFIG.api.rewardsBackendAPI + url
  }

  if (params) {
    const search = new URLSearchParams(params).toString()
    url += (url.includes('?') ? '&' : '?') + search
  }

  const controller = new AbortController()
  const timeoutMs = typeof timeout === 'number' && timeout > 0 ? timeout : null
  const timeoutId = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null

  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  const sessionTokenHeader = await getSessionTokenHeader()

  let init: RequestInit = {
    method,
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
      ...sessionTokenHeader,
      ...extraHeaders
    },
    ...(data !== undefined && { body: JSON.stringify(data) })
  }

  for (const interceptor of requestInterceptors) {
    ;[url, init] = await interceptor(url, init)
  }

  let res: Response
  try {
    res = await fetch(url, init)
  } catch (e) {
    if (timeoutId) clearTimeout(timeoutId)
    if (e instanceof DOMException && e.name === 'AbortError') {
      const error = timeoutMs ? new TimeoutError(timeoutMs) : new Error('Request aborted')
      if (!skipErrorToast) showErrorToast(error.message)
      throw error
    }
    throw e
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }

  if (!res.ok) {
    // 本 App 内部接口的错误体常常是 { error: '...' }，尽量取出来
    let detailMsg = ''
    if (localApi) {
      try {
        const errBody = await res.clone().json()
        if (errBody && typeof errBody === 'object' && 'error' in errBody) {
          const e = (errBody as { error: unknown }).error
          if (typeof e === 'string') detailMsg = e
          else if (e != null) detailMsg = JSON.stringify(e)
        }
      } catch {
        /* ignore */
      }
    }
    const error = new HttpError(res.status, detailMsg || res.statusText)
    if (!skipErrorToast) showErrorToast(error.message)
    throw error
  }

  // 本 App 内部接口直接返回裸 JSON，跳过 {code, message, data} 信封解析
  if (localApi) {
    try {
      return (await res.json()) as T
    } catch {
      throw new Error('Invalid JSON response')
    }
  }

  let json: ApiResponse<T>
  try {
    json = await res.json()
  } catch {
    throw new Error('Invalid JSON response')
  }

  for (const interceptor of responseInterceptors) {
    json = await interceptor(json)
  }

  if (json.code !== 200) {
    const error = new BusinessError(json.code, json.message)
    if (!skipErrorToast) showErrorToast(json.message || `Error (${json.code})`)
    throw error
  }

  return json.data
}

// ── File download ───────────────────────────────────────

async function downloadFile(config: HttpRequestConfig): Promise<void> {
  let { url } = config
  const { params, headers: extraHeaders, timeout = APP_CONFIG.api.timeout } = config

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = APP_CONFIG.api.rewardsBackendAPI + url
  }

  if (params) {
    const search = new URLSearchParams(params).toString()
    url += (url.includes('?') ? '&' : '?') + search
  }

  const controller = new AbortController()
  const timeoutMs = typeof timeout === 'number' && timeout > 0 ? timeout : null
  const timeoutId = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null

  const sessionTokenHeader = await getSessionTokenHeader()

  let res: Response
  try {
    res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { ...sessionTokenHeader, ...extraHeaders }
    })
  } catch (e) {
    if (timeoutId) clearTimeout(timeoutId)
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw timeoutMs ? new TimeoutError(timeoutMs) : new Error('Request aborted')
    }
    throw e
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }

  if (!res.ok) {
    throw new HttpError(res.status, res.statusText)
  }

  const disposition = res.headers.get('Content-Disposition') || ''
  const filenameMatch = disposition.match(/filename="?([^";\s]+)"?/)
  const filename = filenameMatch?.[1] || 'export.csv'

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

// ── Public API ─────────────────────────────────────────

export const http = {
  get<T>(config: HttpRequestConfig): Promise<T> {
    return request<T>('GET', config)
  },

  post<T>(config: HttpRequestConfig): Promise<T> {
    return request<T>('POST', config)
  },

  put<T>(config: HttpRequestConfig): Promise<T> {
    return request<T>('PUT', config)
  },

  patch<T>(config: HttpRequestConfig): Promise<T> {
    return request<T>('PATCH', config)
  },

  delete<T>(config: HttpRequestConfig): Promise<T> {
    return request<T>('DELETE', config)
  },

  downloadFile(config: HttpRequestConfig): Promise<void> {
    return downloadFile(config)
  }
}
