import { create } from 'zustand'
import dayjs from 'dayjs'
import weekOfYear from 'dayjs/plugin/weekOfYear'
import isoWeek from 'dayjs/plugin/isoWeek'

dayjs.extend(weekOfYear)
dayjs.extend(isoWeek)

interface WeekState {
  currentYear: number
  currentWeek: number
  setWeek: (year: number, week: number) => void
  goToToday: () => void
  nextWeek: () => void
  prevWeek: () => void
  getWeekRange: () => { start: string; end: string }
}

export const useWeekStore = create<WeekState>((set, get) => {
  const now = dayjs()
  
  return {
    currentYear: now.year(),
    currentWeek: now.isoWeek(),
    
    setWeek: (year, week) => set({ currentYear: year, currentWeek: week }),
    
    goToToday: () => {
      const now = dayjs()
      set({ currentYear: now.year(), currentWeek: now.isoWeek() })
    },
    
    nextWeek: () => {
      const { currentYear, currentWeek } = get()
      const current = dayjs().year(currentYear).isoWeek(currentWeek)
      const next = current.add(1, 'week')
      set({ currentYear: next.year(), currentWeek: next.isoWeek() })
    },
    
    prevWeek: () => {
      const { currentYear, currentWeek } = get()
      const current = dayjs().year(currentYear).isoWeek(currentWeek)
      const prev = current.subtract(1, 'week')
      set({ currentYear: prev.year(), currentWeek: prev.isoWeek() })
    },
    
    getWeekRange: () => {
      const { currentYear, currentWeek } = get()
      const start = dayjs().year(currentYear).isoWeek(currentWeek).startOf('isoWeek')
      const end = start.endOf('isoWeek')
      return {
        start: start.format('YYYY-MM-DD'),
        end: end.format('YYYY-MM-DD'),
      }
    },
  }
})
