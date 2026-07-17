import { useEffect, useMemo, useRef, useState } from 'react'
import { analyticsApi } from '~/services/analytics'
import { Tabs } from '~/components/analytics/widgets'
import type { ChannelGroupDef, ChannelMapRow, CollectionOrderRow, MapKind, ProductDictRow } from '~/types/analytics'

type ProductFilter = 'all' | 'missing-model'
type ChannelFilter = 'all' | 'unmatched' | 'inactive'

const PAGE_SIZE = 20

const KIND_TABS: Array<{ key: MapKind; label: string }> = [
  { key: 'product', label: '商品口径' },
  { key: 'channel', label: '渠道分组' },
  { key: 'collection', label: 'Collection 管理' }
]

const KIND_HINT: Record<MapKind, string> = {
  collection:
    '手动添加要纳入分析的 Collection 并排序;商品命中多个 Collection 时,取此处排序最靠前的作为展示 Collection。',
  product:
    '手动添加要分析的商品;业务SKU 取自 Shopify 商品的 metafield「Model」(只读),缺 Model 项可临时覆盖,建议优先到 Shopify 补 metafield。',
  channel: '原始 source / medium → 渠道分组(可选,用于报表辅助列与 AI 分组分析;未分组不阻塞报表)。'
}

/** 打开 Shopify 资源选择器,返回选中项的 GID 列表(product/collection) */
async function pickResourceIds(type: 'product' | 'collection'): Promise<string[]> {
  const picker = (
    shopify as unknown as {
      resourcePicker?: (opts: Record<string, unknown>) => Promise<Array<{ id: string }> | undefined>
    }
  ).resourcePicker
  if (!picker) {
    shopify.toast.show('当前环境不支持资源选择器', { isError: true })
    return []
  }
  const results = await picker({ type, action: 'select', multiple: true })
  return results?.map((r) => r.id) ?? []
}

export default function CaliberManage() {
  const [tab, setTab] = useState<MapKind>('product')
  const [syncing, setSyncing] = useState(false)
  const [summary, setSummary] = useState({ missingModel: 0, ga4Unaligned: 0, sourceMediums: 0 })

  // 切 tab 时刷新计数,使各 tab 角标反映最新待处理项
  useEffect(() => {
    analyticsApi
      .getCaliberSummary()
      .then(setSummary)
      .catch(() => {
        /* toasted */
      })
  }, [tab])

  const onSync = async () => {
    if (syncing) return
    setSyncing(true)
    try {
      await analyticsApi.syncCatalog()
      shopify.toast.show('已提交目录同步,稍后刷新查看')
    } catch {
      /* toasted */
    } finally {
      setSyncing(false)
    }
  }

  const badgeByKind: Record<MapKind, number> = {
    product: summary.missingModel + summary.ga4Unaligned, // 缺 Model + GA4 未对齐(都属商品口径)
    channel: summary.sourceMediums, // 未分组渠道
    collection: 0
  }
  const tabs = KIND_TABS.map((t) => ({ ...t, badge: badgeByKind[t.key] || undefined }))

  return (
    <s-page heading="口径管理">
      {/* 手动添加为主(各 tab 内「添加」按钮);同步全部为可选兜底 */}
      <s-button slot="secondary-actions" variant="secondary" onClick={onSync} disabled={syncing || undefined}>
        {syncing ? '同步中…' : '同步全部(可选)'}
      </s-button>

      <s-box padding="large">
        <s-stack direction="block" gap="large-100">
          <s-text tone="neutral">{KIND_HINT[tab]}</s-text>
          <Tabs tabs={tabs} active={tab} onChange={(k) => setTab(k as MapKind)} />

          {tab === 'collection' && <CollectionTab />}
          {tab === 'product' && <ProductTab />}
          {tab === 'channel' && <ChannelTab />}
        </s-stack>
      </s-box>
    </s-page>
  )
}

function CollectionTab() {
  const [rows, setRows] = useState<CollectionOrderRow[]>([])
  const [saving, setSaving] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())

  const load = () => {
    analyticsApi
      .getCollections()
      .then(setRows)
      .catch(() => {
        /* toasted */
      })
  }
  useEffect(load, [])

  const reorder = (from: number, to: number) =>
    setRows((list) => {
      if (from === to || to < 0 || to >= list.length) return list
      const next = [...list]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next.map((r, i) => ({ ...r, sortOrder: i }))
    })

  const pinTop = (index: number) => {
    if (index === 0) return
    reorder(index, 0)
  }

  const handleDrop = (i: number) => {
    if (dragIndex !== null) reorder(dragIndex, i)
    setDragIndex(null)
    setOverIndex(null)
  }

  const saveOrder = async () => {
    if (saving) return
    setSaving(true)
    try {
      await analyticsApi.reorderCollections(rows.map((r) => ({ collectionId: r.collectionId, sortOrder: r.sortOrder })))
      shopify.toast.show('排序已保存')
    } catch {
      /* toasted */
    } finally {
      setSaving(false)
    }
  }

  const onAddCollections = async () => {
    try {
      const ids = await pickResourceIds('collection')
      if (!ids.length) return
      const res = await analyticsApi.addCollections(ids)
      shopify.toast.show(`已添加 ${res.added} 个 Collection`)
      load()
    } catch {
      /* toasted */
    }
  }

  const onRemoveCollection = async (row: CollectionOrderRow) => {
    try {
      await analyticsApi.removeCollection(row.collectionId)
      setRows((list) => list.filter((x) => x.id !== row.id))
      setSelected((s) => {
        const n = new Set(s)
        n.delete(row.collectionId)
        return n
      })
    } catch {
      /* toasted */
    }
  }

  const toggleOne = (collectionId: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(collectionId)) n.delete(collectionId)
      else n.add(collectionId)
      return n
    })

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.collectionId))
  const toggleAll = () =>
    setSelected((s) => {
      const n = new Set(s)
      if (allSelected) rows.forEach((r) => n.delete(r.collectionId))
      else rows.forEach((r) => n.add(r.collectionId))
      return n
    })

  const onRemoveSelected = async () => {
    const ids = [...selected]
    if (!ids.length) return
    try {
      await analyticsApi.removeCollections(ids)
      setRows((list) => list.filter((x) => !selected.has(x.collectionId)))
      setSelected(new Set())
      shopify.toast.show(`已移除 ${ids.length} 个 Collection`)
    } catch {
      /* toasted */
    }
  }

  return (
    <s-stack direction="block" gap="base">
      <s-stack direction="inline" gap="base" alignItems="center">
        <s-button variant="primary" onClick={onAddCollections}>
          添加 Collection
        </s-button>
        <s-button variant="secondary" onClick={saveOrder} disabled={saving || rows.length === 0 || undefined}>
          {saving ? '保存中…' : '保存排序'}
        </s-button>
        <s-checkbox label="全选" checked={allSelected || undefined} onChange={toggleAll} />
        <s-button
          variant="secondary"
          tone="critical"
          onClick={onRemoveSelected}
          disabled={selected.size === 0 || undefined}
        >
          {selected.size ? `移除所选 (${selected.size})` : '移除所选'}
        </s-button>
        <s-text tone="neutral">拖动整行排序,序号越小优先级越高(↑↓ 移动)</s-text>
      </s-stack>

      {/* Polaris 无拖拽排序组件,此处自绘可拖拽列表(同 tabs 例外);行内容仍用 s-text/s-badge/s-button */}
      <div className="space-y-1">
        {rows.map((r, i) => (
          <div
            key={r.id}
            draggable
            role="button"
            tabIndex={0}
            aria-label={`排序:${r.title},当前第 ${i + 1} 位`}
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => {
              e.preventDefault()
              setOverIndex(i)
            }}
            onDrop={() => handleDrop(i)}
            onDragEnd={() => {
              setDragIndex(null)
              setOverIndex(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                reorder(i, i - 1)
              } else if (e.key === 'ArrowDown') {
                e.preventDefault()
                reorder(i, i + 1)
              }
            }}
            className={[
              'flex cursor-grab items-center gap-3 rounded-md border bg-white px-3 py-2 active:cursor-grabbing',
              overIndex === i && dragIndex !== null && dragIndex !== i ? 'border-[#2c6ecb]' : 'border-[#e3e3e3]',
              dragIndex === i ? 'opacity-50' : ''
            ].join(' ')}
          >
            <s-checkbox
              accessibilityLabel="选择"
              checked={selected.has(r.collectionId) || undefined}
              onChange={() => toggleOne(r.collectionId)}
            />
            <span className="select-none text-[#9aa0a6]" aria-hidden="true">
              ⠿
            </span>
            <span className="w-6 text-sm text-[#6d7175]">{i + 1}</span>
            <s-text>{r.title}</s-text>
            <s-badge tone="neutral">{r.productCount} 商品</s-badge>
            <span className="ml-auto flex gap-1">
              <s-button variant="tertiary" disabled={i === 0 || undefined} onClick={() => pinTop(i)}>
                置顶
              </s-button>
              <s-button variant="tertiary" tone="critical" onClick={() => onRemoveCollection(r)}>
                移除
              </s-button>
            </span>
          </div>
        ))}
        {rows.length === 0 && <s-text tone="neutral">暂无 Collection,点「添加 Collection」从 Shopify 选择。</s-text>}
      </div>
    </s-stack>
  )
}

function ProductTab() {
  const [rows, setRows] = useState<ProductDictRow[]>([])
  const [filter, setFilter] = useState<ProductFilter>('all')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)

  const modalRef = useRef<any>(null)
  const [editing, setEditing] = useState<ProductDictRow | null>(null)
  const [formOverride, setFormOverride] = useState('')
  const [selected, setSelected] = useState<Set<string>>(() => new Set())

  const load = () => {
    analyticsApi
      .getProducts()
      .then(setRows)
      .catch(() => {
        /* toasted */
      })
  }
  useEffect(load, [])

  const onAddProducts = async () => {
    try {
      const ids = await pickResourceIds('product')
      if (!ids.length) return
      const res = await analyticsApi.addProducts(ids)
      shopify.toast.show(`已添加 ${res.added} 个商品${res.missingModel ? `,其中 ${res.missingModel} 个缺 Model` : ''}`)
      load()
    } catch {
      /* toasted */
    }
  }

  const onRemoveProduct = async (row: ProductDictRow) => {
    try {
      await analyticsApi.removeProduct(row.productId)
      setRows((list) => list.filter((x) => x.id !== row.id))
      setSelected((s) => {
        const n = new Set(s)
        n.delete(row.productId)
        return n
      })
    } catch {
      /* toasted */
    }
  }

  const toggleOne = (productId: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(productId)) n.delete(productId)
      else n.add(productId)
      return n
    })

  const onRemoveSelected = async () => {
    const ids = [...selected]
    if (!ids.length) return
    try {
      await analyticsApi.removeProducts(ids)
      setRows((list) => list.filter((x) => !selected.has(x.productId)))
      setSelected(new Set())
      shopify.toast.show(`已移除 ${ids.length} 个商品`)
    } catch {
      /* toasted */
    }
  }

  const counts = useMemo(() => {
    const missing = rows.filter((r) => r.status === 'MISSING_MODEL' && !r.modelOverride).length
    return { missing }
  }, [rows])

  const visible = rows.filter((r) => {
    if (filter === 'missing-model' && !(r.status === 'MISSING_MODEL' && !r.modelOverride)) return false
    return (r.title + r.productId + (r.bizSku ?? '')).toLowerCase().includes(keyword.toLowerCase())
  })

  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r.productId))
  const toggleAllVisible = () =>
    setSelected((s) => {
      const n = new Set(s)
      if (allVisibleSelected) visible.forEach((r) => n.delete(r.productId))
      else visible.forEach((r) => n.add(r.productId))
      return n
    })

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const curPage = Math.min(page, totalPages)
  const pageRows = visible.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE)

  const openOverride = (row: ProductDictRow) => {
    setEditing(row)
    setFormOverride(row.modelOverride ?? row.bizSku ?? '')
    modalRef.current?.showOverlay?.()
  }

  const saveOverride = async () => {
    if (!editing) return
    const value = formOverride.trim()
    try {
      await analyticsApi.overrideProduct(editing.productId, value)
      setRows((list) =>
        list.map((x) =>
          x.id === editing.id
            ? { ...x, modelOverride: value || null, status: value || x.bizSku ? 'OK' : 'MISSING_MODEL' }
            : x
        )
      )
      shopify.toast.show('已保存覆盖')
      modalRef.current?.hideOverlay?.()
    } catch {
      /* toasted */
    }
  }

  return (
    <s-stack direction="block" gap="base">
      <s-stack direction="inline" gap="base" alignItems="end">
        <s-button variant="primary" onClick={onAddProducts}>
          添加商品
        </s-button>
        <s-button
          variant="secondary"
          tone="critical"
          onClick={onRemoveSelected}
          disabled={selected.size === 0 || undefined}
        >
          {selected.size ? `移除所选 (${selected.size})` : '移除所选'}
        </s-button>
        <s-text-field
          label="搜索"
          placeholder="商品标题 / productId / 业务SKU"
          value={keyword}
          onInput={(e: Event) => {
            setKeyword((e.target as HTMLInputElement).value)
            setPage(1)
          }}
        />
        <s-select
          label="筛选"
          value={filter}
          onChange={(e: Event) => {
            setFilter((e.target as HTMLSelectElement).value as ProductFilter)
            setPage(1)
          }}
        >
          <s-option value="all">全部</s-option>
          <s-option value="missing-model">仅缺 Model</s-option>
        </s-select>
        <s-stack direction="inline" gap="small-200" alignItems="center">
          {counts.missing > 0 ? (
            <s-badge tone="critical">缺 Model {counts.missing}</s-badge>
          ) : (
            <s-badge tone="success">口径完整</s-badge>
          )}
        </s-stack>
      </s-stack>

      <s-table
        paginate={totalPages > 1 || undefined}
        hasPreviousPage={curPage > 1 || undefined}
        hasNextPage={curPage < totalPages || undefined}
        onPreviousPage={() => setPage(Math.max(1, curPage - 1))}
        onNextPage={() => setPage(curPage + 1)}
      >
        <s-table-header-row>
          <s-table-header>
            <s-checkbox
              accessibilityLabel="全选"
              checked={allVisibleSelected || undefined}
              onChange={toggleAllVisible}
            />
          </s-table-header>
          <s-table-header>商品</s-table-header>
          <s-table-header>业务SKU(Model)</s-table-header>
          <s-table-header>命中 Collection</s-table-header>
          <s-table-header>操作</s-table-header>
        </s-table-header-row>
        <s-table-body>
          {pageRows.map((r) => (
            <s-table-row key={r.id}>
              <s-table-cell>
                <s-checkbox
                  accessibilityLabel="选择"
                  checked={selected.has(r.productId) || undefined}
                  onChange={() => toggleOne(r.productId)}
                />
              </s-table-cell>
              <s-table-cell>
                {r.title}
                <span className="block text-[11px] text-[#9aa0a6]">#{r.productId}</span>
              </s-table-cell>
              <s-table-cell>
                {r.modelOverride ? (
                  <s-stack direction="inline" gap="small-200" alignItems="center">
                    <s-text>{r.modelOverride}</s-text>
                    <s-badge tone="info">覆盖</s-badge>
                  </s-stack>
                ) : r.bizSku ? (
                  r.bizSku
                ) : (
                  <s-badge tone="critical">缺 Model</s-badge>
                )}
              </s-table-cell>
              <s-table-cell>{r.collectionTitle ?? '—'}</s-table-cell>
              <s-table-cell>
                <s-stack direction="inline" gap="small-200">
                  <s-button variant="tertiary" onClick={() => openOverride(r)}>
                    覆盖 Model
                  </s-button>
                  <s-button variant="tertiary" tone="critical" onClick={() => onRemoveProduct(r)}>
                    移除
                  </s-button>
                </s-stack>
              </s-table-cell>
            </s-table-row>
          ))}
          {visible.length === 0 && (
            <s-table-row>
              <s-table-cell>
                <s-text tone="neutral">无匹配商品,点「添加商品」从 Shopify 选择要分析的商品</s-text>
              </s-table-cell>
            </s-table-row>
          )}
        </s-table-body>
      </s-table>

      <s-text tone="neutral">
        业务SKU 来自 Shopify 商品的 metafield「Model」。缺 Model 请优先到 Shopify 给该商品补
        metafield(数据源头修);确需临时适配再用「覆盖 Model」。
      </s-text>

      <s-modal ref={modalRef} id="product-override-modal" heading="覆盖业务SKU(Model)">
        <s-stack direction="block" gap="base">
          {editing && (
            <s-text tone="neutral">
              商品:{editing.title}(#{editing.productId})
            </s-text>
          )}
          <s-text-field
            label="业务SKU"
            placeholder="如 K19"
            value={formOverride}
            onInput={(e: Event) => setFormOverride((e.target as HTMLInputElement).value)}
          />
          <s-text tone="neutral">覆盖值优先于 metafield;留空则清除覆盖、回退用 metafield Model。</s-text>
        </s-stack>
        <s-button slot="primary-action" variant="primary" onClick={saveOverride}>
          保存
        </s-button>
        <s-button slot="secondary-actions" variant="secondary" onClick={() => modalRef.current?.hideOverlay?.()}>
          取消
        </s-button>
      </s-modal>
    </s-stack>
  )
}

function ChannelTab() {
  const [rows, setRows] = useState<ChannelMapRow[]>([])
  const [groups, setGroups] = useState<ChannelGroupDef[]>([])
  const [filter, setFilter] = useState<ChannelFilter>('all')
  const [keyword, setKeyword] = useState('')
  const [newName, setNewName] = useState('')
  const [page, setPage] = useState(1)

  const groupModalRef = useRef<any>(null)

  const loadGroups = () =>
    analyticsApi
      .getChannelGroups()
      .then(setGroups)
      .catch(() => {
        /* toasted */
      })
  const loadMaps = () =>
    analyticsApi
      .getChannelMaps()
      .then(setRows)
      .catch(() => {
        /* toasted */
      })

  useEffect(() => {
    loadGroups()
    loadMaps()
  }, [])

  const groupName = (id: string | null) => (id ? (groups.find((g) => g.id === id)?.name ?? '已删除分组') : '')
  const activeGroups = groups.filter((g) => g.isActive)

  const counts = useMemo(() => {
    const unmatched = rows.filter((r) => !r.matched).length
    return { matched: rows.length - unmatched, unmatched }
  }, [rows])

  const visible = rows.filter(
    (r) =>
      (filter === 'all' ? true : filter === 'unmatched' ? !r.matched : !r.isActive) &&
      (r.sourceMedium + groupName(r.channelGroupId)).toLowerCase().includes(keyword.toLowerCase())
  )

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const curPage = Math.min(page, totalPages)
  const pageRows = visible.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE)

  const assignGroup = async (row: ChannelMapRow, channelGroupId: string | null) => {
    setRows((list) => list.map((x) => (x.id === row.id ? { ...x, channelGroupId, matched: !!channelGroupId } : x)))
    try {
      await analyticsApi.updateChannelMap(row.id, { channelGroupId })
    } catch {
      loadMaps()
    }
  }

  const toggleActive = async (row: ChannelMapRow) => {
    const next = !row.isActive
    setRows((list) => list.map((x) => (x.id === row.id ? { ...x, isActive: next } : x)))
    try {
      await analyticsApi.updateChannelMap(row.id, { isActive: next })
    } catch {
      loadMaps()
    }
  }

  const addGroup = async () => {
    const name = newName.trim()
    if (!name) return
    if (groups.some((g) => g.name === name)) {
      shopify.toast.show('分组已存在')
      return
    }
    try {
      await analyticsApi.createChannelGroup(name)
      setNewName('')
      await loadGroups()
    } catch {
      /* toasted */
    }
  }

  const renameGroup = (id: string, name: string) =>
    setGroups((list) => list.map((g) => (g.id === id ? { ...g, name } : g)))

  const persistRename = async (id: string, name: string) => {
    try {
      await analyticsApi.updateChannelGroup(id, { name })
    } catch {
      loadGroups()
    }
  }

  const removeGroup = async (id: string) => {
    try {
      await analyticsApi.deleteChannelGroup(id)
      shopify.toast.show('分组已删除,引用它的渠道已置为未分组')
      await Promise.all([loadGroups(), loadMaps()])
    } catch {
      /* toasted */
    }
  }

  return (
    <s-stack direction="block" gap="base">
      <s-stack direction="inline" gap="base" alignItems="end">
        <s-text-field
          label="搜索"
          placeholder="source / medium / 分组"
          value={keyword}
          onInput={(e: Event) => {
            setKeyword((e.target as HTMLInputElement).value)
            setPage(1)
          }}
        />
        <s-select
          label="筛选"
          value={filter}
          onChange={(e: Event) => {
            setFilter((e.target as HTMLSelectElement).value as ChannelFilter)
            setPage(1)
          }}
        >
          <s-option value="all">全部</s-option>
          <s-option value="unmatched">仅未分组</s-option>
          <s-option value="inactive">仅停用</s-option>
        </s-select>
        <s-button variant="secondary" onClick={() => groupModalRef.current?.showOverlay?.()}>
          管理分组
        </s-button>
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-badge tone="success">已分组 {counts.matched}</s-badge>
          {counts.unmatched > 0 ? (
            <s-badge tone="critical">未分组 {counts.unmatched}</s-badge>
          ) : (
            <s-badge tone="success">全部已分组</s-badge>
          )}
        </s-stack>
      </s-stack>

      <s-table
        paginate={totalPages > 1 || undefined}
        hasPreviousPage={curPage > 1 || undefined}
        hasNextPage={curPage < totalPages || undefined}
        onPreviousPage={() => setPage(Math.max(1, curPage - 1))}
        onNextPage={() => setPage(curPage + 1)}
      >
        <s-table-header-row>
          <s-table-header>source / medium</s-table-header>
          <s-table-header>渠道分组</s-table-header>
          <s-table-header>状态</s-table-header>
          <s-table-header>操作</s-table-header>
        </s-table-header-row>
        <s-table-body>
          {pageRows.map((r) => (
            <s-table-row key={r.id}>
              <s-table-cell>
                <span className="font-mono text-xs">{r.sourceMedium}</span>
              </s-table-cell>
              <s-table-cell>
                <s-select
                  label=""
                  labelAccessibilityVisibility="exclusive"
                  value={r.channelGroupId ?? 'NONE'}
                  onChange={(e: Event) => {
                    const raw = (e.target as HTMLSelectElement).value
                    assignGroup(r, raw === 'NONE' ? null : raw)
                  }}
                >
                  <s-option value="NONE">待分组</s-option>
                  {activeGroups.map((g) => (
                    <s-option key={g.id} value={g.id}>
                      {g.name}
                    </s-option>
                  ))}
                </s-select>
              </s-table-cell>
              <s-table-cell>
                <s-badge tone={!r.isActive ? 'neutral' : r.matched ? 'success' : 'critical'}>
                  {!r.isActive ? '已停用' : r.matched ? '已分组' : '未分组'}
                </s-badge>
              </s-table-cell>
              <s-table-cell>
                <s-button variant="tertiary" onClick={() => toggleActive(r)}>
                  {r.isActive ? '停用' : '启用'}
                </s-button>
              </s-table-cell>
            </s-table-row>
          ))}
          {visible.length === 0 && (
            <s-table-row>
              <s-table-cell>
                <s-text tone="neutral">无渠道数据(采集 GA4 后出现 source / medium)</s-text>
              </s-table-cell>
            </s-table-row>
          )}
        </s-table-body>
      </s-table>

      <s-modal ref={groupModalRef} id="channel-group-modal" heading="管理渠道分组">
        <s-stack direction="block" gap="base">
          <s-text tone="neutral">改名后引用它的渠道自动跟随;删除后相关渠道变为「未分组」。</s-text>
          <s-table>
            <s-table-header-row>
              <s-table-header>分组名</s-table-header>
              <s-table-header>使用数</s-table-header>
              <s-table-header>操作</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {groups.map((g) => {
                const usage = rows.filter((r) => r.channelGroupId === g.id).length
                return (
                  <s-table-row key={g.id}>
                    <s-table-cell>
                      <s-text-field
                        label="分组名"
                        labelAccessibilityVisibility="exclusive"
                        value={g.name}
                        onInput={(e: Event) => renameGroup(g.id, (e.target as HTMLInputElement).value)}
                        onChange={(e: Event) => persistRename(g.id, (e.target as HTMLInputElement).value)}
                      />
                    </s-table-cell>
                    <s-table-cell>
                      <s-badge tone={usage > 0 ? 'info' : 'neutral'}>{usage}</s-badge>
                    </s-table-cell>
                    <s-table-cell>
                      <s-button variant="tertiary" tone="critical" onClick={() => removeGroup(g.id)}>
                        删除
                      </s-button>
                    </s-table-cell>
                  </s-table-row>
                )
              })}
            </s-table-body>
          </s-table>
          <s-stack direction="inline" gap="base" alignItems="end">
            <s-text-field
              label="新增分组"
              placeholder="如 Affiliate"
              value={newName}
              onInput={(e: Event) => setNewName((e.target as HTMLInputElement).value)}
            />
            <s-button variant="secondary" onClick={addGroup}>
              新增
            </s-button>
          </s-stack>
        </s-stack>
        <s-button slot="primary-action" variant="primary" onClick={() => groupModalRef.current?.hideOverlay?.()}>
          完成
        </s-button>
      </s-modal>
    </s-stack>
  )
}
