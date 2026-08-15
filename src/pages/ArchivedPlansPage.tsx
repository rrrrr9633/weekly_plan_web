import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Archive, Loader2 } from 'lucide-react'
import { PageTransition } from '@/components/layout/PageTransition'
import { PlanCard } from '@/components/PlanCard'
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[var(--spacing-lg)]">
                    {group.plans.map((plan) => <PlanCard key={plan.id} plan={plan} showUser={false} onView={setViewingPlan} onRestore={handleRestore} />)}
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
