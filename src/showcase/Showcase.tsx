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

const FEATURES: [string, string, string][] = [
  ['🗣️', 'Talks in their language', 'Hindi, Hinglish, Thai or English. They speak or tap; replies are read aloud in a natural Google voice.'],
  ['✅', 'Gets things done — safely', 'Orders food and medicine, books a ride, sets reminders, finds a neighbour to fix things — within the spending limits and approvals the family sets.'],
  ['💛', 'A daily check-in', 'A one-minute chat about mood, sleep, meals and medicines. The family sees the summary, and is told when the week drifts from normal.'],
  ['🚨', 'Help in one press', 'Hold the red button — or just say “I fell”. Family and trusted neighbours are alerted straight away.'],
]

const GOOGLE_AI: [string, string][] = [
  ['Gemini on Vertex AI', 'runs every conversation with function calling. The model must act through tools, and the family’s rules are enforced in code — it can’t pretend it did something. Flash-Lite answers in about a second; Flash steps in if it’s busy.'],
  ['Gemini understands and summarises', '— it pulls mood, sleep, meals and worries out of the check-in chat, and writes the family’s weekly note.'],
  ['Cloud Text-to-Speech (Chirp 3 HD)', 'gives the helper a warm voice in Hindi, Thai and English; Hinglish is rewritten in Devanagari by Gemini first.'],
  ['Built and run on Google Cloud', '— Cloud Run, Firestore, Firebase Auth and Hosting, Cloud Build. Checked by a 30-case test suite in four languages.'],
]

const SCREENS: [string, string, string, string][] = [
  ['/elder?demo', '👵', 'Elder app', 'Voice-first home, big buttons, faces to call, hold for help.'],
  ['/caretaker?demo', '👩', 'Family app', 'How they’re doing, chat, approvals, the helper’s rules.'],
  ['/onboarding/caretaker?demo', '🚀', 'Family setup', 'Privacy first, then routine, medicines and rules.'],
  ['/onboarding/elder?demo', '🤝', 'Elder’s first run', 'Meet the helper, try the mic — read aloud.'],
  ['/pricing', '💳', 'Plans', 'All AI is free; top up for volunteer visits.'],
]

export function Launcher() {
  const s = useDemo()
  const signedIn = isLive() && s.live.status === 'ready'
  return (
    <div style={{ minHeight: '100dvh' }}>
      <TopBar>{signedIn
        ? <><Link className="btn sm pri" to={s.live.role === 'elder' ? '/elder' : '/caretaker'}>Open my app</Link>
          <button className="btn sm" onClick={() => void signOut()}>Sign out</button></>
        : <button className="btn sm" onClick={() => switchMode('live', '/login')}>Sign in</button>}</TopBar>
      <div className="launch">
        <p className="eyebrow">Google AI Builder Cup 2026 · Elder care for India and Thailand</p>
        <h1>A helper your loved one can talk to.<br />Peace of mind for family.</h1>
        <p className="lead">Millions of older adults live alone while their children work in other cities. Elderly is a companion
          they simply talk to — that checks in every day, gets things done within rules the family sets, and tells the family
          when something’s wrong.</p>
        <div className="hero-cta">
          <Link className="btn pri hero-btn" to="/try">✨ Try it live with Gemini</Link>
          <Link className="btn" to="/demo">Scripted demo (offline, no AI)</Link>
        </div>
        <p className="small muted">No sign-in: you get a private sandbox — an elder’s phone and their family’s, side by side — deleted after 24 hours.</p>

        <div className="lgrid feat">
          {FEATURES.map(([ic, t, d]) => <div key={t} className="card lcard"><span className="ic">{ic}</span><h3>{t}</h3><p>{d}</p></div>)}
        </div>

        <div className="card gai">
          <p className="eyebrow">How it uses Google AI</p>
          <ul>{GOOGLE_AI.map(([b, t]) => <li key={b}><b>{b}</b> {t}</li>)}</ul>
        </div>

        <p className="eyebrow" style={{ marginTop: 32 }}>Explore the screens (demo data)</p>
        <div className="lgrid small-cards">
          {SCREENS.map(([to, ic, t, d]) => (
            <Link key={to} to={to} className="card lcard"><span className="ic">{ic}</span><h3>{t}</h3><p>{d}</p></Link>
          ))}
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
      <div className="card demo-note">
        <p><b>Scripted offline demo — the helper’s replies here are canned, not AI.</b> For the real Gemini, <Link to="/try">try it live ✨</Link>.</p>
        <ol>
          <li>On Emma’s phone open Chat and tap <b>“Did you take your medicine?”</b> — Grandma hears it with big reply buttons.</li>
          <li>Grandma taps <b>❌ Not yet</b> → Emma gets one-tap next steps (remind, call).</li>
          <li>Grandma taps <b>🔧 Fix something</b> → it waits for Emma’s approval and uses a volunteer visit.</li>
          <li>Tap <b>Empty credit</b> → a normal request waits for a top-up, but “The pipe burst, urgent!” still gets help.</li>
        </ol>
      </div>
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
          <span className="small muted">Sample prices (USD) · payments not live yet</span>
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
