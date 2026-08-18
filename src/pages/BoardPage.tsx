import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, Loader2, Users, FolderKanban, ZoomIn, ZoomOut, ChevronRight, ChevronUp, ChevronDown, RotateCcw, Maximize2, X } from 'lucide-react'
import { PageTransition } from '@/components/layout/PageTransition'
import { WeekSelector } from '@/components/WeekSelector'
import { ProjectTimeline } from '@/components/ProjectTimeline'
import { PlanDetailModal } from '@/components/PlanDetailModal'
import { PlanModal } from '@/components/PlanModal'
import { useWeekStore } from '@/store/weekStore'
import { useAuthStore } from '@/store/authStore'
import { useTenantContextStore } from '@/store/tenantContextStore'
import { projectApi, weekPlanApi } from '@/services/api'
import { sortPlansByWeekday } from '@/lib/planSort'
import { PLAN_WEEKDAY_OPTIONS, type PlanWeekday, type WeekPlan } from '@/types'
import { motion } from 'framer-motion'

type BoardViewMode = 'user' | 'project'

const timelineDays: PlanWeekday[] = ['pending', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const weekdayLabels = Object.fromEntries(PLAN_WEEKDAY_OPTIONS.map(({ value, label }) => [value, label])) as Record<PlanWeekday, string>

export function BoardPage() {
  const { currentYear, currentWeek } = useWeekStore()
  const currentUser = useAuthStore((state) => state.user)
  const isSuperAdmin = currentUser?.role === 'super_admin'
  const companyId = useTenantContextStore((state) => state.companyId)
  const hasCompanyContext = !isSuperAdmin || Boolean(companyId)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<BoardViewMode>('user')
  const [expandedUsers, setExpandedUsers] = useState<Record<string, boolean>>({})
  const [selectedProjectId, setSelectedProjectId] = useState('all')
  const [timelineScale, setTimelineScale] = useState(0.65)
  const [manualOrders, setManualOrders] = useState<Record<string, string[]>>({})
  const pinchPointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchDistance = useRef<number | undefined>(undefined)
  const pinchBaseScale = useRef(1)
  const queryClient = useQueryClient()
  const [viewingPlan, setViewingPlan] = useState<WeekPlan | undefined>()
  const [editingPlan, setEditingPlan] = useState<WeekPlan | undefined>()
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false)
  const [expandedDay, setExpandedDay] = useState<PlanWeekday | null>(null)

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['weekPlans', currentYear, currentWeek, companyId],
    queryFn: () => weekPlanApi.getByWeek(currentYear, currentWeek),
    enabled: hasCompanyContext,
  })
  const { data: projects = [] } = useQuery({
    queryKey: ['projects', companyId],
    queryFn: projectApi.getAll,
    enabled: hasCompanyContext,
  })

  useEffect(() => {
    setExpandedUsers({})
  }, [currentYear, currentWeek, plans])

  const saveOrder = useMutation({
    mutationFn: weekPlanApi.saveBoardOrder,
    onSuccess: (updatedPlans) => {
      setManualOrders({})
      queryClient.setQueryData<WeekPlan[]>(['weekPlans', currentYear, currentWeek, companyId], (cached = []) =>
        cached.map((plan) => updatedPlans.find((updated) => updated.id === plan.id) ?? plan)
      )
    },
    onError: () => {
      setManualOrders({})
      queryClient.invalidateQueries({ queryKey: ['weekPlans', currentYear, currentWeek, companyId] })
    },
  })
  const restoreOrder = useMutation({
    mutationFn: weekPlanApi.restoreBoardOrder,
    onSuccess: () => {
      setManualOrders({})
      queryClient.invalidateQueries({ queryKey: ['weekPlans', currentYear, currentWeek, companyId] })
    },
  })
  const updatePlan = useMutation({
    mutationFn: ({ id, content, weekday }: { id: string; content: string; weekday: PlanWeekday }) =>
      weekPlanApi.update(id, { content, weekday }),
    onSuccess: () => {
      setViewingPlan(undefined)
      setEditingPlan(undefined)
      setIsPlanModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['weekPlans'] })
    },
  })
  const archivePlan = useMutation({
    mutationFn: weekPlanApi.archive,
    onSuccess: () => {
      setViewingPlan(undefined)
      queryClient.invalidateQueries({ queryKey: ['weekPlans'] })
    },
  })
  const deletePlan = useMutation({
    mutationFn: weekPlanApi.delete,
    onSuccess: () => {
      setViewingPlan(undefined)
      queryClient.invalidateQueries({ queryKey: ['weekPlans'] })
    },
  })

  const claimPlan = useMutation({
    mutationFn: weekPlanApi.claim,
    onSuccess: (updatedPlan) => {
      queryClient.setQueryData<WeekPlan[]>(['weekPlans', currentYear, currentWeek, companyId], (cached = []) =>
        cached.map((plan) => plan.id === updatedPlan.id ? updatedPlan : plan)
      )
      setViewingPlan((plan) => plan?.id === updatedPlan.id ? updatedPlan : plan)
      queryClient.invalidateQueries({ queryKey: ['myPlans'] })
    },
  })
  const leavePlan = useMutation({
    mutationFn: weekPlanApi.leave,
    onSuccess: () => {
      setViewingPlan(undefined)
      queryClient.invalidateQueries({ queryKey: ['weekPlans'] })
      queryClient.invalidateQueries({ queryKey: ['myPlans'] })
    },
  })

  const searchMatchedPlans = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return plans
    return plans.filter((plan) =>
      (plan.displayName || plan.username).toLowerCase().includes(query) ||
      plan.projectName.toLowerCase().includes(query) ||
      plan.projectCode.toLowerCase().includes(query) ||
      plan.content.toLowerCase().includes(query)
    )
  }, [plans, searchQuery])

  const projectPlans = useMemo(
    () => sortPlansByWeekday(
      selectedProjectId === 'all'
        ? searchMatchedPlans
        : searchMatchedPlans.filter((plan) => plan.projectId === selectedProjectId),
      true
    ),
    [searchMatchedPlans, selectedProjectId]
  )

  const plansByUser = useMemo(() => {
    const groups = searchMatchedPlans.reduce<Record<string, WeekPlan[]>>((result, plan) => {
      result[plan.userId] = [...(result[plan.userId] ?? []), plan]
      return result
    }, {})
    return Object.entries(groups).map(([userId, userPlans]) => [userId, sortPlansByWeekday(userPlans)] as const)
  }, [searchMatchedPlans])

  const plansByWeekday = useMemo(() => projectPlans.reduce<Record<PlanWeekday, WeekPlan[]>>(
    (groups, plan) => ({ ...groups, [plan.weekday]: [...groups[plan.weekday], plan] }),
    { pending: [], monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [] }
  ), [projectPlans])

  const orderedDayPlans = (weekday: PlanWeekday) => {
    const dayPlans = plansByWeekday[weekday]
    const orderKey = `${selectedProjectId}:${weekday}`
    const order = manualOrders[orderKey]
    if (!order) return dayPlans
    return [...dayPlans].sort((left, right) => order.indexOf(left.id) - order.indexOf(right.id))
  }

  const saveDayOrder = (weekday: PlanWeekday, planIds: string[]) => {
    if (selectedProjectId === 'all') return
    const orderKey = `${selectedProjectId}:${weekday}`
    setManualOrders((orders) => ({ ...orders, [orderKey]: planIds }))
    saveOrder.mutate({ projectId: selectedProjectId, year: currentYear, weekNumber: currentWeek, weekday, planIds })
  }

  const movePlan = (weekday: PlanWeekday, planId: string, offset: -1 | 1) => {
    const planIds = orderedDayPlans(weekday).map((plan) => plan.id)
    const currentIndex = planIds.indexOf(planId)
    const targetIndex = currentIndex + offset
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= planIds.length) return
    const nextPlanIds = [...planIds]
    ;[nextPlanIds[currentIndex], nextPlanIds[targetIndex]] = [nextPlanIds[targetIndex], nextPlanIds[currentIndex]]
    saveDayOrder(weekday, nextPlanIds)
  }

  const movePlanToPosition = (plan: WeekPlan, requestedPosition: number) => {
    const dayPlans = orderedDayPlans(plan.weekday)
    const planIds = dayPlans.filter((item) => item.id !== plan.id).map((item) => item.id)
    const position = Math.max(1, Math.min(Math.trunc(requestedPosition) || 1, planIds.length + 1))
    planIds.splice(position - 1, 0, plan.id)
    saveDayOrder(plan.weekday, planIds)
  }

  const trackPinch = (event: PointerEvent<HTMLDivElement>) => {
    pinchPointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pinchPointers.current.size === 2) {
      const [first, second] = [...pinchPointers.current.values()]
      pinchDistance.current = Math.hypot(first.x - second.x, first.y - second.y)
      pinchBaseScale.current = timelineScale
    }
  }

  const updatePinch = (event: PointerEvent<HTMLDivElement>) => {
    if (!pinchPointers.current.has(event.pointerId)) return
    pinchPointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pinchPointers.current.size !== 2 || !pinchDistance.current) return
    const [first, second] = [...pinchPointers.current.values()]
    setTimelineScale(Math.min(1.25, Math.max(0.65, pinchBaseScale.current * Math.hypot(first.x - second.x, first.y - second.y) / pinchDistance.current)))
  }

  const releasePointer = (event: PointerEvent<HTMLDivElement>) => {
    pinchPointers.current.delete(event.pointerId)
    if (pinchPointers.current.size < 2) pinchDistance.current = undefined
  }

  const restoreAllDays = async () => {
    if (selectedProjectId === 'all') return
    await Promise.all(timelineDays.map((weekday) => weekPlanApi.restoreBoardOrder({ projectId: selectedProjectId, year: currentYear, weekNumber: currentWeek, weekday })))
    setManualOrders({})
    queryClient.invalidateQueries({ queryKey: ['weekPlans', currentYear, currentWeek, companyId] })
  }

  const canManagePlan = (plan: WeekPlan) =>
    (isSuperAdmin && hasCompanyContext) || plan.participants.some((participant) => participant.userId === currentUser?.id)

  const editAssignedPlan = (plan: WeekPlan) => {
    setViewingPlan(undefined)
    setEditingPlan(plan)
    setIsPlanModalOpen(true)
  }

  const archiveAssignedPlan = (plan: WeekPlan) => {
    if (confirm('归档后计划将移入“已归档计划”，确定继续吗？')) archivePlan.mutate(plan.id)
  }

  const deleteAssignedPlan = (plan: WeekPlan) => {
    if (confirm('确定要删除这条计划吗？')) deletePlan.mutate(plan.id)
  }

  const displayedPlans = viewMode === 'user' ? searchMatchedPlans : projectPlans
  const emptyMessage = searchQuery ? '未找到匹配的计划' : '本周暂无团队计划'

  return (
    <PageTransition>
      <div className="min-h-screen ml-64 p-[var(--spacing-2xl)]">
        <div className="max-w-7xl mx-auto">
          <div className="mb-[var(--spacing-2xl)]">
            <h1 className="mb-2">团队计划大板</h1>
            <p className="text-secondary">查看所有成员的周计划</p>
          </div>

          <div className="flex flex-nowrap items-center gap-[var(--spacing-lg)] mb-[var(--spacing-2xl)] overflow-x-auto pb-1">
            <div className="shrink-0 [&_button]:shrink-0 [&_button]:whitespace-nowrap">
              <WeekSelector />
            </div>
            <div className="flex shrink-0 rounded-[var(--radius-full)] surface-3 p-1">
              <button type="button" onClick={() => setViewMode('user')} className={`shrink-0 whitespace-nowrap px-4 py-2 rounded-[var(--radius-full)] text-sm transition-colors flex items-center gap-2 ${viewMode === 'user' ? 'bg-[var(--accent)] text-white' : 'text-secondary hover:text-primary'}`}>
                <Users className="w-4 h-4" />按人员
              </button>
              <button type="button" onClick={() => { setViewMode('project'); if (selectedProjectId === 'all' && projects[0]) setSelectedProjectId(projects[0].id) }} className={`shrink-0 whitespace-nowrap px-4 py-2 rounded-[var(--radius-full)] text-sm transition-colors flex items-center gap-2 ${viewMode === 'project' ? 'bg-[var(--accent)] text-white' : 'text-secondary hover:text-primary'}`}>
                <FolderKanban className="w-4 h-4" />按项目
              </button>
            </div>
            <div className="min-w-64 flex-1 basis-72 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary" />
                <input type="text" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="搜索用户、项目、内容..." className="w-full pl-10 pr-4 py-[var(--spacing-sm)] surface-3 rounded-[var(--radius-full)] border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none transition-colors" />
              </div>
            </div>
          </div>

          {!hasCompanyContext ? (
            <div className="card text-secondary">请先在侧边栏选择要查看的公司。</div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-[var(--spacing-2xl)]"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
          ) : displayedPlans.length === 0 ? (
            <div className="text-center py-[var(--spacing-2xl)]"><p className="text-secondary">{emptyMessage}</p></div>
          ) : viewMode === 'user' ? (
            <div className="space-y-[var(--spacing-2xl)]">
              {plansByUser.map(([userId, userPlans]) => {
                const isExpanded = expandedUsers[userId] === true
                return (
                <div key={userId} className="space-y-[var(--spacing-md)]">
                  <button
                    type="button"
                    onClick={() => setExpandedUsers((users) => ({ ...users, [userId]: !isExpanded }))}
                    className="w-full flex items-center gap-3 pb-[var(--spacing-sm)] border-b border-[var(--border)] text-left"
                    aria-expanded={isExpanded}
                  >
                    <div className="w-2 h-8 bg-[var(--accent)] rounded-full" />
                    <div className="flex-1"><h3 className="font-bold text-lg">{userPlans[0].displayName || userPlans[0].username}</h3><p className="text-sm text-secondary">{userPlans.length} 个计划 · {isExpanded ? '收起' : '展开'}</p></div>
                    <ChevronRight className={`w-5 h-5 text-secondary transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </button>
                  {isExpanded && (
                    <ProjectTimeline plans={userPlans} onView={setViewingPlan} />
                  )}
                </div>
                )
              })}
            </div>
          ) : (
            <motion.section
              key={`${selectedProjectId}:${currentYear}:${currentWeek}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="timeline-shell project-timeline-shell"
              aria-label="项目计划时间流"
            >
              <div className="timeline-toolbar">
                <div>
                  <p className="timeline-kicker">项目时间流</p>
                  <p className="text-sm text-secondary">待定优先，其余计划按周内日期向右推进</p>
                </div>
                <div className="ml-auto flex min-w-0 items-center gap-2">
                  <select
                    value={selectedProjectId}
                    onChange={(event) => setSelectedProjectId(event.target.value)}
                    aria-label="选择项目"
                    className="w-80 max-w-[32vw] truncate px-[var(--spacing-md)] py-[var(--spacing-sm)] surface-3 rounded-[var(--radius-full)] border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none transition-colors"
                  >
                    <option value="all">全部项目</option>
                    {projects.map((project) => <option key={project.id} value={project.id}>[{project.code}] {project.name}</option>)}
                  </select>
                  <div className="flex shrink-0 items-center gap-2" aria-label="缩放时间流">
                  <button type="button" onClick={() => setTimelineScale((scale) => Math.max(0.65, Number((scale - 0.15).toFixed(2))))} disabled={timelineScale <= 0.65} className="timeline-zoom-button" title="缩小总览">
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="w-10 text-center text-xs text-secondary">{Math.round(timelineScale * 100)}%</span>
                  <button type="button" onClick={() => setTimelineScale((scale) => Math.min(1.25, Number((scale + 0.15).toFixed(2))))} disabled={timelineScale >= 1.25} className="timeline-zoom-button" title="放大细节">
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => setTimelineScale(0.65)} className="timeline-reset-button" title="恢复默认缩放">65%</button>
                  {!isSuperAdmin && selectedProjectId !== 'all' && (
                    <button type="button" onClick={restoreAllDays} className="timeline-reset-button" title="恢复当前项目的默认排序">
                      <RotateCcw className="w-3.5 h-3.5" />恢复排序
                    </button>
                  )}
                </div>
              </div>
            </div>
              <div className="timeline-scroll-shell">
                <div
                  className="timeline-viewport"
                  onPointerDown={trackPinch}
                  onPointerMove={updatePinch}
                  onPointerUp={releasePointer}
                  onPointerCancel={releasePointer}
                >
                <div className="timeline-canvas" style={{ '--timeline-scale': timelineScale } as CSSProperties}>
                  {timelineDays.map((weekday, index) => (
                    <div className="timeline-day" key={weekday}>
                      <div className="timeline-day-header">
                        <span className="timeline-day-index">{index === 0 ? '0' : String(index)}</span>
                        <span>{weekdayLabels[weekday]}</span>
                        <span className="timeline-day-count">{plansByWeekday[weekday].length}</span>
                        <button type="button" className="timeline-day-fullscreen" onClick={() => setExpandedDay(weekday)} aria-label={`全屏查看${weekdayLabels[weekday]}计划`} title="全屏总览">
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                        {!isSuperAdmin && selectedProjectId !== 'all' && plansByWeekday[weekday].length > 0 && (
                          <button type="button" className="timeline-day-reset" onClick={() => restoreOrder.mutate({ projectId: selectedProjectId, year: currentYear, weekNumber: currentWeek, weekday })} title={`恢复${weekdayLabels[weekday]}默认排列`}>
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <div className="timeline-bubbles">
                        {plansByWeekday[weekday].length > 0 ? orderedDayPlans(weekday).map((plan) => (
                          <motion.article
                            layout="position"
                            transition={{ layout: { duration: 0.24, ease: 'easeOut' } }}
                            key={plan.id}
                            className={`timeline-bubble ${plan.status === 'archived' ? 'timeline-bubble-archived' : ''}`}
                          >
                            <button type="button" onClick={() => setViewingPlan(plan)} className="timeline-bubble-details" aria-label={`查看计划：${plan.content}`}>
                              <strong className="timeline-bubble-content">{plan.content}</strong>
                              <span className="timeline-bubble-project-name">{plan.projectName}</span>
                              <span className="timeline-bubble-user">{plan.displayName || plan.username}</span>
                              {plan.status === 'archived' && <span className="timeline-bubble-status">已归档</span>}
                            </button>
                            {!isSuperAdmin && selectedProjectId !== 'all' && (
                              <div className="timeline-bubble-order-actions" aria-label="调整排序">
                                <button type="button" onClick={() => movePlan(weekday, plan.id, -1)} disabled={orderedDayPlans(weekday).findIndex((item) => item.id === plan.id) === 0 || saveOrder.isPending} title="向上移动一格" aria-label="向上移动一格">
                                  <ChevronUp className="w-3.5 h-3.5" />
                                </button>
                                <button type="button" onClick={() => movePlan(weekday, plan.id, 1)} disabled={orderedDayPlans(weekday).findIndex((item) => item.id === plan.id) === orderedDayPlans(weekday).length - 1 || saveOrder.isPending} title="向下移动一格" aria-label="向下移动一格">
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </motion.article>
                        )) : <span className="timeline-empty">暂无计划</span>}
                      </div>
                      {index < timelineDays.length - 1 && (
                        <div className="timeline-connector" aria-hidden="true">
                          <span className="timeline-flow-dot" />
                          <ChevronRight className="timeline-arrow" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              </div>
              {expandedDay && (
                <div className="timeline-fullscreen-backdrop" role="dialog" aria-modal="true" aria-label={`${weekdayLabels[expandedDay]}计划总览`}>
                  <section className="timeline-fullscreen-panel">
                    <header className="timeline-fullscreen-header">
                      <div>
                        <p className="timeline-kicker">全屏总览</p>
                        <h2>{weekdayLabels[expandedDay]} · {plansByWeekday[expandedDay].length} 个计划</h2>
                        <p className="text-secondary">点击气泡查看完整计划内容</p>
                      </div>
                      <button type="button" className="timeline-fullscreen-close" onClick={() => setExpandedDay(null)} aria-label="关闭全屏总览">
                        <X className="w-5 h-5" />
                      </button>
                    </header>
                    <div className="timeline-fullscreen-bubbles">
                      {orderedDayPlans(expandedDay).map((plan) => (
                        <button type="button" key={plan.id} onClick={() => { setExpandedDay(null); setViewingPlan(plan) }} className={`timeline-fullscreen-bubble ${plan.status === 'archived' ? 'timeline-bubble-archived' : ''}`}>
                          <strong>{plan.content}</strong>
                          <span>{plan.projectName}</span>
                          <em>{plan.displayName || plan.username}</em>
                        </button>
                      ))}
                    </div>
                  </section>
                </div>
              )}
            </motion.section>
          )}
        </div>
      </div>
      <PlanDetailModal
        plan={viewingPlan}
        onClose={() => setViewingPlan(undefined)}
        onEdit={viewingPlan && canManagePlan(viewingPlan) ? editAssignedPlan : undefined}
        onArchive={viewingPlan && canManagePlan(viewingPlan) ? archiveAssignedPlan : undefined}
        onDelete={viewingPlan && canManagePlan(viewingPlan) ? deleteAssignedPlan : undefined}
        onClaim={viewingPlan && !isSuperAdmin && !viewingPlan.participants.some((participant) => participant.userId === currentUser?.id) ? (plan) => claimPlan.mutate(plan.id) : undefined}
        onLeave={viewingPlan && !isSuperAdmin && viewingPlan.participants.some((participant) => participant.userId === currentUser?.id && !participant.responsible) ? (plan) => leavePlan.mutate(plan.id) : undefined}
        sortPosition={viewingPlan && !isSuperAdmin && selectedProjectId !== 'all' ? Math.max(1, orderedDayPlans(viewingPlan.weekday).findIndex((plan) => plan.id === viewingPlan.id) + 1) : undefined}
        maxSortPosition={viewingPlan && !isSuperAdmin && selectedProjectId !== 'all' ? orderedDayPlans(viewingPlan.weekday).length : undefined}
        onSortPositionChange={viewingPlan && !isSuperAdmin && selectedProjectId !== 'all' ? movePlanToPosition : undefined}
      />
      <PlanModal
        isOpen={isPlanModalOpen}
        onClose={() => {
          setIsPlanModalOpen(false)
          setEditingPlan(undefined)
        }}
        onSubmit={({ plans }) => {
          const [plan] = plans
          if (editingPlan && plan) updatePlan.mutate({ id: editingPlan.id, ...plan })
        }}
        projects={projects}
        editingPlan={editingPlan}
      />
    </PageTransition>
  )
}
