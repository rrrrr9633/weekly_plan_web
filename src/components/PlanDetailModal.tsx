import { useEffect, useState } from 'react'
import { Archive, Calendar, FileText, Pencil, Trash2, User, X } from 'lucide-react'
import { PLAN_WEEKDAY_OPTIONS } from '@/types'
import type { WeekPlan } from '@/types'

interface PlanDetailModalProps {
  plan?: WeekPlan
  onClose: () => void
  onEdit?: (plan: WeekPlan) => void
  onArchive?: (plan: WeekPlan) => void
  onDelete?: (plan: WeekPlan) => void
  sortPosition?: number
  maxSortPosition?: number
  onSortPositionChange?: (plan: WeekPlan, position: number) => void
}

export function PlanDetailModal({ plan, onClose, onEdit, onArchive, onDelete, sortPosition, maxSortPosition, onSortPositionChange }: PlanDetailModalProps) {
  const [draftSortPosition, setDraftSortPosition] = useState(1)

  useEffect(() => {
    setDraftSortPosition(sortPosition ?? 1)
  }, [plan?.id, sortPosition])
  if (!plan) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" role="presentation" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-detail-title"
        className="w-full max-w-lg surface-2 rounded-[var(--radius-lg)] border border-[var(--border)] shadow-[var(--shadow-lg)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between p-[var(--spacing-xl)] border-b border-[var(--border)]">
          <div>
            <p className="text-sm text-secondary">计划详情</p>
            <h2 id="plan-detail-title" className="text-xl font-bold mt-1">{plan.projectName}</h2>
          </div>
          <button onClick={onClose} aria-label="关闭详情" className="p-2 rounded-[var(--radius-md)] hover:bg-[var(--surface-3)] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-[var(--spacing-xl)] space-y-[var(--spacing-lg)]">
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-1 text-xs rounded-[var(--radius-sm)] bg-[var(--accent)]/15 text-accent font-medium">{plan.projectCode}</span>
            {plan.isAssigned && <span className="px-2 py-1 text-xs rounded-[var(--radius-sm)] surface-3 text-secondary">管理员分配</span>}
            {plan.status === 'archived' && <span className="px-2 py-1 text-xs rounded-[var(--radius-sm)] bg-[var(--status-warning)]/15 text-[var(--status-warning)]">已归档</span>}
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--spacing-md)] text-sm">
            <div className="surface-3 rounded-[var(--radius-md)] p-[var(--spacing-md)]">
              <dt className="flex items-center gap-2 text-secondary"><User className="w-4 h-4" />负责人</dt>
              <dd className="mt-2 font-medium">{plan.displayName || plan.username}</dd>
            </div>
            <div className="surface-3 rounded-[var(--radius-md)] p-[var(--spacing-md)]">
              <dt className="flex items-center gap-2 text-secondary"><Calendar className="w-4 h-4" />时间范围</dt>
              <dd className="mt-2 font-medium">{plan.year}年 第{plan.weekNumber}周 · {PLAN_WEEKDAY_OPTIONS.find((option) => option.value === plan.weekday)?.label ?? '待定'}</dd>
              <dd className="mt-1 text-secondary">{plan.weekStart} ~ {plan.weekEnd}</dd>
            </div>
          </dl>

          <div>
            <h3 className="flex items-center gap-2 text-sm font-medium mb-2"><FileText className="w-4 h-4 text-secondary" />计划内容</h3>
            <p className="whitespace-pre-wrap surface-3 rounded-[var(--radius-md)] p-[var(--spacing-md)] text-primary">{plan.content}</p>
          </div>
        </div>

        {(onSortPositionChange || onEdit || onArchive || onDelete) && (
          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] px-[var(--spacing-xl)] py-[var(--spacing-md)]">
            {onSortPositionChange && maxSortPosition && (
              <label className="flex items-center gap-2 text-sm text-secondary">
                排序
                <input
                  type="number"
                  min={1}
                  max={maxSortPosition}
                  value={draftSortPosition}
                  onChange={(event) => setDraftSortPosition(event.target.valueAsNumber)}
                  onBlur={() => {
                    const position = Math.max(1, Math.min(Number.isFinite(draftSortPosition) ? Math.trunc(draftSortPosition) : 1, maxSortPosition))
                    setDraftSortPosition(position)
                    if (position !== sortPosition) onSortPositionChange(plan, position)
                  }}
                  aria-label="排序位次"
                  className="w-16 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-3)] px-2 py-1 text-center text-primary focus:border-[var(--accent)] focus:outline-none"
                />
                <span>／{maxSortPosition}</span>
              </label>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              {onEdit && <button type="button" onClick={() => onEdit(plan)} className="flex items-center gap-2 px-3 py-2 text-sm rounded-[var(--radius-md)] surface-3 hover:bg-[var(--accent)] hover:text-white transition-colors"><Pencil className="w-4 h-4" />编辑</button>}
              {onArchive && <button type="button" onClick={() => onArchive(plan)} className="flex items-center gap-2 px-3 py-2 text-sm rounded-[var(--radius-md)] surface-3 hover:bg-[var(--status-warning)] hover:text-white transition-colors"><Archive className="w-4 h-4" />归档</button>}
              {onDelete && <button type="button" onClick={() => onDelete(plan)} className="flex items-center gap-2 px-3 py-2 text-sm rounded-[var(--radius-md)] text-[var(--status-error)] hover:bg-[var(--status-error)] hover:text-white transition-colors"><Trash2 className="w-4 h-4" />删除</button>}
            </div>
          </footer>
        )}
      </section>
    </div>
  )
}
