# Waterdrop-Shopify-App — 项目规则(Claude Code 必读)

> 本文件是 agent 在本仓库工作的**强约束**。动手前先读完;**不要自由发挥**,优先复用既有组件/工具,遵循既有模式。
> 配套:`.cursor/`、`README.md`、`ShopifyApp-README.md`、`docs/`。

## 🚦 黄金规则(每次改动都要遵守)

1. **UI 必须优先用 Shopify Polaris Web Components(`<s-*>`)**,其次复用本仓库**已存在的公共组件**(见下表),最后才用 Tailwind 自绘。**不要引入新的 UI 组件库**。
   - **禁止**用原生 `<button>/<input>/<select>/<table>/<textarea>` + Tailwind 自绘基础控件——按钮/输入框/下拉/表格/弹窗/横幅/徽章一律用 `<s-button>/<s-text-field>/<s-select>/<s-table>/<s-modal>/<s-banner>/<s-badge>`;Tailwind 仅用于**布局细节微调**(间距、对齐、等宽数字、自定义小标记)和 Polaris 确无对应组件的场景(如 tabs、文件拖拽区,需注释说明)。
   - 即使是 mock/scaffold 阶段的页面也必须遵守(scaffold 不豁免)。提交前自查改动文件:出现原生基础控件即视为违规。
   - 页面骨架统一:`<s-page heading>` + slot 按钮(`primary-action`/`secondary-actions`)→ `<s-box padding="large">` → `<s-stack>` → `<s-section heading>`;弹窗用 `<s-modal ref>` + `showOverlay()/hideOverlay()`(参考 `app/pages/app/competitor/brands/index.tsx`)。
2. **改代码必须同步改文档**(`docs/` 下对应功能文档 + README)。
3. **改动涉及基础功能 / 重功能点 / 公共组件约定时,必须同步更新本 CLAUDE.md**。
4. **改完必须校验**:`pnpm exec eslint <改动文件>` 0 error;`pnpm exec tsc --noEmit` 改动文件无报错(typegen 偶因 `.react-router/types` 权限失败,可直接 `tsc --noEmit`;`activities/$id.tsx` 有一处既有报错,非你引入)。
5. **复用优先**:加组件/hook/util/service 前先 grep `app/components`、`app/hooks`、`app/utils`、`app/services`,有则复用。

## 项目概览

Shopify 内嵌 Admin 应用。**React Router v7(SSR)** + Shopify Polaris Web Components + TypeScript + Tailwind v4 + Zustand + ahooks。包管理 **pnpm**。功能:AI 替代文本、会员活动、竞品监控(展示)、Smile.io 积分。

## UI / 组件约定

- **第一优先 Polaris Web Components**:`<s-page> <s-section> <s-box> <s-stack> <s-table> <s-button> <s-badge> <s-text> <s-banner> <s-modal> <s-select> <s-option> <s-text-field> <s-text-area> <s-checkbox> <s-date-field> <s-link> <s-spinner>` 等。布局/间距优先用 Polaris 属性,细节微调才用 Tailwind。
- 涉及 Polaris 组件/属性不确定时,用 **Shopify MCP**(`shopify-dev-mcp`,已配 `POLARIS_UNIFIED`)查官方用法,不要臆造。
- **第二优先复用既有公共组件**:

| 公共能力                                  | 路径                                                         | 用途                                                                                                                |
| ----------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `EmptyState`                              | `app/components/EmptyState.tsx`                              | 空态                                                                                                                |
| `RetryErrorBanner`                        | `app/components/RetryErrorBanner.tsx`                        | 错误重试横幅                                                                                                        |
| `ImageUploadField`                        | `app/components/ImageUploadField.tsx`                        | 图片上传                                                                                                            |
| `SimpleMarkdown`                          | `app/components/SimpleMarkdown.tsx`                          | 零依赖 markdown 渲染(勿引入 markdown 库)                                                                            |
| `PageChangeCompareModal` + 导出工具       | `app/components/competitor/PageChangeCompareModal.tsx`       | 竞品对比弹窗;并导出 `formatStructuredValue`/`formatCompactValue`/`formatValue`/`FIELD_LABELS` 等,值展示统一复用这些 |
| 会员活动组件                              | `app/components/activities/*`                                | 活动表单/资源选择/富文本等                                                                                          |
| 替代文本组件                              | `app/components/alt-text/*`                                  | alt-text 弹窗/卡片                                                                                                  |
| `useLoading`                              | `app/hooks/useLoading.ts`                                    | 统一 loading + run(async)                                                                                           |
| `useCurrencySymbol` / `useResourcePicker` | `app/hooks/*`                                                | 币种符号 / 资源选择                                                                                                 |
| `http` 客户端                             | `app/utils/http.ts`                                          | 统一请求(自动注入 session token、错误 toast);**所有后端请求走它**,勿直接 fetch                                      |
| 其它 util                                 | `app/utils/{validation,upload,proxy.server,nestedRoutes}.ts` | 校验/上传/代理/路由约定                                                                                             |
| Zustand store                             | `app/stores/{useAppStore,useAltTextStore}.ts`                | 全局状态                                                                                                            |

## 路由约定(`app/utils/nestedRoutes.ts`,非默认 flatRoutes)

- `index.tsx`→ index;`layout.tsx`→ 布局(`<Outlet/>`);`$.tsx`→ `*`;`$param.tsx`→ `:param`;`_prefix/`→ pathless 布局;`.server.ts`/`.client.ts`→ 仅服务端/客户端,不作为路由。
- 页面放 `app/pages/...`;受保护页在 `app/pages/app/`。

## 数据 / 后端集成

- 业务接口走 `app/services/*`(如 `competitor.ts`、`activity.ts`、`product.ts`、`altText.ts`),内部用 `http` 客户端。
- 后端基址:本地 `http://localhost:3100/waterdrop-api`,生产 `https://shopify.waterdropfilter.com/waterdrop-api`;会员/积分类走 `rewardsBackendAPI`(见 `app/config/index.ts`)。响应约定 `{ code, message, data }`。
- 类型集中在 `app/types/*`(如 `app/types/competitor.ts`),新增字段/枚举在此维护并配 label map。
- Shopify GraphQL / OAuth 在 `app/shopify.server.ts`;Session 由 PrismaSessionStorage 存。
- **Prisma**:schema 迁移由 `Waterdrop-service` 统一负责,本仓库只 `prisma generate`,**不要在此建迁移**。

## 代码规范

- TS strict;`import type {...}`;ESLint(`pnpm lint`)+ Prettier(`pnpm format`)。
- React hooks 规则:hooks 必须在组件顶层、早返回之前调用。
- 安全:不要 `dangerouslySetInnerHTML` 注入外部内容(markdown 用 `SimpleMarkdown`)。
- 列表/分页/loading/空态/错误态都要处理;长列表注意性能。

## 文档同步(强制)

改动后同步对应文档:

- `docs/AI替代文本功能技术方案.md`(alt-text)、`docs/会员活动管理系统说明.md`(activities)、`docs/Prisma使用说明.md`、`docs/DEPLOY.md`、`docs/n8n/`。
- 竞品监控前端属 `Waterdrop-service` 的 `docs/竞品监控优化方案.md` / `竞品监控优化-变更清单.md` 范畴(标 `[前端]`)。
- README / ShopifyApp-README 的技术栈、结构、功能章节随之更新。

## Shopify MCP

已配 `.mcp.json`(`@shopify/dev-mcp`,启用 `POLARIS_UNIFIED`/`LIQUID`)。查 Polaris 组件、Admin/Storefront GraphQL、Liquid 时优先用它。
