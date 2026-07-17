import { useEffect } from 'react'
import type { HeadersFunction, LoaderFunctionArgs } from 'react-router'
import { Outlet, useLoaderData, useLocation, useRouteError } from 'react-router'
import { NavMenu } from '@shopify/app-bridge-react'
import { boundary } from '@shopify/shopify-app-react-router/server'
import { AppProvider } from '@shopify/shopify-app-react-router/react'

import { authenticate } from '~/shopify.server'
import { useAppStore } from '~/stores/useAppStore'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request)

  const response = await admin.graphql(`
    query {
      shop {
        currencyCode
        ianaTimezone
      }
    }
  `)
  const { data } = await response.json()
  const currencyCode: string = data?.shop?.currencyCode ?? 'USD'
  const ianaTimezone: string = data?.shop?.ianaTimezone ?? 'UTC'

  return { apiKey: process.env.SHOPIFY_API_KEY || '', shop: session.shop, currencyCode, ianaTimezone }
}

export default function App() {
  const { apiKey, shop, currencyCode, ianaTimezone } = useLoaderData<typeof loader>()
  const location = useLocation()
  const setShop = useAppStore((s) => s.setShop)
  const setCurrencyCode = useAppStore((s) => s.setCurrencyCode)
  const setIanaTimezone = useAppStore((s) => s.setIanaTimezone)

  useEffect(() => {
    setShop(shop)
    setCurrencyCode(currencyCode)
    setIanaTimezone(ianaTimezone)
  }, [shop, currencyCode, ianaTimezone, setShop, setCurrencyCode, setIanaTimezone])

  return (
    <AppProvider embedded apiKey={apiKey}>
      <NavMenu key={location.pathname}>
        <a href="/app" rel="home">
          Home
        </a>
        <a href="/app/alt-text">AI 替代文本</a>
        <a href="/app/competitor">竞品监控</a>
        <a href="/app/analytics">数据分析</a>
        {/* <a href="/app/activities">会员活动管理</a> */}
      </NavMenu>
      <Outlet />
    </AppProvider>
  )
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError())
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs)
