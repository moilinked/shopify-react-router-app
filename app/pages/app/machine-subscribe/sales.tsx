import { useEffect, useRef, useState } from 'react'
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import { useFetcher, useLoaderData } from 'react-router'
import { useAppBridge } from '@shopify/app-bridge-react'
import { authenticate } from '~/shopify.server'
import type { AdminApiContext } from '@shopify/shopify-app-react-router/server'
import { EmptyState } from '~/components/EmptyState'

/**
 * 实体滤芯查询：用虚拟滤芯 variant ID 拉取 variant.related_filter
 * （metafield 挂在变体上，type 为 variant_reference）
 */
const PhysicalFiltersQuery = `#graphql
query PhysicalFilters($ids: [ID!]!) {
  nodes(ids: $ids) {
    __typename
    ... on ProductVariant {
      id
      metafield(namespace: "custom", key: "related_filter") {
        value
      }
      product {
        id
        handle
      }
    }
  }
}
`

/** 整机 + 虚拟滤芯：metafield subscription_filters 存虚拟滤芯 variant GID */
const ProductsWithSkuQuery = `#graphql
query ProductsWithSku($first: Int!, $after: String) {
  products(first: $first, after: $after, query: "status:ACTIVE metafields.custom.subscription_filters:*") {
    nodes {
      id
      title
      variants(first: 10) {
        nodes {
          sku
        }
      }
      metafield(namespace: "custom", key: "subscription_filters") {
        id
        value
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
`

const ShopifyQLQuery = `#graphql
query MachineSubscribeShopifyQL($query: String!) {
  shopifyqlQuery(query: $query) {
    tableData {
      rows
    }
    parseErrors
  }
}
`

/** 默认近 7 天（ShopifyQL 相对时间） */
const DEFAULT_SHOPIFYQL_SINCE = '-7d'
const DEFAULT_SHOPIFYQL_UNTIL = 'today'

type MachineProductNode = {
  id: string
  title: string
  variants?: { nodes?: Array<{ sku?: string | null }> }
  metafield?: { id: string; value?: string | null } | null
}

type SalesMetrics = {
  orders: number
  quantityOrdered: number
  netItemsSold: number
}

type MetricKey = keyof SalesMetrics

const METRIC_OPTIONS: Array<{ value: MetricKey; label: string }> = [
  { value: 'orders', label: '订单数量' },
  { value: 'quantityOrdered', label: '下单数量' },
  { value: 'netItemsSold', label: '实际销量' }
]

type FilterViewMode = 'virtual' | 'physical' | 'total' | 'compare'

const FILTER_VIEW_OPTIONS: Array<{ value: FilterViewMode; label: string }> = [
  { value: 'virtual', label: '只展示虚拟滤芯' },
  { value: 'physical', label: '只展示实体滤芯' },
  { value: 'total', label: '展示总数' },
  { value: 'compare', label: '展示对比（实体数/虚拟滤芯数）' }
]

type SplitSalesMetrics = {
  /** 实体滤芯 + 虚拟滤芯合计（同 id 不重复累加） */
  total: SalesMetrics
  /** 仅虚拟滤芯 */
  virtual: SalesMetrics
  /** 仅实体滤芯 */
  physical: SalesMetrics
}

type SalesFilterRow = {
  /** 实体滤芯主 variant 数字 ID（无实体时回退虚拟 id / —） */
  name: string
  /** 本组内全部虚拟滤芯 variant 数字 ID（已去重） */
  virtualFilterVariantIds: string[]
  /** 本组内全部实体滤芯 variant 数字 ID（已去重） */
  physicalFilterVariantIds: string[]
  /** 是否存在实体滤芯；无实体时仅展示虚拟滤芯数据 */
  hasPhysicalFilter: boolean
  /** 展示 SKU：优先实体滤芯，无实体则回退虚拟滤芯 */
  sku: string
  filterSalesMetrics: SplitSalesMetrics
  totalNewSubsMetrics: SplitSalesMetrics
  machineSubsMetrics: SplitSalesMetrics
}

/** 虚拟滤芯 variant id → 实体滤芯 variant id 列表（已去重） */
type VirtualToPhysicalFilterMap = Map<string, string[]>

type SalesMachineGroup = {
  productId: string
  productNumericId: string
  machine: string
  /** 用于匹配 ShopifyQL product_variant_sku */
  machineSku: string
  machineSalesMetrics: SalesMetrics
  filters: SalesFilterRow[]
}

type ShopifyqlColumn = {
  name: string
  dataType: string
  displayName: string
}

type ShopifyqlRow = Record<string, string | number | null>

type ShopifyqlTableData = {
  columns?: ShopifyqlColumn[]
  rows?: ShopifyqlRow[]
}

type ShopifyqlQueryResult = {
  parseErrors?: string[]
  tableData?: ShopifyqlTableData | null
}

type ShopifyqlGraphqlResponse = {
  data?: {
    shopifyqlQuery?: ShopifyqlQueryResult
  }
  errors?: Array<{ message?: string }>
}

type ShopifyqlResult = {
  ok: boolean
  query: string
  since: string
  until: string
  skuList?: string[]
  parseErrors: string[]
  rows: ShopifyqlRow[]
  error?: string
}

type SalesQueryBundle = {
  machineSales: ShopifyqlResult
  filterSales: ShopifyqlResult
  totalNewSubs: ShopifyqlResult
  machineSubs: ShopifyqlResult
}

type SalesLoaderData = {
  groups: SalesMachineGroup[]
  queries: SalesQueryBundle | null
  error?: string
}

type ProductsWithSkuResponse = {
  data?: {
    products?: {
      nodes?: MachineProductNode[]
      pageInfo?: { hasNextPage?: boolean; endCursor?: string | null }
    }
  }
  errors?: Array<{ message?: string }>
}

type PhysicalFilterNode = {
  __typename?: string
  id?: string
  metafield?: { value?: string | null } | null
  product?: {
    id?: string
    handle?: string
  } | null
}

type PhysicalFiltersResponse = {
  data?: {
    nodes?: Array<PhysicalFilterNode | null>
  }
  errors?: Array<{ message?: string }>
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** 日期选择器默认展示：近 7 天（含今天） */
function getDefaultPickerDates(): { since: string; until: string } {
  const until = new Date()
  const since = new Date()
  since.setDate(until.getDate() - 7)
  return { since: formatDate(since), until: formatDate(until) }
}

function parseFilterVariantIds(value?: string | null): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value) as unknown
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string' && item.length > 0)
    }
    if (typeof parsed === 'string' && parsed.length > 0) return [parsed]
  } catch {
    const trimmed = value.trim()
    if (trimmed.startsWith('gid://')) return [trimmed]
  }
  return []
}

function toVariantNumericId(gidOrId: string): string {
  return toNumericId(gidOrId)
}

/** 归一化并去重：仅保留纯数字 ID（ShopifyQL product_variant_id 要求） */
function uniqueNumericIds(ids: Iterable<string>): string[] {
  const seen = new Set<string>()
  for (const raw of ids) {
    const id = toNumericId(String(raw).trim())
    if (/^\d+$/.test(id)) seen.add(id)
  }
  return [...seen]
}

function toNumericId(gidOrId: string): string {
  return gidOrId.replace(/^gid:\/\/shopify\/[^/]+\//, '').trim()
}

const EMPTY_METRICS: SalesMetrics = { orders: 0, quantityOrdered: 0, netItemsSold: 0 }

function emptyFilterRow(overrides?: Partial<SalesFilterRow>): SalesFilterRow {
  return {
    name: '—',
    virtualFilterVariantIds: [],
    physicalFilterVariantIds: [],
    hasPhysicalFilter: false,
    sku: '',
    filterSalesMetrics: {
      total: { ...EMPTY_METRICS },
      virtual: { ...EMPTY_METRICS },
      physical: { ...EMPTY_METRICS }
    },
    totalNewSubsMetrics: {
      total: { ...EMPTY_METRICS },
      virtual: { ...EMPTY_METRICS },
      physical: { ...EMPTY_METRICS }
    },
    machineSubsMetrics: {
      total: { ...EMPTY_METRICS },
      virtual: { ...EMPTY_METRICS },
      physical: { ...EMPTY_METRICS }
    },
    ...overrides
  }
}

function toSalesMetrics(row?: ShopifyqlRow): SalesMetrics {
  return {
    orders: Number(row?.orders ?? 0) || 0,
    quantityOrdered: Number(row?.quantity_ordered ?? 0) || 0,
    netItemsSold: Number(row?.net_items_sold ?? 0) || 0
  }
}

/**
 * 实体滤芯 + 虚拟滤芯合并为同一组：按实体滤芯 id 归组；
 * 无实体滤芯时按虚拟滤芯 id 单独成组。
 */
function toSalesGroup(
  product: MachineProductNode,
  virtualToPhysicalMap: VirtualToPhysicalFilterMap
): SalesMachineGroup {
  const sku = product.variants?.nodes?.[0]?.sku?.trim() || ''
  const title = product.title?.trim() || ''
  const machine = sku || title || '—'
  const virtualFilterGids = parseFilterVariantIds(product.metafield?.value)

  type GroupBucket = { virtualIds: string[]; physicalIds: string[] }
  const buckets = new Map<string, GroupBucket>()

  for (const gid of virtualFilterGids) {
    const virtualId = toVariantNumericId(gid)
    if (!virtualId) continue
    const physicalIds = virtualToPhysicalMap.get(virtualId) ?? []
    const groupKey = physicalIds[0] || virtualId
    const bucket = buckets.get(groupKey) ?? { virtualIds: [], physicalIds: [] }
    bucket.virtualIds.push(virtualId)
    bucket.physicalIds.push(...physicalIds)
    buckets.set(groupKey, bucket)
  }

  const filters =
    buckets.size > 0
      ? [...buckets.entries()].map(([groupKey, bucket]) => {
          const physicalFilterVariantIds = uniqueNumericIds(bucket.physicalIds)
          return emptyFilterRow({
            name: groupKey,
            virtualFilterVariantIds: uniqueNumericIds(bucket.virtualIds),
            physicalFilterVariantIds,
            hasPhysicalFilter: physicalFilterVariantIds.length > 0
          })
        })
      : [emptyFilterRow()]

  return {
    productId: product.id,
    productNumericId: product.id.split('/').pop() ?? '',
    machine,
    machineSku: sku,
    machineSalesMetrics: toSalesMetrics(),
    filters
  }
}

function toPercent(numerator: number, denominator: number): string {
  if (denominator <= 0) return '0%'
  return `${Math.round((numerator / denominator) * 100)}%`
}

function pickMetric(metrics: SalesMetrics, key: MetricKey): number {
  return metrics[key]
}

/** 按视图模式取占比用的指标切片 */
function pickSplitByView(metrics: SplitSalesMetrics, viewMode: FilterViewMode): SalesMetrics {
  if (viewMode === 'virtual') return metrics.virtual
  if (viewMode === 'physical') return metrics.physical
  return metrics.total
}

/** 整机订阅省占比；对比视图展示实体数/虚拟滤芯数（真实数量，非百分比） */
function formatRatioByMetric(
  machineSubs: SplitSalesMetrics,
  totalNewSubs: SplitSalesMetrics,
  key: MetricKey,
  viewMode: FilterViewMode
): string {
  if (viewMode === 'compare') {
    return `${pickMetric(machineSubs.physical, key)} / ${pickMetric(machineSubs.virtual, key)}`
  }

  const machine = pickSplitByView(machineSubs, viewMode)
  const total = pickSplitByView(totalNewSubs, viewMode)
  return toPercent(pickMetric(machine, key), pickMetric(total, key))
}

/** 订阅率 = 滤芯销量 / 总新增订阅数量 */
function formatSubscribeRate(
  filterSales: SplitSalesMetrics,
  totalNewSubs: SplitSalesMetrics,
  key: MetricKey,
  viewMode: FilterViewMode
): string {
  if (viewMode === 'compare') {
    const physicalRate = toPercent(pickMetric(filterSales.physical, key), pickMetric(totalNewSubs.physical, key))
    const virtualRate = toPercent(pickMetric(filterSales.virtual, key), pickMetric(totalNewSubs.virtual, key))
    return `${physicalRate} / ${virtualRate}`
  }

  const sales = pickSplitByView(filterSales, viewMode)
  const total = pickSplitByView(totalNewSubs, viewMode)
  return toPercent(pickMetric(sales, key), pickMetric(total, key))
}

/** 按视图模式展示滤芯相关指标 */
function formatSplitMetricCell(metrics: SplitSalesMetrics, key: MetricKey, viewMode: FilterViewMode) {
  if (viewMode === 'virtual') return pickMetric(metrics.virtual, key)
  if (viewMode === 'physical') return pickMetric(metrics.physical, key)
  if (viewMode === 'compare') {
    return `${pickMetric(metrics.physical, key)} / ${pickMetric(metrics.virtual, key)}`
  }
  return pickMetric(metrics.total, key)
}

/** 按 product_variant_sku 把 ShopifyQL rows 填到整机销量 */
function applyMachineSalesRows(groups: SalesMachineGroup[], rows: ShopifyqlRow[]): SalesMachineGroup[] {
  const bySku = new Map<string, ShopifyqlRow>()
  for (const row of rows) {
    const sku = String(row.product_variant_sku ?? '').trim()
    if (!sku) continue
    bySku.set(sku, row)
  }

  return groups.map((group) => ({
    ...group,
    machineSalesMetrics: toSalesMetrics(group.machineSku ? bySku.get(group.machineSku) : undefined)
  }))
}

function mergeSalesMetrics(...rows: Array<ShopifyqlRow | undefined>): SalesMetrics {
  return rows.reduce<SalesMetrics>(
    (acc, row) => ({
      orders: acc.orders + (Number(row?.orders ?? 0) || 0),
      quantityOrdered: acc.quantityOrdered + (Number(row?.quantity_ordered ?? 0) || 0),
      netItemsSold: acc.netItemsSold + (Number(row?.net_items_sold ?? 0) || 0)
    }),
    { ...EMPTY_METRICS }
  )
}

function indexRowsByVariantId(rows: ShopifyqlRow[]): Map<string, ShopifyqlRow> {
  const byVariantId = new Map<string, ShopifyqlRow>()
  for (const row of rows) {
    const variantId = toNumericId(String(row.product_variant_id ?? '').trim())
    if (!variantId) continue
    byVariantId.set(variantId, row)
  }
  return byVariantId
}

/**
 * 组装同组指标：
 * - 有实体：total=虚拟∪实体，virtual=仅虚拟，physical=仅实体；SKU 优先实体
 * - 无实体（兜底）：total/virtual=虚拟，physical=0；SKU 回退虚拟
 */
function resolveFilterSplit(
  byVariantId: Map<string, ShopifyqlRow>,
  filter: SalesFilterRow
): { metrics: SplitSalesMetrics; displaySku: string } {
  const virtualIds = uniqueNumericIds(filter.virtualFilterVariantIds)
  const physicalIds = filter.hasPhysicalFilter ? uniqueNumericIds(filter.physicalFilterVariantIds) : []
  const virtualRows = virtualIds.map((id) => byVariantId.get(id))
  const virtualMetrics = mergeSalesMetrics(...virtualRows)
  const virtualSku =
    virtualIds.map((id) => String(byVariantId.get(id)?.product_variant_sku ?? '').trim()).find(Boolean) ?? ''

  if (!filter.hasPhysicalFilter || physicalIds.length === 0) {
    return {
      metrics: {
        total: virtualMetrics,
        virtual: virtualMetrics,
        physical: { ...EMPTY_METRICS }
      },
      displaySku: virtualSku
    }
  }

  const physicalRows = physicalIds.map((id) => byVariantId.get(id))
  const physicalMetrics = mergeSalesMetrics(...physicalRows)
  const totalIds = uniqueNumericIds([...virtualIds, ...physicalIds])
  const totalRows = totalIds.map((id) => byVariantId.get(id))
  const physicalSku =
    physicalIds.map((id) => String(byVariantId.get(id)?.product_variant_sku ?? '').trim()).find(Boolean) ?? ''

  return {
    metrics: {
      total: mergeSalesMetrics(...totalRows),
      virtual: virtualMetrics,
      physical: physicalMetrics
    },
    displaySku: physicalSku || virtualSku
  }
}

/** 按 product_variant_id 把 ShopifyQL rows 填到滤芯销量 */
function applyFilterSalesRows(groups: SalesMachineGroup[], rows: ShopifyqlRow[]): SalesMachineGroup[] {
  const byVariantId = indexRowsByVariantId(rows)

  return groups.map((group) => ({
    ...group,
    filters: group.filters.map((filter) => {
      const { metrics, displaySku } = resolveFilterSplit(byVariantId, filter)
      return {
        ...filter,
        sku: displaySku || filter.sku,
        filterSalesMetrics: metrics
      }
    })
  }))
}

/** 按 product_variant_id 把 ShopifyQL rows 填到总新增订阅数量；SKU 优先实体、无实体回退虚拟 */
function applyTotalNewSubsRows(groups: SalesMachineGroup[], rows: ShopifyqlRow[]): SalesMachineGroup[] {
  const byVariantId = indexRowsByVariantId(rows)

  return groups.map((group) => ({
    ...group,
    filters: group.filters.map((filter) => {
      const { metrics, displaySku } = resolveFilterSplit(byVariantId, filter)
      return {
        ...filter,
        sku: displaySku || filter.sku,
        totalNewSubsMetrics: metrics
      }
    })
  }))
}

/** 按 product_variant_id 把 ShopifyQL rows 填到整机订阅省数量 */
function applyMachineSubsRows(groups: SalesMachineGroup[], rows: ShopifyqlRow[]): SalesMachineGroup[] {
  const byVariantId = indexRowsByVariantId(rows)

  return groups.map((group) => ({
    ...group,
    filters: group.filters.map((filter) => {
      const { metrics, displaySku } = resolveFilterSplit(byVariantId, filter)
      return {
        ...filter,
        sku: displaySku || filter.sku,
        machineSubsMetrics: metrics
      }
    })
  }))
}

function applySalesQueryRows(groups: SalesMachineGroup[], queries: SalesQueryBundle): SalesMachineGroup[] {
  let next = applyMachineSalesRows(groups, queries.machineSales.rows)
  next = applyFilterSalesRows(next, queries.filterSales.rows)
  next = applyTotalNewSubsRows(next, queries.totalNewSubs.rows)
  next = applyMachineSubsRows(next, queries.machineSubs.rows)
  return next
}

async function fetchAllMachineProducts(admin: AdminApiContext): Promise<MachineProductNode[]> {
  const products: MachineProductNode[] = []
  let after: string | null = null
  let hasNextPage = true

  while (hasNextPage) {
    const response = await admin.graphql(ProductsWithSkuQuery, {
      variables: { first: 50, after }
    })
    const json = (await response.json()) as ProductsWithSkuResponse

    if (json.errors?.length) {
      const messages = json.errors.map((error) => error.message ?? '未知 GraphQL 错误')
      throw new Error(`Shopify GraphQL 请求失败：${messages.join('；')}`)
    }

    const page = json.data?.products
    products.push(...(page?.nodes ?? []))
    hasNextPage = Boolean(page?.pageInfo?.hasNextPage)
    after = page?.pageInfo?.endCursor ?? null
  }

  return products
}

/** 从整机 metafield 收集去重后的虚拟滤芯 variant GID */
function buildVirtualFilterGids(products: MachineProductNode[]): string[] {
  return [...new Set(products.flatMap((product) => parseFilterVariantIds(product.metafield?.value)))]
}

/**
 * 批量查询实体滤芯（PhysicalFiltersQuery），构建映射：
 * 虚拟滤芯 variant 数字 ID → 实体滤芯 variant 数字 ID[]（已去重）
 */
async function buildVirtualToPhysicalFilterMap(
  admin: AdminApiContext,
  virtualFilterGids: string[]
): Promise<VirtualToPhysicalFilterMap> {
  const virtualToPhysicalMap: VirtualToPhysicalFilterMap = new Map()
  if (virtualFilterGids.length === 0) return virtualToPhysicalMap

  const chunkSize = 50
  for (let i = 0; i < virtualFilterGids.length; i += chunkSize) {
    const chunk = virtualFilterGids.slice(i, i + chunkSize)
    const response = await admin.graphql(PhysicalFiltersQuery, {
      variables: { ids: chunk }
    })
    const json = (await response.json()) as PhysicalFiltersResponse

    if (json.errors?.length) {
      const messages = json.errors.map((error) => error.message ?? '未知 GraphQL 错误')
      throw new Error(`实体滤芯查询失败：${messages.join('；')}`)
    }

    for (let index = 0; index < chunk.length; index += 1) {
      const virtualFilterGid = chunk[index]
      const node = json.data?.nodes?.[index]
      const virtualFilterVariantId = toVariantNumericId(virtualFilterGid)
      if (!virtualFilterVariantId) continue

      const physicalFilterValue = node?.metafield?.value
      const physicalFilterVariantIds = uniqueNumericIds(parseFilterVariantIds(physicalFilterValue))
      virtualToPhysicalMap.set(virtualFilterVariantId, physicalFilterVariantIds)
    }
  }

  return virtualToPhysicalMap
}

/** ShopifyQL IN 用：虚拟滤芯 id ∪ 实体滤芯 id，归一化后去重 */
function buildFilterVariantIdListForQuery(
  virtualFilterGids: string[],
  virtualToPhysicalMap: VirtualToPhysicalFilterMap
): string[] {
  return uniqueNumericIds([
    ...virtualFilterGids,
    ...virtualToPhysicalMap.keys(),
    ...[...virtualToPhysicalMap.values()].flat()
  ])
}

/** 从 ProductsWithSku 结果中收集去重后的变体 SKU 列表 */
function buildSkuList(products: MachineProductNode[]): string[] {
  return [
    ...new Set(
      products.flatMap((product) =>
        (product.variants?.nodes ?? []).map((variant) => variant.sku?.trim() || '').filter(Boolean)
      )
    )
  ]
}

/** ShopifyQL product_variant_id 必须是数字字面量，不能加引号 */
function formatShopifyqlIdList(ids: string[]): string {
  return ids
    .map((id) => toNumericId(String(id).trim()))
    .filter((id) => /^\d+$/.test(id))
    .join(', ')
}

function escapeShopifyqlString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

/** 整机销量：按整机 variant SKU 汇总销量（仅 SKU 列表与时间可变） */
function buildMachineSalesShopifyql(skuList: string[], since: string, until: string): string {
  const inList = skuList.map((sku) => `'${escapeShopifyqlString(sku)}'`).join(', ')
  return `FROM sales
SHOW orders, quantity_ordered, net_items_sold
WHERE product_variant_sku IN (${inList})
GROUP BY product_variant_sku WITH TOTALS
SINCE ${since} UNTIL ${until}`
}

async function runShopifyql(
  admin: AdminApiContext,
  query: string
): Promise<{
  parseErrors: string[]
  rows: ShopifyqlRow[]
}> {
  const response = await admin.graphql(ShopifyQLQuery, { variables: { query } })
  const json = (await response.json()) as ShopifyqlGraphqlResponse

  if (json.errors?.length) {
    const messages = json.errors.map((error) => error.message ?? '未知 GraphQL 错误')
    throw new Error(`Shopify GraphQL 请求失败：${messages.join('；')}`)
  }

  const result = json.data?.shopifyqlQuery
  return {
    parseErrors: result?.parseErrors ?? [],
    rows: result?.tableData?.rows ?? []
  }
}

/** 查询整机销量 */
async function queryMachineSales(
  admin: AdminApiContext,
  skuList: string[],
  since: string,
  until: string
): Promise<ShopifyqlResult> {
  if (skuList.length === 0) {
    return {
      ok: false,
      query: '',
      since,
      until,
      skuList,
      parseErrors: [],
      rows: [],
      error: '未找到可用的整机 SKU'
    }
  }

  const query = buildMachineSalesShopifyql(skuList, since, until)
  try {
    const { parseErrors, rows } = await runShopifyql(admin, query)
    return {
      ok: parseErrors.length === 0,
      query,
      since,
      until,
      skuList,
      parseErrors,
      rows
    }
  } catch (error) {
    return {
      ok: false,
      query,
      since,
      until,
      skuList,
      parseErrors: [],
      rows: [],
      error: error instanceof Error ? error.message : '未知错误'
    }
  }
}

/** 总新增订阅数量：首单订阅 tag + 虚拟/实体滤芯 variant 全量过滤 */
function buildTotalNewSubsShopifyql(variantIdList: string[], since: string, until: string): string {
  const inList = formatShopifyqlIdList(variantIdList)
  return `FROM sales
SHOW orders, quantity_ordered, net_items_sold
WHERE order_tags CONTAINS 'appstle_subscription_first_order'
AND product_variant_id IN (${inList})
GROUP BY product_variant_sku, product_variant_id
SINCE ${since} UNTIL ${until}`
}

/** 查询总新增订阅数量 */
async function queryTotalNewSubs(
  admin: AdminApiContext,
  variantIdList: string[],
  since: string,
  until: string
): Promise<ShopifyqlResult> {
  if (variantIdList.length === 0) {
    return {
      ok: false,
      query: '',
      since,
      until,
      parseErrors: [],
      rows: [],
      error: '未找到可用的滤芯 variant ID（虚拟滤芯 / 实体滤芯）'
    }
  }

  const query = buildTotalNewSubsShopifyql(variantIdList, since, until)
  try {
    const { parseErrors, rows } = await runShopifyql(admin, query)
    return {
      ok: parseErrors.length === 0,
      query,
      since,
      until,
      parseErrors,
      rows
    }
  } catch (error) {
    return {
      ok: false,
      query,
      since,
      until,
      parseErrors: [],
      rows: [],
      error: error instanceof Error ? error.message : '未知错误'
    }
  }
}

/** 整机订阅省数量：tag + 虚拟/实体滤芯 variant 全量过滤 */
function buildMachineSubsShopifyql(variantIdList: string[], since: string, until: string): string {
  const inList = formatShopifyqlIdList(variantIdList)
  return `FROM sales
SHOW orders, quantity_ordered, net_items_sold
WHERE order_tags CONTAINS 'system_replacement_filter_subscription'
AND product_variant_id IN (${inList})
GROUP BY product_variant_sku, product_variant_id
SINCE ${since} UNTIL ${until}`
}

/** 查询整机订阅省数量 */
async function queryMachineSubs(
  admin: AdminApiContext,
  variantIdList: string[],
  since: string,
  until: string
): Promise<ShopifyqlResult> {
  if (variantIdList.length === 0) {
    return {
      ok: false,
      query: '',
      since,
      until,
      parseErrors: [],
      rows: [],
      error: '未找到可用的滤芯 variant ID（虚拟滤芯 / 实体滤芯）'
    }
  }

  const query = buildMachineSubsShopifyql(variantIdList, since, until)
  try {
    const { parseErrors, rows } = await runShopifyql(admin, query)
    return {
      ok: parseErrors.length === 0,
      query,
      since,
      until,
      parseErrors,
      rows
    }
  } catch (error) {
    return {
      ok: false,
      query,
      since,
      until,
      parseErrors: [],
      rows: [],
      error: error instanceof Error ? error.message : '未知错误'
    }
  }
}

/** 滤芯销量：按虚拟/实体滤芯 variant id 汇总销量 */
function buildFilterSalesShopifyql(variantIdList: string[], since: string, until: string): string {
  const inList = formatShopifyqlIdList(variantIdList)
  return `FROM sales
SHOW orders, quantity_ordered, net_items_sold
WHERE product_variant_id IN (${inList})
GROUP BY product_variant_sku, product_variant_id
SINCE ${since} UNTIL ${until}`
}

/** 查询滤芯销量 */
async function queryFilterSales(
  admin: AdminApiContext,
  variantIdList: string[],
  since: string,
  until: string
): Promise<ShopifyqlResult> {
  if (variantIdList.length === 0) {
    return {
      ok: false,
      query: '',
      since,
      until,
      parseErrors: [],
      rows: [],
      error: '未找到可用的滤芯 variant ID'
    }
  }

  const query = buildFilterSalesShopifyql(variantIdList, since, until)
  try {
    const { parseErrors, rows } = await runShopifyql(admin, query)
    return {
      ok: parseErrors.length === 0,
      query,
      since,
      until,
      parseErrors,
      rows
    }
  } catch (error) {
    return {
      ok: false,
      query,
      since,
      until,
      parseErrors: [],
      rows: [],
      error: error instanceof Error ? error.message : '未知错误'
    }
  }
}

async function querySalesBundle(
  admin: AdminApiContext,
  skuList: string[],
  filterVariantIdList: string[],
  since: string,
  until: string
): Promise<SalesQueryBundle> {
  const [machineSales, filterSales, totalNewSubs, machineSubs] = await Promise.all([
    queryMachineSales(admin, skuList, since, until),
    queryFilterSales(admin, filterVariantIdList, since, until),
    queryTotalNewSubs(admin, filterVariantIdList, since, until),
    queryMachineSubs(admin, filterVariantIdList, since, until)
  ])
  return { machineSales, filterSales, totalNewSubs, machineSubs }
}

/** 拉取整机 → 虚拟滤芯 → 实体滤芯映射 → 并行跑销量 ShopifyQL */
async function loadSalesContext(
  admin: AdminApiContext,
  since: string,
  until: string
): Promise<{
  products: MachineProductNode[]
  virtualToPhysicalMap: VirtualToPhysicalFilterMap
  queries: SalesQueryBundle
}> {
  const products = await fetchAllMachineProducts(admin)
  const virtualFilterGids = buildVirtualFilterGids(products)
  const virtualToPhysicalMap = await buildVirtualToPhysicalFilterMap(admin, virtualFilterGids)
  const skuList = buildSkuList(products)
  const filterVariantIdList = buildFilterVariantIdListForQuery(virtualFilterGids, virtualToPhysicalMap)
  console.log('[machine-subscribe/sales] virtualToPhysicalMap', Object.fromEntries(virtualToPhysicalMap))
  console.log('[machine-subscribe/sales] filterVariantIdList', filterVariantIdList)
  const queries = await querySalesBundle(admin, skuList, filterVariantIdList, since, until)
  return { products, virtualToPhysicalMap, queries }
}

function reportQueryErrors(
  shopify: { toast: { show: (msg: string, opts?: { isError?: boolean }) => void } },
  queries: SalesQueryBundle
) {
  for (const result of [queries.machineSales, queries.filterSales, queries.totalNewSubs, queries.machineSubs]) {
    if (result.error) {
      shopify.toast.show(result.error, { isError: true })
      continue
    }
    if (result.parseErrors.length > 0) {
      shopify.toast.show(`ShopifyQL 解析失败：${result.parseErrors[0]}`, { isError: true })
    }
  }
}

export const loader = async ({ request }: LoaderFunctionArgs): Promise<SalesLoaderData> => {
  const { admin } = await authenticate.admin(request)

  try {
    const { products, virtualToPhysicalMap, queries } = await loadSalesContext(
      admin,
      DEFAULT_SHOPIFYQL_SINCE,
      DEFAULT_SHOPIFYQL_UNTIL
    )
    const groups = applySalesQueryRows(
      products.map((product) => toSalesGroup(product, virtualToPhysicalMap)),
      queries
    )
    return { groups, queries }
  } catch (error) {
    return {
      groups: [],
      queries: null,
      error: error instanceof Error ? error.message : '未知错误'
    }
  }
}

export const action = async ({ request }: ActionFunctionArgs): Promise<SalesQueryBundle | { error: string }> => {
  const { admin } = await authenticate.admin(request)

  let body: { since?: string; until?: string }
  try {
    body = await request.json()
  } catch {
    return { error: '请求体无效' }
  }

  const since = body.since?.trim() ?? ''
  const until = body.until?.trim() ?? ''
  if (!since || !until) {
    return { error: '请选择开始与结束日期' }
  }

  try {
    const { queries } = await loadSalesContext(admin, since, until)
    return queries
  } catch (error) {
    return { error: error instanceof Error ? error.message : '未知错误' }
  }
}

/**
 * 整机订购省 · 销售数据
 * Polaris `<s-table>` 不支持 rowspan 合并单元格，此表用原生 table + Tailwind 实现。
 */
export default function MachineSubscribeSales() {
  const shopify = useAppBridge()
  const loaderData = useLoaderData<typeof loader>()
  const fetcher = useFetcher<SalesQueryBundle | { error: string }>()
  const lastLoggedRef = useRef<SalesQueryBundle | { error: string } | null>(null)
  const defaultPickerDates = getDefaultPickerDates()
  const [since, setSince] = useState(defaultPickerDates.since)
  const [until, setUntil] = useState(defaultPickerDates.until)
  const [groups, setGroups] = useState(loaderData.groups)
  const [metricKey, setMetricKey] = useState<MetricKey>('orders')
  const [filterViewMode, setFilterViewMode] = useState<FilterViewMode>('total')

  const loading = fetcher.state !== 'idle'

  useEffect(() => {
    setGroups(loaderData.groups)
  }, [loaderData.groups])

  useEffect(() => {
    if (loaderData.error) {
      shopify.toast.show(loaderData.error, { isError: true })
    }
  }, [loaderData.error, shopify])

  useEffect(() => {
    if (!loaderData.queries) return
    console.log('[machine-subscribe/sales] sales queries (default -7d)', loaderData.queries)
    reportQueryErrors(shopify, loaderData.queries)
  }, [loaderData.queries, shopify])

  useEffect(() => {
    if (fetcher.state !== 'idle' || !fetcher.data) return
    if (lastLoggedRef.current === fetcher.data) return
    lastLoggedRef.current = fetcher.data

    console.log('[machine-subscribe/sales] sales queries', fetcher.data)

    if ('error' in fetcher.data) {
      shopify.toast.show(fetcher.data.error, { isError: true })
      return
    }

    reportQueryErrors(shopify, fetcher.data)
    setGroups((prev) => applySalesQueryRows(prev, fetcher.data as SalesQueryBundle))
  }, [fetcher.state, fetcher.data, shopify])

  const runQuery = () => {
    if (!since || !until) {
      shopify.toast.show('请选择开始与结束日期', { isError: true })
      return
    }
    if (since > until) {
      shopify.toast.show('开始日期不能晚于结束日期', { isError: true })
      return
    }
    fetcher.submit(JSON.stringify({ since, until }), {
      method: 'POST',
      encType: 'application/json'
    })
  }

  return (
    <s-page heading="销售数据">
      <s-box padding="large">
        <s-stack gap="base">
          <s-banner tone="warning" heading="数据说明">
            Shopify 仅统计已发货订单，且存在约 24-48 小时的数据延迟，以下数据非实时准确值，仅供参考。
          </s-banner>

          <s-section heading="ShopifyQL 查询">
            <s-stack direction="inline" gap="base" alignItems="end">
              <div className="min-w-[180px]">
                <s-date-field
                  label="开始日期"
                  value={since}
                  onChange={(e: Event) => {
                    const nextStart = (e.target as HTMLInputElement).value
                    setSince(nextStart)
                    if (until && nextStart && nextStart > until) setUntil('')
                  }}
                />
              </div>
              <div className="min-w-[180px]">
                <s-date-field
                  label="结束日期"
                  value={until}
                  onChange={(e: Event) => {
                    const nextEnd = (e.target as HTMLInputElement).value
                    setUntil(nextEnd)
                    if (since && nextEnd && nextEnd < since) setSince('')
                  }}
                />
              </div>
              <div className="min-w-[160px]">
                <s-select
                  label="展示指标"
                  value={metricKey}
                  onChange={(e: Event) => setMetricKey((e.target as HTMLSelectElement).value as MetricKey)}
                >
                  {METRIC_OPTIONS.map((option) => (
                    <s-option key={option.value} value={option.value}>
                      {option.label}
                    </s-option>
                  ))}
                </s-select>
              </div>
              <div className="min-w-[240px]">
                <s-select
                  label="滤芯视图"
                  value={filterViewMode}
                  onChange={(e: Event) => setFilterViewMode((e.target as HTMLSelectElement).value as FilterViewMode)}
                >
                  {FILTER_VIEW_OPTIONS.map((option) => (
                    <s-option key={option.value} value={option.value}>
                      {option.label}
                    </s-option>
                  ))}
                </s-select>
              </div>
              <s-button
                variant="primary"
                onClick={runQuery}
                disabled={loading || !since || !until || undefined}
                loading={loading || undefined}
              >
                {loading ? '查询中...' : '查询'}
              </s-button>
            </s-stack>
          </s-section>

          <s-section heading="销售数据">
            {groups.length === 0 ? (
              <EmptyState message="暂无带虚拟滤芯（subscription_filters）的整机商品。" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-[#8c9196] text-center text-sm text-[#202223]">
                  <thead>
                    <tr className="bg-[#f6f6f7] font-semibold">
                      <th className="border border-[#8c9196] px-3 py-2">整机</th>
                      <th className="border border-[#8c9196] px-3 py-2">整机销量</th>
                      <th className="border border-[#8c9196] px-3 py-2">适配滤芯</th>
                      <th className="border border-[#8c9196] px-3 py-2">滤芯销量</th>
                      <th className="border border-[#8c9196] px-3 py-2">总新增订阅数量</th>
                      <th className="border border-[#8c9196] px-3 py-2">整机订阅省数量</th>
                      <th className="border border-[#8c9196] px-3 py-2">订阅率</th>
                      <th className="border border-[#8c9196] px-3 py-2">整机订阅省占比</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((group) =>
                      group.filters.map((filter, index) => (
                        <tr key={`${group.productId}-${filter.name}-${index}`}>
                          {index === 0 && (
                            <>
                              <td
                                rowSpan={group.filters.length}
                                className="border border-[#8c9196] px-3 py-2 align-middle font-medium"
                              >
                                <s-link href={`shopify://admin/products/${group.productNumericId}`} target="_blank">
                                  {group.machine}
                                </s-link>
                              </td>
                              <td
                                rowSpan={group.filters.length}
                                className="border border-[#8c9196] px-3 py-2 align-middle"
                              >
                                {pickMetric(group.machineSalesMetrics, metricKey)}
                              </td>
                            </>
                          )}
                          <td className="border border-[#8c9196] px-3 py-2 break-all">{filter.sku || filter.name}</td>
                          <td className="border border-[#8c9196] px-3 py-2">
                            {formatSplitMetricCell(filter.filterSalesMetrics, metricKey, filterViewMode)}
                          </td>
                          <td className="border border-[#8c9196] px-3 py-2">
                            {formatSplitMetricCell(filter.totalNewSubsMetrics, metricKey, filterViewMode)}
                          </td>
                          <td className="border border-[#8c9196] px-3 py-2">
                            {formatSplitMetricCell(filter.machineSubsMetrics, metricKey, filterViewMode)}
                          </td>
                          <td className="border border-[#8c9196] px-3 py-2">
                            {formatSubscribeRate(
                              filter.filterSalesMetrics,
                              filter.totalNewSubsMetrics,
                              metricKey,
                              filterViewMode
                            )}
                          </td>
                          <td className="border border-[#8c9196] px-3 py-2">
                            {formatRatioByMetric(
                              filter.machineSubsMetrics,
                              filter.totalNewSubsMetrics,
                              metricKey,
                              filterViewMode
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </s-section>
        </s-stack>
      </s-box>
    </s-page>
  )
}
