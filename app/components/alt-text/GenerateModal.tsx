import { useEffect, useRef, useState } from 'react'
import { ALT_TEXT_DEFAULT_LANG, DEFAULT_BRAND_NAME, SUPPORTED_LANGUAGES } from '~/types/altText'

export interface GenerateModalSubmit {
  language: string
  prompt: string | null
  /** 用户在输入框填写的品牌名（输入框默认 Waterdrop，可改/可清；trim 后空串则为 null） */
  brand: string | null
  /** 本批 SEO 关键词（无系统默认值；trim 后空串则为 null） */
  keywords: string | null
  includeProductTitle: boolean
}

interface Props {
  open: boolean
  count: number
  submitting: boolean
  onClose: () => void
  onSubmit: (v: GenerateModalSubmit) => void
}

/**
 * 生成参数 Modal：自定义 prompt + 输出语言 + 是否带产品 title。
 *
 * 注意：`SUPPORTED_LANGUAGES` 来自 `~/types/altText`，前后端共享。
 */
export function GenerateModal({ open, count, submitting, onClose, onSubmit }: Props) {
  const ref = useRef<any>(null)
  const [language, setLanguage] = useState<string>(ALT_TEXT_DEFAULT_LANG)
  const [includeProductTitle, setIncludeProductTitle] = useState(true)
  const [prompt, setPrompt] = useState('')
  const [brand, setBrand] = useState(DEFAULT_BRAND_NAME)
  const [keywords, setKeywords] = useState('')

  useEffect(() => {
    if (open) ref.current?.showOverlay?.()
    else ref.current?.hideOverlay?.()
  }, [open])

  // 用户用 ESC / 点遮罩 / 右上角 X 关闭时，<s-modal> 内部已 hide，但父组件 open 还是 true。
  // 必须把这种"内部 close"回传父组件，否则下次再点"生成 ALT"按钮 setOpen(true) 不会变化，
  // useEffect 不会重跑 → showOverlay 不被调用 → 弹窗打不开。
  // 兼容不同版本 polaris web-components 的事件名。
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handler = () => onClose()
    el.addEventListener('close', handler)
    el.addEventListener('hide', handler)
    el.addEventListener('cancel', handler)
    return () => {
      el.removeEventListener('close', handler)
      el.removeEventListener('hide', handler)
      el.removeEventListener('cancel', handler)
    }
  }, [onClose])

  const handleSubmit = () => {
    onSubmit({
      language,
      prompt: prompt.trim() ? prompt.trim() : null,
      brand: brand.trim() ? brand.trim() : null,
      keywords: keywords.trim() ? keywords.trim() : null,
      includeProductTitle
    })
  }

  return (
    <s-modal ref={ref} id="alt-text-generate-modal" heading="生成 ALT 文本">
      <s-stack direction="block" gap="base">
        <s-banner tone="info">
          将为已选中的 <s-text type="strong">{count}</s-text> 张图片生成 ALT。 生成后需在审核页二次确认才会写入
          Shopify。
        </s-banner>

        <s-select
          label="输出语言"
          value={language}
          onChange={(e: Event) => setLanguage((e.target as HTMLSelectElement).value)}
        >
          {SUPPORTED_LANGUAGES.map((l) => (
            <s-option key={l.value} value={l.value}>
              {l.label}
            </s-option>
          ))}
        </s-select>

        <s-checkbox
          label="将商品标题作为上下文一并发送"
          checked={includeProductTitle || undefined}
          onChange={(e: Event) => setIncludeProductTitle((e.target as HTMLInputElement).checked)}
        />

        <s-text-field
          label="品牌名"
          value={brand}
          placeholder="例如：Waterdrop"
          onInput={(e: Event) => setBrand((e.target as HTMLInputElement).value)}
        />

        <s-text-field
          label="本批 SEO 关键词"
          value={keywords}
          placeholder="多个关键词用英文逗号分隔，例如：reverse osmosis, under-sink"
          onInput={(e: Event) => setKeywords((e.target as HTMLInputElement).value)}
        />

        <s-text-area
          label="自定义系统提示词（选填）"
          rows={4}
          value={prompt}
          placeholder="留空将使用 n8n 默认 SEO/可访问性提示词模板（推荐保持默认）"
          onInput={(e: Event) => setPrompt((e.target as HTMLInputElement).value)}
        />
      </s-stack>

      <s-button
        slot="primary-action"
        variant="primary"
        onClick={handleSubmit}
        disabled={submitting || count === 0 || undefined}
      >
        {submitting ? '提交中…' : `开始生成（${count}）`}
      </s-button>
      <s-button slot="secondary-actions" variant="secondary" onClick={onClose} disabled={submitting || undefined}>
        取消
      </s-button>
    </s-modal>
  )
}
