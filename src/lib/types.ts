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

export interface ChatMessage {
  id: string
  sender: 'elder' | 'agent'
  text: string
  quickReplies: string[]
  createdAt: string
  actedBy: string | null
}

export type Mood = 'great' | 'good' | 'okay' | 'low' | 'bad'
export type CheckInStatus = 'not_today' | 'upcoming' | 'due' | 'in_progress' | 'done' | 'missed'

export interface CheckIn {
  id: string
  elderId: string
  date: string
  status: 'in_progress' | 'done'
  mood: Mood | null
  sleepQuality: 'well' | 'okay' | 'poorly' | null
  sleepHours: number | null
  meals: string | null
  medicationTaken: boolean | null
  anomalies: string[]
  urgent: string[]
  escalateFlag: boolean
  needsMedication: boolean
  startedAt: string
  completedAt: string | null
}

export interface TodayCheckIn {
  status: CheckInStatus
  date: string
  time: string
  checkIn: CheckIn | null
}

export interface LogEntry {
  id: string
  timestamp: string
  actor: 'agent' | 'elder' | 'caretaker' | 'system'
  message: string
  kind: 'ok' | 'warn' | 'alert'
  ack: boolean
  checkInId: string | null
}

export const MOOD_EMOJI: Record<Mood, string> = { great: '😄', good: '😊', okay: '😐', low: '😟', bad: '😢' }

export type Mode = 'autonomous' | 'elder_confirm' | 'caretaker_approve' | 'blocked'
export type ToolName = 'order_food' | 'order_medicine' | 'book_ride' | 'notify_volunteer' | 'send_message_to_caretaker' | 'set_reminder'

export interface ToolRule {
  mode: Mode
  limitMinor: number | null
}

export interface AutonomyRules {
  currency: 'INR' | 'THB' | 'SGD'
  tools: Record<ToolName, ToolRule>
  trustedVolunteersOnly: boolean
}

export type SharingTier = 'alerts_only' | 'daily_summary' | 'full_access'

export interface EmergencyContact {
  name: string
  phone: string
  relationship: string
}

export interface Profile {
  name: string
  phone: string
  language: Language
  sharingTier: SharingTier
  emergencyContacts: EmergencyContact[]
}

export interface Approval {
  id: string
  actionId: string
  elderId: string
  status: 'pending' | 'approved' | 'declined'
  elderRequestText: string
}
