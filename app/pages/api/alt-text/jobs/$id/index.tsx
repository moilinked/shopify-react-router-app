import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import { authenticate } from '~/shopify.server'
import prisma from '~/db.server'
import logger from '~/lib/logger.server'

/**
 * GET /api/alt-text/jobs/:id
 * 返回 Job 进度，供前端轮询（5s 间隔）。
 *
 * 安全：强制 shop 匹配，避免跨店读取。
 */
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request)
  const log = logger.child({ module: 'alt-text-job-progress', shop: session.shop })

  const id = params.id
  if (!id) return Response.json({ error: 'job id is required' }, { status: 400 })

  try {
    const job = await prisma.altTextJob.findFirst({
      where: { id, shop: session.shop },
      select: {
        id: true,
        type: true,
        status: true,
        source: true,
        language: true,
        total: true,
        processed: true,
        failed: true,
        prompt: true,
        includeProductTitle: true,
        errorMessage: true,
        timeoutAt: true,
        createdAt: true,
        updatedAt: true
      }
    })

    if (!job) return Response.json({ error: 'Job not found' }, { status: 404 })

    const pendingReview = await prisma.altTextItem.count({
      where: { shop: session.shop, jobId: job.id, status: 'READY_FOR_REVIEW' }
    })

    return Response.json({
      job: {
        ...job,
        pendingReview,
        timeoutAt: job.timeoutAt?.toISOString() ?? null,
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString()
      }
    })
  } catch (error) {
    log.error({ err: error, jobId: id }, 'Failed to load job progress')
    return Response.json({ error: 'Failed to load job' }, { status: 500 })
  }
}

/**
 * DELETE /api/alt-text/jobs/:id
 * 删除历史 Job 及其关联条目。
 */
export const action = async ({ request, params }: ActionFunctionArgs) => {
  if (request.method !== 'DELETE') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const { session } = await authenticate.admin(request)
  const log = logger.child({ module: 'alt-text-job-delete', shop: session.shop })

  const id = params.id
  if (!id) return Response.json({ error: 'job id is required' }, { status: 400 })

  try {
    const job = await prisma.altTextJob.findFirst({
      where: { id, shop: session.shop },
      select: { id: true }
    })

    if (!job) return Response.json({ error: 'Job not found' }, { status: 404 })

    const result = await prisma.$transaction(async (tx) => {
      const items = await tx.altTextItem.deleteMany({
        where: { jobId: job.id, shop: session.shop }
      })
      const jobs = await tx.altTextJob.deleteMany({
        where: { id: job.id, shop: session.shop }
      })

      return { deletedJobs: jobs.count, deletedItems: items.count }
    })

    log.info({ jobId: id, ...result }, 'Alt-text job deleted')
    return Response.json({ ok: true, ...result })
  } catch (error) {
    log.error({ err: error, jobId: id }, 'Failed to delete job')
    return Response.json({ error: 'Failed to delete job' }, { status: 500 })
  }
}
