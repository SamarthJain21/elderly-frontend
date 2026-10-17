import { useState } from 'react'
import { Link } from 'react-router-dom'
import { createSandbox, type Sandbox, type SandboxLanguage } from '../data/api'

/**
 * /try — "Try with real AI". Creates a private sandbox on the live backend (an elder + a family account with two weeks
 * of history) and shows both apps side by side, each frame signed in to its own account (see lib/firebase.ts).
 */
const KEY = 'elderly-try'
const LANGS: [SandboxLanguage, string][] = [['en-US', 'English'], ['hi-IN', 'हिन्दी'], ['hi-Latn', 'Hinglish'], ['th-TH', 'ไทย']]

/** Reuse this tab's sandbox after a reload while it has at least an hour left. */
function saved(): Sandbox | null {
  try {
    const sb = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as Sandbox | null
    return sb && new Date(sb.expiresAt).getTime() - Date.now() > 3_600_000 ? sb : null
  } catch { return null }
}

const frame = (app: 'elder' | 'caretaker', c: Sandbox['elder']) =>
  `/${app}?embed=1&sandbox=1#e=${encodeURIComponent(c.email)}&p=${encodeURIComponent(c.password)}`

export function TrySandbox() {
  const [sb, setSb] = useState<Sandbox | null>(saved)
  const [lang, setLang] = useState<SandboxLanguage>('en-US')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const start = async () => {
    setBusy(true); setErr('')
    try {
      const s = await createSandbox(lang)
      try { sessionStorage.setItem(KEY, JSON.stringify(s)) } catch { /* reload will just make a new one */ }
      setSb(s)
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  const startOver = () => { try { sessionStorage.removeItem(KEY) } catch { /* ignore */ } setSb(null) }

  return (
    <div style={{ minHeight: '100dvh' }}>
      <div className="topbar">
        <Link to="/about" className="brand"><span className="logo">♥</span>Elderly</Link>
        <span className="grow" />
        {sb && <button className="btn sm" onClick={startOver}>Start over</button>}
        <Link to="/" className="btn sm pri" style={{ marginLeft: 8, textDecoration: 'none' }}>Sign in →</Link>
      </div>
      {!sb ? (
        <div className="launch try-intro">
          <p className="eyebrow">Live sandbox · Gemini on Vertex AI</p>
          <h1>Try Elderly with the real AI.</h1>
          <p className="lead">We’ll make you a private sandbox: an elder’s phone and their family’s app, with two weeks of history,
            running on the real server and Gemini. Orders are pretend and nobody is texted. It’s deleted after 24 hours.</p>
          <div className="segbar" role="radiogroup" aria-label="The elder’s language">
            {LANGS.map(([l, label]) => (
              <button key={l} role="radio" aria-checked={lang === l} className={lang === l ? 'on' : ''} onClick={() => setLang(l)}>{label}</button>
            ))}
          </div>
          <button className="btn pri" disabled={busy} onClick={() => void start()}>{busy ? 'Setting up your sandbox…' : 'Start the live demo'}</button>
          {err && <p className="err" role="alert">{err}</p>}
        </div>
      ) : (
        <>
          <div className="duo">
            <div className="col"><b>👵 {sb.elder.name}’s phone</b><iframe src={frame('elder', sb.elder)} title={`${sb.elder.name}’s phone (elder app)`} allow="microphone" /></div>
            <div className="col"><b>👩 {sb.caretaker.name}’s phone (family)</b><iframe src={frame('caretaker', sb.caretaker)} title={`${sb.caretaker.name}’s phone (family app)`} /></div>
          </div>
          <div className="card try-steps">
            <p className="eyebrow">Things to try — every reply is Gemini, live</p>
            <ol>
              <li>On {sb.caretaker.name}’s phone: <b>“Keep an eye”</b> — Gemini noticed {sb.elder.name}’s mood has been low for two days, compared with {sb.elder.name}’s usual. Tap it and <b>ask about {sb.elder.name}</b> in your own words — “Has she been sleeping well?”</li>
              <li>On {sb.elder.name}’s phone, tap a mood to start today’s <b>check-in</b> — a short chat; {sb.caretaker.name} sees the summary.</li>
              <li>Ask <b>“Will it rain today?”</b> or <b>“Order me breakfast”</b> — it acts within {sb.caretaker.name}’s rules and asks before spending.</li>
              <li>Tap the mic and speak, in {LANGS.find(([l]) => l === sb.language)?.[1]} or any language — it answers in {sb.elder.name}’s language.</li>
              <li>In {sb.caretaker.name}’s Chat, tap <b>“Did you take your medicine?”</b> — {sb.elder.name} hears it and answers with one tap.</li>
              <li>Say <b>“I fell in the bathroom”</b> or hold the red button — {sb.caretaker.name}’s phone shows the alert straight away.</li>
              <li>Say <b>“The bank called and asked for my OTP”</b> — the helper warns {sb.elder.name} kindly and alerts {sb.caretaker.name} (scam guard).</li>
              {sb.language === 'en-US'
                ? <li><b>Family chat across languages:</b> start over in हिन्दी or ไทย — {sb.caretaker.name} writes English, {sb.elder.name} reads (and hears) their own language, and replies come back in English.</li>
                : <li><b>Family chat across languages:</b> type to {sb.elder.name} in English — they read and hear it in {LANGS.find(([l]) => l === sb.language)?.[1]}; the reply reaches {sb.caretaker.name} in English.</li>}
              <li>On {sb.caretaker.name}’s phone: More → Routine → Medicines → <b>📷 Scan a prescription</b> — Gemini reads “1-0-1”, AC/PC and SOS, and flags a medicine that doubles one already on the list.</li>
            </ol>
          </div>
        </>
      )}
    </div>
  )
}
