import { useState, type CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { ChevronRight, Maximize2, X } from 'lucide-react'
import { sortPlansByWeekday } from '@/lib/planSort'
import { PLAN_WEEKDAY_OPTIONS, type PlanWeekday, type WeekPlan } from '@/types'

type ProjectTimelineProps = {
  plans: WeekPlan[]
  showUser?: boolean
  onView: (plan: WeekPlan) => void
}

const timelineDays: PlanWeekday[] = ['pending', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const weekdayLabels = Object.fromEntries(PLAN_WEEKDAY_OPTIONS.map(({ value, label }) => [value, label])) as Record<PlanWeekday, string>

export function ProjectTimeline({ plans, showUser = true, onView }: ProjectTimelineProps) {
  const [expandedDay, setExpandedDay] = useState<PlanWeekday | null>(null)
  const plansByWeekday = timelineDays.reduce<Record<PlanWeekday, WeekPlan[]>>(
    (groups, weekday) => ({ ...groups, [weekday]: sortPlansByWeekday(plans.filter((plan) => plan.weekday === weekday)) }),
    { pending: [], monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [] }
  )

  return (
    <section className="timeline-shell" aria-label="项目计划时间流">
      <div className="timeline-scroll-shell">
        <div className="timeline-viewport">
          <div className="timeline-canvas" style={{ '--timeline-scale': 1 } as CSSProperties}>
          {timelineDays.map((weekday, index) => (
            <div className="timeline-day" key={weekday}>
              <div className="timeline-day-header">
                <span className="timeline-day-index">{index === 0 ? '0' : String(index)}</span>
                <span>{weekdayLabels[weekday]}</span>
                <span className="timeline-day-count">{plansByWeekday[weekday].length}</span>
                <button type="button" className="timeline-day-fullscreen" onClick={() => setExpandedDay(weekday)} aria-label={`全屏查看${weekdayLabels[weekday]}计划`} title="全屏总览">
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
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
                    <strong className="timeline-bubble-content">{plan.content}</strong>
                    <span className="timeline-bubble-project-name">{plan.projectName}</span>
                    {showUser && <span className="timeline-bubble-user">{plan.displayName || plan.username}</span>}
                    {plan.isAssigned && <span className="timeline-bubble-status">管理员分配</span>}
                    {plan.status === 'archived' && <span className="timeline-bubble-status">已归档</span>}
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
              {plansByWeekday[expandedDay].map((plan) => (
                <button
                  type="button"
                  key={plan.id}
                  onClick={() => { setExpandedDay(null); onView(plan) }}
                  className={`timeline-fullscreen-bubble ${plan.status === 'archived' ? 'timeline-bubble-archived' : ''}`}
                >
                  <strong>{plan.content}</strong>
                  <span>{plan.projectName}</span>
                  {showUser && <em>{plan.displayName || plan.username}</em>}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
