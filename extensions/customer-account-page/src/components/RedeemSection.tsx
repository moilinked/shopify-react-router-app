import { useState } from 'preact/hooks'
import type { SmilePointsProduct, Translate } from '../types'
import {
  formatNumber,
  formatPercentInt,
  getPointsPrice,
  getRedemptionDeepLink,
  getRedemptionProgress,
  getRewardsHomeUrl,
  getSettings
} from '../utils'

interface RedeemSectionProps {
  loading: boolean
  pointsBalance: number
  products: SmilePointsProduct[]
  translate: Translate
}

const DEFAULT_COUNT = 4

export function RedeemSection({ loading, pointsBalance, products, translate }: RedeemSectionProps) {
  const [expanded, setExpanded] = useState<boolean>(false)
  const visible = expanded ? products : products.slice(0, DEFAULT_COUNT)
  const canToggle = products.length > DEFAULT_COUNT
  const settings = getSettings()
  const redeemHomeHref = getRewardsHomeUrl(settings)
  return (
    <s-stack gap="base">
      <s-stack direction="inline" alignItems="center" justifyContent="space-between">
        <s-stack direction="inline" gap="small-300" alignItems="center">
          <s-box inlineSize="20px">
            <s-image
              src="https://cdn.shopify.com/s/files/1/0078/6156/7570/files/gift_icon_990f389d-f3c2-44d8-bf4e-5636f069abe1.png"
              alt="redeem icon"
              aspectRatio="1/1"
              objectFit="contain"
            />
          </s-box>
          <s-heading>{translate('redeem_sectionTitle') as string}</s-heading>
        </s-stack>
        <s-clickable href={redeemHomeHref}>
          <s-stack direction="inline" gap="small-400" alignItems="center">
            <s-text>{translate('redeem_redeemMore')}</s-text>
            <s-icon type="chevron-right" size="small-200" />
          </s-stack>
        </s-clickable>
      </s-stack>
      {loading ? (
        <s-grid
          gridTemplateColumns="@container (inline-size > 948px) 1fr 1fr 1fr 1fr, 1fr 1fr"
          gap="@container (inline-size > 948px) large-200, base"
        >
          {Array.from({ length: DEFAULT_COUNT }).map((_, idx) => (
            <s-section key={idx}>
              <s-stack direction="block" gap="@container (inline-size > 948px) large-200, base">
                <s-box background="subdued" borderRadius="base">
                  <s-image src="" alt="loading" aspectRatio="1/1" objectFit="contain" />
                </s-box>
                <s-skeleton-paragraph />
                <s-skeleton-paragraph />
                <s-skeleton-paragraph />
              </s-stack>
            </s-section>
          ))}
        </s-grid>
      ) : products.length === 0 ? (
        <s-paragraph color="subdued">{translate('loading')}</s-paragraph>
      ) : (
        <s-grid
          gridTemplateColumns="@container (inline-size > 948px) 1fr 1fr 1fr 1fr, 1fr 1fr"
          gap="@container (inline-size > 948px) large-200, base"
        >
          {visible.map((product) => (
            <RedeemCard key={product.id} product={product} pointsBalance={pointsBalance} translate={translate} />
          ))}
        </s-grid>
      )}

      {canToggle ? (
        <s-stack direction="inline" alignItems="center" justifyContent="center">
          <s-button variant="secondary" onClick={() => setExpanded((v) => !v)}>
            <s-stack direction="inline" alignItems="center" gap="small-400">
              {expanded ? translate('viewLess') : translate('viewMore')}
              <s-icon type={expanded ? 'chevron-up' : 'chevron-down'} size="small" tone="custom" />
            </s-stack>
          </s-button>
        </s-stack>
      ) : null}
    </s-stack>
  )
}

interface RedeemCardProps {
  product: SmilePointsProduct
  pointsBalance: number
  translate: Translate
}

function RedeemCard({ product, pointsBalance, translate }: RedeemCardProps) {
  const settings = getSettings()
  const price = getPointsPrice(product)
  const progress = getRedemptionProgress(pointsBalance, product)
  const percent = formatPercentInt(progress)
  const isReady = progress >= 1
  const remaining = Math.max(0, price - pointsBalance)
  const redeemHref = getRedemptionDeepLink(settings, product.id)

  const title = product.reward?.name || product.exchange_description
  const imageUrl = product.reward?.image_url || ''

  return (
    <s-section heading="">
      <s-stack
        direction="block"
        gap="@container (inline-size > 948px) large-200, base"
        blockSize="100%"
        justifyContent="space-between"
      >
        <s-stack direction="block" gap="@container (inline-size > 948px) large-200, base">
          <s-box>
            {imageUrl ? (
              <s-image src={imageUrl} alt={title} aspectRatio="1/1" objectFit="contain" inlineSize="fill" />
            ) : (
              <s-box inlineSize="100%" background="subdued" borderRadius="base">
                <s-stack direction="block" alignItems="center" justifyContent="center">
                  <s-icon type="gift-card" size="large" />
                </s-stack>
              </s-box>
            )}
          </s-box>

          <s-section>
            <s-stack direction="block" gap="small-300">
              <s-stack direction="block" gap="base">
                <s-box blockSize="38px">
                  <s-heading>{title}</s-heading>
                </s-box>
                <s-heading>{translate('redeem_pointsLabel', { points: formatNumber(price) })}</s-heading>
              </s-stack>
              <s-progress value={progress === 0 ? 0.01 : progress} accessibilityLabel={`${percent}%`} />
              <s-grid justifyContent="space-between" gridTemplateColumns="auto 34px" gap="small-200">
                <s-text color="subdued">
                  {isReady
                    ? translate('redeem_achieved')
                    : translate('redeem_earnMore', { points: formatNumber(remaining) })}
                </s-text>
                <s-stack direction="inline" justifyContent="end">
                  <s-text color="subdued">{percent}%</s-text>
                </s-stack>
              </s-grid>
            </s-stack>
          </s-section>
        </s-stack>
        {isReady ? (
          <s-button variant="primary" href={redeemHref} target="_blank" inlineSize="fill">
            {translate('redeem_redeem')}
          </s-button>
        ) : (
          <s-button variant="secondary" disabled inlineSize="fill">
            {translate('redeem_redeem')}
          </s-button>
        )}
      </s-stack>
    </s-section>
  )
}
