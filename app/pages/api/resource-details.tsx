import type { ActionFunctionArgs } from 'react-router'
import { authenticate } from '~/shopify.server'
import type { AppliesToType } from '~/types/activity'
import logger from '~/lib/logger.server'

type ResourceDetailsRequest = {
  type?: AppliesToType
  ids?: string[]
}

type ProductResource = {
  type: 'PRODUCT'
  id: string
  title: string
  image?: string
  totalVariants: number
  selectedVariantIds: string[]
  selectedVariantsCount: number
}

type CollectionResource = {
  type: 'COLLECTION'
  id: string
  title: string
  image?: string
}

type ResourceDetailsResponse = {
  resources: Array<ProductResource | CollectionResource>
}

function getCount(value: unknown): number {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'count' in value) {
    const count = (value as { count?: unknown }).count
    return typeof count === 'number' ? count : 0
  }
  return 0
}

function isProductId(id: string) {
  return id.includes('/Product/')
}

function isProductVariantId(id: string) {
  return id.includes('/ProductVariant/')
}

function isCollectionId(id: string) {
  return id.includes('/Collection/')
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const path = new URL(request.url).pathname
  if (request.method !== 'POST') {
    logger.warn({ module: 'resource-details', path, method: request.method }, 'Resource details method not allowed')
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const { admin, session } = await authenticate.admin(request)
  const log = logger.child({ module: 'resource-details', shop: session.shop, path })

  try {
    const body = (await request.json()) as ResourceDetailsRequest
    const type = body.type
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : []

    if (!type || (type !== 'PRODUCT' && type !== 'COLLECTION')) {
      log.warn({ type }, 'Resource details invalid type')
      return Response.json({ error: 'Invalid type' }, { status: 400 })
    }

    if (ids.length === 0) {
      log.debug({ type }, 'Resource details called without ids')
      return Response.json({ resources: [] satisfies ResourceDetailsResponse['resources'] })
    }
    log.info({ type, requestedIds: ids.length }, 'Resource details query started')

    const response = await admin.graphql(
      `#graphql
      query ResourceDetails($ids: [ID!]!) {
        nodes(ids: $ids) {
          __typename
          ... on Product {
            id
            title
            featuredImage {
              url
            }
            totalVariants
            variantsCount {
              count
            }
          }
          ... on ProductVariant {
            id
            product {
              id
              title
              featuredImage {
                url
              }
              totalVariants
              variantsCount {
                count
              }
            }
          }
          ... on Collection {
            id
            title
            image {
              url
            }
          }
        }
      }`,
      {
        variables: { ids }
      }
    )

    const data = (await response.json()) as {
      data?: {
        nodes?: Array<
          | {
              __typename: 'Product'
              id: string
              title: string
              featuredImage?: { url?: string | null } | null
              totalVariants?: number | null
              variantsCount?: { count?: number | null } | null
            }
          | {
              __typename: 'ProductVariant'
              id: string
              product?: {
                id: string
                title: string
                featuredImage?: { url?: string | null } | null
                totalVariants?: number | null
                variantsCount?: { count?: number | null } | null
              } | null
            }
          | {
              __typename: 'Collection'
              id: string
              title: string
              image?: { url?: string | null } | null
            }
          | null
        >
      }
    }

    const nodes = data.data?.nodes ?? []

    if (type === 'COLLECTION') {
      const collectionMap = new Map<string, CollectionResource>()
      nodes.forEach((node) => {
        if (!node || node.__typename !== 'Collection') return
        collectionMap.set(node.id, {
          type: 'COLLECTION',
          id: node.id,
          title: node.title,
          image: node.image?.url ?? undefined
        })
      })

      const resources: CollectionResource[] = []
      const visited = new Set<string>()
      ids.forEach((id) => {
        if (!isCollectionId(id) || visited.has(id)) return
        const item = collectionMap.get(id)
        if (!item) return
        resources.push(item)
        visited.add(id)
      })

      log.info({ type, returnedResources: resources.length }, 'Resource details query completed')
      return Response.json({ resources } satisfies ResourceDetailsResponse)
    }

    const selectedProductIds = new Set(ids.filter(isProductId))
    const productMap = new Map<
      string,
      {
        id: string
        title: string
        image?: string
        totalVariants: number
        selectedVariantIds: Set<string>
      }
    >()
    const variantToProductMap = new Map<string, string>()

    nodes.forEach((node) => {
      if (!node) return

      if (node.__typename === 'Product') {
        productMap.set(node.id, {
          id: node.id,
          title: node.title,
          image: node.featuredImage?.url ?? undefined,
          totalVariants: getCount(node.totalVariants) || 1,
          selectedVariantIds: new Set<string>()
        })
      }

      if (node.__typename === 'ProductVariant' && node.product) {
        const productId = node.product.id
        const existing = productMap.get(productId)
        if (existing) {
          existing.selectedVariantIds.add(node.id)
        } else {
          productMap.set(productId, {
            id: productId,
            title: node.product.title,
            image: node.product.featuredImage?.url ?? undefined,
            totalVariants: getCount(node.product.totalVariants) || 1,
            selectedVariantIds: new Set<string>([node.id])
          })
        }
        variantToProductMap.set(node.id, productId)
      }
    })

    const resources: ProductResource[] = []
    const visitedProducts = new Set<string>()

    ids.forEach((id) => {
      let productId = ''
      if (isProductId(id)) {
        productId = id
      } else if (isProductVariantId(id)) {
        productId = variantToProductMap.get(id) ?? ''
      }
      if (!productId || visitedProducts.has(productId)) return

      const product = productMap.get(productId)
      if (!product) return

      const variantIds = Array.from(product.selectedVariantIds)
      const selectedVariantsCount =
        variantIds.length > 0
          ? variantIds.length
          : selectedProductIds.has(productId)
            ? product.totalVariants
            : Math.min(product.totalVariants, 1)

      resources.push({
        type: 'PRODUCT',
        id: product.id,
        title: product.title,
        image: product.image,
        totalVariants: product.totalVariants,
        selectedVariantIds: variantIds,
        selectedVariantsCount
      })

      visitedProducts.add(productId)
    })

    log.info({ type, returnedResources: resources.length }, 'Resource details query completed')
    return Response.json({ resources } satisfies ResourceDetailsResponse)
  } catch (error) {
    log.error({ err: error }, 'Resource details query failed')
    return Response.json({ error: 'Failed to load resource details' }, { status: 500 })
  }
}
