import type { ActionFunctionArgs } from 'react-router'

import { authenticate } from '~/shopify.server'

interface InventoryLevelUpdatePayload {
  inventory_item_id: number
  location_id: number
  available: number | null
  updated_at: string
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request)

  const { inventory_item_id, location_id, available, updated_at } = payload as InventoryLevelUpdatePayload

  console.log(`Received ${topic} webhook for ${shop}`, {
    inventory_item_id,
    location_id,
    available,
    updated_at
  })

  return new Response()
}
