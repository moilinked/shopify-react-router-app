import type { AppliesToType } from '~/types/activity'
import type { SelectedResource } from '~/hooks/useResourcePicker'

interface ResourcePickerProps {
  appliesToType: AppliesToType
  readOnly: boolean
  searchQuery: string
  error?: string
  loading: boolean
  resources: SelectedResource[]
  onSearchQueryChange: (value: string) => void
  onPick: () => Promise<void>
  onRemove: (resourceId: string) => void
}

export function ResourcePicker({
  appliesToType,
  readOnly,
  searchQuery,
  error,
  loading,
  resources,
  onSearchQueryChange,
  onPick,
  onRemove
}: ResourcePickerProps) {
  return (
    <s-stack gap="small-300">
      <s-text>{appliesToType === 'PRODUCT' ? '特定产品' : '特定产品集合'}</s-text>
      <s-grid gridTemplateColumns="1fr auto" gap="small-300">
        <s-text-field
          label=""
          value={searchQuery}
          disabled={readOnly || undefined}
          placeholder={`搜索${appliesToType === 'PRODUCT' ? '产品' : '集合'}`}
          icon="search"
          error={error}
          onInput={(e: Event) => onSearchQueryChange((e.target as HTMLInputElement).value)}
          {...({
            onKeyPress: async (e: any) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                await onPick()
              }
            }
          } as any)}
        />
        <div style={{ height: '32px' }}>
          <s-button variant="secondary" onClick={onPick} disabled={readOnly || undefined}>
            浏览
          </s-button>
        </div>
      </s-grid>

      {loading && <s-text>正在加载已选资源...</s-text>}

      {!loading && resources.length > 0 && (
        <s-stack gap="small">
          {resources.map((resource) => (
            <s-box key={resource.id} padding="small" borderWidth="base" borderRadius="small">
              <s-grid gridTemplateColumns="auto 1fr auto" gap="small" alignItems="center">
                <s-thumbnail src={resource.image} alt={resource.title} size="small" />
                <s-stack>
                  <s-text>{resource.title}</s-text>
                  {resource.type === 'PRODUCT' && resource.totalVariants > 1 && (
                    <s-text tone="neutral">{resource.selectedVariantsCount} 个变体已选</s-text>
                  )}
                </s-stack>
                {!readOnly && (
                  <s-button variant="tertiary" onClick={() => onRemove(resource.id)}>
                    ✕
                  </s-button>
                )}
              </s-grid>
            </s-box>
          ))}
        </s-stack>
      )}
    </s-stack>
  )
}
