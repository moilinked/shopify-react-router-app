import { Link, Outlet, useLocation } from 'react-router'

const NAV_ITEMS = [
  { href: '/app/competitor', label: '概览' },
  { href: '/app/competitor/brands', label: '竞品管理' },
  { href: '/app/competitor/runs', label: '运行历史' },
  { href: '/app/competitor/change-logs', label: '变化洞察' },
  // 周报列表入口按运营要求暂隐藏(页面与生成能力保留,可经运行详情「查看周报」或直达 URL 使用)
  // { href: '/app/competitor/reports', label: '周报列表' },
  { href: '/app/competitor/settings', label: '调度设置' }
]

export default function CompetitorLayout() {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-[#f4f4f4]">
      <div className="grid grid-cols-1 gap-6 px-6 py-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="h-fit rounded-lg border border-[#d9d9d9] bg-white shadow-sm lg:sticky lg:top-5">
          <div className="border-b border-[#e3e3e3] px-4 py-4">
            <div className="text-sm font-semibold text-[#202223]">竞品监控</div>
            <div className="mt-1 text-xs text-[#6d7175]">经营变化、抓取任务和周报</div>
          </div>
          <nav className="space-y-1 p-3">
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === '/app/competitor'
                  ? location.pathname === item.href
                  : location.pathname === item.href || location.pathname.startsWith(`${item.href}/`)

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={[
                    'block rounded-md px-3 py-2 text-sm font-medium no-underline transition-colors',
                    active ? 'bg-[#ebebeb] text-[#202223]' : 'text-[#4a4a4a] hover:bg-[#f1f1f1]'
                  ].join(' ')}
                >
                  {item.label}
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
