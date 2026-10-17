import { API_URL } from './mode'
/**
 * Typed client for the FastAPI backend (elderly-backend, app/routers/*.py). Used in live mode only;
 * `getToken` supplies the Firebase ID token (src/lib/firebase.ts).
 */
import type {
  ActionCard, ActionStatus, Address, Assessment, AutonomyRules, Caretaker, CheckInRecord, CheckInStatus, Contact, Currency, EmergencyContact, FamilyMessage, HelpRequest,
  DeviceSettings, Insights, Language, LogEntry, Message, Mood, Reminder, SharingTier,
} from '../lib/types'

const BASE = API_URL
export type TokenFn = () => Promise<string>

export function createApi(getToken: TokenFn) {
  async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
    // Never hang forever: a cold Cloud Run start takes a few seconds, 20 s means something is wrong.
    const res = await fetch(BASE + path, {
      method, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20_000),
      headers: { Authorization: `Bearer ${await getToken()}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    }).catch((e: unknown) => {
      throw new ApiError(0, (e as Error)?.name === 'TimeoutError' ? `The Elderly server didn’t answer (${path})` : `Can’t reach the Elderly server at ${BASE} — check the internet connection, or this address isn’t allowed by the server (CORS)`)
    })
    if (!res.ok) throw new ApiError(res.status, (await res.json().catch(() => ({}))).detail ?? res.statusText)
    return res.status === 204 ? (undefined as T) : res.json()
  }
  const e = (id: string) => `/elders/${encodeURIComponent(id)}`
  return {
    // auth & onboarding (app/routers/me.py) — /me 404 means "signed in but not onboarded"
    me: () => req<{ uid: string; email: string | null; role: 'elder' | 'caretaker'; admin?: boolean }>('GET', '/me'),
    onboardCaretaker: (name: string) => req('POST', '/onboarding/caretaker', { name }),
    // elders (app/routers/elders.py)
    createElder: (b: { name: string; phone: string; language: Language }) =>
      req<{ elderId: string; email: string; tempPassword: string }>('POST', '/elders', b),
    myElders: () => req<{ elderId: string; name: string; language: Language; assessed: boolean }[]>('GET', '/elders'),
    elder: (id: string) => req<{ elderId: string; name: string; phone: string; language: Language; sharingTier: SharingTier; assessment: Assessment | null; caretakerNames?: string[]; face?: string | null; appReady?: boolean; family?: { name: string; photo: string | null }[] }>('GET', e(id)),
    saveAssessment: (id: string, a: Assessment) => req<Assessment>('PUT', `${e(id)}/assessment`, a),
    // settings (app/routers/settings.py)
    rules: (id: string) => req<AutonomyRules>('GET', `${e(id)}/rules`),
    saveRules: (id: string, r: AutonomyRules) => req<AutonomyRules>('PUT', `${e(id)}/rules`, r),
    profile: (id: string) => req<Profile>('GET', `${e(id)}/profile`),
    saveProfile: (id: string, p: Profile) => req<Profile>('PUT', `${e(id)}/profile`, p),
    // approvals & actions (app/routers/approvals.py)
    approvals: (id: string) => req<BackendAction[]>('GET', `${e(id)}/approvals`),
    actions: (id: string, limit = 20) => req<BackendAction[]>('GET', `${e(id)}/actions?limit=${limit}`),
    decide: (id: string, actionId: string, approve: boolean) => req<BackendAction>('POST', `${e(id)}/actions/${actionId}/decide`, { approve }),
    // check-ins, logs, family (app/routers/checkins.py)
    checkinToday: (id: string) => req<TodayCheckIn>('GET', `${e(id)}/checkins/today`),
    checkins: (id: string, days = 7) => req<CheckInRecord[]>('GET', `${e(id)}/checkins?days=${days}`),
    insights: (id: string) => req<Insights>('GET', `${e(id)}/insights`),
    /** "Ask about Mum" — answered from two weeks of check-ins + activity (app/routers/ask_api.py). */
    ask: (id: string, question: string) => req<{ answer: string; days: number }>('POST', `${e(id)}/ask`, { question }),
    logs: (id: string, limit = 20) => req<LogEntry[]>('GET', `${e(id)}/logs?limit=${limit}`),
    family: (id: string, limit = 30) => req<FamilyMessage[]>('GET', `${e(id)}/family?limit=${limit}`),
    // reminders (app/routers/reminders.py)
    reminders: (id: string) => req<Reminder[]>('GET', `${e(id)}/reminders`),
    addReminder: (id: string, r: { title: string; kind?: 'appointment' | 'custom'; time: string; days?: string[]; date?: string }) => req<Reminder>('POST', `${e(id)}/reminders`, r),
    deleteReminder: (id: string, rid: string) => req<void>('DELETE', `${e(id)}/reminders/${rid}`),
    // people (app/routers/people.py)
    contacts: (id: string) => req<Contact[]>('GET', `${e(id)}/contacts`),
    addContact: (id: string, c: ContactIn) => req<Contact>('POST', `${e(id)}/contacts`, c),
    updateContact: (id: string, cid: string, c: ContactIn) => req<Contact>('PUT', `${e(id)}/contacts/${cid}`, c),
    deleteContact: (id: string, cid: string) => req<void>('DELETE', `${e(id)}/contacts/${cid}`),
    requests: (id: string) => req<HelpRequest[]>('GET', `${e(id)}/requests`),
    updateRequest: (id: string, rid: string, status: 'confirmed' | 'done' | 'cancelled') => req<HelpRequest>('PATCH', `${e(id)}/requests/${rid}`, { status }),
    caretakers: (id: string) => req<Caretaker[]>('GET', `${e(id)}/caretakers`),
    /** SOS: records the alert, tells every caretaker live, texts emergency contacts. Elder only. */
    sos: (id: string) => req<{ alert: { id: string; status: string }; emergencyNumber: string;
      firstContact: { name: string; phone: string } | null }>('POST', `${e(id)}/sos`),
    resolveAlert: (id: string, alertId: string) => req<unknown>('POST', `${e(id)}/alerts/${encodeURIComponent(alertId)}`, { action: 'resolve' }),
    /** Natural read-aloud voice (app/routers/voice_api.py): MP3 of the text. */
    tts: async (text: string, language: Language): Promise<Blob> => {
      const res = await fetch(`${BASE}/tts`, {
        method: 'POST', body: JSON.stringify({ text, language }), signal: AbortSignal.timeout(8_000),
        headers: { Authorization: `Bearer ${await getToken()}`, 'Content-Type': 'application/json' },
      })
      if (!res.ok) throw new ApiError(res.status, 'Voice unavailable')
      return res.blob()
    },
    // Address search (app/routers/places_api.py)
    placesSearch: (q: string, country: string, session: string) =>
      req<{ placeId: string; main: string; secondary: string; text: string }[]>('GET', `/places/autocomplete?q=${encodeURIComponent(q)}&country=${country}&session=${session}`),
    place: (placeId: string, session: string) => req<Address>('GET', `/places/${encodeURIComponent(placeId)}?session=${session}`),
    /** Spelling + generic name of a typed medicine (app/medicines.py) — no dose or use advice. */
    checkMedicine: (name: string, country: string) =>
      req<{ input: string; recognised: boolean; suggestion: string | null; generic: string | null }>('POST', '/medicines/check', { name, country }),
    /** Prescription / strip photo → draft medicines for the family to tick (app/rx_scan.py). base64 without the data: prefix. */
    scanPrescription: (image: string, mimeType: string, meals: { breakfast: string | null; lunch: string | null; dinner: string | null }, existing: string[]) =>
      req<{ medicines: ScannedMedicine[]; unreadable: boolean }>('POST', '/medicines/scan', { image, mimeType, meals, existing }),
    deviceSettings: (id: string) => req<DeviceSettings>('GET', `${e(id)}/device-settings`),
    saveDeviceSettings: (id: string, s: DeviceSettings) => req<DeviceSettings>('PUT', `${e(id)}/device-settings`, s),
    /** Cost dashboard (app/routers/admin_api.py) — admins only. */
    adminUsage: (days: number) => req<UsageReport>('GET', `/admin/usage?days=${days}`),
    addPushToken: (token: string) => req<void>('POST', '/me/push-token', { token }),
    savedPlaces: (id: string) => req<SavedPlace[]>('GET', `${e(id)}/places`),
    saveSavedPlaces: (id: string, list: SavedPlace[]) => req<SavedPlace[]>('PUT', `${e(id)}/places`, list),
    appReady: (id: string) => req<void>('POST', `${e(id)}/app-ready`),
    inviteCaretaker: (id: string, email: string) => req<{ status: 'added' | 'invited' }>('POST', `${e(id)}/caretakers`, { email }),
  }
}

/** app/rx_scan.py DraftMedicine — shaped like Medication, plus how sure Gemini was. */
export interface ScannedMedicine { name: string; dose: string; times: string[]; withFood: boolean; notes: string; unsure: boolean; asNeeded: boolean; sameAs: string | null }

/** app/routers/places_saved_api.py — 'Clinic', 'Temple'… the helper books rides to them by name. */
export interface SavedPlace { id: string; name: string; address: Address }

/** app/routers/admin_api.py */
export interface UsageReport {
  days: { date: string; counts: Record<string, number>; costUsd: Record<string, number>; totalUsd: number }[]
  totalUsd: number; prices: Record<string, Record<string, number>>; note: string
}

/** app/routers/settings.py ProfileUpdate */
export interface Profile { name: string; phone: string; language: Language; sharingTier: SharingTier; address: Address | null; emergencyContacts: EmergencyContact[] }

/** app/contacts.py ContactIn — what the caretaker can set on a contact. */
export type ContactIn = Pick<Contact, 'name' | 'phone' | 'kind' | 'relationship' | 'skills' | 'trusted' | 'email' | 'face'>
export const contactIn = (c: Contact): ContactIn =>
  ({ name: c.name, phone: c.phone, kind: c.kind, relationship: c.relationship, skills: c.skills, trusted: c.trusted, email: c.email, face: c.face })

/** app/checkin_store.py TodayCheckIn */
export interface TodayCheckIn { status: CheckInStatus; date: string; time: string; checkIn: CheckInRecord | null }

/** app/tools/actions.py Action — the stored record (REST). Chat messages carry the ActionCard snapshot instead. */
export interface BackendAction {
  id: string; elderId: string; tool: string; args: Record<string, unknown>; status: ActionStatus
  quote: { provider: string; lines: string[]; amountMinor: number; currency: Currency; eta: string; estimate?: boolean; demo?: boolean } | null
  orderId: string | null; deliverTo: string | null; bookingUrl: string | null; requestText: string
  messageId: string | null; decidedBy: string | null; createdAt: string; updatedAt: string
}

/** The tap check-in (app/routers/chat.py CheckInAnswersFrame). null = skipped. */
export interface CheckinAnswers { mood: Mood; sleepQuality: 'well' | 'okay' | 'poorly' | null; ate: boolean | null; medicationTaken: boolean | null }

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

// ---------- WebSocket (app/routers/chat.py) ----------
export type ServerFrame =
  | { type: 'history'; messages: Message[] }
  | { type: 'family_history'; messages: FamilyMessage[] }
  | { type: 'family_message'; message: FamilyMessage }
  | { type: 'family_update'; message: FamilyMessage }   // usedChips changed after a family_action
  | { type: 'checkin'; checkin: TodayCheckIn | null }
  | { type: 'message'; message: Message }
  | { type: 'action_update'; messageId: string; action: ActionCard }
  | { type: 'typing'; tool?: string }   // tool: an action is running
  | { type: 'error'; message: string }
  // app/alerts.py raise_alert: SOS button or an emergency the helper detected — sent to the family the moment it happens
  // app/agent/voice_push.py: a reply's voice, first sentence first (seq 0, 1…), base64 MP3
  | { type: 'audio'; messageId: string; seq: number; last: boolean; mime: string; data: string }
  | { type: 'rules'; rules: AutonomyRules }   // the family changed what the helper may do
  | { type: 'notice'; kind: 'ok' | 'warn' | 'alert'; summary: string }   // e.g. a possible scam — to family
  | { type: 'checkin_done'; kind: 'ok' | 'warn' | 'alert'; summary: string }   // to family: refresh now
  | { type: 'device_settings'; settings: DeviceSettings }   // the family changed the elder app's settings
  | { type: 'alert'; alert: { id: string; source: 'sos_button' | 'agent'; description: string; status: string } }

export function connectChat(elderId: string, getToken: TokenFn, onFrame: (f: ServerFrame) => void,
  on: { open?: () => void; close?: (code: number, reason: string) => void } = {}) {
  // Absolute API URL (https://…run.app) → wss://…; relative (/api in dev) → same host as the page.
  const wsBase = /^https?:/.test(BASE) ? BASE.replace(/^http/, 'ws') : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${BASE}`
  const ws = new WebSocket(`${wsBase}/ws/${encodeURIComponent(elderId)}`)
  ws.onopen = async () => {  // auth must be the first frame, within 10 s
    try {
      const token = await getToken()
      if (ws.readyState !== WebSocket.OPEN) return  // closed while the token was refreshing
      ws.send(JSON.stringify({ type: 'auth', token }))
      on.open?.()
    } catch {
      ws.close(4401, 'token unavailable')  // treated like the server's 4401: ask to sign in again
    }
  }
  ws.onmessage = ev => {
    let frame: ServerFrame
    try { frame = JSON.parse(ev.data) } catch { return }  // ignore anything that isn't a JSON frame
    onFrame(frame)
  }
  ws.onclose = ev => on.close?.(ev.code, ev.reason)
  /** false = not connected, nothing sent. */
  const send = (f: object) => { if (ws.readyState !== WebSocket.OPEN) return false; ws.send(JSON.stringify(f)); return true }
  return {
    close: () => ws.close(),
    say: (text: string) => send({ type: 'message', text }),                          // elder → helper
    startCheckin: (mood: Mood | null) => send({ type: 'start_checkin', mood }),
    checkinAnswers: (a: CheckinAnswers) => send({ type: 'checkin_answers', ...a }),   // the tap check-in
    confirm: (actionId: string, approve: boolean) => send({ type: 'confirm', actionId, approve }),
    familyMessage: (text: string) => send({ type: 'family_message', text }),       // caretaker → elder
    familyReply: (text: string) => send({ type: 'family_reply', text }),           // elder → caretakers
    familyAction: (messageId: string, chip: number) => send({ type: 'family_action', messageId, chip }), // ⏰ remind chip
  }
}

// ---------- 'Try with real AI' (app/routers/sandbox_api.py) — no sign-in ----------
export type SandboxLanguage = 'en-US' | 'hi-IN' | 'hi-Latn' | 'th-TH'
export interface Sandbox {
  elderId: string; language: SandboxLanguage; expiresAt: string
  elder: { name: string; email: string; password: string }
  caretaker: { name: string; email: string; password: string }
}

export async function createSandbox(language: SandboxLanguage): Promise<Sandbox> {
  const res = await fetch(`${BASE}/demo/sandbox`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language }),
    signal: AbortSignal.timeout(30_000),
  }).catch(() => { throw new ApiError(0, 'Can’t reach the Elderly server right now.') })
  if (res.status === 429) throw new ApiError(429, 'You’ve started a lot of sandboxes in the last hour — please wait a little and try again.')
  if (!res.ok) throw new ApiError(res.status, (await res.json().catch(() => ({}))).detail ?? 'The live demo isn’t available right now.')
  return res.json()
}
