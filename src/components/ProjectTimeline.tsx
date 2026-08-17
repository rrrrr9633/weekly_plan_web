import { type CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { sortPlansByWeekday } from '@/lib/planSort'
import { PLAN_WEEKDAY_OPTIONS, type PlanWeekday, type WeekPlan } from '@/types'

type ProjectTimelineProps = {
  plans: WeekPlan[]
  showUser?: boolean
  onView: (plan: WeekPlan) => void
  onEdit?: (plan: WeekPlan) => void
  onArchive?: (id: string) => void
  onDelete?: (id: string) => void
}

const timelineDays: PlanWeekday[] = ['pending', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const weekdayLabels = Object.fromEntries(PLAN_WEEKDAY_OPTIONS.map(({ value, label }) => [value, label])) as Record<PlanWeekday, string>

export function ProjectTimeline({ plans, showUser = true, onView, onEdit, onArchive, onDelete }: ProjectTimelineProps) {
  const plansByWeekday = timelineDays.reduce<Record<PlanWeekday, WeekPlan[]>>(
    (groups, weekday) => ({ ...groups, [weekday]: sortPlansByWeekday(plans.filter((plan) => plan.weekday === weekday)) }),
    { pending: [], monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [] }
  )

  return (
    <section className="timeline-shell" aria-label="项目计划时间流">
      <div className="timeline-viewport">
        <div className="timeline-canvas" style={{ '--timeline-scale': 1 } as CSSProperties}>
          {timelineDays.map((weekday, index) => (
            <div className="timeline-day" key={weekday}>
              <div className="timeline-day-header">
                <span className="timeline-day-index">{index === 0 ? '0' : String(index)}</span>
                <span>{weekdayLabels[weekday]}</span>
                <span className="timeline-day-count">{plansByWeekday[weekday].length}</span>
              </div>
              <div className="timeline-bubbles">
                {plansByWeekday[weekday].length ? plansByWeekday[weekday].map((plan) => (
                  <motion.article
                    layout="position"
                    transition={{ layout: { duration: 0.24, ease: 'easeOut' } }}
                    key={plan.id}
                    onClick={() => onView(plan)}
                    className={`timeline-bubble timeline-bubble-static ${plan.status === 'archived' ? 'timeline-bubble-archived' : ''}`}
                  >
                    <span className="timeline-bubble-project">{plan.projectCode}</span>
                    <strong className="timeline-bubble-content">{plan.content}</strong>
                    <span className="timeline-bubble-project-name">{plan.projectName}</span>
                    {showUser && <span className="timeline-bubble-user">{plan.displayName || plan.username}</span>}
                    {plan.isAssigned && <span className="timeline-bubble-status">管理员分配</span>}
                    {plan.status === 'archived' && <span className="timeline-bubble-status">已归档</span>}
                    {(onEdit || onArchive || onDelete) && !plan.isAssigned && (
                      <div className="timeline-bubble-actions" onClick={(event) => event.stopPropagation()}>
                        {onEdit && <button type="button" onClick={() => onEdit(plan)}>编辑</button>}
                        {onArchive && <button type="button" onClick={() => onArchive(plan.id)}>归档</button>}
                        {onDelete && <button type="button" onClick={() => onDelete(plan.id)}>删除</button>}
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
    </section>
  )
}
