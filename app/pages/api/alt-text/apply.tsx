import type { ActionFunctionArgs } from 'react-router'
import { authenticate } from '~/shopify.server'
import logger from '~/lib/logger.server'
import { applyItems } from '~/services/altText.apply.server'

interface ApplyBody {
  itemIds?: unknown
  /**
   * 前端二次确认 modal 生成的随机 nonce。
   * 服务端不强校验内容（v1），仅记录到日志做审计；v2 可以做一次性 token 校验。
   */
  confirmationNonce?: unknown
}

const MAX_BATCH = 1000

/**
 * POST /api/alt-text/apply
 *
 * 二次确认应用：把已审核（READY_FOR_REVIEW / EDITED）的 item 写回 Shopify Files。
 *
 * 强制守卫：服务层 `applyItems` 内部 WHERE status ∈ {READY_FOR_REVIEW, EDITED}，
 * 不在白名单的 item 一律 skipped；前端 modal 二次确认 + DB 守卫 = 三重保障。
 *
 * 详细设计见 docs/AI替代文本功能技术方案.md §7.2 / §11
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const { admin, session } = await authenticate.admin(request)
  const log = logger.child({ module: 'alt-text-apply', shop: session.shop })

  let body: ApplyBody
  try {
    body = (await request.json()) as ApplyBody
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!Array.isArray(body.itemIds) || body.itemIds.length === 0) {
    return Response.json({ error: 'itemIds must be a non-empty array' }, { status: 400 })
  }
  if (body.itemIds.length > MAX_BATCH) {
    return Response.json({ error: `Too many items in one request (max ${MAX_BATCH})` }, { status: 400 })
  }
  if (!body.itemIds.every((v): v is string => typeof v === 'string')) {
    return Response.json({ error: 'itemIds must be string[]' }, { status: 400 })
  }
  const itemIds: string[] = Array.from(new Set(body.itemIds))

  const nonce = typeof body.confirmationNonce === 'string' ? body.confirmationNonce : null
  if (!nonce) {
    log.warn({ count: itemIds.length }, 'Apply called without confirmationNonce')
  }

  try {
    const start = Date.now()
    const stats = await applyItems(admin, session.shop, itemIds)
    log.info(
      {
        requested: itemIds.length,
        success: stats.success,
        failed: stats.failed,
        skipped: stats.skipped,
        nonce,
        costMs: Date.now() - start
      },
      'Apply completed'
    )
    return Response.json(stats)
  } catch (error) {
    log.error({ err: error, count: itemIds.length }, 'Apply failed')
    return Response.json({ error: 'Apply failed' }, { status: 500 })
  }
}
