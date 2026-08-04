import type { LoaderFunctionArgs } from 'react-router'
import { useLoaderData, useNavigate } from 'react-router'
import { authenticate } from '~/shopify.server'
import { getMemberDiscountFunctionId } from '~/services/memberDiscount.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request)
  const functionId = await getMemberDiscountFunctionId(admin)
  return { functionId }
}

export default function MemberDiscountIndex() {
  const { functionId } = useLoaderData<typeof loader>()
  const navigate = useNavigate()

  return (
    <s-page heading="会员 VIP 折扣（App）">
      <s-button
        slot="primary-action"
        variant="primary"
        disabled={!functionId || undefined}
        onClick={() => {
          if (!functionId) return
          navigate(`/app/member-discount/${encodeURIComponent(functionId)}/new`)
        }}
      >
        创建折扣
      </s-button>

      <s-box padding="large">
        <s-stack gap="base">
          <s-banner tone="info">
            本入口对应独立 Function「Member VIP Discount (App)」，配置页为 React Router App UI。
          </s-banner>
          <s-section heading="两套独立入口">
            <s-stack gap="small">
              <s-text>
                1. Function Settings：Admin → 折扣 → 创建 →「Member VIP Discount」（原生折扣页 + Settings 扩展）
              </s-text>
              <s-text>2. App UI：Admin → 折扣 → 创建 →「Member VIP Discount (App)」，或本页「创建折扣」</s-text>
              <s-text tone="neutral">
                两套 Function / 配置入口互不干扰，结账逻辑相同（VIP 等级固定金额产品折扣）。
              </s-text>
            </s-stack>
          </s-section>
          {!functionId ? (
            <s-banner tone="warning">
              未找到 App 版 Function，请确认 `member-discount-function-app` 已通过 `shopify app dev` 部署。
            </s-banner>
          ) : null}
        </s-stack>
      </s-box>
    </s-page>
  )
}
