import { useEffect, useRef, useState } from 'react'
import { ackAlerts, emergencyNumber } from '../data/actions'
import { nick, type DemoState } from '../data/store'
import { timeAgo } from '../components/ui'
import { addressLine } from '../lib/types'

/** An SOS / emergency (the backend logs these as "🚨 …"). Scam warnings ("⚠️ …") stay as the red card on Home. */
const isEmergency = (l: DemoState['logs'][number]) => l.kind === 'alert' && !l.ack && l.message.startsWith('🚨')

/** "🚨 SOS — Rose may need urgent help: Rose fell… Texted Emma." → "Rose fell in the bathroom and cannot get up." */
export function whatHappened(message: string, name: string): string {
  let t = message.replace(/^🚨\s*(SOS\s*—\s*)?/, '')
  t = t.replace(new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} may need urgent help:\\s*`), '')
  t = t.replace(new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} pressed the SOS button`), 'Pressed the SOS button')
  t = t.split(/\s+(?=Texted |[^.]* (?:is|are) not texted)/)[0]   // who was texted is for the activity log, not this screen
  return t.replace(/\.{2,}/g, '.').trim()
}

/** A short alarm: two-tone beeps, if the browser lets the page make sound (the family app has usually been tapped). */
function alarm() {
  try {
    navigator.vibrate?.([500, 200, 500, 200, 900])
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    ;[0, 0.45, 0.9].forEach((t, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.frequency.value = i % 2 ? 660 : 880
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t)
      g.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + t + 0.03)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.38)
      o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.4)
    })
    window.setTimeout(() => { void ctx.close() }, 1600)
  } catch { /* no sound allowed yet — the screen itself is the alarm */ }
}

/**
 * Full-screen red takeover on the family's phone the moment the elder presses SOS or the helper raises an emergency —
 * on every tab, until someone says they're handling it (or hides it for now; the red card stays on Home).
 */
export function EmergencyOverlay({ s }: { s: DemoState }) {
  const open = s.logs.filter(isEmergency)
  const latest = open[0]
  const [hidden, setHidden] = useState<string | null>(null)
  const alarmed = useRef<string | null>(null)
  useEffect(() => {
    if (latest && alarmed.current !== latest.id) { alarmed.current = latest.id; alarm() }
  }, [latest])
  if (!latest || hidden === latest.id) return null
  const nk = nick(s)
  const what = whatHappened(latest.message, s.elder.name)
  const where = addressLine(s.elder.address)
  const phone = s.elder.phone.replace(/\s/g, '')
  const sos = emergencyNumber(s)
  return (
    <div className="sos-overlay" role="alertdialog" aria-modal="true" aria-labelledby="sos-title" aria-describedby="sos-what">
      <div className="sos-pulse" aria-hidden>🚨</div>
      <h1 id="sos-title">{nk} needs help</h1>
      <p id="sos-what" className="sos-what">{what}</p>
      <p className="sos-meta">{timeAgo(latest.timestamp)}{open.length > 1 ? ` · ${open.length} alerts` : ''}</p>
      {where && <p className="sos-where">📍 {where}</p>}
      <div className="sos-actions">
        <a className="sos-btn primary" href={`tel:${phone}`}>📞 Call {nk}</a>
        <a className="sos-btn" href={`tel:${sos}`}>🚑 Call {sos}</a>
        <button className="sos-btn" onClick={() => ackAlerts()}>✓ I’m handling it</button>
        <button className="sos-hide" onClick={() => setHidden(latest.id)}>Hide for now</button>
      </div>
    </div>
  )
}
