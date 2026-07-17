// @ts-ignore — side-effect import registers JSX intrinsics for Polaris web components
import '@shopify/ui-extensions/preact'
import { render } from 'preact'
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks'
import { fetchLoyaltyInit } from './api'
import type { LoyaltyInitData, NormalizedTier } from './types'
import { normalizeTiers } from './utils'
import { EarnPointsSection } from './components/EarnPointsSection'
import { HelpFriendsModal, HowItWorksModal, PointsActivitiesModal } from './components/Modals'
import { ProfileSection } from './components/ProfileSection'
import { RedeemSection } from './components/RedeemSection'
import { ReferralSection } from './components/ReferralSection'
import { SupportSection } from './components/SupportSection'

export default async () => {
  render(<LoyaltyHubExtension />, document.body)
}

function LoyaltyHubExtension() {
  const translate = shopify.i18n.translate
  const [data, setData] = useState<LoyaltyInitData | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const init = await fetchLoyaltyInit()
      setData(init)
    } catch (err) {
      console.error('[Loyalty] init load failed', err)
      setError(err instanceof Error ? err.message : (translate('errorLoading') as string))
    } finally {
      setLoading(false)
    }
  }, [translate])

  useEffect(() => {
    void load()
  }, [load])

  const tiers: NormalizedTier[] = useMemo(() => {
    if (!data) return []
    return normalizeTiers(data.vip_tiers, data.currencyCode, translate)
  }, [data, translate])

  const currentVipTierName = useMemo(() => {
    if (!data?.customer?.vip_status?.vip_tier_id) return null
    return data.vip_tiers.find((tier) => tier.id === data.customer?.vip_status?.vip_tier_id)?.name ?? null
  }, [data])

  return (
    <s-stack gap="large-200">
      <s-query-container>
        <s-box padding="small-400 none large-300 none">
          <s-heading>{translate('pageHeading') as string}</s-heading>
        </s-box>
        <s-stack direction="block" gap="large-200">
          {error ? (
            <s-banner tone="critical" dismissible>
              <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
                <s-text>{error}</s-text>
                <s-button variant="secondary" onClick={() => void load()}>
                  {translate('retry')}
                </s-button>
              </s-stack>
            </s-banner>
          ) : null}

          <ProfileSection
            loading={loading}
            customer={data?.customer ?? null}
            shopifyCustomer={data?.shopify_customer ?? { email: null, first_name: null, last_name: null }}
            tiers={tiers}
            currencyCode={data?.currencyCode ?? 'USD'}
            translate={translate}
          />

          <RedeemSection
            loading={loading}
            pointsBalance={data?.customer?.points_balance ?? 0}
            products={data?.points_products ?? []}
            translate={translate}
          />

          <ReferralSection
            loading={loading}
            customer={data?.customer ?? null}
            currencyCode={data?.currencyCode ?? 'USD'}
            translate={translate}
          />

          <EarnPointsSection
            loading={loading}
            rules={data?.earning_rules ?? []}
            vipTierName={currentVipTierName}
            currencyCode={data?.currencyCode ?? 'USD'}
            translate={translate}
          />

          <SupportSection translate={translate} />
        </s-stack>
        <PointsActivitiesModal translate={translate} />
        <HowItWorksModal translate={translate} />
        <HelpFriendsModal translate={translate} />
      </s-query-container>
    </s-stack>
  )
}
