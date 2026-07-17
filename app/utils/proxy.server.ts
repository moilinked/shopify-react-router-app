/**
 * Proxy Server Utilities
 *
 * 提供三组能力：
 *  1. External API Client — 封装对外部 API 的 HTTP 调用（超时、错误处理）
 *  2. Response Helpers    — 统一的 JSON 响应格式工具函数
 *  3. Proxy Route Factory — 快速生成 Shopify App Proxy 路由的 loader / action
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import { authenticate } from '~/shopify.server'
import { HttpError, TimeoutError } from '~/utils/http'
import type { ApiResponse } from '~/utils/http'
import { EXTERNAL_API_DISABLED } from '~/config/externalApi'
import logger from '~/lib/logger.server'
import type {
  ExternalApiConfig,
  HttpMethod,
  ExternalApiParams,
  ExternalApiError,
  ProxyRequestBody
} from '~/types/proxy'

// ════════════════════════════════════════════════════════
//  1. External API Client
// ════════════════════════════════════════════════════════

const DEFAULT_TIMEOUT = 120_000

/** GET / DELETE 不允许携带 request body */
function isBodyAllowed(method: HttpMethod): boolean {
  return method !== 'GET' && method !== 'DELETE'
}

/**
 * 创建一个可复用的外部 API 客户端。
 *
 * @example
 * const smileClient = createExternalApiClient({
 *   baseUrl: 'https://api.smile.io/v1',
 *   name: 'Smile',
 *   getHeaders: () => ({ Authorization: `Bearer ${SMILE_KEY}` }),
 * })
 * const result = await smileClient.call({ endpoint: '/members', method: 'GET' })
 */
export function createExternalApiClient(config: ExternalApiConfig) {
  const { baseUrl, name, timeout = DEFAULT_TIMEOUT, getHeaders } = config

  /** 发起 HTTP 请求并返回 JSON 响应 */
  async function call(params: ExternalApiParams) {
    const targetUrl = buildUrl(baseUrl, params)

    // 外部接口调用总开关：关闭时短路外部请求，返回空对象
    if (EXTERNAL_API_DISABLED) {
      logger.warn({ module: 'external-api-disabled', name, url: targetUrl.toString() }, 'Skip external API call')
      return {}
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(targetUrl, {
        method: params.method,
        signal: controller.signal,
        headers: { ...getHeaders(params.context), ...params.extraHeaders },
        ...(isBodyAllowed(params.method) && params.payload !== undefined
          ? { body: JSON.stringify(params.payload) }
          : {})
      })

      const data = await response.json()

      if (!response.ok) {
        throw new HttpError(response.status, `${name} ${response.status}`, data)
      }

      return data
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        throw new TimeoutError(timeout)
      }
      throw e
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /** 将任意 error 规范化为 ExternalApiError，便于统一返回给前端 */
  function toError(error: unknown): ExternalApiError {
    if (error instanceof TimeoutError) {
      return { code: 504, message: `${name} timeout`, details: null }
    }
    if (error instanceof HttpError) {
      return {
        code: error.status,
        message: error.message || `${name} request failed`,
        details: error.details ?? null
      }
    }
    if (error instanceof Error) {
      return { code: 500, message: error.message || `Unexpected ${name} error`, details: null }
    }
    return { code: 500, message: `Unexpected ${name} error`, details: null }
  }

  return { call, toError }
}

export type ExternalApiClient = ReturnType<typeof createExternalApiClient>

// ── private helpers ──────────────────────────────────────

/** 拼接 baseUrl + endpoint，并附加 query string */
function buildUrl(baseUrl: string, params: ExternalApiParams): URL {
  const url = new URL(`${baseUrl}${params.endpoint}`)

  if (params.query) {
    for (const [key, value] of Object.entries(params.query)) {
      if (value === undefined || value === null) continue
      url.searchParams.set(key, String(value))
    }
  }

  return url
}

// ════════════════════════════════════════════════════════
//  2. Response Helpers
// ════════════════════════════════════════════════════════

export type { ApiResponse }

/** 构造成功响应体 */
export function ok<T>(data: T, message = 'ok'): ApiResponse<T> {
  return { code: 200, message, data }
}

/** 构造失败响应体 */
export function fail(code: number, message: string, data: unknown = null): ApiResponse<unknown> {
  return { code, message, data }
}

/** Response.json 包装：返回成功 JSON Response */
export function jsonOk<T>(data: T, message = 'ok'): Response {
  return Response.json(ok(data, message))
}

/** Response.json 包装：返回失败 JSON Response */
export function jsonFail(code: number, message: string, data: unknown = null): Response {
  return Response.json(fail(code, message, data))
}

// ════════════════════════════════════════════════════════
//  3. Proxy Route Factory
// ════════════════════════════════════════════════════════

const IS_DEV = process.env.NODE_ENV === 'development'
const ALLOWED_METHODS: HttpMethod[] = ['GET', 'POST']

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
}

/** 开发环境下跳过 Shopify App Proxy 签名验证 */
export async function authenticateProxy(request: Request) {
  if (IS_DEV) {
    logger.warn({ module: 'proxy-auth' }, 'Skipping App Proxy auth in development')
    return
  }
  await authenticate.public.appProxy(request)
}

/** 为 Response 附加 CORS 头（仅开发环境） */
export function withCors(response: Response): Response {
  if (!IS_DEV) return response
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(key, value)
  }
  return response
}

interface ProxyRouteConfig {
  /** 允许的 endpoint 白名单（支持 '/path/*' 通配符） */
  allowedEndpoints: string[]
  /** 用于发起请求的外部 API 客户端 */
  client: ExternalApiClient
  /** 路由名称，用于日志 / 错误信息 */
  routeName: string
  /** 是否将 Shopify proxy 的查询参数作为 header 转发给后端 */
  forwardProxyParams?: boolean
}

// ── loader / action 工厂 ─────────────────────────────────

/**
 * 生成一个只读 loader，阻止 GET 直接访问并引导使用 POST。
 * App Proxy 路由必须导出 loader 以通过 Shopify 认证。
 */
export function createProxyLoader(routeName: string) {
  return async ({ request }: LoaderFunctionArgs) => {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }
    await authenticateProxy(request)
    logger.warn(
      { module: 'proxy-loader', routeName, method: request.method, path: new URL(request.url).pathname },
      'Proxy loader received non-POST request'
    )
    return withCors(jsonFail(405, `Use POST /proxy/${routeName}`))
  }
}

/**
 * 生成标准的 proxy action：
 *  1. 验证 Shopify App Proxy 签名
 *  2. 解析 & 校验请求体
 *  3. 转发到外部 API 并返回统一格式响应
 */
export function createProxyAction(config: ProxyRouteConfig) {
  return async ({ request }: ActionFunctionArgs) => {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }
    const path = new URL(request.url).pathname
    let method: HttpMethod | undefined
    let endpoint: string | undefined
    let extraHeaders: Record<string, string> | undefined
    try {
      await authenticateProxy(request)

      const url = new URL(request.url)

      const input = (await request.json()) as ProxyRequestBody
      const params = normalizeBody(input, config)
      method = params.method
      endpoint = params.endpoint
      const log = logger.child({
        module: 'proxy-action',
        routeName: config.routeName,
        method: params.method,
        endpoint: params.endpoint,
        path
      })
      log.info('Proxy action started')

      const shop = url.searchParams.get('shop') ?? undefined
      extraHeaders = config.forwardProxyParams ? { 'X-Shopify-Proxy': url.searchParams.toString() } : undefined

      const data = await config.client.call({ ...params, extraHeaders, context: { shop } })
      log.info('Proxy action completed')
      return withCors(jsonOk(data))
    } catch (error) {
      const apiError = config.client.toError(error)
      logger.error(
        {
          module: 'proxy-action',
          routeName: config.routeName,
          method,
          endpoint,
          path,
          extraHeaders,
          err: error,
          code: apiError.code
        },
        'Proxy action failed'
      )
      return withCors(jsonFail(apiError.code, apiError.message, apiError.details))
    }
  }
}

// ── request body 校验 & 规范化 ───────────────────────────

/**
 * 校验前端传入的 ProxyRequestBody，确保：
 *  - endpoint 合法且在白名单中
 *  - method 在允许范围内
 *  - pathParams 拼接到 endpoint 尾部
 */
function normalizeBody(input: ProxyRequestBody, config: ProxyRouteConfig) {
  const method = (input.method ?? 'GET').toUpperCase()
  const endpoint = input.endpoint
  const payload = input.payload

  if (!endpoint || typeof endpoint !== 'string') {
    throw new Error('`endpoint` is required')
  }
  if (!endpoint.startsWith('/')) {
    throw new Error('`endpoint` must start with "/"')
  }
  if (!ALLOWED_METHODS.includes(method as HttpMethod)) {
    throw new Error(`Unsupported method: ${method}`)
  }

  let finalEndpoint = endpoint
  if (input.pathParams) {
    const segments = Object.values(input.pathParams).map(String)
    finalEndpoint = `${endpoint}/${segments.join('/')}`
  }

  const isAllowed = config.allowedEndpoints.some((allowedPattern) => isAllowedEndpoint(finalEndpoint, allowedPattern))
  if (!isAllowed) {
    throw new Error(`Endpoint not allowed: ${finalEndpoint}`)
  }

  return {
    endpoint: finalEndpoint,
    method: method as HttpMethod,
    payload,
    query: input.query
  }
}

function isAllowedEndpoint(endpoint: string, allowedBase: string): boolean {
  if (!allowedBase.endsWith('/*')) {
    return endpoint === allowedBase
  }

  const wildcardBase = allowedBase.slice(0, -2)
  return endpoint.startsWith(`${wildcardBase}/`)
}
