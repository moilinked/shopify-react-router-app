import { useEffect, useMemo, useState } from 'react'
import type { ActivityFormData, ActivityType, FrequencyUnit } from '~/types/activity'
import { DateTimeField } from '~/components/activities/DateTimeField'
import { RichTextEditorField } from '~/components/activities/RichTextEditorField'
import { baseValidateActivityForm, type BaseValidationErrors } from '~/utils/validation'
import { FREQUENCY_UNIT_MAP } from '~/types/activity'
interface BasicSettingsFormProps {
  data: ActivityFormData
  onChange: (data: ActivityFormData) => void
  readOnly?: boolean
  onNext?: () => void
  onValidationChange?: (isValid: boolean) => void
}

export function BasicSettingsForm({
  data,
  onChange,
  readOnly = false,
  onNext,
  onValidationChange
}: BasicSettingsFormProps) {
  const [touched, setTouched] = useState<Set<keyof BaseValidationErrors>>(new Set())
  const errors = useMemo(() => baseValidateActivityForm(data), [data])

  // 当表单数据变化时，保存按钮是否可点击
  useEffect(() => {
    onValidationChange?.(Object.keys(errors).length === 0)
  }, [errors, onValidationChange])

  const update = <K extends keyof ActivityFormData>(key: K, value: ActivityFormData[K]) => {
    let newData = { ...data, [key]: value }
    if (key === 'draw_limit') {
      // 抽奖限制开关变化时，联动默认值/清空值，保证数据语义一致
      newData = value
        ? { ...newData, draw_frequency_day: 'DAY', draw_frequency_count: 1 }
        : { ...newData, draw_frequency_day: undefined, draw_frequency_count: undefined }
    }

    onChange(newData)

    // 统一维护 touched，减少多次 setState；时间范围字段需要成对标记
    setTouched((prev) => {
      const next = new Set(prev)
      next.add(key as keyof BaseValidationErrors)

      if (key === 'start_time' || key === 'end_time') {
        next.add('start_time')
        next.add('end_time')
      }

      return next
    })
  }

  // 获取字段错误
  const getFieldError = (field: keyof BaseValidationErrors): string | undefined =>
    touched.has(field) ? errors[field] : undefined

  return (
    <s-section heading="基础设置">
      <s-stack gap="base">
        <s-stack gap="small-300">
          <s-text-field
            label="活动名称"
            value={data.name}
            required
            disabled={readOnly || undefined}
            placeholder="请输入活动名称"
            error={getFieldError('name')}
            onInput={(e: Event) => update('name', (e.target as HTMLInputElement).value)}
          />
          {!readOnly && <s-text>仅后台可见</s-text>}
        </s-stack>

        <s-select
          label="活动类型"
          value={data.type}
          required
          disabled={readOnly || undefined}
          onChange={(e: Event) => update('type', (e.target as HTMLSelectElement).value as ActivityType)}
        >
          <s-option value="SMILE_POINT_DRAW">积分抽奖</s-option>
        </s-select>

        <s-grid gridTemplateColumns="1fr 1fr" gap="large-300">
          <DateTimeField
            label="活动开始时间"
            value={data.start_time}
            required
            disabled={readOnly || undefined}
            error={getFieldError('start_time')}
            onChange={(value) => update('start_time', value)}
          />
          <DateTimeField
            label="活动结束时间"
            value={data.end_time}
            required
            disabled={readOnly || undefined}
            error={getFieldError('end_time')}
            onChange={(value) => update('end_time', value)}
          />
        </s-grid>

        <s-number-field
          label="每日免费赠送次数"
          min={0}
          value={String(data.daily_draw_limit ?? 0)}
          required
          disabled={readOnly || undefined}
          error={getFieldError('daily_draw_limit')}
          onInput={(e: Event) => update('daily_draw_limit', parseInt((e.target as HTMLInputElement).value, 10))}
        />

        <s-stack direction="inline" alignItems="end" gap="small-300">
          <s-box inlineSize={`${data.draw_limit ? '40%' : '100%'}`}>
            <s-select
              label="抽奖次数限制"
              value={data.draw_limit ? 'true' : 'false'}
              disabled={readOnly || undefined}
              onChange={(e: Event) => update('draw_limit', (e.target as HTMLSelectElement).value === 'true')}
            >
              <s-option value="true">有限制</s-option>
              <s-option value="false">无限制</s-option>
            </s-select>
          </s-box>

          {data.draw_limit && (
            <s-stack direction="inline" gap="small" alignItems="center" padding="none none none base">
              <s-text>每</s-text>
              <s-box inlineSize="120px">
                <s-select
                  label="频率单位"
                  labelAccessibilityVisibility="exclusive"
                  value={data.draw_frequency_day}
                  disabled={readOnly || undefined}
                  onChange={(e: Event) =>
                    update('draw_frequency_day', (e.target as HTMLSelectElement).value as FrequencyUnit)
                  }
                >
                  {(Object.keys(FREQUENCY_UNIT_MAP) as FrequencyUnit[]).map((u) => (
                    <s-option key={u} value={u}>
                      {FREQUENCY_UNIT_MAP[u]}
                    </s-option>
                  ))}
                </s-select>
              </s-box>
              <s-text>天，限制抽奖</s-text>
              <s-box inlineSize="120px">
                <s-number-field
                  label="次数"
                  labelAccessibilityVisibility="exclusive"
                  min={1}
                  value={String(data.draw_frequency_count)}
                  required
                  disabled={readOnly || undefined}
                  error={getFieldError('draw_frequency_count')}
                  onInput={(e: Event) =>
                    update('draw_frequency_count', parseInt((e.target as HTMLInputElement).value, 10))
                  }
                />
              </s-box>
              <s-text>次</s-text>
            </s-stack>
          )}
          {!readOnly && data.draw_limit && <s-text>免费赠送的次数不算在限制次数</s-text>}
        </s-stack>

        <s-number-field
          label="每局消耗积分数"
          min={0}
          value={String(data.consumption_points)}
          required
          disabled={readOnly || undefined}
          error={getFieldError('consumption_points')}
          onInput={(e: Event) => update('consumption_points', parseInt((e.target as HTMLInputElement).value, 10))}
        />

        <s-stack gap="small-300">
          <s-text-field
            label="消耗积分说明"
            value={data.consumption_description ?? ''}
            placeholder="例如：每次抽奖消耗 100 积分"
            disabled={readOnly || undefined}
            onInput={(e: Event) => update('consumption_description', (e.target as HTMLInputElement).value)}
          />
          {!readOnly && <s-text>客户中奖后会同步到smile，不建议随意修改</s-text>}
        </s-stack>

        <s-stack gap="small-300">
          <RichTextEditorField
            label="游戏规则说明"
            value={data.rules_description}
            required
            placeholder="请输入游戏规则..."
            disabled={readOnly || undefined}
            error={getFieldError('rules_description')}
            onChange={(value) => update('rules_description', value)}
          />
          {!readOnly && <s-text>前端显示，客户可见</s-text>}
        </s-stack>

        {onNext && !readOnly && (
          <s-stack direction="inline" justifyContent="end">
            <s-button variant="primary" icon="arrow-right" onClick={onNext}>
              奖品设置
            </s-button>
          </s-stack>
        )}
      </s-stack>
    </s-section>
  )
}
