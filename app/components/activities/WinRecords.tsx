import { useCallback, useEffect, useRef, useState } from 'react'
import { useLoading } from '~/hooks/useLoading'
import { activityApi } from '~/services/activity'
import type { WinRecordsResponse, PrizeTypeFilter, DrawStatusFilter } from '~/types/activity'
import {
  PRIZE_TYPE_FILTER_MAP,
  DISCOUNT_CODE_STATUS_MAP,
  DISCOUNT_CODE_STATUS_TONE_MAP,
  DRAW_STATUS_MAP,
  DRAW_STATUS_FILTER_MAP,
  DRAW_STATUS_TONE_MAP
} from '~/types/activity'
import { EmptyState } from '../EmptyState'

interface WinRecordsProps {
  activityId: string
}

export function WinRecords({ activityId }: WinRecordsProps) {
  const [activeTab, setActiveTab] = useState<PrizeTypeFilter>('ALL')
  const [status, setStatus] = useState<DrawStatusFilter>('ALL')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [drawTimeStartInput, setDrawTimeStartInput] = useState('')
  const [drawTimeEndInput, setDrawTimeEndInput] = useState('')
  const [drawTimeStart, setDrawTimeStart] = useState('')
  const [drawTimeEnd, setDrawTimeEnd] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<WinRecordsResponse | null>(null)
  const searchFieldRef = useRef<any>(null)
  const { loading, run } = useLoading()

  const fetchRecords = useCallback(async () => {
    await run(async () => {
      const res = await activityApi.getWinRecords({
        activity_id: activityId,
        prize_type: activeTab,
        status: status,
        search: search || undefined,
        draw_time_start: drawTimeStart || undefined,
        draw_time_end: drawTimeEnd || undefined,
        page: page
      })
      setData(res)
    })
  }, [activityId, activeTab, search, status, drawTimeStart, drawTimeEnd, page, run])

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  useEffect(() => {
    setPage(1)
  }, [activeTab, status, search, drawTimeStart, drawTimeEnd])

  useEffect(() => {
    const field = searchFieldRef.current
    if (!field) return

    const handleKeyDown = (e: Event) => {
      const keyboardEvent = e as KeyboardEvent
      if (keyboardEvent.key === 'Enter') {
        keyboardEvent.preventDefault()
        setSearch(searchInput.trim())
      }
    }

    field.addEventListener('keydown', handleKeyDown)
    return () => field.removeEventListener('keydown', handleKeyDown)
  }, [searchInput])

  const handleExport = async () => {
    try {
      const res = await activityApi.exportRecords({
        activity_id: activityId,
        prize_type: activeTab,
        status: status,
        search: search || undefined,
        draw_time_start: drawTimeStart || undefined,
        draw_time_end: drawTimeEnd || undefined
      })
      await activityApi.downloadRecords(res.download_url)
      shopify.toast.show('导出成功')
    } catch {
      shopify.toast.show('导出失败', { isError: true })
    }
  }

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0

  const handleApplyDrawTimeFilter = () => {
    setDrawTimeStart(drawTimeStartInput)
    setDrawTimeEnd(drawTimeEndInput)
    setPage(1)
  }

  return (
    <s-section>
      <s-stack gap="base">
        <s-stack direction="inline" justifyContent="space-between" alignItems="center">
          <s-heading>中奖记录</s-heading>
          <s-button onClick={handleExport} variant="tertiary">
            导出
          </s-button>
        </s-stack>
        <s-stack direction="inline" gap="base" justifyContent="space-between" alignItems="end">
          <s-stack direction="inline" gap="base">
            <s-box inlineSize="120px">
              <s-select
                label="奖品类型"
                name="prizeType"
                value={activeTab ?? ''}
                onChange={(e: Event) => {
                  const val = (e.target as HTMLSelectElement).value
                  setActiveTab(val as PrizeTypeFilter)
                }}
              >
                {(Object.keys(PRIZE_TYPE_FILTER_MAP) as PrizeTypeFilter[]).map((key) => (
                  <s-option key={key} value={key}>
                    {PRIZE_TYPE_FILTER_MAP[key]}
                  </s-option>
                ))}
              </s-select>
            </s-box>

            <s-box inlineSize="150px">
              <s-select
                label="中奖状态"
                name="drawStatus"
                value={status ?? ''}
                onChange={(e: Event) => {
                  const val = (e.target as HTMLSelectElement).value
                  setStatus(val as DrawStatusFilter)
                }}
              >
                {(Object.keys(DRAW_STATUS_FILTER_MAP) as DrawStatusFilter[]).map((key) => (
                  <s-option key={key} value={key}>
                    {DRAW_STATUS_FILTER_MAP[key]}
                  </s-option>
                ))}
              </s-select>
            </s-box>
          </s-stack>
          <div style={{ flex: 1 }}>
            <s-stack gap="small-300">
              <s-text>时间</s-text>
              <s-stack direction="inline" gap="small" alignItems="center">
                <s-date-field
                  label="开始日期"
                  labelAccessibilityVisibility="exclusive"
                  value={drawTimeStartInput}
                  onChange={(e: Event) => {
                    const nextStart = (e.target as HTMLInputElement).value
                    setDrawTimeStartInput(nextStart)
                    if (drawTimeEndInput && nextStart && nextStart > drawTimeEndInput) {
                      setDrawTimeEndInput('')
                    }
                  }}
                />
                <s-icon type="arrow-right" />
                <s-date-field
                  label="结束日期"
                  labelAccessibilityVisibility="exclusive"
                  value={drawTimeEndInput}
                  onChange={(e: Event) => {
                    const nextEnd = (e.target as HTMLInputElement).value
                    setDrawTimeEndInput(nextEnd)
                    if (drawTimeStartInput && nextEnd && nextEnd < drawTimeStartInput) {
                      setDrawTimeStartInput('')
                    }
                  }}
                />
                <s-button
                  variant="primary"
                  onClick={handleApplyDrawTimeFilter}
                  disabled={!drawTimeStartInput || !drawTimeEndInput || undefined}
                >
                  应用
                </s-button>
              </s-stack>
            </s-stack>
          </div>
          <s-text-field
            ref={searchFieldRef}
            label="按邮箱搜索"
            labelAccessibilityVisibility="exclusive"
            icon="search"
            placeholder="按邮箱搜索..."
            value={searchInput}
            onInput={(e: Event) => setSearchInput((e.target as HTMLInputElement).value)}
          />
        </s-stack>

        {loading && (
          <s-box paddingBlock="base" paddingInline="large">
            <s-stack gap="small-300" alignItems="center">
              <s-spinner size="base" />
            </s-stack>
          </s-box>
        )}

        {!loading && data && (
          <>
            <s-table
              paginate={totalPages > 1 || undefined}
              hasPreviousPage={page > 1 || undefined}
              hasNextPage={page < totalPages || undefined}
              loading={loading || undefined}
              onPreviousPage={() => setPage((p) => Math.max(1, p - 1))}
              onNextPage={() => setPage((p) => p + 1)}
            >
              <s-table-header-row>
                <s-table-header>时间</s-table-header>
                <s-table-header listSlot="primary">客户</s-table-header>
                <s-table-header format="numeric">积分</s-table-header>
                <s-table-header>奖品</s-table-header>
                <s-table-header>折扣码</s-table-header>
                <s-table-header listSlot="secondary">折扣码状态</s-table-header>
                <s-table-header>中奖状态</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {data.list.map((record) => (
                  <s-table-row key={record.id}>
                    <s-table-cell>{record.time}</s-table-cell>
                    <s-table-cell>
                      <s-clickable
                        onClick={() => {
                          setSearchInput(record.email)
                          setSearch(record.email)
                        }}
                      >
                        <s-stack gap="small-300">
                          <s-text type="strong">{record.customer_name}</s-text>
                          <s-text>{record.email}</s-text>
                        </s-stack>
                      </s-clickable>
                    </s-table-cell>
                    <s-table-cell>{record.consumed_points}</s-table-cell>
                    <s-table-cell>{record.prize_name}</s-table-cell>
                    <s-table-cell>
                      {record.discount_code ? (
                        <s-stack gap="small-300">
                          <s-text type="strong">{record.discount_code}</s-text>
                          <s-text>{record.discount_code_expiry}</s-text>
                        </s-stack>
                      ) : (
                        <s-text>-</s-text>
                      )}
                    </s-table-cell>
                    <s-table-cell>
                      {record.discount_status ? (
                        <s-badge
                          tone={
                            DISCOUNT_CODE_STATUS_TONE_MAP[record.discount_status] as
                              | 'success'
                              | 'caution'
                              | 'critical'
                              | 'info'
                          }
                        >
                          {DISCOUNT_CODE_STATUS_MAP[record.discount_status]}
                        </s-badge>
                      ) : (
                        <s-text>-</s-text>
                      )}
                    </s-table-cell>
                    <s-table-cell>
                      {record.status ? (
                        <s-badge
                          tone={DRAW_STATUS_TONE_MAP[record.status] as 'success' | 'caution' | 'critical' | 'info'}
                        >
                          {DRAW_STATUS_MAP[record.status]}
                        </s-badge>
                      ) : (
                        <s-text>-</s-text>
                      )}
                    </s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>

            {data.list.length === 0 && <EmptyState message="无相关记录" />}
          </>
        )}
      </s-stack>
    </s-section>
  )
}
