import { useCallback, useEffect, useRef, useState } from 'react'
import type { LoaderFunctionArgs } from 'react-router'
import { useFetcher, useLoaderData, useLocation } from 'react-router'
import { useAppBridge } from '@shopify/app-bridge-react'
import { authenticate } from '~/shopify.server'
import {
  ProductTable,
  VirtualProductList,
  queryProductsByIds,
  queryVirtualProducts
} from '~/components/machine-subscribe/VirtualProductList'
import type { ProductRow } from '~/types/machineSubscribe'

interface LoaderData {
  virtualProducts: ProductRow[]
  products: ProductRow[]
  notFoundIds: string[]
  invalidIds: string[]
  queried: boolean
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

export const loader = async ({ request }: LoaderFunctionArgs): Promise<LoaderData> => {
  const { admin } = await authenticate.admin(request)
  const raw = new URL(request.url).searchParams.get('ids') ?? ''

  // ID 搜索请求（由 fetcher 触发）
  if (raw.trim()) {
    const { valid, invalid } = parseIds(raw)
    if (valid.length === 0) {
      return { virtualProducts: [], products: [], notFoundIds: [], invalidIds: invalid, queried: true }
    }
    const gids = valid.map((id) => `gid://shopify/Product/${id}`)
    const products = await queryProductsByIds(admin, gids)
    products.sort((a, b) => valid.indexOf(a.numericId) - valid.indexOf(b.numericId))
    const foundNumericIds = new Set(products.map((p) => p.numericId))
    const notFoundIds = valid.filter((id) => !foundNumericIds.has(id))
    return { virtualProducts: [], products, notFoundIds, invalidIds: invalid, queried: true }
  }

  // 初始加载：展示当前已创建的虚拟产品
  const virtualProducts = await queryVirtualProducts(admin)
  return { virtualProducts, products: [], notFoundIds: [], invalidIds: [], queried: false }
}

export default function MachineSubscribeIndex() {
  const shopify = useAppBridge()
  const { pathname } = useLocation()
  const { virtualProducts } = useLoaderData<typeof loader>()
  const fetcher = useFetcher<LoaderData>()
  const [value, setValue] = useState('')
  const fieldRef = useRef<HTMLElement | null>(null)

  const loading = fetcher.state !== 'idle'
  const data = fetcher.data

  const submit = useCallback(() => {
    const ids = value.trim()
    if (!ids) {
      shopify.toast.show('请输入产品 ID', { isError: true })
      return
    }
    fetcher.load(`${pathname}?ids=${encodeURIComponent(ids)}`)
  }, [value, pathname, fetcher, shopify])

  // s-text-field 不支持 onKeyDown，改为绑定原生 keydown 支持回车提交
  useEffect(() => {
    const el = fieldRef.current
    if (!el) return
    const onKeyDown = (event: Event) => {
      if ((event as KeyboardEvent).key === 'Enter') {
        event.preventDefault()
        submit()
      }
    }
    el.addEventListener('keydown', onKeyDown)
    return () => el.removeEventListener('keydown', onKeyDown)
  }, [submit])

  const products = data?.products ?? []

  return (
    <s-page heading="整机订购省-滤芯虚拟产品">
      <s-box padding="large">
        <s-stack gap="base">
          <s-section heading="滤芯查询">
            <s-stack direction="inline" gap="base" alignItems="end">
              <s-box inlineSize="100%">
                <s-text-field
                  ref={(el) => {
                    fieldRef.current = el
                  }}
                  label="产品 ID"
                  placeholder="输入产品数字 ID，用英文逗号分隔，例如：123,456,789"
                  value={value}
                  onInput={(e: Event) => setValue((e.target as HTMLInputElement).value)}
                />
              </s-box>
              <s-button variant="primary" onClick={submit} disabled={loading || undefined}>
                {loading ? '查询中...' : '确认'}
              </s-button>
            </s-stack>
          </s-section>

          {data && data.invalidIds.length > 0 && (
            <s-banner tone="warning" heading="已忽略非法 ID">
              <s-text>以下输入不是有效的数字 ID：{data.invalidIds.join('、')}</s-text>
            </s-banner>
          )}

          {data && data.notFoundIds.length > 0 && (
            <s-banner tone="warning" heading="部分产品未找到">
              <s-text>以下 ID 未查询到对应产品：{data.notFoundIds.join('、')}</s-text>
            </s-banner>
          )}

          {loading && <s-spinner accessibilityLabel="加载中" />}

          {!loading && data?.queried && products.length === 0 && (
            <s-box padding="large">
              <s-text tone="neutral">未查询到任何产品，请检查输入的产品 ID。</s-text>
            </s-box>
          )}

          {!loading && products.length > 0 && (
            <s-section accessibilityLabel="查询结果">
              <ProductTable products={products} />
            </s-section>
          )}

          <VirtualProductList products={virtualProducts} />
        </s-stack>
      </s-box>
    </s-page>
  )
}
