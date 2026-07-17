import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppliesToType } from '~/types/activity'

type SelectedProductResource = {
  type: 'PRODUCT'
  id: string
  title: string
  image?: string
  totalVariants: number
  selectedVariantIds: string[]
  selectedVariantsCount: number
}

type SelectedCollectionResource = {
  type: 'COLLECTION'
  id: string
  title: string
  image?: string
}

export type SelectedResource = SelectedProductResource | SelectedCollectionResource

interface UseResourcePickerParams {
  showAppliesTo: boolean
  readOnly: boolean
  appliesToType: AppliesToType
  appliesToIds: string[]
  onAppliesToChange: (value: { type: AppliesToType; ids: string[] }) => void
}

function getNumericCount(value: unknown): number {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'count' in value) {
    const count = (value as { count?: unknown }).count
    return typeof count === 'number' ? count : 0
  }
  return 0
}

function buildIdsFromSelectedResources(resources: SelectedResource[], appliesToType: AppliesToType): string[] {
  if (appliesToType === 'COLLECTION') {
    return resources.filter((r): r is SelectedCollectionResource => r.type === 'COLLECTION').map((r) => r.id)
  }

  // 产品场景：全选变体时提交产品 ID；部分选择时提交变体 ID
  const ids: string[] = []
  resources
    .filter((r): r is SelectedProductResource => r.type === 'PRODUCT')
    .forEach((resource) => {
      if (resource.totalVariants > resource.selectedVariantsCount) {
        ids.push(...resource.selectedVariantIds)
      } else {
        ids.push(resource.id)
      }
    })

  return Array.from(new Set(ids))
}

function buildSelectionIds(resources: SelectedResource[], appliesToType: AppliesToType) {
  if (appliesToType === 'COLLECTION') {
    return resources.filter((r): r is SelectedCollectionResource => r.type === 'COLLECTION').map((r) => ({ id: r.id }))
  }

  // 传给 Shopify picker 的初始选中结构，便于再次打开时回显用户之前的选择。
  return resources
    .filter((r): r is SelectedProductResource => r.type === 'PRODUCT')
    .map((r) => ({
      id: r.id,
      ...(r.selectedVariantIds.length > 0
        ? { variants: r.selectedVariantIds.map((variantId) => ({ id: variantId })) }
        : {})
    }))
}

function getResourceImageUrl(item: any): string | undefined {
  return item?.image?.originalSrc || item?.images?.[0]?.originalSrc || undefined
}

function mapPickerResultsToSelectedResources(results: any[], appliesToType: AppliesToType): SelectedResource[] {
  console.log('results', results)
  if (appliesToType === 'COLLECTION') {
    return results.map((item) => ({
      type: 'COLLECTION',
      id: item.id,
      title: item.title,
      image: getResourceImageUrl(item)
    }))
  }

  return results.map((item) => {
    const totalVariants = getNumericCount(item.totalVariants) || item.variants?.length || 1
    const selectedVariantIds = Array.isArray(item.variants) ? item.variants.map((variant: any) => variant.id) : []
    const selectedVariantsCount = selectedVariantIds.length > 0 ? selectedVariantIds.length : totalVariants

    return {
      type: 'PRODUCT',
      id: item.id,
      title: item.title,
      image: getResourceImageUrl(item),
      totalVariants,
      selectedVariantIds,
      selectedVariantsCount
    }
  })
}

export function useResourcePicker({
  showAppliesTo,
  readOnly,
  appliesToType,
  appliesToIds,
  onAppliesToChange
}: UseResourcePickerParams) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedResources, setSelectedResources] = useState<SelectedResource[]>([])
  const [loadingSelectedResources, setLoadingSelectedResources] = useState(false)
  // 记录最近一次已初始化的 type+ids，避免同一组数据重复请求详情接口。
  const initializedIdsRef = useRef<string>('')
  const idsKey = useMemo(
    () => `${appliesToType}:${appliesToIds.slice().sort().join(',')}`,
    [appliesToType, appliesToIds]
  )

  const handleResourcePick = async () => {
    if (readOnly || !showAppliesTo) return

    try {
      const picker = (shopify as any).resourcePicker
      if (!picker) {
        shopify.toast.show('当前环境暂不支持资源选择器', { isError: true })
        return
      }

      const results = await picker({
        type: appliesToType === 'PRODUCT' ? 'product' : 'collection',
        action: 'select',
        multiple: true,
        ...(searchQuery.trim() ? { query: searchQuery.trim() } : {}),
        ...(selectedResources.length > 0 ? { selectionIds: buildSelectionIds(selectedResources, appliesToType) } : {})
      })

      if (!results || results.length === 0) return

      const nextSelectedResources = mapPickerResultsToSelectedResources(results, appliesToType)
      const nextIds = buildIdsFromSelectedResources(nextSelectedResources, appliesToType)
      setSelectedResources(nextSelectedResources)
      onAppliesToChange({ type: appliesToType, ids: nextIds })
      initializedIdsRef.current = `${appliesToType}:${nextIds.slice().sort().join(',')}`
    } catch (error) {
      console.error('Resource picker error:', error)
      shopify.toast.show('打开资源选择器失败', { isError: true })
    }
  }

  const handleRemoveResource = (resourceId: string) => {
    const nextSelectedResources = selectedResources.filter((resource) => resource.id !== resourceId)
    const nextIds = buildIdsFromSelectedResources(nextSelectedResources, appliesToType)
    setSelectedResources(nextSelectedResources)
    onAppliesToChange({ type: appliesToType, ids: nextIds })
    initializedIdsRef.current = `${appliesToType}:${nextIds.slice().sort().join(',')}`
  }

  useEffect(() => {
    if (!showAppliesTo) return

    if (appliesToIds.length === 0) {
      setSelectedResources([])
      initializedIdsRef.current = ''
      return
    }

    if (initializedIdsRef.current === idsKey) return

    // 防止组件卸载后异步回调继续 setState。
    let isMounted = true

    const loadSelectedResources = async () => {
      setLoadingSelectedResources(true)
      try {
        const response = await fetch('/api/resource-details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: appliesToType,
            ids: appliesToIds
          })
        })

        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const data = (await response.json()) as { resources?: SelectedResource[] }
        if (!isMounted) return

        setSelectedResources(data.resources ?? [])
        initializedIdsRef.current = idsKey
      } catch (error) {
        console.error('Load selected resources error:', error)
        if (isMounted) {
          shopify.toast.show('加载已选资源失败', { isError: true })
        }
      } finally {
        if (isMounted) {
          setLoadingSelectedResources(false)
        }
      }
    }

    loadSelectedResources()

    return () => {
      isMounted = false
    }
  }, [showAppliesTo, appliesToType, appliesToIds, idsKey])

  return {
    searchQuery,
    setSearchQuery,
    selectedResources,
    loadingSelectedResources,
    handleResourcePick,
    handleRemoveResource
  }
}
