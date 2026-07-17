interface RetryErrorBannerProps {
  error: Error
  onRetry: () => void
  heading?: string
}

export function RetryErrorBanner({ error, onRetry, heading = '加载失败' }: RetryErrorBannerProps) {
  return (
    <s-banner tone="critical" heading={heading}>
      <s-stack direction="inline" gap="small-300" alignItems="center" justifyContent="center">
        <s-text>{error.message}</s-text>
        <s-button onClick={onRetry}>重试</s-button>
      </s-stack>
    </s-banner>
  )
}
