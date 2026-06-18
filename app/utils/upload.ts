/**
 * 上传图片到 Shopify
 * @param file 要上传的文件
 * @returns 图片的 CDN URL
 */
export async function uploadImageToShopify(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch('/api/upload-image', {
    method: 'POST',
    body: formData
  })

  if (!response.ok) {
    const error = await response.json()
    // 显示更详细的错误信息
    const errorMsg = error.details ? `${error.error}: ${error.details}` : error.error || '上传图片失败'
    throw new Error(errorMsg)
  }

  const data = await response.json()
  return data.url
}
