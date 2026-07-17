/**
 * AI 替代文本（Alt Text）服务层
 *
 * 职责：
 * - 与 Shopify Admin GraphQL 交互，拉取商品/Files 中的图片
 * - 计算店铺图片摘要并写入 AltTextSummary 表
 *
 * 详细设计见 docs/AI替代文本功能技术方案.md §5
 */

import type { authenticate } from '~/shopify.server'
import prisma from '~/db.server'
import logger from '~/lib/logger.server'
import type { CandidateImage, CandidateProduct, FilesFilter } from '~/types/altText'

type AdminClient = Awaited<ReturnType<typeof authenticate.admin>>['admin']

// ── GraphQL ───────────────────────────────────────────────

const PRODUCTS_WITH_IMAGES_QUERY = `#graphql
  query ProductsWithImages($cursor: String, $query: String) {
    products(first: 50, after: $cursor, query: $query) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        title
        handle
        media(first: 100, query: "media_type:IMAGE") {
          nodes {
            ... on MediaImage {
              id
              alt
              image { url width height }
            }
          }
        }
      }
    }
  }
`

const PRODUCTS_BY_IDS_QUERY = `#graphql
  query ProductsByIds($ids: [ID!]!) {
    nodes(ids: $ids) {
      __typename
      ... on Product {
        id
        title
        media(first: 100, query: "media_type:IMAGE") {
          nodes {
            ... on MediaImage {
              id
              alt
              image { url width height }
            }
          }
        }
      }
    }
  }
`

const COLLECTION_PRODUCTS_QUERY = `#graphql
  query CollectionProducts($id: ID!, $cursor: String) {
    collection(id: $id) {
      products(first: 50, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          title
          media(first: 100, query: "media_type:IMAGE") {
            nodes {
              ... on MediaImage {
                id
                alt
                image { url width height }
              }
            }
          }
        }
      }
    }
  }
`

const FILES_QUERY = `#graphql
  query AllFiles($cursor: String, $query: String!) {
    files(first: 100, after: $cursor, query: $query) {
      pageInfo { hasNextPage endCursor }
      nodes {
        __typename
        ... on MediaImage {
          id
          alt
          image { url width height }
          fileStatus
          createdAt
        }
        ... on GenericFile {
          id
          alt
          url
          mimeType
          createdAt
        }
      }
    }
  }
`

// ── 内部类型 ───────────────────────────────────────────────

interface MediaImageNode {
  __typename?: 'MediaImage'
  id: string
  alt: string | null
  image?: { url: string; width?: number; height?: number } | null
  fileStatus?: string
  createdAt?: string
}

interface GenericFileNode {
  __typename: 'GenericFile'
  id: string
  alt: string | null
  url: string
  mimeType?: string
  createdAt?: string
}

type FileNode = MediaImageNode | GenericFileNode

interface ProductNode {
  __typename?: 'Product'
  id: string
  title: string
  media?: { nodes: MediaImageNode[] }
}

interface PageInfo {
  hasNextPage: boolean
  endCursor: string | null
}

interface ProductsListResponse {
  data?: {
    products?: {
      pageInfo: PageInfo
      nodes: ProductNode[]
    }
  }
}

interface ProductsByIdsResponse {
  data?: {
    nodes?: Array<ProductNode | null>
  }
}

interface CollectionProductsResponse {
  data?: {
    collection?: {
      products?: {
        pageInfo: PageInfo
        nodes: ProductNode[]
      }
    }
  }
}

interface FilesResponse {
  data?: {
    files?: {
      pageInfo: PageInfo
      nodes: FileNode[]
    }
  }
}

const isAltEmpty = (alt: string | null | undefined) => (alt ?? '').trim() === ''
const USED_IMAGE_FILES_QUERY = 'media_type:IMAGE -used_in:none'

const isSvgMimeType = (mimeType: string | null | undefined) =>
  mimeType?.split(';')[0].trim().toLowerCase() === 'image/svg+xml'

const isSvgUrl = (url: string | null | undefined) => {
  if (!url) return false
  try {
    return new URL(url).pathname.toLowerCase().endsWith('.svg')
  } catch {
    return url.split('?')[0].toLowerCase().endsWith('.svg')
  }
}

const isSvgFileNode = (node: FileNode, isMediaImage: boolean) => {
  if (isMediaImage) return isSvgUrl((node as MediaImageNode).image?.url)

  const generic = node as GenericFileNode
  return isSvgMimeType(generic.mimeType) || isSvgUrl(generic.url)
}

const productNodeToCandidate = (p: ProductNode): CandidateProduct => {
  const images = (p.media?.nodes ?? [])
    .filter((m): m is MediaImageNode & { image: { url: string } } => !!m?.image?.url)
    .map<CandidateImage>((m) => ({
      id: m.id,
      url: m.image.url,
      alt: m.alt ?? null,
      resourceType: 'PRODUCT_IMAGE'
    }))

  return {
    id: p.id,
    title: p.title,
    totalImages: images.length,
    imagesWithAlt: images.filter((i) => !isAltEmpty(i.alt)).length,
    images
  }
}

// ── 商品拉取 ───────────────────────────────────────────────

/**
 * 拉取所有商品 + 每个商品的全部图片（带分页）
 * 对应 UI「添加所有商品」按钮。
 */
export async function scanAllProducts(admin: AdminClient): Promise<CandidateProduct[]> {
  const out: CandidateProduct[] = []
  let cursor: string | null = null

  do {
    const res = await admin.graphql(PRODUCTS_WITH_IMAGES_QUERY, { variables: { cursor } })
    const json = (await res.json()) as ProductsListResponse
    const data = json.data?.products
    if (!data) break

    for (const p of data.nodes) {
      out.push(productNodeToCandidate(p))
    }

    cursor = data.pageInfo.hasNextPage ? data.pageInfo.endCursor : null
  } while (cursor)

  return out
}

/**
 * 按 ID 拉取部分商品 + 图片（用于 ResourcePicker 返回的选择）
 * 对应 UI「搜索商品」按钮。
 */
export async function getProductsByIds(admin: AdminClient, ids: string[]): Promise<CandidateProduct[]> {
  if (ids.length === 0) return []

  const res = await admin.graphql(PRODUCTS_BY_IDS_QUERY, { variables: { ids } })
  const json = (await res.json()) as ProductsByIdsResponse
  const nodes = json.data?.nodes ?? []

  return nodes.filter((p): p is ProductNode => p?.__typename === 'Product').map(productNodeToCandidate)
}

/**
 * 按系列 ID 拉取系列下所有商品 + 图片
 * 对应 UI「按系列添加」按钮。
 */
export async function getProductsByCollections(
  admin: AdminClient,
  collectionIds: string[]
): Promise<CandidateProduct[]> {
  if (collectionIds.length === 0) return []

  const seen = new Set<string>()
  const out: CandidateProduct[] = []

  for (const colId of collectionIds) {
    let cursor: string | null = null
    do {
      const res = await admin.graphql(COLLECTION_PRODUCTS_QUERY, {
        variables: { id: colId, cursor }
      })
      const json = (await res.json()) as CollectionProductsResponse
      const data = json.data?.collection?.products
      if (!data) break

      for (const p of data.nodes) {
        if (seen.has(p.id)) continue
        seen.add(p.id)
        out.push(productNodeToCandidate(p))
      }

      cursor = data.pageInfo.hasNextPage ? data.pageInfo.endCursor : null
    } while (cursor)
  }

  return out
}

// ── Files 拉取 ─────────────────────────────────────────────

/**
 * 扫描 Files 库中的图片
 *
 * 三种筛选模式：
 * - all：有引用的非 SVG 图片（含 MediaImage + GenericFile.image/*）
 * - missing-alt：仅 alt 为空（服务端 trim 判断，不依赖 Shopify query 语法）
 * - ai-optimized：仅本地 AltTextItem.status=APPLIED 的图片（用于二次重生成）
 */
export async function scanFilesByFilter(
  admin: AdminClient,
  shop: string,
  filter: FilesFilter
): Promise<CandidateImage[]> {
  const out: CandidateImage[] = []
  let cursor: string | null = null

  do {
    const res = await admin.graphql(FILES_QUERY, {
      variables: { cursor, query: USED_IMAGE_FILES_QUERY }
    })
    const json = (await res.json()) as FilesResponse
    const data = json.data?.files
    if (!data) break

    for (const n of data.nodes) {
      const isMediaImage = n.__typename === 'MediaImage' && !!(n as MediaImageNode).image?.url
      const isGenericImage = n.__typename === 'GenericFile' && !!(n as GenericFileNode).mimeType?.startsWith('image/')
      if (!isMediaImage && !isGenericImage) continue
      if (isSvgFileNode(n, isMediaImage)) continue

      const alt = n.alt ?? null

      // 关键：服务端做 alt 为空判断，避免依赖 Shopify query 不稳定语法
      if (filter === 'missing-alt' && !isAltEmpty(alt)) continue

      out.push({
        id: n.id,
        url: isMediaImage ? (n as MediaImageNode).image!.url : (n as GenericFileNode).url,
        alt,
        resourceType: isMediaImage ? 'FILE_MEDIA_IMAGE' : 'FILE_GENERIC'
      })
    }

    cursor = data.pageInfo.hasNextPage ? data.pageInfo.endCursor : null
  } while (cursor)

  if (filter === 'ai-optimized') {
    const applied = await prisma.altTextItem.findMany({
      where: { shop, status: 'APPLIED' },
      select: { resourceId: true }
    })
    const set = new Set(applied.map((i) => i.resourceId))
    return out.filter((i) => set.has(i.id))
  }

  return out
}

// ── 摘要扫描 ───────────────────────────────────────────────

/**
 * 全店摘要扫描：统计图片总数、缺 ALT 数、AI 优化数，结果落到 AltTextSummary。
 *
 * 性能说明：
 * - v1 直接分页 files API，1w 张内可控制在 1 分钟以内
 * - v2 改用 BulkOperationRunQuery，详见 §10.2
 */
export async function computeSummary(admin: AdminClient, shop: string) {
  const log = logger.child({ module: 'alt-text-scan', shop })
  const startedAt = Date.now()

  let totalImages = 0
  let missingAlt = 0
  let cursor: string | null = null

  do {
    const res = await admin.graphql(FILES_QUERY, {
      variables: { cursor, query: USED_IMAGE_FILES_QUERY }
    })
    const json = (await res.json()) as FilesResponse
    const data = json.data?.files
    if (!data) break

    for (const n of data.nodes) {
      const isMediaImage = n.__typename === 'MediaImage' && !!(n as MediaImageNode).image?.url
      const isGenericImage = n.__typename === 'GenericFile' && !!(n as GenericFileNode).mimeType?.startsWith('image/')
      if (!isMediaImage && !isGenericImage) continue
      if (isSvgFileNode(n, isMediaImage)) continue

      totalImages++
      if (isAltEmpty(n.alt)) missingAlt++
    }

    cursor = data.pageInfo.hasNextPage ? data.pageInfo.endCursor : null
  } while (cursor)

  // AI 优化数 = 本地已成功写回的 item 去重数（同一资源可能跨 Job）
  const aiOptimized = await prisma.altTextItem
    .findMany({
      where: {
        shop,
        status: 'APPLIED',
        NOT: [{ imageUrl: { endsWith: '.svg' } }, { imageUrl: { contains: '.svg?' } }]
      },
      select: { resourceId: true },
      distinct: ['resourceId']
    })
    .then((rows) => rows.length)

  const lastScanAt = new Date()
  await prisma.altTextSummary.upsert({
    where: { shop },
    create: { shop, totalImages, missingAlt, aiOptimized, lastScanAt },
    update: { totalImages, missingAlt, aiOptimized, lastScanAt }
  })

  log.info(
    { totalImages, missingAlt, aiOptimized, elapsedMs: Date.now() - startedAt },
    'Alt text summary scan completed'
  )
  return { totalImages, missingAlt, aiOptimized, lastScanAt }
}

/**
 * 读取已存的摘要（不触发扫描）。无记录时返回零值。
 */
export async function getSummary(shop: string) {
  const row = await prisma.altTextSummary.findUnique({ where: { shop } })
  return {
    totalImages: row?.totalImages ?? 0,
    missingAlt: row?.missingAlt ?? 0,
    aiOptimized: row?.aiOptimized ?? 0,
    lastScanAt: row?.lastScanAt?.toISOString() ?? null
  }
}
