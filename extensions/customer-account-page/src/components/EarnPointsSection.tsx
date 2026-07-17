import { useState } from 'preact/hooks'
import type { SmileEarningRule, Translate } from '../types'
import { formatEarningRulePoints, getPointsActivityRulesUrl, getSettings } from '../utils'

interface EarnPointsSectionProps {
  loading: boolean
  rules: SmileEarningRule[]
  vipTierName?: string | null
  currencyCode: string
  translate: Translate
}

interface EarnRuleDisplay {
  name: string
  titleKey: string
  ctaKey: string
}

const DEFAULT_COUNT = 6
const TIERED_RULE_PREFIXES = ['celebrate a birthday', 'place an order']
const HIDDEN_RULE_NAMES = ['signup']

const EARN_RULE_DISPLAYS: EarnRuleDisplay[] = [
  { name: 'Check In', titleKey: 'earn_checkInTitle', ctaKey: 'earn_checkInCta' },
  { name: 'Subscribe to Newsletter', titleKey: 'earn_newsletterTitle', ctaKey: 'earn_newsletterCta' },
  { name: 'Subscribe to SMS', titleKey: 'earn_smsTitle', ctaKey: 'earn_smsCta' },
  { name: 'Celebrate a birthday', titleKey: 'earn_birthdayTitle', ctaKey: 'earn_birthdayCta' },
  { name: 'Follow on TikTok', titleKey: 'earn_tiktokTitle', ctaKey: 'earn_tiktokCta' },
  { name: 'Follow on Instagram', titleKey: 'earn_instagramTitle', ctaKey: 'earn_instagramCta' },
  { name: 'Share on Facebook', titleKey: 'earn_facebookTitle', ctaKey: 'earn_facebookCta' },
  { name: 'Place an order', titleKey: 'earn_orderTitle', ctaKey: 'earn_orderCta' }
]

function resolveRuleDisplay(ruleName: string): EarnRuleDisplay | null {
  const lower = ruleName.toLowerCase()
  return EARN_RULE_DISPLAYS.find((display) => lower.startsWith(display.name.toLowerCase())) ?? null
}

function isTieredRule(ruleName: string): boolean {
  const lower = ruleName.toLowerCase()
  return TIERED_RULE_PREFIXES.some((prefix) => lower.startsWith(prefix))
}

function getTierSuffix(ruleName: string): string {
  const [, suffix] = ruleName.split(/\s+-\s+/, 2)
  return suffix ?? ''
}

function filterRulesByTier(rules: SmileEarningRule[], vipTierName?: string | null): SmileEarningRule[] {
  const visibleRules = rules.filter((rule) => !HIDDEN_RULE_NAMES.includes(rule.name.toLowerCase()))
  if (!vipTierName) return visibleRules

  const tierLower = vipTierName.toLowerCase()
  return visibleRules.filter((rule) => {
    if (!isTieredRule(rule.name)) return true
    return rule.name.toLowerCase().endsWith(tierLower)
  })
}

function getRuleTitle(
  rule: SmileEarningRule,
  display: EarnRuleDisplay | null,
  hasTierFilter: boolean,
  translate: Translate
) {
  if (!display) return rule.name

  const translatedTitle = translate(display.titleKey) as string
  if (hasTierFilter || !isTieredRule(rule.name)) return translatedTitle

  const suffix = getTierSuffix(rule.name)
  return suffix ? `${translatedTitle} - ${suffix}` : translatedTitle
}

export function EarnPointsSection({ loading, rules, vipTierName, currencyCode, translate }: EarnPointsSectionProps) {
  const [expanded, setExpanded] = useState<boolean>(false)
  const activityRulesHref = getPointsActivityRulesUrl(getSettings())
  const filteredRules = filterRulesByTier(rules, vipTierName)
  const visibleRules = expanded ? filteredRules : filteredRules.slice(0, DEFAULT_COUNT)
  const canToggle = filteredRules.length > DEFAULT_COUNT

  return (
    <s-stack direction="block" gap="base">
      <s-stack direction="inline" gap="small-300" alignItems="center">
        <s-box inlineSize="20px">
          <s-image
            src="https://cdn.shopify.com/s/files/1/0078/6156/7570/files/points-icon.png"
            alt="earn points icon"
            aspectRatio="1/1"
            objectFit="contain"
          />
        </s-box>
        <s-heading>{translate('earn_sectionTitle') as string}</s-heading>
      </s-stack>
      {loading ? (
        <s-grid gridTemplateColumns="@container (inline-size > 948px) 1fr 1fr, 1fr" gap="base">
          {Array.from({ length: DEFAULT_COUNT }).map((_, idx) => (
            <s-section key={idx}>
              <s-grid gridTemplateColumns="30px auto" gap="small-100" alignItems="center">
                <s-box inlineSize="30px">
                  <s-skeleton-paragraph content="icon" />
                </s-box>
                <s-stack
                  direction="@container (inline-size > 725px) inline, block"
                  gap="small-100"
                  alignItems="@container (inline-size > 725px) center, start"
                  justifyContent="@container (inline-size > 725px) space-between, start"
                >
                  <s-grid
                    gridTemplateColumns="@container (inline-size > 725px) auto, 1fr auto"
                    gap="small-400"
                    alignItems="center"
                    inlineSize="@container (inline-size > 725px) auto, 100%"
                  >
                    <s-skeleton-paragraph content="Earn points" />
                    <s-skeleton-paragraph content="100 Points" />
                  </s-grid>
                  <s-stack direction="inline" gap="small-400" alignItems="center">
                    <s-box inlineSize="96px">
                      <s-skeleton-paragraph content="Start earning" />
                    </s-box>
                  </s-stack>
                </s-stack>
              </s-grid>
            </s-section>
          ))}
        </s-grid>
      ) : filteredRules.length === 0 ? (
        <s-paragraph color="subdued">{translate('earn_empty') as string}</s-paragraph>
      ) : (
        <s-grid gridTemplateColumns="@container (inline-size > 948px) 1fr 1fr, 1fr" gap="base">
          {visibleRules.map((rule) => {
            const display = resolveRuleDisplay(rule.name)
            const title = getRuleTitle(rule, display, Boolean(vipTierName), translate)
            const cta = (display ? translate(display.ctaKey) : translate('earn_defaultCta')) as string
            const points = formatEarningRulePoints(rule.reward_value, currencyCode, translate)

            return (
              <s-section key={rule.id}>
                <s-grid gridTemplateColumns="30px auto" gap="small-100" alignItems="center">
                  {rule.image_url ? (
                    <s-image src={rule.image_url} alt={title} aspectRatio="1/1" objectFit="contain" />
                  ) : (
                    <s-icon type="gift-card" size="base" />
                  )}
                  <s-stack
                    direction="@container (inline-size > 725px) inline, block"
                    gap="small-100"
                    alignItems="@container (inline-size > 725px) center, start"
                    justifyContent="@container (inline-size > 725px) space-between, start"
                  >
                    <s-grid
                      gridTemplateColumns="@container (inline-size > 725px) auto, 1fr auto"
                      gap="small-400"
                      alignItems="center"
                      inlineSize="@container (inline-size > 725px) auto, 100%"
                    >
                      <s-text type="strong">{title}</s-text>
                      {points ? <s-text tone="critical">{points}</s-text> : null}
                    </s-grid>
                    <s-clickable href={activityRulesHref}>
                      <s-stack direction="inline" gap="small-400" alignItems="center">
                        <s-link>{cta}</s-link>
                        <s-icon type="arrow-right" size="small-200" tone="custom" />
                      </s-stack>
                    </s-clickable>
                  </s-stack>
                </s-grid>
              </s-section>
            )
          })}
        </s-grid>
      )}

      {canToggle ? (
        <s-stack direction="inline" alignItems="center" justifyContent="center">
          <s-button variant="secondary" onClick={() => setExpanded((value) => !value)}>
            <s-stack direction="inline" alignItems="center" gap="small-400">
              {expanded ? translate('viewLess') : translate('viewMore')}
              <s-icon type={expanded ? 'chevron-up' : 'chevron-down'} size="small" />
            </s-stack>
          </s-button>
        </s-stack>
      ) : null}
    </s-stack>
  )
}
