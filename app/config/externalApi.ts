/**
 * 非 Shopify 外部接口调用的总开关。
 *
 * 背景：本地开发时不希望依赖 / 触达任何外部第三方或自研后端
 * （Smile.io、n8n、Waterdrop 自研后端等），避免请求失败、超时或误写数据。
 *
 * 语义：
 * - 关闭时（默认：非 production 环境），所有外部 fetch 会被短路，
 *   直接返回安全的空 / 默认值，App 不报错也不发出真实网络请求。
 * - Shopify 相关调用（admin.graphql、staged upload、本 App 自身的 /api/* 接口）不受影响。
 *
 * 说明：此常量在客户端与服务端均会被执行，因此仅依赖会被打包器（Vite）
 * 内联的 `process.env.NODE_ENV`，不要在这里引用其它 `process.env.*`，
 * 否则浏览器端会因 `process` 未定义而报错。
 *
 * 如需在本地开发临时放行外部调用，把下面这行改为 `false` 即可。
 */
export const EXTERNAL_API_DISABLED = process.env.NODE_ENV !== 'production'
