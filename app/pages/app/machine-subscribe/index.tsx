import { useCallback, useEffect, useRef, useState } from 'react'
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import { useFetcher, useLoaderData, useLocation } from 'react-router'
import { useAppBridge } from '@shopify/app-bridge-react'
import { authenticate } from '~/shopify.server'
import { EmptyState } from '~/components/EmptyState'
import { ProductTable } from '~/components/machine-subscribe/ProductTable'
import {
  VIRTUAL_PRODUCT_TAG,
  toProductRow,
  toVirtualProductInput,
  type ActionData,
  type ActionRequestBody,
  type CreateActionData,
  type CreateProductResponse,
  type LoaderData,
  type PageInfo,
  type ProductListResponse,
  type PublicationsResponse,
  type PublishProductResponse,
  type SearchActionData,
  type SearchProduct,
  type VirtualProductCreateInput,
  type VirtualProductNode
} from '~/types/machineSubscribe'
import type { AdminApiContext } from '@shopify/shopify-app-react-router/server'

const EMPTY_PAGE_INFO: PageInfo = {
  hasNextPage: false,
  hasPreviousPage: false,
  endCursor: null,
  startCursor: null
}

/** 根据 ids 查询产品列表 */
const ProductListQuery = `#graphql
query MachineSubscribeProducts($ids: [ID!]!) {
  nodes(ids: $ids) {
    __typename
    ... on Product {
      id
      title
      handle
      status
      templateSuffix
      options {
        id
        name
        values
      }
      variantsCount {
        count
      }
      variants(first: 10) {
        nodes {
          id
          title
          sku
          price
          compareAtPrice
          taxable
        }
      }
      media(first: 20) {
        nodes {
          id
          alt
          src: preview {
            image {
              url
            }
          }
        }
      }
      seo {
        title
        description
      }
      priceRangeV2 {
        minVariantPrice {
          amount
          currencyCode
        }
      }
      metafield(namespace: "custom", key: "event_product_sku") {
        value
      }
    }
  }
}
`

/** 查询销售渠道，用于定位创建后需要发布到的 Online Store publication */
const ProductResourcePublicationsQuery = `#graphql
query Publications {
  publications(first: 10) {
    nodes {
      id
      name
    }
  }
}
`

/** 查询虚拟产品列表（tag:Virtual Filters Subscription） */
const VirtualProductListQuery = `#graphql
query VirtualSubscribeProducts($query: String!, $first: Int!, $after: String) {
  products(first: $first, after: $after, query: $query) {
    nodes {
      id
      title
      handle
      status
      variantsCount {
        count
      }
      featuredMedia {
        mediaContentType
        __typename
        ... on MediaImage {
          image {
            url
            altText
          }
        }
      }
      priceRangeV2 {
        minVariantPrice {
          amount
          currencyCode
        }
      }
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      endCursor
      startCursor
    }
  }
}`

/** 创建虚拟产品；字段级业务错误由 productSet.userErrors 返回 */
const CreateProductMutation = `#graphql
mutation productSet($input: ProductSetInput!) {
  productSet(input: $input) {
    product {
      id
      handle
      onlineStoreUrl
    }
    userErrors {
      field
      message
    }
  }
}
`

/** 将产品发布到指定销售渠道（publication） */
const PublishProductMutation = `#graphql
mutation PublishProduct($id: ID!, $input: [PublicationInput!]!) {
  publishablePublish(id: $id, input: $input) {
    userErrors {
      field
      message
    }
  }
}
`

/** 统一解析 Admin GraphQL 响应，避免顶层 errors 被误当作有效业务数据 */
export async function typedAdminGraphql<T>(
  admin: AdminApiContext,
  query: string,
  variables?: Record<string, unknown>
): Promise<{ data: T }> {
  const response = await admin.graphql(query, { variables })
  const json = (await response.json()) as {
    data?: T
    errors?: Array<{ message?: string }>
  }

  if (json.errors?.length) {
    const messages = json.errors.map((error) => error.message ?? '未知 GraphQL 错误')
    throw new Error(`Shopify GraphQL 请求失败：${messages.join('；')}`)
  }
  if (json.data === undefined) {
    throw new Error('Shopify GraphQL 响应缺少 data')
  }

  return { data: json.data }
}

/** 查询带 Virtual Filters Subscription tag 的虚拟产品（cursor 分页） */
async function queryVirtualProducts(
  admin: AdminApiContext,
  after?: string | null
): Promise<{ products: VirtualProductNode[]; pageInfo: PageInfo }> {
  const { data } = await typedAdminGraphql<{ products?: { nodes?: VirtualProductNode[]; pageInfo?: PageInfo } }>(
    admin,
    VirtualProductListQuery,
    {
      query: `tag:${VIRTUAL_PRODUCT_TAG}`,
      first: 25,
      after: after || null
    }
  )
  return {
    products: data?.products?.nodes ?? [],
    pageInfo: data?.products?.pageInfo ?? EMPTY_PAGE_INFO
  }
}

/** 从逗号分隔文本中解析出合法的产品数字 ID（去重），并收集非法输入 */
function parseIds(raw: string): { valid: string[]; invalid: string[] } {
  const valid: string[] = []
  const invalid: string[] = []
  for (const part of raw.split(',')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    if (/^\d+$/.test(trimmed)) valid.push(trimmed)
    else invalid.push(trimmed)
  }
  return { valid: [...new Set(valid)], invalid }
}

/** 按 GID 列表查询产品（搜索 action 使用） */
async function searchProductsByIds(
  admin: AdminApiContext,
  ids: string[],
  invalidIds: string[]
): Promise<SearchActionData> {
  if (ids.length === 0) {
    return { intent: 'search', products: [], notFoundIds: [], invalidIds, queried: true }
  }

  const { data } = await typedAdminGraphql<ProductListResponse>(admin, ProductListQuery, { ids })
  const products = (data?.nodes ?? []).filter((node): node is SearchProduct => !!node && node.__typename === 'Product')

  const foundIds = new Set(products.map((p) => p.id))
  const notFoundIds = ids.filter((id) => !foundIds.has(id)).map((id) => id.split('/').pop() ?? id)

  return { intent: 'search', products, notFoundIds, invalidIds, queried: true }
}

/** 将已创建产品发布到销售渠道 */
async function publishProductToChannel(
  admin: AdminApiContext,
  productId: string,
  publicationId: string
): Promise<string[]> {
  const { data } = await typedAdminGraphql<PublishProductResponse>(admin, PublishProductMutation, {
    id: productId,
    input: [{ publicationId }]
  })
  const userErrors = data?.publishablePublish?.userErrors ?? []
  return userErrors.map((e) => (e.field?.length ? `${e.field.join('.')}: ${e.message}` : e.message))
}

/** 调用 productSet 创建单个虚拟产品；成功后发布到 Online Store 渠道 */
async function createVirtualProduct(
  admin: AdminApiContext,
  input: VirtualProductCreateInput,
  channelId?: string | null
): Promise<{ product?: { id: string; handle: string }; errors: string[] }> {
  const {
    data: { productSet }
  } = await typedAdminGraphql<CreateProductResponse>(admin, CreateProductMutation, { input })

  if (!productSet) return { errors: [`创建失败：${input.handle}`] }

  const userErrors = productSet?.userErrors ?? []
  if (userErrors.length > 0) {
    return {
      errors: userErrors.map((e) => (e.field?.length ? `${e.field.join('.')}: ${e.message}` : e.message))
    }
  }

  if (!productSet?.product) return { errors: [`创建失败：${input.handle}`] }

  const product = productSet.product
  if (!channelId) {
    return { product, errors: [`已创建但未找到 Online Store 销售渠道：${input.handle}`] }
  }

  const publishErrors = await publishProductToChannel(admin, product.id, channelId)
  if (publishErrors.length > 0) {
    return {
      product,
      errors: publishErrors.map((msg) => `发布销售渠道失败：${msg}`)
    }
  }

  return { product, errors: [] }
}

export const action = async ({ request }: ActionFunctionArgs): Promise<ActionData> => {
  const { admin } = await authenticate.admin(request)

  let body: ActionRequestBody
  try {
    body = await request.json()
  } catch {
    return { intent: 'create', ok: false, created: [], errors: ['请求体无效'] }
  }

  if (body.intent === 'search') return searchProductsByIds(admin, body.ids ?? [], body.invalidIds ?? [])

  // 批量创建虚拟产品，并发布到 Online Store
  const products = body.products ?? []
  const channelId = body.channelId
  if (products.length === 0) {
    return { intent: 'create', ok: false, created: [], errors: ['请至少选择一个产品'] }
  }

  const created: Array<{ id: string; handle: string }> = []
  const errors: string[] = []

  // 逐项捕获，避免后续 GraphQL/网络异常导致已成功创建的结果无法返回前端
  for (const input of products) {
    try {
      const result = await createVirtualProduct(admin, input, channelId)
      if (result.product) created.push(result.product)
      if (result.errors.length > 0) errors.push(...result.errors.map((msg) => `[${input.handle}] ${msg}`))
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      errors.push(`[${input.handle}] ${message}`)
    }
  }

  return {
    intent: 'create',
    ok: created.length > 0 && errors.length === 0,
    created,
    errors
  }
}

export const loader = async ({ request }: LoaderFunctionArgs): Promise<LoaderData> => {
  const { admin } = await authenticate.admin(request)
  const after = new URL(request.url).searchParams.get('after')

  // 虚拟产品列表与销售渠道互不依赖，并行请求以缩短首屏等待
  const [{ products: virtualProducts, pageInfo }, { data }] = await Promise.all([
    queryVirtualProducts(admin, after),
    typedAdminGraphql<PublicationsResponse>(admin, ProductResourcePublicationsQuery)
  ])
  const publicationsNodes = data?.publications?.nodes ?? []
  const channelId = publicationsNodes.find((node) => node?.name === 'Online Store')?.id

  return { virtualProducts, pageInfo, channelId }
}

export default function MachineSubscribeIndex() {
  const shopify = useAppBridge()
  const { pathname } = useLocation()
  const loaderData = useLoaderData<typeof loader>()
  // 虚拟产品列表分页：独立 fetcher，与弹窗搜索互不影响
  const virtualFetcher = useFetcher<LoaderData>()
  // 弹窗内的搜索结果：走 action
  const searchFetcher = useFetcher<SearchActionData>()
  // 批量创建虚拟产品：走 action
  const createFetcher = useFetcher<CreateActionData>()
  const [value, setValue] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  /** 已访问页的 after 游标栈（用于上一页）；空栈表示第 1 页 */
  const [cursorStack, setCursorStack] = useState<string[]>([])
  /** 创建失败错误，由 dismissible banner 展示，用户手动关闭后清空 */
  const [createErrors, setCreateErrors] = useState<string[] | null>(null)
  const [products, setProducts] = useState<SearchProduct[]>([])
  const fieldRef = useRef<HTMLElement | null>(null)
  /** 防止 React effect 对同一份 fetcher 返回值重复执行关闭弹窗和刷新列表 */
  const lastCreateDataRef = useRef<CreateActionData | null>(null)
  /** 同步标记提交已开始，避免 React 状态尚未更新时用户立即关闭弹窗 */
  const creatingRef = useRef(false)

  const virtualLoading = virtualFetcher.state !== 'idle'
  const virtualProducts = virtualFetcher.data?.virtualProducts ?? loaderData.virtualProducts
  const pageInfo = virtualFetcher.data?.pageInfo ?? loaderData.pageInfo
  const hasPreviousPage = cursorStack.length > 0
  const hasNextPage = pageInfo.hasNextPage

  const loading = searchFetcher.state !== 'idle'
  const creating = createFetcher.state !== 'idle'
  const searchData = searchFetcher.data?.intent === 'search' ? searchFetcher.data : undefined

  const loadVirtualPage = useCallback(
    (after?: string | null) => {
      const params = new URLSearchParams({ type: 'virtual' })
      if (after) params.set('after', after)
      virtualFetcher.load(`${pathname}?${params.toString()}`)
    },
    [pathname, virtualFetcher]
  )

  const goNextVirtualPage = useCallback(() => {
    if (!pageInfo.endCursor) return
    setCursorStack((prev) => [...prev, pageInfo.endCursor!])
    loadVirtualPage(pageInfo.endCursor)
  }, [pageInfo.endCursor, loadVirtualPage])

  const goPrevVirtualPage = useCallback(() => {
    const next = cursorStack.slice(0, -1)
    setCursorStack(next)
    loadVirtualPage(next[next.length - 1] ?? null)
  }, [cursorStack, loadVirtualPage])

  const refreshVirtualProducts = useCallback(() => {
    setCursorStack([])
    loadVirtualPage()
  }, [loadVirtualPage])

  const searchNodes = useCallback(() => {
    const raw = value.trim()
    if (!raw) {
      shopify.toast.show('请输入产品 ID', { isError: true })
      return
    }
    const { valid, invalid } = parseIds(raw)
    if (valid.length === 0) {
      shopify.toast.show('请输入有效的数字产品 ID', { isError: true })
      return
    }
    const ids = valid.map((id) => `gid://shopify/Product/${id}`)
    searchFetcher.submit(JSON.stringify({ intent: 'search', ids, invalidIds: invalid }), {
      method: 'POST',
      encType: 'application/json'
    })
  }, [value, searchFetcher, shopify])

  const copySelected = useCallback(() => {
    const selected = products.filter((product) => selectedIds.has(product.id)).map(toVirtualProductInput)

    if (selected.length === 0) {
      shopify.toast.show('请至少选择一个产品', { isError: true })
      return
    }
    creatingRef.current = true

    createFetcher.submit(JSON.stringify({ intent: 'create', products: selected, channelId: loaderData.channelId }), {
      method: 'POST',
      encType: 'application/json'
    })
  }, [products, selectedIds, createFetcher, shopify, loaderData.channelId])

  // 每次搜索返回新结果时清空勾选
  useEffect(() => {
    setSelectedIds(new Set())
  }, [searchData])

  useEffect(() => {
    if (searchData?.intent !== 'search') return
    setProducts(searchData.products ?? [])
  }, [searchData])

  // 创建完成（成功或失败）后关闭弹窗；成功时刷新列表，失败时用 banner 提示
  useEffect(() => {
    if (createFetcher.state !== 'idle' || !createFetcher.data) return
    if (createFetcher.data.intent !== 'create') return
    if (lastCreateDataRef.current === createFetcher.data) return
    lastCreateDataRef.current = createFetcher.data

    const { created, errors } = createFetcher.data
    creatingRef.current = false
    shopify.modal.hide('batch-copy-modal')

    if (created.length > 0) {
      shopify.toast.show(`成功创建 ${created.length} 个虚拟产品`)
      setCursorStack([])
      // Shopify 产品搜索索引存在短暂延迟，稍后再刷新可提高新产品出现在列表中的概率。
      setTimeout(() => {
        loadVirtualPage()
      }, 1500)
    }
    if (errors.length > 0) {
      setCreateErrors(errors)
    }
  }, [createFetcher.state, createFetcher.data, shopify, loadVirtualPage])

  const toggleOne = useCallback(
    (id: string) => {
      if (creating) return
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    },
    [creating]
  )

  const toggleAll = useCallback(() => {
    if (creating) return
    setSelectedIds((prev) => {
      const ids = products.map((product) => product.id)
      if (ids.length > 0 && ids.every((id) => prev.has(id))) return new Set()
      return new Set(ids)
    })
  }, [products, creating])

  return (
    <s-page heading="整机订购省-滤芯虚拟产品">
      <s-button slot="primary-action" variant="primary" onClick={() => shopify.modal.show('batch-copy-modal')}>
        批量复制
      </s-button>
      <s-box padding="large">
        <s-stack gap="base">
          {createErrors && createErrors.length > 0 && (
            <s-banner
              tone="critical"
              heading={`创建失败（${createErrors.length}）`}
              dismissible
              onDismiss={() => setCreateErrors(null)}
            >
              <s-stack gap="small-200">
                {createErrors.map((message, index) => (
                  <s-text key={`${index}-${message}`}>{message}</s-text>
                ))}
              </s-stack>
            </s-banner>
          )}

          <s-section heading={`虚拟滤芯列表（tag: ${VIRTUAL_PRODUCT_TAG}）`}>
            <s-stack gap="base">
              <s-stack direction="inline" gap="base">
                <s-button
                  variant="secondary"
                  icon="refresh"
                  onClick={refreshVirtualProducts}
                  disabled={virtualLoading || undefined}
                  loading={virtualLoading || undefined}
                >
                  刷新列表
                </s-button>
              </s-stack>

              {virtualLoading && virtualProducts.length === 0 && <s-spinner accessibilityLabel="加载中" />}

              {!virtualLoading && virtualProducts.length === 0 ? (
                <EmptyState message="暂无整机订购省虚拟滤芯产品。" />
              ) : (
                virtualProducts.length > 0 && (
                  <ProductTable
                    products={virtualProducts.map(toProductRow)}
                    loading={virtualLoading}
                    paginate={hasPreviousPage || hasNextPage}
                    hasPreviousPage={hasPreviousPage}
                    hasNextPage={hasNextPage}
                    onPreviousPage={goPrevVirtualPage}
                    onNextPage={goNextVirtualPage}
                  />
                )
              )}
            </s-stack>
          </s-section>
        </s-stack>
      </s-box>

      <s-modal
        id="batch-copy-modal"
        heading="批量复制"
        size="large"
        onHide={() => {
          // 每次关闭都清空上次搜索上下文，避免下次打开时残留选择状态。
          setValue('')
          setProducts([])
          setSelectedIds(new Set())
        }}
      >
        <s-stack gap="base">
          <s-stack direction="inline" gap="base">
            <s-text-field
              ref={(el) => {
                fieldRef.current = el
              }}
              label="产品 ID"
              placeholder="输入产品数字 ID，用英文逗号分隔，例如：123,456,789"
              value={value}
              disabled={creating || undefined}
              onInput={(e: Event) => setValue((e.target as HTMLInputElement).value)}
            />
            <s-button variant="primary" onClick={searchNodes} disabled={loading || creating || undefined}>
              {loading ? '查询中...' : '搜索'}
            </s-button>
          </s-stack>

          {searchData && searchData.invalidIds.length > 0 && (
            <s-banner tone="warning" heading="已忽略非法 ID">
              <s-text>以下输入不是有效的数字 ID：{searchData.invalidIds.join('、')}</s-text>
            </s-banner>
          )}

          {searchData && searchData.notFoundIds.length > 0 && (
            <s-banner tone="warning" heading="部分产品未找到">
              <s-text>以下 ID 未查询到对应产品：{searchData.notFoundIds.join('、')}</s-text>
            </s-banner>
          )}

          {loading && <s-spinner accessibilityLabel="加载中" />}

          {!loading && searchData?.queried && products.length === 0 && (
            <EmptyState message="未查询到任何产品，请检查输入的产品 ID。" />
          )}

          {!loading && products.length > 0 && (
            <s-section accessibilityLabel="查询结果">
              <s-stack gap="small-200">
                <s-text tone="neutral">已选 {selectedIds.size} 项</s-text>
                <ProductTable
                  products={products.map(toProductRow)}
                  selectable
                  linkable={false}
                  selectedIds={selectedIds}
                  onToggle={toggleOne}
                  onToggleAll={toggleAll}
                  allSelected={products.length > 0 && selectedIds.size === products.length}
                />
              </s-stack>
            </s-section>
          )}
        </s-stack>

        <s-button
          slot="secondary-actions"
          disabled={creating || undefined}
          onClick={() => {
            if (!creatingRef.current) shopify.modal.hide('batch-copy-modal')
          }}
        >
          取消
        </s-button>
        <s-button
          onClick={copySelected}
          slot="primary-action"
          variant="primary"
          disabled={selectedIds.size === 0 || creating || undefined}
          loading={creating || undefined}
        >
          {creating ? '创建中...' : '复制选中产品'}
        </s-button>
      </s-modal>
    </s-page>
  )
}
