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
  action: ActionCard | null
}

export type ActionStatus = 'awaiting_elder' | 'awaiting_caretaker' | 'done' | 'handed_off' | 'declined' | 'cancelled' | 'blocked' | 'failed'

export interface ActionCard {
  id: string
  tool: string
  title: string
  status: ActionStatus
  lines: string[]
  amount: string | null
  provider: string | null
  eta: string | null
  orderId: string | null
  deliverTo: string | null
  bookingUrl: string | null
  bookingLabel: string | null
  demo: boolean
  estimate: boolean
}

export interface Quote {
  provider: string
  lines: string[]
  amountMinor: number
  currency: 'INR' | 'THB' | 'SGD'
  eta: string
  estimate: boolean
  demo: boolean
}

export interface Action {
  id: string
  elderId: string
  tool: string
  args: Record<string, unknown>
  status: ActionStatus
  quote: Quote | null
  orderId: string | null
  deliverTo: string | null
  bookingUrl: string | null
  requestText: string
  createdAt: string
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

export interface Address {
  line1: string
  line2: string
  landmark: string
  city: string
  postcode: string
  lat: number | null
  lng: number | null
  precision: 'address' | 'street' | 'city' | null
}

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
  address: Address | null
  emergencyContacts: EmergencyContact[]
}


export type ChipAction =
  | { type: 'remind'; title: string; minutes: number | null; at: string | null }
  | { type: 'call'; name: string; phone: string }

/** One-tap option for whoever receives a family message: send the label, or run a small action. */
export interface Chip {
  label: string
  kind: 'message' | 'action'
  action: ChipAction | null
}

export interface FamilyMessage {
  id: string
  sender: 'elder' | 'caretaker' | 'system'
  senderUid: string
  senderName: string
  text: string
  chips: Chip[]
  usedChips: number[]
  viaAgent: boolean
  createdAt: string
}

export type ContactKind = 'family' | 'friend' | 'neighbour' | 'volunteer' | 'doctor'

export interface ContactIn {
  name: string
  phone: string
  kind: ContactKind
  relationship: string
  skills: string[]
  trusted: boolean
  email: string
}

export interface Contact extends ContactIn {
  id: string
  rating: number | null
}

export interface HelpRequest {
  id: string
  skill: string
  title: string
  description: string
  preferredTime: string
  volunteerName: string | null
  status: 'open' | 'notified' | 'confirmed' | 'done' | 'cancelled'
  notifiedVia: ('sms' | 'log')[]
  createdAt: string
}

export interface CaretakerInfo {
  uid: string
  name: string
  email: string
}
