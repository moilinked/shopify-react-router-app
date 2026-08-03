import { Link, Outlet, useLocation } from 'react-router'

// Polaris 无侧栏路由切换组件，沿用 analytics/competitor 的 Tailwind 侧栏模式
const NAV_ITEMS = [
  { href: '/app/machine-subscribe', label: '虚拟产品列表' },
  { href: '/app/machine-subscribe/sales', label: '销售数据' }
]

export default function MachineSubscribeLayout() {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-[#f4f4f4]">
      <div className="grid grid-cols-1 gap-6 px-6 py-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="h-fit rounded-lg border border-[#d9d9d9] bg-white shadow-sm lg:sticky lg:top-5">
          <div className="border-b border-[#e3e3e3] px-4 py-4">
            <div className="text-sm font-semibold text-[#202223]">整机订购省</div>
            <div className="mt-1 text-xs text-[#6d7175]">虚拟滤芯产品与销售数据</div>
          </div>
          <nav className="space-y-1 p-3">
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === '/app/machine-subscribe'
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
