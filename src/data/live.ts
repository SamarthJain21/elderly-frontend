/**
 * Live mode: Firebase sign-in → backend REST + WebSocket → the same store the screens already read.
 * Screens never call the backend directly; src/data/actions.ts routes each action here when isLive().
 *
 * What comes from where:
 *   REST (on sign-in, on elder switch, and polled every 15 s for caretakers): profile, assessment, rules,
 *     actions + approvals, check-ins, reminders, logs, contacts, help requests, family members.
 *   WebSocket /ws/{elderId}: agent chat (elders only), family thread, today's check-in, typing, action updates.
 *   Caretakers only get the family thread over the socket, so approvals/logs arrive by polling.
 */
import { connectChat, contactIn, createApi, ApiError, type BackendAction, type Profile, type ServerFrame, type TodayCheckIn } from './api'
import { auth, getToken, onUser, signOutUser } from '../lib/firebase'
import { emptyLive, getState, update, type DemoState } from './store'
import { formatMoney } from '../lib/money'
import { notify } from '../components/ui'
import type { ActionCard, Contact, Message, Mood } from '../lib/types'

export const api = createApi(getToken)
let chat: ReturnType<typeof connectChat> | null = null
let chatFor: string | null = null
let pollTimer: number | undefined
let retryTimer: number | undefined
let rulesTimer: number | undefined
let pendingRules: { elderId: string; rules: DemoState['rules'] } | null = null
function flushRules() {
  window.clearTimeout(rulesTimer)
  const p = pendingRules
  pendingRules = null
  if (p && p.elderId) api.saveRules(p.elderId, p.rules).catch(soft("Couldn't save the rules"))
}

const errText = (e: unknown) =>
  e instanceof ApiError ? e.message
    : e instanceof TypeError ? "Can't reach the Elderly server — check your connection"
    : e instanceof Error ? e.message : String(e)
/** Show a failed call to the user instead of failing silently. */
export const fail = (what: string) => (e: unknown) => { notify(`${what}: ${errText(e)}`); throw e }
const soft = (what: string) => (e: unknown) => { notify(`${what}: ${errText(e)}`) }

// ---------- backend → store mappers ----------
const TOOL_TITLES: Record<string, string> = {
  order_food: 'Food order', order_medicine: 'Medicine order', book_ride: 'Ride', set_reminder: 'Reminder',
  send_message_to_caretaker: 'Message to family', notify_volunteer: 'Help request', call_contact: 'Call',
}
/** Same as ActionCard.of in app/tools/actions.py. */
export function toCard(a: BackendAction): ActionCard {
  const q = a.quote
  const line = String(a.args.title ?? a.args.message ?? a.args.label ?? a.args.description ?? '')
  const bookingLabel = !a.bookingUrl ? null : a.bookingUrl.startsWith('tel:') ? `📞 Call ${a.args.name ?? ''}`.trim()
    : `Open ${a.bookingUrl.includes('uber.com') ? 'Uber' : 'Google Maps'} to book`
  return {
    id: a.id, tool: a.tool, title: TOOL_TITLES[a.tool] ?? a.tool, status: a.status,
    lines: (q ? q.lines : [line]).filter(Boolean),
    amount: q ? formatMoney(q.amountMinor, q.currency) : null, amountMinor: q?.amountMinor,
    provider: q?.provider ?? null, eta: q?.eta ?? null, orderId: a.orderId, deliverTo: a.deliverTo,
    bookingUrl: a.bookingUrl, bookingLabel, demo: !!q?.demo, estimate: !!q?.estimate,
    requestText: a.requestText, createdAt: a.createdAt, skill: typeof a.args.skill === 'string' ? a.args.skill : undefined,
  }
}

function applyToday(d: DemoState, t: TodayCheckIn | null) {
  if (!t) return
  const c = t.checkIn
  d.checkin = {
    status: t.status, mood: c?.mood ?? null,
    stage: t.status === 'done' ? 'done' : t.status === 'in_progress' ? 'meds' : null,
  }
  if (c && c.status === 'done' && !d.checkinHistory.some(h => h.id === c.id)) d.checkinHistory.unshift(c)
}

function applyProfile(d: DemoState, p: Profile) {
  d.elder.name = p.name; d.elder.phone = p.phone; d.elder.language = p.language; d.elder.sharingTier = p.sharingTier
  d.elder.address = p.address; d.elder.emergencyContacts = p.emergencyContacts
}

/** Elders can't read the contacts list (caretaker-only), so their call buttons come from the emergency contacts. */
const emergencyAsContacts = (d: DemoState): Contact[] => d.elder.emergencyContacts.map((c, i) => ({
  id: `ec_${i}`, name: c.name, phone: c.phone, kind: 'family', relationship: c.relationship, skills: [], trusted: true, email: '', rating: null,
}))

function upsertMessage(d: DemoState, m: Message) {
  const i = d.messages.findIndex(x => x.id === m.id)
  if (i >= 0) d.messages[i] = m; else d.messages.push(m)
  if (m.action) upsertCard(d, m.action)
}
function upsertCard(d: DemoState, card: ActionCard) {
  const i = d.actions.findIndex(a => a.id === card.id)
  if (i >= 0) d.actions[i] = { ...d.actions[i], ...card }; else d.actions.unshift(card)
}

// ---------- loading ----------
/** Everything the current role may read. Failures of single resources don't block the rest. */
export async function refresh(full = true) {
  const { elderId, role } = getState().live
  if (!elderId) return
  const ct = role === 'caretaker'
  const get = <T,>(p: Promise<T>) => p.catch((e: unknown) => { if (!(e instanceof ApiError && (e.status === 403 || e.status === 409))) console.warn(e); return undefined })
  const [elder, profile, rules, actions, approvals, today, history, reminders, logs, contacts, requests, caretakers, family, insights] = await Promise.all([
    full ? get(api.elder(elderId)) : undefined,
    full ? get(api.profile(elderId)) : undefined,
    full ? get(api.rules(elderId)) : undefined,
    get(api.actions(elderId, 30)),
    ct ? get(api.approvals(elderId)) : undefined,
    get(api.checkinToday(elderId)),
    full ? get(api.checkins(elderId, 7)) : undefined,
    get(api.reminders(elderId)),
    ct ? get(api.logs(elderId, 40)) : undefined,
    ct && full ? get(api.contacts(elderId)) : undefined,
    ct ? get(api.requests(elderId)) : undefined,
    ct && full ? get(api.caretakers(elderId)) : undefined,
    // The socket sends the family thread too; REST covers the first paint and a dropped socket.
    !chatOpen() ? get(api.family(elderId, 40)) : undefined,
    ct ? get(api.insights(elderId)) : undefined,  // drift + weekly note (backend caches the note per day)
  ])
  if (getState().live.elderId !== elderId) return  // switched elder while loading
  update(d => {
    if (elder) {
      d.elder.name = elder.name; d.elder.phone = elder.phone; d.elder.language = elder.language
      if (elder.assessment) d.assessment = elder.assessment
    }
    if (profile) applyProfile(d, profile)
    if (rules) d.rules = rules
    if (actions || approvals) {
      const cards = [...(approvals ?? []), ...(actions ?? [])].map(toCard)
      const seen = new Set<string>()
      d.actions = cards.filter(c => !seen.has(c.id) && seen.add(c.id))
        .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    }
    if (history) d.checkinHistory = history
    if (insights) d.insights = insights
    if (today) applyToday(d, today)
    if (reminders) d.reminders = reminders
    if (logs) d.logs = logs.map(l => ({ ...l, ack: l.ack || d.ackedLogs.includes(l.id) }))
    if (contacts) d.contacts = contacts
    else if (!ct && (profile || full)) d.contacts = emergencyAsContacts(d)
    if (requests) d.requests = requests
    if (caretakers) {
      d.caretakers = caretakers
      d.invites = d.invites.filter(e => !caretakers.some(c => c.email.toLowerCase() === e))
      const me = caretakers.find(c => c.uid === d.live.uid)
      if (me) d.caretaker = { uid: me.uid, name: me.name, email: me.email }
    }
    if (family) d.family = family
    // No "phone connected" event yet: for family, any sign of the elder using the app counts.
    if (ct && !d.onboarded.elder) d.onboarded.elder = d.family.some(f => f.sender === 'elder') || d.checkinHistory.length > 0
      || d.actions.length > 0 || d.checkin.status === 'in_progress' || d.checkin.status === 'done'
    if (!ct && elder) {
      // The elder's app says who set things up: the caretaker, never an emergency contact (often a neighbour).
      // No name known (older backend) → '' and the UI falls back to "your family".
      const name = elder.caretakerNames?.[0] ?? ''
      if (name !== d.caretaker.name) d.caretaker = { uid: '', name, email: '' }
    }
  })
}

// ---------- WebSocket ----------
const chatOpen = () => !!chat && getState().live.connected

function onFrame(f: ServerFrame) {
  update(d => {
    switch (f.type) {
      case 'history': d.messages = f.messages; f.messages.forEach(m => m.action && upsertCard(d, m.action)); break
      case 'family_history': d.family = f.messages; break
      case 'family_message':
        if (!d.family.some(x => x.id === f.message.id)) {
          d.family.push(f.message)
          if (f.message.sender === 'elder' && d.live.role === 'caretaker') d.caretakerUnread += 1
        }
        break
      case 'family_update': { const i = d.family.findIndex(x => x.id === f.message.id); if (i >= 0) d.family[i] = f.message; break }
      case 'checkin': applyToday(d, f.checkin); break
      case 'message':
        upsertMessage(d, f.message)
        if (f.message.sender === 'agent') d.elderUi.typing = false
        break
      case 'action_update':
        upsertCard(d, f.action)
        d.messages.forEach(m => { if (m.id === f.messageId || m.action?.id === f.action.id) m.action = f.action })
        break
      case 'typing': d.elderUi.typing = true; break
      case 'error': d.elderUi.typing = false; break
    }
  })
  if (f.type === 'error') notify(f.message)
  // A new action may need approval or a reminder may have been set — refresh the lists the socket doesn't carry.
  // One agent turn sends several frames; coalesce them into a single refresh.
  if ((f.type === 'message' && f.message.action) || f.type === 'family_update' || f.type === 'action_update') refreshSoon()
}

let refreshTimer: number | undefined
function refreshSoon() {
  window.clearTimeout(refreshTimer)
  refreshTimer = window.setTimeout(() => void refresh(false), 800)
}

function openChat(elderId: string) {
  if (chat && chatFor === elderId) return
  closeChat()
  chatFor = elderId
  // Each socket only reports on itself: a late close/open from an older socket must not touch the current one.
  const conn: NonNullable<typeof chat> = connectChat(elderId, getToken, frame => { if (chat === conn) onFrame(frame) }, {
    open: () => { if (chat === conn) update(d => { d.live.connected = true }) },
    close: code => {
      if (chat !== conn) return
      update(d => { d.live.connected = false; d.elderUi.typing = false })
      chat = null
      if (code === 4401 || code === 4403) { notify(code === 4403 ? 'No access to this person' : 'Please sign in again'); return }
      window.clearTimeout(retryTimer)
      retryTimer = window.setTimeout(() => { if (chatFor === elderId) { chatFor = null; openChat(elderId) } }, 3000)
    },
  })
  chat = conn
}
function closeChat() {
  window.clearTimeout(retryTimer)
  const c = chat; chat = null; chatFor = null
  c?.close()
}
/** Send over the socket, or tell the user it isn't connected. */
export function send(fn: (c: NonNullable<typeof chat>) => boolean) {
  if (chat && fn(chat)) return true
  notify('Not connected yet — trying again in a moment')
  if (chatFor === null) { const id = getState().live.elderId; if (id) openChat(id) }
  return false
}

// ---------- session ----------
function stopAll() {
  flushRules()  // a pending rules edit belongs to the elder being left — save it to them, now
  closeChat()
  window.clearInterval(pollTimer); pollTimer = undefined
  window.clearTimeout(refreshTimer)
}

export async function selectElder(elderId: string) {
  stopAll()
  update(d => {
    if (d.elder.elderId !== elderId) {
      // Different person: drop the previous one's data (keep the session and the device-only extras).
      const keep = { live: d.live, caretaker: d.caretaker, tours: d.tours, ackedLogs: d.ackedLogs }
      Object.assign(d, emptyLive(), keep)
      d.elder.elderId = elderId
    }
    d.live.elderId = elderId; d.live.status = 'ready'
  })
  await refresh(true)
  openChat(elderId)
  if (getState().live.role === 'caretaker') pollTimer = window.setInterval(() => { if (!document.hidden) void refresh(false) }, 15_000)
}

/** Re-read /me and the elders list (after sign-in, onboarding, or adding an elder). */
export async function loadSession() {
  const u = auth.currentUser
  if (!u) { update(d => { d.live.status = 'signedOut' }); return }
  update(d => { d.live.status = 'loading'; d.live.error = undefined })
  try {
    let me
    try { me = await api.me() } catch (e) {
      if (e instanceof ApiError && e.status === 404) { update(d => { d.live.status = 'needsOnboarding'; d.live.role = 'caretaker' }); return }
      throw e
    }
    update(d => { d.live.role = me.role })
    if (me.role === 'elder') return selectElder(u.uid)  // elderId == the elder's auth uid
    const elders = await api.myElders()
    update(d => {
      d.live.elders = elders.map(e => ({ elderId: e.elderId, name: e.name, assessed: e.assessed }))
      if (!d.caretaker.uid || d.caretaker.uid !== u.uid) d.caretaker = { uid: u.uid, name: u.displayName ?? '', email: u.email ?? '' }
    })
    const saved = getState().live.elderId
    const pick = elders.find(e => e.elderId === saved) ?? elders[0]
    if (!pick) { update(d => { d.live.status = 'needsElder' }); return }
    await selectElder(pick.elderId)
  } catch (e) {
    update(d => { d.live.status = 'error'; d.live.error = errText(e) })
  }
}

let booted = false
/** Called once from main.tsx in live mode. */
export function bootLive() {
  if (booted) return
  booted = true
  // Firebase normally answers in well under a second; if it never does, say so instead of spinning.
  let authAnswered = false
  window.setTimeout(() => {
    if (!authAnswered) update(d => { d.live.status = 'error'; d.live.error = `Sign-in didn’t start on ${location.host}. If this is a phone on your Wi-Fi, add this address to Firebase → Authentication → Authorized domains, or use the demo.` })
  }, 10_000)
  onUser(u => {
    authAnswered = true
    stopAll()
    if (!u) {
      update(d => { const keep = { tours: d.tours }; Object.assign(d, emptyLive(), keep); d.live.status = 'signedOut' })
      return
    }
    update(d => {
      if (d.live.uid && d.live.uid !== u.uid) Object.assign(d, emptyLive())  // someone else signed in on this device
      d.live = { ...d.live, uid: u.uid, email: u.email, displayName: u.displayName }
    })
    void loadSession()
  })
  // Come back from the background with fresh data.
  document.addEventListener('visibilitychange', () => { if (!document.hidden && getState().live.status === 'ready') void refresh(false) })
}

export async function signOut() {
  stopAll()
  await signOutUser()
}

// ---------- writes used by actions.ts ----------
const eid = () => getState().live.elderId!

export const live = {
  /** Raise an SOS on the backend. Resolves only once the family has really been alerted; throws otherwise. */
  sos: () => api.sos(eid()),
  resolveAlert: (alertId: string) => api.resolveAlert(eid(), alertId).catch(() => { /* family can still resolve it */ }),
  say: (text: string) => { update(d => { d.messages.forEach(m => { m.quickReplies = [] }) }); if (send(c => c.say(text))) update(d => { d.elderUi.typing = true }) },
  confirm: (actionId: string, approve: boolean) => send(c => c.confirm(actionId, approve)),
  startCheckin: (mood: Mood) => { if (send(c => c.startCheckin(mood))) update(d => { d.elderUi.typing = true }) },
  familyMessage: (text: string) => send(c => c.familyMessage(text)),
  familyReply: (text: string) => send(c => c.familyReply(text)),
  familyAction: (msgId: string, index: number) => send(c => c.familyAction(msgId, index)),

  decide: async (actionId: string, approve: boolean) => {
    update(d => { const a = d.actions.find(x => x.id === actionId); if (a) a.status = approve ? 'done' : 'declined' })  // optimistic
    try { const a = await api.decide(eid(), actionId, approve); update(d => upsertCard(d, toCard(a))) }
    catch (e) { soft("Couldn't send your answer")(e) }
    void refresh(false)
  },
  /** Rules change one toggle at a time — save them together a moment later. */
  saveRulesSoon: () => {
    // Capture WHO and WHAT now: if the caretaker switches elder before the timer fires, these rules still go to
    // the elder they were edited for (never to the newly selected one, and never the reset defaults).
    pendingRules = { elderId: eid(), rules: structuredClone(getState().rules) }
    window.clearTimeout(rulesTimer)
    rulesTimer = window.setTimeout(flushRules, 600)
  },
  saveProfile: async () => {
    const s = getState()
    const p: Profile = { name: s.elder.name, phone: s.elder.phone, language: s.elder.language, sharingTier: s.elder.sharingTier,
      address: s.elder.address ? { ...s.elder.address } : null, emergencyContacts: s.elder.emergencyContacts }
    try { const saved = await api.saveProfile(eid(), p); update(d => applyProfile(d, saved)) }
    catch (e) { soft("Couldn't save")(e) }
  },
  addContact: async (c: Omit<Contact, 'id' | 'rating'>) => {
    try { const saved = await api.addContact(eid(), contactIn({ ...c, id: '', rating: null })); update(d => { d.contacts.push(saved) }) }
    catch (e) { soft("Couldn't add the contact")(e) }
  },
  updateContact: async (c: Contact) => {
    try { await api.updateContact(eid(), c.id, contactIn(c)) } catch (e) { soft("Couldn't save the contact")(e); void refresh(true) }
  },
  deleteContact: async (id: string) => {
    try { await api.deleteContact(eid(), id); update(d => { d.contacts = d.contacts.filter(c => c.id !== id) }) }
    catch (e) { soft("Couldn't remove the contact")(e) }
  },
  addReminder: async (title: string, time: string) => {
    try { const r = await api.addReminder(eid(), { title, time, kind: 'custom', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] }); update(d => { d.reminders.push(r) }) }
    catch (e) { soft("Couldn't add the reminder")(e) }
  },
  deleteReminder: async (id: string) => {
    update(d => { d.reminders = d.reminders.filter(x => x.id !== id) })
    try { await api.deleteReminder(eid(), id) } catch (e) { soft("Couldn't delete the reminder")(e); void refresh(false) }
  },
  invite: async (email: string) => {
    try {
      const r = await api.inviteCaretaker(eid(), email)
      update(d => { if (r.status === 'invited' && !d.invites.includes(email)) d.invites.push(email) })
      notify(r.status === 'added' ? `${email} can now help — they already use Elderly` : `Invite saved — ${email} gets access when they sign in with Google`)
      void refresh(true)
    } catch (e) { soft("Couldn't invite")(e) }
  },
  setRequestStatus: async (id: string, status: 'confirmed' | 'done' | 'cancelled') => {
    try { const r = await api.updateRequest(eid(), id, status); update(d => { const i = d.requests.findIndex(x => x.id === id); if (i >= 0) d.requests[i] = r }) }
    catch (e) { soft("Couldn't update the request")(e) }
  },
}

