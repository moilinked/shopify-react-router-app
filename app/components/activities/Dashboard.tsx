import { useCallback, useEffect, useState } from 'react'
import { useLoading } from '~/hooks/useLoading'
import { activityApi } from '~/services/activity'
import { useAppStore } from '~/stores/useAppStore'
import type { DashboardData } from '~/types/activity'

interface DashboardProps {
  activityId: string
}

type DatePreset = 'today' | '7days' | '30days' | 'custom'

function getTodayInTimezone(tz: string): Date {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now)

  const year = Number(parts.find((p) => p.type === 'year')!.value)
  const month = Number(parts.find((p) => p.type === 'month')!.value) - 1
  const day = Number(parts.find((p) => p.type === 'day')!.value)
  return new Date(year, month, day)
}

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDateRange(preset: DatePreset, tz: string): { start_date: string; end_date: string } {
  const today = getTodayInTimezone(tz)
  const end = formatDate(today)

  switch (preset) {
    case 'today':
      return { start_date: end, end_date: end }
    case '7days': {
      const d = new Date(today)
      d.setDate(d.getDate() - 6)
      return { start_date: formatDate(d), end_date: end }
    }
    case '30days': {
      const d = new Date(today)
      d.setDate(d.getDate() - 29)
      return { start_date: formatDate(d), end_date: end }
    }
    default:
      return { start_date: end, end_date: end }
  }
}

function rateBadge(rate: number | null) {
  if (rate === null) return
  if (rate < 0)
    return (
      <s-badge tone="critical" icon="arrow-down">
        {Math.abs(rate)}%
      </s-badge>
    )
  if (rate > 0)
    return (
      <s-badge tone="success" icon="arrow-up">
        {Math.abs(rate)}%
      </s-badge>
    )
  return <s-badge tone="neutral">0%</s-badge>
}

export function Dashboard({ activityId }: DashboardProps) {
  const ianaTimezone = useAppStore((s) => s.ianaTimezone)
  const [preset, setPreset] = useState<DatePreset>('today')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [data, setData] = useState<DashboardData | null>(null)
  const { loading, run } = useLoading()

  const fetchDashboard = useCallback(async () => {
    if (preset === 'custom' && (!customStart || !customEnd)) return
    await run(async () => {
      const range =
        preset === 'custom' ? { start_date: customStart, end_date: customEnd } : getDateRange(preset, ianaTimezone)
      const res = await activityApi.getDashboard({ id: activityId, ...range })
      setData(res)
    })
  }, [activityId, preset, customStart, customEnd, ianaTimezone, run])

  useEffect(() => {
    if (preset !== 'custom') fetchDashboard()
  }, [preset, activityId, fetchDashboard])

  const presets: { value: DatePreset; label: string }[] = [
    { value: 'today', label: '今天' },
    { value: '7days', label: '过去 7 天' },
    { value: '30days', label: '过去 30 天' },
    { value: 'custom', label: '自定义' }
  ]

  const stats = data
    ? [
        { label: '参与人数', count: data.participants_count, rate: data.participants_rate },
        { label: '未中奖', count: data.no_winning_count, rate: data.no_winning_rate },
        { label: '积分', count: data.points_count, rate: data.points_rate },
        { label: '订单折扣', count: data.order_discount_count, rate: data.order_discount_rate },
        { label: '商品折扣', count: data.product_discount_count, rate: data.product_discount_rate },
        { label: '礼品卡', count: data.gift_card_count, rate: data.gift_card_rate }
      ]
    : []

  return (
    <s-section heading="数据面板">
      <s-stack gap="small">
        <s-stack direction="inline" gap="small" alignItems="center">
          {presets.map((p) => (
            <s-button
              key={p.value}
              variant={preset === p.value ? 'primary' : 'secondary'}
              onClick={() => setPreset(p.value)}
            >
              {p.label}
            </s-button>
          ))}

          {preset === 'custom' && (
            <s-stack direction="inline" gap="small" alignItems="center">
              <s-date-field
                label="开始日期"
                labelAccessibilityVisibility="exclusive"
                value={customStart}
                onChange={(e: Event) => {
                  const nextStart = (e.target as HTMLInputElement).value
                  setCustomStart(nextStart)
                  if (customEnd && nextStart > customEnd) {
                    setCustomEnd('')
                  }
                }}
              />
              <s-icon type="arrow-right" />
              <s-date-field
                label="结束日期"
                labelAccessibilityVisibility="exclusive"
                value={customEnd}
                onChange={(e: Event) => {
                  const nextEnd = (e.target as HTMLInputElement).value
                  setCustomEnd(nextEnd)
                  if (customStart && nextEnd < customStart) {
                    setCustomStart('')
                  }
                }}
              />
              <s-button variant="primary" onClick={fetchDashboard} disabled={!customStart || !customEnd || undefined}>
                应用
              </s-button>
            </s-stack>
          )}
        </s-stack>

        {loading && (
          <s-box accessibilityLabel="Metrics" borderRadius="base" borderWidth="base">
            <s-box paddingBlock="base" paddingInline="large">
              <s-stack gap="small-300" alignItems="center">
                <s-spinner size="large" />
              </s-stack>
            </s-box>
          </s-box>
        )}

        {!loading && data && (
          <s-box accessibilityLabel="Metrics" borderRadius="base" borderWidth="base">
            <div style={{ display: 'flex', width: '100%' }}>
              {stats.map((s, i) => (
                <div key={s.label} style={{ flex: 1, display: 'flex' }}>
                  {i > 0 && <s-divider direction="block" />}
                  <s-box paddingBlock="base" paddingInline="large">
                    <s-stack gap="small-300">
                      <s-text>{s.label}</s-text>
                      <s-stack direction="inline" gap="small-200" alignItems="center">
                        <s-text type="strong">{s.count}</s-text>
                        {rateBadge(s.rate)}
                      </s-stack>
                    </s-stack>
                  </s-box>
                </div>
              ))}
            </div>
          </s-box>
        )}
      </s-stack>
    </s-section>
  )
}
