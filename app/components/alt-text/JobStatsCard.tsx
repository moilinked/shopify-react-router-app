import type { AltTextJobStatsDTO } from '~/types/altText'

interface Props {
  stats: AltTextJobStatsDTO | null
  loading: boolean
  onViewHistory: () => void
}

const fmtNumber = (n: number) => n.toLocaleString()

export function JobStatsCard({ stats, loading, onViewHistory }: Props) {
  const pendingReview = stats?.pendingReview ?? 0
  const failed = stats?.failed ?? 0

  return (
    <s-section heading="历史操作统计">
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" gap="base" justifyContent="space-between" alignItems="center">
          <s-text tone="neutral">{loading ? '统计加载中…' : '生成任务条目状态汇总'}</s-text>
          <s-button variant="tertiary" onClick={onViewHistory}>
            查看历史
          </s-button>
        </s-stack>
        <s-stack direction="inline" gap="large-100">
          <Metric label="待审核" value={`${fmtNumber(pendingReview)} 条`} tone="warning" />
          <Metric label="失败" value={`${fmtNumber(failed)} 条`} tone="critical" />
        </s-stack>
      </s-stack>
    </s-section>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone: 'warning' | 'critical' }) {
  return (
    <s-box padding="base" borderWidth="base" borderRadius="base" inlineSize="180px">
      <s-stack direction="block" gap="small-100">
        <s-text tone="neutral">{label}</s-text>
        <s-stack direction="inline" gap="small-200">
          <s-text type="strong">{value}</s-text>
          <s-badge tone={tone}>{label}</s-badge>
        </s-stack>
      </s-stack>
    </s-box>
  )
}
