export interface ProductRow {
  id: string
  numericId: string
  title: string
  handle: string
  status: string
  variantCount: number | null
  imageUrl: string | null
  imageAlt: string | null
  price: string | null
  currencyCode: string | null
}

export interface ProductListResponse {
  nodes?: Array<SearchProduct | { __typename: string } | null>
}

/** GraphQL 分页信息 */
export interface PageInfo {
  hasNextPage: boolean
  hasPreviousPage: boolean
  endCursor: string | null
  startCursor: string | null
}

/** 虚拟产品列表节点（tag 查询返回） */
export interface VirtualProductNode {
  id: string
  title: string
  handle: string
  status: string
  variantsCount?: { count?: number | null } | null
  featuredMedia?: { image?: { url?: string | null; altText?: string | null } | null } | null
  priceRangeV2?: { minVariantPrice?: { amount?: string | null; currencyCode?: string | null } | null } | null
}

/** 页面 loader 数据 */
export interface LoaderData {
  virtualProducts: VirtualProductNode[]
  pageInfo: PageInfo
  channelId?: string
}

/** 搜索 action 返回 */
export interface SearchActionData {
  intent: 'search'
  products: SearchProduct[]
  notFoundIds: string[]
  invalidIds: string[]
  queried: boolean
}

/** 创建 action 返回 */
export interface CreateActionData {
  intent: 'create'
  ok: boolean
  created: Array<{ id: string; handle: string }>
  errors: string[]
}

export type ActionData = SearchActionData | CreateActionData

/** action 请求体 */
export interface ActionRequestBody {
  intent?: 'search' | 'create'
  ids?: string[]
  invalidIds?: string[]
  products?: VirtualProductCreateInput[]
  channelId?: string | null
}

/** productSet mutation 响应 */
export interface CreateProductResponse {
  productSet?: {
    product?: { id: string; handle: string } | null
    userErrors?: Array<{ field?: string[] | null; message: string }>
  }
}

/** publishablePublish mutation 响应 */
export interface PublishProductResponse {
  publishablePublish?: {
    userErrors?: Array<{ field?: string[] | null; message: string }>
  }
}

/** publications 查询响应（用于解析 Online Store channelId） */
export interface PublicationsResponse {
  publications?: {
    nodes?: Array<{
      id: string
      name?: string | null
    }>
  }
}

/** 按 ID 查询返回的原始产品（与虚拟产品列表字段不一致，不做统一格式化） */
export interface SearchProduct {
  __typename?: 'Product'
  id: string
  title: string
  handle: string
  status: string
  templateSuffix?: string | null
  options?: Array<{ id: string; name: string; values: string[] }>
  variantsCount?: { count?: number | null } | null
  variants?: {
    nodes: Array<{
      id: string
      title: string
      sku?: string | null
      price: string
      compareAtPrice?: string | null
      taxable: boolean
    }>
  }
  media?: {
    nodes: Array<{
      id: string
      alt?: string | null
      /** GraphQL alias: `src: preview` */
      src?: { image?: { url?: string | null } | null } | null
    }>
  }
  seo?: { title?: string | null; description?: string | null } | null
  priceRangeV2?: { minVariantPrice?: { amount?: string | null; currencyCode?: string | null } | null } | null
  metafield?: {
    value: string
  }
}

/** 创建虚拟滤芯产品用的 productSet 入参结构 */
export interface VirtualProductCreateInput {
  title: string
  handle: string
  status: 'UNLISTED'
  templateSuffix: string
  tags: string[]
  productOptions: Array<{
    name: string
    values: Array<{ name: string }>
  }>
  variants: Array<{
    optionValues: Array<{ optionName: string; name: string }>
    sku: string
    price: string
    taxable: boolean
    inventoryItem: { requiresShipping: boolean }
  }>
  files: Array<{ id: string; alt: string }>
  seo: { title: string; description: string }
  metafields?: Array<{
    namespace: string
    key: string
    value: string
    type: string
  }>
}

/** 带该 tag 的产品会被识别为「整机订购省」虚拟滤芯产品 */
export const VIRTUAL_PRODUCT_TAG = 'Virtual Filters Subscription'

/** 将虚拟产品节点或搜索结果统一映射为表格行 */
export function toProductRow(product: VirtualProductNode | SearchProduct): ProductRow {
  const searchMedia = 'media' in product ? product.media?.nodes?.[0] : undefined
  const featuredMedia = 'featuredMedia' in product ? product.featuredMedia : undefined

  return {
    id: product.id,
    numericId: product.id.split('/').pop() ?? '',
    title: product.title,
    handle: product.handle,
    status: product.status,
    variantCount: product.variantsCount?.count ?? null,
    imageUrl: searchMedia?.src?.image?.url ?? featuredMedia?.image?.url ?? null,
    imageAlt: searchMedia?.alt ?? featuredMedia?.image?.altText ?? null,
    price: product.priceRangeV2?.minVariantPrice?.amount ?? null,
    currencyCode: product.priceRangeV2?.minVariantPrice?.currencyCode ?? null
  }
}

/** 将源产品转换为 productSet 入参；虚拟产品统一隐藏、固定 SKU，并标记为无需配送 */
export function toVirtualProductInput(product: SearchProduct): VirtualProductCreateInput {
  return {
    title: product.title,
    handle: `${product.handle}-subscribe`,
    status: 'UNLISTED',
    templateSuffix: product.templateSuffix ?? '',
    tags: [VIRTUAL_PRODUCT_TAG],
    productOptions: (product.options ?? []).map((option) => ({
      name: option.name,
      values: option.values.map((value) => ({ name: value }))
    })),
    variants: (product.variants?.nodes ?? []).map((variant) => ({
      optionValues: (product.options ?? []).map((option) => ({
        optionName: option.name,
        name: variant.title
      })),
      sku: 'WD-VF-SUB',
      price: variant.price,
      taxable: variant.taxable,
      inventoryItem: { requiresShipping: false }
    })),
    files: (product.media?.nodes ?? []).map((media) => ({
      id: media.id,
      alt: media.alt ?? ''
    })),
    seo: {
      title: product.seo?.title ?? '',
      description: product.seo?.description ?? ''
    },
    metafields: [
      {
        namespace: 'seo',
        key: 'hidden',
        value: '1',
        type: 'number_integer'
      },
      ...(product.metafield?.value
        ? [
            {
              namespace: 'custom',
              key: 'event_product_sku',
              value: product.metafield.value,
              type: 'single_line_text_field'
            }
          ]
        : [])
    ]
  }
}
