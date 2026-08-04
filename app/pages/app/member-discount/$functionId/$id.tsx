import { useEffect } from 'react'
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import { useActionData, useLoaderData, useNavigation, useParams, useSubmit } from 'react-router'
import { authenticate } from '~/shopify.server'
import { MemberDiscountForm } from '~/components/member-discount/MemberDiscountForm'
import { getMemberDiscount, updateMemberDiscount } from '~/services/memberDiscount.server'
import type { DiscountUserError, MemberDiscountFormState } from '~/types/memberDiscount'
import { returnToDiscounts } from '~/utils/discountNavigation'

type ActionData = {
  errors?: DiscountUserError[]
  success?: boolean
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await authenticate.admin(request)
  const id = params.id
  if (!id) throw new Response('Not Found', { status: 404 })
  const discount = await getMemberDiscount(request, id)
  if (!discount) throw new Response('Not Found', { status: 404 })
  return { discount }
}

export const action = async ({ request, params }: ActionFunctionArgs) => {
  await authenticate.admin(request)
  const id = params.id
  if (!id) {
    return { errors: [{ message: '缺少折扣 ID' }] } satisfies ActionData
  }

  const formData = await request.formData()
  const raw = formData.get('discount')
  if (!raw || typeof raw !== 'string') {
    return { errors: [{ message: '未收到折扣数据' }] } satisfies ActionData
  }

  const form = JSON.parse(raw) as MemberDiscountFormState
  const result = await updateMemberDiscount(request, id, form)
  if (result.errors?.length) {
    return { errors: result.errors } satisfies ActionData
  }
  return { success: true } satisfies ActionData
}

export default function MemberDiscountEditPage() {
  const { discount } = useLoaderData<typeof loader>()
  const actionData = useActionData<ActionData>()
  const navigation = useNavigation()
  const submit = useSubmit()
  const params = useParams()
  const isSubmitting = navigation.state === 'submitting'

  useEffect(() => {
    if (actionData?.success) {
      returnToDiscounts()
    }
  }, [actionData?.success])

  return (
    <MemberDiscountForm
      initialData={discount}
      isEditing
      isSubmitting={isSubmitting}
      errors={actionData?.errors}
      onDiscard={returnToDiscounts}
      onSubmit={(form) => {
        const payload = new FormData()
        payload.set('discount', JSON.stringify(form))
        payload.set('functionId', params.functionId ?? '')
        submit(payload, { method: 'post' })
      }}
    />
  )
}
