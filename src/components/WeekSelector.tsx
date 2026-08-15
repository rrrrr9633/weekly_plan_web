import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { useWeekStore } from '@/store/weekStore'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'

dayjs.extend(isoWeek)

export function WeekSelector() {
  const { currentYear, currentWeek, setWeek, goToToday, nextWeek, prevWeek, getWeekRange } = useWeekStore()
  const [showPicker, setShowPicker] = useState(false)
  const [pickerYear, setPickerYear] = useState(currentYear)
  const [pickerMonth, setPickerMonth] = useState(dayjs().month())
  const selectableYears = Array.from({ length: 11 }, (_, index) => currentYear - 5 + index)

  const weekRange = getWeekRange()

  // 生成指定年月的所有周
  const getWeeksInMonth = (year: number, month: number) => {
    const firstDay = dayjs().year(year).month(month).startOf('month')
    const lastDay = firstDay.endOf('month')
    const weeks: Array<{ week: number; start: string; end: string; isCurrentMonth: boolean }> = []

    let current = firstDay.startOf('isoWeek')
    
    while (current.isBefore(lastDay) || current.isSame(lastDay, 'day')) {
      const weekEnd = current.endOf('isoWeek')
      weeks.push({
        week: current.isoWeek(),
        start: current.format('MM-DD'),
        end: weekEnd.format('MM-DD'),
        isCurrentMonth: current.month() === month || weekEnd.month() === month,
      })
      current = current.add(1, 'week')
    }

    return weeks
  }

  const weeks = getWeeksInMonth(pickerYear, pickerMonth)

  const handleSelectWeek = (week: number) => {
    setWeek(pickerYear, week)
    setShowPicker(false)
  }

  const goToNextMonth = () => {
    const next = dayjs().year(pickerYear).month(pickerMonth).add(1, 'month')
    setPickerYear(next.year())
    setPickerMonth(next.month())
  }

  const goToPrevMonth = () => {
    const prev = dayjs().year(pickerYear).month(pickerMonth).subtract(1, 'month')
    setPickerYear(prev.year())
    setPickerMonth(prev.month())
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-[var(--spacing-md)]">
        <button
          onClick={prevWeek}
          className="p-2 rounded-[var(--radius-md)] text-secondary hover:text-primary hover:bg-[var(--surface-3)] transition-all duration-200"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <button
          onClick={() => setShowPicker(!showPicker)}
          className="flex items-center gap-3 px-[var(--spacing-lg)] py-[var(--spacing-sm)] rounded-[var(--radius-full)] surface-3 hover:bg-[var(--surface-4)] transition-all duration-200 border border-[var(--border)]"
        >
          <Calendar className="w-5 h-5 text-accent" />
          <div className="text-left">
            <div className="text-sm font-bold">
              {currentYear}年 第{currentWeek}周
            </div>
            <div className="text-xs text-secondary">
              {weekRange.start} ~ {weekRange.end}
            </div>
          </div>
        </button>

        <button
          onClick={nextWeek}
          className="p-2 rounded-[var(--radius-md)] text-secondary hover:text-primary hover:bg-[var(--surface-3)] transition-all duration-200"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        <button
          onClick={goToToday}
          className="ml-4 px-[var(--spacing-md)] py-[var(--spacing-sm)] text-sm rounded-[var(--radius-full)] surface-3 hover:bg-[var(--accent)] hover:text-white transition-all duration-200"
        >
          回到本周
        </button>
      </div>

      <AnimatePresence>
        {showPicker && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full mt-2 left-0 w-[400px] surface-2 rounded-[var(--radius-lg)] border border-[var(--border)] shadow-[var(--shadow-lg)] p-[var(--spacing-lg)] z-50"
          >
            <div className="flex items-center justify-between gap-[var(--spacing-sm)] mb-[var(--spacing-lg)]">
              <button onClick={goToPrevMonth} aria-label="上一个月" className="p-1 hover:text-accent transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <select
                  value={pickerYear}
                  onChange={(event) => setPickerYear(Number(event.target.value))}
                  aria-label="选择年份"
                  className="px-2 py-1 surface-3 rounded-[var(--radius-sm)] border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none"
                >
                  {selectableYears.map((year) => (
                    <option key={year} value={year}>
                      {year}年
                    </option>
                  ))}
                </select>
                <select
                  value={pickerMonth}
                  onChange={(event) => setPickerMonth(Number(event.target.value))}
                  aria-label="选择月份"
                  className="px-2 py-1 surface-3 rounded-[var(--radius-sm)] border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none"
                >
                  {Array.from({ length: 12 }, (_, month) => (
                    <option key={month} value={month}>
                      {month + 1}月
                    </option>
                  ))}
                </select>
              </div>
              <button onClick={goToNextMonth} aria-label="下一个月" className="p-1 hover:text-accent transition-colors">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {weeks.map((w) => {
                const isSelected = w.week === currentWeek && pickerYear === currentYear
                return (
                  <button
                    key={`${pickerYear}-${w.week}`}
                    onClick={() => handleSelectWeek(w.week)}
                    disabled={!w.isCurrentMonth}
                    className={`w-full text-left px-[var(--spacing-md)] py-[var(--spacing-sm)] rounded-[var(--radius-md)] transition-all duration-200 ${
                      isSelected
                        ? 'bg-[var(--accent)] text-white'
                        : w.isCurrentMonth
                        ? 'hover:bg-[var(--surface-3)]'
                        : 'opacity-30 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">第 {w.week} 周</span>
                      <span className="text-sm opacity-80">
                        {w.start} ~ {w.end}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
