import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { PhoneField } from '../components/PhoneField'
import { countryForTimezone, phoneError } from '../lib/phone'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { isLive } from '../data/mode'
import { api, loadSession } from '../data/live'
import { signInElder } from '../lib/firebase'
import { ComingSoon } from '../components/ui'
import { decodeSetup } from '../caretaker/SetupPhone'
import { getState, medicationReminders, resetDemo, seed, update, useDemo, uid } from '../data/store'
import { Face } from '../components/Face'
import { MicIcon, Switch, useToast } from '../components/ui'
import { currencyForTimezone, TIMEZONES } from '../lib/money'
import { defaultRules } from '../lib/policy'
import { canListen, listen, speak } from '../lib/speech'
import { strings } from '../lib/i18n'
import type { Address, Contact, Day, Language, Medication, Mode, ToolName } from '../lib/types'
import { CycleToggle, PlanCards, TopUpPicker } from '../billing/Billing'
import { CREDIT, formatUsd, planById } from '../lib/plans'
import type { Billing, PlanId } from '../lib/plans'
import { Confetti, WaveHand } from './Scenes'
import { AddressFields, addressComplete } from '../caretaker/Screens'

function Frame({ step, total, onBack, children, foot }: { step: number; total: number; onBack?: () => void; children: ReactNode; foot: ReactNode }) {
  return (
    <div className="ob">
      <div className="ob-top">
        {onBack ? <button className="btn ghost sm" onClick={onBack} aria-label="Back" style={{ fontSize: 20 }}>‹</button> : <span style={{ width: 36 }} />}
        <div className="ob-progress" aria-label={`Step ${step + 1} of ${total}`}><i style={{ width: `${((step + 1) / total) * 100}%` }} /></div>
        <span className="small muted" style={{ width: 40, textAlign: 'right' }}>{step + 1}/{total}</span>
      </div>
      <div className="ob-body" key={step}>{children}</div>
      <div className="ob-foot">{foot}</div>
    </div>
  )
}

const LANGS: [Language, string][] = [['en-US', 'English'], ['hi-IN', 'हिन्दी Hindi'], ['hi-Latn', 'Hinglish (Hindi in English letters)'], ['th-TH', 'ไทย Thai'], ['ja-JP', '日本語 Japanese'], ['ko-KR', '한국어 Korean']]
const NICKS = ['Mom', 'Dad', 'Grandma', 'Grandpa', 'Nana', 'Papa']
/** Sensible default for "you are their…" from what you call them. */
const relFor = (n: string) => /^(mom|dad|mum|mother|father|ma|pa)$/i.test(n) ? 'daughter' : /grand|nana|papa|granny|gran/i.test(n) ? 'granddaughter' : 'family'
const PRESETS: { id: string; t: string; d: string; ic: string; modes: Record<ToolName, Mode> }[] = [
  { id: 'cautious', ic: '🛡️', t: 'Cautious', d: 'Ask me before any order, ride or visit',
    modes: { order_food: 'caretaker_approve', order_medicine: 'caretaker_approve', book_ride: 'caretaker_approve', notify_volunteer: 'caretaker_approve', send_message_to_caretaker: 'autonomous', set_reminder: 'autonomous' } },
  { id: 'balanced', ic: '⚖️', t: 'Balanced (recommended)', d: 'They confirm small orders; volunteer visits need me',
    modes: { order_food: 'elder_confirm', order_medicine: 'elder_confirm', book_ride: 'elder_confirm', notify_volunteer: 'caretaker_approve', send_message_to_caretaker: 'autonomous', set_reminder: 'autonomous' } },
  { id: 'independent', ic: '🌿', t: 'Independent', d: 'They decide everything within spending limits',
    modes: { order_food: 'elder_confirm', order_medicine: 'elder_confirm', book_ride: 'elder_confirm', notify_volunteer: 'elder_confirm', send_message_to_caretaker: 'autonomous', set_reminder: 'autonomous' } },
]

/** Shown on the very first screen: what we collect and how it's handled. */
/** Data consent on the very first screen: short promises, full details on demand, one required agreement. */
function PrivacyConsent() {
  return (
    <section className="consent-form" aria-labelledby="consent-title">
      <div className="cf-head"><span aria-hidden>🔒</span><div className="grow"><b id="consent-title">Your family’s data</b>
        <p className="small muted">Please read and agree to continue.</p></div></div>
      <ul className="cf-list">
        <li><span aria-hidden>✓</span>They choose what family sees — helper chats stay private.</li>
        <li><span aria-hidden>✓</span>We keep words, not voice recordings.</li>
        <li><span aria-hidden>✓</span>Location is shared only in an emergency.</li>
        <li><span aria-hidden>✓</span>Never sold, never used for ads. Encrypted throughout.</li>
      </ul>
      <details className="cf-more">
        <summary>What we collect and why <span className="chev" aria-hidden>▾</span></summary>
        <table><tbody>
          <tr><td>Name, phone, language, address</td><td>Calls, deliveries, rides, their language</td></tr>
          <tr><td>Routine & medicines</td><td>Reminders and the daily check-in</td></tr>
          <tr><td>Check-ins & chats (text)</td><td>Wellbeing summaries, as they allow</td></tr>
          <tr><td>Contacts you add</td><td>Faces to call, help at home</td></tr>
          <tr><td>Payment</td><td>Handled by Stripe — we never see card numbers</td></tr>
        </tbody></table>
        <p className="small muted" style={{ marginTop: 8 }}>You can download or delete everything at any time.</p>
      </details>
    </section>
  )
}

/** The required agreement — sits at the bottom, right above the button it unlocks. */
function ConsentCheck({ agreed, onChange }: { agreed: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={`cf-agree ${agreed ? 'on' : ''}`}>
      <input type="checkbox" checked={agreed} onChange={e => onChange(e.target.checked)} />
      <span>I agree to how Elderly collects and uses our family’s data.</span>
    </label>
  )
}

// ===================== Caretaker onboarding =====================
export function CaretakerOnboarding() {
  const nav = useNavigate()
  const toast = useToast()
  const [step, setStep] = useState(0)
  const st = useDemo()
  const L = isLive()
  const [me, setMe] = useState({ name: L ? st.live.displayName ?? '' : '', email: L ? st.live.email ?? '' : 'emma@example.com', relationship: '', phone: L ? '' : '+65 9000 1111' })
  const [them, setThem] = useState(L ? { nickname: '', name: '', phone: '', language: 'en-US' as Language, timezone: 'Asia/Singapore' }
    : { nickname: '', name: 'Rose', phone: '+65 8123 4567', language: 'en-US' as Language, timezone: 'Asia/Singapore' })
  const [address, setAddress] = useState<Address>(L ? { line1: '', line2: '', landmark: '', city: '', postcode: '' }
    : { line1: '14 Elm Street', line2: '#03-02', landmark: 'Near Riverside Park', city: 'Singapore', postcode: '238801' })
  const [busy, setBusy] = useState(false)
  const [customNick, setCustomNick] = useState(false)
  const [consent, setConsent] = useState(false)
  const [dataOk, setDataOk] = useState(false)
  // Same fields as the backend Assessment: one check-in time + days; a skipped meal is null.
  const [rhythm, setRhythm] = useState({ wake: '06:30', breakfast: '08:00', checkIn: '09:00', lunch: '12:30', dinner: '19:00', bed: '21:30' })
  const [skip, setSkip] = useState<Record<'breakfast' | 'lunch' | 'dinner', boolean>>({ breakfast: false, lunch: false, dinner: false })
  const [days, setDays] = useState<Day[]>(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])
  // Extra check-ins: the backend has one check-in time, so these become daily "Quick check-in" reminders (POST /reminders).
  const [extraCheckins, setExtraCheckins] = useState<{ id: string; time: string }[]>([])
  // Rows keep their place while a time is being typed, and move to their new spot once it's committed (blur).
  type RowKey = 'wake' | 'breakfast' | 'checkIn' | 'lunch' | 'dinner' | 'bed' | string
  const timeOf = (k: RowKey, extras = extraCheckins) => (k in rhythm ? rhythm[k as keyof typeof rhythm] : extras.find(c => c.id === k)?.time ?? '12:00')
  const sortRows = (keys: RowKey[], extras = extraCheckins) => [...keys].sort((a, b) =>
    a === 'wake' ? -1 : b === 'wake' ? 1 : a === 'bed' ? 1 : b === 'bed' ? -1 : timeOf(a, extras).localeCompare(timeOf(b, extras)))
  const [rowOrder, setRowOrder] = useState<RowKey[]>(['wake', 'breakfast', 'checkIn', 'lunch', 'dinner', 'bed'])
  const commitOrder = () => setRowOrder(o => sortRows(o))
  const addCheckin = () => {
    const taken = new Set([rhythm.checkIn, ...extraCheckins.map(c => c.time)])
    const time = ['15:00', '17:00', '11:00', '20:00', '13:30', '16:00'].find(t => !taken.has(t)) ?? '15:00'
    const next = [...extraCheckins, { id: uid('chk'), time }]
    setExtraCheckins(next)
    setRowOrder(o => sortRows([...o, next[next.length - 1].id], next))
  }
  const removeCheckin = (id: string) => {
    setExtraCheckins(cs => cs.filter(x => x.id !== id))
    setRowOrder(o => o.filter(k => k !== id))
  }
  // Slide rows to their new place (FLIP) so it's clear where a row went.
  const rhythmList = useRef<HTMLDivElement>(null)
  const rowTops = useRef<Record<string, number>>({})
  useLayoutEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    rhythmList.current?.querySelectorAll<HTMLElement>('[data-row]').forEach(el => {
      const k = el.dataset.row!, top = el.offsetTop, prev = rowTops.current[k]
      if (prev !== undefined && Math.abs(prev - top) > 2 && !reduced) {
        el.animate([{ transform: `translateY(${prev - top}px)`, background: 'var(--accent-soft)' }, { transform: 'none', background: 'transparent' }],
          { duration: 450, easing: 'cubic-bezier(.2,.8,.2,1)' })
      }
      rowTops.current[k] = top
    })
  }, [rowOrder])
  const [notes, setNotes] = useState(L ? '' : 'Low vision — prefers voice.')
  const [meds, setMeds] = useState<Medication[]>(L ? [] : [{ id: 'm1', name: 'Amlodipine', dose: '5 mg', times: ['08:00'], withFood: false, notes: 'Blood pressure' }])
  const [people, setPeople] = useState<{ name: string; relationship: string; phone: string }[]>(L ? [] : [
    { name: 'Tom', relationship: 'grandson', phone: '+44 20 7946 0000' }, { name: 'David', relationship: 'neighbour next door', phone: '+65 9000 2222' },
  ])
  const [preset, setPreset] = useState('balanced')
  const [cycle, setCycle] = useState<Billing>('monthly')
  const [plan, setPlan] = useState<PlanId>('basic')
  const [credit, setCredit] = useState(1000)
  const [showPlans, setShowPlans] = useState(false)
  const [startFree, setStartFree] = useState(false)
  const total = 8
  const next = () => setStep(s => Math.min(total - 1, s + 1))
  const back = step > 0 ? () => setStep(s => s - 1) : undefined
  const cur = currencyForTimezone(them.timezone)
  const nk = them.nickname.trim() || 'your loved one'
  const Nk = nk.charAt(0).toUpperCase() + nk.slice(1)
  const faceFor = (n: string) => ({ tom: 'tom', david: 'david', emma: 'emma' } as Record<string, string>)[n.trim().toLowerCase()]

  /** Live: create everything on the backend, in the order its endpoints need. */
  const finishLive = async () => {
    setBusy(true)
    const rules = defaultRules(cur)
    const p = PRESETS.find(x => x.id === preset)!
    ;(Object.keys(p.modes) as ToolName[]).forEach(t => { rules.tools[t].mode = p.modes[t] })
    const assessment = {
      timezone: them.timezone, sleep: { bedtime: rhythm.bed, wakeTime: rhythm.wake },
      meals: { breakfast: skip.breakfast ? null : rhythm.breakfast, lunch: skip.lunch ? null : rhythm.lunch, dinner: skip.dinner ? null : rhythm.dinner },
      medications: meds.filter(m => m.name.trim()).map(m => ({ ...m, times: [...new Set(m.times)].sort() })),
      checkIn: { time: rhythm.checkIn, days }, healthNotes: notes,
    }
    const myRel = me.relationship || relFor(nk)
    let elderId = ''
    try {
      if (getState().live.status === 'needsOnboarding') await api.onboardCaretaker(me.name.trim())
      const creds = await api.createElder({ name: them.name.trim(), phone: them.phone.trim(), language: them.language })
      elderId = creds.elderId
      // Keep what only this device knows (nickname, one-time password) before the session reloads.
      update(d => {
        d.elder.elderId = elderId; d.live.elderId = elderId
        d.elder.nickname = them.nickname.trim() || them.name.trim()
        d.elder.credentials = { email: creds.email, tempPassword: creds.tempPassword }
        d.setup = { sentVia: null, sentAt: null }; d.onboarded.elder = false; d.tours.caretaker = false
      })
      await api.saveAssessment(elderId, assessment)
      await api.saveProfile(elderId, { name: them.name.trim(), phone: them.phone.trim(), language: them.language, sharingTier: 'daily_summary', address,
        emergencyContacts: me.phone.trim().length >= 5 ? [{ name: me.name.trim(), phone: me.phone.trim(), relationship: myRel }] : [] })
      await api.saveRules(elderId, rules)
      const contacts = [
        ...(me.phone.trim().length >= 5 ? [{ name: me.name.trim(), phone: me.phone.trim(), relationship: myRel, email: me.email }] : []),
        ...people.filter(x => x.name.trim() && x.phone.trim().length >= 5).map(x => ({ ...x, email: '' })),
      ]
      await Promise.all([
        ...contacts.map(c => api.addContact(elderId, { name: c.name.trim(), phone: c.phone.trim(), relationship: c.relationship.slice(0, 50), email: c.email,
          kind: /neighbo/i.test(c.relationship) ? 'neighbour' : /doctor/i.test(c.relationship) ? 'doctor' : 'family', skills: [], trusted: true })),
        ...extraCheckins.map(c => api.addReminder(elderId, { title: 'Quick check-in 💬', time: c.time, days })),
      ])
      await loadSession()
      nav('/caretaker/setup-phone')
    } catch (e) {
      toast(`${elderId ? 'Saved part of the setup' : 'Couldn’t create the account'}: ${(e as Error).message}`)
      if (elderId) { await loadSession(); nav('/caretaker') }
    } finally { setBusy(false) }
  }

  const finish = (skipCredit = false) => {
    if (L) { void finishLive(); return }
    const base = seed()
    const elderId = 'elder_' + them.name.toLowerCase().replace(/\W/g, '')
    const rules = defaultRules(cur)
    const p = PRESETS.find(x => x.id === preset)!
    ;(Object.keys(p.modes) as ToolName[]).forEach(t => { rules.tools[t].mode = p.modes[t] })
    const contacts: Contact[] = [
      { id: 'con_me', name: me.name, phone: '+65 9000 1111', kind: 'family', relationship: me.relationship || relFor(nk), skills: [], trusted: true, email: me.email, rating: null, face: faceFor(me.name) },
      ...people.filter(x => x.name.trim()).map(x => ({ id: uid('con_'), name: x.name, phone: x.phone, kind: (/neighbo/i.test(x.relationship) ? 'neighbour' : /doctor/i.test(x.relationship) ? 'doctor' : 'family') as Contact['kind'], relationship: x.relationship, skills: [], trusted: true, email: '', rating: null, face: faceFor(x.name) })),
      ...base.contacts.filter(c => c.kind === 'volunteer' || c.kind === 'doctor'),
    ]
    const assessment = {
      timezone: them.timezone, sleep: { bedtime: rhythm.bed, wakeTime: rhythm.wake },
      meals: { breakfast: skip.breakfast ? null : rhythm.breakfast, lunch: skip.lunch ? null : rhythm.lunch, dinner: skip.dinner ? null : rhythm.dinner },
      medications: meds.filter(m => m.name.trim()).map(m => ({ ...m, times: [...new Set(m.times)].sort() })),
      checkIn: { time: rhythm.checkIn, days }, healthNotes: notes,
    }
    resetDemo({
      caretaker: { uid: 'ct_me', name: me.name, email: me.email },
      // Illustrated face only for the demo persona; anyone else shows initials until a photo is added.
      elder: { ...base.elder, face: them.name.trim().toLowerCase() === 'rose' ? 'rose' : '', elderId, nickname: them.nickname.trim() || them.name, name: them.name, phone: them.phone, language: them.language, address,
        emergencyContacts: [{ name: me.name, phone: '+65 9000 1111', relationship: me.relationship || relFor(nk) }] },
      caretakers: [{ uid: 'ct_me', name: me.name, email: me.email }], invites: [], checkinHistory: [],
      assessment, rules, contacts, family: [], messages: [], actions: [], requests: [],
      logs: [{ id: uid('log_'), timestamp: new Date().toISOString(), actor: 'caretaker', message: `${me.name} set up Elderly for ${them.nickname || them.name}`, kind: 'ok', ack: true, checkInId: null }],
      reminders: [...medicationReminders(elderId, assessment), ...extraCheckins.map(c => ({
        id: uid('rem_'), elderId, title: 'Quick check-in 💬', kind: 'custom' as const, time: c.time, days, date: null, medicationId: null, active: true,
      }))],
      billing: { ...base.billing, volunteerUsed: 0, balance: 0, ledger: [], invoices: [], paymentMethod: null },
      onboarded: { caretaker: true, elder: false },
      setup: { sentVia: null, sentAt: null }, tours: { caretaker: false, elder: false },
    })
    // Paid plan → pay first; the receipt then leads to phone setup. Basic → straight to phone setup.
    // Top up first: pay for credit (or a plan), and the receipt leads on to phone setup.
    nav(skipCredit ? '/caretaker/setup-phone' : plan !== 'basic' ? `/caretaker/checkout/${plan}?cycle=${cycle}` : `/caretaker/checkout/topup?amount=${credit}`)
  }

  // Sign-in happens on /login before onboarding. Someone who already uses Elderly and is adding another person skips the welcome.
  const adding = L && (st.live.status === 'ready' || st.live.status === 'needsElder')
  useEffect(() => { if (adding && step < 1) setStep(1) }, [adding]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (L && st.live.email && !me.email) setMe(m => ({ ...m, email: st.live.email ?? '', name: m.name || st.live.displayName || '' })) }, [st.live.email]) // eslint-disable-line react-hooks/exhaustive-deps

  const screens: { body: ReactNode; cta?: string; ok?: boolean; action?: () => void; above?: ReactNode }[] = [
    // 0 — welcome + how we handle data
    { cta: 'I agree — get started', ok: dataOk, above: <ConsentCheck agreed={dataOk} onChange={setDataOk} />, body: <>
      <div className="brand" style={{ marginTop: 8 }}><span className="logo" aria-hidden>♥</span>Elderly</div>
      <h1>Care for the people you love — even from far away.</h1>
      <p className="lead">A helper they can simply talk to. You set the rules and step in when it matters.</p>
      <PrivacyConsent />
    </> },
    // 1 — about them (+ nickname, consent, data note)
    { ok: !!them.nickname.trim() && !!them.name.trim() && !phoneError(them.phone) && addressComplete(address) && consent, body: <>
      <h1>Who are you caring for?</h1>
      <div className="field">What do you call them?
        <div className="chips-pick" role="radiogroup" aria-label="What you call them">
          {NICKS.map(n => <button key={n} role="radio" aria-checked={them.nickname === n && !customNick} className={them.nickname === n && !customNick ? 'on' : ''} onClick={() => { setCustomNick(false); setThem({ ...them, nickname: n }) }}>{n}</button>)}
          <button className={customNick ? 'on' : ''} onClick={() => { setCustomNick(true); setThem({ ...them, nickname: '' }) }}>Other…</button>
        </div>
        {customNick && <input autoFocus value={them.nickname} onChange={e => setThem({ ...them, nickname: e.target.value })} placeholder="e.g. Auntie May, Pop, Ah Ma" />}
      </div>
      <label className="field">Their name<input value={them.name} onChange={e => setThem({ ...them, name: e.target.value })} /></label>
      <PhoneField label="Their phone number" value={them.phone} onChange={v => setThem({ ...them, phone: v })} defaultCountry={countryForTimezone(them.timezone)} />
      <div className="row">
        <label className="field grow">Language<select value={them.language} onChange={e => setThem({ ...them, language: e.target.value as Language })}>{LANGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label className="field grow">Lives in<select value={them.timezone} onChange={e => setThem({ ...them, timezone: e.target.value })}>{TIMEZONES.map(t => <option key={t.tz} value={t.tz}>{t.label}</option>)}</select></label>
      </div>
      <p className="eyebrow" style={{ marginTop: 4 }}>Home address · for deliveries & rides</p>
      <AddressFields value={address} onChange={setAddress} country={countryForTimezone(them.timezone)} />
      <p className="note-lock"><span>🔒</span><span>Only used to call, deliver and speak their language. {Nk} can see and change all of it, and nothing is shared beyond the family they choose.</span></p>
      <label className="consent"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /><span>I’ve talked with {nk} and they’re happy to use Elderly.</span></label>
    </> },
    // 2 — your name
    { ok: me.name.trim().length > 0 && (!L || !phoneError(me.phone)), body: <>
      <h1>What does {nk} call you?</h1>
      <p className="lead">This name appears on their screen next to your photo.</p>
      <label className="field">Your name<input value={me.name} onChange={e => setMe({ ...me, name: e.target.value })} placeholder="Emma" autoFocus /></label>
      <PhoneField label="Your phone number" value={me.phone} onChange={v => setMe({ ...me, phone: v })} defaultCountry={countryForTimezone(them.timezone)} />
      <span className="small muted" style={{ marginTop: -6 }}>So {nk} can call you with one tap, and the helper can reach you in an emergency.</span>
      <div className="field">You are their…
        <div className="chips-pick">{['daughter', 'son', 'granddaughter', 'grandson', 'carer', 'friend'].map(r => (
          <button key={r} className={(me.relationship || relFor(nk)) === r ? 'on' : ''} onClick={() => setMe({ ...me, relationship: r })}>{r}</button>
        ))}</div>
      </div>
      <p className="small muted">Add a clear, smiling photo later — a familiar face is easier to recognise than a name.</p>
    </> },
    // 3 — daily rhythm
    { body: <>
      <h1>{Nk}’s daily rhythm</h1>
      <p className="lead">From waking up to bedtime. The helper uses this for reminders and a friendly check-in. Skip any meal {nk} doesn’t usually have.</p>
      <div className="card rhythm" ref={rhythmList}>
        {rowOrder.map(k => {
          const extra = extraCheckins.find(c => c.id === k)
          if (extra) return (
            <div key={k} data-row={k} className="rhy-row">
              <span className="rhy-ic" aria-hidden>💬</span>
              <div className="grow"><b>Check-in</b><span className="rhy-note">Extra</span></div>
              <input type="time" aria-label="Extra check-in time" value={extra.time} onBlur={commitOrder}
                onChange={e => e.target.value && setExtraCheckins(cs => cs.map(x => x.id === k ? { ...x, time: e.target.value } : x))} />
              <span className="rhy-end"><button className="rhy-x" aria-label="Remove check-in" onClick={() => removeCheckin(k)}>✕</button></span>
            </div>
          )
          const key = k as keyof typeof rhythm
          const [ic, label] = ({ wake: ['☀️', 'Wake up'], breakfast: ['🍳', 'Breakfast'], checkIn: ['💬', 'Check-in'],
            lunch: ['🍱', 'Lunch'], dinner: ['🍲', 'Dinner'], bed: ['🌙', 'Bedtime'] } as const)[key]
          const meal = key === 'breakfast' || key === 'lunch' || key === 'dinner'
          const off = meal && skip[key]
          return (
            <div key={k} data-row={k} className={`rhy-row ${off ? 'off' : ''}`}>
              <span className="rhy-ic" aria-hidden>{ic}</span>
              <div className="grow"><b>{label}</b>{off ? <span className="rhy-note">Skipped</span> : key === 'checkIn' ? <span className="rhy-note">Daily</span> : null}</div>
              <input type="time" aria-label={`${label} time`} value={rhythm[key]} disabled={off} onBlur={commitOrder}
                onChange={e => e.target.value && setRhythm({ ...rhythm, [key]: e.target.value })} />
              <span className="rhy-end">
                {meal && <Switch checked={!skip[key]} onChange={on => setSkip({ ...skip, [key]: !on })} label={`${nk} usually has ${label.toLowerCase()}`} />}
              </span>
            </div>
          )
        })}
      </div>
      <p className="small muted" style={{ marginTop: -4 }}>Switch a meal off if {nk} doesn’t usually have it.</p>
      <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={addCheckin}>＋ Add another check-in</button>
      <div className="field">Check-in days
        <div className="chips-pick">{(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as Day[]).map(d => (
          <button key={d} className={days.includes(d) ? 'on' : ''} aria-pressed={days.includes(d)}
            onClick={() => setDays(ds => ds.includes(d) ? (ds.length > 1 ? ds.filter(x => x !== d) : ds) : [...ds, d])}>{d.charAt(0).toUpperCase() + d.slice(1)}</button>
        ))}</div>
      </div>
      <label className="field">Anything the helper should know?<textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} /></label>
    </> },
    // 4 — medicines
    { body: <>
      <h1>{Nk}’s medicines</h1>
      <p className="lead">We’ll remind them at each time and let you know if one is missed.</p>
      {meds.map((m, i) => (
        <div key={m.id} className="card stack medcard" style={{ gap: 8 }}>
          <div className="row"><label className="field grow">💊 Medicine<input value={m.name} onChange={e => setMeds(ms => ms.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} /></label>
            <label className="field" style={{ width: 100 }}>Dose<input value={m.dose} onChange={e => setMeds(ms => ms.map((x, j) => j === i ? { ...x, dose: e.target.value } : x))} /></label></div>
          <div className="field">Times each day
            <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
              {m.times.map((t, ti) => (
                <span key={ti} className="row" style={{ gap: 2 }}>
                  <input type="time" style={{ width: 120 }} value={t} aria-label={`Time ${ti + 1}`}
                    onChange={e => setMeds(ms => ms.map((x, j) => j === i ? { ...x, times: x.times.map((y, yi) => yi === ti ? e.target.value : y) } : x))} />
                  {m.times.length > 1 && <button className="btn sm ghost" aria-label="Remove time" onClick={() => setMeds(ms => ms.map((x, j) => j === i ? { ...x, times: x.times.filter((_, yi) => yi !== ti) } : x))}>✕</button>}
                </span>
              ))}
              {m.times.length < 8 && <button className="btn sm" onClick={() => setMeds(ms => ms.map((x, j) => j === i ? { ...x, times: [...x.times, '20:00'] } : x))}>＋ time</button>}
            </div>
          </div>
          <div className="row"><label className="row small grow" style={{ fontWeight: 700 }}><input type="checkbox" checked={m.withFood} onChange={e => setMeds(ms => ms.map((x, j) => j === i ? { ...x, withFood: e.target.checked } : x))} /> Take with food</label>
            <button className="btn sm ghost" onClick={() => setMeds(ms => ms.filter((_, j) => j !== i))}>Remove medicine</button></div>
        </div>
      ))}
      <button className="btn" onClick={() => setMeds(ms => [...ms, { id: uid('m'), name: '', dose: '', times: ['20:00'], withFood: true, notes: '' }])}>＋ Add a medicine</button>
    </> },
    // 5 — faces (a person with a name needs a valid number, or they can't be called)
    { ok: people.every(p => !p.name.trim() || !phoneError(p.phone)), body: <>
      <h1>Faces {nk} can call</h1>
      <p className="lead">They appear as big photos on {nk}’s home screen — one tap to call.</p>
      <div className="row card"><Face k={faceFor(me.name)} name={me.name} size={52} /><div className="grow"><b>{me.name || 'You'}</b><p className="small muted">You · added automatically</p></div><span className="pill ok">✓</span></div>
      {people.map((p, i) => (
        <div key={i} className="card stack medcard" style={{ gap: 8 }}>
          <div className="row"><Face k={faceFor(p.name)} name={p.name} size={44} />
            <label className="field grow">Name<input value={p.name} onChange={e => setPeople(ps => ps.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} /></label></div>
          <div className="row"><label className="field grow">Relationship<input value={p.relationship} onChange={e => setPeople(ps => ps.map((x, j) => j === i ? { ...x, relationship: e.target.value } : x))} /></label>
            <div className="grow"><PhoneField label="Phone" value={p.phone} onChange={v => setPeople(ps => ps.map((x, j) => j === i ? { ...x, phone: v } : x))} defaultCountry={countryForTimezone(them.timezone)} /></div></div>
        </div>
      ))}
      <button className="btn" onClick={() => setPeople(ps => [...ps, { name: '', relationship: '', phone: '' }])}>＋ Add someone</button>
    </> },
    // 6 — independence
    { body: <>
      <h1>How independent should the helper be?</h1>
      <p className="lead">You can fine-tune every action later in Rules. Emergencies always get help right away.</p>
      {PRESETS.map(p => (
        <button key={p.id} className={`choice ${preset === p.id ? 'on' : ''}`} onClick={() => setPreset(p.id)}>
          <span className="ic">{p.ic}</span><div className="grow"><b>{p.t}</b><p className="small muted">{p.d}</p></div>{preset === p.id && <span>✓</span>}
        </button>
      ))}
    </> },
    // 7 — how to start: Free tier, or top up care credit (a monthly plan is optional).
    L ? { cta: busy ? 'Setting things up…' : 'Finish setup', ok: !busy, action: () => finish(true), body: <>
      <h1>You’re starting on Free</h1>
      <p className="lead">The AI helper, family chat, daily check-ins and emergency alerts are free.</p>
      <div className="choice on" style={{ alignItems: 'flex-start' }}><span className="ic">🎁</span>
        <div className="grow"><div className="row"><b className="grow">Free</b><b>$0</b></div>
          <p className="small muted">AI helper, family chat, check-ins & SOS · no card needed</p></div></div>
      <ComingSoon card title="Care credit & monthly plans">Prepaid credit for volunteer visits and the Premium / Pro plans are on the way. We’ll let you know — nothing is charged today.</ComingSoon>
      <p className="note-lock"><span>🔐</span><span>Finishing creates {nk}’s account on Elderly and saves the routine, medicines, people and rules you entered.</span></p>
    </> } :
    { cta: plan !== 'basic' ? `Finish & pay for ${plan === 'pro' ? 'Pro' : 'Premium'}` : startFree ? 'Start free' : `Top up ${formatUsd(credit)} & finish`,
      action: () => finish(plan === 'basic' && startFree), body: <>
      <h1>Choose how to start</h1>
      <p className="lead">The AI helper is free for everyone. Add credit only if you want more volunteer visits than the free ones.</p>

      <button className={`choice ${plan === 'basic' && startFree ? 'on' : ''}`} style={{ alignItems: 'flex-start' }} aria-pressed={plan === 'basic' && startFree}
        onClick={() => { setStartFree(true); setPlan('basic') }}>
        <span className="ic">🎁</span>
        <div className="grow">
          <div className="row"><b className="grow">Free</b><b>$0</b></div>
          <p className="small muted">AI helper, family chat, check-ins & SOS · <b>{planById('basic').volunteerCalls} free volunteer calls</b> every month · no card needed</p>
        </div>
      </button>

      <button className={`choice ${plan === 'basic' && !startFree ? 'on' : ''}`} style={{ alignItems: 'flex-start' }} aria-pressed={plan === 'basic' && !startFree}
        onClick={() => { setStartFree(false); setPlan('basic') }}>
        <span className="ic">💳</span>
        <div className="grow">
          <div className="row"><b className="grow">Free + care credit</b><b>from {formatUsd(CREDIT.minTopUpUsd)}</b></div>
          <p className="small muted">Everything in Free, then <b>{formatUsd(CREDIT.callPriceUsd)} per extra volunteer call</b>. Credit never expires.</p>
        </div>
      </button>
      {plan === 'basic' && !startFree && <>
        <p className="eyebrow">Top-up amount · minimum {formatUsd(CREDIT.minTopUpUsd)}</p>
        <TopUpPicker value={credit} onChange={setCredit} />
      </>}

      <p className="note-lock"><span>🚨</span><span><b>Emergencies are never blocked</b> — on either option. If credit runs out, urgent help still goes ahead (down to −{formatUsd(-CREDIT.emergencyFloorUsd)}) and is repaid with your next top-up.</span></p>

      <button className="btn ghost" style={{ alignSelf: 'flex-start', color: 'var(--accent)' }} onClick={() => setShowPlans(v => !v)}>
        {showPlans ? '▾' : '▸'} Or save with a monthly plan {plan !== 'basic' ? `(${plan === 'pro' ? 'Pro' : 'Premium'} selected)` : ''}
      </button>
      {showPlans && <>
        <div className="row" style={{ flexWrap: 'wrap' }}><span className="grow small muted">Sample prices (USD) · payments not live yet</span><CycleToggle cycle={cycle} setCycle={setCycle} /></div>
        <PlanCards cycle={cycle} current={plan === 'basic' ? undefined : plan} onChoose={id => { setPlan(id); if (id === 'basic') setStartFree(true) }} compact />
      </>}
    </> },
  ]
  const sc = screens[step]
  if (L && st.live.status === 'signedOut') return <Navigate to="/login?next=%2Fonboarding%2Fcaretaker" replace />
  if (L && st.live.role === 'elder') return <Navigate to="/elder" replace />
  return (
    <div className="shell framed">
      <Frame step={step} total={total} onBack={adding && step <= 1 ? () => nav('/caretaker') : back} foot={<>
        {sc.above}
        <button className="btn pri block" style={{ minHeight: 52 }} disabled={sc.ok === false} onClick={() => sc.action ? sc.action() : next()}>
          {sc.cta ?? 'Continue'}
        </button>
      </>}>{sc.body}</Frame>
    </div>
  )
}

// ===================== Elder onboarding (on their own phone) =====================
export function ElderOnboarding() {
  const s = useDemo()
  const nav = useNavigate()
  const [step, setStep] = useState(0)
  const [heard, setHeard] = useState('')
  const [listening, setListening] = useState(false)
  const lang = s.elder.language
  const t = strings(lang).ob
  const care = s.caretaker.name || strings(lang).yourFamily
  const family = s.contacts.filter(c => c.kind !== 'volunteer').slice(0, 4)

  const steps: { say: string; body: ReactNode; cta: string; next?: () => void }[] = [
    { say: `${t.hello} ${t.setUp(care)}`, cta: t.start, body: <>
      <WaveHand />
      <h1 className="center" style={{ fontSize: 38 }}>{t.hello}</h1>
      <p className="center" style={{ fontSize: 22 }}>{t.setUp(care)}</p>
    </> },
    { say: t.imHelperSay(s.elder.name), cta: t.next, body: <>
      <div className="center bob" style={{ marginTop: 10, display: 'flex', justifyContent: 'center' }}><Face k={s.elder.face} name={s.elder.name} size={130} /></div>
      <h1 className="center" style={{ fontSize: 34 }}>{t.hi(s.elder.name)}</h1>
      <p className="center" style={{ fontSize: 22 }}>{t.imHelper}</p>
      <button className="bb no" onClick={() => speak(`${t.hi(s.elder.name)} ${t.imHelper}`, lang)}>{t.sayAgain}</button>
    </> },
    { say: t.micSay, cta: t.allowMic, next: async () => {
      // Never get stuck on an ignored permission prompt: move on after 5 s either way.
      const ask = navigator.mediaDevices?.getUserMedia({ audio: true }).then(st => st.getTracks().forEach(t => t.stop()))
      try { await Promise.race([ask, new Promise(r => setTimeout(r, 5000))]) } catch { /* denied: big buttons still work */ }
      setStep(x => x + 1)
    }, body: <>
      <div className="micwrap" style={{ marginTop: 30 }}><div className="mic on" aria-hidden><MicIcon /></div></div>
      <h1 className="center" style={{ fontSize: 32 }}>{t.micTitle}</h1>
      <p className="center" style={{ fontSize: 21 }}>{t.micBody}</p>
    </> },
    { say: t.trySay, cta: heard ? t.next : t.skip, body: <>
      <h1 className="center" style={{ fontSize: 32 }}>{t.tryTitle}</h1>
      <p className="center" style={{ fontSize: 21 }}>{t.tryBody}</p>
      <div className="micwrap"><button className={`mic ${listening ? 'on' : ''}`} aria-label={strings(lang).speak} onClick={() => {
        if (!canListen()) { setHeard(t.helloWord); speak(t.niceToMeet(s.elder.name), lang); return }
        setListening(true); listen(lang, said => { setHeard(said); setListening(false); speak(t.niceToMeet(s.elder.name), lang) }, () => setListening(false))
      }}><MicIcon /></button></div>
      {heard && <p className="done-note" style={{ justifyContent: 'center' }}>{t.heard(heard)}</p>}
    </> },
    { say: t.peopleSay, cta: t.next, body: <>
      <h1 className="center" style={{ fontSize: 32 }}>{t.peopleTitle}</h1>
      <p className="center" style={{ fontSize: 21 }}>{t.peopleBody}</p>
      <div className="people" style={{ marginTop: 10 }}>{family.map((c, i) => (
        <div key={c.id} className="center" style={{ fontWeight: 700, fontSize: 17, display: 'flex', flexDirection: 'column', alignItems: 'center', animation: `pop .5s ${0.2 + i * 0.2}s both cubic-bezier(.2,1.6,.4,1)` }}>
          <Face k={c.face} name={c.name} size={74} /><p style={{ marginTop: 6 }}>{c.name}</p>
        </div>
      ))}</div>
    </> },
    { say: t.setSay, cta: t.startUsing, next: () => { if (isLive()) { update(d => { d.onboarded.elder = true }); nav('/elder'); return } update(d => { d.onboarded.elder = true; d.logs.unshift({ id: uid('log_'), timestamp: new Date().toISOString(), actor: 'elder', message: `${d.elder.nickname || d.elder.name}’s phone is connected — you can chat now 🎉`, kind: 'ok', ack: true, checkInId: null }) }); nav('/elder') }, body: <>
      <Confetti />
      <div className="center" style={{ fontSize: 90, marginTop: 30, animation: 'pop .6s both cubic-bezier(.2,1.6,.4,1)' }}>🎉</div>
      <h1 className="center" style={{ fontSize: 36 }}>{t.setTitle}</h1>
      <p className="center" style={{ fontSize: 22 }}>{t.setBody}</p>
    </> },
  ]
  const sc = steps[step]
  useEffect(() => { if (getState().elderUi.voice) speak(sc.say, lang) }, [step]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="shell framed" style={{ position: 'relative' }}>
      <Frame step={step} total={steps.length} onBack={step > 0 ? () => setStep(x => x - 1) : undefined}
        foot={<button className="bb yes" onClick={() => sc.next ? sc.next() : setStep(x => x + 1)}>{sc.cta}</button>}>
        {sc.body}
      </Frame>
    </div>
  )
}

// ===================== The setup link, opened on the elder's phone =====================
/** /join/:code — signs the phone in with the account the caretaker created, then starts the spoken welcome. */
export function JoinLink() {
  return isLive() ? <JoinLive /> : <JoinDemo />
}

/** Live: the link's #fragment carries the elder's sign-in (never sent to any server); sign in, then the welcome. */
function JoinLive() {
  const s = useDemo()
  const nav = useNavigate()
  const { code } = useParams()
  const [err, setErr] = useState('')
  useEffect(() => {
    const creds = decodeSetup(location.hash.slice(1))
    history.replaceState(null, '', location.pathname)  // don't leave the password in the address bar
    if (!creds) { setErr('This link is incomplete. Ask your family to send it again.'); return }
    signInElder(creds.email, creds.password).catch((e: { code?: string }) =>
      setErr(e.code?.includes('invalid-credential') ? 'This link has already been used or has expired. Ask your family to send a new one.' : 'Couldn’t sign in — check your internet and try again.'))
  }, [code])
  useEffect(() => {
    if (s.live.status === 'ready' && s.live.role === 'elder') nav(s.onboarded.elder ? '/elder' : '/onboarding/elder', { replace: true })
  }, [s.live.status, s.live.role]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="shell framed">
      <div className="success" style={{ margin: 'auto' }}>
        <span className="logo" style={{ width: 72, height: 72, borderRadius: 22, fontSize: 36 }}>♥</span>
        <h1 style={{ fontSize: 32 }}>Elderly</h1>
        {err ? <>
          <p className="err" role="alert" style={{ fontSize: 18 }}>{err}</p>
          <button className="btn" onClick={() => nav('/login?as=elder')}>Sign in another way</button>
        </> : <>
          <div className="spinner" />
          <p style={{ fontSize: 20 }}>{strings(s.elder.language).signingIn}</p>
        </>}
      </div>
    </div>
  )
}

function JoinDemo() {
  const s = useDemo()
  const nav = useNavigate()
  useEffect(() => {
    update(d => { if (d.logs[0]?.message.endsWith('opened the setup link')) return; d.logs.unshift({ id: uid('log_'), timestamp: new Date().toISOString(), actor: 'elder', message: `${d.elder.nickname || d.elder.name} opened the setup link`, kind: 'ok', ack: true, checkInId: null }) })
    const t = window.setTimeout(() => nav('/onboarding/elder', { replace: true }), 1800)
    return () => window.clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="shell framed">
      <div className="success" style={{ margin: 'auto' }}>
        <span className="logo" style={{ width: 72, height: 72, borderRadius: 22, fontSize: 36 }}>♥</span>
        <h1 style={{ fontSize: 32 }}>Elderly</h1>
        <div className="spinner" />
        <p style={{ fontSize: 20 }}>Signing you in, {s.elder.name}…</p>
        {s.caretaker.name && <p className="small muted">Set up for you by {s.caretaker.name}</p>}
      </div>
    </div>
  )
}
