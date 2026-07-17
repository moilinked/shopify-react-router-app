import type { ActionFunctionArgs } from 'react-router'
import { authenticate } from '~/shopify.server'
import { getProductsByCollections, getProductsByIds, scanAllProducts } from '~/services/altText.server'
import logger from '~/lib/logger.server'

interface ProductsRequestBody {
  source?: 'all-products' | 'products' | 'collections'
  productIds?: string[]
  collectionIds?: string[]
}

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((i) => typeof i === 'string')

/**
 * POST /api/alt-text/products
 * 拉取商品 + 图片候选数据，对应 UI「添加所有商品 / 选择商品 / 按系列添加」按钮。
 *
 * Body:
 *   - source: 'all-products' | 'products' | 'collections'
 *   - productIds?: string[]    （source=products 必填，Shopify GID）
 *   - collectionIds?: string[] （source=collections 必填，Shopify GID）
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const { admin, session } = await authenticate.admin(request)
  const log = logger.child({ module: 'alt-text-products', shop: session.shop })

  let body: ProductsRequestBody
  try {
    body = (await request.json()) as ProductsRequestBody
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { source, productIds, collectionIds } = body

  try {
    const start = Date.now()
    let products: Awaited<ReturnType<typeof scanAllProducts>> = []

    switch (source) {
      case 'all-products':
        products = await scanAllProducts(admin)
        break
      case 'products':
        if (!isStringArray(productIds) || productIds.length === 0) {
          return Response.json({ error: 'productIds is required for source=products' }, { status: 400 })
        }
        products = await getProductsByIds(admin, productIds)
        break
      case 'collections':
        if (!isStringArray(collectionIds) || collectionIds.length === 0) {
          return Response.json({ error: 'collectionIds is required for source=collections' }, { status: 400 })
        }
        products = await getProductsByCollections(admin, collectionIds)
        break
      default:
        return Response.json({ error: `Invalid source: ${source ?? '(missing)'}` }, { status: 400 })
    }

    log.info({ source, count: products.length, costMs: Date.now() - start }, 'Alt-text products fetched')
    return Response.json({ products })
  } catch (error) {
    log.error({ err: error, source }, 'Failed to fetch alt-text products')
    return Response.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}
