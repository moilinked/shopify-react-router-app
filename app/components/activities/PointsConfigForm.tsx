import type { PointsConfig } from '~/types/activity'

interface PointsConfigFormProps {
  config: PointsConfig
  onChange: (c: PointsConfig) => void
  readOnly: boolean
  getError?: (field: keyof PointsConfig) => string | undefined
}

export function PointsConfigForm({ config, onChange, readOnly = false, getError }: PointsConfigFormProps) {
  return (
    <s-box padding="base" borderWidth="base" borderRadius="base">
      <s-section heading="积分设置">
        <s-number-field
          label="赠送积分数量"
          min={0}
          value={String(config.point_value)}
          disabled={readOnly || undefined}
          required
          error={getError?.('point_value')}
          onInput={(e: Event) =>
            onChange({
              ...config,
              point_value: parseInt((e.target as HTMLInputElement).value)
            })
          }
        />

        <s-stack>
          <s-text-field
            label="赠送说明"
            value={config.point_description ?? ''}
            placeholder="例如：抽奖奖励"
            required
            disabled={readOnly || undefined}
            error={getError?.('point_description')}
            onInput={(e: Event) => onChange({ ...config, point_description: (e.target as HTMLInputElement).value })}
          />
          <s-text>客户中奖后会同步到smile，不建议随意修改。</s-text>
        </s-stack>
      </s-section>
    </s-box>
  )
}
