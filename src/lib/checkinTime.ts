export type CheckinTime = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

export function parseShortcut(input: string): CheckinTime | null {
  const digits = input.replace(/\D/g, '')
  if (digits.length !== 9 && digits.length !== 10) return null
  const year = 2000 + Number(digits.slice(0, 2))
  const month = Number(digits.slice(2, 4))
  const day = Number(digits.slice(4, 6))
  const hour = Number(digits.slice(6, -2))
  const minute = Number(digits.slice(-2))
  return validTime({ year, month, day, hour, minute })
}

export function fromDateParts(date: string, hour: number, minute: number): CheckinTime | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) return null
  return validTime({
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour,
    minute,
  })
}

export function formatShortcut(time: CheckinTime): string {
  const hour = time.hour < 10 ? String(time.hour) : String(time.hour).padStart(2, '0')
  return `${String(time.year).slice(-2)}${pad(time.month)}${pad(time.day)}${hour}${pad(time.minute)}`
}

export function dateValue(time: CheckinTime): string {
  return `${time.year}-${pad(time.month)}-${pad(time.day)}`
}

export function hourMinute(time: CheckinTime): string {
  return `${pad(time.hour)}:${pad(time.minute)}`
}

export function weekdayOf(time: CheckinTime): string {
  return WEEKDAYS[new Date(time.year, time.month - 1, time.day).getDay()]
}

export function dateLine(time: CheckinTime): string {
  return `${time.year}/${pad(time.month)}/${pad(time.day)} ${weekdayOf(time)}`
}

export function fromIso(value?: string | null): CheckinTime | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})/.exec(value.trim())
  if (!match) return null
  return validTime({
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  })
}

export function nowCheckin(): CheckinTime {
  const now = new Date()
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: now.getHours(),
    minute: now.getMinutes(),
  }
}

function validTime(time: CheckinTime): CheckinTime | null {
  if (time.month < 1 || time.month > 12) return null
  if (time.day < 1 || time.day > 31) return null
  if (time.hour < 0 || time.hour > 23) return null
  if (time.minute < 0 || time.minute > 59) return null
  const date = new Date(time.year, time.month - 1, time.day, time.hour, time.minute)
  if (
    date.getFullYear() !== time.year ||
    date.getMonth() !== time.month - 1 ||
    date.getDate() !== time.day
  ) return null
  return time
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}
