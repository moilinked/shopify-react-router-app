/** 返回 Shopify Admin 折扣列表页 */
export function returnToDiscounts() {
  if (typeof window === 'undefined') return
  window.open('shopify://admin/discounts', '_top')
}
