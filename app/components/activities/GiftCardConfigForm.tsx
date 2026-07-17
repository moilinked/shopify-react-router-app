import type { GiftCardConfig, ExpirationDays } from '~/types/activity'
import { EXPIRATION_DAYS_MAP } from '~/types/activity'
import { useCurrencySymbol } from '~/hooks/useCurrencySymbol'

interface GiftCardConfigFormProps {
  config: GiftCardConfig
  onChange: (c: GiftCardConfig) => void
  readOnly: boolean
  getError?: (field: 'gift_card_value') => string | undefined
}

export function GiftCardConfigForm({ config, onChange, readOnly = false, getError }: GiftCardConfigFormProps) {
  const currencySymbol = useCurrencySymbol()
  const updateField = <K extends keyof GiftCardConfig>(key: K, value: GiftCardConfig[K]) => {
    onChange({ ...config, [key]: value })
  }

  return (
    <s-box padding="base" borderWidth="base" borderRadius="base">
      <s-section heading="礼品卡设置">
        <s-stack gap="base">
          <s-stack>
            <s-text-field
              label="礼品卡码前缀"
              value={config.prefix}
              required
              disabled={readOnly || undefined}
              placeholder="例如：WDX16"
              onInput={(e: Event) => updateField('prefix', (e.target as HTMLInputElement).value)}
            />
            <s-text>只能支持数字和字母组合，使用时字母不区分大小写。</s-text>
          </s-stack>

          <s-number-field
            label={`礼品卡金额 (${currencySymbol})`}
            min={0}
            value={String(config.gift_card_value)}
            required
            disabled={readOnly || undefined}
            prefix={currencySymbol}
            error={getError?.('gift_card_value')}
            onInput={(e: Event) => updateField('gift_card_value', parseFloat((e.target as HTMLInputElement).value))}
          />

          <s-stack>
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
                onChange={(e: Event) =>
                  updateField('expiration', {
                    ...config.expiration,
                    days: (e.target as HTMLSelectElement).value as ExpirationDays
                  })
                }
              >
                {(Object.keys(EXPIRATION_DAYS_MAP) as ExpirationDays[]).map((d) => (
                  <s-option key={d} value={d}>
                    {EXPIRATION_DAYS_MAP[d]}
                  </s-option>
                ))}
              </s-select>
            )}
          </s-stack>
        </s-stack>
      </s-section>
    </s-box>
  )
}
