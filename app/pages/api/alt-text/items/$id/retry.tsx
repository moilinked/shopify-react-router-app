import type { ActionFunctionArgs } from 'react-router'
import { authenticate } from '~/shopify.server'
import prisma from '~/db.server'
import logger from '~/lib/logger.server'
import { ALT_TEXT_JOB_TIMEOUT_MIN } from '~/config/altText.server'
import { maybeFinalizeJob } from '~/services/altText.jobs.server'
import { dispatchToN8n } from '~/services/n8n.server'

/**
 * POST /api/alt-text/items/:id/retry
 *
 * 重新派发一个 FAILED 状态的 item 到 n8n。
 * - 仅 status === FAILED 的 item 可重试
 * - 重试沿用原 Job 的 language / prompt / brand / keywords / includeProductTitle / callbackUrl
 *
 * 计数处理（修正 v1 早期 bug，避免 retry 后 Job 计数发散）：
 *   - 重试前先 `processed -1, failed -1`（撤销原失败计数 + 把"已结案"权重交还）
 *   - 派发成功后等 n8n 回调；回调里 `processCallback` 会再做 `processed/failed +1`
 *   - 派发失败回滚 item.status=FAILED，**同步把计数 +1 还原**，保持收支平衡
 *   - 如果 Job 已结束生成阶段（REVIEWING/PARTIAL/FAILED/SUCCEEDED），把 Job 状态拉回 RUNNING，
 *     等 sweeper 或新回调重新 finalize
 */
export const action = async ({ request, params }: ActionFunctionArgs) => {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const { session } = await authenticate.admin(request)
  const log = logger.child({ module: 'alt-text-item-retry', shop: session.shop })

  const id = params.id
  if (!id) return Response.json({ error: 'item id is required' }, { status: 400 })

  const item = await prisma.altTextItem.findFirst({
    where: { id, shop: session.shop },
    select: {
      id: true,
      jobId: true,
      imageUrl: true,
      resourceType: true,
      parentTitle: true,
      status: true
    }
  })

  if (!item) return Response.json({ error: 'Item not found' }, { status: 404 })
  if (item.status !== 'FAILED') {
    return Response.json({ error: `Item is in status ${item.status} and cannot be retried` }, { status: 409 })
  }

  const job = await prisma.altTextJob.findFirst({
    where: { id: item.jobId, shop: session.shop },
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

  const url = new URL(request.url)
  const callbackUrl = `https://${url.host}/webhooks/n8n/alt-text`
  const timeoutAt = new Date(Date.now() + ALT_TEXT_JOB_TIMEOUT_MIN * 60_000)

  // 先把 item 改为 GENERATING + 清错误；同时把 Job 计数从"已结案"撤回，
  // 避免回调再次 increment 后 processed > total。
  // 终态 Job 拉回 RUNNING，并刷新 timeoutAt，等回调或 sweeper 重新 finalize。
  const claimed = await prisma.$transaction(async (tx) => {
    const updated = await tx.altTextItem.updateMany({
      where: { id: item.id, shop: session.shop, status: 'FAILED' },
      data: { status: 'GENERATING', errorMessage: null }
    })
    if (updated.count === 0) return false

    await tx.altTextJob.update({
      where: { id: job.id },
      data: { processed: { decrement: 1 }, failed: { decrement: 1 }, timeoutAt }
    })
    await tx.altTextJob.updateMany({
      where: { id: job.id, status: { in: ['REVIEWING', 'SUCCEEDED', 'PARTIAL', 'FAILED'] } },
      data: { status: 'RUNNING', errorMessage: null }
    })

    return true
  })

  if (!claimed) {
    return Response.json({ error: 'Item is no longer in FAILED status' }, { status: 409 })
  }

  try {
    await dispatchToN8n({
      jobId: job.id,
      shop: session.shop,
      callbackUrl,
      language: job.language,
      promptOverride: job.prompt,
      includeProductTitle: job.includeProductTitle,
      // retry 完整复用用户当时输入的 brand / keywords（落库在 AltTextJob）
      brand: job.brand?.trim() ?? '',
      keywords: job.keywords?.trim() ?? '',
      items: [
        {
          itemId: item.id,
          imageUrl: item.imageUrl,
          context: {
            resourceType: item.resourceType as 'PRODUCT_IMAGE' | 'FILE_MEDIA_IMAGE' | 'FILE_GENERIC',
            ...(job.includeProductTitle && item.parentTitle ? { productTitle: item.parentTitle } : {})
          }
        }
      ]
    })
    log.info({ itemId: item.id, jobId: job.id }, 'Item retry dispatched')
    return Response.json({ ok: true })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    log.error({ err, itemId: item.id }, 'Item retry dispatch failed')
    // 派发直接失败：把 item 还原为 FAILED，并把上面 decrement 的计数补回
    await prisma.$transaction([
      prisma.altTextItem.update({
        where: { id: item.id },
        data: { status: 'FAILED', errorMessage }
      }),
      prisma.altTextJob.update({
        where: { id: job.id },
        data: { processed: { increment: 1 }, failed: { increment: 1 } }
      })
    ])
    await maybeFinalizeJob(job.id)
    return Response.json({ error: errorMessage }, { status: 500 })
  }
}
