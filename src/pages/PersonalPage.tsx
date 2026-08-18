import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Loader2, Download, X } from 'lucide-react'
import { PageTransition } from '@/components/layout/PageTransition'
import { WeekSelector } from '@/components/WeekSelector'
import { ProjectFilter } from '@/components/ProjectFilter'
import { ProjectTimeline } from '@/components/ProjectTimeline'
import { PlanModal } from '@/components/PlanModal'
import { PlanDetailModal } from '@/components/PlanDetailModal'
import { useWeekStore } from '@/store/weekStore'
import { useAuthStore } from '@/store/authStore'
import { weekPlanApi, projectApi, ApiError } from '@/services/api'
import type { WeekPlan } from '@/types'

export function PersonalPage() {
  const queryClient = useQueryClient()
  const { currentYear, currentWeek } = useWeekStore()
  const currentUser = useAuthStore((state) => state.user)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<WeekPlan | undefined>()
  const [viewingPlan, setViewingPlan] = useState<WeekPlan | undefined>()
  const [operationError, setOperationError] = useState<string | undefined>()
  const [isExporting, setIsExporting] = useState(false)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [selectedExportProjectIds, setSelectedExportProjectIds] = useState<string[] | null>(null)
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[] | null>([])

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

  const filteredPlans = useMemo(
    () => selectedProjectIds === null
      ? []
      : selectedProjectIds.length === 0
        ? plans.filter((plan) => !projects.find((project) => project.id === plan.projectId)?.hidden)
        : plans.filter((plan) => selectedProjectIds.includes(plan.projectId)),
    [plans, projects, selectedProjectIds]
  )

  const visibleProjectIds = projects.filter((project) => !project.hidden).map((project) => project.id)
  const effectiveExportProjectIds = selectedExportProjectIds === null
    ? []
    : selectedExportProjectIds.length === 0
      ? visibleProjectIds
      : selectedExportProjectIds

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
    mutationFn: ({ id, projectId, content, weekday }: { id: string; projectId: string; content: string; weekday: WeekPlan['weekday'] }) =>
      weekPlanApi.update(id, { projectId, content, weekday }),
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

  const leaveMutation = useMutation({
    mutationFn: weekPlanApi.leave,
    onSuccess: () => {
      setViewingPlan(undefined)
      queryClient.invalidateQueries({ queryKey: ['myPlans'] })
      queryClient.invalidateQueries({ queryKey: ['weekPlans'] })
    },
  })

  const handleSubmit = (data: { projectId: string; plans: Array<{ content: string; weekday: WeekPlan['weekday'] }> }) => {
    if (editingPlan) {
      const [plan] = data.plans
      updateMutation.mutate({ id: editingPlan.id, projectId: data.projectId, content: plan.content, weekday: plan.weekday })
    } else {
      createMutation.mutate(data)
    }
  }

  const handleEdit = (plan: WeekPlan) => {
    setViewingPlan(undefined)
    setEditingPlan(plan)
    setIsModalOpen(true)
  }

  const handleDelete = (id: string) => {
    if (confirm('确定要删除这条计划吗？')) {
      setViewingPlan(undefined)
      deleteMutation.mutate(id)
    }
  }

  const handleArchive = (id: string) => {
    if (confirm('归档后计划将移入“已归档计划”，确定继续吗？')) {
      setViewingPlan(undefined)
      archiveMutation.mutate(id)
    }
  }

  const openNewPlanModal = () => {
    setOperationError(undefined)
    setEditingPlan(undefined)
    setIsModalOpen(true)
  }

  const openExportModal = () => {
    setOperationError(undefined)
    setSelectedExportProjectIds(null)
    setIsExportModalOpen(true)
  }

  const exportWeekReport = async () => {
    if (effectiveExportProjectIds.length === 0) {
      setOperationError('请至少选择一个项目后再导出周报')
      return
    }

    setOperationError(undefined)
    setIsExporting(true)
    try {
      await weekPlanApi.exportMyWeekReport(currentYear, currentWeek, effectiveExportProjectIds)
      setIsExportModalOpen(false)
    } catch (error) {
      setOperationError(error instanceof ApiError ? error.message : '导出周报失败，请稍后重试')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <PageTransition>
      <div className="min-h-screen ml-64 p-[var(--spacing-2xl)]">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-[var(--spacing-2xl)]">
            <div>
              <h1 className="mb-2">我的周计划</h1>
              <p className="text-secondary">管理你的个人周计划和被分配的任务</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={openExportModal}
                disabled={isExporting}
                className="btn-secondary flex items-center gap-2"
              >
                {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                导出周报
              </button>
              <button onClick={openNewPlanModal} className="btn-primary flex items-center gap-2">
                <Plus className="w-5 h-5" />
                添加计划
              </button>
            </div>
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
          ) : (
            <ProjectTimeline
              plans={filteredPlans}
              projects={projects}
              selectedProjectIds={selectedProjectIds}
              onProjectFilterChange={setSelectedProjectIds}
              showUser={false}
              onView={setViewingPlan}
            />
          )}
        </div>
      </div>

      <PlanDetailModal
        plan={viewingPlan}
        onClose={() => setViewingPlan(undefined)}
        onEdit={handleEdit}
        onArchive={(plan) => handleArchive(plan.id)}
        onDelete={(plan) => handleDelete(plan.id)}
        onLeave={viewingPlan?.participants.some((participant) => participant.userId === currentUser?.id && !participant.responsible) ? (plan) => leaveMutation.mutate(plan.id) : undefined}
      />

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

      {isExportModalOpen && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-labelledby="export-report-title">
          <section className="w-full max-w-md rounded-[var(--radius-lg)] bg-white p-[var(--spacing-xl)] shadow-[var(--shadow-lg)]">
            <header className="flex items-start justify-between gap-4">
              <div>
                <h2 id="export-report-title" className="text-xl">选择导出项目</h2>
                <p className="mt-2 text-sm text-secondary">仅导出本次勾选项目在当前周的计划。</p>
              </div>
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                disabled={isExporting}
                className="grid h-8 w-8 place-items-center rounded-[var(--radius-sm)] text-secondary transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]"
                aria-label="关闭项目选择"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="mt-[var(--spacing-lg)]">
              <ProjectFilter
                projects={projects}
                selectedProjectIds={selectedExportProjectIds}
                onChange={setSelectedExportProjectIds}
              />
            </div>

            <footer className="mt-[var(--spacing-xl)] flex justify-end gap-3">
              <button type="button" onClick={() => setIsExportModalOpen(false)} disabled={isExporting} className="btn-secondary">
                取消
              </button>
              <button type="button" onClick={exportWeekReport} disabled={isExporting || effectiveExportProjectIds.length === 0} className="btn-primary flex items-center gap-2">
                {isExporting && <Loader2 className="h-4 w-4 animate-spin" />}
                导出周报
              </button>
            </footer>
          </section>
        </div>
      )}
    </PageTransition>
  )
}
