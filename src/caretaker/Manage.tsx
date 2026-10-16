import { useState } from 'react'
import { PhoneField } from '../components/PhoneField'
import { countryForTimezone, phoneError } from '../lib/phone'
import { Link, useNavigate } from 'react-router-dom'
import { nick, resetDemo, update, useDemo } from '../data/store'
import { addContact, addReminder, caretakerDecide, deleteReminder, helperVisitsLeft, quotaLeft, setElderLanguage, setNickname, setRuleLimit, setRuleMode, setSharingTier, setTrustedOnly, toggleTrusted } from '../data/actions'
import { EMBEDDED, isLive } from '../data/mode'
import { selectElder, signOut } from '../data/live'
import { ComingSoon } from '../components/ui'
import { Face } from '../components/Face'
import { MockQR, Sheet, Switch, timeAgo, useToast } from '../components/ui'
import { formatMoney, minorToInput, parseToMinor } from '../lib/money'
import { MODE_LABEL, SPENDING_TOOLS, TOOL_META } from '../lib/policy'
import { CREDIT, formatBalance, formatUsd, planById } from '../lib/plans'
import type { ContactKind, Currency, Mode, SharingTier, ToolName } from '../lib/types'
import { CHead } from './CaretakerApp'
import { ProfileExtras } from './Screens'
import { addressLine } from '../lib/types'

// ---------------- Approvals ----------------
export function Approvals() {
  const s = useDemo()
  const nk = nick(s)
  const toast = useToast()
  const nav = useNavigate()
  const pending = s.actions.filter(a => a.status === 'awaiting_caretaker')
  const history = s.actions.filter(a => a.status !== 'awaiting_caretaker' && a.tool !== 'call_contact').slice(0, 8)
  const cur = s.rules.currency
  return (
    <>
      <CHead title="Approvals" sub={`${nk}’s requests that need you first`} />
      <div className="scroll"><div className="c-body">
        {pending.length === 0 && (
          <div className="card center" style={{ padding: 28 }}>
            <p style={{ fontSize: 34 }}>🎉</p><b>Nothing waiting</b>
            <p className="small muted" style={{ marginTop: 4 }}>Try saying “My kitchen tap is leaking” on {nk}’s phone — volunteer requests need your OK by default.</p>
          </div>
        )}
        {pending.map(a => {
          const limit = a.tool in s.rules.tools ? s.rules.tools[a.tool as ToolName].limitMinor : null
          const over = a.amountMinor != null && limit != null && a.amountMinor > limit
          return (
            <div key={a.id} className="card stack" style={{ gap: 10 }}>
              <div className="row"><span style={{ fontSize: 26 }}>{TOOL_META[a.tool as ToolName]?.ic ?? '🔐'}</span>
                <div className="grow"><b>{a.title}</b><p className="small muted">Asked by voice · {timeAgo(a.createdAt ?? new Date().toISOString())}</p></div>
                {over && <span className="pill warn">Over {formatMoney(limit!, cur)} limit</span>}
              </div>
              <p style={{ fontSize: 17 }}>“{a.requestText}”</p>
              {(a.lines.length > 0 || a.amount) && (
                <div style={{ background: 'var(--bg)', borderRadius: 12, padding: 12 }}>
                  {a.lines.map(l => <p key={l} className="small">• {l}</p>)}
                  {a.amount && <p style={{ marginTop: 6 }}><b>{a.amount}</b> <span className="small muted">{a.provider}</span></p>}
                </div>
              )}
              {a.needsTopUp ? (
                <>
                  <div className="row" style={{ background: 'var(--amber-soft)', borderRadius: 12, padding: 10 }}>
                    <span>⚠️</span><p className="small"><b>Free calls used up and care credit is {formatBalance(s.billing.balance)}.</b> A call costs {formatUsd(CREDIT.callPriceUsd)} — top up to continue.</p>
                  </div>
                  <button className="btn acc block" onClick={() => { caretakerDecide(a.id, true, { topUpUsd: CREDIT.minTopUpUsd }); toast(`Added ${formatUsd(CREDIT.minTopUpUsd)} & approved — ${nk} has been told`) }}>
                    Top up {formatUsd(CREDIT.minTopUpUsd)} & approve
                  </button>
                  <div className="row"><button className="btn grow" onClick={() => nav('/caretaker/plan')}>Other amount</button>
                    <button className="btn grow" onClick={() => caretakerDecide(a.id, false)}>I’ll handle it</button></div>
                </>
              ) : (
                <div className="row">
                  <button className="btn grow" onClick={() => { caretakerDecide(a.id, false); toast(`Declined — ${nk} has been told kindly`) }}>I’ll handle it</button>
                  <button className="btn acc grow" onClick={() => { caretakerDecide(a.id, true); toast(`Approved — ${nk} has been told`) }}>✓ Approve</button>
                </div>
              )}
            </div>
          )
        })}
        {history.length > 0 && <>
          <h3 style={{ fontSize: 18, marginTop: 6 }}>Recent actions</h3>
          <div className="card tl">
            {history.map(a => (
              <div key={a.id} className="it"><div className="ic">{TOOL_META[a.tool as ToolName]?.ic ?? '•'}</div>
                <p className="txt"><b>{a.title}</b> — {a.lines[0] ?? ''}{a.amount ? ` · ${a.amount}` : ''}</p>
                <span className={`pill ${a.status === 'done' || a.status === 'handed_off' ? 'ok' : a.status.startsWith('await') ? 'warn' : 'bad'}`}>{a.status.replace(/_/g, ' ')}</span></div>
            ))}
          </div>
        </>}
      </div></div>
    </>
  )
}

// ---------------- Rules ----------------
export function Rules() {
  const s = useDemo()
  const nk = nick(s)
  const cur = s.rules.currency
  const tools = Object.keys(TOOL_META) as ToolName[]
  return (
    <>
      <CHead title="Helper rules" sub={`What the helper may do when ${nk} asks`} />
      <div className="scroll"><div className="c-body">
        {tools.map(t => {
          const r = s.rules.tools[t]; const meta = TOOL_META[t]
          return (
            <div key={t} className="card stack" style={{ gap: 10 }}>
              <div className="row"><span style={{ fontSize: 24 }}>{meta.ic}</span><div className="grow"><b>{meta.label}</b><p className="small muted">{nk} says: {meta.ex}</p></div></div>
              <div className="seg" role="radiogroup" aria-label={meta.label}>
                {(Object.keys(MODE_LABEL) as Mode[]).map(m => (
                  <button key={m} role="radio" aria-checked={r.mode === m} className={r.mode === m ? 'on' : ''} onClick={() => setRuleMode(t, m)}>
                    {MODE_LABEL[m].l.replace('{nick}', nk)}<small>{MODE_LABEL[m].s.replace('{nick}', nk)}</small>
                  </button>
                ))}
              </div>
              {SPENDING_TOOLS.has(t) && (
                <label className="field">Spending limit per order — above this, you’re always asked
                  <div className="row"><span style={{ fontWeight: 700 }}>{cur}</span>
                    <LimitInput minor={r.limitMinor ?? 0} currency={cur} onValid={m => setRuleLimit(t, m)} /></div>
                </label>
              )}
            </div>
          )
        })}
        <div className="card row">
          <div className="grow"><b>Only trusted volunteers</b><p className="small muted">Starred volunteers get {nk}’s requests</p></div>
          <Switch checked={s.rules.trustedVolunteersOnly} onChange={setTrustedOnly} label="Only trusted volunteers" />
        </div>
        <div className="card" style={{ background: '#26221E', color: '#EDE6DA', border: 0 }}>
          <p className="eyebrow" style={{ color: '#CFC6B8' }}>Always on — can’t be changed</p>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 14.5, lineHeight: 1.6 }}>
            <li>Emergencies call for help right away (with a 10-second “I’m OK”).</li>
            <li>Urgent help at home (burst pipe, locked out…) goes out right away — even if care credit has run out.</li>
            <li>Calling family is always allowed — {nk} places the call.</li>
            <li>Never sends money or shares bank codes.</li>
            <li>Every action is logged and visible to you and {nk}.</li>
          </ul>
        </div>
      </div></div>
    </>
  )
}

// ---------------- People & volunteers ----------------
export function People() {
  const s = useDemo()
  const nk = nick(s)
  const toast = useToast()
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', kind: 'family' as ContactKind, relationship: '' })
  const fam = s.contacts.filter(c => c.kind !== 'volunteer'), vols = s.contacts.filter(c => c.kind === 'volunteer')
  const save = () => {
    const bad = !form.name.trim() ? 'Add their name' : phoneError(form.phone)
    if (bad) { toast(bad); return }
    addContact({ ...form, skills: [], trusted: form.kind !== 'volunteer', email: '' })
    setAdding(false); setForm({ name: '', phone: '', kind: 'family', relationship: '' }); toast(`${form.name} added — ${nk} can tap their face to call`)
  }
  return (
    <>
      <CHead title="People" sub={`Faces ${nk} sees and can call`} back="/caretaker/more" right={<button className="btn sm pri" onClick={() => setAdding(true)}>＋ Add</button>} />
      <div className="scroll"><div className="c-body">
        <div className="card">
          <p className="eyebrow">Family & friends</p>
          {fam.map(c => (
            <div key={c.id} className="list-row"><Face k={c.face} name={c.name} size={48} />
              <div className="grow"><p className="t">{c.name}</p><p className="s">{c.relationship || c.kind} · {c.phone}</p></div></div>
          ))}
        </div>
        <div className="card">
          <div className="row"><p className="eyebrow grow">Volunteers</p>{isLive() ? <ComingSoon>Volunteer credit</ComingSoon> : <span className="pill info">{quotaLeft(s)} free · {formatBalance(s.billing.balance)} credit</span>}</div>
          {isLive() && vols.length === 0 && <p className="small muted" style={{ marginTop: 6 }}>No volunteers yet. Add one with ＋ Add and choose “volunteer”. <ComingSoon>Verified volunteer network</ComingSoon></p>}
          {vols.map(c => (
            <div key={c.id} className="list-row"><Face k={c.face} name={c.name} size={48} />
              <div className="grow"><p className="t">{c.name} {c.rating ? <span className="small muted">★ {c.rating}</span> : null}</p>
                <p className="s">{c.skills.join(' · ')}</p>
                <div className="row" style={{ gap: 4, marginTop: 4 }}>{!isLive() && <span className="pill ok">✓ ID verified</span>}{c.trusted && <span className="pill gold">★ Trusted</span>}</div></div>
              <button className="btn sm ghost" style={{ fontSize: 22 }} onClick={() => toggleTrusted(c.id)} aria-label={c.trusted ? 'Remove trusted' : 'Mark trusted'}>{c.trusted ? '★' : '☆'}</button>
            </div>
          ))}
        </div>
        <Link to="/caretaker/requests" className="card row" style={{ textDecoration: 'none' }}><span style={{ fontSize: 24 }}>🤝</span>
          <div className="grow"><b>Help requests</b><p className="small muted">{s.requests.length} request{s.requests.length === 1 ? '' : 's'} · mark confirmed or done</p></div><span className="chev">›</span></Link>
      </div></div>
      <Sheet open={adding} onClose={() => setAdding(false)} label="Add a contact">
        <h2 style={{ fontSize: 24, marginBottom: 12 }}>Add someone {nk} knows</h2>
        <div className="stack">
          <label className="field">Name<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Grace" /></label>
          <PhoneField label="Phone" value={form.phone} onChange={v => setForm({ ...form, phone: v })} defaultCountry={countryForTimezone(s.assessment.timezone)} />
          <label className="field">Who are they?
            <select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value as ContactKind })}>
              {['family', 'friend', 'neighbour', 'doctor', 'volunteer'].map(k => <option key={k}>{k}</option>)}
            </select></label>
          <label className="field">Relationship (shown to {nk})<input value={form.relationship} onChange={e => setForm({ ...form, relationship: e.target.value })} placeholder="granddaughter" /></label>
          <div className="row" style={{ background: 'var(--bg)', borderRadius: 12, padding: 10 }}><span>📷</span><p className="small">Add a clear, smiling photo — {nk} will recognise a face faster than a name.</p></div>
          <button className="btn pri block" onClick={save}>Save</button>
        </div>
      </Sheet>
    </>
  )
}

// ---------------- Routine (assessment + reminders) ----------------
export function Routine() {
  const s = useDemo()
  const nk = nick(s)
  const a = s.assessment
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState(''), [time, setTime] = useState('17:00')
  const custom = s.reminders.filter(r => r.kind !== 'medication')
  return (
    <>
      <CHead title={`${nk}’s routine`} sub="Drives reminders and the daily check-in" back="/caretaker/more" />
      <div className="scroll"><div className="c-body">
        <div className="card metrics" style={{ boxShadow: 'none' }}>
          <div className="metric"><p className="k">Wakes</p><p className="v">{a.sleep.wakeTime ?? '—'}</p></div>
          <div className="metric"><p className="k">Bedtime</p><p className="v">{a.sleep.bedtime ?? '—'}</p></div>
          <div className="metric"><p className="k">Check-in</p>{a.checkIn.enabled === false ? <p className="v">Off</p> : <>
            <p className="v">{a.checkIn.time}</p><p className="small muted">{a.checkIn.days.length === 7 ? 'Every day' : a.checkIn.days.join(', ')}</p></>}</div>
          <div className="metric"><p className="k">Meals</p><p className="v" style={{ fontSize: 18 }}>{[a.meals.breakfast, a.meals.lunch, a.meals.dinner].filter(Boolean).join(' · ') || '—'}</p></div>
        </div>
        <div className="card">
          <p className="eyebrow">Medicines</p>
          {a.medications.map(m => (
            <div key={m.id} className="list-row"><span style={{ fontSize: 22 }}>💊</span>
              <div className="grow"><p className="t">{m.name} {m.dose}</p><p className="s">{m.times.join(', ')}{m.withFood ? ' · with food' : ''}{m.notes ? ` · ${m.notes}` : ''}</p></div></div>
          ))}
        </div>
        <div className="card">
          <div className="row"><p className="eyebrow grow">Other reminders</p><button className="btn sm" onClick={() => setAdding(true)}>＋ Add</button></div>
          {custom.length === 0 && <p className="small muted" style={{ marginTop: 8 }}>None yet.</p>}
          {custom.map(r => (
            <div key={r.id} className="list-row"><span style={{ fontSize: 22 }}>{r.kind === 'appointment' ? '🩺' : '⏰'}</span>
              <div className="grow"><p className="t">{r.title}</p><p className="s">{r.time} · {r.days ? r.days.join(', ') : r.date}</p></div>
              <button className="btn sm ghost" onClick={() => deleteReminder(r.id)} aria-label="Delete">✕</button></div>
          ))}
        </div>
        {a.healthNotes && <div className="card"><p className="eyebrow">Health notes for the helper</p><p style={{ marginTop: 6 }}>{a.healthNotes}</p></div>}
      </div></div>
      <Sheet open={adding} onClose={() => setAdding(false)} label="Add reminder">
        <h2 style={{ fontSize: 24, marginBottom: 12 }}>New reminder</h2>
        <div className="stack">
          <label className="field">What<input value={title} onChange={e => setTitle(e.target.value)} placeholder="Water the plants" /></label>
          <label className="field">Time<input type="time" value={time} onChange={e => setTime(e.target.value)} /></label>
          <button className="btn pri block" disabled={!title.trim()} onClick={() => {
            addReminder(title.trim(), time)
            setAdding(false); setTitle('')
          }}>Save — every day</button>
        </div>
      </Sheet>
    </>
  )
}

// ---------------- More ----------------
export function More() {
  const s = useDemo()
  const plan = planById(s.billing.plan)
  const items: [string, string, string, string][] = [
    ['/caretaker/plan', '💳', 'Care credit & plan', isLive() ? 'Free · credit & plans coming soon' : `${formatBalance(s.billing.balance)} credit · ${plan.name} · ${helperVisitsLeft(s)} calls available`],
    ['/caretaker/people', '👥', 'People & volunteers', `${s.contacts.length} contacts`],
    ['/caretaker/family', '👪', 'Family members', `${s.caretakers.length} active${s.invites.length ? ` · ${s.invites.length} invited` : ''}`],
    ['/caretaker/requests', '🤝', 'Help requests', `${s.requests.filter(r => ['open', 'notified', 'confirmed'].includes(r.status)).length} in progress`],
    ['/caretaker/checkins', '😊', 'Check-in history', 'The last 7 days'],
    ['/caretaker/routine', '⏰', 'Routine & reminders', `${s.assessment.medications.length} medicines · ${s.assessment.checkIn.enabled === false ? 'no daily check-in' : `check-in ${s.assessment.checkIn.time}`}`],
    ['/caretaker/settings', '⚙️', `${nick(s)}’s profile & privacy`, 'Address, emergency contacts, language, sharing'],
  ]
  return (
    <>
      <CHead title="More" />
      <div className="scroll"><div className="c-body">
        {plan.id !== 'pro' && !isLive() && (
          <Link to="/caretaker/plan" className="card row" style={{ textDecoration: 'none', background: 'linear-gradient(135deg,#FFF7E6,#FFFCF7)', borderColor: '#E9CF97' }}>
            <span style={{ fontSize: 30 }}>✨</span><div className="grow"><b>Upgrade to {plan.id === 'basic' ? 'Premium' : 'Pro'}</b><p className="small muted">{plan.id === 'basic' ? '20 volunteer calls a month + daily AI summary' : '50 calls, 10% off medicine, free delivery'}</p></div><span className="chev">›</span>
          </Link>
        )}
        <div className="card">
          {items.map(([to, ic, t, sub]) => (
            <Link key={to} to={to} className="list-row"><span style={{ fontSize: 24, width: 32, textAlign: 'center' }}>{ic}</span>
              <div className="grow"><p className="t">{t}</p><p className="s">{sub}</p></div><span className="chev">›</span></Link>
          ))}
        </div>
        <div className="card">
          <Link to="/caretaker" className="list-row" onClick={() => update(d => { d.tours.caretaker = false })}><span style={{ fontSize: 24, width: 32, textAlign: 'center' }}>🧭</span><div className="grow"><p className="t">Take the tour again</p><p className="s">A 1-minute walk through the app</p></div><span className="chev">›</span></Link>
          {/* Developer showcase links: only in the standalone demo, never for real users or inside /demo, /try. */}
          {!isLive() && !EMBEDDED && <Link to="/" className="list-row"><span style={{ fontSize: 24, width: 32, textAlign: 'center' }}>🧪</span><div className="grow"><p className="t">Showcase menu</p><p className="s">Side-by-side demo, onboarding, pricing</p></div><span className="chev">›</span></Link>}
        </div>
      </div></div>
    </>
  )
}

// ---------------- Settings ----------------
const TIERS: [SharingTier, string, string][] = [
  ['alerts_only', 'Alerts only', 'Only emergencies and missed check-ins'],
  ['daily_summary', 'Daily summary', 'Mood, check-ins and helper actions (recommended)'],
  ['full_access', 'Full access', 'Also their conversations with the helper'],
]
const LANGS: [string, string][] = [['en-US', 'English'], ['hi-IN', 'हिन्दी Hindi'], ['hi-Latn', 'Hinglish (Hindi in English letters)'], ['th-TH', 'ไทย Thai'], ['ja-JP', '日本語 Japanese'], ['ko-KR', '한국어 Korean']]

export function Settings() {
  const s = useDemo()
  const nk = nick(s)
  const toast = useToast()
  const nav = useNavigate()
  return (
    <>
      <CHead title={`${nk}’s profile`} back="/caretaker/more" />
      <div className="scroll"><div className="c-body">
        <div className="card row"><Face k={s.elder.face} name={s.elder.name} size={64} /><div className="grow"><b style={{ fontSize: 20 }}>{s.elder.name}</b><p className="small muted">{s.elder.phone}</p><p className="small muted">{addressLine(s.elder.address) || 'No address yet'}</p></div></div>
        <div className="field">What you call them
          <div className="chips-pick">{['Mom', 'Dad', 'Grandma', 'Grandpa', 'Nana', 'Papa'].map(n => (
            <button key={n} className={s.elder.nickname === n ? 'on' : ''} onClick={() => { setNickname(n); toast(`The app now says “${n}”${isLive() ? ' on this device' : ''}`) }}>{n}</button>
          ))}</div>
          {isLive() && <p className="small muted" style={{ marginTop: 6 }}>Saved on this device only <ComingSoon>Sync the nickname across family devices</ComingSoon></p>}
        </div>
        <label className="field">Language {nk} speaks
          <select value={s.elder.language} onChange={e => { setElderLanguage(e.target.value as never); toast('Saved — the helper will speak this language') }}>
            {LANGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select></label>
        <ProfileExtras />
        <div className="card">
          <p className="eyebrow">What {nk} shares with family</p>
          {TIERS.map(([v, t, d]) => (
            <button key={v} className={`choice ${s.elder.sharingTier === v ? 'on' : ''}`} style={{ marginTop: 8 }} onClick={() => setSharingTier(v)}>
              <div className="grow"><b>{t}</b><p className="small muted">{d}</p></div>{s.elder.sharingTier === v && <span>✓</span>}
            </button>
          ))}
          <p className="small muted" style={{ marginTop: 8 }}>{nk} is told when this changes. Location is only shared in an emergency.</p>
        </div>
        {isLive() && !s.elder.credentials.tempPassword ? (
          <ComingSoon card title={`Re-send ${nk}’s sign-in`}>The one-time password is shown only once, when the account is created. Resetting it from here is on the way.</ComingSoon>
        ) : (
          <div className="card stack" style={{ alignItems: 'center', textAlign: 'center' }}>
            <p className="eyebrow">{nk}’s phone sign-in</p>
            <div className="qrbox"><MockQR seed={s.elder.credentials.email} size={160} /></div>
            <p className="small muted">{isLive() ? <>Open the setup link on {nk}’s phone, or sign in with:<br /><b>{s.elder.credentials.email}</b></> : <>Scan on {nk}’s phone, or type this one-time code:</>}</p>
            <div className="cred">{s.elder.credentials.tempPassword}</div>
            {isLive() && <Link className="btn" to="/caretaker/setup-phone">Send the setup link again</Link>}
          </div>
        )}
        {isLive() ? <AccountCard /> : (
          <div className="card stack">
            <p className="eyebrow">Demo</p>
            <button className="btn" onClick={() => nav('/onboarding/caretaker')}>Replay caretaker onboarding</button>
            <button className="btn" onClick={() => { resetDemo(); toast('Demo reset'); nav('/caretaker') }}>Reset demo data</button>
          </div>
        )}
      </div></div>
    </>
  )
}


/** Live mode: who's signed in, which person you're caring for, sign out. */
function AccountCard() {
  const s = useDemo()
  const nav = useNavigate()
  const others = s.live.elders.filter(e => e.elderId !== s.live.elderId)
  return (
    <div className="card stack">
      <p className="eyebrow">Your account</p>
      <p className="small"><span className={`live-dot ${s.live.connected ? 'on' : ''}`} />Signed in as <b>{s.live.email}</b></p>
      {others.map(e => (
        <button key={e.elderId} className="btn" onClick={() => { void selectElder(e.elderId); nav('/caretaker') }}>Switch to {e.name}</button>
      ))}
      <button className="btn" onClick={() => nav('/onboarding/caretaker?add=1')}>＋ Care for another person</button>
      <button className="btn" onClick={() => { void signOut().then(() => nav('/login')) }}>Sign out</button>
    </div>
  )
}


/** Spending limit as typed text: parsed exactly (no floats) and saved only when it's a valid amount. */
function LimitInput({ minor, currency, onValid }: { minor: number; currency: Currency; onValid: (minor: number) => void }) {
  const [text, setText] = useState(() => minorToInput(minor, currency))
  const invalid = parseToMinor(text, currency) === null
  return (
    <input type="text" inputMode="decimal" value={text} aria-invalid={invalid} style={{ flex: 1, borderColor: invalid ? 'var(--sos)' : undefined }}
      onChange={e => {
        setText(e.target.value)
        const m = parseToMinor(e.target.value, currency)
        if (m !== null) onValid(m)
      }} />
  )
}
