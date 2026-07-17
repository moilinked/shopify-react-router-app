/**
 * AI 替代文本"二次确认应用"服务层
 *
 * 职责：把已审核（READY_FOR_REVIEW / EDITED）的 Item 通过 Shopify
 * `fileUpdate` 写回；按 FILE_UPDATE_BATCH_SIZE 切批 + 批间 sleep 防限流。
 *
 * **强制守卫**：仅 `status ∈ {READY_FOR_REVIEW, EDITED}` 的 item 会被写回；
 * 其它状态（含 APPLIED/REJECTED/FAILED/PENDING/GENERATING）一律静默忽略。
 *
 * 详细设计见 docs/AI替代文本功能技术方案.md §5.4 / §7.2 / §9
 */

import type { authenticate } from '~/shopify.server'
import prisma from '~/db.server'
import logger from '~/lib/logger.server'
import { FILE_UPDATE_BATCH_SIZE, FILE_UPDATE_BATCH_SLEEP_MS } from '~/config/altText.server'
import { APPLYABLE_ITEM_STATUSES, type ItemStatus } from '~/types/altText'

type AdminClient = Awaited<ReturnType<typeof authenticate.admin>>['admin']

const FILE_UPDATE_MUTATION = `#graphql
  mutation FileUpdate($files: [FileUpdateInput!]!) {
    fileUpdate(files: $files) {
      files { id alt }
      userErrors { field message code }
    }
  }
`

interface FileUpdateResponse {
  data?: {
    fileUpdate?: {
      files?: Array<{ id: string; alt: string | null } | null>
      userErrors?: Array<{ field?: string[] | null; message: string; code?: string | null }>
    }
  }
}

export interface ApplyResult {
  itemId: string
  ok: boolean
  error?: string
}

export interface ApplyStats {
  success: number
  failed: number
  skipped: number
  results: ApplyResult[]
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * 选出最终要写到 Shopify 的 alt 值：用户编辑过用 editedAlt，否则 generatedAlt。
 * 两者都为空则返回 null（apply 时会被过滤）。
 */
const finalAlt = (it: { editedAlt: string | null; generatedAlt: string | null }) => {
  const v = (it.editedAlt ?? it.generatedAlt ?? '').trim()
  return v || null
}

/**
 * 批量写回 Alt 到 Shopify。
 *
 * 流程：
 * 1. DB 查 item，强制 status ∈ APPLYABLE_ITEM_STATUSES（不在白名单的直接 skipped）
 * 2. 按 FILE_UPDATE_BATCH_SIZE 切批，每批调一次 fileUpdate
 * 3. 根据 userErrors / files 对每个 item 写状态：APPLIED / FAILED
 * 4. 批间 sleep FILE_UPDATE_BATCH_SLEEP_MS 防限流
 */
export async function applyItems(admin: AdminClient, shop: string, itemIds: string[]): Promise<ApplyStats> {
  const log = logger.child({ module: 'alt-text-apply', shop })

  if (itemIds.length === 0) {
    return { success: 0, failed: 0, skipped: 0, results: [] }
  }

  // 1. 强校验：只取处于可应用状态的 item
  const items = await prisma.altTextItem.findMany({
    where: {
      id: { in: itemIds },
      shop,
      status: { in: APPLYABLE_ITEM_STATUSES as unknown as ItemStatus[] }
    },
    select: {
      id: true,
      resourceId: true,
      generatedAlt: true,
      editedAlt: true
    }
  })

  const validMap = new Map(items.map((i) => [i.id, i]))
  const skippedIds = itemIds.filter((id) => !validMap.has(id))
  const results: ApplyResult[] = skippedIds.map((id) => ({
    itemId: id,
    ok: false,
    error: 'Item not in applyable status'
  }))

  if (items.length === 0) {
    log.warn({ requested: itemIds.length }, 'No applyable items, skip all')
    return { success: 0, failed: 0, skipped: skippedIds.length, results }
  }

  // 2. 切批
  const batches: (typeof items)[] = []
  for (let i = 0; i < items.length; i += FILE_UPDATE_BATCH_SIZE) {
    batches.push(items.slice(i, i + FILE_UPDATE_BATCH_SIZE))
  }

  let success = 0
  let failed = 0

  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi]
    const batchResults = await applyBatch(admin, shop, batch)
    for (const r of batchResults) {
      results.push(r)
      if (r.ok) success++
      else failed++
    }

    if (bi < batches.length - 1 && FILE_UPDATE_BATCH_SLEEP_MS > 0) {
      await sleep(FILE_UPDATE_BATCH_SLEEP_MS)
    }
  }

  log.info(
    { requested: itemIds.length, success, failed, skipped: skippedIds.length, batches: batches.length },
    'Apply finished'
  )

  return { success, failed, skipped: skippedIds.length, results }
}

/**
 * 单批 fileUpdate 调用 + 状态落库。
 *
 * userErrors 里的 field 形如 ["files", "0", "id"]，可定位到具体 item；
 * 没有 field 索引信息的 userError 视为整批失败。
 */
async function applyBatch(
  admin: AdminClient,
  shop: string,
  batch: Array<{ id: string; resourceId: string; generatedAlt: string | null; editedAlt: string | null }>
): Promise<ApplyResult[]> {
  const log = logger.child({ module: 'alt-text-apply-batch', shop, count: batch.length })

  // 准备 mutation 输入；alt 为空的本批 item 直接标 FAILED 不发请求
  const validIdx: number[] = []
  const filesInput: Array<{ id: string; alt: string }> = []
  const localFailed: ApplyResult[] = []

  for (let i = 0; i < batch.length; i++) {
    const item = batch[i]
    const alt = finalAlt(item)
    if (!alt) {
      localFailed.push({ itemId: item.id, ok: false, error: 'No alt to apply' })
      continue
    }
    filesInput.push({ id: item.resourceId, alt })
    validIdx.push(i)
  }

  // 把本地失败的直接落库（appliedAt 仅在写回成功时更新，失败保持 null）
  if (localFailed.length > 0) {
    const ids = localFailed.map((r) => r.itemId)
    await prisma.altTextItem.updateMany({
      where: { id: { in: ids }, shop, status: { in: APPLYABLE_ITEM_STATUSES as unknown as ItemStatus[] } },
      data: { status: 'FAILED', errorMessage: 'No alt to apply' }
    })
  }

  if (filesInput.length === 0) return localFailed

  // 调 Shopify
  let resp: FileUpdateResponse
  try {
    const res = await admin.graphql(FILE_UPDATE_MUTATION, { variables: { files: filesInput } })
    resp = (await res.json()) as FileUpdateResponse
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    log.error({ err }, 'fileUpdate request failed')

    // 整批失败：本批所有 item 标 FAILED（不写 appliedAt：fileUpdate 没成功）
    const ids = validIdx.map((i) => batch[i].id)
    await prisma.altTextItem.updateMany({
      where: { id: { in: ids }, shop, status: { in: APPLYABLE_ITEM_STATUSES as unknown as ItemStatus[] } },
      data: { status: 'FAILED', errorMessage }
    })
    return [...localFailed, ...ids.map((id) => ({ itemId: id, ok: false, error: errorMessage }))]
  }

  const userErrors = resp.data?.fileUpdate?.userErrors ?? []
  const updatedFiles = (resp.data?.fileUpdate?.files ?? []).filter(
    (f): f is { id: string; alt: string | null } => f !== null
  )
  const updatedFileIds = new Set(updatedFiles.map((f) => f.id))

  // 把 userErrors 按索引归到具体 item；无 field 索引信息的视为全批错误
  const errorByIdx = new Map<number, string>()
  let batchLevelError: string | null = null
  for (const ue of userErrors) {
    const idxStr = ue.field?.[1]
    const idxNum = idxStr != null ? Number(idxStr) : NaN
    if (Number.isFinite(idxNum) && idxNum >= 0 && idxNum < filesInput.length) {
      const itemIdx = validIdx[idxNum]
      const prev = errorByIdx.get(itemIdx)
      errorByIdx.set(itemIdx, prev ? `${prev}; ${ue.message}` : ue.message)
    } else {
      batchLevelError = batchLevelError ? `${batchLevelError}; ${ue.message}` : ue.message
    }
  }

  // 写状态
  const now = new Date()
  const remoteResults: ApplyResult[] = []
  const successIds: string[] = []
  const successAltMap = new Map<string, string>()
  const failedUpdates: Array<{ id: string; error: string }> = []

  for (let i = 0; i < validIdx.length; i++) {
    const itemIdx = validIdx[i]
    const item = batch[itemIdx]
    const altApplied = finalAlt(item)!
    const indivErr = errorByIdx.get(itemIdx)

    if (indivErr) {
      failedUpdates.push({ id: item.id, error: indivErr })
      remoteResults.push({ itemId: item.id, ok: false, error: indivErr })
      continue
    }

    if (batchLevelError) {
      failedUpdates.push({ id: item.id, error: batchLevelError })
      remoteResults.push({ itemId: item.id, ok: false, error: batchLevelError })
      continue
    }

    if (!updatedFileIds.has(item.resourceId)) {
      const err = 'fileUpdate did not return this file'
      failedUpdates.push({ id: item.id, error: err })
      remoteResults.push({ itemId: item.id, ok: false, error: err })
      continue
    }

    successIds.push(item.id)
    successAltMap.set(item.id, altApplied)
    remoteResults.push({ itemId: item.id, ok: true })
  }

  if (successIds.length > 0) {
    // 单条 update：需要把 appliedAlt 各自写到对应 row（updateMany 不支持多值）
    await prisma.$transaction(
      successIds.map((id) =>
        prisma.altTextItem.update({
          where: { id },
          data: {
            status: 'APPLIED',
            appliedAlt: successAltMap.get(id)!,
            appliedAt: now,
            reviewedAt: now,
            errorMessage: null
          }
        })
      )
    )
  }

  if (failedUpdates.length > 0) {
    // 同 message 合并 updateMany，最多分组数有限
    const byMsg = new Map<string, string[]>()
    for (const f of failedUpdates) {
      const arr = byMsg.get(f.error) ?? []
      arr.push(f.id)
      byMsg.set(f.error, arr)
    }
    await prisma.$transaction(
      Array.from(byMsg.entries()).map(([errorMessage, ids]) =>
        prisma.altTextItem.updateMany({
          where: { id: { in: ids }, shop, status: { in: APPLYABLE_ITEM_STATUSES as unknown as ItemStatus[] } },
          data: {
            status: 'FAILED',
            errorMessage: errorMessage.slice(0, 500)
            // 不写 appliedAt：fileUpdate 这条没成功
          }
        })
      )
    )
  }

  return [...localFailed, ...remoteResults]
}
