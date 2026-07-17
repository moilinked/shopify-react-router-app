import type { LoaderFunctionArgs } from 'react-router'
import { authenticate } from '~/shopify.server'
import { getSummary } from '~/services/altText.server'
import logger from '~/lib/logger.server'

/**
 * GET /api/alt-text/summary
 * 返回当前店铺的图片摘要（不触发扫描，仅读 AltTextSummary 表）
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request)
  const log = logger.child({ module: 'alt-text-summary', shop: session.shop })

  try {
    const summary = await getSummary(session.shop)
    return Response.json({ summary })
  } catch (error) {
    log.error({ err: error }, 'Failed to load alt-text summary')
    return Response.json({ error: 'Failed to load summary' }, { status: 500 })
  }
}
