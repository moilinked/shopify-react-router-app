import {
  DeliveryInput,
  CartDeliveryOptionsDiscountsGenerateRunResult
} from '../generated/api'

/**
 * 本折扣仅支持产品折扣（PRODUCT），不输出运费折扣。
 */
export function cartDeliveryOptionsDiscountsGenerateRun(
  _input: DeliveryInput
): CartDeliveryOptionsDiscountsGenerateRunResult {
  return { operations: [] }
}
