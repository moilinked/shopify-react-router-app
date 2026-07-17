import type { ActionFunctionArgs } from 'react-router'
import { authenticate } from '~/shopify.server'
import logger from '~/lib/logger.server'
import { ALT_TEXT_DEFAULT_LANG, isSupportedLanguage } from '~/config/altText.server'
import { RESOURCE_TYPES, type ResourceType } from '~/types/altText'
import { createGenerateJob, dispatchJobAsync } from '~/services/altText.jobs.server'

interface GenerateItemInput {
  resourceType?: string
  resourceId?: string
  parentId?: string | null
  parentTitle?: string | null
  imageUrl?: string
  thumbnailUrl?: string | null
  originalAlt?: string | null
}

interface GenerateRequestBody {
  language?: string
  includeProductTitle?: boolean
  prompt?: string | null
  /** 用户在生成弹窗输入的品牌名（弹窗默认 Waterdrop，可改/可清；空串/缺失/null 都直传 n8n） */
  brand?: string | null
  /** 本批 SEO 关键词（无系统默认；空串/缺失/null 都直传 n8n） */
  keywords?: string | null
  source?: string
  items?: GenerateItemInput[]
}

const isResourceType = (v: unknown): v is ResourceType =>
  typeof v === 'string' && (RESOURCE_TYPES as readonly string[]).includes(v)

/**
 * POST /api/alt-text/generate
 *
 * 创建 GENERATE Job + 异步派发 n8n。立即返回 jobId 给前端，
 * 前端跳到 review 页轮询 /api/alt-text/jobs/$id（PR-4 实现）。
 *
 * 详见 docs/AI替代文本功能技术方案.md §7.2
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const { session } = await authenticate.admin(request)
  const log = logger.child({ module: 'alt-text-generate', shop: session.shop })

  let body: GenerateRequestBody
  try {
    body = (await request.json()) as GenerateRequestBody
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // ── 入参校验 ────────────────────────────────────────
  const language = isSupportedLanguage(body.language) ? body.language : ALT_TEXT_DEFAULT_LANG
  const includeProductTitle = body.includeProductTitle !== false // 默认 true
  const prompt = typeof body.prompt === 'string' && body.prompt.trim() ? body.prompt.trim() : null
  const brand = typeof body.brand === 'string' && body.brand.trim() ? body.brand.trim() : null
  const keywords = typeof body.keywords === 'string' && body.keywords.trim() ? body.keywords.trim() : null
  const source = typeof body.source === 'string' && body.source ? body.source : 'unknown'

  const rawItems = Array.isArray(body.items) ? body.items : []
  if (rawItems.length === 0) {
    return Response.json({ error: 'items must be a non-empty array' }, { status: 400 })
  }

  const items: Parameters<typeof createGenerateJob>[0]['items'] = []
  const seen = new Set<string>()
  for (const it of rawItems) {
    if (!isResourceType(it.resourceType)) {
      return Response.json({ error: `Invalid resourceType: ${String(it.resourceType)}` }, { status: 400 })
    }
    if (typeof it.resourceId !== 'string' || !it.resourceId) {
      return Response.json({ error: 'resourceId is required' }, { status: 400 })
    }
    if (typeof it.imageUrl !== 'string' || !it.imageUrl) {
      return Response.json({ error: `imageUrl missing for ${it.resourceId}` }, { status: 400 })
    }
    // 同一 resourceId 在一个请求里去重，避免触发 unique 约束
    if (seen.has(it.resourceId)) continue
    seen.add(it.resourceId)

    items.push({
      resourceType: it.resourceType,
      resourceId: it.resourceId,
      parentId: it.parentId ?? null,
      parentTitle: it.parentTitle ?? null,
      imageUrl: it.imageUrl,
      thumbnailUrl: it.thumbnailUrl ?? null,
      originalAlt: it.originalAlt ?? null
    })
  }

  // ── 构造回调 URL（n8n 用同源 webhooks 路径回调本 App） ──
  const url = new URL(request.url)
  const callbackUrl = `https://${url.host}/webhooks/n8n/alt-text`

  // ── 落库 + 派发 ─────────────────────────────────────
  try {
    const job = await createGenerateJob({
      shop: session.shop,
      language,
      includeProductTitle,
      prompt,
      brand,
      keywords,
      source,
      callbackUrl,
      createdBy: session.onlineAccessInfo?.associated_user?.email ?? null,
      items
    })

    log.info(
      {
        jobId: job.id,
        total: job.total,
        language,
        source,
        withPrompt: !!prompt,
        withBrand: !!brand,
        withKeywords: !!keywords
      },
      'Generate job created'
    )

    // 注意：不 await，立即返回；内部异常自吞并落到 Item.status=FAILED
    dispatchJobAsync({
      jobId: job.id,
      shop: session.shop,
      language,
      includeProductTitle,
      prompt,
      brand,
      keywords,
      callbackUrl
    })

    return Response.json({ jobId: job.id, total: job.total })
  } catch (error) {
    log.error({ err: error }, 'Failed to create generate job')
    return Response.json({ error: 'Failed to create job' }, { status: 500 })
  }
}
