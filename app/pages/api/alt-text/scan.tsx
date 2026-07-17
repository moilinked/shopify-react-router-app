import type { ActionFunctionArgs } from 'react-router'
import { authenticate } from '~/shopify.server'
import { computeSummary } from '~/services/altText.server'
import logger from '~/lib/logger.server'

/**
 * POST /api/alt-text/scan
 * 触发一次完整扫描：遍历 Shopify Files 中的所有图片，
 * 统计 totalImages / missingAlt / aiOptimized，并写回 AltTextSummary。
 *
 * 同步执行（一次扫描一般 < 30s）。如果将来量级大可改为异步 Job。
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const { admin, session } = await authenticate.admin(request)
  const log = logger.child({ module: 'alt-text-scan', shop: session.shop })

  try {
    const start = Date.now()
    const summary = await computeSummary(admin, session.shop)
    log.info({ summary, costMs: Date.now() - start }, 'Alt-text scan completed')
    return Response.json({ summary })
  } catch (error) {
    log.error({ err: error }, 'Alt-text scan failed')
    return Response.json({ error: 'Scan failed' }, { status: 500 })
  }
}
