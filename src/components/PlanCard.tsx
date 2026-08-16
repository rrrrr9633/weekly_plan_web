import { type WeekPlan, PLAN_WEEKDAY_OPTIONS } from '@/types'
import { User, Calendar, FileText } from 'lucide-react'
import { motion } from 'framer-motion'

interface PlanCardProps {
  plan: WeekPlan
  showUser?: boolean
  variant?: 'default' | 'content-primary'
  onView?: (plan: WeekPlan) => void
  onEdit?: (plan: WeekPlan) => void
  onDelete?: (id: string) => void
  onArchive?: (id: string) => void
  onRestore?: (id: string) => void
}

export function PlanCard({ plan, showUser = true, variant = 'default', onView, onEdit, onDelete, onArchive, onRestore }: PlanCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className="card hover:border-[var(--accent)] hover:shadow-[var(--shadow-md)] cursor-pointer group"
      onClick={() => onView?.(plan)}
    >
      <div className="flex items-start justify-between mb-[var(--spacing-sm)]">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-block px-2 py-1 text-xs rounded-[var(--radius-sm)] bg-[var(--accent)]/20 text-accent font-medium">
              {plan.projectCode}
            </span>
            {plan.isAssigned && (
              <span className="text-xs text-secondary">· 管理员分配</span>
            )}
            {plan.status === 'archived' && (
              <span className="text-xs px-2 py-1 rounded-[var(--radius-sm)] bg-[var(--status-warning)]/15 text-[var(--status-warning)]">已归档</span>
            )}
          </div>
          {variant === 'content-primary' ? (
            <>
              <h3 className="font-semibold text-primary group-hover:text-accent transition-colors line-clamp-2">
                {plan.content}
              </h3>
              <p className="mt-1 text-sm text-secondary">{plan.projectName}</p>
            </>
          ) : (
            <h3 className="font-semibold text-primary group-hover:text-accent transition-colors">
              {plan.projectName}
            </h3>
          )}
        </div>
      </div>

      {showUser && (
        <div className="flex items-center gap-2 text-sm text-secondary mb-[var(--spacing-sm)]">
          <User className="w-4 h-4" />
          <span>{plan.displayName || plan.username}</span>
        </div>
      )}

      <div className="flex items-start gap-2 text-sm text-secondary mb-[var(--spacing-md)]">
        <Calendar className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>
          第{plan.weekNumber}周 · {PLAN_WEEKDAY_OPTIONS.find((option) => option.value === plan.weekday)?.label ?? '待定'} · {plan.weekStart} ~ {plan.weekEnd}
        </span>
      </div>

      {variant !== 'content-primary' && (
        <div className="flex items-start gap-2 text-sm">
          <FileText className="w-4 h-4 mt-0.5 flex-shrink-0 text-secondary" />
          <p className="text-primary line-clamp-3">{plan.content}</p>
        </div>
      )}

      {(onEdit || onDelete || onArchive || onRestore) && (
        <div className="mt-[var(--spacing-md)] pt-[var(--spacing-md)] border-t border-[var(--border)] flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <button
              onClick={(event) => { event.stopPropagation(); onEdit(plan) }}
              className="text-xs px-3 py-1 rounded-[var(--radius-full)] surface-3 hover:bg-[var(--accent)] hover:text-white transition-all"
            >
              编辑
            </button>
          )}
          {onArchive && (
            <button
              onClick={(event) => { event.stopPropagation(); onArchive(plan.id) }}
              className="text-xs px-3 py-1 rounded-[var(--radius-full)] surface-3 hover:bg-[var(--status-warning)] hover:text-white transition-all"
            >
              归档
            </button>
          )}
          {onRestore && (
            <button
              onClick={(event) => { event.stopPropagation(); onRestore(plan.id) }}
              className="text-xs px-3 py-1 rounded-[var(--radius-full)] surface-3 hover:bg-[var(--accent)] hover:text-white transition-all"
            >
              移出归档
            </button>
          )}
          {onDelete && (
            <button
              onClick={(event) => { event.stopPropagation(); onDelete(plan.id) }}
              className="text-xs px-3 py-1 rounded-[var(--radius-full)] surface-3 hover:bg-[var(--status-error)] hover:text-white transition-all"
            >
              删除
            </button>
          )}
        </div>
      )}
    </motion.div>
  )
}
