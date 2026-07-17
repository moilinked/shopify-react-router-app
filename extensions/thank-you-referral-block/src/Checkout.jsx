import '@shopify/ui-extensions/preact'
import { render } from 'preact'

const DEFAULT_SETTINGS = {
  imageUrl: 'https://cdn.shopify.com/s/files/1/0078/6156/7570/files/referral-img.webp?v=1780976294',
  title1: 'Give friends 25% off.',
  title2: 'Get $50 Gift Card when they buy.',
  description: 'Share your referral link and start earning rewards.',
  buttonLabel: 'Get Your Link',
  buttonUrl: 'https://www.waterdropfilter.com/pages/refer-a-friend?ref=thankyoupage'
}

export default async () => {
  render(<Extension />, document.body)
}

function Extension() {
  const settings = getSettings()

  return (
    <s-query-container>
      <s-box borderRadius="base" padding="large-100" background="subdued">
        <s-grid gap="base" gridTemplateColumns="1fr auto" alignItems="center" justifyContent="space-between">
          <s-box inlineSize="@container (inline-size > 400px) 140px, 100px">
            <s-image
              src={settings.imageUrl}
              alt="referral-image"
              inlineSize="fill"
              aspectRatio="1/1"
              objectFit="contain"
            />
          </s-box>

          <s-stack gap="base">
            <s-stack gap="small-300">
              <s-heading>{settings.title1}</s-heading>
              <s-heading>{settings.title2}</s-heading>
              <s-paragraph color="subdued">{settings.description}</s-paragraph>
            </s-stack>

            <s-button href={settings.buttonUrl} variant="primary" inlineSize="fill">
              {settings.buttonLabel}
            </s-button>
          </s-stack>
        </s-grid>
      </s-box>
    </s-query-container>
  )
}

function getSettings() {
  const values = shopify.settings.value

  return {
    imageUrl: withDefault(values.image_url, DEFAULT_SETTINGS.imageUrl),
    title1: withDefault(values.title1, DEFAULT_SETTINGS.title1),
    title2: withDefault(values.title2, DEFAULT_SETTINGS.title2),
    description: withDefault(values.description, DEFAULT_SETTINGS.description),
    buttonLabel: withDefault(values.button_label, DEFAULT_SETTINGS.buttonLabel),
    buttonUrl: withDefault(values.button_url, DEFAULT_SETTINGS.buttonUrl)
  }
}

function withDefault(value, fallback) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback
}
