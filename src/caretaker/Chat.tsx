import { useEffect, useRef, useState } from 'react'
import { nick, useDemo } from '../data/store'
import { caretakerCall, caretakerSend, isAnswered, isFollowedUp, markCaretakerRead, tapChip } from '../data/actions'
import { Face } from '../components/Face'
import { clock, useToast } from '../components/ui'
import { CHead } from './CaretakerApp'

/**
 * Family chat — exactly the backend's WebSocket protocol (app/routers/chat.py):
 *   send:    family_message {text}            → the backend attaches chips for the elder
 *   receive: family_message / family_update   → the elder's replies carry next-step chips for you
 *   tap:     message chip → family_message; ⏰ remind chip → family_action {messageId, chip}; 📞 call chip → tel:
 * The first three presets match the backend's built-in presets, so the elder gets answers instantly (no AI call).
 */
const PRESETS = ['Did you take your medicine?', 'How are you feeling today?', 'Shall I order dinner?', 'I’ll call you tonight']

export default function Chat() {
  const s = useDemo()
  const toast = useToast()
  const nk = nick(s)
  const [text, setText] = useState('')
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => { markCaretakerRead() }, [s.family.length])
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [s.family.length])

  const send = (t: string) => { caretakerSend(t); toast(`Sent — ${nk} will hear it read aloud`) }
  const lastElder = [...s.family].reverse().find(f => f.sender === 'elder')

  return (
    <>
      <CHead title={nk} sub={`● At home${s.checkin.stage === 'done' ? ' · checked in today' : ''}`}
        right={<><Face k={s.elder.face} name={s.elder.name} size={44} /><a className="btn sm" href={`tel:${s.elder.phone.replace(/\s/g, '')}`} onClick={() => { caretakerCall(); toast(`Calling ${nk}…`) }} aria-label={`Call ${nk}`}>📞</a></>} />
      <div className="scroll p-thread">
        <p className="small muted center" style={{ margin: '4px 0 10px' }}>🔊 Your messages are read aloud on {nk}’s phone, with big buttons to answer.</p>
        {s.family.map(m => {
          if (m.sender === 'system') return <p key={m.id} className="sysnote">{m.text}</p>
          if (m.sender === 'caretaker') return (
            <div key={m.id} className="pm me">{m.text}<span className="meta">{clock(m.createdAt)} · {isAnswered(s.family, m.id) ? 'answered' : 'delivered'}</span></div>
          )
          // The elder's message, with the backend's next-step chips (shown on the latest one until you follow up).
          const showChips = m.id === lastElder?.id && m.chips.length > 0 && !isFollowedUp(s.family, m.id)
          return (
            <div key={m.id}>
              <div className="pm mom">
                <span className="who"><Face k={s.elder.face} name={s.elder.name} size={26} />{nk}{m.viaAgent ? ' · via helper' : ''}</span>
                {m.text}<span className="meta">{clock(m.createdAt)}</span>
              </div>
              {showChips && (
                <div className="row" style={{ flexWrap: 'wrap', gap: 6, margin: '2px 0 12px' }}>
                  {m.chips.map((c, i) => {
                    const used = m.usedChips.includes(i)
                    return (
                      <button key={c.label + i} className="btn sm" disabled={used}
                        style={{ borderColor: 'var(--accent)', color: 'var(--accent)', borderStyle: c.kind === 'action' ? 'solid' : 'dashed' }}
                        onClick={() => tapChip('caretaker', m.id, i)}>
                        {used ? `✓ ${c.label}` : c.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
        <div ref={end} />
      </div>
      <div className="p-input">
        <div className="row" style={{ gap: 6, overflowX: 'auto', paddingBottom: 8, scrollbarWidth: 'none' }}>
          {PRESETS.map(t => <button key={t} className="btn sm" style={{ flex: 'none', borderRadius: 999 }} onClick={() => send(t)}>{t}</button>)}
        </div>
        <form className="p-form" onSubmit={e => { e.preventDefault(); if (text.trim()) { send(text.trim()); setText('') } }}>
          <input value={text} maxLength={1000} onChange={e => setText(e.target.value)} placeholder={`Message ${nk}…`} aria-label={`Message ${nk}`} />
          <button className="btn pri" type="submit">Send</button>
        </form>
      </div>
    </>
  )
}
