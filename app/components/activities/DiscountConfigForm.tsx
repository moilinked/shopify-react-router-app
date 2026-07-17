import type {
  DiscountConfig,
  DiscountType,
  PurchaseType,
  AppliesToType,
  RequirementType,
  CombinesWith,
  ExpirationDays
} from '~/types/activity'
import {
  DISCOUNT_TYPE_MAP,
  APPLIES_TO_TYPE_MAP,
  REQUIREMENT_TYPE_MAP,
  COMBINES_WITH_MAP,
  EXPIRATION_DAYS_MAP,
  PURCHASE_TYPE_MAP
} from '~/types/activity'
import { shouldShowPurchaseType } from '~/config'
import { useCurrencySymbol } from '~/hooks/useCurrencySymbol'
import { useResourcePicker } from '~/hooks/useResourcePicker'
import { useAppStore } from '~/stores/useAppStore'
import { ResourcePicker } from './ResourcePicker'

interface DiscountConfigFormProps {
  config: DiscountConfig
  onChange: (c: DiscountConfig) => void
  showAppliesTo: boolean
  readOnly: boolean
  getError?: (field: 'discount_value' | 'applies_to' | 'requirement_value') => string | undefined
}

export function DiscountConfigForm({
  config,
  onChange,
  showAppliesTo,
  readOnly = false,
  getError
}: DiscountConfigFormProps) {
  const currencySymbol = useCurrencySymbol()
  const shop = useAppStore((s) => s.shop)
  const showPurchaseType = shouldShowPurchaseType(shop)
  const appliesToType = config.applies_to?.type ?? 'PRODUCT'
  const appliesToIds = config.applies_to?.ids ?? []

  const updateField = <K extends keyof DiscountConfig>(key: K, value: DiscountConfig[K]) => {
    onChange({ ...config, [key]: value })
  }
  const {
    searchQuery,
    setSearchQuery,
    selectedResources,
    loadingSelectedResources,
    handleResourcePick,
    handleRemoveResource
  } = useResourcePicker({
    showAppliesTo,
    readOnly,
    appliesToType,
    appliesToIds,
    onAppliesToChange: (value) => updateField('applies_to', value)
  })

  return (
    <s-box padding="base" borderWidth="base" borderRadius="base">
      <s-section heading="折扣码设置">
        <s-stack gap="base">
          <s-box padding="small" borderWidth="base" borderRadius="base">
            <s-text-field
              label="折扣码前缀"
              value={config.prefix}
              disabled={readOnly || undefined}
              placeholder="例如：WDX16"
              onInput={(e: Event) => {
                updateField('prefix', (e.target as HTMLInputElement).value)
              }}
            />
            <s-text>只能支持数字和字母组合，使用时字母不区分大小写。</s-text>
          </s-box>

          <s-box padding="small" borderWidth="base" borderRadius="base">
            <s-stack gap="small">
              <s-heading>折扣值</s-heading>
              <s-grid gridTemplateColumns="2fr 1fr" gap="small">
                <s-select
                  label=""
                  value={config.discount.type}
                  disabled={readOnly || undefined}
                  onChange={(e: Event) =>
                    updateField('discount', {
                      ...config.discount,
                      type: (e.target as HTMLSelectElement).value as DiscountType
                    })
                  }
                >
                  {(Object.keys(DISCOUNT_TYPE_MAP) as DiscountType[]).map((t) => (
                    <s-option key={t} value={t}>
                      {DISCOUNT_TYPE_MAP[t]}
                    </s-option>
                  ))}
                </s-select>

                <s-number-field
                  label=""
                  min={0}
                  value={String(config.discount.value)}
                  disabled={readOnly || undefined}
                  required
                  error={getError?.('discount_value')}
                  suffix={config.discount.type === 'FIXED_AMOUNT' ? currencySymbol : '%'}
                  onInput={(e: Event) => {
                    updateField('discount', {
                      ...config.discount,
                      value: parseFloat((e.target as HTMLInputElement).value)
                    })
                  }}
                />
              </s-grid>

              <s-grid gridTemplateColumns="1fr 1fr" gap="small">
                {showAppliesTo && (
                  <s-select
                    label="适用于"
                    value={config.applies_to?.type ?? 'PRODUCT'}
                    disabled={readOnly || undefined}
                    onChange={(e: Event) => {
                      updateField('applies_to', {
                        type: (e.target as HTMLSelectElement).value as AppliesToType,
                        ids: []
                      })
                    }}
                  >
                    {(Object.keys(APPLIES_TO_TYPE_MAP) as AppliesToType[]).map((pt) => (
                      <s-option value={pt} key={pt}>
                        {APPLIES_TO_TYPE_MAP[pt]}
                      </s-option>
                    ))}
                  </s-select>
                )}
                {showPurchaseType && (
                  <s-select
                    label="购买类型"
                    value={config.discount?.purchase_type ?? 'ONE_TIME'}
                    disabled={readOnly || undefined}
                    onChange={(e: Event) =>
                      updateField('discount', {
                        ...config.discount,
                        purchase_type: (e.target as HTMLSelectElement).value as PurchaseType
                      })
                    }
                  >
                    {(Object.keys(PURCHASE_TYPE_MAP) as PurchaseType[]).map((pt) => (
                      <s-option value={pt} key={pt}>
                        {PURCHASE_TYPE_MAP[pt]}
                      </s-option>
                    ))}
                  </s-select>
                )}
              </s-grid>
              {showAppliesTo && (
                <ResourcePicker
                  appliesToType={appliesToType}
                  readOnly={readOnly}
                  searchQuery={searchQuery}
                  error={getError?.('applies_to')}
                  loading={loadingSelectedResources}
                  resources={selectedResources}
                  onSearchQueryChange={setSearchQuery}
                  onPick={handleResourcePick}
                  onRemove={handleRemoveResource}
                />
              )}
            </s-stack>
          </s-box>

          <s-box padding="small" borderWidth="base" borderRadius="base">
            <s-choice-list
              label="组合"
              name="combines_with"
              multiple
              disabled={readOnly || undefined}
              onChange={(e: Event) => {
                const target = e.currentTarget as any
                updateField('combines_with', target.values)
              }}
            >
              {(Object.keys(COMBINES_WITH_MAP) as CombinesWith[]).map((cw) => (
                <s-choice key={cw} value={cw} selected={config.combines_with.includes(cw) || undefined}>
                  {COMBINES_WITH_MAP[cw].name}
                  {config.combines_with.includes(cw) && <s-text slot="details">{COMBINES_WITH_MAP[cw].text}</s-text>}
                </s-choice>
              ))}
            </s-choice-list>
          </s-box>

          <s-box padding="small" borderWidth="base" borderRadius="base">
            <s-choice-list
              label="最低购买要求"
              name="type"
              disabled={readOnly || undefined}
              onChange={(e: Event) => {
                const target = e.currentTarget as any
                const selectedType = target.values[0] as RequirementType
                updateField('requirement', {
                  type: selectedType,
                  value: selectedType === 'NONE' ? undefined : (config.requirement.value ?? 0)
                })
              }}
            >
              {(Object.keys(REQUIREMENT_TYPE_MAP) as RequirementType[]).map((t) => (
                <s-choice key={t} value={t} selected={config.requirement.type === t || undefined}>
                  {REQUIREMENT_TYPE_MAP[t]}
                </s-choice>
              ))}
            </s-choice-list>

            {config.requirement.type !== 'NONE' && (
              <s-box inlineSize="150px">
                <s-number-field
                  label={config.requirement.type === 'QUANTITY' ? '最低订购量' : '最低购买金额'}
                  min={0}
                  disabled={readOnly || undefined}
                  value={String(config.requirement.value ?? 0)}
                  required
                  error={getError?.('requirement_value')}
                  onInput={(e: Event) => {
                    updateField('requirement', {
                      ...config.requirement,
                      value: parseFloat((e.target as HTMLInputElement).value)
                    })
                  }}
                />
              </s-box>
            )}
          </s-box>

          <s-box padding="small" borderWidth="base" borderRadius="base">
            <s-text>有效期限</s-text>
            <s-checkbox
              label="在经过一段时间后使已发放的奖励过期"
              checked={config.expiration.type === 'RELATIVE'}
              disabled={readOnly || undefined}
              onChange={(e: Event) => {
                const target = e.currentTarget as any
                const selectedType = target.checked
                updateField('expiration', {
                  type: selectedType ? 'RELATIVE' : 'NEVER',
                  days: selectedType ? (config.expiration.days ?? 'THREE_DAYS') : undefined
                })
              }}
            />

            {config.expiration.type === 'RELATIVE' && (
              <s-select
                label=""
                value={config.expiration.days ?? 'THREE_DAYS'}
                disabled={readOnly || undefined}
                onChange={(e: Event) => {
                  updateField('expiration', {
                    ...config.expiration,
                    days: (e.target as HTMLSelectElement).value as ExpirationDays
                  })
                }}
              >
                {(Object.keys(EXPIRATION_DAYS_MAP) as ExpirationDays[]).map((d) => (
                  <s-option key={d} value={d}>
                    {EXPIRATION_DAYS_MAP[d]}
                  </s-option>
                ))}
              </s-select>
            )}
          </s-box>
        </s-stack>
      </s-section>
    </s-box>
  )
}
