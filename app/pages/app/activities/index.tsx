import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { RetryErrorBanner } from '~/components/RetryErrorBanner'
import { activityApi } from '~/services/activity'
import { useLoading } from '~/hooks/useLoading'
import type { ActivityListItem, ActivityListResponse } from '~/types/activity'
import { ACTIVITY_STATUS_MAP, ACTIVITY_STATUS_TONE_MAP } from '~/types/activity'
import { EmptyState } from '~/components/EmptyState'

export default function ActivitiesIndex() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { loading, error, run } = useLoading()
  const [data, setData] = useState<ActivityListResponse | null>(null)
  const [copyTarget, setCopyTarget] = useState<ActivityListItem | null>(null)
  const [copyName, setCopyName] = useState('')
  const [copying, setCopying] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const modalRef = useRef<any>(null)
  const deleteConfirmModalRef = useRef<any>(null)
  const page = Number(searchParams.get('page')) || 1

  const fetchList = useCallback(async () => {
    const res = await run(() => activityApi.getList({ page }))
    if (res) setData(res)
  }, [run, page])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  const handleCopyClick = (activity: ActivityListItem) => {
    setCopyTarget(activity)
    setCopyName(`${activity.name} (Copy)`)
    modalRef.current?.showOverlay()
  }

  const handleCopyConfirm = async () => {
    if (!copyTarget || !copyName.trim()) return
    setCopying(true)
    try {
      // 获取原活动的完整数据
      const detail = await activityApi.getById(copyTarget.id)

      // 创建新活动，使用原活动的数据
      await activityApi.create({
        name: copyName.trim(),
        type: detail.type,
        start_time: detail.start_time,
        end_time: detail.end_time,
        daily_draw_limit: detail.daily_draw_limit,
        draw_limit: detail.draw_limit,
        draw_frequency_day: detail.draw_frequency_day,
        draw_frequency_count: detail.draw_frequency_count,
        consumption_points: detail.consumption_points,
        consumption_description: detail.consumption_description,
        rules_description: detail.rules_description,
        prizes: detail.prizes.map((prize) => ({
          ...prize,
          id: undefined // 移除 id，让后端生成新的
        }))
      })

      shopify.toast.show('活动复制成功')
      modalRef.current?.hideOverlay()
      setCopyTarget(null)
      fetchList()
    } catch {
      shopify.toast.show('复制活动失败', { isError: true })
    } finally {
      setCopying(false)
    }
  }

  const handleDeleteRequest = (activityId: string) => {
    setDeleteTargetId(activityId)
    deleteConfirmModalRef.current?.showOverlay()
  }

  const handleDeleteCancel = () => {
    if (deleting) return
    setDeleteTargetId(null)
    deleteConfirmModalRef.current?.hideOverlay()
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return

    setDeleting(true)
    try {
      await activityApi.remove(deleteTargetId)
      shopify.toast.show('活动删除成功')
      deleteConfirmModalRef.current?.hideOverlay()
      setDeleteTargetId(null)

      // 当前页删空时回到上一页，其他情况刷新当前列表
      if (data && data.list.length === 1 && page > 1) {
        setSearchParams({ page: String(page - 1) })
      } else {
        fetchList()
      }
    } catch {
      shopify.toast.show('删除活动失败', { isError: true })
    } finally {
      setDeleting(false)
    }
  }

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0

  return (
    <s-page heading="活动列表">
      <s-button slot="primary-action" variant="primary" icon="plus" onClick={() => navigate('/app/activities/new')}>
        添加活动
      </s-button>
      <s-box padding="large">
        {error && <RetryErrorBanner error={error} heading="加载活动失败" onRetry={fetchList} />}

        {!error && data && data.list.length === 0 && (
          <EmptyState
            heading="暂无活动"
            message="创建您的第一个抽奖活动，开始与客户互动。"
            actionLabel="创建活动"
            onAction={() => navigate('/app/activities/new')}
          />
        )}

        {data && data.list.length > 0 && (
          <s-section accessibilityLabel="Activities table">
            <s-table
              paginate={totalPages > 1 || undefined}
              hasPreviousPage={page > 1 || undefined}
              hasNextPage={page < totalPages || undefined}
              loading={loading || undefined}
              onPreviousPage={() => setSearchParams({ page: String(Math.max(1, page - 1)) })}
              onNextPage={() => setSearchParams({ page: String(page + 1) })}
            >
              <s-table-header-row>
                <s-table-header format="numeric">
                  <s-box inlineSize="150px">ID</s-box>
                </s-table-header>
                <s-table-header listSlot="primary">名称</s-table-header>
                <s-table-header>类型</s-table-header>
                <s-table-header>时间</s-table-header>
                <s-table-header format="numeric">奖品数</s-table-header>
                <s-table-header listSlot="secondary">状态</s-table-header>
                <s-table-header>操作</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {data.list.map((activity) => (
                  <s-table-row key={activity.id}>
                    <s-table-cell>
                      <s-box inlineSize="150px">{activity.id}</s-box>
                    </s-table-cell>
                    <s-table-cell>
                      <s-clickable href={`/app/activities/${activity.id}`} accessibilityLabel={`查看 ${activity.name}`}>
                        <s-text type="strong">{activity.name}</s-text>
                      </s-clickable>
                    </s-table-cell>
                    <s-table-cell>积分抽奖</s-table-cell>
                    <s-table-cell>
                      <s-stack gap="small-300">
                        <s-text>开始: {activity.start_time}</s-text>
                        <s-text>结束: {activity.end_time}</s-text>
                      </s-stack>
                    </s-table-cell>
                    <s-table-cell>{activity.prizes_count}</s-table-cell>
                    <s-table-cell>
                      <s-badge tone={ACTIVITY_STATUS_TONE_MAP[activity.status] as 'info' | 'caution' | 'success'}>
                        {ACTIVITY_STATUS_MAP[activity.status]}
                      </s-badge>
                    </s-table-cell>
                    <s-table-cell>
                      <s-button variant="tertiary" icon="duplicate" onClick={() => handleCopyClick(activity)}>
                        复制
                      </s-button>
                      <s-button variant="tertiary" icon="delete" onClick={() => handleDeleteRequest(activity.id)}>
                        删除
                      </s-button>
                    </s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          </s-section>
        )}
      </s-box>

      {/* 复制活动弹窗 */}
      <s-modal ref={modalRef} id="copy-activity-modal" heading="复制活动">
        <s-stack gap="base">
          <s-text>请输入复制后的活动名称：</s-text>
          <s-text-field
            label="活动名称"
            value={copyName}
            onInput={(e: Event) => setCopyName((e.target as HTMLInputElement).value)}
          />
        </s-stack>
        <s-button
          slot="primary-action"
          variant="primary"
          onClick={handleCopyConfirm}
          disabled={!copyName.trim() || copying || undefined}
        >
          {copying ? '复制中...' : '确认'}
        </s-button>
        <s-button
          slot="secondary-actions"
          variant="secondary"
          onClick={() => {
            modalRef.current?.hideOverlay()
            setCopyTarget(null)
          }}
        >
          取消
        </s-button>
      </s-modal>

      {/* 删除二次确认弹窗 */}
      <s-modal ref={deleteConfirmModalRef} id="activity-delete-confirm-modal" heading="确认删除活动">
        <s-stack gap="base">
          <s-text>确定要删除此活动「{deleteTargetId}」吗？</s-text>
        </s-stack>
        <s-button
          slot="primary-action"
          variant="primary"
          tone="critical"
          onClick={handleDeleteConfirm}
          disabled={deleting || undefined}
        >
          {deleting ? '删除中...' : '确认删除'}
        </s-button>
        <s-button
          slot="secondary-actions"
          variant="secondary"
          onClick={handleDeleteCancel}
          disabled={deleting || undefined}
        >
          取消
        </s-button>
      </s-modal>
    </s-page>
  )
}
