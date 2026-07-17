// @ts-ignore — side-effect import registers JSX intrinsics for Polaris web components
import '@shopify/ui-extensions/preact'
import { render } from 'preact'
import { useEffect, useState } from 'preact/hooks'

type Attribute = {
  key: string
  value: string
}

type Money = {
  amount: number | string
  currencyCode: string
}

type RelatedSubscriptionNote = {
  text: string
}

type ProductInfoQueryResponse = {
  variant?: {
    price?: Money
  } | null
  product?: {
    eventProductSku?: {
      value?: string | null
    } | null
  } | null
}

export default function extension() {
  render(<SubscriptionPerDeliveryNote />, document.body)
}

function SubscriptionPerDeliveryNote() {
  const translate = shopify.i18n.translate
  const [relatedNotes, setRelatedNotes] = useState<RelatedSubscriptionNote[]>([])

  useEffect(() => {
    let cancelled = false
    const relatedValue = getAttributeValue(shopify.target.value.attributes, '__related')

    if (!relatedValue) {
      setRelatedNotes([])
      return undefined
    }

    const loadRelatedNotes = async () => {
      const notes = await Promise.all(
        shopify.lines.value.map(async (line) => {
          const lineRelatedValue = getAttributeValue(line.attributes, '__related')
          const linePerDelivery = getPerDelivery(line.attributes)
          const lineAccount = line.cost?.totalAmount?.amount
          if (lineRelatedValue !== relatedValue || !linePerDelivery || lineAccount !== 0) {
            return null
          }

          try {
            const { data } = await shopify.query(
              `query ProductInfo($variantId: ID!, $productId: ID!) {
              variant: node(id: $variantId) {
                ... on ProductVariant {
                  price {
                    amount
                    currencyCode
                  }
                }
              }
              product: node(id: $productId) {
                ... on Product {
                  eventProductSku: metafield(namespace: "custom", key: "event_product_sku") {
                    value
                  }
                }
              }
            }`,
              { variables: { variantId: line.merchandise.id, productId: line.merchandise.product.id } }
            )
            const responseData = data as ProductInfoQueryResponse | undefined
            const eventProductSku = responseData?.product?.eventProductSku?.value?.trim() || null
            const price = responseData?.variant?.price?.amount ?? null
            return {
              text: translate('subscription_note', {
                sku: eventProductSku,
                price: price,
                interval: linePerDelivery,
                intervalUnit: linePerDelivery
              }) as string
            }
          } catch (error) {
            console.error('[CustomerAccount] failed to load subscription product info', error)
            return null
          }
        })
      )

      if (!cancelled) {
        setRelatedNotes(notes.filter((note): note is RelatedSubscriptionNote => note != null))
      }
    }

    loadRelatedNotes()

    return () => {
      cancelled = true
    }
  }, [])

  if (relatedNotes.length === 0) return null
  return (
    <s-box padding="small-400 none none none">
      <s-text color="subdued">{translate('subscription_title') as string}</s-text>
      <s-stack>
        {relatedNotes.length > 0
          ? relatedNotes.map((note, index) => (
              <s-text color="subdued" key={index}>
                {note.text}
              </s-text>
            ))
          : null}
      </s-stack>
    </s-box>
  )
}

function getAttributeValue(attributes: Attribute[], key: string): string | null {
  return attributes.find((attribute) => attribute.key === key)?.value?.trim() || null
}

function getPerDelivery(attributes: Attribute[]): string | null {
  const value = getAttributeValue(attributes, '__per_delivery')?.toLowerCase()

  return value || null
}
