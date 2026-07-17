import '@shopify/ui-extensions';

//@ts-ignore
declare module './src/CartLineItemSubscriptionNote.tsx' {
  const shopify: import('@shopify/ui-extensions/customer-account.order-status.cart-line-item.render-after').Api;
  const globalThis: { shopify: typeof shopify };
}
