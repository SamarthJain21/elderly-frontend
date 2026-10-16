import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useDemo } from '../data/store'
import { isLive, switchMode } from '../data/mode'
import { loadSession, signOut } from '../data/live'
import { signInCaretaker, signInElder } from '../lib/firebase'
import { WaveHand } from '../onboarding/Scenes'

const authError = (e: unknown) => {
  const code = (e as { code?: string })?.code ?? ''
  if (code.includes('popup-closed') || code.includes('cancelled-popup')) return 'Sign-in was closed before it finished.'
  if (code.includes('popup-blocked')) return 'Your browser blocked the Google window — allow pop-ups for this site and try again.'
  if (code.includes('unauthorized-domain')) return 'This address isn’t allowed to sign in yet. Open the app at http://localhost:5173, or add this domain in Firebase → Authentication → Settings.'
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) return 'That email or password isn’t right. Check the setup message from your family.'
  if (code.includes('network')) return 'No internet connection.'
  return (e as Error)?.message || 'Something went wrong.'
}

/** /login — family members use Google (required by the backend); elders use the account their family made. */
export function Login() {
  const s = useDemo()
  const [q] = useSearchParams()
  const [who, setWho] = useState<'family' | 'elder'>(q.get('as') === 'elder' ? 'elder' : 'family')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const next = q.get('next')

  // A tab left in demo mode (a ?demo link) signs in live: switch back and reload here.
  useEffect(() => { if (!isLive()) switchMode('live', location.pathname + location.search) }, [])
  if (!isLive()) return null
  if (s.live.status === 'ready') return <Navigate to={next || (s.live.role === 'elder' ? '/elder' : '/caretaker')} replace />
  if (s.live.status === 'needsOnboarding' || s.live.status === 'needsElder') return <Navigate to="/onboarding/caretaker" replace />

  const go = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr('')
    try { await fn() } catch (e) { setErr(authError(e)) } finally { setBusy(false) }
  }

  return (
    <div className="shell framed"><div className="scroll"><div className="login">
      <div style={{ width: 96 }}><WaveHand /></div>
      <h1>Welcome to Elderly</h1>
      <div className="seg" role="tablist" aria-label="Who is signing in">
        <button role="tab" aria-selected={who === 'family'} className={who === 'family' ? 'on' : ''} onClick={() => setWho('family')}>I’m family</button>
        <button role="tab" aria-selected={who === 'elder'} className={who === 'elder' ? 'on' : ''} onClick={() => setWho('elder')}>I’m being cared for</button>
      </div>
      {who === 'family' ? (
        <>
          <p className="muted">Sign in with Google to set up and look after someone you love.</p>
          <button className="btn pri google" disabled={busy} onClick={() => go(signInCaretaker)}>
            <GoogleG /> {busy ? 'Opening Google…' : 'Continue with Google'}
          </button>
        </>
      ) : (
        <form className="stack" onSubmit={e => { e.preventDefault(); void go(() => signInElder(email.trim(), pw.trim())) }}>
          <p className="muted">Easiest: open the setup link your family sent you. Or type the details from their message:</p>
          <label className="field">Email<input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} /></label>
          <label className="field">One-time password<input type="password" autoComplete="current-password" value={pw} onChange={e => setPw(e.target.value)} /></label>
          <button className="btn pri block" disabled={busy || !email || !pw}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
      )}
      {(err || s.live.status === 'error') && <p className="err" role="alert">{err || s.live.error}</p>}
      {s.live.status === 'error' && <button className="btn" onClick={() => void loadSession()}>Try again</button>}
      <p className="small muted" style={{ textAlign: 'center' }}>

      </p>
      <div className="login-new">
        <p className="eyebrow">New here?</p>
        <Link className="btn acc block" to="/try">✨ Try it live <span className="small">(for judges)</span> — no sign-in</Link>
        <Link className="btn block" to="/about">Learn about Elderly →</Link>
      </div>
    </div></div></div>
  )
}

const GoogleG = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
)

function Center({ children }: { children: ReactNode }) {
  return <div className="shell framed"><div className="center-msg" style={{ justifyItems: "center" }}>{children}</div></div>
}

/**
 * Guards the apps in live mode: not signed in → /login; signed in but new → onboarding;
 * wrong app for this account → a friendly pointer. Demo mode passes straight through.
 */
export function LiveGate({ app, children }: { app: 'elder' | 'caretaker'; children: ReactNode }) {
  const s = useDemo()
  const { pathname } = useLocation()
  const nav = useNavigate()
  const st = s.live.status
  // Live data must never carry demo state; if it somehow does, reload the real session.
  useEffect(() => { if (isLive() && st === 'demo') void loadSession() }, [st])
  if (!isLive()) return <>{children}</>
  if (st === 'loading' || st === 'demo') return <Center><div className="spinner" aria-hidden /><p className="muted">Connecting to Elderly…</p></Center>
  if (st === 'signedOut') return <Navigate to={`/login?next=${encodeURIComponent(pathname)}${app === 'elder' ? '&as=elder' : ''}`} replace />
  if (st === 'error') return (
    <Center>
      <h2>Can’t reach Elderly</h2><p className="muted">{s.live.error}</p>
      <button className="btn pri" onClick={() => void loadSession()}>Try again</button>
    </Center>
  )
  if (st === 'needsOnboarding' || st === 'needsElder') {
    if (app === 'caretaker') return <Navigate to="/onboarding/caretaker" replace />
    return <Center><h2>This phone isn’t set up yet</h2><p className="muted">Open the setup link from your family to sign in.</p>
      <button className="btn" onClick={() => void signOut()}>Sign out</button></Center>
  }
  if (app === 'caretaker' && s.live.role === 'elder') return <Navigate to="/elder" replace />
  if (app === 'elder' && s.live.role === 'caretaker') return (
    <Center>
      <h2>This is the family account</h2>
      <p className="muted">The elder app runs on {s.elder.nickname || s.elder.name || 'their'} phone, signed in with the setup link.</p>
      <button className="btn pri" onClick={() => nav('/caretaker')}>Go to the family app</button>
      <button className="btn" onClick={() => nav('/caretaker/setup-phone')}>Send the setup link</button>
    </Center>
  )
  return <>{children}</>
}
