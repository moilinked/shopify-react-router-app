import { useState } from 'react'
import { uploadImageToShopify } from '~/utils/upload'

interface ImageUploadFieldProps {
  value?: string
  label?: string
  disabled?: boolean
  readOnly?: boolean
  maxSizeMB?: number
  successMessage?: string
  invalidTypeMessage?: string
  previewAlt?: string
  onChange: (imageUrl: string) => void
  onUploadingChange?: (uploading: boolean) => void
}

export function ImageUploadField({
  value = '',
  label = '图片',
  disabled = false,
  readOnly = false,
  maxSizeMB = 5,
  successMessage = '图片上传成功',
  invalidTypeMessage = '请上传图片文件',
  previewAlt = '上传图片',
  onChange,
  onUploadingChange
}: ImageUploadFieldProps) {
  const [uploading, setUploading] = useState(false)

  const handleFileUpload = async (event: Event) => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]

    if (!file) return

    if (!file.type.startsWith('image/')) {
      shopify.toast.show(invalidTypeMessage, { isError: true })
      return
    }

    const maxFileSize = maxSizeMB * 1024 * 1024
    if (file.size > maxFileSize) {
      shopify.toast.show(`图片大小不能超过 ${maxSizeMB}MB`, { isError: true })
      return
    }

    setUploading(true)
    onUploadingChange?.(true)
    try {
      const imageUrl = await uploadImageToShopify(file)
      onChange(imageUrl)
      shopify.toast.show(successMessage)
    } catch (error) {
      console.error('上传图片失败:', error)
      shopify.toast.show(error instanceof Error ? error.message : '上传图片失败', { isError: true })
    } finally {
      setUploading(false)
      onUploadingChange?.(false)
      input.value = ''
    }
  }

  const isDisabled = disabled || uploading || readOnly

  return (
    <div style={{ position: 'relative' }}>
      <s-drop-zone
        name="file"
        label={label}
        accept="image/*"
        disabled={isDisabled || undefined}
        onChange={handleFileUpload}
      >
        {uploading && (
          <s-stack alignItems="center" justifyContent="center" padding="large">
            <s-spinner size="large" />
          </s-stack>
        )}
        {value && !uploading && <s-image src={value} alt={previewAlt} aspectRatio="50/50" inlineSize="auto" />}
      </s-drop-zone>

      {value && !uploading && !readOnly && (
        <div style={{ position: 'absolute', top: '-7px', right: '0' }}>
          <s-button icon="delete" variant="tertiary" onClick={() => onChange('')} accessibilityLabel="删除图片" />
        </div>
      )}
    </div>
  )
}
