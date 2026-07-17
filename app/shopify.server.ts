import '@shopify/shopify-app-react-router/adapters/node'
import { ApiVersion, AppDistribution, shopifyApp } from '@shopify/shopify-app-react-router/server'
import { PrismaSessionStorage } from '@shopify/shopify-app-session-storage-prisma'
import prisma from './db.server'
import { startAltTextTimeoutSweeper } from './services/altText.timeout.server'

// 在服务端入口启动一次性的 Job 超时清理任务（幂等，多副本部署需替换为外部 cron）
startAltTextTimeoutSweeper()

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || '',
  apiVersion: ApiVersion.October25,
  scopes: process.env.SCOPES?.split(','),
  appUrl: process.env.SHOPIFY_APP_URL || '',
  authPathPrefix: '/auth',
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  ...(process.env.SHOP_CUSTOM_DOMAIN ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] } : {})
})

export default shopify
export const apiVersion = ApiVersion.October25
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders
export const authenticate = shopify.authenticate
export const unauthenticated = shopify.unauthenticated
export const login = shopify.login
export const registerWebhooks = shopify.registerWebhooks
export const sessionStorage = shopify.sessionStorage
