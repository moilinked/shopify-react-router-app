import { http } from '~/utils/http'
import type { Product, ProductListParams } from '~/types/product'

export type { Product, ProductListParams }

export const productApi = {
  getList(params?: ProductListParams) {
    return http.get<Product[]>({
      url: '/api/products',
      params: params ? Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) : undefined
    })
  },

  getById(id: string) {
    return http.get<Product>({ url: `/api/products/${id}` })
  },

  create(data: Omit<Product, 'id'>) {
    return http.post<Product>({ url: '/api/products', data })
  },

  update(id: string, data: Partial<Product>) {
    return http.put<Product>({ url: `/api/products/${id}`, data })
  },

  remove(id: string) {
    return http.delete<null>({
      url: `/api/products/${id}`,
      skipErrorToast: true
    })
  }
}
