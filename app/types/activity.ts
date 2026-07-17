export type ActivityType = 'SMILE_POINT_DRAW'

export type ActivityStatus = 'PROGRESS' | 'PENDING' | 'COMPLETED'

export type PrizeType = 'NO_PRIZE' | 'PRODUCT_DISCOUNT_CODE' | 'ORDER_DISCOUNT_CODE' | 'GIFT_CARD' | 'POINTS'

export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT'

export type PurchaseType = 'ONE_TIME' | 'SUBSCRIPTION' | 'BOTH'

export type AppliesToType = 'PRODUCT' | 'COLLECTION'

export type RequirementType = 'NONE' | 'QUANTITY' | 'SUBTOTAL'

export type CombinesWith = 'ORDER_DISCOUNTS' | 'PRODUCT_DISCOUNTS' | 'SHIPPING_DISCOUNTS'

export type ExpirationType = 'RELATIVE' | 'NEVER'

export type ExpirationDays = 'THREE_DAYS' | 'SEVEN_DAYS' | 'THIRTY_DAYS' | 'ONE_YEAR'

export type FrequencyUnit = 'DAY' | 'WEEK' | 'MONTH'

export type DiscountCodeStatus = 'ACTIVE' | 'PENDING' | 'EXPIRED' | 'DISABLED' | 'USED'

export type PrizeTypeFilter = 'ALL' | PrizeType

export type DrawStatus = 'FREE_DEDUCTED' | 'POINT_DEDUCTED' | 'PRIZE_SENDING' | 'SUCCESS' | 'PRIZE_FAILED'

export type DrawStatusFilter = 'ALL' | DrawStatus
// ── Activity List ──

export interface ActivityListItem {
  id: string
  name: string
  type: ActivityType
  start_time: string
  end_time: string
  prizes_count: number
  status: ActivityStatus
}

export interface ActivityListResponse {
  total: number
  page: number
  limit: number
  list: ActivityListItem[]
}

// ── Prize Config ──

export interface DiscountConfig {
  prefix: string
  discount: {
    type: DiscountType
    value: number
    purchase_type?: PurchaseType
  }
  applies_to?: {
    type: AppliesToType
    ids: string[]
  }
  requirement: {
    type: RequirementType
    value?: number
  }
  combines_with: CombinesWith[]
  expiration: {
    type: ExpirationType
    days?: ExpirationDays
  }
}

export interface GiftCardConfig {
  prefix: string
  gift_card_value: number
  expiration: {
    type: ExpirationType
    days?: ExpirationDays
  }
}

export interface PointsConfig {
  point_value: number
  point_description: string
}

export type PrizeConfig = DiscountConfig | GiftCardConfig | PointsConfig | Record<string, never>

export interface Prize {
  id?: number
  prize_type: PrizeType
  prize_name: string
  prize_image: string
  winning_rate: number
  draw_limit?: boolean
  draw_frequency_unit?: FrequencyUnit
  draw_frequency_count?: number
  inventory: number | null
  won_count?: number | null
  config: PrizeConfig
  message?: string
  cta_text?: string
  cta_url?: string
  description?: string
  winning_pop_up_message?: string
  winning_pop_up_cta_text?: string
  winning_pop_up_cta_url?: string
  winning_pop_up_rule?: string | null
}

// ── Activity Detail ──

export interface ActivityDetail {
  id: string
  name: string
  type: ActivityType
  start_time: string
  end_time: string
  status: ActivityStatus
  created_at: string
  updated_at: string
  daily_draw_limit: number
  draw_limit: boolean
  draw_frequency_day?: FrequencyUnit
  draw_frequency_count?: number
  consumption_points: number
  consumption_description?: string
  rules_description: string
  prizes: Prize[]
  prizes_deleted?: Prize[]
}

// ── Activity Create/Update ──

export interface ActivityFormData {
  name: string
  type: ActivityType
  start_time: string
  end_time: string
  daily_draw_limit: number
  draw_limit: boolean
  draw_frequency_day?: FrequencyUnit
  draw_frequency_count?: number
  consumption_points: number
  consumption_description?: string
  rules_description: string
  prizes: Prize[]
}

// ── Dashboard ──

export interface DashboardData {
  start_date: string
  end_date: string
  participants_count: number
  participants_rate: number | null
  no_winning_count: number
  no_winning_rate: number | null
  points_count: number
  points_rate: number | null
  order_discount_count: number
  order_discount_rate: number | null
  product_discount_count: number
  product_discount_rate: number | null
  gift_card_count: number
  gift_card_rate: number | null
}

// ── Win Records ──

export interface WinRecord {
  id: string
  activity_id: string
  time: string
  customer_name: string
  email: string
  consumed_points: number
  prize_name: string
  prize_type: PrizeType
  discount_code: string | null
  discount_code_expiry: string | null
  discount_status: DiscountCodeStatus | null
  status: DrawStatus | null
  remark: string
}

export interface WinRecordsResponse {
  total: number
  page: number
  limit: number
  list: WinRecord[]
}

export interface WinRecordsExportResponse {
  download_url: string
  row_count: number
}
// ── Params ──

export interface ActivityListParams {
  page?: number
  limit?: number
}

export interface DashboardParams {
  id: string
  start_date?: string
  end_date?: string
}

export interface WinRecordsParams {
  activity_id: string
  prize_type?: PrizeTypeFilter
  status?: DrawStatusFilter
  search?: string
  draw_time_start?: string
  draw_time_end?: string
  page?: number
  limit?: number
}

// ── Label Maps ──

export const ACTIVITY_STATUS_MAP: Record<ActivityStatus, string> = {
  PROGRESS: '进行中',
  PENDING: '待开始',
  COMPLETED: '已结束'
}

export const ACTIVITY_STATUS_TONE_MAP: Record<ActivityStatus, string> = {
  PROGRESS: 'info',
  PENDING: 'caution',
  COMPLETED: 'success'
}

export const PRIZE_TYPE_MAP: Record<PrizeType, string> = {
  NO_PRIZE: '无中奖',
  PRODUCT_DISCOUNT_CODE: '产品折扣',
  ORDER_DISCOUNT_CODE: '订单折扣',
  GIFT_CARD: '礼品卡',
  POINTS: '积分'
}

export const PRIZE_TYPE_FILTER_MAP: Record<PrizeTypeFilter, string> = {
  ALL: '全部',
  NO_PRIZE: '无中奖',
  PRODUCT_DISCOUNT_CODE: '产品折扣',
  ORDER_DISCOUNT_CODE: '订单折扣',
  GIFT_CARD: '礼品卡',
  POINTS: '积分'
}

export const DISCOUNT_CODE_STATUS_MAP: Record<DiscountCodeStatus, string> = {
  ACTIVE: '生效中',
  PENDING: '待生效',
  EXPIRED: '已失效',
  DISABLED: '已停用',
  USED: '已使用'
}

export const DISCOUNT_CODE_STATUS_TONE_MAP: Record<DiscountCodeStatus, string> = {
  ACTIVE: 'success',
  PENDING: 'caution',
  EXPIRED: 'critical',
  DISABLED: 'critical',
  USED: 'info'
}

export const FREQUENCY_UNIT_MAP: Record<FrequencyUnit, string> = {
  DAY: '日',
  MONTH: '月',
  WEEK: '周'
}

export const EXPIRATION_DAYS_MAP: Record<ExpirationDays, string> = {
  THREE_DAYS: '3天',
  SEVEN_DAYS: '7天',
  THIRTY_DAYS: '30天',
  ONE_YEAR: '1年'
}

export const DISCOUNT_TYPE_MAP: Record<DiscountType, string> = {
  PERCENTAGE: '百分比',
  FIXED_AMOUNT: '固定金额'
}

export const PURCHASE_TYPE_MAP: Record<PurchaseType, string> = {
  ONE_TIME: '一次性购买',
  SUBSCRIPTION: '订阅',
  BOTH: '两个都'
}

export const APPLIES_TO_TYPE_MAP: Record<AppliesToType, string> = {
  PRODUCT: '特定产品',
  COLLECTION: '特定产品系列'
}

export const REQUIREMENT_TYPE_MAP: Record<RequirementType, string> = {
  NONE: '无最低要求',
  SUBTOTAL: '最低购买金额',
  QUANTITY: '最低商品数量'
}

export const COMBINES_WITH_MAP: Record<CombinesWith, { name: string; text: string }> = {
  PRODUCT_DISCOUNTS: {
    name: '产品折扣',
    text: '购物车中每件符合条件的商品最多可享受一次商品折扣。'
  },
  ORDER_DISCOUNTS: {
    name: '订单折扣',
    text: '所有符合条件的订单折扣将与符合条件的商品折扣叠加使用。'
  },
  SHIPPING_DISCOUNTS: {
    name: '运费折扣',
    text: '符合条件的最大运费折扣将与符合条件的商品折扣叠加使用。'
  }
}

export const DRAW_STATUS_MAP: Record<DrawStatus, string> = {
  FREE_DEDUCTED: '免费次数已扣',
  POINT_DEDUCTED: '积分已扣减',
  PRIZE_SENDING: '发奖中',
  SUCCESS: '全流程成功',
  PRIZE_FAILED: '发奖失败'
}

export const DRAW_STATUS_TONE_MAP: Record<DrawStatus, string> = {
  FREE_DEDUCTED: 'info',
  POINT_DEDUCTED: 'info',
  PRIZE_SENDING: 'info',
  SUCCESS: 'success',
  PRIZE_FAILED: 'critical'
}

export const DRAW_STATUS_FILTER_MAP: Record<DrawStatusFilter, string> = {
  ALL: '全部状态',
  FREE_DEDUCTED: '免费次数已扣',
  POINT_DEDUCTED: '积分已扣减',
  PRIZE_SENDING: '发奖中',
  SUCCESS: '全流程成功',
  PRIZE_FAILED: '发奖失败'
}
