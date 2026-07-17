import type { LoaderFunctionArgs } from 'react-router'
import { authenticate } from '~/shopify.server'
import prisma from '~/db.server'
import logger from '~/lib/logger.server'
import { ITEM_STATUSES, type ItemStatus } from '~/types/altText'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

const isItemStatus = (v: string): v is ItemStatus => (ITEM_STATUSES as readonly string[]).includes(v)

/**
 * GET /api/alt-text/jobs/:id/items
 *
 * Query:
 *   - status: 逗号分隔的 ItemStatus 子集，缺省返回全部
 *   - cursor: 上一页最后一条 item 的 id（基于 id 游标，避免 offset 性能问题）
 *   - limit: 1..MAX_LIMIT，默认 50
 *
 * 安全：强制 shop 匹配。
 */
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request)
  const log = logger.child({ module: 'alt-text-job-items', shop: session.shop })

  const jobId = params.id
  if (!jobId) return Response.json({ error: 'job id is required' }, { status: 400 })

  const url = new URL(request.url)
  const cursor = url.searchParams.get('cursor') ?? undefined
  const limitRaw = Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT)
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), MAX_LIMIT) : DEFAULT_LIMIT

  const statusParam = url.searchParams.get('status')
  let statusFilter: ItemStatus[] | undefined
  if (statusParam) {
    const parts = statusParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const invalid = parts.filter((s) => !isItemStatus(s))
    if (invalid.length > 0) {
      return Response.json({ error: `Invalid status: ${invalid.join(', ')}` }, { status: 400 })
    }
    statusFilter = parts as ItemStatus[]
  }

  try {
    const job = await prisma.altTextJob.findFirst({
      where: { id: jobId, shop: session.shop },
      select: { id: true }
    })
    if (!job) return Response.json({ error: 'Job not found' }, { status: 404 })

    const items = await prisma.altTextItem.findMany({
      where: {
        jobId,
        shop: session.shop,
        ...(statusFilter ? { status: { in: statusFilter } } : {})
      },
      select: {
        id: true,
        resourceType: true,
        resourceId: true,
        parentId: true,
        parentTitle: true,
        imageUrl: true,
        thumbnailUrl: true,
        originalAlt: true,
        generatedAlt: true,
        editedAlt: true,
        appliedAlt: true,
        status: true,
        errorMessage: true,
        language: true,
        generatedAt: true,
        reviewedAt: true,
        appliedAt: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { id: 'asc' },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {})
    })

    const hasMore = items.length > limit
    const page = hasMore ? items.slice(0, limit) : items

    return Response.json({
      items: page.map((it) => ({
        ...it,
        generatedAt: it.generatedAt?.toISOString() ?? null,
        reviewedAt: it.reviewedAt?.toISOString() ?? null,
        appliedAt: it.appliedAt?.toISOString() ?? null,
        createdAt: it.createdAt.toISOString(),
        updatedAt: it.updatedAt.toISOString()
      })),
      pageInfo: {
        hasMore,
        nextCursor: hasMore ? page[page.length - 1].id : null
      }
    })
  } catch (error) {
    log.error({ err: error, jobId }, 'Failed to load job items')
    return Response.json({ error: 'Failed to load items' }, { status: 500 })
  }
}
