export interface SmileVipStatus {
  vip_tier_id: number | null
  vip_tier_expires_at: string | null
  progress_value: number | null
  current_vip_period_end: string | null
  delta_to_retain_vip_tier: number | null
  next_vip_tier_id: number | null
  delta_to_next_vip_tier: number | null
}

export interface SmileCustomer {
  id: number
  first_name: string | null
  last_name: string | null
  email: string
  points_balance: number
  referral_url: string | null
  vip_status: SmileVipStatus | null
}

export interface ShopifyCustomerSummary {
  email: string | null
  first_name: string | null
  last_name: string | null
}

export interface SmileVipTier {
  id: number
  name: string
  image_url: string
  milestone: number
}

export interface SmileReward {
  id: number
  name: string
  description?: string | null
  image_url?: string | null
}

export interface SmilePointsProduct {
  id: number
  exchange_type: 'fixed' | 'variable'
  exchange_description: string
  points_price: number | null
  variable_points_step: number | null
  variable_points_step_reward_value: number | null
  variable_points_min: number | null
  variable_points_max: number | null
  reward: SmileReward
}

export interface SmileEarningRuleRewardValue {
  type: 'fixed' | 'variable'
  fixed?: {
    value: number
  }
  variable?: {
    per_amount: number
    value: number
  }
}

export interface SmileEarningRule {
  id: number
  name: string
  image_url: string | null
  reward_value: SmileEarningRuleRewardValue
}

export interface SmilePointsTransaction {
  id: number
  customer_id: number
  points_change: number
  description: string
  internal_note: string | null
  created_at: string
  updated_at: string
}

export interface LoyaltyInitData {
  customer: SmileCustomer | null
  shopify_customer: ShopifyCustomerSummary
  vip_tiers: SmileVipTier[]
  points_products: SmilePointsProduct[]
  earning_rules: SmileEarningRule[]
  currencyCode: string
  storefrontUrl: string | null
}

export interface LoyaltyTransactionsData {
  points_transactions: SmilePointsTransaction[]
  next_cursor: string | null
  previous_cursor: string | null
}

export interface NormalizedTier {
  id: number
  name: string
  label: string
  milestone: number
  icon: string
}

export type Translate = typeof shopify.i18n.translate
