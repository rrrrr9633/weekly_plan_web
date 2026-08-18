export interface User {
  id: string
  username: string
  displayName?: string
  role: 'admin' | 'user' | 'super_admin'
  companyId?: string
  companyName?: string
  createdAt: string
}

export interface Company {
  id: string
  code: string
  name: string
}

export interface Project {
  id: string
  name: string
  code: string
  description?: string
  assistOrg?: string
  status: 'active' | 'inactive'
  hidden: boolean
  createdAt: string
}

export type PlanWeekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'
  | 'pending'

export const PLAN_WEEKDAY_OPTIONS: ReadonlyArray<{ value: PlanWeekday; label: string }> = [
  { value: 'monday', label: '周一' },
  { value: 'tuesday', label: '周二' },
  { value: 'wednesday', label: '周三' },
  { value: 'thursday', label: '周四' },
  { value: 'friday', label: '周五' },
  { value: 'saturday', label: '周六' },
  { value: 'sunday', label: '周日' },
  { value: 'pending', label: '待定' },
]

export interface PlanParticipant {
  userId: string
  displayName: string
  responsible: boolean
}

export interface WeekPlan {
  id: string
  projectId: string
  projectName: string
  projectCode: string
  userId: string
  username: string
  displayName?: string
  year: number
  weekNumber: number
  weekday: PlanWeekday
  weekStart: string
  weekEnd: string
  content: string
  assignedBy?: string
  assignedByUserId?: string
  isAssigned: boolean
  createdAt: string
  updatedAt: string
  status: 'active' | 'archived'
  archivedAt?: string
  boardPosition?: number
  participants: PlanParticipant[]
}

export interface WeekRange {
  year: number
  weekNumber: number
  start: string
  end: string
}
