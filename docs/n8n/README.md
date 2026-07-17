# n8n 工作流：Waterdrop Alt Text Generator

匹配本仓库 `app/services/n8n.server.ts` 派发格式 + `app/services/altText.jobs.server.ts::processCallback` 期望的回调格式的 n8n 工作流。**开箱即用**，导入后只需配置一个 OpenAI 凭证。

> 关联文档：[`../AI替代文本功能技术方案.md`](../AI替代文本功能技术方案.md) §6 n8n 工作流接入

---

## 快速开始（4 步）

1. **导入工作流**
   - n8n → Workflows → 右上 `⋯` → `Import from File`
   - 选择 [`waterdrop-alt-text.workflow.json`](./waterdrop-alt-text.workflow.json)

2. **创建 OpenAI 凭证**
   - n8n → Credentials → New → 搜 `OpenAI`
   - 填入 OpenAI API Key（[platform.openai.com](https://platform.openai.com/api-keys)）
   - 在 `OpenAI Vision (gpt-5.5)` 节点把 Credential 选为刚创建的那条

3. **激活工作流**
   - 右上角 `Active` 开关 → ON
   - 生产 Webhook URL 固定为：
     ```
     https://n8n.ecolifeglobal.cn:4443/webhook/waterdrop-alt-text
     ```
   - **App 端无需配置任何 env**：URL 已固化在 `app/config/altText.server.ts::N8N_PROD_WEBHOOK_URL`。如有调整 host/path 的需要，改这个常量即可。

4. **回调网络可达性**
   - 确认 n8n 容器/服务能访问 App 的回调地址（生产为 `https://shopify.waterdropfilter.com/webhooks/n8n/alt-text`，开发为 `https://<your-tunnel>.cloudflare-tunnel/webhooks/n8n/alt-text`）
   - 内网部署时网络互通即可，**v1 不做鉴权**

### 调试测试模式 webhook（可选）

n8n 工作流编辑器里点「Execute workflow」时，n8n 会监听 `/webhook-test/waterdrop-alt-text` 路径，**单次**生效。要让 App 临时打到这个测试 URL 上，可在 `.env.local` 设：

```bash
N8N_ALT_WEBHOOK_URL=https://n8n.ecolifeglobal.cn:4443/webhook-test/waterdrop-alt-text
```

env 优先级高于代码常量，留空或删行即恢复走生产 URL。

---

## 工作流拓扑

```
Webhook (POST /webhook/waterdrop-alt-text, 立即返回 200)
    ↓
Extract Payload (Set: 提取 jobId / shop / callbackUrl / language / promptOverride
                       / includeProductTitle / brand / keywords / items)
    ↓
Split Items (Split Out: 按 items 数组拆成 N 条)
    ↓
Concurrency Limit 5 (SplitInBatches: 每次 5 张并发)
    ↓ (loop)
OpenAI Vision (gpt-5.5)  ← 直接传 imageUrl，无需下载/编码 base64
    ↓
Format Result (Code: OpenAI 响应 → {itemId, status, altText|errorMessage, executionId})
    ↓
Aggregate Results (汇总成 results: [...])
    ↓
Callback to App (POST {callbackUrl} { jobId, results })
```

### 设计要点

| 关注点           | 实现                                                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **App 不等待**   | Webhook 节点 `responseMode: "onReceived"` → 收到请求立即返回 200，所有处理后台跑。配合 App 端 30s `AbortController`，整链路无阻塞。                                 |
| **图片传入**     | OpenAI Chat Completions API 的 `image_url.url` **直接接 URL**。Shopify CDN 公网可达，无需任何下载/上传/base64 节点。`detail: "low"` 足够 alt 任务用，可以省 token。 |
| **并发**         | `Concurrency Limit 5` 节点 batchSize=5，避免一次开太多 OpenAI 连接被限流。30 张图大约 6 轮，单图 1-3s，预计总耗时 < 30s。                                           |
| **错误隔离**     | OpenAI 节点 `continueOnFail: true` + `neverError: true`，单张失败不会中断整批。`Format Result` 把 HTTP 错 / 空内容统一映射成 `status: 'error'`。                    |
| **Prompt 覆盖**  | `promptOverride` 来自 App 的生成弹窗自定义 prompt；为 null 时用内置默认（与文档 §6.5 一致）。                                                                       |
| **多语言输出**   | OpenAI 节点 user prompt 注入 `Output language: ${language}`，并由规则 11 强制要求 alt 用该语言输出。`payload.language` 留空兜底 `'en'`。                            |
| **图片链接冗余** | OpenAI 节点除了 `image_url` 多模态项外，还把 `imageUrl` 写进 user prompt 文本（`Image URL: ...`）作为兜底/排障线索；模型仍主要看 `image_url` 项。                   |
| **携带商品标题** | OpenAI 节点同时校验 `payload.includeProductTitle === true` 且 `context.productTitle` 非空，才会注入产品标题，否则填 `'N/A'`，严格尊重生成弹窗的开关。               |
| **回调幂等**     | 每条 result 都带 `executionId`（n8n 执行 ID），App 端 `processCallback` 用 `WHERE status IN (GENERATING, PENDING)` 守卫，重复回调自动跳过。                         |

---

## 调用契约

### 入参（App → n8n）

```http
POST /webhook/waterdrop-alt-text
Content-Type: application/json
```

```json
{
  "jobId": "ckxxxxxxxxxxxxxxxxxxx",
  "shop": "waterdropde.myshopify.com",
  "callbackUrl": "https://shopify.waterdropfilter.com/webhooks/n8n/alt-text",
  "language": "en",
  "promptOverride": null,
  "includeProductTitle": true,
  "brand": "Waterdrop",
  "keywords": "water filter, reverse osmosis, RO, under-sink, countertop water filter, faucet",
  "items": [
    {
      "itemId": "ckitem_1",
      "imageUrl": "https://cdn.shopify.com/s/files/.../foo.jpg",
      "context": {
        "resourceType": "PRODUCT_IMAGE",
        "productTitle": "Waterdrop G3P800 RO 净水器"
      }
    },
    {
      "itemId": "ckitem_2",
      "imageUrl": "https://cdn.shopify.com/s/files/.../banner.png",
      "context": {
        "resourceType": "FILE_MEDIA_IMAGE"
      }
    }
  ]
}
```

字段一一对应 `app/services/n8n.server.ts::N8nDispatchPayload`。**单批最多 30 条**（App 端 `ALT_TEXT_BATCH_SIZE` 常量），超过会切多批多次 POST。

- `language` 来自生成弹窗"输出语言"下拉，n8n 会写进 user prompt `Output language` 字段并强制模型遵循
- `brand` / `keywords` 来自生成弹窗用户输入（brand 输入框默认值 `Waterdrop`，可改/可清；keywords 无系统默认），落库 `AltTextJob.brand / keywords`，单条 retry 时完整复用
- `includeProductTitle` 控制是否把 `context.productTitle` 注入 prompt，n8n 严格遵守此开关；OFF 时该字段为 `'N/A'`
- 上述字段都会以占位符形式渲染进 OpenAI user prompt（详见技术方案 §6.5）

### 回调（n8n → App）

```http
POST {callbackUrl}
Content-Type: application/json
```

```json
{
  "jobId": "ckxxxxxxxxxxxxxxxxxxx",
  "results": [
    {
      "itemId": "ckitem_1",
      "status": "ok",
      "altText": "Reverse osmosis water filter system on a wooden countertop",
      "executionId": "n8n-exec-12345"
    },
    {
      "itemId": "ckitem_2",
      "status": "error",
      "errorMessage": "Image inaccessible",
      "executionId": "n8n-exec-12345"
    }
  ]
}
```

字段对应 `app/services/altText.jobs.server.ts::N8nCallbackResult`。

**回调触发次数**：当前工作流里 `Concurrency Limit (5)`（SplitInBatches）只是控制「每次最多并行处理 5 张」；`Format Result` 处理完本批后会回到该节点继续下一批。**只有当本次 execution 里所有 item 都跑完**，才会走「完成」分支进入 `Aggregate Results` → `Callback to App`。因此对 **单次** App→n8n 的 webhook POST（例如 body 里最多 30 条），通常只会 **POST 一次** `/webhooks/n8n/alt-text`，`results` 里应尽量包含本 POST 对应的全部条目。若 App 对同一 job 发了多次 POST（多批 30），则会有多次 execution、多次回调。

---

## 关于模型选择

工作流默认 `model: "gpt-5.5"`。如有需要，到 `OpenAI Vision (gpt-5.5)` 节点的 `jsonBody` 把 `"model": "gpt-5.5"` 替换为：

| 模型           | 适用场景       | 备注                    |
| -------------- | -------------- | ----------------------- |
| `gpt-5.5`      | 默认，质量优先 | alt 任务体感最好        |
| `gpt-5.5-mini` | 成本优先       | 单图便宜约 5×，质量略降 |
| `gpt-4o`       | 兼容历史账号   | 已发布 1+ 年，稳定      |
| `gpt-4o-mini`  | 极致成本       | 适合 10w+ 图量级        |

**为什么直接传 URL 就够了？** OpenAI Vision API 服务端会自己抓取 `image_url.url`，无需提供 base64。Shopify CDN 是公网域名，且不需要鉴权。本工作流为此**省掉了**「下载图片 → base64 编码」两个节点，链路更短，n8n 内存消耗为 0。

---

## 故障排查

| 现象                                                              | 原因                                       | 处理                                                                                                     |
| ----------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| App 侧 `n8n dispatch timeout after 30000ms`                       | n8n 不可达 / 域名 DNS / SSL                | 在 App 服务器 `curl -I {N8N_ALT_WEBHOOK_URL}` 测试连通性                                                 |
| App 侧 `n8n dispatch failed: 404`                                 | Webhook URL 路径不对，或工作流未激活       | 在 n8n 工作流右上角检查 `Active` 是否 ON；确认 URL 是 `/webhook/`（生产）而不是 `/webhook-test/`（测试） |
| Items 一直 GENERATING 直到 30min 超时                             | 回调没回来：n8n → App 网络不通             | 在 n8n 执行历史看 `Callback to App` 节点是否成功；若失败查 `callbackUrl` 是否能从 n8n 容器访问           |
| 全部 results 都是 `errorMessage: "OpenAI returned empty content"` | OpenAI key 失效 / 模型名错 / 超 max_tokens | 检查 OpenAI 凭证；把 `max_completion_tokens` 调大；或换 `gpt-4o` 验证                                    |
| 回调成功但 App 侧 Item 仍 GENERATING                              | 多半是 jobId 或 itemId 串了                | 在 n8n 执行历史看 `Callback to App` 节点 body，对照 App 日志 `[alt-text-callback]`                       |

---

## v2 强化路线（与文档 §15 一致）

- **入口鉴权**：在 Webhook 节点加 `Header Auth` 凭证校验 `X-Auth-Token`；App 端 `dispatchToN8n` 同步带 header。
- **回调签名**：在 `Callback to App` 节点前用 Code 节点对 body 算 HMAC-SHA256 签名加到 `X-Signature` header；App 端用 `crypto.timingSafeEqual` 验签。
- **多模型可选**：从 webhook payload 里读 `model` 字段，由 App 生成弹窗暴露给用户选择。
- **重试**：替换为 n8n 内置的 `Retry On Fail`，OpenAI 偶发 429 自动重试 2 次。
