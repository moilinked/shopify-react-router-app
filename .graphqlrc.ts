import { ApiVersion } from '@shopify/shopify-app-react-router/server'
import { ApiType, shopifyApiProject } from '@shopify/api-codegen-preset'
import type { IGraphQLConfig } from 'graphql-config'

function getConfig() {
  const config: IGraphQLConfig = {
    projects: {
      default: shopifyApiProject({
        apiType: ApiType.Admin,
        apiVersion: ApiVersion.October25,
        documents: ['./app/**/*.{js,ts,jsx,tsx}', './app/.server/**/*.{js,ts,jsx,tsx}'],
        outputDir: './app/types'
      })
    }
  }

  return config
}

const config = getConfig()

export default config
