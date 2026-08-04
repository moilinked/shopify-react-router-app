import { useEffect } from 'react'
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import { useActionData, useNavigation, useParams, useSubmit } from 'react-router'
import { authenticate } from '~/shopify.server'
import { MemberDiscountForm } from '~/components/member-discount/MemberDiscountForm'
import { createMemberDiscount } from '~/services/memberDiscount.server'
import type { DiscountUserError, MemberDiscountFormState } from '~/types/memberDiscount'
import { createDefaultFormState } from '~/types/memberDiscount'
import { returnToDiscounts } from '~/utils/discountNavigation'

type ActionData = {
  errors?: DiscountUserError[]
  success?: boolean
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request)
  return null
}

export const action = async ({ request, params }: ActionFunctionArgs) => {
  await authenticate.admin(request)
  const formData = await request.formData()
  const raw = formData.get('discount')
  if (!raw || typeof raw !== 'string') {
    return { errors: [{ message: '未收到折扣数据' }] } satisfies ActionData
  }

  const form = JSON.parse(raw) as MemberDiscountFormState
  const result = await createMemberDiscount(request, form, params.functionId)
  if (result.errors?.length) {
    return { errors: result.errors } satisfies ActionData
  }
  return { success: true } satisfies ActionData
}

export default function MemberDiscountNewPage() {
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
      initialData={createDefaultFormState()}
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
