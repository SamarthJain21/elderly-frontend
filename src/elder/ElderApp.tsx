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
import { partOfDay, strings, type Strings } from '../lib/i18n'
import type { ActionCard, Chip, FamilyMessage, Message } from '../lib/types'

type Screen = 'home' | 'talk' | 'reminders'
type Item = { kind: 'agent'; m: Message } | { kind: 'fam'; m: FamilyMessage }

export default function ElderApp({ framed = true }: { framed?: boolean }) {
  const s = useDemo()
  const toast = useToast()
  const [screen, setScreen] = useState<Screen>('home')
  const [listening, setListening] = useState(false)
  const lang = s.elder.language
  const t = strings(lang)

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
      speak(`${t.messageFrom(last.m.senderName)} ${last.m.text}. ${spokenChips(t, last.m.chips)}`, lang)
    }
  }, [items, s.elderUi.voice, lang]) // eslint-disable-line react-hooks/exhaustive-deps

  // A new message from family while on Home: stay on Home (the big card shows it). Agent replies: go to Talk.
  useEffect(() => { if (s.elderUi.typing) setScreen('talk') }, [s.elderUi.typing])

  const say = (t: string) => { setScreen('talk'); elderSay(t) }
  const mic = () => {
    if (listening) { stopListening(); return }
    if (!canListen()) { toast(t.voiceBrowser); setScreen('talk'); return }
    stopSpeaking(); setListening(true)
    listen(lang, t => { setListening(false); say(t) }, err => { setListening(false); if (err && err !== 'no-speech' && err !== 'aborted') toast(t.micError(err)) })
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
  const t = strings(s.elder.language)
  const date = new Date().toLocaleDateString(t.locale, { weekday: 'long', day: 'numeric', month: 'long' })
  const people = s.contacts.filter(c => c.kind !== 'volunteer').slice(0, 4)
  const care = s.caretaker.name || t.myFamily
  // Live: wait for the elder's profile, so the tour is shown (and read aloud) in their language.
  const loaded = !isLive() || !!s.elder.name
  return (
    <>
      <div className="scroll">
        <div className="e-body">
          <p className="e-date">{date}</p>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <h1 className="e-greet grow">{t.greet[partOfDay()]}<br />{s.elder.name}</h1>
            <button className="tour-help" onClick={() => update(d => { d.tours.elder = false })} aria-label={t.helpAria}>{t.help}</button>
          </div>
          <FamilyQuestion s={s} />
          <CheckInCard s={s} onDone={() => go('talk')} />
          <div className="micwrap" data-tour="e-mic">
            <button className={`mic ${listening ? 'on' : ''}`} onClick={onMic} aria-label={t.micAria}><MicIcon /></button>
            <p className="mic-l">{listening ? t.listening : <>{t.tapAndTell[0]}<br />{t.tapAndTell[1]}</>}</p>
          </div>
          <h2 className="e-sec" style={{ marginTop: 4 }}>{t.tapFace}</h2>
          {people.length === 0 && <p className="muted" style={{ fontSize: 18 }}>{t.noFaces}</p>}
          <div className="people" data-tour="e-people">
            {people.map(c => (
              <button key={c.id} onClick={() => elderCallContact(c.id)} aria-label={t.callAria(c.name)}>
                <Face k={c.face} name={c.name} size={74} />{c.name.replace('Dr. ', 'Dr ')}
              </button>
            ))}
          </div>
          <h2 className="e-sec">{t.whatNeed}</h2>
          <div className="tiles" data-tour="e-tiles">
            <button className="tile" onClick={() => say(t.sayMedicine)}><span className="ic">💊</span>{t.tileMedicine}</button>
            <button className="tile" onClick={() => say(t.sayFood)}><span className="ic">🍲</span>{t.tileFood}</button>
            <button className="tile" onClick={() => say(t.sayRide)}><span className="ic">🚕</span>{t.tileRide}</button>
            <button className="tile" onClick={() => say(t.sayFix)}><span className="ic">🔧</span>{t.tileFix}</button>
            <button className="tile" onClick={() => say(t.tileOk(care))}><span className="ic">💬</span>{t.tileOk(care)}</button>
            <button className="tile" onClick={() => go('reminders')}><span className="ic">⏰</span>{t.tileDay}</button>
          </div>
          {!isLive() && <p className="muted center" style={{ marginTop: 18, fontSize: 16 }}>{t.helperVisits} <b>{helperVisitsLeft(s)}</b></p>}
        </div>
      </div>
      <SosBar t={t} aboveTour={!s.tours.elder && loaded} />
      {!s.tours.elder && loaded && <Tour big labels={t.tourUi} steps={elderTour(t, s.caretaker.name || t.yourFamily)} onDone={() => update(d => { d.tours.elder = true })}
        onStep={st => st.say && s.elderUi.voice && speak(`${st.title}. ${st.say}`, s.elder.language)} />}
    </>
  )
}

/** Grandma's tour of her home screen — short, spoken, one thing at a time, in her language. */
const TOUR_TARGETS = ['e-mic', 'e-family', 'e-checkin', 'e-people', 'e-tiles', 'e-sos']
function elderTour(t: Strings, care: string): TourStep[] {
  return t.tour(care).map((st, i) => ({ target: TOUR_TARGETS[i], title: st.title, say: st.say, body: st.body }))
}

function FamilyQuestion({ s }: { s: DemoState }) {
  const m = [...s.family].reverse().find(f => f.sender === 'caretaker' && f.chips.length && !isAnswered(s.family, f.id))
  const [playing, setPlaying] = useState(false)
  if (!m) return null
  const t = strings(s.elder.language)
  const sender = s.contacts.find(c => c.name === m.senderName)
  const play = () => { setPlaying(true); speak(`${m.text}. ${spokenChips(t, m.chips)}`, s.elder.language); setTimeout(() => setPlaying(false), 4000) }
  return (
    <div className="fam-q" data-tour="e-family">
      <div className="who"><Face k={sender?.face ?? 'emma'} name={m.senderName} size={88} /><div><b>{m.senderName}</b><span>{t.sentYou}</span></div></div>
      {<button className={`vplay ${playing ? 'playing' : ''}`} onClick={play} aria-label={t.playFrom(m.senderName)}><span className="pb">▶</span><Wave /><b>0:0{Math.max(2, Math.min(9, Math.round(m.text.split(' ').length / 2.5)))}</b></button>}
      <p className="q">{m.text}</p>
      <div className="bigbtns">
        <ChipButtons m={m} t={t} />
      </div>
    </div>
  )
}

function CheckInCard({ s, onDone }: { s: DemoState; onDone: () => void }) {
  const t = strings(s.elder.language)
  if (s.checkin.stage === 'done') return <div className="done-note">{t.checkedIn}</div>
  if (s.checkin.stage === 'meds') return <button className="done-note" style={{ border: 0, width: '100%' }} onClick={onDone}>{t.finishCheckin}</button>
  if (!['due', 'upcoming', 'missed'].includes(s.checkin.status)) return null
  const go = (m: 'good' | 'okay' | 'bad') => { startCheckin(m); onDone() }
  return (
    <div className="checkin" data-tour="e-checkin">
      <p>{t.feeling[partOfDay()]}</p>
      <div className="faces3">
        <button onClick={() => go('good')}><span>😊</span>{t.moodGood}</button>
        <button onClick={() => go('okay')}><span>😐</span>{t.moodOkay}</button>
        <button onClick={() => go('bad')}><span>😟</span>{t.moodBad}</button>
      </div>
    </div>
  )
}

/** `aboveTour`: while the first-visit tour dims the screen, SOS stays bright and tappable above it. */
function SosBar({ t, aboveTour = false }: { t: Strings; aboveTour?: boolean }) {
  const [holding, setHolding] = useState(false)
  const timer = useRef<number>(undefined)
  const start = () => { setHolding(true); timer.current = window.setTimeout(() => { setHolding(false); triggerHelp() }, 1600) }
  const stop = () => { setHolding(false); window.clearTimeout(timer.current) }
  return (
    <button data-tour="e-sos" className={`sosbar ${holding ? 'holding' : ''} ${aboveTour ? 'above-tour' : ''}`} onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') triggerHelp() }} aria-label={t.sosAria}>
      <span className="fill" /><span className="lbl">{t.sosHold}<small>{t.sosSub}</small></span>
    </button>
  )
}

// ---------------- Talk ----------------
function Talk({ s, items, onMic, listening, say, back }: { s: DemoState; items: Item[]; onMic: () => void; listening: boolean; say: (t: string) => void; back: () => void }) {
  const [text, setText] = useState('')
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [items.length, s.elderUi.typing])
  const t = strings(s.elder.language)
  const care = s.caretaker.name || t.myFamily
  return (
    <>
      <div className="e-top">
        <button className="e-back" onClick={back}>{t.home}</button>
        <span className="ttl">{t.talk}</span>
        <button className="e-iconbtn" onClick={() => { setVoice(!s.elderUi.voice); if (s.elderUi.voice) stopSpeaking() }} aria-label={s.elderUi.voice ? t.voiceOff : t.voiceOn}>{s.elderUi.voice ? '🔊' : '🔇'}</button>
      </div>
      <div className="scroll">
        <div className="chat">
          {items.length === 0 && <div className="msg agent"><span className="tag">{t.helper}</span>{t.hello(s.elder.name)}</div>}
          {items.map(it => it.kind === 'agent' ? <AgentBubble key={it.m.id} m={it.m} t={t} last={it.m.id === s.messages[s.messages.length - 1]?.id} /> : <FamilyBubble key={it.m.id} m={it.m} s={s} t={t} />)}
          {s.elderUi.typing && <Typing s={s} />}
          <div ref={end} />
        </div>
      </div>
      <div className="e-input">
        <div className="e-quick">
          {([['📞', t.callAria(care), t.sayCall(care)], ['💬', t.tileOk(care), t.tileOk(care)], ['💊', t.tileMedicine, t.sayMedicine], ['🔧', t.tileFix, t.sayFix]] as const).map(([i, l, said]) => (
            <button key={l} onClick={() => say(said)}><span>{i}</span>{l}</button>
          ))}
        </div>
        <form className="e-form" onSubmit={e => { e.preventDefault(); if (text.trim()) { say(text); setText('') } }}>
          <input value={text} onChange={e => setText(e.target.value)} placeholder={t.typeHere} aria-label={t.typeAria} />
          <button type="button" className={`mic sm ${listening ? 'on' : ''}`} onClick={onMic} aria-label={t.speak}><MicIcon /></button>
        </form>
      </div>
    </>
  )
}

/** Typing dots, plus what the helper is doing when an action runs ("Checking the weather…"). */
function Typing({ s }: { s: DemoState }) {
  const label = activityLabel(s.elderUi.activity, s.elder.language)
  return (
    <div className={'msg agent typing' + (label ? ' with-label' : '')} role="status" aria-label={label ?? strings(s.elder.language).typing}>
      <span className="dots"><i /><i /><i /></span>{label && <span className="activity">{label}</span>}
    </div>
  )
}

function AgentBubble({ m, last, t }: { m: Message; last: boolean; t: Strings }) {
  if (m.sender === 'elder') return <div className="msg me">{m.text}</div>
  return (
    <div className="msg agent">
      <span className="tag">{t.helper}</span>{m.text}
      {m.action && <ActionCardView a={m.action} t={t} />}
      {last && m.quickReplies.length > 0 && (
        <div className="qr" style={{ marginTop: 12 }}>{m.quickReplies.map(r => <button key={r} onClick={() => elderSay(r)}>{r}</button>)}</div>
      )}
    </div>
  )
}

const STATUS_CLASS: Record<string, string> = {
  awaiting_elder: 'warn', awaiting_caretaker: 'plum', done: 'ok', handed_off: 'info', declined: 'bad', cancelled: 'bad', blocked: 'bad', failed: 'bad',
}

function ActionCardView({ a, t }: { a: ActionCard; t: Strings }) {
  const cls = STATUS_CLASS[a.status] ?? 'info'
  const label = t.status[a.status] ?? a.status
  if (a.tool === 'call_contact') return null
  return (
    <div className="acard">
      <div className="h"><span>{t.tool[a.tool] ?? a.title}</span><span className={`pill ${cls}`}>{label}</span></div>
      {a.lines.length > 0 && <ul>{a.lines.map(l => <li key={l}>{l}</li>)}</ul>}
      {a.amount && <p className="amt">{a.estimate ? '≈ ' : ''}{a.amount}{a.discountMinor ? <span className="pill gold" style={{ marginLeft: 8, fontSize: 13 }}>Pro −10%</span> : null}</p>}
      {(a.provider || a.eta) && <p className="muted" style={{ fontSize: 16 }}>{[a.provider, a.eta].filter(Boolean).join(' · ')}</p>}
      {a.status === 'awaiting_elder' && (
        <div className="bigbtns">
          <button className="bb yes" onClick={() => elderConfirm(a.id, true)}>{t.yesPlease}</button>
          <button className="bb no" onClick={() => elderConfirm(a.id, false)}>{t.noThanks}</button>
        </div>
      )}
      {a.bookingUrl && a.status === 'handed_off' && <a className="bb yes" style={{ display: 'block', marginTop: 12, textDecoration: 'none' }} href={a.bookingUrl} target="_blank" rel="noreferrer">{a.bookingLabel}</a>}
    </div>
  )
}

function FamilyBubble({ m, s, t }: { m: FamilyMessage; s: DemoState; t: Strings }) {
  if (m.sender === 'system') return <p className="sysnote">{m.text}</p>
  if (m.sender === 'elder') return <div className="msg me">{m.text}<span className="to">{t.sentTo(s.caretaker.name || t.yourFamily)}</span></div>
  const sender = s.contacts.find(c => c.name === m.senderName)
  return (
    <div className="msg fam">
      <span className="who-face"><Face k={sender?.face ?? 'emma'} name={m.senderName} size={64} /><span><b>{m.senderName}</b><small>{sender?.relationship ? t.yourRel(sender.relationship) : t.family}</small></span></span>
      <button className="vplay" onClick={() => speak(m.text, s.elder.language)} aria-label={t.listenMsg}><span className="pb">▶</span><Wave /></button>
      {m.text}
      {!isAnswered(s.family, m.id) && m.chips.length > 0 && <ChipButtons m={m} t={t} />}
    </div>
  )
}

/** Chips from the backend (app/agent/chips.py): message → reply; ⏰ remind → sets a reminder once; 📞 call → phone. */
function ChipButtons({ m, t }: { m: FamilyMessage; t: Strings }) {
  return (
    <div className="bigbtns">
      {m.chips.map((c, i) => {
        const used = m.usedChips.includes(i)
        return (
          <button key={c.label + i} className={`bb ${i === 0 && c.kind === 'message' ? 'yes' : 'no'}`} disabled={used}
            onClick={() => tapChip('elder', m.id, i)}>{used ? `✓ ${c.label.replace(/^\S+\s/, '')} — ${t.done}` : c.label}</button>
        )
      })}
    </div>
  )
}
const spokenChips = (t: Strings, chips: Chip[]) => chips.length ? `${t.youCanAnswer} ` + chips.map(c => c.label.replace(/^[^\p{L}]+/u, '')).join(t.or) : ''

// ---------------- Reminders ("My day") ----------------
function Reminders({ s, back }: { s: DemoState; back: () => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const wd = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()]
  const nowHM = new Date().toTimeString().slice(0, 5)
  const t = strings(s.elder.language)
  const due = s.reminders.filter(r => r.active && (r.date === today || r.days?.includes(wd as never))).sort((a, b) => a.time.localeCompare(b.time))
  return (
    <>
      <div className="e-top"><button className="e-back" onClick={back}>{t.home}</button><span className="ttl">{t.myDay}</span><span style={{ width: 52 }} /></div>
      <div className="scroll"><div className="e-body">
        {due.length === 0 && <p style={{ fontSize: 20 }}>{t.nothingToday}</p>}
        {due.map(r => (
          <div key={r.id} className={`rem ${r.time < nowHM ? 'past' : ''}`}>
            <b>{r.time}</b><span style={{ fontSize: 26 }}>{r.kind === 'medication' ? '💊' : r.kind === 'appointment' ? '🩺' : '⏰'}</span><span className="grow">{r.title}</span>
          </div>
        ))}
        <button className="bb no" style={{ marginTop: 10 }} onClick={() => speak(due.map(r => t.atTime(r.time, r.title)).join('. ') || t.nothingTodaySay, s.elder.language)}>{t.readDay}</button>
      </div></div>
    </>
  )
}

// ---------------- Overlays: calls & emergency ----------------
function Overlay({ s }: { s: DemoState }) {
  const o = s.elderUi.overlay
  const t = strings(s.elder.language)
  const [, tick] = useState(0)
  useEffect(() => {
    if (o?.type !== 'emergency') return
    const t = window.setInterval(() => {
      tick(x => x + 1)
      if (!o.alerted && !o.sending && !o.failed && Date.now() >= o.endsAt) { window.clearInterval(t); emergencyFire() }
    }, 250)
    return () => window.clearInterval(t)
  }, [o])
  useEffect(() => { if (o?.type === 'incoming' && s.elderUi.voice) speak(t.isCalling(o.who), s.elder.language) }, [o?.type]) // eslint-disable-line
  if (!o) return null
  if (o.type === 'emergency') {
    const num = o.number ?? emergencyNumber(s)
    if (o.sending) {
      return (
        <div className="ov sos" role="alertdialog" aria-label={t.alertingAria} aria-busy="true">
          <div style={{ fontSize: 56 }}>🚨</div>
          <h2>{t.alerting}</h2>
          <p>{t.seriousCall(num)}</p>
          <div className="spacer" />
          <a className="bb white" style={{ textDecoration: 'none', display: 'block', fontSize: 26 }} href={`tel:${num}`}>{t.callNum(num)}</a>
        </div>
      )
    }
    if (o.failed) {
      // Never pretend: the alert did NOT go through, so the elder must call directly.
      const care = s.elder.emergencyContacts[0]
      return (
        <div className="ov sos" role="alertdialog" aria-label={t.couldntReach}>
          <div style={{ fontSize: 56 }}>⚠️</div>
          <h2>{t.couldntReach}</h2>
          <p>{t.callYourself}</p>
          <div className="spacer" />
          <a className="bb white" style={{ textDecoration: 'none', display: 'block', fontSize: 26 }} href={`tel:${num}`}>{t.callNum(num)}</a>
          {care && <a className="bb dark" style={{ textDecoration: 'none', display: 'block' }} href={`tel:${care.phone.replace(/\s/g, '')}`}>{t.callNum(care.name)}</a>}
          <button className="bb dark" onClick={retrySos}>{t.tryAgain}</button>
          <button className="bb dark" onClick={closeEmergency}>{t.close}</button>
        </div>
      )
    }
    if (o.alerted) {
      const care = s.contacts.find(c => c.name === s.caretaker.name)
      return (
        <div className="ov sos" role="alertdialog" aria-label={t.alerted}>
          <div style={{ fontSize: 56 }}>🚨</div>
          <h2>{t.alerted}</h2>
          <p>{t.alertedBody(num)}</p>
          <div className="spacer" />
          <a className="bb white" style={{ textDecoration: 'none', display: 'block', fontSize: 26 }} href={`tel:${num}`}>{t.callNum(num)}</a>
          {care && <a className="bb dark" style={{ textDecoration: 'none', display: 'block' }} href={`tel:${care.phone.replace(/\s/g, '')}`}>{t.callNum(care.name)}</a>}
          <button className="bb dark" onClick={closeEmergency}>{t.safeNow}</button>
        </div>
      )
    }
    const left = Math.max(0, Math.ceil((o.endsAt - Date.now()) / 1000))
    return (
      <div className="ov sos" role="alertdialog" aria-label={t.alertingAria}>
        <h2>{t.gettingHelp}</h2>
        <p>{t.alertIn}</p>
        <div className="count" aria-live="assertive">{left}</div>
        <div className="spacer" />
        <button className="bb white" onClick={emergencyCancel}>{t.imOk}</button>
        <button className="bb dark" onClick={emergencyFire}>{t.alertNow}</button>
      </div>
    )
  }
  if (o.type === 'incoming') return (
    <div className="ov call" role="alertdialog" aria-label={`${o.who} is calling`}>
      <p style={{ opacity: .85, fontSize: 18 }}>{t.incoming}</p>
      <div className="ring" style={{ marginTop: 16 }}><Face k={o.face} name={o.who} size={176} /></div>
      <h2>{o.who}</h2><p style={{ opacity: .85 }}>{(() => { const c = s.contacts.find(x => x.name === o.who); return c?.relationship ? t.yourRel(c.relationship) : t.family })()}</p>
      <div className="spacer" />
      <button className="bb white" onClick={answerCall}>{t.answer}</button>
      <button className="bb dark" onClick={declineCall}>{t.notNow}</button>
    </div>
  )
  return (
    <div className="ov call" role="dialog" aria-label={`Call with ${o.who}`}>
      <p style={{ opacity: .85, fontSize: 18 }}>{o.live ? t.onCall : t.calling}</p>
      <div className="ring" style={{ marginTop: 16 }}>{o.face ? <Face k={o.face} name={o.who} size={176} /> : <div style={{ width: 176, height: 176, borderRadius: '50%', background: 'rgba(255,255,255,.18)', display: 'grid', placeItems: 'center', fontSize: 80 }}>🚑</div>}</div>
      <h2>{o.who}</h2>
      <p style={{ opacity: .85 }}>{o.face ? t.speakerOn : t.locationShared}</p>
      <div className="spacer" />
      <button className="bb red" onClick={endCall}>{t.endCall}</button>
    </div>
  )
}
