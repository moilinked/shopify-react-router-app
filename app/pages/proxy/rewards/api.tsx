import { createExternalApiClient, createProxyLoader, createProxyAction } from '~/utils/proxy.server'
import { APP_CONFIG } from '~/config'

const backendApi = createExternalApiClient({
  baseUrl: APP_CONFIG.api.rewardsBackendAPI || 'https://api.example.com',
  name: 'Backend API',
  getHeaders: () => ({
    'Content-Type': 'application/json'
  })
})

export const loader = createProxyLoader('api')

export const action = createProxyAction({
  routeName: 'api',
  client: backendApi,
  forwardProxyParams: true,
  allowedEndpoints: ['/activities/*', '/customer', '/draws', '/customer/draw_records', '/check_in']
})
