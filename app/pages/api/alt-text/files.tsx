import type { ActionFunctionArgs } from 'react-router'
import { authenticate } from '~/shopify.server'
import { scanFilesByFilter } from '~/services/altText.server'
import logger from '~/lib/logger.server'
import { FILES_FILTERS, type FilesFilter } from '~/types/altText'

interface FilesRequestBody {
  filter?: FilesFilter
}

const isFilesFilter = (v: unknown): v is FilesFilter =>
  typeof v === 'string' && (FILES_FILTERS as readonly string[]).includes(v)

/**
 * POST /api/alt-text/files
 * 按筛选条件拉取 Shopify Files 中的图片候选数据，对应 UI「Files 图片」按钮。
 *
 * Body:
 *   - filter: 'all' | 'missing-alt' | 'ai-optimized'
 *
 * 注意：服务端基于 alt 字段做 trim 判空，不依赖 Shopify GraphQL query 的 alt 过滤
 *      （后者在多版本 Admin API 上行为不一致，详见 §5.2）。
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const { admin, session } = await authenticate.admin(request)
  const log = logger.child({ module: 'alt-text-files', shop: session.shop })

  let body: FilesRequestBody
  try {
    body = (await request.json()) as FilesRequestBody
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { filter } = body
  if (!isFilesFilter(filter)) {
    return Response.json(
      { error: `Invalid filter: ${String(filter)} (expected one of ${FILES_FILTERS.join(', ')})` },
      { status: 400 }
    )
  }

  try {
    const start = Date.now()
    const images = await scanFilesByFilter(admin, session.shop, filter)
    log.info({ filter, count: images.length, costMs: Date.now() - start }, 'Alt-text files fetched')
    return Response.json({ images })
  } catch (error) {
    log.error({ err: error, filter }, 'Failed to fetch alt-text files')
    return Response.json({ error: 'Failed to fetch files' }, { status: 500 })
  }
}
