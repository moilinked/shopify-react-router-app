/** 带该 tag 的产品会被识别为「整机订购省」虚拟滤芯产品 */
export const VIRTUAL_PRODUCT_TAG = 'Virtual Filters Subscription'

export type SourceProduct = {
  id: string
  title: string
  handle: string
  status: string
  templateSuffix?: string | null
  tags?: string[] | null
  options?: Array<{ id: string; name: string; values: string[] }> | null
  variants?: {
    nodes: Array<{
      id: string
      title: string
      sku?: string | null
      price: string
      compareAtPrice?: string | null
      taxable: boolean
    }>
  } | null
  media?: {
    nodes: Array<{
      id: string
      alt?: string | null
    }>
  } | null
  seo?: { title?: string | null; description?: string | null } | null
  metafield?: { value?: string | null } | null
}

export type VirtualProductCreateInput = {
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
    metafields?: Array<{
      namespace: string
      key: string
      value: string
      type: string
    }>
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

/** 将源产品转换为 productSet 入参；与 app/types/machineSubscribe.toVirtualProductInput 保持一致 */
export function toVirtualProductInput(product: SourceProduct): VirtualProductCreateInput {
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
      inventoryItem: { requiresShipping: false },
      metafields: [
        {
          namespace: 'custom',
          key: 'related_filter',
          value: variant.id,
          type: 'variant_reference'
        }
      ]
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

export function titleSuffixForShop(myshopifyDomain?: string | null): string {
  if (myshopifyDomain?.includes('waterdropde')) return ' Abonnement'
  return ' Subscription'
}
