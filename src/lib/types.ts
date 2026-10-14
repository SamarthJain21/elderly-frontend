// Mirrors backend app/schedule.py and app/routers/elders.py.
export type Day = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
export const ALL_DAYS: readonly Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
export const DAY_LABEL: Record<Day, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
}

export type Language = 'en-US' | 'hi-IN' | 'th-TH' | 'ja-JP' | 'ko-KR'

export interface Medication {
  id?: string
  name: string
  dose: string
  times: string[]
  withFood: boolean
  notes: string
}

export interface Assessment {
  timezone: string
  sleep: { bedtime: string; wakeTime: string }
  meals: { breakfast: string | null; lunch: string | null; dinner: string | null }
  medications: Medication[]
  checkIn: { time: string; days: Day[] }
  healthNotes: string
}

export interface ElderSummary {
  elderId: string
  name: string
  language: Language
  assessed: boolean
}

export interface ElderProfile {
  elderId: string
  name: string
  phone: string
  language: Language
  sharingTier: string
  assessment: Assessment | null
}

export type ReminderKind = 'medication' | 'appointment' | 'custom'

export interface Reminder {
  id: string
  elderId: string
  title: string
  kind: ReminderKind
  time: string
  days: Day[] | null
  date: string | null
  medicationId: string | null
  active: boolean
}

export interface TodayReminders {
  date: string
  timezone: string
  reminders: Reminder[]
}

export const REMINDER_ICON: Record<ReminderKind, string> = { medication: '💊', appointment: '📅', custom: '⏰' }
