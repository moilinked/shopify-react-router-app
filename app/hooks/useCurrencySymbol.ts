import { useAppStore } from '~/stores/useAppStore'
import { getCurrencySymbol } from '~/utils/currency'

/**
 * Hook that returns the currency symbol for the current shop.
 * Reads the currency code from the global app store (set by the layout loader).
 */
export function useCurrencySymbol(): string {
  const currencyCode = useAppStore((s) => s.currencyCode)
  return getCurrencySymbol(currencyCode)
}
