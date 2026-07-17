/**
 * n8n 工作流客户端
 *
 * 职责：
 * - 把一批待生成的 AltTextItem 推送给 n8n webhook
 * - v1 不做鉴权（依赖内部网络隔离）；v2 再补 X-Auth-Token / HMAC，详见
 *   docs/AI替代文本功能技术方案.md §6
 */

import { ALT_TEXT_BATCH_SIZE, ALT_TEXT_N8N, N8N_DISPATCH_TIMEOUT_MS } from '~/config/altText.server'
import { EXTERNAL_API_DISABLED } from '~/config/externalApi'
import logger from '~/lib/logger.server'
import type { ResourceType } from '~/types/altText'

export interface N8nDispatchItem {
  itemId: string
  imageUrl: string
  context: {
    resourceType: ResourceType
    productTitle?: string
  }
}

export interface N8nDispatchPayload {
  jobId: string
  shop: string
  callbackUrl: string
  language: string
  promptOverride: string | null
  includeProductTitle: boolean
  /** 店铺品牌名，注入 n8n OpenAI prompt 的 {{ brand }} 占位符 */
  brand: string
  /** 本批 SEO 关键词（用户可在生成弹窗自定义；为空时由调用方填充店铺默认值） */
  keywords: string
  items: N8nDispatchItem[]
}

/**
 * 切批工具：默认按 ALT_TEXT_BATCH_SIZE 切分。
 */
export function chunkBatches<T>(arr: T[], size = ALT_TEXT_BATCH_SIZE): T[][] {
  if (size <= 0) throw new Error('chunk size must be > 0')
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * 派发一批 items 到 n8n webhook。
 *
 * 失败时抛错，由调用方负责把 items 标记为 FAILED 并记录 errorMessage。
 */
export async function dispatchToN8n(payload: N8nDispatchPayload): Promise<void> {
  const { webhookUrl } = ALT_TEXT_N8N
  if (!webhookUrl) {
    throw new Error('N8N webhook URL is not configured')
  }

  const log = logger.child({ module: 'n8n-dispatch', jobId: payload.jobId, shop: payload.shop })
  const start = Date.now()

  // 外部接口调用总开关：关闭时不派发到 n8n，直接返回（items 保持待处理，由调用方兜底）
  if (EXTERNAL_API_DISABLED) {
    log.warn({ count: payload.items.length }, '[external-api-disabled] skip n8n dispatch')
    return
  }

  // 加超时保护：n8n hung 住时不让整个派发流程一起 hung，让 sweeper 兜底反而要等 30min
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), N8N_DISPATCH_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      log.error({ count: payload.items.length, timeoutMs: N8N_DISPATCH_TIMEOUT_MS }, 'n8n dispatch timeout')
      throw new Error(`n8n dispatch timeout after ${N8N_DISPATCH_TIMEOUT_MS}ms`)
    }
    log.error({ err, count: payload.items.length }, 'n8n dispatch network error')
    throw err
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    log.error(
      { status: res.status, body: text.slice(0, 500), count: payload.items.length },
      'n8n dispatch returned non-2xx'
    )
    throw new Error(`n8n dispatch failed: ${res.status} ${res.statusText}`)
  }

  log.info({ count: payload.items.length, costMs: Date.now() - start }, 'n8n dispatch ok')
}
