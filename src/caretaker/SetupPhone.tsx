import { useNavigate } from 'react-router-dom'
import { nick, update, useDemo } from '../data/store'
import { ComingSoon, useToast } from '../components/ui'
import { isLive } from '../data/mode'
import { newSetupLink } from '../data/live'
import { LinkPhonesScene } from '../onboarding/Scenes'

/**
 * Connect the elder's phone in two steps:
 *   1. Send a one-time setup link (it already carries their account, name, routine and family faces).
 *   2. They open it — their phone is signed in and a short spoken welcome guides them.
 * Backend today: POST /elders returns the elder's email + one-time password. The link carries those for the
 * showcase; for real users a short-lived pairing token endpoint is recommended (review item B).
 * Live mode: the sign-in goes in the link's #fragment, which browsers never send to any server.
 */
const b64url = (t: string) => btoa(unescape(encodeURIComponent(t))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
export const encodeSetup = (email: string, password: string) => b64url(`${email}\n${password}`)
export function decodeSetup(frag: string): { email: string; password: string } | null {
  try {
    const t = decodeURIComponent(escape(atob(frag.replace(/-/g, '+').replace(/_/g, '/'))))
    const [email, password] = t.split('\n')
    return email && password ? { email, password } : null
  } catch { return null }
}
export default function SetupPhone() {
  const s = useDemo()
  const nav = useNavigate()
  const toast = useToast()
  const nk = nick(s)
  const me = s.contacts.find(c => c.name === s.caretaker.name)
  const live = isLive()
  const { email, tempPassword } = s.elder.credentials
  const code = live ? s.elder.elderId.slice(0, 6) : tempPassword
  const link = live ? `${location.origin}/join/${code}#${encodeSetup(email, tempPassword)}` : `https://elderly.app/join/${code}`
  const canSend = !live || !!tempPassword
  const sent = !!s.setup.sentVia
  const connected = s.onboarded.elder
  const message = `Hi ${nk}, it’s ${s.caretaker.name}! I’ve set up Elderly for you — just tap this link and it will help you get started: ${link}`

  const send = (via: string) => {
    if (live && (via === 'SMS' || via === 'WhatsApp')) {
      // Opens the phone's own SMS / WhatsApp with the message ready — the caretaker presses send.
      const phone = s.elder.phone.replace(/[^\d+]/g, '')
      window.open(via === 'SMS' ? `sms:${phone}?&body=${encodeURIComponent(message)}` : `https://wa.me/${phone.replace('+', '')}?text=${encodeURIComponent(message)}`, '_blank')
    }
    update(d => {
      d.setup = { sentVia: via, sentAt: new Date().toISOString() }
      if (!live) d.logs.unshift({ id: 'log_' + Date.now(), timestamp: new Date().toISOString(), actor: 'caretaker', message: `Setup link sent to ${nick(d)} by ${via}`, kind: 'ok', ack: true, checkInId: null })
    })
    toast(live ? `Ready in ${via} — the link signs ${nk} in once` : `Link sent by ${via} — we’ll tell you when ${nk} opens it`)
  }
  const share = async () => {
    try {
      if (navigator.share) { await navigator.share({ title: 'Elderly', text: message }); send('Share'); return }
      await navigator.clipboard.writeText(message); send('Copied link'); toast('Link copied — paste it into any chat')
    } catch { /* user cancelled */ }
  }
  const finish = () => nav('/caretaker')  // Home starts the guided tour the first time

  return (
    <>
      <header className="c-head">
        <span className={`pill ${connected ? 'ok' : 'info'}`}>{connected ? '✓ All set' : 'Last step'}</span>
        <span className="grow" />
        {!connected && <button className="btn ghost sm" onClick={finish}>Do it later</button>}
      </header>
      <div className="scroll"><div className="c-body">
        <LinkPhonesScene elderFace={s.elder.face || undefined} careFace={me?.face} />
        <h1 style={{ fontSize: 28 }}>Connect {nk}’s phone</h1>
        <p className="muted">Two steps. {nk} doesn’t need to type anything — no app store, no password.</p>

        {/* Step 1 */}
        <div className="card stack" style={{ gap: 10 }}>
          <div className="setup-step"><span className={`num ${sent ? 'done' : ''}`}>{sent ? '✓' : '1'}</span>
            <div className="grow"><b>Send the setup link</b>
              <p className="small muted">It already has {nk}’s account, routine, medicines and your faces. It works once and expires in 7 days.</p></div></div>
          <div className="sms-bubble">Hi {nk}, it’s {s.caretaker.name}! I’ve set up Elderly for you — just tap this link and it will help you get started: <a href={link} onClick={e => e.preventDefault()}>{link}</a></div>
          <p className="small muted">To {s.elder.phone}</p>
          {!canSend ? <button className="btn pri" onClick={() => newSetupLink(false).catch((e: unknown) => toast(e instanceof Error ? e.message : 'Couldn’t make a new link'))}>🔗 Make a new setup link</button>
            : sent
            ? <p className="small" style={{ fontWeight: 700, color: 'var(--accent)' }}>✓ Sent by {s.setup.sentVia} · <button className="btn ghost sm" style={{ padding: 0, minHeight: 0, color: 'var(--accent)' }} onClick={() => send(s.setup.sentVia!)}>Send again</button></p>
            : <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                <button className="btn acc" onClick={() => send('SMS')}>💬 SMS</button>
                <button className="btn acc" onClick={() => send('WhatsApp')}>🟢 WhatsApp</button>
                <button className="btn" onClick={share}>🔗 Copy / share</button>
              </div>}
        </div>

        {/* Step 2 */}
        <div className="card stack" style={{ gap: 10, opacity: sent ? 1 : .55 }}>
          <div className="setup-step"><span className={`num ${connected ? 'done' : 'wait'}`}>{connected ? '✓' : '2'}</span>
            <div className="grow"><b>{nk} taps the link</b>
              <p className="small muted">Elderly opens already signed in, then a 2-minute spoken welcome shows {nk} the big green button, the faces to call and the red help button.</p></div></div>
          {connected
            ? <p className="small" style={{ fontWeight: 700, color: 'var(--accent)' }}>✓ {nk}’s phone is connected</p>
            : sent && <>
                <p className="small row" style={{ gap: 8 }}><span className="pulse-dot" /> Waiting for {nk} to open it{live ? '' : ' — we’ll notify you'}.</p>
                <p className="small muted">Tip: a quick call helps — “Tap the blue link I sent you.”</p>
                {live
                  ? <p className="small muted">We’ll mark this done when {nk} first chats or checks in. <ComingSoon>Instant “phone connected” alert</ComingSoon></p>
                  : <button className="btn" onClick={() => nav(`/join/${code}`)}>📱 Open the link on {nk}’s phone (demo) →</button>}
              </>}
        </div>

        {connected
          ? <button className="btn pri block" style={{ minHeight: 52 }} onClick={finish}>Next: a quick tour of your app →</button>
          : live ? <>
              {/* Always there: the link can be sent later (Home → Set up phone, or their phone page → Signing in). */}
              <button className="btn pri block" style={{ minHeight: 52 }} onClick={finish}>{sent ? 'Done — take me to the app →' : 'Continue to the app →'}</button>
              {!sent && <p className="small muted center">You can send the link later from Home.</p>}
            </>
          : <p className="small muted center">You can also do this later from Home.</p>}
      </div></div>
    </>
  )
}
