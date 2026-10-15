import { API_URL } from './mode'
/**
 * Typed client for the FastAPI backend (elderly-backend, app/routers/*.py). Used in live mode only;
 * `getToken` supplies the Firebase ID token (src/lib/firebase.ts).
 */
import type {
  ActionCard, ActionStatus, Address, Assessment, AutonomyRules, Caretaker, CheckInRecord, CheckInStatus, Contact, Currency, EmergencyContact, FamilyMessage, HelpRequest,
  Language, LogEntry, Message, Mood, Reminder, SharingTier,
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
    me: () => req<{ uid: string; email: string | null; role: 'elder' | 'caretaker' }>('GET', '/me'),
    onboardCaretaker: (name: string) => req('POST', '/onboarding/caretaker', { name }),
    // elders (app/routers/elders.py)
    createElder: (b: { name: string; phone: string; language: Language }) =>
      req<{ elderId: string; email: string; tempPassword: string }>('POST', '/elders', b),
    myElders: () => req<{ elderId: string; name: string; language: Language; assessed: boolean }[]>('GET', '/elders'),
    elder: (id: string) => req<{ elderId: string; name: string; phone: string; language: Language; sharingTier: SharingTier; assessment: Assessment | null }>('GET', e(id)),
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
    inviteCaretaker: (id: string, email: string) => req<{ status: 'added' | 'invited' }>('POST', `${e(id)}/caretakers`, { email }),
  }
}

/** app/routers/settings.py ProfileUpdate */
export interface Profile { name: string; phone: string; language: Language; sharingTier: SharingTier; address: Address | null; emergencyContacts: EmergencyContact[] }

/** app/contacts.py ContactIn — what the caretaker can set on a contact. */
export type ContactIn = Pick<Contact, 'name' | 'phone' | 'kind' | 'relationship' | 'skills' | 'trusted' | 'email'>
export const contactIn = (c: Contact): ContactIn =>
  ({ name: c.name, phone: c.phone, kind: c.kind, relationship: c.relationship, skills: c.skills, trusted: c.trusted, email: c.email })

/** app/checkin_store.py TodayCheckIn */
export interface TodayCheckIn { status: CheckInStatus; date: string; time: string; checkIn: CheckInRecord | null }

/** app/tools/actions.py Action — the stored record (REST). Chat messages carry the ActionCard snapshot instead. */
export interface BackendAction {
  id: string; elderId: string; tool: string; args: Record<string, unknown>; status: ActionStatus
  quote: { provider: string; lines: string[]; amountMinor: number; currency: Currency; eta: string; estimate?: boolean; demo?: boolean } | null
  orderId: string | null; deliverTo: string | null; bookingUrl: string | null; requestText: string
  messageId: string | null; decidedBy: string | null; createdAt: string; updatedAt: string
}

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
  | { type: 'typing' }
  | { type: 'error'; message: string }

export function connectChat(elderId: string, getToken: TokenFn, onFrame: (f: ServerFrame) => void,
  on: { open?: () => void; close?: (code: number, reason: string) => void } = {}) {
  const ws = new WebSocket(BASE.replace(/^http/, 'ws') + `/ws/${encodeURIComponent(elderId)}`)
  ws.onopen = async () => { ws.send(JSON.stringify({ type: 'auth', token: await getToken() })); on.open?.() } // auth must be first, within 10 s
  ws.onmessage = ev => onFrame(JSON.parse(ev.data))
  ws.onclose = ev => on.close?.(ev.code, ev.reason)
  /** false = not connected, nothing sent. */
  const send = (f: object) => { if (ws.readyState !== WebSocket.OPEN) return false; ws.send(JSON.stringify(f)); return true }
  return {
    close: () => ws.close(),
    say: (text: string) => send({ type: 'message', text }),                          // elder → helper
    startCheckin: (mood: Mood | null) => send({ type: 'start_checkin', mood }),
    confirm: (actionId: string, approve: boolean) => send({ type: 'confirm', actionId, approve }),
    familyMessage: (text: string) => send({ type: 'family_message', text }),       // caretaker → elder
    familyReply: (text: string) => send({ type: 'family_reply', text }),           // elder → caretakers
    familyAction: (messageId: string, chip: number) => send({ type: 'family_action', messageId, chip }), // ⏰ remind chip
  }
}
