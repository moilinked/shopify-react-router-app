import type { ActionFunctionArgs } from 'react-router'
import { authenticate } from '~/shopify.server'
import prisma from '~/db.server'
import logger from '~/lib/logger.server'
import { EDITABLE_ITEM_STATUSES, type ItemStatus } from '~/types/altText'

interface PatchBody {
  editedAlt?: string
}

const MAX_ALT_LEN = 512

/**
 * PATCH /api/alt-text/items/:id
 *
 * Body: { editedAlt: string }
 *
 * 行为：
 *   - 若当前 status ∈ {READY_FOR_REVIEW, EDITED} → 写 editedAlt + status=EDITED
 *   - 若当前 status === APPLIED → 写 editedAlt + status=EDITED（再次编辑后需重新走 apply 才生效）
 *   - 其它状态（PENDING/GENERATING/FAILED/REJECTED）拒绝
 */
export const action = async ({ request, params }: ActionFunctionArgs) => {
  if (request.method !== 'PATCH') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const { session } = await authenticate.admin(request)
  const log = logger.child({ module: 'alt-text-item-edit', shop: session.shop })

  const id = params.id
  if (!id) return Response.json({ error: 'item id is required' }, { status: 400 })

  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (typeof body.editedAlt !== 'string') {
    return Response.json({ error: 'editedAlt must be a string' }, { status: 400 })
  }

  const editedAlt = body.editedAlt.trim()
  if (!editedAlt) {
    return Response.json({ error: 'editedAlt must not be empty' }, { status: 400 })
  }
  if (editedAlt.length > MAX_ALT_LEN) {
    return Response.json({ error: `editedAlt exceeds ${MAX_ALT_LEN} chars` }, { status: 400 })
  }

  try {
    const result = await prisma.altTextItem.updateMany({
      where: {
        id,
        shop: session.shop,
        status: { in: EDITABLE_ITEM_STATUSES as unknown as ItemStatus[] }
      },
      data: { status: 'EDITED', editedAlt }
    })

    if (result.count === 0) {
      // 区分"不存在" vs "状态不允许"
      const exists = await prisma.altTextItem.findFirst({
        where: { id, shop: session.shop },
        select: { status: true }
      })
      if (!exists) return Response.json({ error: 'Item not found' }, { status: 404 })
      return Response.json({ error: `Item is in status ${exists.status} and cannot be edited` }, { status: 409 })
    }

    log.info({ itemId: id, len: editedAlt.length }, 'Item edited')
    return Response.json({ ok: true })
  } catch (error) {
    log.error({ err: error, itemId: id }, 'Failed to edit item')
    return Response.json({ error: 'Failed to edit item' }, { status: 500 })
  }
}
