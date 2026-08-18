import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { X, Plus, Minus } from 'lucide-react'
import type { PlanWeekday, Project, User, WeekPlan } from '@/types'
import { PLAN_WEEKDAY_OPTIONS } from '@/types'
import { useWeekStore } from '@/store/weekStore'

type PlanDraft = { content: string; weekday: PlanWeekday }

interface PlanModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: { projectId: string; plans: PlanDraft[] }) => void
  projects: Project[]
  editingPlan?: WeekPlan
  assignee?: User
}

const emptyPlan = (): PlanDraft => ({ content: '', weekday: 'pending' })

export function PlanModal({ isOpen, onClose, onSubmit, projects, editingPlan, assignee }: PlanModalProps) {
  const { currentYear, currentWeek, getWeekRange } = useWeekStore()
  const [selectedProject, setSelectedProject] = useState('')
  const [plans, setPlans] = useState<PlanDraft[]>([emptyPlan()])

  useEffect(() => {
    if (isOpen) {
      setSelectedProject(editingPlan?.projectId ?? '')
      setPlans(editingPlan ? [{ content: editingPlan.content, weekday: editingPlan.weekday }] : [emptyPlan()])
    }
  }, [editingPlan, isOpen])

  const weekRange = getWeekRange()
  const isValid = selectedProject && plans.length > 0 && plans.every((plan) => plan.content.trim())

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!isValid) return
    onSubmit({
      projectId: selectedProject,
      plans: plans.map((plan) => ({ ...plan, content: plan.content.trim() })),
    })
  }

  const updatePlan = (index: number, patch: Partial<PlanDraft>) => {
    setPlans((currentPlans) => currentPlans.map((plan, planIndex) => planIndex === index ? { ...plan, ...patch } : plan))
  }

  const removePlan = (index: number) => {
    setPlans((currentPlans) => currentPlans.length === 1 ? currentPlans : currentPlans.filter((_, planIndex) => planIndex !== index))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-2xl max-h-[calc(100vh-2rem)] overflow-y-auto surface-2 rounded-[var(--radius-lg)] border border-[var(--border)] shadow-[var(--shadow-lg)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between p-[var(--spacing-xl)] border-b border-[var(--border)]">
          <div>
            <h2 className="text-xl font-bold">{editingPlan ? '编辑计划' : assignee ? `为 ${assignee.displayName || assignee.username} 分配计划` : '批量添加计划'}</h2>
            {!editingPlan && <p className="text-sm text-secondary mt-1">{assignee ? '计划将以管理员分配形式保存，分配者与被分配成员均可管理该计划。' : '同一项目的每条计划会分别保存并独立展示'}</p>}
          </div>
          <button onClick={onClose} aria-label="关闭" className="p-1 rounded-[var(--radius-md)] hover:bg-[var(--surface-3)] transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-[var(--spacing-xl)] space-y-[var(--spacing-lg)]">
          <div>
            <label className="block text-sm font-medium mb-2">时间范围</label>
            <div className="text-sm text-secondary px-[var(--spacing-md)] py-[var(--spacing-sm)] surface-3 rounded-[var(--radius-md)]">
              {currentYear}年 第{currentWeek}周 · {weekRange.start} ~ {weekRange.end}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">选择项目 <span className="text-[var(--status-error)]">*</span></label>
            <select
              value={selectedProject}
              onChange={(event) => setSelectedProject(event.target.value)}
              className="w-full px-[var(--spacing-md)] py-[var(--spacing-sm)] surface-3 rounded-[var(--radius-md)] border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none transition-colors"
              required
            >
              <option value="">请选择项目</option>
              {projects.filter((project) => project.status === 'active').map((project) => (
                <option key={project.id} value={project.id}>[{project.code}] {project.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-[var(--spacing-md)]">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium">计划内容 <span className="text-[var(--status-error)]">*</span></label>
              {!editingPlan && (
                <button type="button" onClick={() => setPlans((currentPlans) => [...currentPlans, emptyPlan()])} className="text-sm text-accent hover:opacity-80 flex items-center gap-1">
                  <Plus className="w-4 h-4" /> 添加一条
                </button>
              )}
            </div>
            {plans.map((plan, index) => (
              <div key={index} className="surface-3 rounded-[var(--radius-md)] p-[var(--spacing-md)] space-y-[var(--spacing-sm)]">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-secondary">计划 {index + 1}</span>
                  {!editingPlan && (
                    <button type="button" onClick={() => removePlan(index)} disabled={plans.length === 1} aria-label={`删除计划 ${index + 1}`} className="p-1 text-secondary hover:text-[var(--status-error)] disabled:opacity-40 disabled:cursor-not-allowed">
                      <Minus className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <textarea
                  value={plan.content}
                  onChange={(event) => updatePlan(index, { content: event.target.value })}
                  placeholder="请输入本周计划内容..."
                  rows={3}
                  className="w-full px-[var(--spacing-md)] py-[var(--spacing-sm)] bg-[var(--surface-2)] rounded-[var(--radius-md)] border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none transition-colors resize-none"
                  required
                />
                <select
                  value={plan.weekday}
                  onChange={(event) => updatePlan(index, { weekday: event.target.value as PlanWeekday })}
                  aria-label={`计划 ${index + 1} 的星期`}
                  className="w-full px-[var(--spacing-md)] py-[var(--spacing-sm)] bg-[var(--surface-2)] rounded-[var(--radius-md)] border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none transition-colors"
                >
                  {PLAN_WEEKDAY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div className="flex gap-[var(--spacing-md)] pt-[var(--spacing-md)]">
            <button type="button" onClick={onClose} className="flex-1 px-[var(--spacing-lg)] py-[var(--spacing-sm)] rounded-[var(--radius-full)] surface-3 hover:bg-[var(--surface-4)] transition-all">取消</button>
            <button type="submit" disabled={!isValid} className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" />{editingPlan ? '保存修改' : `添加 ${plans.length} 条计划`}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
