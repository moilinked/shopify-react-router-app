import type { ActionFunctionArgs } from 'react-router'
import { authenticate } from '~/shopify.server'
import prisma from '~/db.server'
import logger from '~/lib/logger.server'
import { ALT_TEXT_JOB_TIMEOUT_MIN } from '~/config/altText.server'
import { maybeFinalizeJob } from '~/services/altText.jobs.server'
import { chunkBatches, dispatchToN8n, type N8nDispatchItem } from '~/services/n8n.server'
import type { ResourceType } from '~/types/altText'

/**
 * POST /api/alt-text/jobs/:id/retry-failed
 *
 * 批量重试该 Job 中所有 status=FAILED 的 items。
 * - 复用 Job 上落库的 language / prompt / brand / keywords / includeProductTitle
 * - 计数处理：与单条 retry 同款"先撤销旧失败计数 → 派发 → 失败回滚"逻辑，但用 batch 量
 * - 已结束生成阶段的 Job (REVIEWING/SUCCEEDED/PARTIAL/FAILED) 拉回 RUNNING，等待回调或 sweeper 重新 finalize
 * - 派发以 ALT_TEXT_BATCH_SIZE 切批；任一 batch 派发失败只回滚该 batch 内 items 的状态/计数，
 *   其它 batch 已成功派发的不受影响
 *
 * 返回：{ retried: number, dispatchedBatches: number, failedToDispatch: number }
 */
export const action = async ({ request, params }: ActionFunctionArgs) => {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const { session } = await authenticate.admin(request)
  const log = logger.child({ module: 'alt-text-job-retry-failed', shop: session.shop })

  const jobId = params.id
  if (!jobId) return Response.json({ error: 'job id is required' }, { status: 400 })

  const job = await prisma.altTextJob.findFirst({
    where: { id: jobId, shop: session.shop },
    select: {
      id: true,
      language: true,
      prompt: true,
      brand: true,
      keywords: true,
      includeProductTitle: true
    }
  })
  if (!job) return Response.json({ error: 'Job not found' }, { status: 404 })

  const failedItems = await prisma.altTextItem.findMany({
    where: { jobId: job.id, shop: session.shop, status: 'FAILED' },
    select: {
      id: true,
      imageUrl: true,
      resourceType: true,
      parentTitle: true
    }
  })

  if (failedItems.length === 0) {
    return Response.json({ retried: 0, dispatchedBatches: 0, failedToDispatch: 0, message: '当前任务没有失败条目' })
  }

  const url = new URL(request.url)
  const callbackUrl = `https://${url.host}/webhooks/n8n/alt-text`

  // 一次性把这一批 FAILED items 撤回 → GENERATING + 清错；同步把 Job 计数撤回，终态 Job 拉回 RUNNING
  const ids = failedItems.map((it) => it.id)
  const timeoutAt = new Date(Date.now() + ALT_TEXT_JOB_TIMEOUT_MIN * 60_000)
  const claimed = await prisma.$transaction(async (tx) => {
    const updated = await tx.altTextItem.updateMany({
      where: { id: { in: ids }, shop: session.shop, status: 'FAILED' },
      data: { status: 'GENERATING', errorMessage: null }
    })
    if (updated.count !== ids.length) return false

    await tx.altTextJob.update({
      where: { id: job.id },
      data: { processed: { decrement: ids.length }, failed: { decrement: ids.length }, timeoutAt }
    })
    await tx.altTextJob.updateMany({
      where: { id: job.id, status: { in: ['REVIEWING', 'SUCCEEDED', 'PARTIAL', 'FAILED'] } },
      data: { status: 'RUNNING', errorMessage: null }
    })

    return true
  })

  if (!claimed) {
    return Response.json(
      { error: 'Some failed items were already retried or changed status. Please refresh and try again.' },
      { status: 409 }
    )
  }

  const dispatchItems: N8nDispatchItem[] = failedItems.map((it) => ({
    itemId: it.id,
    imageUrl: it.imageUrl,
    context: {
      resourceType: it.resourceType as ResourceType,
      ...(job.includeProductTitle && it.parentTitle ? { productTitle: it.parentTitle } : {})
    }
  }))

  const batches = chunkBatches(dispatchItems)
  let dispatchedBatches = 0
  let failedToDispatch = 0

  for (const batch of batches) {
    const batchIds = batch.map((b) => b.itemId)
    try {
      await dispatchToN8n({
        jobId: job.id,
        shop: session.shop,
        callbackUrl,
        language: job.language,
        promptOverride: job.prompt,
        includeProductTitle: job.includeProductTitle,
        brand: job.brand?.trim() ?? '',
        keywords: job.keywords?.trim() ?? '',
        items: batch
      })
      dispatchedBatches++
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      log.error({ err, count: batchIds.length }, 'Batch retry-dispatch failed, rolling back this batch')
      failedToDispatch += batchIds.length

      // 仅回滚本 batch：把 items 还原 FAILED + 把对应计数补回去
      await prisma.$transaction([
        prisma.altTextItem.updateMany({
          where: { id: { in: batchIds }, status: 'GENERATING' },
          data: { status: 'FAILED', errorMessage }
        }),
        prisma.altTextJob.update({
          where: { id: job.id },
          data: { processed: { increment: batchIds.length }, failed: { increment: batchIds.length } }
        })
      ])
    }
  }

  if (failedToDispatch > 0) {
    await maybeFinalizeJob(job.id)
  }

  log.info(
    { jobId: job.id, retried: ids.length, dispatchedBatches, failedToDispatch },
    'Batch retry of failed items dispatched'
  )

  return Response.json({
    retried: ids.length - failedToDispatch,
    dispatchedBatches,
    failedToDispatch
  })
}
