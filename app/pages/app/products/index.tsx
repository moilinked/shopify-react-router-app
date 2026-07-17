import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { BusinessError } from '~/utils/http'
import { productApi, type Product } from '~/services/product'
import { useLoading } from '~/hooks/useLoading'
import { EmptyState } from '~/components/EmptyState'

export default function ProductsIndex() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const { loading, error, run } = useLoading()

  const fetchProducts = useCallback(async () => {
    const data = await run(() => productApi.getList({ page: 1, limit: 10 }))
    if (data) setProducts(data)
  }, [run])

  const deleteProduct = useCallback(async (id: string) => {
    try {
      await productApi.remove(id)
      setProducts((prev) => prev.filter((p) => p.id !== id))
      shopify.toast.show('Product deleted')
    } catch (e) {
      if (e instanceof BusinessError) {
        shopify.toast.show(`Delete failed: ${e.message}`, { isError: true })
      }
    }
  }, [])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  return (
    <s-section heading="Product list">
      <s-paragraph>
        Uses <code>productApi</code> + <code>useLoading</code> + <code>EmptyState</code> + <code>APP_CONFIG</code>.
      </s-paragraph>

      {loading && <s-paragraph>Loading...</s-paragraph>}

      <div className="text-red-500">test tailwindcss</div>

      {error && (
        <s-box padding="base" borderWidth="base" borderRadius="base">
          <s-paragraph>
            <s-badge tone="critical">{error.message}</s-badge>
          </s-paragraph>
          <s-button onClick={fetchProducts}>Retry</s-button>
        </s-box>
      )}

      {!loading && !error && products.length === 0 && (
        <EmptyState
          message="No products found (API not available yet -- this is expected in dev)."
          actionLabel="Retry fetch"
          onAction={fetchProducts}
        />
      )}

      <s-stack direction="block" gap="base">
        {products.map((product) => (
          <s-box key={product.id} padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="inline" gap="base">
              <s-text>{product.title}</s-text>
              <s-badge>{product.status}</s-badge>
              <s-button variant="tertiary" onClick={() => navigate(`/app/products/${product.id}`)}>
                View detail
              </s-button>
              <s-button variant="tertiary" tone="critical" onClick={() => deleteProduct(product.id)}>
                Delete
              </s-button>
            </s-stack>
          </s-box>
        ))}
      </s-stack>
    </s-section>
  )
}
