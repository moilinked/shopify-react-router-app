import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { competitorApi } from '~/services/competitor'
import { useLoading } from '~/hooks/useLoading'
import type { CompetitorBrand } from '~/types/competitor'
import { MARKETS, MARKET_MAP } from '~/types/competitor'

const LIMIT = 20
const MARKET_OPTIONS = MARKETS

export default function BrandsPage() {
  const navigate = useNavigate()
  const { loading, run } = useLoading()
  const [brands, setBrands] = useState<CompetitorBrand[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)

  // 筛选
  const [filterMarket, setFilterMarket] = useState('')
  const [filterActive, setFilterActive] = useState<string>('')

  // 弹窗
  const modalRef = useRef<any>(null)
  const [editingBrand, setEditingBrand] = useState<CompetitorBrand | null>(null)
  const [formName, setFormName] = useState('')
  const [formMarket, setFormMarket] = useState('US')
  const [formNotes, setFormNotes] = useState('')
  const [formIsFocus, setFormIsFocus] = useState(false)
  const { loading: saving, run: runSave } = useLoading()

  const loadBrands = useCallback(() => {
    run(async () => {
      const params: Record<string, unknown> = { page, limit: LIMIT }
      if (filterMarket) params.market = filterMarket
      if (filterActive === 'true') params.isActive = true
      if (filterActive === 'false') params.isActive = false
      const res = await competitorApi.getBrands(params as any)
      setBrands(res.data)
      setTotal(res.total)
    })
  }, [run, page, filterMarket, filterActive])

  useEffect(() => {
    loadBrands()
  }, [loadBrands])

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  const openCreateModal = () => {
    setEditingBrand(null)
    setFormName('')
    setFormMarket('US')
    setFormNotes('')
    setFormIsFocus(false)
    modalRef.current?.showOverlay?.()
  }

  const openEditModal = (brand: CompetitorBrand) => {
    setEditingBrand(brand)
    setFormName(brand.name)
    setFormMarket(brand.market)
    setFormNotes(brand.notes ?? '')
    setFormIsFocus(brand.isFocus)
    modalRef.current?.showOverlay?.()
  }

  const closeModal = () => modalRef.current?.hideOverlay?.()

  useEffect(() => {
    const el = modalRef.current
    if (!el) return
    const handler = () => {
      setEditingBrand(null)
    }
    el.addEventListener('close', handler)
    el.addEventListener('hide', handler)
    return () => {
      el.removeEventListener('close', handler)
      el.removeEventListener('hide', handler)
    }
  }, [])

  const handleSave = () => {
    runSave(async () => {
      if (editingBrand) {
        await competitorApi.updateBrand(editingBrand.id, {
          name: formName,
          market: formMarket,
          isFocus: formIsFocus,
          notes: formNotes || undefined
        })
        shopify.toast.show('品牌已更新')
      } else {
        await competitorApi.createBrand({
          name: formName,
          market: formMarket,
          isFocus: formIsFocus,
          notes: formNotes || undefined
        })
        shopify.toast.show('品牌已创建')
      }
      closeModal()
      loadBrands()
    })
  }

  const handleToggleActive = async (brand: CompetitorBrand) => {
    await run(async () => {
      await competitorApi.updateBrand(brand.id, { isActive: !brand.isActive })
      shopify.toast.show(brand.isActive ? '已停用' : '已启用')
      loadBrands()
    })
  }

  const handleDeleteBrand = async (brand: CompetitorBrand) => {
    const confirmed = window.confirm(`删除品牌「${brand.name}」？相关页面、快照、字段结果和变化日志会一并删除。`)
    if (!confirmed) return

    await run(async () => {
      await competitorApi.deleteBrand(brand.id)
      shopify.toast.show('品牌已删除')
      loadBrands()
    })
  }

  return (
    <s-page heading="竞品管理">
      <s-button slot="primary-action" variant="primary" onClick={openCreateModal}>
        新增品牌
      </s-button>
      <s-button slot="secondary-actions" variant="secondary" onClick={() => navigate('/app/competitor')}>
        返回概览
      </s-button>

      <s-box padding="large">
        <s-stack direction="block" gap="large-100">
          {/* 筛选栏(s-option 空 value 会回退用文本当值,「全部」用显式哨兵 ALL) */}
          <s-stack direction="inline" gap="base" alignItems="end">
            <s-select
              label="市场"
              value={filterMarket || 'ALL'}
              onChange={(e: Event) => {
                const value = (e.target as HTMLSelectElement).value
                setFilterMarket(value === 'ALL' ? '' : value)
                setPage(1)
              }}
            >
              <s-option value="ALL">全部</s-option>
              {MARKET_OPTIONS.map((market) => (
                <s-option key={market} value={market}>
                  {MARKET_MAP[market] ?? market}
                </s-option>
              ))}
            </s-select>
            <s-select
              label="状态"
              value={filterActive || 'ALL'}
              onChange={(e: Event) => {
                const value = (e.target as HTMLSelectElement).value
                setFilterActive(value === 'ALL' ? '' : value)
                setPage(1)
              }}
            >
              <s-option value="ALL">全部</s-option>
              <s-option value="true">活跃</s-option>
              <s-option value="false">停用</s-option>
            </s-select>
          </s-stack>

          {/* 表格 */}
          <s-table
            paginate={totalPages > 1 || undefined}
            hasPreviousPage={page > 1 || undefined}
            hasNextPage={page < totalPages || undefined}
            loading={loading || undefined}
            onPreviousPage={() => setPage((p) => Math.max(1, p - 1))}
            onNextPage={() => setPage((p) => p + 1)}
          >
            <s-table-header-row>
              <s-table-header>品牌名</s-table-header>
              <s-table-header>市场</s-table-header>
              <s-table-header>状态</s-table-header>
              <s-table-header>重点</s-table-header>
              <s-table-header>页面数</s-table-header>
              <s-table-header>备注</s-table-header>
              <s-table-header>操作</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {brands.map((b) => (
                <s-table-row key={b.id}>
                  <s-table-cell>
                    <s-button variant="tertiary" onClick={() => navigate(`/app/competitor/brands/${b.id}`)}>
                      {b.name}
                    </s-button>
                  </s-table-cell>
                  <s-table-cell>{MARKET_MAP[b.market] ?? b.market}</s-table-cell>
                  <s-table-cell>
                    <s-badge tone={b.isActive ? 'success' : 'critical'}>{b.isActive ? '活跃' : '停用'}</s-badge>
                  </s-table-cell>
                  <s-table-cell>{b.isFocus ? '⭐' : '-'}</s-table-cell>
                  <s-table-cell>{b._count?.pages ?? '-'}</s-table-cell>
                  <s-table-cell>{b.notes ?? '-'}</s-table-cell>
                  <s-table-cell>
                    <s-stack direction="inline" gap="small-200">
                      <s-button variant="tertiary" onClick={() => openEditModal(b)}>
                        编辑
                      </s-button>
                      <s-button variant="tertiary" onClick={() => handleToggleActive(b)}>
                        {b.isActive ? '停用' : '启用'}
                      </s-button>
                      <s-button variant="tertiary" tone="critical" onClick={() => handleDeleteBrand(b)}>
                        删除
                      </s-button>
                    </s-stack>
                  </s-table-cell>
                </s-table-row>
              ))}
              {brands.length === 0 && !loading && (
                <s-table-row>
                  <s-table-cell>
                    <s-text tone="neutral">暂无品牌数据</s-text>
                  </s-table-cell>
                </s-table-row>
              )}
            </s-table-body>
          </s-table>
        </s-stack>
      </s-box>

      {/* 创建/编辑弹窗 */}
      <s-modal ref={modalRef} id="brand-modal" heading={editingBrand ? '编辑品牌' : '新增品牌'}>
        <s-stack direction="block" gap="base">
          <s-text-field
            label="品牌名称"
            value={formName}
            required
            onInput={(e: Event) => setFormName((e.target as HTMLInputElement).value)}
          />
          <s-select
            label="市场"
            value={formMarket}
            required
            onChange={(e: Event) => setFormMarket((e.target as HTMLSelectElement).value)}
          >
            {!(MARKET_OPTIONS as readonly string[]).includes(formMarket) && (
              <s-option value={formMarket}>{formMarket}</s-option>
            )}
            {MARKET_OPTIONS.map((market) => (
              <s-option key={market} value={market}>
                {MARKET_MAP[market] ?? market}
              </s-option>
            ))}
          </s-select>
          <s-checkbox
            label="标记为重点品牌"
            checked={formIsFocus || undefined}
            onChange={(e: Event) => setFormIsFocus((e.target as HTMLInputElement).checked)}
          />
          <s-text-area
            label="备注"
            rows={3}
            value={formNotes}
            onInput={(e: Event) => setFormNotes((e.target as HTMLInputElement).value)}
          />
        </s-stack>
        <s-button
          slot="primary-action"
          variant="primary"
          onClick={handleSave}
          disabled={saving || !formName.trim() || undefined}
        >
          {saving ? '保存中…' : '确认'}
        </s-button>
        <s-button slot="secondary-actions" variant="secondary" onClick={closeModal} disabled={saving || undefined}>
          取消
        </s-button>
      </s-modal>
    </s-page>
  )
}
