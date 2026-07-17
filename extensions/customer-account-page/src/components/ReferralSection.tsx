import { Fragment } from 'preact'
import type { SmileCustomer, Translate } from '../types'
import { getCurrencySymbol, getReferralDetailsUrl, getSettings, getReferralSmileUrl } from '../utils'
import { HELP_FRIENDS_MODAL_ID } from './Modals'

interface ReferralSectionProps {
  loading: boolean
  customer: SmileCustomer | null
  currencyCode: string
  translate: Translate
}

export function ReferralSection({ loading, customer, currencyCode, translate }: ReferralSectionProps) {
  const referralUrl = customer?.referral_url ?? ''
  const currencySymbol = getCurrencySymbol(currencyCode)
  const settings = getSettings()

  const detailsHref = getReferralDetailsUrl(settings)
  const referHref = getReferralSmileUrl(settings)

  const steps: StepCardData[] = [
    {
      step: 1,
      icon: 'https://cdn.shopify.com/s/files/1/0078/6156/7570/files/Frame_8839.webp?v=1780883069',
      action: (
        <s-button variant="secondary" disabled inlineSize="fill">
          {translate('referral_step1Cta')}
        </s-button>
      )
    },
    {
      step: 2,
      icon: 'https://cdn.shopify.com/s/files/1/0078/6156/7570/files/share-icon.webp?v=1780883121',
      action: loading ? (
        <s-skeleton-paragraph />
      ) : (
        referralUrl && (
          <s-stack direction="block" gap="large-100" inlineSize="100%" alignItems="center">
            <s-stack direction="block" gap="none" alignItems="center">
              <s-text>{translate('referral_step2LinkLabel')}</s-text>
              <s-text>{referralUrl}</s-text>
            </s-stack>
            <s-button commandFor="referral-url" variant="primary" inlineSize="fill">
              {translate('referral_step2Cta')}
            </s-button>
            <s-clipboard-item id="referral-url" text={referralUrl}></s-clipboard-item>
          </s-stack>
        )
      )
    },
    {
      step: 3,
      icon: 'https://cdn.shopify.com/s/files/1/0078/6156/7570/files/claims-icon.webp?v=1780883197',
      note: translate('referral_step3Note'),
      action: (
        <s-button variant="primary" command="--show" commandFor={HELP_FRIENDS_MODAL_ID} inlineSize="fill">
          {translate('referral_step3Cta')}
        </s-button>
      )
    },
    {
      step: 4,
      icon: 'https://cdn.shopify.com/s/files/1/0078/6156/7570/files/gift-icon.webp?v=1781771444',
      action: (
        <s-button variant="primary" href={referHref} target="_blank" inlineSize="fill">
          {translate('referral_step4Cta')}
        </s-button>
      )
    }
  ]

  return (
    <s-stack direction="block" gap="base">
      <s-stack direction="inline" gap="small-300" alignItems="center">
        <s-box inlineSize="20px">
          <s-image
            src="https://cdn.shopify.com/s/files/1/0078/6156/7570/files/referral-icon.png"
            alt="referral icon"
            aspectRatio="1/1"
            objectFit="contain"
          />
        </s-box>
        <s-heading>{translate('referral_sectionTitle') as string}</s-heading>
      </s-stack>

      <s-section heading="">
        <s-stack gap="large-200">
          <s-stack
            direction="@container (inline-size > 725px) 'inline', 'block'"
            gap="base"
            alignItems="@container (inline-size > 725px) 'center', 'start'"
            justifyContent="@container (inline-size > 725px) 'space-between', 'start'"
          >
            <s-stack direction="block" gap="small-300">
              <s-section>
                <s-heading>{translate('referral_rewardHeading', { currencySymbol })}</s-heading>
              </s-section>
              <s-text color="subdued">{translate('referral_rewardSubtitle')}</s-text>
            </s-stack>
            <s-box inlineSize="@container (inline-size > 725px) 318px, 100%">
              <s-button variant="secondary" href={detailsHref} target="_blank" inlineSize="fill">
                {translate('referral_viewDetails')}
              </s-button>
            </s-box>
          </s-stack>
          <s-divider />

          <s-stack direction="block" gap="large-200">
            <s-text type="strong">{translate('referral_stepsTitle')}</s-text>

            <s-grid
              gridTemplateColumns="@container (inline-size > 948px) 1fr auto 1fr auto 1fr auto 1fr, 1fr"
              gap="large-200"
              alignItems="@container (inline-size > 948px) stretch, start"
              justifyItems="center"
            >
              {steps.map((item, index) => (
                <Fragment key={item.step}>
                  {index > 0 ? <StepConnector /> : null}
                  <StepCard item={item} currencySymbol={currencySymbol} translate={translate} />
                </Fragment>
              ))}
            </s-grid>
          </s-stack>
        </s-stack>
      </s-section>
    </s-stack>
  )
}

interface StepCardData {
  step: 1 | 2 | 3 | 4
  icon: string
  note?: preact.ComponentChildren
  action: preact.ComponentChildren
}

interface StepCardProps {
  item: StepCardData
  currencySymbol: string
  translate: Translate
}

function StepCard({ item, currencySymbol, translate }: StepCardProps) {
  const { step, icon, note, action } = item
  const titleKey = `referral_step${step}Title`
  const bodyKey = `referral_step${step}Body`
  const stepLabel = `Step ${step}`

  return (
    <s-stack
      direction="block"
      alignItems="center"
      inlineSize="100%"
      paddingInline="large-100"
      justifyContent="space-between"
      gap={`@container (inline-size > 948px) none, ${step === 2 ? 'small-400' : 'large-100'}`}
    >
      <s-stack direction="block" gap="small-400" alignItems="center" inlineSize="100%">
        <s-box inlineSize="60px" borderRadius="max" background="subdued">
          <s-stack direction="block" alignItems="center" justifyContent="center">
            <s-image src={icon} alt={stepLabel} inlineSize="fill" aspectRatio="1/1" objectFit="contain" />
          </s-stack>
        </s-box>
        <s-text color="subdued">{stepLabel}</s-text>
        <s-section>
          <s-paragraph textAlign="center">
            <s-heading>{step === 4 ? `${translate(titleKey, { currencySymbol })}` : translate(titleKey)}</s-heading>
          </s-paragraph>
        </s-section>
        <s-paragraph color="subdued" textAlign="center">
          {translate(bodyKey)}
        </s-paragraph>
        {note ? (
          <s-paragraph color="subdued" textAlign="center">
            {note}
          </s-paragraph>
        ) : null}
      </s-stack>
      {action}
    </s-stack>
  )
}

function StepConnector() {
  return (
    <s-box>
      <s-stack
        alignItems="center"
        justifyContent="center"
        blockSize="100%"
        display="@container (inline-size > 948px) auto, none"
      >
        <s-icon type="chevron-right" size="base" tone="neutral" />
      </s-stack>
      <s-stack
        alignItems="center"
        justifyContent="center"
        blockSize="100%"
        display="@container (inline-size > 948px) none, auto"
      >
        <s-icon type="chevron-down" size="base" tone="neutral" />
      </s-stack>
    </s-box>
  )
}
