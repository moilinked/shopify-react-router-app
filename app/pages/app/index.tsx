import type { HeadersFunction, LoaderFunctionArgs } from 'react-router'
import { boundary } from '@shopify/shopify-app-react-router/server'

import { authenticate } from '~/shopify.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request)

  return null
}

export default function AppIndex() {
  return (
    <s-page heading="Waterdrop App Dev">
      <s-section heading="Ready">
        <s-paragraph>The app shell is ready for new features.</s-paragraph>
      </s-section>
    </s-page>
  )
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs)
