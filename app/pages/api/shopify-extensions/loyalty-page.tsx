import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import { authenticate, unauthenticated } from '~/shopify.server'
import { getSmileTokenForShop, SMILE_API_BASE } from '~/config'
import { EXTERNAL_API_DISABLED } from '~/config/externalApi'
import { HttpError, TimeoutError } from '~/utils/http'
import logger from '~/lib/logger.server'

/**
 * Customer Account UI Extension API — Loyalty Hub full page
 *
 * 由 customer account "page.render" 全屏扩展调用，聚合获取一个会员中心
 * 页面所需要的所有 Smile 数据（profile / VIP / 可兑奖商品 / 赚积分规则 / 积分流水）。
 *
 * Request:
 *   POST /api/shopify-extensions/loyalty-page
 *   Headers: { Authorization: `Bearer ${sessionToken}` }
 *   Body:    { kind: 'init' | 'transactions', cursor?: string, limit?: number }
 *
 * Response:
 *   200 { code: 200, data: <see InitData | TransactionsData> }
 */

const REQUEST_TIMEOUT = 30_000
const TRANSACTIONS_DEFAULT_LIMIT = 20
const TRANSACTIONS_MAX_LIMIT = 50
const POINTS_PRODUCTS_PAGE_SIZE = 50

interface SmileVipStatus {
  vip_tier_id: number | null
  vip_tier_expires_at: string | null
  progress_value: number | null
  current_vip_period_end: string | null
  delta_to_retain_vip_tier: number | null
  next_vip_tier_id: number | null
  delta_to_next_vip_tier: number | null
}

interface SmileCustomer {
  id: number
  first_name: string | null
  last_name: string | null
  email: string
  state: 'candidate' | 'member' | 'disabled'
  points_balance: number
  referral_url: string | null
  vip_status: SmileVipStatus | null
}

interface SmileCustomersResponse {
  customers: SmileCustomer[]
}

interface SmileVipTier {
  id: number
  name: string
  image_url: string
  milestone: number
}

interface SmileVipTiersResponse {
  vip_tiers: SmileVipTier[]
}

interface SmileReward {
  id: number
  name: string
  description?: string | null
  image_url?: string | null
}

interface SmilePointsProduct {
  id: number
  exchange_type: 'fixed' | 'variable'
  exchange_description: string
  points_price: number | null
  variable_points_step: number | null
  variable_points_step_reward_value: number | null
  variable_points_min: number | null
  variable_points_max: number | null
  reward: SmileReward
}

interface SmilePointsProductsResponse {
  points_products: SmilePointsProduct[]
}

interface SmileEarningRuleRewardValue {
  type: 'fixed' | 'variable'
  fixed?: {
    value: number
  }
  variable?: {
    per_amount: number
    value: number
  }
}

interface SmileEarningRule {
  id: number
  name: string
  image_url: string | null
  reward_value: SmileEarningRuleRewardValue
}

interface SmileEarningRulesResponse {
  earning_rules: SmileEarningRule[]
}

interface SmilePointsTransaction {
  id: number
  customer_id: number
  points_change: number
  description: string
  internal_note: string | null
  created_at: string
  updated_at: string
}

interface SmilePointsTransactionsResponse {
  points_transactions: SmilePointsTransaction[]
  metadata?: {
    next_cursor: string | null
    previous_cursor: string | null
  }
}

interface ShopifyCustomerNode {
  email?: string | null
  firstName?: string | null
  lastName?: string | null
}

interface ShopifyShopNode {
  name?: string | null
  primaryDomain?: { url?: string | null } | null
  currencyCode?: string | null
}

interface ShopifyCustomerQueryResponse {
  data?: {
    customer?: ShopifyCustomerNode | null
    shop?: ShopifyShopNode | null
  }
}

type RequestBody = { kind?: 'init' } | { kind: 'transactions'; cursor?: string; limit?: number }

interface InitData {
  customer: {
    id: number
    first_name: string | null
    last_name: string | null
    email: string
    points_balance: number
    referral_url: string | null
    vip_status: SmileVipStatus | null
  } | null
  shopify_customer: {
    email: string | null
    first_name: string | null
    last_name: string | null
  }
  vip_tiers: SmileVipTier[]
  points_products: SmilePointsProduct[]
  earning_rules: SmileEarningRule[]
  currencyCode: string
  storefrontUrl: string | null
}

interface TransactionsData {
  points_transactions: SmilePointsTransaction[]
  next_cursor: string | null
  previous_cursor: string | null
}

// ── Helpers ─────────────────────────────────────────────

function parseShopFromDest(dest: unknown): string | undefined {
  if (typeof dest !== 'string') return undefined
  try {
    const url = new URL(dest)
    return url.hostname
  } catch {
    return dest.replace(/^https?:\/\//, '').replace(/\/$/, '')
  }
}

async function fetchShopifyContext(
  shop: string,
  customerGid: string
): Promise<{
  email: string | null
  firstName: string | null
  lastName: string | null
  currencyCode: string
  storefrontUrl: string | null
}> {
  const { admin } = await unauthenticated.admin(shop)
  const res = await admin.graphql(
    `#graphql
      query GetLoyaltyContext($id: ID!) {
        customer(id: $id) {
          email
          firstName
          lastName
        }
        shop {
          name
          currencyCode
          primaryDomain { url }
        }
      }
    `,
    { variables: { id: customerGid } }
  )

  const json = (await res.json()) as ShopifyCustomerQueryResponse
  return {
    email: json.data?.customer?.email ?? null,
    firstName: json.data?.customer?.firstName ?? null,
    lastName: json.data?.customer?.lastName ?? null,
    currencyCode: json.data?.shop?.currencyCode ?? 'USD',
    storefrontUrl: json.data?.shop?.primaryDomain?.url ?? null
  }
}

async function smileFetch<T>(shop: string, path: string, query: Record<string, string | number> = {}): Promise<T> {
  // 外部接口调用总开关：关闭时短路 Smile 请求，返回空对象（消费方均用可选链 / ?? [] 兜底）
  if (EXTERNAL_API_DISABLED) {
    logger.warn({ module: 'external-api-disabled', shop, path }, 'Skip Smile API call')
    return {} as T
  }

  const token = getSmileTokenForShop(shop)
  const url = new URL(`${SMILE_API_BASE}${path}`)
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    url.searchParams.set(key, String(value))
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    })

    if (!res.ok) {
      const details = await res.text().catch(() => '')
      throw new HttpError(res.status, `Smile API ${res.status} ${path}`, details)
    }

    return (await res.json()) as T
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new TimeoutError(REQUEST_TIMEOUT)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

async function fetchInitData(shop: string, customerGid: string): Promise<InitData> {
  const { email, firstName, lastName, currencyCode, storefrontUrl } = await fetchShopifyContext(shop, customerGid)
  const earningRulesPromise = smileFetch<SmileEarningRulesResponse>(shop, '/earning_rules')

  if (!email) {
    const earningRulesResp = await earningRulesPromise

    return {
      customer: null,
      shopify_customer: { email, first_name: firstName, last_name: lastName },
      vip_tiers: [],
      points_products: [],
      earning_rules: earningRulesResp.earning_rules ?? [],
      currencyCode,
      storefrontUrl
    }
  }

  const [customersResp, vipTiersResp, pointsProductsResp, earningRulesResp] = await Promise.all([
    smileFetch<SmileCustomersResponse>(shop, '/customers', { email, include: 'vip_status', limit: 1 }),
    smileFetch<SmileVipTiersResponse>(shop, '/vip_tiers'),
    smileFetch<SmilePointsProductsResponse>(shop, '/points_products', { page_size: POINTS_PRODUCTS_PAGE_SIZE }),
    earningRulesPromise
  ])

  const smileCustomer = customersResp.customers?.[0] ?? null

  return {
    customer: smileCustomer
      ? {
          id: smileCustomer.id,
          first_name: smileCustomer.first_name ?? null,
          last_name: smileCustomer.last_name ?? null,
          email: smileCustomer.email,
          points_balance: smileCustomer.points_balance ?? 0,
          referral_url: smileCustomer.referral_url ?? null,
          vip_status: smileCustomer.vip_status ?? null
        }
      : null,
    shopify_customer: { email, first_name: firstName, last_name: lastName },
    vip_tiers: vipTiersResp.vip_tiers ?? [],
    points_products: pointsProductsResp.points_products ?? [],
    earning_rules: earningRulesResp.earning_rules ?? [],
    currencyCode,
    storefrontUrl
  }
}

async function fetchTransactionsData(
  shop: string,
  customerGid: string,
  cursor: string | undefined,
  limit: number
): Promise<TransactionsData> {
  const { email } = await fetchShopifyContext(shop, customerGid)
  if (!email) {
    return { points_transactions: [], next_cursor: null, previous_cursor: null }
  }

  const customersResp = await smileFetch<SmileCustomersResponse>(shop, '/customers', { email, limit: 1 })
  const smileCustomer = customersResp.customers?.[0]
  if (!smileCustomer) {
    return { points_transactions: [], next_cursor: null, previous_cursor: null }
  }

  const resp = await smileFetch<SmilePointsTransactionsResponse>(shop, '/points_transactions', {
    customer_id: smileCustomer.id,
    limit,
    cursor: cursor ?? ''
  })

  return {
    points_transactions: resp.points_transactions ?? [],
    next_cursor: resp.metadata?.next_cursor ?? null,
    previous_cursor: resp.metadata?.previous_cursor ?? null
  }
}

function clampLimit(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return TRANSACTIONS_DEFAULT_LIMIT
  return Math.min(Math.max(Math.trunc(parsed), 1), TRANSACTIONS_MAX_LIMIT)
}

// ── Route Handlers ──────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { cors } = await authenticate.public.customerAccount(request)
  return cors(Response.json({ code: 405, message: 'Use POST', data: null }, { status: 405 }))
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const log = logger.child({ module: 'customer-account-loyalty-page' })
  const { cors, sessionToken } = await authenticate.public.customerAccount(request)

  try {
    const shop = parseShopFromDest(sessionToken.dest)
    const customerGid = sessionToken.sub
    console.log('shop', shop)
    console.log('customerGid', customerGid)
    if (!shop) {
      log.warn({ dest: sessionToken.dest }, 'Session token missing shop dest')
      return cors(Response.json({ code: 401, message: 'Invalid session token', data: null }, { status: 401 }))
    }
    if (!customerGid) {
      log.warn({ shop, sub: sessionToken.sub }, 'Session token missing customer subject')
      return cors(Response.json({ code: 401, message: 'Invalid customer session', data: null }, { status: 401 }))
    }

    const body = (await request.json().catch(() => ({}))) as RequestBody
    const kind = (body as { kind?: string }).kind ?? 'init'

    if (kind === 'transactions') {
      const cursor = (body as { cursor?: string }).cursor
      const limit = clampLimit((body as { limit?: number }).limit)
      const data = await fetchTransactionsData(shop, customerGid, cursor, limit)
      log.info({ shop, customerGid, count: data.points_transactions.length }, 'Smile transactions loaded')
      return cors(Response.json({ code: 200, message: 'ok', data }))
    }

    const data = await fetchInitData(shop, customerGid)
    log.info(
      {
        shop,
        customerGid,
        hasCustomer: Boolean(data.customer),
        vipTierCount: data.vip_tiers.length,
        pointsProductCount: data.points_products.length,
        earningRuleCount: data.earning_rules.length
      },
      'Smile loyalty page init loaded'
    )
    return cors(Response.json({ code: 200, message: 'ok', data }))
  } catch (error) {
    const isTimeout = error instanceof TimeoutError
    const isHttp = error instanceof HttpError
    const status = isHttp ? error.status : isTimeout ? 504 : 500
    const message = isHttp ? error.message : isTimeout ? 'Smile API timeout' : 'Smile API request failed'

    log.error({ err: error }, 'customer-account loyalty-page request failed')

    return cors(Response.json({ code: status, message, data: null }, { status }))
  }
}
