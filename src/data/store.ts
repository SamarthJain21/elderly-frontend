/**
 * Demo data layer. One shared state object, persisted to localStorage and synced across tabs/iframes
 * with BroadcastChannel — this stands in for the backend's Firestore + WebSocket fan-out (app/agent/live.py),
 * so the Elder and Caretaker apps update each other live during a showcase.
 */
import { useSyncExternalStore } from 'react'
import type {
  ActionCard, Address, Assessment, AutonomyRules, Caretaker, CheckInRecord, CheckInStatus, Contact, EmergencyContact,
  FamilyMessage, HelpRequest, Language, LogEntry, Message, Mood, Reminder, SharingTier,
} from '../lib/types'
import type { Billing, PlanId } from '../lib/plans'
import { defaultRules } from '../lib/policy'
import { currencyForTimezone } from '../lib/money'
import { SANDBOX_FRAME, isLive } from './mode'

/** amountMinor is US cents — subscriptions and top-ups are billed in USD. */
export interface LedgerEntry { id: string; date: string; description: string; amount: number; kind: 'topup' | 'included' | 'call' | 'emergency' }
export interface Invoice { id: string; date: string; description: string; amountMinor: number; method: string }
export type Overlay =
  | { type: 'call'; who: string; face?: string; live?: boolean }
  | { type: 'incoming'; who: string; face?: string }
  /** Countdown, then `alerted`: family told + a button to call the local emergency number (backend never auto-dials). */
  // alerted = the backend CONFIRMED the alert. sending/failed track the request; never claim help without it.
  | { type: 'emergency'; endsAt: number; alerted?: boolean; sending?: boolean; failed?: boolean; alertId?: string; number?: string }
  | null

/** Live-mode session (Firebase user + which elder we're looking at). Unused in demo mode. */
export interface LiveInfo {
  status: 'demo' | 'loading' | 'signedOut' | 'needsOnboarding' | 'needsElder' | 'ready' | 'error'
  role: 'caretaker' | 'elder' | null
  uid: string | null; email: string | null; displayName: string | null
  elderId: string | null
  elders: { elderId: string; name: string; assessed: boolean }[]
  connected: boolean
  error?: string
}

export interface DemoState {
  v: 9
  onboarded: { caretaker: boolean; elder: boolean }
  caretaker: { uid: string; name: string; email: string }
  elder: {
    /** What the family calls them: Mom, Dad, Grandma, Grandpa… (frontend-only; backend stores `name`). */
    nickname: string
    elderId: string; name: string; phone: string; language: Language; sharingTier: SharingTier
    address: Address | null; emergencyContacts: EmergencyContact[]
    credentials: { email: string; tempPassword: string }; face: string
  }
  /** GET /elders/{id}/caretakers — family members with access. */
  caretakers: Caretaker[]
  /** POST /elders/{id}/caretakers → "invited" (pending until they sign in with Google). */
  invites: string[]
  /** GET /elders/{id}/checkins?days=7 — newest first. */
  checkinHistory: CheckInRecord[]
  assessment: Assessment
  rules: AutonomyRules
  contacts: Contact[]
  messages: Message[]
  family: FamilyMessage[]
  actions: ActionCard[]
  logs: LogEntry[]
  reminders: Reminder[]
  requests: HelpRequest[]
  checkin: { status: CheckInStatus; mood: Mood | null; stage: 'mood' | 'meds' | 'done' | null }
  billing: {
    plan: PlanId; cycle: Billing; renewsOn: string; cancelAtPeriodEnd: boolean
    /** Free calls used this month (from the plan). */
    volunteerUsed: number
    /** Prepaid care credit in US cents. May be negative only after emergency help. */
    balance: number
    ledger: LedgerEntry[]
    invoices: Invoice[]
    paymentMethod: { kind: 'card'; brand: string; last4: string } | { kind: 'wallet'; label: string } | null
  }
  elderUi: { typing: boolean; overlay: Overlay; voice: boolean; lastEmergency?: string }
  caretakerUnread: number
  /** Frontend-only: how the elder's setup link was sent, and which guided tours are finished. */
  setup: { sentVia: string | null; sentAt: string | null }
  tours: { caretaker: boolean; elder: boolean }
  live: LiveInfo
  /** Alerts marked handled on this device (the backend has no endpoint for it yet). */
  ackedLogs: string[]
}

// Live and demo data never share storage.
const KEY = isLive() ? 'elderly-live-v1' : 'elderly-demo-v9'
export const uid = (p = '') => p + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
export const nowIso = () => new Date().toISOString()
const minsAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()

export function medicationReminders(elderId: string, a: Assessment): Reminder[] {
  return a.medications.flatMap(m => m.times.map(t => ({
    id: `med_${elderId}_${m.id}_${t.replace(':', '')}`, elderId, kind: 'medication' as const, time: t,
    title: `Take ${m.name}${m.dose ? ` (${m.dose})` : ''}${m.withFood ? ' with food' : ''}`,
    days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as Reminder['days'], date: null, medicationId: m.id, active: true,
  })))
}

export function seed(): DemoState {
  const elderId = 'elder_rose'
  const timezone = 'Asia/Singapore'
  const assessment: Assessment = {
    timezone,
    sleep: { bedtime: '21:30', wakeTime: '06:30' },
    meals: { breakfast: '08:00', lunch: '12:30', dinner: '19:00' },
    medications: [
      { id: 'm1', name: 'Amlodipine', dose: '5 mg', times: ['08:00'], withFood: false, notes: 'Blood pressure' },
      { id: 'm2', name: 'Metformin', dose: '500 mg', times: ['08:00', '19:00'], withFood: true, notes: '' },
    ],
    checkIn: { time: '09:00', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] },
    healthNotes: 'Mild hearing loss. Low vision — prefers voice. Walks with a cane.',
  }
  return {
    v: 9,
    onboarded: { caretaker: true, elder: true },
    caretaker: { uid: 'ct_emma', name: 'Emma', email: 'emma@example.com' },
    elder: {
      elderId, name: 'Rose', nickname: 'Grandma', phone: '+65 8123 4567', language: 'en-US', sharingTier: 'daily_summary',
      address: { line1: '14 Elm Street', line2: '#03-02', landmark: 'Near Riverside Park', city: 'Singapore', postcode: '238801', lat: 1.3008, lng: 103.8398, precision: 'address' },
      emergencyContacts: [
        { name: 'Emma', phone: '+65 9000 1111', relationship: 'granddaughter' },
        { name: 'David', phone: '+65 9000 2222', relationship: 'neighbour' },
      ],
      face: 'rose',
      credentials: { email: 'elder-7f3a@elderly.app', tempPassword: 'kq7m2xa9hp' },
    },
    caretakers: [{ uid: 'ct_emma', name: 'Emma', email: 'emma@example.com' }],
    invites: [],
    checkinHistory: pastCheckins(elderId),
    assessment,
    rules: defaultRules(currencyForTimezone(timezone)),
    contacts: [
      { id: 'con_emma', name: 'Emma', phone: '+65 9000 1111', kind: 'family', relationship: 'granddaughter', skills: [], trusted: true, email: 'emma@example.com', rating: null, face: 'emma' },
      { id: 'con_tom', name: 'Tom', phone: '+44 20 7946 0000', kind: 'family', relationship: 'grandson', skills: [], trusted: true, email: '', rating: null, face: 'tom' },
      { id: 'con_david', name: 'David', phone: '+65 9000 2222', kind: 'neighbour', relationship: 'neighbour next door', skills: ['check-ins'], trusted: true, email: '', rating: null, face: 'david' },
      { id: 'con_lewis', name: 'Dr. Lewis', phone: '+65 6000 3333', kind: 'doctor', relationship: 'family doctor', skills: [], trusted: true, email: '', rating: null, face: 'lewis' },
      { id: 'con_mia', name: 'Mia Santos', phone: '+65 9000 4444', kind: 'volunteer', relationship: '', skills: ['tech help', 'groceries', 'walking buddy'], trusted: true, email: '', rating: 4.9, face: 'mia' },
      { id: 'con_alex', name: 'Alex Morgan', phone: '+65 9000 5555', kind: 'volunteer', relationship: '', skills: ['plumbing', 'electrical', 'repairs'], trusted: true, email: '', rating: 4.8, face: 'alex' },
      { id: 'con_ben', name: 'Ben Carter', phone: '+65 9000 6666', kind: 'volunteer', relationship: '', skills: ['tech help'], trusted: false, email: '', rating: 4.6, face: 'ben' },
    ],
    messages: [],
    family: [
      { id: 'f1', sender: 'caretaker', senderUid: 'ct_emma', senderName: 'Emma', text: 'Did you enjoy yoga today, Grandma?', chips: [], usedChips: [], viaAgent: false, createdAt: minsAgo(60 * 20) },
      { id: 'f2', sender: 'elder', senderUid: elderId, senderName: 'Rose', text: '😊 Yes, very much!', chips: [], usedChips: [], viaAgent: false, createdAt: minsAgo(60 * 20 - 3) },
    ],
    actions: [
      { id: 'act_seed1', tool: 'order_medicine', title: 'Medicine order', status: 'done', lines: ['1 × Amlodipine 5 mg'], amount: 'S$1', provider: 'Guardian', eta: 'Delivered', orderId: 'ORD-48211', demo: true, createdAt: minsAgo(60 * 26), requestText: 'Order my blood pressure pills' },
    ],
    logs: [
      { id: 'l3', timestamp: minsAgo(60 * 7), actor: 'system', message: 'Blocked a suspected scam call pretending to be the bank', kind: 'warn', ack: true, checkInId: null },
      { id: 'l2', timestamp: minsAgo(60 * 20), actor: 'agent', message: 'Joined Morning Yoga at Riverside Park with 6 neighbours', kind: 'ok', ack: true, checkInId: null },
      { id: 'l1', timestamp: minsAgo(60 * 24), actor: 'agent', message: 'Check-in: feeling good, slept well (~7h), meals: porridge & fish, took medicines', kind: 'ok', ack: true, checkInId: null },
    ],
    reminders: [
      ...medicationReminders(elderId, assessment),
      { id: 'rem_tom', elderId, title: 'Video call with Tom', kind: 'custom', time: '17:00', days: ['sun'], date: null, medicationId: null, active: true },
    ],
    requests: [
      { id: 'req_seed1', skill: 'tech help', title: 'Set up video calls on the tablet', description: 'Wants to see Tom on Sundays', preferredTime: 'this weekend',
        volunteerId: 'con_mia', volunteerName: 'Mia Santos', status: 'confirmed', createdAt: minsAgo(60 * 30) },
    ],
    checkin: { status: 'due', mood: null, stage: null },
    billing: {
      plan: 'basic', cycle: 'monthly', renewsOn: firstOfNextMonth(), cancelAtPeriodEnd: false,
      volunteerUsed: 3, balance: 500, paymentMethod: { kind: 'card', brand: 'Visa', last4: '4242' },
      ledger: [{ id: 'led_seed', date: minsAgo(60 * 24 * 6), description: 'Starter top-up', amount: 500, kind: 'topup' }],
      invoices: [{ id: 'INV-100231', date: minsAgo(60 * 24 * 6), description: 'Care credit top-up', amountMinor: 500, method: 'Visa •••• 4242' }],
    },
    elderUi: { typing: false, overlay: null, voice: true },
    caretakerUnread: 0,
    setup: { sentVia: 'SMS', sentAt: minsAgo(60 * 24 * 6) },
    tours: { caretaker: false, elder: false },
    live: { status: 'demo', role: null, uid: null, email: null, displayName: null, elderId: null, elders: [], connected: false },
    ackedLogs: [],
  }
}

/** A plausible week of check-ins (backend: check_ins/{elderId}_{date}). */
function pastCheckins(elderId: string): CheckInRecord[] {
  const rows: [Mood, CheckInRecord['sleepQuality'], number, string, boolean, string[]][] = [
    ['good', 'well', 7, 'porridge, fish & rice', true, []],
    ['great', 'well', 7.5, 'eggs, noodle soup', true, []],
    ['okay', 'okay', 6, 'toast, soup', true, ['a little tired']],
    ['good', 'well', 7, 'porridge, chicken rice', true, []],
    ['low', 'poorly', 5, 'just tea and biscuits', false, ['knee pain', 'skipped lunch']],
    ['good', 'okay', 6.5, 'oats, fish, vegetables', true, []],
  ]
  return rows.map(([mood, sleepQuality, sleepHours, meals, medicationTaken, anomalies], i) => {
    const d = new Date(Date.now() - (i + 1) * 86_400_000).toISOString().slice(0, 10)
    return { id: `${elderId}_${d}`, elderId, date: d, status: 'done', mood, sleepQuality, sleepHours, meals, medicationTaken, anomalies, urgent: [], escalateFlag: false }
  })
}

/** Starting point for live mode: no demo people or history — everything comes from the backend. */
export function emptyLive(): DemoState {
  const base = seed()
  return {
    ...base,
    // A /try sandbox skips the elder's first-run walkthrough: visitors came to talk to the helper.
    onboarded: { caretaker: true, elder: SANDBOX_FRAME },
    caretaker: { uid: '', name: '', email: '' },
    elder: { ...base.elder, elderId: '', name: '', nickname: '', phone: '', face: '', address: null, emergencyContacts: [],
      credentials: { email: '', tempPassword: '' } },
    caretakers: [], invites: [], checkinHistory: [], contacts: [], messages: [], family: [], actions: [], logs: [],
    reminders: [], requests: [],
    assessment: { ...base.assessment, medications: [], healthNotes: '' },
    checkin: { status: 'upcoming', mood: null, stage: null },
    billing: { ...base.billing, volunteerUsed: 0, balance: 0, ledger: [], invoices: [], paymentMethod: null },
    setup: { sentVia: null, sentAt: null },
    tours: { caretaker: false, elder: false },
    live: { status: 'loading', role: null, uid: null, email: null, displayName: null, elderId: null, elders: [], connected: false },
  }
}

function firstOfNextMonth() {
  const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString()
}

function load(): DemoState | null {
  try {
    const raw = localStorage.getItem(KEY)
    const s = raw ? JSON.parse(raw) : null
    return s && s.v === 9 ? s : null
  } catch { return null }
}

// Live mode: the backend is the source of truth, so state lives only in this tab's memory.
//  - Real people's data never lands in localStorage (shared/family devices).
//  - Each tab has its own socket and elder; syncing state across tabs would mix elders (wrong-recipient bug).
// Demo mode keeps localStorage + cross-tab sync: the showcase's embedded phones rely on it.
const SYNC_ACROSS_TABS = !isLive()
if (isLive()) { try { localStorage.removeItem(KEY) } catch { /* ignore */ } }  // clear anything an older build saved

let state: DemoState = (SYNC_ACROSS_TABS ? load() : null) ?? (isLive() ? emptyLive() : seed())
const listeners = new Set<() => void>()
const channel = SYNC_ACROSS_TABS && typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('elderly-demo') : null
channel?.addEventListener('message', () => { state = load() ?? seed(); listeners.forEach(l => l()) })

function persist() {
  if (SYNC_ACROSS_TABS) {
    try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* private mode: in-memory only */ }
    channel?.postMessage('sync')
  }
  listeners.forEach(l => l())
}

export const getState = () => state
/** What the family calls their person — used everywhere instead of a fixed "Mom". */
export const nick = (s: DemoState) => s.elder.nickname || s.elder.name || 'your loved one'
export function update(fn: (draft: DemoState) => void) {
  const draft = structuredClone(state)
  fn(draft)
  state = draft
  persist()
}
export function resetDemo(fresh?: Partial<DemoState>) {
  state = { ...seed(), ...fresh }
  persist()
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
export const useDemo = () => useSyncExternalStore(subscribe, getState)
