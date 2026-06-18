import type { ActivityFormData, Prize } from '~/types/activity'

export interface BaseValidationErrors {
  name?: string
  type?: string
  start_time?: string
  end_time?: string
  daily_draw_limit?: string
  draw_frequency_count?: string
  consumption_points?: string
  consumption_description?: string
  rules_description?: string
}

export interface PrizeValidationErrors {
  prize_name?: string
  prize_type?: string
  winning_rate?: string
  inventory?: string
  draw_frequency_count?: string
  discount_value?: string
  applies_to?: string
  requirement_value?: string
  gift_card_value?: string
  point_value?: string
  point_description?: string
  winning_pop_up_message?: string
  winning_pop_up_cta_text?: string
  config?: string
}

export interface PointsConfigValidationErrors {
  point_value?: string
  point_description?: string
}

const requiredError = '不能为空'
const isEmptyString = (value?: string) => !value?.trim()
const isEmptyRichText = (value?: string) =>
  !value
    ?.replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim()
const isEmptyNumber = (value?: number | null) => value == null || Number.isNaN(value)

/**
 * 活动基础设置表单字段校验规则
 */
export function validateActivityField(
  field: keyof BaseValidationErrors,
  formData: ActivityFormData
): string | undefined {
  switch (field) {
    case 'name':
      return isEmptyString(formData.name) ? `活动名称${requiredError}` : undefined
    case 'start_time':
      if (isEmptyString(formData.start_time)) return `开始时间${requiredError}`
      if (formData.end_time && new Date(formData.start_time) >= new Date(formData.end_time)) {
        return '开始时间必须早于结束时间'
      }
      return undefined
    case 'end_time':
      if (isEmptyString(formData.end_time)) return `结束时间${requiredError}`
      if (formData.start_time && new Date(formData.end_time) <= new Date(formData.start_time)) {
        return '结束时间必须晚于开始时间'
      }
      return undefined
    case 'daily_draw_limit':
      if (isEmptyNumber(formData.daily_draw_limit)) return `每日免费赠送次数${requiredError}`
      return undefined
    case 'draw_frequency_count':
      if (formData.draw_limit && isEmptyNumber(formData.draw_frequency_count)) {
        return `次数${requiredError}`
      }
      return undefined
    case 'consumption_points':
      if (isEmptyNumber(formData.consumption_points)) return `每局消耗积分${requiredError}`
      return undefined
    case 'rules_description':
      return isEmptyRichText(formData.rules_description) ? `游戏规则说明${requiredError}` : undefined
    default:
      return undefined
  }
}

/**
 * 活动基础设置需校验字段
 */
export function baseValidateActivityForm(formData: ActivityFormData): BaseValidationErrors {
  const errors: BaseValidationErrors = {}
  const fields: (keyof BaseValidationErrors)[] = [
    'name',
    'start_time',
    'end_time',
    'daily_draw_limit',
    'consumption_points',
    'rules_description'
  ]

  if (formData.draw_limit) {
    fields.push('draw_frequency_count')
  }

  fields.forEach((field) => {
    const error = validateActivityField(field, formData)
    if (error) {
      errors[field] = error
    }
  })

  return errors
}

/**
 * 活动基础设置表单是否校验通过
 */
export function isActivityFormValid(formData: ActivityFormData): boolean {
  const errors = baseValidateActivityForm(formData)
  return Object.keys(errors).length === 0
}

/**
 * 活动奖项表单共同字段校验规则
 */
function validateCommonPrizeField(field: keyof PrizeValidationErrors, prize: Prize): string | undefined {
  switch (field) {
    case 'prize_name':
      return isEmptyString(prize.prize_name) ? `奖品名称${requiredError}` : undefined
    case 'winning_rate':
      if (isEmptyNumber(prize.winning_rate)) return `中奖概率${requiredError}`
      if (prize.winning_rate < 0 || prize.winning_rate > 100) {
        return '中奖率必须在 0-100 之间'
      }
      return undefined
    case 'inventory':
      if (prize.prize_type !== 'NO_PRIZE') {
        if (isEmptyNumber(prize.inventory)) {
          return `总库存${requiredError}`
        }
        if ((prize.won_count ?? 0) > (prize.inventory ?? 0)) {
          return '总库存不能小于中奖数量'
        }
      }
      return undefined
    case 'draw_frequency_count':
      if (prize.draw_limit && isEmptyNumber(prize.draw_frequency_count)) {
        return `${requiredError}`
      }
      return undefined
    case 'winning_pop_up_message':
      return isEmptyString(prize.winning_pop_up_message) ? `中奖提示语${requiredError}` : undefined
    case 'winning_pop_up_cta_text':
      return isEmptyString(prize.winning_pop_up_cta_text) ? `按钮文案${requiredError}` : undefined
    default:
      return undefined
  }
}

/**
 * 折扣码奖品字段校验规则
 */
function validateDiscountPrizeField(field: keyof PrizeValidationErrors, prize: Prize): string | undefined {
  switch (field) {
    case 'discount_value':
      if (!('discount' in prize.config) || isEmptyNumber(prize.config.discount.value)) {
        return `折扣值${requiredError}`
      }
      if (prize.config.discount.value < 0) {
        return '折扣值不能小于 0'
      }
      return undefined
    case 'applies_to':
      if (prize.prize_type === 'PRODUCT_DISCOUNT_CODE') {
        if (!('applies_to' in prize.config) || !prize.config.applies_to || prize.config.applies_to.ids.length === 0) {
          return '请选择至少一个适用资源'
        }
      }
      return undefined
    case 'requirement_value':
      if (
        'requirement' in prize.config &&
        prize.config.requirement.type !== 'NONE' &&
        isEmptyNumber(prize.config.requirement.value)
      ) {
        return '最低购买要求不能为空'
      }
      return undefined
    default:
      return undefined
  }
}

/**
 * 礼品卡奖品字段校验规则
 */
function validateGiftCardPrizeField(field: keyof PrizeValidationErrors, prize: Prize): string | undefined {
  switch (field) {
    case 'gift_card_value':
      if (!('gift_card_value' in prize.config) || isEmptyNumber(prize.config.gift_card_value)) {
        return `礼品卡金额${requiredError}`
      }
      if (prize.config.gift_card_value < 0) {
        return '礼品卡金额不能小于 0'
      }
      return undefined
    default:
      return undefined
  }
}

/**
 * 积分奖品字段校验规则
 */
function validatePointsPrizeField(field: keyof PrizeValidationErrors, prize: Prize): string | undefined {
  switch (field) {
    case 'point_value':
      if (!('point_value' in prize.config) || isEmptyNumber(prize.config.point_value)) {
        return `赠送积分数量${requiredError}`
      }
      if (prize.config.point_value < 0) {
        return '赠送积分数量不能小于 0'
      }
      return undefined
    case 'point_description':
      if (!('point_description' in prize.config) || isEmptyString(prize.config.point_description)) {
        return `赠送说明${requiredError}`
      }
      return undefined
    default:
      return undefined
  }
}

/**
 * 验证奖品字段
 */
export function validatePrizeField(field: keyof PrizeValidationErrors, prize: Prize): string | undefined {
  const commonError = validateCommonPrizeField(field, prize)
  if (commonError) {
    return commonError
  }

  switch (prize.prize_type) {
    case 'PRODUCT_DISCOUNT_CODE':
      return validateDiscountPrizeField(field, prize)
    case 'ORDER_DISCOUNT_CODE':
      return validateDiscountPrizeField(field, prize)
    case 'GIFT_CARD':
      return validateGiftCardPrizeField(field, prize)
    case 'POINTS':
      return validatePointsPrizeField(field, prize)
    default:
      return undefined
  }
}

/**
 * 活动奖项设置需校验字段
 */
export function validatePrizeForm(prize: Prize): PrizeValidationErrors {
  const errors: PrizeValidationErrors = {}
  const fields: (keyof PrizeValidationErrors)[] = [
    'prize_name',
    'winning_rate',
    'winning_pop_up_message',
    'winning_pop_up_cta_text'
  ]

  if (prize.prize_type !== 'NO_PRIZE') {
    fields.push('inventory')
  }

  if (prize.draw_limit) {
    fields.push('draw_frequency_count')
  }

  if (prize.prize_type === 'GIFT_CARD') {
    fields.push('gift_card_value')
  }

  if (prize.prize_type === 'PRODUCT_DISCOUNT_CODE') {
    fields.push('discount_value', 'applies_to', 'requirement_value')
  }

  if (prize.prize_type === 'ORDER_DISCOUNT_CODE') {
    fields.push('discount_value', 'requirement_value')
  }

  if (prize.prize_type === 'POINTS') {
    fields.push('point_value', 'point_description')
  }

  fields.forEach((field) => {
    const error = validatePrizeField(field, prize)
    if (error) {
      errors[field] = error
    }
  })

  return errors
}

/**
 * 活动奖项表单是否校验通过
 */
export function isPrizeFormValid(prize: Prize): boolean {
  const errors = validatePrizeForm(prize)
  return Object.keys(errors).length === 0
}

/**
 * 验证整个新增活动表单是否通过（兜底校验）
 */
export function validateCompleteActivity(formData: ActivityFormData): string | null {
  // 基础设置校验
  const basicErrors = baseValidateActivityForm(formData)
  if (Object.keys(basicErrors).length > 0) {
    return Object.values(basicErrors)[0] || '基础设置存在错误'
  }

  // 奖项设置校验
  if (formData.prizes.length !== 8) {
    return '需要添加八个奖品'
  }

  // 总中奖率校验
  const totalRate = formData.prizes.reduce((sum, p) => sum + p.winning_rate, 0)
  if (totalRate !== 100) {
    return `总中奖率必须为 100% (当前: ${totalRate}%)`
  }

  return null
}
