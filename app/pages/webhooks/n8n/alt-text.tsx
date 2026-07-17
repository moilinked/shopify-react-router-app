import type { ActionFunctionArgs } from 'react-router'
import logger from '~/lib/logger.server'
import { processCallback, type N8nCallbackResult } from '~/services/altText.jobs.server'

interface RawCallbackBody {
  jobId?: string
  results?: unknown
}

const isString = (v: unknown): v is string => typeof v === 'string'

const parseResults = (raw: unknown): N8nCallbackResult[] => {
  if (!Array.isArray(raw)) return []
  const out: N8nCallbackResult[] = []
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    if (!isString(o.itemId)) continue
    const status = o.status === 'ok' ? 'ok' : 'error'
    out.push({
      itemId: o.itemId,
      status,
      altText: isString(o.altText) ? o.altText : null,
      errorMessage: isString(o.errorMessage) ? o.errorMessage : null,
      executionId: isString(o.executionId) ? o.executionId : null
    })
  }
  return out
}

/**
 * POST /webhooks/n8n/alt-text
 *
 * n8n 工作流回调入口。**v1 不做鉴权**，依赖部署网络隔离 / IP 白名单；
 * v2 接入共享 token + HMAC 签名校验，详见
 * docs/AI替代文本功能技术方案.md §6.3 / §15。
 *
 * 幂等：
 *  - 单条 item 仅在 status ∈ {PENDING, GENERATING} 时被更新，重复回调直接 skip
 *  - 未知 jobId 返回 200（避免 n8n 死循环重试堵队列），日志记录
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const log = logger.child({ module: 'alt-text-callback' })

  let body: RawCallbackBody
  try {
    body = (await request.json()) as RawCallbackBody
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!isString(body.jobId)) {
    return Response.json({ error: 'jobId is required' }, { status: 400 })
  }

  const results = parseResults(body.results)
  if (results.length === 0) {
    log.warn({ jobId: body.jobId }, 'Callback received with empty/invalid results')
    return Response.json({ ok: 0, failed: 0, skipped: 0 })
  }

  try {
    const stats = await processCallback({ jobId: body.jobId, results })
    return Response.json(stats)
  } catch (err) {
    log.error({ err, jobId: body.jobId }, 'Failed to process n8n callback')
    return Response.json({ error: 'Failed to process callback' }, { status: 500 })
  }
}
