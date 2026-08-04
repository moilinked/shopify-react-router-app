import { authenticate } from '~/shopify.server'
import {
  CREATE_AUTOMATIC_DISCOUNT,
  CREATE_CODE_DISCOUNT,
  GET_DISCOUNT,
  GET_SHOPIFY_FUNCTIONS,
  UPDATE_AUTOMATIC_DISCOUNT,
  UPDATE_CODE_DISCOUNT
} from '~/graphql/memberDiscount'
import type {
  CombinesWithState,
  DiscountUserError,
  MemberDiscountConfiguration,
  MemberDiscountFormState,
  PurchaseType
} from '~/types/memberDiscount'
import {
  FUNCTION_HANDLE,
  METAFIELD_KEY,
  METAFIELD_NAMESPACE,
  buildConfigurationPayload,
  configurationToTierRows,
  createDefaultFormState,
  flagsToPurchaseType,
  purchaseTypeToFlags,
  toLocalDateTimeValue
} from '~/types/memberDiscount'

type AdminClient = Awaited<ReturnType<typeof authenticate.admin>>['admin']

function parseConfiguration(value: string | undefined | null): MemberDiscountConfiguration {
  try {
    const parsed = value ? (JSON.parse(value) as Partial<MemberDiscountConfiguration>) : {}
    const productIds = Array.isArray(parsed.productIds)
      ? parsed.productIds.filter((id): id is string => typeof id === 'string')
      : []
    return {
      tiers: Array.isArray(parsed.tiers) ? parsed.tiers : [],
      productScope:
        parsed.productScope === 'FIXED_VARIANTS' || productIds.length > 0 ? 'FIXED_VARIANTS' : 'ALL_PRODUCTS',
      productIds,
      productSelections: Array.isArray(parsed.productSelections) ? parsed.productSelections : [],
      appliesOncePerOrder: parsed.appliesOncePerOrder !== false,
      requirement:
        parsed.requirement?.type === 'SUBTOTAL' || parsed.requirement?.type === 'QUANTITY'
          ? { type: parsed.requirement.type, value: Number(parsed.requirement.value) || 0 }
          : { type: 'NONE' }
    }
  } catch {
    return {
      tiers: [],
      productScope: 'ALL_PRODUCTS',
      productIds: [],
      productSelections: [],
      appliesOncePerOrder: true,
      requirement: { type: 'NONE' }
    }
  }
}

function toIsoDate(value: string | null | undefined): string | null {
  if (!value) return null
  const normalized = value.trim().includes('T') ? value.trim() : value.trim().replace(' ', 'T')
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function buildBaseInput(
  form: MemberDiscountFormState,
  options?: { functionId?: string; includeFunctionRef?: boolean }
) {
  const purchaseFlags = purchaseTypeToFlags(form.purchaseType)
  const title = form.method === 'CODE' ? form.code.trim() || form.title.trim() : form.title.trim()
  const includeFunctionRef = options?.includeFunctionRef !== false
  return {
    ...(includeFunctionRef
      ? options?.functionId
        ? { functionId: options.functionId }
        : { functionHandle: FUNCTION_HANDLE }
      : {}),
    title,
    discountClasses: ['PRODUCT'],
    combinesWith: form.combinesWith,
    startsAt: toIsoDate(form.startsAt) ?? new Date().toISOString(),
    endsAt: form.endsAtEnabled ? toIsoDate(form.endsAt) : null,
    ...purchaseFlags,
    context: { all: true }
  }
}

function buildMetafieldInput(form: MemberDiscountFormState) {
  const configuration = buildConfigurationPayload(form)
  if (form.metafieldId) {
    return [
      {
        id: form.metafieldId,
        value: JSON.stringify(configuration)
      }
    ]
  }
  return [
    {
      namespace: METAFIELD_NAMESPACE,
      key: METAFIELD_KEY,
      type: 'json',
      value: JSON.stringify(configuration)
    }
  ]
}

export async function getMemberDiscountFunctionId(admin: AdminClient): Promise<string | null> {
  const response = await admin.graphql(GET_SHOPIFY_FUNCTIONS)
  const json = await response.json()
  const nodes = (json.data?.shopifyFunctions?.nodes ?? []) as Array<{ id?: string; title?: string }>
  // 优先匹配 App UI 独立 Function（title 含 "App"），避免拿到 Function Settings 那套
  const appMatch = nodes.find((node) => {
    const title = String(node.title || '').toLowerCase()
    return title.includes('member') && title.includes('app')
  })
  if (appMatch?.id) return appMatch.id
  const memberMatch = nodes.find((node) =>
    String(node.title || '')
      .toLowerCase()
      .includes('member')
  )
  return memberMatch?.id ?? null
}

export async function getMemberDiscount(request: Request, id: string): Promise<MemberDiscountFormState | null> {
  const { admin } = await authenticate.admin(request)
  const discountGid = id.includes('gid://') ? id : `gid://shopify/DiscountNode/${id}`
  const response = await admin.graphql(GET_DISCOUNT, { variables: { id: discountGid } })
  const json = await response.json()
  const node = json.data?.discountNode
  if (!node?.discount) return null

  const discount = node.discount
  const configuration = parseConfiguration(node.configurationField?.value)
  const method = discount.__typename === 'DiscountCodeApp' ? 'CODE' : 'AUTOMATIC'
  const startsAt = discount.startsAt
    ? toLocalDateTimeValue(new Date(discount.startsAt))
    : createDefaultFormState().startsAt
  const endsAt = discount.endsAt ? toLocalDateTimeValue(new Date(discount.endsAt)) : null

  return {
    method,
    title: discount.title ?? '',
    code: discount.codes?.nodes?.[0]?.code ?? discount.title ?? '',
    productScope: configuration.productScope,
    purchaseType: flagsToPurchaseType(
      discount.appliesOnOneTimePurchase,
      discount.appliesOnSubscription
    ) as PurchaseType,
    productIds: configuration.productIds,
    productSelections: configuration.productSelections,
    appliesOncePerOrder: configuration.appliesOncePerOrder,
    tiers: configurationToTierRows(configuration.tiers),
    requirement: configuration.requirement,
    usageLimitEnabled: typeof discount.usageLimit === 'number',
    usageLimit: typeof discount.usageLimit === 'number' ? discount.usageLimit : null,
    appliesOncePerCustomer: Boolean(discount.appliesOncePerCustomer),
    combinesWith: (discount.combinesWith ?? {
      orderDiscounts: false,
      productDiscounts: false,
      shippingDiscounts: false
    }) as CombinesWithState,
    startsAt,
    endsAtEnabled: Boolean(endsAt),
    endsAt,
    metafieldId: node.configurationField?.id
  }
}

export async function createMemberDiscount(
  request: Request,
  form: MemberDiscountFormState,
  functionId?: string
): Promise<{ errors: DiscountUserError[]; discountId?: string }> {
  const { admin } = await authenticate.admin(request)
  const base = buildBaseInput(form, { functionId, includeFunctionRef: true })
  const metafields = buildMetafieldInput(form)

  if (form.method === 'CODE') {
    const response = await admin.graphql(CREATE_CODE_DISCOUNT, {
      variables: {
        discount: {
          ...base,
          code: form.code.trim(),
          title: form.code.trim(),
          usageLimit: form.usageLimitEnabled ? form.usageLimit : null,
          appliesOncePerCustomer: form.appliesOncePerCustomer,
          metafields
        }
      }
    })
    const json = await response.json()
    return {
      errors: (json.data?.discountCreate?.userErrors ?? []) as DiscountUserError[],
      discountId: json.data?.discountCreate?.codeAppDiscount?.discountId
    }
  }

  const response = await admin.graphql(CREATE_AUTOMATIC_DISCOUNT, {
    variables: {
      discount: {
        ...base,
        metafields
      }
    }
  })
  const json = await response.json()
  return {
    errors: (json.data?.discountCreate?.userErrors ?? []) as DiscountUserError[],
    discountId: json.data?.discountCreate?.automaticAppDiscount?.discountId
  }
}

export async function updateMemberDiscount(
  request: Request,
  id: string,
  form: MemberDiscountFormState
): Promise<{ errors: DiscountUserError[] }> {
  const { admin } = await authenticate.admin(request)
  const base = buildBaseInput(form, { includeFunctionRef: false })
  const metafields = buildMetafieldInput(form)

  if (form.method === 'CODE') {
    const discountId = id.includes('gid://')
      ? id.replace('DiscountNode', 'DiscountCodeNode')
      : `gid://shopify/DiscountCodeNode/${id}`
    const response = await admin.graphql(UPDATE_CODE_DISCOUNT, {
      variables: {
        id: discountId,
        discount: {
          ...base,
          code: form.code.trim(),
          title: form.code.trim(),
          usageLimit: form.usageLimitEnabled ? form.usageLimit : null,
          appliesOncePerCustomer: form.appliesOncePerCustomer,
          metafields
        }
      }
    })
    const json = await response.json()
    return { errors: (json.data?.discountUpdate?.userErrors ?? []) as DiscountUserError[] }
  }

  const discountId = id.includes('gid://')
    ? id.replace('DiscountNode', 'DiscountAutomaticApp').replace('DiscountAutomaticNode', 'DiscountAutomaticApp')
    : `gid://shopify/DiscountAutomaticApp/${id}`
  const response = await admin.graphql(UPDATE_AUTOMATIC_DISCOUNT, {
    variables: {
      id: discountId,
      discount: {
        ...base,
        metafields
      }
    }
  })
  const json = await response.json()
  return { errors: (json.data?.discountUpdate?.userErrors ?? []) as DiscountUserError[] }
}
