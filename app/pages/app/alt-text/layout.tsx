import { Outlet } from 'react-router'

/**
 * AI 替代文本模块的共享布局：仅承载子路由出口；
 * 顶部 TitleBar / 页面级 heading 由各子页自行声明。
 */
export default function AltTextLayout() {
  return <Outlet />
}
