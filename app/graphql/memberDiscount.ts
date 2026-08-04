import { METAFIELD_KEY, METAFIELD_NAMESPACE } from '~/types/memberDiscount'

export const GET_SHOPIFY_FUNCTIONS = `#graphql
  query MemberDiscountFunctions {
    shopifyFunctions(first: 25) {
      nodes {
        id
        title
        apiType
        appKey
      }
    }
  }
`

export const GET_DISCOUNT = `#graphql
  query MemberDiscountGet($id: ID!) {
    discountNode(id: $id) {
      id
      configurationField: metafield(namespace: "${METAFIELD_NAMESPACE}", key: "${METAFIELD_KEY}") {
        id
        value
      }
      discount {
        __typename
        ... on DiscountAutomaticApp {
          title
          status
          discountClasses
          appliesOnOneTimePurchase
          appliesOnSubscription
          combinesWith {
            orderDiscounts
            productDiscounts
            shippingDiscounts
          }
          startsAt
          endsAt
        }
        ... on DiscountCodeApp {
          title
          status
          discountClasses
          appliesOnOneTimePurchase
          appliesOnSubscription
          combinesWith {
            orderDiscounts
            productDiscounts
            shippingDiscounts
          }
          startsAt
          endsAt
          usageLimit
          appliesOncePerCustomer
          codes(first: 1) {
            nodes {
              code
            }
          }
        }
      }
    }
  }
`

export const CREATE_CODE_DISCOUNT = `#graphql
  mutation MemberDiscountCreateCode($discount: DiscountCodeAppInput!) {
    discountCreate: discountCodeAppCreate(codeAppDiscount: $discount) {
      codeAppDiscount {
        discountId
      }
      userErrors {
        code
        message
        field
      }
    }
  }
`

export const CREATE_AUTOMATIC_DISCOUNT = `#graphql
  mutation MemberDiscountCreateAutomatic($discount: DiscountAutomaticAppInput!) {
    discountCreate: discountAutomaticAppCreate(automaticAppDiscount: $discount) {
      automaticAppDiscount {
        discountId
      }
      userErrors {
        code
        message
        field
      }
    }
  }
`

export const UPDATE_CODE_DISCOUNT = `#graphql
  mutation MemberDiscountUpdateCode($id: ID!, $discount: DiscountCodeAppInput!) {
    discountUpdate: discountCodeAppUpdate(id: $id, codeAppDiscount: $discount) {
      codeAppDiscount {
        discountId
      }
      userErrors {
        code
        message
        field
      }
    }
  }
`

export const UPDATE_AUTOMATIC_DISCOUNT = `#graphql
  mutation MemberDiscountUpdateAutomatic($id: ID!, $discount: DiscountAutomaticAppInput!) {
    discountUpdate: discountAutomaticAppUpdate(id: $id, automaticAppDiscount: $discount) {
      automaticAppDiscount {
        discountId
      }
      userErrors {
        code
        message
        field
      }
    }
  }
`
