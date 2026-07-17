import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  Prize,
  PrizeType,
  PrizeConfig,
  DiscountConfig,
  GiftCardConfig,
  PointsConfig,
  FrequencyUnit
} from '~/types/activity'
import { shouldShowPurchaseType } from '~/config'
import { PRIZE_TYPE_MAP, FREQUENCY_UNIT_MAP } from '~/types/activity'
import { useAppStore } from '~/stores/useAppStore'
import { DiscountConfigForm } from './DiscountConfigForm'
import { GiftCardConfigForm } from './GiftCardConfigForm'
import { PointsConfigForm } from './PointsConfigForm'
import { ImageUploadField } from '~/components/ImageUploadField'
import { RichTextEditorField } from '~/components/activities/RichTextEditorField'
import { validatePrizeForm, isPrizeFormValid, type PrizeValidationErrors } from '~/utils/validation'

interface PrizeFormProps {
  prize?: Prize
  onSave: (prize: Prize) => void
  onCancel: () => void
  readOnly?: boolean
  lockPrizeType?: boolean
}

const createEmptyPrize = (): Prize => ({
  prize_type: 'NO_PRIZE',
  prize_name: '',
  prize_image: '',
  winning_rate: 0,
  draw_limit: false,
  inventory: null,
  config: {},
  winning_pop_up_message: '',
  winning_pop_up_cta_text: '',
  winning_pop_up_cta_url: ''
})

const CONFIG_TOUCHED_FIELD_MAP = {
  prefix: 'prefix',
  discount: 'discount_value',
  applies_to: 'applies_to',
  requirement: 'requirement_value',
  gift_card_value: 'gift_card_value',
  expiration: 'expiration_days',
  point_value: 'point_value',
  point_description: 'point_description'
} as const

/**
 * 获取默认配置
 * @param type 奖品类型
 * @returns 默认配置
 */
function getDefaultConfig(type: PrizeType, shop: string): PrizeConfig {
  const purchase_type = shouldShowPurchaseType(shop) ? ('ONE_TIME' as const) : undefined

  switch (type) {
    case 'PRODUCT_DISCOUNT_CODE':
      return {
        prefix: '',
        discount: { type: 'PERCENTAGE', value: 0, purchase_type },
        applies_to: { type: 'PRODUCT', ids: [] },
        requirement: { type: 'NONE' },
        combines_with: [],
        expiration: { type: 'NEVER' }
      }
    case 'ORDER_DISCOUNT_CODE':
      return {
        prefix: '',
        discount: { type: 'PERCENTAGE', value: 0, purchase_type },
        requirement: { type: 'NONE' },
        combines_with: [],
        expiration: { type: 'NEVER' }
      }
    case 'GIFT_CARD':
      return {
        prefix: '',
        gift_card_value: 0,
        expiration: { type: 'NEVER' }
      }
    case 'POINTS':
      return { point_value: 0, point_description: '抽奖奖励' }
    default:
      return {}
  }
}

export function PrizeForm({ prize, onSave, onCancel, readOnly = false, lockPrizeType = false }: PrizeFormProps) {
  const shop = useAppStore((s) => s.shop)
  const [form, setForm] = useState<Prize>(prize ? { ...prize } : createEmptyPrize())
  const [uploading, setUploading] = useState(false)
  const [touched, setTouched] = useState<Set<keyof PrizeValidationErrors>>(new Set())
  const modalRef = useRef<any>(null)

  useEffect(() => {
    modalRef.current?.showOverlay()
  }, [])

  const errors = useMemo(() => validatePrizeForm(form), [form])

  /**
   * 更新表单
   * @param key 字段名
   * @param value 值
   */
  const patchForm = (patch: Partial<Prize>, touchedFields: (keyof PrizeValidationErrors)[] = []) => {
    setForm((prev) => {
      let next = { ...prev, ...patch }
      if ('draw_limit' in patch) {
        // 抽奖限制开关变化时，联动默认值/清空值，保证数据语义一致
        next = patch.draw_limit
          ? { ...next, draw_frequency_count: 7, draw_frequency_unit: 'DAY' }
          : { ...next, draw_frequency_count: undefined, draw_frequency_unit: undefined }
      }
      return next
    })

    if (touchedFields.length > 0) {
      setTouched((prev) => {
        const next = new Set(prev)
        touchedFields.forEach((field) => next.add(field))
        return next
      })
    }
  }

  const update = <K extends keyof Prize>(key: K, value: Prize[K]) => {
    patchForm({ [key]: value } as Partial<Prize>, [key as keyof PrizeValidationErrors])
  }

  const updateConfig = (config: PrizeConfig) => {
    const touchedFields = Object.entries(CONFIG_TOUCHED_FIELD_MAP).flatMap(([configKey, errorKey]) =>
      configKey in config ? [errorKey] : []
    )
    patchForm({ config }, touchedFields as (keyof PrizeValidationErrors)[])
  }

  /**
   * 处理奖品类型变化
   * @param type 奖品类型
   */
  const handleTypeChange = (type: PrizeType) => {
    const typeNoPrize = type === 'NO_PRIZE'
    setForm((prev) => ({
      ...prev,
      prize_type: type,
      config: getDefaultConfig(type, shop),
      draw_limit: typeNoPrize ? false : prev.draw_limit,
      inventory: typeNoPrize ? null : prev.inventory,
      draw_frequency_unit: typeNoPrize ? undefined : prev.draw_frequency_unit,
      draw_frequency_count: typeNoPrize ? undefined : prev.draw_frequency_count
    }))
  }

  const handleSave = () => {
    // Mark all fields as touched
    const allFields: (keyof PrizeValidationErrors)[] = [
      'prize_name',
      'prize_type',
      'winning_rate',
      'winning_pop_up_message',
      'winning_pop_up_cta_text'
    ]
    if (form.prize_type !== 'NO_PRIZE') {
      allFields.push('inventory')
    }
    if (form.draw_limit) {
      allFields.push('draw_frequency_count')
    }
    if (form.prize_type === 'GIFT_CARD') {
      allFields.push('gift_card_value')
    }
    if (form.prize_type === 'PRODUCT_DISCOUNT_CODE') {
      allFields.push('discount_value', 'applies_to', 'requirement_value')
    }
    if (form.prize_type === 'ORDER_DISCOUNT_CODE') {
      allFields.push('discount_value', 'requirement_value')
    }
    if (form.prize_type === 'POINTS') {
      allFields.push('point_value', 'point_description')
    }
    setTouched(new Set(allFields))

    // Validate
    if (!isPrizeFormValid(form)) {
      const firstError = Object.values(errors)[0]
      shopify.toast.show(firstError || '请填写完整的奖品信息', { isError: true })
      return
    }

    modalRef.current?.hideOverlay()
    onSave(form)
  }

  const handleCancel = () => {
    modalRef.current?.hideOverlay()
    onCancel()
  }

  // 获取字段错误
  const getFieldError = (field: keyof PrizeValidationErrors): string | undefined =>
    touched.has(field) ? errors[field] : undefined

  const isFormValid = isPrizeFormValid(form)

  return (
    <s-modal
      ref={modalRef}
      id="prize-form-modal"
      heading={readOnly ? '查看奖项' : prize ? '编辑奖品' : '添加奖品'}
      size="base"
      onHide={onCancel}
    >
      <s-stack gap="large-200">
        {/* 基础设置 */}
        <s-box padding="base" borderWidth="base" borderRadius="base">
          <s-section heading="基础设置">
            <s-stack gap="base">
              <s-grid gridTemplateColumns="1fr 1fr" gap="small">
                <s-stack gap="small">
                  <s-stack>
                    <s-text-field
                      label="奖品名称"
                      value={form.prize_name}
                      required
                      placeholder="例如：10元优惠券"
                      disabled={readOnly || undefined}
                      error={getFieldError('prize_name')}
                      onInput={(e: Event) => update('prize_name', (e.target as HTMLInputElement).value)}
                    />
                    <s-text>客户可见</s-text>
                  </s-stack>
                  <s-select
                    label="奖品类型"
                    required
                    value={form.prize_type}
                    disabled={readOnly || lockPrizeType || undefined}
                    onChange={(e: Event) => handleTypeChange((e.target as HTMLSelectElement).value as PrizeType)}
                  >
                    {(Object.keys(PRIZE_TYPE_MAP) as PrizeType[]).map((t) => (
                      <s-option key={t} value={t}>
                        {PRIZE_TYPE_MAP[t]}
                      </s-option>
                    ))}
                  </s-select>
                  <s-number-field
                    label="中奖概率 (%)"
                    min={0}
                    max={100}
                    value={String(form.winning_rate)}
                    required
                    disabled={readOnly || undefined}
                    error={getFieldError('winning_rate')}
                    onInput={(e: Event) => {
                      const value = Number.parseFloat((e.target as HTMLInputElement).value)
                      update('winning_rate', Number.isNaN(value) ? 0 : Number(value.toFixed(2)))
                    }}
                  />
                </s-stack>
                <s-stack gap="small">
                  <ImageUploadField
                    label="奖品图片"
                    value={form.prize_image}
                    readOnly={readOnly}
                    onChange={(imageUrl) => update('prize_image', imageUrl)}
                    onUploadingChange={setUploading}
                    previewAlt="奖品图片"
                  />
                </s-stack>
              </s-grid>

              {form.prize_type !== 'NO_PRIZE' && (
                <>
                  <s-grid gridTemplateColumns="1fr 1fr" gap="small" alignItems="end">
                    <s-select
                      label="中奖数量限制"
                      required
                      value={form.draw_limit ? 'true' : 'false'}
                      disabled={readOnly || undefined}
                      onChange={(e: Event) => update('draw_limit', (e.target as HTMLSelectElement).value === 'true')}
                    >
                      <s-option value="false">无限制</s-option>
                      <s-option value="true">有限制</s-option>
                    </s-select>

                    {form.draw_limit && (
                      <s-stack direction="inline" gap="small-300" alignItems="center">
                        <s-text>每</s-text>
                        <s-box inlineSize="80px">
                          <s-select
                            label="频率单位"
                            labelAccessibilityVisibility="exclusive"
                            value={form.draw_frequency_unit}
                            disabled={readOnly || undefined}
                            onChange={(e: Event) =>
                              update('draw_frequency_unit', (e.target as HTMLSelectElement).value as FrequencyUnit)
                            }
                          >
                            {(Object.keys(FREQUENCY_UNIT_MAP) as FrequencyUnit[]).map((u) => (
                              <s-option key={u} value={u}>
                                {FREQUENCY_UNIT_MAP[u]}
                              </s-option>
                            ))}
                          </s-select>
                        </s-box>
                        <s-text>限制次数</s-text>
                        <s-box inlineSize="80px">
                          <s-number-field
                            label="限制次数"
                            labelAccessibilityVisibility="exclusive"
                            min={1}
                            value={String(form.draw_frequency_count)}
                            disabled={readOnly || undefined}
                            error={getFieldError('draw_frequency_count')}
                            onInput={(e: Event) =>
                              update('draw_frequency_count', parseInt((e.target as HTMLInputElement).value))
                            }
                          />
                        </s-box>
                        <s-text>次</s-text>
                      </s-stack>
                    )}
                  </s-grid>

                  <s-stack gap="small-300">
                    <s-number-field
                      label="总库存"
                      min={0}
                      value={String(form.inventory)}
                      required
                      disabled={readOnly || undefined}
                      error={getFieldError('inventory')}
                      onInput={(e: Event) => update('inventory', parseInt((e.target as HTMLInputElement).value))}
                    />
                    {form.inventory && form.won_count && Number(form.won_count) > 0 ? (
                      <s-text>
                        已中奖数量：{form.won_count}，剩余库存：{form.inventory - form.won_count}
                      </s-text>
                    ) : null}
                  </s-stack>
                </>
              )}
            </s-stack>
          </s-section>
        </s-box>
        {/* 折扣码设置 */}
        {form.prize_type === 'PRODUCT_DISCOUNT_CODE' && (
          <DiscountConfigForm
            config={form.config as DiscountConfig}
            onChange={updateConfig}
            showAppliesTo
            readOnly={readOnly}
            getError={getFieldError}
          />
        )}
        {form.prize_type === 'ORDER_DISCOUNT_CODE' && (
          <DiscountConfigForm
            config={form.config as DiscountConfig}
            onChange={updateConfig}
            showAppliesTo={false}
            readOnly={readOnly}
            getError={getFieldError}
          />
        )}

        {/* 礼品卡设置 */}
        {form.prize_type === 'GIFT_CARD' && (
          <GiftCardConfigForm
            config={form.config as GiftCardConfig}
            onChange={updateConfig}
            readOnly={readOnly}
            getError={getFieldError}
          />
        )}

        {/* 积分设置 */}
        {form.prize_type === 'POINTS' && (
          <PointsConfigForm
            config={form.config as PointsConfig}
            onChange={updateConfig}
            readOnly={readOnly}
            getError={getFieldError}
          />
        )}

        {/* 中奖弹窗设置 */}
        <s-box padding="base" borderWidth="base" borderRadius="base">
          <s-section heading="中奖弹窗">
            <s-stack gap="small">
              <s-text-area
                label="中奖提示语"
                value={form.winning_pop_up_message ?? ''}
                required
                rows={2}
                disabled={readOnly || undefined}
                error={getFieldError('winning_pop_up_message')}
                onInput={(e: Event) => update('winning_pop_up_message', (e.target as HTMLTextAreaElement).value)}
              />
              <s-text-field
                label="按钮文案"
                value={form.winning_pop_up_cta_text ?? ''}
                required
                disabled={readOnly || undefined}
                error={getFieldError('winning_pop_up_cta_text')}
                onInput={(e: Event) => update('winning_pop_up_cta_text', (e.target as HTMLInputElement).value)}
              />
              <s-stack gap="small-300">
                <s-text-field
                  label="按钮跳转链接"
                  value={form.winning_pop_up_cta_url ?? ''}
                  disabled={readOnly || undefined}
                  onInput={(e: Event) => update('winning_pop_up_cta_url', (e.target as HTMLInputElement).value)}
                />
                {!readOnly && <s-text>无中奖和积分类型下不需要填写该值</s-text>}
              </s-stack>
              <RichTextEditorField
                label="奖品规则说明"
                value={form.winning_pop_up_rule ?? ''}
                placeholder="请输入奖品规则..."
                disabled={readOnly || undefined}
                onChange={(value) => update('winning_pop_up_rule', value)}
              />
            </s-stack>
          </s-section>
        </s-box>
      </s-stack>

      {!readOnly && (
        <s-button
          slot="primary-action"
          variant="primary"
          onClick={handleSave}
          disabled={uploading || !isFormValid || undefined}
        >
          {uploading ? '上传中...' : '保存奖品'}
        </s-button>
      )}
      <s-button slot={readOnly ? 'primary-action' : 'secondary-actions'} variant="secondary" onClick={handleCancel}>
        {readOnly ? '关闭' : '取消'}
      </s-button>
    </s-modal>
  )
}
