/**
 * Caretaker screens for features the backend already has (app/routers/people.py, settings.py, checkins.py).
 */
import { InsightsCard } from './InsightsCard'
import { useState } from 'react'
import { nick, useDemo } from '../data/store'
import { isLive } from '../data/mode'
import { inviteCaretaker, saveAddress, saveEmergencyContacts, setRequestStatus } from '../data/actions'
import { Face } from '../components/Face'
import { timeAgo, useToast } from '../components/ui'
import { planById } from '../lib/plans'
import type { Address, CheckInRecord, EmergencyContact, HelpRequest, Mood } from '../lib/types'
import { CHead } from './CaretakerApp'

const MOOD_EMOJI: Record<Mood, string> = { great: '😄', good: '😊', okay: '😐', low: '😕', bad: '😟' }
const MOOD_LABEL: Record<Mood, string> = { great: 'great', good: 'good', okay: 'okay', low: 'a bit low', bad: 'not good' }

// ---------------- Address (backend geocodes it; orders are refused without one) ----------------
export const EMPTY_ADDRESS: Address = { line1: '', line2: '', landmark: '', city: '', postcode: '' }

export function AddressFields({ value, onChange }: { value: Address; onChange: (a: Address) => void }) {
  const f = (k: keyof Address, label: string, ph: string, extra: object = {}) => (
    <label className="field grow">{label}<input value={(value[k] as string) ?? ''} placeholder={ph} onChange={e => onChange({ ...value, [k]: e.target.value })} {...extra} /></label>
  )
  return (
    <div className="stack" style={{ gap: 10 }}>
      {f('line1', 'Street address', '14 Elm Street')}
      <div className="row">{f('line2', 'Unit / floor', '#03-02')}{f('postcode', 'Postcode', '238801', { inputMode: 'numeric' })}</div>
      {f('landmark', 'Landmark (helps drivers)', 'Near Riverside Park')}
      {f('city', 'City', 'Singapore')}
    </div>
  )
}
export const addressComplete = (a: Address | null) => !!a && a.line1.trim().length > 0 && a.city.trim().length > 0

function AddressCard() {
  const s = useDemo()
  const toast = useToast()
  const [a, setA] = useState<Address>(s.elder.address ?? EMPTY_ADDRESS)
  const located = s.elder.address?.precision
  return (
    <div className="card stack" style={{ gap: 10 }}>
      <div className="row"><p className="eyebrow grow">Home address</p>
        {located ? <span className="pill ok">📍 Located ({located})</span> : <span className="pill warn">Not located yet</span>}</div>
      <p className="small muted">Used for food & medicine delivery and ride pickups. Orders can’t be placed without it.</p>
      <AddressFields value={a} onChange={setA} />
      <button className="btn pri" disabled={!addressComplete(a)} onClick={() => { saveAddress(a); toast('Saved — we’ll locate it on the map') }}>Save address</button>
    </div>
  )
}

function EmergencyContactsCard() {
  const s = useDemo()
  const toast = useToast()
  const [list, setList] = useState<EmergencyContact[]>(s.elder.emergencyContacts)
  const set = (i: number, k: keyof EmergencyContact, v: string) => setList(l => l.map((c, j) => j === i ? { ...c, [k]: v } : c))
  return (
    <div className="card stack" style={{ gap: 10 }}>
      <p className="eyebrow">Emergency contacts</p>
      <p className="small muted">Who to reach first in an emergency (up to 10).</p>
      {list.map((c, i) => (
        <div key={i} className="stack" style={{ gap: 6, borderTop: i ? '1px solid var(--line)' : 0, paddingTop: i ? 10 : 0 }}>
          <div className="row"><label className="field grow">Name<input value={c.name} onChange={e => set(i, 'name', e.target.value)} /></label>
            <button className="btn sm ghost" style={{ marginTop: 18 }} aria-label="Remove" onClick={() => setList(l => l.filter((_, j) => j !== i))}>✕</button></div>
          <div className="row"><label className="field grow">Phone<input value={c.phone} inputMode="tel" onChange={e => set(i, 'phone', e.target.value)} /></label>
            <label className="field grow">Relationship<input value={c.relationship} onChange={e => set(i, 'relationship', e.target.value)} /></label></div>
        </div>
      ))}
      {list.length < 10 && <button className="btn" onClick={() => setList(l => [...l, { name: '', phone: '', relationship: '' }])}>＋ Add contact</button>}
      <button className="btn pri" disabled={list.some(c => !c.name.trim() || c.phone.trim().length < 5)}
        onClick={() => { saveEmergencyContacts(list); toast('Emergency contacts saved') }}>Save contacts</button>
    </div>
  )
}

/** Mounted inside Settings. */
export function ProfileExtras() {
  return <><AddressCard /><EmergencyContactsCard /></>
}

// ---------------- Family members (co-caretakers) ----------------
export function FamilyMembers() {
  const s = useDemo()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const seats = isLive() ? Infinity : planById(s.billing.plan).familySeats
  const used = s.caretakers.length + s.invites.length
  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
  return (
    <>
      <CHead title="Family members" sub={`Who helps care for ${nick(s)}`} back="/caretaker/more" />
      <div className="scroll"><div className="c-body">
        <div className="card">
          {s.caretakers.map(c => (
            <div key={c.uid} className="list-row"><Face k={s.contacts.find(x => x.name === c.name)?.face} name={c.name} size={44} />
              <div className="grow"><p className="t">{c.name}{c.uid === s.caretaker.uid ? ' (you)' : ''}</p><p className="s">{c.email}</p></div><span className="pill ok">Active</span></div>
          ))}
          {s.invites.map(e => (
            <div key={e} className="list-row"><Face name={e} size={44} />
              <div className="grow"><p className="t">{e}</p><p className="s">Joins when they first sign in with Google</p></div><span className="pill warn">Invited</span></div>
          ))}
        </div>
        <div className="card stack" style={{ gap: 10 }}>
          <p className="eyebrow">Invite someone</p>
          <p className="small muted">They’ll get the same chat, alerts and approvals.{isLive() ? '' : ` ${used}/${seats} family seats used on ${planById(s.billing.plan).name}.`}</p>
          <label className="field">Their Google email<input type="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tom@gmail.com" /></label>
          <button className="btn pri" disabled={!valid || used >= seats} onClick={() => {
            const r = inviteCaretaker(email); setEmail('')
            if (r !== 'pending') toast(r === 'added' ? 'Already has an account — added now' : 'Invite sent — they’re added when they sign in')
          }}>{used >= seats ? 'All seats used — upgrade for more' : 'Send invite'}</button>
        </div>
      </div></div>
    </>
  )
}

// ---------------- Help requests (volunteers reply by phone; you record the outcome) ----------------
const REQ_PILL: Record<HelpRequest['status'], [string, string]> = {
  open: ['warn', 'Open'], notified: ['info', 'Volunteer texted'], confirmed: ['ok', 'Confirmed'], done: ['ok', 'Done ✓'], cancelled: ['bad', 'Cancelled'],
}

export function HelpRequests() {
  const s = useDemo()
  return (
    <>
      <CHead title="Help requests" sub="Volunteers reply by phone — mark the outcome here" back="/caretaker/more" />
      <div className="scroll"><div className="c-body">
        {s.requests.length === 0 && <div className="card center" style={{ padding: 24 }}><p style={{ fontSize: 30 }}>🤝</p><p className="small muted">No requests yet. When {nick(s)} asks for help at home, it shows up here.</p></div>}
        {s.requests.map(r => {
          const [cls, label] = REQ_PILL[r.status]
          const vol = s.contacts.find(c => c.id === r.volunteerId)
          const open = r.status === 'open' || r.status === 'notified' || r.status === 'confirmed'
          return (
            <div key={r.id} className="card stack" style={{ gap: 8 }}>
              <div className="row"><span style={{ fontSize: 24 }}>🤝</span><div className="grow"><b>{r.title}</b><p className="small muted">{r.skill}{r.preferredTime ? ` · ${r.preferredTime}` : ''} · {timeAgo(r.createdAt)}</p></div><span className={`pill ${cls}`}>{label}</span></div>
              {r.volunteerName && <div className="row"><Face k={vol?.face} name={r.volunteerName} size={34} /><p className="small grow">{r.volunteerName}</p>
                {vol && <a className="btn sm" href={`tel:${vol.phone.replace(/\s/g, '')}`}>📞 Call</a>}</div>}
              {open && (
                <div className="row">
                  {r.status !== 'confirmed' && <button className="btn sm grow" onClick={() => setRequestStatus(r.id, 'confirmed')}>✓ Confirmed</button>}
                  <button className="btn sm acc grow" onClick={() => setRequestStatus(r.id, 'done')}>Done</button>
                  <button className="btn sm grow" onClick={() => setRequestStatus(r.id, 'cancelled')}>Cancel</button>
                </div>
              )}
            </div>
          )
        })}
      </div></div>
    </>
  )
}

// ---------------- Check-in history (last 7 days) ----------------
export function weekCheckins(s: ReturnType<typeof useDemo>): CheckInRecord[] {
  const today = new Date().toISOString().slice(0, 10)
  const todays: CheckInRecord[] = s.checkin.stage === 'done' && s.checkin.mood
    ? [{ id: 'today', elderId: s.elder.elderId, date: today, status: 'done', mood: s.checkin.mood, sleepQuality: null, sleepHours: null, meals: null, medicationTaken: null, anomalies: [], urgent: [], escalateFlag: s.checkin.mood === 'bad' }]
    : []
  return [...todays, ...s.checkinHistory].slice(0, 7)
}

export function CheckinHistory() {
  const s = useDemo()
  const rows = weekCheckins(s)
  return (
    <>
      <CHead title="Check-ins" sub="The last 7 days" back="/caretaker" />
      <div className="scroll"><div className="c-body">
        <InsightsCard s={s} />
        <div className="card row" style={{ justifyContent: 'space-between' }}>
          {[...rows].reverse().map(c => (
            <div key={c.id} className="center" style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>
              <div style={{ fontSize: 26 }}>{c.mood ? MOOD_EMOJI[c.mood] : '—'}</div>{new Date(c.date).toLocaleDateString('en-GB', { weekday: 'short' })}
            </div>
          ))}
        </div>
        {rows.map(c => {
          const warn = c.mood === 'low' || c.mood === 'bad' || c.medicationTaken === false || c.sleepQuality === 'poorly' || c.anomalies.length > 0
          return (
            <div key={c.id} className="card stack" style={{ gap: 6, ...(warn ? { borderColor: 'var(--amber)' } : {}) }}>
              <div className="row"><span style={{ fontSize: 28 }}>{c.mood ? MOOD_EMOJI[c.mood] : '—'}</span>
                <div className="grow"><b>{new Date(c.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}</b>
                  <p className="small muted">Feeling {c.mood ? MOOD_LABEL[c.mood] : '—'}</p></div>
                {warn && <span className="pill warn">Worth a call</span>}</div>
              <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                {c.sleepQuality && <span className="pill info">😴 Slept {c.sleepQuality}{c.sleepHours ? ` · ~${c.sleepHours}h` : ''}</span>}
                {c.medicationTaken !== null && <span className={`pill ${c.medicationTaken ? 'ok' : 'bad'}`}>💊 {c.medicationTaken ? 'Took medicines' : 'Missed medicines'}</span>}
                {c.meals && <span className="pill plum">🍲 {c.meals}</span>}
              </div>
              {c.anomalies.length > 0 && <p className="small" style={{ color: 'var(--amber)', fontWeight: 700 }}>Mentioned: {c.anomalies.join(', ')}</p>}
            </div>
          )
        })}
      </div></div>
    </>
  )
}
