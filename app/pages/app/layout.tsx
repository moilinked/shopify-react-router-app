import type { HeadersFunction, LoaderFunctionArgs } from 'react-router'
import { Outlet, useLoaderData, useRouteError } from 'react-router'
import { NavMenu } from '@shopify/app-bridge-react'
import { AppProvider } from '@shopify/shopify-app-react-router/react'
import { boundary } from '@shopify/shopify-app-react-router/server'

import { authenticate } from '~/shopify.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request)

  return { apiKey: process.env.SHOPIFY_API_KEY || '' }
}

export default function AppLayout() {
  const { apiKey } = useLoaderData<typeof loader>()

  return (
    <AppProvider embedded apiKey={apiKey}>
      <NavMenu>
        <a href="/app" rel="home">
          Home
        </a>
      </NavMenu>
      <Outlet />
    </AppProvider>
  )
}

export function ErrorBoundary() {
  return boundary.error(useRouteError())
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs)
