/**
 * AI 替代文本（Alt Text）功能配置
 * 详细设计见 docs/AI替代文本功能技术方案.md
 *
 * 仅服务端使用，不要在客户端 bundle 中引用。
 */

// ── 调优常量（不需要按环境变化，统一写在这里） ──────────────

/** 一次推送给 n8n 的图片数量 */
export const ALT_TEXT_BATCH_SIZE = 30

/** Job 超时时间（分钟），超过则标记 Item 为 FAILED */
export const ALT_TEXT_JOB_TIMEOUT_MIN = 30

/** Shopify fileUpdate 单批最大数量 */
export const FILE_UPDATE_BATCH_SIZE = 50

/** 批次间睡眠（避免触发 Shopify GraphQL 限流） */
export const FILE_UPDATE_BATCH_SLEEP_MS = 250

/** n8n dispatch HTTP 超时（毫秒）。超过则中断 fetch 并把整批 item 标 FAILED */
export const N8N_DISPATCH_TIMEOUT_MS = 30_000

// brand / keywords 都由用户在生成弹窗输入并落库到 AltTextJob，后端不再维护服务端默认值。
// brand 输入框初始值 = `~/types/altText::DEFAULT_BRAND_NAME`，仅前端 UI 占位用。

// ── n8n（v1 仅 URL，v2 再加鉴权） ────────────────────────

/**
 * n8n 生产 webhook URL（工作流处于 Active 状态时使用）。
 * 仓库部署形态固定为内部店铺 App，所以直接以代码常量维护。
 *
 * 临时切到测试模式（n8n Editor 点 "Execute workflow" 后单次生效）时，
 * 可在 `.env.local` 设置 `N8N_ALT_WEBHOOK_URL=https://.../webhook-test/...`
 * override 当前常量。**注意：测试 URL 不要硬编码进代码**（一次性，且属临时调试）。
 *
 * v2 接入鉴权后，URL 不再是 secret，到时把这个常量提到 docs/常量都行。
 */
const N8N_PROD_WEBHOOK_URL = 'https://n8n.ecolifeglobal.cn:4443/webhook/waterdrop-alt-text'

export const ALT_TEXT_N8N = {
  webhookUrl: N8N_PROD_WEBHOOK_URL
} as const

// ── 支持的语言（统一来源放在 ~/types/altText 以便前后端共享） ──

export {
  ALT_TEXT_DEFAULT_LANG,
  SUPPORTED_LANGUAGES,
  isSupportedLanguage,
  type SupportedLanguage
} from '~/types/altText'
