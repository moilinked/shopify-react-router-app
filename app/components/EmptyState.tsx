interface EmptyStateProps {
  heading?: string
  message: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ heading, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <s-section accessibilityLabel="Empty state">
      <s-grid gap="base" justifyItems="center" paddingBlock="large-400">
        <s-grid justifyItems="center" maxInlineSize="450px" gap="base">
          <s-stack alignItems="center">
            {heading && <s-heading>{heading}</s-heading>}
            <s-paragraph>{message}</s-paragraph>
          </s-stack>
          {actionLabel && onAction && (
            <s-button variant="primary" onClick={onAction}>
              {actionLabel}
            </s-button>
          )}
        </s-grid>
      </s-grid>
    </s-section>
  )
}
