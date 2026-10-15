import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { isLive } from '../data/mode'
import { useDemo, type DemoState } from '../data/store'
import {
  answerCall, closeEmergency, retrySos, declineCall, elderCallContact, elderConfirm, elderSay, emergencyCancel, emergencyFire, emergencyNumber, isAnswered, tapChip,
  endCall, helperVisitsLeft, setVoice, startCheckin, triggerHelp,
} from '../data/actions'
import { Face } from '../components/Face'
import { MicIcon, Wave, useToast } from '../components/ui'
import { Tour, type TourStep } from '../components/Tour'
import { update } from '../data/store'
import { canListen, listen, speak, stopListening, stopSpeaking } from '../lib/speech'
import { activityLabel } from '../lib/activity'
import type { ActionCard, Chip, FamilyMessage, Message } from '../lib/types'

type Screen = 'home' | 'talk' | 'reminders'
type Item = { kind: 'agent'; m: Message } | { kind: 'fam'; m: FamilyMessage }

const partOfDay = () => { const h = new Date().getHours(); return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening' }

export default function ElderApp({ framed = true }: { framed?: boolean }) {
  const s = useDemo()
  const toast = useToast()
  const [screen, setScreen] = useState<Screen>('home')
  const [listening, setListening] = useState(false)
  const lang = s.elder.language

  // One timeline: assistant conversation + family thread (elder sees both).
  const items: Item[] = useMemo(() => [
    ...s.messages.map(m => ({ kind: 'agent' as const, m })),
    ...s.family.map(m => ({ kind: 'fam' as const, m })),
  ].sort((a, b) => a.m.createdAt.localeCompare(b.m.createdAt)), [s.messages, s.family])

  // Read new assistant replies and family messages aloud (low vision). Skip what was there on first load.
  const spoken = useRef<string | null>(null)
  useEffect(() => {
    const last = items[items.length - 1]
    if (!last) return
    if (spoken.current === null) { spoken.current = last.m.id; return }
    if (spoken.current === last.m.id) return
    spoken.current = last.m.id
    if (!s.elderUi.voice) return
    if (last.kind === 'agent' && last.m.sender === 'agent') speak(last.m.text, lang)
    if (last.kind === 'fam' && last.m.sender === 'caretaker') {
      speak(`Message from ${last.m.senderName}. ${last.m.text}. ${spokenChips(last.m.chips)}`, lang)
    }
  }, [items, s.elderUi.voice, lang])

  // A new message from family while on Home: stay on Home (the big card shows it). Agent replies: go to Talk.
  useEffect(() => { if (s.elderUi.typing) setScreen('talk') }, [s.elderUi.typing])

  const say = (t: string) => { setScreen('talk'); elderSay(t) }
  const mic = () => {
    if (listening) { stopListening(); return }
    if (!canListen()) { toast('Voice works in Chrome or Edge — tap a button or type instead'); setScreen('talk'); return }
    stopSpeaking(); setListening(true)
    listen(lang, t => { setListening(false); say(t) }, err => { setListening(false); if (err && err !== 'no-speech' && err !== 'aborted') toast('Microphone: ' + err) })
  }

  if (!s.onboarded.elder) return <Navigate to="/onboarding/elder" replace />

  return (
    <div className={`shell ${framed ? 'framed' : ''}`}>
      {screen === 'home' && <Home s={s} onMic={mic} listening={listening} say={say} go={setScreen} />}
      {screen === 'talk' && <Talk s={s} items={items} onMic={mic} listening={listening} say={say} back={() => setScreen('home')} />}
      {screen === 'reminders' && <Reminders s={s} back={() => setScreen('home')} />}
      <Overlay s={s} />
    </div>
  )
}

// ---------------- Home ----------------
function Home({ s, onMic, listening, say, go }: { s: DemoState; onMic: () => void; listening: boolean; say: (t: string) => void; go: (x: Screen) => void }) {
  const date = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  const people = s.contacts.filter(c => c.kind !== 'volunteer').slice(0, 4)
  const care = s.caretaker.name || 'my family'
  return (
    <>
      <div className="scroll">
        <div className="e-body">
          <p className="e-date">{date}</p>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <h1 className="e-greet grow">Good {partOfDay()},<br />{s.elder.name}</h1>
            <button className="tour-help" onClick={() => update(d => { d.tours.elder = false })} aria-label="Show me how it works">❓ Help</button>
          </div>
          <FamilyQuestion s={s} />
          <CheckInCard s={s} onDone={() => go('talk')} />
          <div className="micwrap" data-tour="e-mic">
            <button className={`mic ${listening ? 'on' : ''}`} onClick={onMic} aria-label="Speak to your helper"><MicIcon /></button>
            <p className="mic-l">{listening ? 'I’m listening…' : <>Tap and tell me<br />what you need</>}</p>
          </div>
          <h2 className="e-sec" style={{ marginTop: 4 }}>Tap a face to call</h2>
          {people.length === 0 && <p className="muted" style={{ fontSize: 18 }}>Your family will add their faces here.</p>}
          <div className="people" data-tour="e-people">
            {people.map(c => (
              <button key={c.id} onClick={() => elderCallContact(c.id)} aria-label={`Call ${c.name}`}>
                <Face k={c.face} name={c.name} size={74} />{c.name.replace('Dr. ', 'Dr ')}
              </button>
            ))}
          </div>
          <h2 className="e-sec">What do you need?</h2>
          <div className="tiles" data-tour="e-tiles">
            <button className="tile" onClick={() => say('Order my medicine')}><span className="ic">💊</span>My medicine</button>
            <button className="tile" onClick={() => say('I’m hungry, order food')}><span className="ic">🍲</span>Food</button>
            <button className="tile" onClick={() => say('Take me to the clinic')}><span className="ic">🚕</span>A ride</button>
            <button className="tile" onClick={() => say('My kitchen tap is leaking, please fix it')}><span className="ic">🔧</span>Fix something</button>
            <button className="tile" onClick={() => say(`Tell ${care} I’m OK`)}><span className="ic">💬</span>Tell {care} I’m OK</button>
            <button className="tile" onClick={() => go('reminders')}><span className="ic">⏰</span>My day</button>
          </div>
          {!isLive() && <p className="muted center" style={{ marginTop: 18, fontSize: 16 }}>Helper visits available: <b>{helperVisitsLeft(s)}</b></p>}
        </div>
      </div>
      <SosBar />
      {!s.tours.elder && <Tour big steps={elderTour(s.caretaker.name || 'your family')} onDone={() => update(d => { d.tours.elder = true })}
        onStep={st => st.say && s.elderUi.voice && speak(`${st.title}. ${st.say}`, s.elder.language)} />}
    </>
  )
}

/** Grandma's tour of her home screen — short, spoken, one thing at a time. */
function elderTour(care: string): TourStep[] {
  return [
    { target: 'e-mic', title: 'Talk to me', say: `Tap the green button and just say what you need. For example, call ${care}, or order my medicine.`,
      body: <>Tap the <b>green button</b> and just say what you need — like <b>“Call {care}”</b> or <b>“Order my medicine”</b>.</> },
    { target: 'e-family', title: `Messages from ${care}`, say: `Messages from ${care} appear here. I read them out loud. Tap a big button to answer.`,
      body: <>Messages from {care} appear here. I <b>read them out loud</b> — tap a big button to answer.</> },
    { target: 'e-checkin', title: 'How are you today?', say: 'Each day I ask how you feel. Just tap a face.',
      body: <>Each day I ask how you feel. Just <b>tap a face</b>.</> },
    { target: 'e-people', title: 'Your people', say: 'Tap a face to call someone you love.',
      body: <>Tap a <b>face</b> to call someone you love.</> },
    { target: 'e-tiles', title: 'Big buttons', say: 'You can also tap a big button for your medicine, food, a ride, or to fix something at home.',
      body: <>Or tap a big button — <b>medicine, food, a ride</b>, or to <b>fix something</b> at home.</> },
    { target: 'e-sos', title: 'Need help?', say: 'If you ever need help, press and hold the red button. Your family is told straight away.',
      body: <>If you ever need help, <b>press and hold</b> the red button. Your family is told straight away.</> },
  ]
}

function FamilyQuestion({ s }: { s: DemoState }) {
  const m = [...s.family].reverse().find(f => f.sender === 'caretaker' && f.chips.length && !isAnswered(s.family, f.id))
  const [playing, setPlaying] = useState(false)
  if (!m) return null
  const sender = s.contacts.find(c => c.name === m.senderName)
  const play = () => { setPlaying(true); speak(`${m.text}. ${spokenChips(m.chips)}`, s.elder.language); setTimeout(() => setPlaying(false), 4000) }
  return (
    <div className="fam-q" data-tour="e-family">
      <div className="who"><Face k={sender?.face ?? 'emma'} name={m.senderName} size={88} /><div><b>{m.senderName}</b><span>🔊 sent you a message</span></div></div>
      {<button className={`vplay ${playing ? 'playing' : ''}`} onClick={play} aria-label={`Play message from ${m.senderName}`}><span className="pb">▶</span><Wave /><b>0:0{Math.max(2, Math.min(9, Math.round(m.text.split(' ').length / 2.5)))}</b></button>}
      <p className="q">{m.text}</p>
      <div className="bigbtns">
        <ChipButtons m={m} />
      </div>
    </div>
  )
}

function CheckInCard({ s, onDone }: { s: DemoState; onDone: () => void }) {
  if (s.checkin.stage === 'done') return <div className="done-note">✓ Checked in today — thank you!</div>
  if (s.checkin.stage === 'meds') return <button className="done-note" style={{ border: 0, width: '100%' }} onClick={onDone}>💬 Finish your check-in ›</button>
  if (!['due', 'upcoming', 'missed'].includes(s.checkin.status)) return null
  const go = (m: 'good' | 'okay' | 'bad') => { startCheckin(m); onDone() }
  return (
    <div className="checkin" data-tour="e-checkin">
      <p>How are you feeling this {partOfDay()}?</p>
      <div className="faces3">
        <button onClick={() => go('good')}><span>😊</span>Good</button>
        <button onClick={() => go('okay')}><span>😐</span>Okay</button>
        <button onClick={() => go('bad')}><span>😟</span>Not good</button>
      </div>
    </div>
  )
}

function SosBar() {
  const [holding, setHolding] = useState(false)
  const t = useRef<number>(undefined)
  const start = () => { setHolding(true); t.current = window.setTimeout(() => { setHolding(false); triggerHelp() }, 1600) }
  const stop = () => { setHolding(false); window.clearTimeout(t.current) }
  return (
    <button data-tour="e-sos" className={`sosbar ${holding ? 'holding' : ''}`} onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') triggerHelp() }} aria-label="Press and hold for help">
      <span className="fill" /><span className="lbl">Hold for help<small>Calls your family & a neighbour</small></span>
    </button>
  )
}

// ---------------- Talk ----------------
function Talk({ s, items, onMic, listening, say, back }: { s: DemoState; items: Item[]; onMic: () => void; listening: boolean; say: (t: string) => void; back: () => void }) {
  const [text, setText] = useState('')
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [items.length, s.elderUi.typing])
  const care = s.caretaker.name
  return (
    <>
      <div className="e-top">
        <button className="e-back" onClick={back}>‹ Home</button>
        <span className="ttl">Talk</span>
        <button className="e-iconbtn" onClick={() => { setVoice(!s.elderUi.voice); if (s.elderUi.voice) stopSpeaking() }} aria-label={s.elderUi.voice ? 'Turn voice off' : 'Turn voice on'}>{s.elderUi.voice ? '🔊' : '🔇'}</button>
      </div>
      <div className="scroll">
        <div className="chat">
          {items.length === 0 && <div className="msg agent"><span className="tag">Helper</span>Hello {s.elder.name}. What can I do for you?</div>}
          {items.map(it => it.kind === 'agent' ? <AgentBubble key={it.m.id} m={it.m} last={it.m.id === s.messages[s.messages.length - 1]?.id} /> : <FamilyBubble key={it.m.id} m={it.m} s={s} />)}
          {s.elderUi.typing && <Typing s={s} />}
          <div ref={end} />
        </div>
      </div>
      <div className="e-input">
        <div className="e-quick">
          {[['📞', `Call ${care}`], ['💬', `Tell ${care} I’m OK`], ['💊', 'My medicine'], ['🔧', 'Fix something']].map(([i, l]) => (
            <button key={l} onClick={() => say(l === 'My medicine' ? 'Order my medicine' : l === 'Fix something' ? 'Something is broken, please fix it' : l)}><span>{i}</span>{l}</button>
          ))}
        </div>
        <form className="e-form" onSubmit={e => { e.preventDefault(); if (text.trim()) { say(text); setText('') } }}>
          <input value={text} onChange={e => setText(e.target.value)} placeholder="Or type here…" aria-label="Type a request" />
          <button type="button" className={`mic sm ${listening ? 'on' : ''}`} onClick={onMic} aria-label="Speak"><MicIcon /></button>
        </form>
      </div>
    </>
  )
}

/** Typing dots, plus what the helper is doing when an action runs ("Checking the weather…"). */
function Typing({ s }: { s: DemoState }) {
  const label = activityLabel(s.elderUi.activity, s.elder.language)
  return (
    <div className={'msg agent typing' + (label ? ' with-label' : '')} role="status" aria-label={label ?? 'Helper is typing'}>
      <span className="dots"><i /><i /><i /></span>{label && <span className="activity">{label}</span>}
    </div>
  )
}

function AgentBubble({ m, last }: { m: Message; last: boolean }) {
  if (m.sender === 'elder') return <div className="msg me">{m.text}</div>
  return (
    <div className="msg agent">
      <span className="tag">Helper</span>{m.text}
      {m.action && <ActionCardView a={m.action} />}
      {last && m.quickReplies.length > 0 && (
        <div className="qr" style={{ marginTop: 12 }}>{m.quickReplies.map(r => <button key={r} onClick={() => elderSay(r)}>{r}</button>)}</div>
      )}
    </div>
  )
}

const STATUS_PILL: Record<string, [string, string]> = {
  awaiting_elder: ['warn', 'Waiting for you'], awaiting_caretaker: ['plum', 'Waiting for family'], done: ['ok', 'Done'],
  handed_off: ['info', 'Ready to book'], declined: ['bad', 'Not this time'], cancelled: ['bad', 'Cancelled'], blocked: ['bad', 'Not allowed'], failed: ['bad', 'Couldn’t do it'],
}

function ActionCardView({ a }: { a: ActionCard }) {
  const [cls, label] = STATUS_PILL[a.status] ?? ['info', a.status]
  if (a.tool === 'call_contact') return null
  return (
    <div className="acard">
      <div className="h"><span>{a.title}</span><span className={`pill ${cls}`}>{label}</span></div>
      {a.lines.length > 0 && <ul>{a.lines.map(l => <li key={l}>{l}</li>)}</ul>}
      {a.amount && <p className="amt">{a.estimate ? '≈ ' : ''}{a.amount}{a.discountMinor ? <span className="pill gold" style={{ marginLeft: 8, fontSize: 13 }}>Pro −10%</span> : null}</p>}
      {(a.provider || a.eta) && <p className="muted" style={{ fontSize: 16 }}>{[a.provider, a.eta].filter(Boolean).join(' · ')}</p>}
      {a.status === 'awaiting_elder' && (
        <div className="bigbtns">
          <button className="bb yes" onClick={() => elderConfirm(a.id, true)}>Yes, please</button>
          <button className="bb no" onClick={() => elderConfirm(a.id, false)}>No, thank you</button>
        </div>
      )}
      {a.bookingUrl && a.status === 'handed_off' && <a className="bb yes" style={{ display: 'block', marginTop: 12, textDecoration: 'none' }} href={a.bookingUrl} target="_blank" rel="noreferrer">{a.bookingLabel}</a>}
    </div>
  )
}

function FamilyBubble({ m, s }: { m: FamilyMessage; s: DemoState }) {
  if (m.sender === 'system') return <p className="sysnote">{m.text}</p>
  if (m.sender === 'elder') return <div className="msg me">{m.text}<span className="to">to {s.caretaker.name} ✓</span></div>
  const sender = s.contacts.find(c => c.name === m.senderName)
  return (
    <div className="msg fam">
      <span className="who-face"><Face k={sender?.face ?? 'emma'} name={m.senderName} size={64} /><span><b>{m.senderName}</b><small>{sender?.relationship ? `your ${sender.relationship}` : 'family'}</small></span></span>
      <button className="vplay" onClick={() => speak(m.text, s.elder.language)} aria-label="Listen to this message"><span className="pb">▶</span><Wave /></button>
      {m.text}
      {!isAnswered(s.family, m.id) && m.chips.length > 0 && <ChipButtons m={m} />}
    </div>
  )
}

/** Chips from the backend (app/agent/chips.py): message → reply; ⏰ remind → sets a reminder once; 📞 call → phone. */
function ChipButtons({ m }: { m: FamilyMessage }) {
  return (
    <div className="bigbtns">
      {m.chips.map((c, i) => {
        const used = m.usedChips.includes(i)
        return (
          <button key={c.label + i} className={`bb ${i === 0 && c.kind === 'message' ? 'yes' : 'no'}`} disabled={used}
            onClick={() => tapChip('elder', m.id, i)}>{used ? `✓ ${c.label.replace(/^\S+\s/, '')} — done` : c.label}</button>
        )
      })}
    </div>
  )
}
const spokenChips = (chips: Chip[]) => chips.length ? 'You can answer: ' + chips.map(c => c.label.replace(/^[^\p{L}]+/u, '')).join(', or ') : ''

// ---------------- Reminders ("My day") ----------------
function Reminders({ s, back }: { s: DemoState; back: () => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const wd = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()]
  const nowHM = new Date().toTimeString().slice(0, 5)
  const due = s.reminders.filter(r => r.active && (r.date === today || r.days?.includes(wd as never))).sort((a, b) => a.time.localeCompare(b.time))
  return (
    <>
      <div className="e-top"><button className="e-back" onClick={back}>‹ Home</button><span className="ttl">My day</span><span style={{ width: 52 }} /></div>
      <div className="scroll"><div className="e-body">
        {due.length === 0 && <p style={{ fontSize: 20 }}>Nothing planned today. Enjoy your day! ☀️</p>}
        {due.map(r => (
          <div key={r.id} className={`rem ${r.time < nowHM ? 'past' : ''}`}>
            <b>{r.time}</b><span style={{ fontSize: 26 }}>{r.kind === 'medication' ? '💊' : r.kind === 'appointment' ? '🩺' : '⏰'}</span><span className="grow">{r.title}</span>
          </div>
        ))}
        <button className="bb no" style={{ marginTop: 10 }} onClick={() => speak(due.map(r => `At ${r.time}, ${r.title}`).join('. ') || 'Nothing planned today.', s.elder.language)}>🔊 Read my day aloud</button>
      </div></div>
    </>
  )
}

// ---------------- Overlays: calls & emergency ----------------
function Overlay({ s }: { s: DemoState }) {
  const o = s.elderUi.overlay
  const [, tick] = useState(0)
  useEffect(() => {
    if (o?.type !== 'emergency') return
    const t = window.setInterval(() => {
      tick(x => x + 1)
      if (!o.alerted && !o.sending && !o.failed && Date.now() >= o.endsAt) { window.clearInterval(t); emergencyFire() }
    }, 250)
    return () => window.clearInterval(t)
  }, [o])
  useEffect(() => { if (o?.type === 'incoming' && s.elderUi.voice) speak(`${o.who} is calling you`, s.elder.language) }, [o?.type]) // eslint-disable-line
  if (!o) return null
  if (o.type === 'emergency') {
    const num = o.number ?? emergencyNumber(s)
    if (o.sending) {
      return (
        <div className="ov sos" role="alertdialog" aria-label="Alerting your family" aria-busy="true">
          <div style={{ fontSize: 56 }}>🚨</div>
          <h2>Alerting your family…</h2>
          <p>If it’s serious, don’t wait — call {num} now.</p>
          <div className="spacer" />
          <a className="bb white" style={{ textDecoration: 'none', display: 'block', fontSize: 26 }} href={`tel:${num}`}>📞 Call {num}</a>
        </div>
      )
    }
    if (o.failed) {
      // Never pretend: the alert did NOT go through, so the elder must call directly.
      const care = s.elder.emergencyContacts[0]
      return (
        <div className="ov sos" role="alertdialog" aria-label="Could not alert your family">
          <div style={{ fontSize: 56 }}>⚠️</div>
          <h2>We couldn’t reach your family</h2>
          <p>Please call for help yourself now.</p>
          <div className="spacer" />
          <a className="bb white" style={{ textDecoration: 'none', display: 'block', fontSize: 26 }} href={`tel:${num}`}>📞 Call {num}</a>
          {care && <a className="bb dark" style={{ textDecoration: 'none', display: 'block' }} href={`tel:${care.phone.replace(/\s/g, '')}`}>📞 Call {care.name}</a>}
          <button className="bb dark" onClick={retrySos}>Try alerting again</button>
          <button className="bb dark" onClick={closeEmergency}>Close</button>
        </div>
      )
    }
    if (o.alerted) {
      const care = s.contacts.find(c => c.name === s.caretaker.name)
      return (
        <div className="ov sos" role="alertdialog" aria-label="Family alerted">
          <div style={{ fontSize: 56 }}>🚨</div>
          <h2>Your family has been alerted</h2>
          <p>If it’s serious, call {num} now. Stay where you are — help is coming.</p>
          <div className="spacer" />
          <a className="bb white" style={{ textDecoration: 'none', display: 'block', fontSize: 26 }} href={`tel:${num}`}>📞 Call {num}</a>
          {care && <a className="bb dark" style={{ textDecoration: 'none', display: 'block' }} href={`tel:${care.phone.replace(/\s/g, '')}`}>📞 Call {care.name}</a>}
          <button className="bb dark" onClick={closeEmergency}>I’m safe now</button>
        </div>
      )
    }
    const left = Math.max(0, Math.ceil((o.endsAt - Date.now()) / 1000))
    return (
      <div className="ov sos" role="alertdialog" aria-label="Alerting your family">
        <h2>Getting you help</h2>
        <p>I’ll alert your family in</p>
        <div className="count" aria-live="assertive">{left}</div>
        <div className="spacer" />
        <button className="bb white" onClick={emergencyCancel}>I’m OK — stop</button>
        <button className="bb dark" onClick={emergencyFire}>Alert them now</button>
      </div>
    )
  }
  if (o.type === 'incoming') return (
    <div className="ov call" role="alertdialog" aria-label={`${o.who} is calling`}>
      <p style={{ opacity: .85, fontSize: 18 }}>Incoming video call</p>
      <div className="ring" style={{ marginTop: 16 }}><Face k={o.face} name={o.who} size={176} /></div>
      <h2>{o.who}</h2><p style={{ opacity: .85 }}>{(() => { const c = s.contacts.find(x => x.name === o.who); return c?.relationship ? `your ${c.relationship}` : 'family' })()}</p>
      <div className="spacer" />
      <button className="bb white" onClick={answerCall}>📞 Answer</button>
      <button className="bb dark" onClick={declineCall}>Not now</button>
    </div>
  )
  return (
    <div className="ov call" role="dialog" aria-label={`Call with ${o.who}`}>
      <p style={{ opacity: .85, fontSize: 18 }}>{o.live ? 'On a call' : 'Calling…'}</p>
      <div className="ring" style={{ marginTop: 16 }}>{o.face ? <Face k={o.face} name={o.who} size={176} /> : <div style={{ width: 176, height: 176, borderRadius: '50%', background: 'rgba(255,255,255,.18)', display: 'grid', placeItems: 'center', fontSize: 80 }}>🚑</div>}</div>
      <h2>{o.who}</h2>
      <p style={{ opacity: .85 }}>{o.face ? 'Speaker is on' : 'Your location has been shared'}</p>
      <div className="spacer" />
      <button className="bb red" onClick={endCall}>End call</button>
    </div>
  )
}
