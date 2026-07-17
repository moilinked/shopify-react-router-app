import type { LoyaltyInitData, LoyaltyTransactionsData } from './types'
import { EDITOR_LOYALTY_INIT_DATA, EDITOR_LOYALTY_TRANSACTIONS_DATA } from './editorMockData'

// 生产环境 app 后端域名（扩展脚本由 Shopify CDN 提供，需回落到固定域名）。
const PRODUCTION_BACKEND_URL = 'https://shopify.waterdropfilter.com'

// 本地 `shopify app dev` 使用的临时隧道域名（cloudflare / ngrok）。
// 这些 host 每次启动都会变化，因此运行时从扩展脚本地址动态推断，无需手改。
const DEV_TUNNEL_HOST_SUFFIXES = ['.trycloudflare.com', '.ngrok.io', '.ngrok-free.app', '.ngrok.app', '.cloudflare.com']

function isDevTunnelHost(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true
  return DEV_TUNNEL_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
}

/**
 * 解析 app 后端 base URL：
 * - 本地开发时，扩展脚本与 app 后端通过同一个临时隧道域名提供服务，
 *   直接复用 `shopify.extension.scriptUrl` 的 origin。
 * - 生产环境扩展脚本由 Shopify CDN 提供，回落到固定的生产域名。
 */
function resolveBackendUrl(): string {
  try {
    const scriptUrl = shopify.extension?.scriptUrl
    if (scriptUrl) {
      const { origin, hostname } = new URL(scriptUrl)
      if (isDevTunnelHost(hostname)) {
        return origin
      }
    }
  } catch {
    // 解析失败时回落到生产域名。
  }
  return PRODUCTION_BACKEND_URL
}

const LOYALTY_ENDPOINT = `${resolveBackendUrl()}/api/shopify-extensions/loyalty-page`

function isShopifyAdminEditorRequest(): boolean {
  return shopify.extension?.editor != null
}

interface SmileBackendEnvelope<T> {
  code: number
  message: string
  data: T | null
}

async function postJson<T>(body: Record<string, unknown>): Promise<T> {
  const token = await shopify.sessionToken.get()
  if (!token) throw new Error('Missing customer account session token')

  const res = await fetch(LOYALTY_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    throw new Error(`Loyalty backend ${res.status}`)
  }

  const json = (await res.json()) as SmileBackendEnvelope<T>
  if (json.code !== 200 || json.data == null) {
    throw new Error(json.message || 'Loyalty backend error')
  }
  return json.data
}

export function fetchLoyaltyInit(): Promise<LoyaltyInitData> {
  if (isShopifyAdminEditorRequest()) {
    return Promise.resolve(EDITOR_LOYALTY_INIT_DATA)
  }

  return postJson<LoyaltyInitData>({ kind: 'init' })
}

export function fetchLoyaltyTransactions(
  params: { cursor?: string; limit?: number } = {}
): Promise<LoyaltyTransactionsData> {
  if (isShopifyAdminEditorRequest()) {
    return Promise.resolve(EDITOR_LOYALTY_TRANSACTIONS_DATA)
  }

  return postJson<LoyaltyTransactionsData>({
    kind: 'transactions',
    cursor: params.cursor,
    limit: params.limit
  })
}
