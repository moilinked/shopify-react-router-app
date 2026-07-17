import type { LoaderFunctionArgs } from 'react-router'
import { authenticate } from '~/shopify.server'
import prisma from '~/db.server'
import logger from '~/lib/logger.server'
import { JOB_STATUSES, type JobStatus } from '~/types/altText'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

const isJobStatus = (v: string): v is JobStatus => (JOB_STATUSES as readonly string[]).includes(v)

/**
 * GET /api/alt-text/jobs
 *
 * 历史 Job 列表（时间倒序）。Query:
 *   - status: 逗号分隔 JobStatus 子集
 *   - cursor: 上一页最后一条 Job 的 id
 *   - limit: 1..MAX_LIMIT，默认 20
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request)
  const log = logger.child({ module: 'alt-text-jobs-list', shop: session.shop })

  const url = new URL(request.url)
  const cursor = url.searchParams.get('cursor') ?? undefined
  const limitRaw = Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT)
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), MAX_LIMIT) : DEFAULT_LIMIT

  const statusParam = url.searchParams.get('status')
  let statusFilter: JobStatus[] | undefined
  if (statusParam) {
    const parts = statusParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const invalid = parts.filter((s) => !isJobStatus(s))
    if (invalid.length > 0) {
      return Response.json({ error: `Invalid status: ${invalid.join(', ')}` }, { status: 400 })
    }
    statusFilter = parts as JobStatus[]
  }

  try {
    const jobs = await prisma.altTextJob.findMany({
      where: {
        shop: session.shop,
        ...(statusFilter ? { status: { in: statusFilter } } : {})
      },
      select: {
        id: true,
        type: true,
        status: true,
        source: true,
        language: true,
        total: true,
        processed: true,
        failed: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {})
    })

    const hasMore = jobs.length > limit
    const page = hasMore ? jobs.slice(0, limit) : jobs
    const pendingReviewByJob = new Map<string, number>()

    if (page.length > 0) {
      const pendingReviewCounts = await prisma.altTextItem.groupBy({
        by: ['jobId'],
        where: {
          shop: session.shop,
          jobId: { in: page.map((j) => j.id) },
          status: 'READY_FOR_REVIEW'
        },
        _count: { _all: true }
      })

      for (const row of pendingReviewCounts) {
        pendingReviewByJob.set(row.jobId, row._count._all)
      }
    }

    return Response.json({
      jobs: page.map((j) => ({
        ...j,
        pendingReview: pendingReviewByJob.get(j.id) ?? 0,
        createdAt: j.createdAt.toISOString(),
        updatedAt: j.updatedAt.toISOString()
      })),
      pageInfo: { hasMore, nextCursor: hasMore ? page[page.length - 1].id : null }
    })
  } catch (error) {
    log.error({ err: error }, 'Failed to load jobs list')
    return Response.json({ error: 'Failed to load jobs' }, { status: 500 })
  }
}
