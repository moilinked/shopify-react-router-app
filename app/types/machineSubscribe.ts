export interface ProductRow {
  id: string
  numericId: string
  title: string
  handle: string
  status: string
  totalInventory: number | null
  imageUrl: string | null
  imageAlt: string | null
  price: string | null
  currencyCode: string | null
}

/** 带该 tag 的产品会被识别为「整机订购省」虚拟滤芯产品 */
export const VIRTUAL_PRODUCT_TAG = 'subscribe'
