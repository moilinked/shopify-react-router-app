import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { competitorApi } from '~/services/competitor'
import { useLoading } from '~/hooks/useLoading'
import type { CompetitorPageConfig } from '~/types/competitor'
import { PAGE_TYPE_MAP, PAGE_TYPES, PLATFORMS, PLATFORM_MAP, detectPlatform } from '~/types/competitor'

const LIMIT = 20

export default function BrandDetailPage() {
  const { brandId } = useParams()
  const navigate = useNavigate()
  const { loading, run } = useLoading()
  const [pages, setPages] = useState<CompetitorPageConfig[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [brandName, setBrandName] = useState('')

  // 页面弹窗
  const modalRef = useRef<any>(null)
  const [editingPage, setEditingPage] = useState<CompetitorPageConfig | null>(null)
  const [formPlatform, setFormPlatform] = useState('GENERIC')
  const [platformManuallySet, setPlatformManuallySet] = useState(false)
  const [formPageType, setFormPageType] = useState('PDP')
  const [formPageName, setFormPageName] = useState('')
  const [formPageUrl, setFormPageUrl] = useState('')
  const [formPriority, setFormPriority] = useState('P1')
  const [formCompetitorModel, setFormCompetitorModel] = useState('')
  const [formCompetitorPrice, setFormCompetitorPrice] = useState('')
  const [formOurMatchModel, setFormOurMatchModel] = useState('')
  const [formOurMatchUrl, setFormOurMatchUrl] = useState('')
  const [formPopupSelectors, setFormPopupSelectors] = useState('')
  const { loading: saving, run: runSave } = useLoading()

  const loadPages = useCallback(() => {
    if (!brandId) return
    run(async () => {
      const res = await competitorApi.getPages({ page, limit: LIMIT, brandId })
      setPages(res.data)
      setTotal(res.total)
      if (res.data.length > 0 && res.data[0].brand) {
        setBrandName(res.data[0].brand.name)
      }
    })
  }, [run, page, brandId])

  useEffect(() => {
    loadPages()
  }, [loadPages])

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  const openCreateModal = () => {
    setEditingPage(null)
    setFormPlatform('GENERIC')
    setPlatformManuallySet(false)
    setFormPageType('PDP')
    setFormPageName('')
    setFormPageUrl('')
    setFormPriority('P1')
    setFormCompetitorModel('')
    setFormCompetitorPrice('')
    setFormOurMatchModel('')
    setFormOurMatchUrl('')
    setFormPopupSelectors('')
    modalRef.current?.showOverlay?.()
  }

  const openEditModal = (p: CompetitorPageConfig) => {
    setEditingPage(p)
    setFormPlatform(p.platform ?? 'GENERIC')
    setPlatformManuallySet(true)
    setFormPageType(p.pageType)
    setFormPageName(p.pageName)
    setFormPageUrl(p.pageUrl)
    setFormPriority(p.priority)
    setFormCompetitorModel(p.competitorModel ?? '')
    setFormCompetitorPrice(p.competitorPrice ?? '')
    setFormOurMatchModel(p.ourMatchModel ?? '')
    setFormOurMatchUrl(p.ourMatchProductUrl ?? '')
    setFormPopupSelectors((p.popupDismissSelectors ?? []).join('\n'))
    modalRef.current?.showOverlay?.()
  }

  const closeModal = () => modalRef.current?.hideOverlay?.()

  useEffect(() => {
    const el = modalRef.current
    if (!el) return
    const handler = () => setEditingPage(null)
    el.addEventListener('close', handler)
    el.addEventListener('hide', handler)
    return () => {
      el.removeEventListener('close', handler)
      el.removeEventListener('hide', handler)
    }
  }, [])

  const handleSave = () => {
    runSave(async () => {
      const data: Record<string, unknown> = {
        platform: formPlatform,
        pageType: formPageType,
        pageName: formPageName,
        pageUrl: formPageUrl,
        priority: formPriority,
        competitorModel: formCompetitorModel || null,
        competitorPrice: formCompetitorPrice || null,
        ourMatchModel: formOurMatchModel || null,
        ourMatchProductUrl: formOurMatchUrl || null,
        popupDismissSelectors: formPopupSelectors
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
      }
      if (editingPage) {
        await competitorApi.updatePage(editingPage.id, data)
        shopify.toast.show('页面已更新')
      } else {
        await competitorApi.createPage({ ...data, brandId })
        shopify.toast.show('页面已创建')
      }
      closeModal()
      loadPages()
    })
  }

  const handleToggleActive = async (p: CompetitorPageConfig) => {
    await run(async () => {
      await competitorApi.updatePage(p.id, { isActive: !p.isActive })
      shopify.toast.show(p.isActive ? '已停用' : '已启用')
      loadPages()
    })
  }

  const handleDeletePage = async (p: CompetitorPageConfig) => {
    const confirmed = window.confirm(`删除页面「${p.pageName}」？相关快照、字段结果和变化日志会一并删除。`)
    if (!confirmed) return

    await run(async () => {
      await competitorApi.deletePage(p.id)
      shopify.toast.show('页面已删除')
      loadPages()
    })
  }

  return (
    <s-page heading={brandName ? `品牌详情 — ${brandName}` : '品牌详情'}>
      <s-button slot="primary-action" variant="primary" onClick={openCreateModal}>
        新增页面
      </s-button>
      <s-button slot="secondary-actions" variant="secondary" onClick={() => navigate('/app/competitor/brands')}>
        返回竞品列表
      </s-button>

      <s-box padding="large">
        <s-stack direction="block" gap="large-100">
          <s-table
            paginate={totalPages > 1 || undefined}
            hasPreviousPage={page > 1 || undefined}
            hasNextPage={page < totalPages || undefined}
            loading={loading || undefined}
            onPreviousPage={() => setPage((p) => Math.max(1, p - 1))}
            onNextPage={() => setPage((p) => p + 1)}
          >
            <s-table-header-row>
              <s-table-header>页面名</s-table-header>
              <s-table-header>平台</s-table-header>
              <s-table-header>类型</s-table-header>
              <s-table-header>URL</s-table-header>
              <s-table-header>优先级</s-table-header>
              <s-table-header>竞品型号</s-table-header>
              <s-table-header>状态</s-table-header>
              <s-table-header>操作</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {pages.map((p) => (
                <s-table-row key={p.id}>
                  <s-table-cell>{p.pageName}</s-table-cell>
                  <s-table-cell>
                    <s-badge tone={p.platform === 'GENERIC' || !p.platform ? 'neutral' : 'info'}>
                      {PLATFORM_MAP[p.platform] ?? p.platform ?? '通用/其它'}
                    </s-badge>
                  </s-table-cell>
                  <s-table-cell>{PAGE_TYPE_MAP[p.pageType] ?? p.pageType}</s-table-cell>
                  <s-table-cell>
                    <s-text>{p.pageUrl}</s-text>
                  </s-table-cell>
                  <s-table-cell>{p.priority}</s-table-cell>
                  <s-table-cell>{p.competitorModel ?? '-'}</s-table-cell>
                  <s-table-cell>
                    <s-badge tone={p.isActive ? 'success' : 'critical'}>{p.isActive ? '活跃' : '停用'}</s-badge>
                  </s-table-cell>
                  <s-table-cell>
                    <s-stack direction="inline" gap="small-200">
                      <s-button variant="tertiary" onClick={() => navigate(`/app/competitor/pages/${p.id}`)}>
                        历史
                      </s-button>
                      <s-button variant="tertiary" onClick={() => openEditModal(p)}>
                        编辑
                      </s-button>
                      <s-button variant="tertiary" onClick={() => handleToggleActive(p)}>
                        {p.isActive ? '停用' : '启用'}
                      </s-button>
                      <s-button variant="tertiary" tone="critical" onClick={() => handleDeletePage(p)}>
                        删除
                      </s-button>
                    </s-stack>
                  </s-table-cell>
                </s-table-row>
              ))}
              {pages.length === 0 && !loading && (
                <s-table-row>
                  <s-table-cell>
                    <s-text tone="neutral">暂无页面配置</s-text>
                  </s-table-cell>
                </s-table-row>
              )}
            </s-table-body>
          </s-table>
        </s-stack>
      </s-box>

      {/* 创建/编辑页面弹窗 */}
      <s-modal ref={modalRef} id="page-modal" heading={editingPage ? '编辑页面' : '新增页面'}>
        <s-stack direction="block" gap="base">
          <s-text-field
            label="页面名称"
            value={formPageName}
            required
            onInput={(e: Event) => setFormPageName((e.target as HTMLInputElement).value)}
          />
          <s-select
            label="页面类型"
            value={formPageType}
            onChange={(e: Event) => setFormPageType((e.target as HTMLSelectElement).value)}
          >
            {PAGE_TYPES.map((t) => (
              <s-option key={t} value={t}>
                {PAGE_TYPE_MAP[t] ?? t}
              </s-option>
            ))}
          </s-select>
          <s-text-field
            label="页面 URL"
            value={formPageUrl}
            required
            onInput={(e: Event) => {
              const url = (e.target as HTMLInputElement).value
              setFormPageUrl(url)
              if (!platformManuallySet) setFormPlatform(detectPlatform(url))
            }}
          />
          <s-select
            label="平台"
            details={platformManuallySet ? undefined : '根据 URL 自动识别,可手动调整'}
            value={formPlatform}
            onChange={(e: Event) => {
              setFormPlatform((e.target as HTMLSelectElement).value)
              setPlatformManuallySet(true)
            }}
          >
            {PLATFORMS.map((p) => (
              <s-option key={p} value={p}>
                {PLATFORM_MAP[p] ?? p}
              </s-option>
            ))}
          </s-select>
          <s-select
            label="优先级"
            value={formPriority}
            onChange={(e: Event) => setFormPriority((e.target as HTMLSelectElement).value)}
          >
            <s-option value="P0">P0（最高）</s-option>
            <s-option value="P1">P1</s-option>
            <s-option value="P2">P2</s-option>
            <s-option value="P3">P3（最低）</s-option>
          </s-select>
          <s-text-field
            label="竞品型号"
            value={formCompetitorModel}
            onInput={(e: Event) => setFormCompetitorModel((e.target as HTMLInputElement).value)}
          />
          <s-text-field
            label="竞品价格"
            value={formCompetitorPrice}
            onInput={(e: Event) => setFormCompetitorPrice((e.target as HTMLInputElement).value)}
          />
          <s-text-field
            label="我方对标型号"
            value={formOurMatchModel}
            onInput={(e: Event) => setFormOurMatchModel((e.target as HTMLInputElement).value)}
          />
          <s-text-field
            label="我方产品链接"
            value={formOurMatchUrl}
            onInput={(e: Event) => setFormOurMatchUrl((e.target as HTMLInputElement).value)}
          />
          <s-text-area
            label="弹窗关闭/遮挡选择器"
            value={formPopupSelectors}
            details="每行一个 CSS 选择器;截图前会点击并直接移除命中的整个节点。用于排查到具体遮挡元素后手动清除(如 #cookie-banner、.newsletter-modal)。"
            onInput={(e: Event) => setFormPopupSelectors((e.target as HTMLTextAreaElement).value)}
          />
        </s-stack>
        <s-button
          slot="primary-action"
          variant="primary"
          onClick={handleSave}
          disabled={saving || !formPageName.trim() || !formPageUrl.trim() || undefined}
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
