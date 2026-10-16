import { useState, type ReactNode } from 'react'
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { nick, useDemo, type DemoState } from '../data/store'
import { ackAlerts, caretakerCall, dispatchHelp, emergencyNumber, quotaLeft, quotaTotal } from '../data/actions'
import { isLive } from '../data/mode'
import { Face } from '../components/Face'
import { ComingSoon, Sheet, timeAgo, useToast } from '../components/ui'
import { CREDIT, formatBalance, planById } from '../lib/plans'
import Chat from './Chat'
import SetupPhone from './SetupPhone'
import { CheckinHistory, FamilyMembers, HelpRequests, weekCheckins } from './Screens'
import { InsightsCard, weekStatus } from './InsightsCard'
import { addressLine } from '../lib/types'
import { Tour, type TourStep } from '../components/Tour'
import { update } from '../data/store'
import { Approvals, More, People, Routine, Rules, Settings, ElderPhone } from './Manage'
import { Checkout, PlanPage } from '../billing/Billing'

export default function CaretakerApp({ framed = true }: { framed?: boolean }) {
  const s = useDemo()
  const { pathname } = useLocation()
  if (!s.onboarded.caretaker) return <Navigate to="/onboarding/caretaker" replace />
  const pending = s.actions.filter(a => a.status === 'awaiting_caretaker').length
  return (
    <div className={`shell ${framed ? 'framed' : ''}`}>
      <Routes>
        <Route index element={<Overview s={s} />} />
        <Route path="chat" element={<Chat />} />
        <Route path="approvals" element={<Approvals />} />
        <Route path="rules" element={<Rules />} />
        <Route path="more" element={<More />} />
        <Route path="phone" element={<ElderPhone />} />
        <Route path="people" element={<People />} />
        <Route path="routine" element={<Routine />} />
        <Route path="settings" element={<Settings />} />
        <Route path="plan" element={<PlanPage />} />
        <Route path="checkout/:planId" element={<Checkout />} />
        <Route path="setup-phone" element={<SetupPhone />} />
        <Route path="family" element={<FamilyMembers />} />
        <Route path="requests" element={<HelpRequests />} />
        <Route path="checkins" element={<CheckinHistory />} />
      </Routes>
      {!/\/(checkout|setup-phone)/.test(pathname) && <nav className="c-nav" aria-label="Main">
        <Tab to="" end i="🏠" l="Home" />
        <Tab to="chat" i="💬" l="Chat" badge={s.caretakerUnread} />
        <Tab to="approvals" i="🔐" l="Approvals" badge={pending} />
        <Tab to="rules" i="🧭" l="Rules" />
        <Tab to="more" i="☰" l="More" also={['phone', 'people', 'family', 'requests', 'checkins', 'routine', 'settings', 'plan', 'setup-phone', 'checkout']} />
      </nav>}
    </div>
  )
}

/** `also`: sub-pages opened from this tab keep it highlighted (People, Routine… live under More). */
function Tab({ to, i, l, badge, end, also = [] }: { to: string; i: string; l: string; badge?: number; end?: boolean; also?: string[] }) {
  const anchor = `nav-${to || 'home'}`
  const { pathname } = useLocation()
  const under = also.some(p => pathname.startsWith(`/caretaker/${p}`))
  return (
    <NavLink to={`/caretaker/${to}`} end={end} data-tour={anchor} aria-current={under ? 'page' : undefined}
      className={({ isActive }) => (isActive || under ? 'active' : '')}>
      <span className="i" aria-hidden>{i}</span>{l}{badge ? <span className="nbadge">{badge}</span> : null}
    </NavLink>
  )
}

export function CHead({ title, sub, right, back }: { title: string; sub?: string; right?: ReactNode; back?: string }) {
  const nav = useNavigate()
  return (
    <header className="c-head">
      {back !== undefined && <button className="btn ghost sm" onClick={() => nav(back || -1 as never)} aria-label="Back" style={{ marginLeft: -8, fontSize: 20 }}>‹</button>}
      <div className="grow"><h1>{title}</h1>{sub && <p className="muted small">{sub}</p>}</div>
      {right}
    </header>
  )
}

const LOG_IC: Record<string, string> = { alert: '⚠️', warn: '🟡', ok: '✓' }

function Overview({ s }: { s: DemoState }) {
  const toast = useToast()
  const nk = nick(s)
  const [sos, setSos] = useState(false)
  // Live: until their profile arrives, don't show half-filled status ("? All good — is at home").
  if (isLive() && !s.elder.name) return (
    <>
      <CHead title={`Hi ${s.caretaker.name}`} sub="Connecting…" />
      <div className="scroll"><div className="c-body center-msg"><div className="spinner" aria-hidden /><p className="muted">Loading the latest…</p></div></div>
    </>
  )
  const alerts = s.logs.filter(l => l.kind === 'alert' && !l.ack)
  // Alerts first; otherwise the week's picture, so the headline never says 'all good' above a 'keep an eye' card.
  const week = weekStatus(s)
  const pending = s.actions.filter(a => a.status === 'awaiting_caretaker')
  const plan = planById(s.billing.plan)
  const left = quotaLeft(s), total = quotaTotal(s)
  const wd = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()]
  const nowHM = new Date().toTimeString().slice(0, 5)
  const today = s.reminders.filter(r => r.active && (r.days?.includes(wd as never) || r.date === new Date().toISOString().slice(0, 10)))
  const next = today.filter(r => r.time >= nowHM).sort((a, b) => a.time.localeCompare(b.time))[0]
  const mood = s.checkin.mood
  return (
    <>
      <CHead title={`Hi ${s.caretaker.name}`} sub={isLive() ? (s.live.connected ? `Live · here’s how ${nk} is doing` : 'Connecting…') : `Here’s how ${nk} is doing`}
        right={<><button className="btn sm" onClick={() => update(d => { d.tours.caretaker = false })} aria-label="Show the tour">❓ Tour</button>
          <Link to="/caretaker/plan" className={`pill ${plan.id === 'pro' ? 'gold' : plan.id === 'premium' ? 'ok' : 'info'}`} style={{ textDecoration: 'none' }}>{plan.id === 'pro' ? '★ ' : ''}{plan.name}</Link></>} />
      <div className="scroll"><div className="c-body">
        <div className="card" data-tour="status" style={alerts.length ? { borderColor: 'var(--sos)', background: 'var(--sos-soft)' } : undefined}>
          <div className="status-hero">
            <Face k={s.elder.face} name={s.elder.name} size={72} />
            <div className="grow">
              <span className={`pill ${alerts.length ? 'bad' : week.cls}`}><span className="dot" />{alerts.length ? `${alerts.length} alert${alerts.length > 1 ? 's' : ''}` : week.label}</span>
              <p className="s">{alerts.length ? alerts[0].message : week.line}</p>
            </div>
          </div>
          <div className="row" data-tour="actions" style={{ flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            <button className="btn sm" onClick={() => { caretakerCall(); toast(`Calling ${nk}…`) }}>📞 Call</button>
            <Link className="btn sm" to="/caretaker/chat">💬 Message</Link>
            <button className="btn sm sos" onClick={() => setSos(true)}>🚨 Send someone</button>
            {alerts.length > 0 && <button className="btn sm pri" onClick={ackAlerts}>Mark handled</button>}
          </div>
        </div>

        {!s.onboarded.elder && (
          <Link to="/caretaker/setup-phone" className="card row" style={{ textDecoration: 'none', borderColor: 'var(--accent)', background: 'var(--accent-soft)' }}>
            <span style={{ fontSize: 28 }}>📱</span>
            <div className="grow"><b>Set up {nk}’s phone</b><p className="small muted">One last step — about 3 minutes together, or send a link</p></div>
            <span className="chev">›</span>
          </Link>
        )}

        {pending.length > 0 && (
          <Link to="/caretaker/approvals" className="card row" style={{ textDecoration: 'none', borderColor: 'var(--amber)', background: 'var(--amber-soft)' }}>
            <span style={{ fontSize: 26 }}>🔐</span>
            <div className="grow"><b>{pending.length} request{pending.length > 1 ? 's' : ''} from {nk}</b><p className="small muted">“{pending[0].requestText}”</p></div>
            <span className="chev">›</span>
          </Link>
        )}

        <InsightsCard s={s} compact />

        <div className="metrics">
          <Link to="/caretaker/checkins" data-tour="checkin" className="card metric" style={{ textDecoration: 'none' }}><p className="k">Check-in today ›</p><p className="v">{s.checkin.stage === 'done' ? (mood === 'bad' ? '😟' : mood === 'okay' ? '😐' : '😊') : s.checkin.stage === 'meds' ? '…' : '—'} <small>{s.checkin.stage === 'done' ? 'done' : s.checkin.stage === 'meds' ? 'in progress' : `due ${s.assessment.checkIn.time}`}</small></p><div className="row" style={{ gap: 2, marginTop: 6 }} aria-label="Last 7 days">{weekCheckins(s).slice(0, 7).reverse().map(c => <span key={c.id} style={{ fontSize: 15 }}>{c.mood ? ({ great: '😄', good: '😊', okay: '😐', low: '😕', bad: '😟' } as const)[c.mood] : '·'}</span>)}</div></Link>
          <div className="card metric" data-tour="reminder"><p className="k">Next reminder</p><p className="v">{next ? next.time : '—'}</p><p className="small muted" style={{ marginTop: 2 }}>{next ? next.title : 'Nothing left today'}</p></div>
        </div>

        {isLive() ? (
          <div data-tour="credit"><ComingSoon card title="Care credit & plans">
            Free volunteer calls, top-ups and plans aren’t connected to payments yet. Until then, volunteer requests simply wait for your approval.
          </ComingSoon></div>
        ) : <Link to="/caretaker/plan" data-tour="credit" className="card" style={{ textDecoration: 'none', ...(s.billing.balance < 0 ? { borderColor: 'var(--sos)', background: 'var(--sos-soft)' } : {}) }}>
          <div className="row"><p className="k eyebrow grow">Care credit</p><span className="small muted">{plan.name} plan ›</span></div>
          <div className="row" style={{ margin: '8px 0', alignItems: 'baseline' }}>
            <div className="quota grow"><b style={{ color: s.billing.balance < 0 ? 'var(--sos)' : undefined }}>{formatBalance(s.billing.balance)}</b><span>prepaid</span></div>
            <span className="small"><b>{left}</b> of {total} free calls left</span>
          </div>
          <div className="bar"><i style={{ width: `${(left / Math.max(1, total)) * 100}%`, background: left <= 1 ? 'var(--amber)' : undefined }} /></div>
          {s.billing.balance < 0
            ? <p className="small" style={{ marginTop: 8, color: 'var(--sos)', fontWeight: 700 }}>Emergency help used credit — top up to repay and continue →</p>
            : left === 0 && s.billing.balance < CREDIT.callPriceUsd * 2
              ? <p className="small" style={{ marginTop: 8, color: 'var(--amber)', fontWeight: 700 }}>Credit running low — top up so help isn’t delayed →</p>
              : null}
        </Link>}

        <div className="card" data-tour="activity">
          <div className="row"><h3 className="grow" style={{ fontSize: 19 }}>Activity</h3><span className="small muted">Everything the helper did</span></div>
          <div className="tl" style={{ marginTop: 6 }}>
            {s.logs.length === 0 && <p className="small muted" style={{ padding: '8px 0' }}>Nothing yet — what the helper does for {nk} will appear here.</p>}
            {s.logs.slice(0, 10).map(l => (
              <div key={l.id} className={`it ${l.kind}`}><div className="ic">{LOG_IC[l.kind]}</div><p className="txt">{l.message}</p><span className="t">{timeAgo(l.timestamp)}</span></div>
            ))}
          </div>
        </div>
      </div></div>
      <SosSheet open={sos} onClose={() => setSos(false)} s={s} />
      {!s.tours.caretaker && <Tour steps={caretakerTour(nk, s.elder.name)} onDone={() => update(d => { d.tours.caretaker = true })} />}
    </>
  )
}

function SosSheet({ open, onClose, s }: { open: boolean; onClose: () => void; s: DemoState }) {
  const toast = useToast()
  const nk = nick(s)
  const david = s.contacts.find(c => c.kind === 'neighbour')
  const opts = [
    { face: david?.face, t: david?.name ?? 'Neighbour', d: 'Neighbour · has a spare key', eta: '2 min' },
    { face: 'mia', t: 'Mia Santos', d: 'Trusted volunteer · first aid', eta: '8 min' },
    { face: 'emma', t: 'Go myself', d: 'From your location', eta: '35 min' },
    { face: undefined, t: 'Ambulance', d: 'Shares location + medical notes', eta: '~12 min' },
  ]
  return (
    <Sheet open={open} onClose={onClose} label={`Send someone to ${nk}`}>
      <p className="eyebrow">SOS</p><h2 style={{ fontSize: 24 }}>Send someone to {nk}</h2>
      <p className="muted small" style={{ margin: '4px 0 12px' }}>{addressLine(s.elder.address) || 'No address yet — add it in Profile'}</p>
      {isLive() && <div className="stack" style={{ gap: 8, marginBottom: 12 }}>
        <a className="btn sos block" href={`tel:${emergencyNumber(s)}`}>🚑 Call {emergencyNumber(s)} (emergency services)</a>
        <button className="btn block" onClick={() => { onClose(); caretakerCall() }}>📞 Call {nk}</button>
        <ComingSoon card title="Send a neighbour or volunteer">Dispatching someone with live location and an ETA is on the way. For now, call them directly from People.</ComingSoon>
      </div>}
      <div className={`stack ${isLive() ? 'soon-dim' : ''}`} style={{ gap: 8 }} aria-hidden={isLive() || undefined}>
        {opts.map(o => (
          <button key={o.t} className="choice" onClick={() => { onClose(); dispatchHelp(o.t, o.eta); toast(`${o.t === 'Go myself' ? 'You’re' : o.t + ' is'} on the way — ${nk} has been told`) }}>
            {o.face ? <Face k={o.face} name={o.t} size={44} /> : <span className="ic">🚑</span>}
            <div className="grow"><b>{o.t}</b><p className="small muted">{o.d}</p></div><b>{o.eta}</b>
          </button>
        ))}
      </div>
    </Sheet>
  )
}

/** The caretaker's guided tour — in the order they'll use things each day. */
function caretakerTour(nk: string, name: string): TourStep[] {
  return [
    { target: 'status', title: `Is ${nk} OK?`, body: <>Your answer at a glance. It turns <b>red</b> when something needs you — a fall, a missed check-in, a worrying answer.</> },
    { target: 'actions', title: 'Act in one tap', body: <>Call {nk}, send a message, or <b>send someone</b> (a neighbour, a volunteer or an ambulance) in an emergency.</> },
    { target: 'checkin', title: 'Daily check-in', body: <>The helper asks {name} how they feel, how they slept, what they ate and about medicines. Tap for the last 7 days.</> },
    { target: 'reminder', title: 'Reminders', body: <>Medicines and appointments from {nk}’s routine. The helper reminds {nk} out loud.</> },
    { target: 'credit', title: 'Care credit & free calls', body: <>Every month includes free volunteer calls. Extra calls use care credit. <b>Emergencies are never blocked.</b></> },
    { target: 'activity', title: 'Everything is logged', body: <>Each thing the helper does — orders, rides, messages, alerts — appears here, for you and {nk}.</> },
    { target: 'nav-chat', title: 'Chat', body: <>Your messages are <b>read aloud</b> to {nk}, who answers with big buttons. Their replies come with one-tap next steps.</> },
    { target: 'nav-approvals', title: 'Approvals', body: <>Requests your rules say need you first — like a volunteer visit or an order above the limit.</> },
    { target: 'nav-rules', title: 'Helper rules', body: <>Decide what the helper may do on its own, what {nk} confirms, and what needs you. Set spending limits.</> },
    { target: 'nav-more', title: 'Everything else', body: <>Family members, help requests, check-in history, {nk}’s routine, profile & privacy, and care credit.</> },
  ]
}
