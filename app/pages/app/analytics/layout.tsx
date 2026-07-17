import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import { analyticsApi } from '~/services/analytics'

const NAV_ITEMS = [
  { href: '/app/analytics', label: '报表' },
  { href: '/app/analytics/reports', label: '报告存档' },
  { href: '/app/analytics/maps', label: '口径管理' },
  { href: '/app/analytics/settings', label: '设置' }
]

export default function AnalyticsLayout() {
  const location = useLocation()
  const [unmatched, setUnmatched] = useState(0)

  useEffect(() => {
    analyticsApi
      .getCaliberSummary()
      .then((s) => setUnmatched(s.missingModel + s.ga4Unaligned + s.sourceMediums))
      .catch(() => {
        /* toasted */
      })
  }, [location.pathname])

  return (
    <div className="min-h-screen bg-[#f4f4f4]">
      <div className="grid grid-cols-1 gap-6 px-6 py-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="h-fit rounded-lg border border-[#d9d9d9] bg-white shadow-sm lg:sticky lg:top-5">
          <div className="border-b border-[#e3e3e3] px-4 py-4">
            <div className="text-sm font-semibold text-[#202223]">数据分析</div>
            <div className="mt-1 text-xs text-[#6d7175]">Shopify + GA4 报表与 AI 分析</div>
          </div>
          <nav className="space-y-1 p-3">
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === '/app/analytics'
                  ? location.pathname === item.href
                  : location.pathname === item.href || location.pathname.startsWith(`${item.href}/`)

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={[
                    'flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium no-underline transition-colors',
                    active ? 'bg-[#ebebeb] text-[#202223]' : 'text-[#4a4a4a] hover:bg-[#f1f1f1]'
                  ].join(' ')}
                >
                  {item.label}
                  {item.label === '口径管理' && unmatched > 0 && (
                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#b3261e] px-1 text-[10px] font-semibold text-white">
                      {unmatched}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>
        </aside>

        <main className="min-w-0 max-w-[1120px]">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
