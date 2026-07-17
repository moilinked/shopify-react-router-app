// ── Customer Types ────────────────────────────────
export interface CustomerUpdateRequest {
  firstName?: string
  lastName?: string
  email?: string
  emailSubscribed?: boolean
  phone?: string
  smsSubscribed?: boolean
}

export interface CustomerMetafield {
  namespace: string
  key: string
  value: string
  type?: string
}

export interface CustomerData {
  id: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  metafields?: { edges: { node: CustomerMetafield }[] }
  emailMarketingConsent?: { marketingState: string; marketingOptInLevel: string }
  smsMarketingConsent?: { marketingState: string; marketingOptInLevel: string }
}

export interface CustomerUserError {
  field: string[]
  message: string
}

export interface GraphqlResponse<T> {
  data?: T
}

export interface CustomerUpdateData {
  customerUpdate?: {
    customer: CustomerData
    userErrors: CustomerUserError[]
  }
}

export interface EmailConsentData {
  customerEmailMarketingConsentUpdate?: {
    customer: { id: string; emailMarketingConsent: { marketingState: string; marketingOptInLevel: string } }
    userErrors: CustomerUserError[]
  }
}

export interface SmsConsentData {
  customerSmsMarketingConsentUpdate?: {
    customer: { id: string; smsMarketingConsent: { marketingState: string; marketingOptInLevel: string } }
    userErrors: CustomerUserError[]
  }
}

export interface AdminClient {
  graphql(query: string, options?: { variables?: Record<string, unknown> }): Promise<Response>
}

// ── Proxy Types ────────────────────────────────
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface ProxyContext {
  shop?: string
}

export interface ExternalApiConfig {
  baseUrl: string
  name: string
  timeout?: number
  getHeaders: (context?: ProxyContext) => Record<string, string>
}

export interface ProxyRequestBody {
  endpoint?: string
  method?: string
  payload?: unknown
  query?: Record<string, string | number | boolean | null | undefined>
  pathParams?: Record<string, string | number>
}

export interface ExternalApiParams {
  endpoint: string
  method: HttpMethod
  payload?: unknown
  query?: Record<string, string | number | boolean | null | undefined>
  extraHeaders?: Record<string, string>
  context?: ProxyContext
}

export interface ExternalApiError {
  code: number
  message: string
  details: unknown
}

// ── Subscribe (App Proxy) Types ────────────────────────────────
export interface CustomerEmailAddress {
  emailAddress?: string
  marketingState?: string
  marketingOptInLevel?: string
}

export interface SubscribeCustomer {
  id: string
  tags?: string[]
  defaultEmailAddress?: CustomerEmailAddress
}

export interface CustomersByEmailData {
  customers?: { edges: { node: SubscribeCustomer }[] }
}

export interface CustomerCreateResult {
  customerCreate?: { customer: SubscribeCustomer; userErrors: CustomerUserError[] }
}

export interface CustomerUpdateResult {
  customerUpdate?: { customer: SubscribeCustomer; userErrors: CustomerUserError[] }
}

export interface EmailConsentResult {
  customerEmailMarketingConsentUpdate?: {
    customer: { id: string; defaultEmailAddress?: CustomerEmailAddress }
    userErrors: CustomerUserError[]
  }
}

export interface CustomerSmsResult {
  success: boolean
  prevState: string
}
