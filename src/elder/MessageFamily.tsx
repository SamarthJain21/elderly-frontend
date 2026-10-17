import { useEffect, useState } from 'react'
import { elderFamilyReply } from '../data/actions'
import type { DemoState } from '../data/store'
import { MicIcon } from '../components/ui'
import { strings } from '../lib/i18n'
import { canListen, listen, speak, stopListening } from '../lib/speech'

/**
 * "Message Priya": the elder's own words straight into the family chat — no helper in between, so nothing is
 * reworded. One-tap messages, or speak (or type), see exactly what will go, then Send. Always available, like calling.
 */
export function MessageFamily({ s, back }: { s: DemoState; back: () => void }) {
  const t = strings(s.elder.language)
  const lang = s.elder.language
  const care = s.caretaker.name || t.myFamily
  const [draft, setDraft] = useState('')
  const [listening, setListening] = useState(false)
  const [sent, setSent] = useState(false)
  useEffect(() => () => stopListening(), [])

  const send = (text: string) => {
    const msg = text.trim()
    if (!msg) return
    elderFamilyReply(msg)
    setSent(true); setDraft('')
    speak(t.msgSent(care), lang)
  }
  const mic = () => {
    if (listening) { stopListening(); return }
    setListening(true)
    listen(lang, said => setDraft(d => (d ? `${d} ${said}` : said)), () => setListening(false))
  }

  return (
    <>
      <div className="e-top"><button className="e-back" onClick={back}>{t.home}</button><span className="ttl">{t.tileMsg(care)}</span><span style={{ width: 52 }} /></div>
      <div className="scroll"><div className="e-body stack" style={{ gap: 14 }}>
        {sent ? <>
          <p className="msg-sent" role="status">{t.msgSent(care)}</p>
          <button className="bb yes" onClick={back}>{t.home}</button>
          <button className="bb no" onClick={() => setSent(false)}>{t.tileMsg(care)}</button>
        </> : <>
          {[t.msgOk, t.msgCall, t.msgLove].map(m => <button key={m} className="bb no" onClick={() => send(m)}>{m}</button>)}
          {canListen() && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <button className={`mic ${listening ? 'on' : ''}`} onClick={mic} aria-label={t.msgSpeak}><MicIcon /></button>
              <p style={{ fontSize: 19, fontWeight: 700, marginTop: 8 }}>{listening ? t.msgListening : t.msgSpeak}</p>
            </div>
          )}
          <label className="field" style={{ fontSize: 18 }}>{t.msgOrType}
            <textarea rows={3} maxLength={1000} value={draft} onChange={e => setDraft(e.target.value)} style={{ fontSize: 22 }} />
          </label>
          {draft.trim() && <>
            <button className="bb yes" onClick={() => send(draft)}>{t.msgSend(care)}</button>
            <button className="bb no" onClick={() => setDraft('')}>{t.msgClear}</button>
          </>}
        </>}
      </div></div>
    </>
  )
}
