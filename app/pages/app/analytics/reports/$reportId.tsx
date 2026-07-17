import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useCurrencySymbol } from '~/hooks/useCurrencySymbol'
import { analyticsApi } from '~/services/analytics'
import { AiInsightCard, ReportStatusBadge, ReportTable, Tabs } from '~/components/analytics/widgets'
import { ACTIVE_TABLE_TYPES, TABLE_TYPE_MAP } from '~/types/analytics'
import type { AnalyticsReportDetail, TableType } from '~/types/analytics'

const TABS = ACTIVE_TABLE_TYPES.map((key) => ({ key, label: TABLE_TYPE_MAP[key] }))

export default function AnalyticsReportDetailPage() {
  const { reportId } = useParams()
  const navigate = useNavigate()
  const symbol = useCurrencySymbol()
  const [tab, setTab] = useState<TableType>('SALES_SITE')
  const [exporting, setExporting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<AnalyticsReportDetail | null>(null)

  useEffect(() => {
    if (!reportId) return
    let alive = true
    setLoading(true)
    analyticsApi
      .getReportDetail(reportId)
      .then((d) => {
        if (alive) setDetail(d)
      })
      .catch(() => {
        /* toasted */
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [reportId])

  if (loading) {
    return (
      <s-page heading="报告详情">
        <s-box padding="large">
          <s-text tone="neutral">加载中…</s-text>
        </s-box>
      </s-page>
    )
  }

  if (!detail) {
    return (
      <s-page heading="报告详情">
        <s-box padding="large">
          <s-section>
            <s-stack direction="block" gap="base">
              <s-text tone="neutral">报告不存在或尚未生成完成。</s-text>
              <s-button variant="secondary" onClick={() => navigate('/app/analytics/reports')}>
                返回报告存档
              </s-button>
            </s-stack>
          </s-section>
        </s-box>
      </s-page>
    )
  }

  const onExport = async () => {
    if (!reportId || exporting) return
    setExporting(true)
    try {
      await analyticsApi.exportReport(reportId)
    } catch {
      /* toasted */
    } finally {
      setExporting(false)
    }
  }

  const unmatchedTotal =
    detail.unmatched.missingModel.length + detail.unmatched.ga4Unaligned.length + detail.unmatched.sourceMediums.length

  return (
    <s-page heading={`${detail.granularity === 'WEEK' ? '周报' : '月报'} · ${detail.periodLabel}`}>
      <s-button slot="primary-action" variant="primary" onClick={onExport} disabled={exporting || undefined}>
        {exporting ? '导出中…' : '导出整份报告(多 Sheet)'}
      </s-button>
      <s-button slot="secondary-actions" variant="secondary" onClick={() => navigate('/app/analytics/reports')}>
        返回存档
      </s-button>

      <s-box padding="large">
        <s-stack direction="block" gap="large-100">
          <s-stack direction="inline" gap="base" alignItems="center">
            <ReportStatusBadge status={detail.status} />
            <s-text tone="neutral">
              数据截止 {detail.dataThrough} · 生成于 {detail.createdAt}
            </s-text>
          </s-stack>

          {detail.status === 'FAILED' && (
            <s-banner tone="critical" heading="报告生成失败">
              <s-text>{detail.errorMessage || '生成过程中出错,可点「重新生成」重试。'}</s-text>
            </s-banner>
          )}

          {!detail.tables && detail.status !== 'FAILED' && (
            <s-banner tone="info" heading="报告生成中">
              <s-text>采集 + 组表 + AI 进行中(约 1–2 分钟),请稍后刷新本页。</s-text>
            </s-banner>
          )}

          {detail.tables && (
            <>
              {detail.ai && <AiInsightCard ai={detail.ai} />}

              <s-section>
                <s-stack direction="block" gap="base">
                  <Tabs tabs={TABS} active={tab} onChange={(k) => setTab(k as TableType)} />
                  {detail.tables[tab] ? (
                    <ReportTable
                      table={detail.tables[tab]}
                      symbol={symbol}
                      onUnmatchedClick={() => navigate('/app/analytics/maps')}
                    />
                  ) : (
                    <s-text tone="neutral">该历史报告未包含此表,可重新生成报告后查看。</s-text>
                  )}
                </s-stack>
              </s-section>
            </>
          )}

          {unmatchedTotal > 0 && (
            <s-section heading="本期未匹配清单">
              <s-stack direction="block" gap="base">
                <s-text tone="neutral">数据中出现但口径无对应,建议尽快处理。</s-text>
                {detail.unmatched.missingModel.length > 0 && (
                  <s-stack direction="inline" gap="small-200" alignItems="center">
                    <s-text tone="neutral">缺 Model 商品:</s-text>
                    {detail.unmatched.missingModel.map((x) => (
                      <s-badge key={x} tone="warning">
                        {x}
                      </s-badge>
                    ))}
                  </s-stack>
                )}
                {detail.unmatched.ga4Unaligned.length > 0 && (
                  <s-stack direction="inline" gap="small-200" alignItems="center">
                    <s-text tone="neutral">GA4 未对齐:</s-text>
                    {detail.unmatched.ga4Unaligned.map((x) => (
                      <s-badge key={x} tone="warning">
                        {x}
                      </s-badge>
                    ))}
                  </s-stack>
                )}
                {detail.unmatched.sourceMediums.length > 0 && (
                  <s-stack direction="inline" gap="small-200" alignItems="center">
                    <s-text tone="neutral">未分组渠道:</s-text>
                    {detail.unmatched.sourceMediums.map((x) => (
                      <s-badge key={x} tone="warning">
                        {x}
                      </s-badge>
                    ))}
                  </s-stack>
                )}
                <s-button variant="secondary" onClick={() => navigate('/app/analytics/maps')}>
                  去口径管理处理
                </s-button>
              </s-stack>
            </s-section>
          )}
        </s-stack>
      </s-box>
    </s-page>
  )
}
