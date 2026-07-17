import { useEffect, useState } from 'react'
import { useAppStore } from '~/stores/useAppStore'
import { analyticsApi } from '~/services/analytics'
import type { AnalyticsSettings } from '~/types/analytics'

const DAYS = [
  { v: 'MONDAY', l: '周一' },
  { v: 'TUESDAY', l: '周二' },
  { v: 'WEDNESDAY', l: '周三' },
  { v: 'THURSDAY', l: '周四' },
  { v: 'FRIDAY', l: '周五' },
  { v: 'SATURDAY', l: '周六' },
  { v: 'SUNDAY', l: '周日' }
]
const TIMES = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`)

export default function AnalyticsSettings() {
  const currency = useAppStore((s) => s.currencyCode)
  const timezone = useAppStore((s) => s.ianaTimezone)
  const [s, setS] = useState<AnalyticsSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')

  useEffect(() => {
    let alive = true
    analyticsApi
      .getSettings(currency, timezone)
      .then((data) => {
        if (alive) setS(data)
      })
      .catch(() => {
        /* toasted */
      })
    return () => {
      alive = false
    }
  }, [currency, timezone])

  if (!s) {
    return (
      <s-page heading="设置">
        <s-box padding="large">
          <s-text tone="neutral">加载中…</s-text>
        </s-box>
      </s-page>
    )
  }

  const dayLabel = DAYS.find((d) => d.v === s.weeklyDayOfWeek)?.l ?? '周一'

  const testGa4 = async () => {
    if (!s.ga4PropertyId.trim()) {
      setTesting('fail')
      return
    }
    setTesting('testing')
    try {
      const res = await analyticsApi.testGa4(s.ga4PropertyId.trim())
      setTesting(res.ok ? 'ok' : 'fail')
      if (!res.ok) shopify.toast.show(res.message, { isError: true })
    } catch {
      setTesting('fail')
    }
  }

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      // 调度统一按 UTC,持久化的 timezone 也存 UTC(店铺真实时区仅在 UI 展示参考)
      await analyticsApi.saveSettings({ ...s, timezone: 'UTC' })
      shopify.toast.show('设置已保存')
    } catch {
      /* toasted */
    } finally {
      setSaving(false)
    }
  }

  return (
    <s-page heading="设置">
      <s-button slot="primary-action" variant="primary" onClick={handleSave} disabled={saving || undefined}>
        {saving ? '保存中…' : '保存设置'}
      </s-button>

      <s-box padding="large">
        <s-stack direction="block" gap="large-200">
          <s-section heading="GA4 配置">
            <s-stack direction="block" gap="base">
              <s-text tone="neutral">用于拉取流量与渠道数据</s-text>
              <s-stack direction="inline" gap="base" alignItems="end">
                <s-text-field
                  label="GA4 Property ID"
                  placeholder="例如 123456789"
                  value={s.ga4PropertyId}
                  onInput={(e: Event) => {
                    setS({ ...s, ga4PropertyId: (e.target as HTMLInputElement).value })
                    setTesting('idle')
                  }}
                />
                <s-button variant="secondary" onClick={testGa4} disabled={testing === 'testing' || undefined}>
                  {testing === 'testing' ? '测试中…' : '测试连接'}
                </s-button>
                {testing === 'ok' && <s-badge tone="success">连接成功</s-badge>}
                {testing === 'fail' && <s-badge tone="critical">连接失败,请检查 Property ID 与授权</s-badge>}
              </s-stack>
              <s-text tone="neutral">
                如何获取:GA4 后台 → 管理 → 媒体资源设置 → 媒体资源 ID。并将我们的服务账号加为「查看者」。
              </s-text>
            </s-stack>
          </s-section>

          <s-section heading="币种">
            <s-stack direction="block" gap="small-200">
              <s-text tone="neutral">来自店铺设置,报表按此币种展示</s-text>
              <s-badge>{currency}</s-badge>
            </s-stack>
          </s-section>

          <s-section heading="定时分析">
            <s-stack direction="block" gap="base">
              <s-text tone="neutral">到点自动采集数据、生成报表并出 AI 结论</s-text>
              <s-banner tone="info">
                <s-text>
                  调度时间均按 UTC(协调世界时)触发,与店铺所在时区无关。例如设「周二 09:00」= 每周二 UTC 09:00。请按 UTC
                  折算你期望的本地时间。
                </s-text>
              </s-banner>

              <s-stack direction="inline" gap="base" alignItems="end">
                <s-checkbox
                  label="周报"
                  checked={s.weeklyEnabled || undefined}
                  onChange={(e: Event) => setS({ ...s, weeklyEnabled: (e.target as HTMLInputElement).checked })}
                />
                <s-select
                  label="星期"
                  value={s.weeklyDayOfWeek}
                  onChange={(e: Event) => setS({ ...s, weeklyDayOfWeek: (e.target as HTMLSelectElement).value })}
                >
                  {DAYS.map((d) => (
                    <s-option key={d.v} value={d.v}>
                      {d.l}
                    </s-option>
                  ))}
                </s-select>
                <s-select
                  label="时间"
                  value={s.weeklyTimeOfDay}
                  onChange={(e: Event) => setS({ ...s, weeklyTimeOfDay: (e.target as HTMLSelectElement).value })}
                >
                  {TIMES.map((t) => (
                    <s-option key={t} value={t}>
                      {t}
                    </s-option>
                  ))}
                </s-select>
                <s-text tone="neutral">
                  每{dayLabel} {s.weeklyTimeOfDay}(UTC)分析上周数据
                </s-text>
              </s-stack>

              <s-stack direction="inline" gap="base" alignItems="end">
                <s-checkbox
                  label="月报"
                  checked={s.monthlyEnabled || undefined}
                  onChange={(e: Event) => setS({ ...s, monthlyEnabled: (e.target as HTMLInputElement).checked })}
                />
                <s-select
                  label="日期"
                  value={String(s.monthlyDayOfMonth)}
                  onChange={(e: Event) =>
                    setS({ ...s, monthlyDayOfMonth: Number((e.target as HTMLSelectElement).value) })
                  }
                >
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <s-option key={d} value={String(d)}>
                      {d} 号
                    </s-option>
                  ))}
                </s-select>
                <s-select
                  label="时间"
                  value={s.monthlyTimeOfDay}
                  onChange={(e: Event) => setS({ ...s, monthlyTimeOfDay: (e.target as HTMLSelectElement).value })}
                >
                  {TIMES.map((t) => (
                    <s-option key={t} value={t}>
                      {t}
                    </s-option>
                  ))}
                </s-select>
                <s-text tone="neutral">
                  每月 {s.monthlyDayOfMonth} 号 {s.monthlyTimeOfDay}(UTC)分析上月数据
                </s-text>
              </s-stack>

              <s-stack direction="inline" gap="small-200" alignItems="center">
                <s-text tone="neutral">调度时区</s-text>
                <s-badge tone="info">UTC</s-badge>
                <s-text tone="neutral">(你的店铺时区:{timezone},仅供参考,不影响调度)</s-text>
              </s-stack>

              <s-text tone="neutral">提示:GA4 数据 T+1~2 天完成回填,建议周报设在周二及以后(UTC)。</s-text>
            </s-stack>
          </s-section>
        </s-stack>
      </s-box>
    </s-page>
  )
}
