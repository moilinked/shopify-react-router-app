import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { altTextApi, type CandidateImage, type CandidateProduct } from '~/services/altText'
import { useAltTextStore } from '~/stores/useAltTextStore'
import { useLoading } from '~/hooks/useLoading'
import { RetryErrorBanner } from '~/components/RetryErrorBanner'
import { EmptyState } from '~/components/EmptyState'
import { SummaryCard } from '~/components/alt-text/SummaryCard'
import { JobStatsCard } from '~/components/alt-text/JobStatsCard'
import { GenerateModal, type GenerateModalSubmit } from '~/components/alt-text/GenerateModal'
import type { AltTextJobStatsDTO, AltTextSummaryDTO, FilesFilter, ResourceType } from '~/types/altText'

type ViewMode = 'products' | 'files'

const FILE_FILTERS: { value: FilesFilter; label: string }[] = [
  { value: 'all', label: '全部图片' },
  { value: 'missing-alt', label: '缺少 ALT' },
  { value: 'ai-optimized', label: 'AI 已优化' }
]

const PRODUCTS_PAGE_SIZE = 50
const FILES_PAGE_SIZE = 100

/** 从 Shopify CDN URL 中提取文件名，剔除 query string；失败时回退最后一段路径。 */
function getImageFilename(url: string): string {
  if (!url) return ''
  try {
    const u = new URL(url)
    const last = u.pathname.split('/').filter(Boolean).pop() ?? ''
    return decodeURIComponent(last)
  } catch {
    const noQuery = url.split('?')[0]
    return noQuery.split('/').pop() ?? url
  }
}

interface PickerState {
  productId: string | null
  /**
   * 每次"open"时递增，确保即使重复打开同一个 product（state.productId 没变化）
   * 也能让 useEffect 重新触发 showOverlay。同时配合 modal 自身的 close 事件回写
   * productId=null，处理用户用 X / 背景点击关闭的场景。
   */
  nonce: number
}

interface FlatImage {
  id: string
  url: string
  alt: string | null
  resourceType: ResourceType
  parentId: string | null
  parentTitle: string | null
}

const flattenSelection = (
  products: CandidateProduct[],
  files: CandidateImage[],
  selectedIds: Set<string>
): FlatImage[] => {
  const out: FlatImage[] = []
  for (const p of products) {
    for (const i of p.images) {
      if (!selectedIds.has(i.id)) continue
      out.push({
        id: i.id,
        url: i.url,
        alt: i.alt,
        resourceType: i.resourceType,
        parentId: p.id,
        parentTitle: p.title
      })
    }
  }
  for (const f of files) {
    if (!selectedIds.has(f.id)) continue
    out.push({
      id: f.id,
      url: f.url,
      alt: f.alt,
      resourceType: f.resourceType,
      parentId: null,
      parentTitle: null
    })
  }
  return out
}

export default function AltTextIndex() {
  const navigate = useNavigate()
  const {
    products,
    files,
    selectedImageIds,
    setProducts,
    setFiles,
    removeProduct,
    toggleImageSelected,
    selectImages,
    unselectImages,
    clearSelection
  } = useAltTextStore()

  const [summary, setSummary] = useState<AltTextSummaryDTO | null>(null)
  const [jobStats, setJobStats] = useState<AltTextJobStatsDTO | null>(null)
  const [scanning, setScanning] = useState(false)
  const [view, setView] = useState<ViewMode>('products')
  const [filesFilter, setFilesFilter] = useState<FilesFilter>('all')
  const [generateOpen, setGenerateOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [picker, setPicker] = useState<PickerState>({ productId: null, nonce: 0 })
  const [productPage, setProductPage] = useState(1)
  const [filePage, setFilePage] = useState(1)
  const [fileNameQuery, setFileNameQuery] = useState('')
  // Files 筛选采用「待提交」模式：select / 文件名输入框只更新 pending，
  // 点击「筛选」按钮才把 pending 提交到 filesFilter / fileNameQuery 触发实际筛选。
  const [pendingFilter, setPendingFilter] = useState<FilesFilter>('all')
  const [pendingNameQuery, setPendingNameQuery] = useState('')

  const summaryReq = useLoading()
  const jobStatsReq = useLoading()
  const candidatesReq = useLoading()
  // useLoading 每次渲染返回新对象，把 run 拿出来固定引用，避免依赖整个对象触发无限循环
  const summaryRun = summaryReq.run
  const jobStatsRun = jobStatsReq.run

  const refreshSummary = useCallback(async () => {
    const res = await summaryRun(() => altTextApi.getSummary())
    if (res) setSummary(res.summary)
  }, [summaryRun])

  const refreshJobStats = useCallback(async () => {
    const res = await jobStatsRun(() => altTextApi.getJobStats())
    if (res) setJobStats(res.stats)
  }, [jobStatsRun])

  useEffect(() => {
    void refreshSummary()
    void refreshJobStats()
  }, [refreshSummary, refreshJobStats])

  const handleScan = async () => {
    setScanning(true)
    try {
      const res = await altTextApi.scan()
      setSummary(res.summary)
      shopify.toast.show('扫描完成')
    } catch (e) {
      shopify.toast.show(`扫描失败：${(e as Error).message}`, { isError: true })
    } finally {
      setScanning(false)
    }
  }

  // ── 拉取候选 ────────────────────────────────
  const loadAllProducts = async () => {
    const res = await candidatesReq.run(() => altTextApi.loadProducts({ source: 'all-products' }))
    if (res) {
      setProducts(res.products)
      setView('products')
    }
  }

  const loadProductsByPicker = async () => {
    try {
      const picker = (shopify as any).resourcePicker
      const picked = await picker?.({ type: 'product', action: 'select', multiple: true })
      if (!picked || picked.length === 0) return
      const ids: string[] = picked.map((p: any) => p.id)
      const res = await candidatesReq.run(() => altTextApi.loadProducts({ source: 'products', productIds: ids }))
      if (res) {
        setProducts(res.products)
        setView('products')
      }
    } catch (e) {
      shopify.toast.show(`选择商品失败：${(e as Error).message}`, { isError: true })
    }
  }

  const loadCollectionsByPicker = async () => {
    try {
      const picker = (shopify as any).resourcePicker
      const picked = await picker?.({ type: 'collection', action: 'select', multiple: true })
      if (!picked || picked.length === 0) return
      const ids: string[] = picked.map((p: any) => p.id)
      const res = await candidatesReq.run(() => altTextApi.loadProducts({ source: 'collections', collectionIds: ids }))
      if (res) {
        setProducts(res.products)
        setView('products')
      }
    } catch (e) {
      shopify.toast.show(`选择系列失败：${(e as Error).message}`, { isError: true })
    }
  }

  const loadFiles = async (filter: FilesFilter) => {
    setFilesFilter(filter)
    const res = await candidatesReq.run(() => altTextApi.loadFiles(filter))
    if (res) {
      setFiles(res.images)
      setView('files')
    }
  }

  /**
   * 点击「筛选」按钮时调用：
   * - 若服务端筛选条件变了或者还没加载过 → 远程拉一次（顺便切到 files 视图）
   * - 始终把待提交的文件名筛选词提交到 fileNameQuery（客户端筛选）
   */
  const applyFilesFilter = async () => {
    setFileNameQuery(pendingNameQuery)
    if (pendingFilter !== filesFilter || files.length === 0) {
      await loadFiles(pendingFilter)
    }
  }

  // ── 生成 ────────────────────────────────────
  const selectedFlat = useMemo(
    () => flattenSelection(products, files, selectedImageIds),
    [products, files, selectedImageIds]
  )

  // 当前选区中已经有 ALT 的图片（用于 Skip 提示）
  const selectedWithAltIds = useMemo(
    () => selectedFlat.filter((i) => i.alt && i.alt.trim()).map((i) => i.id),
    [selectedFlat]
  )

  // 选中的商品数（用 parentId 去重；files 视图下统计 files 数）
  const selectedSourceCount = useMemo(() => {
    if (view === 'products') {
      const ids = new Set<string>()
      for (const i of selectedFlat) if (i.parentId) ids.add(i.parentId)
      return ids.size
    }
    return selectedFlat.length
  }, [view, selectedFlat])

  const handleGenerateSubmit = async (v: GenerateModalSubmit) => {
    if (selectedFlat.length === 0) return
    setGenerating(true)
    try {
      const res = await altTextApi.generate({
        language: v.language,
        includeProductTitle: v.includeProductTitle,
        prompt: v.prompt,
        brand: v.brand,
        keywords: v.keywords,
        source: view === 'products' ? 'products' : `files-${filesFilter}`,
        items: selectedFlat.map((img) => ({
          resourceType: img.resourceType,
          resourceId: img.id,
          parentId: img.parentId,
          parentTitle: img.parentTitle,
          imageUrl: img.url,
          originalAlt: img.alt
        }))
      })
      shopify.toast.show(`已创建生成任务（${res.total} 张）`)
      setGenerateOpen(false)
      clearSelection()
      navigate(`/app/alt-text/review/${res.jobId}`)
    } catch (e) {
      shopify.toast.show(`提交失败：${(e as Error).message}`, { isError: true })
    } finally {
      setGenerating(false)
    }
  }

  const pickerProduct = useMemo(
    () => products.find((p) => p.id === picker.productId) ?? null,
    [products, picker.productId]
  )

  const openPicker = (id: string) => setPicker((s) => ({ productId: id, nonce: s.nonce + 1 }))
  const closePicker = useCallback(() => setPicker((s) => ({ productId: null, nonce: s.nonce })), [])

  // 商品列表分页：每页 50。products 变化（重新加载、删除）时回到第 1 页。
  const productPageCount = Math.max(1, Math.ceil(products.length / PRODUCTS_PAGE_SIZE))
  // 用首个 product id 作为"重置"信号——重新加载时首项必然变化；
  // 删除非首项时不会触发回到第 1 页（用户体验更稳）。
  const productsHeadId = products[0]?.id ?? ''
  useEffect(() => {
    setProductPage(1)
  }, [productsHeadId])
  useEffect(() => {
    if (productPage > productPageCount) setProductPage(productPageCount)
  }, [productPage, productPageCount])

  const pagedProducts = useMemo(
    () => products.slice((productPage - 1) * PRODUCTS_PAGE_SIZE, productPage * PRODUCTS_PAGE_SIZE),
    [products, productPage]
  )

  // Files 视图：按文件名做客户端筛选 + 分页 100 条/页
  const filteredFiles = useMemo(() => {
    const q = fileNameQuery.trim().toLowerCase()
    if (!q) return files
    return files.filter((f) => getImageFilename(f.url).toLowerCase().includes(q))
  }, [files, fileNameQuery])

  const filePageCount = Math.max(1, Math.ceil(filteredFiles.length / FILES_PAGE_SIZE))
  // 筛选条件或文件集变化时回到第 1 页
  useEffect(() => {
    setFilePage(1)
  }, [fileNameQuery, files])
  useEffect(() => {
    if (filePage > filePageCount) setFilePage(filePageCount)
  }, [filePage, filePageCount])

  const pagedFiles = useMemo(
    () => filteredFiles.slice((filePage - 1) * FILES_PAGE_SIZE, filePage * FILES_PAGE_SIZE),
    [filteredFiles, filePage]
  )

  // 当前 tab/view 下的全部图片 id 与当前页图片 id（喂给 SelectionBanner 的两个 checkbox）
  const viewAllIds = useMemo(() => {
    if (view === 'products') return products.flatMap((p) => p.images.map((i) => i.id))
    return filteredFiles.map((f) => f.id)
  }, [view, products, filteredFiles])

  const viewPageIds = useMemo(() => {
    if (view === 'products') return pagedProducts.flatMap((p) => p.images.map((i) => i.id))
    return pagedFiles.map((f) => f.id)
  }, [view, pagedProducts, pagedFiles])

  const hasCandidates = view === 'products' ? products.length > 0 : files.length > 0

  return (
    <s-page heading="AI 替代文本">
      <s-box padding="large">
        <s-stack direction="block" gap="large-100">
          <SummaryCard summary={summary} scanning={scanning} onScan={handleScan} />
          <JobStatsCard
            stats={jobStats}
            loading={jobStatsReq.loading}
            onViewHistory={() => navigate('/app/alt-text/history')}
          />

          <SourceTabs view={view} onChange={setView} />

          <s-section>
            {view === 'products' ? (
              <s-stack direction="inline" gap="base">
                <s-button onClick={loadAllProducts}>添加所有商品</s-button>
                <s-button onClick={loadProductsByPicker}>选择商品</s-button>
                <s-button onClick={loadCollectionsByPicker}>按系列添加</s-button>
              </s-stack>
            ) : (
              <s-stack direction="inline" gap="base" alignItems="end">
                <s-select
                  label="筛选"
                  value={pendingFilter}
                  onChange={(e: Event) => setPendingFilter((e.target as HTMLSelectElement).value as FilesFilter)}
                >
                  {FILE_FILTERS.map((f) => (
                    <s-option key={f.value} value={f.value}>
                      {f.label}
                    </s-option>
                  ))}
                </s-select>
                <s-text-field
                  label="按文件名筛选"
                  placeholder="输入文件名片段，例如 ui-wd"
                  value={pendingNameQuery}
                  onInput={(e: Event) => setPendingNameQuery((e.target as HTMLInputElement).value)}
                />
                <s-button variant="primary" onClick={applyFilesFilter} disabled={candidatesReq.loading || undefined}>
                  筛选
                </s-button>
              </s-stack>
            )}
          </s-section>

          {(candidatesReq.error || summaryReq.error || jobStatsReq.error) && (
            <s-stack direction="block" gap="small-200">
              {candidatesReq.error && (
                <RetryErrorBanner
                  error={candidatesReq.error}
                  heading="加载候选失败"
                  onRetry={view === 'products' ? loadAllProducts : () => loadFiles(filesFilter)}
                />
              )}
              {summaryReq.error && (
                <RetryErrorBanner error={summaryReq.error} heading="加载概览失败" onRetry={refreshSummary} />
              )}
              {jobStatsReq.error && (
                <RetryErrorBanner error={jobStatsReq.error} heading="加载历史统计失败" onRetry={refreshJobStats} />
              )}
            </s-stack>
          )}

          {/* 选区 + 生成 banner（候选不为空时才显示） */}
          {hasCandidates && (
            <SelectionBanner
              selectedCount={selectedFlat.length}
              sourceCount={selectedSourceCount}
              sourceLabel={view === 'products' ? '件商品' : '张 Files 图片'}
              withAltCount={selectedWithAltIds.length}
              onSkipAlt={() => unselectImages(selectedWithAltIds)}
              viewAllIds={viewAllIds}
              viewPageIds={viewPageIds}
              onSelectIds={selectImages}
              onUnselectIds={unselectImages}
              onGenerate={() => setGenerateOpen(true)}
            />
          )}

          {candidatesReq.loading && <s-spinner accessibilityLabel="loading" />}

          {!candidatesReq.loading && view === 'products' && products.length > 0 && (
            <ProductsTable
              products={pagedProducts}
              totalCount={products.length}
              page={productPage}
              pageCount={productPageCount}
              pageSize={PRODUCTS_PAGE_SIZE}
              onPageChange={setProductPage}
              selectedIds={selectedImageIds}
              onPick={openPicker}
              onRemove={removeProduct}
            />
          )}

          {!candidatesReq.loading && view === 'files' && filteredFiles.length > 0 && (
            <FilesTable
              files={pagedFiles}
              totalCount={filteredFiles.length}
              page={filePage}
              pageCount={filePageCount}
              pageSize={FILES_PAGE_SIZE}
              onPageChange={setFilePage}
              selectedIds={selectedImageIds}
              onToggle={toggleImageSelected}
            />
          )}

          {!candidatesReq.loading && view === 'products' && products.length === 0 && (
            <EmptyState message="点击上方按钮选择需要生成 ALT 的商品。" />
          )}
          {!candidatesReq.loading && view === 'files' && files.length === 0 && (
            <EmptyState message="选择 Files 筛选条件以加载图片。" />
          )}
          {!candidatesReq.loading && view === 'files' && files.length > 0 && filteredFiles.length === 0 && (
            <EmptyState message={`没有匹配 "${fileNameQuery}" 的文件。`} />
          )}
        </s-stack>
      </s-box>

      <ImagesPickerModal
        product={pickerProduct}
        nonce={picker.nonce}
        selectedIds={selectedImageIds}
        onSelect={selectImages}
        onUnselect={unselectImages}
        onClose={closePicker}
      />

      <GenerateModal
        open={generateOpen}
        count={selectedFlat.length}
        submitting={generating}
        onClose={() => setGenerateOpen(false)}
        onSubmit={handleGenerateSubmit}
      />
    </s-page>
  )
}

// ── 来源 Tab 切换器（按商品/系列 ↔ Files 图片） ──────

function SourceTabs({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <s-stack direction="inline" gap="small-200">
      <s-button variant={view === 'products' ? 'primary' : 'tertiary'} onClick={() => onChange('products')}>
        按商品 / 系列
      </s-button>
      <s-button variant={view === 'files' ? 'primary' : 'tertiary'} onClick={() => onChange('files')}>
        Files 图片
      </s-button>
    </s-stack>
  )
}

// ── 顶部选区 banner ─────────────────────────────────

function SelectionBanner({
  selectedCount,
  sourceCount,
  sourceLabel,
  withAltCount,
  onSkipAlt,
  viewAllIds,
  viewPageIds,
  onSelectIds,
  onUnselectIds,
  onGenerate
}: {
  selectedCount: number
  sourceCount: number
  sourceLabel: string
  withAltCount: number
  onSkipAlt: () => void
  /** 当前 view（products/files）所有图片 id（跨页） */
  viewAllIds: string[]
  /** 当前 view 当前页的图片 id */
  viewPageIds: string[]
  onSelectIds: (ids: string[]) => void
  onUnselectIds: (ids: string[]) => void
  onGenerate: () => void
}) {
  // 计算两个 checkbox 的状态需要知道 selectedIds，但只把"已选数"传过来，
  // 这里直接从 store 读一次即可避免再把 Set 透传一层
  const selectedImageIds = useAltTextStore((s) => s.selectedImageIds)

  const allSelectedCount = viewAllIds.reduce((n, id) => (selectedImageIds.has(id) ? n + 1 : n), 0)
  const pageSelectedCount = viewPageIds.reduce((n, id) => (selectedImageIds.has(id) ? n + 1 : n), 0)

  const allChecked = viewAllIds.length > 0 && allSelectedCount === viewAllIds.length
  const allIndeterminate = allSelectedCount > 0 && allSelectedCount < viewAllIds.length
  const pageChecked = viewPageIds.length > 0 && pageSelectedCount === viewPageIds.length
  const pageIndeterminate = pageSelectedCount > 0 && pageSelectedCount < viewPageIds.length

  const toggleAll = () => {
    if (allChecked) onUnselectIds(viewAllIds)
    else onSelectIds(viewAllIds)
  }
  const togglePage = () => {
    if (pageChecked) onUnselectIds(viewPageIds)
    else onSelectIds(viewPageIds)
  }

  return (
    <s-banner tone="info">
      <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
        <s-stack direction="block" gap="small-100">
          <s-text type="strong">
            已选 {selectedCount} 张唯一图片，来自 {sourceCount} {sourceLabel}
          </s-text>
          {withAltCount > 0 && (
            <s-paragraph>
              <s-text tone="neutral">{withAltCount} 张图片已有 ALT</s-text>
              <s-text tone="neutral"> — </s-text>
              <s-link onClick={onSkipAlt} accessibilityLabel="跳过已有 ALT 的图片">
                跳过
              </s-link>
            </s-paragraph>
          )}
        </s-stack>
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-checkbox
            checked={allChecked || undefined}
            indeterminate={allIndeterminate || undefined}
            label={`全选（${viewAllIds.length}）`}
            onChange={toggleAll}
          />
          <s-checkbox
            checked={pageChecked || undefined}
            indeterminate={pageIndeterminate || undefined}
            label={`全选当页（${viewPageIds.length}）`}
            onChange={togglePage}
          />
          <s-button variant="primary" disabled={selectedCount === 0 || undefined} onClick={onGenerate}>
            生成 ALT（{selectedCount}）
          </s-button>
        </s-stack>
      </s-stack>
    </s-banner>
  )
}

// ── 商品表格 ────────────────────────────────────────

function ProductsTable({
  products,
  totalCount,
  page,
  pageCount,
  pageSize,
  onPageChange,
  selectedIds,
  onPick,
  onRemove
}: {
  products: CandidateProduct[]
  totalCount: number
  page: number
  pageCount: number
  pageSize: number
  onPageChange: (page: number) => void
  selectedIds: Set<string>
  onPick: (productId: string) => void
  onRemove: (productId: string) => void
}) {
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, totalCount)

  return (
    <s-section>
      <s-table>
        <s-table-header-row>
          <s-table-header>商品</s-table-header>
          <s-table-header>总计图片</s-table-header>
          <s-table-header>已选图片</s-table-header>
          <s-table-header>操作</s-table-header>
        </s-table-header-row>
        <s-table-body>
          {products.map((p) => {
            const selectedCount = p.images.filter((i) => selectedIds.has(i.id)).length
            const cover = p.images[0]?.url
            return (
              <s-table-row key={p.id}>
                <s-table-cell>
                  <s-stack direction="inline" gap="small-200" alignItems="center">
                    {cover ? (
                      <s-thumbnail src={cover} alt={p.title} size="base" />
                    ) : (
                      <s-box padding="small-100">
                        <s-text tone="neutral">—</s-text>
                      </s-box>
                    )}
                    <s-text>{p.title}</s-text>
                  </s-stack>
                </s-table-cell>
                <s-table-cell>{p.totalImages}</s-table-cell>
                <s-table-cell>{selectedCount}</s-table-cell>
                <s-table-cell>
                  <s-stack direction="inline" gap="small-100">
                    <s-button onClick={() => onPick(p.id)}>选择图片</s-button>
                    <s-button variant="tertiary" tone="critical" onClick={() => onRemove(p.id)}>
                      删除
                    </s-button>
                  </s-stack>
                </s-table-cell>
              </s-table-row>
            )
          })}
        </s-table-body>
      </s-table>

      {totalCount > pageSize && (
        <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
          <s-text tone="neutral">
            第 {start}–{end} 件 / 共 {totalCount} 件商品
          </s-text>
          <s-stack direction="inline" gap="small-200" alignItems="center">
            <s-button
              variant="tertiary"
              disabled={page <= 1 || undefined}
              onClick={() => onPageChange(Math.max(1, page - 1))}
            >
              上一页
            </s-button>
            <s-text tone="neutral">
              {page} / {pageCount}
            </s-text>
            <s-button
              variant="tertiary"
              disabled={page >= pageCount || undefined}
              onClick={() => onPageChange(Math.min(pageCount, page + 1))}
            >
              下一页
            </s-button>
          </s-stack>
        </s-stack>
      )}
    </s-section>
  )
}

// ── 单商品图片选择 modal ────────────────────────────

function ImagesPickerModal({
  product,
  nonce,
  selectedIds,
  onSelect,
  onUnselect,
  onClose
}: {
  product: CandidateProduct | null
  nonce: number
  selectedIds: Set<string>
  onSelect: (ids: string[]) => void
  onUnselect: (ids: string[]) => void
  onClose: () => void
}) {
  const ref = useRef<any>(null)

  // 用 nonce 强制每次"open"都触发 effect，即使是同一个 product 被反复打开
  useEffect(() => {
    if (product) ref.current?.showOverlay?.()
    // 仅在打开时调用，不要在 product=null 时主动 hide：modal 自己关闭后会派发 close 事件
  }, [product, nonce])

  // 监听 modal 自身关闭事件（X / 背景 / Escape），同步 React 端 state
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handler = () => onClose()
    // 兼容多种事件名（不同版本的 polaris web-components）
    el.addEventListener('close', handler)
    el.addEventListener('hide', handler)
    el.addEventListener('cancel', handler)
    return () => {
      el.removeEventListener('close', handler)
      el.removeEventListener('hide', handler)
      el.removeEventListener('cancel', handler)
    }
  }, [onClose])

  if (!product) {
    // 仍然挂载空 modal，避免 ref 抖动
    return <s-modal ref={ref} id="alt-text-images-picker" heading="选择图片" />
  }

  const selectedCount = product.images.filter((i) => selectedIds.has(i.id)).length
  const allSelected = selectedCount === product.images.length

  const toggleAll = () => {
    if (allSelected) onUnselect(product.images.map((i) => i.id))
    else onSelect(product.images.map((i) => i.id))
  }

  const handleDone = () => {
    ref.current?.hideOverlay?.()
    onClose()
  }

  return (
    <s-modal ref={ref} id="alt-text-images-picker" heading={`选择图片 — ${product.title}`}>
      <s-stack direction="block" gap="small-200">
        <s-checkbox checked={allSelected || undefined} label={`${selectedCount} selected`} onChange={toggleAll} />
        <s-table>
          <s-table-header-row>
            <s-table-header />
            <s-table-header>图片</s-table-header>
            <s-table-header>图片名称</s-table-header>
            <s-table-header>ALT</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {product.images.map((img) => {
              const isSelected = selectedIds.has(img.id)
              return (
                <s-table-row key={img.id}>
                  <s-table-cell>
                    <s-checkbox
                      checked={isSelected || undefined}
                      onChange={() => (isSelected ? onUnselect([img.id]) : onSelect([img.id]))}
                    />
                  </s-table-cell>
                  <s-table-cell>
                    <s-thumbnail src={img.url} alt={img.alt ?? ''} size="base" />
                  </s-table-cell>
                  <s-table-cell>
                    <s-text>{getImageFilename(img.url)}</s-text>
                  </s-table-cell>
                  <s-table-cell>
                    <s-text tone="neutral">{img.alt ? img.alt : '无'}</s-text>
                  </s-table-cell>
                </s-table-row>
              )
            })}
          </s-table-body>
        </s-table>
      </s-stack>

      <s-button slot="primary-action" variant="primary" onClick={handleDone}>
        完成
      </s-button>
    </s-modal>
  )
}

// ── Files 视图（表格 + 分页） ───────────────────────

function FilesTable({
  files,
  totalCount,
  page,
  pageCount,
  pageSize,
  onPageChange,
  selectedIds,
  onToggle
}: {
  files: CandidateImage[]
  totalCount: number
  page: number
  pageCount: number
  pageSize: number
  onPageChange: (page: number) => void
  selectedIds: Set<string>
  onToggle: (id: string) => void
}) {
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, totalCount)

  return (
    <s-section heading={`Files 候选（共 ${totalCount} 张图）`}>
      <s-table>
        <s-table-header-row>
          <s-table-header />
          <s-table-header>图片</s-table-header>
          <s-table-header>图片名称</s-table-header>
          <s-table-header>ALT</s-table-header>
        </s-table-header-row>
        <s-table-body>
          {files.map((img) => {
            const selected = selectedIds.has(img.id)
            return (
              <s-table-row key={img.id}>
                <s-table-cell>
                  <s-checkbox checked={selected || undefined} onChange={() => onToggle(img.id)} />
                </s-table-cell>
                <s-table-cell>
                  <s-thumbnail src={img.url} alt={img.alt ?? ''} size="base" />
                </s-table-cell>
                <s-table-cell>
                  <s-text>{getImageFilename(img.url)}</s-text>
                </s-table-cell>
                <s-table-cell>
                  <s-text tone="neutral">{img.alt ? img.alt : '无'}</s-text>
                </s-table-cell>
              </s-table-row>
            )
          })}
        </s-table-body>
      </s-table>

      {totalCount > pageSize && (
        <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
          <s-text tone="neutral">
            第 {start}–{end} 张 / 共 {totalCount} 张
          </s-text>
          <s-stack direction="inline" gap="small-200" alignItems="center">
            <s-button
              variant="tertiary"
              disabled={page <= 1 || undefined}
              onClick={() => onPageChange(Math.max(1, page - 1))}
            >
              上一页
            </s-button>
            <s-text tone="neutral">
              {page} / {pageCount}
            </s-text>
            <s-button
              variant="tertiary"
              disabled={page >= pageCount || undefined}
              onClick={() => onPageChange(Math.min(pageCount, page + 1))}
            >
              下一页
            </s-button>
          </s-stack>
        </s-stack>
      )}
    </s-section>
  )
}
