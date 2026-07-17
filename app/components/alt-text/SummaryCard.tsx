import type { AltTextSummaryDTO } from '~/types/altText'

interface Props {
  summary: AltTextSummaryDTO | null
  scanning: boolean
  onScan: () => void
}

const fmtNumber = (n: number) => n.toLocaleString()

const fmtTime = (iso: string | null) => {
  if (!iso) return '尚未扫描'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

export function SummaryCard({ summary, scanning, onScan }: Props) {
  const total = summary?.totalImages ?? 0
  const missing = summary?.missingAlt ?? 0
  const optimized = summary?.aiOptimized ?? 0
  const withAlt = Math.max(0, total - missing)

  return (
    <s-section heading="店铺图片概览">
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" gap="large-100">
          <Metric label="图片总数" value={fmtNumber(total)} tone="info" />
          <Metric label="已有 ALT" value={fmtNumber(withAlt)} tone="success" />
          <Metric label="缺少 ALT" value={fmtNumber(missing)} tone="warning" />
          <Metric label="AI 优化" value={fmtNumber(optimized)} tone="info" />
        </s-stack>
        <s-stack direction="inline" gap="base">
          <s-text tone="neutral">最近扫描：{fmtTime(summary?.lastScanAt ?? null)}</s-text>
          <s-button onClick={onScan} disabled={scanning || undefined}>
            {scanning ? '扫描中…' : '重新扫描'}
          </s-button>
        </s-stack>
      </s-stack>
    </s-section>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone: 'info' | 'success' | 'warning' }) {
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
