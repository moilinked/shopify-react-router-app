import type { Translate } from '../types'
import { getSettings } from '../utils'

interface SupportSectionProps {
  translate: Translate
}

export function SupportSection({ translate }: SupportSectionProps) {
  const settings = getSettings()
  const contactHref = settings.contactUrl
  const supportHref = settings.helpUrl

  return (
    <s-stack direction="block" gap="base">
      <s-stack direction="inline" gap="small-300" alignItems="center">
        <s-box inlineSize="20px">
          <s-image
            src="https://cdn.shopify.com/s/files/1/0078/6156/7570/files/support-icon.png"
            alt="earn points icon"
            aspectRatio="1/1"
            objectFit="contain"
          />
        </s-box>
        <s-heading>{translate('support_sectionTitle') as string}</s-heading>
      </s-stack>
      <s-section heading="">
        <s-stack
          direction="@container (inline-size > 725px) inline, block"
          gap="base"
          alignItems="@container (inline-size > 725px) center, start"
          justifyContent="space-between"
        >
          <s-stack direction="block" gap="small-300">
            <s-section>
              <s-heading>{translate('support_heading')}</s-heading>
            </s-section>
            <s-text color="subdued">{translate('support_body')}</s-text>
          </s-stack>
          <s-grid
            gridTemplateColumns="1fr 1fr"
            gap="base"
            alignItems="center"
            minInlineSize="@container (inline-size > 725px) 318px, 100%"
          >
            <s-button variant="primary" href={contactHref} target="_blank" inlineSize="fill">
              {translate('support_contact')}
            </s-button>
            <s-button variant="secondary" href={supportHref} target="_blank" inlineSize="fill">
              {translate('support_goToSupport')}
            </s-button>
          </s-grid>
        </s-stack>
      </s-section>
    </s-stack>
  )
}
