import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { competitorApi } from '~/services/competitor'
import { useLoading } from '~/hooks/useLoading'
import type { CompetitorShopSchedule } from '~/types/competitor'
import { DAYS_OF_WEEK, DAY_OF_WEEK_MAP } from '~/types/competitor'

const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hour = String(Math.floor(index / 2)).padStart(2, '0')
  const minute = index % 2 === 0 ? '00' : '30'
  return `${hour}:${minute}`
})

const TIMEZONE_OPTIONS = [
  { value: 'Asia/Shanghai', label: '中国时间 (Asia/Shanghai)' },
  { value: 'America/Los_Angeles', label: '美国太平洋时间 (America/Los_Angeles)' },
  { value: 'America/New_York', label: '美国东部时间 (America/New_York)' },
  { value: 'Europe/London', label: '英国时间 (Europe/London)' },
  { value: 'Europe/Berlin', label: '德国时间 (Europe/Berlin)' },
  { value: 'Europe/Paris', label: '欧洲中部时间 (Europe/Paris)' },
  { value: 'Australia/Sydney', label: '澳大利亚东部时间 (Australia/Sydney)' },
  { value: 'UTC', label: 'UTC' }
]

export default function SettingsPage() {
  const navigate = useNavigate()
  const { run } = useLoading()
  const { loading: saving, run: runSave } = useLoading()
  const { loading: testing, run: runTest } = useLoading()

  const [schedule, setSchedule] = useState<CompetitorShopSchedule | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [dayOfWeek, setDayOfWeek] = useState('TUESDAY')
  const [timeOfDay, setTimeOfDay] = useState('10:00')
  const [timezone, setTimezone] = useState('Asia/Shanghai')
  const [aiEnabled, setAiEnabled] = useState(true)

  const loadSchedule = useCallback(() => {
    run(async () => {
      const res = await competitorApi.getSchedule()
      setSchedule(res)
      setEnabled(res.enabled)
      setDayOfWeek(res.dayOfWeek)
      setTimeOfDay(res.timeOfDay)
      setTimezone(res.timezone)
      setAiEnabled(res.aiEnabled)
    })
  }, [run])

  useEffect(() => {
    loadSchedule()
  }, [loadSchedule])

  const handleSave = () => {
    runSave(async () => {
      const res = await competitorApi.updateSchedule({
        enabled,
        dayOfWeek,
        timeOfDay,
        timezone,
        aiEnabled
      })
      setSchedule(res)
      shopify.toast.show('调度配置已保存')
    })
  }

  const handleTestN8n = () => {
    runTest(async () => {
      const res = await competitorApi.testN8n()
      if (res.ok) {
        shopify.toast.show('N8N 连接正常')
      } else {
        shopify.toast.show(`N8N 测试失败：${res.message}`, { isError: true })
      }
    })
  }

  return (
    <s-page heading="调度设置">
      <s-button slot="primary-action" variant="primary" onClick={handleSave} disabled={saving || undefined}>
        {saving ? '保存中…' : '保存'}
      </s-button>
      <s-button slot="secondary-actions" variant="secondary" onClick={() => navigate('/app/competitor')}>
        返回概览
      </s-button>

      <s-box padding="large">
        <s-stack direction="block" gap="large-200">
          <s-section heading="定时调度">
            <s-stack direction="block" gap="base">
              <s-checkbox
                label="启用自动调度"
                checked={enabled || undefined}
                onChange={(e: Event) => setEnabled((e.target as HTMLInputElement).checked)}
              />

              <s-select
                label="执行日"
                value={dayOfWeek}
                onChange={(e: Event) => setDayOfWeek((e.target as HTMLSelectElement).value)}
              >
                {DAYS_OF_WEEK.map((d) => (
                  <s-option key={d} value={d}>
                    {DAY_OF_WEEK_MAP[d]}
                  </s-option>
                ))}
              </s-select>

              <s-select
                label="执行时间"
                value={timeOfDay}
                onChange={(e: Event) => setTimeOfDay((e.target as HTMLSelectElement).value)}
              >
                {!TIME_OPTIONS.includes(timeOfDay) && <s-option value={timeOfDay}>{timeOfDay}</s-option>}
                {TIME_OPTIONS.map((time) => (
                  <s-option key={time} value={time}>
                    {time}
                  </s-option>
                ))}
              </s-select>

              <s-select
                label="时区"
                value={timezone}
                onChange={(e: Event) => setTimezone((e.target as HTMLSelectElement).value)}
              >
                {!TIMEZONE_OPTIONS.some((item) => item.value === timezone) && (
                  <s-option value={timezone}>{timezone}</s-option>
                )}
                {TIMEZONE_OPTIONS.map((item) => (
                  <s-option key={item.value} value={item.value}>
                    {item.label}
                  </s-option>
                ))}
              </s-select>

              <s-checkbox
                label="启用 AI 分析"
                checked={aiEnabled || undefined}
                onChange={(e: Event) => setAiEnabled((e.target as HTMLInputElement).checked)}
              />
            </s-stack>
          </s-section>

          <s-section heading="连接测试">
            <s-stack direction="block" gap="base">
              <s-text tone="neutral">测试 N8N Webhook 连接是否正常（不会实际执行任务）。</s-text>
              <s-button variant="secondary" onClick={handleTestN8n} disabled={testing || undefined}>
                {testing ? '测试中…' : '测试 N8N 连接'}
              </s-button>
            </s-stack>
          </s-section>

          {schedule && (
            <s-section heading="当前配置">
              <s-box padding="base" borderWidth="base" borderRadius="base">
                <s-stack direction="block" gap="small-200">
                  <s-text>状态：{schedule.enabled ? '已启用' : '已停用'}</s-text>
                  <s-text>
                    执行时间：每{DAY_OF_WEEK_MAP[schedule.dayOfWeek] ?? schedule.dayOfWeek} {schedule.timeOfDay}
                  </s-text>
                  <s-text>时区：{schedule.timezone}</s-text>
                  <s-text>AI 分析：{schedule.aiEnabled ? '已启用' : '已停用'}</s-text>
                </s-stack>
              </s-box>
            </s-section>
          )}
        </s-stack>
      </s-box>
    </s-page>
  )
}
