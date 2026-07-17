export const APP_CONFIG = {
  api: {
    rewardsBackendAPI: 'https://shopify-activity.ecolifeglobal.cn',
    timeout: null
  }
} as const

export type AppConfig = typeof APP_CONFIG

export const SMILE_API_BASE = 'https://api.smile.io/v1'
/**
 * 多店铺 Smile API Token 映射
 * key = Shopify 店铺域名 (xxx.myshopify.com)
 * value = 对应的 Smile API Bearer token
 */
const SMILE_SHOP_TOKENS: Record<string, string> = {
  'dev-test-202051044.myshopify.com': 'api_5735d90a3c467c3a057fc36323fc6d37',
  'filteroutlet.myshopify.com': 'api_5735d90a3c467c3a057fc36323fc6d37',
  'waterdropde.myshopify.com': 'api_7eab739685ee6b332630b06b9e1e1020',
  'waterdropuk.myshopify.com': 'api_7d0913b98012369db00ca37ee8ce6d62',
  'waterdropcanada.myshopify.com': 'api_7c8d17e1ef86f5d4369843be4577cdc1',
  'waterdropfilter-eu.myshopify.com': 'api_ed0bc411dbe6c3bdc1827e37b7907407'
}

export function getSmileTokenForShop(shop: string): string {
  const token = SMILE_SHOP_TOKENS[shop]
  if (!token) {
    throw new Error(`No Smile API token configured for shop: ${shop}`)
  }
  return token
}

/** 店铺无开启订阅功能，不展示「购买类型」选项的店铺*/
const SHOPS_WITHOUT_PURCHASE_TYPE = new Set(['waterdropuk.myshopify.com'])

export function shouldShowPurchaseType(shop: string): boolean {
  return !SHOPS_WITHOUT_PURCHASE_TYPE.has(shop)
}
