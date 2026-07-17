import { Fragment } from 'preact'
import { useState } from 'preact/hooks'
import { fetchLoyaltyTransactions } from '../api'
import type { SmilePointsTransaction, Translate } from '../types'
import { formatNumber, getSettings } from '../utils'

export const POINTS_ACTIVITIES_MODAL_ID = 'loyalty-points-activities-modal'
export const HOW_IT_WORKS_MODAL_ID = 'loyalty-how-it-works-modal'
export const HELP_FRIENDS_MODAL_ID = 'loyalty-help-friends-modal'

interface ModalsProps {
  translate: Translate
}

export function PointsActivitiesModal({ translate }: ModalsProps) {
  const [items, setItems] = useState<SmilePointsTransaction[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [initialized, setInitialized] = useState<boolean>(false)

  function handleShow() {
    if (!initialized && !loading) {
      void loadPage()
    }
  }

  async function loadPage(nextCursor?: string) {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchLoyaltyTransactions({ cursor: nextCursor, limit: 50 })
      setItems((prev) => (nextCursor ? [...prev, ...data.points_transactions] : data.points_transactions))
      setCursor(data.next_cursor)
      setInitialized(true)
    } catch (err) {
      console.error('[Loyalty] activities load failed', err)
      setError(err instanceof Error ? err.message : (translate('errorLoading') as string))
    } finally {
      setLoading(false)
    }
  }

  return (
    <s-modal
      id={POINTS_ACTIVITIES_MODAL_ID}
      heading={translate('activities_title') as string}
      size="large"
      onShow={handleShow}
    >
      <s-query-container>
        <s-stack direction="block" gap="base">
          {!initialized && loading ? (
            <s-stack direction="block" gap="small-200">
              <s-skeleton-paragraph />
              <s-skeleton-paragraph />
              <s-skeleton-paragraph />
              <s-skeleton-paragraph />
            </s-stack>
          ) : error ? (
            <s-banner tone="critical">{error}</s-banner>
          ) : items.length === 0 ? (
            <s-paragraph color="subdued">{translate('activities_empty')}</s-paragraph>
          ) : (
            <s-scroll-box overflow="auto hidden">
              <s-stack direction="block" gap="none">
                <s-box background="subdued" paddingInline="small-300">
                  <ActivityTableHeader translate={translate} />
                </s-box>
                {items.map((tx, index) => (
                  <s-box key={tx.id} background={index % 2 === 1 ? 'subdued' : undefined}>
                    <ActivityRow tx={tx} translate={translate} />
                  </s-box>
                ))}
              </s-stack>
            </s-scroll-box>
          )}

          {cursor && initialized ? (
            <s-stack direction="inline" justifyContent="center">
              <s-button variant="secondary" loading={loading} onClick={() => loadPage(cursor)}>
                {translate('activities_loadMore')}
              </s-button>
            </s-stack>
          ) : null}
        </s-stack>
      </s-query-container>
    </s-modal>
  )
}

function ActivityTableHeader({ translate }: { translate: Translate }) {
  return (
    <s-grid
      gridTemplateColumns="@container (inline-size > 579px) 160px 160px auto, 90px 90px auto"
      gap="none"
      alignItems="center"
    >
      <s-box paddingInline="small-300" paddingBlock="base">
        <s-text type="strong">{translate('activities_time')}</s-text>
      </s-box>
      <s-box paddingInline="small-300" paddingBlock="base">
        <s-text type="strong">{translate('activities_points')}</s-text>
      </s-box>
      <s-box paddingInline="small-300" paddingBlock="base">
        <s-text type="strong">{translate('activities_action')}</s-text>
      </s-box>
    </s-grid>
  )
}

function ActivityRow({ tx, translate }: { tx: SmilePointsTransaction; translate: Translate }) {
  const isPositive = tx.points_change >= 0
  const pointsText = isPositive
    ? (translate('activities_pointsEarned', { points: formatNumber(tx.points_change) }) as string)
    : (translate('activities_pointsRedeemed', { points: formatNumber(tx.points_change) }) as string)

  const dateText = formatActivityDate(tx.created_at)

  return (
    <s-grid
      gridTemplateColumns="@container (inline-size > 579px) 160px 160px auto, 90px 90px auto"
      gap="none"
      alignItems="center"
    >
      <s-box paddingInline="small-300" paddingBlock="base">
        <s-text>{dateText}</s-text>
      </s-box>
      <s-box paddingInline="small-300" paddingBlock="base">
        <s-text>{pointsText}</s-text>
      </s-box>
      <s-box paddingInline="small-300" paddingBlock="base">
        <s-text>{tx.description || pointsText}</s-text>
      </s-box>
    </s-grid>
  )
}

function formatActivityDate(value: string) {
  const date = new Date(value)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${day}/${month}/${year}   ${hours}:${minutes}`
}

export function HowItWorksModal({ translate }: ModalsProps) {
  const steps: Array<{ title: string; body: string; icon: string }> = [
    {
      title: translate('howItWorks_step1Title') as string,
      body: translate('howItWorks_step1Body') as string,
      icon: 'https://cdn.shopify.com/s/files/1/0078/6156/7570/files/user_icon_c87d8ffb-db49-4c5c-95c8-bd04fa7cf27b.png?v=1780562223'
    },
    {
      title: translate('howItWorks_step2Title') as string,
      body: translate('howItWorks_step2Body') as string,
      icon: 'https://cdn.shopify.com/s/files/1/0078/6156/7570/files/point-icon.png?v=1780562521'
    },
    {
      title: translate('howItWorks_step3Title') as string,
      body: translate('howItWorks_step3Body') as string,
      icon: 'https://cdn.shopify.com/s/files/1/0078/6156/7570/files/rewards-icon.png?v=1780562610'
    }
  ]

  return (
    <s-modal id={HOW_IT_WORKS_MODAL_ID} heading={translate('howItWorks_title') as string} size="large">
      <s-query-container>
        <s-grid
          gridTemplateColumns="@container (inline-size > 571px) 1fr auto 1fr auto 1fr, 1fr"
          gap="small-300"
          alignItems="center"
          justifyItems="center"
          paddingInline="base"
        >
          {steps.map((step, index) => (
            <Fragment key={step.title}>
              {index > 0 ? (
                <s-box>
                  <s-box display="@container (inline-size > 571px) auto, none">
                    <s-icon type="chevron-right" size="base" tone="neutral" />
                  </s-box>
                  <s-box display="@container (inline-size > 571px) none, auto">
                    <s-icon type="chevron-down" size="base" tone="neutral" />
                  </s-box>
                </s-box>
              ) : null}
              <s-stack
                direction="block"
                gap="small-300"
                blockSize="100%"
                alignItems="center"
                inlineSize="100%"
                paddingInline="large-100"
                paddingBlockEnd="@container (inline-size > 571px) large-300, none"
              >
                <s-box borderRadius="max" inlineSize="60px">
                  <s-image src={step.icon} alt={step.title} inlineSize="fill" aspectRatio="1 / 1" objectFit="contain" />
                </s-box>
                <s-heading>{step.title}</s-heading>
                <s-paragraph color="subdued" textAlign="center">
                  {step.body}
                </s-paragraph>
              </s-stack>
            </Fragment>
          ))}
        </s-grid>
      </s-query-container>
    </s-modal>
  )
}

export function HelpFriendsModal({ translate }: ModalsProps) {
  const settings = getSettings()
  const imageDesktop = settings.referralHelpPc
  const imageMobile = settings.referralHelpMb
  const alt = translate('referral_helpFriendsAlt') as string

  return (
    <s-modal id={HELP_FRIENDS_MODAL_ID} heading={translate('referral_helpFriendsTitle') as string} size="large-100">
      <s-query-container>
        <s-box display="@container (inline-size > 400px) block, none">
          <s-image src={imageDesktop} alt={alt} aspectRatio="918/552" inlineSize="fill" objectFit="contain" />
        </s-box>
        <s-box display="@container (inline-size > 400px) none, block">
          <s-image src={imageMobile} alt={alt} aspectRatio="333/492" inlineSize="fill" objectFit="contain" />
        </s-box>
      </s-query-container>
    </s-modal>
  )
}
