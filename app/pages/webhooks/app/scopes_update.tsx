import type { ActionFunctionArgs } from 'react-router'

import db from '~/db.server'
import { authenticate } from '~/shopify.server'

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, session } = await authenticate.webhook(request)
  const current = payload.current as string[]

  if (session) {
    await db.session.update({
      where: {
        id: session.id
      },
      data: {
        scope: current.toString()
      }
    })
  }

  return new Response()
}
