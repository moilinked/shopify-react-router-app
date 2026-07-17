import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import { authenticate } from '~/shopify.server'
import { withCors } from '~/utils/proxy.server'
import type {
  CustomerUpdateRequest,
  CustomerData,
  CustomerUserError,
  GraphqlResponse,
  CustomerUpdateData,
  EmailConsentData,
  SmsConsentData,
  AdminClient
} from '~/types/proxy'
import { BusinessError } from '~/utils/http'
import { jsonFail, jsonOk } from '~/utils/proxy.server'
import logger from '~/lib/logger.server'

interface CustomerQueryData {
  customer: CustomerData | null
}

interface CustomerProfileData {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  emailSubscribed: boolean
  smsSubscribed: boolean
}

// ── Route Handlers ──────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const path = new URL(request.url).pathname
  const log = logger.child({ module: 'proxy-customer', path })
  try {
    const authResult = await authenticate.public.appProxy(request)

    if (!authResult?.admin) {
      log.warn('Customer proxy authentication failed')
      return withCors(jsonFail(401, 'Failed to authenticate with Shopify'))
    }

    const url = new URL(request.url)
    const customerId = getCustomerIdFromProxy(url)
    if (!customerId) {
      log.warn('Customer proxy missing logged_in_customer_id')
      return withCors(jsonFail(401, 'Customer not logged in'))
    }

    const customer = await getCustomerProfile(authResult.admin, customerId)
    return withCors(jsonOk(customer))
  } catch (error) {
    log.error({ err: error }, 'Customer query failed')
    const code = (error as { code?: string }).code
    return withCors(
      jsonFail(400, code ? `[${code}] ${(error as Error).message}` : 'Failed to get customer information')
    )
  }
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const path = new URL(request.url).pathname
  const log = logger.child({ module: 'proxy-customer', path })
  try {
    const authResult = await authenticate.public.appProxy(request)

    if (!authResult?.admin) {
      log.warn('Customer proxy authentication failed')
      return withCors(jsonFail(401, 'Failed to authenticate with Shopify'))
    }

    const url = new URL(request.url)

    const customerId = getCustomerIdFromProxy(url)
    if (!customerId) {
      log.warn('Customer proxy missing logged_in_customer_id')
      return jsonFail(401, 'Customer not logged in')
    }

    const body = (await request.json()) as CustomerUpdateRequest
    if (!body || Object.keys(body).length === 0) {
      log.warn({ customerId }, 'Customer proxy request body is empty')
      return jsonFail(400, 'No data provided')
    }

    const customer = await updateCustomer(authResult.admin, customerId, body)
    log.info({ customerId }, 'Customer information updated successfully')
    return jsonOk(customer, 'Customer information updated successfully')
  } catch (error) {
    log.error({ err: error }, 'Customer update failed')
    const code = (error as { code?: string }).code
    return jsonFail(400, code ? `[${code}] ${(error as Error).message}` : 'Failed to update customer information')
  }
}

// ── GraphQL Mutations ───────────────────────────────────

const CUSTOMER_UPDATE_MUTATION = `
  mutation customerUpdate($input: CustomerInput!) {
    customerUpdate(input: $input) {
      customer {
        id
        firstName
        lastName
        email
        phone
      }
      userErrors { field message }
    }
  }
`

const EMAIL_CONSENT_MUTATION = `
  mutation customerEmailMarketingConsentUpdate($input: CustomerEmailMarketingConsentUpdateInput!) {
    customerEmailMarketingConsentUpdate(input: $input) {
      customer {
        id
        emailMarketingConsent { marketingState marketingOptInLevel }
      }
      userErrors { field message }
    }
  }
`

const SMS_CONSENT_MUTATION = `
  mutation customerSmsMarketingConsentUpdate($input: CustomerSmsMarketingConsentUpdateInput!) {
    customerSmsMarketingConsentUpdate(input: $input) {
      customer {
        id
        smsMarketingConsent { marketingState marketingOptInLevel }
      }
      userErrors { field message }
    }
  }
`

const CUSTOMER_QUERY = `
  query customer($id: ID!) {
    customer(id: $id) {
      id
      firstName
      lastName
      email
      phone
      emailMarketingConsent { marketingState }
      smsMarketingConsent { marketingState }
    }
  }
`

// ── Helpers ─────────────────────────────────────────────

function throwIfUserErrors(errors: CustomerUserError[] | undefined, label: string) {
  if (errors?.length) {
    throw new BusinessError(422, `[${label}] ${errors[0].message}`)
  }
}

function buildCustomerInput(customerGid: string, body: CustomerUpdateRequest): Record<string, unknown> {
  const input: Record<string, unknown> = { id: customerGid }

  if (body.firstName !== undefined) input.firstName = body.firstName
  if (body.lastName !== undefined) input.lastName = body.lastName
  if (body.email !== undefined) input.email = body.email
  if (body.phone !== undefined) input.phone = body.phone

  return input
}

function getCustomerIdFromProxy(url: URL): string | null {
  return url.searchParams.get('logged_in_customer_id') || null
}

function isSubscribed(marketingState?: string): boolean {
  return marketingState === 'SUBSCRIBED'
}

async function getCustomerProfile(admin: AdminClient, customerId: string): Promise<CustomerProfileData> {
  const customerGid = `gid://shopify/Customer/${customerId}`
  const res = await admin.graphql(CUSTOMER_QUERY, { variables: { id: customerGid } })
  const json: GraphqlResponse<CustomerQueryData> = await res.json()

  const customer = json.data?.customer
  if (!customer) {
    throw new BusinessError(404, '[CUSTOMER_NOT_FOUND] Customer not found')
  }

  return {
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email,
    phone: customer.phone,
    emailSubscribed: isSubscribed(customer.emailMarketingConsent?.marketingState),
    smsSubscribed: isSubscribed(customer.smsMarketingConsent?.marketingState)
  }
}

async function updateCustomer(
  admin: AdminClient,
  customerId: string,
  body: CustomerUpdateRequest
): Promise<CustomerData> {
  const customerGid = `gid://shopify/Customer/${customerId}`

  const input = buildCustomerInput(customerGid, body)
  const res = await admin.graphql(CUSTOMER_UPDATE_MUTATION, { variables: { input } })
  const json: GraphqlResponse<CustomerUpdateData> = await res.json()
  throwIfUserErrors(json.data?.customerUpdate?.userErrors, 'UPDATE_FAILED')

  let customer: CustomerData = json.data!.customerUpdate!.customer

  if (body.emailSubscribed !== undefined) {
    const emailRes = await admin.graphql(EMAIL_CONSENT_MUTATION, {
      variables: {
        input: {
          customerId: customerGid,
          emailMarketingConsent: {
            marketingState: body.emailSubscribed ? 'SUBSCRIBED' : 'UNSUBSCRIBED',
            marketingOptInLevel: 'SINGLE_OPT_IN'
          }
        }
      }
    })
    const emailJson: GraphqlResponse<EmailConsentData> = await emailRes.json()
    throwIfUserErrors(emailJson.data?.customerEmailMarketingConsentUpdate?.userErrors, 'EMAIL_CONSENT_FAILED')

    const consent = emailJson.data?.customerEmailMarketingConsentUpdate?.customer?.emailMarketingConsent
    if (consent) customer = { ...customer, emailMarketingConsent: consent }
  }

  if (body.smsSubscribed !== undefined) {
    const smsRes = await admin.graphql(SMS_CONSENT_MUTATION, {
      variables: {
        input: {
          customerId: customerGid,
          smsMarketingConsent: {
            marketingState: body.smsSubscribed ? 'SUBSCRIBED' : 'UNSUBSCRIBED',
            marketingOptInLevel: 'SINGLE_OPT_IN'
          }
        }
      }
    })
    const smsJson: GraphqlResponse<SmsConsentData> = await smsRes.json()
    throwIfUserErrors(smsJson.data?.customerSmsMarketingConsentUpdate?.userErrors, 'SMS_CONSENT_FAILED')

    const consent = smsJson.data?.customerSmsMarketingConsentUpdate?.customer?.smsMarketingConsent
    if (consent) customer = { ...customer, smsMarketingConsent: consent }
  }

  return customer
}
