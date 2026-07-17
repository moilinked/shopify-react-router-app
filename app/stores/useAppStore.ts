import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface AppState {
  sidebarOpen: boolean
  shop: string
  currencyCode: string
  ianaTimezone: string
  toggleSidebar: () => void
  setShop: (shop: string) => void
  setCurrencyCode: (code: string) => void
  setIanaTimezone: (tz: string) => void
}

export const useAppStore = create<AppState>()(
  devtools(
    (set) => ({
      sidebarOpen: false,
      shop: '',
      currencyCode: 'USD',
      ianaTimezone: 'UTC',
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen }), false, 'toggleSidebar'),
      setShop: (shop: string) => set({ shop }, false, 'setShop'),
      setCurrencyCode: (code: string) => set({ currencyCode: code }, false, 'setCurrencyCode'),
      setIanaTimezone: (tz: string) => set({ ianaTimezone: tz }, false, 'setIanaTimezone')
    }),
    { name: 'AppStore' }
  )
)
