import type { ActionFunctionArgs } from 'react-router'
import { authenticate } from '~/shopify.server'
import prisma from '~/db.server'
import logger from '~/lib/logger.server'

/**
 * POST /api/alt-text/items/:id/reject
 *
 * 拒绝某条 item，将状态置为 REJECTED。
 * 仅允许从 READY_FOR_REVIEW / EDITED 转入；APPLIED 不允许撤销
 * （撤销已写到 Shopify 的 alt 不属于本接口职责，需另开"恢复"路径）。
 */
export const action = async ({ request, params }: ActionFunctionArgs) => {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const { session } = await authenticate.admin(request)
  const log = logger.child({ module: 'alt-text-item-reject', shop: session.shop })

  const id = params.id
  if (!id) return Response.json({ error: 'item id is required' }, { status: 400 })

  try {
    const result = await prisma.altTextItem.updateMany({
      where: {
        id,
        shop: session.shop,
        status: { in: ['READY_FOR_REVIEW', 'EDITED'] }
      },
      data: { status: 'REJECTED', reviewedAt: new Date() }
    })

    if (result.count === 0) {
      const exists = await prisma.altTextItem.findFirst({
        where: { id, shop: session.shop },
        select: { status: true }
      })
      if (!exists) return Response.json({ error: 'Item not found' }, { status: 404 })
      return Response.json({ error: `Item is in status ${exists.status} and cannot be rejected` }, { status: 409 })
    }

    log.info({ itemId: id }, 'Item rejected')
    return Response.json({ ok: true })
  } catch (error) {
    log.error({ err: error, itemId: id }, 'Failed to reject item')
    return Response.json({ error: 'Failed to reject item' }, { status: 500 })
  }
}
