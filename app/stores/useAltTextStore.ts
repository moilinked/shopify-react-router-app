import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { CandidateImage, CandidateProduct } from '~/services/altText'

/**
 * 入口页选中的候选图片集合。
 * - 商品来源：按 productId 分组，containing image 列表
 * - Files 来源：扁平 image 列表
 */
interface AltTextState {
  // 候选数据
  products: CandidateProduct[]
  files: CandidateImage[]
  /** 已选中的 image id 集合（跨商品/Files 共用） */
  selectedImageIds: Set<string>

  setProducts: (products: CandidateProduct[]) => void
  appendProducts: (products: CandidateProduct[]) => void
  removeProduct: (productId: string) => void
  setFiles: (images: CandidateImage[]) => void
  toggleImageSelected: (id: string) => void
  selectImages: (ids: string[]) => void
  unselectImages: (ids: string[]) => void
  selectAll: () => void
  clearSelection: () => void
  reset: () => void
}

const collectAllImageIds = (products: CandidateProduct[], files: CandidateImage[]): string[] => {
  const ids: string[] = []
  for (const p of products) for (const i of p.images) ids.push(i.id)
  for (const f of files) ids.push(f.id)
  return ids
}

export const useAltTextStore = create<AltTextState>()(
  devtools(
    (set) => ({
      products: [],
      files: [],
      selectedImageIds: new Set<string>(),

      // 加载商品时默认全选所有图片
      setProducts: (products) =>
        set(
          {
            products,
            files: [],
            selectedImageIds: new Set(collectAllImageIds(products, []))
          },
          false,
          'setProducts'
        ),

      // 追加商品时合并去重，并把新商品的图片默认加入选区
      appendProducts: (products) =>
        set(
          (s) => {
            const map = new Map(s.products.map((p) => [p.id, p]))
            for (const p of products) map.set(p.id, p)
            const merged = Array.from(map.values())
            const nextSelected = new Set(s.selectedImageIds)
            for (const p of products) for (const i of p.images) nextSelected.add(i.id)
            return { products: merged, selectedImageIds: nextSelected }
          },
          false,
          'appendProducts'
        ),

      // 移除某个商品（同时把它的图片从选区清掉）
      removeProduct: (productId) =>
        set(
          (s) => {
            const target = s.products.find((p) => p.id === productId)
            if (!target) return {}
            const dropIds = new Set(target.images.map((i) => i.id))
            const nextSelected = new Set(s.selectedImageIds)
            for (const id of dropIds) nextSelected.delete(id)
            return {
              products: s.products.filter((p) => p.id !== productId),
              selectedImageIds: nextSelected
            }
          },
          false,
          'removeProduct'
        ),

      // 加载 Files 时默认全选
      setFiles: (images) =>
        set(
          {
            files: images,
            products: [],
            selectedImageIds: new Set(collectAllImageIds([], images))
          },
          false,
          'setFiles'
        ),

      toggleImageSelected: (id) =>
        set(
          (s) => {
            const next = new Set(s.selectedImageIds)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return { selectedImageIds: next }
          },
          false,
          'toggleImageSelected'
        ),

      selectImages: (ids) =>
        set(
          (s) => {
            const next = new Set(s.selectedImageIds)
            for (const id of ids) next.add(id)
            return { selectedImageIds: next }
          },
          false,
          'selectImages'
        ),

      unselectImages: (ids) =>
        set(
          (s) => {
            const next = new Set(s.selectedImageIds)
            for (const id of ids) next.delete(id)
            return { selectedImageIds: next }
          },
          false,
          'unselectImages'
        ),

      selectAll: () =>
        set((s) => ({ selectedImageIds: new Set(collectAllImageIds(s.products, s.files)) }), false, 'selectAll'),

      clearSelection: () => set({ selectedImageIds: new Set() }, false, 'clearSelection'),

      reset: () => set({ products: [], files: [], selectedImageIds: new Set() }, false, 'reset')
    }),
    { name: 'AltTextStore' }
  )
)
