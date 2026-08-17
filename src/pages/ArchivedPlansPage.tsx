import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Archive, Loader2, RotateCcw } from 'lucide-react'
import { PageTransition } from '@/components/layout/PageTransition'
import { PlanDetailModal } from '@/components/PlanDetailModal'
import { weekPlanApi } from '@/services/api'
import type { WeekPlan } from '@/types'

type ArchivedWeekGroup = {
  key: string
  label: string
  plans: WeekPlan[]
}

function groupByPlanWeek(plans: WeekPlan[]): ArchivedWeekGroup[] {
  const groups = plans.reduce<Record<string, ArchivedWeekGroup>>((current, plan) => {
    const key = `${plan.year}-${plan.weekNumber}`
    const existing = current[key]
    if (existing) {
      existing.plans.push(plan)
      return current
    }
    current[key] = {
      key,
      label: `${plan.year} 年第 ${plan.weekNumber} 周 · ${plan.weekStart} ~ ${plan.weekEnd}`,
      plans: [plan],
    }
    return current
  }, {})

  return Object.values(groups).sort((left, right) => {
    const [leftYear, leftWeek] = left.key.split('-').map(Number)
    const [rightYear, rightWeek] = right.key.split('-').map(Number)
    return rightYear - leftYear || rightWeek - leftWeek
  })
}

export function ArchivedPlansPage() {
  const queryClient = useQueryClient()
  const [viewingPlan, setViewingPlan] = useState<WeekPlan | undefined>()
  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['archivedPlans'],
    queryFn: weekPlanApi.getArchived,
  })

  const restoreMutation = useMutation({
    mutationFn: weekPlanApi.restore,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archivedPlans'] })
      queryClient.invalidateQueries({ queryKey: ['myPlans'] })
    },
  })

  const handleRestore = (id: string) => {
    if (confirm('移出归档后，计划将重新显示在个人计划中，确定继续吗？')) restoreMutation.mutate(id)
  }

  const archivedWeekGroups = groupByPlanWeek(plans)

  return (
    <PageTransition>
      <div className="min-h-screen ml-64 p-[var(--spacing-2xl)]">
        <div className="max-w-6xl mx-auto">
          <div className="mb-[var(--spacing-2xl)]">
            <div className="flex items-center gap-3 mb-2">
              <Archive className="w-7 h-7 text-accent" />
              <h1>已归档计划</h1>
            </div>
            <p className="text-secondary">保留已完成或不再执行的个人计划，仅供查阅。</p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-[var(--spacing-2xl)]"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
          ) : plans.length === 0 ? (
            <div className="text-center py-[var(--spacing-2xl)] surface-2 rounded-[var(--radius-lg)] border border-[var(--border)]">
              <p className="text-secondary">暂无已归档计划</p>
            </div>
          ) : (
            <div className="space-y-[var(--spacing-2xl)]">
              {archivedWeekGroups.map((group) => (
                <section key={group.key}>
                  <div className="flex items-center justify-between gap-4 mb-[var(--spacing-lg)]">
                    <div>
                      <h2 className="text-lg font-semibold">{group.label}</h2>
                      <p className="text-sm text-secondary mt-1">{group.plans.length} 条已归档计划</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {group.plans.map((plan) => (
                      <article
                        key={plan.id}
                        onClick={() => setViewingPlan(plan)}
                        className="group flex cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 transition-colors hover:border-[var(--accent)] hover:bg-white"
                      >
                        <span className="shrink-0 rounded-[var(--radius-sm)] bg-[var(--status-warning)]/15 px-2 py-1 text-xs font-medium text-[var(--status-warning)]">
                          {plan.projectCode}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium">{plan.projectName}</span>
                            <span className="text-secondary">· {plan.weekday === 'pending' ? '待定' : `周${['一', '二', '三', '四', '五', '六', '日'][['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].indexOf(plan.weekday)]}`}</span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-sm text-secondary">{plan.content}</p>
                        </div>
                        <button
                          type="button"
                          onClick={(event) => { event.stopPropagation(); handleRestore(plan.id) }}
                          disabled={restoreMutation.isPending}
                          className="flex shrink-0 items-center gap-1 rounded-[var(--radius-full)] px-3 py-1.5 text-xs text-accent transition-colors hover:bg-[var(--accent)] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />移出归档
                        </button>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
      <PlanDetailModal plan={viewingPlan} onClose={() => setViewingPlan(undefined)} />
    </PageTransition>
  )
}
