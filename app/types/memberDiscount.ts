export type DiscountMethod = 'CODE' | 'AUTOMATIC'

export type ProductScope = 'ALL_PRODUCTS' | 'FIXED_VARIANTS'

export type PurchaseType = 'ONE_TIME' | 'SUBSCRIPTION' | 'BOTH'

export type RequirementType = 'NONE' | 'SUBTOTAL' | 'QUANTITY'

export type SelectedVariant = {
  id: string
  title: string
}

export type SelectedProduct = {
  id: string
  title: string
  image?: string
  variants?: SelectedVariant[]
  totalVariants?: number
}

export type DiscountValueType = 'FIXED_AMOUNT' | 'PERCENTAGE'

export type TierRule = {
  tierName: string
  valueType?: DiscountValueType
  amount: number
  message?: string
}

export type TierRow = {
  id: string
  tierName: string
  valueType: DiscountValueType
  amount: string
  message: string
}

function resolveValueType(value: unknown): DiscountValueType {
  return value === 'PERCENTAGE' ? 'PERCENTAGE' : 'FIXED_AMOUNT'
}

export type MemberDiscountRequirement = {
  type: RequirementType
  value?: number
}

export type MemberDiscountConfiguration = {
  tiers: TierRule[]
  productScope: ProductScope
  productIds: string[]
  productSelections: SelectedProduct[]
  appliesOncePerOrder: boolean
  requirement: MemberDiscountRequirement
  metafieldId?: string
}

export type CombinesWithState = {
  orderDiscounts: boolean
  productDiscounts: boolean
  shippingDiscounts: boolean
}

export type MemberDiscountFormState = {
  method: DiscountMethod
  title: string
  code: string
  productScope: ProductScope
  purchaseType: PurchaseType
  productIds: string[]
  productSelections: SelectedProduct[]
  appliesOncePerOrder: boolean
  tiers: TierRow[]
  requirement: MemberDiscountRequirement
  usageLimitEnabled: boolean
  usageLimit: number | null
  appliesOncePerCustomer: boolean
  combinesWith: CombinesWithState
  startsAt: string
  endsAtEnabled: boolean
  endsAt: string | null
  metafieldId?: string
}

export type DiscountUserError = {
  code?: string
  message: string
  field?: string[]
}

export const METAFIELD_NAMESPACE = '$app'
export const METAFIELD_KEY = 'function-configuration'
/** React Router App UI 对应的独立 Function handle（与 Function Settings 那套分离） */
export const FUNCTION_HANDLE = 'member-discount-function-app'
/** Admin Function Settings 对应的 Function handle */
export const FUNCTION_SETTINGS_HANDLE = 'member-discount-function'

export function createEmptyTier(): TierRow {
  return {
    id: `tier-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tierName: '',
    valueType: 'FIXED_AMOUNT',
    amount: '10',
    message: ''
  }
}

export function createDefaultFormState(): MemberDiscountFormState {
  const now = new Date()
  const local = toLocalDateTimeValue(now)
  return {
    method: 'CODE',
    title: '',
    code: '',
    productScope: 'ALL_PRODUCTS',
    purchaseType: 'BOTH',
    productIds: [],
    productSelections: [],
    appliesOncePerOrder: true,
    tiers: [createEmptyTier()],
    requirement: { type: 'NONE' },
    usageLimitEnabled: false,
    usageLimit: null,
    appliesOncePerCustomer: false,
    combinesWith: {
      orderDiscounts: false,
      productDiscounts: false,
      shippingDiscounts: false
    },
    startsAt: local,
    endsAtEnabled: false,
    endsAt: null
  }
}

export function toLocalDateTimeValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:00`
}

export function tiersToConfiguration(tiers: TierRow[]): TierRule[] {
  return tiers
    .map((tier) => {
      const valueType = resolveValueType(tier.valueType)
      const amount = Number(tier.amount)
      return {
        tierName: tier.tierName.trim(),
        valueType,
        amount,
        message: tier.message.trim() || undefined
      }
    })
    .filter((tier) => {
      if (!tier.tierName || !Number.isFinite(tier.amount) || tier.amount <= 0) return false
      if (tier.valueType === 'PERCENTAGE' && tier.amount > 100) return false
      return true
    })
}

export function configurationToTierRows(tiers: TierRule[] | undefined): TierRow[] {
  if (!tiers?.length) return [createEmptyTier()]
  return tiers.map((tier, index) => ({
    id: `tier-${index}-${tier.tierName || 'row'}`,
    tierName: String(tier.tierName ?? ''),
    valueType: resolveValueType(tier.valueType),
    amount: String(tier.amount ?? ''),
    message: String(tier.message ?? '')
  }))
}

export function buildConfigurationPayload(
  form: MemberDiscountFormState
): Omit<MemberDiscountConfiguration, 'metafieldId'> {
  const isFixed = form.productScope === 'FIXED_VARIANTS'
  return {
    tiers: tiersToConfiguration(form.tiers),
    productScope: form.productScope,
    productIds: isFixed ? form.productIds : [],
    productSelections: isFixed ? form.productSelections : [],
    appliesOncePerOrder: form.appliesOncePerOrder,
    requirement:
      form.requirement.type === 'NONE'
        ? { type: 'NONE' }
        : { type: form.requirement.type, value: Number(form.requirement.value) || 0 }
  }
}

export function purchaseTypeToFlags(purchaseType: PurchaseType): {
  appliesOnOneTimePurchase: boolean
  appliesOnSubscription: boolean
} {
  if (purchaseType === 'ONE_TIME') {
    return { appliesOnOneTimePurchase: true, appliesOnSubscription: false }
  }
  if (purchaseType === 'SUBSCRIPTION') {
    return { appliesOnOneTimePurchase: false, appliesOnSubscription: true }
  }
  return { appliesOnOneTimePurchase: true, appliesOnSubscription: true }
}

export function flagsToPurchaseType(
  appliesOnOneTimePurchase?: boolean | null,
  appliesOnSubscription?: boolean | null
): PurchaseType {
  const oneTime = appliesOnOneTimePurchase !== false
  const subscription = appliesOnSubscription !== false
  if (oneTime && !subscription) return 'ONE_TIME'
  if (!oneTime && subscription) return 'SUBSCRIPTION'
  return 'BOTH'
}
