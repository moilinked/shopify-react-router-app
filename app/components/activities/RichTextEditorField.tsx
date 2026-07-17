import { useEffect, useMemo, useRef, useState } from 'react'
import type { IDomEditor, IEditorConfig, IToolbarConfig } from '@wangeditor/editor'

interface RichTextEditorFieldProps {
  label: string
  value: string
  required?: boolean
  placeholder?: string
  disabled?: boolean
  error?: string
  onChange: (value: string) => void
}

const toolbarConfig: Partial<IToolbarConfig> = {
  toolbarKeys: ['bold', 'underline', 'italic', 'bulletedList', 'numberedList']
}

export function RichTextEditorField({
  label,
  value,
  required,
  placeholder,
  disabled,
  error,
  onChange
}: RichTextEditorFieldProps) {
  const toolbarContainerRef = useRef<HTMLDivElement | null>(null)
  const editorContainerRef = useRef<HTMLDivElement | null>(null)
  const editorRef = useRef<IDomEditor | null>(null)
  const latestOnChangeRef = useRef(onChange)
  const disabledRef = useRef(disabled)
  const lastHtmlRef = useRef(value || '')
  const [editorReady, setEditorReady] = useState(false)
  const [editorLoadFailed, setEditorLoadFailed] = useState(false)

  const editorConfig = useMemo<Partial<IEditorConfig>>(
    () => ({
      placeholder,
      hoverbarKeys: {
        text: {
          menuKeys: []
        }
      }
    }),
    [placeholder]
  )

  useEffect(() => {
    latestOnChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    disabledRef.current = disabled
  }, [disabled])

  useEffect(() => {
    let disposed = false
    let currentEditor: IDomEditor | null = null
    setEditorReady(false)
    setEditorLoadFailed(false)

    void import('@wangeditor/editor')
      .then(({ createEditor, createToolbar }) => {
        if (disposed || !editorContainerRef.current || !toolbarContainerRef.current) return

        currentEditor = createEditor({
          selector: editorContainerRef.current,
          config: {
            ...editorConfig,
            onChange: (nextEditor) => {
              const html = nextEditor.getHtml()
              lastHtmlRef.current = html
              latestOnChangeRef.current(html)
            }
          },
          html: lastHtmlRef.current,
          mode: 'default'
        })
        editorRef.current = currentEditor

        createToolbar({
          editor: currentEditor,
          selector: toolbarContainerRef.current,
          config: toolbarConfig,
          mode: 'default'
        })

        if (disabledRef.current) {
          currentEditor.disable()
        }

        setEditorReady(true)
      })
      .catch(() => {
        if (!disposed) {
          setEditorLoadFailed(true)
        }
      })

    return () => {
      disposed = true
      currentEditor?.destroy()
      if (editorRef.current === currentEditor) {
        editorRef.current = null
      }
    }
  }, [editorConfig])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return

    if (disabled) {
      editor.disable()
    } else {
      editor.enable()
    }
  }, [disabled])

  useEffect(() => {
    const editor = editorRef.current
    const nextHtml = value || ''

    if (!editor) {
      lastHtmlRef.current = nextHtml
      return
    }

    if (nextHtml === lastHtmlRef.current) return

    editor.setHtml(nextHtml)
    lastHtmlRef.current = nextHtml
  }, [value])

  const handleFallbackInput = (event: Event) => {
    onChange((event.target as HTMLTextAreaElement).value)
  }

  return (
    <s-stack gap="small-300">
      <s-text>
        {label}
        {required && <s-text tone="critical"> *</s-text>}
      </s-text>

      {(!editorReady || editorLoadFailed) && (
        <s-text-area
          label={label}
          labelAccessibilityVisibility="exclusive"
          value={value}
          required={required}
          rows={3}
          placeholder={placeholder}
          disabled={disabled || undefined}
          error={error}
          onInput={handleFallbackInput}
        />
      )}

      {!editorLoadFailed && (
        <div
          className={`rich-text-editor-field${error ? ' rich-text-editor-field--error' : ''}${disabled ? ' rich-text-editor-field--disabled' : ''}`}
          hidden={!editorReady}
        >
          <div ref={toolbarContainerRef} />
          <div ref={editorContainerRef} />
        </div>
      )}

      {error && <s-text tone="critical">{error}</s-text>}
    </s-stack>
  )
}
