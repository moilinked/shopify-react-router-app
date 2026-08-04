import { DiscountClass, ProductDiscountSelectionStrategy } from '../generated/api'
import type { CartInput, CartLinesDiscountsGenerateRunResult } from '../generated/api'

/**
 * Admin UI / React Router App UI 写入的折扣配置。
 * tiers: VIP 等级名 → 百分比或固定金额产品折扣（与 smile.vip_tier_name 匹配）
 */
type DiscountValueType = 'FIXED_AMOUNT' | 'PERCENTAGE'

type TierRule = {
  tierName: string
  valueType?: DiscountValueType
  amount: number
  message?: string
}

type Requirement = {
  type?: 'NONE' | 'SUBTOTAL' | 'QUANTITY'
  value?: number
}

type Configuration = {
  tiers?: TierRule[]
  productScope?: 'ALL_PRODUCTS' | 'FIXED_VARIANTS'
  productIds?: string[]
  appliesOncePerOrder?: boolean
  requirement?: Requirement
}

function parseConfiguration(jsonValue: unknown): Configuration {
  if (!jsonValue || typeof jsonValue !== 'object') {
    return { tiers: [] }
  }
  return jsonValue as Configuration
}

function resolveValueType(valueType: unknown): DiscountValueType {
  return valueType === 'PERCENTAGE' ? 'PERCENTAGE' : 'FIXED_AMOUNT'
}

function findTierRule(tiers: TierRule[] | undefined, vipTierName: string | undefined): TierRule | undefined {
  if (!tiers?.length || !vipTierName) {
    return undefined
  }
  const normalized = vipTierName.trim().toLowerCase()
  return tiers.find((tier) => tier.tierName?.trim().toLowerCase() === normalized)
}

function getConfiguredIds(ids: unknown): string[] {
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string' && id.length > 0) : []
}

function isEligibleLine(line: CartInput['cart']['lines'][number], configuration: Configuration): boolean {
  const productIds = getConfiguredIds(configuration.productIds)

  if (configuration.productScope !== 'FIXED_VARIANTS') {
    return true
  }
  if (line.merchandise.__typename !== 'ProductVariant') {
    return false
  }
  if (!productIds.length) {
    return false
  }

  return productIds.includes(line.merchandise.id) || productIds.includes(line.merchandise.product.id)
}

function meetsRequirement(lines: CartInput['cart']['lines'], requirement: Requirement | undefined): boolean {
  if (!requirement || !requirement.type || requirement.type === 'NONE') {
    return true
  }
  const threshold = Number(requirement.value)
  if (!Number.isFinite(threshold) || threshold <= 0) {
    return true
  }

  if (requirement.type === 'QUANTITY') {
    const quantity = lines.reduce((sum, line) => sum + (line.quantity ?? 0), 0)
    return quantity >= threshold
  }

  if (requirement.type === 'SUBTOTAL') {
    const subtotal = lines.reduce((sum, line) => {
      const amount = Number(line.cost?.subtotalAmount?.amount)
      return sum + (Number.isFinite(amount) ? amount : 0)
    }, 0)
    return subtotal >= threshold
  }

  return true
}

function isValidAmount(valueType: DiscountValueType, amount: number): boolean {
  if (!Number.isFinite(amount) || amount <= 0) return false
  if (valueType === 'PERCENTAGE' && amount > 100) return false
  return true
}

function buildDiscountValue(valueType: DiscountValueType, amount: number, appliesToEachItem: boolean) {
  if (valueType === 'PERCENTAGE') {
    return {
      percentage: {
        value: amount
      }
    }
  }
  return {
    fixedAmount: {
      amount,
      appliesToEachItem
    }
  }
}

export function cartLinesDiscountsGenerateRun(input: CartInput): CartLinesDiscountsGenerateRunResult {
  if (!input.cart.lines.length) {
    return { operations: [] }
  }

  const hasProductDiscountClass = input.discount.discountClasses.includes(DiscountClass.Product)
  if (!hasProductDiscountClass) {
    return { operations: [] }
  }

  const configuration = parseConfiguration(input.discount.metafield?.jsonValue)
  const vipTierName = input.cart.buyerIdentity?.customer?.vipTierName?.value
  const tierRule = findTierRule(configuration.tiers, vipTierName ?? undefined)
  const valueType = resolveValueType(tierRule?.valueType)
  const amount = Number(tierRule?.amount)

  if (!tierRule || !isValidAmount(valueType, amount)) {
    return { operations: [] }
  }

  const eligibleLines = input.cart.lines.filter((line) => isEligibleLine(line, configuration))
  if (!eligibleLines.length) {
    return { operations: [] }
  }

  if (!meetsRequirement(eligibleLines, configuration.requirement)) {
    return { operations: [] }
  }

  const defaultMessage =
    valueType === 'PERCENTAGE' ? `VIP ${tierRule.tierName} -${amount}%` : `VIP ${tierRule.tierName} -${amount}`
  const message = tierRule.message?.trim() || defaultMessage
  const appliesToEachItem = configuration.appliesOncePerOrder === false

  return {
    operations: [
      {
        productDiscountsAdd: {
          candidates: [
            {
              message,
              targets: eligibleLines.map((line) => ({
                cartLine: {
                  id: line.id
                }
              })),
              value: buildDiscountValue(valueType, amount, appliesToEachItem)
            }
          ],
          selectionStrategy: ProductDiscountSelectionStrategy.First
        }
      }
    ]
  }
}
