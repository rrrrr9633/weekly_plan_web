import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, Loader2, Users, FolderKanban, ZoomIn, ZoomOut, ChevronRight, RotateCcw } from 'lucide-react'
import { PageTransition } from '@/components/layout/PageTransition'
import { WeekSelector } from '@/components/WeekSelector'
import { PlanCard } from '@/components/PlanCard'
import { PlanDetailModal } from '@/components/PlanDetailModal'
import { useWeekStore } from '@/store/weekStore'
import { projectApi, weekPlanApi } from '@/services/api'
import { sortPlansByWeekday } from '@/lib/planSort'
import { PLAN_WEEKDAY_OPTIONS, type PlanWeekday, type WeekPlan } from '@/types'
import { motion } from 'framer-motion'

type BoardViewMode = 'user' | 'project'

const timelineDays: PlanWeekday[] = ['pending', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const weekdayLabels = Object.fromEntries(PLAN_WEEKDAY_OPTIONS.map(({ value, label }) => [value, label])) as Record<PlanWeekday, string>

export function BoardPage() {
  const { currentYear, currentWeek } = useWeekStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<BoardViewMode>('user')
  const [expandedUsers, setExpandedUsers] = useState<Record<string, boolean>>({})
  const [selectedProjectId, setSelectedProjectId] = useState('all')
  const [timelineScale, setTimelineScale] = useState(1)
  const [manualOrders, setManualOrders] = useState<Record<string, string[]>>({})
  const [dropTargetId, setDropTargetId] = useState<string | undefined>(undefined)
  const [dragGhost, setDragGhost] = useState<{ plan: WeekPlan; x: number; y: number } | undefined>(undefined)
  const dragPlanId = useRef<string | undefined>(undefined)
  const dragWeekday = useRef<PlanWeekday | undefined>(undefined)
  const dragInitialOrder = useRef<string[]>([])
  const dragStartPoint = useRef<{ x: number; y: number } | undefined>(undefined)
  const dragDidMove = useRef(false)
  const suppressDetailUntil = useRef(0)
  const pinchPointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchDistance = useRef<number | undefined>(undefined)
  const pinchBaseScale = useRef(1)
  const queryClient = useQueryClient()
  const [viewingPlan, setViewingPlan] = useState<WeekPlan | undefined>()

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['weekPlans', currentYear, currentWeek],
    queryFn: () => weekPlanApi.getByWeek(currentYear, currentWeek),
  })
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: projectApi.getAll,
  })

  useEffect(() => {
    setExpandedUsers({})
  }, [currentYear, currentWeek, plans])

  const saveOrder = useMutation({
    mutationFn: weekPlanApi.saveBoardOrder,
    onSuccess: (updatedPlans) => {
      setManualOrders({})
      queryClient.setQueryData<WeekPlan[]>(['weekPlans', currentYear, currentWeek], (cached = []) =>
        cached.map((plan) => updatedPlans.find((updated) => updated.id === plan.id) ?? plan)
      )
    },
    onError: () => {
      setManualOrders({})
      queryClient.invalidateQueries({ queryKey: ['weekPlans', currentYear, currentWeek] })
    },
  })
  const restoreOrder = useMutation({
    mutationFn: weekPlanApi.restoreBoardOrder,
    onSuccess: () => {
      setManualOrders({})
      queryClient.invalidateQueries({ queryKey: ['weekPlans', currentYear, currentWeek] })
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

  const previewDropTarget = (weekday: PlanWeekday, clientX: number, clientY: number) => {
    if (!dragPlanId.current || dragWeekday.current !== weekday || !dragDidMove.current) return
    const target = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-plan-id]')
    const targetId = target?.dataset.planId
    setDropTargetId(targetId && targetId !== dragPlanId.current ? targetId : undefined)
  }

  const finishDrag = (weekday: PlanWeekday, clientX: number, clientY: number) => {
    const sourceId = dragPlanId.current
    const didMove = dragDidMove.current
    const target = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-plan-id]')
    const targetId = target?.dataset.planId
    const initialOrder = dragInitialOrder.current
    dragPlanId.current = undefined
    dragWeekday.current = undefined
    dragStartPoint.current = undefined
    dragDidMove.current = false
    dragInitialOrder.current = []
    setDragGhost(undefined)
    setDropTargetId(undefined)
    if (!didMove || !sourceId || !target || !targetId || targetId === sourceId || selectedProjectId === 'all') return

    const targetIndex = initialOrder.indexOf(targetId)
    if (targetIndex < 0) return
    const next = initialOrder.filter((id) => id !== sourceId)
    const insertAfterTarget = clientY > target.getBoundingClientRect().top + target.getBoundingClientRect().height / 2
    const targetIndexAfterRemoval = next.indexOf(targetId)
    next.splice(targetIndexAfterRemoval + (insertAfterTarget ? 1 : 0), 0, sourceId)
    const orderKey = `${selectedProjectId}:${weekday}`
    setManualOrders((orders) => ({ ...orders, [orderKey]: next }))
    suppressDetailUntil.current = Date.now() + 250
    saveOrder.mutate({ projectId: selectedProjectId, year: currentYear, weekNumber: currentWeek, weekday, planIds: next })
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
    queryClient.invalidateQueries({ queryKey: ['weekPlans', currentYear, currentWeek] })
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

          <div className="flex flex-col xl:flex-row xl:items-center gap-[var(--spacing-lg)] mb-[var(--spacing-2xl)]">
            <WeekSelector />
            <div className="flex rounded-[var(--radius-full)] surface-3 p-1 w-fit">
              <button type="button" onClick={() => setViewMode('user')} className={`px-4 py-2 rounded-[var(--radius-full)] text-sm transition-colors flex items-center gap-2 ${viewMode === 'user' ? 'bg-[var(--accent)] text-white' : 'text-secondary hover:text-primary'}`}>
                <Users className="w-4 h-4" />按人员
              </button>
              <button type="button" onClick={() => { setViewMode('project'); if (selectedProjectId === 'all' && projects[0]) setSelectedProjectId(projects[0].id) }} className={`px-4 py-2 rounded-[var(--radius-full)] text-sm transition-colors flex items-center gap-2 ${viewMode === 'project' ? 'bg-[var(--accent)] text-white' : 'text-secondary hover:text-primary'}`}>
                <FolderKanban className="w-4 h-4" />按项目
              </button>
            </div>
            {viewMode === 'project' && (
              <select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)} className="px-[var(--spacing-md)] py-[var(--spacing-sm)] surface-3 rounded-[var(--radius-full)] border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none transition-colors">
                <option value="all">全部项目</option>
                {projects.map((project) => <option key={project.id} value={project.id}>[{project.code}] {project.name}</option>)}
              </select>
            )}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary" />
                <input type="text" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="搜索用户、项目、内容..." className="w-full pl-10 pr-4 py-[var(--spacing-sm)] surface-3 rounded-[var(--radius-full)] border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none transition-colors" />
              </div>
            </div>
          </div>

          {isLoading ? (
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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[var(--spacing-lg)]">
                      {userPlans.map((plan) => <PlanCard key={plan.id} plan={plan} showUser={false} variant="content-primary" onView={setViewingPlan} />)}
                    </div>
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
              className="timeline-shell"
              aria-label="项目计划时间流"
            >
              <div className="timeline-toolbar">
                <div>
                  <p className="timeline-kicker">项目时间流</p>
                  <p className="text-sm text-secondary">待定优先，其余计划按周内日期向右推进</p>
                </div>
                <div className="flex items-center gap-2" aria-label="缩放时间流">
                  <button type="button" onClick={() => setTimelineScale((scale) => Math.max(0.65, Number((scale - 0.15).toFixed(2))))} disabled={timelineScale <= 0.65} className="timeline-zoom-button" title="缩小总览">
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="w-10 text-center text-xs text-secondary">{Math.round(timelineScale * 100)}%</span>
                  <button type="button" onClick={() => setTimelineScale((scale) => Math.min(1.25, Number((scale + 0.15).toFixed(2))))} disabled={timelineScale >= 1.25} className="timeline-zoom-button" title="放大细节">
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => setTimelineScale(1)} className="timeline-reset-button" title="重置缩放">100%</button>
                  {selectedProjectId !== 'all' && (
                    <button type="button" onClick={restoreAllDays} className="timeline-reset-button" title="恢复当前项目的默认排序">
                      <RotateCcw className="w-3.5 h-3.5" />恢复排序
                    </button>
                  )}
                </div>
              </div>
              <div className="timeline-viewport" onPointerDown={trackPinch} onPointerMove={updatePinch} onPointerUp={releasePointer} onPointerCancel={releasePointer}>
                <div className="timeline-canvas" style={{ '--timeline-scale': timelineScale } as CSSProperties}>
                  {timelineDays.map((weekday, index) => (
                    <div className="timeline-day" key={weekday}>
                      <div className="timeline-day-header">
                        <span className="timeline-day-index">{index === 0 ? '0' : String(index)}</span>
                        <span>{weekdayLabels[weekday]}</span>
                        <span className="timeline-day-count">{plansByWeekday[weekday].length}</span>
                        {selectedProjectId !== 'all' && plansByWeekday[weekday].length > 0 && (
                          <button type="button" className="timeline-day-reset" onClick={() => restoreOrder.mutate({ projectId: selectedProjectId, year: currentYear, weekNumber: currentWeek, weekday })} title={`恢复${weekdayLabels[weekday]}默认排列`}>
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <div className="timeline-bubbles">
                        {plansByWeekday[weekday].length > 0 ? orderedDayPlans(weekday).map((plan) => (
                          <motion.button
                            layout="position"
                            transition={{ layout: { duration: 0.24, ease: 'easeOut' } }}
                            type="button"
                            key={plan.id}
                            data-plan-id={plan.id}
                            onClick={() => { if (Date.now() >= suppressDetailUntil.current) setViewingPlan(plan) }}
                            onPointerDown={(event) => {
                              if (selectedProjectId === 'all' || (event.pointerType === 'touch' && pinchPointers.current.size > 1)) return
                              dragPlanId.current = plan.id
                              dragWeekday.current = weekday
                              dragInitialOrder.current = orderedDayPlans(weekday).map((item) => item.id)
                              dragStartPoint.current = { x: event.clientX, y: event.clientY }
                              dragDidMove.current = false
                              event.currentTarget.setPointerCapture(event.pointerId)
                            }}
                            onPointerMove={(event) => {
                              if (!dragPlanId.current || !dragStartPoint.current) return
                              const distance = Math.hypot(event.clientX - dragStartPoint.current.x, event.clientY - dragStartPoint.current.y)
                              if (distance < 2) return
                              dragDidMove.current = true
                              setDragGhost({ plan, x: event.clientX, y: event.clientY })
                              previewDropTarget(weekday, event.clientX, event.clientY)
                            }}
                            onPointerUp={(event) => finishDrag(weekday, event.clientX, event.clientY)}
                            onPointerCancel={() => {
                              dragPlanId.current = undefined
                              dragWeekday.current = undefined
                              dragStartPoint.current = undefined
                              dragDidMove.current = false
                              dragInitialOrder.current = []
                              setDragGhost(undefined)
                              setDropTargetId(undefined)
                            }}
                            className={`timeline-bubble ${selectedProjectId !== 'all' ? 'timeline-bubble-draggable' : ''} ${dragGhost?.plan.id === plan.id ? 'timeline-bubble-drag-source' : ''} ${dropTargetId === plan.id ? 'timeline-bubble-drop-target' : ''} ${plan.status === 'archived' ? 'timeline-bubble-archived' : ''}`}
                          >
                            <span className="timeline-bubble-project">{plan.projectCode}</span>
                            <strong className="timeline-bubble-content">{plan.content}</strong>
                            <span className="timeline-bubble-project-name">{plan.projectName}</span>
                            <span className="timeline-bubble-user">{plan.displayName || plan.username}</span>
                            {plan.status === 'archived' && <span className="timeline-bubble-status">已归档</span>}
                          </motion.button>
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
              {dragGhost && (
                <div
                  className={`timeline-drag-ghost ${dragGhost.plan.status === 'archived' ? 'timeline-bubble-archived' : ''}`}
                  style={{ left: dragGhost.x, top: dragGhost.y }}
                  aria-hidden="true"
                >
                  <span className="timeline-bubble-project">{dragGhost.plan.projectCode}</span>
                  <strong className="timeline-bubble-content">{dragGhost.plan.content}</strong>
                  <span className="timeline-bubble-project-name">{dragGhost.plan.projectName}</span>
                  <span className="timeline-bubble-user">{dragGhost.plan.displayName || dragGhost.plan.username}</span>
                  {dragGhost.plan.status === 'archived' && <span className="timeline-bubble-status">已归档</span>}
                </div>
              )}
            </motion.section>
          )}
        </div>
      </div>
      <PlanDetailModal plan={viewingPlan} onClose={() => setViewingPlan(undefined)} />
    </PageTransition>
  )
}
