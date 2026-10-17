import { useEffect, useState } from 'react'
import { api } from '../data/live'
import type { DemoState } from '../data/store'
import { strings } from '../lib/i18n'
import { pinProblem } from '../lib/pin'
import { speak } from '../lib/speech'

/** Big keypad: 4 numbers, then the same 4 again. Saved on the server as a hash (app/elder_pin.py). */
export function PinScreen({ s, back }: { s: DemoState; back: () => void }) {
  const t = strings(s.elder.language)
  const lang = s.elder.language
  const [first, setFirst] = useState<string | null>(null)
  const [cur, setCur] = useState('')
  const [note, setNote] = useState(t.pinEnter)
  const [done, setDone] = useState(false)
  const tell = (m: string) => { setNote(m); speak(m, lang) }
  useEffect(() => { speak(t.pinEnter, lang) }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  const press = (d: string) => {
    if (done) return
    const next = (cur + d).slice(0, 4)
    setCur(next)
    if (next.length < 4) return
    window.setTimeout(() => {
      setCur('')
      if (first === null) {
        if (pinProblem(next)) { tell(t.pinWeak); return }
        setFirst(next); tell(t.pinAgain); return
      }
      if (next !== first) { setFirst(null); tell(t.pinMismatch); return }
      api.setPin(s.live.elderId!, next).then(() => { setDone(true); tell(t.pinSaved) }, () => { setFirst(null); tell(t.pinFailed) })
    }, 250)
  }
  return (
    <>
      <div className="e-top"><button className="e-back" onClick={back}>{t.myDay}</button><span className="ttl">{t.pinTitle}</span><span style={{ width: 52 }} /></div>
      <div className="scroll"><div className="e-body pin-pad">
        <p className="pin-note" aria-live="polite">{done ? '✅ ' : ''}{note}</p>
        {!done && <>
          <div className="pin-dots" aria-hidden>{[0, 1, 2, 3].map(i => <i key={i} className={i < cur.length ? 'on' : ''} />)}</div>
          <div className="pin-keys">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => <button key={d} onClick={() => press(d)}>{d}</button>)}
            <span />
            <button onClick={() => press('0')}>0</button>
            <button onClick={() => setCur(c => c.slice(0, -1))} aria-label={t.pinDelete}>⌫</button>
          </div>
        </>}
        {done && <button className="bb yes" onClick={back}>{t.myDay}</button>}
      </div></div>
    </>
  )
}
