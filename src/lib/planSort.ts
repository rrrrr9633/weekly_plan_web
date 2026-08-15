import type { PlanWeekday, WeekPlan } from '@/types'

const weekdayRank: Record<PlanWeekday, number> = {
  pending: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
}

export const sortPlansByWeekday = (plans: WeekPlan[], useBoardPosition = false) =>
  [...plans].sort((left, right) => {
    const weekdayOrder = weekdayRank[left.weekday] - weekdayRank[right.weekday]
    if (weekdayOrder !== 0) return weekdayOrder
    if (useBoardPosition) {
      const leftPosition = left.boardPosition ?? Number.MAX_SAFE_INTEGER
      const rightPosition = right.boardPosition ?? Number.MAX_SAFE_INTEGER
      if (leftPosition !== rightPosition) return leftPosition - rightPosition
    }
    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  })
