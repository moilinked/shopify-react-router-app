# 会员 VIP 产品折扣（Shopify Function）

基于 Smile 客户元字段 `smile.vip_tier_name` 的**产品折扣** Function，配合 Admin UI 配置「等级 → 固定金额」及适用产品、变体。

## 组成

| 扩展 | 路径 | 作用 |
| --- | --- | --- |
| Discount Function | `extensions/member-discount-function` | 结账时按 VIP 等级输出产品固定金额折扣 |
| Admin UI | `extensions/member-discount-ui` | `admin.discount-details.function-settings.render`，配置等级规则 |

API：统一 [Discount Function API](https://shopify.dev/docs/api/functions/latest/discount)（`cart.lines.discounts.generate.run`），非已废弃的 Product Discount API。

## 业务规则

1. 读取登录顾客元字段 `smile.vip_tier_name`（namespace=`smile`，key=`vip_tier_name`）。
2. 与折扣节点 metafield 配置比对（大小写不敏感）：
   - namespace: `$app`
   - key: `function-configuration`
3. 匹配到规则后，对命中适用范围的购物车 line 应用**固定金额产品折扣**（`productDiscountsAdd` + `fixedAmount`，`appliesToEachItem: false`）。
   - 未选产品或变体时，适用于全部商品。
   - 选择产品时，命中所选产品或变体。
4. 仅处理 `PRODUCT` discount class；运费 target 恒返回空操作。

### 配置 JSON 示例

```json
{
  "tiers": [
    { "tierName": "a", "amount": 10, "message": "VIP A -¥10" },
    { "tierName": "b", "amount": 20, "message": "VIP B -¥20" }
  ],
  "productIds": ["gid://shopify/Product/123", "gid://shopify/ProductVariant/456"]
}
```

当顾客 `smile.vip_tier_name = "a"` 时，命中适用范围的购物车商品合计减免 10（店铺货币单位）。

## 商家操作

1. Admin → **折扣** → 创建折扣 → 选择本 App 的 **Member VIP Discount**。
2. 折扣类型选**折扣码**或自动折扣均可；UI 会强制启用**产品折扣** class。
3. 在 Function Settings 中添加 VIP 等级规则（等级名需与 Smile 写入的 `vip_tier_name` 一致），并使用“选择产品或变体”配置适用范围后保存。
4. 顾客需登录且元字段有值，结账时才会命中。

## 本地开发

```bash
pnpm install
cd extensions/member-discount-function && pnpm test
shopify app dev
```

Function 单测：`extensions/member-discount-function/tests`（vitest + fixtures）。

## 相关文件

- Function 输入查询：`src/cart_lines_discounts_generate_run.graphql`
- Function 逻辑：`src/cart_lines_discounts_generate_run.ts`
- Admin UI：`extensions/member-discount-ui/src/DiscountFunctionSettings.tsx`
- App 声明：`shopify.app.toml` → `[discount.metafields.app.function-configuration]`
