import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { activityApi } from '~/services/activity'
import { useLoading } from '~/hooks/useLoading'
import { RetryErrorBanner } from '~/components/RetryErrorBanner'
import { Dashboard } from '~/components/activities/Dashboard'
import { WinRecords } from '~/components/activities/WinRecords'
import { BasicSettingsForm } from '~/components/activities/BasicSettingsForm'
import { PrizeList } from '~/components/activities/PrizeList'
import type { ActivityDetail, ActivityFormData } from '~/types/activity'
import { ACTIVITY_STATUS_MAP, ACTIVITY_STATUS_TONE_MAP } from '~/types/activity'
import { validateCompleteActivity } from '~/utils/validation'
import { EmptyState } from '~/components/EmptyState'

type Tab = 'records' | 'settings' | 'prizes'

export default function ActivityDetailPage() {
  const { id } = useParams<{ id: string }>()
  const activityId = id || ''

  const { loading, error, run } = useLoading()
  const [activity, setActivity] = useState<ActivityDetail | null>(null)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('records')
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<ActivityFormData | null>(null)
  const [isBasicSettingsValid, setIsBasicSettingsValid] = useState(false)

  const handleBasicSettingsValidationChange = useCallback((isValid: boolean) => {
    setIsBasicSettingsValid(isValid)
  }, [])

  // 检查表单是否可以保存
  const canSave = isBasicSettingsValid && formData && formData.prizes.length === 8

  const fetchActivity = useCallback(async () => {
    try {
      const res = await run(() => activityApi.getById(activityId))
      if (res) {
        setActivity(res)
        setFormData(toFormData(res))
      }
    } finally {
      setHasLoaded(true)
    }
  }, [run, activityId])

  useEffect(() => {
    setHasLoaded(false)
    if (activityId) {
      fetchActivity()
      return
    }
    setHasLoaded(true)
  }, [activityId, fetchActivity])

  const handleSave = async () => {
    if (!formData) return

    const validationError = validateCompleteActivity(formData)
    if (validationError) {
      shopify.toast.show(validationError, { isError: true })
      return
    }

    setSaving(true)
    try {
      await activityApi.update(activityId, formData)
      shopify.toast.show('活动更新成功')
      setIsEditing(false)
      fetchActivity()
    } catch {
      shopify.toast.show('更新活动失败', { isError: true })
    } finally {
      setSaving(false)
    }
  }

  const handleCancelEdit = () => {
    if (activity) setFormData(toFormData(activity))
    setIsEditing(false)
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'records', label: '中奖记录' },
    { id: 'settings', label: '基础设置' },
    { id: 'prizes', label: '奖品设置' }
  ]

  if (error) {
    return (
      <s-page heading="错误">
        <s-link slot="breadcrumb-actions" href="/app/activities">
          活动列表
        </s-link>
        <RetryErrorBanner error={error} heading="加载活动失败" onRetry={fetchActivity} />
      </s-page>
    )
  }

  if (!hasLoaded || loading) {
    return (
      <s-page heading="加载中">
        <s-link slot="breadcrumb-actions" href="/app/activities">
          活动列表
        </s-link>
        <s-box padding="large">
          <s-section accessibilityLabel="Loading">
            <s-stack gap="small-300" alignItems="center">
              <s-spinner size="base" />
            </s-stack>
          </s-section>
        </s-box>
      </s-page>
    )
  }

  if (!activity || !formData) {
    return (
      <s-page heading="未找到">
        <s-link slot="breadcrumb-actions" href="/app/activities">
          活动列表
        </s-link>
        <EmptyState message="未找到该活动" />
      </s-page>
    )
  }

  const showEditActions = activeTab !== 'records'

  return (
    <s-page heading={activity.name}>
      <s-link slot="breadcrumb-actions" href="/app/activities">
        活动列表
      </s-link>

      {showEditActions && !isEditing && (
        <s-button slot="primary-action" variant="primary" icon="edit" onClick={() => setIsEditing(true)}>
          编辑
        </s-button>
      )}
      {showEditActions && isEditing && (
        <>
          <s-button
            slot="primary-action"
            variant="primary"
            onClick={handleSave}
            disabled={saving || !canSave || undefined}
          >
            {saving ? '保存中...' : '保存'}
          </s-button>
          <s-button slot="secondary-actions" variant="secondary" onClick={handleCancelEdit}>
            取消
          </s-button>
        </>
      )}

      <s-stack gap="base" padding="small large">
        <s-stack direction="inline" justifyContent="space-between">
          <s-stack direction="inline" gap="small">
            {tabs.map((tab) => (
              <s-button
                key={tab.id}
                variant={activeTab === tab.id ? 'primary' : 'tertiary'}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </s-button>
            ))}
          </s-stack>
          <s-badge tone={ACTIVITY_STATUS_TONE_MAP[activity.status] as 'info' | 'caution' | 'success'} size="large">
            活动{ACTIVITY_STATUS_MAP[activity.status]}
          </s-badge>
        </s-stack>
        <div hidden={activeTab !== 'records'}>
          <s-stack gap="base">
            <Dashboard activityId={activityId} />
            <WinRecords activityId={activityId} />
          </s-stack>
        </div>

        {activeTab === 'settings' && (
          <BasicSettingsForm
            data={formData}
            onChange={setFormData}
            readOnly={!isEditing}
            onValidationChange={handleBasicSettingsValidationChange}
          />
        )}
        {activeTab === 'prizes' && (
          <PrizeList
            prizes={formData.prizes}
            deletedPrizes={activity.prizes_deleted}
            onChange={(prizes) => setFormData((prev) => (prev ? { ...prev, prizes } : prev))}
            readOnly={!isEditing}
            isProgress={activity.status === 'PROGRESS'}
            lockPrizeType={activity.status === 'PROGRESS'}
          />
        )}
      </s-stack>
    </s-page>
  )
}

function toFormData(activity: ActivityDetail): ActivityFormData {
  return {
    name: activity.name,
    type: activity.type,
    start_time: activity.start_time,
    end_time: activity.end_time,
    daily_draw_limit: activity.daily_draw_limit,
    draw_limit: activity.draw_limit,
    draw_frequency_day: activity.draw_frequency_day,
    draw_frequency_count: activity.draw_frequency_count,
    consumption_points: activity.consumption_points,
    consumption_description: activity.consumption_description,
    rules_description: activity.rules_description,
    prizes: activity.prizes
  }
}
