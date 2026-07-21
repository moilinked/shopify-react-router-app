import type { ProductRow } from '~/types/machineSubscribe'

const STATUS_TONE: Record<string, 'success' | 'info' | 'warning'> = {
  ACTIVE: 'success',
  DRAFT: 'info',
  ARCHIVED: 'warning'
}

interface ProductTableProps {
  products: ProductRow[]
  /** 开启后在首列显示勾选框（表头为全选） */
  selectable?: boolean
  /** 已选中的产品 id 集合 */
  selectedIds?: Set<string>
  /** 切换单行选中 */
  onToggle?: (id: string) => void
  /** 切换全选 */
  onToggleAll?: () => void
  /** 是否已全选（用于表头勾选态） */
  allSelected?: boolean
  /** 标题是否可跳转到 Admin 产品详情，默认 true */
  linkable?: boolean
  /** 是否显示分页控件 */
  paginate?: boolean
  hasPreviousPage?: boolean
  hasNextPage?: boolean
  loading?: boolean
  onPreviousPage?: () => void
  onNextPage?: () => void
}

/** 产品数据表格（图片 / ID / 标题 / 状态 / 变体数量 / 价格），可选勾选列 */
export function ProductTable(props: ProductTableProps) {
  const {
    products,
    selectable = false,
    selectedIds,
    onToggle,
    onToggleAll,
    allSelected = false,
    linkable = true,
    paginate,
    hasPreviousPage,
    hasNextPage,
    loading,
    onPreviousPage,
    onNextPage
  } = props

  return (
    <s-table
      paginate={paginate || undefined}
      hasPreviousPage={hasPreviousPage || undefined}
      hasNextPage={hasNextPage || undefined}
      loading={loading || undefined}
      onPreviousPage={onPreviousPage}
      onNextPage={onNextPage}
    >
      <s-table-header-row>
        {selectable && (
          <s-table-header>
            <s-checkbox accessibilityLabel="全选" checked={allSelected || undefined} onChange={onToggleAll} />
          </s-table-header>
        )}
        <s-table-header>图片</s-table-header>
        <s-table-header>ID</s-table-header>
        <s-table-header listSlot="primary">标题</s-table-header>
        <s-table-header>状态</s-table-header>
        <s-table-header>变体数量</s-table-header>
        <s-table-header>价格</s-table-header>
      </s-table-header-row>
      <s-table-body>
        {products.map((product) => (
          <s-table-row key={product.id}>
            {selectable && (
              <s-table-cell>
                <s-checkbox
                  accessibilityLabel={`选择 ${product.title}`}
                  checked={selectedIds?.has(product.id) || undefined}
                  onChange={() => onToggle?.(product.id)}
                />
              </s-table-cell>
            )}
            <s-table-cell>
              {product.imageUrl ? (
                <s-thumbnail src={product.imageUrl} alt={product.imageAlt ?? product.title} size="small" />
              ) : (
                <s-box inlineSize="40px" blockSize="40px" background="subdued" borderRadius="small" />
              )}
            </s-table-cell>
            <s-table-cell>
              {linkable ? (
                <s-link href={`shopify://admin/products/${product.numericId}`} target="_blank">
                  {product.numericId}
                </s-link>
              ) : (
                <s-text type="strong">{product.numericId}</s-text>
              )}
            </s-table-cell>
            <s-table-cell>
              <s-text type="strong">{product.title}</s-text>
            </s-table-cell>
            <s-table-cell>
              <s-badge tone={STATUS_TONE[product.status]}>{product.status}</s-badge>
            </s-table-cell>
            <s-table-cell>{product.variantCount ?? '—'}</s-table-cell>
            <s-table-cell>
              {product.price ? `${product.price}${product.currencyCode ? ` ${product.currencyCode}` : ''}` : '—'}
            </s-table-cell>
          </s-table-row>
        ))}
      </s-table-body>
    </s-table>
  )
}
