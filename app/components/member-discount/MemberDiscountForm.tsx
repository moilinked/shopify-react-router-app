import { useMemo, useState } from 'react'
import { useAppBridge } from '@shopify/app-bridge-react'
import { DateTimeField } from '~/components/activities/DateTimeField'
import { useCurrencySymbol } from '~/hooks/useCurrencySymbol'
import type {
  DiscountUserError,
  MemberDiscountFormState,
  ProductScope,
  PurchaseType,
  RequirementType,
  SelectedProduct,
  TierRow
} from '~/types/memberDiscount'
import { createEmptyTier, tiersToConfiguration } from '~/types/memberDiscount'

type Props = {
  initialData: MemberDiscountFormState
  isEditing?: boolean
  isSubmitting?: boolean
  errors?: DiscountUserError[]
  onSubmit: (form: MemberDiscountFormState) => void
  onDiscard: () => void
}

function getVariantCount(product: SelectedProduct): number {
  if (typeof product.totalVariants === 'number') return product.totalVariants
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

function mapPickerProducts(results: unknown[]): SelectedProduct[] {
  return (results as any[]).map((item) => {
    const variants = Array.isArray(item.variants)
      ? item.variants.map((variant: any) => ({
          id: String(variant.id),
          title: String(variant.title ?? 'Default Title')
        }))
      : undefined
    const totalVariants =
      typeof item.totalVariants === 'number'
        ? item.totalVariants
        : typeof item.totalVariants?.count === 'number'
          ? item.totalVariants.count
          : variants?.length
    return {
      id: String(item.id),
      title: String(item.title ?? ''),
      image: item.images?.[0]?.originalSrc || item.image?.originalSrc || undefined,
      variants,
      totalVariants
    }
  })
}

function generateRandomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 10; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export function MemberDiscountForm({
  initialData,
  isEditing = false,
  isSubmitting = false,
  errors = [],
  onSubmit,
  onDiscard
}: Props) {
  const shopify = useAppBridge()
  const currencySymbol = useCurrencySymbol()
  const [form, setForm] = useState<MemberDiscountFormState>(initialData)
  const [searchQuery, setSearchQuery] = useState('')

  const validTiers = useMemo(() => tiersToConfiguration(form.tiers), [form.tiers])
  const canSave =
    (form.method === 'CODE' ? form.code.trim().length > 0 : form.title.trim().length > 0) &&
    validTiers.length > 0 &&
    (form.productScope === 'ALL_PRODUCTS' || form.productIds.length > 0) &&
    (form.requirement.type === 'NONE' || (Number(form.requirement.value) || 0) > 0)

  const update = <K extends keyof MemberDiscountFormState>(key: K, value: MemberDiscountFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const updateTiers = (tiers: TierRow[]) => update('tiers', tiers)

  const handleProductPick = async () => {
    const result = await shopify.resourcePicker({
      type: 'product',
      action: 'select',
      multiple: true,
      ...(searchQuery.trim() ? { query: searchQuery.trim() } : {}),
      ...(form.productSelections.length > 0
        ? {
            selectionIds: form.productSelections.map((product) => ({
              id: product.id,
              ...(product.variants?.length ? { variants: product.variants.map((v) => ({ id: v.id })) } : {})
            }))
          }
        : {})
    })
    if (!result) return
    const products = mapPickerProducts(result as unknown[])
    update('productSelections', products)
    update('productIds', getSelectedProductIds(products))
  }

  const removeProduct = (productId: string) => {
    const next = form.productSelections.filter((product) => product.id !== productId)
    update('productSelections', next)
    update('productIds', getSelectedProductIds(next))
  }

  const getSelectedVariantsLabel = (product: SelectedProduct) => {
    if (!product.variants?.length) return '全部变体'
    if (product.variants.length === 1) return product.variants[0].title
    return `${product.variants.length} 个变体已选`
  }

  const summaryLines = [
    form.method === 'CODE' ? `折扣码：${form.code || '—'}` : `自动折扣：${form.title || '—'}`,
    '产品折扣 · 会员 VIP 固定金额',
    form.productScope === 'ALL_PRODUCTS' ? '适用于所有产品' : `适用于 ${form.productIds.length} 个产品/变体`,
    `${validTiers.length} 条会员等级规则`,
    form.requirement.type === 'NONE'
      ? '无最低购买要求'
      : form.requirement.type === 'SUBTOTAL'
        ? `最低购买金额 ${currencySymbol}${form.requirement.value ?? 0}`
        : `最低商品数量 ${form.requirement.value ?? 0}`,
    form.method === 'CODE'
      ? form.usageLimitEnabled
        ? `总使用次数上限 ${form.usageLimit ?? '—'}`
        : '不限制总使用次数'
      : '自动折扣无总使用次数限制'
  ]

  return (
    <s-page heading={isEditing ? '编辑会员 VIP 折扣' : '创建会员 VIP 折扣'}>
      <s-link slot="breadcrumb-actions" href="/app/member-discount">
        会员折扣
      </s-link>
      <s-button slot="secondary-actions" variant="secondary" onClick={onDiscard} disabled={isSubmitting || undefined}>
        放弃
      </s-button>
      <s-button
        slot="primary-action"
        variant="primary"
        onClick={() => onSubmit(form)}
        disabled={!canSave || isSubmitting || undefined}
      >
        {isSubmitting ? '保存中...' : '保存'}
      </s-button>

      <s-box padding="large">
        <s-grid gridTemplateColumns="1fr 320px" gap="large" alignItems="start">
          <s-stack gap="base">
            {errors.length > 0 ? (
              <s-banner tone="critical">{errors.map((error) => error.message).join('；')}</s-banner>
            ) : null}

            <s-section heading={form.method === 'CODE' ? '折扣码' : '自动折扣'}>
              <s-stack gap="base">
                {!isEditing ? (
                  <s-select
                    label="方式"
                    value={form.method}
                    onChange={(event: Event) =>
                      update('method', (event.currentTarget as HTMLSelectElement).value as 'CODE' | 'AUTOMATIC')
                    }
                  >
                    <s-option value="CODE">折扣码</s-option>
                    <s-option value="AUTOMATIC">自动折扣</s-option>
                  </s-select>
                ) : null}

                {form.method === 'CODE' ? (
                  <s-stack gap="small">
                    <s-text-field
                      label="折扣码"
                      value={form.code}
                      placeholder="例如：VIP-MEMBER"
                      onInput={(event: Event) => {
                        const code = (event.currentTarget as HTMLInputElement).value
                        update('code', code)
                        update('title', code)
                      }}
                    />
                    <s-button variant="tertiary" onClick={() => update('code', generateRandomCode())}>
                      生成随机码
                    </s-button>
                    <s-text tone="neutral">顾客需在结账时输入此折扣码。</s-text>
                  </s-stack>
                ) : (
                  <s-text-field
                    label="标题"
                    value={form.title}
                    placeholder="例如：会员 VIP 产品折扣"
                    onInput={(event: Event) => update('title', (event.currentTarget as HTMLInputElement).value)}
                  />
                )}
              </s-stack>
            </s-section>

            <s-section heading="折扣值">
              <s-stack gap="base">
                <s-banner tone="info">
                  折扣金额由下方「会员身份验证」中的 VIP 等级规则决定（匹配 Smile `vip_tier_name`）。
                </s-banner>

                <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                  <s-select
                    label="适用于"
                    value={form.productScope}
                    onChange={(event: Event) => {
                      const scope = (event.currentTarget as HTMLSelectElement).value as ProductScope
                      update('productScope', scope)
                      if (scope === 'ALL_PRODUCTS') {
                        update('productIds', [])
                        update('productSelections', [])
                      }
                    }}
                  >
                    <s-option value="ALL_PRODUCTS">所有产品</s-option>
                    <s-option value="FIXED_VARIANTS">特定产品</s-option>
                  </s-select>

                  <s-select
                    label="购买类型"
                    value={form.purchaseType}
                    onChange={(event: Event) =>
                      update('purchaseType', (event.currentTarget as HTMLSelectElement).value as PurchaseType)
                    }
                  >
                    <s-option value="BOTH">一次性购买与订阅</s-option>
                    <s-option value="ONE_TIME">一次性购买</s-option>
                    <s-option value="SUBSCRIPTION">订阅</s-option>
                  </s-select>
                </s-grid>

                {form.productScope === 'FIXED_VARIANTS' ? (
                  <s-stack gap="small-300">
                    <s-grid gridTemplateColumns="1fr auto" gap="small-300" alignItems="end">
                      <s-text-field
                        label=""
                        value={searchQuery}
                        placeholder="搜索产品"
                        icon="search"
                        onInput={(event: Event) => setSearchQuery((event.currentTarget as HTMLInputElement).value)}
                        {...({
                          onKeyPress: async (event: KeyboardEvent) => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              await handleProductPick()
                            }
                          }
                        } as any)}
                      />
                      <s-button variant="secondary" onClick={handleProductPick}>
                        浏览
                      </s-button>
                    </s-grid>
                    {!form.productIds.length ? <s-banner tone="critical">必须添加特定产品</s-banner> : null}
                    {form.productSelections.map((product) => (
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
                            onClick={() => removeProduct(product.id)}
                          >
                            ✕
                          </s-button>
                        </s-grid>
                      </s-box>
                    ))}
                  </s-stack>
                ) : null}

                <s-checkbox
                  label="每笔订单仅应用一次折扣"
                  checked={form.appliesOncePerOrder || undefined}
                  onChange={(event: Event) =>
                    update('appliesOncePerOrder', Boolean((event.currentTarget as HTMLInputElement).checked))
                  }
                />
                <s-text tone="neutral">
                  {form.appliesOncePerOrder
                    ? '选中后，符合条件的商品合计只减免一次固定金额。'
                    : '未选中时，每件符合条件的商品都会按固定金额减免。'}
                </s-text>
              </s-stack>
            </s-section>

            <s-section heading="会员身份验证">
              <s-stack gap="base">
                <s-text tone="neutral">
                  仅当登录顾客的 Smile 元字段 `smile.vip_tier_name` 与下方等级名匹配时，才应用对应固定金额折扣。
                </s-text>
                {form.tiers.map((tier, index) => (
                  <s-stack key={tier.id} gap="base">
                    {index > 0 ? <s-divider /> : null}
                    <s-stack direction="inline" gap="base" alignItems="end">
                      <s-text-field
                        label="VIP 等级名"
                        value={tier.tierName}
                        placeholder="与 smile.vip_tier_name 一致"
                        onInput={(event: Event) => {
                          const next = [...form.tiers]
                          next[index] = { ...tier, tierName: (event.currentTarget as HTMLInputElement).value }
                          updateTiers(next)
                        }}
                      />
                      <s-grid gridTemplateColumns="1fr 1fr" gap="small-300" alignItems="end">
                        <s-select
                          label="折扣力度"
                          value={tier.valueType}
                          onChange={(event: Event) => {
                            const next = [...form.tiers]
                            next[index] = {
                              ...tier,
                              valueType: (event.currentTarget as HTMLSelectElement).value as
                                | 'FIXED_AMOUNT'
                                | 'PERCENTAGE'
                            }
                            updateTiers(next)
                          }}
                        >
                          <s-option value="PERCENTAGE">百分比</s-option>
                          <s-option value="FIXED_AMOUNT">固定金额</s-option>
                        </s-select>
                        <s-number-field
                          label={tier.valueType === 'PERCENTAGE' ? '百分比' : `金额 (${currencySymbol})`}
                          value={tier.amount}
                          min={0}
                          max={tier.valueType === 'PERCENTAGE' ? 100 : undefined}
                          step={tier.valueType === 'PERCENTAGE' ? 1 : 0.01}
                          suffix={tier.valueType === 'PERCENTAGE' ? '%' : undefined}
                          onInput={(event: Event) => {
                            const next = [...form.tiers]
                            next[index] = { ...tier, amount: (event.currentTarget as HTMLInputElement).value }
                            updateTiers(next)
                          }}
                        />
                      </s-grid>
                      <s-button
                        variant="tertiary"
                        tone="critical"
                        onClick={() => updateTiers(form.tiers.filter((row) => row.id !== tier.id))}
                        disabled={form.tiers.length <= 1 || undefined}
                      >
                        删除
                      </s-button>
                    </s-stack>
                    <s-text-field
                      label="结账显示文案"
                      value={tier.message}
                      placeholder="例如：VIP A -¥10"
                      onInput={(event: Event) => {
                        const next = [...form.tiers]
                        next[index] = { ...tier, message: (event.currentTarget as HTMLInputElement).value }
                        updateTiers(next)
                      }}
                    />
                  </s-stack>
                ))}
                <s-button onClick={() => updateTiers([...form.tiers, createEmptyTier()])}>添加等级</s-button>
              </s-stack>
            </s-section>

            <s-section heading="资格">
              <s-stack gap="small">
                <s-text>所有客户</s-text>
                <s-text tone="neutral">
                  Shopify 侧对所有客户开放；实际是否减免由「会员身份验证」中的 VIP 等级匹配决定。
                </s-text>
              </s-stack>
            </s-section>

            <s-section heading="最低购买要求">
              <s-stack gap="base">
                <s-choice-list
                  label="最低购买要求"
                  name="requirementType"
                  onChange={(event: Event) => {
                    const values = (event.currentTarget as any).values as string[]
                    const type = (values?.[0] ?? 'NONE') as RequirementType
                    update('requirement', {
                      type,
                      value: type === 'NONE' ? undefined : (form.requirement.value ?? 0)
                    })
                  }}
                >
                  <s-choice value="NONE" selected={form.requirement.type === 'NONE' || undefined}>
                    无最低要求
                  </s-choice>
                  <s-choice value="SUBTOTAL" selected={form.requirement.type === 'SUBTOTAL' || undefined}>
                    {`最低购买金额 (${currencySymbol})`}
                  </s-choice>
                  <s-choice value="QUANTITY" selected={form.requirement.type === 'QUANTITY' || undefined}>
                    最低商品数量
                  </s-choice>
                </s-choice-list>
                {form.requirement.type !== 'NONE' ? (
                  <s-box inlineSize="200px">
                    <s-number-field
                      label={form.requirement.type === 'QUANTITY' ? '数量' : '金额'}
                      min={0}
                      value={String(form.requirement.value ?? 0)}
                      onInput={(event: Event) =>
                        update('requirement', {
                          type: form.requirement.type,
                          value: Number((event.currentTarget as HTMLInputElement).value)
                        })
                      }
                    />
                  </s-box>
                ) : null}
                <s-text tone="neutral">最低购买要求由 Function 在结账时校验（针对符合适用范围的商品）。</s-text>
              </s-stack>
            </s-section>

            {form.method === 'CODE' ? (
              <s-section heading="折扣最大使用次数">
                <s-stack gap="base">
                  <s-checkbox
                    label="限制此折扣可使用的总次数"
                    checked={form.usageLimitEnabled || undefined}
                    onChange={(event: Event) => {
                      const checked = Boolean((event.currentTarget as HTMLInputElement).checked)
                      update('usageLimitEnabled', checked)
                      if (checked && !form.usageLimit) update('usageLimit', 1)
                      if (!checked) update('usageLimit', null)
                    }}
                  />
                  {form.usageLimitEnabled ? (
                    <s-box inlineSize="200px">
                      <s-number-field
                        label="总次数"
                        min={1}
                        value={String(form.usageLimit ?? 1)}
                        onInput={(event: Event) =>
                          update('usageLimit', Number((event.currentTarget as HTMLInputElement).value) || 1)
                        }
                      />
                    </s-box>
                  ) : null}
                  <s-checkbox
                    label="每位客户限用一次"
                    checked={form.appliesOncePerCustomer || undefined}
                    onChange={(event: Event) =>
                      update('appliesOncePerCustomer', Boolean((event.currentTarget as HTMLInputElement).checked))
                    }
                  />
                </s-stack>
              </s-section>
            ) : null}

            <s-section heading="组合">
              <s-stack gap="small">
                <s-checkbox
                  label="产品折扣"
                  checked={form.combinesWith.productDiscounts || undefined}
                  onChange={(event: Event) =>
                    update('combinesWith', {
                      ...form.combinesWith,
                      productDiscounts: Boolean((event.currentTarget as HTMLInputElement).checked)
                    })
                  }
                />
                <s-checkbox
                  label="订单折扣"
                  checked={form.combinesWith.orderDiscounts || undefined}
                  onChange={(event: Event) =>
                    update('combinesWith', {
                      ...form.combinesWith,
                      orderDiscounts: Boolean((event.currentTarget as HTMLInputElement).checked)
                    })
                  }
                />
                <s-checkbox
                  label="运费折扣"
                  checked={form.combinesWith.shippingDiscounts || undefined}
                  onChange={(event: Event) =>
                    update('combinesWith', {
                      ...form.combinesWith,
                      shippingDiscounts: Boolean((event.currentTarget as HTMLInputElement).checked)
                    })
                  }
                />
              </s-stack>
            </s-section>

            <s-section heading="有效日期">
              <s-stack gap="base">
                <DateTimeField
                  label="开始日期与时间"
                  value={form.startsAt}
                  onChange={(value) => update('startsAt', value)}
                />
                <s-checkbox
                  label="设置结束日期"
                  checked={form.endsAtEnabled || undefined}
                  onChange={(event: Event) => {
                    const checked = Boolean((event.currentTarget as HTMLInputElement).checked)
                    update('endsAtEnabled', checked)
                    if (checked && !form.endsAt) update('endsAt', form.startsAt)
                    if (!checked) update('endsAt', null)
                  }}
                />
                {form.endsAtEnabled ? (
                  <DateTimeField
                    label="结束日期与时间"
                    value={form.endsAt ?? ''}
                    onChange={(value) => update('endsAt', value)}
                  />
                ) : null}
              </s-stack>
            </s-section>
          </s-stack>

          <s-stack gap="base">
            <s-section heading="摘要">
              <s-stack gap="small">
                <s-heading>
                  {form.method === 'CODE' ? form.code || '未命名折扣码' : form.title || '未命名折扣'}
                </s-heading>
                <s-badge tone="info">会员 VIP 产品折扣</s-badge>
                {summaryLines.map((line) => (
                  <s-text key={line} tone="neutral">
                    · {line}
                  </s-text>
                ))}
              </s-stack>
            </s-section>
          </s-stack>
        </s-grid>
      </s-box>
    </s-page>
  )
}
