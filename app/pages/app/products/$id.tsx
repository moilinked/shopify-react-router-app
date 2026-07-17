import { useParams, useNavigate } from 'react-router'

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  return (
    <s-section heading={`Product #${id}`}>
      <s-paragraph>
        This is a <strong>dynamic route</strong> at <code>/app/products/:id</code> (file: <code>$id.tsx</code>).
      </s-paragraph>
      <s-paragraph>
        Current product ID: <s-badge>{id}</s-badge>
      </s-paragraph>
      <s-button onClick={() => navigate('/app/products')}>Back to list</s-button>
    </s-section>
  )
}
