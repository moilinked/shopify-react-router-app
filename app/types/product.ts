export interface Product {
  id: string
  title: string
  status: string
  price?: string
}

export interface ProductListParams {
  page?: number
  limit?: number
  status?: string
}
