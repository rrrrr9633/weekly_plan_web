import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Loader2 } from 'lucide-react'
import { PageTransition } from '@/components/layout/PageTransition'
import { WeekSelector } from '@/components/WeekSelector'
import { PlanCard } from '@/components/PlanCard'
import { PlanModal } from '@/components/PlanModal'
import { PlanDetailModal } from '@/components/PlanDetailModal'
import { useWeekStore } from '@/store/weekStore'
import { weekPlanApi, projectApi, ApiError } from '@/services/api'
import type { WeekPlan } from '@/types'
import { sortPlansByWeekday } from '@/lib/planSort'

export function PersonalPage() {
  const queryClient = useQueryClient()
  const { currentYear, currentWeek } = useWeekStore()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<WeekPlan | undefined>()
  const [viewingPlan, setViewingPlan] = useState<WeekPlan | undefined>()
  const [operationError, setOperationError] = useState<string | undefined>()

  // 获取项目列表
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: projectApi.getAll,
  })

  // 获取个人计划
  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['myPlans', currentYear, currentWeek],
    queryFn: () => weekPlanApi.getMyPlans(currentYear, currentWeek),
  })

  // 批量创建计划
  const createMutation = useMutation({
    mutationFn: (data: { projectId: string; plans: Array<{ content: string; weekday: WeekPlan['weekday'] }> }) =>
      weekPlanApi.createBatch({
        ...data,
        year: currentYear,
        weekNumber: currentWeek,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myPlans'] })
      setOperationError(undefined)
      setIsModalOpen(false)
    },
    onError: (error) => {
      setOperationError(error instanceof ApiError ? error.message : '添加计划失败，请确认后端服务正在运行后重试')
    },
  })

  // 更新计划
  const updateMutation = useMutation({
    mutationFn: ({ id, content, weekday }: { id: string; content: string; weekday: WeekPlan['weekday'] }) =>
      weekPlanApi.update(id, { content, weekday }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myPlans'] })
      setIsModalOpen(false)
      setEditingPlan(undefined)
    },
  })

  // 删除计划
  const deleteMutation = useMutation({
    mutationFn: weekPlanApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myPlans'] })
    },
  })

  const archiveMutation = useMutation({
    mutationFn: weekPlanApi.archive,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['myPlans'] }),
  })

  const handleSubmit = (data: { projectId: string; plans: Array<{ content: string; weekday: WeekPlan['weekday'] }> }) => {
    if (editingPlan) {
      const [plan] = data.plans
      updateMutation.mutate({ id: editingPlan.id, content: plan.content, weekday: plan.weekday })
    } else {
      createMutation.mutate(data)
    }
  }

  const handleEdit = (plan: WeekPlan) => {
    if (plan.isAssigned) return // 分配的计划不能编辑
    setEditingPlan(plan)
    setIsModalOpen(true)
  }

  const handleDelete = (id: string) => {
    if (confirm('确定要删除这条计划吗？')) {
      deleteMutation.mutate(id)
    }
  }

  const handleArchive = (id: string) => {
    if (confirm('归档后计划将移入“已归档计划”，确定继续吗？')) archiveMutation.mutate(id)
  }

  const openNewPlanModal = () => {
    setOperationError(undefined)
    setEditingPlan(undefined)
    setIsModalOpen(true)
  }

  const orderedPlans = sortPlansByWeekday(plans)

  return (
    <PageTransition>
      <div className="min-h-screen ml-64 p-[var(--spacing-2xl)]">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-[var(--spacing-2xl)]">
            <div>
              <h1 className="mb-2">我的周计划</h1>
              <p className="text-secondary">管理你的个人周计划和被分配的任务</p>
            </div>
            <button onClick={openNewPlanModal} className="btn-primary flex items-center gap-2">
              <Plus className="w-5 h-5" />
              添加计划
            </button>
          </div>

          {operationError && (
            <div role="alert" className="mb-[var(--spacing-lg)] px-[var(--spacing-md)] py-[var(--spacing-sm)] rounded-[var(--radius-md)] bg-[var(--status-error)]/10 text-[var(--status-error)] text-sm">
              {operationError}
            </div>
          )}

          <div className="mb-[var(--spacing-2xl)]">
            <WeekSelector />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-[var(--spacing-2xl)]">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
            </div>
          ) : orderedPlans.length === 0 ? (
            <div className="text-center py-[var(--spacing-2xl)]">
              <p className="text-secondary mb-[var(--spacing-lg)]">
                本周还没有计划，点击上方按钮添加
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[var(--spacing-lg)]">
              {orderedPlans.map((plan: WeekPlan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  showUser={false}
                  onView={setViewingPlan}
                  onEdit={plan.isAssigned ? undefined : handleEdit}
                  onDelete={plan.isAssigned ? undefined : () => handleDelete(plan.id)}
                  onArchive={plan.isAssigned ? undefined : handleArchive}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <PlanDetailModal plan={viewingPlan} onClose={() => setViewingPlan(undefined)} />

      <PlanModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingPlan(undefined)
        }}
        onSubmit={handleSubmit}
        projects={projects}
        editingPlan={editingPlan}
      />
    </PageTransition>
  )
}
