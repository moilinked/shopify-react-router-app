import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import { authenticate } from '~/shopify.server'
import { jsonFail, jsonOk, withCors } from '~/utils/proxy.server'
import { BusinessError } from '~/utils/http'
import type {
  AdminClient,
  CustomerUserError,
  GraphqlResponse,
  SubscribeCustomer,
  CustomersByEmailData,
  CustomerCreateResult,
  CustomerUpdateResult,
  EmailConsentResult
} from '~/types/proxy'
import logger from '~/lib/logger.server'

const MAX_TAG_COUNT = 3
const MAX_TAG_LENGTH = 50
const BASIC_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ── Route Handlers ──────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (request.method === 'OPTIONS') {
    return withCors(new Response(null, { status: 204 }))
  }
  await authenticate.public.appProxy(request)
  logger.warn(
    { module: 'proxy-subscribe', method: request.method, path: new URL(request.url).pathname },
    'Subscribe proxy received non-POST request'
  )
  return withCors(jsonFail(405, 'Method Not Allowed'))
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const path = new URL(request.url).pathname
  const log = logger.child({ module: 'proxy-subscribe', path })
  try {
    const authResult = await authenticate.public.appProxy(request)
    if (!authResult?.admin) {
      log.warn('Subscribe proxy authentication failed')
      return withCors(jsonFail(401, 'Failed to authenticate with Shopify'))
    }

    const form = await request.formData()
    const email = String(form.get('email') ?? '').trim()
    const tags = parseTags(form.get('tags'))

    if (!email) {
      log.warn('Subscribe proxy missing email')
      return withCors(jsonFail(400, 'Email is required'))
    }
    if (!isValidEmail(email)) {
      log.warn('Subscribe proxy received invalid email')
      return withCors(jsonFail(400, 'Invalid email format'))
    }

    const existing = await getCustomerByEmail(authResult.admin, email)

    if (!existing) {
      //- 邮箱不存在：创建客户并订阅
      await createCustomer(authResult.admin, { email, tags })
      log.info({ email, created: true }, 'Customer created and subscribed')
      return withCors(jsonOk<{ success: boolean; prevState: string }>({ success: true, prevState: 'NOT_SUBSCRIBED' }))
    }

    //- 邮箱存在：更新客户 Tags 并同步订阅状态
    await updateCustomer(authResult.admin, existing, { tags })
    log.info({ email, created: false }, 'Customer updated and subscription synced')
    return withCors(
      jsonOk<{ success: boolean; prevState: string }>({
        success: true,
        prevState: existing.defaultEmailAddress?.marketingState ?? 'NOT_SUBSCRIBED'
      })
    )
  } catch (error) {
    log.error({ err: error }, 'Subscribe action failed')
    const code = error instanceof BusinessError ? error.code : 400
    return withCors(jsonFail(code, error instanceof Error ? error.message : 'Failed to subscribe'))
  }
}

// ── GraphQL Operations ──────────────────────────────────

const CUSTOMER_BY_EMAIL_QUERY = `#graphql
  query customerByEmail($query: String!) {
    customers(first: 1, query: $query) {
      edges {
        node {
          id
          tags
          defaultEmailAddress { emailAddress marketingState marketingOptInLevel marketingState }
        }
      }
    }
  }
`

const CUSTOMER_CREATE_MUTATION = `#graphql
  mutation customerCreate($input: CustomerInput!) {
    customerCreate(input: $input) {
      customer {
        id
        tags
        defaultEmailAddress { emailAddress marketingState marketingOptInLevel  }
      }
      userErrors { field message }
    }
  }
`

const CUSTOMER_UPDATE_MUTATION = `#graphql
  mutation customerUpdate($input: CustomerInput!) {
    customerUpdate(input: $input) {
      customer {
        id
        tags
        defaultEmailAddress { emailAddress }
      }
      userErrors { field message }
    }
  }
`

const EMAIL_CONSENT_MUTATION = `#graphql
  mutation customerEmailMarketingConsentUpdate($input: CustomerEmailMarketingConsentUpdateInput!) {
    customerEmailMarketingConsentUpdate(input: $input) {
      customer {
        id
        defaultEmailAddress { marketingState marketingOptInLevel }
      }
      userErrors { field message }
    }
  }
`

// ── Helpers ─────────────────────────────────────────────

/** 解析逗号分隔的 tags 字符串，最多保留 3 个有效 tag。 */
function parseTags(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== 'string' || !raw.trim()) return []
  const tags: string[] = []
  for (const tag of raw.split(',')) {
    const trimmed = tag.trim()
    if (!trimmed || trimmed.length > MAX_TAG_LENGTH || tags.includes(trimmed)) continue
    tags.push(trimmed)
    if (tags.length >= MAX_TAG_COUNT) break
  }
  return tags
}

function isValidEmail(email: string): boolean {
  return BASIC_EMAIL_PATTERN.test(email)
}

function throwIfUserErrors(errors: CustomerUserError[] | undefined, label: string) {
  if (errors?.length) {
    throw new BusinessError(422, `[${label}] ${errors[0].message}`)
  }
}

async function getCustomerByEmail(admin: AdminClient, email: string): Promise<SubscribeCustomer | null> {
  const res = await admin.graphql(CUSTOMER_BY_EMAIL_QUERY, {
    variables: { query: `email:${JSON.stringify(email)}` }
  })
  const json: GraphqlResponse<CustomersByEmailData> = await res.json()
  return json.data?.customers?.edges?.[0]?.node ?? null
}

async function createCustomer(admin: AdminClient, data: { email: string; tags: string[] }): Promise<SubscribeCustomer> {
  const input: Record<string, unknown> = {
    email: data.email,
    emailMarketingConsent: {
      marketingState: 'SUBSCRIBED',
      marketingOptInLevel: 'SINGLE_OPT_IN'
    }
  }
  if (data.tags.length) input.tags = data.tags

  const res = await admin.graphql(CUSTOMER_CREATE_MUTATION, { variables: { input } })
  const json: GraphqlResponse<CustomerCreateResult> = await res.json()
  throwIfUserErrors(json.data?.customerCreate?.userErrors, 'CREATE_FAILED')

  const customer = json.data?.customerCreate?.customer
  if (!customer) {
    throw new BusinessError(500, '[CREATE_FAILED] Customer was not created')
  }
  return customer
}

async function updateCustomer(
  admin: AdminClient,
  existing: SubscribeCustomer,
  data: { tags: string[] }
): Promise<SubscribeCustomer> {
  const mergedTags = Array.from(new Set([...(existing.tags ?? []), ...data.tags]))

  const res = await admin.graphql(CUSTOMER_UPDATE_MUTATION, {
    variables: { input: { id: existing.id, tags: mergedTags } }
  })
  const json: GraphqlResponse<CustomerUpdateResult> = await res.json()
  throwIfUserErrors(json.data?.customerUpdate?.userErrors, 'UPDATE_FAILED')

  let customer: SubscribeCustomer = json.data?.customerUpdate?.customer ?? existing

  const consent = await updateEmailConsent(admin, existing.id)
  if (consent) {
    customer = { ...customer, defaultEmailAddress: { ...customer.defaultEmailAddress, ...consent } }
  }

  return customer
}

async function updateEmailConsent(admin: AdminClient, customerId: string) {
  const res = await admin.graphql(EMAIL_CONSENT_MUTATION, {
    variables: {
      input: {
        customerId,
        emailMarketingConsent: {
          marketingState: 'SUBSCRIBED',
          marketingOptInLevel: 'SINGLE_OPT_IN'
        }
      }
    }
  })
  const json: GraphqlResponse<EmailConsentResult> = await res.json()
  throwIfUserErrors(json.data?.customerEmailMarketingConsentUpdate?.userErrors, 'EMAIL_CONSENT_FAILED')
  return json.data?.customerEmailMarketingConsentUpdate?.customer?.defaultEmailAddress
}
