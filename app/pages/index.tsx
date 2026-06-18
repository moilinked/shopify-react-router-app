import type { LoaderFunctionArgs } from 'react-router'
import { Form, redirect, useLoaderData } from 'react-router'

import { login } from '~/shopify.server'

import styles from './styles.module.css'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url)

  if (url.searchParams.get('shop')) {
    throw redirect(`/app?${url.searchParams.toString()}`)
  }

  return { showForm: Boolean(login) }
}

export default function Index() {
  const { showForm } = useLoaderData<typeof loader>()

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>Waterdrop App Dev</h1>
        <p className={styles.text}>Shopify app development scaffold.</p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
      </div>
    </div>
  )
}
