import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { competitorApi } from '~/services/competitor'
import { useLoading } from '~/hooks/useLoading'
import type { CompetitorWeeklyReport } from '~/types/competitor'
import { REPORT_STATUS_MAP, REPORT_STATUS_TONE } from '~/types/competitor'
import { SimpleMarkdown } from '~/components/SimpleMarkdown'

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '-'
  return iso.slice(0, 10)
}

export default function ReportDetailPage() {
  const { reportId } = useParams()
  const navigate = useNavigate()
  const { loading, run } = useLoading()
  const [report, setReport] = useState<CompetitorWeeklyReport | null>(null)

  const loadReport = useCallback(() => {
    if (!reportId) return
    run(async () => {
      const res = await competitorApi.getWeeklyReport(reportId)
      setReport(res)
    })
  }, [run, reportId])

  useEffect(() => {
    loadReport()
  }, [loadReport])

  if (loading && !report) {
    return (
      <s-page heading="周报详情">
        <s-box padding="large">
          <s-text>加载中…</s-text>
        </s-box>
      </s-page>
    )
  }

  if (!report) {
    return (
      <s-page heading="周报详情">
        <s-box padding="large">
          <s-text>未找到周报</s-text>
        </s-box>
      </s-page>
    )
  }

  const highlights = Array.isArray(report.highlightsJson) ? report.highlightsJson : []
  const brandAnalysis = Array.isArray(report.brandAnalysisJson) ? report.brandAnalysisJson : []
  const actionItems = Array.isArray(report.actionItemsJson) ? report.actionItemsJson : []

  return (
    <s-page heading={`周报 ${fmtDate(report.periodStart)} ~ ${fmtDate(report.periodEnd)}`}>
      <s-button slot="secondary-actions" variant="secondary" onClick={() => navigate('/app/competitor/reports')}>
        返回列表
      </s-button>

      <s-box padding="large">
        <s-stack direction="block" gap="large-200">
          {/* 基本信息 */}
          <s-section heading="报告信息">
            <s-stack direction="inline" gap="large-100">
              <s-text>状态：</s-text>
              <s-badge tone={REPORT_STATUS_TONE[report.status]}>{REPORT_STATUS_MAP[report.status]}</s-badge>
              <s-text>触发方式：{report.triggerType}</s-text>
              <s-text>模型：{report.modelUsed ?? '-'}</s-text>
            </s-stack>
          </s-section>

          {/* 总览 */}
          {report.overviewJson && (
            <s-section heading="总览">
              <s-box padding="base" borderWidth="base" borderRadius="base">
                <s-text>
                  {typeof report.overviewJson === 'string'
                    ? report.overviewJson
                    : JSON.stringify(report.overviewJson, null, 2)}
                </s-text>
              </s-box>
            </s-section>
          )}

          {/* 要点 */}
          {highlights.length > 0 && (
            <s-section heading="本周要点">
              <s-stack direction="block" gap="base">
                {highlights.map((h: any, i: number) => (
                  <s-box key={i} padding="base" borderWidth="base" borderRadius="base">
                    <s-stack direction="block" gap="small-200">
                      {h.title && <s-text type="strong">{h.title}</s-text>}
                      <s-text>{h.content ?? h.summary ?? JSON.stringify(h)}</s-text>
                    </s-stack>
                  </s-box>
                ))}
              </s-stack>
            </s-section>
          )}

          {/* 品牌分析 */}
          {brandAnalysis.length > 0 && (
            <s-section heading="品牌分析">
              <s-stack direction="block" gap="base">
                {brandAnalysis.map((b: any, i: number) => (
                  <s-box key={i} padding="base" borderWidth="base" borderRadius="base">
                    <s-stack direction="block" gap="small-200">
                      <s-text type="strong">{b.brandName ?? b.brand ?? `品牌 ${i + 1}`}</s-text>
                      <s-text>{b.analysis ?? b.summary ?? JSON.stringify(b)}</s-text>
                    </s-stack>
                  </s-box>
                ))}
              </s-stack>
            </s-section>
          )}

          {/* 行动项 */}
          {actionItems.length > 0 && (
            <s-section heading="行动建议">
              <s-stack direction="block" gap="small-200">
                {actionItems.map((a: any, i: number) => (
                  <s-box key={i} padding="base" borderWidth="base" borderRadius="base">
                    <s-text>
                      {a.priority && <s-badge tone={a.priority === 'HIGH' ? 'critical' : 'info'}>{a.priority}</s-badge>}{' '}
                      {a.action ?? a.content ?? JSON.stringify(a)}
                    </s-text>
                  </s-box>
                ))}
              </s-stack>
            </s-section>
          )}

          {/* Markdown 全文 */}
          {report.fullMarkdown && (
            <s-section heading="完整报告">
              <s-box padding="base" borderWidth="base" borderRadius="base">
                <SimpleMarkdown source={report.fullMarkdown} />
              </s-box>
            </s-section>
          )}
        </s-stack>
      </s-box>
    </s-page>
  )
}
