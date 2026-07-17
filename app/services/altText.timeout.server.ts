/**
 * AI 替代文本 Job 超时清理
 *
 * 场景：n8n 长时间未回调（n8n 节点宕机、回调网络丢失等），
 *      Item 永久卡在 GENERATING 会让前端轮询永远不会结束。
 *
 * 策略：每 60s 扫一次过期 Job
 *  - 把仍在 GENERATING/PENDING 的 Item 标记 FAILED + 'Job timed out'
 *  - 重新跑 finalize 逻辑，把 Job 推到 FAILED / REVIEWING
 *
 * v1 简化为单进程内 setInterval；多副本部署时改用外部 cron 或调度服务。
 */

import prisma from '~/db.server'
import logger from '~/lib/logger.server'

const SWEEP_INTERVAL_MS = 60_000
const TIMEOUT_ERROR = 'Job timed out (no n8n callback)'

let started = false

/**
 * 启动一次性的全局超时清理任务（幂等）。
 *
 * 应在服务端入口被引用一次（例如 root.tsx 的 server-only import 或某个
 * 在每个请求都会被加载的 *.server.ts 模块）。
 */
export function startAltTextTimeoutSweeper() {
  if (started) return
  if (typeof process === 'undefined' || !process.versions?.node) return
  started = true

  const log = logger.child({ module: 'alt-text-timeout-sweeper' })
  log.info({ intervalMs: SWEEP_INTERVAL_MS }, 'Alt-text timeout sweeper started')

  const tick = async () => {
    try {
      await sweepOnce()
    } catch (err) {
      log.error({ err }, 'Sweeper tick failed')
    }
  }

  // 启动后立即跑一次，避免冷启 60s 的盲区
  void tick()
  const handle = setInterval(() => {
    void tick()
  }, SWEEP_INTERVAL_MS)

  // 不阻止 Node 进程退出
  if (typeof handle === 'object' && handle !== null && 'unref' in handle) {
    ;(handle as unknown as { unref: () => void }).unref()
  }
}

/**
 * 单次清理。导出仅为方便单测/手动触发，正常路径走 setInterval。
 */
export async function sweepOnce() {
  const log = logger.child({ module: 'alt-text-timeout-sweeper' })
  const now = new Date()

  const overdueJobs = await prisma.altTextJob.findMany({
    where: {
      status: { in: ['PENDING', 'RUNNING'] },
      timeoutAt: { not: null, lt: now }
    },
    select: { id: true, shop: true, total: true, processed: true, failed: true }
  })

  if (overdueJobs.length === 0) return

  for (const job of overdueJobs) {
    try {
      const timedOutCount = await prisma.$transaction(async (tx) => {
        const updated = await tx.altTextItem.updateMany({
          where: {
            jobId: job.id,
            status: { in: ['PENDING', 'GENERATING'] }
          },
          data: { status: 'FAILED', errorMessage: TIMEOUT_ERROR }
        })

        if (updated.count > 0) {
          await tx.altTextJob.update({
            where: { id: job.id },
            data: {
              processed: { increment: updated.count },
              failed: { increment: updated.count }
            }
          })
        }

        return updated.count
      })

      // finalize：根据最新计数决定 FAILED/REVIEWING
      const fresh = await prisma.altTextJob.findUnique({
        where: { id: job.id },
        select: { total: true, processed: true, failed: true, status: true }
      })
      if (!fresh) continue
      if (fresh.processed < fresh.total) {
        // 仍有 item 没结案（理论上不会出现，安全起见标 FAILED 兜底）
        await prisma.altTextJob.update({
          where: { id: job.id },
          data: { status: 'FAILED', errorMessage: TIMEOUT_ERROR }
        })
      } else {
        const next: 'REVIEWING' | 'FAILED' = fresh.failed === fresh.total ? 'FAILED' : 'REVIEWING'
        await prisma.altTextJob.update({
          where: { id: job.id },
          data: { status: next, errorMessage: next === 'REVIEWING' ? null : TIMEOUT_ERROR }
        })
      }

      log.warn({ jobId: job.id, shop: job.shop, stuck: timedOutCount }, 'Sweeper finalized overdue job')
    } catch (err) {
      log.error({ err, jobId: job.id }, 'Failed to finalize overdue job')
    }
  }
}
