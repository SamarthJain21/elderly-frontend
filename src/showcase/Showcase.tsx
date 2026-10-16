import { useState } from 'react'
import { Link } from 'react-router-dom'
import { resetDemo, update } from '../data/store'
import { CycleToggle, PlanCards } from '../billing/Billing'
import { useToast } from '../components/ui'
import { isLive, switchMode } from '../data/mode'
import { useDemo } from '../data/store'
import { signOut } from '../data/live'
import type { Billing } from '../lib/plans'

function TopBar({ children }: { children?: React.ReactNode }) {
  return (
    <div className="topbar">
      <Link to="/" className="brand"><span className="logo">♥</span>Elderly</Link>
      <span className="grow" />
      {children}
    </div>
  )
}

export function Launcher() {
  const toast = useToast()
  const cards: [string, string, string, string][] = [
    ['/try', '✨', 'Try it with real AI', 'Your own private sandbox on the live server: Gemini on Vertex AI, both phones side by side.'],
    ['/demo', '📱📱', 'Live side-by-side', 'Grandma’s phone and Emma’s phone, talking to each other in real time.'],
    ['/elder', '👵', 'Elder app', 'Voice-first home, big buttons, faces to call, hold-for-help.'],
    ['/caretaker', '👩', 'Caretaker app', 'Status, chat, approvals, helper rules, plan & billing.'],
    ['/onboarding/caretaker', '🚀', 'Caretaker onboarding', 'Privacy first, then your loved one’s details, routine, medicines, rules, plan.'],
    ['/onboarding/elder', '🤝', 'Elder onboarding', 'Scan code, meet the helper, try the mic — read aloud.'],
    ['/pricing', '💳', 'Care credit & plans', 'Free AI. Top up from $5, $1 per volunteer call, emergencies never blocked.'],
  ]
  return (
    <div style={{ minHeight: '100dvh' }}>
      <TopBar>{isLive()
        ? <button className="btn sm" onClick={() => switchMode('demo', '/')}>Switch to demo</button>
        : <><button className="btn sm" onClick={() => switchMode('live', '/')}>Use real account</button>
          <button className="btn sm" onClick={() => { resetDemo(); toast('Demo data reset') }}>↺ Reset demo</button></>}</TopBar>
      <div className="launch">
        <ModeCard />
        <p className="eyebrow">Prototype showcase</p>
        <h1>A helper your loved one can talk to.<br />Peace of mind for family.</h1>
        <p className="lead">Elders speak naturally; an AI helper acts within rules their family sets; volunteers nearby handle the hands-on help. {isLive() ? 'Signed in, everything is saved on the Elderly server; the side-by-side showcase always uses demo data.' : 'Everything here runs in the browser with demo data — open it on a phone for the real feel.'}</p>
        <div className="lgrid">
          {cards.map(([to, ic, t, d]) => (
            <Link key={to} to={to} className="card lcard"><span className="ic">{ic}</span><h3>{t}</h3><p>{d}</p></Link>
          ))}
        </div>
        <div className="card" style={{ marginTop: 24 }}>
          <p className="eyebrow">Try this story</p>
          <ol style={{ margin: '8px 0 0', paddingLeft: 20, lineHeight: 1.8 }}>
            <li>Open <b>Live side-by-side</b>. On Emma’s phone tap <b>“Did you take your medicine?”</b> — Grandma hears it and gets big reply buttons.</li>
            <li>Grandma taps <b>❌ Not yet</b> → Emma gets one-tap next steps (remind, call).</li>
            <li>Grandma taps <b>🔧 Fix something</b> → the request waits for Emma’s approval and uses a volunteer call.</li>
            <li>Tap <b>Empty credit</b> → a normal request waits for Emma to <b>Top up $5 & approve</b>, but “The pipe burst, urgent!” still gets help and the credit goes negative.</li>
          </ol>
        </div>
      </div>
    </div>
  )
}

export function SideBySide() {
  const toast = useToast()
  return (
    <div style={{ minHeight: '100dvh' }}>
      <TopBar>
        <button className="btn sm" onClick={() => { update(d => { d.billing.volunteerUsed = 5; d.billing.balance = 0 }); toast('Free calls used up and credit is $0 — try “Fix something”, then an urgent request') }}>Empty credit</button>
        <button className="btn sm" onClick={() => { resetDemo(); toast('Demo reset') }}>↺ Reset</button>
        <Link className="btn sm pri" to="/try">Try with real AI ✨</Link>
      </TopBar>
      <div className="duo">
        <div className="col"><b>👵 Grandma’s phone (Elder)</b><iframe src="/elder?embed=1" title="Elder app" /></div>
        <div className="col"><b>👩 Emma’s phone (Caretaker)</b><iframe src="/caretaker?embed=1" title="Caretaker app" /></div>
      </div>
    </div>
  )
}

export function Pricing() {
  const [cycle, setCycle] = useState<Billing>('monthly')
  return (
    <div style={{ minHeight: '100dvh' }}>
      <TopBar><Link className="btn sm pri" to="/onboarding/caretaker">Get started</Link></TopBar>
      <div className="launch" style={{ maxWidth: 520 }}>
        <p className="eyebrow">Plans</p>
        <h1 style={{ fontSize: 38 }}>Everything AI is free.<br />Top up for extra help.</h1>
        <p className="lead">Every plan includes the voice helper, family chat and daily check-ins. Paid plans add volunteer calls and savings.</p>
        <div className="row" style={{ margin: '20px 0', flexWrap: 'wrap' }}>
          <CycleToggle cycle={cycle} setCycle={setCycle} />
          <span className="grow" />
          <span className="small muted">Prices in USD</span>
        </div>
        <PlanCards cycle={cycle} onChoose={() => { window.location.href = '/onboarding/caretaker' }} />
        <div className="card" style={{ marginTop: 18 }}>
          <b>How care credit works</b>
          <p className="small muted" style={{ marginTop: 4 }}>Top up from $5. Every plan includes free volunteer calls each month; after that each call is $1 from credit. Emergencies are never blocked — credit can go down to −$10 and your next top-up repays it.</p>
          <b style={{ display: 'block', marginTop: 10 }}>What’s a volunteer call?</b>
          <p className="small muted" style={{ marginTop: 4 }}>One request for a verified volunteer to help at home — fixing a tap, setting up a phone, a walk to the shops. Free calls reset monthly; credit never expires.</p>
        </div>
      </div>
    </div>
  )
}

/** Live = signed in to the real Elderly server; demo = everything in this browser. */
function ModeCard() {
  const s = useDemo()
  if (!isLive()) return (
    <div className="card row" style={{ marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 26 }}>🧪</span>
      <div className="grow" style={{ minWidth: 200 }}><b>Demo mode</b><p className="small muted">Pretend data in this browser — nothing is sent anywhere.</p></div>
      <button className="btn pri sm" onClick={() => switchMode('live', '/login')}>Sign in for real</button>
    </div>
  )
  const st = s.live.status
  return (
    <div className="card row" style={{ marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 26 }}>🔐</span>
      <div className="grow" style={{ minWidth: 200 }}>
        <b><span className={`live-dot ${s.live.connected ? 'on' : ''}`} />Live — real Elderly server</b>
        <p className="small muted">{st === 'signedOut' ? 'Not signed in.' : st === 'loading' ? 'Checking your account…'
          : st === 'error' ? `Can’t connect: ${s.live.error}` : `Signed in as ${s.live.email}${s.live.role ? ` (${s.live.role === 'elder' ? 'elder' : 'family'})` : ''}.`}</p>
      </div>
      {st === 'signedOut' ? <Link className="btn pri sm" to="/login">Sign in</Link>
        : st === 'ready' ? <><Link className="btn pri sm" to={s.live.role === 'elder' ? '/elder' : '/caretaker'}>Open my app</Link>
          <button className="btn sm" onClick={() => void signOut()}>Sign out</button></>
        : st === 'needsOnboarding' || st === 'needsElder' ? <Link className="btn pri sm" to="/onboarding/caretaker">Finish setting up</Link> : null}
    </div>
  )
}
