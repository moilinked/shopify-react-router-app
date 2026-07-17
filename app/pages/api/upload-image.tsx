import type { ActionFunctionArgs } from 'react-router'
import { authenticate } from '~/shopify.server'
import logger from '~/lib/logger.server'

const FILE_CREATE_MUTATION = `#graphql
  mutation fileCreate($files: [FileCreateInput!]!) {
    fileCreate(files: $files) {
      files {
        id
        alt
        createdAt
      }
      userErrors {
        field
        message
      }
    }
  }
`

const FILE_QUERY = `#graphql
  query getFile($id: ID!) {
    node(id: $id) {
      ... on MediaImage {
        id
        fileStatus
        image {
          url
        }
      }
    }
  }
`

const MAX_POLL_ATTEMPTS = 10
const POLL_INTERVAL_MS = 1000

async function pollForFileReady(
  admin: Awaited<ReturnType<typeof authenticate.admin>>['admin'],
  fileId: string
): Promise<string | null> {
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    const response = await admin.graphql(FILE_QUERY, {
      variables: { id: fileId }
    })
    const data = await response.json()
    const node = data.data?.node
    if (node?.fileStatus === 'READY' && node?.image?.url) {
      return node.image.url
    }
    if (node?.fileStatus === 'FAILED') {
      return null
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }
  return null
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request)
  const log = logger.child({ module: 'upload-image', shop: session.shop, path: new URL(request.url).pathname })

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      log.warn('Upload image request missing file')
      return Response.json({ error: '没有上传文件' }, { status: 400 })
    }
    log.info({ fileName: file.name, mimeType: file.type, fileSize: file.size }, 'Upload image started')

    // 步骤一：创建临时上传
    const stagedUploadResponse = await admin.graphql(
      `#graphql
      mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets {
            url
            resourceUrl
            parameters {
              name
              value
            }
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          input: [
            {
              resource: 'IMAGE',
              filename: file.name,
              mimeType: file.type,
              httpMethod: 'POST'
            }
          ]
        }
      }
    )

    const stagedUploadData = await stagedUploadResponse.json()

    if (stagedUploadData.data.stagedUploadsCreate.userErrors.length > 0) {
      log.warn({ errors: stagedUploadData.data.stagedUploadsCreate.userErrors }, 'Staged upload creation failed')
      return Response.json({ error: stagedUploadData.data.stagedUploadsCreate.userErrors[0].message }, { status: 400 })
    }

    const target = stagedUploadData.data.stagedUploadsCreate.stagedTargets[0]

    // 步骤二：上传文件到 Shopify CDN
    const uploadFormData = new FormData()
    target.parameters.forEach(({ name, value }: { name: string; value: string }) => {
      uploadFormData.append(name, value)
    })
    uploadFormData.append('file', file)

    const uploadResponse = await fetch(target.url, {
      method: 'POST',
      body: uploadFormData
    })

    if (!uploadResponse.ok) {
      log.error({ status: uploadResponse.status }, 'Upload to Shopify CDN failed')
      return Response.json({ error: '上传文件到 Shopify 失败' }, { status: 500 })
    }

    // 步骤三：注册为永久文件 via fileCreate
    const fileCreateResponse = await admin.graphql(FILE_CREATE_MUTATION, {
      variables: {
        files: [
          {
            alt: file.name,
            contentType: 'IMAGE',
            originalSource: target.resourceUrl
          }
        ]
      }
    })

    const fileCreateData = await fileCreateResponse.json()

    if (fileCreateData.data.fileCreate.userErrors.length > 0) {
      log.warn({ errors: fileCreateData.data.fileCreate.userErrors }, 'fileCreate failed')
      return Response.json({ error: fileCreateData.data.fileCreate.userErrors[0].message }, { status: 500 })
    }

    const createdFile = fileCreateData.data.fileCreate.files[0]
    log.info({ fileId: createdFile.id }, 'fileCreate succeeded, polling for permanent URL')

    // 步骤四：轮询直到图片处理完成并永久 URL 可用
    const permanentUrl = await pollForFileReady(admin, createdFile.id)

    if (!permanentUrl) {
      log.error({ fileId: createdFile.id }, 'File processing timed out or failed')
      return Response.json({ error: '图片处理超时或失败' }, { status: 500 })
    }

    log.info({ url: permanentUrl }, 'Upload image completed with permanent URL')
    return Response.json({ url: permanentUrl })
  } catch (error) {
    log.error({ err: error }, 'Upload image failed')
    const errorMessage = error instanceof Error ? error.message : '上传图片失败'
    return Response.json({ error: '上传图片失败', details: errorMessage }, { status: 500 })
  }
}
