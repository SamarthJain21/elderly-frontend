/**
 * Everything the two apps can do, against the demo store. Each function maps to a backend call:
 *   elderSay           → WS {"type":"message"}           (agent turn with tool use, app/routers/chat.py)
 *   elderConfirm       → WS {"type":"confirm"}           (Yes/No on an action card)
 *   startCheckin       → WS {"type":"start_checkin"}
 *   caretakerSend      → WS {"type":"family_message"}    elderFamilyReply → {"type":"family_reply"}
 *   chat next steps    → only quick replies, POST /elders/{id}/reminders, or a tel: link — no new backend work
 *   caretakerDecide    → POST /elders/{id}/actions/{actionId}/decide
 *   setRule…           → PUT /elders/{id}/rules          contacts → /elders/{id}/contacts
 * The "agent" here is a keyword stand-in for Gemini; the decision step is the same code as app/autonomy.py.
 */
import { getState, nick, nowIso, uid, update, type DemoState } from './store'
import { addressLine, type ActionCard, type Address, type Chip, type Currency, type EmergencyContact, type FamilyMessage, type HelpRequest, type Mood, type ToolName } from '../lib/types'
import { decide } from '../lib/policy'
import { formatMoney } from '../lib/money'
import { CREDIT, formatBalance, formatUsd, planById, priceFor, type Billing, type PlanId } from '../lib/plans'
import { isLive } from './mode'
import { deviceOf, live, saveDevice } from './live'
import type { Contact } from '../lib/types'

/** Open the phone dialler (live mode: real calls go through the phone, not the app). */
/** Sandbox numbers (+000…) are never dialled or texted (backend app/sms.py). */
export const isPretendNumber = (phone: string) => phone.replace(/\s/g, '').startsWith('+000')
const dial = (phone: string) => { if (phone) window.location.href = `tel:${phone.replace(/[^\d+]/g, '')}` }

// ---------- helpers ----------
const log = (d: DemoState, message: string, kind: 'ok' | 'warn' | 'alert' = 'ok', actor: 'agent' | 'elder' | 'caretaker' | 'system' = 'agent') =>
  d.logs.unshift({ id: uid('log_'), timestamp: nowIso(), actor, message, kind, ack: kind !== 'alert', checkInId: null })

const agentMsg = (d: DemoState, text: string, quickReplies: string[] = [], action: ActionCard | null = null) =>
  d.messages.push({ id: uid('m_'), sender: 'agent', text, quickReplies, createdAt: nowIso(), actedBy: null, action })

const elderMsg = (d: DemoState, text: string) =>
  d.messages.push({ id: uid('m_'), sender: 'elder', text, quickReplies: [], createdAt: nowIso(), actedBy: null, action: null })

/** Agent "thinking" delay so the typing indicator is visible. */
function agentTurn(fn: (d: DemoState) => void, delay = 900, activity: string | null = null) {
  update(d => { d.elderUi.typing = true; d.elderUi.activity = activity })
  setTimeout(() => update(d => { d.elderUi.typing = false; d.elderUi.activity = null; fn(d) }), delay)
}

/** Free volunteer calls included in the plan this month. */
export const quotaTotal = (s: DemoState) => planById(s.billing.plan).volunteerCalls
export const quotaLeft = (s: DemoState) => Math.max(0, quotaTotal(s) - s.billing.volunteerUsed)
/** Calls the prepaid credit can still pay for (never counts the emergency allowance). */
export const creditCalls = (s: DemoState) => Math.max(0, Math.floor(s.billing.balance / CREDIT.callPriceUsd))
/** What the elder sees: free calls left + calls covered by credit. */
export const helperVisitsLeft = (s: DemoState) => quotaLeft(s) + creditCalls(s)
/** Urgent help is never blocked by money (it may take the balance negative). */
export const isUrgent = (text: string) => /(urgent|emergency|fell|fall|flood|burst|smoke|gas|no power|locked out|can'?t get up)/i.test(text)
/** Can this call be paid — free call, enough credit, or an emergency within the floor? */
export const canCover = (s: DemoState, urgent = false) =>
  quotaLeft(s) > 0 || s.billing.balance >= CREDIT.callPriceUsd || (urgent && s.billing.balance - CREDIT.callPriceUsd >= CREDIT.emergencyFloorUsd)

/** Pay for one volunteer call: free call first, then credit; emergencies may go negative. */
function chargeCall(d: DemoState, what: string, urgent: boolean): 'included' | 'credit' | 'emergency' | 'blocked' {
  const entry = (description: string, amount: number, kind: 'included' | 'call' | 'emergency') =>
    d.billing.ledger.unshift({ id: uid('led_'), date: nowIso(), description, amount, kind })
  if (quotaLeft(d) > 0) { d.billing.volunteerUsed += 1; entry(`Free call — ${what}`, 0, 'included'); return 'included' }
  if (d.billing.balance >= CREDIT.callPriceUsd) { d.billing.balance -= CREDIT.callPriceUsd; entry(`Volunteer call — ${what}`, -CREDIT.callPriceUsd, 'call'); return 'credit' }
  if (urgent && d.billing.balance - CREDIT.callPriceUsd >= CREDIT.emergencyFloorUsd) {
    d.billing.balance -= CREDIT.callPriceUsd; entry(`Emergency call — ${what}`, -CREDIT.callPriceUsd, 'emergency')
    log(d, `Emergency help went ahead on credit — balance ${formatBalance(d.billing.balance)}. Please top up when you can.`, 'warn', 'system')
    return 'emergency'
  }
  return 'blocked'
}
const firstName = (s: DemoState) => s.caretaker.name

// Quotes mirror app/tools/providers.py: same providers per market, same price formulas (INR base × demo rate).
const FOOD_PROVIDER: Record<Currency, string> = { INR: 'Swiggy', THB: 'LINE MAN', SGD: 'GrabFood' }
const PHARMACY: Record<Currency, string> = { INR: 'Blinkit', THB: 'Grab Mart', SGD: 'Guardian' }
const RIDES: Record<Currency, string> = { INR: 'Uber', THB: 'Grab', SGD: 'Grab' }
const SCALE: Record<Currency, number> = { INR: 1, THB: 0.4, SGD: 0.016 }
const FOOD_INR: Record<string, number> = { porridge: 10_000, jok: 10_000, soup: 11_000, rice: 8_000, fruit: 9_000, dal: 12_000, roti: 2_500,
  noodles: 15_000, eggs: 7_000, bread: 4_500, milk: 3_500, tea: 3_000, coffee: 6_000, sandwich: 13_000, idli: 6_000, dosa: 9_000 }
const convert = (inrMinor: number, c: Currency) => Math.max(100, Math.round((inrMinor * SCALE[c]) / 100) * 100)
const FARE: Record<Currency, [number, number]> = { INR: [5_000, 1_800], THB: [3_500, 800], SGD: [400, 80] }

interface Quote { provider: string; lines: string[]; amountMinor: number; eta: string; estimate?: boolean; demo: boolean; bookingUrl?: string; bookingLabel?: string }

function quoteFor(d: DemoState, tool: ToolName, text: string): Quote | null {
  const c = d.rules.currency
  if (tool === 'order_food') {
    const items = ['rice porridge', 'soup', 'fruit']
    const total = 3_000 + items.reduce((sum, it) => sum + (Object.entries(FOOD_INR).find(([k]) => it.includes(k))?.[1] ?? 15_000), 0)
    return { provider: FOOD_PROVIDER[c], lines: items.map(i => `1 × ${i}`), amountMinor: convert(total, c), eta: '30–40 min', demo: true }
  }
  if (tool === 'order_medicine') {
    const med = d.assessment.medications[0]
    const name = med ? `${med.name}${med.dose ? ' ' + med.dose : ''}` : 'your usual medicine'
    return { provider: PHARMACY[c], lines: [`1 × ${name}`], amountMinor: convert(9_000, c), eta: 'about 20 min', demo: true }
  }
  if (tool === 'book_ride') {
    const dest = (text.match(/to (?:the )?(.+?)[.!?]*$/i)?.[1] ?? 'the clinic').replace(/^the /i, '')
    const road = 6 * 1.3
    const [base, perKm] = FARE[c]
    const isUber = c === 'INR'  // backend: Uber deep link in India, Google Maps elsewhere
    return { provider: RIDES[c], lines: [`Ride to ${dest} (~${Math.round(road)} km)`], amountMinor: Math.round((base + perKm * road) / 100) * 100,
      eta: `~${Math.max(5, Math.round(road * 3))} min drive`, estimate: true, demo: false,
      bookingUrl: isUber ? 'https://m.uber.com/ul/?action=setPickup' : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`,
      bookingLabel: isUber ? 'Open Uber to book' : 'Open Google Maps to book' }
  }
  return null
}

const VERB: Record<string, string> = {
  order_medicine: 'order your medicine', order_food: 'order your food', book_ride: 'book you a ride',
  notify_volunteer: 'ask a volunteer to help', send_message_to_caretaker: 'send that to family', set_reminder: 'set that reminder',
}

function buildCard(d: DemoState, tool: ToolName, requestText: string, extra: Partial<ActionCard> = {}): ActionCard {
  const titles: Record<string, string> = {
    order_food: 'Food order', order_medicine: 'Medicine order', book_ride: 'Ride', set_reminder: 'Reminder',
    send_message_to_caretaker: 'Message to family', notify_volunteer: 'Help request', call_contact: 'Call',
  }
  const card: ActionCard = {
    id: uid('act_'), tool, title: titles[tool], status: 'awaiting_elder', lines: [], amount: null, provider: null,
    eta: null, orderId: null, requestText, createdAt: nowIso(), ...extra,
  }
  const q = quoteFor(d, tool, requestText)
  if (q) {
    const cur = d.rules.currency
    let amount = q.amountMinor
    const pct = tool === 'order_medicine' ? planById(d.billing.plan).medicineDiscountPct : 0
    const discount = Math.round((amount * pct) / 100)
    amount -= discount
    Object.assign(card, {
      lines: q.lines, provider: q.provider, eta: q.eta, amountMinor: amount, discountMinor: discount || undefined,
      amount: formatMoney(amount, cur), estimate: q.estimate, bookingUrl: q.bookingUrl, bookingLabel: q.bookingLabel, demo: q.demo,
      deliverTo: tool === 'book_ride' ? null : addressLine(d.elder.address),
    })
  }
  return card
}

const upsertAction = (d: DemoState, card: ActionCard) => {
  const i = d.actions.findIndex(a => a.id === card.id)
  if (i >= 0) d.actions[i] = card; else d.actions.unshift(card)
  // Keep the chat card in sync (backend: update_card in app/agent/narrate.py).
  d.messages.forEach(m => { if (m.action?.id === card.id) m.action = { ...card } })
}

/** Execute an approved action. Returns what the agent tells the elder. */
function perform(d: DemoState, card: ActionCard): string {
  const cur = d.rules.currency
  switch (card.tool) {
    case 'order_medicine':
    case 'order_food': {
      card.status = 'done'; card.orderId = `${(card.provider ?? 'ORDER').toUpperCase().replace(/\s/g, '')}-${uid().slice(0, 6).toUpperCase()}`
      log(d, `Done — ${card.title}: ${card.lines.join(', ')} from ${card.provider}, ${card.amount}${card.discountMinor ? ` (Pro saved ${formatMoney(card.discountMinor, cur)})` : ''}${card.demo ? ' (demo — not really ordered)' : ''}`)
      return card.tool === 'order_medicine'
        ? `Done! Your medicine is on its way and should arrive ${card.eta?.toLowerCase()}. I'll tell you when it's at the door.`
        : `Ordered! Your food will arrive in ${card.eta}. The driver will ring the bell twice.`
    }
    case 'book_ride': {
      card.status = 'handed_off'
      log(d, `Ride ready to book — ${card.lines[0]} from ${card.provider}, about ${card.amount} (estimate)`)
      return `Tap the button on the card to finish booking your ride. The fare shown is an estimate.`
    }
    case 'notify_volunteer': {
      const urgent = isUrgent(card.requestText || '')
      if (!canCover(d, urgent)) {
        card.status = 'awaiting_caretaker'; card.needsTopUp = true
        return `${firstName(d)} needs to add a little care credit first. I've let them know.`
      }
      const skill = card.skill || ''
      const pool = d.contacts.filter(c => c.kind === 'volunteer' && (c.trusted || !d.rules.trustedVolunteersOnly)
        && (!skill || c.skills.some(s => s.includes(skill) || skill.includes(s))))
        .sort((a, b) => Number(b.trusted) - Number(a.trusted) || (b.rating ?? 0) - (a.rating ?? 0))
      const v = pool[0]
      if (!v) {
        card.status = 'failed'
        log(d, `No trusted volunteer for “${skill}” — please arrange help for ${nick(d)}`, 'warn')
        return `I couldn't find a volunteer for that right now. I've told ${firstName(d)} so they can arrange someone.`
      }
      card.status = 'done'; card.lines = [card.lines[0] || card.requestText || 'Help at home', `${v.name} (★ ${v.rating})`]
      card.provider = v.name
      chargeCall(d, card.lines[0], urgent)
      d.requests.unshift({ id: uid('req_'), skill, title: card.lines[0], description: card.requestText || '', preferredTime: 'Today',
        volunteerId: v.id, volunteerName: v.name, status: 'notified', createdAt: nowIso() })
      log(d, `${v.name} was asked to help: “${card.requestText}” (${quotaLeft(d)} free calls left · credit ${formatBalance(d.billing.balance)})`)
      return `I've asked ${v.name.split(' ')[0]}, a volunteer you know, to come and help. I'll tell you when they confirm.`
    }
    case 'send_message_to_caretaker': {
      card.status = 'done'
      pushFamily(d, { sender: 'elder', text: card.lines[0], viaAgent: true })
      return `I've sent that to ${firstName(d)}.`
    }
    case 'set_reminder': {
      card.status = 'done'
      d.reminders.push({ id: uid('rem_'), elderId: d.elder.elderId, title: card.lines[0], kind: 'custom', time: card.eta || '17:00',
        days: null, date: new Date().toISOString().slice(0, 10), medicationId: null, active: true })
      log(d, `Reminder set for ${card.eta}: ${card.lines[0]}`)
      return `Okay, I'll remind you at ${card.eta}.`
    }
  }
  card.status = 'done'
  return 'Done.'
}

function pushFamily(d: DemoState, m: Partial<FamilyMessage> & { sender: FamilyMessage['sender']; text: string }) {
  const isElder = m.sender === 'elder'
  d.family.push({
    id: uid('f_'), senderUid: isElder ? d.elder.elderId : d.caretaker.uid,
    senderName: m.sender === 'system' ? 'Elderly' : isElder ? d.elder.name : d.caretaker.name,
    chips: [], usedChips: [], viaAgent: false, createdAt: nowIso(), ...m,
  })
  if (isElder) d.caretakerUnread += 1
  // Keep the demo thread short, like the backend's /family?limit=30.
  if (d.family.length > 60) d.family.splice(0, d.family.length - 60)
}

// ---------- the "agent" ----------
function runTool(d: DemoState, tool: ToolName, requestText: string, extra: Partial<ActionCard> = {}) {
  if ((tool === 'order_food' || tool === 'order_medicine') && !addressLine(d.elder.address)) {
    log(d, `${nick(d)} wanted to order (${tool.replace('_', ' ')}) but there's no delivery address. Add it in their Profile.`, 'warn')
    return agentMsg(d, `${firstName(d)} needs to add your address first. I've told them.`)
  }
  const card = buildCard(d, tool, requestText, extra)
  let decision = decide(tool, d.rules, card.amountMinor ?? null)
  // Urgent help at home (burst pipe, locked out…) goes out right away — like escalate_emergency, it never waits
  // for approval or money. The caretaker is alerted, and the call may take care credit negative.
  if (tool === 'notify_volunteer' && isUrgent(requestText) && decision !== 'execute') {
    decision = 'execute'
    log(d, `URGENT: ${nick(d)} said “${requestText}” — volunteer sent right away`, 'alert')
  }
  const name = firstName(d)
  if (decision === 'block') {
    card.status = 'blocked'
    log(d, `${nick(d)} asked “${requestText}” — blocked by your rules. Please check in.`, 'alert')
    agentMsg(d, `I'm not able to do that on my own. I've let ${name} know so they can help you.`, [], card)
  } else if (decision === 'execute') {
    const say = perform(d, card)
    agentMsg(d, say, [], card)
  } else if (decision === 'ask_elder') {
    card.status = 'awaiting_elder'
    agentMsg(d, `Shall I ${VERB[tool]}?${card.amount ? ` It's ${card.amount}${card.provider ? ` from ${card.provider.replace(' (demo)', '')}` : ''}.` : ''}`, [], card)
  } else {
    card.status = 'awaiting_caretaker'
    if (tool === 'notify_volunteer' && !canCover(d, isUrgent(requestText))) card.needsTopUp = true
    const over = card.amountMinor != null && d.rules.tools[tool].limitMinor != null && card.amountMinor > (d.rules.tools[tool].limitMinor ?? 0)
    agentMsg(d, card.needsTopUp
      ? `This month's free helper visits are used up and the care credit is empty, so I've asked ${name} to top up. I'll tell you as soon as I hear back.`
      : over
      ? `That's a little more than usual, so I've asked ${name} to check first. I'll tell you as soon as I hear back.`
      : `Good idea. ${name} likes to check this first, so I've sent them a message. I'll tell you as soon as I hear back.`, [], card)
    log(d, `${nick(d)} asked: “${requestText}” — waiting for your approval`, 'warn')
  }
  upsertAction(d, card)
}

const INTENTS: [string, RegExp][] = [
  ['money', /(transfer|bank|money|otp|\bpin\b|send .*(dollar|baht|rupee))/i],
  ['emergency', /(fell|fall|chest|can'?t breathe|ambulance|bleeding|dizzy|emergency|help me)/i],
  ['message', /^(please\s+)?(tell|message|text|send)\s+(emma|my daughter|family)/i],
  ['remind', /remind me/i],
  ['weather', /(weather|umbrella|rain today|is it hot|temperature)/i],
  ['medicine', /(medicine|pill|pharmac|prescription|tablets)/i],
  ['ride', /(ride|taxi|cab|clinic|hospital|take me)/i],
  ['food', /(food|hungry|dinner|lunch|breakfast|eat|groceries|order)/i],
  ['volunteer', /(fix|broken|leak|pipe|burst|flood|locked out|repair|bulb|light|tap|fan|tv|wifi|wi-fi|phone|computer|internet|help with)/i],
  ['call', /(call|ring|speak to)/i],
  ['lonely', /(lonely|alone|bored|sad|miss)/i],
]

/** Which tool each demo intent runs — shown under the typing dots ("Finding a taxi…"). */
const INTENT_TOOL: Record<string, string> = {
  emergency: 'escalate_emergency', message: 'send_message_to_caretaker', remind: 'set_reminder', medicine: 'order_medicine',
  ride: 'book_ride', food: 'order_food', volunteer: 'notify_volunteer', call: 'call_contact',
}

function skillFor(text: string) {
  if (/(leak|tap|pipe|toilet)/i.test(text)) return 'plumbing'
  if (/(light|bulb|fan|socket|electric)/i.test(text)) return 'electrical'
  if (/(tv|wifi|wi-fi|phone|computer|internet|app)/i.test(text)) return 'tech help'
  return 'repairs'
}

export function findContact(s: DemoState, who: string) {
  // Same idea as app/contacts.py find_contact: name first, then relationship, then kind.
  const q = who.toLowerCase()
  const word = (w: string) => w.length > 2 && new RegExp(`\\b${w.replace(/[^\p{L}]/gu, '')}\\b`, 'u').test(q)
  return s.contacts.find(c => c.name.toLowerCase().replace(/^dr\.?\s*/, '').split(/\s+/).some(word))
    ?? s.contacts.find(c => c.kind !== 'doctor' && c.relationship && word(c.relationship.split(' ')[0]))
    ?? s.contacts.find(c => /doctor/.test(q) && c.kind === 'doctor')
    ?? s.contacts.find(c => /neighbo/.test(q) && c.kind === 'neighbour')
}

export function elderSay(raw: string) {
  const shown = raw.trim()
  // Quick-reply buttons start with an emoji ("💬 Tell Emma…"); match intents on the words.
  const text = shown.replace(/^[^\p{L}\p{N}]+/u, '')
  if (!text) return
  if (isLive()) {
    // Everything goes to the agent, which understands context ("I fell asleep" is not "I fell") and raises a real
    // emergency itself (escalate_emergency → SOS path). No keyword guessing here: it caused false alarms and
    // swallowed the elder's actual request. The red SOS bar is the deliberate, always-available path.
    return live.say(shown)
  }
  update(d => { d.messages.forEach(m => { m.quickReplies = [] }); elderMsg(d, shown) })
  const s = getState()

  // Guided check-in (backend: checkin_turn) — second question.
  if (s.checkin.stage === 'meds') {
    const took = !/(not|no|forgot|later)/i.test(text)
    return agentTurn(d => {
      d.checkin = { status: 'done', mood: d.checkin.mood, stage: 'done' }
      const mood = d.checkin.mood ?? 'okay'
      const kind = mood === 'bad' ? 'alert' : (mood === 'low' || !took) ? 'warn' : 'ok'
      log(d, `Check-in: feeling ${mood === 'bad' ? 'not good' : mood === 'low' ? 'a bit low' : mood}, ${took ? 'took medicines' : 'has NOT taken medicines'}`, kind)
      agentMsg(d, took ? `Wonderful. Thank you, ${d.elder.name}. Have a lovely day! ☀️` : `No problem — I'll remind you again in 30 minutes. I've let ${firstName(d)} know.`)
    })
  }

  const intent = INTENTS.find(([, re]) => re.test(text))?.[0]
  const activity = intent ? INTENT_TOOL[intent] ?? null : null
  agentTurn(d => {
    switch (intent) {
      case 'money':
        log(d, `${nick(d)} asked about money/bank details: “${text}” — refused (possible scam)`, 'alert')
        return agentMsg(d, `I can't help with sending money or sharing bank codes — not for anyone. If someone asked you for money, it may be a scam. I've let ${firstName(d)} know.`)
      case 'emergency':
        d.elderUi.overlay = { type: 'emergency', endsAt: Date.now() + 10_000 }
        d.elderUi.lastEmergency = text
        return agentMsg(d, `I'll alert your family in 10 seconds. Press “I'm OK” if you don't need help.`)
      case 'message': {
        const body = text.replace(/^(please\s+)?(tell|message|text|send)\s+(emma|my daughter|family)\s*(that\s*)?/i, '') || 'Hello ❤️'
        return runTool(d, 'send_message_to_caretaker', text, { lines: [body.charAt(0).toUpperCase() + body.slice(1)] })
      }
      case 'remind': {
        const m = text.match(/at (\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i)
        let h = m ? +m[1] : new Date().getHours() + 1
        if (m?.[3]?.toLowerCase() === 'pm' && h < 12) h += 12
        if (!m?.[3] && m && h < 8) h += 12
        const time = `${String(h % 24).padStart(2, '0')}:${m?.[2] ?? '00'}`
        const what = text.replace(/.*remind me (to )?/i, '').replace(/ at .*/i, '') || 'Reminder'
        return runTool(d, 'set_reminder', text, { lines: [what.charAt(0).toUpperCase() + what.slice(1)], eta: time })
      }
      case 'weather':
        d.elderUi.typing = true  // stays on while the real forecast loads
        d.elderUi.activity = 'check_weather'
        void sayWeather()
        return
      case 'medicine': return runTool(d, 'order_medicine', text)
      case 'ride': return runTool(d, 'book_ride', text)
      case 'food': return runTool(d, 'order_food', text)
      case 'volunteer': {
        const skill = skillFor(text)
        return runTool(d, 'notify_volunteer', text, { skill, lines: [text.charAt(0).toUpperCase() + text.slice(1)] })
      }
      case 'call': {
        const c = findContact(d, text) ?? d.contacts.find(c => c.kind === 'family')!
        d.elderUi.overlay = { type: 'call', who: c.name, face: c.face }
        log(d, `${nick(d)} called ${c.name}`)
        return agentMsg(d, `Calling ${c.name} now…`, [], {
          id: uid('act_'), tool: 'call_contact', title: 'Call', status: 'done', lines: [`${c.name} · ${c.relationship || c.kind}`],
          amount: null, provider: null, eta: null, orderId: null, bookingUrl: `tel:${c.phone.replace(/\s/g, '')}`, bookingLabel: `📞 Call ${c.name}`,
        })
      }
      case 'lonely':
        log(d, `${nick(d)} said they feel lonely — offered a call with family`, 'warn')
        return agentMsg(d, `I'm here with you, ${d.elder.name}. Would you like to hear a friendly voice?`, [`📞 Call ${firstName(d)}`, `💬 Tell ${firstName(d)} I miss you`, '📞 Call Tom'])
      default:
        return agentMsg(d, `I can order medicine or food, book a ride, ask a volunteer to fix something, or call your family. What would you like?`,
          ['💊 Order my medicine', `📞 Call ${firstName(d)}`, '🔧 Something is broken'])
    }
  }, activity ? 1300 : 900, activity)  // a little longer when there's an action to name
}

export function elderConfirm(actionId: string, approve: boolean) {
  if (isLive()) { live.confirm(actionId, approve); return }
  update(d => elderMsg(d, approve ? 'Yes, please' : 'No, thank you'))
  agentTurn(d => {
    const card = d.actions.find(a => a.id === actionId)
    if (!card || card.status !== 'awaiting_elder') return agentMsg(d, "That's already been decided.")
    if (!approve) { card.status = 'cancelled'; upsertAction(d, card); return agentMsg(d, "Okay, I won't do that.") }
    const say = perform(d, card); upsertAction(d, card); agentMsg(d, say)
  }, 700)
}

export function caretakerDecide(actionId: string, approve: boolean, opts: { topUpUsd?: number } = {}) {
  if (isLive()) { void live.decide(actionId, approve); return }  // care credit isn't in the backend yet
  update(d => {
    const card = d.actions.find(a => a.id === actionId)
    if (!card || card.status !== 'awaiting_caretaker') return
    if (opts.topUpUsd) addCredit(d, opts.topUpUsd)
    if (!approve) {
      card.status = 'declined'; upsertAction(d, card)
      log(d, `Declined — ${card.title}: ${card.lines[0] ?? ''}`, 'ok', 'caretaker')
      agentMsg(d, `${firstName(d)} said not this time for “${card.requestText}”, and will call you about it. 💛`)
      return
    }
    card.needsTopUp = false
    const say = perform(d, card); upsertAction(d, card)
    agentMsg(d, `Good news — ${firstName(d)} said yes! ${say}`)
  })
}

export function startCheckin(mood: Mood) {
  if (isLive()) return live.startCheckin(mood)
  const label: Record<Mood, string> = { great: 'great', good: 'good', okay: 'okay', low: 'a bit low', bad: 'not good' }
  update(d => { d.checkin = { status: 'in_progress', mood, stage: 'meds' }; elderMsg(d, `I'm feeling ${label[mood]}`) })
  agentTurn(d => {
    const opener = mood === 'bad' || mood === 'low' ? `I'm sorry to hear that, ${d.elder.name}. I've let ${firstName(d)} know.` : `That's lovely to hear!`
    if (mood === 'bad') log(d, `Check-in: ${nick(d)} said they feel not good — please call`, 'alert')
    agentMsg(d, `${opener} Have you taken your morning medicine?`, ['✅ Yes, I took it', '❌ Not yet'])
  })
}

// ---------- family chat (mirrors app/agent/chips.py) ----------
const msgChip = (label: string): Chip => ({ label, kind: 'message', action: null })
const remindChip = (label: string, title: string, minutes: number | null, at: string | null = null): Chip =>
  ({ label, kind: 'action', action: { type: 'remind', title, minutes, at, date: null } })
const callChip = (label: string, name: string, phone: string): Chip => ({ label, kind: 'action', action: { type: 'call', name, phone } })

const FALLBACK_FOR_ELDER = [msgChip('👍 Okay'), msgChip('❤️ Love you'), remindChip('⏰ Remind me later', 'Reply to family', 60)]
const FALLBACK_FOR_CARETAKER = [msgChip('💬 Thanks for letting me know ❤️'), msgChip('👍')]

/** Chips for the elder on a caretaker's message: backend presets, else (demo stand-in for the model) a few patterns. */
function elderChips(d: DemoState, text: string): Chip[] {
  const t = text.trim().toLowerCase().replace(/\?+$/, '').trim()
  const me = d.contacts.find(c => c.name === d.caretaker.name)
  const callBack = me ? [callChip(`📞 Call ${me.name}`, me.name, me.phone)] : []
  if (t === 'did you take your medicine') return [msgChip('✅ Yes, I took it'), msgChip('❌ Not yet'), remindChip('⏰ Remind me in 30 min', 'Take your medicine', 30)]
  if (t === 'how are you feeling today') return [msgChip("😊 I'm good"), msgChip('😐 Okay'), msgChip('😟 Not great'), ...callBack]
  if (t === 'shall i order dinner') return [msgChip('🍲 Yes please'), msgChip('🙅 No thanks'), msgChip('🍞 Something light')]
  if (/love you/.test(t)) return [msgChip('❤️ Love you too'), msgChip('😊 Thank you'), ...callBack]
  if (/call you|ring you/.test(t)) return [msgChip('👍 Okay'), msgChip('😊 Talk soon'), remindChip('⏰ Remind me at 19:00', `Call with ${d.caretaker.name}`, null, '19:00')]
  if (/visit|come over|sunday|saturday/.test(t)) return [msgChip('👍 Yes, please!'), msgChip('📅 Another day'), ...callBack]
  return FALLBACK_FOR_ELDER
}

/** Next steps for the caretaker on the elder's message (caretaker_presets). Backend uses the elder's first name; the demo uses the nickname. */
function caretakerChips(d: DemoState, text: string): Chip[] {
  const t = text.toLowerCase()
  const who = nick(d)
  const callThem = d.elder.phone ? [callChip(`📞 Call ${who}`, who, d.elder.phone)] : []
  if (t.includes('not yet') || t.includes('forgot')) return [remindChip(`⏰ Remind ${who} in 30 min`, 'Take your medicine', 30), msgChip('💬 Please take it now ❤️'), ...callThem]
  if (['not great', 'not good', 'low', 'sad', 'lonely'].some(w => t.includes(w))) return [msgChip("💬 I'll call you soon ❤️"), msgChip('💬 Shall I come over?'), ...callThem]
  if (t.includes('took it') || t.includes("i'm good") || t.includes('yes')) return [msgChip('💬 Great, thank you! ❤️'), msgChip('👍'), ...callThem]
  return FALLBACK_FOR_CARETAKER
}

/** WS family_message (caretaker → elder). Chips are made for the receiver. */
export function caretakerSend(text: string) {
  if (isLive()) { live.familyMessage(text); return }
  update(d => pushFamily(d, { sender: 'caretaker', text, chips: elderChips(d, text) }))
}

/** WS family_reply (elder → caretakers), with next-step chips for the caretakers. */
export function elderFamilyReply(text: string) {
  if (isLive()) { live.familyReply(text); return }
  update(d => pushFamily(d, { sender: 'elder', text, chips: caretakerChips(d, text) }))
}

/** A caretaker message counts as answered once the elder has sent any family message after it. */
export const isAnswered = (family: FamilyMessage[], msgId: string) => {
  const i = family.findIndex(f => f.id === msgId)
  return i >= 0 && family.slice(i + 1).some(f => f.sender === 'elder')
}
/** The caretaker has already followed up on this elder message (sent anything after it). */
export const isFollowedUp = (family: FamilyMessage[], msgId: string) => {
  const i = family.findIndex(f => f.id === msgId)
  return i >= 0 && family.slice(i + 1).some(f => f.sender === 'caretaker')
}

/**
 * Tap a chip. message → send its text; call → phone link on the device (demo: call screen);
 * remind → WS family_action: claimed once (usedChips), reminder saved, system note posted.
 */
export function tapChip(role: 'elder' | 'caretaker', msgId: string, index: number) {
  const s = getState()
  const m = s.family.find(f => f.id === msgId); const chip = m?.chips[index]
  if (!m || !chip) return
  if (chip.kind === 'message') {
    return role === 'elder' ? elderFamilyReply(chip.label) : caretakerSend(chip.label.replace(/^💬\s*/, ''))
  }
  const act = chip.action
  if (isLive()) {
    if (act?.type === 'call') return dial(act.phone)
    if (act?.type === 'remind') { live.familyAction(msgId, index); return }
    return
  }
  if (act?.type === 'call') {
    if (role === 'caretaker') return caretakerCall()
    const c = s.contacts.find(x => x.name === act.name || x.phone === act.phone)
    return c ? elderCallContact(c.id) : undefined
  }
  if (chip.action?.type === 'remind') {
    const a = chip.action
    update(d => {
      const msg = d.family.find(f => f.id === msgId)
      if (!msg || msg.usedChips.includes(index)) return  // already done (double tap / second caretaker)
      msg.usedChips.push(index)
      const target = a.at ? null : new Date(Date.now() + (a.minutes ?? 30) * 60_000)
      const hhmm = a.at ?? `${String(target!.getHours()).padStart(2, '0')}:${String(target!.getMinutes()).padStart(2, '0')}`
      const nowHM = new Date().toTimeString().slice(0, 5)
      const day = new Date(); if (a.at && a.at <= nowHM) day.setDate(day.getDate() + 1)
      d.reminders.push({ id: uid('rem_'), elderId: d.elder.elderId, title: a.title, kind: 'custom', time: hhmm, days: null,
        date: day.toISOString().slice(0, 10), medicationId: null, active: true })
      const by = role === 'elder' ? 'you' : d.caretaker.name
      const tomorrow = a.at && a.at <= nowHM ? ' tomorrow' : ''
      pushFamily(d, { sender: 'system', text: `⏰ Reminder set for ${hhmm}${tomorrow} — ${a.title} (by ${by})` })
    })
  }
}

// ---------- calls & emergency ----------
export function caretakerCall() {
  if (isLive()) return dial(getState().elder.phone)
  update(d => { d.elderUi.overlay = { type: 'incoming', who: d.caretaker.name, face: 'emma' } })
}
export function elderCallContact(contactId: string) {
  if (isLive()) {
    // Show who's being called (a bare tel: link does nothing on a laptop, or with a sandbox's pretend number),
    // and open the phone's dialer when there is one.
    const c = getState().contacts.find(x => x.id === contactId); if (!c) return
    update(d => { d.elderUi.overlay = { type: 'call', who: c.name, face: c.face, phone: c.phone } })
    if (!isPretendNumber(c.phone) && matchMedia('(pointer: coarse)').matches) dial(c.phone)
    return
  }
  update(d => {
    const c = d.contacts.find(x => x.id === contactId); if (!c) return
    d.elderUi.overlay = { type: 'call', who: c.name, face: c.face }
    log(d, `${nick(d)} called ${c.name}`)
  })
}
export const answerCall = () => update(d => { const o = d.elderUi.overlay; if (o?.type === 'incoming') d.elderUi.overlay = { type: 'call', who: o.who, face: o.face, live: true } })
export const declineCall = () => update(d => { d.elderUi.overlay = null; pushFamily(d, { sender: 'elder', text: 'Can you call me a bit later? 🙏', chips: caretakerChips(d, 'call me later') }) })
export const endCall = () => update(d => { d.elderUi.overlay = null })

/** Local emergency number by timezone — same table as app/tools/executor.py. Shown, never dialled automatically. */
const EMERGENCY_NUMBER: Record<string, string> = { 'Asia/Kolkata': '112', 'Asia/Bangkok': '1669', 'Asia/Singapore': '995' }
export const emergencyNumber = (s: DemoState) => EMERGENCY_NUMBER[s.assessment.timezone] ?? '112'

/** Same outcome as the backend's escalate_emergency: alert the family, tell them the number, ask if they're safe. */
function alertFamily(d: DemoState, description: string) {
  d.elderUi.overlay = { type: 'emergency', endsAt: Date.now(), alerted: true }
  log(d, `🚨 EMERGENCY — ${d.elder.name}: ${description}`, 'alert')
  agentMsg(d, `I've alerted your family. If it's serious, press the red button to call ${emergencyNumber(d)} now. Are you safe right now?`,
    ["I'm safe now", `📞 Call ${firstName(d)}`])
}

/** Hold-for-help button (no backend endpoint yet — see review item P): goes straight to "family alerted". */
/** Live SOS. "Alerted" is shown ONLY after the backend confirms; otherwise the elder is told to call directly. */
async function sendSos() {
  update(d => { d.elderUi.overlay = { type: 'emergency', endsAt: Date.now(), sending: true } })
  try {
    const r = await live.sos()
    update(d => { d.elderUi.overlay = { type: 'emergency', endsAt: Date.now(), alerted: true, alertId: r.alert.id, number: r.emergencyNumber } })
  } catch {
    update(d => { d.elderUi.overlay = { type: 'emergency', endsAt: Date.now(), failed: true } })
  }
}

export function triggerHelp() {
  // Holding the bar for 1.5 s is already deliberate, so it alerts straight away (no countdown).
  if (isLive()) { void sendSos(); return }
  update(d => alertFamily(d, 'pressed the help button'))
}
export function emergencyCancel() {
  if (isLive()) { update(d => { d.elderUi.overlay = null }); return }
  update(d => {
    d.elderUi.overlay = null
    elderMsg(d, "I'm OK")
    log(d, `${nick(d)} cancelled the emergency countdown — says they're OK`, 'warn', 'elder')
    agentMsg(d, `Okay. I'm glad you're alright. I've let ${firstName(d)} know, just in case.`)
  })
}
export function emergencyFire() {
  if (isLive()) { void sendSos(); return }
  update(d => alertFamily(d, d.elderUi.lastEmergency || 'asked for emergency help'))
}
export const closeEmergency = () => {
  const o = getState().elderUi.overlay
  if (isLive() && o?.type === 'emergency' && o.alertId) void live.resolveAlert(o.alertId)  // "I'm safe now"
  update(d => { d.elderUi.overlay = null })
}
export const retrySos = () => { if (isLive()) void sendSos() }

// ---------- weather (check_weather → Open-Meteo, the same free API the backend uses) ----------
async function sayWeather() {
  const s = getState()
  const city = s.elder.address?.city || 'Singapore'
  let say = ''
  try {
    const g = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`)).json()
    const p = g.results?.[0]
    const f = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${p.latitude}&longitude=${p.longitude}&timezone=auto&forecast_days=1&current=temperature_2m,apparent_temperature&daily=apparent_temperature_max,precipitation_probability_max`)).json()
    const feelsMax = f.daily.apparent_temperature_max[0], rain = f.daily.precipitation_probability_max[0] ?? 0
    const tips = [feelsMax >= 38 ? 'very hot today: drink water often and stay indoors 11am–4pm' : '', rain >= 60 ? 'rain likely: take an umbrella and mind wet floors' : ''].filter(Boolean)
    say = `It's ${Math.round(f.current.temperature_2m)}°C in ${p.name} right now, feels like ${Math.round(f.current.apparent_temperature)}°. ${tips.length ? cap(tips.join('; ')) + '.' : 'A comfortable day.'}`
  } catch {
    say = "I couldn't check the weather just now."
  }
  update(d => { d.elderUi.typing = false; d.elderUi.activity = null; agentMsg(d, say, ['☂️ Will it rain later?', '📞 Call Emma', '👍 Thanks']) })
}
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

// ---------- caretaker: profile, family members, help requests (existing backend endpoints) ----------
/** PUT /elders/{id}/profile — address (geocoded by the backend) and emergency contacts. */
export const saveAddress = (a: Address) => { update(d => { d.elder.address = { ...a, lat: null, lng: null, precision: null } }); if (isLive()) void live.saveProfile() }
export const saveEmergencyContacts = (list: EmergencyContact[]) => { update(d => { d.elder.emergencyContacts = list.slice(0, 10) }); if (isLive()) void live.saveProfile() }
export const setElderLanguage = (lang: DemoState['elder']['language']) => { update(d => { d.elder.language = lang }); if (isLive()) void live.saveProfile() }
export const setSharingTier = (tier: DemoState['elder']['sharingTier']) => { update(d => { d.elder.sharingTier = tier }); if (isLive()) void live.saveProfile() }
/** Frontend-only (the backend stores just `name`): kept on this device. */
export const setNickname = (n: string) => update(d => { d.elder.nickname = n })

// ---------- caretaker: contacts & routine ----------
export function addContact(c: Omit<Contact, 'id' | 'rating'>) {
  if (isLive()) return void live.addContact(c)
  update(d => { d.contacts.push({ id: uid('con_'), ...c, rating: null }) })
}
export function removeContact(id: string) {
  if (isLive()) return void live.deleteContact(id)
  update(d => { d.contacts = d.contacts.filter(c => c.id !== id) })
}
export function addReminder(title: string, time: string) {
  if (isLive()) return void live.addReminder(title, time)
  update(d => { d.reminders.push({ id: uid('rem_'), elderId: d.elder.elderId, title, kind: 'custom', time, days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], date: null, medicationId: null, active: true }) })
}
export function deleteReminder(id: string) {
  if (isLive()) return void live.deleteReminder(id)
  update(d => { d.reminders = d.reminders.filter(x => x.id !== id) })
}
/** POST /elders/{id}/caretakers → "added" if they already have an account, else "invited" until they sign in with Google. */
export function inviteCaretaker(email: string): 'added' | 'invited' | 'pending' {
  const e = email.trim().toLowerCase()
  if (isLive()) { void live.invite(e); return 'pending' }
  let result: 'added' | 'invited' = 'invited'
  update(d => {
    if (d.caretakers.some(c => c.email.toLowerCase() === e)) { result = 'added'; return }
    if (!d.invites.includes(e)) d.invites.push(e)
    log(d, `You invited ${e} to help care for ${nick(d)}`, 'ok', 'caretaker')
  })
  return result
}
/** PATCH /elders/{id}/requests/{id} — volunteers reply by phone; the caretaker records the outcome. */
export const setRequestStatus = (id: string, status: Extract<HelpRequest['status'], 'confirmed' | 'done' | 'cancelled'>) => {
  update(d => { const r = d.requests.find(x => x.id === id); if (r) r.status = status })
  if (isLive()) void live.setRequestStatus(id, status)
}

export function dispatchHelp(who: string, eta: string) {
  update(d => {
    d.logs.forEach(l => { if (l.kind === 'alert') l.ack = true })
    log(d, `SOS: you sent ${who} to ${nick(d)} — ETA ${eta}, live location shared`, 'warn', 'caretaker')
    // Sending a volunteer in an SOS is an emergency call: never blocked, may take credit negative.
    if (d.contacts.some(c => c.kind === 'volunteer' && c.name === who)) chargeCall(d, `SOS visit by ${who}`, true)
    agentMsg(d, `${who === 'Go myself' ? firstName(d) : who} is coming to check on you — about ${eta}. ${firstName(d)} asked them to. 💛`)
  })
}

// ---------- caretaker settings ----------
const saveRules = () => { if (isLive()) live.saveRulesSoon() }
export const setRuleMode = (tool: ToolName, mode: DemoState['rules']['tools'][ToolName]['mode']) =>
  { update(d => { d.rules.tools[tool].mode = mode }); saveRules() }
export const setRuleLimit = (tool: ToolName, minor: number) => { update(d => { d.rules.tools[tool].limitMinor = Math.max(0, minor) }); saveRules() }
export const setTrustedOnly = (v: boolean) => { update(d => { d.rules.trustedVolunteersOnly = v }); saveRules() }
export const toggleTrusted = (id: string) => {
  update(d => { const c = d.contacts.find(x => x.id === id); if (c) c.trusted = !c.trusted })
  const c = getState().contacts.find(x => x.id === id)
  if (isLive() && c) void live.updateContact(c)
}
/** Marks alerts handled. The backend has no endpoint for this yet, so live mode remembers it on this device. */
export const ackAlerts = () => update(d => { d.logs.forEach(l => { l.ack = true; if (!d.ackedLogs.includes(l.id)) d.ackedLogs.push(l.id) }) })
export const markCaretakerRead = () => { if (getState().caretakerUnread) update(d => { d.caretakerUnread = 0 }) }
/** The elder's 🔊 toggle. Live: saved, so the family's Phone page shows the same thing. */
export const setVoice = (v: boolean) => {
  if (isLive()) { void saveDevice({ ...deviceOf(getState()), voice: v }).catch(() => { /* applied here anyway */ }); return }
  update(d => { d.elderUi.voice = v })
}

// ---------- billing ----------
/** Add prepaid care credit. A negative (emergency) balance is repaid first, automatically. */
function addCredit(d: DemoState, cents: number) {
  const owed = Math.max(0, -d.billing.balance)
  d.billing.balance += cents
  d.billing.ledger.unshift({ id: uid('led_'), date: nowIso(), amount: cents, kind: 'topup',
    description: owed ? `Top-up (repaid ${formatUsd(Math.min(owed, cents))} emergency use)` : 'Top-up' })
  d.billing.invoices.unshift({ id: 'INV-' + Math.floor(100000 + Math.random() * 899999), date: nowIso(),
    description: 'Care credit top-up', amountMinor: cents, method: methodLabel(d) })
  log(d, `You added ${formatUsd(cents)} care credit — balance ${formatBalance(d.billing.balance)}`, 'ok', 'caretaker')
  d.actions.forEach(a => { if (a.needsTopUp && canCover(d)) a.needsTopUp = false })
}
const methodLabel = (d: DemoState) => {
  const p = d.billing.paymentMethod
  return !p ? 'Card' : p.kind === 'card' ? `${p.brand} •••• ${p.last4}` : p.label
}

export function subscribe(plan: PlanId, cycle: Billing, method: DemoState['billing']['paymentMethod']) {
  update(d => {
    const p = planById(plan)
    d.billing.plan = plan; d.billing.cycle = cycle; d.billing.cancelAtPeriodEnd = false
    if (method) d.billing.paymentMethod = method
    const renew = new Date(); if (cycle === 'yearly') renew.setFullYear(renew.getFullYear() + 1); else renew.setMonth(renew.getMonth() + 1)
    d.billing.renewsOn = renew.toISOString()
    const amount = priceFor(p, cycle)
    if (amount > 0) d.billing.invoices.unshift({ id: 'INV-' + Math.floor(100000 + Math.random() * 899999), date: nowIso(),
      description: `${p.name} plan — ${cycle === 'yearly' ? '12 months' : '1 month'}`, amountMinor: amount, method: methodLabel(d) })
    log(d, `You switched to the ${p.name} plan (${p.volunteerCalls} volunteer calls / month)`, 'ok', 'caretaker')
    // Unblock any volunteer requests that were waiting on credit.
    d.actions.forEach(a => { if (a.needsTopUp && canCover(d)) a.needsTopUp = false })
  })
}
export function topUp(cents: number, method?: DemoState['billing']['paymentMethod']) {
  update(d => { if (method) d.billing.paymentMethod = method; addCredit(d, Math.max(CREDIT.minTopUpUsd, cents)) })
}
export const cancelPlan = () => update(d => { d.billing.cancelAtPeriodEnd = true })
export const resumePlan = () => update(d => { d.billing.cancelAtPeriodEnd = false })
