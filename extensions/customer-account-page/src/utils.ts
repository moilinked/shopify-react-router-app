import { getCurrencySymbol } from '../../../app/utils/currency'
import type { NormalizedTier, SmileEarningRuleRewardValue, SmilePointsProduct, SmileVipTier, Translate } from './types'

export { getCurrencySymbol }

export function formatMoney(amount: number, currencyCode: string): string {
  const symbol = getCurrencySymbol(currencyCode)
  const formattedAmount = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0
  }).format(amount)
  return `${symbol}${formattedAmount}`
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined).format(value)
}

const DEFAULT_SETTINGS = {
  rewardUrl: 'https://www.waterdropfilter.com/pages/rewards?ref=account',
  referUrl: 'https://www.waterdropfilter.com/pages/refer-a-friend?ref=account',
  contactUrl: 'https://www.waterdropfilter.com/pages/contact-us?ref=account',
  helpUrl: 'https://www.waterdropfilter.com/pages/help-center?ref=account',
  referralHelpPc: 'https://cdn.shopify.com/s/files/1/0078/6156/7570/files/referral-bg-pc.webp?v=1781772947',
  referralHelpMb: 'https://cdn.shopify.com/s/files/1/0078/6156/7570/files/referral-bg-mb.webp?v=1781772816'
}

export type ExtensionSettings = typeof DEFAULT_SETTINGS

function withDefault(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback
}

export function getSettings(): ExtensionSettings {
  const values = shopify.settings.value

  return {
    rewardUrl: withDefault(values.reward_url, DEFAULT_SETTINGS.rewardUrl),
    referUrl: withDefault(values.refer_url, DEFAULT_SETTINGS.referUrl),
    contactUrl: withDefault(values.contact_url, DEFAULT_SETTINGS.contactUrl),
    helpUrl: withDefault(values.help_url, DEFAULT_SETTINGS.helpUrl),
    referralHelpPc: withDefault(values.referral_help_pc, DEFAULT_SETTINGS.referralHelpPc),
    referralHelpMb: withDefault(values.referral_help_mb, DEFAULT_SETTINGS.referralHelpMb)
  }
}

export function getRewardsHomeUrl(settings: ExtensionSettings): string {
  return `${settings.rewardUrl}&smile_deep_link=points_products#points-redemption`
}

export function getWaysToEarnUrl(settings: ExtensionSettings): string {
  return `${settings.rewardUrl}#ways-to-earn-points`
}

export function getPointsActivityRulesUrl(settings: ExtensionSettings): string {
  return `${settings.rewardUrl}&smile_deep_link=points_activity_rules#ways-to-earn-points`
}

export function getReferralDetailsUrl(settings: ExtensionSettings): string {
  return `${settings.referUrl}#smile-home`
}

export function getReferralSmileUrl(settings: ExtensionSettings): string {
  return `${settings.referUrl}#smile-referral-program-details`
}

export function normalizeTiers(rawTiers: SmileVipTier[], currencyCode: string, translate: Translate): NormalizedTier[] {
  return [...rawTiers]
    .sort((a, b) => a.milestone - b.milestone)
    .map((tier) => ({
      id: tier.id,
      name: tier.name,
      milestone: tier.milestone,
      icon: tier.image_url,
      label:
        tier.milestone > 0
          ? (translate('profile_spendAmount', { amount: formatMoney(tier.milestone, currencyCode) }) as string)
          : (translate('profile_signUp') as string)
    }))
}

/**
 * 计算可兑奖产品所需积分。
 * - 固定型 (fixed) 直接取 points_price
 * - 可变型 (variable) 取最小值 variable_points_min
 */
export function getPointsPrice(product: SmilePointsProduct): number {
  if (product.exchange_type === 'fixed') {
    return product.points_price ?? 0
  }
  return product.variable_points_min ?? product.variable_points_step ?? 0
}

/**
 * 兑换进度。当前积分 / 所需积分，超过 1 直接返回 1（已可兑换）。
 */
export function getRedemptionProgress(pointsBalance: number, product: SmilePointsProduct): number {
  const price = getPointsPrice(product)
  if (price <= 0) return 1
  const ratio = pointsBalance / price
  return Math.max(0, Math.min(1, ratio))
}

export function formatPercentInt(ratio: number): number {
  return Math.min(100, Math.max(0, Math.floor(ratio * 100)))
}

export function getRedemptionDeepLink(settings: ExtensionSettings, productId: number): string {
  return `${settings.rewardUrl}&smile_deep_link=points_product:${productId}#points-redemption`
}

export function formatEarningRulePoints(
  rewardValue: SmileEarningRuleRewardValue,
  currencyCode: string,
  translate: Translate
): string {
  if (rewardValue.type === 'fixed' && rewardValue.fixed) {
    return translate('earn_pointsLabel', { points: formatNumber(Math.floor(rewardValue.fixed.value)) }) as string
  }

  if (rewardValue.type === 'variable' && rewardValue.variable) {
    return translate('earn_variablePointsLabel', {
      amount: formatMoney(Math.floor(rewardValue.variable.per_amount), currencyCode),
      points: formatNumber(Math.floor(rewardValue.variable.value))
    }) as string
  }

  return ''
}
