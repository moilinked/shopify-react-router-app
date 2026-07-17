import type { LoaderFunctionArgs } from 'react-router'
import { authenticate } from '~/shopify.server'
import prisma from '~/db.server'
import logger from '~/lib/logger.server'

/**
 * GET /api/alt-text/jobs/summary
 * 返回当前店铺历史操作条目统计。
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request)
  const log = logger.child({ module: 'alt-text-jobs-summary', shop: session.shop })

  try {
    const counts = await prisma.altTextItem.groupBy({
      by: ['status'],
      where: {
        shop: session.shop,
        status: { in: ['READY_FOR_REVIEW', 'FAILED'] }
      },
      _count: { _all: true }
    })

    let pendingReview = 0
    let failed = 0
    for (const row of counts) {
      if (row.status === 'READY_FOR_REVIEW') pendingReview = row._count._all
      if (row.status === 'FAILED') failed = row._count._all
    }

    return Response.json({ stats: { pendingReview, failed } })
  } catch (error) {
    log.error({ err: error }, 'Failed to load alt-text jobs summary')
    return Response.json({ error: 'Failed to load jobs summary' }, { status: 500 })
  }
}
