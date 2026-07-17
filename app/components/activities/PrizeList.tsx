import { useRef, useState } from 'react'
import type { Prize } from '~/types/activity'
import { PRIZE_TYPE_MAP } from '~/types/activity'
import { PrizeForm } from './PrizeForm'
import { EmptyState } from '../EmptyState'

interface PrizeListProps {
  prizes: Prize[]
  isProgress?: boolean
  deletedPrizes?: Prize[]
  onChange: (prizes: Prize[]) => void
  readOnly?: boolean
}

export function PrizeList({ prizes, deletedPrizes, onChange, isProgress = false, readOnly = false }: PrizeListProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [viewingIndex, setViewingIndex] = useState<number | null>(null)
  const [viewingDeletedIndex, setViewingDeletedIndex] = useState<number | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null)
  const deleteConfirmModalRef = useRef<any>(null)

  const totalRate = prizes.reduce((sum, p) => sum + p.winning_rate, 0)

  const handleSave = (prize: Prize, index: number) => {
    const next = [...prizes]
    next[index] = prize
    onChange(next)
    setEditingIndex(null)
  }

  const handleAdd = (prize: Prize) => {
    onChange([...prizes, prize])
    setIsAdding(false)
  }

  const handleDelete = (index: number) => {
    onChange(prizes.filter((_, i) => i !== index))
  }

  const handleDeleteRequest = (index: number) => {
    setDeletingIndex(index)
    deleteConfirmModalRef.current?.showOverlay()
  }

  const handleDeleteCancel = () => {
    deleteConfirmModalRef.current?.hideOverlay()
    setDeletingIndex(null)
  }

  const handleDeleteConfirm = () => {
    if (deletingIndex === null) return
    handleDelete(deletingIndex)
    deleteConfirmModalRef.current?.hideOverlay()
    setDeletingIndex(null)
  }

  const handleCopy = (index: number) => {
    const source = prizes[index]
    const copiedPrize: Prize = {
      ...source,
      id: undefined,
      won_count: null,
      prize_name: `${source.prize_name} (副本)`
    }

    const next = [...prizes]
    const copiedIndex = index + 1
    next.splice(copiedIndex, 0, copiedPrize)

    onChange(next)
    setEditingIndex(copiedIndex)
    setViewingIndex(null)
    setIsAdding(false)
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const newPrizes = [...prizes]
    const draggedItem = newPrizes[draggedIndex]
    newPrizes.splice(draggedIndex, 1)
    newPrizes.splice(index, 0, draggedItem)

    onChange(newPrizes)
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  // 优先级: edit > view > add (同一时间只能有一种模式)。
  let formProps: React.ComponentProps<typeof PrizeForm> | null = null
  if (editingIndex !== null) {
    formProps = {
      prize: prizes[editingIndex],
      onSave: (p) => handleSave(p, editingIndex),
      onCancel: () => setEditingIndex(null),
      lockPrizeType: isProgress
    }
  } else if (viewingIndex !== null) {
    formProps = {
      prize: prizes[viewingIndex],
      readOnly: true,
      onSave: () => {},
      onCancel: () => setViewingIndex(null)
    }
  } else if (viewingDeletedIndex !== null && deletedPrizes?.[viewingDeletedIndex]) {
    formProps = {
      prize: deletedPrizes[viewingDeletedIndex],
      readOnly: true,
      onSave: () => {},
      onCancel: () => setViewingDeletedIndex(null)
    }
  } else if (isAdding) {
    formProps = {
      onSave: handleAdd,
      onCancel: () => setIsAdding(false)
    }
  }

  return (
    <s-section>
      <s-stack gap="base">
        <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
          <s-stack direction="inline" gap="base" alignItems="center">
            <s-heading>奖品列表</s-heading>
            <s-stack direction="inline" alignItems="center">
              <s-text>总中奖率：</s-text>
              <s-badge tone={totalRate === 100 ? 'success' : 'critical'}>
                {totalRate}%{totalRate !== 100 ? ' (必须为 100%)' : ''}
              </s-badge>
            </s-stack>
            <s-stack direction="inline" alignItems="center">
              <s-text>奖品数量：</s-text>
              <s-badge tone={prizes.length === 8 ? 'success' : 'critical'}>
                {prizes.length}
                {prizes.length !== 8 ? ' (必须为 8 个)' : ''}
              </s-badge>
            </s-stack>
          </s-stack>
          {!readOnly && (
            <s-button variant="primary" onClick={() => setIsAdding(true)}>
              +添加奖项
            </s-button>
          )}
        </s-stack>

        {prizes.length > 0 ? (
          <s-table>
            <s-table-header-row>
              {!readOnly && <s-table-header></s-table-header>}
              <s-table-header>奖项名称</s-table-header>
              <s-table-header>中奖率</s-table-header>
              <s-table-header>奖项类型</s-table-header>
              <s-table-header>总库存</s-table-header>
              <s-table-header>中奖数量</s-table-header>
              <s-table-header>剩余库存</s-table-header>
              <s-table-header>操作</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {prizes.map((prize, index) => (
                <s-table-row key={`${prize.prize_type}-${index}`}>
                  {!readOnly && (
                    <s-table-cell>
                      <div
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={(e: React.DragEvent) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                        style={{ cursor: 'grab', userSelect: 'none' }}
                      >
                        ⋮⋮
                      </div>
                    </s-table-cell>
                  )}
                  <s-table-cell>{prize.prize_name}</s-table-cell>
                  <s-table-cell>
                    <s-badge tone="warning">{prize.winning_rate}%</s-badge>
                  </s-table-cell>
                  <s-table-cell>
                    <s-badge tone="info">{PRIZE_TYPE_MAP[prize.prize_type]}</s-badge>
                  </s-table-cell>
                  <s-table-cell>{prize.inventory ?? '-'}</s-table-cell>
                  <s-table-cell>{prize.won_count ?? '-'}</s-table-cell>
                  <s-table-cell>
                    {prize.inventory && prize.won_count ? prize.inventory - prize.won_count : '-'}
                  </s-table-cell>
                  <s-table-cell>
                    {readOnly ? (
                      <s-button
                        variant="tertiary"
                        tone="neutral"
                        onClick={() => {
                          setViewingIndex(index)
                          setViewingDeletedIndex(null)
                        }}
                      >
                        查看
                      </s-button>
                    ) : (
                      <s-stack direction="inline" gap="small">
                        <s-button variant="tertiary" tone="neutral" onClick={() => setEditingIndex(index)}>
                          编辑
                        </s-button>
                        <s-button variant="tertiary" tone="neutral" onClick={() => handleCopy(index)}>
                          复制
                        </s-button>
                        <s-button variant="tertiary" tone="critical" onClick={() => handleDeleteRequest(index)}>
                          删除
                        </s-button>
                      </s-stack>
                    )}
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        ) : (
          <EmptyState
            heading="暂无奖品配置"
            message="点击添加奖品开始配置。"
            actionLabel="添加奖品"
            onAction={() => setIsAdding(true)}
          />
        )}

        {deletedPrizes && deletedPrizes.length > 0 && (
          <s-stack gap="base">
            <s-heading>已删奖品列</s-heading>
            <s-table>
              <s-table-header-row>
                {!readOnly && <s-table-header></s-table-header>}
                <s-table-header>奖项名称</s-table-header>
                <s-table-header>中奖率</s-table-header>
                <s-table-header>奖项类型</s-table-header>
                <s-table-header>总库存</s-table-header>
                <s-table-header>中奖数量</s-table-header>
                <s-table-header>剩余库存</s-table-header>
                <s-table-header>操作</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {deletedPrizes.map((prize, index) => (
                  <s-table-row key={`${prize.prize_type}-${index}`}>
                    {!readOnly && (
                      <s-table-cell>
                        <div
                          draggable
                          onDragStart={() => handleDragStart(index)}
                          onDragOver={(e: React.DragEvent) => handleDragOver(e, index)}
                          onDragEnd={handleDragEnd}
                          style={{ cursor: 'grab', userSelect: 'none' }}
                        >
                          ⋮⋮
                        </div>
                      </s-table-cell>
                    )}
                    <s-table-cell>{prize.prize_name}</s-table-cell>
                    <s-table-cell>
                      <s-badge tone="warning">{prize.winning_rate}%</s-badge>
                    </s-table-cell>
                    <s-table-cell>
                      <s-badge tone="info">{PRIZE_TYPE_MAP[prize.prize_type]}</s-badge>
                    </s-table-cell>
                    <s-table-cell>{prize.inventory ?? '-'}</s-table-cell>
                    <s-table-cell>{prize.won_count ?? '-'}</s-table-cell>
                    <s-table-cell>
                      {prize.inventory && prize.won_count ? prize.inventory - prize.won_count : '-'}
                    </s-table-cell>
                    <s-table-cell>
                      <s-button
                        variant="tertiary"
                        tone="neutral"
                        onClick={() => {
                          setViewingDeletedIndex(index)
                          setViewingIndex(null)
                        }}
                      >
                        查看
                      </s-button>
                    </s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          </s-stack>
        )}
      </s-stack>
      {/* 根据当前模式渲染 PrizeForm 组件。 */}
      {formProps && <PrizeForm {...formProps} />}

      <s-modal
        ref={deleteConfirmModalRef}
        id="prize-delete-confirm-modal"
        heading="确认删除奖项"
        onHide={() => setDeletingIndex(null)}
      >
        <s-stack gap="base">
          <s-text>
            确定要删除奖项
            {deletingIndex !== null ? `「${prizes[deletingIndex]?.prize_name || ''}」` : ''}
            吗？
          </s-text>
        </s-stack>
        <s-button slot="primary-action" variant="primary" tone="critical" onClick={handleDeleteConfirm}>
          确认删除
        </s-button>
        <s-button slot="secondary-actions" variant="secondary" onClick={handleDeleteCancel}>
          取消
        </s-button>
      </s-modal>
    </s-section>
  )
}
