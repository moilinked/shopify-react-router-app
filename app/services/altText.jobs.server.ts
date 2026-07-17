/**
 * AI 替代文本 Job/Item 生命周期管理
 *
 * 职责：
 * - 创建 GENERATE Job + 批量插入 Item（status=PENDING）
 * - 异步切批派发 n8n（不 await，立即返回 jobId 给前端）
 * - 处理 n8n 回调，更新 Item 状态 + Job 进度
 *
 * 详细设计见 docs/AI替代文本功能技术方案.md §6
 */

import prisma from '~/db.server'
import logger from '~/lib/logger.server'
import { ALT_TEXT_JOB_TIMEOUT_MIN } from '~/config/altText.server'
import type { ResourceType } from '~/types/altText'
import { chunkBatches, dispatchToN8n, type N8nDispatchItem } from './n8n.server'

// ── 类型 ───────────────────────────────────────────────

export interface CreateGenerateJobInput {
  shop: string
  language: string
  includeProductTitle: boolean
  prompt?: string | null
  /** 用户在生成弹窗输入的品牌名（弹窗默认 'Waterdrop'，用户可改/可清；为 null 表示用户清空了） */
  brand?: string | null
  /** 用户在生成弹窗输入的本批 SEO 关键词；无系统默认值，留空就传空串 */
  keywords?: string | null
  source: string
  callbackUrl: string
  createdBy?: string | null
  items: Array<{
    resourceType: ResourceType
    resourceId: string
    parentId?: string | null
    parentTitle?: string | null
    imageUrl: string
    thumbnailUrl?: string | null
    originalAlt?: string | null
  }>
}

export interface N8nCallbackResult {
  itemId: string
  status: 'ok' | 'error'
  altText?: string | null
  errorMessage?: string | null
  executionId?: string | null
}

export interface N8nCallbackPayload {
  jobId: string
  results: N8nCallbackResult[]
}

// ── 创建 Job ───────────────────────────────────────────

/**
 * 创建一个 GENERATE Job，并把所有候选图片插入 AltTextItem(status=PENDING)。
 *
 * 同一资源在同一 Job 内只能存在一条，依赖 schema 中
 * `@@unique([shop, resourceId, jobId])` 在并发情况下兜底；
 * 上层调用前已做去重，正常路径不会触发冲突。
 */
export async function createGenerateJob(input: CreateGenerateJobInput) {
  if (input.items.length === 0) {
    throw new Error('createGenerateJob: items must not be empty')
  }

  const timeoutAt = new Date(Date.now() + ALT_TEXT_JOB_TIMEOUT_MIN * 60_000)

  const job = await prisma.altTextJob.create({
    data: {
      shop: input.shop,
      type: 'GENERATE',
      status: 'PENDING',
      source: input.source,
      language: input.language,
      prompt: input.prompt ?? null,
      brand: input.brand ?? null,
      keywords: input.keywords ?? null,
      includeProductTitle: input.includeProductTitle,
      total: input.items.length,
      processed: 0,
      failed: 0,
      createdBy: input.createdBy ?? null,
      timeoutAt,
      items: {
        create: input.items.map((it) => ({
          shop: input.shop,
          resourceType: it.resourceType,
          resourceId: it.resourceId,
          parentId: it.parentId ?? null,
          parentTitle: it.parentTitle ?? null,
          imageUrl: it.imageUrl,
          thumbnailUrl: it.thumbnailUrl ?? null,
          originalAlt: it.originalAlt ?? null,
          status: 'PENDING',
          language: input.language
        }))
      }
    },
    include: { items: true }
  })

  return job
}

// ── 异步派发（fire-and-forget） ─────────────────────────

/**
 * 异步切批派发到 n8n。**调用方不应 await 这个函数**——
 * 前端期望 generate 接口立即返回 jobId。
 *
 * 内部错误均被吞并，只反映在 Item.status=FAILED + errorMessage。
 */
export function dispatchJobAsync(args: {
  jobId: string
  shop: string
  language: string
  includeProductTitle: boolean
  prompt?: string | null
  /** 用户在生成弹窗输入的品牌名（v1.4 新增；空串/null 都直接透传给 n8n，不再后端兜底） */
  brand?: string | null
  /** 用户在生成弹窗输入的关键词（v1.4 新增；空串/null 都直接透传给 n8n，不再后端兜底） */
  keywords?: string | null
  callbackUrl: string
}): void {
  // 显式不 await，但要捕获异步异常防止 unhandled rejection
  void runDispatch(args).catch((err) => {
    logger.error(
      { err, jobId: args.jobId, shop: args.shop, module: 'alt-text-job' },
      'Unexpected error in dispatchJobAsync'
    )
  })
}

async function runDispatch(args: {
  jobId: string
  shop: string
  language: string
  includeProductTitle: boolean
  prompt?: string | null
  brand?: string | null
  keywords?: string | null
  callbackUrl: string
}) {
  const log = logger.child({ module: 'alt-text-dispatch', jobId: args.jobId, shop: args.shop })

  // 把 Job 标记为 RUNNING（如果还在 PENDING）
  await prisma.altTextJob.updateMany({
    where: { id: args.jobId, status: 'PENDING' },
    data: { status: 'RUNNING' }
  })

  const items = await prisma.altTextItem.findMany({
    where: { jobId: args.jobId, status: 'PENDING' },
    select: {
      id: true,
      imageUrl: true,
      resourceType: true,
      parentTitle: true
    }
  })

  if (items.length === 0) {
    log.warn('No PENDING items to dispatch')
    return
  }

  const dispatchItems: N8nDispatchItem[] = items.map((it) => ({
    itemId: it.id,
    imageUrl: it.imageUrl,
    context: {
      resourceType: it.resourceType as ResourceType,
      ...(args.includeProductTitle && it.parentTitle ? { productTitle: it.parentTitle } : {})
    }
  }))

  const batches = chunkBatches(dispatchItems)
  log.info({ total: dispatchItems.length, batches: batches.length }, 'Start n8n dispatch')

  for (const batch of batches) {
    const ids = batch.map((b) => b.itemId)

    // 先把这一批 items 标记为 GENERATING，便于幂等回调判断
    await prisma.altTextItem.updateMany({
      where: { id: { in: ids }, status: 'PENDING' },
      data: { status: 'GENERATING' }
    })

    try {
      await dispatchToN8n({
        jobId: args.jobId,
        shop: args.shop,
        callbackUrl: args.callbackUrl,
        language: args.language,
        promptOverride: args.prompt ?? null,
        includeProductTitle: args.includeProductTitle,
        brand: args.brand?.trim() ?? '',
        keywords: args.keywords?.trim() ?? '',
        items: batch
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      log.error({ err, count: ids.length }, 'Batch dispatch failed, marking items FAILED')

      await prisma.$transaction([
        prisma.altTextItem.updateMany({
          where: { id: { in: ids }, status: 'GENERATING' },
          data: { status: 'FAILED', errorMessage }
        }),
        prisma.altTextJob.update({
          where: { id: args.jobId },
          data: { failed: { increment: ids.length }, processed: { increment: ids.length } }
        })
      ])

      await maybeFinalizeJob(args.jobId)
    }
  }
}

// ── 回调处理 ───────────────────────────────────────────

/**
 * 处理 n8n 回调。幂等：仅更新 status 为 GENERATING/PENDING 的 item，
 * 重复回调不会破坏已完成/已应用的状态。
 *
 * 返回处理统计，便于路由层日志/响应。
 */
export async function processCallback(payload: N8nCallbackPayload) {
  const log = logger.child({ module: 'alt-text-callback', jobId: payload.jobId })

  const job = await prisma.altTextJob.findUnique({
    where: { id: payload.jobId },
    select: { id: true, shop: true, status: true }
  })
  if (!job) {
    log.warn('Callback for unknown jobId')
    return { ok: 0, failed: 0, skipped: payload.results.length, unknown: true }
  }

  let ok = 0
  let failed = 0
  let skipped = 0

  for (const r of payload.results) {
    if (!r.itemId) {
      skipped++
      continue
    }

    const updated = await applySingleResult(job.id, r)
    if (updated === 'ok') ok++
    else if (updated === 'failed') failed++
    else skipped++
  }

  if (ok + failed > 0) {
    await prisma.altTextJob.update({
      where: { id: job.id },
      data: {
        processed: { increment: ok + failed },
        failed: { increment: failed }
      }
    })
  }

  await maybeFinalizeJob(job.id)

  log.info({ ok, failed, skipped, total: payload.results.length }, 'Callback applied')
  return { ok, failed, skipped, unknown: false }
}

/**
 * 单条结果落库。返回：
 *  - 'ok'      → 状态从 GENERATING/PENDING 转 READY_FOR_REVIEW
 *  - 'failed'  → 状态从 GENERATING/PENDING 转 FAILED
 *  - 'skipped' → 不在可写状态（重复回调或已被人工处理），忽略
 */
async function applySingleResult(jobId: string, r: N8nCallbackResult): Promise<'ok' | 'failed' | 'skipped'> {
  if (r.status === 'ok') {
    const alt = (r.altText ?? '').trim()
    if (!alt) {
      // n8n 返回 ok 但 altText 为空，按失败处理
      const res = await prisma.altTextItem.updateMany({
        where: { id: r.itemId, jobId, status: { in: ['GENERATING', 'PENDING'] } },
        data: { status: 'FAILED', errorMessage: 'n8n returned empty altText', generatedAt: new Date() }
      })
      return res.count > 0 ? 'failed' : 'skipped'
    }

    const res = await prisma.altTextItem.updateMany({
      where: { id: r.itemId, jobId, status: { in: ['GENERATING', 'PENDING'] } },
      data: {
        status: 'READY_FOR_REVIEW',
        generatedAlt: alt,
        n8nExecutionId: r.executionId ?? null,
        generatedAt: new Date(),
        errorMessage: null
      }
    })
    return res.count > 0 ? 'ok' : 'skipped'
  }

  // status === 'error'
  const res = await prisma.altTextItem.updateMany({
    where: { id: r.itemId, jobId, status: { in: ['GENERATING', 'PENDING'] } },
    data: {
      status: 'FAILED',
      errorMessage: r.errorMessage?.slice(0, 500) ?? 'n8n error',
      n8nExecutionId: r.executionId ?? null,
      generatedAt: new Date()
    }
  })
  return res.count > 0 ? 'failed' : 'skipped'
}

/**
 * 当 processed >= total 时，把 Job 从生成阶段推到下一阶段：
 *  - failed === total → FAILED
 *  - 存在成功生成条目  → REVIEWING（等待人工审核/应用）
 *
 * 并发安全：用 `updateMany` + status 守卫，重复回调同时落到这里时只有一条会真正写。
 */
export async function maybeFinalizeJob(jobId: string) {
  const job = await prisma.altTextJob.findUnique({
    where: { id: jobId },
    select: { total: true, processed: true, failed: true, status: true }
  })
  if (!job) return
  if (job.status !== 'RUNNING' && job.status !== 'PENDING') return
  if (job.processed < job.total) return

  const next: 'REVIEWING' | 'FAILED' = job.failed === job.total ? 'FAILED' : 'REVIEWING'

  await prisma.altTextJob.updateMany({
    where: { id: jobId, status: { in: ['RUNNING', 'PENDING'] } },
    data: { status: next }
  })
}
