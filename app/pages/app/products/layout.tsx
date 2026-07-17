import { Outlet, useLocation } from 'react-router'

export default function ProductsLayout() {
  const location = useLocation()

  return (
    <s-page heading="Products">
      <s-section>
        <s-paragraph>
          This is a <strong>nested layout</strong> at <code>/app/products</code>. All product sub-pages render inside
          this layout.
        </s-paragraph>
        <s-paragraph>
          Current path: <code>{location.pathname}</code>
        </s-paragraph>
      </s-section>
      <s-divider />
      <Outlet />
    </s-page>
  )
}
