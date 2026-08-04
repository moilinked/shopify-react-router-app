import '@shopify/ui-extensions/preact'
import { render } from 'preact'
import { useEffect, useMemo, useRef, useState } from 'preact/hooks'

const METAFIELD_NAMESPACE = '$app'
const METAFIELD_KEY = 'function-configuration'

type ProductScope = 'ALL_PRODUCTS' | 'FIXED_VARIANTS'
type DiscountValueType = 'FIXED_AMOUNT' | 'PERCENTAGE'

type TierRow = {
  id: string
  tierName: string
  valueType: DiscountValueType
  amount: string
  message: string
}

type SelectedVariant = {
  id: string
  title: string
}

type SelectedProduct = {
  id: string
  title: string
  image?: string
  variants?: SelectedVariant[]
  totalVariants?: number | { count?: number }
}

type Configuration = {
  tiers: Array<{ tierName: string; valueType?: DiscountValueType; amount: number; message?: string }>
  productScope?: ProductScope
  productIds?: string[]
  productSelections?: SelectedProduct[]
}

function resolveValueType(value: unknown): DiscountValueType {
  return value === 'PERCENTAGE' ? 'PERCENTAGE' : 'FIXED_AMOUNT'
}

export default async () => {
  render(<App />, document.body)
}

function createEmptyTier(): TierRow {
  return {
    id: `tier-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tierName: '',
    valueType: 'FIXED_AMOUNT',
    amount: '10',
    message: ''
  }
}

function resolveProductScope(parsed: Partial<Configuration>): ProductScope {
  if (parsed.productScope === 'FIXED_VARIANTS' || parsed.productScope === 'ALL_PRODUCTS') {
    return parsed.productScope
  }
  // 兼容旧配置：已有 productIds 时视为固定变体
  return Array.isArray(parsed.productIds) && parsed.productIds.length > 0 ? 'FIXED_VARIANTS' : 'ALL_PRODUCTS'
}

function parseConfiguration(value: string | undefined): Configuration {
  try {
    const parsed = value ? (JSON.parse(value) as Partial<Configuration>) : {}
    return {
      tiers: Array.isArray(parsed.tiers) ? parsed.tiers : [],
      productScope: resolveProductScope(parsed),
      productIds: Array.isArray(parsed.productIds) ? parsed.productIds.filter((id) => typeof id === 'string') : [],
      productSelections: Array.isArray(parsed.productSelections)
        ? parsed.productSelections.filter(
            (product): product is SelectedProduct =>
              Boolean(product) &&
              typeof product.id === 'string' &&
              typeof product.title === 'string' &&
              (!product.variants ||
                (Array.isArray(product.variants) &&
                  product.variants.every(
                    (variant) => typeof variant.id === 'string' && typeof variant.title === 'string'
                  )))
          )
        : []
    }
  } catch {
    return { tiers: [], productScope: 'ALL_PRODUCTS', productIds: [], productSelections: [] }
  }
}

function toTierRows(configuration: Configuration): TierRow[] {
  const tiers = configuration.tiers
  if (!tiers.length) {
    return [createEmptyTier()]
  }
  return tiers.map((tier, index) => ({
    id: `tier-${index}-${tier.tierName || 'row'}`,
    tierName: String(tier.tierName ?? ''),
    valueType: resolveValueType(tier.valueType),
    amount: String(tier.amount ?? ''),
    message: String(tier.message ?? '')
  }))
}

function toConfiguration(tiers: TierRow[]): Configuration {
  return {
    tiers: tiers
      .map((tier) => {
        const valueType = resolveValueType(tier.valueType)
        const amount = Number(tier.amount)
        return {
          tierName: tier.tierName.trim(),
          valueType,
          amount,
          message: tier.message.trim() || undefined
        }
      })
      .filter((tier) => {
        if (!tier.tierName || !Number.isFinite(tier.amount) || tier.amount <= 0) return false
        if (tier.valueType === 'PERCENTAGE' && tier.amount > 100) return false
        return true
      })
  }
}

function getVariantCount(product: SelectedProduct): number {
  if (typeof product.totalVariants === 'number') return product.totalVariants
  if (product.totalVariants && typeof product.totalVariants.count === 'number') return product.totalVariants.count
  return product.variants?.length ?? 1
}

function getSelectedProductIds(products: SelectedProduct[]): string[] {
  return Array.from(
    new Set(
      products.flatMap((product) => {
        const variantIds = product.variants?.map((variant) => variant.id) ?? []
        return variantIds.length > 0 && variantIds.length < getVariantCount(product) ? variantIds : [product.id]
      })
    )
  )
}

function buildSelectionFingerprint(scope: ProductScope, productIds: string[]): string {
  return JSON.stringify({ scope, productIds })
}

function getResourceImageUrl(product: Record<string, unknown>): string | undefined {
  const image = product.image as { originalSrc?: unknown } | undefined
  if (typeof image?.originalSrc === 'string') return image.originalSrc

  const images = product.images as Array<{ originalSrc?: unknown }> | undefined
  return typeof images?.[0]?.originalSrc === 'string' ? images[0].originalSrc : undefined
}

function mapPickerProducts(results: unknown[]): SelectedProduct[] {
  return results
    .filter((result): result is Record<string, unknown> => Boolean(result) && typeof result === 'object')
    .filter((result) => typeof result.id === 'string')
    .map((result) => {
      const variants = Array.isArray(result.variants)
        ? result.variants
            .filter(
              (variant): variant is Record<string, unknown> =>
                Boolean(variant) && typeof variant === 'object' && typeof variant.id === 'string'
            )
            .map((variant) => ({
              id: variant.id as string,
              title: typeof variant.title === 'string' ? variant.title : '未命名变体'
            }))
        : []

      return {
        id: result.id as string,
        title: typeof result.title === 'string' ? result.title : '未命名产品',
        image: getResourceImageUrl(result),
        variants,
        totalVariants: result.totalVariants as number | { count?: number } | undefined
      }
    })
}

function App() {
  const { applyMetafieldChange, i18n, data, discounts } = shopify
  const [error, setError] = useState<string>()
  const [ensuringProductClass, setEnsuringProductClass] = useState(true)
  const fingerprintFieldRef = useRef<HTMLInputElement | null>(null)

  const metafieldValue = useMemo(() => {
    const configuredMetafield = data?.metafields?.find(
      (metafield) => metafield.key === METAFIELD_KEY && metafield.namespace === METAFIELD_NAMESPACE
    )
    return configuredMetafield?.value ?? data?.metafields?.find((metafield) => metafield.key === METAFIELD_KEY)?.value
  }, [data?.metafields])

  const initialConfiguration = useMemo(() => parseConfiguration(metafieldValue), [metafieldValue])
  const initialTiers = useMemo(() => toTierRows(initialConfiguration), [initialConfiguration])
  const initialFingerprint = useMemo(
    () =>
      buildSelectionFingerprint(
        initialConfiguration.productScope ?? 'ALL_PRODUCTS',
        initialConfiguration.productIds ?? []
      ),
    [initialConfiguration]
  )

  const [tiers, setTiers] = useState<TierRow[]>(initialTiers)
  const [productScope, setProductScope] = useState<ProductScope>(initialConfiguration.productScope ?? 'ALL_PRODUCTS')
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(initialConfiguration.productIds ?? [])
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>(
    initialConfiguration.productSelections ?? []
  )
  const [selectionFingerprint, setSelectionFingerprint] = useState(initialFingerprint)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    setTiers(initialTiers)
    setProductScope(initialConfiguration.productScope ?? 'ALL_PRODUCTS')
    setSelectedProductIds(initialConfiguration.productIds ?? [])
    setSelectedProducts(initialConfiguration.productSelections ?? [])
    setSelectionFingerprint(initialFingerprint)
    setSearchQuery('')
  }, [initialConfiguration, initialFingerprint, initialTiers])

  useEffect(() => {
    const ensureProductOnly = async () => {
      setEnsuringProductClass(true)
      const current = discounts?.discountClasses?.value ?? []
      const isProductOnly = current.length === 1 && current.includes('product')
      if (!isProductOnly && discounts?.updateDiscountClasses) {
        const result = await discounts.updateDiscountClasses(['product'])
        if (!result?.success) {
          setError(i18n.translate('error'))
        }
      }
      setEnsuringProductClass(false)
    }
    void ensureProductOnly()
  }, [discounts, i18n])

  /**
   * Function Settings 仅在“带 name 的表单控件”发生变更时启用保存按钮。
   * resourcePicker / 自定义按钮不会触发 dirty，因此同步更新隐藏字段并派发 change。
   */
  const markSettingsDirty = (nextFingerprint: string) => {
    setSelectionFingerprint(nextFingerprint)
    const field = fingerprintFieldRef.current
    if (!field) return
    field.value = nextFingerprint
    field.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
    field.dispatchEvent(new Event('change', { bubbles: true, composed: true }))
  }

  const updateTier = (id: string, field: keyof Omit<TierRow, 'id'>, value: string) => {
    setTiers((previous) => previous.map((tier) => (tier.id === id ? { ...tier, [field]: value } : tier)))
  }

  const addTier = () => {
    setTiers((previous) => [...previous, createEmptyTier()])
  }

  const removeTier = (id: string) => {
    setTiers((previous) => {
      const next = previous.filter((tier) => tier.id !== id)
      return next.length ? next : [createEmptyTier()]
    })
  }

  const resetForm = () => {
    setTiers(initialTiers)
    setProductScope(initialConfiguration.productScope ?? 'ALL_PRODUCTS')
    setSelectedProductIds(initialConfiguration.productIds ?? [])
    setSelectedProducts(initialConfiguration.productSelections ?? [])
    setSelectionFingerprint(initialFingerprint)
    setSearchQuery('')
    setError(undefined)
  }

  const applyExtensionMetafieldChange = async () => {
    const isFixed = productScope === 'FIXED_VARIANTS'
    const result = await applyMetafieldChange({
      type: 'updateMetafield',
      namespace: METAFIELD_NAMESPACE,
      key: METAFIELD_KEY,
      value: JSON.stringify({
        ...initialConfiguration,
        ...toConfiguration(tiers),
        productScope,
        productIds: isFixed ? selectedProductIds : [],
        productSelections: isFixed ? selectedProducts : [],
        collectionIds: []
      }),
      valueType: 'json'
    })

    if (result.type === 'error') {
      setError(result.message)
      return
    }

    setError(undefined)
  }

  const handleProductPick = async () => {
    const result = await shopify.resourcePicker({
      type: 'product',
      action: 'select',
      multiple: true,
      ...(searchQuery.trim() ? { query: searchQuery.trim() } : {}),
      ...(selectedProducts.length > 0
        ? {
            selectionIds: selectedProducts.map((product) => ({
              id: product.id,
              ...(product.variants?.length ? { variants: product.variants } : {})
            }))
          }
        : {})
    })
    if (!result) return

    const products = mapPickerProducts(result as unknown[])
    const productIds = getSelectedProductIds(products)
    setSelectedProducts(products)
    setSelectedProductIds(productIds)
    markSettingsDirty(buildSelectionFingerprint('FIXED_VARIANTS', productIds))
  }

  const removeSelectedProduct = (productId: string) => {
    const nextProducts = selectedProducts.filter((product) => product.id !== productId)
    const productIds = getSelectedProductIds(nextProducts)
    setSelectedProducts(nextProducts)
    setSelectedProductIds(productIds)
    markSettingsDirty(buildSelectionFingerprint(productScope, productIds))
  }

  const updateProductScope = (event: Event) => {
    const nextScope = (event.currentTarget as HTMLSelectElement).value as ProductScope
    const scope: ProductScope = nextScope === 'FIXED_VARIANTS' ? 'FIXED_VARIANTS' : 'ALL_PRODUCTS'
    setProductScope(scope)
    const nextIds = scope === 'FIXED_VARIANTS' ? selectedProductIds : []
    markSettingsDirty(buildSelectionFingerprint(scope, nextIds))
  }

  const getSelectedVariantsLabel = (product: SelectedProduct) => {
    if (!product.variants?.length) return '全部变体'
    if (product.variants.length === 1) return product.variants[0].title
    return `${product.variants.length} 个变体已选`
  }

  if (ensuringProductClass) {
    return <s-text>{i18n.translate('loading')}</s-text>
  }

  return (
    <s-function-settings
      onSubmit={(event) => {
        event.waitUntil?.(applyExtensionMetafieldChange())
      }}
      onReset={resetForm}
    >
      <s-stack gap="base">
        {error ? <s-banner tone="critical">{error}</s-banner> : null}

        <s-text></s-text>
        {/* 隐藏命名字段：用于让 Function Settings 识别 resourcePicker 等非表单控件的变更 */}
        <input
          {...({ ref: fingerprintFieldRef } as any)}
          name="productSelectionFingerprint"
          label="productSelectionFingerprint"
          value={selectionFingerprint}
          defaultValue={initialFingerprint}
          style={{ display: 'none' }}
        />

        <s-section heading="适用产品">
          <s-stack gap="base">
            <s-select label="适用于" name="productScope" value={productScope} onChange={updateProductScope}>
              <s-option value="ALL_PRODUCTS">所有产品</s-option>
              <s-option value="FIXED_VARIANTS">特定产品</s-option>
            </s-select>

            {productScope === 'FIXED_VARIANTS' ? (
              <s-stack gap="small-300">
                <s-grid gridTemplateColumns="1fr auto" gap="small-300" alignItems="end">
                  <s-text-field
                    label=""
                    name="productSearchQuery"
                    value={selectedProductIds.join(',')}
                    placeholder="搜索产品"
                    icon="search"
                    onFocus={async () => {
                      await handleProductPick()
                    }}
                  />
                  <s-button variant="secondary" onClick={handleProductPick}>
                    浏览
                  </s-button>
                </s-grid>

                {!selectedProductIds.length ? (
                  <s-banner tone="warning">请至少选择一个产品或变体，否则折扣不会生效。</s-banner>
                ) : null}

                {selectedProducts.length > 0 ? (
                  <s-stack gap="small">
                    {selectedProducts.map((product) => (
                      <s-box key={product.id} padding="small" borderWidth="base" borderRadius="small">
                        <s-grid gridTemplateColumns="auto 1fr auto" gap="small" alignItems="center">
                          {product.image ? (
                            <s-thumbnail src={product.image} alt={product.title} size="small" />
                          ) : (
                            <s-text tone="neutral">—</s-text>
                          )}
                          <s-stack gap="small-100">
                            <s-text>{product.title}</s-text>
                            <s-text tone="neutral">{getSelectedVariantsLabel(product)}</s-text>
                          </s-stack>
                          <s-button
                            variant="tertiary"
                            accessibilityLabel={`删除 ${product.title}`}
                            onClick={() => removeSelectedProduct(product.id)}
                          >
                            ✕
                          </s-button>
                        </s-grid>
                      </s-box>
                    ))}
                  </s-stack>
                ) : null}
              </s-stack>
            ) : (
              <s-text tone="neutral">当前折扣会应用于购物车中的全部产品。</s-text>
            )}
          </s-stack>
        </s-section>

        <s-divider />

        <s-section heading="VIP 规则">
          <s-stack gap="base">
            {tiers.map((tier, index) => (
              <s-stack key={tier.id} gap="base">
                {index > 0 ? <s-divider /> : null}
                <s-stack direction="inline" gap="base" alignItems="end">
                  <s-text-field
                    label="VIP 等级"
                    name={`tierName-${tier.id}`}
                    value={tier.tierName}
                    defaultValue={initialTiers.find((row) => row.id === tier.id)?.tierName ?? ''}
                    placeholder={i18n.translate('tierNamePlaceholder')}
                    onChange={(event) => updateTier(tier.id, 'tierName', event.currentTarget.value)}
                  />
                  <s-grid gridTemplateColumns="1fr 1fr" gap="small-300" alignItems="end">
                    <s-select
                      label="折扣力度"
                      name={`valueType-${tier.id}`}
                      value={tier.valueType}
                      onChange={(event: Event) =>
                        updateTier(
                          tier.id,
                          'valueType',
                          (event.currentTarget as HTMLSelectElement).value as DiscountValueType
                        )
                      }
                    >
                      <s-option value="PERCENTAGE">百分比</s-option>
                      <s-option value="FIXED_AMOUNT">固定金额</s-option>
                    </s-select>
                    <s-number-field
                      label={tier.valueType === 'PERCENTAGE' ? '百分比' : '金额'}
                      name={`amount-${tier.id}`}
                      value={tier.amount}
                      defaultValue={initialTiers.find((row) => row.id === tier.id)?.amount ?? '10'}
                      min={0}
                      max={tier.valueType === 'PERCENTAGE' ? 100 : undefined}
                      step={tier.valueType === 'PERCENTAGE' ? 1 : 0.01}
                      suffix={tier.valueType === 'PERCENTAGE' ? '%' : undefined}
                      onChange={(event) => updateTier(tier.id, 'amount', event.currentTarget.value)}
                    />
                  </s-grid>
                  <s-button
                    variant="tertiary"
                    tone="critical"
                    onClick={() => removeTier(tier.id)}
                    accessibilityLabel="删除"
                  >
                    删除规则
                  </s-button>
                </s-stack>
                <s-text-field
                  label="折扣文案"
                  name={`message-${tier.id}`}
                  value={tier.message}
                  defaultValue={initialTiers.find((row) => row.id === tier.id)?.message ?? ''}
                  placeholder={i18n.translate('messagePlaceholder')}
                  onChange={(event) => updateTier(tier.id, 'message', event.currentTarget.value)}
                />
              </s-stack>
            ))}

            {!toConfiguration(tiers).tiers.length ? <s-text tone="neutral">{i18n.translate('empty')}</s-text> : null}

            <s-button onClick={addTier}>{i18n.translate('addTier')}</s-button>
          </s-stack>
        </s-section>
      </s-stack>
    </s-function-settings>
  )
}
