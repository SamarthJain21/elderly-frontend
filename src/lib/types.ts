/**
 * Types mirrored from the FastAPI backend (elderly-backend/app). Keep field names identical so the
 * demo data layer and the live API client are interchangeable.
 */

// app/routers/elders.py
/** hi-Latn = Hinglish: Hindi in Roman letters, mixed with English (how many people in India text). */
export type Language = 'en-US' | 'hi-IN' | 'hi-Latn' | 'th-TH' | 'ja-JP' | 'ko-KR'
// app/autonomy.py
export type Currency = 'INR' | 'THB' | 'SGD'
export type Mode = 'autonomous' | 'elder_confirm' | 'caretaker_approve' | 'blocked'
export type ToolName =
  | 'order_food' | 'order_medicine' | 'book_ride' | 'notify_volunteer' | 'send_message_to_caretaker' | 'set_reminder'
export interface ToolRule { mode: Mode; limitMinor: number | null }
export interface AutonomyRules {
  currency: Currency
  tools: Record<ToolName, ToolRule>
  trustedVolunteersOnly: boolean
}
export type Decision = 'execute' | 'ask_elder' | 'caretaker_approve' | 'block'

// app/schedule.py
export type Day = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
export interface Medication { id: string; name: string; dose: string; times: string[]; withFood: boolean; notes: string }
export interface Assessment {
  timezone: string
  /** null = skipped during setup (not known) */
  sleep: { bedtime: string | null; wakeTime: string | null }
  meals: { breakfast: string | null; lunch: string | null; dinner: string | null }
  medications: Medication[]
  /** enabled false = the family switched the daily check-in off */
  checkIn: { enabled?: boolean; time: string; days: Day[] }
  healthNotes: string
}
export interface Reminder {
  id: string; elderId: string; title: string; kind: 'medication' | 'appointment' | 'custom'
  time: string; days: Day[] | null; date: string | null; medicationId: string | null; active: boolean
}

// app/checkin.py
export type Mood = 'great' | 'good' | 'okay' | 'low' | 'bad'
export type LogKind = 'ok' | 'warn' | 'alert'
export type CheckInStatus = 'not_today' | 'upcoming' | 'due' | 'in_progress' | 'done' | 'missed'
export interface LogEntry {
  id: string; timestamp: string; actor: 'agent' | 'elder' | 'caretaker' | 'system'
  message: string; kind: LogKind; ack: boolean; checkInId: string | null
}

// app/tools/actions.py
export type ActionStatus =
  | 'awaiting_elder' | 'awaiting_caretaker' | 'done' | 'handed_off' | 'declined' | 'cancelled' | 'blocked' | 'failed'
export interface ActionCard {
  id: string; tool: string; title: string; status: ActionStatus; lines: string[]
  amount: string | null; provider: string | null; eta: string | null; orderId: string | null
  deliverTo?: string | null; bookingUrl?: string | null; bookingLabel?: string | null
  demo?: boolean; estimate?: boolean
  /** Frontend-only extras for the showcase. */
  amountMinor?: number; discountMinor?: number; requestText?: string; createdAt?: string
  /** Volunteer request held because the monthly quota is used up (caretaker can top up). */
  needsTopUp?: boolean; skill?: string
}

// app/agent/messages.py + app/agent/family.py
export interface Message {
  id: string; sender: 'elder' | 'agent'; text: string; quickReplies: string[]
  createdAt: string; actedBy: string | null; action: ActionCard | null
}
// app/agent/chips.py — one-tap chips for whoever RECEIVES a family message.
export interface RemindAction { type: 'remind'; title: string; minutes: number | null; at: string | null; date: string | null }
export interface CallAction { type: 'call'; name: string; phone: string }
export interface Chip { label: string; kind: 'message' | 'action'; action: RemindAction | CallAction | null }
export interface FamilyMessage {
  id: string
  /** "system" = a note about something that happened ("⏰ Reminder set for 10:30"). */
  sender: 'elder' | 'caretaker' | 'system'
  senderUid: string; senderName: string; text: string
  /** The message in the receiver's language (family chat across languages), when it differs. */
  translated?: string | null; translatedTo?: string | null
  chips: Chip[]
  /** Indexes of action chips already carried out (claimed atomically by the backend). */
  usedChips: number[]
  viaAgent: boolean; createdAt: string
}

// app/contacts.py
export type ContactKind = 'family' | 'friend' | 'neighbour' | 'volunteer' | 'doctor'
export interface Contact {
  id: string; name: string; phone: string; kind: ContactKind; relationship: string
  skills: string[]; trusted: boolean; email: string; rating: number | null
  /** Key of the illustrated face (demo data, live sandbox); real people get initials until photos exist. */
  face?: string
}
export interface HelpRequest {
  id: string; skill: string; title: string; description: string; preferredTime: string
  volunteerId: string | null; volunteerName: string | null
  status: 'open' | 'notified' | 'confirmed' | 'done' | 'cancelled'; createdAt: string
}

// app/routers/settings.py
export type SharingTier = 'alerts_only' | 'daily_summary' | 'full_access'
export interface Address {
  line1: string; line2: string; landmark: string; city: string; postcode: string
  /** Filled by the backend's geocoding on save. */
  lat?: number | null; lng?: number | null; precision?: 'address' | 'street' | 'city' | null
  /** Picked from Google address search: the server re-reads this place for its exact location. */
  placeId?: string | null
}
/** The elder app's own settings (app/routers/device_api.py) — managed by the elder and their family. */
export interface DeviceSettings { voice: boolean; volume: number; rate: number; textSize: 'normal' | 'large' | 'xlarge' }
export const DEFAULT_DEVICE: DeviceSettings = { voice: true, volume: 1, rate: 1, textSize: 'normal' }
export interface EmergencyContact { name: string; phone: string; relationship: string; face?: string | null }
export const addressLine = (a: Address | null | undefined) =>
  a ? [a.line1, a.line2, a.landmark, a.city, a.postcode].filter(Boolean).join(', ') : ''

// app/checkin.py — one check-in per day
export interface CheckInRecord {
  id: string; elderId: string; date: string; status: 'in_progress' | 'done'
  mood: Mood | null; sleepQuality: 'well' | 'okay' | 'poorly' | null; sleepHours: number | null
  meals: string | null; medicationTaken: boolean | null; anomalies: string[]; urgent: string[]; escalateFlag: boolean
}

// app/routers/people.py
export interface Caretaker { uid: string; name: string; email: string }

// app/insights.py — drift detection + weekly insights (GET /elders/{id}/insights, caretakers)
export type InsightSignal = 'mood' | 'sleep' | 'medication' | 'checkins'
export interface Drift { signal: InsightSignal; days: number; since: string; detail: string }
export interface InsightWeek {
  days: number; checkinsDone: number; moodAvg: number | null; moodTrend: 'up' | 'down' | 'flat' | null
  medsTakenPct: number | null; sleptWellPct: number | null; concerns: string[]
}
export interface Insights { status: 'stable' | 'watch' | 'concern'; drifts: Drift[]; week: InsightWeek; summary: string | null }
