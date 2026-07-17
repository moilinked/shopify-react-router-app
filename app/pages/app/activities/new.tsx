import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { activityApi } from '~/services/activity'
import { BasicSettingsForm } from '~/components/activities/BasicSettingsForm'
import { PrizeList } from '~/components/activities/PrizeList'
import type { ActivityFormData } from '~/types/activity'
import { validateCompleteActivity } from '~/utils/validation'

const createDefaultForm = (): ActivityFormData => ({
  name: '',
  type: 'SMILE_POINT_DRAW',
  start_time: '2026-01-01 00:00:00',
  end_time: '2026-01-02 00:00:00',
  daily_draw_limit: 0,
  draw_limit: false,
  consumption_points: 0,
  consumption_description: '',
  rules_description: '',
  prizes: []
})

export default function NewActivity() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState<ActivityFormData>(createDefaultForm)
  const [saving, setSaving] = useState(false)
  const [activeSection, setActiveSection] = useState<'settings' | 'prizes'>('settings')
  const [isBasicSettingsValid, setIsBasicSettingsValid] = useState(false)

  const handleBasicSettingsValidationChange = useCallback((isValid: boolean) => {
    setIsBasicSettingsValid(isValid)
  }, [])

  // 检查表单是否可以保存：基础表单校验通过 && 奖品设置有奖品
  const canSave = isBasicSettingsValid && formData.prizes.length > 0

  const handleSave = async () => {
    const validationError = validateCompleteActivity(formData)
    if (validationError) {
      shopify.toast.show(validationError, { isError: true })
      return
    }

    setSaving(true)
    try {
      const res = await activityApi.create(formData)
      shopify.toast.show('活动创建成功')
      navigate(`/app/activities/${res.id}`)
    } catch {
      shopify.toast.show('创建活动失败', { isError: true })
    } finally {
      setSaving(false)
    }
  }

  return (
    <s-page heading="新建活动">
      <s-link slot="breadcrumb-actions" href="/app/activities">
        活动列表
      </s-link>

      <s-button slot="secondary-actions" variant="secondary" onClick={() => navigate('/app/activities')}>
        取消
      </s-button>
      <s-button slot="primary-action" variant="primary" onClick={handleSave} disabled={saving || !canSave || undefined}>
        {saving ? '保存中...' : '保存'}
      </s-button>

      <s-stack gap="base" padding="large">
        <s-stack direction="inline" gap="small">
          <s-button
            variant={activeSection === 'settings' ? 'primary' : 'tertiary'}
            onClick={() => setActiveSection('settings')}
          >
            基础设置
          </s-button>
          <s-button
            variant={activeSection === 'prizes' ? 'primary' : 'tertiary'}
            onClick={() => setActiveSection('prizes')}
          >
            奖品设置
          </s-button>
        </s-stack>

        {activeSection === 'settings' && (
          <BasicSettingsForm
            data={formData}
            onChange={setFormData}
            onNext={() => setActiveSection('prizes')}
            onValidationChange={handleBasicSettingsValidationChange}
          />
        )}

        {activeSection === 'prizes' && (
          <PrizeList prizes={formData.prizes} onChange={(prizes) => setFormData((prev) => ({ ...prev, prizes }))} />
        )}
      </s-stack>
    </s-page>
  )
}
