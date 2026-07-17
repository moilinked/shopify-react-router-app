import { createExternalApiClient, createProxyLoader, createProxyAction } from '~/utils/proxy.server'
import { getSmileTokenForShop, SMILE_API_BASE } from '~/config'

const smileApi = createExternalApiClient({
  baseUrl: SMILE_API_BASE,
  name: 'Smile API',
  getHeaders: (context) => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getSmileTokenForShop(context?.shop ?? '')}`
  })
})

export const loader = createProxyLoader('smile')

export const action = createProxyAction({
  routeName: 'smile',
  client: smileApi,
  allowedEndpoints: [
    '/vip_tiers',
    '/customers',
    '/points_products',
    '/points_transactions',
    '/earning_rules',
    '/reward_fulfillments'
  ]
})
