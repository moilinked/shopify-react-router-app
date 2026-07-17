import type { NormalizedTier, ShopifyCustomerSummary, SmileCustomer, Translate } from '../types'
import { formatMoney, formatNumber, getSettings, getWaysToEarnUrl } from '../utils'
import { HOW_IT_WORKS_MODAL_ID, POINTS_ACTIVITIES_MODAL_ID } from './Modals'

interface ProfileSectionProps {
  loading: boolean
  customer: SmileCustomer | null
  shopifyCustomer: ShopifyCustomerSummary
  tiers: NormalizedTier[]
  currencyCode: string
  translate: Translate
}

export function ProfileSection(props: ProfileSectionProps) {
  const { loading, customer, shopifyCustomer, tiers, currencyCode, translate } = props

  const displayName = customer?.first_name || shopifyCustomer.first_name || shopifyCustomer.email || ''
  const email = shopifyCustomer.email || customer?.email || ''
  const pointsBalance = customer?.points_balance ?? 0

  const waysToEarnHref = getWaysToEarnUrl(getSettings())

  return (
    <s-stack direction="block" gap="large-200">
      <s-grid gridTemplateColumns="@container (inline-size > 725px)  1fr 1fr, 1fr" gap="large-200">
        <s-grid-item>
          <s-section>
            <s-stack direction="block" gap="base">
              {loading ? (
                <>
                  <s-skeleton-paragraph content="hello, user" />
                  <s-skeleton-paragraph content="user@example.com" />
                </>
              ) : (
                <>
                  <s-section>
                    <s-heading>{translate('hello', { name: displayName })}</s-heading>
                  </s-section>
                  {email ? (
                    <s-stack direction="inline" gap="small-400" alignItems="center">
                      <s-icon type="email" tone="neutral" size="small" />
                      <s-text>{email}</s-text>
                    </s-stack>
                  ) : null}
                </>
              )}
            </s-stack>
          </s-section>
        </s-grid-item>

        <s-grid-item>
          <s-section>
            <s-stack direction="block" gap="base">
              {loading ? (
                <s-skeleton-paragraph content="200 Points" />
              ) : (
                <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
                  <s-stack direction="inline" gap="small-200" alignItems="end">
                    <s-section>
                      <s-heading>{formatNumber(pointsBalance)}</s-heading>
                    </s-section>
                    <s-text type="small">{translate('profile_pointsSuffix')}</s-text>
                  </s-stack>
                  <s-clickable href={waysToEarnHref}>
                    <s-stack direction="inline" gap="small-400" alignItems="center">
                      <s-link>{translate('profile_viewWaysToEarn')}</s-link>
                      <s-icon type="arrow-right" size="small-200" tone="custom" />
                    </s-stack>
                  </s-clickable>
                </s-stack>
              )}

              <s-stack direction="inline" gap="large" alignItems="center">
                <s-clickable
                  command="--show"
                  commandFor={POINTS_ACTIVITIES_MODAL_ID}
                  accessibilityLabel={translate('profile_pointsActivities') as string}
                >
                  <s-stack direction="inline" gap="small-400" alignItems="center">
                    <s-text>{translate('profile_pointsActivities')}</s-text>
                    <s-icon type="chevron-right" size="small-200" />
                  </s-stack>
                </s-clickable>
                <s-clickable
                  command="--show"
                  commandFor={HOW_IT_WORKS_MODAL_ID}
                  accessibilityLabel={translate('profile_howItWorks') as string}
                >
                  <s-stack direction="inline" gap="small-400" alignItems="center">
                    <s-text>{translate('profile_howItWorks')}</s-text>
                    <s-icon type="chevron-right" size="small-200" />
                  </s-stack>
                </s-clickable>
              </s-stack>
            </s-stack>
          </s-section>
        </s-grid-item>
      </s-grid>

      <s-section>
        {loading ? (
          <s-stack direction="block" gap="small-200" blockSize="@container (inline-size > 725px) 103px, 218px">
            <s-skeleton-paragraph content="My tier Bronze" />
            <s-skeleton-paragraph content="Spend $600 More to Reach Silver" />
            <s-skeleton-paragraph />
          </s-stack>
        ) : (
          <TierTrack customer={customer} tiers={tiers} currencyCode={currencyCode} translate={translate} />
        )}
      </s-section>
    </s-stack>
  )
}

interface TierTrackProps {
  customer: SmileCustomer | null
  tiers: NormalizedTier[]
  currencyCode: string
  translate: Translate
}

function TierTrack({ customer, tiers, currencyCode, translate }: TierTrackProps) {
  const fallbackTier: NormalizedTier = {
    id: 0,
    name: 'Bronze',
    label: translate('profile_signUp') as string,
    milestone: 0,
    icon: ''
  }
  const allTiers = tiers.length > 0 ? tiers : [fallbackTier]
  const currentTierId = customer?.vip_status?.vip_tier_id ?? null
  const matchedIdx = currentTierId == null ? 0 : allTiers.findIndex((t) => t.id === currentTierId)
  const currentIdx = matchedIdx >= 0 ? matchedIdx : 0
  const currentTier = allTiers[currentIdx]
  const isTop = currentIdx === allTiers.length - 1
  const nextTier = isTop ? currentTier : allTiers[currentIdx + 1]

  const deltaRaw = customer?.vip_status?.delta_to_next_vip_tier
  const delta = deltaRaw != null ? Math.ceil(deltaRaw) : null

  let progressValue = isTop ? 1 : 0
  if (!isTop) {
    const start = currentTier.milestone
    const end = nextTier.milestone
    const span = end - start
    if (delta != null && span > 0) {
      progressValue = Math.max(0, Math.min(1, (span - delta) / span))
    }
  }

  return (
    <s-stack
      direction="@container (inline-size > 725px) 'inline', 'block'"
      gap="large-200"
      alignItems="@container (inline-size > 725px) 'center', 'start'"
      justifyContent="@container (inline-size > 725px) 'space-between', 'start'"
    >
      <s-box inlineSize="@container (inline-size > 725px) 231px, (inline-size > 948px) 400px, 100%">
        <s-stack direction="block" gap="small-300">
          <s-stack direction="inline" gap="small-300" alignItems="center" paddingBlockEnd="small-300">
            <s-heading>{currentTier.name}</s-heading>
            <s-badge tone="neutral">{translate('profile_myTier')}</s-badge>
          </s-stack>

          <s-paragraph>
            {isTop ? (
              translate('profile_topTierUnlocked')
            ) : delta != null ? (
              <>
                {translate('profile_spendMorePrefix')} <s-text type="strong">{formatMoney(delta, currencyCode)}</s-text>{' '}
                {translate('profile_spendMoreSuffix', { next: nextTier.name })}
              </>
            ) : (
              translate('profile_reachNext', {
                next: nextTier.name,
                amount: formatMoney(nextTier.milestone, currencyCode)
              })
            )}
          </s-paragraph>

          <s-progress
            value={progressValue === 0 ? 0.01 : progressValue}
            accessibilityLabel={translate('profile_progressLabel', { next: nextTier.name }) as string}
          />

          <s-stack direction="inline" alignItems="center" justifyContent="space-between">
            <s-text color="subdued">{isTop ? translate('profile_unlocked') : currentTier.label}</s-text>
            <s-text color="subdued">{isTop ? '' : nextTier.name}</s-text>
          </s-stack>
        </s-stack>
      </s-box>
      <s-box inlineSize="@container (inline-size > 725px) 432px, (inline-size > 948px) 486px, 100%">
        <s-scroll-box overflow="auto">
          <s-box inlineSize="@container (inline-size > 948px) 486px, 432px">
            <s-stack direction="inline" gap="@container (inline-size > 948px) base, small-400" alignItems="stretch">
              {allTiers.map((t, idx) => (
                <s-stack
                  key={t.id}
                  direction="inline"
                  gap="@container (inline-size > 948px) base, small-400"
                  alignItems="center"
                >
                  {idx > 0 ? <s-icon type="chevron-right" size="small" tone="neutral" /> : null}
                  <s-box inlineSize="90px" blockSize="100%">
                    <s-stack direction="block" gap="small-400" alignItems="center" blockSize="100%">
                      {t.icon ? (
                        <s-box inlineSize="40px">
                          <s-image
                            src={t.icon}
                            alt={t.name}
                            inlineSize="fill"
                            aspectRatio="40/53"
                            objectFit="contain"
                          />
                        </s-box>
                      ) : null}
                      <s-text type="strong">{t.name}</s-text>
                      <s-paragraph color="subdued" textAlign="center">
                        {t.label}
                      </s-paragraph>
                    </s-stack>
                  </s-box>
                </s-stack>
              ))}
            </s-stack>
          </s-box>
        </s-scroll-box>
      </s-box>
    </s-stack>
  )
}
