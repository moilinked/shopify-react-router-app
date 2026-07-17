import type { authenticate } from '~/shopify.server'
import { VIRTUAL_PRODUCT_TAG, type ProductRow } from '~/types/machineSubscribe'

// ── 查询逻辑（服务端 loader 调用）───────────────────────

/** 一次查询虚拟产品的上限 */
const VIRTUAL_PRODUCT_LIMIT = 100

const PRODUCT_FIELDS = `
  id
  title
  handle
  status
  totalInventory
  featuredImage {
    url
    altText
  }
  priceRangeV2 {
    minVariantPrice {
      amount
      currencyCode
    }
  }
`

type Admin = Awaited<ReturnType<typeof authenticate.admin>>['admin']

type ProductNode = {
  __typename?: 'Product'
  id: string
  title: string
  handle: string
  status: string
  totalInventory: number | null
  featuredImage?: { url?: string | null; altText?: string | null } | null
  priceRangeV2?: { minVariantPrice?: { amount?: string | null; currencyCode?: string | null } | null } | null
}

function mapProductNode(node: ProductNode): ProductRow {
  return {
    id: node.id,
    numericId: node.id.split('/').pop() ?? '',
    title: node.title,
    handle: node.handle,
    status: node.status,
    totalInventory: node.totalInventory ?? null,
    imageUrl: node.featuredImage?.url ?? null,
    imageAlt: node.featuredImage?.altText ?? null,
    price: node.priceRangeV2?.minVariantPrice?.amount ?? null,
    currencyCode: node.priceRangeV2?.minVariantPrice?.currencyCode ?? null
  }
}

/** 按产品数字 ID 列表查询 */
export async function queryProductsByIds(admin: Admin, gids: string[]): Promise<ProductRow[]> {
  const response = await admin.graphql(
    `#graphql
    query MachineSubscribeProducts($ids: [ID!]!) {
      nodes(ids: $ids) {
        __typename
        ... on Product {
          ${PRODUCT_FIELDS}
        }
      }
    }`,
    { variables: { ids: gids } }
  )
  const json = (await response.json()) as {
    data?: { nodes?: Array<ProductNode | { __typename: string } | null> }
  }
  return (json.data?.nodes ?? [])
    .filter((node): node is ProductNode => !!node && node.__typename === 'Product')
    .map(mapProductNode)
}

/** 查询带 subscribe tag 的虚拟产品 */
export async function queryVirtualProducts(admin: Admin): Promise<ProductRow[]> {
  const response = await admin.graphql(
    `#graphql
    query VirtualSubscribeProducts($query: String!, $first: Int!) {
      products(first: $first, query: $query) {
        nodes {
          ${PRODUCT_FIELDS}
        }
      }
    }`,
    { variables: { query: `tag:${VIRTUAL_PRODUCT_TAG}`, first: VIRTUAL_PRODUCT_LIMIT } }
  )
  const json = (await response.json()) as { data?: { products?: { nodes?: ProductNode[] } } }
  return (json.data?.products?.nodes ?? []).map(mapProductNode)
}

// ── UI ──────────────────────────────────────────────────

const STATUS_TONE: Record<string, 'success' | 'info' | 'warning'> = {
  ACTIVE: 'success',
  DRAFT: 'info',
  ARCHIVED: 'warning'
}

/** 产品数据表格（图片 / ID / 标题 / 状态 / 库存 / 价格）*/
export function ProductTable({ products }: { products: ProductRow[] }) {
  return (
    <s-table>
      <s-table-header-row>
        <s-table-header>图片</s-table-header>
        <s-table-header format="numeric">ID</s-table-header>
        <s-table-header listSlot="primary">标题</s-table-header>
        <s-table-header>状态</s-table-header>
        <s-table-header format="numeric">库存</s-table-header>
        <s-table-header format="numeric">价格</s-table-header>
      </s-table-header-row>
      <s-table-body>
        {products.map((product) => (
          <s-table-row key={product.id}>
            <s-table-cell>
              {product.imageUrl ? (
                <s-thumbnail src={product.imageUrl} alt={product.imageAlt ?? product.title} size="base" />
              ) : (
                <s-box inlineSize="40px" blockSize="40px" background="subdued" borderRadius="small" />
              )}
            </s-table-cell>
            <s-table-cell>{product.numericId}</s-table-cell>
            <s-table-cell>
              <s-clickable
                href={`shopify://admin/products/${product.numericId}`}
                accessibilityLabel={`打开 ${product.title}`}
              >
                <s-text type="strong">{product.title}</s-text>
              </s-clickable>
            </s-table-cell>
            <s-table-cell>
              <s-badge tone={STATUS_TONE[product.status] ?? 'info'}>{product.status}</s-badge>
            </s-table-cell>
            <s-table-cell>{product.totalInventory ?? '—'}</s-table-cell>
            <s-table-cell>
              {product.price ? `${product.price}${product.currencyCode ? ` ${product.currencyCode}` : ''}` : '—'}
            </s-table-cell>
          </s-table-row>
        ))}
      </s-table-body>
    </s-table>
  )
}

/** 已创建的「整机订购省」虚拟滤芯产品列表 */
export function VirtualProductList({ products }: { products: ProductRow[] }) {
  return (
    <s-section heading={`虚拟滤芯产品列表（tag: ${VIRTUAL_PRODUCT_TAG}）`}>
      {products.length > 0 ? (
        <ProductTable products={products} />
      ) : (
        <s-box padding="large">
          <s-text tone="neutral">暂无整机订购省虚拟滤芯产品。</s-text>
        </s-box>
      )}
    </s-section>
  )
}
