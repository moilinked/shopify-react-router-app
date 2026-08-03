// @ts-ignore — side-effect import registers JSX intrinsics for Polaris web components
import '@shopify/ui-extensions/preact'
import { render } from 'preact'
import { useCallback, useEffect, useState } from 'preact/hooks'
import {
  VIRTUAL_PRODUCT_TAG,
  titleSuffixForShop,
  toVirtualProductInput,
  type SourceProduct,
  type VirtualProductCreateInput
} from './virtualProduct'

const GetSourceProductQuery = `#graphql
query GetSourceProduct($id: ID!) {
  product(id: $id) {
    id
    title
    handle
    status
    templateSuffix
    tags
    options {
      id
      name
      values
    }
    variants(first: 100) {
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
      }
    }
    seo {
      title
      description
    }
    metafield(namespace: "custom", key: "event_product_sku") {
      value
    }
  }
  shop {
    myshopifyDomain
  }
  publications(first: 10) {
    nodes {
      id
      name
    }
  }
}
`

const CreateProductMutation = `#graphql
mutation productSet($input: ProductSetInput!) {
  productSet(input: $input) {
    product {
      id
      handle
    }
    userErrors {
      field
      message
    }
  }
}
`

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

type GraphqlError = { message?: string }

type GetSourceProductResponse = {
  data?: {
    product?: SourceProduct | null
    shop?: { myshopifyDomain?: string | null } | null
    publications?: {
      nodes?: Array<{ id?: string | null; name?: string | null } | null> | null
    } | null
  }
  errors?: GraphqlError[]
}

type ProductSetResponse = {
  data?: {
    productSet?: {
      product?: { id: string; handle: string } | null
      userErrors?: Array<{ field?: string[] | null; message: string }> | null
    } | null
  }
  errors?: GraphqlError[]
}

type PublishProductResponse = {
  data?: {
    publishablePublish?: {
      userErrors?: Array<{ field?: string[] | null; message: string }> | null
    } | null
  }
  errors?: GraphqlError[]
}

type LoadState = {
  product: SourceProduct | null
  channelId: string | null
  titleSuffix: string
}

async function adminGraphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const response = await fetch('shopify:admin/api/graphql.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables })
  })
  return (await response.json()) as T
}

function formatUserErrors(errors?: Array<{ field?: string[] | null; message: string }> | null): string[] {
  return (errors ?? []).map((error) =>
    error.field?.length ? `${error.field.join('.')}: ${error.message}` : error.message
  )
}

export default async () => {
  render(<Extension />, document.body)
}

function Extension() {
  const { close, data } = shopify
  const productId = data.selected?.[0]?.id

  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ id: string; handle: string } | null>(null)
  const [loadState, setLoadState] = useState<LoadState>({
    product: null,
    channelId: null,
    titleSuffix: ' Subscription'
  })

  const loadProduct = useCallback(async () => {
    if (!productId) {
      setError('未选中产品')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const json = await adminGraphql<GetSourceProductResponse>(GetSourceProductQuery, { id: productId })
      if (json.errors?.length) {
        throw new Error(json.errors.map((item) => item.message ?? 'GraphQL 错误').join('；'))
      }

      const product = json.data?.product
      if (!product) {
        throw new Error('未找到产品')
      }

      const channelId = json.data?.publications?.nodes?.find((node) => node?.name === 'Online Store')?.id ?? null

      setLoadState({
        product,
        channelId,
        titleSuffix: titleSuffixForShop(json.data?.shop?.myshopifyDomain)
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载产品失败')
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => {
    void loadProduct()
  }, [loadProduct])

  const createVirtualProduct = useCallback(async () => {
    const product = loadState.product
    if (!product || creating || created) return

    if (product.tags?.includes(VIRTUAL_PRODUCT_TAG)) {
      setError('该产品已是虚拟滤芯订阅产品')
      return
    }

    setCreating(true)
    setError(null)

    try {
      const input: VirtualProductCreateInput = {
        ...toVirtualProductInput(product),
        title: `${product.title}${loadState.titleSuffix}`
      }

      const createJson = await adminGraphql<ProductSetResponse>(CreateProductMutation, { input })
      if (createJson.errors?.length) {
        throw new Error(createJson.errors.map((item) => item.message ?? 'GraphQL 错误').join('；'))
      }

      const productSet = createJson.data?.productSet
      const createErrors = formatUserErrors(productSet?.userErrors)
      if (createErrors.length > 0) {
        throw new Error(createErrors.join('；'))
      }

      const newProduct = productSet?.product
      if (!newProduct) {
        throw new Error('创建虚拟产品失败')
      }

      if (loadState.channelId) {
        const publishJson = await adminGraphql<PublishProductResponse>(PublishProductMutation, {
          id: newProduct.id,
          input: [{ publicationId: loadState.channelId }]
        })
        const publishErrors = formatUserErrors(publishJson.data?.publishablePublish?.userErrors)
        if (publishJson.errors?.length || publishErrors.length > 0) {
          const messages = [
            ...(publishJson.errors?.map((item) => item.message ?? 'GraphQL 错误') ?? []),
            ...publishErrors
          ]
          setCreated(newProduct)
          setError(`已创建，但发布到 Online Store 失败：${messages.join('；')}`)
          return
        }
      }

      setCreated(newProduct)
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建虚拟产品失败')
    } finally {
      setCreating(false)
    }
  }, [created, creating, loadState])

  const previewHandle = loadState.product ? `${loadState.product.handle}-subscribe` : ''
  const previewTitle = loadState.product ? `${loadState.product.title}${loadState.titleSuffix}` : ''
  const isAlreadyVirtual = Boolean(loadState.product?.tags?.includes(VIRTUAL_PRODUCT_TAG))
  const variantCount = loadState.product?.variants?.nodes?.length ?? 0

  return (
    <s-admin-action heading="创建虚拟滤芯产品" loading={loading || creating}>
      {error ? (
        <s-banner tone="critical" heading="错误">
          {error}
        </s-banner>
      ) : null}

      {created ? (
        <s-banner tone="success" heading="创建成功">
          <s-stack gap="small">
            <s-text>虚拟产品已创建：{created.handle}</s-text>
            <s-link href={`shopify:admin/products/${created.id.split('/').pop()}`}>打开产品</s-link>
          </s-stack>
        </s-banner>
      ) : null}

      {!loading && loadState.product && !created ? (
        <s-stack gap="base">
          <s-paragraph>
            将当前产品复制为未上架的虚拟滤芯订阅产品，并为每个变体写入 related_filter metafield。
          </s-paragraph>
          {isAlreadyVirtual ? <s-banner tone="warning">该产品已是虚拟滤芯订阅产品</s-banner> : null}
          <s-section heading="预览">
            <s-stack gap="small">
              <s-text type="strong">{previewTitle}</s-text>
              <s-text color="subdued">handle：{previewHandle}</s-text>
              <s-text color="subdued">变体数：{variantCount}</s-text>
              <s-text color="subdued">tag：{VIRTUAL_PRODUCT_TAG}</s-text>
            </s-stack>
          </s-section>
        </s-stack>
      ) : null}

      {loading ? <s-spinner accessibilityLabel="正在加载产品" /> : null}

      <s-button
        slot="primary-action"
        variant="primary"
        loading={creating}
        disabled={loading || creating || !loadState.product || isAlreadyVirtual || Boolean(created)}
        onClick={() => void createVirtualProduct()}
      >
        创建虚拟产品
      </s-button>
      <s-button slot="secondary-actions" onClick={() => close()} disabled={creating}>
        {created ? '完成' : '关闭'}
      </s-button>
    </s-admin-action>
  )
}
