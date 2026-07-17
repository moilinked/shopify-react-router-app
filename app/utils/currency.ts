/**
 * Currency code to symbol mapping.
 * Covers the most common Shopify-supported currencies.
 */
export const CURRENCY_SYMBOL_MAP: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
  CAD: 'CA$',
  AUD: 'A$',
  HKD: 'HK$',
  SGD: 'S$',
  NZD: 'NZ$',
  KRW: '₩',
  INR: '₹',
  BRL: 'R$',
  MXN: 'MX$',
  TWD: 'NT$',
  THB: '฿',
  TRY: '₺',
  RUB: '₽',
  PLN: 'zł',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
  CHF: 'CHF',
  ZAR: 'R',
  MYR: 'RM',
  PHP: '₱',
  IDR: 'Rp',
  VND: '₫',
  AED: 'د.إ',
  SAR: '﷼',
  ILS: '₪',
  CZK: 'Kč',
  HUF: 'Ft',
  CLP: 'CL$',
  COP: 'COL$',
  ARS: 'AR$',
  PEN: 'S/',
  EGP: 'E£',
  NGN: '₦',
  KES: 'KSh',
  UAH: '₴',
  RON: 'lei',
  BGN: 'лв',
  HRK: 'kn',
  ISK: 'kr',
  PKR: '₨',
  BDT: '৳',
  LKR: 'Rs',
  QAR: 'QR',
  KWD: 'KD',
  BHD: 'BD',
  OMR: 'OMR',
  JOD: 'JD'
}

/**
 * Returns the currency symbol for the given shop currency code.
 * Falls back to the currency code itself if no symbol mapping exists.
 */
export function getCurrencySymbol(currencyCode: string): string {
  return CURRENCY_SYMBOL_MAP[currencyCode] ?? currencyCode
}
